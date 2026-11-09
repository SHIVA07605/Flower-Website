import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Infinity as InfinityIcon, ShieldCheck, UserPlus } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { listAdminGrants, revokeAdminGrant, saveAdminGrant } from "@/lib/admin.functions";
import type { AdminGrantRecord } from "@/lib/admin-types";
import { unwrap } from "@/lib/result";
import {
  adminInput,
  AdminField,
  EmptyState,
  ErrorNote,
  LoadingRows,
  Panel,
  useAdminAction,
} from "./shared";

const GRANTS_KEY = ["admin", "grants"];

const DURATIONS = [
  { id: "1d", label: "1 day", days: 1 },
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "custom", label: "Until a date…", days: null },
  { id: "forever", label: "No end date", days: null },
] as const;
type DurationId = (typeof DURATIONS)[number]["id"];

/** Local date-time string for <input type="datetime-local"> (no seconds, no zone). */
function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function endsAt(duration: DurationId, custom: string): string | null | "invalid" {
  if (duration === "forever") return null;
  if (duration === "custom") {
    const date = new Date(custom);
    return Number.isNaN(date.getTime()) ? "invalid" : date.toISOString();
  }
  const days = DURATIONS.find((d) => d.id === duration)?.days ?? 1;
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function describeEnd(grant: AdminGrantRecord) {
  if (grant.expiresAt === null) return "No end date";
  const when = new Date(grant.expiresAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return grant.active ? `Until ${when}` : `Ended ${when}`;
}

/** Owners decide who else can open the admin dashboard, and for how long. */
export function AccessPanel() {
  const { viewer } = useAuth();
  const [email, setEmail] = useState("");
  const [duration, setDuration] = useState<DurationId>("7d");
  const [custom, setCustom] = useState(() => toLocalInput(new Date(Date.now() + 3 * 86_400_000)));
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: GRANTS_KEY,
    queryFn: async () => unwrap(await listAdminGrants()),
    enabled: viewer?.isOwner === true,
  });
  const save = useAdminAction(
    (input: { email: string; expiresAt: string | null; note: string }) =>
      saveAdminGrant({ data: input }),
    {
      success: (r) => `${r.email} can now use the admin dashboard.`,
      invalidate: [GRANTS_KEY, ["admin", "customers"]],
    },
  );
  const revoke = useAdminAction((target: string) => revokeAdminGrant({ data: { email: target } }), {
    success: (r) => `Removed admin access for ${r.email}.`,
    invalidate: [GRANTS_KEY, ["admin", "customers"]],
  });

  if (!viewer?.isOwner) {
    return (
      <Panel>
        <EmptyState>
          <ShieldCheck className="mx-auto mb-2 h-6 w-6" aria-hidden="true" />
          Only the shop owner can change who has admin access.
          {viewer?.adminUntil && (
            <span className="mt-1 block">
              Your access lasts until {new Date(viewer.adminUntil).toLocaleString("en-IN")}.
            </span>
          )}
        </EmptyState>
      </Panel>
    );
  }

  const submit = (e: FormEvent, target = email, chosen = duration, keepNote = note) => {
    e.preventDefault();
    setFormError(null);
    const expiresAt = endsAt(chosen, custom);
    if (expiresAt === "invalid") return setFormError("Choose the date and time access should end.");
    save.mutate(
      { email: target.trim(), expiresAt, note: keepNote },
      {
        onSuccess: () => {
          setEmail("");
          setNote("");
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Admin access</h2>
        <p className="text-sm text-ink-soft">
          Let other people manage the shop — pictures, bouquets &amp; prices, copy, orders and
          reviews — for as long as you choose. They sign in with Google using the email you add
          here. Only owners can add or remove admins.
        </p>
      </div>

      <Panel
        title="Give admin access"
        description="Takes effect the next time they sign in or refresh."
      >
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
          <AdminField label="Their email (Google account)">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="helper@gmail.com"
              className={adminInput}
            />
          </AdminField>
          <AdminField label="For how long">
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value as DurationId)}
              className={adminInput}
            >
              {DURATIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </AdminField>
          {duration === "custom" && (
            <AdminField label="Access ends">
              <input
                type="datetime-local"
                value={custom}
                min={toLocalInput(new Date())}
                onChange={(e) => setCustom(e.target.value)}
                className={adminInput}
              />
            </AdminField>
          )}
          <AdminField label="Note (optional)" hint="Only you see this, e.g. “Diwali rush helper”.">
            <input
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              className={adminInput}
            />
          </AdminField>
          <div className="flex items-end md:col-span-2">
            <button
              type="submit"
              disabled={save.isPending}
              className="bg-cta shadow-cta inline-flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Give access
            </button>
          </div>
        </form>
        {formError && (
          <div className="mt-3">
            <ErrorNote message={formError} />
          </div>
        )}
      </Panel>

      <Panel title="People with admin access" className="!p-0 overflow-hidden">
        {query.isPending ? (
          <LoadingRows />
        ) : query.isError ? (
          <div className="p-5">
            <ErrorNote message={query.error.message} />
          </div>
        ) : query.data.length === 0 ? (
          <EmptyState>Only you so far. People you add will appear here.</EmptyState>
        ) : (
          <ul className="divide-y divide-border/60">
            {query.data.map((g) => (
              <li key={g.email} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{g.email}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${g.active ? "text-primary" : "text-rose-700"}`}
                    >
                      {g.expiresAt === null ? (
                        <InfinityIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {describeEnd(g)}
                    </span>
                    <span>{g.hasSignedIn ? "has signed in" : "hasn't signed in yet"}</span>
                    {g.note && <span>· {g.note}</span>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={save.isPending}
                    onClick={(e) => submit(e, g.email, "7d", g.note)}
                    className="cursor-pointer rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                  >
                    {g.active ? "+7 days from now" : "Renew 7 days"}
                  </button>
                  <button
                    type="button"
                    disabled={revoke.isPending}
                    onClick={() => {
                      if (window.confirm(`Remove admin access for ${g.email} now?`))
                        revoke.mutate(g.email);
                    }}
                    className="cursor-pointer rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
