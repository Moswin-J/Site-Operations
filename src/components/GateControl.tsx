import React, { useState, useEffect } from "react";
import { 
  Users, 
  UserPlus, 
  UserMinus, 
  TrendingUp, 
  AlertCircle,
  History,
  Activity,
  PlusCircle,
  Calendar,
  X,
  Clock,
  ShieldAlert,
  Radio,
  Megaphone,
  CheckCircle2,
  BellRing,
  Lock,
  Unlock,
  SlidersHorizontal,
  Timer,
  Volume2,
  VolumeX,
  Sun,
  Flame,
  Gauge
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { 
  doc, 
  onSnapshot, 
  updateDoc, 
  increment, 
  collection, 
  query, 
  limit, 
  getDocs,
  setDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
  orderBy
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { toast } from "sonner";
import { PeakTrafficCharts } from "./PeakTrafficCharts";
import { BarChart3 } from "lucide-react";

const playWebAudioChime = (type: 'entry' | 'exit' | 'error' | 'bell') => {
  if (typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    const isMuted = localStorage.getItem("gate_sound_muted") === "true";
    if (isMuted && type !== 'error') return; // let error bypass mute or just stay silent

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (type === 'entry') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.12); // G5
      gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'exit') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc.frequency.exponentialRampToValueAtTime(293.66, ctx.currentTime + 0.15); // D4
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'error') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(146.83, ctx.currentTime); // D3 low buzzing tone
      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'bell') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 glass chime
      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      osc.start();
      osc.stop(ctx.currentTime + 1.25);
    }
  } catch (e) {
    console.error("Audio Web Synth failure:", e);
  }
};

interface CounterCardProps {
  title: string;
  value: number;
  onIn: () => void;
  onOut: () => void;
  isPod?: boolean;
  theme?: "slate" | "emerald";
  totalEntriesValue?: number;
  language: string;
  isRtl: boolean;
  model?: { label: string; color: string; bg: string };
  count: number;
  capacity: number;
}

