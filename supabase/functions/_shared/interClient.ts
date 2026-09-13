import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface InterConfig {
  organizationId: string;
  bankIntegrationId: string;
  environment: "sandbox" | "production";
  clientId: string;
  clientSecret: string;
  accountNumber?: string | null;
  certificateCrt: string;
  certificateKey: string;
}

export interface InterTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface IssueChargePayload {
  seuNumero: string;
  valorNominal: number;
  dataVencimento: string; // YYYY-MM-DD
  numDiasAgenda?: number;
  pagador: {
    cpfCnpj: string;
    tipoPessoa: "FISICA" | "JURIDICA";
    nome: string;
    endereco: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    email?: string;
    telefone?: string;
  };
  mensagem?: {
    linha1?: string;
    linha2?: string;
    linha3?: string;
    linha4?: string;
    linha5?: string;
  };
  multa?: {
    codigoMulta: "PERCENTUAL" | "VALORFIXO";
    taxa?: number;
    valor?: number;
  };
  mora?: {
    codigoMora: "TAXAMENSAL" | "VALORDIA" | "ISENTO";
    taxa?: number;
    valor?: number;
  };
}

export interface IssueChargeResponse {
  codigoSolicitacao: string;
  seuNumero: string;
  dataEmissao?: string;
  dataVencimento?: string;
  valorNominal?: number;
  situacao?: string;
  nossoNumero?: string;
  codigoBarras?: string;
  linhaDigitavel?: string;
  pixCopiaECola?: string;
  txid?: string;
}

/**
 * Cliente seguro de backend para orquestração da API do Banco Inter v3
 * Executa em ambiente Deno (Supabase Edge Functions) com suporte a mTLS e cache de tokens.
 */
export class BancoInterClient {
  private supabaseAdmin: SupabaseClient;
  private config: InterConfig;

  constructor(supabaseAdmin: SupabaseClient, config: InterConfig) {
    this.supabaseAdmin = supabaseAdmin;
    this.config = config;
  }

  private getBaseUrl(): string {
    return this.config.environment === "production"
      ? "https://cdpj.partners.bancointer.com.br"
      : "https://cdpj-sandbox.partners.uatinter.co";
  }

  /**
   * Obtém um HttpClient configurado com os certificados mTLS da empresa
   */
  private getMtlsHttpClient(): Deno.HttpClient | undefined {
    if (!this.config.certificateCrt || !this.config.certificateKey) {
      return undefined;
    }

    try {
      return Deno.createHttpClient({
        cert: this.config.certificateCrt,
        key: this.config.certificateKey,
      });
    } catch (err) {
      console.error("Erro ao instanciar Deno.createHttpClient com certificados mTLS:", err);
      throw new Error("Certificado ou chave privada mTLS inválidos para o Banco Inter.");
    }
  }

  /**
   * Obtém token de acesso válido, reutilizando o cache do banco ou renovando atomicamente
   */
  public async getAccessToken(safetyMarginSeconds: number = 300): Promise<string> {
    const { organizationId, bankIntegrationId, environment } = this.config;

    // 1. Tentar buscar token válido em cache
    const { data: cached, error: checkErr } = await this.supabaseAdmin.rpc("get_valid_bank_token", {
      p_organization_id: organizationId,
      p_bank_integration_id: bankIntegrationId,
      p_environment: environment,
      p_safety_margin_seconds: safetyMarginSeconds,
    });

    if (!checkErr && cached && cached.length > 0 && cached[0].found && cached[0].access_token) {
      return cached[0].access_token;
    }

    // 2. Token inexistente ou expirando: Tentar adquirir Lease de renovação
    const workerId = crypto.randomUUID();
    const maxRetries = 6;
    const retryDelayMs = 800;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const { data: leaseData, error: leaseErr } = await this.supabaseAdmin.rpc(
        "acquire_bank_token_refresh_lease",
        {
          p_organization_id: organizationId,
          p_bank_integration_id: bankIntegrationId,
          p_environment: environment,
          p_owner_id: workerId,
          p_lease_duration_seconds: 30,
          p_safety_margin_seconds: safetyMarginSeconds,
        }
      );

      if (leaseErr) {
        throw new Error(`Falha na RPC de aquisição de lease: ${leaseErr.message}`);
      }

      const leaseResult = leaseData?.[0];

      // Caso A: Outro processo já renovou o token e ele está pronto
      if (leaseResult?.existing_valid_token) {
        return leaseResult.existing_valid_token;
      }

      // Caso B: Este processo adquiriu com sucesso o direito exclusivo de renovação
      if (leaseResult?.lease_acquired) {
        try {
          const newToken = await this.requestNewOAuthToken();

          const { data: completeData, error: completeErr } = await this.supabaseAdmin.rpc(
            "complete_bank_token_refresh",
            {
              p_organization_id: organizationId,
              p_bank_integration_id: bankIntegrationId,
              p_environment: environment,
              p_owner_id: workerId,
              p_access_token: newToken.access_token,
              p_token_type: newToken.token_type || "Bearer",
              p_scope: newToken.scope || "",
              p_issued_at: new Date().toISOString(),
              p_expires_in_seconds: newToken.expires_in || 3600,
            }
          );

          if (completeErr) {
            console.error("Erro ao persistir token renovado no banco:", completeErr);
          }

          return newToken.access_token;
        } catch (authError) {
          // Em caso de falha na chamada externa ao Inter, libera o lease imediatamente
          await this.supabaseAdmin.rpc("fail_bank_token_refresh", {
            p_organization_id: organizationId,
            p_bank_integration_id: bankIntegrationId,
            p_environment: environment,
            p_owner_id: workerId,
          });
          throw authError;
        }
      }

      // Caso C: Outro worker está renovando agora ('LEASE_HELD_BY_ANOTHER_WORKER')
      // Aguarda e reconsulta na próxima iteração
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }

