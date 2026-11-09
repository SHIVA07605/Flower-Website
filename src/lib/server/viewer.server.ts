import { createRemoteJWKSet, jwtVerify } from "jose";

import type { AuthProviderName, PublicViewer } from "../viewer";
import { getAnonDb, getServiceDb, isMissingTable } from "./db.server";
import { serverEnv, ServiceError } from "./env.server";

/** A verified caller. Only ever built from a token checked on the server. */
export interface Viewer extends PublicViewer {
  uid: string;
  emailVerified: boolean;
}

interface Identity {
  provider: AuthProviderName;
  uid: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
}

// Google's public keys for Firebase ID tokens; jose caches them between requests.
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

const str = (value: unknown) =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

async function verifyFirebaseToken(token: string): Promise<Identity | null> {
  const projectId = serverEnv().firebaseProjectId;
  try {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ["RS256"],
    });
    const uid = str(payload.sub);
    if (!uid) return null;
    return {
      provider: "firebase",
      uid,
      email: str(payload["email"])?.toLowerCase() ?? null,
      emailVerified: payload["email_verified"] === true,
      name: str(payload["name"]),
      avatarUrl: str(payload["picture"]),
    };
  } catch (error) {
    console.warn("[auth] Firebase token rejected:", (error as Error).message);
    return null;
  }
}

/**
 * Whether Supabase makes people click a confirmation link before an email counts as theirs.
 * With "Confirm email" switched off, Supabase marks every sign-up as confirmed, so anyone
 * could register an admin's address (or a shopper's, to read their guest orders). Checked
 * from the live auth settings rather than assumed; fails closed if they can't be read.
 */
let confirmsEmails: { value: boolean; expires: number } | undefined;
const SETTINGS_TTL_MS = 10 * 60_000;

export async function supabaseConfirmsEmails(): Promise<boolean> {
  const now = Date.now();
  if (confirmsEmails && confirmsEmails.expires > now) return confirmsEmails.value;
  const { supabaseUrl, supabaseAnonKey } = serverEnv();
  let value = false;
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
        headers: { apikey: supabaseAnonKey },
      });
      if (res.ok) {
        const settings = (await res.json()) as { mailer_autoconfirm?: unknown };
        value = settings.mailer_autoconfirm === false;
        if (!value) {
          console.warn(
            "[auth] Supabase 'Confirm email' is off: email/password accounts won't be trusted for admin access or order lookups by email.",
          );
        }
      }
    } catch (error) {
      console.warn("[auth] couldn't read Supabase auth settings:", (error as Error).message);
    }
  }
  // Remember a failed lookup only briefly so a blip doesn't lock admins out for long.
  confirmsEmails = { value, expires: now + (value ? SETTINGS_TTL_MS : 30_000) };
  return value;
}

async function verifySupabaseToken(token: string): Promise<Identity | null> {
  const db = getServiceDb() ?? getAnonDb();
  if (!db) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const user = data.user;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    provider: "supabase",
    uid: user.id,
    email: user.email?.toLowerCase() ?? null,
    emailVerified: Boolean(user.email_confirmed_at) && (await supabaseConfirmsEmails()),
    name: str(meta["full_name"]) ?? str(meta["name"]) ?? str(meta["username"]),
    avatarUrl: str(meta["avatar_url"]) ?? str(meta["picture"]),
  };
}

