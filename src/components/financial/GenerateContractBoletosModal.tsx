import React, { useState } from "react";
import { Contract, PricingTierRule, FinancialRecord, Organization } from "@/types/locgest";
import { 
  calculateContractInstallments, 
  buildBoletoRecordFromInstallment,
  GeneratedInstallment 
} from "@/utils/installmentCalculator";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { 
  X, 
  Layers, 
  Calendar, 
  DollarSign, 
  Truck, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrencyBRL } from "@/utils/masks";

interface GenerateContractBoletosModalProps {
  contract: Contract;
  organization: Organization;
  tierRules: PricingTierRule[];
  existingRecords: FinancialRecord[];
  onClose: () => void;
  onSuccess: () => void;
}

export const GenerateContractBoletosModal: React.FC<GenerateContractBoletosModalProps> = ({
  contract,
  organization,
  tierRules,
  existingRecords,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  
  // Calcula as parcelas sugeridas pela regra da empresa
  const suggestedInstallments = calculateContractInstallments(contract, tierRules);
  const [installments, setInstallments] = useState<GeneratedInstallment[]>(suggestedInstallments);

  // Duração
  const durationMonths = contract.proposal?.equipment_items?.[0]?.duration_months || installments.length || 1;

  // Verifica se já existem boletos gerados
  const existingBoletosCount = existingRecords.filter((r) => r.type === "boleto").length;

  const handleDateChange = (index: number, newDate: string) => {
    setInstallments((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], due_date: newDate };
      return updated;
    });
  };

  const handleAmountChange = (index: number, newAmount: number) => {
    setInstallments((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], amount: newAmount };
      return updated;
    });
  };

  const handleGenerateAll = async () => {
    try {
      setLoading(true);

      const recordsToCreate = installments.map((inst) =>
        buildBoletoRecordFromInstallment(inst, contract, organization.id)
      );

      // Salva cada registro no Supabase
      for (const rec of recordsToCreate) {
        await SupabaseDataService.saveFinancialRecord(rec);
      }

      toast.success(`${recordsToCreate.length} boleto(s) gerado(s) com sucesso no padrão Banco Inter!`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Erro ao gerar cronograma de boletos:", err);
      toast.error("Falha ao gerar os boletos do contrato.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl bg-slate-900/95 border border-white/10 shadow-2xl p-6 md:p-8 flex flex-col gap-6 text-white custom-scrollbar">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-tenant/15 text-tenant border border-tenant/30">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Gerar Boletos do Contrato ({contract.contract_number})
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cliente: <strong className="text-white">{contract.client?.company_name}</strong> · Duração: <strong className="text-tenant">{durationMonths} {durationMonths === 1 ? "Mês" : "Meses"}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning if already generated */}
        {existingBoletosCount > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>
              Este contrato já possui <strong>{existingBoletosCount} boleto(s)</strong> registrado(s). Gerar novamente adicionará novas cobranças ao histórico.
            </span>
          </div>
        )}

        {/* Regra Aplicada */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-start gap-3">
          <Info className="w-5 h-5 text-tenant shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="text-white font-semibold">Regra de Faturamento da Empresa Aplicada:</div>
            {durationMonths === 1 ? (
              <p>• <strong>1 Mês:</strong> Cobrança à vista (Locação + Frete de Ida + Frete de Volta no mesmo boleto).</p>
            ) : durationMonths === 2 ? (
              <p>• <strong>2 Meses:</strong> 1ª Parcela (Locação + Frete Ida em 10 dias) + 2ª Parcela (Locação + Frete Retirada em 30 dias).</p>
            ) : (
              <p>• <strong>{durationMonths} Meses:</strong> 1ª Parcela (Locação + Frete Ida em 10 dias), 2ª Parcela (Locação + Frete Retirada em 30 dias) e parcelas restantes a cada 30 dias.</p>
            )}
          </div>
        </div>

        {/* Cronograma de Parcelas Geradas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-white/70 uppercase tracking-wider px-1">
            <span>Cronograma de Parcelas ({installments.length})</span>
            <span>Total: R$ {installments.reduce((acc, i) => acc + i.amount, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="space-y-2.5">
            {installments.map((inst, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-tenant/15 text-tenant font-bold text-xs flex items-center justify-center shrink-0 border border-tenant/30 mt-0.5">
                    {inst.installment_number}ª
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white">{inst.description}</div>
                    <div className="text-[11px] text-muted-foreground flex flex-wrap gap-2 pt-0.5">
                      {inst.breakdown.lease_amount > 0 && <span>Locação: R$ {inst.breakdown.lease_amount.toFixed(2)}</span>}
                      {inst.breakdown.freight_delivery > 0 && <span className="text-amber-400">· Frete Entrega: R$ {inst.breakdown.freight_delivery.toFixed(2)}</span>}
                      {inst.breakdown.freight_retrieval > 0 && <span className="text-amber-400">· Frete Retirada: R$ {inst.breakdown.freight_retrieval.toFixed(2)}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div>
                    <label className="block text-[10px] text-white/50 mb-0.5">Vencimento</label>
                    <input
                      type="date"
                      value={inst.due_date}
                      onChange={(e) => handleDateChange(idx, e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 border border-white/15 text-xs text-white focus:outline-none focus:border-tenant"
                    />
                  </div>

                  <div className="text-right">
                    <label className="block text-[10px] text-white/50 mb-0.5">Valor (R$)</label>
                    <div className="text-sm font-black text-emerald-400">
                      R$ {inst.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGenerateAll}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-tenant hover:opacity-90 text-sm font-bold text-white shadow-lg shadow-tenant/20 transition-all flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Emitindo {installments.length} Boletos...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Emitir {installments.length} Boleto(s) Inter
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
