import React, { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { Equipment, Client, Proposal, Contract, FinancialRecord, ServiceOrder } from "@/types/locgest";
import {
  Boxes,
  FileText,
  ShieldCheck,
  Receipt,
  Truck,
  TrendingUp,
  DollarSign,
  PlusCircle,
  Clock
} from "lucide-react";
import { Link } from "react-router-dom";

export const Dashboard: React.FC = () => {
  const { organization } = useTenant();

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [proposalsList, setProposalsList] = useState<Proposal[]>([]);
  const [contractsList, setContractsList] = useState<Contract[]>([]);
  const [financialList, setFinancialList] = useState<FinancialRecord[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);

  const loadData = async () => {
    const [eq, cli, prop, cont, fin, os] = await Promise.all([
      SupabaseDataService.getEquipment(organization.id),
      SupabaseDataService.getClients(organization.id),
      SupabaseDataService.getProposals(organization.id),
      SupabaseDataService.getContracts(organization.id),
      SupabaseDataService.getFinancialRecords(organization.id),
      SupabaseDataService.getServiceOrders(organization.id),
    ]);

    setEquipmentList(eq);
    setClientsList(cli);
    setProposalsList(prop);
    setContractsList(cont);
    setFinancialList(fin);
    setServiceOrders(os);
  };

  useEffect(() => {
    loadData();
  }, [organization.id]);

  const totalRented = equipmentList.filter((e) => e.status === "Rented").length;
  const totalAvailable = equipmentList.filter((e) => e.status === "Available").length;
  const occupancyRate = equipmentList.length ? Math.round((totalRented / equipmentList.length) * 100) : 0;

  const totalRevenue = financialList
    .filter((f) => f.status === "Paid")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const pendingOS = serviceOrders.filter((os) => os.status === "Pending" || os.status === "InRoute").length;

  const chartData = [
    { category: "Escavação", qty: equipmentList.filter(e => e.category.includes("Escavação")).length, color: "#0284c7" },
    { category: "Geradores", qty: equipmentList.filter(e => e.category.includes("Geradores")).length, color: "#16a34a" },
    { category: "Carga", qty: equipmentList.filter(e => e.category.includes("Carga")).length, color: "#f59e0b" },
    { category: "Compactação", qty: equipmentList.filter(e => e.category.includes("Compactação")).length, color: "#ec4899" },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl glass-card border border-white/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-tenant/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Painel de Gestão - {organization.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Visão consolidada do ciclo de locação, finanças e logística de campo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/proposals"
              className="px-4 py-2.5 rounded-xl bg-tenant text-white text-xs font-bold shadow-lg shadow-tenant/20 hover:opacity-90 transition-all flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" /> Nova Proposta
            </Link>
            <Link
              to="/clients"
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all flex items-center gap-2"
            >
              Ver Clientes (Pasta Cascata)
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="p-5 rounded-2xl glass-card border border-white/5 relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Frota de Máquinas</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">{equipmentList.length} <span className="text-xs font-normal text-muted-foreground">unidades</span></div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">{totalRented} Locados</span>
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 font-bold">{totalAvailable} Livres</span>
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="p-5 rounded-2xl glass-card border border-white/5 relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Taxa de Ocupação</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">{occupancyRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">Frota alocada em contratos ativos</p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="p-5 rounded-2xl glass-card border border-white/5 relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Faturamento Confirmado</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-emerald-400">
              R$ {totalRevenue.toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">NFs & Boletos quitados</p>
          </div>
        </div>

        {/* Card 4 */}
        <div className="p-5 rounded-2xl glass-card border border-white/5 relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">OS de Logística Pátio</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">{pendingOS} <span className="text-xs font-normal text-muted-foreground">pendentes</span></div>
            <p className="text-xs text-muted-foreground mt-1">Entregas em campo com GPS/Foto</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fleet Distribution Chart / Status */}
        <div className="lg:col-span-2 p-6 rounded-2xl glass-card border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Boxes className="w-4 h-4 text-tenant" /> Distribuição da Frota por Categoria
            </h3>
            <span className="text-xs text-muted-foreground font-medium">Equipamentos Cadastrados</span>
          </div>

          {equipmentList.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Nenhum equipamento cadastrado na frota desta organização.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {chartData.map((d, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">{d.category}</span>
                  <div className="text-xl font-bold text-white">{d.qty} <span className="text-[10px] text-muted-foreground font-normal">un</span></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="p-6 rounded-2xl glass-card border border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-tenant" /> Atividades Recentes
          </h3>

          <div className="space-y-3">
            {proposalsList.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">Nenhuma proposta ou atividade registrada.</p>
            ) : (
              proposalsList.slice(0, 4).map((p) => (
                <div key={p.id} className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{p.proposal_number}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      p.status === "Approved" ? "bg-emerald-500/20 text-emerald-400" : "bg-sky-500/20 text-sky-400"
                    }`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{p.client?.company_name || "Cliente"}</p>
                  <p className="text-xs font-extrabold text-emerald-400">R$ {p.total_amount.toLocaleString("pt-BR")}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
