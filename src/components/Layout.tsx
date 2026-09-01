import React from "react";
import { 
  LayoutDashboard, 
  CheckSquare, 
  AlertTriangle, 
  Users, 
  Settings,
  Menu,
  X,
  Bell,
  ShieldAlert,
  TrendingUp,
  CalendarDays,
  LogOut,
  BarChart3,
  DoorOpen,
  Plus,
  Layout as LayoutIcon,
  Sparkles,
  RotateCcw,
  Activity,
  Clock,
  Search,
  UserPlus,
  FileCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { useLayout } from "../context/LayoutContext";
import { useLanguage } from "../context/LanguageContext";
import { doc, onSnapshot, collection } from "firebase/firestore";
import { db } from "../firebase";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [isOpen, setIsOpen] = React.useState(true);
  const [siteName, setSiteName] = React.useState("SiteOps");
  const { user, logout, hasPermission } = useAuth();
  const { t, dir, tData } = useLanguage();

  React.useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "settings"), (snapshot) => {
      const siteNameSetting = snapshot.docs.find(doc => doc.id === 'site_name');
      if (siteNameSetting) {
        setSiteName(siteNameSetting.data().value);
      }
    }, (error) => {
      console.error("Layout settings snapshot error:", error);
    });

    return () => unsubscribe();
  }, []);

  const navItems = [
    { id: "dashboard", label: t("dashboard"), icon: LayoutDashboard, permission: "view_dashboard" },
    { id: "gate", label: t("gate"), icon: DoorOpen, permission: "manage_gate" },
    { id: "tasks", label: t("tasks"), icon: CheckSquare, permission: "manage_tasks" },
    { id: "incidents", label: t("incidents"), icon: AlertTriangle, permission: "report_incidents" },
    { id: "planning", label: t("planning"), icon: BarChart3, permission: "manage_planning" },
    { id: "handover", label: t("handover"), icon: Sparkles, permission: "view_dashboard" },
    { id: "permits", label: t("permits"), icon: FileCheck, permission: "view_dashboard" },
    { id: "staff", label: t("staff"), icon: Users, permission: "view_staff" },
    { id: "rota", label: t("rota"), icon: CalendarDays, permission: "view_rota" },
    { id: "analytics", label: t("analytics"), icon: TrendingUp, permission: "view_analytics" },
    { id: "emergency", label: t("emergency"), icon: ShieldAlert, permission: "manage_emergency" },
    { id: "settings", label: t("settings"), icon: Settings, permission: "manage_settings" },
  ].filter(item => hasPermission(item.permission));

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "lg:hidden fixed top-4 z-50 p-2 bg-white rounded-md shadow-md border border-slate-200 transition-all",
          dir === "rtl" ? "right-4" : "left-4"
        )}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={cn(
        "fixed inset-y-0 z-40 w-64 bg-slate-900 text-white transition-all duration-300 ease-in-out lg:translate-x-0",
        dir === "rtl" ? "right-0 border-l border-slate-800" : "left-0 border-r border-slate-800",
        !isOpen && (dir === "rtl" ? "translate-x-full" : "-translate-x-full")
      )}>
        <div className="flex flex-col h-full">
          <div className="p-6">
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-white font-black">{siteName.charAt(0)}</span>
              </div>
              <span className="truncate">{siteName}</span>
            </h1>
          </div>

          <nav className="flex-1 px-4 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group cursor-pointer",
                  activeTab === item.id 
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-white",
                  dir === "rtl" ? "flex-row-reverse text-right" : "text-left"
                )}
              >
                <item.icon size={20} className={cn(
                  activeTab === item.id ? "text-white" : "text-slate-400 group-hover:text-white",
                  "shrink-0"
                )} />
                <span className="font-medium truncate">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-4 mt-auto border-t border-slate-800">
            <div className={cn("flex items-center gap-3 px-4 py-2 mb-2", dir === "rtl" && "flex-row-reverse")}>
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-black text-white shrink-0">
                {user?.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className={cn("flex-1 min-w-0", dir === "rtl" ? "text-right" : "text-left")}>
                <p className="text-sm font-bold truncate">{tData(user?.name)}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black truncate">{tData(user?.role)}</p>
              </div>
            </div>
            <button 
              onClick={logout}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-red-400 transition-colors text-sm font-bold cursor-pointer",
                dir === "rtl" ? "flex-row-reverse text-right" : "text-left"
              )}
            >
              <LogOut size={18} className="shrink-0" />
              <span>{t("sign_out")}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export function Header({ title }: { title: string, pageId: string }) {
  const [now, setNow] = React.useState(new Date());
  const { t, language, setLanguage } = useLanguage();
  
  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-30 px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t("path")}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">/</span>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">{t(title.toLowerCase())}</h2>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-lg">
            <div className="flex flex-col text-right">
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">{t("global_clock")}</span>
               <span className="text-xs font-mono font-bold text-slate-600 leading-none">
                 {now.toLocaleTimeString(language === "ar" ? "ar-EG" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
               </span>
            </div>
            <div className="w-[1px] h-6 bg-slate-200" />
            <div className="flex flex-col text-right">
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">{t("operational_date")}</span>
               <span className="text-xs font-bold text-slate-600 leading-none">
                 {now.toLocaleDateString(language === "ar" ? "ar-EG" : "en-GB", { day: "2-digit", month: "short" }).toUpperCase()}
               </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Bilingual Toggle button */}
            <button
              onClick={() => setLanguage(language === "en" ? "ar" : "en")}
              className="px-3 py-1.5 bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs hover:shadow-xs hover:scale-[1.02]"
              title={language === "en" ? "تغيير اللغة إلى العربية" : "Switch to English"}
            >
              <span className="text-sm">🌐</span>
              <span className="tracking-wide">{language === "en" ? "العربية" : "English"}</span>
            </button>

            <button className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all relative group cursor-pointer">
              <Bell size={20} />
              <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white group-hover:scale-110 transition-transform" />
            </button>
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-[10px] font-black text-emerald-500 border border-slate-800 shrink-0">
               {language === "ar" ? "ع" : "E"}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
