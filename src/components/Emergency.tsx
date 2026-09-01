import React, { useState, useEffect } from "react";
import { 
  Flame, 
  Activity, 
  ShieldAlert, 
  CloudLightning, 
  AlertOctagon, 
  CheckCircle2, 
  Clock, 
  User,
  ChevronRight,
  Bell,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  where
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { CustomizableGrid } from "./CustomizableGrid";
import { LayoutItem } from "../context/LayoutContext";

export function Emergency() {
  const { language, tData, dir } = useLanguage();
  const [protocols, setProtocols] = useState<any[]>([]);
  const [activeEmergencies, setActiveEmergencies] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [view, setView] = useState<'active' | 'history'>('active');
  const [selectedProtocol, setSelectedProtocol] = useState<any>(null);
  const [isActivating, setIsActivating] = useState(false);

  const { user: currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;

    // Listen for protocols
    const protocolsPath = "emergency_protocols";
    const protocolsQuery = collection(db, protocolsPath);
    const unsubscribeProtocols = onSnapshot(protocolsQuery, (snapshot) => {
      setProtocols(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, protocolsPath);
    });

    // Listen for active emergencies
    const activePath = "active_emergencies";
    const activeQuery = query(collection(db, activePath), where("status", "==", "active"), orderBy("created_at", "desc"));
    const unsubscribeActive = onSnapshot(activeQuery, (snapshot) => {
      setActiveEmergencies(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString()
      })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, activePath);
    });

    // Listen for history
    const historyQuery = query(collection(db, activePath), where("status", "==", "resolved"), orderBy("resolved_at", "desc"));
    const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
        resolved_at: doc.data().resolved_at?.toDate?.()?.toISOString() || new Date().toISOString()
      })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, activePath);
    });

    return () => {
      unsubscribeProtocols();
      unsubscribeActive();
      unsubscribeHistory();
    };
  }, [currentUser]);

  const handleActivate = async () => {
    if (!selectedProtocol || !currentUser) return;
    setIsActivating(true);
    try {
      await addDoc(collection(db, "active_emergencies"), {
        protocol_id: selectedProtocol.id,
        protocol_name: selectedProtocol.name,
        protocol_type: selectedProtocol.type,
        protocol_steps: selectedProtocol.steps,
        activated_by: currentUser.id,
        activated_by_name: currentUser.name,
        status: "active",
        created_at: serverTimestamp()
      });
      setSelectedProtocol(null);
    } catch (error) {
      console.error("Failed to activate protocol", error);
    } finally {
      setIsActivating(false);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await updateDoc(doc(db, "active_emergencies", id), {
        status: "resolved",
        resolved_at: serverTimestamp()
      });
    } catch (error) {
      console.error("Failed to resolve emergency", error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'fire': return Flame;
      case 'medical': return Activity;
      case 'security': return ShieldAlert;
      case 'weather': return CloudLightning;
      default: return AlertOctagon;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'fire': return "bg-red-500 shadow-red-500/20";
      case 'medical': return "bg-blue-500 shadow-blue-500/20";
      case 'security': return "bg-amber-600 shadow-amber-600/20";
      case 'weather': return "bg-purple-500 shadow-purple-500/20";
      default: return "bg-slate-700 shadow-slate-700/20";
    }
  };

  const defaultLayout: LayoutItem[] = [
    { i: 'banner', x: 0, y: 0, w: 12, h: 4 },
    { i: 'protocols', x: 0, y: 4, w: 8, h: 12 },
    { i: 'incidents', x: 0, y: 16, w: 8, h: 15 },
    { i: 'preview', x: 8, y: 4, w: 4, h: 27 },
  ];

  const isRtl = dir === "rtl";

  return (
    <div className="pb-12">
      <CustomizableGrid pageId="emergency" defaultLayout={defaultLayout}>
        <div key="banner" className="h-full">
          <AnimatePresence>
            {activeEmergencies.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden h-full"
              >
                <div className={cn(
                  "bg-red-600 text-white p-6 rounded-3xl shadow-2xl shadow-red-600/30 flex items-center justify-between h-full animate-pulse",
                  isRtl && "flex-row-reverse"
                )}>
                  <div className={cn("flex items-center gap-4", isRtl && "flex-row-reverse text-right")}>
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                      <Bell className="animate-bounce" size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black uppercase tracking-tighter">
                        {language === "ar" ? "بروتوكول الطوارئ والأزمات نشط حالياً" : "Active Emergency Protocol"}
                      </h2>
                      <p className="text-red-100 font-bold">
                        {language === "ar" 
                          ? `هناك ${activeEmergencies.length} بلاغات نشطة تتطلب مستوى استجابة ميداني فوري.`
                          : `${activeEmergencies.length} active ${activeEmergencies.length === 1 ? 'incident' : 'incidents'} requiring immediate attention.`}
                      </p>
                    </div>
                  </div>
                  <div className={cn("flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-xs font-black tracking-widest uppercase shrink-0", isRtl && "flex-row-reverse")}>
                    <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                    {language === "ar" ? "تم بث التنبيه الميداني الفوري" : "LIVE BROADCAST ACTIVE"}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div key="protocols" className="h-full text-start">
          <div className="space-y-6 h-full">
            <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
              <h3 className={cn("text-2xl font-black text-slate-900 flex items-center gap-2", isRtl && "flex-row-reverse text-right")}>
                <AlertOctagon className="text-red-600 shrink-0" />
                {language === "ar" ? "خطط وبروتوكولات الطوارئ" : "Emergency Protocols"}
              </h3>
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                {language === "ar" ? "الملف الأحمر الرقمي" : "Digital Red Folder"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {protocols.map((protocol) => {
                const Icon = getIcon(protocol.type);
                return (
                  <motion.button
                    key={protocol.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedProtocol(protocol)}
                    className={cn(
                      "p-6 bg-white rounded-3xl border-2 border-slate-100 hover:border-red-500 transition-all group shadow-sm cursor-pointer",
                      isRtl ? "text-right flex flex-col items-end" : "text-left"
                    )}
                  >
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg", getColor(protocol.type))}>
                      <Icon size={24} />
                    </div>
                    <h4 className="text-lg font-black text-slate-900 group-hover:text-red-600 transition-colors">{tData(protocol.name)}</h4>
                    <p className="text-sm text-slate-500 mt-2 line-clamp-2 leading-relaxed font-medium">{tData(protocol.description)}</p>
                    <div className={cn(
                      "mt-4 flex items-center text-xs font-black uppercase tracking-widest group-hover:text-red-500",
                      isRtl && "flex-row-reverse"
                    )}>
                      {language === "ar" ? "عرض الخطة التكتيكية" : "View Protocol"} 
                      <ChevronRight size={14} className={cn("shrink-0", isRtl ? "mr-1 rotate-180" : "ml-1")} />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        <div key="incidents" className="h-full text-start">
          <div className="space-y-4 h-full">
            <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
              <h3 className="text-lg font-black text-slate-900">
                {view === 'active' 
                  ? (language === "ar" ? "الحالات والتدخلات النشطة" : "Active Incidents") 
                  : (language === "ar" ? "سجل تصفية الطوارئ والأزمات" : "Emergency Log")}
              </h3>
              <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => setView('active')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    view === 'active' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {language === "ar" ? "النشطة" : "Active"}
                </button>
                <button
                  onClick={() => setView('history')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    view === 'history' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {language === "ar" ? "الأرشيف" : "History"}
                </button>
              </div>
            </div>

            <div className="h-[calc(100%-40px)] overflow-y-auto pr-2">
              {view === 'active' ? (
                activeEmergencies.length === 0 ? (
                  <div className="p-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <CheckCircle2 className="mx-auto text-slate-300 mb-4 animate-pulse" size={48} />
                    <p className="text-slate-500 font-extrabold">
                      {language === "ar" ? "لا توجد أي أزمات أو بلاغات طوارئ نشطة حالياً. الوضع آمن." : "No active emergencies. Site is secure."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeEmergencies.map((emergency) => (
                      <motion.div
                        key={emergency.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-6 rounded-3xl border-2 border-red-100 shadow-lg text-start"
                      >
                        <div className={cn("flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6", isRtl && "sm:flex-row-reverse")}>
                          <div className={cn("flex items-center gap-4", isRtl && "flex-row-reverse text-right")}>
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0", getColor(emergency.protocol_type))}>
                              {React.createElement(getIcon(emergency.protocol_type), { size: 20 })}
                            </div>
                            <div>
                              <h4 className="text-lg font-black text-slate-950">{tData(emergency.protocol_name)}</h4>
                              <div className={cn("flex items-center gap-3 mt-1 flex-wrap", isRtl && "flex-row-reverse")}>
                                <span className={cn("flex items-center gap-1 text-xs text-slate-500 font-bold", isRtl && "flex-row-reverse")}>
                                  <User size={12} className="shrink-0" />
                                  <span>{language === "ar" ? "مفعل بواسطة:" : "Activated by"} {tData(emergency.activated_by_name)}</span>
                                </span>
                                <span className={cn("flex items-center gap-1 text-xs text-slate-500 font-bold", isRtl && "flex-row-reverse")}>
                                  <Clock size={12} className="shrink-0" />
                                  <span>{new Date(emergency.created_at).toLocaleTimeString(language === "ar" ? "ar-EG" : "en-US")}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleResolve(emergency.id)}
                            className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors cursor-pointer shrink-0"
                          >
                            {language === "ar" ? "حل واحتواء الحادث" : "Mark as Resolved"}
                          </button>
                        </div>

                        <div className="space-y-3">
                          <p className={cn("text-xs font-black text-slate-400 uppercase tracking-[0.15em] mb-2", isRtl && "text-right")}>
                            {language === "ar" ? "قائمة الخطوات الأمنية الفورية" : "Immediate Response Checklist"}
                          </p>
                          {emergency.protocol_steps.map((step: string, i: number) => (
                            <div key={i} className={cn("flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100", isRtl && "flex-row-reverse text-right")}>
                              <div className="w-5 h-5 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                                <span className="text-[10px] font-black text-slate-500">{i + 1}</span>
                              </div>
                              <p className="text-sm text-slate-700 font-bold leading-relaxed">{tData(step)}</p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  {history.length === 0 ? (
                    <div className="p-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                      <Clock className="mx-auto text-slate-300 mb-4 animate-pulse" size={48} />
                      <p className="text-slate-500 font-bold">
                        {language === "ar" ? "لا توجد أي أرشيفات طوابئ سابقة تشغيلية." : "No emergency history recorded."}
                      </p>
                    </div>
                  ) : (
                    history.map((item) => (
                      <div key={item.id} className={cn("bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between gap-4 text-start", isRtl && "flex-row-reverse")}>
                        <div className={cn("flex items-center gap-4 min-w-0 flex-1", isRtl && "flex-row-reverse text-right")}>
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white opacity-50 shrink-0", getColor(item.protocol_type))}>
                            {React.createElement(getIcon(item.protocol_type), { size: 20 })}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-base font-black text-slate-900 truncate">{tData(item.protocol_name)}</h4>
                            <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                              {language === "ar" ? "تم التفعيل بواسطة:" : "Activated by"} {tData(item.activated_by_name)} • {new Date(item.created_at).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US")}
                            </p>
                          </div>
                        </div>
                        <div className={cn("text-right shrink-0", isRtl ? "text-left" : "text-right")}>
                          <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                            {language === "ar" ? "تم الاحتواء والحل" : "Resolved"}
                          </span>
                          <p className="text-[10px] text-slate-400 font-bold mt-1">
                            {language === "ar" ? "المستغرق:" : "Duration:"} {Math.round((new Date(item.resolved_at).getTime() - new Date(item.created_at).getTime()) / 60000)} {language === "ar" ? "دقائق" : "mins"}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div key="preview" className="h-full text-start">
          <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-2xl h-full overflow-y-auto">
            <h3 className={cn("text-xl font-black mb-6 border-b border-white/10 pb-4", isRtl && "text-right")}>
              {language === "ar" ? "تفاصيل ومعاينة الخطة" : "Protocol Preview"}
            </h3>
            
            {selectedProtocol ? (
              <div className={cn("space-y-6", isRtl ? "text-right flex flex-col items-end" : "text-left")}>
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg shrink-0", getColor(selectedProtocol.type))}>
                  {React.createElement(getIcon(selectedProtocol.type), { size: 28 })}
                </div>
                <div>
                  <h4 className="text-2xl font-black tracking-tight leading-tight">{tData(selectedProtocol.name)}</h4>
                  <p className="text-slate-400 mt-2 text-sm leading-relaxed font-medium">{tData(selectedProtocol.description)}</p>
                </div>

                <div className="space-y-4 w-full">
                  <p className={cn("text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1", isRtl ? "text-right" : "text-left")}>
                    {language === "ar" ? "معاينة قائمة التخطي" : "Checklist Preview"}
                  </p>
                  <div className="space-y-2 w-full">
                    {selectedProtocol.steps.map((step: string, i: number) => (
                      <div key={i} className={cn("flex gap-3 text-sm text-slate-300 font-bold leading-normal", isRtl && "flex-row-reverse text-right")}>
                        <span className="text-emerald-500 font-black shrink-0">{i + 1}.</span>
                        <span>{tData(step)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleActivate}
                  disabled={isActivating}
                  className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-red-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isActivating ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <AlertOctagon size={20} className="shrink-0" />
                      <span>{language === "ar" ? "تفعيل خطة الاستجابة الفورية" : "Activate Protocol"}</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => setSelectedProtocol(null)}
                  className="w-full py-3 text-slate-500 hover:text-white text-sm font-black transition-colors cursor-pointer text-center"
                >
                  {language === "ar" ? "إلغاء ومعاودة البحث" : "Cancel"}
                </button>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center text-slate-700 shrink-0 shadow-lg">
                  <ShieldAlert size={40} />
                </div>
                <p className="text-slate-400 font-medium text-sm leading-relaxed">
                  {language === "ar" 
                    ? "حدد بروتوكول طوارئ من الواجهة المجاورة لمعاينة البنود، تفعيل قائمة المهام، وإرسال بث فوري عبر الموقع لفرق الحراسة والتدخل."
                    : "Select a protocol to view details and activate site-wide broadcast."}
                </p>
              </div>
            )}
          </div>
        </div>
      </CustomizableGrid>
    </div>
  );
}

