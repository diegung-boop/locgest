import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Layers,
  Boxes,
  FolderKanban,
  FileText,
  Receipt,
  Truck,
  ShieldCheck,
  Sparkles,
  Settings,
  ChevronRight
} from "lucide-react";

interface SidebarProps {
  isSettingsOpen: boolean;
  onToggleSettings: () => void;
  onCloseSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isSettingsOpen, onToggleSettings, onCloseSettings }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const isSettingsActive =
    location.pathname.startsWith("/users") ||
    location.pathname.startsWith("/pricing") ||
    location.pathname.startsWith("/superadmin") ||
    isSettingsOpen;

  const mainNavItems = [
    { label: "Dashboard", path: "/", icon: LayoutDashboard },
    { label: "Catálogo de Equipamentos", path: "/catalog", icon: Layers },
    { label: "Patrimônio & Frota", path: "/equipment", icon: Boxes },
    { label: "Clientes & Pasta", path: "/clients", icon: FolderKanban, highlight: true },
    { label: "Propostas & Pedidos", path: "/proposals", icon: FileText },
    { label: "Contratos", path: "/contracts", icon: ShieldCheck },
    { label: "Financeiro (NFs / Boletos)", path: "/financial", icon: Receipt },
    { label: "Logística & OS (Fotos/GPS)", path: "/logistics", icon: Truck, badge: "OS Campo" },
  ];

  const handleConfiguracoesClick = () => {
    if (
      !location.pathname.startsWith("/users") &&
      !location.pathname.startsWith("/pricing") &&
      !location.pathname.startsWith("/superadmin")
    ) {
      navigate("/users");
    } else {
      onToggleSettings();
    }
  };

  return (
    <aside className="w-64 h-[calc(100vh-65px)] sticky top-[65px] glass-panel border-r border-white/10 p-3 flex flex-col justify-between hidden md:flex shrink-0 z-30">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
          Módulos Locgest
        </div>

        <nav className="space-y-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseSettings}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group border ${
                    isActive
                      ? "bg-tenant/20 text-tenant border-tenant/40 font-bold shadow-md shadow-tenant/10"
                      : "border-transparent text-muted-foreground hover:text-white hover:bg-white/5"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? "text-tenant" : ""}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        {item.badge}
                      </span>
                    )}
                    {item.highlight && !item.badge && (
                      <Sparkles className="w-3 h-3 text-amber-400 opacity-80" />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}

          {/* Configurações Main Menu Item */}
          <div className="pt-2 mt-2 border-t border-white/10">
            <button
              onClick={handleConfiguracoesClick}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group border ${
                isSettingsActive
                  ? "bg-tenant/20 text-tenant border-tenant/40 font-bold shadow-md shadow-tenant/10"
                  : "border-transparent text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings className={`w-4 h-4 transition-transform group-hover:rotate-45 ${isSettingsActive ? "text-tenant" : ""}`} />
                <span>Configurações</span>
              </div>
              <ChevronRight className={`w-4 h-4 transition-transform ${isSettingsActive ? "rotate-90 text-tenant" : "text-muted-foreground"}`} />
            </button>
          </div>
        </nav>
      </div>

      {/* Footer Info Box */}
      <div className="p-3 rounded-xl bg-secondary/40 border border-white/5 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-tenant animate-pulse"></div>
          <span className="text-[11px] font-bold text-white">Versão v2.4</span>
        </div>
      </div>
    </aside>
  );
};
