import React, { useEffect, useState } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar,
  User as UserIcon,
  MapPin,
  Check,
  X as XIcon,
  ShieldCheck,
  Clock,
  AlertTriangle,
  FileCheck,
  CornerDownRight,
  ClipboardList,
  ChevronRight,
  UserCheck,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { Printer, Map } from "lucide-react";
import { SiteMap, normalizeAreaToZoneId } from "./SiteMap";
import { ContractorPass } from "./ContractorPass";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot,
  serverTimestamp 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";

const PERMIT_TYPES = [
  { id: "work", label_en: "Hot Work / Maintenance", label_ar: "أعمال الصيانة الساخنة" },
  { id: "drone", label_en: "Drone Photography / UAV", label_ar: "تصوير طائرة درون" },
  { id: "research", label_en: "Scientific Research Access", label_ar: "أبحاث علمية ودراسات" },
  { id: "photography", label_en: "Commercial Media & Film", label_ar: "تصوير إعلامي وتجاري" },
  { id: "excavation", label_en: "Archaeological Excavation", label_ar: "حفريات أثرية ومجسات" },
  { id: "other", label_en: "Special Event / Guest Access", label_ar: "فعاليات خاصة / ضيوف" }
];

const PERMIT_CATEGORIES = [
  { id: "maintenance", label_en: "Maintenance", label_ar: "الصيانة", bg: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "access", label_en: "Access", label_ar: "تصريح دخول", bg: "bg-sky-50 text-sky-700 border-sky-200" },
  { id: "event", label_en: "Event / Media", label_ar: "فعاليات وتغطية", bg: "bg-purple-50 text-purple-700 border-purple-200" }
];

const PRESET_PERMITS = [
  {
    title: "Drone Topographic Site Mapping",
    type: "drone",
    category: "access",
    applicant_name: "AeroSurvey Drone Solutions Ltd",
    description: "High-level UAV aerial capture for modern 3D monument reconstruction and orthomapping of the central monolith layout.",
    start_time: new Date(Date.now() - 3600000 * 24).toISOString().substring(0, 16),
    end_time: new Date(Date.now() + 3600000 * 48).toISOString().substring(0, 16),
    status: "approved",
    area: "Monuments Inner Sanctum Grid B",
    risk_level: "medium",
    approved_by: "Supervisor Jane Smith",
    approval_notes: "Drone and flight logs cleared. Strictly stay below 120m altitude ceiling to respect safe airspace parameters.",
    created_at: new Date(Date.now() - 3600000 * 48).toISOString()
  },
  {
    title: "Archaeological GPR Subsoil Scan",
    type: "research",
    category: "access",
    applicant_name: "Dr. Alistair Vance (UCL Institute)",
    description: "Non-invasive Ground Penetrating Radar scanning across ancient perimeter trenches to detect unexcavated structural deposits.",
    start_time: new Date().toISOString().substring(0, 16),
    end_time: new Date(Date.now() + 3600000 * 120).toISOString().substring(0, 16),
    status: "pending",
    area: "Avenue Perimeter Trenches West Side",
    risk_level: "low",
    approved_by: "",
    approval_notes: "",
    created_at: new Date().toISOString()
  },
  {
    title: "Monolith Point-Cloud Laser Cleaning",
    type: "work",
    category: "maintenance",
    applicant_name: "Apex Heritage Restoration Restoration Services",
    description: "Eco-friendly low-vibration dry laser preservation to clean mineral lichen growth off the central Sarsen stone face #56.",
    start_time: new Date(Date.now() + 3600000 * 24).toISOString().substring(0, 16),
    end_time: new Date(Date.now() + 3600000 * 96).toISOString().substring(0, 16),
    status: "pending",
    area: "Sarsen Ring Stone #56 Accent Block",
    risk_level: "high",
    approved_by: "",
    approval_notes: "",
    created_at: new Date().toISOString()
  },
  {
    title: "National Geographic Sunset Film Crew",
    type: "photography",
    category: "event",
    applicant_name: "NatGeo International Broadcast Team",
    description: "Commercial high-intensity evening lighting and camera tripod arrays filming the solstice sunset orientation.",
    start_time: new Date(Date.now() - 3600000 * 72).toISOString().substring(0, 16),
    end_time: new Date(Date.now() - 3600000 * 68).toISOString().substring(0, 16),
    status: "expired",
    area: "Sunset Axis Alignment Portal",
    risk_level: "medium",
    approved_by: "Operations Office",
    approval_notes: "Authorized for tripod set up only. No heavy vehicles or generator trucks allowed within the grass perimeter zone.",
    created_at: new Date(Date.now() - 3600000 * 96).toISOString()
  }
];

