import { useState } from "react";
import { AlertTriangle, Check, Copy, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";

import type { SetupStatus } from "@/lib/admin-types";
import setupSql from "../../../supabase/migrations/20261106120000_reelmark_schema.sql?raw";

const projectRef = import.meta.env.VITE_SUPABASE_URL?.match(
  /^https:\/\/([a-z0-9]+)\.supabase\.co/,
)?.[1];
const sqlEditorUrl = projectRef
  ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
  : "https://supabase.com/dashboard";

export function CopySqlButton({ className = "" }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(setupSql);
          setCopied(true);
          toast.success("Setup SQL copied — paste it into the Supabase SQL editor and press Run.");
          setTimeout(() => setCopied(false), 3000);
        } catch {
          toast.error(
            "Couldn't copy automatically. Open supabase/migrations in the project instead.",
          );
        }
      }}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold ${className}`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : "Copy setup SQL"}
    </button>
  );
}

/** Tells the admin exactly what still needs doing before the shop can save anything. */
export function SetupBanner({ setup }: { setup: SetupStatus }) {
  const missingTables = Object.entries(setup.tables)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  const blocking = !setup.serviceKey || !setup.dbReady;
  const notes: string[] = [];
  if (setup.dbReady && !setup.storageReady) {
    notes.push("Picture uploads need the site-media storage bucket — run the setup SQL once more.");
  }
  if (!setup.adminEmailsFromEnv) {
    notes.push(
      "Admin access uses the built-in email list. Set ADMIN_EMAILS (comma-separated) in the server environment to choose who can sign in here.",
    );
  }
  if (!setup.aiConfigured) {
    notes.push("The AI bouquet finder needs LOVABLE_API_KEY in the server environment.");
  }

  if (!blocking && notes.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {blocking && (
        <div className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-5 text-amber-950">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-200 text-amber-900">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold">Finish connecting the store database</h3>
              {!setup.serviceKey ? (
                <p className="mt-1 text-sm leading-relaxed text-amber-900/85">
                  The server can't reach Supabase with write access. Add{" "}
                  <code className="rounded bg-amber-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code> to
                  the server environment (Vercel → Project → Settings → Environment Variables, or{" "}
                  <code className="rounded bg-amber-100 px-1">.env.local</code> for local
                  development), then redeploy or restart. Until then nothing you change here can be
                  saved, and the shop shows its built-in content.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-sm leading-relaxed text-amber-900/85">
                    The database is connected but these tables don't exist yet:{" "}
                    <strong>{missingTables.join(", ")}</strong>. Run the setup SQL once in the
                    Supabase SQL editor — orders, reviews and your edits will start saving
                    immediately.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <CopySqlButton className="bg-amber-900 text-white hover:bg-amber-950" />
                    <a
                      href={sqlEditorUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-900 bg-white px-4 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100"
                    >
                      Open Supabase SQL editor <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {notes.map((note) => (
        <p
          key={note}
          className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs text-sky-900"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {note}
        </p>
      ))}
    </div>
  );
}
