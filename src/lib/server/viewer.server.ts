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
    emailVerified: Boolean(user.email_confirmed_at),
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

async function buildViewer(provider: AuthProviderName, token: string): Promise<Viewer | null> {
  const identity =
    provider === "supabase" ? await verifySupabaseToken(token) : await verifyFirebaseToken(token);
  if (!identity) return null;

  const id = `${identity.provider}:${identity.uid}`;
  const { adminEmails } = serverEnv();
  const allowlisted =
    identity.email !== null && identity.emailVerified && adminEmails.includes(identity.email);
  const role = await syncProfile(identity, id);

  return {
    id,
    uid: identity.uid,
    provider: identity.provider,
    email: identity.email,
    emailVerified: identity.emailVerified,
    name: identity.name ?? identity.email?.split("@")[0] ?? "Shopper",
    avatarUrl: identity.avatarUrl,
    isAdmin: allowlisted || role === "admin",
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

export function toPublicViewer(viewer: Viewer): PublicViewer {
  return {
    id: viewer.id,
    provider: viewer.provider,
    email: viewer.email,
    name: viewer.name,
    avatarUrl: viewer.avatarUrl,
    isAdmin: viewer.isAdmin,
  };
}

export function requireViewer(viewer: Viewer | null): Viewer {
  if (!viewer) throw new ServiceError("Please sign in to continue.", 401);
  return viewer;
}

export function requireAdmin(viewer: Viewer | null): Viewer {
  const v = requireViewer(viewer);
  if (!v.isAdmin) throw new ServiceError("This account doesn't have admin access.", 403);
  return v;
}