export function Permits() {
  const { language, t, tData, dir } = useLanguage();
  const { user: currentUser } = useAuth();
  
  const [permits, setPermits] = useState<any[]>([]);
  const [selectedPermit, setSelectedPermit] = useState<any | null>(null);
  
  // Modal states
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isPassOpen, setIsPassOpen] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [filteredMapZone, setFilteredMapZone] = useState<string | null>(null);

  // Review Form state
  const [reviewNotes, setReviewNotes] = useState("");
  
  // New Permit form state
  const [newPermit, setNewPermit] = useState({
    title: "",
    type: "work",
    category: "maintenance",
    applicant_name: currentUser?.name || "",
    description: "",
    start_time: "",
    end_time: "",
    area: "",
    risk_level: "low",
  });

  const isRtl = dir === "rtl";

  // Subscribe to Permits collection
  useEffect(() => {
    if (!currentUser) return;
    const path = "permits";

    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      if (snapshot.empty) {
        // Seed presets if absolutely empty so user can experience the permit approvals immediately
        PRESET_PERMITS.forEach(async (preset) => {
          try {
            await addDoc(collection(db, path), {
              ...preset,
              created_at: serverTimestamp()
            });
          } catch (e) {
            console.error("Preset seed failure:", e);
          }
        });
        return;
      }

      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at || new Date().toISOString()
        };
      });

      // Sort newest created_at first
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPermits(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Set default form values matching the current logged-in user
  useEffect(() => {
    if (currentUser) {
      setNewPermit(prev => ({
        ...prev,
        applicant_name: currentUser.name
      }));
    }
  }, [currentUser, isApplyModalOpen]);

  // Form submit handler
  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPermit.title || !newPermit.start_time || !newPermit.end_time || !newPermit.area) {
      return;
    }

    const path = "permits";
    try {
      await addDoc(collection(db, path), {
        ...newPermit,
        applicant_id: currentUser?.id || "anonymous",
        status: "pending",
        approved_by: "",
        approval_notes: "",
        created_at: serverTimestamp()
      });
      
      // Reset form
      setNewPermit({
        title: "",
        type: "work",
        category: "maintenance",
        applicant_name: currentUser?.name || "",
        description: "",
        start_time: "",
        end_time: "",
        area: "",
        risk_level: "low",
      });
      setIsApplyModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  // Review status submit handler (Approve / Reject)
  const handleReviewStatus = async (status: "approved" | "rejected") => {
    if (!selectedPermit) return;

    const path = "permits";
    try {
      const docRef = doc(db, path, selectedPermit.id);
      await updateDoc(docRef, {
        status: status,
        approved_by: currentUser?.name || "Administrator",
        approval_notes: reviewNotes,
        updated_at: serverTimestamp()
      });

      // Update local state if needed
      setSelectedPermit((prev: any) => ({
        ...prev,
        status,
        approved_by: currentUser?.name || "Administrator",
        approval_notes: reviewNotes
      }));

      setIsReviewModalOpen(false);
      setReviewNotes("");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  // Quick stats calculations
  const totalCounts = permits.length;
  const pendingCount = permits.filter(p => p.status === "pending").length;
  const approvedCount = permits.filter(p => p.status === "approved").length;
  const expiredCount = permits.filter(p => p.status === "expired" || new Date(p.end_time).getTime() < Date.now()).length;

  // Filter application logic
  const filteredPermits = permits.filter(permit => {
    const matchesSearch = 
      permit.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      permit.applicant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      permit.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (permit.description && permit.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" ? true : permit.status === statusFilter;
    const matchesType = typeFilter === "all" ? true : permit.type === typeFilter;
    const matchesRisk = riskFilter === "all" ? true : permit.risk_level === riskFilter;
    const matchesCategory = categoryFilter === "all" ? true : (permit.category || "maintenance") === categoryFilter;
    const matchesMapZone = !filteredMapZone ? true : normalizeAreaToZoneId(permit.area) === filteredMapZone;

    return matchesSearch && matchesStatus && matchesType && matchesRisk && matchesCategory && matchesMapZone;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {language === "ar" ? "معتمد نشط" : "Approved / Active"}
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {language === "ar" ? "مرفوض" : "Rejected"}
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            {language === "ar" ? "منتهي الصلاحية" : "Expired"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {language === "ar" ? "في الانتظار" : "Pending Sync"}
          </span>
        );
    }
  };

  const getRiskLabel = (risk: string) => {
    switch (risk) {
      case "critical":
        return <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-150">{language === "ar" ? "حرجة للغاية" : "CRITICAL RISK"}</span>;
      case "high":
        return <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-150">{language === "ar" ? "مرتفعة الخطورة" : "HIGH RISK"}</span>;
      case "medium":
        return <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-150">{language === "ar" ? "متوسطة" : "MEDIUM RISK"}</span>;
      default:
        return <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-150">{language === "ar" ? "منخفضة" : "LOW RISK"}</span>;
    }
  };

  const getCategoryBadge = (category: string) => {
    const cat = PERMIT_CATEGORIES.find(c => c.id === category) || {
      label_en: "Maintenance",
      label_ar: "الصيانة",
      bg: "bg-amber-50 text-amber-700 border-amber-200"
    };
    const label = language === "ar" ? cat.label_ar : cat.label_en;
    return (
      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border shrink-0", cat.bg)}>
        {label}
      </span>
    );
  };

  const getPermitTypeLabel = (typeId: string) => {
    const permitType = PERMIT_TYPES.find(t => t.id === typeId);
    if (!permitType) return typeId;
    return language === "ar" ? permitType.label_ar : permitType.label_en;
  };

  return (
    <div className="space-y-6">
      {/* Banner Title Part */}
      <div className={cn("flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 lg:p-8 rounded-[2rem] border border-slate-200 shadow-2xs", isRtl && "lg:flex-row-reverse text-right")}>
        <div>
          <div className={cn("flex items-center gap-2", isRtl && "flex-row-reverse")}>
            <div className="bg-emerald-50 border border-emerald-250 p-2 rounded-xl text-emerald-600">
              <FileCheck size={24} />
            </div>
            <h1 className="text-xl lg:text-3xl font-black tracking-tight text-slate-900 leading-tight">
              {t("permits_title")}
            </h1>
          </div>
          <p className="text-slate-500 text-xs font-semibold mt-1.5 max-w-2xl leading-relaxed">
            {t("permits_subtitle")}
          </p>
        </div>

        <button
          onClick={() => setIsApplyModalOpen(true)}
          className={cn("px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all cursor-pointer flex items-center gap-2 shadow-sm shrink-0 active:scale-[0.98]", isRtl && "flex-row-reverse")}
        >
          <Plus size={16} />
          <span>{t("apply_for_permit")}</span>
        </button>
      </div>

      {/* KPI Stats overview bento */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{language === "ar" ? "إجمالي التصاريح" : "Total Permits"}</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-slate-950">{totalCounts}</span>
            <span className="text-xs font-semibold text-slate-400">issued</span>
          </div>
        </div>
        <div className="bg-amber-50/50 p-5 rounded-3xl border border-amber-200/50 shadow-2xs flex flex-col justify-between">
          <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{language === "ar" ? "قيد التدقيق" : "Pending Review"}</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-amber-700">{pendingCount}</span>
            <span className="text-amber-500 text-xs animate-pulse">● pending</span>
          </div>
        </div>
        <div className="bg-emerald-50/40 p-5 rounded-3xl border border-emerald-200/50 shadow-2xs flex flex-col justify-between">
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{language === "ar" ? "الموافقات الفعالة" : "Active Approved"}</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-emerald-700">{approvedCount}</span>
            <span className="text-emerald-500 text-xs">● live</span>
          </div>
        </div>
        <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{language === "ar" ? "منتهية الصلاحية" : "Completed / Expired"}</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-slate-700">{expiredCount}</span>
            <span className="text-slate-400 text-xs">historical</span>
          </div>
        </div>
      </div>

      {/* Controls: Search, Types, Status, Risk Filter Row */}
      <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-2xs space-y-4">
        <div className={cn("flex flex-col md:flex-row gap-3 items-center justify-between", isRtl && "md:flex-row-reverse")}>
          
          {/* Search bar input details */}
          <div className="relative w-full md:max-w-md">
            <Search className={cn("absolute top-3.5 text-slate-400", isRtl ? "right-3.5" : "left-3.5")} size={16} />
            <input
              type="text"
              placeholder={language === "ar" ? "البحث عن طريق العنوان، مقدم الطلب أو المنطقة..." : "Search title, applicant, zone..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full py-3 bg-slate-50 hover:bg-slate-50/85 text-slate-900 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 duration-150 font-medium",
                isRtl ? "pr-10 pl-4 text-right" : "pl-10 pr-4 text-left"
              )}
            />
          </div>

          <div className={cn("flex flex-wrap items-center gap-2 w-full md:w-auto justify-end", isRtl && "flex-row-reverse")}>
            
            {/* Category selector */}
            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-[11px] font-bold text-slate-700 focus:outline-none"
              >
                <option value="all">{language === "ar" ? "كل الفئات" : "All Categories"}</option>
                {PERMIT_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {language === "ar" ? cat.label_ar : cat.label_en}
                  </option>
                ))}
              </select>
            </div>

            {/* Type selector */}
            <div className="flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-[11px] font-bold text-slate-700 focus:outline-none"
              >
                <option value="all">{language === "ar" ? "جميع الأنواع" : "All Classes"}</option>
                {PERMIT_TYPES.map(type => (
                  <option key={type.id} value={type.id}>
                    {language === "ar" ? type.label_ar : type.label_en}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Selector */}
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-[11px] font-bold text-slate-700 focus:outline-none"
              >
                <option value="all">{language === "ar" ? "كل الحالات" : "All Status"}</option>
                <option value="pending">{language === "ar" ? "قيد الانتظار" : "Pending"}</option>
                <option value="approved">{language === "ar" ? "معتمدة نشطة" : "Approved / Active"}</option>
                <option value="rejected">{language === "ar" ? "مرفوضة" : "Rejected"}</option>
                <option value="expired">{language === "ar" ? "منتهية" : "Expired"}</option>
              </select>
            </div>

            {/* Risk Levels Selector */}
            <div className="flex items-center gap-2">
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-[11px] font-bold text-slate-700 focus:outline-none"
              >
                <option value="all">{language === "ar" ? "كل مستويات المخاطر" : "All Risks"}</option>
                <option value="low">{language === "ar" ? "منخفضة" : "Low Risk"}</option>
                <option value="medium">{language === "ar" ? "متوسطة" : "Medium Risk"}</option>
                <option value="high">{language === "ar" ? "مرتفعة" : "High Risk"}</option>
                <option value="critical">{language === "ar" ? "حرجة" : "Critical Risk"}</option>
              </select>
            </div>

          </div>
        </div>
      </div>

      {/* Main Grid: Left side details list / Right side focused preview details panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Permits list records */}
        <div className="lg:col-span-7 space-y-3">
          {filteredPermits.length === 0 ? (
            <div className="bg-white rounded-[2rem] border border-slate-200 p-12 text-center text-slate-500">
              <ClipboardList className="mx-auto text-slate-300 mb-4" size={48} />
              <h3 className="font-black text-slate-900 text-sm tracking-wide uppercase">{language === "ar" ? "لم يتم العثور على تصاريح" : "No Permits Recieved"}</h3>
              <p className="text-xs text-slate-400 mt-1">{language === "ar" ? "قم بتعديل عناصر التصفية أو تقديم طلب تصريح جديد لبدء رصد العمليات." : "Try clearing filters or apply for an operational permit above."}</p>
            </div>
          ) : (
            filteredPermits.map(permit => {
              const isSelected = selectedPermit?.id === permit.id;
              return (
                <div
                  key={permit.id}
                  onClick={() => {
                    setSelectedPermit(permit);
                    // preset default review note if reviewing
                    setReviewNotes(permit.approval_notes || "");
                  }}
                  className={cn(
                    "cursor-pointer bg-white p-5 rounded-3xl border transition-all duration-150 text-left flex items-start gap-4 shadow-3xs relative overflow-hidden active:scale-[0.99]",
                    isSelected ? "border-emerald-500 ring-2 ring-emerald-500/10" : "border-slate-200 hover:border-slate-300",
                    isRtl && "text-right flex-row-reverse"
                  )}
                >
                  <div className={cn(
                    "p-3 rounded-2xl shrink-0 border",
                    permit.status === "approved" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                    permit.status === "rejected" ? "bg-rose-50 text-rose-600 border-rose-100" :
                    permit.status === "expired" ? "bg-slate-50 text-slate-400 border-slate-200" :
                    "bg-amber-50 text-amber-500 border-amber-100/50"
                  )}>
                    <FileText size={20} />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className={cn("flex items-center gap-2 flex-wrap text-slate-450", isRtl && "flex-row-reverse")}>
                      {getCategoryBadge(permit.category || "maintenance")}
                      <span>•</span>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                        {getPermitTypeLabel(permit.type)}
                      </span>
                      <span>•</span>
                      {getRiskLabel(permit.risk_level)}
                    </div>

                    <h3 className="text-sm font-black text-slate-900 truncate tracking-wide">
                      {permit.title}
                    </h3>

                    <p className="text-xs text-slate-500 font-bold tracking-tight">
                      {language === "ar" ? "الجهة الطالبة:" : "Applicant:"} <span className="text-slate-700">{permit.applicant_name}</span>
                    </p>

                    <div className={cn("flex flex-wrap gap-x-4 gap-y-1 items-center text-[11px] text-slate-400 font-medium pt-2 border-t border-slate-50 mt-2", isRtl && "flex-row-reverse")}>
                      <span className="flex items-center gap-1">
                        <MapPin size={12} className="text-slate-450" />
                        <span className="truncate max-w-[150px]">{permit.area}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        <span>{new Date(permit.start_time).toLocaleDateString(language === "ar" ? "ar-EG" : "en-GB", {day: 'numeric', month: 'short'})}</span>
                      </span>
                    </div>
                  </div>

                  {/* Indicator Arrow or State indicator */}
                  <div className="self-center">
                    {getStatusBadge(permit.status)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Side: Focused Selected Permit detailed document layout */}
        <div className="lg:col-span-5 space-y-6">
          <SiteMap
            selectedArea={selectedPermit ? selectedPermit.area : ""}
            onSelectZone={(zoneId) => {
              setFilteredMapZone(zoneId);
              // if selected permit doesn't belong to this newly filtered zone, clear selection to keep UI synchronized
              if (zoneId && selectedPermit && normalizeAreaToZoneId(selectedPermit.area) !== zoneId) {
                setSelectedPermit(null);
              }
            }}
            language={language}
          />

          {/* Active zone filter notice banner */}
          {filteredMapZone && (
            <div className="p-4 bg-emerald-50 text-emerald-800 rounded-3xl border border-emerald-100/80 text-xs flex justify-between items-center animate-fade-in font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span>
                  {language === "ar" ? "تصفية الخريطة نشطة: " : "Map Zone Filter Active: "}{" "}
                  <strong className="text-emerald-900 font-black tracking-wide">
                    {filteredMapZone === "inner" ? (language === "ar" ? "حرم الهيكل الداخلي" : "Inner Sanctum Ring-B") :
                     filteredMapZone === "sarsen" ? (language === "ar" ? "أحجار السارسن الخارجية" : "Sarsen Outer Stones") :
                     filteredMapZone === "trenches" ? (language === "ar" ? "الخنادق والحدود المشتركة" : "Perimeter Trenches") :
                     (language === "ar" ? "ممر درب الاعتدال الشمسي" : "Sunset Axis Portal")}
                  </strong>
                </span>
              </span>
              <button
                onClick={() => setFilteredMapZone(null)}
                className="text-xs font-black uppercase tracking-wider text-emerald-600 hover:text-emerald-800 cursor-pointer border border-emerald-200/50 hover:bg-emerald-100/50 px-2.5 py-1 rounded-xl shadow-xs transition-colors"
              >
                {language === "ar" ? "إلغاء التصفية" : "Clear Filter"}
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {selectedPermit ? (
              <motion.div
                key={selectedPermit.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-white rounded-[2rem] border border-slate-200 p-6 space-y-6 shadow-2xs text-left"
              >
                {/* Header detail */}
                <div className={cn("flex justify-between items-start gap-3 border-b border-slate-100 pb-5", isRtl && "flex-row-reverse text-right")}>
                  <div className="space-y-1">
                    <div className={cn("flex items-center gap-1.5", isRtl && "flex-row-reverse")}>
                      {getCategoryBadge(selectedPermit.category || "maintenance")}
                      <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                        {getPermitTypeLabel(selectedPermit.type)}
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-slate-900 mt-1 leading-snug tracking-wide">
                      {selectedPermit.title}
                    </h2>
                  </div>
                  <div className="shrink-0">
                    {getStatusBadge(selectedPermit.status)}
                  </div>
                </div>

                {/* Meta details bento mapping */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block mb-1">
                      {language === "ar" ? "مقدم الطلب / المندوب" : "Applicant Entity"}
                    </span>
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                      <UserIcon size={13} className="text-slate-500 shrink-0" />
                      <span className="truncate">{selectedPermit.applicant_name}</span>
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-105">
                    <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block mb-1">
                      {language === "ar" ? "منطقة العمل المرخصة" : "Deployment Zone"}
                    </span>
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                      <MapPin size={13} className="text-emerald-500 shrink-0" />
                      <span className="truncate">{selectedPermit.area}</span>
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block mb-1">
                      {language === "ar" ? "بداية التصريح" : "Valid From"}
                    </span>
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1 font-mono">
                      <Clock size={13} className="text-slate-400" />
                      <span>{new Date(selectedPermit.start_time).toLocaleString(language === "ar" ? "ar-EG" : "en-GB", { hour12: false, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block mb-1">
                      {language === "ar" ? "نهاية الصلاحية" : "Valid Until"}
                    </span>
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1 font-mono">
                      <Clock size={13} className="text-slate-400" />
                      <span>{new Date(selectedPermit.end_time).toLocaleString(language === "ar" ? "ar-EG" : "en-GB", { hour12: false, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </span>
                  </div>
                </div>

                {/* Risk profile bar */}
                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                    <AlertTriangle size={14} className="text-slate-400" />
                    <span>{language === "ar" ? "مخاطر السلامة والإنقاذ:" : "Operational Hazard Level:"}</span>
                  </span>
                  {getRiskLabel(selectedPermit.risk_level)}
                </div>

                {/* Description details */}
                <div className="space-y-1.5 text-left">
                  <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">
                    {language === "ar" ? "وصف الأنشطة وتدابير الأمان" : "Scope of Operations & Methods"}
                  </span>
                  <p className="text-xs font-semibold text-slate-650 leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-slate-100/60 max-h-52 overflow-y-auto">
                    {selectedPermit.description || (language === "ar" ? "لا يوجد وصف إضافي مرفق مع الطلب." : "No explicit description notes provided.")}
                  </p>
                </div>

                {/* Approval Review Status Tracker */}
                {selectedPermit.approved_by && (
                  <div className="space-y-2 bg-emerald-50/10 p-4 rounded-3xl border border-emerald-100/55 text-left">
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 block flex items-center gap-1">
                      <UserCheck size={12} />
                      <span>{language === "ar" ? "سجل مصادقة المشرف والاعتماد" : "Authority Validation Log"}</span>
                    </span>
                    <div className="text-xs space-y-1 text-slate-600">
                      <p className="font-bold">
                        {language === "ar" ? "المشرف المعتمد:" : "Verified Auth Rep:"} <span className="text-slate-800 font-extrabold">{selectedPermit.approved_by}</span>
                      </p>
                      {selectedPermit.approval_notes && (
                        <div className="text-slate-500 italic mt-1.5 pl-3 border-l-2 border-slate-300">
                          "{selectedPermit.approval_notes}"
                        </div>
                      )}

                      {selectedPermit.status === "approved" && (
                        <button
                          onClick={() => setIsPassOpen(true)}
                          className="w-full mt-3 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-xs transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                          <Printer size={13} className="text-emerald-405 animate-pulse" />
                          <span>{language === "ar" ? "تصدير وطباعة بطاقة المرور" : "Export & Print Access Pass"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Review Action Controls - displayed only for authorized users (Admins or Managers) if the permit is pending */}
                {selectedPermit.status === "pending" && (currentUser?.role === "admin" || currentUser?.role === "manager") && (
                  <div className="pt-4 border-t border-slate-150 space-y-3">
                    <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">
                      {language === "ar" ? "صندوق قرارات واعتمادات الإدارة" : "Review Decisions & Safety Directives"}
                    </span>
                    
                    <textarea
                      placeholder={language === "ar" ? "أدخل تعليقات وتوجيهات السلامة الفنية بخصوص هذا التصريح..." : "Specify supervisor safety instructions, speed limits, or restrictions..."}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={3}
                      className="w-full p-3.5 bg-slate-50 text-xs text-slate-900 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleReviewStatus("rejected")}
                        className="py-3 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-black uppercase tracking-wider rounded-2xl cursor-pointer duration-150 flex items-center justify-center gap-1 shrink-0"
                      >
                        <XIcon size={14} />
                        <span>{language === "ar" ? "رفض الطلب" : "Reject Permit"}</span>
                      </button>
                      <button
                        onClick={() => handleReviewStatus("approved")}
                        className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-2xl cursor-pointer duration-150 flex items-center justify-center gap-1 shrink-0 shadow-sm"
                      >
                        <Check size={14} />
                        <span>{language === "ar" ? "اعتماد وتفعيل" : "Approve & Issue"}</span>
                      </button>
                    </div>
                  </div>
                )}

              </motion.div>
            ) : (
              <div className="bg-slate-100/50 rounded-[2.5rem] p-12 text-center text-slate-450 border border-dashed border-slate-350 min-h-[400px] flex flex-col justify-center items-center">
                <FileCheck className="text-slate-300 mb-3" size={44} />
                <h3 className="font-extrabold text-sm text-slate-650 uppercase tracking-widest">{language === "ar" ? "حدد تصريحًا للتفاصيل" : "No Permit Selected"}</h3>
                <p className="text-xs text-slate-400 max-w-xs mt-1 leading-snug">{language === "ar" ? "اختر أحد السجلات من القائمة لعرض وصف السلامة وتفاصيل التفعيل والموافقة." : "Select an active or pending permit request to verify safety parameters and deploy status updates."}</p>
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Apply for Permit Form Modal Overlays */}
      <AnimatePresence>
        {isApplyModalOpen && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] border border-slate-200 shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className={cn("flex justify-between items-center p-6 border-b border-slate-100", isRtl && "flex-row-reverse")}>
                <h3 className="text-base font-black text-slate-950 uppercase tracking-wider">
                  📝 {language === "ar" ? "نموذج تقديم طلب تصريح عمليات جديد" : "Request Operational Permit"}
                </h3>
                <button
                  onClick={() => setIsApplyModalOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-xl cursor-pointer text-slate-400 hover:text-slate-600"
                >
                  <XIcon size={18} />
                </button>
              </div>

              <form onSubmit={handleApplySubmit} className="p-6 space-y-4">
                
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    {language === "ar" ? "عنوان التصريح / المهمة" : "Permit Operational Title"}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Stonehenge Monolith Laser Cleaning Phase 1"
                    value={newPermit.title}
                    onChange={(e) => setNewPermit(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium text-slate-900"
                  />
                </div>

                {/* Grid row: Category / Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      {language === "ar" ? "فئة التصريح" : "Permit Category"}
                    </label>
                    <select
                      value={newPermit.category}
                      onChange={(e) => setNewPermit(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none tracking-wide text-slate-800 font-extrabold"
                    >
                      {PERMIT_CATEGORIES.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {language === "ar" ? cat.label_ar : cat.label_en}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      {language === "ar" ? "صنف التصريح" : "Operational Class"}
                    </label>
                    <select
                      value={newPermit.type}
                      onChange={(e) => setNewPermit(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none tracking-wide text-slate-800 font-extrabold"
                    >
                      {PERMIT_TYPES.map(p => (
                        <option key={p.id} value={p.id}>
                          {language === "ar" ? p.label_ar : p.label_en}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Applicant Name Row */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    {language === "ar" ? "اسم مقدم الطلب" : "Applicant Entity Full Name"}
                  </label>
                  <input
                    type="text"
                    required
                    value={newPermit.applicant_name}
                    onChange={(e) => setNewPermit(prev => ({ ...prev, applicant_name: e.target.value }))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none font-medium text-slate-900"
                  />
                </div>

                {/* Grid row: Site Zone Area / Hazard Level */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      {language === "ar" ? "المنطقة المشمولة في الموقع" : "Permitted Site Zone / Area"}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Stonehenge Inner Monuments Block C"
                      value={newPermit.area}
                      onChange={(e) => setNewPermit(prev => ({ ...prev, area: e.target.value }))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none font-medium text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      {language === "ar" ? "تقدير مستوى خطورة النشاط" : "Safety Risk Profile Level"}
                    </label>
                    <select
                      value={newPermit.risk_level}
                      onChange={(e) => setNewPermit(prev => ({ ...prev, risk_level: e.target.value }))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none tracking-wide text-slate-800 font-extrabold"
                    >
                      <option value="low">🟢 {language === "ar" ? "منخفضة" : "Low Risk"}</option>
                      <option value="medium">🔵 {language === "ar" ? "متوسطة" : "Medium Risk"}</option>
                      <option value="high">🟡 {language === "ar" ? "مرتفعة المخاطر" : "High Risk"}</option>
                      <option value="critical">🔴 {language === "ar" ? "حرجة للغاية" : "Critical Risk"}</option>
                    </select>
                  </div>
                </div>

                {/* Grid row: Start date - End date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      {language === "ar" ? "تاريخ ووقت البدء" : "Valid From (Date/Time)"}
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={newPermit.start_time}
                      onChange={(e) => setNewPermit(prev => ({ ...prev, start_time: e.target.value }))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none font-medium text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      {language === "ar" ? "تاريخ ووقت الانتهاء" : "Valid Until (Expiration)"}
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={newPermit.end_time}
                      onChange={(e) => setNewPermit(prev => ({ ...prev, end_time: e.target.value }))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none font-medium text-slate-900"
                    />
                  </div>
                </div>

                {/* Description details */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    {language === "ar" ? "وصف دقيق للأعمال والاحتياطات المتخذة" : "Task Description & Safety Protocols"}
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Describe equipment used, radio channels monitored, emergency safety gears deployed..."
                    value={newPermit.description}
                    onChange={(e) => setNewPermit(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium text-slate-900"
                  />
                </div>

                {/* Submit button bar */}
                <div className="flex justify-end gap-3.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsApplyModalOpen(false)}
                    className="px-5 py-3 border border-slate-200 hover:bg-slate-50 font-black text-slate-500 text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                  >
                    {language === "ar" ? "إلغاء الطلب" : "Cancel Request"}
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                  >
                    🚀 {language === "ar" ? "تقديم طلب الاعتماد" : "Submit Request"}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Contractor Badge Pass Popup Modal Overlay (Option 2) */}
      {isPassOpen && selectedPermit && (
        <ContractorPass
          permit={selectedPermit}
          onClose={() => setIsPassOpen(false)}
          language={language}
        />
      )}
    </div>
  );
}
