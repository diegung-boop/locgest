import React, { useState, useEffect } from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { SettingsSidebar } from "./SettingsSidebar";
import { Toaster } from "sonner";
import { useAuth } from "@/contexts/AuthProvider";

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const { user, loading } = useAuth();
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

  // Route guard: while the initial Supabase session check is still running,
  // render nothing rather than flashing the app then bouncing to /login.
  // Once resolved, an unauthenticated user (e.g. right after signOut) is
  // redirected — nothing previously did this, so logout never left the app.
  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }

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
