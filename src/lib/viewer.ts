export type AuthProviderName = "firebase" | "supabase";

/** The signed-in shopper or admin as verified by the server. */
export interface PublicViewer {
  /** Stable profile id, e.g. "firebase:<uid>" or "supabase:<uuid>". */
  id: string;
  provider: AuthProviderName;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  /** Listed in ADMIN_EMAILS: can also give and remove other people's admin access. */
  isOwner: boolean;
  /** When a time-limited admin grant ends (ISO date); null when it doesn't expire. */
  adminUntil: string | null;
}
