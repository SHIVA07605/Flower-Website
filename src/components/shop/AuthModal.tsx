import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { Leaf, Lock, Mail, User, AlertCircle, Loader2 } from "lucide-react";
import { GoogleIcon } from "@/components/ui/google-icon";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "signup";
}

export function AuthModal({ isOpen, onClose, initialMode = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const { signIn, signUp, signInWithGoogle, isConfigured } = useAuth();

  // Reset state when toggling modes
  const switchMode = (newMode: "login" | "signup") => {
    setMode(newMode);
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
      // On success, Supabase will redirect to Google's consent screen
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsSubmitting(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (!error) {
          onClose();
          setEmail("");
          setPassword("");
        }
      } else {
        const { error } = await signUp(email, password, username);
        if (!error) {
          onClose();
          setEmail("");
          setPassword("");
          setUsername("");
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[440px] rounded-3xl border border-white/60 bg-[#faf8f5]/95 p-6 backdrop-blur-xl sm:p-8 shadow-2xl">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Leaf className="h-6 w-6" />
          </div>
          <DialogTitle className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {mode === "login" ? "Welcome Back" : "Join Reelmark"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-ink-soft">
            {mode === "login"
              ? "Sign in to save favorite bouquets and track your orders"
              : "Discover indie florists, curate arrangements & receive same-day deliveries"}
          </DialogDescription>
        </DialogHeader>

        {!isConfigured && (
          <div className="mt-2 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Supabase is in setup mode</p>
              <p className="mt-0.5 text-amber-700">
                Add your Supabase URL & Key to <code className="rounded bg-amber-100 px-1 py-0.5">.env.local</code> to activate live authentication.
              </p>
            </div>
          </div>
        )}

        {/* Tab switch */}
        <div className="mt-4 flex rounded-full bg-black/[0.04] p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`flex-1 rounded-full py-1.5 transition-all cursor-pointer ${
              mode === "login"
                ? "bg-white text-foreground shadow-sm font-semibold"
                : "text-ink-soft hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={`flex-1 rounded-full py-1.5 transition-all cursor-pointer ${
              mode === "signup"
                ? "bg-white text-foreground shadow-sm font-semibold"
                : "text-ink-soft hover:text-foreground"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Supabase Google OAuth Button */}
        <div className="mt-5">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-neutral-50/80 hover:shadow active:scale-[0.99] cursor-pointer disabled:opacity-70"
          >
            {isGoogleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />
            ) : (
              <GoogleIcon className="h-4 w-4" />
            )}
            <span>{mode === "login" ? "Continue with Google" : "Sign up with Google"}</span>
          </button>
        </div>

        {/* Elegant Divider */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/80" />
          </div>
          <div className="relative bg-[#faf8f5] px-3 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            or with email
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "signup" && (
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1.5 pl-1">
                Your Name / Florist Handle
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                <input
                  type="text"
                  placeholder="e.g. Flora Vance"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-white/70 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5 pl-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <input
                type="email"
                required
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-border bg-white/70 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5 pl-1">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-border bg-white/70 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-cta shadow-cta mt-2 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : mode === "login" ? (
              "Sign In to Reelmark"
            ) : (
              "Create My Account"
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-soft">
          By continuing, you agree to Reelmark's Terms of Service and Privacy Policy.
        </p>
      </DialogContent>
    </Dialog>
  );
}
