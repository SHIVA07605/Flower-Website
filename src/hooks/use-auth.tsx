import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  auth as firebaseAuth,
  googleProvider,
  signInWithPopup,
  firebaseSignOut,
  onAuthStateChanged,
  type FirebaseUser,
} from "@/lib/firebase";
import { toast } from "sonner";

export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role: "admin" | "user";
  created_at?: string;
}

export interface AppUser {
  id: string;
  email?: string | null;
  user_metadata?: {
    full_name?: string | null;
    name?: string | null;
    avatar_url?: string | null;
    picture?: string | null;
    role?: string | null;
    [key: string]: any;
  };
}

interface AuthContextValue {
  user: AppUser | null;
  profile: Profile | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, username?: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: (redirectTo?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const buildFallbackProfile = (authUser: AppUser): Profile => {
    const meta = authUser.user_metadata || {};
    return {
      id: authUser.id,
      username:
        meta.full_name ||
        meta.name ||
        meta.username ||
        authUser.email?.split("@")[0] ||
        "Shopper",
      avatar_url: meta.avatar_url || meta.picture || null,
      role:
        authUser.email === "admin@reelmark.com" ||
        authUser.email === "gamerzgod932@gmail.com" ||
        meta.role === "admin"
          ? "admin"
          : "user",
    };
  };

  const fetchProfile = useCallback(async (userId: string, authUser?: AppUser) => {
    if (!isSupabaseConfigured) return authUser ? buildFallbackProfile(authUser) : null;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, role, created_at")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.warn("Could not fetch user profile:", error.message);
        return authUser ? buildFallbackProfile(authUser) : null;
      }
      if (data) {
        return data as Profile;
      }
      return authUser ? buildFallbackProfile(authUser) : null;
    } catch (err) {
      console.warn("Profile fetch exception:", err);
      return authUser ? buildFallbackProfile(authUser) : null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    const p = await fetchProfile(user.id, user);
    if (p) setProfile(p);
  }, [user, fetchProfile]);

