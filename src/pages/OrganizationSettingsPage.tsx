import React, { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Organization } from "@/types/locgest";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { StorageService } from "@/services/storageService";
import { 
  Building2, 
  Upload, 
  Sparkles, 
  Loader2, 
  Eye, 
  Image as ImageIcon,
  Sliders,
  Save,
  Trash2
} from "lucide-react";
import { toast } from "sonner";

export const OrganizationSettingsPage: React.FC = () => {
  const { organization, refreshOrganization } = useTenant();

  const [formData, setFormData] = useState<Organization>({ ...organization });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingWatermark, setIsUploadingWatermark] = useState(false);
  const [activeTab, setActiveTab] = useState<"letterhead" | "general">("letterhead");

  useEffect(() => {
    setFormData({ ...organization });
  }, [organization]);

  const handleChange = (field: keyof Organization, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (
    file: File,
    targetField: "logo_url" | "letterhead_watermark_url",
    setLoadingState: (v: boolean) => void
  ) => {
    try {
      setLoadingState(true);
      const url = await StorageService.uploadImage(file, "equipment-images", organization.id);
      handleChange(targetField, url);
      toast.success("Imagem atualizada com sucesso!");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Erro ao processar imagem.");
    } finally {
      setLoadingState(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await SupabaseDataService.saveOrganization(formData);
      await refreshOrganization();
      toast.success("Configurações salvas com sucesso!");
    } catch (err) {
      console.error("Save org error:", err);
      toast.error("Erro ao salvar configurações.");
    } finally {
      setIsSaving(false);
    }
  };

  const formatAddressLine = (org: Partial<Organization>) => {
    const parts = [org.address_st, org.address_number, org.address_neighborhood].filter(Boolean);
    const cityState = [org.address_city, org.address_estate].filter(Boolean).join("/");
    if (cityState) parts.push(cityState);
    const line = parts.join(", ");
    return org.address_zipcode ? `${line}${line ? " - " : ""}CEP: ${org.address_zipcode}` : line;
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-card border border-white/10">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-tenant" /> Logotipo & Marca-d'Água dos Documentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure a marca-d'água de fundo e a logo oficial da sua empresa para utilização nos documentos e PDFs.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-slate-900/80 border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab("letterhead")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "letterhead"
                ? "bg-tenant text-white shadow-lg shadow-tenant/20"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            <Sparkles className="w-4 h-4" /> Logo & Marca-d'Água
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "general"
                ? "bg-tenant text-white shadow-lg shadow-tenant/20"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            <Building2 className="w-4 h-4" /> Cadastro da Empresa
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Settings Panel */}
        <div className="lg:col-span-7 space-y-6">
          {activeTab === "letterhead" && (
            <div className="space-y-6">
              {/* Toggle Card */}
              <div className="p-5 rounded-2xl glass-card border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-tenant/10 border border-tenant/20 text-tenant">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Marca-d'Água e Identidade nos Documentos</h3>
                      <p className="text-xs text-muted-foreground">
                        Exibe a marca-d'água no fundo das folhas A4 impressas e exportadas.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.letterhead_enabled !== false}
                      onChange={(e) => handleChange("letterhead_enabled", e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-tenant"></div>
                  </label>
                </div>
              </div>

              {/* Company Logo Section */}
              <div className="p-6 rounded-2xl glass-card border border-white/10 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-tenant" />
                    <h3 className="text-sm font-bold text-white">Logotipo Oficial da Empresa</h3>
                  </div>
                  <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-md">
                    Tamanho Padrão nos Documentos: 130px
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    {formData.logo_url ? (
                      <div className="relative p-2 bg-slate-900 border border-white/10 rounded-xl flex items-center justify-center min-w-[120px] h-[75px]">
                        <img
                          src={formData.logo_url}
                          alt="Logo da Empresa"
                          className="max-h-[60px] max-w-[110px] object-contain"
                        />
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-950 border border-dashed border-white/10 rounded-xl text-center text-xs text-muted-foreground min-w-[120px] h-[75px] flex items-center justify-center">
                        Nenhuma logo
                      </div>
                    )}

                    <div className="flex-1 space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, "logo_url", setIsUploadingLogo);
                        }}
                        className="hidden"
                        id="upload-logo-input"
                      />
                      <div className="flex items-center gap-3">
                        <label
                          htmlFor="upload-logo-input"
                          className="py-2.5 px-4 rounded-xl border border-dashed border-white/20 hover:border-tenant hover:bg-tenant/5 text-xs text-white font-medium flex items-center gap-2 cursor-pointer transition-all"
                        >
                          {isUploadingLogo ? (
                            <Loader2 className="w-4 h-4 animate-spin text-tenant" />
                          ) : (
                            <Upload className="w-4 h-4 text-tenant" />
                          )}
                          <span>{formData.logo_url ? "Substituir Logo" : "Upload da Logo (PNG/JPEG)"}</span>
                        </label>

                        {formData.logo_url && (
                          <button
                            type="button"
                            onClick={() => handleChange("logo_url", null)}
                            className="p-2.5 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs flex items-center gap-1.5 transition-all"
                            title="Remover Logo"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remover
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        A logo será exibida no cabeçalho com altura fixada em 130px.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Watermark Section */}
              <div className="p-6 rounded-2xl glass-card border border-white/10 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-tenant" />
                    <h3 className="text-sm font-bold text-white">Marca-d'Água de Fundo</h3>
                  </div>
                  <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-md">
                    Exibida no centro do papel A4
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                        Imagem da Marca-d'Água (PNG Transparente Recomendado)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, "letterhead_watermark_url", setIsUploadingWatermark);
                        }}
                        className="hidden"
                        id="upload-watermark-input"
                      />
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="upload-watermark-input"
                          className="w-full py-3 px-4 rounded-xl border border-dashed border-white/20 hover:border-tenant hover:bg-tenant/5 text-xs text-white font-medium flex items-center justify-center gap-2 cursor-pointer transition-all"
                        >
                          {isUploadingWatermark ? (
                            <Loader2 className="w-4 h-4 animate-spin text-tenant" />
                          ) : (
                            <Upload className="w-4 h-4 text-tenant" />
                          )}
                          <span>{formData.letterhead_watermark_url ? "Substituir Marca-d'Água" : "Fazer Upload de Marca-d'Água (PNG)"}</span>
                        </label>

                        {formData.letterhead_watermark_url && (
                          <button
                            type="button"
                            onClick={() => handleChange("letterhead_watermark_url", null)}
                            className="p-3 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs transition-all shrink-0"
                            title="Remover Marca-d'Água"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-tenant" /> Transparência / Opacidade
                        </label>
                        <span className="text-xs font-extrabold text-tenant">
                          {Math.round((formData.letterhead_watermark_opacity ?? 0.10) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.02"
                        max="0.30"
                        step="0.01"
                        value={formData.letterhead_watermark_opacity ?? 0.10}
                        onChange={(e) => handleChange("letterhead_watermark_opacity", parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-tenant"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "general" && (
            <div className="p-6 rounded-2xl glass-card border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-white/10 pb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-tenant" /> Dados Cadastrais da Empresa (Tenant)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Razão Social *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ""}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-tenant"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Nome Fantasia</label>
                  <input
                    type="text"
                    value={formData.trade_name || ""}
                    onChange={(e) => handleChange("trade_name", e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-tenant"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">CNPJ</label>
                  <input
                    type="text"
                    value={formData.cnpj || ""}
                    onChange={(e) => handleChange("cnpj", e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-tenant"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Inscrição Estadual (IE)</label>
                  <input
                    type="text"
                    value={formData.ie || ""}
                    onChange={(e) => handleChange("ie", e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-tenant"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Telefone Principal</label>
                  <input
                    type="text"
                    value={formData.phone || ""}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="(85) 3034-3519"
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-tenant"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">E-mail Institucional</label>
                  <input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="contato@empresa.com"
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-tenant"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-3 rounded-xl bg-tenant text-white font-bold text-xs shadow-lg shadow-tenant/20 hover:opacity-90 transition-all flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Salvar Alterações</span>
            </button>
          </div>
        </div>

        {/* Right Side: Real-Time Live A4 Letterhead Preview */}
        <div className="lg:col-span-5 space-y-3 sticky top-6">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-tenant" /> Pré-visualização A4 em Tempo Real
            </h3>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold border border-emerald-500/20">
              Live Preview
            </span>
          </div>

          {/* A4 Paper Container */}
          <div className="bg-white text-black rounded-lg shadow-2xl p-6 min-h-[580px] flex flex-col justify-between relative overflow-hidden text-[9px] font-serif border border-neutral-300">
            {/* Background Watermark */}
            {formData.letterhead_enabled !== false && formData.letterhead_watermark_url && (
              <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none w-full flex items-center justify-center p-8 z-0"
                style={{ opacity: formData.letterhead_watermark_opacity ?? 0.10 }}
              >
                <img
                  src={formData.letterhead_watermark_url}
                  alt="Marca d'Água"
                  className="max-w-[65%] max-h-[45%] object-contain"
                />
              </div>
            )}

            {/* Header Area */}
            <div className="relative z-10 space-y-2 border-b border-neutral-300 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-xs uppercase tracking-wider text-neutral-800">
                    {formData.name || "SUA EMPRESA LTDA"}
                  </h2>
                  <p className="text-[8px] text-neutral-500 italic">
                    Plataforma de Gestão de Locações & Equipamentos
                  </p>
                </div>
                {formData.logo_url && (
                  <img
                    src={formData.logo_url}
                    alt="Logo"
                    className="object-contain max-h-[65px] max-w-[160px]"
                  />
                )}
              </div>
            </div>

            {/* Document Body Sample Mock */}
            <div className="relative z-10 my-auto space-y-3 py-4 text-neutral-700">
              <div className="text-center font-bold text-[10px] uppercase text-neutral-900 border-b border-neutral-200 pb-1">
                CONTRATO DE LOCAÇÃO DE BENS MÓVEIS Nº C-2026/001
              </div>

              <p className="leading-relaxed text-[8.5px]">
                Pelo presente instrumento particular, de um lado <strong>{formData.name || "LOCADORA"}</strong>, CNPJ {formData.cnpj || "00.000.000/0001-00"}, doravante denominada LOCADORA, e de outro lado o LOCATÁRIO devidamente qualificado no sistema...
              </p>

              <div className="border border-neutral-200 rounded p-2 bg-neutral-50/50 text-[8px] space-y-1">
                <div className="font-bold text-neutral-800">CLÁUSULA PRIMEIRA - DO OBJETO:</div>
                <p>1.1. O presente contrato tem por objeto a locação de módulo(s) habitável(is) e equipamentos listados na proposta comercial vinculada.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 text-[7.5px] text-center">
                <div className="border-t border-neutral-400 pt-1 font-bold">
                  {formData.name || "LOCADORA"}
                </div>
                <div className="border-t border-neutral-400 pt-1 font-bold">
                  LOCATÁRIO (CLIENTE)
                </div>
              </div>
            </div>

            {/* Footer Area */}
            <div className="relative z-10 border-t border-neutral-300 pt-2 text-center text-[7.5px] text-neutral-500 font-bold uppercase tracking-wider">
              <p>
                {formatAddressLine(formData).toUpperCase() ||
                  "ENDEREÇO DA EMPRESA — TELEFONE — E-MAIL"}
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
