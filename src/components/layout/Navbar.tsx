import React from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { useTenant } from "@/contexts/TenantContext";
import { UserRole } from "@/types/locgest";
import {
  Building2,
  ShieldAlert,
  UserCheck,
  LogOut,
  Sparkles,
  ChevronDown,
  RefreshCw
} from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, loginAsRole, signOut } = useAuth();
  const { organization, allOrganizations, isOverridden, switchOrganization, clearOrganizationOverride } = useTenant();

  const roles: UserRole[] = ["Admin", "Diretor", "Gestor", "Analista", "Entregador", "Cliente"];

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/10 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Brand & Organization Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-tenant/20 border border-tenant/40 text-tenant font-bold shadow-lg shadow-tenant/10">
            {organization.logo_url ? (
              <img src={organization.logo_url} alt={organization.name} className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <Building2 className="w-5 h-5 text-tenant" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-white">LOCGEST</span>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-tenant-soft text-tenant border border-tenant/30">
                Especializado em Gestão de Locação de Equipamentos
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {organization.name}
            </p>
          </div>
        </div>

        {/* SuperAdmin Override Banner Notice if active */}
        {isOverridden && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Modo SuperAdmin: Visualizando <strong>{organization.name}</strong></span>
            <button
              onClick={clearOrganizationOverride}
              className="ml-2 font-semibold underline hover:text-white transition-colors"
            >
              Restaurar Original
            </button>
          </div>
        )}

        {/* Right Actions: Tenant Switcher (SuperAdmin) & Role Switcher Simulation */}
        <div className="flex items-center gap-3">
          {/* Tenant Switcher Dropdown (SuperAdmin) */}
          {user?.is_super_admin && (
            <div className="relative group">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/60 hover:bg-secondary text-xs text-secondary-foreground font-medium border border-white/10 transition-all">
                <Building2 className="w-3.5 h-3.5 text-tenant" />
                <span className="hidden sm:inline">Locadora:</span>
                <span className="font-semibold text-white">{organization.slug}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
              <div className="absolute right-0 top-full mt-1 w-56 p-1 rounded-xl glass-panel border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-150 z-50">
                <div className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase border-b border-white/5">
                  Alternar Locadora (Tenant)
                </div>
                {allOrganizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => switchOrganization(org)}
                    className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${org.id === organization.id
                        ? "bg-tenant/20 text-tenant border border-tenant/30"
                        : "hover:bg-white/5 text-muted-foreground hover:text-white"
                      }`}
                  >
                    <span className="truncate">{org.name}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: org.primary_color }}
                    ></span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Simulated Role Quick Switcher for Testing */}
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-tenant/15 hover:bg-tenant/25 border border-tenant/30 text-xs font-medium text-white transition-all shadow-sm">
              <UserCheck className="w-3.5 h-3.5 text-tenant" />
              <span className="hidden sm:inline font-normal text-muted-foreground">Perfil:</span>
              <span className="font-bold text-tenant">{user?.role || "Admin"}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-52 p-1.5 rounded-xl glass-panel border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-150 z-50">
              <div className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase border-b border-white/5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> Simular Papel (RBAC)
              </div>
              {roles.map((r) => (
                <button
                  key={r}
                  onClick={() => loginAsRole(r)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${user?.role === r
                      ? "bg-tenant text-white font-bold"
                      : "hover:bg-white/5 text-muted-foreground hover:text-white"
                    }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* User Signout */}
          <button
            onClick={signOut}
            title="Sair"
            className="p-2 rounded-lg bg-secondary/40 hover:bg-red-500/20 text-muted-foreground hover:text-red-400 border border-white/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
