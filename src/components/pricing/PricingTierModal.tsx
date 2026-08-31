import React, { useState, useEffect } from "react";
import { EquipmentCatalog, Organization, PricingTierRule } from "@/types/locgest";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { X, Plus, Trash2, Save, Calendar, DollarSign, Truck, FileText, Check, Layers } from "lucide-react";
import { toast } from "sonner";
import { formatCurrencyBRL, maskCurrencyInput, parseCurrencyToNumber } from "@/utils/masks";

interface PricingTierModalProps {
  catalogItem: EquipmentCatalog;
  organization: Organization;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export const PricingTierModal: React.FC<PricingTierModalProps> = ({
  catalogItem,
  organization,
  onClose,
  onSaveSuccess,
}) => {
  const [rules, setRules] = useState<PricingTierRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Form State for creating/editing a tier
  const [formState, setFormState] = useState<{
    id?: string;
    min_months: number;
    max_months: number | null;
    is_unlimited: boolean;
    monthly_rate_str: string;
    freight_delivery_str: string;
    freight_retrieval_str: string;
    payment_terms_template: string;
  }>({
    min_months: 1,
    max_months: 1,
    is_unlimited: false,
    monthly_rate_str: "900,00",
    freight_delivery_str: "800,00",
    freight_retrieval_str: "800,00",
    payment_terms_template: "À vista na assinatura do Contrato",
  });

  const loadRules = async () => {
    setLoading(true);
    const tierRules = await SupabaseDataService.getPricingTierRules(organization.id, catalogItem.id);
    // Sort rules by min_months ascending
    tierRules.sort((a, b) => a.min_months - b.min_months);
    setRules(tierRules);
    setLoading(false);
  };

  useEffect(() => {
    loadRules();
  }, [catalogItem.id, organization.id]);

  const handleStartAdd = () => {
    // Determine next min_months based on existing rules
    const lastRule = rules[rules.length - 1];
    const nextMin = lastRule ? (lastRule.max_months ? lastRule.max_months + 1 : lastRule.min_months + 1) : 1;

    setEditingRuleId("NEW");
    setFormState({
      min_months: nextMin,
      max_months: nextMin,
      is_unlimited: false,
      monthly_rate_str: "800,00",
      freight_delivery_str: "800,00",
      freight_retrieval_str: "800,00",
      payment_terms_template: nextMin === 1 
        ? "À vista na assinatura do Contrato" 
        : nextMin === 2
        ? "1ª Parcela: Locação + Frete Entrega = 10 (dez) dias após assinatura do contrato;\n2ª Parcela: Locação + Frete Retirada = 30 (trinta) dias após assinatura do contrato."
        : "1ª Parcela: Locação + Frete Entrega = 10 (dez) dias após assinatura do contrato;\n2ª Parcela: Locação + Frete Retirada = 30 (trinta) dias após assinatura do contrato;\n3ª Parcela em diante: Locação = a cada 30 (trinta) dias.",
    });
  };

  const handleStartEdit = (rule: PricingTierRule) => {
    setEditingRuleId(rule.id);
    setFormState({
      id: rule.id,
      min_months: rule.min_months,
      max_months: rule.max_months,
      is_unlimited: rule.max_months === null,
      monthly_rate_str: formatCurrencyBRL(rule.monthly_rate),
      freight_delivery_str: formatCurrencyBRL(rule.freight_delivery),
      freight_retrieval_str: formatCurrencyBRL(rule.freight_retrieval),
      payment_terms_template: rule.payment_terms_template || "",
    });
  };

  const handleSaveRule = async () => {
    try {
      const newRule: PricingTierRule = {
        id: formState.id || crypto.randomUUID(),
        organization_id: organization.id,
        catalog_id: catalogItem.id,
        min_months: Number(formState.min_months) || 1,
        max_months: formState.is_unlimited ? null : Number(formState.max_months) || Number(formState.min_months),
        monthly_rate: parseCurrencyToNumber(formState.monthly_rate_str),
        freight_delivery: parseCurrencyToNumber(formState.freight_delivery_str),
        freight_retrieval: parseCurrencyToNumber(formState.freight_retrieval_str),
        payment_terms_template: formState.payment_terms_template.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await SupabaseDataService.savePricingTierRule(newRule);
      toast.success("Regra de prazo salva com sucesso!");
      setEditingRuleId(null);
      await loadRules();
      onSaveSuccess();
    } catch (err) {
      toast.error("Erro ao salvar regra de prazo.");
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await SupabaseDataService.deletePricingTierRule(id);
      toast.success("Regra de prazo removida.");
      await loadRules();
      onSaveSuccess();
    } catch (err) {
      toast.error("Erro ao remover regra de prazo.");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl glass-card rounded-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-tenant/20 border border-tenant/40 text-tenant flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Regras de Preço por Prazo</h2>
              <p className="text-xs text-muted-foreground">
                Modelo: <strong className="text-tenant">{catalogItem.name}</strong> ({catalogItem.category})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-200 flex items-start gap-2.5">
            <Calendar className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Como funcionam as regras de prazo:</span> As faixas configuradas abaixo preenchem automaticamente o valor da locação, frete e fluxo de pagamento quando uma proposta é criada para este equipamento com a duração selecionada.
            </div>
          </div>

          {/* List of current Tier Rules */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white uppercase text-[11px] tracking-wider text-muted-foreground">
                Faixas de Prazo Configuradas ({rules.length})
              </h3>
              {!editingRuleId && (
                <button
                  onClick={handleStartAdd}
                  className="px-3 py-1.5 rounded-xl bg-tenant hover:bg-tenant/80 text-white font-bold text-xs shadow-md shadow-tenant/20 transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Nova Faixa de Prazo
                </button>
              )}
            </div>

            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando regras...</div>
            ) : rules.length === 0 && !editingRuleId ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-white/10 text-muted-foreground space-y-2">
                <div>Nenhuma regra de prazo configurada para este modelo.</div>
                <button
                  onClick={handleStartAdd}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Cadastrar Primeira Faixa (ex: 1 mês, 2 meses, 3+ meses)
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => {
                  const isBeingEdited = editingRuleId === rule.id;
                  if (isBeingEdited) return null; // rendered in form below

                  const durationLabel = rule.max_months
                    ? rule.min_months === rule.max_months
                      ? `${rule.min_months} Mês`
                      : `${rule.min_months} a ${rule.max_months} Meses`
                    : `${rule.min_months}+ Meses (Em Diante)`;

                  return (
                    <div
                      key={rule.id}
                      className="p-4 rounded-xl glass-card border border-white/10 hover:border-white/20 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-tenant/20 border border-tenant/40 text-tenant font-black text-xs">
                            {durationLabel}
                          </span>
                          <span className="font-extrabold text-emerald-400 text-sm">
                            R$ {formatCurrencyBRL(rule.monthly_rate)} / mês
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStartEdit(rule)}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white font-bold text-[11px] transition-all"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-all"
                            title="Excluir Faixa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-[11px] text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>
                            <strong className="text-white">Frete:</strong> R$ {formatCurrencyBRL(rule.freight_delivery)} (Ida) + R$ {formatCurrencyBRL(rule.freight_retrieval)} (Volta)
                          </span>
                        </div>
                        {rule.payment_terms_template && (
                          <div className="flex items-start gap-1.5 col-span-2 bg-white/5 p-2 rounded-lg text-slate-300 font-mono text-[10.5px]">
                            <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                            <div className="whitespace-pre-wrap">{rule.payment_terms_template}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Form to Add / Edit Tier */}
          {editingRuleId && (
            <div className="p-5 rounded-xl bg-slate-900/90 border border-tenant/50 space-y-4 animate-in slide-in-from-bottom-2 duration-200">
              <h4 className="font-extrabold text-white text-xs flex items-center justify-between border-b border-white/10 pb-2">
                <span>{editingRuleId === "NEW" ? "Nova Faixa de Prazo" : "Editar Faixa de Prazo"}</span>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Configuração da Regra</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Min Months */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Prazo Mínimo (Meses)</label>
                  <input
                    type="number"
                    min={1}
                    value={formState.min_months}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 1);
                      setFormState({
                        ...formState,
                        min_months: val,
                        max_months: formState.is_unlimited ? null : Math.max(val, formState.max_months || val),
                      });
                    }}
                    className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold focus:outline-none focus:border-tenant"
                  />
                </div>

                {/* Max Months / Unlimited */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Prazo Máximo</label>
                  {formState.is_unlimited ? (
                    <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-amber-300 font-bold">
                      Em diante (Sem limite)
                    </div>
                  ) : (
                    <input
                      type="number"
                      min={formState.min_months}
                      value={formState.max_months || formState.min_months}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          max_months: Math.max(formState.min_months, parseInt(e.target.value) || formState.min_months),
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold focus:outline-none focus:border-tenant"
                    />
                  )}
                  <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer text-[10px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={formState.is_unlimited}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          is_unlimited: e.target.checked,
                          max_months: e.target.checked ? null : formState.min_months,
                        })
                      }
                      className="rounded bg-white/10 border-white/20 text-tenant focus:ring-0"
                    />
                    <span>Aplicar de {formState.min_months} meses em diante (sem limite superior)</span>
                  </label>
                </div>

                {/* Monthly Rate */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Valor Mensal (R$)</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">R$</span>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={formState.monthly_rate_str}
                      onChange={(e) => setFormState({ ...formState, monthly_rate_str: maskCurrencyInput(e.target.value) })}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-emerald-400 font-extrabold focus:outline-none focus:border-tenant"
                    />
                  </div>
                </div>

                {/* Freight Delivery */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Frete Entrega / Ida (R$)</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">R$</span>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={formState.freight_delivery_str}
                      onChange={(e) => setFormState({ ...formState, freight_delivery_str: maskCurrencyInput(e.target.value) })}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-amber-300 font-bold focus:outline-none focus:border-tenant"
                    />
                  </div>
                </div>

                {/* Freight Retrieval */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Frete Retirada / Volta (R$)</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">R$</span>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={formState.freight_retrieval_str}
                      onChange={(e) => setFormState({ ...formState, freight_retrieval_str: maskCurrencyInput(e.target.value) })}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-amber-300 font-bold focus:outline-none focus:border-tenant"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Terms Template */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Modelo de Forma de Pagamento (Condições para este prazo)
                </label>
                <textarea
                  rows={3}
                  value={formState.payment_terms_template}
                  onChange={(e) => setFormState({ ...formState, payment_terms_template: e.target.value })}
                  placeholder="ex: 1ª Parcela: Locação + Frete Entrega = 10 dias após assinatura..."
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-[11px] focus:outline-none focus:border-tenant"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRuleId(null)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveRule}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> Salvar Regra de Prazo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
          >
            Concluir / Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
