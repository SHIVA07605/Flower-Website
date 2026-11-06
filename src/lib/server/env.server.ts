/**
 * Server-only configuration. Secrets come from process.env (set them in your hosting
 * dashboard; `vite dev` copies them from .env.local). Public values fall back to the
 * VITE_* build-time config the browser already uses.
 */

/**
 * Used only when ADMIN_EMAILS is not set, so the existing admin isn't locked out.
 * admin@reelmark.com is deliberately not here: its password was shown on the old login page.
 */
const DEFAULT_ADMIN_EMAILS = ["gamerzgod932@gmail.com"];

function read(name: string): string | undefined {
  const value = typeof process !== "undefined" ? process.env[name] : undefined;
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function emailList(raw: string | undefined): string[] | undefined {
  const emails = raw
    ?.split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return emails && emails.length > 0 ? emails : undefined;
}

export function serverEnv() {
  const adminEmails = emailList(read("ADMIN_EMAILS"));
  return {
    supabaseUrl:
      read("SUPABASE_URL") ?? read("VITE_SUPABASE_URL") ?? import.meta.env.VITE_SUPABASE_URL,
    supabaseAnonKey:
      read("SUPABASE_ANON_KEY") ??
      read("VITE_SUPABASE_ANON_KEY") ??
      import.meta.env.VITE_SUPABASE_ANON_KEY,
    serviceRoleKey: read("SUPABASE_SERVICE_ROLE_KEY"),
    firebaseProjectId:
      read("FIREBASE_PROJECT_ID") ??
      read("VITE_FIREBASE_PROJECT_ID") ??
      import.meta.env.VITE_FIREBASE_PROJECT_ID ??
      "flower-website-81679",
    adminEmails: adminEmails ?? DEFAULT_ADMIN_EMAILS,
    adminEmailsFromEnv: adminEmails !== undefined,
    aiConfigured: read("LOVABLE_API_KEY") !== undefined,
  };
}

/** An expected failure whose message is safe to show the shopper or admin. */
export class ServiceError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
