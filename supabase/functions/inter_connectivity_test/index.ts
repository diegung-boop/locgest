import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Endpoint de Diagnóstico de Conectividade com a API do Banco Inter
 * Teste puramente técnico de infraestrutura, DNS, handshake TLS e resposta HTTP.
 * SEM uso de chaves, segredos ou certificados reais/falsos.
 */
serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = performance.now();
  const timestamp = new Date().toISOString();

  // Leitura do ambiente solicitado (padrão: sandbox)
  let environment: "sandbox" | "production" = "sandbox";
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.environment === "production") {
      environment = "production";
    }
  } catch (_) {
    // defaults to sandbox
  }

  // Definição dos endpoints oficiais do Banco Inter para verificação de infraestrutura
  const targetEndpoint = environment === "production"
    ? "https://cdpj.partners.bancointer.com.br/oauth/v2/token"
    : "https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token";

  // Verificação de variáveis de ambiente futuras (sem expor nenhum valor sensível)
  const envClientId = Deno.env.get("INTER_CLIENT_ID") || "";
  const envClientSecret = Deno.env.get("INTER_CLIENT_SECRET") || "";
  const envCertPath = Deno.env.get("INTER_CERT_PATH") || "";
  const envKeyPath = Deno.env.get("INTER_KEY_PATH") || "";

  const credentialsConfigured = Boolean(envClientId && envClientSecret);
  const mtlsConfigured = Boolean(envCertPath && envKeyPath);

  try {
    // Configura um AbortController com timeout de 8 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    // Faz requisição HTTP POST para o endpoint oficial sem credenciais
    const response = await fetch(targetEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Locgest-Connectivity-Probe/1.0",
      },
      body: "grant_type=client_credentials",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTimeMs = Math.round(performance.now() - startTime);
    const status = response.status;

    // Log técnico seguro (apenas metadados e duração)
    console.log(JSON.stringify({
      level: "INFO",
      action: "INTER_CONNECTIVITY_PROBE",
      endpoint: targetEndpoint,
      environment,
      status,
      durationMs: responseTimeMs,
      timestamp,
    }));

    // Se o servidor respondeu qualquer código HTTP (ex: 400 Bad Request, 401 Unauthorized),
    // a infraestrutura do Inter, o DNS e o handshake TLS foram 100% estabelecidos com sucesso.
    const result = {
      service: "Banco Inter",
      environment,
      reachable: true,
      httpStatus: status,
      stage: credentialsConfigured ? "connected" : "authentication_pending",
      mtlsConfigured,
      credentialsConfigured,
      message: credentialsConfigured
        ? `Servidor do Banco Inter alcançado com sucesso. Resposta HTTP ${status}.`
        : `Servidor do Banco Inter alcançado (HTTP ${status}). Autenticação ainda não configurada.`,
      responseTimeMs,
      timestamp,
      endpointTested: targetEndpoint,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    const responseTimeMs = Math.round(performance.now() - startTime);
    const errorMessage = (error?.message || "").toLowerCase();
    const errorName = error?.name || "Error";

    let stage: "timeout" | "dns_failed" | "tls_error" | "network_failed" = "network_failed";
    let message = "Falha ao alcançar a API do Banco Inter.";

    if (errorName === "AbortError" || errorMessage.includes("timeout") || errorMessage.includes("aborted")) {
      stage = "timeout";
      message = "Tempo limite de conexão esgotado (Timeout).";
    } else if (errorMessage.includes("dns") || errorMessage.includes("enotfound") || errorMessage.includes("name not resolved")) {
      stage = "dns_failed";
      message = "Falha de resolução de DNS do domínio do Banco Inter.";
    } else if (errorMessage.includes("tls") || errorMessage.includes("certificate") || errorMessage.includes("ssl") || errorMessage.includes("handshake")) {
      // Erro TLS / Certificado significa que o servidor foi alcançado e exigiu mTLS
      stage = "tls_error";
      message = "Servidor do Banco Inter alcançado, porém o handshake mTLS exige certificado digital.";
    }

    console.error(JSON.stringify({
      level: "WARN",
      action: "INTER_CONNECTIVITY_PROBE_ERROR",
      endpoint: targetEndpoint,
      environment,
      stage,
      errorName,
      durationMs: responseTimeMs,
      timestamp,
    }));

    const result = {
      service: "Banco Inter",
      environment,
      reachable: stage === "tls_error", // se for erro de mTLS, a infraestrutura foi alcançada
      httpStatus: null,
      stage,
      mtlsConfigured,
      credentialsConfigured,
      message,
      responseTimeMs,
      timestamp,
      endpointTested: targetEndpoint,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
