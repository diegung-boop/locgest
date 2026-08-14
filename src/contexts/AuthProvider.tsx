import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { UserProfile, UserRole } from "@/types/locgest";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<boolean>;
  sendPasswordResetEmail: (email: string) => Promise<boolean>;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: false,
  signInWithEmail: async () => false,
  sendPasswordResetEmail: async () => false,
  refreshUser: async () => {},
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(async (sessionUser: any): Promise<UserProfile | null> => {
    if (!sessionUser) return null;

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", sessionUser.id)
        .maybeSingle();

      if (profile) {
        return profile as UserProfile;
      }

      // If profiles row isn't ready or RLS limited, build directly from auth session metadata
      const meta = sessionUser.user_metadata || {};
      return {
        id: sessionUser.id,
        organization_id: meta.organization_id || "",
        email: sessionUser.email || "",
        full_name: meta.full_name || sessionUser.email || "Usuário",
        role: (meta.role as UserRole) || "Analista",
        is_super_admin: meta.is_super_admin === true || meta.is_super_admin === "true",
        avatar_url: meta.avatar_url,
        phone: meta.phone,
        created_at: sessionUser.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } catch (err) {
      console.warn("Supabase Auth session check warning:", err);
      return null;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await fetchUserProfile(session.user);
        setUser(profile);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Erro ao atualizar dados do usuário:", err);
    }
  }, [fetchUserProfile]);

  useEffect(() => {
    const initSession = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await fetchUserProfile(session.user);
          setUser(profile);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.warn("Init session error:", err);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await fetchUserProfile(session.user);
        setUser(profile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

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
      const profile = await fetchUserProfile(data.user);
      setUser(profile);
      toast.success("Login efetuado com sucesso!");
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

    toast.success(`E-mail de redefinição de senha enviado para ${email}!`);
    return true;
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    setUser(null);
    sessionStorage.removeItem("locgest_superadmin_org_override");
    localStorage.removeItem("locgest_active_user");
    toast.info("Sessão encerrada.");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithEmail,
        sendPasswordResetEmail,
        refreshUser,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

