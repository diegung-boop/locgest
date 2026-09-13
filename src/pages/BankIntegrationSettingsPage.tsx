import React, { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { TenantBankIntegration, BankConnectivityResult } from "@/types/locgest";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { BankIntegrationService } from "@/services/bankIntegrationService";
import { 
  Building2, 
  KeyRound, 
  ShieldCheck, 
  FileCode2, 
  Save, 
  Loader2, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Upload,
  Sparkles,
  Lock,
  Activity,
  Radio,
  Wifi,
  Clock
} from "lucide-react";
import { toast } from "sonner";

export const BankIntegrationSettingsPage: React.FC = () => {
  const { organization } = useTenant();

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Estado do Diagnóstico de Conectividade
  const [isTestingConnectivity, setIsTestingConnectivity] = useState(false);
  const [connectivityResult, setConnectivityResult] = useState<BankConnectivityResult | null>(null);

  const [formData, setFormData] = useState<TenantBankIntegration>({
    id: crypto.randomUUID(),
    organization_id: organization.id,
    bank_provider: "banco_inter",
    environment: "sandbox",
    client_id: "",
    client_secret: "",
    account_number: "",
    certificate_crt_content: "",
    certificate_key_content: "",
    certificate_crt_filename: "",
    certificate_key_filename: "",
    pix_key: "",
    webhook_url: "",
    is_active: true,
  });

  const handleTestConnectivity = async () => {
    try {
      setIsTestingConnectivity(true);
      const result = await BankIntegrationService.testConnectivity(formData.environment, formData);
      setConnectivityResult(result);
      if (result.reachable) {
        toast.success(`Conexão com a API do Banco Inter (${result.environment}) validada com sucesso!`);
      } else {
        toast.error(`Falha na verificação de conectividade: ${result.message}`);
      }
    } catch (err: any) {
      toast.error("Erro inesperado ao executar teste de conectividade.");
    } finally {
      setIsTestingConnectivity(false);
    }
  };

  useEffect(() => {
    const loadIntegration = async () => {
      try {
        setLoading(true);
        const existing = await SupabaseDataService.getBankIntegration(organization.id);
        if (existing) {
          setFormData(existing);
        } else {
          setFormData({
            id: crypto.randomUUID(),
            organization_id: organization.id,
            bank_provider: "banco_inter",
            environment: "sandbox",
            client_id: "",
            client_secret: "",
            account_number: "",
            certificate_crt_content: "",
            certificate_key_content: "",
            certificate_crt_filename: "",
            certificate_key_filename: "",
            pix_key: "",
            webhook_url: "",
            is_active: true,
          });
        }
      } catch (err) {
        console.error("Erro ao carregar credenciais bancárias:", err);
      } finally {
        setLoading(false);
      }
    };

    loadIntegration();
  }, [organization.id]);

  const handleCertificateUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "crt" | "key"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (type === "crt") {
        setFormData((prev) => ({
          ...prev,
          certificate_crt_content: content,
          certificate_crt_filename: file.name,
        }));
        toast.success(`Certificado público (${file.name}) carregado!`);
      } else {
        setFormData((prev) => ({
          ...prev,
          certificate_key_content: content,
          certificate_key_filename: file.name,
        }));
        toast.success(`Chave privada (${file.name}) carregada!`);
      }
    };
    reader.readAsText(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await SupabaseDataService.saveBankIntegration({
        ...formData,
        organization_id: organization.id,
      });
      toast.success("Credenciais do Banco Inter salvas com sucesso para esta empresa!");
    } catch (err) {
      console.error("Erro ao salvar credenciais:", err);
      toast.error("Falha ao salvar as credenciais bancárias.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-tenant" />
        <p className="text-xs">Carregando credenciais bancárias da empresa...</p>
      </div>
    );
  }

  const isFullyConfigured =
    formData.client_id.trim().length > 0 &&
    formData.client_secret.trim().length > 0 &&
    Boolean(formData.certificate_crt_content) &&
    Boolean(formData.certificate_key_content);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-card border border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-tenant/20 text-tenant border border-tenant/30">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Integração Bancária (Banco Inter)
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure as chaves e certificados de API para emissão automatizada de boletos e Pix híbrido da empresa <strong className="text-tenant">{organization.name}</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
            isFullyConfigured
              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              : "bg-amber-500/20 text-amber-400 border-amber-500/30"
          }`}>
            {isFullyConfigured ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> Pronto para Emissão Real
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4" /> Configuração Pendente / Simulação
              </>
            )}
          </span>
        </div>
      </div>

      {/* Card de Diagnóstico Técnico de Conectividade (SEM CREDS) */}
      <div className="p-5 rounded-2xl glass-card border border-white/10 bg-slate-900/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                Diagnóstico de Conectividade com a API
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white/70 border border-white/10">
                  Sem Autenticação Requerida
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Verifica se o servidor e a infraestrutura do Banco Inter ({formData.environment.toUpperCase()}) estão alcançáveis via DNS/HTTPS.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestConnectivity}
            disabled={isTestingConnectivity}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md shadow-sky-600/20 flex items-center justify-center gap-2 shrink-0"
          >
            {isTestingConnectivity ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Testando conexão...
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5" /> Testar Conectividade
              </>
            )}
          </button>
        </div>

        {/* Exibição do Resultado do Teste */}
        {connectivityResult && (
          <div className={`p-4 rounded-xl border text-xs space-y-2.5 animate-in fade-in duration-150 ${
            connectivityResult.reachable
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                {connectivityResult.reachable ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                )}
                <span>
                  Banco Inter: {connectivityResult.reachable ? "API Alcançável" : "Falha de Conectividade"}
                </span>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-white/70">
                <span>Ambiente: <strong className="text-white uppercase">{connectivityResult.environment}</strong></span>
                <span>•</span>
                <span>Autenticação: <strong className="text-amber-400">Não configurada</strong></span>
                {connectivityResult.httpStatus && (
                  <>
                    <span>•</span>
                    <span>Status HTTP: <strong className="text-white">{connectivityResult.httpStatus}</strong></span>
                  </>
                )}
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {connectivityResult.responseTimeMs} ms
                </span>
              </div>
            </div>

            <p className="text-xs text-white/80">
              {connectivityResult.message}
            </p>

            <div className="text-[11px] text-white/50 font-mono break-all pt-1">
              Endpoint testado: {connectivityResult.endpointTested}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. Ambiente e Conta */}
        <div className="p-6 rounded-2xl glass-card border border-white/10 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Building2 className="w-4 h-4 text-tenant" />
              <span>Ambiente & Conta Corrente PJ</span>
            </div>
            
            {/* Seletor Sandbox vs Produção */}
            <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setFormData((p) => ({ ...p, environment: "sandbox" }))}
                className={`px-3 py-1 rounded-lg transition-all ${
                  formData.environment === "sandbox"
                    ? "bg-tenant text-white font-bold"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Sandbox (Testes)
              </button>
              <button
                type="button"
                onClick={() => setFormData((p) => ({ ...p, environment: "production" }))}
                className={`px-3 py-1 rounded-lg transition-all ${
                  formData.environment === "production"
                    ? "bg-emerald-600 text-white font-bold"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Produção Oficial
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                Número da Conta Corrente Inter (PJ) *
              </label>
              <input
                type="text"
                value={formData.account_number || ""}
                onChange={(e) => setFormData((p) => ({ ...p, account_number: e.target.value }))}
                placeholder="Ex: 12345678-9 (sem pontos)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-white/15 text-sm text-white focus:outline-none focus:border-tenant font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Número da conta PJ associada à aplicação de cobrança no Internet Banking.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                Chave Pix Cadastrada (Opcional)
              </label>
              <input
                type="text"
                value={formData.pix_key || ""}
                onChange={(e) => setFormData((p) => ({ ...p, pix_key: e.target.value }))}
                placeholder="CNPJ, E-mail, Telefone ou Chave Aleatória"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-white/15 text-sm text-white focus:outline-none focus:border-tenant"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Chave Pix da conta Inter para identificação nos boletos híbridos.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Chaves OAuth2 (Client ID & Client Secret) */}
        <div className="p-6 rounded-2xl glass-card border border-white/10 space-y-5">
          <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/10 pb-4">
            <Lock className="w-4 h-4 text-tenant" />
            <span>Credenciais de Aplicação (OAuth2)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                Client ID *
              </label>
              <input
                type="text"
                value={formData.client_id}
                onChange={(e) => setFormData((p) => ({ ...p, client_id: e.target.value }))}
                placeholder="Ex: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-white/15 text-sm text-white focus:outline-none focus:border-tenant font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-white/80">
                  Client Secret *
                </label>
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-[11px] text-tenant hover:underline flex items-center gap-1"
                >
                  {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showSecret ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <input
                type={showSecret ? "text" : "password"}
                value={formData.client_secret}
                onChange={(e) => setFormData((p) => ({ ...p, client_secret: e.target.value }))}
                placeholder="Ex: 8f72a6b2-..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-white/15 text-sm text-white focus:outline-none focus:border-tenant font-mono"
              />
            </div>
          </div>
        </div>

        {/* 3. Certificados Digitais mTLS (.crt e .key) */}
        <div className="p-6 rounded-2xl glass-card border border-white/10 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <ShieldCheck className="w-4 h-4 text-tenant" />
              <span>Certificados Digitais de Segurança (mTLS)</span>
            </div>
            <a
              href="https://developers.inter.co"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-tenant hover:underline flex items-center gap-1"
            >
              Documentação Inter <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <p className="text-xs text-muted-foreground">
            O Banco Inter exige autenticação mútua (mTLS). Faça o upload do arquivo público <strong>.crt</strong> e da chave privada <strong>.key</strong> obtidos no portal do desenvolvedor do Inter.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Certificado .crt */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <FileCode2 className="w-4 h-4 text-amber-400" /> Certificado Público (.crt)
                </span>
                {formData.certificate_crt_content && (
                  <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Carregado
                  </span>
                )}
              </div>

              <div className="text-xs text-muted-foreground truncate">
                {formData.certificate_crt_filename || "Nenhum arquivo .crt selecionado"}
              </div>

              <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10 transition-colors">
                <Upload className="w-3.5 h-3.5 text-tenant" /> Selecionar arquivo .crt
                <input
                  type="file"
                  accept=".crt,.cer,.pem"
                  onChange={(e) => handleCertificateUpload(e, "crt")}
                  className="hidden"
                />
              </label>
            </div>

            {/* Chave Privada .key */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <FileCode2 className="w-4 h-4 text-rose-400" /> Chave Privada RSA (.key)
                </span>
                {formData.certificate_key_content && (
                  <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Carregada
                  </span>
                )}
              </div>

              <div className="text-xs text-muted-foreground truncate">
                {formData.certificate_key_filename || "Nenhum arquivo .key selecionado"}
              </div>

              <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10 transition-colors">
                <Upload className="w-3.5 h-3.5 text-tenant" /> Selecionar arquivo .key
                <input
                  type="file"
                  accept=".key,.pem"
                  onChange={(e) => handleCertificateUpload(e, "key")}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Action Save Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 rounded-2xl bg-tenant hover:opacity-90 text-white font-bold text-sm shadow-lg shadow-tenant/20 transition-all flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Salvar Credenciais Bancárias
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
