import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Result } from "../result";
import { serverEnv, ServiceError } from "./env.server";

const serverAuth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

let serviceClient: SupabaseClient | undefined;
let anonClient: SupabaseClient | undefined;

export const NOT_CONNECTED =
  "The store database isn't connected yet. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.";
export const NOT_SET_UP =
  "The store database tables don't exist yet. Run the setup SQL from the admin dashboard in the Supabase SQL editor.";
/** What shoppers see instead of the admin's setup instructions. */
export const SHOP_UNAVAILABLE =
  "Our shop is just finishing setting up, so we couldn't do that yet. Please try again a little later.";

/** The database isn't connected or its tables are missing — something only an admin can fix. */
export class SetupError extends ServiceError {
  constructor(message: string) {
    super(message, 503);
    this.name = "SetupError";
  }
}

/** Service-role client: bypasses RLS, so it is only ever used after server-side checks. */
export function getServiceDb(): SupabaseClient | null {
  const { supabaseUrl, serviceRoleKey } = serverEnv();
  if (!supabaseUrl || !serviceRoleKey) return null;
  serviceClient ??= createClient(supabaseUrl, serviceRoleKey, { auth: serverAuth });
  return serviceClient;
}

export function requireServiceDb(): SupabaseClient {
  const db = getServiceDb();
  if (!db) throw new SetupError(NOT_CONNECTED);
  return db;
}

/** Read-only fallback (anon key, RLS enforced) for public storefront data and token checks. */
export function getAnonDb(): SupabaseClient | null {
  const { supabaseUrl, supabaseAnonKey } = serverEnv();
  if (!supabaseUrl || !supabaseAnonKey) return null;
  anonClient ??= createClient(supabaseUrl, supabaseAnonKey, { auth: serverAuth });
  return anonClient;
}

interface DbError {
  code?: string;
  message?: string;
}

export function isMissingTable(error: DbError | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /schema cache|does not exist/i.test(error.message ?? "")
  );
}

/** Turns a Supabase error into a ServiceError with a message an admin can act on. */
export function dbFailure(error: DbError, action: string): ServiceError {
  if (isMissingTable(error)) return new SetupError(NOT_SET_UP);
  console.error(`[db] ${action} failed:`, error.message ?? error);
  return new ServiceError(`Couldn't ${action}. Please try again.`, 500);
}

/**
 * Runs a server operation and converts thrown errors into a Result for the client.
 * Setup problems are explained in full only to admins (`audience: "admin"`); shoppers get a
 * friendly message and the details go to the server log instead.
 */
export async function run<T>(
  operation: () => Promise<T>,
  { audience = "shopper" }: { audience?: "shopper" | "admin" } = {},
): Promise<Result<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    if (error instanceof SetupError && audience === "shopper") {
      console.warn(`[db] shopper request failed, store not set up: ${error.message}`);
      return { ok: false, error: SHOP_UNAVAILABLE };
    }
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Something went wrong on our side. Please try again." };
  }
}
