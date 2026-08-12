import React, { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Proposal, Contract } from "@/types/locgest";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { CreateProposalModal } from "@/components/proposals/CreateProposalModal";
import { FormalProposalModal } from "@/components/proposals/FormalProposalModal";
import { FileText, Plus, CheckCircle, Calendar, MapPin, Layers } from "lucide-react";
import { toast } from "sonner";

export const ProposalsPage: React.FC = () => {
  const { organization } = useTenant();
  const [proposals, setProposals] = useState<Proposal[]>([]);

  const loadData = async () => {
    const propList = await SupabaseDataService.getProposals(organization.id);
    setProposals(propList);
  };

  useEffect(() => {
    loadData();
  }, [organization.id]);

  const [showModal, setShowModal] = useState(false);
  const [selectedFormalProp, setSelectedFormalProp] = useState<Proposal | null>(null);

  const handleApproveProposal = async (prop: Proposal) => {
    const updatedProp: Proposal = { ...prop, status: "Approved" };
    await SupabaseDataService.saveProposal(updatedProp);

    // Auto-generate Contract with full sum of all proposal items
    const newContract: Contract = {
      id: crypto.randomUUID(),
      organization_id: organization.id,
      client_id: prop.client_id,
      proposal_id: prop.id,
      contract_number: `CONT-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
      status: "PendingSignature",
      total_value: prop.total_amount,
      billing_cycle: "Monthly",
      start_date: prop.start_date,
      end_date: prop.end_date,
      terms_conditions: `Contrato gerado automaticamente a partir da proposta ${prop.proposal_number} com ${prop.equipment_items?.length || 1} equipamento(s).`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await SupabaseDataService.saveContract(newContract);
    await loadData();
    toast.success(`Proposta ${prop.proposal_number} Aprovada! Contrato ${newContract.contract_number} (R$ ${prop.total_amount.toLocaleString("pt-BR")}) gerado.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-card border border-white/10">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-tenant" /> Pedidos & Propostas Comerciais Multi-Item
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Recebimento de solicitações, cotação de múltiplos equipamentos, cálculo de subtotais e geração de contrato.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl bg-tenant text-white text-xs font-bold shadow-lg shadow-tenant/20 hover:opacity-90 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nova Proposta Comercial
        </button>
      </div>

      {/* Proposal Cards */}
      <div className="space-y-4">
        {proposals.map((p) => (
          <div key={p.id} className="p-6 rounded-2xl glass-card border border-white/10 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-base">{p.proposal_number}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    p.status === "Approved" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                  }`}>
                    {p.status === "Approved" ? "Aprovada & Contratada" : p.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cliente: <strong className="text-white">{p.client?.company_name || "Cliente Registrado"}</strong>
                </p>
              </div>

              <div className="text-right">
                <div className="text-[10px] text-muted-foreground uppercase font-bold">Valor Total Geral</div>
                <div className="text-xl font-black text-emerald-400">
                  R$ {p.total_amount.toLocaleString("pt-BR")}
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="flex items-center gap-2 bg-white/5 p-3 rounded-xl">
                <MapPin className="w-4 h-4 text-tenant shrink-0" />
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">Local da Obra</div>
                  <div className="text-white font-medium truncate">{p.job_site_name} ({p.job_site_address})</div>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-white/5 p-3 rounded-xl">
                <Calendar className="w-4 h-4 text-tenant shrink-0" />
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">Período de Locação</div>
                  <div className="text-white font-medium">
                    {p.start_date} até {p.end_date}
                  </div>
                </div>
              </div>
            </div>

            {/* Multi-Item Breakdown Box */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-white/5 space-y-2">
              <div className="text-[11px] font-bold text-white flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-tenant">
                  <Layers className="w-3.5 h-3.5" /> Equipamentos Solicitados ({p.equipment_items?.length || 0}):
                </span>
                <span className="text-[10px] text-muted-foreground">Subtotais por Item</span>
              </div>
              <div className="divide-y divide-white/5">
                {p.equipment_items?.map((item, idx) => (
                  <div key={idx} className="py-1.5 flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{item.qty}x</span>
                      <span className="text-slate-200">{item.equipment_name}</span>
                      <span className="text-[10px] text-muted-foreground">({item.equipment_code})</span>
                    </div>
                    <span className="font-extrabold text-emerald-400">
                      R$ {item.total_amount.toLocaleString("pt-BR")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedFormalProp(p)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 flex items-center gap-2 transition-all"
              >
                <FileText className="w-4 h-4 text-tenant" /> Proposta Formal / PDF
              </button>

              {p.status !== "Approved" && (
                <button
                  onClick={() => handleApproveProposal(p)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all"
                >
                  <CheckCircle className="w-4 h-4" /> Aprovar Proposta Comercial & Gerar Contrato (R$ {p.total_amount.toLocaleString("pt-BR")})
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Add Proposal */}
      {showModal && (
        <CreateProposalModal
          onClose={() => setShowModal(false)}
          onSuccess={loadData}
        />
      )}

      {/* Modal Formal Proposal PDF */}
      {selectedFormalProp && (
        <FormalProposalModal
          proposal={selectedFormalProp}
          organization={organization}
          onClose={() => setSelectedFormalProp(null)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
};
