import { getServiceDb } from "./db.server";
import { ServiceError } from "./env.server";

/**
 * Caps how often one caller can use the public, unauthenticated-or-cheap actions: fake
 * pay-on-delivery orders, guessing order numbers, newsletter spam and draining AI credits.
 *
 * Counts live in Postgres (`hit_rate_limit`, see supabase/migrations) so every server
 * instance shares them. Until that migration runs, or if the database is unreachable, each
 * instance counts in memory instead — weaker on serverless, but never fails open entirely.
 */
export interface Limit {
  name: string;
  max: number;
  windowSeconds: number;
}

export const LIMITS = {
  /** Attempts, not just successes: leaves room for a shopper fixing a typo or two. */
  placeOrder: { name: "order", max: 10, windowSeconds: 15 * 60 },
  /** Order numbers are sequential, so guessing them must stay slow. */
  trackOrder: { name: "track", max: 10, windowSeconds: 10 * 60 },
  newsletter: { name: "newsletter", max: 5, windowSeconds: 60 * 60 },
  review: { name: "review", max: 5, windowSeconds: 60 * 60 },
  /** Each finder request can cost an AI call. */
  finder: { name: "finder", max: 10, windowSeconds: 10 * 60 },
} satisfies Record<string, Limit>;

export const RATE_LIMITED =
  "You're doing that a little too often. Please wait a few minutes and try again.";

const memory = new Map<string, { start: number; hits: number }>();
const MEMORY_MAX_KEYS = 5000;

function hitInMemory(key: string, limit: Limit, now = Date.now()): boolean {
  const windowMs = limit.windowSeconds * 1000;
  if (memory.size > MEMORY_MAX_KEYS) {
    for (const [k, v] of memory) if (now - v.start > windowMs) memory.delete(k);
    if (memory.size > MEMORY_MAX_KEYS) memory.clear();
  }
  const entry = memory.get(key);
  if (!entry || now - entry.start > windowMs) {
    memory.set(key, { start: now, hits: 1 });
    return true;
  }
  entry.hits += 1;
  return entry.hits <= limit.max;
}

/** Stores a hash, never the raw IP address or account id. */
async function hashKey(limit: Limit, who: string): Promise<string> {
  const bytes = new TextEncoder().encode(`reelmark:${limit.name}:${who}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const hex = Array.from(digest.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${limit.name}:${hex}`;
}

let warnedNoTable = false;

/** Throws a 429 ServiceError when `who` (an IP or account id) is over the limit. */
export async function enforceLimit(limit: Limit, who: string): Promise<void> {
  const key = await hashKey(limit, who);
  let allowed: boolean;
  const db = getServiceDb();
  if (db) {
    const { data, error } = await db.rpc("hit_rate_limit", {
      p_key: key,
      p_limit: limit.max,
      p_window_seconds: limit.windowSeconds,
    });
    if (error) {
      if (!warnedNoTable) {
        warnedNoTable = true;
        console.warn(
          "[rate-limit] database limiter unavailable, counting in memory:",
          error.message,
        );
      }
      allowed = hitInMemory(key, limit);
    } else {
      allowed = data === true;
    }
  } else {
    allowed = hitInMemory(key, limit);
  }
  if (!allowed) throw new ServiceError(RATE_LIMITED, 429);
}

/**
 * The caller's IP as reported by the hosting platform. Only headers the platform itself
 * sets are trusted, so a client can't dodge the limit by sending its own.
 */
export async function clientAddress(): Promise<string> {
  const { getRequestHeader, getRequestIP } = await import("@tanstack/react-start/server");
  const onVercel = typeof process !== "undefined" && Boolean(process.env["VERCEL"]);
  const first = (value: string | undefined) => value?.split(",")[0]?.trim() || undefined;
  const ip = onVercel
    ? (first(getRequestHeader("x-real-ip")) ?? first(getRequestHeader("x-vercel-forwarded-for")))
    : first(getRequestHeader("cf-connecting-ip"));
  return ip ?? getRequestIP({ xForwardedFor: true }) ?? "unknown";
}

/** For tests. */
export function resetMemoryLimits() {
  memory.clear();
}
