import { createClient } from "@supabase/supabase-js";

// Browser client: used for email/password sign-in only. Reads and writes of store data go
// through server functions, so this client never needs elevated access.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured =
  supabaseUrl.startsWith("https://") &&
  !supabaseUrl.includes("your-project") &&
  supabaseAnonKey.length > 20 &&
  !supabaseAnonKey.includes("your-anon-key");

// Always export a client (placeholder when unconfigured) so callers never crash.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : "https://placeholder.supabase.co",
  isSupabaseConfigured ? supabaseAnonKey : "placeholder-anon-key",
  { auth: { persistSession: true, autoRefreshToken: true } },
);
