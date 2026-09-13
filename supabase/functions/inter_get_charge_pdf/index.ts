import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BancoInterClient } from "../_shared/interClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge Function: Recuperação Segura do PDF Oficial do Boleto Banco Inter v3
 * Valida o usuário autenticado, confirma o isolamento multi-tenant,
 * busca o codigoSolicitacao no banco, reaproveita o access_token e
 * retorna o binário do PDF (application/pdf).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Validar autenticação do usuário chamador via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Cabeçalho de autorização ausente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado ou sessão expirada." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Extrair dados da requisição
    const body = await req.json();
    const { record_id, organization_id } = body;

    if (!record_id || !organization_id) {
      return new Response(
        JSON.stringify({ error: "record_id e organization_id são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validar pertencimento do usuário à organização solicitada
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id, role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profile && profile.organization_id !== organization_id && profile.role !== "superadmin") {
      return new Response(
        JSON.stringify({ error: "Acesso não autorizado para esta organização." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Buscar o registro do boleto no banco com validação de organização
    const { data: record, error: recordErr } = await supabaseAdmin
      .from("financial_records")
      .select("id, organization_id, type, code_number, inter_codigo_solicitacao, inter_nosso_numero, pdf_url")
      .eq("id", record_id)
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (recordErr || !record) {
      return new Response(
        JSON.stringify({ error: "Boleto não localizado ou não pertence a esta organização." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se já estiver salvo permanentemente no Storage, serve direto sem chamar o Inter
    if (record.pdf_url) {
      try {
        const cachedRes = await fetch(record.pdf_url);
        if (cachedRes.ok) {
          const cachedBytes = new Uint8Array(await cachedRes.arrayBuffer());
          return new Response(cachedBytes, {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/pdf",
              "Content-Disposition": `inline; filename="${record.code_number || "boleto"}.pdf"`,
            },
          });
        }
      } catch (_) {}
    }

    if (!record.inter_codigo_solicitacao) {
      return new Response(
        JSON.stringify({
          error:
            "O boleto ainda está sendo processado pelo Banco Inter ou não possui código de solicitação bancário. Tente novamente em instantes.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Buscar credenciais bancárias da organização
    const { data: integration, error: integErr } = await supabaseAdmin
      .from("tenant_bank_integrations")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("is_active", true)
      .maybeSingle();

    if (integErr || !integration) {
      return new Response(
        JSON.stringify({
          error: "Nenhuma integração ativa com o Banco Inter encontrada para esta empresa.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Instanciar o cliente Banco Inter e recuperar o PDF binário
    const interClient = new BancoInterClient(supabaseAdmin, {
      organizationId: organization_id,
      bankIntegrationId: integration.id,
      environment: integration.environment || "sandbox",
      clientId: integration.client_id,
      clientSecret: integration.client_secret,
      accountNumber: integration.account_number,
      certificateCrt: integration.certificate_crt_content || "",
      certificateKey: integration.certificate_key_content || "",
    });

    const pdfBytes = await interClient.getChargePdf(record.inter_codigo_solicitacao);

    // Validação básica da assinatura binária de PDF (%PDF)
    if (pdfBytes.length < 4 || String.fromCharCode(pdfBytes[0], pdfBytes[1], pdfBytes[2], pdfBytes[3]) !== "%PDF") {
      throw new Error("O conteúdo retornado pelo Banco Inter não é um arquivo PDF válido.");
    }

    // Salvar permanentemente no Supabase Storage para reutilização futura
    try {
      const filePath = `${organization_id}/${record.code_number || record.id}.pdf`;
      const { error: uploadErr } = await supabaseAdmin.storage
        .from("boletos")
        .upload(filePath, pdfBytes, {
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
        }
      }
    } catch (storageErr) {
      console.warn("Aviso ao salvar PDF no Storage:", storageErr);
    }

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${record.code_number || "boleto"}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("Erro na Edge Function inter_get_charge_pdf:", err);
    return new Response(
      JSON.stringify({
        error: "Não foi possível carregar o boleto. Tente novamente em alguns instantes.",
        details: err?.message || String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
