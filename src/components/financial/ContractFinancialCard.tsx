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
  ExternalLink,
  Copy,
  QrCode,
  Layers,
  Sparkles,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { BankIntegrationService } from "@/services/bankIntegrationService";
import { BoletoPdfViewerModal } from "./BoletoPdfViewerModal";

interface ContractFinancialCardProps {
  contract: Contract | null;
  records: FinancialRecord[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onConfirmPayment: (record: FinancialRecord) => Promise<void>;
  onOpenGenerateModal?: (contract: Contract) => void;
  loadingId: string | null;
}

export const ContractFinancialCard: React.FC<ContractFinancialCardProps> = ({
  contract,
  records,
  isExpanded,
  onToggleExpand,
  onConfirmPayment,
  onOpenGenerateModal,
  loadingId,
}) => {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const [activePixModal, setActivePixModal] = React.useState<FinancialRecord | null>(null);
  const [loadingPdfId, setLoadingPdfId] = React.useState<string | null>(null);
  const [viewerModalRecord, setViewerModalRecord] = React.useState<FinancialRecord | null>(null);
  const [viewerModalBlobUrl, setViewerModalBlobUrl] = React.useState<string | null>(null);
  const pdfBlobCache = React.useRef<Record<string, string>>({});

  const handleViewPdf = async (record: FinancialRecord) => {
    if (loadingPdfId) return;

    // 1. Se já possui o PDF salvo permanentemente no Supabase Storage, abre direto instantaneamente!
    if (record.pdf_url) {
      setViewerModalRecord(record);
      setViewerModalBlobUrl(record.pdf_url);
      return;
    }

    // 2. Se já estiver em cache na sessão do componente, abre imediatamente
    if (pdfBlobCache.current[record.id]) {
      setViewerModalRecord(record);
      setViewerModalBlobUrl(pdfBlobCache.current[record.id]);
      return;
    }

    try {
      setLoadingPdfId(record.id);
      const blob = await BankIntegrationService.getChargePdf(record.id, record.organization_id);
      const url = URL.createObjectURL(blob);
      pdfBlobCache.current[record.id] = url;
      setViewerModalRecord(record);
      setViewerModalBlobUrl(url);
    } catch (err: any) {
      console.error("Erro ao carregar PDF do boleto:", err);
      toast.error(err?.message || "Não foi possível carregar o boleto. Tente novamente em alguns instantes.");
    } finally {
      setLoadingPdfId(null);
    }
  };

  React.useEffect(() => {
    return () => {
      // Limpeza de recursos de memória Blob URLs ao desmontar
      Object.values(pdfBlobCache.current).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
      });
    };
  }, []);

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

  const hasBoletos = records.some((r) => r.type === "boleto");
  const displayPaid = hasBoletos ? totalPaid : records.filter((r) => r.status === "Paid").reduce((acc, r) => acc + r.amount, 0);
  const displayPending = hasBoletos ? totalPending : records.filter((r) => r.status === "Pending").reduce((acc, r) => acc + r.amount, 0);

  const percentProgress = contractValue > 0 
    ? Math.min(100, Math.round((displayPaid / contractValue) * 100))
    : (displayPaid + displayPending > 0 ? Math.round((displayPaid / (displayPaid + displayPending)) * 100) : 0);

  const boletosCount = records.filter((r) => r.type === "boleto").length;
  const nfServiceCount = records.filter((r) => r.type === "nf_service").length;
  const nfRemessaCount = records.filter((r) => r.type === "nf_remessa").length;

  const copyToClipboard = (text: string, label: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(keyId);
    toast.success(`${label} copiado!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

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
            <Receipt className="w-5 h-5" />
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-extrabold text-base text-white">
                {contract?.contract_number || "Lançamentos Avulsos / Sem Contrato"}
              </span>

              {contract && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  contract.status === "Active" 
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : contract.status === "Draft"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-white/10 text-white/60 border border-white/20"
                }`}>
                  {contract.status === "Active" ? "Contrato Ativo" : contract.status}
                </span>
              )}

              {totalOverdue > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 animate-pulse">
                  <AlertCircle className="w-3 h-3" /> {totalOverdue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em atraso
                </span>
              )}
            </div>

            {/* Client and Job Site Details */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-0.5">
              <span className="flex items-center gap-1.5 font-medium text-white/90">
                <Building2 className="w-3.5 h-3.5 text-tenant shrink-0" />
                {clientName}
                {tradeName && <span className="text-white/50 text-[11px]">({tradeName})</span>}
                {clientDoc && <span className="text-white/40 text-[11px]">· {clientDoc}</span>}
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
                  <Barcode className="w-3 h-3" /> {boletosCount} {boletosCount === 1 ? "Boleto Inter" : "Boletos Inter"}
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
          </div>

          <div className="text-left lg:text-right space-y-1">
            <div className="text-xs text-emerald-400">Total Pago</div>
            <div className="text-lg font-bold text-emerald-400">
              R$ {displayPaid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="hidden sm:block text-right space-y-1">
            <div className="text-xs text-amber-400">A Receber</div>
            <div className="text-lg font-bold text-amber-400">
              R$ {displayPending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </div>

          {/* Quick Action: Gerar Boletos do Contrato */}
          {contract && onOpenGenerateModal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenGenerateModal(contract);
              }}
              className="px-3 py-2 rounded-xl bg-tenant/15 hover:bg-tenant/25 text-tenant border border-tenant/30 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="Gerar boletos baseado na regra de prazo da empresa"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Gerar Boletos Inter</span>
            </button>
          )}

          <div className="p-2 rounded-xl bg-white/5 text-white/60">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {/* Expanded Details: Financial Records List */}
      {isExpanded && (
        <div className="border-t border-white/10 p-5 bg-black/20 space-y-4 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between text-xs font-semibold text-white/70 uppercase tracking-wider">
            <span>Boletos & Documentos Fiscais ({records.length})</span>
            {contract && onOpenGenerateModal && (
              <button
                onClick={() => onOpenGenerateModal(contract)}
                className="text-tenant hover:underline flex items-center gap-1 text-xs capitalize font-bold"
              >
                <Sparkles className="w-3 h-3" /> + Gerar Cronograma de Boletos
              </button>
            )}
          </div>

          {records.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-center space-y-3">
              <p className="text-xs text-muted-foreground">
                Nenhum boleto ou lançamento financeiro vinculado a este contrato até o momento.
              </p>
              {contract && onOpenGenerateModal && (
                <button
                  onClick={() => onOpenGenerateModal(contract)}
                  className="px-4 py-2 rounded-xl bg-tenant text-white font-bold text-xs shadow-md shadow-tenant/20 hover:opacity-90 transition-all inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Gerar Boletos Automaticamente (Banco Inter)
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((r) => {
                const isOverdue = r.status === "Pending" && r.due_date < today;
                const isPaid = r.status === "Paid";
                const isBoleto = r.type === "boleto";

                return (
                  <div
                    key={r.id}
                    className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 hover:border-white/20 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    {/* Document Identification */}
                    <div className="flex items-start sm:items-center gap-3.5 flex-1">
                      <div className={`p-3 rounded-2xl font-bold shrink-0 ${
                        r.type === "nf_service" 
                          ? "bg-sky-500/20 text-sky-400 border border-sky-500/30" 
                          : r.type === "nf_remessa" 
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" 
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      }`}>
                        {r.type === "nf_service" && <FileText className="w-5 h-5" />}
                        {r.type === "nf_remessa" && <Truck className="w-5 h-5" />}
                        {r.type === "boleto" && <Barcode className="w-5 h-5" />}
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
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
                            {r.type === "nf_service" ? "NF-e Serviço" : r.type === "nf_remessa" ? "NF Remessa Transporte" : "Boleto Banco Inter"}
                          </span>

                          {r.installment_number && r.total_installments && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-white/10 text-white/80 border border-white/15">
                              Parcela {r.installment_number}/{r.total_installments}
                            </span>
                          )}

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

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/50 pt-0.5">
                          <span>
                            Vencimento: <strong className={isOverdue ? "text-rose-400 font-bold" : "text-white/80"}>
                              {r.due_date ? r.due_date.split("-").reverse().join("/") : "-"}
                            </strong>
                          </span>

                          {r.paid_at && (
                            <span className="text-emerald-400 font-medium">
                              · Liquidado em: {new Date(r.paid_at).toLocaleDateString("pt-BR")}
                            </span>
                          )}

                          {r.inter_nosso_numero && (
                            <span className="text-white/40">
                              · Nosso Nº: {r.inter_nosso_numero}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Value and Inter Action Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-3 shrink-0 border-t lg:border-t-0 border-white/5 pt-3 lg:pt-0">
                      <div className="text-left lg:text-right">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Valor</div>
                        <div className="text-base font-black text-white">
                          R$ {r.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Botão Visualizar PDF Oficial */}
                        {r.type === "boleto" && (
                          <button
                            type="button"
                            onClick={() => handleViewPdf(r)}
                            disabled={loadingPdfId === r.id}
                            className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold shadow-sm ${
                              loadingPdfId === r.id
                                ? "bg-white/10 text-tenant border-tenant/30 cursor-not-allowed"
                                : "bg-white/5 hover:bg-white/10 text-white/90 hover:text-white border-white/10"
                            }`}
                            title="Visualizar PDF Oficial do Boleto Banco Inter"
                          >
                            {loadingPdfId === r.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-tenant" />
                                <span className="text-tenant text-[11px] font-medium">Carregando...</span>
                              </>
                            ) : (
                              <>
                                <FileText className="w-3.5 h-3.5 text-sky-400" />
                                <span className="hidden sm:inline">Visualizar PDF</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Botão Copiar Linha Digitável */}
                        {r.linha_digitavel && (
                          <button
                            onClick={() => copyToClipboard(r.linha_digitavel!, "Linha digitável", `linha-${r.id}`)}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                            title="Copiar Linha Digitável do Boleto"
                          >
                            {copiedField === `linha-${r.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Barcode className="w-3.5 h-3.5 text-amber-400" />}
                            <span className="hidden sm:inline">Copiar Código</span>
                          </button>
                        )}

                        {/* Botão Copiar Pix Copia e Cola / QR Code */}
                        {r.pix_copia_cola && (
                          <button
                            onClick={() => setActivePixModal(r)}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                            title="Ver Pix Copia e Cola / QR Code"
                          >
                            <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="hidden sm:inline">Pix</span>
                          </button>
                        )}

                        {/* Action to confirm payment (only for unpaid records) */}
                        {!isPaid && (
                          <button
                            onClick={() => onConfirmPayment(r)}
                            disabled={Boolean(loadingId)}
                            className={`px-3 py-2 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 ${
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
                                <CheckCircle2 className="w-3.5 h-3.5" /> Liquidar & Disparar OS
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

      {/* Modal Rápido de Pix Copia e Cola */}
      {activePixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-white/10 shadow-2xl p-6 flex flex-col gap-5 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Pix Híbrido do Boleto</h3>
                  <p className="text-xs text-muted-foreground">{activePixModal.code_number}</p>
                </div>
              </div>
              <button
                onClick={() => setActivePixModal(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center space-y-2">
              <div className="text-xs text-muted-foreground">Valor para pagamento imediato:</div>
              <div className="text-2xl font-black text-emerald-400">
                R$ {activePixModal.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/70">Pix Copia e Cola (EMV):</label>
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs font-mono break-all text-white/80 max-h-28 overflow-y-auto">
                {activePixModal.pix_copia_cola}
              </div>
            </div>

            <button
              onClick={() => copyToClipboard(activePixModal.pix_copia_cola!, "Código Pix", `pix-${activePixModal.id}`)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" /> Copiar Código Pix Copia e Cola
            </button>
          </div>
        </div>
      )}

      {/* Modal de Visualização Oficial do PDF do Boleto */}
      <BoletoPdfViewerModal
        record={viewerModalRecord}
        blobUrl={viewerModalBlobUrl}
        isOpen={Boolean(viewerModalRecord && viewerModalBlobUrl)}
        onClose={() => {
          setViewerModalRecord(null);
          setViewerModalBlobUrl(null);
        }}
      />
    </div>
  );
};
