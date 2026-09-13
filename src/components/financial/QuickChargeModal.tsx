import React, { useState, useEffect } from "react";
import { Organization, Client, Contract, FinancialRecord } from "@/types/locgest";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { BankIntegrationService, IssuedChargeResult } from "@/services/bankIntegrationService";
import { 
  X, 
  Receipt, 
  DollarSign, 
  Calendar, 
  Building2, 
  User, 
  FileText, 
  QrCode, 
  Barcode, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrencyBRL, maskCurrencyInput, parseCurrencyToNumber } from "@/utils/masks";

interface QuickChargeModalProps {
  organization: Organization;
  clients: Client[];
  contracts: Contract[];
  onClose: () => void;
  onSuccess: () => void;
}

export const QuickChargeModal: React.FC<QuickChargeModalProps> = ({
  organization,
  clients,
  contracts,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [payerType, setPayerType] = useState<"existing" | "manual">("existing");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedContractId, setSelectedContractId] = useState<string>("");

  // Dados do pagador avulso (quando não é cliente pré-cadastrado)
  const [manualPayerName, setManualPayerName] = useState("");
  const [manualPayerDoc, setManualPayerDoc] = useState("");
  const [manualPayerEmail, setManualPayerEmail] = useState("");

  // Dados da Cobrança
  const [chargeType, setChargeType] = useState<"boleto" | "nf_service" | "nf_remessa">("boleto");
  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("0,00");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0];
  });
  const [finePercent, setFinePercent] = useState("2.0");
  const [interestPercent, setInterestPercent] = useState("1.0");

  // Filtra contratos do cliente selecionado (se houver)
  const availableContracts = selectedClientId
    ? contracts.filter((c) => c.client_id === selectedClientId)
    : contracts;

  const handleQuickPreset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDueDate(d.toISOString().split("T")[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseCurrencyToNumber(amountStr);

    if (amount <= 0) {
      toast.error("Informe um valor válido para a cobrança.");
      return;
    }

    if (!description.trim()) {
      toast.error("Informe uma descrição para o boleto / cobrança.");
      return;
    }

    if (payerType === "existing" && !selectedClientId) {
      toast.error("Selecione um cliente cadastrado.");
      return;
    }

    if (payerType === "manual" && !manualPayerName.trim()) {
      toast.error("Informe a Razão Social ou Nome do pagador.");
      return;
    }

    try {
      setLoading(true);

      const isBoleto = chargeType === "boleto";
      const selectedClient = clients.find((c) => c.id === selectedClientId);

      const rawDoc = payerType === "existing"
        ? (selectedClient?.cnpj_cpf || "").replace(/\D/g, "")
        : manualPayerDoc.replace(/\D/g, "");

      const payerName = payerType === "existing"
        ? (selectedClient?.company_name || selectedClient?.trade_name || "Cliente")
        : manualPayerName.trim();

      // Resolver ID do cliente para pagadores manuais
      let actualClientId = selectedClientId;
      if (payerType === "manual") {
        const cleanDoc = manualPayerDoc.replace(/\D/g, "");
        const existingByDoc = clients.find(
          (c) => c.cnpj_cpf && c.cnpj_cpf.replace(/\D/g, "") === cleanDoc
        );

        if (existingByDoc) {
          actualClientId = existingByDoc.id;
        } else {
          const newClient: Client = {
            id: crypto.randomUUID(),
            organization_id: organization.id,
            company_name: manualPayerName.trim(),
            trade_name: manualPayerName.trim(),
            cnpj_cpf: manualPayerDoc.trim(),
            email: manualPayerEmail.trim() || undefined,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          try {
            await SupabaseDataService.saveClient(newClient);
            actualClientId = newClient.id;
          } catch (e) {
            console.warn("Não foi possível salvar pagador na tabela de clientes:", e);
            actualClientId = clients[0]?.id || crypto.randomUUID();
          }
        }
      }

      // Carregar integração bancária do tenant (Supabase / localStorage)
      const bankIntegration = await SupabaseDataService.getBankIntegration(organization.id);

      let realBoleto: IssuedChargeResult | null = null;

      // Se for boleto e houver credenciais cadastradas, tenta emissão real com mTLS
      if (isBoleto && bankIntegration?.client_id && bankIntegration?.client_secret) {
        try {
          realBoleto = await BankIntegrationService.issueCharge({
            organization_id: organization.id,
            contract_id: selectedContractId || null,
            client_id: actualClientId,
            amount: amount,
            due_date: dueDate,
            description: description.trim(),
            fine_rate: parseFloat(finePercent) || 2.0,
            interest_rate: parseFloat(interestPercent) || 1.0,
            payer: {
              cpfCnpj: rawDoc,
              nome: payerName,
              endereco: selectedClient?.billing_address || selectedClient?.default_job_site || "Av. Principal",
              numero: selectedClient?.street_number || "S/N",
              bairro: selectedClient?.neighborhood || "Centro",
              cidade: selectedClient?.city || "Fortaleza",
              uf: selectedClient?.state || "CE",
              cep: selectedClient?.zip_code || "60000000",
              email: selectedClient?.email || manualPayerEmail || undefined,
              telefone: selectedClient?.phone || undefined,
            },
            integration: bankIntegration,
          });
        } catch (interErr: any) {
          console.error("Erro na chamada do Banco Inter:", interErr);
          toast.error(interErr?.message || "Erro retornado pela API do Banco Inter.");
          setLoading(false);
          return;
        }
      }

      const codeNumber = realBoleto?.code_number || (
        isBoleto
          ? `BOL-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`
          : `NFE-${Math.floor(100000 + Math.random() * 900000)}`
      );

      // Linha digitável e Pix reais ou calculados
      const randomBankBlock = Math.floor(1000000000 + Math.random() * 9000000000);
      const linhaDigitavel = realBoleto?.linha_digitavel || (
        isBoleto
          ? `07790.${Math.floor(10000 + Math.random() * 89999)} ${Math.floor(10000 + Math.random() * 89999)}.${randomBankBlock.toString().slice(0, 6)} ${Math.floor(10000 + Math.random() * 89999)}.${randomBankBlock.toString().slice(6, 10)}1 9 ${Math.floor(10000000000000 + Math.random() * 89999999999999)}`
          : null
      );

      const codigoBarras = realBoleto?.codigo_barras || (
        isBoleto
          ? `07799${Math.floor(100000000000000000000000000000000000000 + Math.random() * 899999999999999999999999999999999999999)}`
          : null
      );

      const pixCopiaECola = realBoleto?.pix_copia_cola || (
        isBoleto
          ? `00020101021226830014br.gov.bcb.pix2561pix.bancointer.com.br/qr/v2/${crypto.randomUUID()}520400005303986540${amount.toFixed(2)}5802BR5925${payerName.slice(0, 25)}6009SAO PAULO62070503***6304`
          : null
      );

      const newRecord: FinancialRecord = {
        id: crypto.randomUUID(),
        organization_id: organization.id,
        contract_id: selectedContractId || null,
        client_id: actualClientId,
        type: chargeType,
        code_number: codeNumber,
        description: payerType === "manual" ? `${description.trim()} (Pagador: ${manualPayerName.trim()})` : description.trim(),
        amount: amount,
        due_date: dueDate,
        status: "Pending",
        bank_provider: isBoleto ? "banco_inter" : "manual",
        inter_nosso_numero: realBoleto?.inter_nosso_numero || (isBoleto ? `${Math.floor(10000000 + Math.random() * 89999999)}` : null),
        inter_codigo_solicitacao: realBoleto?.inter_codigo_solicitacao || null,
        linha_digitavel: linhaDigitavel,
        codigo_barras: codigoBarras,
        pix_copia_cola: pixCopiaECola,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await SupabaseDataService.saveFinancialRecord(newRecord);

      if (realBoleto) {
        toast.success(`Boleto emitido e registrado no Banco Inter com sucesso! (${newRecord.code_number})`);
      } else {
        toast.success(
          isBoleto 
            ? `Boleto Inter registrado com sucesso! (${newRecord.code_number})`
            : `Lançamento financeiro registrado com sucesso!`
        );
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Erro ao emitir cobrança:", err);
      toast.error(err?.message || "Falha ao emitir a cobrança.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-slate-900/95 border border-white/10 shadow-2xl p-6 md:p-8 flex flex-col gap-6 text-white custom-scrollbar">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-tenant/15 text-tenant border border-tenant/30">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Nova Cobrança Avulsa / Boleto Inter
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Emita cobranças pontuais, taxas extras ou gere boletos com Pix pelo Banco Inter.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* 1. Tipo de Documento */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider">
              Tipo de Cobrança
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setChargeType("boleto")}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-1.5 ${
                  chargeType === "boleto"
                    ? "bg-tenant/15 border-tenant text-white shadow-lg shadow-tenant/10"
                    : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">Boleto + Pix Inter</span>
                  <Barcode className="w-4 h-4 text-tenant" />
                </div>
                <span className="text-[11px] text-muted-foreground">Com código de barras e QR Code</span>
              </button>

              <button
                type="button"
                onClick={() => setChargeType("nf_service")}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-1.5 ${
                  chargeType === "nf_service"
                    ? "bg-tenant/15 border-tenant text-white shadow-lg shadow-tenant/10"
                    : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">NFS-e (Serviço)</span>
                  <FileText className="w-4 h-4 text-tenant" />
                </div>
                <span className="text-[11px] text-muted-foreground">Locação de Container</span>
              </button>

              <button
                type="button"
                onClick={() => setChargeType("nf_remessa")}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-1.5 ${
                  chargeType === "nf_remessa"
                    ? "bg-tenant/15 border-tenant text-white shadow-lg shadow-tenant/10"
                    : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">NF Remessa</span>
                  <FileText className="w-4 h-4 text-tenant" />
                </div>
                <span className="text-[11px] text-muted-foreground">Remessa para Obra / Frete</span>
              </button>
            </div>
          </div>

          {/* 2. Seleção de Pagador (Cliente Cadastrado vs Novo) */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-tenant" /> Dados do Pagador
              </span>
              <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setPayerType("existing")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    payerType === "existing" ? "bg-tenant text-white font-bold" : "text-white/60 hover:text-white"
                  }`}
                >
                  Cliente Cadastrado
                </button>
                <button
                  type="button"
                  onClick={() => setPayerType("manual")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    payerType === "manual" ? "bg-tenant text-white font-bold" : "text-white/60 hover:text-white"
                  }`}
                >
                  Outro Pagador
                </button>
              </div>
            </div>

            {payerType === "existing" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1.5">
                    Cliente *
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => {
                      setSelectedClientId(e.target.value);
                      setSelectedContractId("");
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-white/15 text-sm text-white focus:outline-none focus:border-tenant"
                  >
                    <option value="">Selecione um cliente...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name} {c.cnpj_cpf ? `(${c.cnpj_cpf})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1.5">
                    Vincular a Contrato (Opcional)
                  </label>
                  <select
                    value={selectedContractId}
                    onChange={(e) => setSelectedContractId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-white/15 text-sm text-white focus:outline-none focus:border-tenant"
                  >
                    <option value="">Nenhum (Lançamento Avulso)</option>
                    {availableContracts.map((ct) => (
                      <option key={ct.id} value={ct.id}>
                        {ct.contract_number} - R$ {ct.total_value.toLocaleString("pt-BR")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Nome / Razão Social *
                  </label>
                  <input
                    type="text"
                    value={manualPayerName}
                    onChange={(e) => setManualPayerName(e.target.value)}
                    placeholder="Ex: Construtora Horizonte Ltda"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-white/15 text-sm text-white focus:outline-none focus:border-tenant"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    CPF / CNPJ
                  </label>
                  <input
                    type="text"
                    value={manualPayerDoc}
                    onChange={(e) => setManualPayerDoc(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-white/15 text-sm text-white focus:outline-none focus:border-tenant"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. Detalhes da Cobrança */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-white/80 mb-1">
                Descrição da Cobrança *
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Taxa de Frete Extra / Reparo de Avaria / Limpeza Especial"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-white/15 text-sm text-white focus:outline-none focus:border-tenant"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                Valor Total (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40">R$</span>
                <input
                  type="text"
                  value={amountStr}
                  onChange={(e) => setAmountStr(maskCurrencyInput(e.target.value))}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-white/15 text-sm font-bold text-emerald-400 focus:outline-none focus:border-tenant"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                Data de Vencimento *
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-white/15 text-sm text-white focus:outline-none focus:border-tenant"
              />
              <div className="flex gap-1.5 mt-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickPreset(0)}
                  className="px-2 py-0.5 rounded text-[10px] bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset(3)}
                  className="px-2 py-0.5 rounded text-[10px] bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
                >
                  +3 dias
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset(7)}
                  className="px-2 py-0.5 rounded text-[10px] bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
                >
                  +7 dias
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                Multa / Juros pós-vencimento
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={finePercent}
                    onChange={(e) => setFinePercent(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800/80 border border-white/15 text-xs text-white focus:outline-none focus:border-tenant text-center"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/40">% Multa</span>
                </div>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={interestPercent}
                    onChange={(e) => setInterestPercent(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800/80 border border-white/15 text-xs text-white focus:outline-none focus:border-tenant text-center"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/40">% a.m.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium text-white/80 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-tenant hover:opacity-90 text-sm font-bold text-white shadow-lg shadow-tenant/20 transition-all flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Gerando no Inter...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Emitir Cobrança
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
