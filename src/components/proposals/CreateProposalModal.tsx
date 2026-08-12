import React, { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Client, Equipment, Proposal, ProposalItem } from "@/types/locgest";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { FileText, X, Building2, Calendar, Plus, Trash2, Layers, AlertTriangle, Truck, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreateProposalModalProps {
  onClose: () => void;
  onSuccess: () => void;
  preselectedClientId?: string; // If passed, locks client selection
}

interface ProposalFormItem {
  equipment_id: string;
  qty: number;
  duration_months: number;
}

export const CreateProposalModal: React.FC<CreateProposalModalProps> = ({
  onClose,
  onSuccess,
  preselectedClientId,
}) => {
  const { organization } = useTenant();

  const [clients, setClients] = useState<Client[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);

  const todayStr = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    client_id: preselectedClientId || "",
    job_site_name: "",
    job_site_address: "",
    start_date: todayStr,
    requested_delivery_date: todayStr,
  });

  const [items, setItems] = useState<ProposalFormItem[]>([
    { equipment_id: "", qty: 1, duration_months: 1 },
  ]);

  const loadData = async () => {
    const cliList = await SupabaseDataService.getClients(organization.id);
    const eqList = await SupabaseDataService.getEquipment(organization.id);
    setClients(cliList);
    setEquipmentList(eqList);

    const initialClientId = preselectedClientId || cliList[0]?.id || "";
    const initialEqId = eqList[0]?.id || "";
    const initialClient = cliList.find((c) => c.id === initialClientId);

    setFormData((prev) => ({
      ...prev,
      client_id: initialClientId,
      job_site_name: initialClient?.default_job_site || "Obra Principal",
      job_site_address: initialClient?.billing_address || "Endereço da Obra",
    }));

    if (eqList.length > 0) {
      setItems([{ equipment_id: initialEqId, qty: 1, duration_months: 1 }]);
    }
  };

  useEffect(() => {
    loadData();
  }, [organization.id, preselectedClientId]);

  // Helper to calculate end date based on start date and N months (start + N months - 1 day)
  function calculateMonthlyEndDate(startDateStr: string, monthsCount: number): string {
    if (!startDateStr) return "";
    const start = new Date(startDateStr + "T00:00:00");
    if (isNaN(start.getTime())) return startDateStr;

    const end = new Date(start);
    end.setMonth(end.getMonth() + Math.max(1, monthsCount));
    end.setDate(end.getDate() - 1);
    return end.toISOString().split("T")[0];
  }

  // Calculate Maximum duration among all equipment items
  const maxDurationMonths = Math.max(1, ...items.map((i) => Math.max(1, Number(i.duration_months) || 1)));
  const calculatedEndDate = calculateMonthlyEndDate(formData.start_date, maxDurationMonths);

  const handleClientSelectChange = (clientId: string) => {
    const selectedCli = clients.find((c) => c.id === clientId);
    setFormData((prev) => ({
      ...prev,
      client_id: clientId,
      job_site_name: selectedCli?.default_job_site || prev.job_site_name,
      job_site_address: selectedCli?.billing_address || prev.job_site_address,
    }));
  };

  // Multi-Item Form Handlers
  const handleAddItem = () => {
    const defaultEqId = equipmentList[0]?.id || "";
    setItems((prev) => [...prev, { equipment_id: defaultEqId, qty: 1, duration_months: maxDurationMonths }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.warning("A proposta deve conter pelo menos 1 equipamento.");
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateItem = (index: number, field: keyof ProposalFormItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Calculate subtotal for each item (monthly rate * qty * item.duration_months)
  const calculateItemSubtotal = (item: ProposalFormItem) => {
    const eq = equipmentList.find((e) => e.id === item.equipment_id);
    if (!eq) return 0;
    const months = Math.max(1, Number(item.duration_months) || 1);
    return eq.monthly_rate * item.qty * months;
  };

  const grandTotal = items.reduce((sum, item) => sum + calculateItemSubtotal(item), 0);

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const client = clients.find((c) => c.id === formData.client_id);
    if (!client) {
      toast.error("Selecione um cliente válido.");
      return;
    }

    if (items.length === 0) {
      toast.error("Adicione pelo menos um equipamento na proposta.");
      return;
    }

    try {
      setIsSaving(true);
      const proposalItems: ProposalItem[] = items.map((item) => {
        const eq = equipmentList.find((e) => e.id === item.equipment_id);
        const months = Math.max(1, Number(item.duration_months) || 1);
        const subtotal = (eq?.monthly_rate || 0) * item.qty * months;
        const earlyReturnDate = months < maxDurationMonths 
          ? calculateMonthlyEndDate(formData.start_date, months) 
          : undefined;

        return {
          id: crypto.randomUUID(),
          equipment_id: eq?.id || item.equipment_id,
          equipment_code: eq?.code || "EQ-ITEM",
          equipment_name: eq?.name || "Equipamento Cotado",
          daily_rate: eq?.daily_rate || 0,
          monthly_rate: eq?.monthly_rate || 0,
          qty: Number(item.qty),
          billing_type: "monthly",
          duration_months: months,
          early_return_date: earlyReturnDate,
          total_amount: subtotal,
        };
      });

      const newProp: Proposal = {
        id: crypto.randomUUID(),
        organization_id: organization.id,
        client_id: client.id,
        proposal_number: `PROP-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        status: "Draft",
        job_site_name: formData.job_site_name || client.default_job_site || "Obra Principal",
        job_site_address: formData.job_site_address || client.billing_address || "Endereço da Obra",
        start_date: formData.start_date,
        end_date: calculatedEndDate,
        requested_delivery_date: formData.requested_delivery_date,
        equipment_items: proposalItems,
        total_amount: grandTotal,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await SupabaseDataService.saveProposal(newProp);
      toast.success(`Proposta ${newProp.proposal_number} com ${items.length} equipamento(s) gerada com sucesso!`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error("Erro ao gerar proposta.");
    } finally {
      setIsSaving(false);
    }
  };

  const lockedClient = clients.find((c) => c.id === preselectedClientId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-2xl p-6 rounded-2xl glass-panel border border-white/20 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-tenant" /> Montar Proposta Comercial Multi-Equipamento
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreateProposal} className="space-y-4 text-xs">
          {/* Client Selection (Locked if preselectedClientId is passed) */}
          <div>
            <label className="block text-muted-foreground mb-1 font-semibold flex items-center justify-between">
              <span>Cliente da Locação *</span>
              {preselectedClientId && (
                <span className="text-[10px] text-amber-400 font-bold">🔒 Cliente travado pela pasta</span>
              )}
            </label>

            {preselectedClientId && lockedClient ? (
              <div className="p-3 rounded-xl bg-white/10 border border-amber-500/40 text-white flex items-center gap-2 font-bold">
                <Building2 className="w-4 h-4 text-tenant shrink-0" />
                <div>
                  <div>{lockedClient.company_name}</div>
                  <div className="text-[10px] text-muted-foreground font-normal">CNPJ/CPF: {lockedClient.cnpj_cpf}</div>
                </div>
              </div>
            ) : (
              <select
                value={formData.client_id}
                onChange={(e) => handleClientSelectChange(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-tenant"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name} ({c.cnpj_cpf})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Job Site Details & Start Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-muted-foreground mb-1 font-semibold">Data Início Locação *</label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-tenant font-semibold"
              />
            </div>
            <div>
              <label className="block text-muted-foreground mb-1">Nome do Canteiro / Obra</label>
              <input
                type="text"
                placeholder="ex: Obra Galpão 04"
                value={formData.job_site_name}
                onChange={(e) => setFormData({ ...formData, job_site_name: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
              />
            </div>
            <div>
              <label className="block text-muted-foreground mb-1">Endereço da Obra</label>
              <input
                type="text"
                placeholder="ex: Av. Litorânea, Cumbuco"
                value={formData.job_site_address}
                onChange={(e) => setFormData({ ...formData, job_site_address: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
              />
            </div>
          </div>

          {/* Overall Proposal Period Header */}
          <div className="p-3 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-tenant" />
              <div>
                <span className="text-xs font-bold text-white">Prazo Máximo da Proposta: </span>
                <span className="text-xs font-black text-tenant">{maxDurationMonths} mês/meses</span>
              </div>
            </div>
            <div className="text-[11px] text-emerald-400 font-bold">
              Término Geral: {calculatedEndDate}
            </div>
          </div>

          {/* Dynamic Multi-Equipment Items Selector with Individual Months */}
          <div className="space-y-3 p-4 rounded-xl glass-card border border-white/10">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-white text-xs flex items-center gap-2">
                <Layers className="w-4 h-4 text-tenant" /> Equipamentos Solicitados na Proposta ({items.length})
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 rounded-lg bg-tenant text-white text-[11px] font-bold shadow-md shadow-tenant/20 hover:opacity-90 flex items-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Outro Equipamento
              </button>
            </div>

            <div className="space-y-3.5">
              {items.map((item, idx) => {
                const itemMonths = Math.max(1, Number(item.duration_months) || 1);
                const subtotal = calculateItemSubtotal(item);
                const isEarlyReturn = itemMonths < maxDurationMonths;
                const itemEndDate = calculateMonthlyEndDate(formData.start_date, itemMonths);

                return (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-900/90 border border-white/10 space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-tenant">Item #{idx + 1}</span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-red-400 hover:text-red-300 p-1 transition-colors"
                          title="Remover este equipamento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                      <div className="sm:col-span-7">
                        <label className="block text-muted-foreground mb-1 font-semibold">Selecione o Equipamento *</label>
                        <select
                          value={item.equipment_id}
                          onChange={(e) => handleUpdateItem(idx, "equipment_id", e.target.value)}
                          className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant text-xs"
                        >
                          {equipmentList.map((eq) => {
                            const sizeTag = eq.catalog_item?.size_dimension ? ` [${eq.catalog_item.size_dimension}]` : "";
                            const rateTag = eq.monthly_rate > 0 ? ` (R$ ${eq.monthly_rate.toLocaleString("pt-BR")}/mês)` : "";
                            return (
                              <option key={eq.id} value={eq.id}>
                                {eq.code} - {eq.name}{sizeTag}{rateTag}
                              </option>
                            );
                          })}
                        </select>

                        {/* Selected Equipment Pricing & Size Info Badge */}
                        {(() => {
                          const selectedEq = equipmentList.find((e) => e.id === item.equipment_id);
                          if (!selectedEq) return null;
                          const size = selectedEq.catalog_item?.size_dimension || "Padrão";
                          const monthly = selectedEq.monthly_rate;
                          const daily = selectedEq.daily_rate;

                          return (
                            <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold">
                                {size}
                              </span>
                              <span className="text-emerald-400 font-bold">
                                Tarifa: R$ {monthly.toLocaleString("pt-BR")}/mês
                              </span>
                              {daily > 0 && <span className="text-muted-foreground">(R$ {daily.toLocaleString("pt-BR")}/dia)</span>}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-muted-foreground mb-1 font-semibold">Qtd *</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.qty}
                          onChange={(e) => handleUpdateItem(idx, "qty", Number(e.target.value))}
                          className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-center focus:outline-none focus:border-tenant"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-muted-foreground mb-1 font-semibold">Prazo (Meses) *</label>
                        <input
                          type="number"
                          min="1"
                          max="48"
                          required
                          value={item.duration_months}
                          onChange={(e) => handleUpdateItem(idx, "duration_months", Number(e.target.value))}
                          className="w-full p-2 rounded-xl bg-slate-800 border border-tenant/40 text-white font-bold text-center focus:outline-none focus:border-tenant"
                        />
                      </div>
                    </div>

                    {/* Early Return Alert for Logistics */}
                    {isEarlyReturn && (
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-medium flex items-center gap-1.5 mt-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>
                          <strong>Alerta de Logística:</strong> Recolhimento antecipado deste item agendado para <strong>{itemEndDate}</strong> ({itemMonths} meses).
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 text-[11px] border-t border-white/5 text-muted-foreground">
                      <span>Subtotal deste item ({itemMonths} mês/meses):</span>
                      <span className="font-extrabold text-emerald-400 text-xs">
                        R$ {subtotal.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grand Total Summary */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Valor Total Geral da Proposta</div>
              <div className="text-xs text-slate-300">Somatório de {items.length} equipamento(s) • Prazo máximo: {maxDurationMonths} mês(es)</div>
            </div>
            <div className="text-2xl font-black text-emerald-400">
              R$ {grandTotal.toLocaleString("pt-BR")}
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-tenant text-white font-bold shadow-lg shadow-tenant/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Gerar Proposta Comercial (R$ {grandTotal.toLocaleString("pt-BR")})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
