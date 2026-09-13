import React, { useEffect } from "react";
import { FinancialRecord } from "@/types/locgest";
import { FileText, ExternalLink, X } from "lucide-react";

interface BoletoPdfViewerModalProps {
  record: FinancialRecord | null;
  blobUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BoletoPdfViewerModal: React.FC<BoletoPdfViewerModalProps> = ({
  record,
  blobUrl,
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !record || !blobUrl) return null;

  const handleOpenNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, "_blank", "noopener,noreferrer");
    }
  };

  const isPaid = record.status === "Paid";
  const today = new Date().toISOString().split("T")[0];
  const isOverdue = record.status === "Pending" && record.due_date < today;

  const formattedDueDate = record.due_date
    ? record.due_date.split("-").reverse().join("/")
    : "-";

  const clientName =
    record.client?.company_name ||
    record.client?.trade_name ||
    record.payer_name ||
    "Cliente";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl h-[92vh] max-h-[92vh] rounded-3xl bg-slate-900/95 border border-white/10 shadow-2xl flex flex-col text-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-tenant/15 text-tenant border border-tenant/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Boleto Oficial ({record.code_number})
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    isPaid
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : isOverdue
                      ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                      : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  }`}
                >
                  {isPaid ? "Pago" : isOverdue ? "Vencido" : "Aguardando Pagamento"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cliente: <strong className="text-white/90">{clientName}</strong> · Valor:{" "}
                <strong className="text-emerald-400">
                  R$ {record.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </strong>{" "}
                · Vencimento: <strong className="text-white/90">{formattedDueDate}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Ação secundária: Abrir em nova aba */}
            <button
              type="button"
              onClick={handleOpenNewTab}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              title="Abrir PDF em nova aba do navegador"
            >
              <ExternalLink className="w-4 h-4 text-tenant" />
              <span className="hidden sm:inline">Abrir em nova aba</span>
            </button>

            {/* Fechar */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              title="Fechar visualizador"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Visualizador PDF Nativo */}
        <div className="flex-1 w-full h-full bg-slate-950 p-2 overflow-hidden">
          <object
            data={blobUrl}
            type="application/pdf"
            className="w-full h-full rounded-2xl border border-white/5 bg-slate-950"
          >
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground gap-3">
              <FileText className="w-12 h-12 text-tenant/50" />
              <p className="text-sm font-semibold text-white">
                Seu navegador não possui suporte para renderização embutida de PDF.
              </p>
              <button
                onClick={handleOpenNewTab}
                className="px-4 py-2 rounded-xl bg-tenant text-white text-xs font-bold shadow-lg shadow-tenant/20 hover:opacity-90 transition-all flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" /> Abrir PDF em Nova Aba
              </button>
            </div>
          </object>
        </div>
      </div>
    </div>
  );
};
