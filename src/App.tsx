import React, { useState, useEffect } from "react";
import { Sidebar, Header } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Tasks } from "./components/Tasks";
import { Incidents } from "./components/Incidents";
import { Staff } from "./components/Staff";
import { Settings } from "./components/Settings";
import { Emergency } from "./components/Emergency";
import { Analytics } from "./components/Analytics";
import { Rota } from "./components/Rota";
import { Planning } from "./components/Planning";
import { GateControl } from "./components/GateControl";
import Handover from "./components/Handover";
import { Permits } from "./components/Permits";
import { LoginPage } from "./components/LoginPage";
import { RegisterPage } from "./components/RegisterPage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LayoutProvider } from "./context/LayoutContext";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { motion, AnimatePresence } from "motion/react";
import { ShieldAlert } from "lucide-react";
import { cn } from "./lib/utils";
import { Toaster } from "sonner";
import { GeofenceAlertManager } from "./components/GeofenceAlertManager";

function AppContent() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isRegistering, setIsRegistering] = useState(false);
  const { user, isLoading, hasPermission } = useAuth();
  const { t, dir } = useLanguage();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return isRegistering ? (
      <RegisterPage onSwitchToLogin={() => setIsRegistering(false)} />
    ) : (
      <LoginPage onSwitchToRegister={() => setIsRegistering(true)} />
    );
  }

  const renderContent = () => {
    const check = (permission: string, component: React.ReactNode) => {
      return hasPermission(permission) ? component : (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500 space-y-4">
          <div className="p-4 bg-slate-100 rounded-full">
            <ShieldAlert size={48} className="text-slate-400" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-slate-900">{t("access_restricted")}</h3>
            <p className="text-sm">{t("restricted_message")}</p>
          </div>
        </div>
      );
    };

    switch (activeTab) {
      case "dashboard": return check("view_dashboard", <Dashboard />);
      case "gate": return check("manage_gate", <GateControl />);
      case "tasks": return check("manage_tasks", <Tasks />);
      case "incidents": return check("report_incidents", <Incidents />);
      case "planning": return check("manage_planning", <Planning />);
      case "handover": return check("view_dashboard", <Handover />);
      case "permits": return check("view_dashboard", <Permits />);
      case "staff": return check("view_staff", <Staff />);
      case "rota": return check("view_rota", <Rota />);
      case "emergency": return check("manage_emergency", <Emergency />);
      case "analytics": return check("view_analytics", <Analytics />);
      case "settings": return check("manage_settings", <Settings />);
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Toaster position="top-right" richColors />
      <GeofenceAlertManager />
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className={cn(
        "flex-1 min-h-screen flex flex-col transition-all duration-300",
        dir === "rtl" ? "lg:mr-64 lg:ml-0" : "lg:ml-64 lg:mr-0"
      )}>
        <Header 
          title={activeTab} 
          pageId={activeTab}
        />
        
        <div className="p-6 lg:p-8 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <LayoutProvider>
            <AppContent />
          </LayoutProvider>
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
