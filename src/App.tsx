import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthProvider";
import { TenantProvider } from "@/contexts/TenantContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Dashboard } from "@/pages/Dashboard";
import { CatalogPage } from "@/pages/CatalogPage";
import { EquipmentPage } from "@/pages/EquipmentPage";
import { ClientsPage } from "@/pages/ClientsPage";
import { ProposalsPage } from "@/pages/ProposalsPage";
import { ContractsPage } from "@/pages/ContractsPage";
import { FinancialPage } from "@/pages/FinancialPage";
import { LogisticsPage } from "@/pages/LogisticsPage";
import { UsersPage } from "@/pages/UsersPage";
import { PricingSettingsPage } from "@/pages/PricingSettingsPage";
import { SuperAdminPage } from "@/pages/SuperAdmin";
import { LoginPage } from "@/pages/LoginPage";
import { AcceptInvitePage } from "@/pages/AcceptInvitePage";

export function App() {
  return (
    <AuthProvider>
      <TenantProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />
            <Route path="/reset-password" element={<AcceptInvitePage />} />
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="catalog" element={<CatalogPage />} />
              <Route path="equipment" element={<EquipmentPage />} />
              <Route path="clients" element={<ClientsPage />} />
              <Route path="proposals" element={<ProposalsPage />} />
              <Route path="contracts" element={<ContractsPage />} />
              <Route path="financial" element={<FinancialPage />} />
              <Route path="logistics" element={<LogisticsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="pricing" element={<PricingSettingsPage />} />
              <Route path="superadmin" element={<SuperAdminPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TenantProvider>
    </AuthProvider>
  );
}

export default App;
