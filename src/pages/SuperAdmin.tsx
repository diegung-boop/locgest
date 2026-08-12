import React, { useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Organization } from "@/types/locgest";
import { MockDataService } from "@/services/mockDataService";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { Building2, Plus, CheckCircle2, Shield, ArrowRight, ExternalLink, Loader2, Edit3, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { maskCpfCnpj, validateCpfCnpj } from "@/utils/masks";

export const SuperAdminPage: React.FC = () => {
  const { allOrganizations, organization, switchOrganization, refreshOrganization } = useTenant();

  const [showModal, setShowModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const initialFormState = {
    name: "",
    slug: "",
    trade_name: "",
    cnpj: "",
    primary_color: "#0284c7",
    logo_url: "",
    plan: "Enterprise",
  };

  const [formData, setFormData] = useState(initialFormState);

  const handleOpenCreateModal = () => {
    setEditingOrg(null);
    setFormData(initialFormState);
    setShowModal(true);
  };

  const handleOpenEditModal = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      slug: org.slug,
      trade_name: org.trade_name || org.name,
      cnpj: org.cnpj || "",
      primary_color: org.primary_color || "#0284c7",
      logo_url: org.logo_url || "",
      plan: org.plan || "Enterprise",
    });
    setShowModal(true);
  };

  const handleDeleteOrg = async (org: Organization) => {
    if (allOrganizations.length <= 1) {
      toast.error("Não é possível excluir a única locadora cadastrada no sistema.");
      return;
    }

    if (!window.confirm(`Tem certeza que deseja excluir o cadastro da empresa ${org.name}? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      await SupabaseDataService.deleteOrganization(org.id);
      
      // If deleted organization was the currently active tenant, switch to another
      if (org.id === organization.id) {
        const remaining = allOrganizations.find((o) => o.id !== org.id);
        if (remaining) {
          switchOrganization(remaining);
        }
      }

      await refreshOrganization();
      toast.success(`Locadora ${org.name} excluída com sucesso!`);
    } catch (err) {
      toast.error("Erro ao excluir locadora no Supabase.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!formData.name || !formData.slug) {
      toast.error("Preencha o nome e a URL amigável (slug) da locadora.");
      return;
    }

    if (formData.cnpj) {
      const validation = validateCpfCnpj(formData.cnpj);
      if (!validation.isValid) {
        toast.error("CNPJ ou CPF digitado para a empresa é inválido! Por favor, verifique.");
        return;
      }
    }

    try {
      setIsSaving(true);
      const targetOrg: Organization = {
        id: editingOrg ? editingOrg.id : crypto.randomUUID(),
        name: formData.name,
        slug: formData.slug.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        trade_name: formData.trade_name || formData.name,
        cnpj: formData.cnpj || "00.000.000/0001-00",
        logo_url: formData.logo_url || null,
        primary_color: formData.primary_color,
        plan: formData.plan,
        status: "active",
        created_at: editingOrg ? editingOrg.created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await SupabaseDataService.saveOrganization(targetOrg);
      await refreshOrganization();
      toast.success(editingOrg ? `Cadastro da locadora ${targetOrg.name} atualizado!` : `Locadora ${targetOrg.name} salva no banco de dados Supabase!`);
      setShowModal(false);
      setEditingOrg(null);
      setFormData(initialFormState);
    } catch (err) {
      toast.error("Erro ao salvar locadora.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-card border border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-amber-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">SuperAdmin Whitelabel</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de locadoras contratantes e alternância de contexto (Multi-Tenant).
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 rounded-xl bg-tenant text-white text-xs font-bold shadow-lg shadow-tenant/20 hover:opacity-90 transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" /> Nova Empresa
        </button>
      </div>

      {/* Locadoras Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allOrganizations.map((org) => {
          const isActive = org.id === organization.id;
          return (
            <div
              key={org.id}
              className={`p-5 rounded-2xl glass-card border transition-all space-y-4 relative ${isActive
                  ? "border-tenant shadow-xl shadow-tenant/10 bg-tenant/5"
                  : "border-white/5 hover:border-white/20"
                }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-inner shrink-0"
                    style={{ backgroundColor: org.primary_color }}
                  >
                    {org.logo_url ? (
                      <img src={org.logo_url} alt={org.name} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      org.name.charAt(0)
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm line-clamp-1">{org.name}</h3>
                    <p className="text-xs text-muted-foreground">{org.slug}.locgest.com.br</p>
                  </div>
                </div>

                {/* Card Quick Actions: Edit & Delete */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Editar Empresa Locadora"
                    onClick={() => handleOpenEditModal(org)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-amber-500/20 text-muted-foreground hover:text-amber-400 border border-white/10 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Excluir Empresa Locadora"
                    onClick={() => handleDeleteOrg(org)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 border border-white/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground border-t border-b border-white/5 py-3">
                <div className="flex justify-between">
                  <span>CNPJ:</span>
                  <span className="text-white font-medium">{org.cnpj || "Não informado"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Plano:</span>
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-bold text-[10px]">
                    {org.plan}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ativo
                  </span>
                </div>
              </div>

              <button
                onClick={() => switchOrganization(org)}
                className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${isActive
                    ? "bg-tenant/20 text-tenant border border-tenant/30 cursor-default"
                    : "bg-white/5 hover:bg-white/15 text-white border border-white/10"
                  }`}
              >
                {isActive ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Tenant Ativo no Momento
                  </>
                ) : (
                  <>
                    Simular Esta Locadora <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal Add/Edit Locadora */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 rounded-2xl glass-panel border border-white/20 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-tenant" /> {editingOrg ? `Editar Empresa: ${editingOrg.name}` : "Cadastrar Nova Locadora Whitelabel"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditingOrg(null);
                }}
                className="text-muted-foreground hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1 font-semibold">Nome da Empresa Locadora *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Locadora Rápida Equipamentos"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value, slug: editingOrg ? formData.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-") })}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1">Slug Subdomínio *</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: locadararapida"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">CNPJ</label>
                  <input
                    type="text"
                    placeholder="00.000.000/0001-00"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: maskCpfCnpj(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Cor Primária Whitelabel (Hexadecimal)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="flex-1 p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">URL do Logotipo</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingOrg(null);
                  }}
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
                  {editingOrg ? "Salvar Alterações" : "Salvar Locadora"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