/** Upserts the shopper's profile and returns the role stored in the database (if reachable). */
async function syncProfile(
  identity: Identity,
  profileId: string,
): Promise<"admin" | "user" | null> {
  const db = getServiceDb();
  if (!db) return null;
  const { data, error } = await db
    .from("profiles")
    .upsert(
      {
        id: profileId,
        provider: identity.provider,
        email: identity.email,
        display_name: identity.name,
        avatar_url: identity.avatarUrl,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("role")
    .single();
  if (error) {
    if (!isMissingTable(error)) console.warn("[auth] profile sync failed:", error.message);
    return null;
  }
  return data?.role === "admin" ? "admin" : "user";
}

/**
 * Admin access an owner granted to this email (see the admin_grants table). Returns when it
 * ends: null for "until removed", undefined when there is no active grant.
 */
async function activeGrant(email: string | null): Promise<Date | null | undefined> {
  const db = getServiceDb();
  if (!db || !email) return undefined;
  const { data, error } = await db
    .from("admin_grants")
    .select("expires_at")
    .eq("email", email)
    .maybeSingle();
  if (error) {
    if (!isMissingTable(error)) console.warn("[auth] admin grant lookup failed:", error.message);
    return undefined;
  }
  if (!data) return undefined;
  if (data.expires_at === null) return null;
  const until = new Date(data.expires_at as string);
  return until.getTime() > Date.now() ? until : undefined;
}

async function buildViewer(provider: AuthProviderName, token: string): Promise<Viewer | null> {
  const identity =
    provider === "supabase" ? await verifySupabaseToken(token) : await verifyFirebaseToken(token);
  if (!identity) return null;

  const id = `${identity.provider}:${identity.uid}`;
  const { adminEmails } = serverEnv();
  // Every admin route depends on the email really belonging to the caller.
  const verifiedEmail = identity.emailVerified ? identity.email : null;
  const isOwner = verifiedEmail !== null && adminEmails.includes(verifiedEmail);
  const [role, grant] = await Promise.all([
    syncProfile(identity, id),
    isOwner ? Promise.resolve(undefined) : activeGrant(verifiedEmail),
  ]);

  return {
    id,
    uid: identity.uid,
    provider: identity.provider,
    email: identity.email,
    emailVerified: identity.emailVerified,
    name: identity.name ?? identity.email?.split("@")[0] ?? "Shopper",
    avatarUrl: identity.avatarUrl,
    isOwner,
    isAdmin: isOwner || role === "admin" || grant !== undefined,
    adminUntil: !isOwner && role !== "admin" && grant ? grant.toISOString() : null,
  };
}

// Several server functions often fire together (e.g. the admin dashboard); verify once.
const cache = new Map<string, { expires: number; viewer: Promise<Viewer | null> }>();
const CACHE_MS = 60_000;

export async function resolveViewer(
  authorization: string | undefined,
  providerHeader: string | undefined,
): Promise<Viewer | null> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;
  const provider: AuthProviderName =
    providerHeader?.trim().toLowerCase() === "supabase" ? "supabase" : "firebase";

  const key = `${provider}:${token}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.viewer;

  if (cache.size > 500) {
    for (const [k, v] of cache) if (v.expires <= now) cache.delete(k);
    if (cache.size > 500) cache.clear();
  }

  const pending = buildViewer(provider, token).catch((error: unknown) => {
    console.warn("[auth] could not verify caller:", error);
    return null;
  });
  cache.set(key, { expires: now + CACHE_MS, viewer: pending });
  const viewer = await pending;
  if (!viewer) cache.delete(key);
  return viewer;
}

/** Re-check everyone on their next request, e.g. after admin access was removed. */
export function forgetCachedViewers() {
  cache.clear();
}

export function toPublicViewer(viewer: Viewer): PublicViewer {
  return {
    id: viewer.id,
    provider: viewer.provider,
    email: viewer.email,
    name: viewer.name,
    avatarUrl: viewer.avatarUrl,
    isAdmin: viewer.isAdmin,
    isOwner: viewer.isOwner,
    adminUntil: viewer.adminUntil,
  };
}

export function requireViewer(viewer: Viewer | null): Viewer {
  if (!viewer) throw new ServiceError("Please sign in to continue.", 401);
  return viewer;
}

export function requireAdmin(viewer: Viewer | null): Viewer {
  const v = requireViewer(viewer);
  // A time-limited grant stops working the moment it ends, even mid-session.
  const expired = v.adminUntil !== null && new Date(v.adminUntil).getTime() <= Date.now();
  if (!v.isAdmin || expired) {
    throw new ServiceError(
      expired
        ? "Your admin access has ended. Ask the owner to extend it."
        : "This account doesn't have admin access.",
      403,
    );
  }
  return v;
}

/** Owners (the ADMIN_EMAILS setting) are the only ones who can decide who else is an admin. */
export function requireOwner(viewer: Viewer | null): Viewer {
  const v = requireAdmin(viewer);
  if (!v.isOwner)
    throw new ServiceError("Only the shop owner can change who has admin access.", 403);
  return v;
}
