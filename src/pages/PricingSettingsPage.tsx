import React, { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { EquipmentCatalog, EquipmentPricing } from "@/types/locgest";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { Coins, Search, Layers, Plus, Save, Edit3, X, Check, DollarSign, Loader2, Tag } from "lucide-react";
import { toast } from "sonner";
import { formatCurrencyBRL, maskCurrencyInput, parseCurrencyToNumber } from "@/utils/masks";

export const PricingSettingsPage: React.FC = () => {
  const { organization } = useTenant();
  const [catalogList, setCatalogList] = useState<EquipmentCatalog[]>([]);
  const [pricingList, setPricingList] = useState<EquipmentPricing[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savingItemIds, setSavingItemIds] = useState<Record<string, boolean>>({});

  // Editing buffer state for inline row edits using masked string inputs
  const [editBuffer, setEditBuffer] = useState<{
    daily_rate_str: string;
    monthly_rate_str: string;
    size_dimension: string;
  }>({ daily_rate_str: "", monthly_rate_str: "", size_dimension: "" });

  // Modal Add New Model state
  const [showModal, setShowModal] = useState(false);
  const [newModelData, setNewModelData] = useState({
    name: "",
    category: "Containers",
    brand_model: "",
    size_dimension: "20 Pés (6m)",
    daily_rate_str: "100,00",
    monthly_rate_str: "2.000,00",
    description: "",
  });

  const categories = ["ALL", "Containers", "Escavação", "Geradores", "Elevação", "Compactação", "Ferramentas"];

  const loadData = async () => {
    const [catList, prcList] = await Promise.all([
      SupabaseDataService.getEquipmentCatalog(organization.id),
      SupabaseDataService.getEquipmentPricing(organization.id),
    ]);
    setCatalogList(catList);
    setPricingList(prcList);
  };

  useEffect(() => {
    loadData();
  }, [organization.id]);

  const handleStartEdit = (item: EquipmentCatalog) => {
    setEditingId(item.id);
    const existingPrc = pricingList.find((p) => p.catalog_id === item.id);
    const dailyRate = existingPrc?.daily_rate ?? item.daily_rate ?? 0;
    const monthlyRate = existingPrc?.monthly_rate ?? item.monthly_rate ?? 0;
    const sizeDim = existingPrc?.size_dimension ?? item.size_dimension ?? "Padrão";

    setEditBuffer({
      daily_rate_str: dailyRate > 0 ? formatCurrencyBRL(dailyRate) : "",
      monthly_rate_str: monthlyRate > 0 ? formatCurrencyBRL(monthlyRate) : "",
      size_dimension: sizeDim,
    });
  };

  const handleSaveInline = async (item: EquipmentCatalog) => {
    try {
      setSavingItemIds((prev) => ({ ...prev, [item.id]: true }));

      // Update catalog model to save size_dimension changes
      const updatedCatalog: EquipmentCatalog = {
        ...item,
        size_dimension: editBuffer.size_dimension || "Padrão",
        updated_at: new Date().toISOString(),
      };

      const existingPrc = pricingList.find((p) => p.catalog_id === item.id);
      const pricingId = existingPrc?.id || crypto.randomUUID();

      const pricingRecord: EquipmentPricing = {
        id: pricingId,
        organization_id: organization.id,
        catalog_id: item.id,
        daily_rate: parseCurrencyToNumber(editBuffer.daily_rate_str),
        monthly_rate: parseCurrencyToNumber(editBuffer.monthly_rate_str),
        created_at: existingPrc?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await SupabaseDataService.saveEquipmentCatalog(updatedCatalog);
      await SupabaseDataService.saveEquipmentPricing(pricingRecord);
      await loadData();
      toast.success(`Tarifas do modelo "${item.name}" atualizadas!`);
      setEditingId(null);
    } catch (err) {
      toast.error("Erro ao atualizar tarifas do modelo.");
    } finally {
      setSavingItemIds((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!newModelData.name) {
      toast.error("Informe o Nome do Modelo de Equipamento.");
      return;
    }

    try {
      setIsSaving(true);
      const catalogId = crypto.randomUUID();
      const catalogItem: EquipmentCatalog = {
        id: catalogId,
        organization_id: organization.id,
        name: newModelData.name,
        category: newModelData.category,
        brand_model: newModelData.brand_model || null,
        size_dimension: newModelData.size_dimension || "Padrão",
        description: newModelData.description || null,
        images: ["https://images.unsplash.com/photo-1579412690850-bd41cd0af397?w=600&auto=format&fit=crop&q=80"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const pricingRecord: EquipmentPricing = {
        id: crypto.randomUUID(),
        organization_id: organization.id,
        catalog_id: catalogId,
        daily_rate: parseCurrencyToNumber(newModelData.daily_rate_str),
        monthly_rate: parseCurrencyToNumber(newModelData.monthly_rate_str),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await SupabaseDataService.saveEquipmentCatalog(catalogItem);
      await SupabaseDataService.saveEquipmentPricing(pricingRecord);
      await loadData();
      toast.success(`Modelo "${catalogItem.name}" cadastrado com sucesso!`);
      setShowModal(false);
      setNewModelData({
        name: "",
        category: "Containers",
        brand_model: "",
        size_dimension: "20 Pés (6m)",
        daily_rate_str: "100,00",
        monthly_rate_str: "2.000,00",
        description: "",
      });
    } catch (err) {
      toast.error("Erro ao cadastrar novo modelo.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredList = catalogList.filter((item) => {
    const matchesCategory = selectedCategory === "ALL" || item.category === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.brand_model || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.size_dimension || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-card border border-white/10">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Coins className="w-6 h-6 text-tenant" /> Tabela de Preços & Tarifas por Modelo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Defina os valores padrão por <strong>Dia</strong> e por <strong>Mês</strong> conforme o <strong>tamanho / dimensão</strong> de cada equipamento (ex: Container 20 pés vs 40 pés). Estes valores alimentam automaticamente as propostas comerciais.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl bg-tenant text-white text-xs font-bold shadow-lg shadow-tenant/20 hover:opacity-90 transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" /> Novo Modelo & Tarifa
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl glass-panel border border-white/10">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-tenant/20 text-tenant border border-tenant/40 shadow-sm"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              {cat === "ALL" ? "Todas as Categorias" : cat}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, marca ou tamanho..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-tenant"
          />
        </div>
      </div>

      {/* Pricing Table */}
      <div className="rounded-2xl glass-card border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 border-b border-white/10 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Modelo de Equipamento</th>
                <th className="p-4">Categoria</th>
                <th className="p-4">Tamanho / Dimensão</th>
                <th className="p-4">Tarifa Diária (R$)</th>
                <th className="p-4">Tarifa Mensal (R$)</th>
                <th className="p-4 text-right">Ações & Edição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Nenhum modelo de equipamento encontrado. Clique em "+ Novo Modelo & Tarifa" para cadastrar.
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => {
                  const isEditing = editingId === item.id;
                  const isItemSaving = savingItemIds[item.id];

                  return (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      {/* Name & Model */}
                      <td className="p-4 font-bold text-white">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-tenant/20 border border-tenant/30 flex items-center justify-center text-tenant shrink-0">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-white font-bold text-xs">{item.name}</div>
                            {item.brand_model && (
                              <div className="text-[11px] text-muted-foreground font-normal mt-0.5">
                                Fabricante: {item.brand_model}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 text-[11px] font-bold">
                          {item.category}
                        </span>
                      </td>

                      {/* Size, Daily Rate & Monthly Rate reading from EquipmentPricing */}
                      {(() => {
                        const prc = pricingList.find((p) => p.catalog_id === item.id);
                        const sizeDim = prc?.size_dimension || item.size_dimension || "Padrão";
                        const dailyRate = prc?.daily_rate ?? item.daily_rate;
                        const monthlyRate = prc?.monthly_rate ?? item.monthly_rate;

                        return (
                          <>
                            {/* Size / Dimension */}
                            <td className="p-4">
                              {isEditing ? (
                                <input
                                  type="text"
                                  placeholder="ex: 20 pés (6m)"
                                  value={editBuffer.size_dimension}
                                  onChange={(e) => setEditBuffer({ ...editBuffer, size_dimension: e.target.value })}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-tenant text-white text-xs focus:outline-none w-36 font-semibold"
                                />
                              ) : (
                                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold inline-flex items-center gap-1">
                                  <Tag className="w-3 h-3" /> {sizeDim}
                                </span>
                              )}
                            </td>

                            {/* Daily Rate */}
                            <td className="p-4 font-semibold text-slate-200">
                              {isEditing ? (
                                <div className="relative w-36">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">R$</span>
                                  <input
                                    type="text"
                                    placeholder="0,00"
                                    value={editBuffer.daily_rate_str}
                                    onChange={(e) => setEditBuffer({ ...editBuffer, daily_rate_str: maskCurrencyInput(e.target.value) })}
                                    className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-slate-900 border border-tenant text-emerald-400 font-bold text-xs focus:outline-none"
                                  />
                                </div>
                              ) : (
                                <span className="text-slate-300">
                                  {dailyRate && dailyRate > 0
                                    ? `R$ ${formatCurrencyBRL(dailyRate)}/dia`
                                    : "N/A"}
                                </span>
                              )}
                            </td>

                            {/* Monthly Rate */}
                            <td className="p-4 font-extrabold text-emerald-400 text-sm">
                              {isEditing ? (
                                <div className="relative w-36">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">R$</span>
                                  <input
                                    type="text"
                                    placeholder="0,00"
                                    value={editBuffer.monthly_rate_str}
                                    onChange={(e) => setEditBuffer({ ...editBuffer, monthly_rate_str: maskCurrencyInput(e.target.value) })}
                                    className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-slate-900 border border-tenant text-emerald-400 font-bold text-xs focus:outline-none"
                                  />
                                </div>
                              ) : (
                                <span>
                                  {monthlyRate && monthlyRate > 0
                                    ? `R$ ${formatCurrencyBRL(monthlyRate)}/mês`
                                    : "Sob Consulta"}
                                </span>
                              )}
                            </td>
                          </>
                        );
                      })()}

                      {/* Actions */}
                      <td className="p-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleSaveInline(item)}
                              disabled={isItemSaving}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1 disabled:opacity-50"
                            >
                              {isItemSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                              Salvar
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white text-xs font-bold transition-all"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(item)}
                            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-tenant/20 text-muted-foreground hover:text-tenant border border-white/10 hover:border-tenant/40 text-xs font-bold transition-all flex items-center gap-1.5 ml-auto"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-400" /> Editar Preços
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add New Model & Pricing */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg p-6 rounded-2xl glass-panel border border-white/20 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-tenant" /> Novo Modelo de Equipamento & Tarifa
              </h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateModel} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1 font-semibold">Nome do Modelo *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Container Depósito Almoxarifado"
                  value={newModelData.name}
                  onChange={(e) => setNewModelData({ ...newModelData, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">Categoria *</label>
                  <select
                    value={newModelData.category}
                    onChange={(e) => setNewModelData({ ...newModelData, category: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-tenant font-semibold"
                  >
                    {categories.filter((c) => c !== "ALL").map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">Tamanho / Dimensão *</label>
                  <input
                    type="text"
                    placeholder="ex: 20 pés (6m) ou 40 pés (12m)"
                    value={newModelData.size_dimension}
                    onChange={(e) => setNewModelData({ ...newModelData, size_dimension: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">Tarifa Diária (R$) (Opcional)</label>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={newModelData.daily_rate_str}
                    onChange={(e) => setNewModelData({ ...newModelData, daily_rate_str: maskCurrencyInput(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-emerald-400 font-bold focus:outline-none focus:border-tenant font-mono"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">Tarifa Mensal (R$) *</label>
                  <input
                    type="text"
                    required
                    placeholder="0,00"
                    value={newModelData.monthly_rate_str}
                    onChange={(e) => setNewModelData({ ...newModelData, monthly_rate_str: maskCurrencyInput(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-emerald-400 font-bold focus:outline-none focus:border-tenant font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Fabricante / Marca / Modelo</label>
                <input
                  type="text"
                  placeholder="ex: Reefer / Thermo King"
                  value={newModelData.brand_model}
                  onChange={(e) => setNewModelData({ ...newModelData, brand_model: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Descrição / Especificações Técnicas</label>
                <textarea
                  rows={2}
                  placeholder="ex: Estrutura em aço corten, assoalho naval, travas de alta segurança..."
                  value={newModelData.description}
                  onChange={(e) => setNewModelData({ ...newModelData, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-tenant text-white font-bold shadow-lg shadow-tenant/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Cadastrar Modelo & Salvar Tarifas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
