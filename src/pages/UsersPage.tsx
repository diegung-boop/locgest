import React, { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthProvider";
import { UserProfile, UserRole } from "@/types/locgest";
import { MockDataService } from "@/services/mockDataService";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { Users, Plus, ShieldCheck, Mail, Phone, UserCheck, KeyRound, Edit3, X, Building2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { maskPhone } from "@/utils/masks";
import { supabase } from "@/integrations/supabase/client";

export const UsersPage: React.FC = () => {
  const { organization, allOrganizations } = useTenant();
  const { sendPasswordResetEmail } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadProfiles = async () => {
    const list = await SupabaseDataService.getProfiles(organization.id);
    setProfiles(list);
  };

  useEffect(() => {
    loadProfiles();
  }, [organization.id]);

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    role: "Analista" as UserRole,
    organization_id: organization.id,
    phone: "",
  });

  // Sync formData.organization_id when active tenant changes
  useEffect(() => {
    setFormData((prev) => ({ ...prev, organization_id: organization.id }));
  }, [organization.id]);

  const roles: UserRole[] = ["Admin", "Diretor", "Gestor", "Analista", "Entregador", "Cliente"];

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!formData.full_name || !formData.email || !formData.organization_id) {
      toast.error("Preencha o nome, e-mail e selecione a locadora vinculada.");
      return;
    }

    try {
      setIsSaving(true);
      
      const { data, error } = await supabase.functions.invoke('invite_user', {
        body: {
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          organization_id: formData.organization_id,
          phone: formData.phone || "(11) 99999-8888",
          redirectTo: `${window.location.origin}/accept-invite`
        }
      });

      if (error) {
        let errorMsg = error.message;
        try {
          if (error.context && typeof error.context.json === "function") {
            const body = await error.context.json();
            if (body?.error) errorMsg = body.error;
          }
        } catch {}
        throw new Error(errorMsg);
      }

      await loadProfiles();

      const targetOrg = allOrganizations.find((o) => o.id === formData.organization_id);
      toast.success(`Usuário ${formData.full_name} convidado para a locadora ${targetOrg?.name || "selecionada"} com sucesso! Um e-mail foi enviado.`);
      setShowModal(false);
      setFormData({ full_name: "", email: "", role: "Analista", organization_id: organization.id, phone: "" });
    } catch (err: any) {
      console.error("Erro ao convidar usuário:", err);
      toast.error(err.message || "Erro ao cadastrar usuário.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEdit = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name || "",
      email: user.email || "",
      role: user.role || "Analista",
      organization_id: user.organization_id || organization.id,
      phone: user.phone || "",
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || !editingUser) return;
    if (!formData.full_name || !formData.email || !formData.organization_id) {
      toast.error("Preencha o nome, e-mail e selecione a locadora vinculada.");
      return;
    }

    try {
      setIsSaving(true);
      const updatedUser: UserProfile = {
        ...editingUser,
        organization_id: formData.organization_id,
        full_name: formData.full_name,
        email: formData.email,
        role: formData.role,
        phone: formData.phone,
        updated_at: new Date().toISOString(),
      };

      await SupabaseDataService.saveProfile(updatedUser);
      await loadProfiles();

      toast.success(`Dados do usuário ${updatedUser.full_name} atualizados no Supabase!`);
      setEditingUser(null);
    } catch (err) {
      toast.error("Erro ao atualizar usuário.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    await sendPasswordResetEmail(email);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-card border border-white/10">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-tenant" /> Gestão de Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de perfis para os usuários da <strong>{organization.name}</strong>. Atribua a cada usuário o perfil adequado para liberar as funções do sistema.
          </p>
        </div>
        <button
          onClick={() => {
            setFormData({ full_name: "", email: "", role: "Analista", organization_id: organization.id, phone: "" });
            setShowModal(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-tenant text-white text-xs font-bold shadow-lg shadow-tenant/20 hover:opacity-90 transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" /> Cadastrar Usuário
        </button>
      </div>

      {/* User Table */}
      <div className="rounded-2xl glass-card border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 border-b border-white/10 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Nome do Usuário</th>
                <th className="p-4">E-mail (Supabase Auth)</th>
                <th className="p-4">Locadora Vinculada</th>
                <th className="p-4">Cargo / Função</th>
                <th className="p-4 text-right">Ações Supabase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {profiles.map((p) => {
                const userOrg = allOrganizations.find((o) => o.id === p.organization_id) || organization;
                return (
                  <tr key={p.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-bold text-white flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-tenant/20 border border-tenant/30 flex items-center justify-center font-bold text-tenant">
                        {p.full_name.charAt(0)}
                      </div>
                      <div>
                        <div>{p.full_name}</div>
                        {p.is_super_admin && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                            SuperAdmin
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        {p.email}
                      </div>
                    </td>
                    <td className="p-4">
                      {p.organization_id ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-white font-medium border border-white/10 text-[11px]">
                          <Building2 className="w-3 h-3 text-tenant" /> {userOrg.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20 text-[11px]">
                          <AlertTriangle className="w-3 h-3 text-amber-400" /> Sem Locadora Vinculada
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase border ${p.role === "Admin" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                        p.role === "Diretor" ? "bg-purple-500/20 text-purple-300 border-purple-500/30" :
                          p.role === "Gestor" ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
                            p.role === "Entregador" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
                              "bg-sky-500/20 text-sky-300 border-sky-500/30"
                        }`}>
                        {p.role}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white font-bold text-[11px] flex items-center gap-1 border border-white/10 transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-400" /> Editar
                        </button>
                        <button
                          onClick={() => handleResetPassword(p.email)}
                          className="px-3 py-1.5 rounded-lg bg-tenant/20 hover:bg-tenant text-tenant hover:text-white font-bold text-[11px] flex items-center gap-1 border border-tenant/30 transition-all"
                        >
                          <KeyRound className="w-3.5 h-3.5" /> Reset Senha
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add User */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl glass-panel border border-white/20 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-tenant" /> Convidar Usuário via Supabase Auth
              </h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1 font-semibold">Organização / Locadora Vinculada *</label>
                <select
                  required
                  value={formData.organization_id}
                  onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-tenant"
                >
                  {allOrganizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: João da Silva"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">E-mail Corporativo (Supabase Auth) *</label>
                <input
                  type="email"
                  required
                  placeholder="joao@locadora.com.br"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  placeholder="(11) 99999-8888"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Função / Perfil (RBAC)</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-tenant"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-tenant text-white font-bold shadow-lg shadow-tenant/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Criar Usuário & Disparar Convite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit User */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl glass-panel border border-white/20 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" /> Editar Usuário Supabase
              </h2>
              <button onClick={() => setEditingUser(null)} className="text-muted-foreground hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1 font-semibold">Organização / Locadora Vinculada *</label>
                <select
                  required
                  value={formData.organization_id}
                  onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-tenant"
                >
                  {allOrganizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: João da Silva"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">E-mail Corporativo *</label>
                <input
                  type="email"
                  required
                  placeholder="joao@locadora.com.br"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  placeholder="(85) 99221-8282"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: maskPhone(e.target.value) })}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant font-semibold"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Função / Perfil (RBAC)</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-tenant"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-lg shadow-amber-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