  useEffect(() => {
    let isMounted = true;

    // 1. Listen for Firebase Auth state changes
    let unsubscribeFirebase: (() => void) | null = null;
    if (typeof window !== "undefined") {
      unsubscribeFirebase = onAuthStateChanged(firebaseAuth, async (fbUser: FirebaseUser | null) => {
        if (!isMounted) return;
        if (fbUser) {
          const appUser: AppUser = {
            id: fbUser.uid,
            email: fbUser.email,
            user_metadata: {
              full_name: fbUser.displayName,
              name: fbUser.displayName,
              avatar_url: fbUser.photoURL,
              picture: fbUser.photoURL,
              role:
                fbUser.email === "admin@reelmark.com" ||
                fbUser.email === "gamerzgod932@gmail.com"
                  ? "admin"
                  : "user",
            },
          };
          setUser(appUser);
          setProfile({
            id: fbUser.uid,
            username: fbUser.displayName || fbUser.email?.split("@")[0] || "Shopper",
            avatar_url: fbUser.photoURL,
            role:
              fbUser.email === "admin@reelmark.com" ||
              fbUser.email === "gamerzgod932@gmail.com"
                ? "admin"
                : "user",
          });
          setLoading(false);
        }
      });
    }

    // 2. Listen for Supabase session if configured
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!isMounted) return;
        if (session?.user && !firebaseAuth.currentUser) {
          setSession(session);
          const mapped: AppUser = {
            id: session.user.id,
            email: session.user.email,
            user_metadata: session.user.user_metadata,
          };
          setUser(mapped);
          const p = await fetchProfile(session.user.id, mapped);
          if (isMounted) setProfile(p);
        }
        setLoading(false);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (!isMounted) return;
        if (newSession?.user && !firebaseAuth.currentUser) {
          setSession(newSession);
          const mapped: AppUser = {
            id: newSession.user.id,
            email: newSession.user.email,
            user_metadata: newSession.user.user_metadata,
          };
          setUser(mapped);
          const p = await fetchProfile(newSession.user.id, mapped);
          if (isMounted) setProfile(p);
        } else if (!newSession && !firebaseAuth.currentUser) {
          if (isMounted) {
            setSession(null);
            setUser(null);
            setProfile(null);
          }
        }
        setLoading(false);
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
        if (unsubscribeFirebase) unsubscribeFirebase();
      };
    } else {
      setLoading(false);
      return () => {
        isMounted = false;
        if (unsubscribeFirebase) unsubscribeFirebase();
      };
    }
  }, [fetchProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!isSupabaseConfigured) {
        const err = new Error(
          "Supabase is not configured yet. Please add your credentials to .env.local"
        );
        toast.error(err.message);
        return { error: err };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        return { error };
      }

      toast.success("Welcome back to Reelmark!");
      if (data.user) {
        const mapped: AppUser = {
          id: data.user.id,
          email: data.user.email,
          user_metadata: data.user.user_metadata,
        };
        setUser(mapped);
        const p = await fetchProfile(data.user.id, mapped);
        setProfile(p);
      }
      return { error: null };
    },
    [fetchProfile]
  );

  const signUp = useCallback(
    async (email: string, password: string, username?: string) => {
      if (!isSupabaseConfigured) {
        const err = new Error(
          "Supabase is not configured yet. Please add your credentials to .env.local"
        );
        toast.error(err.message);
        return { error: err };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username || email.split("@")[0],
          },
        },
      });

      if (error) {
        toast.error(error.message);
        return { error };
      }

      if (data.session) {
        toast.success("Account created successfully!");
        if (data.user) {
          const mapped: AppUser = {
            id: data.user.id,
            email: data.user.email,
            user_metadata: data.user.user_metadata,
          };
          setUser(mapped);
          const p = await fetchProfile(data.user.id, mapped);
          setProfile(p);
        }
      } else {
        toast.success(
          "Sign up successful! Please check your email inbox to confirm your account."
        );
      }

      return { error: null };
    },
    [fetchProfile]
  );

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    // 1. Try Firebase Google Popup first (Instant popup on localhost, zero redirect setup required!)
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const fbUser = result.user;
      const appUser: AppUser = {
        id: fbUser.uid,
        email: fbUser.email,
        user_metadata: {
          full_name: fbUser.displayName,
          name: fbUser.displayName,
          avatar_url: fbUser.photoURL,
          picture: fbUser.photoURL,
          role:
            fbUser.email === "admin@reelmark.com" ||
            fbUser.email === "gamerzgod932@gmail.com"
              ? "admin"
              : "user",
        },
      };
      setUser(appUser);
      setProfile({
        id: fbUser.uid,
        username: fbUser.displayName || fbUser.email?.split("@")[0] || "Shopper",
        avatar_url: fbUser.photoURL,
        role:
          fbUser.email === "admin@reelmark.com" ||
          fbUser.email === "gamerzgod932@gmail.com"
            ? "admin"
            : "user",
      });
      toast.success(`Welcome to Reelmark, ${fbUser.displayName || "Shopper"}!`);
      return { error: null };
    } catch (fbErr: any) {
      // User closed the popup intentionally
      if (fbErr.code === "auth/popup-closed-by-user") {
        return { error: null };
      }

      console.warn("Firebase popup auth attempt:", fbErr.code, fbErr.message);

      // If Google provider is not yet toggled on in Firebase Console
      if (
        fbErr.code === "auth/configuration-not-found" ||
        fbErr.code === "auth/operation-not-allowed"
      ) {
        toast.error(
          "Google Sign-In is not enabled yet in your Firebase Console. Go to Authentication → Sign-in method → Google and turn it ON."
        );
        return { error: fbErr };
      }

      // If user has Supabase Google provider enabled, try fallback
      if (isSupabaseConfigured && fbErr.code !== "auth/unauthorized-domain") {
        try {
          const defaultRedirect =
            typeof window !== "undefined"
              ? `${window.location.origin}${window.location.pathname}`
              : "http://localhost:5173/";
          const targetUrl = redirectTo || defaultRedirect;

          const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: targetUrl,
              queryParams: { access_type: "offline", prompt: "consent" },
            },
          });
          if (error) {
            toast.error(`Google Sign-In: ${error.message}`);
            return { error };
          }
          return { error: null };
        } catch {}
      }

      toast.error(fbErr.message || "Failed to sign in with Google");
      return { error: fbErr };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(firebaseAuth);
    } catch {}
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }
    setSession(null);
    setUser(null);
    setProfile(null);
    toast.success("Signed out successfully");
  }, []);

  const isAdmin =
    profile?.role === "admin" ||
    user?.user_metadata?.role === "admin" ||
    user?.email === "admin@reelmark.com" ||
    user?.email === "gamerzgod932@gmail.com";

  const value: AuthContextValue = {
    user,
    profile,
    session,
    isAdmin,
    loading,
    isConfigured: isSupabaseConfigured,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
