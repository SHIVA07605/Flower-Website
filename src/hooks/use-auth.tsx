import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";

import { getViewer } from "@/lib/account.functions";
import { auth as firebaseAuth, googleProvider } from "@/lib/firebase";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { AuthProviderName, PublicViewer } from "@/lib/viewer";

/** The signed-in identity as known in the browser (instant, unverified). */
export interface AuthUser {
  id: string;
  provider: AuthProviderName;
  email: string | null;
  name: string;
  avatarUrl: string | null;
}

export type AuthMode = "login" | "signup" | "forgot" | "reset";

interface AuthContextValue {
  user: AuthUser | null;
  /** The same person as verified by the server — the only source of `isAdmin`. */
  viewer: PublicViewer | null;
  isAdmin: boolean;
  /** Saved sessions are still being restored. */
  loading: boolean;
  viewerLoading: boolean;
  viewerError: string | null;
  isSupabaseConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  authDialog: { open: boolean; mode: AuthMode };
  openAuth: (mode?: AuthMode) => void;
  setAuthDialog: (state: { open: boolean; mode: AuthMode }) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const GOOGLE_ERRORS: Record<string, string> = {
  "auth/unauthorized-domain":
    "Google sign-in isn't enabled for this website address yet. Add it under Firebase → Authentication → Settings → Authorized domains.",
  "auth/operation-not-allowed":
    "Google sign-in is turned off. Enable it under Firebase → Authentication → Sign-in method.",
  "auth/configuration-not-found":
    "Google sign-in is turned off. Enable it under Firebase → Authentication → Sign-in method.",
  "auth/network-request-failed": "You seem to be offline. Check your connection and try again.",
  "auth/too-many-requests": "Too many attempts. Please wait a minute and try again.",
};

function friendlySupabaseError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match.";
  if (/email not confirmed/i.test(message))
    return "Please confirm your email first — check your inbox for the link.";
  if (/already registered|already exists/i.test(message))
    return "That email already has an account — sign in instead.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Please wait a minute.";
  if (/password/i.test(message) && /least|short|weak/i.test(message))
    return "Use a stronger password (at least 8 characters).";
  return message;
}

function toFirebaseUser(u: FirebaseUser): AuthUser {
  return {
    id: `firebase:${u.uid}`,
    provider: "firebase",
    email: u.email,
    name: u.displayName || u.email?.split("@")[0] || "Shopper",
    avatarUrl: u.photoURL,
  };
}

function toSupabaseUser(session: Session): AuthUser {
  const u = session.user;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const pick = (k: string) => (typeof meta[k] === "string" && meta[k] ? (meta[k] as string) : null);
  return {
    id: `supabase:${u.id}`,
    provider: "supabase",
    email: u.email ?? null,
    name:
      pick("full_name") ?? pick("name") ?? pick("username") ?? u.email?.split("@")[0] ?? "Shopper",
    avatarUrl: pick("avatar_url") ?? pick("picture"),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [supabaseReady, setSupabaseReady] = useState(!isSupabaseConfigured);
  const [authDialog, setAuthDialog] = useState<{ open: boolean; mode: AuthMode }>({
    open: false,
    mode: "login",
  });

  useEffect(
    () =>
      onAuthStateChanged(firebaseAuth, (u) => {
        setFirebaseUser(u);
        setFirebaseReady(true);
      }),
    [],
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setSupabaseReady(true);
      })
      .catch(() => active && setSupabaseReady(true));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);
      setSupabaseReady(true);
      // The emailed reset link signs the shopper in; ask them for a new password.
      if (event === "PASSWORD_RECOVERY") setAuthDialog({ open: true, mode: "reset" });
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const user = useMemo<AuthUser | null>(() => {
    if (firebaseUser) return toFirebaseUser(firebaseUser);
    if (session) return toSupabaseUser(session);
    return null;
  }, [firebaseUser, session]);

  const viewerQuery = useQuery({
    queryKey: ["viewer", user?.id ?? "guest"],
    queryFn: () => getViewer(),
    enabled: user !== null,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const viewer = user ? (viewerQuery.data ?? null) : null;
  let viewerError: string | null = null;
  if (user && viewerQuery.isError)
    viewerError = "We couldn't reach the server to verify your account.";
  else if (user && viewerQuery.isSuccess && viewerQuery.data === null)
    viewerError = "The server couldn't verify your sign-in. Try signing out and in again.";

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: "Email sign-in isn't configured yet." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: friendlySupabaseError(error.message) };
    // One identity at a time: an email sign-in replaces a Google one.
    if (firebaseAuth.currentUser) await firebaseSignOut(firebaseAuth).catch(() => {});
    toast.success("Welcome back to Reelmark!");
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    if (!isSupabaseConfigured) {
      return { error: "Email sign-up isn't configured yet.", needsConfirmation: false };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, username: name },
        emailRedirectTo: `${window.location.origin}/account`,
      },
    });
    if (error) return { error: friendlySupabaseError(error.message), needsConfirmation: false };
    const needsConfirmation = !data.session;
    if (!needsConfirmation && firebaseAuth.currentUser) {
      await firebaseSignOut(firebaseAuth).catch(() => {});
    }
    toast.success(
      needsConfirmation
        ? "Almost there! Confirm your email from the link we just sent, then sign in."
        : "Your Reelmark account is ready!",
    );
    return { error: null, needsConfirmation };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      if (isSupabaseConfigured) await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      toast.success(`Welcome to Reelmark, ${result.user.displayName?.split(" ")[0] || "friend"}!`);
      return { error: null };
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return { error: null };
      }
      if (code === "auth/popup-blocked") {
        await signInWithRedirect(firebaseAuth, googleProvider);
        return { error: null };
      }
      console.warn("Google sign-in failed:", code, err);
      return { error: GOOGLE_ERRORS[code] ?? "Google sign-in didn't work. Please try again." };
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) return { error: "Email accounts aren't configured yet." };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/account`,
    });
    if (error) return { error: friendlySupabaseError(error.message) };
    toast.success("If that email has an account, a reset link is on its way.");
    return { error: null };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: friendlySupabaseError(error.message) };
    toast.success("Your password has been updated.");
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await Promise.allSettled([
      firebaseSignOut(firebaseAuth),
      isSupabaseConfigured ? supabase.auth.signOut() : Promise.resolve(),
    ]);
    setFirebaseUser(null);
    setSession(null);
    for (const key of ["viewer", "account", "admin"])
      queryClient.removeQueries({ queryKey: [key] });
    toast.success("Signed out");
  }, [queryClient]);

  const openAuth = useCallback(
    (mode: AuthMode = "login") => setAuthDialog({ open: true, mode }),
    [],
  );

  const value: AuthContextValue = {
    user,
    viewer,
    isAdmin: viewer?.isAdmin === true,
    loading: !firebaseReady || !supabaseReady,
    viewerLoading: user !== null && viewerQuery.isPending,
    viewerError,
    isSupabaseConfigured,
    signIn,
    signUp,
    signInWithGoogle,
    sendPasswordReset,
    updatePassword,
    signOut,
    authDialog,
    openAuth,
    setAuthDialog,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
