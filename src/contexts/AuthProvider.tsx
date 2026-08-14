import React, { createContext, useContext, useEffect, useState } from "react";
import { UserProfile, UserRole } from "@/types/locgest";
import { supabase } from "@/integrations/supabase/client";
import { MockDataService } from "@/services/mockDataService";
import { toast } from "sonner";

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  loginAsRole: (role: UserRole) => void;
  signInWithEmail: (email: string, pass: string) => Promise<boolean>;
  sendPasswordResetEmail: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: false,
  loginAsRole: () => {},
  signInWithEmail: async () => false,
  sendPasswordResetEmail: async () => false,
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem("locgest_active_user");
      if (saved) return JSON.parse(saved);
    } catch {}
    // No auto-login fallback: an app with route guards needs "no saved
    // session" to genuinely mean logged out, otherwise / (and even /login
    // itself) silently re-admits a demo user after a real signOut + reload.
    // Use the "Acesso Rápido" buttons on the login screen for demo access.
    return null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sync with Supabase Auth Session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .maybeSingle();

          if (profile) {
            setUser(profile as UserProfile);
          }
        }
      } catch (err) {
        console.warn("Supabase Auth session check warning:", err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profile) {
          setUser(profile as UserProfile);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem("locgest_active_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("locgest_active_user");
    }
  }, [user]);

  const signInWithEmail = async (email: string, pass: string): Promise<boolean> => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) {
      toast.error(`Erro ao fazer login: ${error.message}`);
      setLoading(false);
      return false;
    }

    if (data.user) {
      toast.success("Login efetuado com sucesso via Supabase Auth!");
    }
    setLoading(false);
    return true;
  };

  const sendPasswordResetEmail = async (email: string): Promise<boolean> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error(`Erro ao enviar e-mail de redefinição: ${error.message}`);
      return false;
    }

    toast.success(`E-mail oficial de redefinição de senha enviado para ${email}!`);
    return true;
  };

  const loginAsRole = (role: UserRole) => {
    setLoading(true);
    const profiles = MockDataService.getProfiles();
    let found = profiles.find((p) => p.role === role);
    if (!found) {
      found = {
        id: `11111111-1111-1111-1111-111111111111`,
        organization_id: "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
        email: `${role.toLowerCase()}@terraforte.com.br`,
        full_name: `Simulação - ${role}`,
        role: role,
        is_super_admin: role === "Admin",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    setUser(found);
    setLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem("locgest_active_user");
    toast.info("Sessão encerrada.");
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginAsRole, signInWithEmail, sendPasswordResetEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
