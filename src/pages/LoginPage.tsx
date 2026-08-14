import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthProvider";
import { useTenant } from "@/contexts/TenantContext";
import { Building2, Lock, Mail, ArrowRight, KeyRound, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const LoginPage: React.FC = () => {
  const { user, loading: authLoading, signInWithEmail, sendPasswordResetEmail, loginAsRole } = useAuth();
  const { organization } = useTenant();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  // Already authenticated (e.g. typed /login manually while logged in) — bounce home.
  if (!authLoading && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Informe o seu e-mail.");
      return;
    }

    if (resetMode) {
      setLoading(true);
      await sendPasswordResetEmail(email);
      setLoading(false);
      setResetMode(false);
      return;
    }

    if (!password) {
      toast.error("Informe a senha.");
      return;
    }

    setLoading(true);
    const success = await signInWithEmail(email, password);
    setLoading(false);
    if (success) {
      navigate("/", { replace: true });
    }
  };

  const handleQuickRoleLogin = (role: Parameters<typeof loginAsRole>[0]) => {
    loginAsRole(role);
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Dynamic Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-tenant/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md p-8 rounded-3xl glass-panel border border-white/20 shadow-2xl relative space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-tenant/20 border border-tenant/40 text-tenant font-bold shadow-xl shadow-tenant/20 mb-2">
            {organization.logo_url ? (
              <img src={organization.logo_url} alt={organization.name} className="w-12 h-12 rounded-xl object-cover" />
            ) : (
              <Building2 className="w-8 h-8 text-tenant" />
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">LOCGEST</h1>
          <p className="text-xs text-muted-foreground">
            SaaS Whitelabel - {organization.name}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-muted-foreground mb-1 font-medium">E-mail Cadastrado *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="seu.email@locadora.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
              />
            </div>
          </div>

          {!resetMode && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-muted-foreground font-medium">Senha *</label>
                <button
                  type="button"
                  onClick={() => setResetMode(true)}
                  className="text-[11px] text-tenant hover:underline font-bold"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-tenant text-white font-bold text-xs shadow-lg shadow-tenant/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              "Processando no Supabase..."
            ) : resetMode ? (
              <>
                <KeyRound className="w-4 h-4" /> Enviar E-mail de Redefinição
              </>
            ) : (
              <>
                Entrar com Supabase Auth <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {resetMode && (
            <button
              type="button"
              onClick={() => setResetMode(false)}
              className="w-full text-center text-xs text-muted-foreground hover:text-white font-medium"
            >
              $\leftarrow$ Voltar para o Login
            </button>
          )}
        </form>

        {/* Demo Quick Roles */}
        <div className="pt-4 border-t border-white/10 text-center space-y-2">
          <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Acesso Rápido de Teste Localhost
          </span>
          <div className="flex flex-wrap justify-center gap-1.5">
            {["Admin", "Diretor", "Gestor", "Entregador"].map((r) => (
              <button
                key={r}
                onClick={() => handleQuickRoleLogin(r as any)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-muted-foreground hover:text-white text-[10px] font-bold border border-white/5 transition-all"
              >
                Entrar como {r}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
