import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthProvider";
import { Users, Building2, Settings, Shield, X, SlidersHorizontal, Coins } from "lucide-react";

interface SettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const location = useLocation();

  // Settings sub-navigation items
  const settingsNavItems = [
    { label: "Gestão de Usuários", path: "/users", icon: Users, description: "Perfis, papéis e permissões" },
    { label: "Tabela de Preços & Tarifas", path: "/pricing", icon: Coins, description: "Valores diários/mensais e tamanhos" },
  ];

  if (user?.is_super_admin) {
    settingsNavItems.push({
      label: "SuperAdmin (Tenants)",
      path: "/superadmin",
      icon: Building2,
      description: "Gestão de empresas parceiras",
    });
  }

  if (!isOpen) return null;

  return (
    <aside className="w-56 h-[calc(100vh-65px)] sticky top-[65px] glass-panel border-r border-white/10 p-3 flex flex-col justify-between hidden md:flex animate-in slide-in-from-left duration-200 z-20">
      <div className="space-y-3">
        {/* Header Secondary Sidebar */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2 text-white font-bold text-xs">
            <SlidersHorizontal className="w-4 h-4 text-tenant" />
            <span>Configurações</span>
          </div>
        </div>

        {/* Sub-menu Navigation Links */}
        <nav className="space-y-1">
          {settingsNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`block p-2.5 rounded-xl transition-all group border ${isActive
                  ? "bg-tenant/20 text-tenant border-tenant/40 font-bold shadow-md shadow-tenant/10"
                  : "border-transparent text-muted-foreground hover:text-white hover:bg-white/5"
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? "text-tenant" : ""}`} />
                  <span className="text-xs">{item.label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground font-normal mt-0.5 ml-6 line-clamp-1">
                  {item.description}
                </p>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};
