import type { z } from "zod";

/** What every mutating server function returns, so the UI can show a real reason on failure. */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * A server-function input validator that never throws: invalid input becomes a readable
 * message the handler can return as `{ ok: false }`.
 */
export function validateWith<S extends z.ZodType>(schema: S) {
  return (data: z.input<S>): Parsed<z.output<S>> => {
    const parsed = schema.safeParse(data);
    if (parsed.success) return { ok: true, value: parsed.data };
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Please check the form and try again." };
  };
}

/** Unwraps a Result for react-query: failures become thrown errors with the server's message. */
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
