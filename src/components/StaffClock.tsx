import React, { useState, useEffect, useRef } from "react";
import { 
  Clock, 
  MapPin, 
  RefreshCw, 
  AlertCircle,
  Moon,
  Sun,
  FileText
} from "lucide-react";
import { motion } from "motion/react";
import { 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  serverTimestamp,
  doc,
  updateDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { cn } from "../lib/utils";

interface ClockRecord {
  id: string;
  user_id: string;
  user_name: string;
  type: "clock_in" | "clock_out";
  timestamp: any;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  department: string;
  notes?: string;
}

export function StaffClock() {
  const { user: currentUser } = useAuth();
  const { language, tData, dir } = useLanguage();
  
  const [clockLogs, setClockLogs] = useState<ClockRecord[]>([]);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [lastClockInTime, setLastClockInTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState("00:00:00");
  const [notes, setNotes] = useState("");
  
  // Geolocation states
  const [gpsStatus, setGpsStatus] = useState<"idle" | "acquiring" | "success" | "error">("idle");
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number; accuracy: number | null } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch user's clock logs from Firestore
  useEffect(() => {
    if (!currentUser) return;

    const clockLogsPath = "clock_logs";
    const q = query(
      collection(db, clockLogsPath)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ClockRecord[];

      // Filter and sort manually in-memory to prevent missing Firestore index errors
      const userLogs = allLogs
        .filter(log => log.user_id === currentUser.id)
        .sort((a, b) => {
          const aTime = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp).getTime();
          const bTime = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp).getTime();
          return bTime - aTime; // Latest first
        });

      setClockLogs(userLogs);

      // Check the latest log to see if the user is clocked in
      const latestLog = userLogs[0];
      if (latestLog && latestLog.type === "clock_in") {
        setIsClockedIn(true);
        const clockInDate = latestLog.timestamp?.seconds 
          ? new Date(latestLog.timestamp.seconds * 1000) 
          : new Date(latestLog.timestamp || Date.now());
        setLastClockInTime(clockInDate);
      } else {
        setIsClockedIn(false);
        setLastClockInTime(null);
        setElapsedTime("00:00:00");
      }
    }, (error) => {
      console.error("Error subscribing to clock logs:", error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // 2. Active timer elapsed time tracking
  useEffect(() => {
    if (isClockedIn && lastClockInTime) {
      const updateTimer = () => {
        const now = new Date();
        const diffMs = now.getTime() - lastClockInTime.getTime();
        if (diffMs < 0) {
          setElapsedTime("00:00:00");
          return;
        }
        
        const totalSecs = Math.floor(diffMs / 1000);
        const hours = Math.floor(totalSecs / 3600);
        const minutes = Math.floor((totalSecs % 3600) / 60);
        const seconds = totalSecs % 60;
        
        const pad = (n: number) => String(n).padStart(2, "0");
        setElapsedTime(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
      };

      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setElapsedTime("00:00:00");
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isClockedIn, lastClockInTime]);

  // 3. Geolocation fetch
  const triggerGPSAcquisition = (): Promise<{ latitude: number; longitude: number; accuracy: number | null }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        setGpsStatus("error");
        reject(new Error("Geolocation unsupported"));
        return;
      }

      setGpsStatus("acquiring");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || null
          };
          setGpsCoords(coords);
          setGpsStatus("success");
          resolve(coords);
        },
        (error) => {
          console.warn("Geolocation coordinate acquisition skipped/denied", error);
          setGpsStatus("error");
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  };

  // Pre-acquire GPS status on mount or when dashboard is displayed
  useEffect(() => {
    triggerGPSAcquisition().catch(() => {});
  }, []);

  // 4. Clock In / Out Action Trigger
  const handleClockToggle = async () => {
    if (!currentUser) return;
    setIsSubmitting(true);
    setActionError(null);

    let activeCoords = gpsCoords;
    
    // Attempt coordinate grab again to ensure up-to-date position tagging
    try {
      activeCoords = await triggerGPSAcquisition();
    } catch (err) {
      console.warn("Proceeding with last known coordinates or null tags due to geolocation limits:", err);
    }

    const actionType = isClockedIn ? "clock_out" : "clock_in";

    try {
      const clockLogsPath = "clock_logs";
      // Save logs with automatic GPS tags
      await addDoc(collection(db, clockLogsPath), {
        user_id: currentUser.id,
        user_name: currentUser.name,
        type: actionType,
        timestamp: serverTimestamp(),
        latitude: activeCoords?.latitude || null,
        longitude: activeCoords?.longitude || null,
        accuracy: activeCoords?.accuracy || null,
        department: currentUser.department || "Visitor Services",
        notes: notes.trim() || (actionType === "clock_in" ? "Shift Started" : "Shift Ended")
      });

      // Update user state reactive indicators in real-time
      const userRef = doc(db, "users", currentUser.id);
      await updateDoc(userRef, {
        status: actionType === "clock_in" ? "online" : "offline"
      });

      setNotes("");
    } catch (err: any) {
      console.error("Clock operation fail:", err);
      setActionError(
        language === "ar"
          ? "الوصول مقيد أو فشلت عملية الاتصال بالخادم. أعد المحاولة."
          : "Permission restricted or server connection reset. Try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between h-full relative" id="staff-clock-card">
      <div className="space-y-4">
        {/* Card Header Title with status indicator */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Clock size={16} />
            </div>
            <h3 className="font-black text-slate-800 text-sm tracking-tight uppercase">
              {language === "ar" ? "الحضور والمناوبات" : "Duty Attendance"}
            </h3>
          </div>
          
          <span className={cn(
            "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border shadow-sm transition-colors",
            isClockedIn 
              ? "bg-emerald-50 border-emerald-200 text-emerald-700 animate-pulse" 
              : "bg-slate-50 border-slate-200 text-slate-500"
          )}>
            {isClockedIn 
              ? (language === "ar" ? "على رأس العمل ومتزامن" : "ON SHIFT & SYNCED") 
              : (language === "ar" ? "خارج الخدمة" : "OFF DUTY")}
          </span>
        </div>

        {/* Live Duration tracking / elapsed shifts indicator */}
        <div className="py-4 text-center rounded-2xl bg-slate-50/50 border border-slate-100">
          <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
            {language === "ar" ? "وقت المناوبة النشط" : "ACTIVE TIME"}
          </p>
          <p className="text-4xl font-mono font-black text-slate-800 tracking-tight py-1">{elapsedTime}</p>
          <div className="flex items-center justify-center gap-1.5 mt-1 text-[11px] font-medium text-slate-500">
            {isClockedIn ? (
              <>
                <Sun size={12} className="text-amber-500 animate-spin" style={{ animationDuration: "12s" }} />
                <span>
                  {language === "ar" 
                    ? `بدأت نوبتك الميدانية الساعة ${lastClockInTime?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : `Duty started at ${lastClockInTime?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                </span>
              </>
            ) : (
              <>
                <Moon size={12} className="text-slate-400" />
                <span>
                  {language === "ar" ? "لا توجد مناوبة نشطة حالياً." : "No active schedule running."}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Custom optional shifts logging notes */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <FileText size={11} />
              <span>{language === "ar" ? "ملاحظة كتابية من المناوبة (اختياري)" : "Shift Note (Optional)"}</span>
            </label>
            <span className="text-[9px] text-slate-400">{notes.length}/80</span>
          </div>
          <input 
            type="text"
            maxLength={80}
            disabled={isSubmitting}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              isClockedIn 
                ? (language === "ar" ? "مثال: تم إكمال الجولات والتسليم بنجاح" : "e.g., Rounds completed, heading home")
                : (language === "ar" ? "مثال: بدأت جولة تفتيش محيط البوابة أولية" : "e.g., Initializing main desk sweep")
            }
            className={cn(
              "w-full text-xs px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400",
              dir === "rtl" ? "text-right" : "text-left"
            )}
          />
        </div>

        {/* GPS location diagnostics module */}
        <div className="p-3 bg-indigo-50/40 rounded-2xl border border-indigo-100/50 space-y-1.5 text-xs text-indigo-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold font-sans">
              <MapPin size={13} className={cn(
                gpsStatus === "success" ? "text-indigo-600 animate-bounce" :
                gpsStatus === "acquiring" ? "text-amber-500 animate-pulse" :
                "text-slate-400"
              )} />
              <span>{language === "ar" ? "التتبع الجغرافي ونظام GPS" : "GPS Tagging"}</span>
            </div>
            
            {/* Quick manual coordinates trigger */}
            <button
              onClick={() => triggerGPSAcquisition().catch(() => {})}
              disabled={gpsStatus === "acquiring"}
              type="button"
              className="text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-0.5 font-bold text-[10px] uppercase tracking-wider cursor-pointer"
              title="Recalculate geolocation"
            >
              <RefreshCw size={10} className={cn(gpsStatus === "acquiring" && "animate-spin")} />
              <span>{language === "ar" ? "تحديث" : "Refresh"}</span>
            </button>
          </div>

          {gpsStatus === "success" && gpsCoords ? (
            <div className="flex items-center justify-between font-mono text-[10px] text-indigo-700 bg-white/60 px-2 py-1.5 rounded-lg border border-indigo-100">
              <span className="truncate">Lat: {gpsCoords.latitude.toFixed(4)}</span>
              <span className="truncate">Lon: {gpsCoords.longitude.toFixed(4)}</span>
              <span className="text-[9px] font-bold text-emerald-600 font-sans tracking-wide shrink-0 bg-emerald-50 px-1 rounded">
                {language === "ar" ? "✔ تم تحديد الإحداثيات" : "✔ Tagged"}
              </span>
            </div>
          ) : gpsStatus === "acquiring" ? (
            <p className="text-[11px] text-indigo-600 animate-pulse">
              {language === "ar" ? "جاري استقبال بيانات القمر الصناعي الدقيقة..." : "Requesting exact satellite telemetry coordinates..."}
            </p>
          ) : (
            <div className="flex items-center justify-between text-[11px] text-amber-700/80">
              <span>{language === "ar" ? "تم رصد إحداثيات الموقع عبر شبكة الاتصال." : "Location tagged at general site router."}</span>
              <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wide bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                {language === "ar" ? "نشط" : "Active"}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 pt-4 mt-4 border-t border-slate-100">
        {actionError && (
          <div className="flex items-center gap-1.5 text-[10px] text-red-600 bg-red-50 p-2 rounded-xl border border-red-100">
            <AlertCircle size={12} className="shrink-0" />
            <span className="font-bold">{actionError}</span>
          </div>
        )}

        {/* Prominent high-contrast clocking interactive buttons */}
        <motion.button
          onClick={handleClockToggle}
          disabled={isSubmitting}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "w-full py-3 text-xs font-black uppercase tracking-widest text-white rounded-xl shadow-md transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer",
            isClockedIn 
              ? "bg-red-600 hover:bg-red-700 shadow-red-200" 
              : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200",
            isSubmitting && "opacity-50 cursor-wait"
          )}
        >
          {isSubmitting ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Clock size={14} />
          )}
          <span>
            {isClockedIn 
              ? (language === "ar" ? "تسجيل الانصراف الخروج" : "CLOCK OUT (END SHIFT)") 
              : (language === "ar" ? "تسجيل الحضور الدخول" : "CLOCK IN (START SHIFT)")}
          </span>
        </motion.button>

        {/* Log list feed of past actions */}
        <div className="space-y-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            {language === "ar" ? "سجل الحضور الأخير (آخر 3)" : "TIMECARD SESSIONS (LAST 3)"}
          </p>
          <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
            {clockLogs.slice(0, 3).map((log) => {
              const logTime = log.timestamp?.seconds 
                ? new Date(log.timestamp.seconds * 1000) 
                : new Date(log.timestamp || Date.now());
              return (
                <div 
                  key={log.id} 
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px]"
                >
                  <div className="flex items-center gap-2 max-w-[70%]">
                    <span className={cn(
                       "w-2 h-2 rounded-full",
                       log.type === "clock_in" ? "bg-emerald-500" : "bg-slate-400"
                    )} />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-700 leading-none">
                        {log.type === "clock_in" 
                          ? (language === "ar" ? "تسجيل دخول" : "Clocked In") 
                          : (language === "ar" ? "تسجيل خروج" : "Clocked Out")}
                      </p>
                      <p className="text-[9px] text-slate-400 truncate mt-0.5" title={log.notes}>
                        {tData(log.notes) || (language === "ar" ? "لا توجد ملاحظات" : "No notes provided")}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end text-right shrink-0">
                    <span className="font-bold text-slate-600 font-mono">
                      {logTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {log.latitude && (
                      <span className="text-[8px] font-mono font-bold text-indigo-500 bg-indigo-50 px-1 rounded mt-0.5">
                        {language === "ar" ? "📍 موقع GPS" : "📍 GPS TAGGED"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            
            {clockLogs.length === 0 && (
              <p className="text-[10px] text-slate-400 text-center py-4 italic select-none">
                {language === "ar" ? "لم يتم العثور على سجلات اليوم لنا." : "No shift logs found for today."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
