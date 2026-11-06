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

/** Service-role client: bypasses RLS, so it is only ever used after server-side checks. */
export function getServiceDb(): SupabaseClient | null {
  const { supabaseUrl, serviceRoleKey } = serverEnv();
  if (!supabaseUrl || !serviceRoleKey) return null;
  serviceClient ??= createClient(supabaseUrl, serviceRoleKey, { auth: serverAuth });
  return serviceClient;
}

export function requireServiceDb(): SupabaseClient {
  const db = getServiceDb();
  if (!db) throw new ServiceError(NOT_CONNECTED, 503);
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
  if (isMissingTable(error)) return new ServiceError(NOT_SET_UP, 503);
  console.error(`[db] ${action} failed:`, error.message ?? error);
  return new ServiceError(`Couldn't ${action}. Please try again.`, 500);
}

/** Runs a server operation and converts thrown errors into a Result for the client. */
export async function run<T>(operation: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Something went wrong on our side. Please try again." };
  }
}
