import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, Loader2, Lock, Mail, ShieldAlert } from "lucide-react";

import { GoogleIcon } from "@/components/ui/google-icon";
import { useAuth } from "@/hooks/use-auth";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#faf8f5] px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-border bg-white p-8 shadow-card">
        {children}
      </div>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to the store
      </Link>
    </div>
  );
}

const input =
  "w-full rounded-2xl border border-border bg-[#faf8f5] py-2.5 pl-10 pr-4 text-sm text-foreground focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20";

export function AdminLogin() {
  const { signIn, signInWithGoogle, isSupabaseConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const google = async () => {
    setBusy("google");
    setError(null);
    try {
      const r = await signInWithGoogle();
      if (r.error) setError(r.error);
    } finally {
      setBusy(null);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("email");
    setError(null);
    try {
      const r = await signIn(email.trim(), password);
      if (r.error) setError(r.error);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Shell>
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
        <Lock className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="text-center font-display text-2xl font-bold text-foreground">
        Reelmark admin
      </h1>
      <p className="mt-1.5 text-center text-sm text-ink-soft">
        Orders, bouquets, prices, copy and reviews — all in one place.
      </p>

      <button
        type="button"
        onClick={google}
        disabled={busy !== null}
        className="mt-6 flex w-full cursor-pointer items-center justify-center gap-3 rounded-full border border-border bg-[#faf8f5] px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-neutral-100 disabled:opacity-70"
      >
        {busy === "google" ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <GoogleIcon className="h-4 w-4" />
        )}
        Continue with Google
      </button>

      {isSupabaseConfigured && (
        <>
          <div className="relative my-4 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/80" />
            </div>
            <span className="relative bg-white px-3 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
              or with email
            </span>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <label className="relative block">
              <span className="sr-only">Email</span>
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <input
                type="email"
                required
                autoComplete="username"
                placeholder="Admin email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={input}
              />
            </label>
            <label className="relative block">
              <span className="sr-only">Password</span>
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={input}
              />
            </label>
            <button
              type="submit"
              disabled={busy !== null}
              className="bg-cta shadow-cta flex w-full cursor-pointer items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-primary-foreground disabled:opacity-70"
            >
              {busy === "email" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Sign in
            </button>
          </form>
        </>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-2xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      <p className="mt-5 text-center text-xs text-ink-soft">
        Only accounts with admin access can open the dashboard.
      </p>
    </Shell>
  );
}

/** Signed in, but the server says this account isn't an admin (or couldn't verify it). */
export function AdminNoAccess({ reason }: { reason: string | null }) {
  const { user, signOut } = useAuth();
  return (
    <Shell>
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-amber-700">
        <ShieldAlert className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="text-center font-display text-2xl font-bold text-foreground">
        {reason ? "We couldn't verify you" : "No admin access"}
      </h1>
      <p className="mt-2 text-center text-sm text-ink-soft">
        {reason ??
          `${user?.email ?? "This account"} can shop on Reelmark but can't open the admin dashboard.`}
      </p>
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-6 w-full cursor-pointer rounded-full border border-border py-2.5 text-sm font-semibold hover:bg-muted"
      >
        Sign out and use another account
      </button>
    </Shell>
  );
}
