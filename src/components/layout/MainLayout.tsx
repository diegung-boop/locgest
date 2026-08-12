import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { SettingsSidebar } from "./SettingsSidebar";
import { Toaster } from "sonner";

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Auto-manage settings submenu state based on navigation path:
  // If navigating to an operational route, automatically close settings submenu.
  // If navigating to a settings route, open settings submenu.
  useEffect(() => {
    if (location.pathname.startsWith("/users") || location.pathname.startsWith("/superadmin")) {
      setIsSettingsOpen(true);
    } else {
      setIsSettingsOpen(false);
    }
  }, [location.pathname]);

  const handleToggleSettings = () => {
    setIsSettingsOpen((prev) => !prev);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <div className="flex flex-1 relative">
        <Sidebar
          isSettingsOpen={isSettingsOpen}
          onToggleSettings={handleToggleSettings}
          onCloseSettings={handleCloseSettings}
        />
        <SettingsSidebar
          isOpen={isSettingsOpen}
          onClose={handleCloseSettings}
        />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full transition-all">
          <Outlet />
        </main>
      </div>
      <Toaster position="top-right" theme="dark" richColors />
    </div>
  );
};
