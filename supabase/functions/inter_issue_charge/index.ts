import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BancoInterClient, IssueChargePayload } from "../_shared/interClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge Function: Emissão Segura de Boletos e Cobranças via Banco Inter v3
 * Valida o usuário autenticado, busca as credenciais isoladas da organização,
 * reutiliza o access_token e cria o registro na tabela public.financial_records.
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
    const {
      organization_id,
      contract_id,
      client_id,
      amount,
      due_date,
      description,
      payer,
      installment_number,
      total_installments,
    } = body;

    if (!organization_id || !client_id || !amount || !due_date) {
      return new Response(
        JSON.stringify({ error: "organization_id, client_id, amount e due_date são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Buscar credenciais bancárias da organização no banco
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

    // 4. Instanciar o cliente do Banco Inter
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

    const codeNumber = `BOL-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    // 5. Montar payload oficial do Banco Inter v3
    const chargePayload: IssueChargePayload = {
      seuNumero: codeNumber.slice(0, 15),
      valorNominal: Number(amount),
      dataVencimento: due_date,
      numDiasAgenda: 60,
      pagador: {
        cpfCnpj: (payer.cpfCnpj || "").replace(/[^0-9]/g, ""),
        tipoPessoa: (payer.cpfCnpj || "").replace(/[^0-9]/g, "").length > 11 ? "JURIDICA" : "FISICA",
        nome: payer.nome || "Cliente",
        endereco: payer.endereco || "Endereco Principal",
        numero: payer.numero || "S/N",
        bairro: payer.bairro || "Centro",
        cidade: payer.cidade || "Fortaleza",
        uf: payer.uf || "CE",
        cep: (payer.cep || "60000000").replace(/[^0-9]/g, ""),
        email: payer.email,
        ...(payer.telefone && payer.telefone.replace(/\D/g, "").length >= 10
          ? {
              ddd: payer.telefone.replace(/\D/g, "").slice(0, 2),
              telefone: payer.telefone.replace(/\D/g, "").slice(2, 11),
            }
          : payer.telefone
          ? { telefone: payer.telefone.replace(/\D/g, "").slice(0, 9) }
          : {}),
      },
      mensagem: {
        linha1: description ? description.slice(0, 78) : `Boleto de Locacao - ${codeNumber}`,
      },
      multa: {
        codigo: "PERCENTUAL",
        taxa: 2.0,
        valor: 0.0,
      },
      mora: {
        codigo: "TAXAMENSAL",
        taxa: 1.0,
        valor: 0.0,
      },
    };

    // 6. Emitir cobrança no Banco Inter
    const interResponse = await interClient.issueCharge(chargePayload);

    // 7. Persistir o boleto gerado na tabela public.financial_records
    const newRecord = {
      id: crypto.randomUUID(),
      organization_id,
      contract_id: contract_id || null,
      client_id,
      type: "boleto",
      code_number: codeNumber,
      description: description || "Locação de Equipamento",
      amount: Number(amount),
      due_date,
      status: "Pending",
      bank_provider: "banco_inter",
      inter_nosso_numero: interResponse.nossoNumero || null,
      inter_codigo_solicitacao: interResponse.codigoSolicitacao || null,
      linha_digitavel: interResponse.linhaDigitavel || null,
      codigo_barras: interResponse.codigoBarras || null,
      pix_copia_cola: interResponse.pixCopiaECola || null,
      installment_number: installment_number || 1,
      total_installments: total_installments || 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: savedRecord, error: saveErr } = await supabaseAdmin
      .from("financial_records")
      .insert(newRecord)
      .select("*")
      .single();

    if (saveErr) {
      console.error("Erro ao salvar boleto no financial_records:", saveErr);
      throw saveErr;
    }

    return new Response(JSON.stringify({ success: true, record: savedRecord }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Erro na Edge Function inter_issue_charge:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Falha ao emitir boleto no Banco Inter." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
