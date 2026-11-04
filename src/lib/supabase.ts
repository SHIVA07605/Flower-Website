import { createClient } from "@supabase/supabase-js";

// Support both VITE_ and NEXT_PUBLIC_ prefixes so user can configure either
const supabaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env
    ? (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL)
    : "") || "";

const supabaseAnonKey =
  (typeof import.meta !== "undefined" && import.meta.env
    ? (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : "") || "";

export const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  !supabaseUrl.includes("your-supabase-url") &&
  Boolean(supabaseAnonKey) &&
  !supabaseAnonKey.includes("your-supabase-anon-key");

// Always export a valid client instance (dummy or real) so callers never crash
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : "https://placeholder.supabase.co",
  isSupabaseConfigured ? supabaseAnonKey : "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