function CounterCard({ 
  title, 
  value, 
  onIn, 
  onOut, 
  isPod = false,
  theme = 'slate',
  totalEntriesValue = 0,
  language,
  isRtl,
  model,
  count,
  capacity
}: CounterCardProps) {
  return (
    <div className={cn(
      "p-8 rounded-[2.5rem] border shadow-xl flex flex-col items-center justify-center space-y-6 min-h-[400px] transition-all relative overflow-hidden",
      theme === 'emerald' 
        ? "bg-emerald-900 border-emerald-800 shadow-emerald-100 text-white" 
        : "bg-slate-900 border-slate-800 shadow-slate-100 text-white",
      isRtl && "text-right"
    )}>
      <div className={cn("absolute top-6 text-right", isRtl ? "left-8 text-left" : "right-8 text-right")}>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">
          {language === "ar" ? "إجمالي العابرين" : "Total Entries"}
        </p>
        <p className="text-xl font-black tabular-nums opacity-60">{totalEntriesValue}</p>
      </div>

      <div className="text-center space-y-2">
        <p className={cn(
          "text-[10px] font-black uppercase tracking-[0.2em]",
          theme === 'emerald' ? "text-emerald-400" : "text-slate-400"
        )}>
          {title}
        </p>
        <motion.p 
          key={value}
          initial={{ scale: 0.9, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="text-8xl font-black tabular-nums tracking-tighter"
        >
          {value}
        </motion.p>
      </div>

      {!isPod && model && (
        <div className={cn("px-4 py-2 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-2", model.bg, model.color, isRtl && "flex-row-reverse")}>
          <Activity size={16} />
          <span>{model.label} {language === "ar" ? "التشغيلي" : "State"}</span>
        </div>
      )}

      <div className={cn("grid grid-cols-2 gap-4 w-full pt-4", isRtl && "flex-row-reverse")}>
        <button 
          onClick={onIn}
          className={cn(
            "group relative p-6 rounded-2xl flex flex-col items-center gap-3 transition-all active:scale-95 overflow-hidden cursor-pointer",
            theme === 'emerald' 
              ? "bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20" 
              : "bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
          )}
        >
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <UserPlus size={32} strokeWidth={2.5} />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {language === "ar" ? "دخول (+)" : "Entry (+)"}
          </span>
        </button>
        <button 
          onClick={onOut}
          disabled={value === 0}
          className={cn(
            "group relative p-6 rounded-2xl flex flex-col items-center gap-3 transition-all active:scale-95 overflow-hidden disabled:opacity-30 disabled:grayscale cursor-pointer",
            theme === 'emerald' 
              ? "bg-white/10 hover:bg-white/20 border border-white/10" 
              : "bg-white/10 hover:bg-white/20 border border-white/10"
          )}
        >
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <UserMinus size={32} strokeWidth={2.5} />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {language === "ar" ? "خروج (-)" : "Exit (-)"}
          </span>
        </button>
      </div>

      {!isPod && (
        <div className="w-full space-y-2 pt-4">
          <div className={cn("flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest", isRtl && "flex-row-reverse")}>
            <span>{language === "ar" ? "استهلاك السعة الاستيعابية" : "Capacity Utilization"}</span>
            <span>{Math.round((count / capacity) * 100)}%</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <motion.div 
              animate={{ width: `${Math.min(100, (count / capacity) * 100)}%` }}
              className={cn("h-full transition-all duration-500", 
                count > capacity * 0.9 ? "bg-red-500" : "bg-emerald-500"
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function GateControl() {
  const { language, tData, dir } = useLanguage();
  const { user } = useAuth();
  const isRtl = dir === "rtl";

  // Tactile sound effects feedback muted state
  const [soundMuted, setSoundMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem("gate_sound_muted") === "true";
    } catch {
      return false;
    }
  });

  const toggleSoundMute = () => {
    const newVal = !soundMuted;
    setSoundMuted(newVal);
    localStorage.setItem("gate_sound_muted", String(newVal));
    toast.info(
      newVal 
        ? (language === "ar" ? "تم كتم أصوات المعالجة الصوتية للبوابات" : "Interactive gate chime audio feedback muted")
        : (language === "ar" ? "تم تفعيل التنبيهات والأصوات التفاعلية للبوابات" : "Interactive gate chime audio feedback unmuted")
    );
  };

  // Core state from existing counters
  const [count, setCount] = useState<number>(0);
  const [podCount, setPodCount] = useState<number>(0);
  const [totalEntries, setTotalEntries] = useState<number>(0);
  const [podTotalEntries, setPodTotalEntries] = useState<number>(0);
  const [capacity, setCapacity] = useState<number>(500);
  const [lastAction, setLastAction] = useState<{ type: string, time: Date } | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [showBackfill, setShowBackfill] = useState(false);
  const [showBulkBackfill, setShowBulkBackfill] = useState(false);
  const [bulkData, setBulkData] = useState("");
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  const [backfillData, setBackfillData] = useState({
    timestamp: new Date().toISOString().slice(0, 16),
    type: 'entry' as 'entry' | 'exit',
    isPod: false,
    count: 1
  });

  // NEW: Sub-tab state
  const [subActiveTab, setSubActiveTab] = useState<'counters' | 'schedule' | 'analytics'>('counters');

  // NEW: Historical list of emergency broadcasts
  const [broadcasts, setBroadcasts] = useState<any[]>([]);

  // NEW: Local simulated clock for testing schedules
  const [useSimulatedClock, setUseSimulatedClock] = useState(false);
  const [simulatedClockDate, setSimulatedClockDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [simulatedClockTime, setSimulatedClockTime] = useState<string>("16:45"); // 4:45 PM standard default for testing

  // NEW: Manager Emergency Broadcast controls state
  const [broadcastType, setBroadcastType] = useState<'open' | 'close'>('open');
  const [presetReason, setPresetReason] = useState<string>("severe_weather");
  const [customReasonNote, setCustomReasonNote] = useState<string>("");
  const [isPublishingBroadcast, setIsPublishingBroadcast] = useState(false);

  // NEW: Local tracking of acknowledged alerts
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem("acknowledged_gate_alerts");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Save acknowledgement helper
  const acknowledgeAlert = (id: string) => {
    const updated = { ...acknowledgedAlerts, [id]: true };
    setAcknowledgedAlerts(updated);
    localStorage.setItem("acknowledged_gate_alerts", JSON.stringify(updated));
    toast.success(language === "ar" ? "تم إقرار استلام التوجيه بنجاح" : "Emergency directive acknowledged successfully");
  };

  // Real-time Firestore Sync
  useEffect(() => {
    if (!user) return;

    const statsPath = "stats";
    const unsubscribeStats = onSnapshot(doc(db, statsPath, "current"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setCount(data.count || 0);
        setPodCount(data.pod_count || 0);
        setTotalEntries(data.total_entries || 0);
        setPodTotalEntries(data.pod_total_entries || 0);
        setCapacity(data.capacity || 500);
      } else {
        setDoc(doc(db, statsPath, "current"), { 
          count: 0, 
          pod_count: 0, 
          total_entries: 0,
          pod_total_entries: 0,
          capacity: 500, 
          updated_at: serverTimestamp() 
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, statsPath);
    });

    const logsPath = "gate_logs";
    const logsQuery = query(collection(db, logsPath), orderBy("timestamp", "desc"), limit(5));
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      setRecentLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Subscribing to real-time gate emergency broadcasts
    const broadcastsPath = "gate_notifications";
    const broadcastsQuery = query(collection(db, broadcastsPath), orderBy("timestamp", "desc"), limit(10));
    const unsubscribeBroadcasts = onSnapshot(broadcastsQuery, (snapshot) => {
      setBroadcasts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeStats();
      unsubscribeLogs();
      unsubscribeBroadcasts();
    };
  }, [user]);

  // Existing gate update function
  const handleUpdate = async (delta: number, isPod: boolean = false) => {
    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    // Apply optimistic updates to local state immediately for instant response
    playWebAudioChime(delta > 0 ? 'entry' : 'exit');

    if (isPod) {
      setPodCount(prev => Math.max(0, prev + delta));
      if (delta > 0) {
        setPodTotalEntries(prev => prev + delta);
      }
    } else {
      setCount(prev => Math.max(0, prev + delta));
      if (delta > 0) {
        setTotalEntries(prev => prev + delta);
      }
    }

    const statsPath = "stats";
    const logsPath = "gate_logs";
    try {
      const updates: any = {
        [isPod ? "pod_count" : "count"]: increment(delta),
        updated_at: serverTimestamp()
      };

      if (delta > 0) {
        updates[isPod ? "pod_total_entries" : "total_entries"] = increment(delta);
      }

      await updateDoc(doc(db, statsPath, "current"), updates);

      await addDoc(collection(db, logsPath), {
        type: delta > 0 ? (isPod ? 'pod_entry' : 'entry') : (isPod ? 'pod_exit' : 'exit'),
        timestamp: serverTimestamp(),
        user_id: user?.id || 'anonymous',
        user_name: user?.name || 'Anonymous',
        is_pod: isPod
      });

      setLastAction({ 
        type: delta > 0 ? (isPod ? 'pod_in' : 'in') : (isPod ? 'pod_out' : 'out'), 
        time: new Date() 
      });
    } catch (error) {
      // Revert optimistic updates on failure
      playWebAudioChime('error');
      if (isPod) {
        setPodCount(prev => Math.max(0, prev - delta));
        if (delta > 0) {
          setPodTotalEntries(prev => Math.max(0, prev - delta));
        }
      } else {
        setCount(prev => Math.max(0, prev - delta));
        if (delta > 0) {
          setTotalEntries(prev => Math.max(0, prev - delta));
        }
      }
      handleFirestoreError(error, OperationType.WRITE, statsPath);
    }
  };

  const getOperationalCategory = (val: number) => {
    if (val < 1200) return { label: language === "ar" ? "منخفض" : "Low", color: "text-blue-600", bg: "bg-blue-50" };
    if (val <= 2500) return { label: language === "ar" ? "طبيعي" : "Normal", color: "text-emerald-600", bg: "bg-emerald-50" };
    if (val <= 4800) return { label: language === "ar" ? "مرتفع" : "High", color: "text-amber-600", bg: "bg-amber-50" };
    return { label: language === "ar" ? "ذروة" : "Peak", color: "text-red-600", bg: "bg-red-50" };
  };

  const handleBackfill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const statsPath = "stats";
    const logsPath = "gate_logs";
    const delta = backfillData.type === 'entry' ? backfillData.count : -backfillData.count;
    const timestamp = Timestamp.fromDate(new Date(backfillData.timestamp));

    try {
      const updates: any = {
        [backfillData.isPod ? "pod_count" : "count"]: increment(delta),
        updated_at: serverTimestamp()
      };

      if (delta > 0) {
        updates[backfillData.isPod ? "pod_total_entries" : "total_entries"] = increment(delta);
      }

      await updateDoc(doc(db, statsPath, "current"), updates);

      await addDoc(collection(db, logsPath), {
        type: backfillData.type === 'entry' ? (backfillData.isPod ? 'pod_entry' : 'entry') : (backfillData.isPod ? 'pod_exit' : 'exit'),
        timestamp: timestamp,
        user_id: user?.id || 'anonymous',
        user_name: user?.name || 'Anonymous',
        is_pod: backfillData.isPod,
        is_manual: true,
        manual_count: backfillData.count
      });

      setLastAction({ type: 'backfill', time: new Date() });
      setShowBackfill(false);
      setBackfillData({
        timestamp: new Date().toISOString().slice(0, 16),
        type: 'entry',
        isPod: false,
        count: 1
      });
      toast.success(language === "ar" ? "تم تسجيل الدخول اليدوي بنجاح" : "Manual gate log submitted successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, statsPath);
    }
  };

  const handleBulkBackfill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !bulkData.trim()) return;

    setIsProcessingBulk(true);
    const statsPath = "stats";
    const logsPath = "gate_logs";
    
    const lines = bulkData.split('\n').filter(line => line.trim());
    let totalMainDelta = 0;
    let totalPodDelta = 0;
    let totalMainEntriesDelta = 0;
    let totalPodEntriesDelta = 0;

    try {
      for (const line of lines) {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length < 4) continue;

        const [tsStr, typeStr, popStr, countStr] = parts;
        const timestamp = Timestamp.fromDate(new Date(tsStr));
        const isEntry = typeStr.toUpperCase() === 'IN';
        const isPod = popStr.toUpperCase() === 'POD';
        const countValue = parseInt(countStr) || 0;
        const delta = isEntry ? countValue : -countValue;

        if (isPod) {
          totalPodDelta += delta;
          if (delta > 0) totalPodEntriesDelta += delta;
        } else {
          totalMainDelta += delta;
          if (delta > 0) totalMainEntriesDelta += delta;
        }

        await addDoc(collection(db, logsPath), {
          type: isEntry ? (isPod ? 'pod_entry' : 'entry') : (isPod ? 'pod_exit' : 'exit'),
          timestamp: timestamp,
          user_id: user?.id || 'anonymous',
          user_name: user?.name || 'Anonymous',
          is_pod: isPod,
          is_manual: true,
          manual_count: countValue,
          is_bulk: true
        });
      }

      const updates: any = { updated_at: serverTimestamp() };
      if (totalMainDelta !== 0) updates.count = increment(totalMainDelta);
      if (totalPodDelta !== 0) updates.pod_count = increment(totalPodDelta);
      if (totalMainEntriesDelta !== 0) updates.total_entries = increment(totalMainEntriesDelta);
      if (totalPodEntriesDelta !== 0) updates.pod_total_entries = increment(totalPodEntriesDelta);

      await updateDoc(doc(db, statsPath, "current"), updates);

      setLastAction({ type: 'backfill', time: new Date() });
      setShowBulkBackfill(false);
      setBulkData("");
      toast.success(language === "ar" ? "تم رفع ومعالجة القائمة المجمعة بنجاح" : "Bulk gate logs loaded successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, statsPath);
    } finally {
      setIsProcessingBulk(false);
    }
  };

  // NEW: EMERGENCY BROADCAST HANDLER (Manager only trigger)
  const handleDeployEmergencyBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const isAuthorized = user.role === 'admin' || user.role === 'manager';
    if (!isAuthorized) {
      toast.error(language === "ar" ? "غير مصرح: هذه الميزة مخصصة للمدراء الميدانيين فقط" : "Unauthorized: This is a Manager or Admin only feature");
      return;
    }

    setIsPublishingBroadcast(true);
    try {
      const reasonLabels: Record<string, string> = {
        severe_weather: language === "ar" ? "طقس متطرف / عواصف ترابية" : "Severe Weather / Sandstorms",
        power_failure: language === "ar" ? "انقطاع التيار الكهربائي وبطاريات البوابات" : "Power Grid / Gate System Failure",
        medical: language === "ar" ? "إخلاء طبي طارئ" : "Emergency Medical Evacuation",
        security: language === "ar" ? "تهديد أمني حرج / حالة حظر" : "Critical Security Threat / Secure Lockdown",
        other: language === "ar" ? "إجراء تشغيلي طارئ آخر" : "Other Emergency Protocol"
      };

      await addDoc(collection(db, "gate_notifications"), {
        type: broadcastType === 'open' ? 'emergency_open' : 'emergency_close',
        sender_id: user.id,
        sender_name: user?.name || "Field Manager",
        sender_role: user?.role || "manager",
        reason_key: presetReason,
        reason: reasonLabels[presetReason] || "Emergency Directive",
        notes: customReasonNote || (broadcastType === 'open' ? "URGENT: Manually override locks to fallback OPEN." : "URGENT: Immediate perimeters SECURED lockdown."),
        timestamp: serverTimestamp(),
        status: "active"
      });

      toast.success(language === "ar" ? "تم بث وإرسال تنبيه الطوارئ العام للموظفين والحراس" : "General Emergency Gate Decree broadcasted successfully!");
      setCustomReasonNote("");
    } catch (err) {
      console.error("Emergency broadcast publish failure:", err);
      toast.error("Database Broadcast Failure");
    } finally {
      setIsPublishingBroadcast(false);
    }
  };

  // EVALUATE SCHEDULE ENGINE ON THE FLY BASED ON CLOCK
  const getSimulatedClockDateObject = () => {
    if (!useSimulatedClock) return new Date();
    try {
      return new Date(`${simulatedClockDate}T${simulatedClockTime}:00`);
    } catch {
      return new Date();
    }
  };

  const evaluateScheduleRules = () => {
    const d = getSimulatedClockDateObject();
    const month = d.getMonth(); // 0 = Jan, 4 = May, 8 = Sep, 9 = Oct
    const dateNum = d.getDate();
    const dayOfWeek = d.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat

    // May 1st to September 30 = Summer
    const isSummer = (month >= 4 && month <= 8);

    // Opening time configuration
    let scheduledOpenTime = "17:00"; 
    let scheduledCloseTime = "23:00";
    let scheduleNotes = "";

    if (isSummer) {
      scheduledOpenTime = "17:00";
      scheduledCloseTime = "23:00";
      scheduleNotes = language === "ar" 
        ? "أوقات الصيف (١ مايو إلى ٣٠ سبتمبر) • الأحد إلى السبت: تفتح ١٧:٠٠، تغلق ٢٣:٠٠"
        : "Summer Rules (May 1 - Sep 30) • Sun to Sat: Open 17:00, Close 23:00";
    } else {
      scheduleNotes = language === "ar"
        ? "أوقات الشتاء (١ أكتوبر إلى ٣٠ أبريل) • السبت إلى الخميس: تفتح ١٠:٠٠ | الجمعة: تفتح ١٤:٠٠ • وتغلق يومياً ٢٣:٠٠"
        : "Winter Rules (Oct 1 - Apr 30) • Sat to Thu: Open 10:00 | Fri: Open 14:00 • Daily Close 23:00";
      
      if (dayOfWeek === 5) { // Friday
        scheduledOpenTime = "14:00";
      } else { // Saturday to Thursday
        scheduledOpenTime = "10:00";
      }
    }

    // Determine state relative to current simulated time
    const currentHrs = d.getHours();
    const currentMins = d.getMinutes();
    const currentVal = currentHrs * 60 + currentMins;

    const [openHrs, openMins] = scheduledOpenTime.split(":").map(Number);
    const [closeHrs, closeMins] = scheduledCloseTime.split(":").map(Number);
    
    const openVal = openHrs * 60 + openMins;
    const closeVal = closeHrs * 60 + closeMins;

    let isGateScheduledOpen = false;
    let nextActionLabel = "";
    
    if (currentVal >= openVal && currentVal < closeVal) {
      isGateScheduledOpen = true;
      nextActionLabel = language === "ar" 
        ? `الإغلاق المجدول القادم في تمام الساعة ${scheduledCloseTime}`
        : `Next scheduled closing at ${scheduledCloseTime}`;
    } else {
      isGateScheduledOpen = false;
      const willOpenTomorrow = currentVal >= closeVal;
      nextActionLabel = language === "ar"
        ? `الفتح المجدول ${willOpenTomorrow ? "غداً" : "اليوم"} في تمام الساعة ${scheduledOpenTime}`
        : `Next scheduled opening ${willOpenTomorrow ? "tomorrow" : "today"} at ${scheduledOpenTime}`;
    }

    // Individual triggers details
    const openTriggered = currentVal >= openVal;
    const closeTriggered = currentVal >= closeVal;

    return {
      isSummer,
      seasonLabel: isSummer 
        ? (language === "ar" ? "فترة الصيف (نشطة)" : "Summer Season Schedule (Active)")
        : (language === "ar" ? "فترة الشتاء/خارج الذروة (نشطة)" : "Winter Season Schedule (Active)"),
      openTime: scheduledOpenTime,
      closeTime: scheduledCloseTime,
      notes: scheduleNotes,
      currentDateDisplay: d.toLocaleDateString(language === "ar" ? "ar-EG" : "en-GB", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      currentTimeDisplay: d.toLocaleTimeString(language === "ar" ? "ar-EG" : [], { hour: '2-digit', minute: '2-digit' }),
      isGateScheduledOpen,
      nextActionLabel,
      openTriggered,
      closeTriggered
    };
  };

  // Instant Traffic Velocity (operations per minute calculated based on recent log activities)
  const calculateFlowVelocity = () => {
    if (!recentLogs || recentLogs.length < 2) return 0;
    try {
      const times = recentLogs.map(l => l.timestamp?.seconds ? l.timestamp.seconds * 1000 : Date.now());
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      // diff in minutes
      const diffMin = (maxTime - minTime) / 60000;
      if (diffMin <= 0.08) {
        // High density burst
        return parseFloat((recentLogs.length / 0.1).toFixed(1));
      }
      return parseFloat((recentLogs.length / diffMin).toFixed(1));
    } catch {
      return 0;
    }
  };

  const velocityValue = calculateFlowVelocity();

  const getFlowDensityStatus = (vel: number) => {
    if (vel === 0) return { label: language === "ar" ? "ساكن / مستقر" : "STABLE / IDLE", color: "text-slate-400 bg-slate-50 border-slate-200" };
    if (vel < 1.0) return { label: language === "ar" ? "تدفق خفيف" : "LIGHT FLOW", color: "text-blue-500 bg-blue-500/10 border-blue-200" };
    if (vel < 3.0) return { label: language === "ar" ? "تدفق معتدل" : "ACTIVE MODERATE", color: "text-emerald-500 bg-emerald-500/10 border-emerald-200" };
    return { label: language === "ar" ? "تدفق عنيف" : "HEAVY CONGESTION", color: "text-red-500 bg-red-500/10 border-red-200 animate-pulse" };
  };

  const densityStatus = getFlowDensityStatus(velocityValue);

  // Celestial Alignment computations (Sunset alignment occurs daily at 20:45)
  const getSunsetCountdownValue = () => {
    const d = getSimulatedClockDateObject();
    const currentHrs = d.getHours();
    const currentMins = d.getMinutes();
    const currentVal = currentHrs * 60 + currentMins;
    
    // Solstice sunset alignment occurs at 20:45 (1245 mins)
    const alignmentVal = 20 * 60 + 45; 
    const diff = alignmentVal - currentVal;
    
    // Sun rises around 05:30 (330 mins) and sets around 20:45 (1245 mins). Peak height is at 13:00 (780 mins).
    let angle = -1; // Below horizon
    if (currentVal >= 330 && currentVal <= 1245) {
      const ratio = (currentVal - 330) / (1245 - 330);
      angle = ratio * 180; // 0 to 180 degrees
    }
    
    return {
      minutesLeft: diff,
      angle: angle
    };
  };

  const solsticeData = getSunsetCountdownValue();

  const scheduleInfo = evaluateScheduleRules();
  const model = getOperationalCategory(count);

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-8">
      {/* Page Header */}
      <div className={cn("flex flex-col sm:flex-row items-center justify-between gap-6 border-b border-slate-100 pb-6", isRtl && "sm:flex-row-reverse")}>
        <div className={cn("text-left space-y-1", isRtl && "text-right")}>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            {language === "ar" ? "بوابات ومنافذ العبور" : "Gate Control"}
          </h2>
          <p className="text-slate-500 font-medium">
            {language === "ar" ? "الإشراف والتحكم الميداني الحي والمباشر وبث إشعارات البوابات الآلية" : "Live entry management, seasonal timelines, and emergency decrees"}
          </p>
        </div>

        {/* Audio Feedback Controller */}
        <button
          onClick={toggleSoundMute}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95",
            soundMuted 
              ? "bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-200" 
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/20 shadow-xs"
          )}
        >
          {soundMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          <span>
            {soundMuted 
              ? (language === "ar" ? "أصوات البوابة: كتم" : "Gate audio: muted") 
              : (language === "ar" ? "أصوات البوابة: نشط" : "Gate audio: active")}
          </span>
        </button>
      </div>

      {/* Segmented Sub-Tab Switcher */}
      <div className="flex border border-slate-200 bg-white p-1 rounded-2xl w-full max-w-xl mx-auto shadow-xs">
        <button
          onClick={() => setSubActiveTab('counters')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center",
            subActiveTab === 'counters'
              ? "bg-slate-900 text-white shadow-md shadow-slate-950/20"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          )}
        >
          <Activity size={15} />
          <span>{language === "ar" ? "العدادات والسجلات" : "Live Counters"}</span>
        </button>
        <button
          onClick={() => setSubActiveTab('schedule')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center",
            subActiveTab === 'schedule'
              ? "bg-slate-900 text-white shadow-md shadow-slate-950/20"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          )}
        >
          <Clock size={15} />
          <span>{language === "ar" ? "أوقات الطوارئ" : "Schedules"}</span>
        </button>
        <button
          onClick={() => setSubActiveTab('analytics')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center",
            subActiveTab === 'analytics'
              ? "bg-slate-900 text-white shadow-md shadow-slate-950/20"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          )}
        >
          <BarChart3 size={15} />
          <span>{language === "ar" ? "المخططات البيانية" : "Peak Traffic"}</span>
        </button>
      </div>

      {/* Subtab Content: 1. Counters */}
      {subActiveTab === 'counters' && (
        <div className="space-y-8">
          <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-100 p-4 rounded-[2rem] border border-slate-200/50", isRtl && "md:flex-row-reverse")}>
            {/* Live Flow Rate Velocity Telemetry */}
            <div className={cn("flex items-center gap-4 bg-white px-5 py-3 rounded-2xl border border-slate-200/60 shadow-xs", isRtl && "flex-row-reverse text-right")}>
              <div className="p-3 bg-slate-50 text-slate-500 rounded-xl relative shrink-0">
                <Gauge size={20} className="text-slate-600" />
                {velocityValue > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                )}
              </div>
              <div className="min-w-[150px]">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block leading-3">
                  {language === "ar" ? "معدل التدفق المباشر" : "Entrance Velocity"}
                </span>
                <div className={cn("flex flex-wrap items-center gap-2 mt-1", isRtl && "flex-row-reverse")}>
                  <p className="text-sm font-black text-slate-900 tabular-nums">
                    {velocityValue} <span className="text-xs font-bold text-slate-400 font-sans">{language === "ar" ? "عبرات/د" : "passes/min"}</span>
                  </p>
                  <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-md border text-center leading-none", densityStatus.color)}>
                    {densityStatus.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Manual Controls buttons */}
            <div className={cn("flex items-center gap-3 shrink-0", isRtl && "flex-row-reverse")}>
              <button 
                onClick={() => setShowBackfill(true)}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <PlusCircle size={18} className="text-emerald-500" />
                <span>{language === "ar" ? "تسجيل يدوي" : "Manual"}</span>
              </button>
              <button 
                onClick={() => setShowBulkBackfill(true)}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-md cursor-pointer text-center active:scale-95"
              >
                <Activity size={18} />
                <span>{language === "ar" ? "إدخال مجمّع" : "Bulk Backfill"}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <CounterCard 
              title={language === "ar" ? "المتواجدون بالموقع الرئيسي" : "Main Site Live Count"}
              value={count}
              onIn={() => handleUpdate(1)}
              onOut={() => handleUpdate(-1)}
              theme="slate"
              totalEntriesValue={totalEntries}
              language={language}
              isRtl={isRtl}
              count={count}
              capacity={capacity}
              model={model}
            />

            <CounterCard 
              title={language === "ar" ? "المتواجدون في الكبسولة المصاحبة" : "POD Live Count"}
              value={podCount}
              onIn={() => handleUpdate(1, true)}
              onOut={() => handleUpdate(-1, true)}
              isPod={true}
              theme="emerald"
              totalEntriesValue={podTotalEntries}
              language={language}
              isRtl={isRtl}
              count={count}
              capacity={capacity}
            />
          </div>

          {/* Activity Timeline */}
          <div className={cn("bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6", isRtl && "text-right")}>
            <div className={cn("flex items-center justify-between flex-wrap gap-4", isRtl && "flex-row-reverse")}>
              <div className={cn("flex items-center gap-3", isRtl && "flex-row-reverse")}>
                <div className="p-3 bg-slate-100 rounded-2xl text-slate-400">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    {language === "ar" ? "سجل الحركة الحية" : "Activity Timeline"}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {language === "ar" ? "البث الزمني لحركات بوابات الدخول والخروج والكبسولة" : "Real-time gate and POD events"}
                  </p>
                </div>
              </div>
              {count > capacity * 0.95 && (
                <div className={cn("flex items-center gap-3 px-4 py-2 bg-red-50 text-red-600 rounded-xl font-black text-[10px] uppercase tracking-widest animate-pulse border border-red-100", isRtl && "flex-row-reverse")}>
                  <AlertCircle size={16} />
                  <span>{language === "ar" ? "قريب من إشغال السعة الكلية" : "Near Capacity"}</span>
                </div>
              )}
            </div>

            <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", isRtl && "direction-rtl")}>
              {recentLogs.length > 0 ? (
                recentLogs.map((log) => {
                  const formattedType = () => {
                    if (language === "ar") {
                      if (log.type === "entry") return "دخول الموقع";
                      if (log.type === "exit") return "خروج الموقع";
                      if (log.type === "pod_entry") return "دخول الكبسولة " + "POD";
                      if (log.type === "pod_exit") return "خروج الكبسولة " + "POD";
                    }
                    return log.type.split('_').join(' ');
                  };
                  
                  const formatLogCount = () => {
                    if (language === "ar") {
                      return log.manual_count && log.manual_count > 1 ? `${log.manual_count} أشخاص` : "شخص واحد";
                    }
                    return log.manual_count && log.manual_count > 1 ? `${log.manual_count} People` : '1 Person';
                  };

                  return (
                    <div key={log.id} className={cn("p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between min-h-[100px] border-l-4 overflow-hidden relative group", isRtl ? "text-right pr-4 border-l-0 border-r-4" : "text-left pl-4")}
                      style={{ [isRtl ? "borderRightColor" : "borderLeftColor"]: log.type.includes('entry') ? '#10b981' : '#f43f5e' }}>
                      <div className={cn("flex items-center justify-between w-full", isRtl && "flex-row-reverse")}>
                        <span className={cn("text-[10px] font-black uppercase tracking-widest", log.type.includes('entry') ? 'text-emerald-600' : 'text-red-500')}>
                          {formattedType()}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(log.timestamp?.seconds * 1000 || Date.now()).toLocaleTimeString(language === "ar" ? "ar-EG" : [], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div className="mt-2">
                        <p className="text-sm font-bold text-slate-900 leading-tight">
                          {formatLogCount()}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium truncate italic">{tData(log.user_name || 'System')}</p>
                      </div>
                      {log.is_manual && (
                        <div className={cn("absolute -bottom-1 p-2 bg-slate-100 rounded-tl-xl opacity-40 group-hover:opacity-100 transition-opacity", isRtl ? "left-1 rounded-tr-xl rounded-tl-none" : "right-1 rounded-tl-xl")}>
                          <History size={10} className="text-slate-400" />
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-8 text-center text-slate-300 font-black uppercase tracking-widest text-[10px]">
                  {language === "ar" ? "في انتظار تسجيل أو رصد حركات عبور..." : "Awaiting Activity..."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subtab Content: 2. Schedule & Emergency */}
      {subActiveTab === 'schedule' && (
        <div className="space-y-8 duration-200">

          {/* Megalith Alignment Celestial Telemetry */}
          <div className={cn(
            "p-8 rounded-[2.5rem] border transition-all text-white relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-8",
            solsticeData.minutesLeft >= -15 && solsticeData.minutesLeft <= 15
              ? "bg-amber-955 border-amber-600 shadow-xl shadow-amber-500/10 ring-2 ring-amber-500/20"
              : "bg-slate-900 border-slate-800 shadow-xl"
          )} style={{ backgroundColor: solsticeData.minutesLeft >= -15 && solsticeData.minutesLeft <= 15 ? '#1c1004' : undefined }}>
            {solsticeData.minutesLeft >= -15 && solsticeData.minutesLeft <= 15 && (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.15),transparent_70%)] animate-pulse pointer-events-none" />
            )}
            
            <div className={cn("space-y-4 max-w-xl text-left flex-1", isRtl && "text-right")}>
              <div className={cn("flex items-center gap-2", isRtl && "flex-row-reverse")}>
                <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
                  <Sun size={18} className="text-amber-400" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-400 tracking-widest block leading-none">
                    {language === "ar" ? "رصد الهيكل ومسار الشمس الفلكي للموقع" : "CELESTIAL ALIGNMENT TELEMETRY MONITOR"}
                  </span>
                  <h3 className="text-xl font-black mt-1 text-white">
                    {language === "ar" ? "محاذاة الغروب والاعتدال الشمسي الشرفي" : "Megalithic Gateway Sunset Alignment"}
                  </h3>
                </div>
              </div>

              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                {language === "ar" 
                  ? "يقوم المحرك الفلكي بحساب الزاوية النسبية لمسار الشمس وموقع قرصها الذهبي بالنسبة لمحور بوابات المعلم الرئيسي ومراقبة توافق الغروب عند الساعة ٢٠:٤٥."
                  : "Geometric tracker calculating real-time solar path relative to the primary megaliths alignment axis. Crucial for organizing VIP Golden Hour photographic access and drone photogrammetry."}
              </p>

              {/* Status metrics bar */}
              <div className={cn("flex items-center gap-6 pt-2 text-xs", isRtl && "flex-row-reverse")}>
                <div>
                  <span className="text-slate-500 font-extrabold uppercase block text-[9px] tracking-wider">{language === "ar" ? "موعد المحاذاة اليومي" : "Daily Peak Alignment"}</span>
                  <span className="font-mono font-black text-amber-400">20:45 (8:45 PM)</span>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div>
                  <span className="text-slate-500 font-extrabold uppercase block text-[9px] tracking-wider">{language === "ar" ? "مسار الشمس الحالي" : "Calculated Solar Angle"}</span>
                  <span className="font-mono font-black text-slate-200">
                    {solsticeData.angle >= 0 ? `${Math.round(solsticeData.angle)}° / 180°` : (language === "ar" ? "تحت مستوى الأفق" : "Below Horizon")}
                  </span>
                </div>
              </div>
            </div>

            {/* SVG Solar Position Tracker Panel */}
            <div className="w-full lg:w-80 flex flex-col items-center justify-center space-y-4 bg-slate-950/40 p-6 rounded-3xl border border-slate-800/80 shrink-0">
              <div className="relative w-full h-24 flex items-center justify-center">
                <svg viewBox="0 0 200 80" className="w-48 h-full overflow-visible">
                  {/* Archeological stone arches schematic */}
                  <g className="stroke-slate-700 fill-none" strokeWidth="1.5">
                    <rect x="86" y="45" width="8" height="35" rx="1.5" />
                    <rect x="106" y="45" width="8" height="35" rx="1.5" />
                    <rect x="80" y="38" width="40" height="7" rx="1.5" /> {/* lintel */}
                  </g>
                  {/* Horizon */}
                  <line x1="10" y1="78" x2="190" y2="78" stroke="#334115" strokeWidth="1" strokeDasharray="3 3" />
                  {/* Solar Arc */}
                  <path d="M 20 78 Q 100 -12 180 78" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />
                  
                  {/* Amber Sun movement indicator representation */}
                  {solsticeData.angle >= 0 ? (
                    <circle
                      cx={20 + (160 * (solsticeData.angle / 180))}
                      cy={78 - (90 * Math.sin((solsticeData.angle * Math.PI) / 180))}
                      r="6"
                      className="fill-amber-400 stroke-amber-200 filter drop-shadow-[0_0_8px_rgba(245,158,11,0.85)]"
                    />
                  ) : null}
                </svg>
                
                {solsticeData.angle < 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black uppercase text-slate-500 tracking-widest bg-slate-950/40 rounded-xl">
                    {language === "ar" ? "جرم الشمس تحت الأفق" : "Sun Below Horizon"}
                  </div>
                )}
              </div>

              {/* Countdown panel status */}
              <div className="text-center w-full">
                {solsticeData.minutesLeft >= -15 && solsticeData.minutesLeft <= 15 ? (
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-lg leading-none animate-bounce">
                      <Flame size={12} />
                      {language === "ar" ? "محاذاة البوابة نشطة" : "ALIGNMENT ACTIVE"}
                    </span>
                    <p className="text-[10px] text-amber-200 font-bold leading-tight mt-1">
                      {language === "ar" ? "يتعامد قرص الشمس مع الشرفات الكبرى الآن!" : "Sun perfectly aligned inside lintel gateway!"}
                    </p>
                  </div>
                ) : solsticeData.minutesLeft > 0 ? (
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                      {language === "ar" ? "المتبقي لمحاذاة البوابة" : "Alignment Countdown"}
                    </p>
                    <p className="text-xl font-black mt-0.5 font-mono text-amber-400 tabular-nums leading-none">
                      {Math.floor(solsticeData.minutesLeft / 60)}h {solsticeData.minutesLeft % 60}m
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">
                      {language === "ar" ? "انتهت محاذاة اليوم" : "Sequence Complete"}
                    </p>
                    <p className="text-[10px] font-bold mt-0.5 text-slate-400 leading-none">
                      {language === "ar" ? "بانتظار محاذاة شمس اليوم القادم" : "Next alignment at tomorrow's sunset"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Active Emergency Instruction Alert Banner */}
          {broadcasts.length > 0 && broadcasts[0].status === "active" && !acknowledgedAlerts[broadcasts[0].id] && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-6 rounded-3xl bg-red-950 border border-red-800 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse"
            >
              <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-red-800/10 rounded-full blur-2xl" />
              <div className={cn("flex items-start gap-4 flex-1", isRtl && "flex-row-reverse text-right")}>
                <div className="p-3 bg-red-500 rounded-2xl shrink-0 text-white animate-bounce mt-1">
                  <ShieldAlert size={24} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-400 px-2.5 py-0.5 rounded-full bg-red-900 border border-red-800">
                    {language === "ar" ? "توجيه طوارئ نشط من الإدارة" : "ACTIVE DIRECTIVE OVERRIDE BROADCAST"}
                  </span>
                  <h4 className="text-xl font-extrabold tracking-tight">
                    {broadcasts[0].type === 'emergency_open' 
                      ? (language === "ar" ? "أمر طارئ بفتح جميع بوابات العبور فورا" : "MANDATORY COMMAND: OVERRIDE OPEN ALL GATES")
                      : (language === "ar" ? "أمر طارئ بإغلاق وتأمين حدود الموقع كاملة" : "MANDATORY COMMAND: SECURE-CLOSE ALL PERIMETERS")
                    }
                  </h4>
                  <p className="text-sm font-bold text-red-200">
                    {language === "ar" ? `السبب: ${broadcasts[0].reason}` : `Reason: ${broadcasts[0].reason}`}
                  </p>
                  <p className="text-xs text-slate-300 italic font-medium pt-1 max-w-xl">
                    "{broadcasts[0].notes}"
                  </p>
                  <p className="text-[10px] text-red-400 font-bold font-mono">
                    {language === "ar" ? "مرسل بواسطة: " : "Issued by: "} {broadcasts[0].sender_name} • {new Date(broadcasts[0].timestamp?.seconds * 1000 || Date.now()).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex gap-3">
                <button
                  onClick={() => acknowledgeAlert(broadcasts[0].id)}
                  className="px-6 py-3 bg-white text-red-950 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all cursor-pointer shadow-lg active:scale-95"
                >
                  {language === "ar" ? "إقرار باستلام الأمر ✓" : "Acknowledge Command ✓"}
                </button>
              </div>
            </motion.div>
          )}

          {/* SEASON RULES INDEX CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Summer Profile */}
            <div className={cn(
              "p-6 rounded-[2.5rem] border bg-white flex flex-col justify-between space-y-4 relative",
              scheduleInfo.isSummer ? "border-emerald-500 shadow-md ring-2 ring-emerald-500/10" : "border-slate-200 opacity-65",
              isRtl && "text-right"
            )}>
              {scheduleInfo.isSummer && (
                <div className={cn("absolute top-6 px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-black uppercase tracking-wider rounded-full", isRtl ? "left-6" : "right-6")}>
                  {language === "ar" ? "الفترة النشطة حالياً" : "Current Active Season"}
                </div>
              )}
              <div className="space-y-2">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl w-12 h-12 flex items-center justify-center">
                  <Calendar size={22} />
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  {language === "ar" ? "الموسم الصيفي (١ مايو - ٣٠ سبتمبر)" : "Summer Season Profile (May 1st - Sep 30th)"}
                </h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  {language === "ar" ? "خطة توافق التشغيل خلال درجات الحرارة المرتفعة وفترات السياحة المسائية." : "Configured timing parameters for hot mid-year seasons allowing extended nocturnal visitor flows."}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2 font-mono">
                <div className={cn("flex justify-between text-xs font-bold", isRtl && "flex-row-reverse")}>
                  <span className="text-slate-400">{language === "ar" ? "مواعيد التشغيل (الأحد - السبت):" : "Operating Hours (Sun–Sat):"}</span>
                  <span className="text-slate-900 font-extrabold">{language === "ar" ? "١٧:٠٠ مساءً" : "17:00 (5:00 PM)"}</span>
                </div>
                <div className={cn("flex justify-between text-xs font-bold", isRtl && "flex-row-reverse")}>
                  <span className="text-slate-400">{language === "ar" ? "مواعيد الإغلاق (الأحد - السبت):" : "Closing Hours (Sun–Sat):"}</span>
                  <span className="text-slate-950 font-extrabold">{language === "ar" ? "٢٣:٠٠ ليلاً" : "23:00 (11:00 PM)"}</span>
                </div>
              </div>
            </div>

            {/* Winter Profile */}
            <div className={cn(
              "p-6 rounded-[2.5rem] border bg-white flex flex-col justify-between space-y-4 relative",
              !scheduleInfo.isSummer ? "border-emerald-500 shadow-md ring-2 ring-emerald-500/10" : "border-slate-200 opacity-65",
              isRtl && "text-right"
            )}>
              {!scheduleInfo.isSummer && (
                <div className={cn("absolute top-6 px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-black uppercase tracking-wider rounded-full", isRtl ? "left-6" : "right-6")}>
                  {language === "ar" ? "الفترة النشطة حالياً" : "Current Active Season"}
                </div>
              )}
              <div className="space-y-2">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl w-12 h-12 flex items-center justify-center">
                  <Calendar size={22} />
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  {language === "ar" ? "موسم الخريف والشتاء (١ أكتوبر - ٣٠ أبريل)" : "Winter Season Profile (Oct 1st - Apr 30th)"}
                </h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  {language === "ar" ? "خطة العمليات القياسية النهارية مع مراعاة صلوات الجمعة والعطل الرسمية." : "Diurnal standard schedule adjusting standard daylight opening parameters with Friday exceptions."}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2 font-mono">
                <div className={cn("flex justify-between text-xs font-bold", isRtl && "flex-row-reverse")}>
                  <span className="text-slate-400">{language === "ar" ? "السبت إلى الخميس (الفتح):" : "Saturday to Thursday (Open):"}</span>
                  <span className="text-slate-900 font-extrabold">{language === "ar" ? "١٠:٠٠ صباحاً" : "10:00 AM"}</span>
                </div>
                <div className={cn("flex justify-between text-xs font-bold", isRtl && "flex-row-reverse")}>
                  <span className="text-slate-400">{language === "ar" ? "يوم الجمعة (الفتح):" : "Friday (Open):"}</span>
                  <span className="text-slate-900 font-extrabold">{language === "ar" ? "١٤:٠٠ ظهراً" : "14:00 (2:00 PM)"}</span>
                </div>
                <div className={cn("flex justify-between text-xs font-bold", isRtl && "flex-row-reverse")}>
                  <span className="text-slate-400">{language === "ar" ? "مواعيد الإغلاق اليومية (الأحد - السبت):" : "Daily Closing (Sun–Sat):"}</span>
                  <span className="text-slate-950 font-extrabold">{language === "ar" ? "٢٣:٠٠ ليلاً" : "23:00 (11:00 PM)"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVE LIVE CLOCK TIMELINE VERIFY CELL */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Live Clock Check status */}
            <div className={cn("p-8 rounded-[2.5rem] bg-slate-900 border border-slate-800 text-white space-y-6 lg:col-span-2", isRtl && "text-right")}>
              <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    {language === "ar" ? "حالة البوابات التلقائية حالياً" : "ACTIVE AUTOMATED GATE TELEMETRY"}
                  </p>
                  <h3 className="text-2xl font-black text-white leading-none">
                    {scheduleInfo.isGateScheduledOpen 
                      ? (language === "ar" ? "مفتوحة وإمكانية المرور قائمة" : "GATE SCHEDULE STATUS: UNLOCKED / OPEN") 
                      : (language === "ar" ? "مغلقة ومؤمنة بالكامل" : "GATE SCHEDULE STATUS: SECURED / CLOSED")
                    }
                  </h3>
                </div>
                <div className={cn("p-4 rounded-3xl shrink-0 flex items-center justify-center", 
                  scheduleInfo.isGateScheduledOpen ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                )}>
                  {scheduleInfo.isGateScheduledOpen ? <Unlock size={28} /> : <Lock size={28} />}
                </div>
              </div>

              {/* Checklist representing triggers today */}
              <div className="space-y-4 bg-slate-950/40 p-6 rounded-2xl border border-slate-800/60 text-slate-300">
                <p className="text-xs font-bold text-slate-400">
                  {language === "ar" ? `قائمة إجراءات اليوم الدورية (${scheduleInfo.currentDateDisplay}):` : `Automated Trigger Log Today (${scheduleInfo.currentDateDisplay}):`}
                </p>
                
                <div className="space-y-3 font-mono">
                  {/* Open trigger */}
                  <div className={cn("flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800/40", isRtl && "flex-row-reverse")}>
                    <div className={cn("flex items-center gap-3", isRtl && "flex-row-reverse")}>
                      <div className={cn("p-1.5 rounded-lg shrink-0", scheduleInfo.openTriggered ? "bg-emerald-500/20 text-emerald-400" : "bg-yellow-500/10 text-yellow-500")}>
                        {scheduleInfo.openTriggered ? <CheckCircle2 size={16} /> : <Timer size={16} />}
                      </div>
                      <div>
                        <p className="text-xs font-black">{language === "ar" ? `فتح البوابات تلقائياً عند ${scheduleInfo.openTime}` : `Auto Gate Open at ${scheduleInfo.openTime}`}</p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {scheduleInfo.openTriggered 
                            ? (language === "ar" ? "تجاوز القفل: تم بنجاح" : "Signal Decrypted: System Unlocked")
                            : (language === "ar" ? "مجدول في وقت لاحق" : "Waiting for clock triggers")
                          }
                        </p>
                      </div>
                    </div>
                    <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-md", 
                      scheduleInfo.openTriggered ? "bg-emerald-400/10 text-emerald-400" : "bg-yellow-400/10 text-yellow-400 animate-pulse"
                    )}>
                      {scheduleInfo.openTriggered ? (language === "ar" ? "تم بنجاح" : "AUTO-TRIGGERED") : (language === "ar" ? "قيد الانتظار" : "PENDING")}
                    </span>
                  </div>

                  {/* Close trigger */}
                  <div className={cn("flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800/40", isRtl && "flex-row-reverse")}>
                    <div className={cn("flex items-center gap-3", isRtl && "flex-row-reverse")}>
                      <div className={cn("p-1.5 rounded-lg shrink-0", scheduleInfo.closeTriggered ? "bg-emerald-500/20 text-emerald-400" : "bg-yellow-500/10 text-yellow-500")}>
                        {scheduleInfo.closeTriggered ? <CheckCircle2 size={16} /> : <Timer size={16} />}
                      </div>
                      <div>
                        <p className="text-xs font-black">{language === "ar" ? `إغلاق البوابات عند ${scheduleInfo.closeTime}` : `Auto Gate Close at ${scheduleInfo.closeTime}`}</p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {scheduleInfo.closeTriggered 
                            ? (language === "ar" ? "تأمين الأسوار: تم بنجاح" : "System Secure Directive Active") 
                            : (language === "ar" ? "مجدول في وقت لاحق" : "Waiting for clock triggers")
                          }
                        </p>
                      </div>
                    </div>
                    <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-md", 
                      scheduleInfo.closeTriggered ? "bg-emerald-400/10 text-emerald-400" : "bg-yellow-400/10 text-yellow-400"
                    )}>
                      {scheduleInfo.closeTriggered ? (language === "ar" ? "تم بنجاح" : "AUTO-TRIGGERED") : (language === "ar" ? "قيد الانتظار" : "PENDING")}
                    </span>
                  </div>
                </div>
              </div>

              <div className={cn("flex items-center justify-between text-xs text-slate-400 font-medium", isRtl && "flex-row-reverse")}>
                <span>{scheduleInfo.nextActionLabel}</span>
                <span>{language === "ar" ? `التوقيت المكتشف: ${scheduleInfo.currentTimeDisplay}` : `Current Clock: ${scheduleInfo.currentTimeDisplay}`}</span>
              </div>
            </div>

            {/* Simulated Clock parameters (Testing Widget sandbox) */}
            <div className={cn("bg-white p-6 rounded-[2.5rem] border border-slate-200 flex flex-col justify-between space-y-4 shadow-sm", isRtl && "text-right")}>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-800">
                  <SlidersHorizontal size={18} className="text-slate-400" />
                  <span className="text-xs font-black uppercase tracking-widest">{language === "ar" ? "اختبار ومحاكاة المواعيد" : "Schedules Testing Sandbox"}</span>
                </div>
                <h4 className="text-base font-black text-slate-900 leading-tight">
                  {language === "ar" ? "مُحاكي الجدول الزمني البصري" : "Gate Schedule Simulator"}
                </h4>
                <p className="text-xs text-slate-400 leading-normal font-medium">
                  {language === "ar" ? "تريد مراجعة سلوك البوابات في تاريخ أو توقيت مخصص؟ استخدم المحاكي لتجاوز ساعة المتصفح واختبار الحالات." : "Tweak simulated times to evaluate how seasons open and close relative to Friday exceptions and daylight saving hours."}
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
                  <label className="text-xs font-bold text-slate-500">{language === "ar" ? "تفعيل المحاكي" : "Toggle Clock Injection"}</label>
                  <input
                    type="checkbox"
                    checked={useSimulatedClock}
                    onChange={(e) => setUseSimulatedClock(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{language === "ar" ? "تاريخ المحاكاة:" : "Simulated Date:"}</label>
                  <input
                    type="date"
                    disabled={!useSimulatedClock}
                    value={simulatedClockDate}
                    onChange={(e) => setSimulatedClockDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-emerald-500 disabled:opacity-40"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{language === "ar" ? "توقيت الساعة:" : "Simulated Time (24h):"}</label>
                  <input
                    type="time"
                    disabled={!useSimulatedClock}
                    value={simulatedClockTime}
                    onChange={(e) => setSimulatedClockTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-emerald-500 disabled:opacity-40"
                  />
                </div>
              </div>

              {useSimulatedClock ? (
                <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl border border-amber-100 text-[10px] font-bold">
                  {language === "ar" ? "⚠️ محاكاة التوقيت نشطة الآن وغطّت ساعة النظام." : "⚠️ Time overriding values in effect. Browser calendar mocked."}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl text-[10px] italic">
                  {language === "ar" ? "يستخدم ساعة متصفحك الفعلية." : "Using current host computer system time."}
                </div>
              )}
            </div>
          </div>

          {/* EMERGENCY TRIGGER DIRECTIVE TRANSMITTER DECK (Manager vs Guard layout screens) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left side: Broadcaster layout */}
            <div className={cn("lg:col-span-2 p-8 rounded-[2.5rem] bg-white border border-slate-200 space-y-6 shadow-sm", isRtl && "text-right")}>
              <div className={cn("flex items-start gap-4", isRtl && "flex-row-reverse")}>
                <div className="p-3 bg-red-100 text-red-650 rounded-2xl shrink-0">
                  <Radio size={24} className="animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    {language === "ar" ? "مرسل إشارات أوامر الطوارئ" : "Emergency Override Broadcast Terminal"}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">
                    {language === "ar" ? "لوحة الإدارة لإرسال وبث إشعارات وتوجيهات الطوارئ العاجلة فوراً إلى جميع حراس ومسؤولي الموقع." : "Authorize and deploy urgent immediate security directives manually overriding all automatic gates schedule profiles."}
                  </p>
                </div>
              </div>

              {/* Check if user is manager or admin */}
              {(user?.role === 'manager' || user?.role === 'admin') ? (
                <form onSubmit={handleDeployEmergencyBroadcast} className="space-y-4 pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{language === "ar" ? "نوع توجيه الحركة:" : "Overriding Command Target:"}</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setBroadcastType('open')}
                          className={cn("flex-1 py-3 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer",
                            broadcastType === 'open' 
                              ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs" 
                              : "bg-slate-50 border-slate-200 text-slate-600"
                          )}
                        >
                          <Unlock size={14} />
                          <span>{language === "ar" ? "فتح فوري (طوارئ)" : "EMERGENCY OPEN"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBroadcastType('close')}
                          className={cn("flex-1 py-3 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer",
                            broadcastType === 'close' 
                              ? "bg-red-50 border-red-500 text-red-700 shadow-xs" 
                              : "bg-slate-50 border-slate-200 text-slate-600"
                          )}
                        >
                          <Lock size={14} />
                          <span>{language === "ar" ? "إغلاق وتأمين فوري" : "EMERGENCY CLOSE"}</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{language === "ar" ? "سبب الحالة الطارئة:" : "Declaration Reason / Preset:"}</label>
                      <select
                        value={presetReason}
                        onChange={(e) => setPresetReason(e.target.value)}
                        className={cn("w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-red-500 cursor-pointer focus:outline-none", isRtl && "text-right")}
                      >
                        <option value="severe_weather">{language === "ar" ? "عواصف رملية وغبار مفرط" : "Severe Weather / Dust storms"}</option>
                        <option value="power_failure">{language === "ar" ? "انقطاع شبكة الطاقة الرئيسية" : "Power Grid / Reader Jam"}</option>
                        <option value="medical">{language === "ar" ? "حالة إخلاء طبي عاجلة" : "Medical Evacuation Deploy"}</option>
                        <option value="security">{language === "ar" ? " lockdown حظر وتطويق أمني" : "Lockdown Security Protocol"}</option>
                        <option value="other">{language === "ar" ? "أسباب تشغيلية طارئة" : "Other Operational Directive"}</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{language === "ar" ? "توجيهات ونصائح تشغيلية للموظفين:" : "Urgent Guidance & Directive Text:"}</label>
                    <textarea
                      required
                      rows={3}
                      value={customReasonNote}
                      onChange={(e) => setCustomReasonNote(e.target.value)}
                      placeholder={language === "ar" ? "اكتب تفاصيل التوجيه الميداني.. مثال: يرجى فتح البوابة ٣ يدوياً لتخفيف تدافع الرياح الشديدة" : "Describe the exact action items for onsite staff... (e.g. Card readers are down, manually unlock Gate A for immediate evacuation!)"}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-slate-700 text-xs font-semibold focus:ring-2 focus:ring-red-500 focus:outline-none resize-none leading-relaxed"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isPublishingBroadcast}
                    className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-red-200 cursor-pointer disabled:opacity-55 active:scale-[0.99]"
                  >
                    {isPublishingBroadcast 
                      ? (language === "ar" ? "جاري بث الإشارات العاجلة..." : "TRANSMITTING SIGNALS...") 
                      : (language === "ar" ? "⚠️ تشفير وبث تنبيه طوارئ عام فوري" : "⚠️ DECRYPT & DEPLOY EMERGENCY GATE DIRECTIVE")
                    }
                  </button>
                </form>
              ) : (
                // Passive receiver UI for staff
                <div className="bg-slate-50 border border-slate-150 p-6 rounded-3xl space-y-3">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Megaphone size={16} />
                    <span className="text-xs font-black uppercase tracking-wider">{language === "ar" ? "مستقبل التوجيهات التشغيلية للموظفين" : "Staff Signal Receiver"}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    {language === "ar" 
                      ? "جهاز استقبالك نشط ومؤمن بالكامل. عند إصدار المشرف الميداني لأي أمر إغلاق أو فتح عاجل لإخلاء الموقع، سيظهر تنبيه البث متوهجاً على شاشتك فوراً للاستجابة السريعة السليمة."
                      : "Telemetry receiver is active and online. In any emergency requiring lockdown or immediate unlocking, a priority full-screen alert will override your HUD, broadcasting supervisors' coordinates and instructions instantly."
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Right side: Signals Logs and Broadcasts feed */}
            <div className={cn("bg-white p-6 rounded-[2.5rem] border border-slate-200 flex flex-col justify-between space-y-4 shadow-sm", isRtl && "text-right")}>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-800">
                  <BellRing size={16} className="text-slate-400" />
                  <span className="text-xs font-black uppercase tracking-widest">{language === "ar" ? "سجل توجيهات الطوارئ" : "Active Signals Feed"}</span>
                </div>
                <h4 className="text-base font-black text-slate-900 leading-tight">
                  {language === "ar" ? "البث التناظري الأخير" : "Recent Decrees Issued"}
                </h4>
              </div>

              <div className="flex-1 space-y-3 max-h-[340px] overflow-y-auto pr-1">
                {broadcasts.length > 0 ? (
                  broadcasts.map((b) => {
                    const isCommandAcknowledge = acknowledgedAlerts[b.id];
                    return (
                      <div 
                        key={b.id} 
                        className={cn(
                          "p-4 rounded-2xl border flex flex-col gap-2 relative overflow-hidden",
                          b.type === 'emergency_open' ? "border-emerald-100 bg-emerald-50/30" : "border-red-100 bg-red-50/30"
                        )}
                      >
                        <div className={cn("flex justify-between items-start w-full gap-2", isRtl && "flex-row-reverse")}>
                          <span className={cn("text-[9px] font-black px-2 py-0.5 rounded uppercase font-mono tracking-wider",
                            b.type === 'emergency_open' ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                          )}>
                            {b.type === 'emergency_open' ? "OPEN" : "LOCKDOWN"}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            {new Date(b.timestamp?.seconds * 1000 || Date.now()).toLocaleTimeString(language === "ar" ? "ar-EG" : [], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div>
                          <p className="text-xs font-extrabold text-slate-800">{b.reason}</p>
                          <p className="text-[10px] text-slate-500 mt-1 leading-snug line-clamp-3">"{b.notes}"</p>
                          <p className="text-[9px] text-slate-400 mt-1 font-bold">
                            {language === "ar" ? "بواسطة: " : "By: "} {b.sender_name}
                          </p>
                        </div>

                        {!isCommandAcknowledge ? (
                          <button
                            onClick={() => acknowledgeAlert(b.id)}
                            className="w-full mt-1.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                          >
                            {language === "ar" ? "إقرار الاستلام" : "Acknowledge"}
                          </button>
                        ) : (
                          <div className={cn("flex items-center gap-1.5 text-[9px] text-emerald-500 font-bold justify-end mt-1", isRtl && "flex-row-reverse")}>
                            <CheckCircle2 size={10} />
                            <span>{language === "ar" ? "تم الإقرار ✓" : "Acknowledged ✓"}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-[10px] text-slate-350 uppercase tracking-widest font-black font-mono">
                    {language === "ar" ? "لا توجد توجيهات طارئة نشطة" : "No emergency decrees broadcasted"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtab Content: 3. Analytics & Headcount Charts */}
      {subActiveTab === 'analytics' && (
        <PeakTrafficCharts
          currentMainCount={count}
          currentPodCount={podCount}
          capacity={capacity}
          language={language}
        />
      )}

      {/* MODALS */}
      <AnimatePresence>
        {showBackfill && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden"
            >
              <div className={cn("p-8 space-y-6", isRtl && "text-right")}>
                <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
                  <h3 className="text-xl font-black text-slate-900">
                    {language === "ar" ? "تسجيل يدوي منفرد لقيد العبور" : "Manual Data Entry"}
                  </h3>
                  <button onClick={() => setShowBackfill(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleBackfill} className="space-y-4">
                  <div className="space-y-2">
                    <label className={cn("text-xs font-black text-slate-400 uppercase tracking-widest block", isRtl && "text-right")}>
                      {language === "ar" ? "الوقت والتاريخ" : "Date & Time"}
                    </label>
                    <input 
                      type="datetime-local"
                      required
                      value={backfillData.timestamp}
                      onChange={(e) => setBackfillData(prev => ({ ...prev, timestamp: e.target.value }))}
                      className={cn("w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-slate-700", isRtl && "text-right")}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={cn("text-xs font-black text-slate-400 uppercase tracking-widest block", isRtl && "text-right")}>
                        {language === "ar" ? "نوع القيد" : "Type"}
                      </label>
                      <select 
                        value={backfillData.type}
                        onChange={(e) => setBackfillData(prev => ({ ...prev, type: e.target.value as any }))}
                        className={cn("w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-slate-700", isRtl && "text-right")}
                      >
                        <option value="entry">{language === "ar" ? "دخول (+)" : "Entry (+)"}</option>
                        <option value="exit">{language === "ar" ? "خروج (-)" : "Exit (-)"}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className={cn("text-xs font-black text-slate-400 uppercase tracking-widest block", isRtl && "text-right")}>
                        {language === "ar" ? "الجهود" : "Population"}
                      </label>
                      <select 
                        value={backfillData.isPod ? "pod" : "main"}
                        onChange={(e) => setBackfillData(prev => ({ ...prev, isPod: e.target.value === "pod" }))}
                        className={cn("w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-slate-700", isRtl && "text-right")}
                      >
                        <option value="main">{language === "ar" ? "الموقع الرئيسي" : "Main Site"}</option>
                        <option value="pod">POD</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={cn("text-xs font-black text-slate-400 uppercase tracking-widest block", isRtl && "text-right")}>
                      {language === "ar" ? "العدد" : "Count"}
                    </label>
                    <input 
                      type="number"
                      min="1"
                      required
                      value={backfillData.count}
                      onChange={(e) => setBackfillData(prev => ({ ...prev, count: parseInt(e.target.value) }))}
                      className={cn("w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-slate-700", isRtl && "text-right")}
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-200 mt-4 cursor-pointer"
                  >
                    {language === "ar" ? "تسجيل وحفظ القيد" : "Save Manual Entry"}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
        {showBulkBackfill && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden"
            >
              <div className={cn("p-8 space-y-6", isRtl && "text-right")}>
                <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">
                      {language === "ar" ? "التدوين والرفع المجمّع" : "Bulk Data Entry"}
                    </h3>
                    <p className="text-sm text-slate-500 font-medium">
                      {language === "ar" ? "الصق السطور المجمّعة بالأسفل للتحميل الفوري" : "Paste multiple entries below"}
                    </p>
                  </div>
                  <button onClick={() => setShowBulkBackfill(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {language === "ar" ? "البنية القياسية المتوقعة (CSV)" : "Expected Format (CSV)"}
                  </p>
                  <code className="text-[10px] text-emerald-600 font-bold block">
                    YYYY-MM-DD HH:MM, [IN/OUT], [MAIN/POD], [COUNT]
                  </code>
                  <p className="text-[10px] text-slate-400 italic">
                    {language === "ar" ? "مثال: 2024-04-15 08:30, IN, MAIN, 75" : "Example: 2024-04-15 08:30, IN, MAIN, 75"}
                  </p>
                </div>

                <form onSubmit={handleBulkBackfill} className="space-y-4">
                  <div className="space-y-2">
                    <label className={cn("text-xs font-black text-slate-400 uppercase tracking-widest block", isRtl && "text-right")}>
                      {language === "ar" ? "البيانات المسطّرة" : "Data Lines"}
                    </label>
                    <textarea 
                      required
                      rows={8}
                      value={bulkData}
                      onChange={(e) => setBulkData(e.target.value)}
                      placeholder="2024-04-15 08:00, IN, MAIN, 50&#10;2024-04-15 08:15, IN, POD, 10"
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono text-xs text-slate-700 resize-none"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={isProcessingBulk || !bulkData.trim()}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-200 mt-4 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isProcessingBulk ? (
                      <>
                        <Activity size={20} className="animate-spin" />
                        <span>{language === "ar" ? "جاري معالجة القيود..." : "Processing..."}</span>
                      </>
                    ) : (
                      <span>{language === "ar" ? "معالجة وتحميل القيود الكليّة" : "Process Bulk Entry"}</span>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
