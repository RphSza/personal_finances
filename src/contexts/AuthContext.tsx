import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

type AuthState = {
  sessionReady: boolean;
  userId: string | null;
  email: string | null;
  isGlobalAdmin: boolean;
  signOut: () => void;
};

const AuthContext = createContext<AuthState>({
  sessionReady: false,
  userId: null,
  email: null,
  isGlobalAdmin: false,
  signOut: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionReady, setSessionReady] = useState(!isSupabaseConfigured);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);

  const ensureProfile = useCallback(async (id: string, userEmail: string | null) => {
    if (!supabase) return;
    const { data, error } = await supabase.from("user_profiles").select("id").eq("id", id).maybeSingle();
    if (error) {
      console.warn("[auth] ensureProfile select failed:", error.message);
      return;
    }
    if (!data) {
      const { error: createError } = await supabase
        .from("user_profiles")
        .insert({ id, email: userEmail, role: "client", active: true });
      if (createError) console.warn("[auth] ensureProfile insert failed:", createError.message);
    }
  }, []);

  const checkGlobalAdmin = useCallback(async (id: string) => {
    if (!supabase) return;
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("role, active")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.warn("[auth] checkGlobalAdmin failed:", error.message);
      return;
    }
    setIsGlobalAdmin(profile?.role === "internal" && profile?.active !== false);
  }, []);

  // Listen for auth state changes — MUST NOT make Supabase requests inside this
  // callback, as Supabase's _notifyAllSubscribers awaits the callback while
  // holding initializePromise unresolved. Any getSession() call (which every
  // PostgREST request triggers internally) would await initializePromise,
  // creating a circular Promise deadlock that hangs the app on refresh.
  useEffect(() => {
    if (!supabase) return;

    // Safety: if auth doesn't resolve in 10s, mark ready with no user (→ login screen)
    const fallbackTimeout = setTimeout(() => {
      setSessionReady((prev) => {
        if (!prev) console.warn("[auth] session check timed out — redirecting to login");
        return true;
      });
    }, 10_000);

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      clearTimeout(fallbackTimeout);
      const user = session?.user ?? null;

      setUserId(user?.id ?? null);
      setEmail(user?.email ?? null);
      setSessionReady(true);

      if (!user) {
        setIsGlobalAdmin(false);
      }
    });

    return () => {
      clearTimeout(fallbackTimeout);
      data.subscription.unsubscribe();
    };
  }, []);

  // Profile checks run in a separate effect, triggered by userId changes.
  // This avoids the initializePromise deadlock described above.
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    (async () => {
      try {
        await ensureProfile(userId, email);
        if (!cancelled) await checkGlobalAdmin(userId);
      } catch (err) {
        console.error("[auth] profile check failed:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [userId, email, ensureProfile, checkGlobalAdmin]);

  const signOut = useCallback(() => void supabase?.auth.signOut(), []);

  return (
    <AuthContext.Provider value={{ sessionReady, userId, email, isGlobalAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
