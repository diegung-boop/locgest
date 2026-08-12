import React, { useState, useEffect } from "react";
import { Client, Proposal, Contract, Equipment, ServiceOrder } from "@/types/locgest";
import { MockDataService } from "@/services/mockDataService";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { CreateProposalModal } from "@/components/proposals/CreateProposalModal";
import {
  FolderKanban,
  X,
  Building2,
  FileText,
  ShieldCheck,
  Receipt,
  Truck,
  MapPin,
  Camera,
  Navigation,
  ExternalLink,
  Plus,
  Send,
  CheckCircle,
  FilePlus,
  Link2,
  Loader2,
  Edit3,
  Trash2
} from "lucide-react";
import { toast } from "sonner";

interface ClientFolderModalProps {
  client: Client;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const ClientFolderModal: React.FC<ClientFolderModalProps> = ({ client, onClose, onEdit, onDelete }) => {
  const [activeTab, setActiveTab] = useState<"overview" | "proposals" | "contracts" | "financial" | "logistics">("overview");

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [financialRecords, setFinancialRecords] = useState<any[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);

  const [showCreatePropModal, setShowCreatePropModal] = useState(false);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  const loadData = async () => {
    const props = await SupabaseDataService.getProposals(client.organization_id);
    const conts = await SupabaseDataService.getContracts(client.organization_id);
    const fins = await SupabaseDataService.getFinancialRecords(client.organization_id);
    const oses = await SupabaseDataService.getServiceOrders(client.organization_id);

    setProposals(props.filter((p) => p.client_id === client.id));
    setContracts(conts.filter((c) => c.client_id === client.id));
    setFinancialRecords(fins.filter((f) => f.client_id === client.id));
    setServiceOrders(oses.filter((s) => s.client_id === client.id));
  };

  useEffect(() => {
    loadData();
  }, [client.id, client.organization_id]);

  const totalSpent = financialRecords
    .filter((f) => f.status === "Paid")
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Send Proposal to Client (WhatsApp link simulation)
  const handleSendProposal = (prop: Proposal) => {
    const text = encodeURIComponent(
      `Olá ${client.company_name}! Segue a proposta comercial ${prop.proposal_number} no valor de R$ ${prop.total_amount.toLocaleString("pt-BR")} para locação de equipamento.`
    );
    const whatsappUrl = `https://wa.me/?text=${text}`;
    window.open(whatsappUrl, "_blank");
    toast.success(`Link da Proposta ${prop.proposal_number} preparado para envio!`);
  };

  // Approve Proposal & Convert to Contract inside Client Folder (With Debounce Protection)
  const handleApproveProposalInsideFolder = async (prop: Proposal) => {
    if (loadingActionId) return;

    // Check if contract already generated for this proposal
    const existingContract = contracts.find((c) => c.proposal_id === prop.id);
    if (existingContract) {
      toast.info(`Já existe um contrato (${existingContract.contract_number}) gerado para esta proposta!`);
      return;
    }

    try {
      setLoadingActionId(prop.id);

      const updatedProp: Proposal = { ...prop, status: "Approved" };
      await SupabaseDataService.saveProposal(updatedProp);

      const newContract: Contract = {
        id: crypto.randomUUID(),
        organization_id: client.organization_id,
        client_id: client.id,
        proposal_id: prop.id,
        contract_number: `CONT-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        status: "Active",
        total_value: prop.total_amount,
        billing_cycle: "Monthly",
        start_date: prop.start_date,
        end_date: prop.end_date,
        terms_conditions: `Contrato assinado gerado a partir da proposta ${prop.proposal_number}.`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await SupabaseDataService.saveContract(newContract);

      // Auto generate initial financial record (NF / Boleto) linked to Contract
      await SupabaseDataService.saveFinancialRecord({
        id: crypto.randomUUID(),
        organization_id: client.organization_id,
        client_id: client.id,
        contract_id: newContract.id,
        code_number: `NF-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        type: "nf_service",
        description: `Locação referente ao Contrato ${newContract.contract_number}`,
        amount: prop.total_amount,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "Pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await loadData();
      toast.success(`Proposta aprovada! Contrato ${newContract.contract_number} e cobrança criados.`);
    } catch (err) {
      toast.error("Erro ao aprovar proposta. Tente novamente.");
    } finally {
      setLoadingActionId(null);
    }
  };

  // Generate OS Logistics directly from Contract (With Debounce Protection & Duplicate Prevention)
  const handleGenerateOSFromContract = async (contract: Contract) => {
    if (loadingActionId) return;

    // Check if an OS already exists for this contract
    const existingOS = serviceOrders.find((os) => os.contract_id === contract.id);
    if (existingOS) {
      toast.info(`Já existe uma Ordem de Serviço (${existingOS.os_number}) para este contrato!`);
      return;
    }

    try {
      setLoadingActionId(contract.id);

      const newOS: ServiceOrder = {
        id: crypto.randomUUID(),
        organization_id: client.organization_id,
        client_id: client.id,
        contract_id: contract.id,
        os_number: `OS-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        status: "Pending",
        type: "Delivery",
        scheduled_date: new Date().toISOString().split("T")[0],
        job_site_address: client.billing_address || "Canteiro de Obras",
        equipment_ids: [],
        photos: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await SupabaseDataService.saveServiceOrder(newOS);
      await loadData();
      toast.success(`Ordem de Serviço ${newOS.os_number} vinculada ao Contrato ${contract.contract_number}!`);
    } catch (err) {
      toast.error("Erro ao gerar Ordem de Serviço. Tente novamente.");
    } finally {
      setLoadingActionId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-5xl h-[85vh] rounded-2xl glass-panel border border-white/20 flex flex-col overflow-hidden shadow-2xl">
        {/* Header - Client Folder Identity */}
        <div className="p-6 bg-slate-900/90 border-b border-white/10 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-tenant/20 border border-tenant/40 flex items-center justify-center font-black text-2xl text-tenant shadow-lg shadow-tenant/10">
              <FolderKanban className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-tenant-soft text-tenant border border-tenant/30">
                  Pasta do Cliente
                </span>
                <span className="text-xs text-muted-foreground">CNPJ: {client.cnpj_cpf}</span>
              </div>
              <h2 className="text-xl font-black text-white tracking-tight">{client.company_name}</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                <span>{client.trade_name || client.contact_person}</span> • <span>{client.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-amber-500/20 text-muted-foreground hover:text-amber-400 border border-white/10 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" /> Editar Cadastro
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Tem certeza que deseja excluir o cadastro do cliente ${client.company_name}? Esta ação não pode ser desfeita.`)) {
                    onDelete();
                  }
                }}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 border border-white/10 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir Cliente
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-muted-foreground hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 bg-slate-950 border-b border-white/10 overflow-x-auto">
          {[
            { id: "overview", label: "Visão Geral", icon: Building2 },
            { id: "proposals", label: `Propostas (${proposals.length})`, icon: FileText },
            { id: "contracts", label: `Contratos (${contracts.length})`, icon: ShieldCheck },
            { id: "financial", label: `Financeiro (${financialRecords.length})`, icon: Receipt },
            { id: "logistics", label: `Entregas & OS (${serviceOrders.length})`, icon: Truck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? "border-tenant text-tenant bg-tenant/10"
                    : "border-transparent text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl glass-card border border-white/5 space-y-1">
                  <span className="text-xs text-muted-foreground">Total Faturado</span>
                  <div className="text-xl font-black text-emerald-400">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalSpent)}
                  </div>
                </div>
                <div className="p-4 rounded-xl glass-card border border-white/5 space-y-1">
                  <span className="text-xs text-muted-foreground">Contratos Ativos</span>
                  <div className="text-xl font-black text-white">{contracts.filter((c) => c.status === "Active").length}</div>
                </div>
                <div className="p-4 rounded-xl glass-card border border-white/5 space-y-1">
                  <span className="text-xs text-muted-foreground">Local Padrão de Obra</span>
                  <div className="text-xs font-bold text-white truncate">{client.default_job_site || "Não informado"}</div>
                </div>
              </div>

              {/* Action bar inside Overview */}
              <div className="p-4 rounded-xl bg-tenant/10 border border-tenant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-white">Iniciar Ciclo Completo de Locação</h4>
                  <p className="text-[11px] text-muted-foreground">Crie proposta comercial vinculada exclusivamente a esta empresa com travamento automático de segurança.</p>
                </div>
                <button
                  onClick={() => {
                    setActiveTab("proposals");
                    setShowCreatePropModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-tenant text-white text-xs font-bold shadow-lg shadow-tenant/20 flex items-center gap-2 shrink-0 hover:opacity-90 transition-all"
                >
                  <Plus className="w-4 h-4" /> Criar Nova Proposta
                </button>
              </div>

              {/* Cascading Traceability Map */}
              <div className="p-5 rounded-2xl glass-card border border-white/10 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-tenant flex items-center gap-2">
                  <FolderKanban className="w-4 h-4" /> Estrutura Cascateada do Cliente
                </h3>
                <div className="space-y-3 relative pl-4 border-l-2 border-tenant/30">
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-sky-500"></div>
                    <p className="text-xs font-bold text-white">1. Pedido / Proposta Inicial</p>
                    <p className="text-[11px] text-muted-foreground">Solicitação do cliente com tipo de equipamento, prazo e local da obra.</p>
                  </div>
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-emerald-500"></div>
                    <p className="text-xs font-bold text-white">2. Contrato de Locação Assinado</p>
                    <p className="text-[11px] text-muted-foreground">Vínculo jurídico e termos de manutenção acordados.</p>
                  </div>
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-amber-500"></div>
                    <p className="text-xs font-bold text-white">3. Emissão de NFs + Boletos + NF de Remessa</p>
                    <p className="text-[11px] text-muted-foreground">Envio dos documentos fiscais e boleto de cobrança.</p>
                  </div>
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-purple-500"></div>
                    <p className="text-xs font-bold text-white">4. Ordem de Serviço de Entrega (OS)</p>
                    <p className="text-[11px] text-muted-foreground">Confirmação de transporte, fotos da máquina no local e GPS.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROPOSALS */}
          {activeTab === "proposals" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-xs font-bold text-muted-foreground">Propostas do Cliente</span>
                <button
                  onClick={() => setShowCreatePropModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-tenant text-white text-xs font-bold shadow-md shadow-tenant/20 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Nova Proposta
                </button>
              </div>

              {proposals.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhuma proposta vinculada a este cliente.</p>
              ) : (
                proposals.map((p) => (
                  <div key={p.id} className="p-4 rounded-xl glass-card border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">{p.proposal_number}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        p.status === "Approved" ? "bg-emerald-500/20 text-emerald-400" : "bg-sky-500/20 text-sky-400"
                      }`}>
                        {p.status === "Approved" ? "Aprovada & Contratada" : p.status}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p><strong className="text-white">Obra:</strong> {p.job_site_name} ({p.job_site_address})</p>
                      <p><strong className="text-white">Período:</strong> {p.start_date} até {p.end_date}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1.5">
                      <div className="text-[11px] font-bold text-white flex justify-between">
                        <span>Equipamentos Cotados ({p.equipment_items?.length || 0}):</span>
                        <span className="text-emerald-400">Total: R$ {p.total_amount.toLocaleString("pt-BR")}</span>
                      </div>
                      {p.equipment_items?.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-slate-300 pt-1 border-t border-white/5">
                          <span>{item.qty}x {item.equipment_name} ({item.duration_months || 1}m)</span>
                          <span className="font-bold">R$ {item.total_amount.toLocaleString("pt-BR")}</span>
                        </div>
                      ))}
                    </div>

                    {/* Action Buttons inside Proposal */}
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-white/5">
                      <button
                        onClick={() => handleSendProposal(p)}
                        className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-white font-bold text-[11px] flex items-center gap-1 border border-sky-500/30 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" /> Enviar WhatsApp / E-mail
                      </button>

                      {p.status !== "Approved" && (
                        <button
                          onClick={() => handleApproveProposalInsideFolder(p)}
                          disabled={Boolean(loadingActionId)}
                          className={`px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-md transition-all ${
                            loadingActionId === p.id
                              ? "bg-emerald-600/50 text-white cursor-not-allowed opacity-75"
                              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
                          }`}
                        >
                          {loadingActionId === p.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" /> Aprovar & Gerar Contrato
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: CONTRACTS */}
          {activeTab === "contracts" && (
            <div className="space-y-4">
              {contracts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhum contrato ativo.</p>
              ) : (
                contracts.map((c) => {
                  const originatingProp = proposals.find((p) => p.id === c.proposal_id);
                  const hasOS = serviceOrders.some((os) => os.contract_id === c.id);

                  return (
                    <div key={c.id} className="p-4 rounded-xl glass-card border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">{c.contract_number}</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                          {c.status}
                        </span>
                      </div>

                      {/* Cascading Proposal Link Badge */}
                      {originatingProp && (
                        <div className="p-3 rounded-xl bg-slate-900 border border-tenant/30 text-xs space-y-2">
                          <div className="flex items-center justify-between font-bold text-tenant">
                            <span className="flex items-center gap-1.5">
                              <Link2 className="w-3.5 h-3.5" /> Ref. Proposta Origem: {originatingProp.proposal_number}
                            </span>
                            <span className="text-[10px] text-emerald-400">R$ {originatingProp.total_amount.toLocaleString("pt-BR")}</span>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] text-slate-300"><strong className="text-white">Local Obra:</strong> {originatingProp.job_site_name} ({originatingProp.job_site_address})</p>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {originatingProp.equipment_items?.map((item, idx) => (
                                <span key={idx} className="bg-white/5 text-slate-200 px-2 py-0.5 rounded text-[10px] font-medium border border-white/5">
                                  {item.qty}x {item.equipment_name} ({item.duration_months || 1}m) - R$ {item.total_amount.toLocaleString("pt-BR")}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">{c.terms_conditions}</p>
                      <div className="flex justify-between items-center pt-2 text-xs border-t border-white/5">
                        <span className="text-muted-foreground">Ciclo: {c.billing_cycle} ({c.start_date} a {c.end_date})</span>
                        <span className="font-extrabold text-emerald-400 text-sm">
                          R$ {c.total_value.toLocaleString("pt-BR")}
                        </span>
                      </div>

                      {/* Generate OS Logistics Button inside Contract (With Loading & Duplicate Prevention) */}
                      <div className="flex justify-end pt-2 border-t border-white/5">
                        <button
                          onClick={() => handleGenerateOSFromContract(c)}
                          disabled={Boolean(loadingActionId) || hasOS}
                          className={`px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1 border transition-all ${
                            hasOS
                              ? "bg-slate-800 text-slate-400 border-white/10 cursor-not-allowed"
                              : loadingActionId === c.id
                              ? "bg-tenant/50 text-white border-tenant/30 cursor-not-allowed opacity-75"
                              : "bg-tenant/20 hover:bg-tenant text-tenant hover:text-white border-tenant/30"
                          }`}
                        >
                          {loadingActionId === c.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando OS...
                            </>
                          ) : hasOS ? (
                            <>
                              <Truck className="w-3.5 h-3.5 text-emerald-400" /> OS de Logística Gerada
                            </>
                          ) : (
                            <>
                              <FilePlus className="w-3.5 h-3.5" /> Gerar OS de Logística / Entrega
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 4: FINANCIAL */}
          {activeTab === "financial" && (
            <div className="space-y-4">
              {financialRecords.map((f) => {
                const linkedContract = contracts.find((c) => c.id === f.contract_id);
                const linkedProp = proposals.find((p) => p.id === linkedContract?.proposal_id);
                return (
                  <div key={f.id} className="p-4 rounded-xl glass-card border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{f.code_number}</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            f.type === "nf_service" ? "bg-sky-500/20 text-sky-300" :
                            f.type === "nf_remessa" ? "bg-purple-500/20 text-purple-300" :
                            "bg-amber-500/20 text-amber-300"
                          }`}>
                            {f.type === "nf_service" ? "NF Serviço" : f.type === "nf_remessa" ? "NF Remessa" : "Boleto"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{f.description}</p>
                        <p className="text-[11px] text-slate-400">Vencimento: {f.due_date}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-sm font-extrabold text-white">
                          R$ {f.amount.toLocaleString("pt-BR")}
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                          {f.status}
                        </span>
                      </div>
                    </div>

                    {/* Cascading Contract & Proposal Link Badge */}
                    {linkedContract && (
                      <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/30 text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-emerald-400">
                          <span className="flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5" /> Ref. Contrato Vinculado: {linkedContract.contract_number}
                          </span>
                          {linkedProp && (
                            <span className="text-[10px] text-sky-400 font-medium">Proposta: {linkedProp.proposal_number}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300">
                          Valor Contratado: <strong className="text-emerald-400">R$ {linkedContract.total_value.toLocaleString("pt-BR")}</strong> | Período: {linkedContract.start_date} até {linkedContract.end_date}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 5: LOGISTICS */}
          {activeTab === "logistics" && (
            <div className="space-y-4">
              {serviceOrders.map((os) => {
                const linkedContract = contracts.find((c) => c.id === os.contract_id);
                const linkedProp = proposals.find((p) => p.id === linkedContract?.proposal_id);
                return (
                  <div key={os.id} className="p-5 rounded-2xl glass-card border border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white text-sm">{os.os_number}</span>
                        <span className="ml-2 text-xs text-muted-foreground">• Entrega no Canteiro de Obras</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                        {os.status}
                      </span>
                    </div>

                    {/* Cascading Contract & Proposal Link Badge */}
                    {linkedContract && (
                      <div className="p-3 rounded-xl bg-slate-900 border border-purple-500/30 text-xs space-y-1.5">
                        <div className="flex items-center justify-between font-bold text-purple-300">
                          <span className="flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5 text-purple-400" /> Ref. Contrato de Origem: {linkedContract.contract_number}
                          </span>
                          {linkedProp && (
                            <span className="text-[10px] text-sky-400 font-medium">Proposta: {linkedProp.proposal_number}</span>
                          )}
                        </div>
                        {linkedProp?.equipment_items && linkedProp.equipment_items.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {linkedProp.equipment_items.map((item, idx) => (
                              <span key={idx} className="bg-purple-500/10 text-purple-200 px-2 py-0.5 rounded text-[10px] font-medium border border-purple-500/20">
                                📦 {item.qty}x {item.equipment_name} (Prazo: {item.duration_months || 1} meses)
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className="flex items-center gap-1.5 text-white">
                        <MapPin className="w-3.5 h-3.5 text-tenant" /> {os.job_site_address}
                      </p>
                      {os.receiver_name && (
                        <p><strong>Recebido por:</strong> {os.receiver_name} (Doc: {os.receiver_document})</p>
                      )}
                    </div>

                    {/* GPS GeoCoordinates Badge */}
                    {os.geo_latitude && (
                      <div className="p-3 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-emerald-400 font-mono">
                          <Navigation className="w-4 h-4" />
                          <span>Lat: {os.geo_latitude} | Long: {os.geo_longitude}</span>
                        </div>
                        <a
                          href={`https://www.google.com/maps?q=${os.geo_latitude},${os.geo_longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-tenant/20 text-tenant hover:bg-tenant/30 text-[11px] font-bold flex items-center gap-1"
                        >
                          Abrir Mapa <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* Evidence Photos */}
                    {os.photos && os.photos.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                          <Camera className="w-3.5 h-3.5 text-amber-400" /> Fotos Comprovantes da Entrega no Local:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {os.photos.map((img, idx) => (
                            <img
                              key={idx}
                              src={img}
                              alt="Comprovante"
                              className="w-full h-24 object-cover rounded-xl border border-white/10"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Add Proposal */}
      {showCreatePropModal && (
        <CreateProposalModal
          preselectedClientId={client.id}
          onClose={() => setShowCreatePropModal(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
};
