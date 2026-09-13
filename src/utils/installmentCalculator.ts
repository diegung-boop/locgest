import { Contract, PricingTierRule, FinancialRecord } from "@/types/locgest";
import { addDays, format } from "date-fns";

export interface GeneratedInstallment {
  installment_number: number;
  total_installments: number;
  description: string;
  amount: number;
  due_date: string;
  breakdown: {
    lease_amount: number;
    freight_delivery: number;
    freight_retrieval: number;
    other_fees: number;
  };
}

/**
 * Calcula o cronograma de parcelas e boletos para um Contrato com base nas faixas de prazo da empresa
 */
export function calculateContractInstallments(
  contract: Contract,
  tierRules: PricingTierRule[]
): GeneratedInstallment[] {
  const proposal = contract.proposal;
  const items = proposal?.equipment_items || [];
  
  // 1. Determinar a duração em meses e o valor mensal
  let durationMonths = 1;
  let totalMonthlyRate = 0;
  let deliveryFreight = 0;
  let retrievalFreight = 0;

  if (items.length > 0) {
    durationMonths = items[0].duration_months || 1;
    totalMonthlyRate = items.reduce((sum, item) => sum + (item.monthly_rate * (item.qty || 1)), 0);
  } else {
    // Caso não haja itens detalhados, deduzir das datas
    if (contract.start_date && contract.end_date) {
      const start = new Date(contract.start_date);
      const end = new Date(contract.end_date);
      const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      durationMonths = Math.max(1, Math.round(diffDays / 30));
    }
    totalMonthlyRate = contract.total_value / (durationMonths || 1);
  }

  // 2. Encontrar a regra de faixa de prazo correspondente
  const sortedRules = [...tierRules].sort((a, b) => a.min_months - b.min_months);
  const matchedRule = sortedRules.find(
    (r) => durationMonths >= r.min_months && (r.max_months === null || durationMonths <= r.max_months)
  );

  if (matchedRule) {
    deliveryFreight = matchedRule.freight_delivery || 0;
    retrievalFreight = matchedRule.freight_retrieval || 0;
    if (matchedRule.monthly_rate > 0) {
      totalMonthlyRate = matchedRule.monthly_rate;
    }
  }

  const startDate = contract.start_date ? new Date(contract.start_date) : new Date();
  const installments: GeneratedInstallment[] = [];

  // ==========================================
  // CENÁRIO 1: 1 MÊS (À vista na assinatura)
  // ==========================================
  if (durationMonths <= 1) {
    const totalAmount = totalMonthlyRate + deliveryFreight + retrievalFreight;
    const dueDateStr = format(addDays(startDate, 1), "yyyy-MM-dd");

    installments.push({
      installment_number: 1,
      total_installments: 1,
      description: `Locação (1 Mês) + Frete Entrega + Frete Retirada`,
      amount: totalAmount > 0 ? totalAmount : contract.total_value,
      due_date: dueDateStr,
      breakdown: {
        lease_amount: totalMonthlyRate,
        freight_delivery: deliveryFreight,
        freight_retrieval: retrievalFreight,
        other_fees: 0,
      },
    });
    return installments;
  }

  // ==========================================
  // CENÁRIO 2: 2 MESES
  // 1ª: Locação + Frete Entrega (10 dias)
  // 2ª: Locação + Frete Retirada (30 dias)
  // ==========================================
  if (durationMonths === 2) {
    const due1 = format(addDays(startDate, 10), "yyyy-MM-dd");
    const due2 = format(addDays(startDate, 30), "yyyy-MM-dd");

    installments.push({
      installment_number: 1,
      total_installments: 2,
      description: `1ª Parcela (1/2): Locação + Frete Entrega (10 dias)`,
      amount: totalMonthlyRate + deliveryFreight,
      due_date: due1,
      breakdown: {
        lease_amount: totalMonthlyRate,
        freight_delivery: deliveryFreight,
        freight_retrieval: 0,
        other_fees: 0,
      },
    });

    installments.push({
      installment_number: 2,
      total_installments: 2,
      description: `2ª Parcela (2/2): Locação + Frete Retirada (30 dias)`,
      amount: totalMonthlyRate + retrievalFreight,
      due_date: due2,
      breakdown: {
        lease_amount: totalMonthlyRate,
        freight_delivery: 0,
        freight_retrieval: retrievalFreight,
        other_fees: 0,
      },
    });

    return installments;
  }

  // ==========================================
  // CENÁRIO 3: 3+ MESES (Em diante)
  // 1ª: Locação + Frete Entrega (10 dias)
  // 2ª: Locação + Frete Retirada (30 dias)
  // 3ª em diante: Apenas Locação a cada 30 dias
  // ==========================================
  const totalParcelas = durationMonths;

  // 1ª Parcela (10 dias)
  installments.push({
    installment_number: 1,
    total_installments: totalParcelas,
    description: `1ª Parcela (1/${totalParcelas}): Locação + Frete Entrega (10 dias)`,
    amount: totalMonthlyRate + deliveryFreight,
    due_date: format(addDays(startDate, 10), "yyyy-MM-dd"),
    breakdown: {
      lease_amount: totalMonthlyRate,
      freight_delivery: deliveryFreight,
      freight_retrieval: 0,
      other_fees: 0,
    },
  });

  // 2ª Parcela (30 dias)
  installments.push({
    installment_number: 2,
    total_installments: totalParcelas,
    description: `2ª Parcela (2/${totalParcelas}): Locação + Frete Retirada (30 dias)`,
    amount: totalMonthlyRate + retrievalFreight,
    due_date: format(addDays(startDate, 30), "yyyy-MM-dd"),
    breakdown: {
      lease_amount: totalMonthlyRate,
      freight_delivery: 0,
      freight_retrieval: retrievalFreight,
      other_fees: 0,
    },
  });

  // 3ª até N parcelas (a cada 30 dias)
  for (let i = 3; i <= totalParcelas; i++) {
    const dueMonth = format(addDays(startDate, 30 * (i - 1)), "yyyy-MM-dd");
    installments.push({
      installment_number: i,
      total_installments: totalParcelas,
      description: `${i}ª Parcela (${i}/${totalParcelas}): Locação Mensal`,
      amount: totalMonthlyRate,
      due_date: dueMonth,
      breakdown: {
        lease_amount: totalMonthlyRate,
        freight_delivery: 0,
        freight_retrieval: 0,
        other_fees: 0,
      },
    });
  }

  return installments;
}

