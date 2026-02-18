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

  const handleUser = useCallback(
    async (id: string | null, userEmail: string | null) => {
      setUserId(id);
      setEmail(userEmail);
      if (id) {
        await ensureProfile(id, userEmail);
        await checkGlobalAdmin(id);
      } else {
        setIsGlobalAdmin(false);
      }
    },
    [ensureProfile, checkGlobalAdmin]
  );

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      try {
        await handleUser(user?.id ?? null, user?.email ?? null);
      } catch (err) {
        console.error("[auth] onAuthStateChange failed:", err);
      }
      setSessionReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [handleUser]);

  const signOut = useCallback(() => void supabase?.auth.signOut(), []);

  return (
    <AuthContext.Provider value={{ sessionReady, userId, email, isGlobalAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
