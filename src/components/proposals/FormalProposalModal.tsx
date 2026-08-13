import React, { useState, useRef, useEffect } from "react";
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
    `3) O frete corresponde a franquia de 04 (quatro) horas de serviço. Excedentes serão cobrados a R$ 150,00/hora.\n\n` +
    `Dados para emissão de Contrato de Locação e Nota de Remessa de Bens:\n` +
    `- CNPJ;\n` +
    `- Inscrição estadual (se houver) e/ ou municipal;\n` +
    `- Contrato social e/ ou consolidado e último aditivo;\n` +
    `- Endereço completo de entrega/ obra;\n` +
    `- Nome e telefone da pessoa que vai receber o container.\n\n` +
    `Aguardo retorno.`
  );

  const [isExporting, setIsExporting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(proposal.pdf_url || null);

  // Scale-to-fit page preview: the sheet is always rendered at its true A4
  // width/layout (so it matches the exported PDF pixel-for-pixel); only the
  // visual presentation is scaled down to fit the available preview pane,
  // the same technique used by Google Docs/Figma page previews.
  const previewPaneRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [sheetNaturalSize, setSheetNaturalSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const pane = previewPaneRef.current;
    const sheet = sheetRef.current;
    if (!pane || !sheet) return;

    const recalc = () => {
      const paneWidth = pane.clientWidth;
      const naturalWidth = sheet.offsetWidth;
      const naturalHeight = sheet.scrollHeight;
      setSheetNaturalSize({ width: naturalWidth, height: naturalHeight });
      if (naturalWidth > 0) {
        setPreviewScale(Math.min(1, paneWidth / naturalWidth));
      }
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(pane);
    ro.observe(sheet);
    return () => ro.disconnect();
  }, []);

  const formatDateBRL = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const formatOrgAddress = (org: Organization) => {
    const parts = [org.address_st, org.address_number, org.address_neighborhood].filter(Boolean);
    const cityState = [org.address_city, org.address_estate].filter(Boolean).join("/");
    if (cityState) parts.push(cityState);
    const line = parts.join(", ");
    return org.address_zipcode ? `${line}${line ? " - " : ""}${org.address_zipcode}` : line;
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
        margin: 0,
        filename: `Proposta_${proposal.proposal_number}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, windowWidth: 794 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
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
      <div className="w-full max-w-[1440px] p-6 rounded-2xl glass-panel border border-white/20 grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[95vh] overflow-hidden">

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
                className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${pdfUrl
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
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground/70 font-mono tabular-nums">
                {Math.round(previewScale * 100)}%
              </span>
              <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Preview pane — a fixed-size dark tray the page rests in. The sheet always
              renders at true A4 layout width (so it's pixel-identical to the exported PDF);
              only its on-screen presentation is scaled down to fit, like a Google Docs/Figma
              page preview. This avoids fighting flexbox stretch/overflow across browsers. */}
          <div
            ref={previewPaneRef}
            className="flex-1 overflow-y-auto bg-slate-900 border border-white/5 rounded-xl mt-3 p-6 flex justify-center"
          >
            <div
              className="relative shrink-0"
              style={{
                width: sheetNaturalSize.width * previewScale,
                height: sheetNaturalSize.height * previewScale,
              }}
            >
              <div
                className="absolute top-0 left-0 origin-top-left"
                style={{ transform: `scale(${previewScale})` }}
              >
                {/* The A4 Sheet: untouched true-size DOM, also the exact node html2pdf captures */}
                <div
                  ref={sheetRef}
                  id="formal-proposal-pdf-content"
                  className="w-[210mm] bg-white text-black p-[12mm] text-[9px] leading-relaxed shadow-2xl relative font-sans"
                  style={{ color: "#111" }}
                >

                  {/* Header Info */}
                  <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-5">
                    <div>
                      {organization.logo_url ? (
                        <img src={organization.logo_url} alt="Logo" className="max-h-[78px] object-contain mb-2" />
                      ) : (
                        <h1 className="text-lg font-black tracking-tight text-tenant uppercase mb-1">{organization.name}</h1>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-black">PROPOSTA DE LOCAÇÃO Nº {proposal.proposal_number.replace("PROP-2026-", "")}</div>
                      <div className="text-[9px] font-bold text-gray-600 mt-0.5">PRAZO DE {getLeaseDurationMonths()} MES(ES)</div>
                    </div>
                  </div>

                  {/* Prestadora e Tomador details columns */}
                  <div className="grid grid-cols-2 gap-4 mb-5 text-[8px] border-b border-gray-200 pb-4">
                    {/* Prestador */}
                    <div>
                      <div className="font-extrabold uppercase text-gray-500 tracking-wider text-[7.5px] mb-1">Locadora (Prestadora)</div>
                      <div className="font-bold text-[9px] mb-1">{organization.name.toUpperCase()}</div>
                      <div className="space-y-0.5 leading-snug">
                        {(organization.cnpj || organization.ie) && (
                          <div className="flex items-center gap-1.5">
                            {organization.cnpj && <span><span className="font-bold">CNPJ:</span> {organization.cnpj}</span>}
                            {organization.cnpj && organization.ie && <span className="text-gray-300">|</span>}
                            {organization.ie && <span><span className="font-bold">IE:</span> {organization.ie}</span>}
                          </div>
                        )}
                        {formatOrgAddress(organization) && (
                          <div><span className="font-bold">Endereço:</span> {formatOrgAddress(organization)}</div>
                        )}
                        {(organization.phone || organization.email) && (
                          <div className="flex items-center gap-1.5">
                            {organization.phone && <span><span className="font-bold">Tel:</span> {organization.phone}</span>}
                            {organization.phone && organization.email && <span className="text-gray-300">|</span>}
                            {organization.email && <span><span className="font-bold">E-mail:</span> {organization.email.toLowerCase()}</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tomador */}
                    <div>
                      <div className="font-extrabold uppercase text-gray-500 tracking-wider text-[7.5px] mb-1">Tomador do Serviço (Cliente)</div>
                      <div className="font-bold text-[9px] mb-1">{client?.company_name?.toUpperCase() || "CLIENTE NÃO CADASTRADO"}</div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 leading-snug">
                        {client?.cnpj_cpf && <div><span className="font-bold">CNPJ/CPF:</span> {client.cnpj_cpf}</div>}
                        {client?.contact_person && <div><span className="font-bold">Contato:</span> {client.contact_person}</div>}
                        {client?.phone && <div><span className="font-bold">Tel:</span> {client.phone}</div>}
                        {client?.email && <div className="col-span-2"><span className="font-bold">E-mail:</span> {client.email.toLowerCase()}</div>}
                        {client?.billing_address && <div className="col-span-2"><span className="font-bold">Endereço:</span> {client.billing_address}</div>}
                      </div>
                    </div>
                  </div>

                  {/* Lease Metadata Row */}
                  <div className="flex items-center gap-2 bg-gray-100 p-2.5 rounded mb-5 font-semibold text-[9px]">
                    <div className="flex-1"><span className="text-gray-500">Período:</span> {formatDateBRL(proposal.start_date)} à {formatDateBRL(proposal.end_date)}</div>
                    <div className="flex-1"><span className="text-gray-500">Condição:</span> LOCAÇÃO</div>
                    <div className="flex-1 text-right text-emerald-700 font-extrabold text-[10px]">Total Proposta: R$ {proposal.total_amount.toLocaleString("pt-BR")}</div>
                  </div>

                  {/* Complementary Costs Table */}
                  <div className="mb-5">
                    <div className="font-bold uppercase text-gray-700 text-[8px] mb-1.5 tracking-wider">Valores Complementares</div>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-100 text-left text-gray-600 font-bold border-b border-gray-300">
                          <th className="p-1.5 text-[8px] align-middle">Item</th>
                          <th className="p-1.5 text-[8px] align-middle">Código</th>
                          <th className="p-1.5 text-[8px] align-middle">Descrição</th>
                          <th className="p-1.5 text-[8px] align-middle text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-200">
                          <td className="p-1.5 align-middle">1</td>
                          <td className="p-1.5 align-middle">009</td>
                          <td className="p-1.5 align-middle font-semibold text-gray-800">FRETE ENTREGA</td>
                          <td className="p-1.5 align-middle text-right font-bold text-gray-800">R$ {deliveryFreight}</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="p-1.5 align-middle">2</td>
                          <td className="p-1.5 align-middle">010</td>
                          <td className="p-1.5 align-middle font-semibold text-gray-800">FRETE RETIRADA</td>
                          <td className="p-1.5 align-middle text-right font-bold text-gray-800">R$ {retrievalFreight}</td>
                        </tr>
                        <tr className="bg-gray-50 font-bold border-t border-gray-300">
                          <td colSpan={3} className="p-1.5 align-middle text-[8px] uppercase">TOTAL CUSTOS COMPLEMENTARES</td>
                          <td className="p-1.5 align-middle text-right text-black font-extrabold">
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
                  <div className="mb-5">
                    <div className="font-bold uppercase text-gray-700 text-[8px] mb-1.5 tracking-wider">Produtos para Locação</div>
                    <table className="w-full border-collapse table-fixed">
                      <colgroup>
                        <col style={{ width: "4%" }} />
                        <col style={{ width: "14%" }} />
                        <col style={{ width: "42%" }} />
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "6%" }} />
                        <col style={{ width: "11%" }} />
                        <col style={{ width: "11%" }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-100 text-left text-gray-600 font-bold border-b border-gray-300">
                          <th className="p-1.5 align-middle text-[8px]">#</th>
                          <th className="p-1.5 align-middle text-[8px]">TAG / Patrimônio</th>
                          <th className="p-1.5 align-middle text-[8px]">Descrição</th>
                          <th className="p-1.5 align-middle text-[8px]">Faturamento</th>
                          <th className="p-1.5 align-middle text-[8px] text-center">Qtd</th>
                          <th className="p-1.5 align-middle text-[8px] text-right whitespace-nowrap">Vl. Unit.</th>
                          <th className="p-1.5 align-middle text-[8px] text-right whitespace-nowrap">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {proposal.equipment_items?.map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-200">
                            <td className="p-1.5 align-middle">{idx + 1}</td>
                            <td className="p-1.5 align-middle font-bold text-gray-700">{item.equipment_code}</td>
                            <td className="p-1.5 align-middle">
                              <span className="font-bold text-gray-900 block">{item.equipment_name.toUpperCase()}</span>
                            </td>
                            <td className="p-1.5 align-middle text-[8px] font-bold text-gray-600 uppercase">MENSAL</td>
                            <td className="p-1.5 align-middle text-center font-semibold">{item.qty}</td>
                            <td className="p-1.5 align-middle text-right whitespace-nowrap">R$ {item.monthly_rate.toLocaleString("pt-BR")}</td>
                            <td className="p-1.5 align-middle text-right font-bold whitespace-nowrap">R$ {item.total_amount.toLocaleString("pt-BR")}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 font-bold border-t border-gray-300">
                          <td colSpan={6} className="p-1.5 align-middle text-[8px] uppercase">TOTAL MENSAL DOS EQUIPAMENTOS</td>
                          <td className="p-1.5 align-middle text-right text-emerald-800 font-black whitespace-nowrap">R$ {proposal.total_amount.toLocaleString("pt-BR")}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Warning/Attention box */}
                  <div className="p-2.5 border border-amber-300 bg-amber-50 rounded text-[8px] text-amber-900 leading-relaxed mb-5 font-medium">
                    <span className="font-extrabold uppercase text-amber-700">ATENÇÃO!!!</span> O LOCAL ONDE O(S) CONTAINER(S) SERÁ(ÃO) DESCARREGADO(S) DEVERÁ SER NIVELADO E COMPACTADO, SENDO PROIBIDA A DESCARGA EM AREIA, POIS COMPROMETE A ESTRUTURA, PREJUDICANDO A ABERTURA DE PORTAS E DRENAGEM DA CHUVA, BEM COMO CAUSA DANOS AO CHASSI. SUGESTÃO: PODERÃO SER UTILIZADOS BARROTES DE MADEIRA OU BLOQUETES PREMOLDADOS NOS QUATRO CANTOS.
                  </div>

                  {/* Payment Flow */}
                  <div className="mb-5">
                    <div className="font-bold uppercase text-gray-700 text-[8px] mb-1.5 tracking-wider">Forma de Pagamento</div>
                    <div className="whitespace-pre-line text-gray-800 font-semibold bg-gray-50 p-2.5 rounded text-[8px] border border-gray-200 leading-relaxed font-mono">
                      {paymentFlow}
                    </div>
                  </div>

                  {/* General Observations */}
                  <div className="mb-5">
                    <div className="font-bold uppercase text-gray-700 text-[8px] mb-1.5 tracking-wider">Observações Gerais</div>
                    <div className="whitespace-pre-line text-gray-600 bg-gray-50 p-2.5 rounded text-[8px] leading-relaxed border border-gray-200">
                      {observations}
                    </div>
                  </div>

                  {/* Validity info and Signatures block */}
                  <div className="mt-1">
                    <div className="flex justify-between items-center text-[9px] mb-4 font-semibold">
                      <div className="text-gray-500">Validade da Proposta: <span className="text-black font-extrabold">{formatDateBRL(validityDate)}</span></div>
                      <div>Fortaleza, {new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-12 pt-3 text-center text-[8px] font-bold">
                      <div className="border-t border-black pt-1">
                        <div>Locadora</div>
                        <div className="text-[7px] text-gray-400 font-normal">{organization.name.toUpperCase()}</div>
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

      </div>
    </div>
  );
};
