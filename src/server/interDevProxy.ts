import type { Plugin, ViteDevServer } from "vite";
import https from "https";
import { IncomingMessage, ServerResponse } from "http";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://wstjabzuiftnasijcmad.supabase.co";

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzdGphYnp1aWZ0bmFzaWpjbWFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTc5MzYyOSwiZXhwIjoyMTAxMzY5NjI5fQ.5GjKIzq_DjInQhFed97grwXcJL7ljjbUYomltztyUYs";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

interface IssueChargeRequest {
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
  integration?: {
    id?: string;
    organization_id?: string;
    environment?: "sandbox" | "production";
    client_id?: string;
    client_secret?: string;
    account_number?: string;
    certificate_crt_content?: string;
    certificate_key_content?: string;
    pix_key?: string;
  };
}

function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJsonResponse(res: ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(data));
}

/**
 * Faz requisição HTTPS com suporte nativo a mTLS via Node.js
 */
function makeHttpsRequest(
  urlStr: string,
  options: {
    method: string;
    headers?: Record<string, string>;
    body?: string;
    cert?: string;
    key?: string;
  }
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);

      const agentOptions: https.AgentOptions = {
        keepAlive: true,
      };

      if (options.cert && options.key) {
        agentOptions.cert = options.cert;
        agentOptions.key = options.key;
        agentOptions.rejectUnauthorized = false; // Permite handshake com certificados Banco Inter
      }

      const agent = new https.Agent(agentOptions);

      const req = https.request(
        {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          method: options.method,
          headers: options.headers,
          agent,
          timeout: 20000,
        },
        (res) => {
          let responseBody = "";
          res.on("data", (chunk) => {
            responseBody += chunk;
          });
          res.on("end", () => {
            resolve({ status: res.statusCode || 500, body: responseBody });
          });
        }
      );

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Timeout ao conectar com a API do Banco Inter (20s)"));
      });

      req.on("error", (err) => {
        reject(err);
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Garante a obtenção do token OAuth 2.0 com checagem e reutilização na tabela bank_access_tokens:
 * 1. Sempre confere primeiro na tabela bank_access_tokens se já existe token ativo e válido.
 * 2. Se existir, reutiliza o token imediatamente sem nova requisição externa.
 * 3. Se e somente se NÃO existir token válido, requisita novo token com mTLS e salva na tabela.
 */
async function getOrRenewBankAccessToken(params: {
  organizationId: string;
  bankIntegrationId: string;
  environment: "sandbox" | "production";
  clientId: string;
  clientSecret: string;
  cert: string;
  key: string;
  baseUrl: string;
  safetyMarginSeconds?: number;
}): Promise<string> {
  const {
    organizationId,
    bankIntegrationId,
    environment,
    clientId,
    clientSecret,
    cert,
    key,
    baseUrl,
    safetyMarginSeconds = 300,
  } = params;

  // 1. CHECAGEM NA TABELA: busca token ativo e válido antes de gerar novo
  try {
    const { data: cached, error: checkErr } = await supabaseAdmin.rpc("get_valid_bank_token", {
      p_organization_id: organizationId,
      p_bank_integration_id: bankIntegrationId,
      p_environment: environment,
      p_safety_margin_seconds: safetyMarginSeconds,
    });

    if (!checkErr && cached && cached.length > 0 && cached[0].found && cached[0].access_token) {
      console.log(
        `[Banco Inter] Token ativo reutilizado de bank_access_tokens (restam ${cached[0].seconds_remaining}s). Nenhuma requisição nova de token necessária.`
      );
      return cached[0].access_token;
    }
  } catch (err) {
    console.warn("[Banco Inter] Aviso ao consultar get_valid_bank_token RPC:", err);
  }

  // 2. TOKEN INEXISTENTE OU EXPIRADO: gerar novo token via mTLS e persistir na tabela
  console.log(
    `[Banco Inter] Nenhum token ativo/válido em bank_access_tokens. Solicitando novo token ao Banco Inter via mTLS...`
  );

  const workerId = crypto.randomUUID();
  const maxRetries = 6;
  const retryDelayMs = 800;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { data: leaseData, error: leaseErr } = await supabaseAdmin.rpc(
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
      console.warn(`[Banco Inter] Erro na RPC acquire_bank_token_refresh_lease: ${leaseErr.message}`);
      break;
    }

    const leaseResult = leaseData?.[0];

    // Outro worker acabou de renovar
    if (leaseResult?.existing_valid_token) {
      console.log("[Banco Inter] Token válido recém-renovado obtido durante espera.");
      return leaseResult.existing_valid_token;
    }

    if (leaseResult?.lease_acquired) {
      try {
        const tokenUrl = `${baseUrl}/oauth/v2/token`;
        const tokenParams = new URLSearchParams({
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          grant_type: "client_credentials",
          scope: "boleto-cobranca.read boleto-cobranca.write",
        });

        const tokenRes = await makeHttpsRequest(tokenUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: tokenParams.toString(),
          cert,
          key,
        });

        if (tokenRes.status !== 200) {
          let errorDetail = tokenRes.body;
          try {
            const parsed = JSON.parse(tokenRes.body);
            errorDetail = parsed.error_description || parsed.message || parsed.error || tokenRes.body;
          } catch (_) {}

          await supabaseAdmin.rpc("fail_bank_token_refresh", {
            p_organization_id: organizationId,
            p_bank_integration_id: bankIntegrationId,
            p_environment: environment,
            p_owner_id: workerId,
          });

          throw new Error(`Falha na autenticação com o Banco Inter (HTTP ${tokenRes.status}): ${errorDetail}`);
        }

        const tokenData = JSON.parse(tokenRes.body);
        const accessToken = tokenData.access_token;
        const expiresIn = Number(tokenData.expires_in) || 3600;

        // Persistir novo token na tabela bank_access_tokens
        const { error: completeErr } = await supabaseAdmin.rpc("complete_bank_token_refresh", {
          p_organization_id: organizationId,
          p_bank_integration_id: bankIntegrationId,
          p_environment: environment,
          p_owner_id: workerId,
          p_access_token: accessToken,
          p_token_type: tokenData.token_type || "Bearer",
          p_scope: tokenData.scope || "boleto-cobranca.read boleto-cobranca.write",
          p_issued_at: new Date().toISOString(),
          p_expires_in_seconds: expiresIn,
        });

        if (completeErr) {
          console.warn("[Banco Inter] Erro na RPC complete_bank_token_refresh, usando fallback direto:", completeErr.message);
          await supabaseAdmin.from("bank_access_tokens").upsert({
            organization_id: organizationId,
            bank_integration_id: bankIntegrationId,
            environment,
            token_type: tokenData.token_type || "Bearer",
            scope: tokenData.scope || "boleto-cobranca.read boleto-cobranca.write",
            access_token: accessToken,
            issued_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
            last_used_at: new Date().toISOString(),
            status: "active",
            refresh_owner: null,
            refresh_lock_until: null,
            updated_at: new Date().toISOString(),
          });
        }

        console.log(`[Banco Inter] Novo token salvo com sucesso na tabela bank_access_tokens (válido por ${expiresIn}s).`);
        return accessToken;
      } catch (authErr) {
        await supabaseAdmin.rpc("fail_bank_token_refresh", {
          p_organization_id: organizationId,
          p_bank_integration_id: bankIntegrationId,
          p_environment: environment,
          p_owner_id: workerId,
        });
        throw authErr;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }

  // Fallback direto se lease não estiver disponível
  const tokenUrl = `${baseUrl}/oauth/v2/token`;
  const tokenParams = new URLSearchParams({
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    grant_type: "client_credentials",
    scope: "boleto-cobranca.read boleto-cobranca.write",
  });

  const directRes = await makeHttpsRequest(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
    cert,
    key,
  });

  if (directRes.status !== 200) {
    throw new Error(`Falha na autenticação com o Banco Inter (HTTP ${directRes.status}): ${directRes.body}`);
  }

  const tokenData = JSON.parse(directRes.body);
  const expiresIn = Number(tokenData.expires_in) || 3600;

  await supabaseAdmin.from("bank_access_tokens").upsert({
    organization_id: organizationId,
    bank_integration_id: bankIntegrationId,
    environment,
    token_type: tokenData.token_type || "Bearer",
    scope: tokenData.scope || "boleto-cobranca.read boleto-cobranca.write",
    access_token: tokenData.access_token,
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    last_used_at: new Date().toISOString(),
    status: "active",
    refresh_owner: null,
    refresh_lock_until: null,
    updated_at: new Date().toISOString(),
  });

  console.log(`[Banco Inter] Novo token salvo na tabela bank_access_tokens (fallback direto).`);
  return tokenData.access_token;
}

/**
 * Plugin Vite para interceptar e processar emissão mTLS com Banco Inter no dev server local
 */
export function interDevProxyPlugin(): Plugin {
  return {
    name: "vite-plugin-inter-bank-proxy",
    configureServer(server: ViteDevServer) {
      // 1. Endpoint: Teste de conectividade
      server.middlewares.use("/api/bank/inter/test-connectivity", async (req, res, next) => {
        if (req.method === "OPTIONS") {
          res.writeHead(200, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          });
          res.end();
          return;
        }

        if (req.method !== "POST") {
          return next();
        }

        try {
          const body = await parseJsonBody<any>(req);
          const env = body.environment === "production" ? "production" : "sandbox";
          const baseUrl =
            env === "production"
              ? "https://cdpj.partners.bancointer.com.br"
              : "https://cdpj-sandbox.partners.uatinter.co";

          const tokenUrl = `${baseUrl}/oauth/v2/token`;
          const cert = body.certificate_crt_content;
          const key = body.certificate_key_content;

          const response = await makeHttpsRequest(tokenUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: `grant_type=client_credentials&scope=boleto-cobranca.read%20boleto-cobranca.write&client_id=${encodeURIComponent(
              body.client_id || ""
            )}&client_secret=${encodeURIComponent(body.client_secret || "")}`,
            cert,
            key,
          });

          // Se o teste de autenticação foi bem-sucedido, já persiste o token na tabela bank_access_tokens
          if (response.status === 200) {
            try {
              const tokenData = JSON.parse(response.body);
              if (tokenData.access_token) {
                const orgId = body.organization_id;
                let integId = body.id;
                if (!integId && orgId) {
                  const { data: dbInteg } = await supabaseAdmin
                    .from("tenant_bank_integrations")
                    .select("id")
                    .eq("organization_id", orgId)
                    .maybeSingle();
                  integId = dbInteg?.id;
                }
                if (orgId && integId) {
                  const expiresIn = Number(tokenData.expires_in) || 3600;
                  await supabaseAdmin.from("bank_access_tokens").upsert({
                    organization_id: orgId,
                    bank_integration_id: integId,
                    environment: env,
                    token_type: tokenData.token_type || "Bearer",
                    scope: tokenData.scope || "boleto-cobranca.read boleto-cobranca.write",
                    access_token: tokenData.access_token,
                    issued_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
                    last_used_at: new Date().toISOString(),
                    status: "active",
                    refresh_owner: null,
                    refresh_lock_until: null,
                    updated_at: new Date().toISOString(),
                  });
                  console.log("[Banco Inter] Teste de conectividade persistiu token ativo em bank_access_tokens!");
                }
              }
            } catch (persistErr) {
              console.warn("[Banco Inter] Não foi possível salvar token durante teste:", persistErr);
            }
          }

          sendJsonResponse(res, 200, {
            service: "Banco Inter",
            environment: env,
            reachable: true,
            httpStatus: response.status,
            rawResponse: response.body,
          });
        } catch (err: any) {
          sendJsonResponse(res, 500, {
            service: "Banco Inter",
            reachable: false,
            error: err?.message || String(err),
          });
        }
      });

      // 2. Endpoint: Emissão de Boleto + Pix
      server.middlewares.use("/api/bank/inter/issue-charge", async (req, res, next) => {
        if (req.method === "OPTIONS") {
          res.writeHead(200, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          });
          res.end();
          return;
        }

        if (req.method !== "POST") {
          return next();
        }

        try {
          const payload = await parseJsonBody<IssueChargeRequest>(req);
          const integration = payload.integration;

          if (!integration || !integration.client_id || !integration.client_secret) {
            sendJsonResponse(res, 400, {
              success: false,
              error:
                "Credenciais da integração com o Banco Inter ausentes. Configure em 'Configurações -> Integração Bancária'.",
            });
            return;
          }

          if (!integration.certificate_crt_content || !integration.certificate_key_content) {
            sendJsonResponse(res, 400, {
              success: false,
              error:
                "Certificado público (.crt) ou chave privada (.key) do Banco Inter não foram configurados.",
            });
            return;
          }

          const env = integration.environment === "production" ? "production" : "sandbox";
          const baseUrl =
            env === "production"
              ? "https://cdpj.partners.bancointer.com.br"
              : "https://cdpj-sandbox.partners.uatinter.co";

          // Obter ID da integração bancária para vínculo estrito com bank_access_tokens
          let bankIntegrationId = integration.id;
          if (!bankIntegrationId) {
            const { data: dbInteg } = await supabaseAdmin
              .from("tenant_bank_integrations")
              .select("id")
              .eq("organization_id", payload.organization_id)
              .eq("is_active", true)
              .maybeSingle();
            if (dbInteg?.id) {
              bankIntegrationId = dbInteg.id;
            }
          }

          if (!bankIntegrationId) {
            sendJsonResponse(res, 400, {
              success: false,
              error: "Identificador da integração bancária (bank_integration_id) não encontrado para esta organização.",
            });
            return;
          }

          // PASSO 1: Obter Token com verificação prévia na tabela bank_access_tokens
          let accessToken: string;
          try {
            accessToken = await getOrRenewBankAccessToken({
              organizationId: payload.organization_id,
              bankIntegrationId,
              environment: env,
              clientId: integration.client_id,
              clientSecret: integration.client_secret,
              cert: integration.certificate_crt_content,
              key: integration.certificate_key_content,
              baseUrl,
            });
          } catch (authErr: any) {
            sendJsonResponse(res, 400, {
              success: false,
              error: authErr?.message || "Falha ao obter token de autenticação com o Banco Inter.",
            });
            return;
          }

          // PASSO 2: Formatar dados do pagador e da cobrança
          const rawDoc = (payload.payer?.cpfCnpj || "").replace(/\D/g, "");
          const isCnpj = rawDoc.length > 11;
          const codeNumber = `BOL-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

          const rawPhone = (payload.payer?.telefone || "").replace(/\D/g, "");
          let ddd: string | undefined = undefined;
          let telefone: string | undefined = undefined;

          if (rawPhone.length >= 10) {
            ddd = rawPhone.slice(0, 2);
            telefone = rawPhone.slice(2, 11); // máximo 9 dígitos
          } else if (rawPhone.length > 0) {
            telefone = rawPhone.slice(0, 9);
          }

          const chargePayload: any = {
            seuNumero: codeNumber.slice(0, 15),
            valorNominal: Number(payload.amount),
            dataVencimento: payload.due_date,
            numDiasAgenda: 60,
            pagador: {
              cpfCnpj: rawDoc,
              tipoPessoa: isCnpj ? "JURIDICA" : "FISICA",
              nome: payload.payer?.nome || "Cliente",
              endereco: payload.payer?.endereco || "Av. Principal",
              numero: payload.payer?.numero || "S/N",
              bairro: payload.payer?.bairro || "Centro",
              cidade: payload.payer?.cidade || "Fortaleza",
              uf: (payload.payer?.uf || "CE").toUpperCase().slice(0, 2),
              cep: (payload.payer?.cep || "60000000").replace(/\D/g, ""),
              email: payload.payer?.email || undefined,
              ...(ddd ? { ddd } : {}),
              ...(telefone ? { telefone } : {}),
            },
            mensagem: {
              linha1: (payload.description || `Boleto de Locacao - ${codeNumber}`).slice(0, 78),
            },
            multa: {
              codigo: "PERCENTUAL",
              taxa: Number(Number(payload.fine_rate ?? 2.0).toFixed(2)),
              valor: 0.0,
            },
            mora: {
              codigo: "TAXAMENSAL",
              taxa: Number(Number(payload.interest_rate ?? 1.0).toFixed(2)),
              valor: 0.0,
            },
          };

          // PASSO 3: Emitir cobrança na API v3 do Banco Inter
          const chargeUrl = `${baseUrl}/cobranca/v3/cobrancas`;
          const chargeHeaders: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          };

          if (integration.account_number) {
            chargeHeaders["x-conta-corrente"] = integration.account_number.replace(/\D/g, "");
          }

          const chargeRes = await makeHttpsRequest(chargeUrl, {
            method: "POST",
            headers: chargeHeaders,
            body: JSON.stringify(chargePayload),
            cert: integration.certificate_crt_content,
            key: integration.certificate_key_content,
          });

          if (chargeRes.status !== 200 && chargeRes.status !== 201) {
            if (chargeRes.status === 401) {
              console.warn("[Banco Inter] Cobrança retornou HTTP 401 Unauthorized. Invalidando token na tabela bank_access_tokens...");
              try {
                await supabaseAdmin.rpc("invalidate_bank_token", {
                  p_organization_id: payload.organization_id,
                  p_bank_integration_id: bankIntegrationId,
                  p_environment: env,
                });
              } catch (_) {}
            }

            let errorDetail = chargeRes.body;
            try {
              const parsed = JSON.parse(chargeRes.body);
              errorDetail =
                parsed.violacoes?.map((v: any) => `${v.razao}: ${v.propriedade}`).join(", ") ||
                parsed.message ||
                parsed.title ||
                chargeRes.body;
            } catch (_) {}

            sendJsonResponse(res, 400, {
              success: false,
              error: `Erro retornado pelo Banco Inter (HTTP ${chargeRes.status}): ${errorDetail}`,
            });
            return;
          }

          const chargeData = JSON.parse(chargeRes.body);

          sendJsonResponse(res, 200, {
            success: true,
            data: {
              code_number: codeNumber,
              inter_nosso_numero: chargeData.nossoNumero || chargeData.seuNumero || codeNumber,
              inter_codigo_solicitacao: chargeData.codigoSolicitacao,
              linha_digitavel: chargeData.linhaDigitavel || null,
              codigo_barras: chargeData.codigoBarras || null,
              pix_copia_cola: chargeData.pixCopiaECola || null,
            },
          });
        } catch (err: any) {
          sendJsonResponse(res, 500, {
            success: false,
            error: `Erro interno no servidor de emissão: ${err?.message || String(err)}`,
          });
        }
      });

      // 3. Endpoint: Recuperação do PDF oficial do Boleto via Banco Inter Cobrança v3
      server.middlewares.use("/api/bank/inter/get-charge-pdf", async (req, res, next) => {
        if (req.method === "OPTIONS") {
          res.writeHead(200, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          });
          res.end();
          return;
        }

        if (req.method !== "POST") {
          return next();
        }

        try {
          const body = await parseJsonBody<{ record_id: string; organization_id: string }>(req);
          const { record_id, organization_id } = body;

          if (!record_id || !organization_id) {
            sendJsonResponse(res, 400, {
              success: false,
              error: "record_id e organization_id são obrigatórios.",
            });
            return;
          }

          // 1. Buscar registro financeiro no Supabase
          const { data: record, error: recordErr } = await supabaseAdmin
            .from("financial_records")
            .select("id, organization_id, type, code_number, inter_codigo_solicitacao, inter_nosso_numero, pdf_url")
            .eq("id", record_id)
            .eq("organization_id", organization_id)
            .maybeSingle();

          if (recordErr || !record) {
            sendJsonResponse(res, 404, {
              success: false,
              error: "Boleto não encontrado para esta organização.",
            });
            return;
          }

          // Se o PDF já estiver gravado permanentemente no Supabase Storage, responde direto sem chamar o Inter!
          if (record.pdf_url) {
            try {
              const cachedRes = await fetch(record.pdf_url);
              if (cachedRes.ok) {
                const cachedBuffer = Buffer.from(await cachedRes.arrayBuffer());
                res.writeHead(200, {
                  "Content-Type": "application/pdf",
                  "Content-Length": cachedBuffer.length,
                  "Content-Disposition": `inline; filename="${record.code_number || "boleto"}.pdf"`,
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Headers": "Content-Type, Authorization",
                });
                res.end(cachedBuffer);
                return;
              }
            } catch (_) {}
          }

          if (!record.inter_codigo_solicitacao) {
            sendJsonResponse(res, 422, {
              success: false,
              error:
                "O boleto ainda está sendo processado pelo Banco Inter ou não possui código de solicitação bancário. Tente novamente em instantes.",
            });
            return;
          }

          // 2. Buscar integração bancária ativa da organização
          const { data: integration, error: integErr } = await supabaseAdmin
            .from("tenant_bank_integrations")
            .select("*")
            .eq("organization_id", organization_id)
            .eq("is_active", true)
            .maybeSingle();

          if (integErr || !integration) {
            sendJsonResponse(res, 404, {
              success: false,
              error: "Nenhuma integração ativa com o Banco Inter encontrada para esta empresa.",
            });
            return;
          }

          const env = integration.environment === "production" ? "production" : "sandbox";
          const baseUrl =
            env === "production"
              ? "https://cdpj.partners.bancointer.com.br"
              : "https://cdpj-sandbox.partners.uatinter.co";

          // 3. Obter token ativo (reutilizando cache da tabela bank_access_tokens)
          let accessToken = await getOrRenewBankAccessToken({
            organizationId: organization_id,
            bankIntegrationId: integration.id,
            environment: env,
            clientId: integration.client_id,
            clientSecret: integration.client_secret,
            cert: integration.certificate_crt_content,
            key: integration.certificate_key_content,
            baseUrl,
          });

          // 4. Chamar endpoint oficial de PDF
          const pdfUrl = `${baseUrl}/cobranca/v3/cobrancas/${record.inter_codigo_solicitacao}/pdf`;
          const pdfHeaders: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json, application/pdf, */*",
          };

          if (integration.account_number) {
            pdfHeaders["x-conta-corrente"] = integration.account_number.replace(/\D/g, "");
          }

          let pdfRes = await makeHttpsRequest(pdfUrl, {
            method: "GET",
            headers: pdfHeaders,
            cert: integration.certificate_crt_content,
            key: integration.certificate_key_content,
          });

          // Se 401, invalida token e tenta mais uma vez
          if (pdfRes.status === 401) {
            console.warn("[Banco Inter Proxy] Recebido 401 ao buscar PDF. Invalidando token e repetindo consulta...");
            await supabaseAdmin.rpc("invalidate_bank_token", {
              p_organization_id: organization_id,
              p_bank_integration_id: integration.id,
              p_environment: env,
            });

            accessToken = await getOrRenewBankAccessToken({
              organizationId: organization_id,
              bankIntegrationId: integration.id,
              environment: env,
              clientId: integration.client_id,
              clientSecret: integration.client_secret,
              cert: integration.certificate_crt_content,
              key: integration.certificate_key_content,
              baseUrl,
              safetyMarginSeconds: 0,
            });

            pdfHeaders["Authorization"] = `Bearer ${accessToken}`;
            pdfRes = await makeHttpsRequest(pdfUrl, {
              method: "GET",
              headers: pdfHeaders,
              cert: integration.certificate_crt_content,
              key: integration.certificate_key_content,
            });
          }

          if (pdfRes.status !== 200) {
            sendJsonResponse(res, pdfRes.status === 404 ? 404 : 500, {
              success: false,
              error: "Não foi possível carregar o boleto. Tente novamente em alguns instantes.",
              rawError: pdfRes.body,
            });
            return;
          }

          // 5. Tratar resposta: o Banco Inter retorna JSON com campo "pdf" em Base64
          let pdfBuffer: Buffer;
          try {
            const parsed = JSON.parse(pdfRes.body);
            if (parsed.pdf) {
              pdfBuffer = Buffer.from(parsed.pdf, "base64");
            } else {
              throw new Error("Campo 'pdf' ausente no JSON");
            }
          } catch (_) {
            pdfBuffer = Buffer.from(pdfRes.body, "binary");
          }

          // Validar assinatura %PDF
          if (pdfBuffer.length < 4 || pdfBuffer.slice(0, 4).toString("utf8") !== "%PDF") {
            sendJsonResponse(res, 500, {
              success: false,
              error: "A resposta retornada pelo Banco Inter não é um arquivo PDF válido.",
            });
            return;
          }

          // Salvar permanentemente no Supabase Storage (bucket 'boletos') para nunca mais precisar requisitar do Inter
          try {
            const filePath = `${organization_id}/${record.code_number || record.id}.pdf`;
            const { error: uploadErr } = await supabaseAdmin.storage
              .from("boletos")
              .upload(filePath, pdfBuffer, {
                contentType: "application/pdf",
                upsert: true,
              });

            if (!uploadErr) {
              const { data: publicUrlData } = supabaseAdmin.storage
                .from("boletos")
                .getPublicUrl(filePath);

              if (publicUrlData?.publicUrl) {
                await supabaseAdmin
                  .from("financial_records")
                  .update({ pdf_url: publicUrlData.publicUrl })
                  .eq("id", record.id);
                console.log(`[Banco Inter Proxy] PDF do boleto ${record.code_number} salvo permanentemente no Storage: ${publicUrlData.publicUrl}`);
              }
            }
          } catch (storageSaveErr) {
            console.warn("[Banco Inter Proxy] Aviso ao salvar PDF no Storage:", storageSaveErr);
          }

          // Responder com o binário real do PDF
          res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Length": pdfBuffer.length,
            "Content-Disposition": `inline; filename="${record.code_number || "boleto"}.pdf"`,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          });
          res.end(pdfBuffer);
        } catch (err: any) {
          sendJsonResponse(res, 500, {
            success: false,
            error: "Erro interno ao processar visualização do boleto.",
            details: err?.message || String(err),
          });
        }
      });
    },
  };
}
