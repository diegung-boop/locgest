import React, { useState, useRef, useEffect } from "react";
import { Contract, Client, Organization } from "@/types/locgest";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { StorageService } from "@/services/storageService";
import { X, Download, CloudLightning, FileText, Send, Check } from "lucide-react";
import { toast } from "sonner";
// @ts-ignore
import html2pdf from "html2pdf.js";

interface FormalContractModalProps {
  contract: Contract;
  organization: Organization;
  onClose: () => void;
  onSuccess: () => void;
}

export const FormalContractModal: React.FC<FormalContractModalProps> = ({
  contract,
  organization,
  onClose,
  onSuccess,
}) => {
  const client = contract.client;

  // Editable configurations preloaded with approved proposal / contract values
  const [deliveryFreight, setDeliveryFreight] = useState("1.000,00");
  const [retrievalFreight, setRetrievalFreight] = useState("1.000,00");
  const [objectValue, setObjectValue] = useState("40.000,00");
  const [forumCity, setForumCity] = useState("Eusébio (CE)");

  const [locadorRep, setLocadorRep] = useState(
    "Eliane Veríssimo Gomes, brasileira, divorciada, empresária, RG nº 440.646 SSP-CE, C.P.F nº 201.420.303-25, residente e domiciliada na cidade de Fortaleza/ CE, na Av. Dos Expedicionários nº 5405 Bloco 10 Aptº 101 – Vila União – CEP: 60.410-411"
  );
  const [locadorAttorney, setLocadorAttorney] = useState(
    "Hélio Peixoto de Alencar Neto, brasileiro, divorciado, empresário, RG nº 90011007350 SSP-CE, CPF nº 456.487.273-72, residente e domiciliado na cidade de Fortaleza/ CE, na Rua Joaquim Nabuco nº 1300 Aptº 102 – Aldeota – CEP: 60.125-055"
  );

  const [locatarioRep, setLocatarioRep] = useState(
    client?.contact_name
      ? `${client.contact_name}, representante legal da empresa locatária, portador do documento de identificação cadastrado no sistema.`
      : "ARISTARCO BARBOSA SOBREIRA, brasileiro, casado, engenheiro civil, RG nº 4716 CRA/ CE, C.P.F nº 071.680.983-49, residente e domiciliado na cidade de Fortaleza/ CE, na Rua Leonardo Mota nº 1670 – Aldeota – CEP: 60.170-041"
  );

  const [contractDate, setContractDate] = useState(() => {
    return contract.start_date || new Date().toISOString().split("T")[0];
  });

  const [isExporting, setIsExporting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(contract.pdf_url || null);

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

  const getLeaseDurationMonths = () => {
    if (contract.proposal?.equipment_items && contract.proposal.equipment_items.length > 0) {
      return contract.proposal.equipment_items[0].duration_months || 12;
    }
    return 12;
  };

  const generateInstallments = () => {
    const list = [];
    const start = contract.start_date ? new Date(contract.start_date) : new Date();
    const duration = getLeaseDurationMonths();
    const rate = contract.total_value / duration;

    for (let i = 1; i <= duration; i++) {
      let dueDate = new Date(start);
      if (i === 1) {
        dueDate.setDate(dueDate.getDate() + 10);
      } else {
        dueDate.setMonth(dueDate.getMonth() + (i - 1));
      }

      let label = `R$ ${rate.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
      let extra = "";
      if (i === 1) {
        extra = ` + R$ ${deliveryFreight} (Frete ida)`;
      } else if (i === 2) {
        extra = ` + R$ ${retrievalFreight} (Frete volta)`;
      }

      list.push({
        num: i,
        label,
        extra,
        date: dueDate.toLocaleDateString("pt-BR"),
      });
    }
    return list;
  };

  const handleExportPDF = async (shouldUpload: boolean) => {
    try {
      setIsExporting(true);
      const element = document.getElementById("formal-contract-pdf-content");
      if (!element) {
        toast.error("Erro ao localizar conteúdo do contrato.");
        return;
      }

      // Convert logo to base64 if available to print dynamically on jsPDF pages
      let logoBase64: string | null = null;
      const logoImg = document.getElementById("locadora-logo-img") as HTMLImageElement | null;
      if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = logoImg.naturalWidth;
          canvas.height = logoImg.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(logoImg, 0, 0);
            logoBase64 = canvas.toDataURL("image/png");
          }
        } catch (e) {
          console.warn("Could not convert logo to base64 due to CORS or load error:", e);
        }
      }

      // Save original padding and set to "0px 56px" temporarily to prevent double padding clipping on the right margin
      const originalPadding = element.style.padding;
      element.style.padding = "0px 56px";

      // Hide HTML header and footer temporarily during PDF generation to prevent duplicate headers/footers in text flow
      const htmlHeader = document.getElementById("contract-html-header");
      const htmlFooter = document.getElementById("contract-html-footer");
      if (htmlHeader) htmlHeader.style.display = "none";
      if (htmlFooter) htmlFooter.style.display = "none";

      const opt = {
        margin: [25, 0, 25, 0], // Margin: Top 25mm, Bottom 25mm, Left/Right 0
        filename: `Contrato_${contract.contract_number}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, windowWidth: 794 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      };

      const worker = html2pdf().from(element).set(opt).toPdf().get("pdf").then((pdf: any) => {
        const totalPages = pdf.internal.getNumberOfPages();
        const addressLine = formatAddress(organization).toUpperCase();
        const phone = organization.phone || "(85) 3034 3519";
        const email = organization.email || "financeiro@locgest.com";
        const footerText = `${addressLine} — FONE: ${phone} — ${email}`.toUpperCase();

        // Calculate dynamic dimensions to preserve logo aspect ratio
        let imgWidth = 30;
        let imgHeight = 9;
        if (logoImg && logoImg.complete && logoImg.naturalWidth > 0 && logoImg.naturalHeight > 0) {
          const aspectRatio = logoImg.naturalHeight / logoImg.naturalWidth;
          imgWidth = 35; // Maximum width in mm
          imgHeight = imgWidth * aspectRatio;
          // Scale down if height exceeds the maximum header allocation (11mm)
          if (imgHeight > 11) {
            imgHeight = 11;
            imgWidth = imgHeight / aspectRatio;
          }
        }

        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);

          // Draw header divider line
          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.3);
          pdf.line(15, 20, 195, 20);

          // Draw header Locadora Name
          pdf.setFont("Times", "bold");
          pdf.setFontSize(8.5);
          pdf.setTextColor(80, 80, 80);
          pdf.text(organization.name.toUpperCase(), 15, 16);

          // Draw logo if available
          if (logoBase64) {
            const logoX = 195 - imgWidth; // Align to the right margin of A4
            const logoY = 19 - imgHeight; // Align vertically to 1mm above the header divider line
            pdf.addImage(logoBase64, "PNG", logoX, logoY, imgWidth, imgHeight);
          }

          // Draw footer divider line
          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.3);
          pdf.line(15, 277, 195, 277);

          // Draw footer Locadora details centered
          pdf.setFont("Times", "bold");
          pdf.setFontSize(7.5);
          pdf.setTextColor(120, 120, 120);
          pdf.text(footerText, 105, 282, { align: "center" });

          // Draw page numbers centered
          const pageNumText = `PÁGINA ${i} DE ${totalPages}`;
          pdf.text(pageNumText, 105, 286, { align: "center" });
        }
      });

      if (!shouldUpload) {
        await worker.save();
        toast.success("PDF baixado com sucesso!");

        // Restore HTML header, footer and padding
        if (htmlHeader) htmlHeader.style.display = "flex";
        if (htmlFooter) htmlFooter.style.display = "block";
        element.style.padding = originalPadding;
        setIsExporting(false);
        return;
      }

      const pdfObj = await worker;
      const pdfBlob = pdfObj.output("blob");

      // Restore HTML header, footer and padding
      if (htmlHeader) htmlHeader.style.display = "flex";
      if (htmlFooter) htmlFooter.style.display = "block";
      element.style.padding = originalPadding;

      const file = new File([pdfBlob], `Contrato_${contract.contract_number}.pdf`, {
        type: "application/pdf",
      });

      const uploadedUrl = await StorageService.uploadFile(file, "contracts", organization.id);

      const updatedContract: Contract = {
        ...contract,
        pdf_url: uploadedUrl,
        updated_at: new Date().toISOString(),
      };

      await SupabaseDataService.saveContract(updatedContract);
      setPdfUrl(uploadedUrl);
      toast.success("PDF do Contrato gerado e salvo com sucesso!");
      onSuccess();
    } catch (err) {
      console.error("Error generating/uploading PDF:", err);
      toast.error("Erro ao gerar/salvar PDF.");

      // Ensure restoration on error
      const htmlHeader = document.getElementById("contract-html-header");
      const htmlFooter = document.getElementById("contract-html-footer");
      if (htmlHeader) htmlHeader.style.display = "flex";
      if (htmlFooter) htmlFooter.style.display = "block";
      const element = document.getElementById("formal-contract-pdf-content");
      if (element) element.style.padding = "";
    } finally {
      setIsExporting(false);
    }
  };

  const handleSendWhatsApp = () => {
    if (!pdfUrl) {
      toast.warning("Gere e salve o PDF do contrato primeiro.");
      return;
    }
    const message = `Olá, segue nosso Contrato de Locação de Bens Móveis nº ${contract.contract_number} formalizado:\n\n📄 Visualizar Contrato: ${pdfUrl}\n\nFicamos no aguardo da assinatura.`;
    const whatsappUrl = `https://wa.me/${client?.phone?.replace(/\D/g, "") || ""}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  const formatAddress = (org: any) => {
    const parts = [org.address_st, org.address_number, org.address_neighborhood].filter(Boolean);
    const cityState = [org.address_city, org.address_estate].filter(Boolean).join("/");
    if (cityState) parts.push(cityState);
    const line = parts.join(", ");
    return org.address_zipcode ? `${line}${line ? " - " : ""}${org.address_zipcode}` : line;
  };

  const installments = generateInstallments();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md text-xs">
      <div className="w-full max-w-[1440px] p-6 rounded-2xl glass-panel border border-white/20 grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[95vh] overflow-hidden relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-all p-1.5 hover:bg-white/10 rounded-full z-10"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Panel: Editor Configs */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-4 overflow-y-auto pr-2 max-h-[85vh]">
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-tenant" /> Termos do Contrato
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-muted-foreground mb-1 font-semibold">Proposta Vinculada</label>
                <input
                  type="text"
                  readOnly
                  value={contract.proposal?.proposal_number || "P2026..."}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-white/5 text-muted-foreground font-semibold cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1 font-semibold">Cidade do Foro</label>
                <input
                  type="text"
                  value={forumCity}
                  onChange={(e) => setForumCity(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white font-medium focus:outline-none focus:border-tenant"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-muted-foreground mb-1 font-semibold">Frete Ida (R$)</label>
                <input
                  type="text"
                  value={deliveryFreight}
                  onChange={(e) => setDeliveryFreight(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white font-medium focus:outline-none focus:border-tenant"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1 font-semibold">Frete Volta (R$)</label>
                <input
                  type="text"
                  value={retrievalFreight}
                  onChange={(e) => setRetrievalFreight(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white font-medium focus:outline-none focus:border-tenant"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1 font-semibold">Val. Equips.  (R$)</label>
                <input
                  type="text"
                  value={objectValue}
                  onChange={(e) => setObjectValue(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white font-medium focus:outline-none focus:border-tenant"
                />
              </div>
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-semibold">Data do Contrato</label>
              <input
                type="date"
                value={contractDate}
                onChange={(e) => setContractDate(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white font-medium focus:outline-none focus:border-tenant"
              />
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-semibold">Locador - Representante Legal</label>
              <textarea
                rows={3}
                value={locadorRep}
                onChange={(e) => setLocadorRep(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white font-medium focus:outline-none focus:border-tenant resize-none"
              />
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-semibold">Locador - Procurador</label>
              <textarea
                rows={3}
                value={locadorAttorney}
                onChange={(e) => setLocadorAttorney(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white font-medium focus:outline-none focus:border-tenant resize-none"
              />
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-semibold">Locatário - Representante Legal</label>
              <textarea
                rows={3}
                value={locatarioRep}
                onChange={(e) => setLocatarioRep(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-900 border border-white/10 text-white font-medium focus:outline-none focus:border-tenant resize-none"
              />
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-white/10">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleExportPDF(false)}
                disabled={isExporting}
                className="w-full py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-white font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Download className="w-4 h-4" /> Baixar PDF
              </button>

              <button
                onClick={() => handleExportPDF(true)}
                disabled={isExporting}
                className="w-full py-2.5 rounded-xl bg-tenant text-white font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-tenant/20 hover:opacity-90 transition-all"
              >
                <CloudLightning className="w-4 h-4" /> Gerar & Salvar
              </button>
            </div>

            <button
              onClick={handleSendWhatsApp}
              disabled={!pdfUrl}
              className={`w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${pdfUrl
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                : "bg-slate-800 text-muted-foreground cursor-not-allowed"
                }`}
            >
              <Send className="w-4 h-4" /> Enviar por WhatsApp
            </button>

            {pdfUrl && (
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2 text-[10px]">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Documento disponível em nuvem</span>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-all text-center font-bold mt-2"
            >
              Fechar Painel
            </button>
          </div>
        </div>

        {/* Right Panel: A4 Live Preview */}
        <div className="lg:col-span-8 bg-slate-950/60 rounded-2xl border border-white/10 flex flex-col overflow-hidden max-h-[85vh]">
          <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
            <span className="font-semibold text-white">Visualização Impressão A4</span>
            <span className="text-[10px] text-muted-foreground">Proporção Ajustada: {Math.round(previewScale * 100)}%</span>
          </div>

          <div
            ref={previewPaneRef}
            className="flex-1 overflow-y-auto p-4 flex justify-center items-start bg-slate-900/50"
          >
            <div
              style={{
                transform: `scale(${previewScale})`,
                transformOrigin: "top center",
                width: `794px`,
                height: `${sheetNaturalSize.height ? sheetNaturalSize.height * previewScale : "auto"}px`,
              }}
              className="transition-transform duration-100 ease-out"
            >

              {/* ON-SCREEN PREVIEW: Continuous Document (What the user sees in the modal & what html2pdf captures) */}
              <div
                ref={sheetRef}
                id="formal-contract-pdf-content"
                className="w-[794px] bg-white text-black p-[50px] shadow-2xl relative space-y-[20px] contract-preview-container"
                style={{ fontFamily: "'Times New Roman', Times, serif" }}
              >
                <style>{`
                  .contract-preview-container {
                    color: #000 !important;
                    line-height: 1.5;
                  }
                  .contract-preview-container p {
                    margin-bottom: 12px;
                    text-align: justify;
                    text-justify: inter-word;
                    font-size: 10px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                  }
                  .contract-preview-container h2 {
                    font-size: 12px;
                    font-weight: bold;
                    text-align: center;
                    margin-bottom: 20px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                  }
                  .contract-preview-container h3 {
                    font-size: 10px;
                    font-weight: bold;
                    margin-top: 16px;
                    margin-bottom: 8px;
                    border-bottom: 1px solid #ccc;
                    padding-bottom: 2px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                    page-break-after: avoid;
                    break-after: avoid;
                  }
                  .contract-preview-container table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 15px 0;
                    page-break-inside: avoid;
                    break-inside: avoid;
                  }
                  .contract-preview-container table th,
                  .contract-preview-container table td {
                    border: 1px solid #ccc;
                    padding: 6px;
                    font-size: 9px;
                  }
                  .contract-preview-container ul {
                    list-style-type: disc;
                    padding-left: 20px;
                    margin-bottom: 12px;
                    font-size: 10px;
                  }
                  .contract-preview-container li {
                    margin-bottom: 4px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                  }
                  .contract-preview-container .signature-block {
                    margin-top: 30px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                  }
                  .contract-preview-container .witness-block {
                    margin-top: 30px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                  }
                `}</style>

                {/* Header (Hidden dynamically during print) */}
                <div id="contract-html-header" className="flex justify-between items-center border-b-2 border-black pb-2.5 mb-6">
                  <div className="font-black text-sm tracking-tight text-neutral-800 uppercase">
                    {organization.name}
                  </div>
                  {organization.logo_url && (
                    <img id="locadora-logo-img" src={organization.logo_url} crossOrigin="anonymous" alt="Logo" className="max-h-[52px] object-contain" />
                  )}
                </div>

                <h2>
                  CONTRATO DE LOCAÇÃO DE BENS MÓVEIS Nº {contract.contract_number}
                  {contract.proposal?.proposal_number && ` (Ref. Proposta nº ${contract.proposal.proposal_number})`}
                </h2>

                <div className="space-y-4">
                  <p>
                    <strong>LOCADOR:</strong>
                  </p>
                  <p className="pl-4">
                    <strong>{organization.name.toUpperCase()}</strong> (Nome Fantasia: {organization.trade_name || organization.name}),
                    com sede em {formatAddress(organization)}, inscrita no CNPJ sob o nº {organization.cnpj || "Sem CNPJ"},
                    Inscrição Estadual nº {organization.ie || "Isento"}, e-mail: {organization.email || "financeiro@locgest.com"}.<br />
                    <strong>Representante Legal:</strong> {locadorRep}.<br />
                    <strong>Procurador:</strong> {locadorAttorney}.
                  </p>

                  <p className="pt-2">
                    <strong>LOCATÁRIO:</strong>
                  </p>
                  <p className="pl-4">
                    <strong>{client?.company_name?.toUpperCase() || "CLIENTE REGISTRADO"}</strong>,
                    com sede em {client?.billing_address || "Endereço Cadastrado"}, CEP: {client?.cep || "00000-000"},
                    inscrito no CNPJ sob o nº {client?.cnpj || "Sem CNPJ"}, e-mail: {client?.email || "cliente@email.com"}.<br />
                    <strong>Representante Legal:</strong> {locatarioRep}.
                  </p>
                </div>

                <div className="space-y-2">
                  <p>
                    <strong>EQUIPAMENTO(S) LOCADO(S):</strong>
                  </p>
                  <div className="pl-4 space-y-2">
                    {contract.proposal?.equipment_items?.map((item, idx) => (
                      <div key={item.id} className="border border-neutral-300 p-2 rounded text-[10px]">
                        <span className="font-bold">Item {idx + 1}: 01 (UM) {item.equipment_name}</span> - Categoria: {item.equipment_code}<br />
                        <span className="text-[9px] text-neutral-600">Descrição/Detalhamento: {item.equipment_name} para locação corporativa padrão.</span>
                      </div>
                    )) || (
                        <div className="border border-neutral-300 p-2 rounded text-[10px]">
                          <span className="font-bold">Equipamentos do Contrato</span><br />
                          <span className="text-[9px] text-neutral-600">Conforme listados na proposta comercial vinculada.</span>
                        </div>
                      )}
                  </div>
                </div>

                <div className="space-y-4">
                  <p>
                    <strong>Local da obra:</strong> {contract.proposal?.job_site_address || client?.billing_address || "Obra Indicada"}.
                  </p>
                  <p>
                    Pelo presente instrumento, de um lado, o <strong>LOCADOR</strong>, devidamente qualificado no preâmbulo e de outro, o <strong>LOCATÁRIO</strong>, também qualificado acima, celebram entre si o presente Contrato de Locação, que se regerá pelas seguintes cláusulas e condições:
                  </p>

                  <h3>CLÁUSULA PRIMEIRA - OBJETO</h3>
                  <p>
                    Constitui objeto do presente Contrato de Locação o(s) bem(ns) descrito(s) no preâmbulo acima, com suas respectivas características e acessórios indicados.
                  </p>

                  <h3>CLÁUSULA SEGUNDA - VALOR DO OBJETO</h3>
                  <p>
                    O valor total do(s) Módulo(s) / Equipamento(s) descrito(s) acima é de R$ {objectValue} (cada), para os casos de perda total, extravio, bem como acidentes com danos graves, de tal forma que inviabilize a recuperação econômica de suas características originais.
                  </p>

                  <h3>CLÁUSULA TERCEIRA - PREÇO, PRAZO E FORMA DE PAGAMENTO</h3>
                  <p>
                    3.1. O valor mensal da locação do(s) equipamento(s) é de: <strong>R$ {(contract.total_value / getLeaseDurationMonths()).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> por parcela.
                  </p>
                  <p>
                    3.2. A locação será por prazo determinado de <strong>{getLeaseDurationMonths()} meses</strong>, com início em {formatDateBRL(contract.start_date)} e término previsto para {formatDateBRL(contract.end_date)}.
                  </p>
                  <p>
                    3.3. Não será permitida a devolução do(s) módulo(s) / equipamento(s) antes do término do período previsto na cláusula anterior, salvo pela quitação do saldo remanescente de parcelas previstas até o limite do valor global contratado.
                  </p>
                  <p>
                    3.4. O <strong>LOCATÁRIO</strong> se obriga a pagar todos os aluguéis do período inicialmente previsto, mesmo em caso de devolução antecipada de parte ou da totalidade do(s) módulo(s)/equipamento(s).
                  </p>
                  <p>
                    3.5. Ao final do período estabelecido no item 3.2, este contrato se renovará a cada período de 30 (trinta) dias com preços ora acertados, sem correção monetária ou reajustes, independente de infação ou índices de reajustes praticados pelo mercado, podendo quaisquer das partes se manifestar pela não renovação em face de eventual desinteresse na continuação da locação, devendo a outra parte ser notificada com antecedência mínima de 15 (quinze) dias ao término do contrato.
                  </p>
                  <p>
                    3.6. A forma de pagamento será efetuada através de Boleto Bancário ou pagamento à vista (PIX ou TED), sendo:
                  </p>

                  <table>
                    <thead className="bg-neutral-100">
                      <tr>
                        <th>Parcela</th>
                        <th>Detalhamento Financeiro</th>
                        <th className="text-right">Data de Vencimento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {installments.map((inst) => (
                        <tr key={inst.num}>
                          <td className="font-bold">{inst.num}ª parcela</td>
                          <td>{inst.label}{inst.extra}</td>
                          <td className="text-right font-bold">{inst.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <p>
                    3.8. O não pagamento no vencimento de qualquer parcela acarretará multa de 2% (dois por cento) e juros de mora de 0,33% a.d. (três vírgula trinta e três por cento ao dia).
                  </p>
                  <p>
                    3.9. Não há incidência do I.S.S.Q.N., conforme Lei Complementar Federal nº 116/2003 e regulamentação municipal, por se tratar de locação de bens móveis pura. O <strong>LOCADOR</strong> dá ciência ao <strong>LOCATÁRIO</strong> de que este faturamento está de acordo com o Decreto nº 3000/99.
                  </p>

                  <h3>CLÁUSULA QUARTA - REAJUSTE</h3>
                  <p>
                    4.1. Para ajustar o preço à elevação dos custos dos insumos que ocorrer no período, será adotado o índice INCC acumulado a cada 12 (doze) meses da locação.
                  </p>
                  <p>
                    4.2. Caso venha ocorrer defasagem acentuada do preço, em função de alterações na política econômica governamental ou devido a longo tempo de locação decorrido, poderá ocorrer novo reajuste, mediante outra negociação, para ajustar o preço às condições normais de mercado.
                  </p>

                  <h3>CLÁUSULA QUINTA - MANUTENÇÃO E CONSERVAÇÃO DO BEM</h3>
                  <p>
                    5.1. Os equipamentos objetos desta locação estão sendo entregues em perfeitas condições de uso, limpos e revisados.
                  </p>
                  <p>
                    5.2. Vencido o contrato de locação, é de obrigação do <strong>LOCATÁRIO</strong> devolver o(s) Módulo(s) / Equipamento(s) em perfeitas condições de uso, ou seja, nas mesmas condições de quando o recebeu.
                  </p>
                  <p>
                    5.3. O(s) Módulo(s) / Equipamento(s) deverá(ão) estar limpo(s) para devolução, caso contrário será cobrado o valor de R$ 100,00 (cem reais) para limpeza de cada módulo.
                  </p>
                  <p>
                    5.4. O(s) equipamento(s) deverá(ão) ser inspecionado(s) pelo <strong>LOCATÁRIO</strong> ANTES da saída em aluguel, uma vez que o(s) mesmo(s) encontra(m)-se em perfeitas condições de uso, sem resíduos de concreto, sem nenhum tipo de rabiscos, sem avarias ou peças faltantes, neste ato assim aceito.
                  </p>
                  <p>
                    5.5. Ocorrendo avarias ao bem locado ou perda total, o <strong>LOCATÁRIO</strong> se obriga a indenizar o <strong>LOCADOR</strong> pelos gastos nos serviços necessários a reparar os danos causados ou indenizar o valor total do bem, ressalvados os advindos de caso fortuito e força maior, autorizando, ainda, o <strong>LOCADOR</strong> a emitir Ficha de Compensação Bancária cobrando o valor devido.
                  </p>
                  <p>
                    5.6. A indenização será calculada com base nos valores especificados no presente contrato na Cláusula Segunda.
                  </p>
                  <p>
                    5.7. Não serão devidas indenizações pelo <strong>LOCATÁRIO</strong> de reparo por desgaste natural do(s) módulo(s)/equipamento(s).
                  </p>
                  <p>
                    5.8. A manutenção e limpeza de filtros e aparelhos de ar condicionado serão de responsabilidade do <strong>LOCATÁRIO</strong> a partir de 03 (três) meses de locação ou, desde o início do Contrato, caso o equipamento esteja distante mais de 50 (cinquenta) Km do município de Fortaleza - Ceará.
                  </p>

                  <h3>CLÁUSULA SEXTA - FRETE E MONTAGEM</h3>
                  <p>
                    6.1. As despesas decorrentes com transporte de saída, bem como de devolução do(s) módulo(s) / equipamento(s), são por conta única e exclusiva do <strong>LOCATÁRIO</strong> (tomador), assim como seguro e a responsabilidade sobre equipamentos e terceiros durante a operação, não cabendo nenhum ônus ou responsabilidade ao <strong>LOCADOR</strong>.
                  </p>

                  <h3>CLÁUSULA SÉTIMA - RESPONSABILIDADE DO LOCATÁRIO</h3>
                  <p>
                    1) Autorizar a entrada dos funcionários da Contratada no canteiro. A não autorização da entrada del pessoal e/ou equipamentos no local de instalação da obra poderá ensejar a cobrança da hora parada e a postergação dos serviços para data futura;
                  </p>
                  <p>
                    2) Disponibilizar pavimento radier ou piso seco, compactado e nivelado, para instalação do(s) Módulo(s) / Equipamento(s). PROIBIDA DESCARGA EM AREIA;
                  </p>
                  <p>
                    3) Oferecer acesso livre e desimpedido para automóveis e caminhões do <strong>LOCADOR</strong> ou prepostos, até o local da instalação dos equipamentos;
                  </p>
                  <p>
                    4) Não sendo possível a entrada dos veículos do <strong>LOCADOR</strong> e/ou prepostos no local da instalação dos módulos, o <strong>LOCATÁRIO</strong> fica responsável pelo transporte dos equipamentos, ferramentas, materiais e pessoal da contratada;
                  </p>
                  <p>
                    5) Obtenção de licenças e alvarás; laudos ocupacionais e pagamento de taxas, junto a todos os órgãos competentes (Federal, Estadual e/ou Municipal).
                  </p>

                  <p className="font-bold pt-2">Instalações Elétricas:</p>
                  <ul>
                    <li>O <strong>LOCATÁRIO</strong> deve disponibilizar energia para realização da obra;</li>
                    <li>O canteiro de obra deverá ter SPDA (Sistema de Proteção de Descarga Atmosférica);</li>
                    <li>O <strong>LOCATÁRIO</strong> deve executar e fornecer toda a rede externa de energia até o Módulo Habitável;</li>
                    <li>Execução e ligação de rede de lógica, CFTV e telefone são de responsabilidade da contratante.</li>
                  </ul>

                  <p className="font-bold pt-2">Instalações Hidráulicas:</p>
                  <ul>
                    <li>Execução de Fossas, ligação de água e saneamento são de encargo do cliente;</li>
                    <li>Execução de caixa d'água, cisterna e/ou reservatório se necessários;</li>
                    <li>Execução de ligação de esgoto até a rede pública ou fossas adequadas.</li>
                  </ul>

                  <p className="font-bold pt-2">Mobilização e Mão de Obra:</p>
                  <p className="pl-4">
                    a) Informar ao <strong>LOCADOR</strong>, com a devida antecedência, as exigências (documentação, exames, etc.) para que o pessoal e preposto da contratada ingressem no local onde se dará a instalação do(s) Módulo(s).
                  </p>
                  <p className="pl-4">
                    b) Todos os custos decorrentes da habilitação dos veículos, funcionários e prepostos do <strong>LOCADOR</strong> para ingressar no local onde será feita a instalação dos módulos deverão ser suportados pela Contratante.
                  </p>

                  <h3>CLÁUSULA OITAVA - RESPONSABILIDADE DA LOCADORA</h3>
                  <p>
                    1) Fornecimento dos módulos habitáveis em perfeitas condições de uso e de funcionamento;
                  </p>
                  <p>
                    2) A utilização de mão de obra de terceiros para a movimentação ou acoplagem e desacoplagem do módulo cancela a garantia e toda e qualquer manutenção, correrá por conta do <strong>LOCATÁRIO</strong>.
                  </p>

                  <h3>CLÁUSULA NONA - INADIMPLÊNCIA</h3>
                  <p>
                    9.1. Em havendo atraso nos pagamentos ou a não observância das cláusulas deste Contrato, o locatário autoriza o <strong>LOCADOR</strong> a retirar, sem embaraços, os bens ora locados. Eventuais custos decorrentes do inadimplemento serão cobrados junto ao <strong>LOCATÁRIO</strong>, bem como despesas com a desmobilização (frete), conforme estabelecido neste Contrato.
                  </p>

                  <h3>CLÁUSULA DÉCIMA - OBSERVAÇÕES</h3>
                  <p>
                    10.1. Informamos que só serão aceitos pedidos de coleta do(s) Módulo(s) / Equipamento(s) através de e-mail e com 02 (dois) dias úteis de antecedência mínima.
                  </p>
                  <p>
                    10.2. Em caso de desistência da locação por parte do <strong>LOCATÁRIO</strong>, após este ter solicitado a reserva do bem, haverá cobrança equivalente ao previsto na Cláusula Terceira item 3.4, bem como os fretes de mobilização e/ou desmobilização, se houver(em).
                  </p>
                  <p>
                    10.3. Fica expressamente proibida a sublocação, empréstimo ou cessão dos módulos habitáveis objeto deste contrato para uso de terceiros, ainda que gratuitamente, implicando no imediato cancelamento do mesmo.
                  </p>

                  <h3>CLÁUSULA DÉCIMA PRIMEIRA - QUANTO AO DIREITO DE PROPRIEDADE</h3>
                  <p>
                    11.1. Quanto ao direito de propriedade, fica preestabelecido de comum acordo que os Órgãos Municipais, Estaduais e Federais, renunciam ao direito de declarar os módulos habitáveis e as mobílias como de Direito de Utilidade Pública.
                  </p>
                  <p>
                    11.2. O <strong>LOCATÁRIO</strong> reconhece e aceita que o <strong>LOCADOR</strong> é proprietário e/ou detentor dos direitos de uso do(s) módulo(s) habitável(is), não podendo o(s) mesmo(s) ser(em) oferecido(s) pelo <strong>LOCATÁRIO</strong> como garantia de suas dívidas ou a penhora, bem como não poderá permitir quaisquer ônus sobre os mesmos, sob pena de responder judicialmente por todas as despesas incorridas pelo <strong>LOCADOR</strong>, decorrentes de tais situações.
                  </p>

                  <h3>CLÁUSULA DÉCIMA SEGUNDA - FORO</h3>
                  <p>
                    Para dirimir toda e qualquer controvérsia oriunda do presente Contrato de Locação, para os quais as partes não se louvem em solução amigável, fica eleito o Foro da Cidade de {forumCity}, com renúncia expressa a qualquer outro por mais privilegiado que seja.
                  </p>
                  <p className="pt-2 text-center font-bold">
                    Por estarem acordados com as condições acima estipuladas, assinam o presente contrato de locação em 02 (duas) vias de igual teor e forma.
                  </p>
                  <p className="text-center pt-2 font-bold">
                    {forumCity.split("(")[0].trim()}, {formatDateBRL(contractDate)}.
                  </p>
                </div>

                {/* Signatures block */}
                <div className="signature-block grid grid-cols-2 gap-8 pt-8">
                  <div className="space-y-6">
                    <div className="border-t border-neutral-800 pt-2 text-center font-bold text-[9px]">
                      {client?.company_name?.toUpperCase() || "LOCATÁRIO (CLIENTE)"}<br />
                      <span className="font-normal text-neutral-600">Representante Legal</span>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="border-t border-neutral-800 pt-2 text-center font-bold text-[9px]">
                      {organization.name.toUpperCase()}<br />
                      <span className="font-normal text-neutral-600">Locador</span>
                    </div>
                  </div>
                </div>

                {/* Witnesses block */}
                <div className="witness-block pt-8 text-[9px]">
                  <p className="font-bold mb-4">Testemunhas:</p>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="border-t border-neutral-800 pt-2 space-y-1">
                      <p>Nome:</p>
                      <p>CPF nº:</p>
                    </div>
                    <div className="border-t border-neutral-800 pt-2 space-y-1">
                      <p>Nome:</p>
                      <p>CPF nº:</p>
                    </div>
                  </div>
                </div>

                {/* Footer (Hidden dynamically during print) */}
                <div id="contract-html-footer" className="border-t border-neutral-300 pt-4 mt-8 text-center text-[8px] text-neutral-500 font-bold uppercase tracking-wider">
                  {formatAddress(organization)} — Fone: {organization.phone || "(85) 3034 3519"} — {organization.email}
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
