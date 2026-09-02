import React, { createContext, useContext, useEffect, useState } from "react";
import { Organization } from "@/types/locgest";
import { SupabaseDataService } from "@/services/supabaseDataService";
import { MockDataService } from "@/services/mockDataService";
import { useAuth } from "./AuthProvider";

interface TenantContextType {
  organization: Organization;
  allOrganizations: Organization[];
  loading: boolean;
  isOverridden: boolean;
  switchOrganization: (org: Organization) => void;
  clearOrganizationOverride: () => void;
  refreshOrganization: () => Promise<void>;
}

const OVERRIDE_STORAGE_KEY = "locgest_superadmin_org_override";

const TenantContext = createContext<TenantContextType>({
  organization: MockDataService.getOrganizations()[0],
  allOrganizations: [],
  loading: false,
  isOverridden: false,
  switchOrganization: () => {},
  clearOrganizationOverride: () => {},
  refreshOrganization: async () => {},
});

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>(() => 
    MockDataService.getOrganizations()
  );
  
  const [overrideOrgId, setOverrideOrgId] = useState<string | null>(() => {
    try {
      const saved = sessionStorage.getItem(OVERRIDE_STORAGE_KEY);
      if (!saved) return null;
      if (saved.startsWith("{")) {
        const parsed = JSON.parse(saved);
        return parsed.id || null;
      }
      return saved;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  const loadOrganizations = async () => {
    setLoading(true);
    const orgs = await SupabaseDataService.getOrganizations();
    setAllOrganizations(orgs);
    setLoading(false);
  };

  useEffect(() => {
    loadOrganizations();
  }, []);

  const isSuperAdmin = !!user?.is_super_admin;
  const effectiveOverrideOrgId = isSuperAdmin ? overrideOrgId : null;
  const effectiveOverrideOrg = effectiveOverrideOrgId
    ? allOrganizations.find((o) => o.id === effectiveOverrideOrgId) || null
    : null;

  // Find organization strictly by user's organization_id
  const matchedUserOrg = user?.organization_id
    ? allOrganizations.find((o) => o.id === user.organization_id)
    : null;

  const defaultOrg = allOrganizations[0] || MockDataService.getOrganizations()[0];
  const userOrg = matchedUserOrg || defaultOrg;
  const activeOrg = effectiveOverrideOrg || userOrg;

  const isOverridden = isSuperAdmin && !!effectiveOverrideOrg && effectiveOverrideOrg.id !== userOrg.id;

  const applyThemeVariables = (primaryColor: string) => {
    const color = primaryColor || "#0284c7";
    document.documentElement.style.setProperty("--tenant-primary", color);

    let hex = color.replace("#", "");
    if (hex.length === 3) hex = hex.split("").map((x) => x + x).join("");
    const num = parseInt(hex, 16);
    if (!isNaN(num)) {
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      document.documentElement.style.setProperty("--tenant-primary-soft", `rgba(${r}, ${g}, ${b}, 0.12)`);
      document.documentElement.style.setProperty("--tenant-primary-glow", `rgba(${r}, ${g}, ${b}, 0.25)`);
    }
  };

  useEffect(() => {
    if (activeOrg) {
      applyThemeVariables(activeOrg.primary_color);
    }
  }, [activeOrg]);

  const switchOrganization = (org: Organization) => {
    setOverrideOrgId(org.id);
    try {
      sessionStorage.setItem(OVERRIDE_STORAGE_KEY, org.id);
    } catch (e) {}
  };

  const clearOrganizationOverride = () => {
    setOverrideOrgId(null);
    try {
      sessionStorage.removeItem(OVERRIDE_STORAGE_KEY);
    } catch (e) {}
  };

  return (
    <TenantContext.Provider
      value={{
        organization: activeOrg,
        allOrganizations,
        loading,
        isOverridden,
        switchOrganization,
        clearOrganizationOverride,
        refreshOrganization: loadOrganizations,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => useContext(TenantContext);
