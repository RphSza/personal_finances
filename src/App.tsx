import { Suspense, lazy, useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { isSupabaseConfigured } from "./lib/supabase";
import { LoadingCard } from "./components/LoadingState";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";

const AuthScreen = lazy(() =>
  import("./features/auth/AuthScreen").then((m) => ({ default: m.AuthScreen }))
);
const AppShell = lazy(() =>
  import("./layout/AppShell").then((m) => ({ default: m.AppShell }))
);

function AppInner() {
  const { sessionReady, userId } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionReady) return;
    if (!userId && pathname !== "/auth/login") {
      void navigate({ to: "/auth/login", replace: true });
    } else if (userId && pathname.startsWith("/auth")) {
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [userId, navigate, pathname, sessionReady]);

  if (!isSupabaseConfigured) {
    return (
      <div className="auth-shell">
        <section className="auth-card">
          <LoadingCard label="Configure o Supabase no .env para iniciar." />
        </section>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="auth-shell">
        <section className="auth-card">
          <LoadingCard label="Verificando sessao..." />
        </section>
      </div>
    );
  }

  if (!userId) {
    return (
      <Suspense
        fallback={
          <div className="auth-shell">
            <section className="auth-card">
              <LoadingCard label="Preparando autenticacao..." />
            </section>
          </div>
        }
      >
        <AuthScreen />
      </Suspense>
    );
  }

  return (
    <WorkspaceProvider>
      <Suspense fallback={<LoadingCard label="Carregando..." />}>
        <AppShell />
      </Suspense>
    </WorkspaceProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
