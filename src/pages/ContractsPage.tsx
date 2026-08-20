import React, { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Contract, FinancialRecord } from "@/types/locgest";
import { MockDataService } from "@/services/mockDataService";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { ShieldCheck, FileCheck, Loader2, PackageCheck, FileText } from "lucide-react";
import { toast } from "sonner";
import { FormalContractModal } from "@/components/contracts/FormalContractModal";

export const ContractsPage: React.FC = () => {
  const { organization } = useTenant();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContractForPDF, setSelectedContractForPDF] = useState<Contract | null>(null);

  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  const loadData = async () => {
    const list = await SupabaseDataService.getContracts(organization.id);
    setContracts(list);
  };

  useEffect(() => {
    loadData();
  }, [organization.id]);

  const handleSignAndEmitFinancials = async (contract: Contract) => {
    if (loadingActionId) return;

    try {
      setLoadingActionId(contract.id);

      const updatedContract: Contract = {
        ...contract,
        status: "Active",
        signed_at: new Date().toISOString(),
      };

      await SupabaseDataService.saveContract(updatedContract);

      // Emit NF de Serviço
      const nfService: FinancialRecord = {
        id: crypto.randomUUID(),
        organization_id: organization.id,
        contract_id: contract.id,
        client_id: contract.client_id,
        type: "nf_service",
        code_number: `NFE-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        description: `NF-e de Serviço de Locação de Equipamentos - Contrato ${contract.contract_number}`,
        amount: contract.total_value,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "Pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Emit Boleto
      const boleto: FinancialRecord = {
        id: crypto.randomUUID(),
        organization_id: organization.id,
        contract_id: contract.id,
        client_id: contract.client_id,
        type: "boleto",
        code_number: `BOL-2026-${Math.floor(Math.random() * 90000 + 10000)}`,
        description: `Boleto Bancário Itaú / Bradesco - Parcela Única`,
        amount: contract.total_value,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "Pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await SupabaseDataService.saveFinancialRecord(nfService);
      await SupabaseDataService.saveFinancialRecord(boleto);

      await loadData();
      toast.success(`Contrato ${contract.contract_number} Assinado! NF-e e Boleto gerados na área financeira.`);
    } catch (err) {
      toast.error("Erro ao assinar contrato. Tente novamente.");
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleFinishContract = async (contract: Contract) => {
    if (loadingActionId) return;

    try {
      setLoadingActionId(contract.id);

      const updatedContract: Contract = { ...contract, status: "Finished" };
      await SupabaseDataService.saveContract(updatedContract);

      const today = new Date().toISOString().split("T")[0];

      await Promise.all(
        (contract.proposal?.equipment_items || []).map(async (item) => {
          // Don't free an asset that's still committed to a different active
          // contract covering today (e.g. it was double-booked before the
          // availability-rule fix) — only release it if nothing else needs it.
          const stillNeededElsewhere = contracts.some((other) => {
            if (other.id === contract.id || other.status !== "Active") return false;
            const hasSameAsset = other.proposal?.equipment_items?.some(
              (otherItem) => otherItem.equipment_id === item.equipment_id
            );
            if (!hasSameAsset) return false;
            return today >= other.start_date && today <= other.end_date;
          });

          if (!stillNeededElsewhere) {
            await SupabaseDataService.updateEquipmentAssetStatus(item.equipment_id, "Available");
          }
        })
      );

      await loadData();
      toast.success(`Contrato ${contract.contract_number} finalizado! Equipamento(s) devolvido(s) e disponível(is) novamente.`);
    } catch (err) {
      toast.error("Erro ao finalizar contrato. Tente novamente.");
    } finally {
      setLoadingActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-card border border-white/10">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-tenant" /> Gestão de Contratos de Locação
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assinatura de termos e disparo automático do faturamento (NF-e + NF Remessa + Boleto).
          </p>
        </div>
      </div>

      {/* Contracts List */}
      <div className="space-y-4">
        {contracts.map((c) => (
          <div key={c.id} className="p-5 rounded-2xl glass-card border border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-base">{c.contract_number}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    c.status === "Active"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : c.status === "Finished"
                      ? "bg-white/10 text-slate-300 border border-white/10"
                      : c.status === "Terminated"
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  }`}>
                    {c.status === "Active"
                      ? "Ativo & Assinado"
                      : c.status === "Finished"
                      ? "Finalizado"
                      : c.status === "Terminated"
                      ? "Rescindido"
                      : "Pendente de Assinatura"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cliente: <strong className="text-white">{c.client?.company_name || "Cliente Registrado"}</strong>
                </p>
              </div>

              <div className="text-right">
                <div className="text-xs text-muted-foreground">Valor do Contrato</div>
                <div className="text-lg font-black text-emerald-400">
                  R$ {c.total_value.toLocaleString("pt-BR")}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div><strong>Vigência:</strong> {c.start_date} até {c.end_date}</div>
              <div><strong>Faturamento:</strong> {c.billing_cycle}</div>
              <div className="col-span-2"><strong>Termos:</strong> {c.terms_conditions}</div>
            </div>

            {(c.status === "Draft" || c.status === "PendingSignature") && (
              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  onClick={() => setSelectedContractForPDF(c)}
                  className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-white font-bold text-xs flex items-center gap-2 transition-all"
                >
                  <FileText className="w-4 h-4 text-tenant" /> Termos do Contrato (PDF)
                </button>
                <button
                  onClick={() => handleSignAndEmitFinancials(c)}
                  disabled={Boolean(loadingActionId)}
                  className={`px-4 py-2 rounded-xl text-white font-bold text-xs shadow-lg flex items-center gap-2 transition-all ${
                    loadingActionId === c.id
                      ? "bg-tenant/50 cursor-not-allowed opacity-75"
                      : "bg-tenant hover:opacity-90 shadow-tenant/20"
                  }`}
                >
                  {loadingActionId === c.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Assinando & Gerando NFs...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4" /> Simular Assinatura & Disparar NFs + Boletos
                    </>
                  )}
                </button>
              </div>
            )}

            {c.status === "Active" && (
              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  onClick={() => setSelectedContractForPDF(c)}
                  className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-white font-bold text-xs flex items-center gap-2 transition-all"
                >
                  <FileText className="w-4 h-4 text-tenant" /> Termos do Contrato (PDF)
                </button>
                <button
                  onClick={() => handleFinishContract(c)}
                  disabled={Boolean(loadingActionId)}
                  title="Marca o contrato como finalizado e devolve o(s) equipamento(s) ao estoque disponível"
                  className={`px-4 py-2 rounded-xl text-white font-bold text-xs shadow-lg flex items-center gap-2 transition-all ${
                    loadingActionId === c.id
                      ? "bg-white/10 cursor-not-allowed opacity-75"
                      : "bg-slate-700 hover:bg-slate-600 shadow-black/20"
                  }`}
                >
                  {loadingActionId === c.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Finalizando & Liberando Equipamento...
                    </>
                  ) : (
                    <>
                      <PackageCheck className="w-4 h-4" /> Finalizar Contrato (Equipamento Devolvido)
                    </>
                  )}
                </button>
              </div>
            )}

            {c.status === "Finished" && (
              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  onClick={() => setSelectedContractForPDF(c)}
                  className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-white font-bold text-xs flex items-center gap-2 transition-all"
                >
                  <FileText className="w-4 h-4 text-tenant" /> Termos do Contrato (PDF)
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedContractForPDF && (
        <FormalContractModal
          contract={selectedContractForPDF}
          organization={organization}
          onClose={() => setSelectedContractForPDF(null)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
};
