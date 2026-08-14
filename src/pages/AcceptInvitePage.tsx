import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Lock, User, CheckCircle2, ArrowRight, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

export const AcceptInvitePage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);

  useEffect(() => {
    // Check if user has an active session from the invite/recovery link token
    const checkInviteSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.warn("Session error:", error);
        }

        if (session?.user) {
          setEmail(session.user.email || "");
          const metadataName = session.user.user_metadata?.full_name;
          if (metadataName) {
            setFullName(metadataName);
          }
          setSessionValid(true);
        } else {
          // Listen for onAuthStateChange in case token processing is async
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
            if (s?.user) {
              setEmail(s.user.email || "");
              if (s.user.user_metadata?.full_name) {
                setFullName(s.user.user_metadata.full_name);
              }
              setSessionValid(true);
              setCheckingSession(false);
            }
          });

          // Timeout after 3 seconds if no token is captured
          setTimeout(() => {
            setCheckingSession(false);
          }, 3000);

          return () => {
            subscription.unsubscribe();
          };
        }
      } catch (err) {
        console.error("Error inspecting invite token:", err);
      } finally {
        setCheckingSession(false);
      }
    };

    checkInviteSession();
  }, []);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas informadas não coincidem.");
      return;
    }

    try {
      setLoading(true);

      // 1. Update password and metadata in Supabase Auth
      const { data, error } = await supabase.auth.updateUser({
        password: password,
        data: {
          full_name: fullName.trim() || undefined,
        }
      });

      if (error) throw error;

      // 2. Sync profile in public.profiles table
      if (data.user) {
        await supabase
          .from("profiles")
          .update({
            full_name: fullName.trim() || data.user.email,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.user.id);
      }

      toast.success("Conta ativada com sucesso! Bem-vindo ao LOCGEST.");
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Erro ao ativar conta:", err);
      toast.error(`Erro ao ativar conta: ${err.message || "Tente novamente mais tarde."}`);
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
        <Loader2 className="w-8 h-8 text-tenant animate-spin mb-3" />
        <p className="text-sm text-muted-foreground">Validando convite de acesso...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Dynamic Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-tenant/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md p-8 rounded-3xl glass-panel border border-white/20 shadow-2xl relative space-y-6">
        {/* Neutral Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-tenant/20 border border-tenant/40 text-tenant font-bold shadow-xl shadow-tenant/20 mb-2">
            <KeyRound className="w-8 h-8 text-tenant" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Ativação de Conta</h1>
          <p className="text-xs text-muted-foreground">
            Defina sua senha para concluir seu cadastro no <span className="text-white font-semibold">LOCGEST</span>
          </p>
        </div>

        {sessionValid || email ? (
          <form onSubmit={handleSetPassword} className="space-y-4 text-xs">
            <div>
              <label className="block text-muted-foreground mb-1 font-medium">E-mail</label>
              <input
                type="email"
                disabled
                value={email}
                className="w-full px-3.5 py-3 rounded-xl bg-white/5 border border-white/10 text-muted-foreground cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-medium">Nome Completo *</label>
              <div className="relative">
                <User className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Seu nome completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                />
              </div>
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-medium">Criar Nova Senha *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                />
              </div>
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-medium">Confirmar Nova Senha *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-tenant text-white font-bold text-xs shadow-lg shadow-tenant/20 hover:opacity-90 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Salvando Senha...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Concluir e Acessar o Sistema
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="text-center space-y-4 py-4">
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
              O link de convite pode ter expirado ou já foi utilizado. Solicite um novo convite ao administrador da locadora.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all flex items-center justify-center gap-2"
            >
              Ir para Tela de Login <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