    throw new Error("Tempo limite de espera para renovação concorrente do token esgotado.");
  }

  /**
   * Chamada HTTP mTLS direta ao endpoint OAuth2 do Banco Inter
   */
  private async requestNewOAuthToken(): Promise<InterTokenResponse> {
    const tokenUrl = `${this.getBaseUrl()}/oauth/v2/token`;
    const client = this.getMtlsHttpClient();

    const bodyParams = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: "client_credentials",
      scope: "boleto-cobranca.read boleto-cobranca.write",
    });

    const options: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Locgest/2.0",
      },
      body: bodyParams.toString(),
    };

    if (client) {
      (options as any).client = client;
    }

    const response = await fetch(tokenUrl, options);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`Erro OAuth Banco Inter (${response.status}):`, errorText);
      throw new Error(`Falha na autenticação OAuth2 Banco Inter (HTTP ${response.status}).`);
    }

    const data = (await response.json()) as InterTokenResponse;

    if (!data.access_token) {
      throw new Error("Resposta do Banco Inter não continha access_token válido.");
    }

    return data;
  }

  /**
   * Emite uma cobrança / boleto na API de Cobrança v3 do Banco Inter com retry automático em caso de 401
   */
  public async issueCharge(payload: IssueChargePayload): Promise<IssueChargeResponse> {
    const url = `${this.getBaseUrl()}/cobranca/v3/cobrancas`;
    const client = this.getMtlsHttpClient();

    // Primeira tentativa com token do cache
    let token = await this.getAccessToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "Locgest/2.0",
    };

    if (this.config.accountNumber) {
      headers["x-conta-corrente"] = this.config.accountNumber.replace(/[^0-9]/g, "");
    }

    const options: RequestInit = {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    };

    if (client) {
      (options as any).client = client;
    }

    let response = await fetch(url, options);

    // Se receber 401 (token revogado remotamente antes do TTL), invalida e tenta mais 1 vez
    if (response.status === 401) {
      console.warn("Recebido 401 do Banco Inter. Invalidando token em cache e reexecutando...");
      await this.supabaseAdmin.rpc("invalidate_bank_token", {
        p_organization_id: this.config.organizationId,
        p_bank_integration_id: this.config.bankIntegrationId,
        p_environment: this.config.environment,
      });

      token = await this.getAccessToken(0); // força renovação
      headers["Authorization"] = `Bearer ${token}`;
      options.headers = headers;

      response = await fetch(url, options);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(`Erro emissão cobrança Inter (${response.status}):`, errorBody);
      throw new Error(`Erro na emissão do boleto no Banco Inter (HTTP ${response.status}): ${errorBody}`);
    }

    return (await response.json()) as IssueChargeResponse;
  }

  /**
   * Recupera o PDF oficial de um boleto na API de Cobrança v3 do Banco Inter com retry automático em caso de 401
   */
  public async getChargePdf(codigoSolicitacao: string): Promise<Uint8Array> {
    const url = `${this.getBaseUrl()}/cobranca/v3/cobrancas/${codigoSolicitacao}/pdf`;
    const client = this.getMtlsHttpClient();

    let token = await this.getAccessToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, application/pdf, */*",
      "User-Agent": "Locgest/2.0",
    };

    if (this.config.accountNumber) {
      headers["x-conta-corrente"] = this.config.accountNumber.replace(/[^0-9]/g, "");
    }

    const options: RequestInit = {
      method: "GET",
      headers,
    };

    if (client) {
      (options as any).client = client;
    }

    let response = await fetch(url, options);

    // Se receber 401, invalida token em cache e tenta mais 1 única vez
    if (response.status === 401) {
      console.warn("Recebido 401 ao buscar PDF do Banco Inter. Invalidando token e repetindo consulta...");
      await this.supabaseAdmin.rpc("invalidate_bank_token", {
        p_organization_id: this.config.organizationId,
        p_bank_integration_id: this.config.bankIntegrationId,
        p_environment: this.config.environment,
      });

      token = await this.getAccessToken(0);
      headers["Authorization"] = `Bearer ${token}`;
      options.headers = headers;

      response = await fetch(url, options);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(`Erro ao buscar PDF no Banco Inter (${response.status}):`, errorBody);
      throw new Error(`Erro ao recuperar PDF do Banco Inter (HTTP ${response.status}): ${errorBody}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = await response.json();
      if (!json.pdf) {
        throw new Error("Resposta do Banco Inter não continha o campo 'pdf'.");
      }
      const binaryString = atob(json.pdf);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } else {
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }
  }
}

