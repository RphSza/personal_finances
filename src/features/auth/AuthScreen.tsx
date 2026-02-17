import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Sparkles } from "lucide-react";
import { Spinner } from "../../components/LoadingState";
import { supabase } from "../../lib/supabase";

type AuthMode = "signin" | "signup";

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setMessage("");

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Conta criada. Confirme por email, se seu projeto estiver com confirmação ativa.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro de autenticação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <div className="auth-panel auth-panel-form">
          <p className="auth-kicker">Personal Finances</p>
          <h1>Faça seu login</h1>
          <p className="auth-description">
            Controle seu fluxo financeiro em uma experiência limpa, segura e colaborativa.
          </p>

          <div className="auth-switch">
            <button className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")} type="button" disabled={loading}>
              Entrar
            </button>
            <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")} type="button" disabled={loading}>
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <label className="input-label">
              E-mail
              <span className="input-wrap">
                <Mail size={16} />
                <input
                  type="email"
                  placeholder="seuemail@dominio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </span>
            </label>

            <label className="input-label">
              Senha
              <span className="input-wrap">
                <Lock size={16} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>

            <div className="auth-row">
              <label className="checkbox auth-checkbox">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                />
                Lembrar de mim
              </label>
              {mode === "signin" ? (
                <button type="button" className="auth-link" disabled={loading}>
                  Esqueci minha senha
                </button>
              ) : null}
            </div>

            <button type="submit" className={`primary-button auth-submit ${loading ? "is-loading" : ""}`} disabled={loading}>
              {loading ? <Spinner label={mode === "signin" ? "Entrando..." : "Criando conta..."} compact /> : mode === "signin" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <p className="auth-footnote">
            {mode === "signin" ? "Não tem conta ainda?" : "Já possui conta?"}{" "}
            <button
              className="auth-link"
              type="button"
              onClick={() => setMode((prev) => (prev === "signin" ? "signup" : "signin"))}
              disabled={loading}
            >
              {mode === "signin" ? "Crie agora" : "Entrar"}
            </button>
          </p>

          {message ? <p className="feedback">{message}</p> : null}
        </div>

        <aside className="auth-panel auth-panel-hero">
          <div className="hero-badge">
            <Sparkles size={14} />
            <span>Workspace financeiro</span>
          </div>
          <h2>Gestão financeira com clareza e ritmo de execução.</h2>
          <div className="hero-preview">
            <article>
              <p>Resultado do mês</p>
              <strong>R$ 12.840,23</strong>
              <small>+8,4% em relação ao mês anterior</small>
            </article>
            <article>
              <p>Despesas recorrentes</p>
              <strong>R$ 4.230,00</strong>
              <small>Próxima materialização em 3 dias</small>
            </article>
            <article className="hero-cta">
              <span>Ir para dashboard</span>
              <ArrowRight size={16} />
            </article>
          </div>
        </aside>
      </section>
    </div>
  );
}
