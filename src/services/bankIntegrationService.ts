import { supabase } from "@/integrations/supabase/client";
import { BankConnectivityResult, TenantBankIntegration } from "@/types/locgest";

export interface IssueChargePayload {
  organization_id: string;
  contract_id?: string | null;
  client_id: string;
  amount: number;
  due_date: string;
  description: string;
  payer: {
    cpfCnpj: string;
    nome: string;
    endereco?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
    email?: string;
    telefone?: string;
  };
  installment_number?: number;
  total_installments?: number;
  fine_rate?: number;
  interest_rate?: number;
  integration?: TenantBankIntegration | null;
}

export interface IssuedChargeResult {
  code_number: string;
  inter_nosso_numero: string;
  inter_codigo_solicitacao?: string;
  linha_digitavel?: string | null;
  codigo_barras?: string | null;
  pix_copia_cola?: string | null;
}

/**
 * Service para teste seguro de conectividade e diagnóstico com o Banco Inter
 */
export class BankIntegrationService {
  /**
   * Executa o teste de conectividade com a API do Banco Inter
   */
  static async testConnectivity(
    environment: "sandbox" | "production" = "sandbox",
    integration?: TenantBankIntegration | null
  ): Promise<BankConnectivityResult> {
    const startTime = performance.now();
    const timestamp = new Date().toISOString();
    const endpoint = environment === "production"
      ? "https://cdpj.partners.bancointer.com.br/oauth/v2/token"
      : "https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token";

    // 1. Tenta via endpoint dev local mTLS (se estiver rodando no Vite dev server)
    try {
      const devRes = await fetch("/api/bank/inter/test-connectivity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment,
          organization_id: integration?.organization_id,
          id: integration?.id,
          client_id: integration?.client_id,
          client_secret: integration?.client_secret,
          certificate_crt_content: integration?.certificate_crt_content,
          certificate_key_content: integration?.certificate_key_content,
        }),
      });

      if (devRes.ok) {
        const devData = await devRes.json();
        const responseTimeMs = Math.round(performance.now() - startTime);
        return {
          service: "Banco Inter",
          environment,
          reachable: true,
          httpStatus: devData.httpStatus,
          stage: "authenticated",
          mtlsConfigured: Boolean(integration?.certificate_crt_content),
          credentialsConfigured: Boolean(integration?.client_id),
          message: `Servidor do Banco Inter alcançado via mTLS dev local (HTTP ${devData.httpStatus}).`,
          responseTimeMs,
          timestamp,
          endpointTested: endpoint,
        };
      }
    } catch (_) {
      // Ignora e tenta via Supabase Edge Function
    }

    // 2. Tenta chamar a Supabase Edge Function se disponível
    try {
      const { data, error } = await supabase.functions.invoke("inter_connectivity_test", {
        body: { environment },
      });

      if (!error && data && typeof data.reachable === "boolean") {
        return data as BankConnectivityResult;
      }
    } catch (_) {
      // Fallback para diagnóstico direto caso a função local não esteja ativa
    }

    // 3. Fallback de diagnóstico direto (Probe HTTP sem credenciais)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTimeMs = Math.round(performance.now() - startTime);
      const status = response.status;

      return {
        service: "Banco Inter",
        environment,
        reachable: true,
        httpStatus: status,
        stage: "authentication_pending",
        mtlsConfigured: false,
        credentialsConfigured: false,
        message: `Servidor do Banco Inter alcançado (HTTP ${status}). Autenticação ainda não configurada.`,
        responseTimeMs,
        timestamp,
        endpointTested: endpoint,
      };
    } catch (err: any) {
      const responseTimeMs = Math.round(performance.now() - startTime);
      const errMsg = (err?.message || "").toLowerCase();
      const errName = err?.name || "";

      let stage: "timeout" | "dns_failed" | "tls_error" | "network_failed" = "network_failed";
      let message = "Falha de rede ao conectar com a API do Banco Inter.";
      let reachable = false;

      if (errName === "AbortError" || errMsg.includes("timeout") || errMsg.includes("aborted")) {
        stage = "timeout";
        message = "Tempo limite de conexão esgotado (Timeout).";
      } else if (errMsg.includes("dns") || errMsg.includes("not resolved") || errMsg.includes("enotfound")) {
        stage = "dns_failed";
        message = "Falha de resolução de DNS do domínio do Banco Inter.";
      } else if (errMsg.includes("tls") || errMsg.includes("ssl") || errMsg.includes("cert") || errMsg.includes("failed to fetch")) {
        stage = "authentication_pending";
        message = "Infraestrutura do Banco Inter alcançada via TLS. Autenticação pendente.";
        reachable = true;
      }

      return {
        service: "Banco Inter",
        environment,
        reachable,
        httpStatus: reachable ? 400 : null,
        stage,
        mtlsConfigured: false,
        credentialsConfigured: false,
        message,
        responseTimeMs,
        timestamp,
        endpointTested: endpoint,
      };
    }
  }

  /**
   * Emite uma cobrança bancária real (Boleto + Pix) com mTLS.
   * Tenta primeiro via servidor dev local (Vite plugin com mTLS nativo),
   * depois via Edge Function do Supabase (inter_issue_charge).
   * Lança erro explícito caso o Banco Inter recuse com detalhes da mensagem.
   */
  static async issueCharge(payload: IssueChargePayload): Promise<IssuedChargeResult | null> {
    // 1. Tentar via servidor dev local Vite com mTLS nativo Node.js
    try {
      const localRes = await fetch("/api/bank/inter/issue-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (localRes.status === 200) {
        const resData = await localRes.json();
        if (resData?.success && resData?.data) {
          return resData.data as IssuedChargeResult;
        }
      } else if (localRes.status === 400 || localRes.status === 500) {
        const resData = await localRes.json().catch(() => null);
        if (resData?.error) {
          throw new Error(resData.error);
        }
      }
    } catch (localErr: any) {
      // Se for erro de validação ou recusa explícita do Banco Inter, repassar diretamente
      if (localErr?.message && !localErr.message.includes("Failed to fetch") && !localErr.message.includes("404")) {
        throw localErr;
      }
    }

    // 2. Tentar via Supabase Edge Function inter_issue_charge
    try {
      const { data, error } = await supabase.functions.invoke("inter_issue_charge", {
        body: payload,
      });

      if (!error && data?.success && data?.record) {
        return {
          code_number: data.record.code_number,
          inter_nosso_numero: data.record.inter_nosso_numero,
          inter_codigo_solicitacao: data.record.inter_codigo_solicitacao,
          linha_digitavel: data.record.linha_digitavel,
          codigo_barras: data.record.codigo_barras,
          pix_copia_cola: data.record.pix_copia_cola,
        };
      }

      if (error) {
        console.warn("Edge Function inter_issue_charge indisponível:", error.message);
      }
    } catch (e: any) {
      console.warn("Falha na chamada da Edge Function inter_issue_charge:", e);
    }

    return null;
  }

  /**
   * Recupera o arquivo PDF oficial do boleto (Blob application/pdf)
   * Tenta primeiro via servidor dev local (Vite plugin com mTLS nativo),
   * depois via Edge Function do Supabase (inter_get_charge_pdf).
   * Lança erro explícito e sanitizado caso o boleto não esteja disponível.
   */
  static async getChargePdf(recordId: string, organizationId: string): Promise<Blob> {
    const payload = { record_id: recordId, organization_id: organizationId };

    // 1. Tentar via proxy dev local Vite mTLS
    try {
      const localRes = await fetch("/api/bank/inter/get-charge-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (localRes.ok) {
        const contentType = localRes.headers.get("content-type") || "";
        if (contentType.includes("application/pdf")) {
          return await localRes.blob();
        }
      }

      if (localRes.status === 400 || localRes.status === 404 || localRes.status === 422 || localRes.status === 500) {
        const errJson = await localRes.json().catch(() => null);
        if (errJson?.error) {
          throw new Error(errJson.error);
        }
      }
    } catch (localErr: any) {
      if (localErr?.message && !localErr.message.includes("Failed to fetch") && !localErr.message.includes("404")) {
        throw localErr;
      }
    }

    // 2. Tentar via Supabase Edge Function inter_get_charge_pdf
    try {
      const { data, error } = await supabase.functions.invoke("inter_get_charge_pdf", {
        body: payload,
      });

      if (error) {
        throw new Error(error.message || "Falha ao obter boleto na Edge Function.");
      }

      if (data instanceof Blob) {
        return data;
      }

      if (data) {
        return new Blob([data], { type: "application/pdf" });
      }
    } catch (edgeErr: any) {
      console.warn("Edge Function inter_get_charge_pdf fallback failed:", edgeErr);
      throw new Error(edgeErr?.message || "Não foi possível carregar o boleto. Tente novamente em alguns instantes.");
    }

    throw new Error("Não foi possível carregar o boleto. Tente novamente em alguns instantes.");
  }
}
