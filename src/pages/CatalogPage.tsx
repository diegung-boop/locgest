import React, { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { EquipmentCatalog, EquipmentPricing } from "@/types/locgest";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { StorageService } from "@/services/storageService";
import { Layers, Plus, Search, Camera, Edit3, X, FileText, Boxes, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export const CatalogPage: React.FC = () => {
  const { organization } = useTenant();
  const navigate = useNavigate();

  const [catalogList, setCatalogList] = useState<EquipmentCatalog[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentCatalog | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const initialFormState = {
    name: "",
    category: "Containers",
    brand_model: "",
    description: "",
    image_url: "",
  };

  const [formData, setFormData] = useState(initialFormState);
  const [uploadingImage, setUploadingImage] = useState(false);

  const categories = [
    "Containers",
    "Betoneiras",
    "Escoras",
    "Escavação & Terraplenagem",
    "Energia & Geradores",
    "Outros Equipamentos",
  ];

  const loadData = async () => {
    const list = await SupabaseDataService.getEquipmentCatalog(organization.id);
    setCatalogList(list);
  };

  useEffect(() => {
    loadData();
  }, [organization.id]);

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData(initialFormState);
    setShowModal(true);
  };

  const handleOpenEditModal = (item: EquipmentCatalog) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      brand_model: item.brand_model || "",
      description: item.description || "",
      image_url: item.images?.[0] || "",
    });
    setShowModal(true);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const publicUrl = await StorageService.uploadImage(file, "equipment-images", organization.id);
    setFormData((prev) => ({ ...prev, image_url: publicUrl }));
    setUploadingImage(false);
    toast.success("Foto salva no storage!");
  };

  const handleSaveCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!formData.name) {
      toast.error("Preencha o Nome do Modelo de Equipamento.");
      return;
    }

    try {
      setIsSaving(true);
      const baseImage = formData.image_url || "https://images.unsplash.com/photo-1579412690850-bd41cd0af397?w=600&auto=format&fit=crop&q=80";
      const catalogId = editingItem ? editingItem.id : crypto.randomUUID();

      const catalogItem: EquipmentCatalog = {
        id: catalogId,
        organization_id: organization.id,
        name: formData.name,
        category: formData.category,
        brand_model: formData.brand_model || null,
        description: formData.description || null,
        images: [baseImage],
        created_at: editingItem ? editingItem.created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await SupabaseDataService.saveEquipmentCatalog(catalogItem);
      await loadData();
      toast.success(editingItem ? `Modelo ${catalogItem.name} atualizado!` : `Modelo ${catalogItem.name} cadastrado no Catálogo!`);
      setFormData(initialFormState);
      setEditingItem(null);
      setShowModal(false);
    } catch (err) {
      console.error("Error saving catalog model:", err);
      toast.error("Erro ao salvar modelo no catálogo.");
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = catalogList.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === "ALL" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-card border border-white/10">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-tenant" /> Catálogo de Equipamentos (Cadastro de Modelos)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Biblioteca base de modelos e tipos de equipamentos oferecidos para locação.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 rounded-xl bg-tenant text-white text-xs font-bold shadow-lg shadow-tenant/20 hover:opacity-90 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Cadastrar Novo Modelo
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl glass-panel border border-white/10">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, categoria ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-tenant"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedCategory === "ALL" ? "bg-tenant text-white" : "bg-white/5 text-muted-foreground hover:text-white"
            }`}
          >
            Todas Categorias
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === cat ? "bg-tenant text-white" : "bg-white/5 text-muted-foreground hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center glass-card rounded-2xl border border-white/10 text-muted-foreground text-xs">
            Nenhum modelo de equipamento cadastrado no catálogo. Clique em <strong>"Cadastrar Novo Modelo"</strong> para adicionar.
          </div>
        ) : (
          filtered.map((item) => (
            <div key={item.id} className="p-5 rounded-2xl glass-card border border-white/10 flex flex-col justify-between space-y-4 hover:border-white/20 transition-all">
              <div className="space-y-3">
                <div className="relative h-40 rounded-xl overflow-hidden bg-black/40 border border-white/5">
                  <img
                    src={item.images?.[0] || "https://images.unsplash.com/photo-1579412690850-bd41cd0af397?w=600&auto=format&fit=crop&q=80"}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md text-tenant text-[10px] font-bold border border-tenant/30">
                    {item.category}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-white text-base tracking-tight">{item.name}</h3>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                      {item.size_dimension || "Padrão"}
                    </span>
                    {item.brand_model && (
                      <span className="text-xs text-muted-foreground">Fabricante: <strong className="text-white">{item.brand_model}</strong></span>
                    )}
                  </div>
                </div>

                {item.description && (
                  <p className="text-xs text-slate-300 bg-white/5 p-3 rounded-xl line-clamp-3 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                <button
                  onClick={() => handleOpenEditModal(item)}
                  className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" /> Editar Modelo
                </button>
                <button
                  onClick={() => navigate("/equipment")}
                  className="flex-1 py-2 rounded-xl bg-tenant/20 hover:bg-tenant text-tenant hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-tenant/30 transition-all"
                >
                  <Boxes className="w-3.5 h-3.5" /> Ver Patrimônios
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Add/Edit Catalog Model */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg p-6 rounded-2xl glass-panel border border-white/20 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-tenant" /> {editingItem ? `Editar Modelo: ${editingItem.name}` : "Cadastrar Modelo no Catálogo"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCatalog} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1 font-semibold">Nome do Modelo de Equipamento *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Container 20 pés - Almoxarifado"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-semibold">Categoria *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-tenant font-semibold"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Marca / Fabricante Base</label>
                <input
                  type="text"
                  placeholder="ex: Reefer Carrier"
                  value={formData.brand_model}
                  onChange={(e) => setFormData({ ...formData, brand_model: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-semibold">Descrição Detalhada do Modelo</label>
                <textarea
                  rows={3}
                  placeholder="Especificações gerais, recursos inclusos, características físicas e dimensões..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant resize-none"
                />
              </div>

              {/* Photo Upload */}
              <div className="space-y-1">
                <label className="block text-muted-foreground mb-1 font-semibold">Foto do Modelo (Câmera ou Galeria)</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-4 py-2 rounded-xl bg-tenant/20 hover:bg-tenant border border-tenant/30 text-tenant hover:text-white font-bold text-xs flex items-center gap-2 transition-all">
                    <Camera className="w-4 h-4" /> Tirar Foto / Galeria
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                  </label>
                  {uploadingImage && <span className="text-xs text-amber-400">Enviando foto...</span>}
                </div>
                {formData.image_url && (
                  <div className="mt-2">
                    <img src={formData.image_url} alt="Preview" className="w-24 h-24 object-cover rounded-xl border border-white/10" />
                  </div>
                )}
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
                  disabled={uploadingImage || isSaving}
                  className="px-4 py-2 rounded-xl bg-tenant text-white font-bold shadow-lg shadow-tenant/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingItem ? "Salvar Alterações" : "Cadastrar Modelo no Catálogo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