/**
 * Converte parcelas geradas em registros reais de boletos
 */
export function buildBoletoRecordFromInstallment(
  installment: GeneratedInstallment,
  contract: Contract,
  organizationId: string
): FinancialRecord {
  const codeNumber = `BOL-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  const randomBankBlock = Math.floor(1000000000 + Math.random() * 9000000000);
  const linhaDigitavel = `07790.${Math.floor(10000 + Math.random() * 89999)} ${Math.floor(10000 + Math.random() * 89999)}.${randomBankBlock.toString().slice(0, 6)} ${Math.floor(10000 + Math.random() * 89999)}.${randomBankBlock.toString().slice(6, 10)}1 9 ${Math.floor(10000000000000 + Math.random() * 89999999999999)}`;
  const codigoBarras = `07799${Math.floor(100000000000000000000000000000000000000 + Math.random() * 899999999999999999999999999999999999999)}`;
  const pixCopiaECola = `00020101021226830014br.gov.bcb.pix2561pix.bancointer.com.br/qr/v2/${crypto.randomUUID()}520400005303986540${installment.amount.toFixed(2)}5802BR5925${(contract.client?.company_name || "LOCGEST").slice(0, 25)}6009SAO PAULO62070503***6304`;

  return {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    contract_id: contract.id,
    client_id: contract.client_id,
    contract: contract,
    client: contract.client,
    type: "boleto",
    code_number: codeNumber,
    description: installment.description,
    amount: installment.amount,
    due_date: installment.due_date,
    status: "Pending",
    bank_provider: "banco_inter",
    inter_nosso_numero: `${Math.floor(10000000 + Math.random() * 89999999)}`,
    linha_digitavel: linhaDigitavel,
    codigo_barras: codigoBarras,
    pix_copia_cola: pixCopiaECola,
    installment_number: installment.installment_number,
    total_installments: installment.total_installments,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
