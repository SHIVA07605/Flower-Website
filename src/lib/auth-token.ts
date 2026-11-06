import { auth, firebaseReady } from "./firebase";
import { isSupabaseConfigured, supabase } from "./supabase";

/**
 * Headers proving who the current shopper is, for server-function calls. Google sign-in
 * goes through Firebase; email/password through Supabase. Empty for guests and on the server.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};

  await firebaseReady;
  const firebaseUser = auth.currentUser;
  if (firebaseUser) {
    try {
      const token = await firebaseUser.getIdToken();
      return { authorization: `Bearer ${token}`, "x-auth-provider": "firebase" };
    } catch {
      return {};
    }
  }

  if (isSupabaseConfigured) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) return { authorization: `Bearer ${token}`, "x-auth-provider": "supabase" };
  }
  return {};
}
