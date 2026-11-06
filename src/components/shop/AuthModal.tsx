import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Leaf, Loader2, Lock, Mail, User } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GoogleIcon } from "@/components/ui/google-icon";
import { useAuth, type AuthMode } from "@/hooks/use-auth";

const COPY: Record<AuthMode, { title: string; sub: string }> = {
  login: { title: "Welcome back", sub: "Sign in to track orders and leave reviews." },
  signup: {
    title: "Join Reelmark",
    sub: "Save your details for faster checkout and follow every delivery.",
  },
  forgot: { title: "Reset your password", sub: "We'll email you a link to choose a new one." },
  reset: { title: "Choose a new password", sub: "You're signed in — set a new password below." },
};

const inputClass =
  "w-full rounded-2xl border border-border bg-white/70 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all";

/** The one sign-in dialog for the whole app; open it with `useAuth().openAuth(mode)`. */
export function AuthModal() {
  const {
    authDialog,
    setAuthDialog,
    signIn,
    signUp,
    signInWithGoogle,
    sendPasswordReset,
    updatePassword,
    isSupabaseConfigured,
  } = useAuth();
  const { open, mode } = authDialog;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"form" | "google" | null>(null);

  useEffect(() => setError(null), [mode, open]);

  const close = () => setAuthDialog({ open: false, mode });
  const switchMode = (next: AuthMode) => setAuthDialog({ open: true, mode: next });

  const handleGoogle = async () => {
    setBusy("google");
    setError(null);
    try {
      const result = await signInWithGoogle();
      if (result.error) setError(result.error);
      else close();
    } finally {
      setBusy(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("form");
    setError(null);
    try {
      if (mode === "login") {
        const r = await signIn(email.trim(), password);
        if (r.error) return setError(r.error);
      } else if (mode === "signup") {
        if (password.length < 8) return setError("Use at least 8 characters for your password.");
        const r = await signUp(email.trim(), password, name.trim());
        if (r.error) return setError(r.error);
        if (r.needsConfirmation) return switchMode("login");
      } else if (mode === "forgot") {
        const r = await sendPasswordReset(email.trim());
        if (r.error) return setError(r.error);
        return switchMode("login");
      } else {
        if (password.length < 8) return setError("Use at least 8 characters for your password.");
        const r = await updatePassword(password);
        if (r.error) return setError(r.error);
      }
      setPassword("");
      close();
    } finally {
      setBusy(null);
    }
  };

  const showTabs = mode === "login" || mode === "signup";
  const showPassword = mode !== "forgot";
  const showEmail = mode !== "reset";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[92vh] max-w-[440px] overflow-y-auto rounded-3xl border border-white/60 bg-[#faf8f5]/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Leaf className="h-6 w-6" aria-hidden="true" />
          </div>
          <DialogTitle className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {COPY[mode].title}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-ink-soft">
            {COPY[mode].sub}
          </DialogDescription>
        </DialogHeader>

        {showTabs && (
          <div className="mt-4 flex rounded-full bg-black/[0.04] p-1 text-sm font-medium">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 cursor-pointer rounded-full py-1.5 transition-all ${
                  mode === m
                    ? "bg-white font-semibold text-foreground shadow-sm"
                    : "text-ink-soft hover:text-foreground"
                }`}
              >
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
        )}

        {showTabs && (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy !== null}
              className="mt-5 flex w-full cursor-pointer items-center justify-center gap-3 rounded-full border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-neutral-50/80 hover:shadow active:scale-[0.99] disabled:opacity-70"
            >
              {busy === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin text-ink-soft" aria-hidden="true" />
              ) : (
                <GoogleIcon className="h-4 w-4" />
              )}
              Continue with Google
            </button>
            {isSupabaseConfigured && (
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/80" />
                </div>
                <span className="relative bg-[#faf8f5] px-3 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                  or with email
                </span>
              </div>
            )}
          </>
        )}

        {error && (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        {(isSupabaseConfigured || mode === "reset") && (
          <form onSubmit={handleSubmit} className="mt-3 space-y-3.5">
            {mode === "signup" && (
              <label className="block">
                <span className="mb-1.5 block pl-1 text-xs font-semibold text-foreground/80">
                  Your name
                </span>
                <span className="relative block">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="e.g. Priya Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                  />
                </span>
              </label>
            )}

            {showEmail && (
              <label className="block">
                <span className="mb-1.5 block pl-1 text-xs font-semibold text-foreground/80">
                  Email address
                </span>
                <span className="relative block">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </span>
              </label>
            )}

            {showPassword && (
              <div className="relative">
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="absolute right-1 top-0 cursor-pointer text-xs font-semibold text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
                <label className="block">
                  <span className="mb-1.5 block pl-1 text-xs font-semibold text-foreground/80">
                    {mode === "reset" ? "New password" : "Password"}
                  </span>
                  <span className="relative block">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                    <input
                      type="password"
                      required
                      minLength={mode === "login" ? 1 : 8}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      placeholder={mode === "login" ? "Your password" : "At least 8 characters"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass}
                    />
                  </span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={busy !== null}
              className="bg-cta shadow-cta mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70"
            >
              {busy === "form" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {
                {
                  login: "Sign in",
                  signup: "Create my account",
                  forgot: "Email me a reset link",
                  reset: "Save new password",
                }[mode]
              }
            </button>

            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="w-full cursor-pointer text-center text-xs font-semibold text-ink-soft hover:text-foreground"
              >
                Back to sign in
              </button>
            )}
          </form>
        )}

        {showTabs && (
          <p className="mt-4 text-center text-xs text-ink-soft">
            By continuing you agree to Reelmark's Terms of Service and Privacy Policy.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
