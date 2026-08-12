import React, { useState } from "react";
import { Proposal, Client, Organization } from "@/types/locgest";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { StorageService } from "@/services/storageService";
import { X, Download, CloudLightning, FileText, Send, Check } from "lucide-react";
import { toast } from "sonner";
// @ts-ignore
import html2pdf from "html2pdf.js";

interface FormalProposalModalProps {
  proposal: Proposal;
  organization: Organization;
  onClose: () => void;
  onSuccess: () => void;
}

export const FormalProposalModal: React.FC<FormalProposalModalProps> = ({
  proposal,
  organization,
  onClose,
  onSuccess,
}) => {
  const client = proposal.client;

  // Editable configurations
  const [deliveryFreight, setDeliveryFreight] = useState("1.000,00");
  const [retrievalFreight, setRetrievalFreight] = useState("1.000,00");
  const [validityDate, setValidityDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });

  const [paymentFlow, setPaymentFlow] = useState(
    `1ª Parcela: Locação + Frete Entrega = 10 (dez) dias após assinatura do contrato;\n` +
    `2ª Parcela: Locação + Frete Retirada = 30 (trinta) dias após assinatura do contrato;\n` +
    `3ª Parcela em diante: Locação = a cada 30 (trinta) dias.`
  );

  const [observations, setObservations] = useState(
    `1) A ${organization.name.toUpperCase()} possui móveis p/ escritório (birôs, cadeiras, estantes, armários p/ vestiário e etc.) para locação;\n` +
    `2) As conexões hidráulicas (água e esgoto) e elétricas serão de responsabilidade do cliente, bem como licenças, taxas, alvarás e laudos;\n` +
    `3) O frete corresponde a franquia de 04 (quatro) horas de serviço. Excedentes serão cobrados a R$ 150,00/hora.`
  );

  const [isExporting, setIsExporting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(proposal.pdf_url || null);

  const formatDateBRL = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const getLeaseDurationMonths = () => {
    if (proposal.equipment_items && proposal.equipment_items.length > 0) {
      return proposal.equipment_items[0].duration_months || 12;
    }
    return 12;
  };

  const handleExportPDF = async (shouldUpload: boolean) => {
    try {
      setIsExporting(true);
      const element = document.getElementById("formal-proposal-pdf-content");
      if (!element) {
        toast.error("Erro ao gerar visualização do documento.");
        return;
      }

      const opt = {
        margin: [8, 8, 8, 8],
        filename: `Proposta_${proposal.proposal_number}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      if (!shouldUpload) {
        // Direct download
        html2pdf().from(element).set(opt).save();
        toast.success("PDF baixado com sucesso!");
        setIsExporting(false);
        return;
      }

      // Generate blob and upload to Supabase Storage
      const worker = html2pdf().from(element).set(opt).toPdf();
      const pdfObj = await worker.get("pdf");
      const pdfBlob = pdfObj.output("blob");

      const file = new File([pdfBlob], `Proposta_${proposal.proposal_number}.pdf`, {
        type: "application/pdf",
      });

      const uploadedUrl = await StorageService.uploadFile(file, "proposals", organization.id);
      
      // Update proposal pdf_url in DB
      const updatedProp: Proposal = {
        ...proposal,
        pdf_url: uploadedUrl,
        updated_at: new Date().toISOString(),
      };

      await SupabaseDataService.saveProposal(updatedProp);
      setPdfUrl(uploadedUrl);
      toast.success("PDF formal gerado e salvo na pasta do cliente!");
      onSuccess();
    } catch (err) {
      console.error("Error generating/uploading PDF:", err);
      toast.error("Erro ao gerar/salvar PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSendWhatsApp = () => {
    if (!pdfUrl) {
      toast.warning("Gere e salve a proposta formal primeiro.");
      return;
    }
    const message = `Olá, segue nossa Proposta Comercial Formalizada nº ${proposal.proposal_number} para locação de equipamentos:\n\n📄 Visualizar Proposta: ${pdfUrl}\n\nFicamos à disposição para assinatura!`;
    const whatsappUrl = `https://wa.me/${client?.phone?.replace(/\D/g, "") || ""}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md text-xs">
      <div className="w-full max-w-6xl p-6 rounded-2xl glass-panel border border-white/20 grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[95vh] overflow-hidden">
        
        {/* Left Side: Editor Form */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-4 overflow-y-auto pr-2 max-h-[80vh]">
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-tenant" /> Termos da Proposta
              </h2>
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-semibold">Validade da Proposta *</label>
              <input
                type="date"
                value={validityDate}
                onChange={(e) => setValidityDate(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white font-medium focus:outline-none focus:border-tenant"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-muted-foreground mb-1 font-semibold">Frete Entrega (R$)</label>
                <input
                  type="text"
                  value={deliveryFreight}
                  onChange={(e) => setDeliveryFreight(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white font-medium focus:outline-none focus:border-tenant"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1 font-semibold">Frete Retirada (R$)</label>
                <input
                  type="text"
                  value={retrievalFreight}
                  onChange={(e) => setRetrievalFreight(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white font-medium focus:outline-none focus:border-tenant"
                />
              </div>
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-semibold">Forma de Pagamento (Linha a Linha)</label>
              <textarea
                rows={4}
                value={paymentFlow}
                onChange={(e) => setPaymentFlow(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white font-medium focus:outline-none focus:border-tenant text-[10px] leading-relaxed font-mono"
              />
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-semibold">Observações Gerais (Linha a Linha)</label>
              <textarea
                rows={5}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white font-medium focus:outline-none focus:border-tenant text-[10px] leading-relaxed font-mono"
              />
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-white/10">
            <button
              onClick={() => handleExportPDF(true)}
              disabled={isExporting}
              className="w-full py-2.5 rounded-xl bg-tenant text-white text-xs font-bold shadow-lg shadow-tenant/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              {isExporting ? (
                <>Gerando Proposta...</>
              ) : (
                <>
                  <CloudLightning className="w-4 h-4" /> Salvar PDF na Pasta do Cliente
                </>
              )}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleExportPDF(false)}
                disabled={isExporting}
                className="py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10 flex items-center justify-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Baixar PDF
              </button>
              <button
                onClick={handleSendWhatsApp}
                disabled={!pdfUrl}
                className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  pdfUrl
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
                    : "bg-white/5 text-muted-foreground cursor-not-allowed border border-white/5"
                }`}
              >
                <Send className="w-3.5 h-3.5" /> WhatsApp
              </button>
            </div>

            {pdfUrl && (
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] text-center font-semibold flex items-center justify-center gap-1">
                <Check className="w-3 h-3" /> Proposta Formal Salva e Sincronizada!
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Document Preview */}
        <div className="lg:col-span-8 flex flex-col justify-between h-[80vh]">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-xs text-muted-foreground">Visualização do Layout da Proposta Formal</span>
            <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Paper View Container */}
          <div className="flex-1 overflow-y-auto bg-slate-900 border border-white/5 p-4 rounded-xl mt-3 flex justify-center">
            {/* The A4 Sheet container */}
            <div 
              id="formal-proposal-pdf-content" 
              className="w-[210mm] bg-white text-black p-[15mm] text-[10px] leading-relaxed shadow-2xl relative font-sans"
              style={{ minHeight: "297mm", color: "#111" }}
            >
              
              {/* Header Info */}
              <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
                <div>
                  {organization.logo_url ? (
                    <img src={organization.logo_url} alt="Logo" className="max-h-12 object-contain mb-2" />
                  ) : (
                    <h1 className="text-lg font-black tracking-tight text-tenant uppercase mb-1">{organization.name}</h1>
                  )}
                  <p className="text-[8px] text-gray-500 leading-tight uppercase font-semibold">
                    GESTÃO DE LOCAÇÃO DE EQUIPAMENTOS E FROTA
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-black">PROPOSTA DE LOCAÇÃO Nº {proposal.proposal_number.replace("PROP-2026-", "")}</div>
                  <div className="text-[9px] font-bold text-gray-600 mt-0.5">PRAZO DE {getLeaseDurationMonths()} (DOZE) MESES</div>
                </div>
              </div>

              {/* Prestadora e Tomador details columns */}
              <div className="grid grid-cols-2 gap-4 mb-4 text-[9px] border-b border-gray-200 pb-4">
                {/* Prestador */}
                <div className="space-y-1">
                  <div className="font-extrabold uppercase text-gray-500 tracking-wider text-[8px]">Locadora (Prestadora)</div>
                  <div className="font-bold text-[10px]">{organization.name.toUpperCase()}</div>
                  {organization.cnpj && <div><span className="font-bold">CNPJ:</span> {organization.cnpj}</div>}
                  {organization.phone && <div><span className="font-bold">Telefone:</span> {organization.phone}</div>}
                  {organization.email && <div><span className="font-bold">E-mail:</span> {organization.email.toLowerCase()}</div>}
                  {organization.address && <div><span className="font-bold">Endereço:</span> {organization.address}</div>}
                </div>

                {/* Tomador */}
                <div className="space-y-1">
                  <div className="font-extrabold uppercase text-gray-500 tracking-wider text-[8px]">Tomador do Serviço (Cliente)</div>
                  <div className="font-bold text-[10px]">{client?.company_name?.toUpperCase() || "CLIENTE NÃO CADASTRADO"}</div>
                  {client?.cnpj_cpf && <div><span className="font-bold">CNPJ/CPF:</span> {client.cnpj_cpf}</div>}
                  {client?.contact_person && <div><span className="font-bold">Contato:</span> {client.contact_person}</div>}
                  {client?.phone && <div><span className="font-bold">Telefone:</span> {client.phone}</div>}
                  {client?.email && <div><span className="font-bold">E-mail:</span> {client.email.toLowerCase()}</div>}
                  {client?.billing_address && <div><span className="font-bold">Endereço:</span> {client.billing_address}</div>}
                </div>
              </div>

              {/* Lease Metadata Row */}
              <div className="grid grid-cols-3 gap-2 bg-gray-100 p-2 rounded mb-4 font-semibold text-[9px]">
                <div><span className="text-gray-500">Período:</span> {formatDateBRL(proposal.start_date)} à {formatDateBRL(proposal.end_date)}</div>
                <div><span className="text-gray-500">Condição:</span> LOCAÇÃO</div>
                <div className="text-right text-emerald-700 font-extrabold text-[10px]">Total Proposta: R$ {proposal.total_amount.toLocaleString("pt-BR")}</div>
              </div>

              {/* Complementary Costs Table */}
              <div className="mb-4">
                <div className="font-bold uppercase text-gray-700 text-[8px] mb-1.5 tracking-wider">Valores Complementares</div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-left text-gray-600 font-bold border-b border-gray-300">
                      <th className="p-1 text-[8px]">Item</th>
                      <th className="p-1 text-[8px]">Código</th>
                      <th className="p-1 text-[8px]">Descrição</th>
                      <th className="p-1 text-[8px] text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="p-1">1</td>
                      <td className="p-1">009</td>
                      <td className="p-1 font-semibold text-gray-800">FRETE ENTREGA</td>
                      <td className="p-1 text-right font-bold text-gray-800">R$ {deliveryFreight}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-1">2</td>
                      <td className="p-1">010</td>
                      <td className="p-1 font-semibold text-gray-800">FRETE RETIRADA</td>
                      <td className="p-1 text-right font-bold text-gray-800">R$ {retrievalFreight}</td>
                    </tr>
                    <tr className="bg-gray-50 font-bold border-t border-gray-300">
                      <td colSpan={3} className="p-1 text-[8px] uppercase">TOTAL CUSTOS COMPLEMENTARES</td>
                      <td className="p-1 text-right text-black font-extrabold">
                        R$ {(
                          (parseFloat(deliveryFreight.replace(".", "").replace(",", ".")) || 0) +
                          (parseFloat(retrievalFreight.replace(".", "").replace(",", ".")) || 0)
                        ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Leased Products Table */}
              <div className="mb-4">
                <div className="font-bold uppercase text-gray-700 text-[8px] mb-1.5 tracking-wider">Produtos para Locação</div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-left text-gray-600 font-bold border-b border-gray-300">
                      <th className="p-1 text-[8px]">Item</th>
                      <th className="p-1 text-[8px]">TAG / Patrimônio</th>
                      <th className="p-1 text-[8px]">Descrição / Especificações</th>
                      <th className="p-1 text-[8px]">Faturamento</th>
                      <th className="p-1 text-[8px] text-center">Qtde</th>
                      <th className="p-1 text-[8px] text-right">Valor Unit.</th>
                      <th className="p-1 text-[8px] text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposal.equipment_items?.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-200 valign-top align-top">
                        <td className="p-1">{idx + 1}</td>
                        <td className="p-1 font-bold text-gray-700">{item.equipment_code}</td>
                        <td className="p-1 max-w-xs">
                          <span className="font-bold text-gray-900 block">{item.equipment_name.toUpperCase()}</span>
                          <span className="text-[8px] text-gray-500 leading-tight block">
                            Estrutura em aço galvanizado, pintura protetiva, ideal para canteiros de obra.
                          </span>
                        </td>
                        <td className="p-1 text-[8px] font-bold text-gray-600 uppercase">MENSAL</td>
                        <td className="p-1 text-center font-semibold">{item.qty}</td>
                        <td className="p-1 text-right">R$ {item.monthly_rate.toLocaleString("pt-BR")}</td>
                        <td className="p-1 text-right font-bold">R$ {item.total_amount.toLocaleString("pt-BR")}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold border-t border-gray-300">
                      <td colSpan={6} className="p-1 text-[8px] uppercase">TOTAL MENSAL DOS EQUIPAMENTOS</td>
                      <td className="p-1 text-right text-emerald-800 font-black">R$ {proposal.total_amount.toLocaleString("pt-BR")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Warning/Attention box */}
              <div className="p-2 border border-amber-300 bg-amber-50 rounded text-[7px] text-amber-900 leading-normal mb-4 font-medium">
                <span className="font-extrabold uppercase text-amber-700">ATENÇÃO!!!</span> O LOCAL ONDE O(S) CONTAINER(S) SERÁ(ÃO) DESCARREGADO(S) DEVERÁ SER NIVELADO E COMPACTADO, SENDO PROIBIDA A DESCARGA EM AREIA, POIS COMPROMETE A ESTRUTURA, PREJUDICANDO A ABERTURA DE PORTAS E DRENAGEM DA CHUVA, BEM COMO CAUSA DANOS AO CHASSI. SUGESTÃO: PODERÃO SER UTILIZADOS BARROTES DE MADEIRA OU BLOQUETES PREMOLDADOS NOS QUATRO CANTOS.
              </div>

              {/* Payment Flow */}
              <div className="mb-4">
                <div className="font-bold uppercase text-gray-700 text-[8px] mb-1.5 tracking-wider">Forma de Pagamento</div>
                <div className="whitespace-pre-line text-gray-800 font-semibold bg-gray-50 p-2 rounded text-[8px] border border-gray-200 leading-normal font-mono">
                  {paymentFlow}
                </div>
              </div>

              {/* General Observations */}
              <div className="mb-4">
                <div className="font-bold uppercase text-gray-700 text-[8px] mb-1.5 tracking-wider">Observações Gerais</div>
                <div className="whitespace-pre-line text-gray-600 bg-gray-50 p-2 rounded text-[8.5px] leading-relaxed border border-gray-200">
                  {observations}
                </div>
              </div>

              {/* Validity info and Signatures block */}
              <div className="mt-8">
                <div className="flex justify-between items-center text-[9px] mb-8 font-semibold">
                  <div className="text-gray-500">Validade da Proposta: <span className="text-black font-extrabold">{formatDateBRL(validityDate)}</span></div>
                  <div>Fortaleza, {new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}</div>
                </div>

                <div className="grid grid-cols-3 gap-6 pt-4 text-center text-[8px] font-bold">
                  <div className="border-t border-black pt-1">
                    <div>Locadora</div>
                    <div className="text-[7px] text-gray-400 font-normal">{organization.name.toUpperCase()}</div>
                  </div>
                  <div className="border-t border-black pt-1">
                    <div>Representante Comercial</div>
                    <div className="text-[7px] text-gray-400 font-normal">MARLOC COMERCIAL</div>
                  </div>
                  <div className="border-t border-black pt-1">
                    <div>Aceite do Cliente</div>
                    <div className="text-[7px] text-gray-400 font-normal">{client?.company_name?.toUpperCase() || "TOMADOR"}</div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
