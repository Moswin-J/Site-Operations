import React, { useEffect, useState } from "react";
import { 
  AlertTriangle, 
  MapPin, 
  Camera, 
  Shield,
  Info,
  ChevronRight,
  Sparkles,
  User,
  Search,
  RotateCw,
  X,
  Check,
  RefreshCw
} from "lucide-react";
import { motion } from "motion/react";
import { GoogleGenAI } from "@google/genai";
import { cn } from "../lib/utils";
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const DEPARTMENTS = [
  "Visitor Experience",
  "Visitor Services",
  "Business Support",
  "Facility Management",
  "Security",
  "Conservation",
  "Heritage Management"
];

export function Incidents() {
  const { language, tData, dir } = useLanguage();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [isReporting, setIsReporting] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [newIncident, setNewIncident] = useState({ 
    type: "Maintenance", 
    description: "", 
    location: "", 
    severity: "Medium", 
    department: "",
    reported_by: "",
    image_url: ""
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [gpsStatus, setGpsStatus] = useState<"idle" | "acquiring" | "success" | "error">("idle");
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const acquireGPSLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus("error");
      return;
    }
    setGpsStatus("acquiring");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setGpsStatus("success");
      },
      (error) => {
        console.warn("GPS Location access denied or unavailable", error);
        setGpsStatus("error");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (isReporting) {
      acquireGPSLocation();
    } else {
      setGpsCoords(null);
      setGpsStatus("idle");
    }
  }, [isReporting]);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<"user" | "environment">("environment");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  const startCamera = async (facing = cameraFacingMode) => {
    setIsCameraActive(true);
    setCameraError(null);
    setCapturedImage(null);
    
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });
      setCameraStream(stream);
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setCameraError("Failed to access camera. Please confirm that you granted camera permissions to this frame, or check browser/device settings.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
    setIsCameraActive(false);
    setCapturedImage(null);
  };

  const toggleCameraFacingMode = () => {
    const nextMode = cameraFacingMode === "user" ? "environment" : "user";
    setCameraFacingMode(nextMode);
    if (isCameraActive) {
      startCamera(nextMode);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      const video = videoRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (cameraFacingMode === "user") {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setCapturedImage(dataUrl);
        } catch (e) {
          console.error("Image export restricted:", e);
          setCameraError("Unable to extract snapshot from local video stream due to browser sandboxing.");
        }
      }
    }
  };

  const attachCapturedImage = () => {
    if (capturedImage) {
      setNewIncident(prev => ({ ...prev, image_url: capturedImage }));
      stopCamera();
    }
  };

  const { user: currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;

    const path = "incidents";
    const q = query(collection(db, path), orderBy("created_at", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const incidentList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString()
      }));
      setIncidents(incidentList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    const fetchUsers = async () => {
      const usersPath = "users";
      try {
        const userSnapshot = await getDocs(collection(db, usersPath));
        setUsers(userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, usersPath);
      }
    };

    fetchUsers();
    return () => unsubscribe();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      const reporter = users.find(u => u.id === newIncident.reported_by);
      await addDoc(collection(db, "incidents"), {
        ...newIncident,
        reporter_name: reporter?.name || "Unknown",
        status: "open",
        created_at: serverTimestamp(),
        latitude: gpsCoords?.latitude || null,
        longitude: gpsCoords?.longitude || null
      });
      
      setIsReporting(false);
      setNewIncident({ 
        type: "Maintenance", 
        description: "", 
        location: "", 
        severity: "Medium", 
        department: "",
        reported_by: "",
        image_url: ""
      });
    } catch (error) {
      console.error("Error reporting incident:", error);
    }
  };

  const filteredIncidents = incidents.filter(incident => {
    const searchLower = searchQuery.toLowerCase();
    return incident.type.toLowerCase().includes(searchLower) ||
           incident.description.toLowerCase().includes(searchLower) ||
           incident.location?.toLowerCase().includes(searchLower) ||
           incident.reporter_name?.toLowerCase().includes(searchLower) ||
           new Date(incident.created_at).toLocaleDateString().toLowerCase().includes(searchLower);
  });

  const analyzeIncident = async () => {
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this heritage site incident report and provide conservation advice:
        Type: ${newIncident.type}
        Description: ${newIncident.description}
        Location: ${newIncident.location}
        Department: ${newIncident.department}
        
        Provide a brief, professional recommendation for immediate action and long-term conservation.`,
      });
      setAiAnalysis(response.text);
    } catch (error) {
      console.error("AI Analysis failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isRtl = dir === "rtl";

  return (
    <div className="pb-12 text-start">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4", isRtl && "sm:flex-row-reverse")}>
            <h3 className="text-xl font-black text-slate-900">
              {language === "ar" ? "البلاغات والحوادث الميدانية" : "Active Incidents"}
            </h3>
            <div className={cn("flex items-center gap-3 flex-1 max-w-md", isRtl && "flex-row-reverse")}>
              <div className="relative flex-1">
                <Search className={cn("absolute top-1/2 -translate-y-1/2 text-slate-400", isRtl ? "right-3" : "left-3")} size={18} />
                <input 
                  type="text" 
                  placeholder={language === "ar" ? "البحث عن بلاغ حسب النوع، المسؤول، الموقع..." : "Search incidents..."} 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "w-full py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-semibold",
                    isRtl ? "pl-4 pr-10 text-right" : "pl-10 pr-4 text-left"
                  )}
                />
              </div>
              <button 
                onClick={() => setIsReporting(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-black uppercase text-xs tracking-wider hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20 shrink-0 cursor-pointer"
              >
                <AlertTriangle size={18} />
                <span>{language === "ar" ? "تسجيل بلاغ" : "Report"}</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredIncidents.map((incident, i) => (
              <motion.div
                key={incident.id}
                initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn("bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-6", isRtl && "sm:flex-row-reverse text-right")}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
                  incident.severity === 'High' || incident.severity === 'Critical' || incident.severity === 'critical'
                    ? "bg-red-50 text-red-600" 
                    : "bg-amber-50 text-amber-600"
                )}>
                  <Shield size={24} />
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  <div className={cn("flex items-center justify-between gap-4 flex-wrap", isRtl && "flex-row-reverse")}>
                    <div className={cn("flex items-center gap-2 flex-wrap", isRtl && "flex-row-reverse")}>
                      <h4 className="font-extrabold text-slate-900 text-base">{tData(incident.type)}</h4>
                      {incident.department && (
                        <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-md border border-slate-200/50">
                          {tData(incident.department)}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 font-semibold">{new Date(incident.created_at).toLocaleString(language === "ar" ? "ar-EG" : "en-US")}</span>
                  </div>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">{tData(incident.description)}</p>
                  
                  {incident.image_url && (
                    <div className="mt-3 rounded-xl overflow-hidden border border-slate-100 max-h-60 bg-slate-50 flex items-center justify-center">
                      <img 
                        src={incident.image_url} 
                        alt="Incident attachment" 
                        className="w-full h-full object-cover max-h-60"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 border-t border-slate-50 mt-4", isRtl && "flex-row-reverse")}>
                    <div className={cn("flex items-center gap-1.5 text-xs text-slate-500 font-semibold", isRtl && "flex-row-reverse")}>
                      <User size={14} className="text-amber-500 shrink-0" />
                      <span>{language === "ar" ? "بواسطة:" : "By:"} {tData(incident.reporter_name || 'Unknown')}</span>
                    </div>
                    <div className={cn("flex items-center gap-1.5 text-xs text-slate-500 font-semibold", isRtl && "flex-row-reverse")}>
                      <MapPin size={14} className="shrink-0" />
                      <span>{tData(incident.location)}</span>
                    </div>
                    {incident.latitude && incident.longitude && (
                      <div className={cn("flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold font-mono text-indigo-700 bg-indigo-50 border border-indigo-100", isRtl && "flex-row-reverse")}>
                        <MapPin size={10} className="text-indigo-500" />
                        <span>GPS: {Number(incident.latitude).toFixed(5)}, {Number(incident.longitude).toFixed(5)}</span>
                      </div>
                    )}
                    <div className={cn("flex items-center gap-1.5 text-xs text-slate-500 font-semibold", isRtl && "flex-row-reverse")}>
                      <Info size={14} className="shrink-0" />
                      <span>{language === "ar" ? "الحالة:" : "Status:"} {tData(incident.status)}</span>
                    </div>
                  </div>
                </div>
                <button className="self-center p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors cursor-pointer">
                  <ChevronRight size={20} className={cn("shrink-0", isRtl && "rotate-180")} />
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className={cn("text-xl font-black text-slate-900 border-b border-slate-100 pb-3", isRtl && "text-right")}>
            {language === "ar" ? "تقرير بلاغ أمني عاجل" : "Incident Report"}
          </h3>
          {isReporting ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl space-y-4 text-start"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">{language === "ar" ? "نوع البلاغ" : "Type"}</label>
                  <select 
                    value={newIncident.type}
                    onChange={e => setNewIncident({...newIncident, type: e.target.value})}
                    className={cn(
                      "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none font-semibold text-sm",
                      isRtl && "text-right"
                    )}
                  >
                    <option value="Maintenance">{language === "ar" ? "صيانة وتجهيزات" : "Maintenance"}</option>
                    <option value="Security">{language === "ar" ? "أمن وحراسة" : "Security"}</option>
                    <option value="Visitor Safety">{language === "ar" ? "سلامة الزوار ووحدات الدعم" : "Visitor Safety"}</option>
                    <option value="Conservation">{language === "ar" ? "صون تاريخي ومعماري" : "Conservation"}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">{language === "ar" ? "القسم المشرف" : "Department"}</label>
                  <select 
                    value={newIncident.department}
                    onChange={e => setNewIncident({...newIncident, department: e.target.value})}
                    className={cn(
                      "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none font-semibold text-sm",
                      isRtl && "text-right"
                    )}
                  >
                    <option value="">{language === "ar" ? "اختر القسم" : "Select Dept"}</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{tData(d)}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">{language === "ar" ? "الموقع التفصيلي" : "Location"}</label>
                <input 
                  value={newIncident.location}
                  onChange={e => setNewIncident({...newIncident, location: e.target.value})}
                  placeholder={language === "ar" ? "مثال: ممر الجناح الغربي" : "e.g., West Wing Corridor"}
                  className={cn(
                    "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none font-semibold text-sm",
                    isRtl && "text-right"
                  )}
                />
              </div>

              {/* GPS Location Tagging Panel */}
              <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl space-y-2">
                <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
                  <div className={cn("flex items-center gap-2", isRtl && "flex-row-reverse")}>
                    <MapPin size={16} className={cn(
                      gpsStatus === "success" ? "text-indigo-500 animate-bounce" :
                      gpsStatus === "acquiring" ? "text-amber-500 animate-pulse" :
                      "text-slate-400"
                    )} />
                    <span className="text-xs font-black text-slate-700">{language === "ar" ? "تحديد إحداثيات GPS تلقائياً" : "GPS Location Tagging"}</span>
                  </div>
                  {gpsStatus === "acquiring" && (
                    <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                      {language === "ar" ? "جاري التحديد..." : "Acquiring..."}
                    </span>
                  )}
                  {gpsStatus === "success" && (
                    <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100/50 tracking-wider animate-pulse">
                      {language === "ar" ? "موصول تلقائياً" : "Auto-Tagged"}
                    </span>
                  )}
                  {gpsStatus === "error" && (
                    <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md tracking-wider">
                      {language === "ar" ? "غير متاح" : "Unavailable"}
                    </span>
                  )}
                </div>

                {gpsStatus === "success" && gpsCoords ? (
                  <div className={cn("flex items-center justify-between text-[11px] font-mono text-slate-500 bg-white border border-slate-100 px-3 py-1.5 rounded-xl shadow-xs", isRtl && "flex-row-reverse")}>
                    <span>Lat: {gpsCoords.latitude.toFixed(6)}</span>
                    <span>Lng: {gpsCoords.longitude.toFixed(6)}</span>
                    <button
                      type="button"
                      onClick={acquireGPSLocation}
                      className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                    >
                      {language === "ar" ? "تحديث" : "Refresh"}
                    </button>
                  </div>
                ) : gpsStatus === "acquiring" ? (
                  <p className="text-[11px] text-slate-400">{language === "ar" ? "جاري الاتصال بالأقمار الصناعية للحصول على الإحداثيات..." : "Requesting device coordinates for security logging..."}</p>
                ) : (
                  <div className={cn("flex items-center justify-between text-[11px] text-slate-400", isRtl && "flex-row-reverse")}>
                    <span>{language === "ar" ? "تم رفض الوصول للأذونات أو انتهت المهلة" : "GPS permission denied or timed out."}</span>
                    <button
                      type="button"
                      onClick={acquireGPSLocation}
                      className="text-[10px] font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer"
                    >
                      {language === "ar" ? "محاولة مجدداً" : "Try Again"}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">{language === "ar" ? "المبلّغ" : "Reported By"}</label>
                  <select 
                    required
                    value={newIncident.reported_by}
                    onChange={e => setNewIncident({...newIncident, reported_by: e.target.value})}
                    className={cn(
                      "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none font-semibold text-sm",
                      isRtl && "text-right"
                    )}
                  >
                    <option value="">{language === "ar" ? "اختر الموظف" : "Select Staff"}</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">{language === "ar" ? "الخطورة والأهمية" : "Severity"}</label>
                  <select 
                    value={newIncident.severity}
                    onChange={e => setNewIncident({...newIncident, severity: e.target.value})}
                    className={cn(
                      "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none font-semibold text-sm",
                      isRtl && "text-right"
                    )}
                  >
                    <option value="Low">{language === "ar" ? "منخفضة" : "Low"}</option>
                    <option value="Medium">{language === "ar" ? "متوسطة" : "Medium"}</option>
                    <option value="High">{language === "ar" ? "عالية حية" : "High"}</option>
                    <option value="Critical">{language === "ar" ? "حرجة جداً" : "Critical"}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className={cn("flex justify-between items-center gap-2", isRtl && "flex-row-reverse")}>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">{language === "ar" ? "ملحقات الصورة الميدانية" : "Photo Attachment"}</label>
                  {!isCameraActive && (
                    <button 
                      type="button"
                      onClick={() => startCamera()}
                      className="flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-2 py-1 rounded-lg transition-colors border border-amber-100 cursor-pointer shadow-3xs"
                    >
                      <Camera size={14} />
                      <span>{language === "ar" ? "استخدام الكاميرا" : "Use Camera"}</span>
                    </button>
                  )}
                </div>

                {isCameraActive && (
                  <div className="border border-slate-200 rounded-2xl bg-slate-950 overflow-hidden relative p-2 space-y-2">
                    {cameraError ? (
                      <div className="p-4 text-center space-y-2 text-white bg-red-950/80 rounded-xl">
                        <AlertTriangle size={32} className="mx-auto text-red-500" />
                        <p className="text-xs font-medium">{cameraError}</p>
                        <button
                          type="button"
                          onClick={() => startCamera()}
                          className="px-3 py-1 bg-red-800 hover:bg-red-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Retry Access
                        </button>
                      </div>
                    ) : capturedImage ? (
                      <div className="relative">
                        <img 
                          src={capturedImage} 
                          alt="Captured preview" 
                          className="w-full h-48 object-cover rounded-xl border border-slate-800"
                        />
                        <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white">
                          <Check size={16} className="text-emerald-400" />
                        </div>
                      </div>
                    ) : (
                      <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-video max-h-[220px]">
                        <video 
                          ref={videoRef}
                          autoPlay 
                          playsInline 
                          muted
                          className="w-full h-full object-cover"
                        />
                        <div className={cn("absolute top-3 bg-slate-950/80 rounded-full px-2 py-1 text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 border border-emerald-500/30", isRtl ? "right-3" : "left-3")}>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>{language === "ar" ? "بث حي وتوجيه" : "Live Stream"}</span>
                        </div>
                      </div>
                    )}

                    {/* Camera controls */}
                    <div className={cn("flex items-center justify-between gap-2 pt-1 bg-slate-950 px-2 rounded-xl", isRtl && "flex-row-reverse")}>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <X size={16} />
                        <span>{language === "ar" ? "إلغاء" : "Cancel"}</span>
                      </button>

                      {!capturedImage ? (
                        <button
                          type="button"
                          onClick={capturePhoto}
                          disabled={!!cameraError}
                          className="w-10 h-10 bg-white active:scale-95 text-slate-900 rounded-full hover:bg-slate-100 flex items-center justify-center border-4 border-slate-800 transition-all shadow-md focus:outline-none cursor-pointer"
                          title="Click to snapshot"
                        >
                          <div className="w-3 h-3 rounded-full bg-slate-900" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={attachCapturedImage}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md transition-all cursor-pointer"
                        >
                          <Check size={16} />
                          <span>{language === "ar" ? "تأكيد وإرفاق" : "Attach Photo"}</span>
                        </button>
                      )}

                      {!capturedImage ? (
                        <button
                          type="button"
                          onClick={toggleCameraFacingMode}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                          title="Switch front/back camera"
                        >
                          <RotateCw size={18} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startCamera()}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Retake photo"
                        >
                          <RefreshCw size={16} />
                          <span>{language === "ar" ? "إعادة" : "Retake"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Show current attached thumbnail & clear button */}
                {newIncident.image_url && (
                  <div className={cn("p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-4", isRtl && "flex-row-reverse text-right")}>
                    <img 
                      src={newIncident.image_url} 
                      alt="Attachment Preview" 
                      className="w-14 h-14 object-cover rounded-xl border border-slate-200 bg-slate-100 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{language === "ar" ? "الصورة الميدانية جاهزة للإرفاق" : "Photo Attachment Ready"}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">
                        {newIncident.image_url.startsWith("data:") 
                          ? (language === "ar" ? "ملتقطة من كاميرا الهاتف" : "Captured from device camera") 
                          : newIncident.image_url}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewIncident({...newIncident, image_url: ""})}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Clear photo"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {/* Manual Photo URL input fallback */}
                <input 
                  type="url"
                  value={newIncident.image_url}
                  onChange={e => setNewIncident({...newIncident, image_url: e.target.value})}
                  placeholder={language === "ar" ? "أو الصق رابط صورة خارجي (https://...)" : "Or paste an image URL (https://...)"}
                  className={cn(
                    "w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-xs font-semibold",
                    isRtl && "text-right"
                  )}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">{language === "ar" ? "وصف البلاغ والتفاصيل" : "Description"}</label>
                <textarea 
                  value={newIncident.description}
                  onChange={e => setNewIncident({...newIncident, description: e.target.value})}
                  placeholder={language === "ar" ? "يرجى كتابة تفاصيل المشكلة أو الحادث العارض بدقة لتقدير الاستجابة..." : "Describe the issue..."}
                  className={cn(
                    "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none min-h-[100px] font-medium text-sm leading-relaxed",
                    isRtl && "text-right"
                  )}
                />
              </div>

              <div className={cn("flex gap-2", isRtl && "flex-row-reverse")}>
                <button 
                  type="button"
                  onClick={analyzeIncident}
                  disabled={isAnalyzing || !newIncident.description}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-50 text-purple-600 rounded-xl font-bold text-xs hover:bg-purple-100 transition-colors disabled:opacity-50 cursor-pointer uppercase tracking-wider"
                >
                  <Sparkles size={18} />
                  <span>{isAnalyzing ? (language === "ar" ? "جاري التحليل..." : "Analyzing...") : (language === "ar" ? "إرشادات الذكاء الاصطناعي" : "AI Advice")}</span>
                </button>
                <button 
                  type="button"
                  onClick={() => startCamera()}
                  className={cn(
                    "p-2.5 rounded-xl border transition-all duration-200 cursor-pointer",
                    isCameraActive 
                      ? "bg-amber-100 text-amber-700 border-amber-200 animate-pulse" 
                      : "bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200"
                  )}
                  title="Open Camera"
                >
                  <Camera size={20} />
                </button>
              </div>

              {aiAnalysis && (
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 text-xs text-purple-900 leading-relaxed font-semibold">
                  <strong className="block border-b border-purple-200 pb-1 mb-2">
                    {language === "ar" ? "توصية وتحليل الذكاء الاصطناعي الأمني وبحوث الصون الميدانية:" : "AI Suggestion:"}
                  </strong> 
                  <span className="selection:bg-purple-200 leading-relaxed">{aiAnalysis}</span>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setIsReporting(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {language === "ar" ? "إلغاء" : "Cancel"}
                </button>
                <button 
                  onClick={handleSubmit}
                  className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  {language === "ar" ? "إرسال البلاغ فورا" : "Submit"}
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
              <AlertTriangle size={48} className="mx-auto mb-4 text-slate-300 animate-pulse" />
              <p className="text-sm text-slate-500 font-extrabold leading-relaxed">
                {language === "ar" 
                  ? "حدد حادثة أو بلاغاً من القائمة الجانبية لمعاينة كافة الإجراءات الميدانية والصور المرفقة، أو انقر على إبلاغ للبدء." 
                  : "Select an incident to view details or report a new one."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
