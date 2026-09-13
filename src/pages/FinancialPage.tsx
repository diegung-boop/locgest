import React, { useState, useEffect, useMemo } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { FinancialRecord, Contract, ServiceOrder, Client, PricingTierRule } from "@/types/locgest";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { ContractFinancialCard } from "@/components/financial/ContractFinancialCard";
import { QuickChargeModal } from "@/components/financial/QuickChargeModal";
import { GenerateContractBoletosModal } from "@/components/financial/GenerateContractBoletosModal";
import { 
  Receipt, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Filter, 
  Maximize2, 
  Minimize2, 
  Layers, 
  FileText,
  Building2,
  RefreshCw,
  Info,
  Plus,
  Sparkles,
  Barcode
} from "lucide-react";
import { toast } from "sonner";

export const FinancialPage: React.FC = () => {
  const { organization } = useTenant();
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tierRules, setTierRules] = useState<PricingTierRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Modais
  const [isQuickChargeOpen, setIsQuickChargeOpen] = useState(false);
  const [contractToGenerateBoletos, setContractToGenerateBoletos] = useState<Contract | null>(null);

  // Filtros e busca
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid" | "overdue">("all");
  const [showOnlyWithRecords, setShowOnlyWithRecords] = useState(false);
  
  // Controle de acordeão / expansão
  const [expandedContractIds, setExpandedContractIds] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    try {
      setLoading(true);
      const [recordsList, contractsList, clientsList, rulesList] = await Promise.all([
        SupabaseDataService.getFinancialRecords(organization.id),
        SupabaseDataService.getContracts(organization.id),
        SupabaseDataService.getClients(organization.id),
        SupabaseDataService.getPricingTierRules(organization.id),
      ]);
      setFinancialRecords(recordsList);
      setContracts(contractsList);
      setClients(clientsList);
      setTierRules(rulesList);

      // Iniciar com os contratos expandidos caso haja poucos (ex: até 4)
      const initialExpanded: Record<string, boolean> = {};
      contractsList.slice(0, 4).forEach((c) => {
        initialExpanded[c.id] = true;
      });
      initialExpanded["unassigned"] = true;
      setExpandedContractIds(initialExpanded);
    } catch (err) {
      console.error("Erro ao carregar dados financeiros:", err);
      toast.error("Erro ao carregar registros financeiros.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organization.id]);

  const handleConfirmPayment = async (record: FinancialRecord) => {
    if (loadingId) return;

    try {
      setLoadingId(record.id);

      const updatedRecord: FinancialRecord = {
        ...record,
        status: "Paid",
        paid_at: new Date().toISOString(),
      };

      await SupabaseDataService.saveFinancialRecord(updatedRecord);

      // Se houver contrato vinculado, dispara automaticamente a Ordem de Serviço (OS) para a Logística
      if (record.contract_id) {
        const newOS: ServiceOrder = {
          id: crypto.randomUUID(),
          organization_id: organization.id,
          contract_id: record.contract_id,
          client_id: record.client_id,
          os_number: `OS-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
          type: "Delivery",
          status: "Pending",
          scheduled_date: new Date().toISOString().split("T")[0],
          job_site_address: record.client?.default_job_site || "Obra do Cliente",
          photos: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await SupabaseDataService.saveServiceOrder(newOS);
        toast.success(`Pagamento confirmado! Ordem de Serviço (OS) ${newOS.os_number} disparada para a Logística.`);
      } else {
        toast.success(`Pagamento da cobrança avulsa ${record.code_number} confirmado com sucesso!`);
      }

      await loadData();
    } catch (err) {
      toast.error("Erro ao confirmar pagamento.");
    } finally {
      setLoadingId(null);
    }
  };

  const toggleExpand = (contractId: string) => {
    setExpandedContractIds((prev) => ({
      ...prev,
      [contractId]: !prev[contractId],
    }));
  };

  const handleExpandAll = (expand: boolean) => {
    const updated: Record<string, boolean> = {};
    contracts.forEach((c) => {
      updated[c.id] = expand;
    });
    updated["unassigned"] = expand;
    setExpandedContractIds(updated);
  };

  const today = new Date().toISOString().split("T")[0];

  // Agrupamento de contratos e registros
  const { groupedData, unassignedRecords, kpis } = useMemo(() => {
    const contractMap = new Map<string, FinancialRecord[]>();
    const unassigned: FinancialRecord[] = [];

    // Mapear registros para os contratos correspondentes
    financialRecords.forEach((record) => {
      if (record.contract_id && contracts.some((c) => c.id === record.contract_id)) {
        const list = contractMap.get(record.contract_id) || [];
        list.push(record);
        contractMap.set(record.contract_id, list);
      } else {
        unassigned.push(record);
      }
    });

    let groups = contracts.map((contract) => {
      const records = contractMap.get(contract.id) || [];
      const totalPaid = records
        .filter((r) => r.status === "Paid" && r.type === "boleto")
        .reduce((acc, r) => acc + r.amount, 0);

      const totalPending = records
        .filter((r) => r.status === "Pending" && r.type === "boleto")
        .reduce((acc, r) => acc + r.amount, 0);

      const hasOverdue = records.some((r) => r.status === "Pending" && r.due_date < today);
      const isFullyPaid = contract.total_value > 0 && totalPaid >= contract.total_value;

      return {
        contract,
        records,
        totalPaid,
        totalPending,
        hasOverdue,
        isFullyPaid,
      };
    });

    // Se a flag "apenas com registros" estiver ativa
    if (showOnlyWithRecords) {
      groups = groups.filter((g) => g.records.length > 0);
    }

    // Filtrar por termo de busca
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      groups = groups.filter((g) => {
        const matchContract =
          g.contract.contract_number.toLowerCase().includes(term) ||
          g.contract.client?.company_name.toLowerCase().includes(term) ||
          g.contract.client?.trade_name?.toLowerCase().includes(term) ||
          g.contract.proposal?.job_site_name?.toLowerCase().includes(term) ||
          g.contract.proposal?.job_site_address?.toLowerCase().includes(term);

        const matchRecord = g.records.some(
          (r) => 
            r.code_number.toLowerCase().includes(term) || 
            r.description?.toLowerCase().includes(term)
        );

        return matchContract || matchRecord;
      });
    }

    // Filtrar por status
    if (statusFilter === "pending") {
      groups = groups.filter((g) => g.totalPending > 0);
    } else if (statusFilter === "paid") {
      groups = groups.filter((g) => g.isFullyPaid);
    } else if (statusFilter === "overdue") {
      groups = groups.filter((g) => g.hasOverdue);
    }

    // Cálculo dos KPIs Globais
    const totalReceived = financialRecords
      .filter((r) => r.status === "Paid")
      .reduce((acc, r) => acc + r.amount, 0);

    const totalToReceive = financialRecords
      .filter((r) => r.status === "Pending")
      .reduce((acc, r) => acc + r.amount, 0);

    const totalOverdue = financialRecords
      .filter((r) => r.status === "Pending" && r.due_date < today)
      .reduce((acc, r) => acc + r.amount, 0);

    const boletosCount = financialRecords.filter((r) => r.type === "boleto").length;

    return {
      groupedData: groups,
      unassignedRecords: unassigned,
      kpis: {
        totalReceived,
        totalToReceive,
        totalOverdue,
        boletosCount,
      },
    };
  }, [financialRecords, contracts, searchTerm, statusFilter, showOnlyWithRecords, today]);

  return (
    <div className="space-y-6">
      {/* Header com Ações Principais */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-card border border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Receipt className="w-6 h-6 text-tenant" /> Módulo Financeiro & Boletos Inter
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-tenant/15 text-tenant border border-tenant/30">
              Banco Inter Integrado
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de boletos híbridos (Código de Barras + Pix), parcelamento automático por contrato e cobranças pontuais.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-medium transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>

          <button
            onClick={() => setIsQuickChargeOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-tenant hover:opacity-90 text-white text-xs font-bold transition-all shadow-lg shadow-tenant/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nova Cobrança Avulsa / Boleto
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total a Receber */}
        <div className="p-5 rounded-2xl glass-card border border-white/10 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>A Receber (Pendente)</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400 tracking-tight">
            R$ {kpis.totalToReceive.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-white/40">Boletos e títulos aguardando liquidação</p>
        </div>

        {/* Total Recebido */}
        <div className="p-5 rounded-2xl glass-card border border-white/10 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Recebido (Pago)</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 tracking-tight">
            R$ {kpis.totalReceived.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-white/40">Faturamento liquidado via Boleto / Pix</p>
        </div>

        {/* Total Em Atraso */}
        <div className="p-5 rounded-2xl glass-card border border-white/10 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Vencido / Em Atraso</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-400 tracking-tight">
            R$ {kpis.totalOverdue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-white/40">Títulos com vencimento anterior a hoje</p>
        </div>

        {/* Boletos Emitidos */}
        <div className="p-5 rounded-2xl glass-card border border-white/10 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Boletos Inter Emitidos</span>
            <div className="p-2 rounded-lg bg-tenant/10 text-tenant">
              <Barcode className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {kpis.boletosCount}
          </div>
          <p className="text-[11px] text-white/40">Boletos registrados no sistema</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 rounded-2xl glass-card border border-white/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por Contrato (CONT-...), Razão Social, CNPJ ou Nº do Boleto..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-tenant transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 rounded-lg transition-all font-medium ${
                statusFilter === "all" ? "bg-tenant text-white shadow-sm" : "text-muted-foreground hover:text-white"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1 rounded-lg transition-all font-medium ${
                statusFilter === "pending" ? "bg-amber-500/20 text-amber-300 shadow-sm" : "text-muted-foreground hover:text-white"
              }`}
            >
              Pendentes
            </button>
            <button
              onClick={() => setStatusFilter("paid")}
              className={`px-3 py-1 rounded-lg transition-all font-medium ${
                statusFilter === "paid" ? "bg-emerald-500/20 text-emerald-300 shadow-sm" : "text-muted-foreground hover:text-white"
              }`}
            >
              Quitados
            </button>
            <button
              onClick={() => setStatusFilter("overdue")}
              className={`px-3 py-1 rounded-lg transition-all font-medium ${
                statusFilter === "overdue" ? "bg-rose-500/20 text-rose-300 shadow-sm" : "text-muted-foreground hover:text-white"
              }`}
            >
              Atrasados
            </button>
          </div>

          {/* Toggle expand/collapse all */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
            <button
              onClick={() => handleExpandAll(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs flex items-center gap-1 border border-white/10 transition-colors"
              title="Expandir todos os contratos"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleExpandAll(false)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs flex items-center gap-1 border border-white/10 transition-colors"
              title="Recolher todos os contratos"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Contract Groups List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 rounded-2xl glass-card border border-white/10 text-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-tenant mx-auto" />
            <p className="text-xs text-muted-foreground">Carregando faturamentos por contrato...</p>
          </div>
        ) : groupedData.length === 0 && unassignedRecords.length === 0 ? (
          <div className="p-12 rounded-2xl glass-card border border-white/10 text-center space-y-3">
            <Receipt className="w-8 h-8 text-muted-foreground/50 mx-auto" />
            <h3 className="text-sm font-semibold text-white">Nenhum registro financeiro encontrado</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchTerm || statusFilter !== "all"
                ? "Nenhum contrato ou lançamento corresponde aos filtros selecionados."
                : "Quando os contratos forem aprovados e assinados, você poderá gerar os boletos automáticos do Inter aqui."}
            </p>
          </div>
        ) : (
          <>
            {/* Lista de Contratos Agrupados */}
            {groupedData.map((group) => (
              <ContractFinancialCard
                key={group.contract.id}
                contract={group.contract}
                records={group.records}
                isExpanded={Boolean(expandedContractIds[group.contract.id])}
                onToggleExpand={() => toggleExpand(group.contract.id)}
                onConfirmPayment={handleConfirmPayment}
                onOpenGenerateModal={(ct) => setContractToGenerateBoletos(ct)}
                loadingId={loadingId}
              />
            ))}

            {/* Grupo de Lançamentos Avulsos (Sem Contrato Vinculado) */}
            {unassignedRecords.length > 0 && (
              <ContractFinancialCard
                key="unassigned"
                contract={null}
                records={unassignedRecords}
                isExpanded={Boolean(expandedContractIds["unassigned"])}
                onToggleExpand={() => toggleExpand("unassigned")}
                onConfirmPayment={handleConfirmPayment}
                loadingId={loadingId}
              />
            )}
          </>
        )}
      </div>

      {/* Modal 1: Cobrança Avulsa / Pontual */}
      {isQuickChargeOpen && (
        <QuickChargeModal
          organization={organization}
          clients={clients}
          contracts={contracts}
          onClose={() => setIsQuickChargeOpen(false)}
          onSuccess={loadData}
        />
      )}

      {/* Modal 2: Gerar Boletos do Contrato (Regra da Empresa) */}
      {contractToGenerateBoletos && (
        <GenerateContractBoletosModal
          contract={contractToGenerateBoletos}
          organization={organization}
          tierRules={tierRules}
          existingRecords={financialRecords.filter((r) => r.contract_id === contractToGenerateBoletos.id)}
          onClose={() => setContractToGenerateBoletos(null)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
};
