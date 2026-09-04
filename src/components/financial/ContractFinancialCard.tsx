import React from "react";
import { Contract, FinancialRecord } from "@/types/locgest";
import { 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Truck, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Building2, 
  Calendar, 
  MapPin, 
  Receipt,
  Barcode,
  Loader2,
  ExternalLink
} from "lucide-react";

interface ContractFinancialCardProps {
  contract: Contract | null;
  records: FinancialRecord[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onConfirmPayment: (record: FinancialRecord) => Promise<void>;
  loadingId: string | null;
}

export const ContractFinancialCard: React.FC<ContractFinancialCardProps> = ({
  contract,
  records,
  isExpanded,
  onToggleExpand,
  onConfirmPayment,
  loadingId,
}) => {
  const today = new Date().toISOString().split("T")[0];

  // Identificação do cliente e local
  const clientName = contract?.client?.company_name || records[0]?.client?.company_name || "Cliente não informado";
  const tradeName = contract?.client?.trade_name || records[0]?.client?.trade_name;
  const clientDoc = contract?.client?.cnpj_cpf || records[0]?.client?.cnpj_cpf;
  const jobSite = contract?.proposal?.job_site_name || 
    contract?.proposal?.job_site_address || 
    contract?.client?.default_job_site || 
    "Local de entrega não especificado";

  // Cálculos financeiros do contrato
  const contractValue = contract?.total_value || records.reduce((acc, r) => acc + r.amount, 0);
  
  // Total pago (somente boletos e cobranças pagas)
  const totalPaid = records
    .filter((r) => r.status === "Paid" && r.type === "boleto")
    .reduce((acc, r) => acc + r.amount, 0);

  // Total pendente
  const totalPending = records
    .filter((r) => r.status === "Pending" && r.type === "boleto")
    .reduce((acc, r) => acc + r.amount, 0);

  // Total vencido
  const totalOverdue = records
    .filter((r) => r.status === "Pending" && r.type === "boleto" && r.due_date < today)
    .reduce((acc, r) => acc + r.amount, 0);

  // Se não houver boletos emitidos mas houver lançamentos de outros tipos
  const hasBoletos = records.some((r) => r.type === "boleto");
  const displayPaid = hasBoletos ? totalPaid : records.filter((r) => r.status === "Paid").reduce((acc, r) => acc + r.amount, 0);
  const displayPending = hasBoletos ? totalPending : records.filter((r) => r.status === "Pending").reduce((acc, r) => acc + r.amount, 0);

  const percentProgress = contractValue > 0 
    ? Math.min(100, Math.round((displayPaid / contractValue) * 100))
    : (displayPaid + displayPending > 0 ? Math.round((displayPaid / (displayPaid + displayPending)) * 100) : 0);

  // Contadores por tipo de documento
  const boletosCount = records.filter((r) => r.type === "boleto").length;
  const nfServiceCount = records.filter((r) => r.type === "nf_service").length;
  const nfRemessaCount = records.filter((r) => r.type === "nf_remessa").length;

  const isContractFinished = contract?.status === "Finished";

  return (
    <div className={`rounded-2xl glass-card border transition-all duration-200 overflow-hidden ${
      isExpanded 
        ? "border-tenant/40 shadow-lg shadow-black/20" 
        : "border-white/10 hover:border-white/20"
    }`}>
      {/* Contract Header / Summary Clickable Bar */}
      <div
        onClick={onToggleExpand}
        className="p-5 cursor-pointer select-none transition-colors hover:bg-white/[0.02] flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div className="flex items-start gap-4 flex-1">
          {/* Status Indicator Icon */}
          <div className={`p-3 rounded-xl shrink-0 mt-0.5 ${
            percentProgress === 100 
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : totalOverdue > 0
              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
              : "bg-tenant/20 text-tenant border border-tenant/30"
          }`}>
            <Receipt className="w-6 h-6" />
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-white text-lg tracking-tight">
                {contract?.contract_number || "Lançamentos Avulsos"}
              </span>

              {contract?.status && (
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  contract.status === "Active" 
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : contract.status === "Finished"
                    ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                    : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                }`}>
                  {contract.status === "Active" ? "Contrato Ativo" : contract.status === "Finished" ? "Finalizado" : contract.status}
                </span>
              )}

              {totalOverdue > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Parcela em Atraso
                </span>
              )}
            </div>

            {/* Client and Job Site details */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 text-white/90 font-medium">
                <Building2 className="w-3.5 h-3.5 text-tenant shrink-0" />
                {clientName}
                {tradeName && <span className="text-white/50 text-[11px]">({tradeName})</span>}
                {clientDoc && <span className="text-white/40 text-[10px]">· {clientDoc}</span>}
              </span>

              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="truncate max-w-xs">{jobSite}</span>
              </span>

              {contract?.start_date && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {contract.start_date.split("-").reverse().join("/")} até {contract.end_date ? contract.end_date.split("-").reverse().join("/") : "Indeterminado"}
                </span>
              )}
            </div>

            {/* Badges de Documentos Emitidos */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {boletosCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  <Barcode className="w-3 h-3" /> {boletosCount} {boletosCount === 1 ? "Boleto" : "Boletos"}
                </span>
              )}
              {nfServiceCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                  <FileText className="w-3 h-3" /> {nfServiceCount} NF-e {nfServiceCount === 1 ? "Serviço" : "Serviços"}
                </span>
              )}
              {nfRemessaCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  <Truck className="w-3 h-3" /> {nfRemessaCount} NF Remessa
                </span>
              )}
              <span className="text-[11px] text-white/40">
                ({records.length} {records.length === 1 ? "lançamento total" : "lançamentos totais"})
              </span>
            </div>
          </div>
        </div>

        {/* Financial Summary & Progress Bar */}
        <div className="flex items-center gap-6 self-end lg:self-center shrink-0 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 border-white/5 pt-3 lg:pt-0">
          <div className="text-left lg:text-right space-y-1">
            <div className="text-xs text-muted-foreground">Valor do Contrato</div>
            <div className="text-lg font-black text-white">
              R$ {contractValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-400 font-semibold">
                Pago: R$ {displayPaid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-white/30">|</span>
              <span className={displayPending > 0 ? "text-amber-400 font-semibold" : "text-muted-foreground"}>
                Pendente: R$ {displayPending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-44 bg-white/10 rounded-full h-1.5 overflow-hidden mt-1.5 ml-auto">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  percentProgress === 100 
                    ? "bg-emerald-500" 
                    : percentProgress > 0 
                    ? "bg-tenant" 
                    : "bg-white/20"
                }`}
                style={{ width: `${percentProgress}%` }}
              />
            </div>
            <div className="text-[10px] text-white/40 text-right">
              {percentProgress}% quitado
            </div>
          </div>

          {/* Toggle Expand Button */}
          <button 
            type="button"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title={isExpanded ? "Recolher detalhes" : "Expandir lançamentos"}
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Expanded Document Details */}
      {isExpanded && (
        <div className="border-t border-white/10 bg-black/20 p-5 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-tenant" />
              Documentos & Lançamentos Vinculados ({records.length})
            </h4>
            <span className="text-[11px] text-white/40">
              Ciclo: {contract?.billing_cycle ? (
                contract.billing_cycle === "Monthly" ? "Mensal" :
                contract.billing_cycle === "Fortnightly" ? "Quinzenal" :
                contract.billing_cycle === "Weekly" ? "Semanal" : "Diário"
              ) : "Padrão"}
            </span>
          </div>

          {records.length === 0 ? (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-muted-foreground">
              Nenhum boleto ou nota fiscal vinculada a este contrato até o momento.
            </div>
          ) : (
            <div className="space-y-2.5">
              {records.map((r) => {
                const isOverdue = r.status === "Pending" && r.due_date < today;
                const isPaid = r.status === "Paid";

                return (
                  <div
                    key={r.id}
                    className="p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    {/* Document Identification */}
                    <div className="flex items-start sm:items-center gap-3">
                      <div className={`p-2.5 rounded-xl font-bold shrink-0 ${
                        r.type === "nf_service" 
                          ? "bg-sky-500/20 text-sky-400 border border-sky-500/30" 
                          : r.type === "nf_remessa" 
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" 
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      }`}>
                        {r.type === "nf_service" && <FileText className="w-4 h-4" />}
                        {r.type === "nf_remessa" && <Truck className="w-4 h-4" />}
                        {r.type === "boleto" && <Barcode className="w-4 h-4" />}
                      </div>

                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-white text-sm">
                            {r.code_number}
                          </span>

                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            r.type === "nf_service" 
                              ? "bg-sky-500/20 text-sky-300" 
                              : r.type === "nf_remessa" 
                              ? "bg-purple-500/20 text-purple-300" 
                              : "bg-amber-500/20 text-amber-300"
                          }`}>
                            {r.type === "nf_service" ? "NF-e Serviço" : r.type === "nf_remessa" ? "NF Remessa Transporte" : "Boleto de Cobrança"}
                          </span>

                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            isPaid 
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                              : isOverdue 
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" 
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}>
                            {isPaid ? "Pago / Liquidado" : isOverdue ? "Vencido" : "Aguardando Pagamento"}
                          </span>
                        </div>

                        <p className="text-xs text-muted-foreground truncate max-w-lg">
                          {r.description || "Sem descrição"}
                        </p>

                        <div className="flex items-center gap-3 text-[11px] text-white/50 pt-0.5">
                          <span>
                            Vencimento: <strong className={isOverdue ? "text-rose-400 font-bold" : "text-white/80"}>
                              {r.due_date ? r.due_date.split("-").reverse().join("/") : "-"}
                            </strong>
                          </span>

                          {r.paid_at && (
                            <span className="text-emerald-400">
                              · Liquidado em: {new Date(r.paid_at).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Value and Actions */}
                    <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 border-white/5 pt-2 md:pt-0">
                      <div className="text-left md:text-right">
                        <div className="text-xs text-muted-foreground">Valor</div>
                        <div className="text-base font-black text-white">
                          R$ {r.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {r.pdf_url && (
                          <a
                            href={r.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 transition-colors"
                            title="Visualizar documento"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}

                        {/* Action to confirm payment (only for unpaid records) */}
                        {!isPaid && (
                          <button
                            onClick={() => onConfirmPayment(r)}
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
