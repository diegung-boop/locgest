import React, { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { FinancialRecord, ServiceOrder } from "@/types/locgest";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { Receipt, DollarSign, CheckCircle2, FileText, Truck, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const FinancialPage: React.FC = () => {
  const { organization } = useTenant();
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const loadData = async () => {
    const list = await SupabaseDataService.getFinancialRecords(organization.id);
    setFinancialRecords(list);
  };

  useEffect(() => {
    loadData();
  }, [organization.id]);

  const handleConfirmPayment = async (record: FinancialRecord) => {
    if (loadingId) return;

    try {
      setLoadingId(record.id);

      const updatedRecord: FinancialRecord = {
        ...record,
        status: "Paid",
        paid_at: new Date().toISOString(),
      };

      await SupabaseDataService.saveFinancialRecord(updatedRecord);

      // Auto-dispatch Service Order (OS) for Logistics!
      const newOS: ServiceOrder = {
        id: crypto.randomUUID(),
        organization_id: organization.id,
        contract_id: record.contract_id,
        client_id: record.client_id,
        os_number: `OS-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        type: "Delivery",
        status: "Pending",
        scheduled_date: new Date().toISOString().split("T")[0],
        job_site_address: record.client?.default_job_site || "Obra do Cliente",
        equipment_ids: [],
        photos: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await SupabaseDataService.saveServiceOrder(newOS);
      await loadData();
      toast.success(`Pagamento confirmado! Ordem de Serviço (OS) ${newOS.os_number} disparada para a Logística.`);
    } catch (err) {
      toast.error("Erro ao confirmar pagamento.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-card border border-white/10">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-tenant" /> Módulo Financeiro & Documentos Fiscais
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de NF-e de Serviços, NFs de Remessa para Transporte e Boletos de Cobrança com gatilho de Logística.
          </p>
        </div>
      </div>

      {/* Financial Records List */}
      <div className="space-y-4">
        {financialRecords.length === 0 ? (
          <div className="p-8 rounded-2xl glass-card border border-white/10 text-center text-xs text-muted-foreground">
            Nenhum lançamento financeiro registrado.
          </div>
        ) : (
          financialRecords.map((r) => (
            <div key={r.id} className="p-5 rounded-2xl glass-card border border-white/10 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl font-bold ${
                    r.type === "nf_service" ? "bg-sky-500/20 text-sky-400" :
                    r.type === "nf_remessa" ? "bg-purple-500/20 text-purple-400" :
                    "bg-amber-500/20 text-amber-400"
                  }`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-white text-base">{r.code_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        r.type === "nf_service" ? "bg-sky-500/20 text-sky-300" :
                        r.type === "nf_remessa" ? "bg-purple-500/20 text-purple-300" :
                        "bg-amber-500/20 text-amber-300"
                      }`}>
                        {r.type === "nf_service" ? "NF-e Serviço" : r.type === "nf_remessa" ? "NF Remessa Transporte" : "Boleto Bancário"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.description}</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-base font-black text-emerald-400">
                    R$ {r.amount.toLocaleString("pt-BR")}
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    r.status === "Paid" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                  }`}>
                    {r.status === "Paid" ? "Pago / Concluído" : "Aguardando Pagamento"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-white/5 pt-3">
                <div>Vencimento: <strong className="text-white">{r.due_date}</strong></div>
                {r.status !== "Paid" && (
                  <button
                    onClick={() => handleConfirmPayment(r)}
                    disabled={Boolean(loadingId)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 ${
                      loadingId === r.id
                        ? "bg-emerald-600/50 text-white cursor-not-allowed opacity-75"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
                    }`}
                  >
                    {loadingId === r.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Confirmando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar Pagamento & Disparar OS
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
