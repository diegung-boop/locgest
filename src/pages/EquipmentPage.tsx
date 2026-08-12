import React, { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { EquipmentAsset, EquipmentCatalog, EquipmentPricing, EquipmentStatus } from "@/types/locgest";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { Boxes, Plus, Search, Tag, MapPin, Edit3, Copy, X, Layers, AlertCircle, Building, CheckCircle2, Loader2, Coins } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { formatCurrencyBRL, maskCurrencyInput, parseCurrencyToNumber } from "@/utils/masks";

export const EquipmentPage: React.FC = () => {
  const { organization } = useTenant();
  const navigate = useNavigate();

  const [assetList, setAssetList] = useState<EquipmentAsset[]>([]);
  const [catalogList, setCatalogList] = useState<EquipmentCatalog[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<EquipmentAsset | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const initialFormState = {
    catalog_id: "",
    code: "",
    serial_number: "",
    size_dimension: "20 Pés (6m)",
    daily_rate_str: "100,00",
    monthly_rate_str: "2.000,00",
    qty: 1, // Batch creation count
    status: "Available" as EquipmentStatus,
    location_current: "Pátio Central",
  };

  const [formData, setFormData] = useState(initialFormState);

  const loadData = async () => {
    const catalog = await SupabaseDataService.getEquipmentCatalog(organization.id);
    const assets = await SupabaseDataService.getEquipmentAssets(organization.id);
    setCatalogList(catalog);
    setAssetList(assets);

    if (catalog.length > 0 && !formData.catalog_id) {
      setFormData((prev) => ({ ...prev, catalog_id: catalog[0].id }));
    }
  };

  useEffect(() => {
    loadData();
  }, [organization.id]);

  const handleOpenCreateModal = () => {
    if (catalogList.length === 0) {
      toast.warning("Cadastre primeiro um Modelo no Catálogo de Equipamentos.");
      navigate("/catalog");
      return;
    }
    setEditingAsset(null);
    setFormData({
      ...initialFormState,
      catalog_id: catalogList[0]?.id || "",
    });
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (asset: EquipmentAsset) => {
    setEditingAsset(asset);
    const dailyRate = asset.pricing_item?.daily_rate || 0;
    const monthlyRate = asset.pricing_item?.monthly_rate || 0;

    setFormData({
      catalog_id: asset.catalog_id,
      code: asset.code,
      serial_number: asset.serial_number || "",
      size_dimension: asset.pricing_item?.size_dimension || "Padrão",
      daily_rate_str: dailyRate > 0 ? formatCurrencyBRL(dailyRate) : "0,00",
      monthly_rate_str: monthlyRate > 0 ? formatCurrencyBRL(monthlyRate) : "0,00",
      qty: 1,
      status: asset.status,
      location_current: asset.location_current,
    });
    setShowCreateModal(true);
  };

  const handleCloneAsset = (asset: EquipmentAsset) => {
    setEditingAsset(null);
    const dailyRate = asset.pricing_item?.daily_rate || 0;
    const monthlyRate = asset.pricing_item?.monthly_rate || 0;

    setFormData({
      catalog_id: asset.catalog_id,
      code: `${asset.code}-CLONED`,
      serial_number: "",
      size_dimension: asset.pricing_item?.size_dimension || "Padrão",
      daily_rate_str: dailyRate > 0 ? formatCurrencyBRL(dailyRate) : "0,00",
      monthly_rate_str: monthlyRate > 0 ? formatCurrencyBRL(monthlyRate) : "0,00",
      qty: 1,
      status: "Available",
      location_current: asset.location_current,
    });
    setShowCreateModal(true);
    toast.info(`Dados preenchidos para clonar patrimônio de ${asset.code}`);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!formData.code || !formData.catalog_id) {
      toast.error("Selecione o Modelo do Catálogo e informe a TAG do Patrimônio.");
      return;
    }

    try {
      setIsSaving(true);

      // 1. Create or Update Pricing for this Catalog Model + Size
      const pricingId = editingAsset?.pricing_id || crypto.randomUUID();
      const pricingRecord: EquipmentPricing = {
        id: pricingId,
        organization_id: organization.id,
        catalog_id: formData.catalog_id,
        size_dimension: formData.size_dimension || "Padrão",
        daily_rate: parseCurrencyToNumber(formData.daily_rate_str),
        monthly_rate: parseCurrencyToNumber(formData.monthly_rate_str),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await SupabaseDataService.saveEquipmentPricing(pricingRecord);

      // 2. Create Asset(s) linking catalog_id and pricing_id
      const quantity = editingAsset ? 1 : Math.max(1, Number(formData.qty) || 1);

      for (let i = 0; i < quantity; i++) {
        const codeSuffix = quantity > 1 ? `-${String(i + 1).padStart(3, "0")}` : "";
        const itemCode = `${formData.code.toUpperCase()}${codeSuffix}`;
        const itemSerial = formData.serial_number 
          ? (quantity > 1 ? `${formData.serial_number}${codeSuffix}` : formData.serial_number)
          : `SN-${Math.floor(Math.random() * 90000 + 10000)}`;

        const newAsset: EquipmentAsset = {
          id: editingAsset ? editingAsset.id : crypto.randomUUID(),
          organization_id: organization.id,
          catalog_id: formData.catalog_id,
          pricing_id: pricingId,
          code: itemCode,
          serial_number: itemSerial,
          status: formData.status,
          location_current: formData.location_current,
          created_at: editingAsset ? editingAsset.created_at : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await SupabaseDataService.saveEquipmentAsset(newAsset);
      }

      await loadData();
      toast.success(editingAsset ? `Patrimônio ${formData.code} atualizado!` : `${quantity} Patrimônio(s) cadastrado(s) com sucesso!`);
      setFormData(initialFormState);
      setEditingAsset(null);
      setShowCreateModal(false);
    } catch (err) {
      console.error("Error saving physical asset:", err);
      toast.error("Erro ao salvar patrimônio físico.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredAssets = assetList.filter((item) => {
    const catalogName = item.catalog_item?.name || "";
    const matchesSearch =
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      catalogName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location_current.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === "ALL" || item.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: EquipmentStatus) => {
    switch (status) {
      case "Available":
        return <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">Disponível</span>;
      case "Rented":
        return <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-bold border border-sky-500/30 flex items-center gap-1">Alugado</span>;
      case "Maintenance":
        return <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30 flex items-center gap-1">Em Manutenção</span>;
      case "Interno":
        return <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30 flex items-center gap-1">Uso Interno</span>;
      case "InTransit":
        return <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30 flex items-center gap-1">Em Transporte</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full bg-slate-500/20 text-slate-400 text-[10px] font-bold border border-slate-500/30">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-card border border-white/10">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-tenant" /> Patrimônio & Frota Física de Equipamentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de unidades físicas (TAGs), número de série, localização e status operacional da frota.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/catalog")}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all flex items-center gap-2"
          >
            <Layers className="w-4 h-4 text-tenant" /> Ver Catálogo de Modelos
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-tenant text-white text-xs font-bold shadow-lg shadow-tenant/20 hover:opacity-90 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Cadastrar Patrimônio(s)
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl glass-panel border border-white/10">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por TAG de Patrimônio, modelo ou local..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-tenant"
          />
        </div>

        {/* Status Filter Tabs including 'Interno' */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {[
            { id: "ALL", label: "Todos" },
            { id: "Available", label: "Disponível" },
            { id: "Rented", label: "Alugado" },
            { id: "Maintenance", label: "Em Manutenção" },
            { id: "Interno", label: "Uso Interno" },
            { id: "InTransit", label: "Em Transporte" },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStatus(st.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedStatus === st.id ? "bg-tenant text-white" : "bg-white/5 text-muted-foreground hover:text-white"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Asset Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAssets.length === 0 ? (
          <div className="col-span-full py-12 text-center glass-card rounded-2xl border border-white/10 text-muted-foreground text-xs">
            Nenhum patrimônio físico encontrado nesta busca. Clique em <strong>"Cadastrar Patrimônio(s)"</strong> para registrar novas unidades.
          </div>
        ) : (
          filteredAssets.map((asset) => {
            const catalogItem = asset.catalog_item;
            return (
              <div key={asset.id} className="p-5 rounded-2xl glass-card border border-white/10 flex flex-col justify-between space-y-4 hover:border-white/20 transition-all">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-tenant" />
                      <span className="font-black text-white text-base tracking-tight">{asset.code}</span>
                    </div>
                    {getStatusBadge(asset.status)}
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Modelo do Catálogo</span>
                    <h4 className="font-bold text-white text-sm">{catalogItem?.name || "Modelo não vinculado"}</h4>
                    {catalogItem?.category && (
                      <span className="inline-block px-2 py-0.5 rounded bg-white/5 text-slate-300 text-[10px] border border-white/5">
                        {catalogItem.category}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground bg-white/5 p-3 rounded-xl">
                    <div className="flex items-center gap-1.5 text-white">
                      <MapPin className="w-3.5 h-3.5 text-tenant shrink-0" />
                      <span><strong>Localização:</strong> {asset.location_current}</span>
                    </div>
                    {asset.serial_number && (
                      <p className="text-[11px] pt-1 border-t border-white/5 text-slate-400">
                        Nº de Série: <strong className="text-white">{asset.serial_number}</strong>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={() => handleOpenEditModal(asset)}
                    className="flex-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center justify-center gap-1 border border-white/10 transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" /> Editar
                  </button>
                  <button
                    onClick={() => handleCloneAsset(asset)}
                    className="flex-1 py-1.5 rounded-xl bg-tenant/15 hover:bg-tenant text-tenant hover:text-white font-bold text-xs flex items-center justify-center gap-1 border border-tenant/30 transition-all"
                    title="Clonar patrimônio para criar novo com mesma especificação"
                  >
                    <Copy className="w-3.5 h-3.5" /> Clonar
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Add / Edit Physical Asset */}
      {(showCreateModal || editingAsset) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg p-6 rounded-2xl glass-panel border border-white/20 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Boxes className="w-5 h-5 text-tenant" /> {editingAsset ? `Editar Patrimônio: ${editingAsset.code}` : "Cadastrar Patrimônio Físico"}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingAsset(null);
                }}
                className="text-muted-foreground hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAsset} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1 font-semibold">Modelo do Catálogo Vinculado *</label>
                <select
                  value={formData.catalog_id}
                  onChange={(e) => setFormData({ ...formData, catalog_id: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-tenant font-semibold"
                >
                  {catalogList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">TAG / Patrimônio Base *</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: MRLC-001"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant uppercase font-bold"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Nº de Série</label>
                  <input
                    type="text"
                    placeholder="ex: SN-998812"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                  />
                </div>
              </div>

              {/* Pricing & Size configuration for this asset */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-white/10 space-y-3">
                <div className="text-xs font-bold text-tenant flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-400" /> Especificação & Tarifas de Locação
                </div>
                
                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">Tamanho / Dimensão *</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: 20 pés (6m) ou 40 pés (12m)"
                    value={formData.size_dimension}
                    onChange={(e) => setFormData({ ...formData, size_dimension: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-muted-foreground mb-1 font-semibold">Tarifa Diária (R$) (Opcional)</label>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={formData.daily_rate_str}
                      onChange={(e) => setFormData({ ...formData, daily_rate_str: maskCurrencyInput(e.target.value) })}
                      className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-emerald-400 font-bold focus:outline-none focus:border-tenant font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1 font-semibold">Tarifa Mensal (R$) *</label>
                    <input
                      type="text"
                      required
                      placeholder="0,00"
                      value={formData.monthly_rate_str}
                      onChange={(e) => setFormData({ ...formData, monthly_rate_str: maskCurrencyInput(e.target.value) })}
                      className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-emerald-400 font-bold focus:outline-none focus:border-tenant font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Batch Quantity (only for create mode) */}
              {!editingAsset && (
                <div className="p-3.5 rounded-xl bg-tenant/10 border border-tenant/20 space-y-1">
                  <label className="block text-tenant mb-1 font-bold">Quantidade a Cadastrar (Clonagem em Lote) *</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formData.qty}
                      onChange={(e) => setFormData({ ...formData, qty: Number(e.target.value) })}
                      className="w-20 p-2 rounded-xl bg-slate-900 border border-tenant/30 text-white font-bold text-center focus:outline-none"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {formData.qty > 1 
                        ? `Serão gerados ${formData.qty} patrimônios sequenciais: ${formData.code.toUpperCase() || "TAG"}-001 até ${formData.code.toUpperCase() || "TAG"}-${String(formData.qty).padStart(3, "0")}` 
                        : "Cadastro de 1 patrimônio individual"}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">Status do Patrimônio *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as EquipmentStatus })}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-tenant font-semibold"
                  >
                    <option value="Available">Disponível</option>
                    <option value="Rented">Alugado</option>
                    <option value="Maintenance">Em Manutenção</option>
                    <option value="Interno">Uso Interno</option>
                    <option value="InTransit">Em Transporte</option>
                  </select>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">Localização Atual</label>
                  <input
                    type="text"
                    placeholder="ex: Pátio Central - Setor A"
                    value={formData.location_current}
                    onChange={(e) => setFormData({ ...formData, location_current: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingAsset(null);
                  }}
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
                  {editingAsset ? "Salvar Alterações" : "Salvar Patrimônio(s)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
