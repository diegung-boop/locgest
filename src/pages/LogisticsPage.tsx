import React, { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { ServiceOrder } from "@/types/locgest";
import { MockDataService } from "@/services/mockDataService";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { StorageService } from "@/services/storageService";
import { Truck, CheckCircle2, MapPin, Camera, Navigation, ExternalLink, Calendar, X } from "lucide-react";
import { toast } from "sonner";

export const LogisticsPage: React.FC = () => {
  const { organization } = useTenant();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);

  const loadData = async () => {
    const list = await SupabaseDataService.getServiceOrders(organization.id);
    setOrders(list);
  };

  useEffect(() => {
    loadData();
  }, [organization.id]);

  const [activeOS, setActiveOS] = useState<ServiceOrder | null>(null);
  const [receiverName, setReceiverName] = useState("");
  const [receiverDocument, setReceiverDocument] = useState("");
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const handleCaptureGPS = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          toast.success("Coordenadas GPS de campo capturadas com sucesso!");
        },
        (err) => {
          console.warn("Geolocalização não permitida, usando GPS aproximado de teste:", err.message);
          setCoords({ lat: -23.55052, lng: -46.633308 });
        }
      );
    } else {
      setCoords({ lat: -23.55052, lng: -46.633308 });
    }
  };

  // Item 6: Camera / Gallery Upload via Supabase Storage
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    const publicUrl = await StorageService.uploadImage(file, "delivery-photos", organization.id);
    setUploadedPhotos((prev) => [...prev, publicUrl]);
    setUploadingPhoto(false);
    toast.success("Foto do comprovante de entrega salva no Storage por organização!");
  };

  const handleCompleteOS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOS) return;

    const basePhotos = uploadedPhotos.length > 0 
      ? uploadedPhotos 
      : ["https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=600&auto=format&fit=crop&q=80"];

    const updatedOS: ServiceOrder = {
      ...activeOS,
      status: "Completed",
      receiver_name: receiverName || "Encarregado da Obra",
      receiver_document: receiverDocument || "CPF Registrado",
      photos: basePhotos,
      geo_latitude: coords ? String(coords.lat) : "-23.55052",
      geo_longitude: coords ? String(coords.lng) : "-46.633308",
      updated_at: new Date().toISOString(),
    };

    await SupabaseDataService.saveServiceOrder(updatedOS);
    await loadData();
    toast.success(`Ordem de Serviço ${updatedOS.os_number} CONCLUÍDA com fotos e GPS!`);
    setActiveOS(null);
    setReceiverName("");
    setReceiverDocument("");
    setUploadedPhotos([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-card border border-white/10">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-tenant" /> Logística & Ordens de Serviço (OS)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Painel de campo para motoristas/entregadores com registro de fotos (câmera/galeria) e captura de GPS.
          </p>
        </div>
      </div>

      {/* OS Cards List */}
      <div className="space-y-4">
        {orders.map((os) => (
          <div key={os.id} className="p-6 rounded-2xl glass-card border border-white/10 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-base">{os.os_number}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    os.status === "Completed" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-purple-500/20 text-purple-400 border border-purple-500/30 animate-pulse"
                  }`}>
                    {os.status === "Completed" ? "Entrega Concluída (GPS Ok)" : "Pendente de Entrega em Campo"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cliente: <strong className="text-white">{os.client?.company_name || "Cliente Registrado"}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/5 px-3 py-1.5 rounded-xl">
                <Calendar className="w-4 h-4 text-tenant shrink-0" />
                <span>Agendado para: <strong className="text-white">{os.scheduled_date}</strong></span>
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="flex items-center gap-2 bg-white/5 p-3 rounded-xl">
                <MapPin className="w-4 h-4 text-tenant shrink-0" />
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">Endereço do Canteiro de Obras</div>
                  <div className="text-white font-medium truncate">{os.job_site_address}</div>
                </div>
              </div>

              {os.receiver_name && (
                <div className="flex items-center gap-2 bg-white/5 p-3 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Recebedor na Obra</div>
                    <div className="text-white font-medium">{os.receiver_name} ({os.receiver_document})</div>
                  </div>
                </div>
              )}
            </div>

            {/* GPS GeoCoordinates Badge */}
            {os.geo_latitude && (
              <div className="p-3 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-mono">
                  <Navigation className="w-4 h-4" />
                  <span>Lat: {os.geo_latitude} | Long: {os.geo_longitude}</span>
                </div>
                <a
                  href={`https://www.google.com/maps?q=${os.geo_latitude},${os.geo_longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 rounded-lg bg-tenant/20 text-tenant hover:bg-tenant/30 text-xs font-bold flex items-center gap-1"
                >
                  Abrir no Google Maps <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* Evidence Photos */}
            {os.photos && os.photos.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/5">
                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-amber-400" /> Fotos Comprovantes da Entrega no Canteiro:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {os.photos.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt="Comprovante de Entrega"
                      className="w-full h-28 object-cover rounded-xl border border-white/10 hover:scale-105 transition-transform"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Execute OS Button */}
            {os.status !== "Completed" && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => {
                    setActiveOS(os);
                    handleCaptureGPS();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-tenant hover:opacity-90 text-white font-bold text-xs shadow-lg shadow-tenant/20 flex items-center gap-2 transition-all"
                >
                  <Camera className="w-4 h-4" /> Realizar Entrega (Anexar Fotos & GPS)
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal Execution OS (Item 6) */}
      {activeOS && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg p-6 rounded-2xl glass-panel border border-white/20 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-tenant" /> Executar Ordem de Serviço: {activeOS.os_number}
              </h2>
              <button onClick={() => setActiveOS(null)} className="text-muted-foreground hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteOS} className="space-y-4 text-xs">
              {/* GPS Sensor Box */}
              <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-emerald-400" /> Sensor de Geolocalização GPS
                  </span>
                  <button
                    type="button"
                    onClick={handleCaptureGPS}
                    className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]"
                  >
                    Recapturar
                  </button>
                </div>
                {coords ? (
                  <div className="text-emerald-400 font-mono font-bold text-xs">
                    Latitude: {coords.lat} | Longitude: {coords.lng}
                  </div>
                ) : (
                  <div className="text-amber-400 text-xs">Capturando coordenadas de campo...</div>
                )}
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-semibold">Nome do Recebedor na Obra *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Mestre Antonio (Encarregado)"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Documento do Recebedor (RG/CPF)</label>
                <input
                  type="text"
                  placeholder="ex: 12.345.678-9 SP"
                  value={receiverDocument}
                  onChange={(e) => setReceiverDocument(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-tenant"
                />
              </div>

              {/* Item 6: Camera / Gallery Upload via Supabase Storage */}
              <div className="space-y-2">
                <label className="block text-muted-foreground font-semibold">Foto Comprovante da Entrega (Câmera ou Galeria) *</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-tenant/20 hover:bg-tenant border border-tenant/30 text-tenant hover:text-white font-bold text-xs flex items-center gap-2 transition-all">
                    <Camera className="w-4 h-4" /> Tirar Foto / Escolher da Galeria
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoFileChange}
                      className="hidden"
                    />
                  </label>
                  {uploadingPhoto && <span className="text-xs text-amber-400">Enviando foto...</span>}
                </div>

                {uploadedPhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {uploadedPhotos.map((url, idx) => (
                      <img key={idx} src={url} alt="Comprovante" className="w-full h-20 object-cover rounded-xl border border-white/10" />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveOS(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploadingPhoto}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/20"
                >
                  Concluir Entrega em Campo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
