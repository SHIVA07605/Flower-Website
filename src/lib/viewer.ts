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
}
