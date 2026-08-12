import React, { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Client } from "@/types/locgest";
import { MockDataService } from "@/services/mockDataService";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { ClientFolderModal } from "@/components/clients/ClientFolderModal";
import { FolderKanban, Plus, Search, Building2, Mail, Phone, MapPin, ChevronRight, Loader2, Edit3, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { maskPhone, maskCpfCnpj, validateCpfCnpj } from "@/utils/masks";

export const ClientsPage: React.FC = () => {
  const { organization } = useTenant();
  const [clients, setClients] = useState<Client[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadClients = async () => {
    const list = await SupabaseDataService.getClients(organization.id);
    setClients(list);
  };

  useEffect(() => {
    loadClients();
  }, [organization.id]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const initialFormState = {
    company_name: "",
    trade_name: "",
    cnpj_cpf: "",
    email: "",
    phone: "",
    contact_person: "",
    default_job_site: "",
  };

  const [formData, setFormData] = useState(initialFormState);

  const handleOpenCreateModal = () => {
    setEditingClient(null);
    setFormData(initialFormState);
    setShowModal(true);
  };

  const handleOpenEditModal = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClient(client);
    setFormData({
      company_name: client.company_name,
      trade_name: client.trade_name || "",
      cnpj_cpf: client.cnpj_cpf,
      email: client.email,
      phone: client.phone || "",
      contact_person: client.contact_person || "",
      default_job_site: client.default_job_site || "",
    });
    setShowModal(true);
  };

  const handleDeleteClient = async (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Tem certeza que deseja excluir o cadastro do cliente ${client.company_name}? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      await SupabaseDataService.deleteClient(client.id);
      await loadClients();
      toast.success(`Cliente ${client.company_name} removido com sucesso!`);
      if (selectedClient?.id === client.id) {
        setSelectedClient(null);
      }
    } catch (err) {
      toast.error("Erro ao excluir cliente.");
    }
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!formData.company_name || !formData.cnpj_cpf || !formData.email) {
      toast.error("Preencha Razão Social, CNPJ / CPF e E-mail.");
      return;
    }

    // CPF / CNPJ Checksum Validation
    const validation = validateCpfCnpj(formData.cnpj_cpf);
    if (!validation.isValid) {
      toast.error("CNPJ ou CPF digitado é inválido! Por favor, verifique o documento.");
      return;
    }

    try {
      setIsSaving(true);
      const targetClient: Client = {
        id: editingClient ? editingClient.id : crypto.randomUUID(),
        organization_id: organization.id,
        company_name: formData.company_name,
        trade_name: formData.trade_name || formData.company_name,
        cnpj_cpf: formData.cnpj_cpf,
        email: formData.email,
        phone: formData.phone || "(11) 3000-0000",
        contact_person: formData.contact_person || "Responsável Operacional",
        default_job_site: formData.default_job_site || "Obra Principal",
        created_at: editingClient ? editingClient.created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await SupabaseDataService.saveClient(targetClient);
      await loadClients();
      toast.success(editingClient ? `Cadastro de ${targetClient.company_name} atualizado!` : `Cliente ${targetClient.company_name} salvo no Supabase!`);
      setShowModal(false);
      setEditingClient(null);
      setFormData(initialFormState);
    } catch (err) {
      toast.error("Erro ao salvar cliente.");
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = clients.filter(
    (c) =>
      c.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cnpj_cpf.includes(searchTerm) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-card border border-white/10">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-tenant" /> Cadastro de Clientes & Pastas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cada cliente possui uma <strong>Pasta</strong> com propostas, contratos, NFs, boletos e OS de entregas interligadas.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 rounded-xl bg-tenant text-white text-xs font-bold shadow-lg shadow-tenant/20 hover:opacity-90 transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" /> Cadastrar Cliente
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-4 rounded-xl glass-panel border border-white/10">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por Razão Social, CNPJ ou E-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-tenant"
          />
        </div>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((c) => (
          <div
            key={c.id}
            onClick={() => setSelectedClient(c)}
            className="p-5 rounded-2xl glass-card border border-white/10 hover:border-tenant/50 transition-all cursor-pointer group space-y-4 relative"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-tenant/20 border border-tenant/30 flex items-center justify-center font-bold text-tenant text-lg group-hover:scale-105 transition-transform">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm line-clamp-1">{c.company_name}</h3>
                  <p className="text-xs text-muted-foreground">CNPJ/CPF: {c.cnpj_cpf}</p>
                </div>
              </div>
              
              {/* Quick Card Action Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Editar Cliente"
                  onClick={(e) => handleOpenEditModal(c, e)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-amber-500/20 text-muted-foreground hover:text-amber-400 border border-white/10 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Excluir Cliente"
                  onClick={(e) => handleDeleteClient(c, e)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 border border-white/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground border-t border-white/5 pt-3">
              <div className="flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 text-tenant shrink-0" />
                <span className="truncate">{c.email}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-tenant shrink-0" />
                <span>{c.phone}</span>
              </div>
              <div className="col-span-2 flex items-center gap-1.5 truncate text-[11px] text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">Obra: {c.default_job_site || "Não especificada"}</span>
              </div>
            </div>

            <div className="w-full py-2 rounded-xl bg-tenant/15 text-tenant text-xs font-bold text-center border border-tenant/30 group-hover:bg-tenant group-hover:text-white transition-colors flex items-center justify-center gap-1.5">
              <FolderKanban className="w-4 h-4" /> Abrir Pasta do Cliente
            </div>
          </div>
        ))}
      </div>

      {/* Client Folder Cascading Drawer/Modal */}
      {selectedClient && (
        <ClientFolderModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onEdit={() => {
            const c = selectedClient;
            setSelectedClient(null);
            setEditingClient(c);
            setFormData({
              company_name: c.company_name,
              trade_name: c.trade_name || "",
              cnpj_cpf: c.cnpj_cpf,
              email: c.email,
              phone: c.phone || "",
              contact_person: c.contact_person || "",
              default_job_site: c.default_job_site || "",
            });
            setShowModal(true);
          }}
          onDelete={async () => {
            const c = selectedClient;
            setSelectedClient(null);
            await SupabaseDataService.deleteClient(c.id);
            await loadClients();
            toast.success(`Cliente ${c.company_name} removido com sucesso!`);
          }}
        />
      )}

      {/* Modal Add/Edit Client */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 rounded-2xl glass-panel border border-white/20 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-tenant" /> {editingClient ? `Editar Cadastro: ${editingClient.company_name}` : "Cadastrar Novo Cliente"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditingClient(null);
                }}
                className="text-muted-foreground hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveClient} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1 font-semibold">Razão Social *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Construtora Exemplo LTDA"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1">Nome Fantasia</label>
                  <input
                    type="text"
                    placeholder="ex: Construtora Exemplo"
                    value={formData.trade_name}
                    onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">CNPJ / CPF *</label>
                  <input
                    type="text"
                    required
                    placeholder="00.000.000/0001-00"
                    value={formData.cnpj_cpf}
                    onChange={(e) => setFormData({ ...formData, cnpj_cpf: maskCpfCnpj(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1">E-mail Financeiro *</label>
                  <input
                    type="email"
                    required
                    placeholder="financeiro@cliente.com.br"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Telefone</label>
                  <input
                    type="text"
                    placeholder="(85) 99221-8282"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: maskPhone(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Local da Obra Principal</label>
                <input
                  type="text"
                  placeholder="ex: Av. Paulista, 1000 - Canteiro 02"
                  value={formData.default_job_site}
                  onChange={(e) => setFormData({ ...formData, default_job_site: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingClient(null);
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
                  {editingClient ? "Salvar Alterações" : "Salvar Cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
