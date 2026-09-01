import React, { useState, useEffect } from "react";
import { 
  UserPlus, 
  Search, 
  User, 
  Briefcase, 
  Trash2, 
  Edit2,
  X,
  TrendingUp,
  Clock,
  MapPin,
  ExternalLink,
  Users,
  Compass,
  Globe,
  Filter,
  RefreshCw,
  Map,
  AlertTriangle,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LayoutItem } from '../context/LayoutContext';
import { cn } from "../lib/utils";
import { collection, onSnapshot, query, doc, updateDoc, deleteDoc, setDoc, addDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { CustomizableGrid } from "./CustomizableGrid";
import { useLanguage } from "../context/LanguageContext";

const ROLES = ["admin", "manager", "user"];
const DEPARTMENTS = [
  "Heritage Management",
  "Security",
  "Conservation",
  "Visitor Experience",
  "Visitor Services",
  "Business Support",
  "Facility Management"
];

interface ClockLog {
  id: string;
  user_id: string;
  user_name: string;
  type: "clock_in" | "clock_out" | string;
  timestamp: any;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  department?: string;
  notes?: string;
}

export function Staff() {
  const { language, t, tData, dir } = useLanguage();
  const isRtl = dir === "rtl";
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newUser, setNewUser] = useState({
    name: "",
    role: "user",
    department: DEPARTMENTS[0]
  });

  const { user: currentUser } = useAuth();

  // Clock Geolocation view states
  const [activeTab, setActiveTab] = useState<"roster" | "clock_logs" | "map_geofence">("roster");
  const [clockLogs, setClockLogs] = useState<ClockLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logTypeFilter, setLogTypeFilter] = useState("all");
  const [logGpsFilter, setLogGpsFilter] = useState("all");

  // Geofencing & Map States
  const [geofenceCenter, setGeofenceCenter] = useState(() => {
    const saved = localStorage.getItem("geofence_center");
    return saved ? JSON.parse(saved) : { lat: 51.1789, lng: -1.8262 };
  });
  const [geofenceRadius, setGeofenceRadius] = useState(() => {
    const saved = localStorage.getItem("geofence_radius");
    return saved ? Number(saved) : 150;
  });
  const [boundaryType, setBoundaryType] = useState<"circle" | "polygon">(() => {
    const saved = localStorage.getItem("geofence_type");
    return (saved as "circle" | "polygon") || "circle";
  });
  const [polygonPoints, setPolygonPoints] = useState<Array<{ lat: number; lng: number }>>(() => {
    const saved = localStorage.getItem("geofence_polygon");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    // Default polygon surrounding Stonehenge area
    return [
      { lat: 51.1802, lng: -1.8282 }, // Northwest
      { lat: 51.1802, lng: -1.8242 }, // Northeast
      { lat: 51.1776, lng: -1.8242 }, // Southeast
      { lat: 51.1776, lng: -1.8282 }  // Southwest
    ];
  });

  useEffect(() => {
    localStorage.setItem("geofence_center", JSON.stringify(geofenceCenter));
  }, [geofenceCenter]);

  useEffect(() => {
    localStorage.setItem("geofence_radius", String(geofenceRadius));
  }, [geofenceRadius]);

  useEffect(() => {
    localStorage.setItem("geofence_type", boundaryType);
  }, [boundaryType]);

  useEffect(() => {
    localStorage.setItem("geofence_polygon", JSON.stringify(polygonPoints));
  }, [polygonPoints]);

  const [selectedLogOnMap, setSelectedLogOnMap] = useState<any | null>(null);
  const [mapZoom, setMapZoom] = useState(1.0);
  const [mapMode, setMapMode] = useState<'radar' | 'earth'>('earth');
  const [isSimulatingCoords, setIsSimulatingCoords] = useState(false);
  const [mapCenterLabel, setMapCenterLabel] = useState("Stonehenge (Wiltshire, UK)");

  useEffect(() => {
    if (!currentUser) return;

    const path = "users";
    const q = query(collection(db, path));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const clockLogsPath = "clock_logs";
    const q = query(collection(db, clockLogsPath));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ClockLog[];

      // Sort in-memory latest first
      logs.sort((a, b) => {
        const aTime = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp).getTime();
        const bTime = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp).getTime();
        return bTime - aTime;
      });

      setClockLogs(logs);
      setIsLoadingLogs(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, clockLogsPath);
      setIsLoadingLogs(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    superFormSubmitBlock:
    e.preventDefault();
    
    try {
      if (editingUser) {
        await updateDoc(doc(db, "users", editingUser.id), {
          name: newUser.name,
          role: newUser.role,
          department: newUser.department
        });
      } else {
        // For new staff, we'd ideally want them to register themselves.
        // But if an admin adds them, we create a placeholder or a profile.
        // Since we don't have their UID yet, we might use a random ID or email.
        // For now, let's assume we're just managing existing profiles or creating new ones with a generated ID.
        const newId = doc(collection(db, "users")).id;
        await setDoc(doc(db, "users", newId), {
          ...newUser,
          status: "offline",
          created_at: new Date().toISOString()
        });
      }

      setIsModalOpen(false);
      setEditingUser(null);
      setNewUser({ name: "", role: "user", department: DEPARTMENTS[0] });
    } catch (error) {
      console.error("Error saving staff member:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this staff member?")) return;
    
    try {
      await deleteDoc(doc(db, "users", id));
    } catch (error) {
      console.error("Error deleting staff member:", error);
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredClockLogs = clockLogs.filter(log => {
    const matchesSearch = 
      (log.user_name || "").toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      (log.department || "").toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      (log.notes || "").toLowerCase().includes(logSearchQuery.toLowerCase());
    
    const matchesType = logTypeFilter === "all" || log.type === logTypeFilter;
    
    const matchesGps = logGpsFilter === "all" || (log.latitude !== null && log.latitude !== undefined);
    
    return matchesSearch && matchesType && matchesGps;
  });

  const formatLogTime = (timestamp: any) => {
    if (!timestamp) return "N/A";
    let date: Date;
    if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Group clock logs by user to find their last known GPS position
  const lastKnownPositions = React.useMemo(() => {
    const map = new globalThis.Map<string, ClockLog>();
    clockLogs.forEach(log => {
      if (log.latitude !== null && log.latitude !== undefined && log.user_id) {
        if (!map.has(log.user_id)) {
          map.set(log.user_id, log);
        }
      }
    });
    return Array.from(map.values()) as ClockLog[];
  }, [clockLogs]);

  const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Radius of the Earth in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Find cartesian offsets (dx, dy) in meters from center
  const projectedPositions = React.useMemo(() => {
    const R = 6371000;
    const centerLatRad = (geofenceCenter.lat * Math.PI) / 180;
    
    // Ray-Casting algorithm for point-in-polygon checks
    const isInsidePolygon = (latitude: number, longitude: number, pts: Array<{lat: number, lng: number}>): boolean => {
      if (pts.length < 3) return true; // complete boundary layout fallback default
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i].lat, yi = pts[i].lng;
        const xj = pts[j].lat, yj = pts[j].lng;
        
        const intersect = ((yi > longitude) !== (yj > longitude))
            && (latitude < (xj - xi) * (longitude - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    };

    return lastKnownPositions.map(pos => {
      const lat = pos.latitude!;
      const lon = pos.longitude!;
      
      const dx = R * (lon - geofenceCenter.lng) * (Math.PI / 180) * Math.cos(centerLatRad);
      const dy = R * (lat - geofenceCenter.lat) * (Math.PI / 180);
      const distance = getHaversineDistance(lat, lon, geofenceCenter.lat, geofenceCenter.lng);
      
      const userProfile = users.find(u => u.id === pos.user_id);
      const userStatus = userProfile?.status || "offline";
      const isOnline = userStatus === "online";
      
      const isViolating = isOnline && (
        boundaryType === "polygon"
          ? !isInsidePolygon(lat, lon, polygonPoints)
          : distance > geofenceRadius
      );
      
      return {
        ...pos,
        dx,
        dy,
        distance,
        isOnline,
        isViolating,
        userRole: userProfile?.role || "user"
      };
    });
  }, [lastKnownPositions, geofenceCenter, geofenceRadius, boundaryType, polygonPoints, users]);

  const activeViolations = React.useMemo(() => {
    return projectedPositions.filter(p => p.isOnline && p.isViolating);
  }, [projectedPositions]);

  const handleInjectDemoLogs = async () => {
    setIsSimulatingCoords(true);
    try {
      const demoUsers = [
        { id: "demo_guard_1", name: "Sir Arthur Pendragon", role: "manager", department: "Security", status: "online" },
        { id: "demo_guard_2", name: "Lady Guinevere", role: "user", department: "Conservation", status: "online" },
        { id: "demo_guard_3", name: "Merlin the Guide", role: "user", department: "Visitor Experience", status: "online" },
        { id: "demo_guard_4", name: "Lancelot Ranger", role: "user", department: "Security", status: "offline" }
      ];

      for (const u of demoUsers) {
        await setDoc(doc(db, "users", u.id), {
          name: u.name,
          role: u.role,
          department: u.department,
          status: u.status,
          created_at: new Date().toISOString()
        });
      }

      const latOffset = 0.0008; // ~90 meters
      const lngOffset = 0.0012; // ~90 meters

      const demoLogs = [
        {
          user_id: "demo_guard_1",
          user_name: "Sir Arthur Pendragon",
          type: "clock_in",
          timestamp: new Date(),
          latitude: geofenceCenter.lat + latOffset * 0.4,
          longitude: geofenceCenter.lng + lngOffset * 0.3,
          accuracy: 5,
          department: "Security",
          notes: "Patrolling central castle courtyard."
        },
        {
          user_id: "demo_guard_2",
          user_name: "Lady Guinevere",
          type: "clock_in",
          timestamp: new Date(Date.now() - 5 * 60000),
          latitude: geofenceCenter.lat - latOffset * 0.3,
          longitude: geofenceCenter.lng - lngOffset * 0.4,
          accuracy: 8,
          department: "Conservation",
          notes: "Analyzing stone moisture levels at main structure."
        },
        {
          user_id: "demo_guard_3",
          user_name: "Merlin the Guide",
          type: "clock_in",
          timestamp: new Date(Date.now() - 12 * 60000),
          latitude: geofenceCenter.lat + latOffset * 1.8, // Violator (outside radius)
          longitude: geofenceCenter.lng + lngOffset * 2.1,
          accuracy: 12,
          department: "Visitor Experience",
          notes: "Greeting visitors at outer highway intersection bus stop."
        },
        {
          user_id: "demo_guard_4",
          user_name: "Lancelot Ranger",
          type: "clock_out",
          timestamp: new Date(Date.now() - 25 * 60000),
          latitude: geofenceCenter.lat - latOffset * 1.5,
          longitude: geofenceCenter.lng + lngOffset * 2.2,
          accuracy: 10,
          department: "Security",
          notes: "Southern outer gate inspection report concluded."
        }
      ];

      for (const log of demoLogs) {
        await addDoc(collection(db, "clock_logs"), log);
      }
    } catch (e) {
      console.error("Error creating test data:", e);
    } finally {
      setIsSimulatingCoords(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser sandbox.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeofenceCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setMapCenterLabel("Your Current Physical Location");
      },
      (err) => {
        alert("Could not fetch actual location. Sandboxed browser permission might be restricted. Set manual coordinates instead!");
      }
    );
  };

  const defaultLayout: LayoutItem[] = [
    { i: 'search', x: 0, y: 0, w: 9, h: 4 },
    { i: 'actions', x: 9, y: 0, w: 3, h: 4 },
    { i: 'staff_grid', x: 0, y: 4, w: 12, h: 20 },
  ];

  return (
    <div className="pb-12 space-y-6">
      {/* View Selector Tabs */}
      <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/60 pb-1 gap-4", isRtl && "flex-row-reverse")} id="staff-view-tabs">
        <div className={cn("flex items-center gap-1", isRtl && "flex-row-reverse")}>
          <button
            onClick={() => setActiveTab("roster")}
            className={cn(
              "flex items-center gap-2 px-5 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500 border-b-2 border-transparent hover:text-slate-900 transition-all cursor-pointer",
              activeTab === "roster" && "border-indigo-600 text-indigo-600 font-extrabold"
            )}
            id="tab-roster"
          >
            <Users size={14} />
            {language === "ar" ? `قائمة الحراس النشطين (${filteredUsers.length})` : `Active Staff Roster (${filteredUsers.length})`}
          </button>
          <button
            onClick={() => setActiveTab("clock_logs")}
            className={cn(
              "flex items-center gap-2 px-5 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500 border-b-2 border-transparent hover:text-slate-900 transition-all cursor-pointer relative",
              activeTab === "clock_logs" && "border-indigo-600 text-indigo-600 font-extrabold"
            )}
            id="tab-clock-logs"
          >
            <Clock size={14} />
            {language === "ar" ? `سجل الحضور والانصراف (${filteredClockLogs.length})` : `Clock Operations Log (${filteredClockLogs.length})`}
            {clockLogs.some(log => log.type === "clock_in") && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute top-2 right-2 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("map_geofence")}
            className={cn(
              "flex items-center gap-2 px-5 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500 border-b-2 border-transparent hover:text-slate-900 transition-all cursor-pointer relative",
              activeTab === "map_geofence" && "border-indigo-600 text-indigo-600 font-extrabold"
            )}
            id="tab-map-geofence"
          >
            <Map size={14} />
            {language === "ar" ? "خريطة النطاق والسياج الجغرافي" : "Perimeter Map & Geofence"}
            {activeViolations.length > 0 ? (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white absolute -top-1 -right-1 animate-bounce">
                !
              </span>
            ) : projectedPositions.length > 0 ? (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 absolute top-2 right-2" />
            ) : null}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "roster" && (
          <motion.div
            key="roster-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            <div className={cn("flex flex-col sm:flex-row items-center gap-4", isRtl && "flex-row-reverse")}>
              <div className="relative flex-1 w-full">
                <Search className={cn("absolute top-1/2 -translate-y-1/2 text-slate-400", isRtl ? "right-3" : "left-3")} size={18} />
                <input 
                  type="text" 
                  placeholder={language === "ar" ? "البحث في الحراس بالاسم، المسمى، أو القسم..." : "Search staff by name, role, or department..."} 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn("w-full py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm h-11", isRtl ? "pr-10 pl-4 text-right" : "pl-10 pr-4")}
                />
              </div>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setEditingUser(null);
                  setNewUser({ name: "", role: "user", department: DEPARTMENTS[0] });
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20 shrink-0 h-11 cursor-pointer"
              >
                <UserPlus size={20} />
                <span>{language === "ar" ? "إضافة حارس" : "Add Staff"}</span>
              </motion.button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredUsers.map((user) => (
                  <motion.div
                    key={user.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={cn("mission-control-card p-6 group relative", isRtl && "text-right")}
                  >
                    <div className={cn("flex items-start justify-between", isRtl && "flex-row-reverse")}>
                      <div className={cn("flex items-center gap-4", isRtl && "flex-row-reverse")}>
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center text-white border-4 border-white shadow-xl transition-transform group-hover:scale-110 duration-500",
                          user.role === 'admin' ? "bg-slate-900" :
                          user.role === 'manager' ? "bg-emerald-600" :
                          "bg-slate-400"
                        )}>
                          <span className="text-xl font-black">{user.name.charAt(0)}</span>
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 tracking-tight text-lg">{tData(user.name)}</h4>
                          <div className={cn("flex items-center gap-2 mt-0.5", isRtl && "flex-row-reverse")}>
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border",
                              user.role === 'admin' ? "bg-slate-50 border-slate-200 text-slate-900" :
                              user.role === 'manager' ? "bg-emerald-50 border-emerald-100 text-emerald-700" :
                              "bg-slate-50 border-slate-200 text-slate-500"
                            )}>
                              {tData(user.role)}
                            </span>
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full mt-0.5",
                              user.status === 'online' ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-300"
                            )} />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tData(user.status)}</span>
                          </div>
                        </div>
                      </div>
                      <div className={cn("flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform", isRtl ? "-translate-x-2 group-hover:translate-x-0" : "translate-x-2 group-hover:translate-x-0")}>
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setNewUser({ name: user.name, role: user.role, department: user.department || DEPARTMENTS[0] });
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-6 pt-4 border-t border-slate-50">
                      <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
                        <div className="flex flex-col">
                          <span className="data-label">{language === "ar" ? "القسم والموقع الميداني" : "Deployment"}</span>
                          <div className={cn("flex items-center gap-2 mt-1", isRtl && "flex-row-reverse")}>
                            <Briefcase size={12} className="text-slate-300" />
                            <span className="text-xs font-bold text-slate-600 truncate max-w-[180px]">{tData(user.department || "General Ops")}</span>
                          </div>
                        </div>
                        <div className="h-8 w-8 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500">
                          <TrendingUp size={14} className="opacity-40 group-hover:opacity-100" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {activeTab === "clock_logs" && (
          <motion.div
            key="clock-logs-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            {/* Clock logs dashboard controls */}
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-xs space-y-4" id="clock-logs-filter-panel">
              <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-4", isRtl && "flex-row-reverse text-right")}>
                <div>
                  <h3 className={cn("text-base font-extrabold text-slate-900 flex items-center gap-2", isRtl && "flex-row-reverse")}>
                    <Compass size={18} className="text-indigo-600 animate-spin" style={{ animationDuration: '6s' }} />
                    {language === "ar" ? "مركز الحضور والانصراف الجغرافي الفوري" : "Live Clock Audit & Geolocation Hub"}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {language === "ar" ? "راقب البيانات الجغرافية الدقيقة وسجلات الدخول والخروج للحراس بمواقع الآثار." : "Monitor precise GPS tags and activity logs recorded during employee check-ins and check-outs."}
                  </p>
                </div>
              </div>

              <div className={cn("grid grid-cols-1 sm:grid-cols-12 gap-4", isRtl && "text-right")}>
                {/* Search query input */}
                <div className="relative sm:col-span-5">
                  <Search className={cn("absolute top-1/2 -translate-y-1/2 text-slate-400", isRtl ? "right-3" : "left-3")} size={16} />
                  <input 
                    type="text" 
                    placeholder={language === "ar" ? "تصفية السجلات حسب الحارس أو القسم..." : "Filter logs by staff or department..."} 
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    className={cn("w-full py-2 bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl outline-none text-xs transition-all h-10 font-semibold text-slate-700", isRtl ? "pr-9 pl-4 text-right" : "pl-9 pr-4")}
                  />
                </div>

                {/* Filter Selector by Mode */}
                <div className="relative sm:col-span-3">
                  <select
                    value={logTypeFilter}
                    onChange={(e) => setLogTypeFilter(e.target.value)}
                    className={cn("w-full py-2 bg-slate-50 hover:bg-slate-50/80 border border-slate-200 rounded-xl outline-none text-xs font-semibold text-slate-700 appearance-none h-10 cursor-pointer", isRtl ? "pr-3 pl-8 text-right" : "pl-3 pr-8")}
                  >
                    <option value="all">{language === "ar" ? "🔄 جميع العمليات (حضور/انصراف)" : "🔄 All Actions (In / Out)"}</option>
                    <option value="clock_in">{language === "ar" ? "🟢 حضور فقط" : "🟢 Clock-In Entries"}</option>
                    <option value="clock_out">{language === "ar" ? "🔴 انصراف فقط" : "🔴 Clock-Out Entries"}</option>
                  </select>
                  <div className={cn("pointer-events-none absolute inset-y-0 flex items-center px-4 text-slate-400", isRtl ? "left-0" : "right-0")}>
                    <Filter size={12} />
                  </div>
                </div>

                {/* Filter Selector by GPS condition */}
                <div className="relative sm:col-span-4">
                  <select
                    value={logGpsFilter}
                    onChange={(e) => setLogGpsFilter(e.target.value)}
                    className={cn("w-full py-2 bg-slate-50 hover:bg-slate-50/80 border border-slate-200 rounded-xl outline-none text-xs font-semibold text-slate-700 appearance-none h-10 cursor-pointer", isRtl ? "pr-3 pl-8 text-right" : "pl-3 pr-8")}
                  >
                    <option value="all">{language === "ar" ? "🗺️ جميع السجلات" : "🗺️ All Entries"}</option>
                    <option value="gps_only">{language === "ar" ? "📍 السجلات ذات موقع جغرافي مؤكد" : "📍 Geolocation Captured Only"}</option>
                  </select>
                  <div className={cn("pointer-events-none absolute inset-y-0 flex items-center px-4 text-slate-400", isRtl ? "left-0" : "right-0")}>
                    <MapPin size={12} />
                  </div>
                </div>
              </div>
            </div>

            {/* Logs List Container */}
            {isLoadingLogs ? (
              <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-[2.5rem] space-y-4">
                <RefreshCw size={24} className="text-indigo-600 animate-spin" />
                <p className="text-xs text-slate-500 font-bold">{language === "ar" ? "جاري مزامنة وتأكيد سجلات الحضور والانصراف الجغرافية..." : "Synchronizing GPS clock logs..."}</p>
              </div>
            ) : filteredClockLogs.length === 0 ? (
              <div className="p-12 text-center bg-white border border-slate-200 rounded-[2.5rem] space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400 border border-slate-100">
                  <Compass size={22} />
                </div>
                <h4 className="text-sm font-bold text-slate-800">{language === "ar" ? "لم يتم العثور على أي سجلات مطابقة" : "No clock logs found"}</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">
                  {language === "ar" ? "لا توجد سجلات حضور أو انصراف تطابق فلاتر البحث الحالية. يرجى تعديل خيارات التصفية للمحاولة مجدداً." : "We couldn't find any clock records matching your filters. Make sure users have clocked in/out from the Staff Clock module."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="clock-logs-grid">
                <AnimatePresence mode="popLayout">
                  {filteredClockLogs.map((log) => {
                    const hasGPS = log.latitude !== null && log.latitude !== undefined;
                    return (
                      <motion.div
                        key={log.id}
                        layout
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className={cn("bg-white border border-slate-200 p-6 rounded-[2.5rem] flex flex-col justify-between hover:shadow-md transition-all h-full relative group overflow-hidden", isRtl ? "border-r-4 text-right" : "border-l-4 text-left")}
                        style={isRtl ? { borderRightColor: log.type === "clock_in" ? "#10b981" : "#f59e0b" } : { borderLeftColor: log.type === "clock_in" ? "#10b981" : "#f59e0b" }}
                      >
                        <div className="space-y-4">
                          {/* Log Header */}
                          <div className={cn("flex items-start justify-between gap-2", isRtl && "flex-row-reverse")}>
                            <div className={cn("flex items-center gap-3", isRtl && "flex-row-reverse")}>
                              <div className={cn(
                                "w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-sm shadow-sm",
                                log.type === "clock_in" ? "bg-emerald-500" : "bg-amber-500"
                              )}>
                                {log.user_name ? log.user_name.charAt(0) : "U"}
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-900 text-sm leading-tight">{tData(log.user_name) || (language === "ar" ? "حارس غير معروف" : "Unknown Staff")}</h4>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mt-0.5">{tData(log.department) || (language === "ar" ? "خدمات الزوار والجمهور" : "Visitor Services")}</p>
                              </div>
                            </div>

                            <span className={cn(
                              "px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg border",
                              log.type === "clock_in" 
                                ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                                : "bg-amber-50 border-amber-100 text-amber-700"
                            )}>
                              {log.type === "clock_in" ? (language === "ar" ? "🟢 تسجيل حضور" : "🟢 CLOCK IN") : (language === "ar" ? "🔴 تسجيل انصراف" : "🔴 CLOCK OUT")}
                            </span>
                          </div>

                          {/* Time & Comments */}
                          <div className="space-y-1 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                            <div className={cn("flex items-center gap-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider", isRtl && "flex-row-reverse")}>
                              <Clock size={12} className="text-slate-400" />
                              {language === "ar" ? "توقيت التسجيل الميداني:" : "Timestamp:"}
                            </div>
                            <p className="text-xs font-black text-slate-800">{formatLogTime(log.timestamp)}</p>
                            
                            {log.notes && (
                              <div className="mt-2 pt-2 border-t border-slate-200/50">
                                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">{language === "ar" ? "التعليق المرفق والملاحظات:" : "Comments:"}</p>
                                <p className="text-xs text-slate-600 font-medium italic mb-1">"{log.notes}"</p>
                              </div>
                            )}
                          </div>

                          {/* Geolocation Tag */}
                          <div className={cn(
                            "p-4 rounded-2xl border transition-all h-full flex flex-col justify-between",
                            hasGPS 
                              ? "bg-indigo-50/30 border-indigo-100/60" 
                              : "bg-slate-50/50 border-slate-200/40"
                          )}>
                            <div className={cn("flex items-start justify-between", isRtl && "flex-row-reverse")}>
                              <div className={cn("flex items-center gap-1.5", isRtl && "flex-row-reverse")}>
                                <MapPin size={14} className={cn(hasGPS ? "text-indigo-600" : "text-slate-400")} />
                                <span className={cn(
                                  "text-[10px] font-black uppercase tracking-widest",
                                  hasGPS ? "text-indigo-800" : "text-slate-500"
                                )}>
                                  {hasGPS ? (language === "ar" ? "موقع جغرافي مؤكد" : "Verified Geolocation") : (language === "ar" ? "موقع غير معرّف" : "No GPS Coordinate Block")}
                                </span>
                              </div>
                              {hasGPS && log.accuracy && (
                                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100/40 px-1.5 py-0.5 rounded-md">
                                  ±{Math.round(log.accuracy)}m
                                </span>
                              )}
                            </div>

                            {hasGPS ? (
                              <div className="mt-3 space-y-3">
                                <div className={cn("grid grid-cols-2 gap-2 text-xs font-mono font-bold text-slate-700 bg-white p-2.5 rounded-xl border border-indigo-100", isRtl && "text-right")}>
                                  <div>
                                    <span className="text-[9px] text-slate-400 block font-sans font-extrabold uppercase tracking-widest mb-0.5">{language === "ar" ? "خط العرض" : "Latitude"}</span>
                                    {log.latitude?.toFixed(6)}°
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-slate-400 block font-sans font-extrabold uppercase tracking-widest mb-0.5">{language === "ar" ? "خط الطول" : "Longitude"}</span>
                                    {log.longitude?.toFixed(6)}°
                                  </div>
                                </div>

                                <motion.a
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm transition-all text-center cursor-pointer"
                                >
                                  <ExternalLink size={12} />
                                  {language === "ar" ? "عرض على خرائط جوجل" : "Open on Google Maps"}
                                </motion.a>
                              </div>
                            ) : (
                              <p className="mt-2 text-[11px] text-slate-400 font-medium">
                                {language === "ar" ? "لم ترصد إحداثيات GPS بسبب صلاحيات المتصفح أو تعطيل تحديد الموقع أثناء تسجيل الحضور." : "Coordinates were not flagged. GPS permissions were either disabled by browser sandbox or refused during action."}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "map_geofence" && (
          <motion.div
            key="map-geofence-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            {/* Top Stat Banner Alerts */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-8">
                {activeViolations.length > 0 ? (
                  <div className={cn("bg-rose-50 border border-rose-200 rounded-3xl p-5 flex items-start sm:items-center gap-4 text-rose-800 shadow-sm animate-pulse", isRtl && "flex-row-reverse text-right")}>
                    <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-md shadow-rose-500/20">
                      <ShieldAlert size={22} className="animate-bounce" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider text-rose-900">{language === "ar" ? "تنبيه تجاوز السياج الجغرافي الميداني!" : "Perimeter Breach Warning!"}</h4>
                      <p className="text-xs font-semibold text-rose-700/90 mt-0.5">
                        {language === "ar" 
                          ? `هناك ${activeViolations.length} من الحراس مسجلين بالخارج عن القطر المسموح به ${geofenceRadius} متر. تفقد إحداثياتهم التفصيلية بالخريطة أدناه.` 
                          : `${activeViolations.length} active staff member${activeViolations.length > 1 ? "s are" : " is"} clocked-in outside the ${geofenceRadius}m geofence radius. Review exact coordinates on the tracker below.`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className={cn("bg-emerald-50 border border-emerald-100 rounded-3xl p-5 flex items-start sm:items-center gap-4 text-emerald-800 shadow-sm", isRtl && "flex-row-reverse text-right")}>
                    <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-md shadow-emerald-500/10">
                      <Compass size={22} className="animate-spin" style={{ animationDuration: '12s' }} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider text-emerald-950">{language === "ar" ? "حالة النطاق الجغرافي: آمنة ومحمية" : "Geofence Status: SECURED"}</h4>
                      <p className="text-xs font-semibold text-emerald-700/90 mt-0.5">
                        {language === "ar" ? "تم التحقق من مطابقة جميع الحراس المناوبين للحدود ونطاقات المواقع المحددة بدقة." : "All active on-duty staff are verified inside boundary definitions. Perimeter integrity optimized."}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Mini Ticker */}
              <div className="grid grid-cols-2 gap-4 md:col-span-4">
                <div className={cn("bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-center", isRtl && "text-right")}>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">{language === "ar" ? "عدد المجموعات المراقَبة" : "Bound Tracked"}</span>
                  <p className="text-xl font-black text-slate-800 mt-1">{projectedPositions.length}</p>
                </div>
                <div className={cn("bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-center", isRtl && "text-right")}>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">{language === "ar" ? "الحراس الآمنون بالداخل" : "Safe Inside"}</span>
                  <p className="text-xl font-black text-emerald-600 mt-1">
                    {projectedPositions.filter(p => p.isOnline && !p.isViolating).length}
                  </p>
                </div>
              </div>
            </div>

            {/* Split Map View Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Side: Dynamic Interactive Cartographic Vector Grid */}
              <div className="lg:col-span-8 space-y-4">
                <div className="bg-slate-950 border border-slate-900 rounded-[2.5rem] p-4 flex flex-col relative overflow-hidden shadow-xl min-h-[450px] sm:min-h-[500px]">
                  {/* Grid Graphic Background Overlay */}
                  <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none" />

                  {/* Top Map HUD Controls bar */}
                  <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-3 z-10 bg-slate-900/80 backdrop-blur-md p-3.5 rounded-3xl border border-slate-800/60 mb-3", isRtl && "flex-row-reverse")}>
                    <div className={cn("flex items-center gap-2", isRtl && "flex-row-reverse text-right")}>
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                      <div>
                        <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">{language === "ar" ? "مركز ارتكاز السياج الحالي" : "Boundary Center Focus"}</p>
                        <p className="text-xs font-black text-slate-200 truncate max-w-[200px]">{mapCenterLabel}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      {/* Interactive Switch Button - Default vs Google Earth tab */}
                      <button
                        onClick={() => setMapMode(mapMode === 'earth' ? 'radar' : 'earth')}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer border shadow-sm",
                          mapMode === 'earth'
                            ? "bg-indigo-600 border-indigo-500 hover:bg-indigo-500 text-white"
                            : "bg-slate-800 border-slate-700 text-indigo-200 hover:text-white"
                        )}
                        title={mapMode === 'earth' ? (language === "ar" ? "التبديل إلى الرادار التخطيطي" : "Switch to Schematic Radar Representation") : (language === "ar" ? "التبديل لقمر جوجل إيرث" : "Switch to Google Earth Map Layer")}
                      >
                        {mapMode === 'earth' ? (
                          <>
                            <Globe size={12} className="animate-spin text-indigo-100" style={{ animationDuration: '10s' }} />
                            <span>{language === "ar" ? "خريطة قمر صناعي" : "Satellite Map Active"}</span>
                          </>
                        ) : (
                          <>
                            <Compass size={12} className="animate-pulse text-indigo-200" />
                            <span>{language === "ar" ? "الرادار التخطيطي" : "Schematic Radar"}</span>
                          </>
                        )}
                      </button>

                      <div className="w-px h-4 bg-slate-800 mx-0.5" />

                      <button
                        onClick={() => setMapZoom(prev => Math.min(prev + 0.25, 4.0))}
                        title={language === "ar" ? "تقريب الخريطة" : "Zoom In Map Vector Boundary"}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-all border border-slate-700 cursor-pointer"
                      >
                        <ZoomIn size={14} />
                      </button>
                      <button
                        onClick={() => setMapZoom(prev => Math.max(prev - 0.25, 0.5))}
                        title={language === "ar" ? "إبعاد الخريطة" : "Zoom Out Map Vector Boundary"}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-all border border-slate-700 cursor-pointer"
                      >
                        <ZoomOut size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setMapZoom(1.0);
                          setGeofenceCenter({ lat: 51.1789, lng: -1.8262 });
                          setMapCenterLabel("Stonehenge (Wiltshire, UK)");
                        }}
                        title={language === "ar" ? "إعادة تعيين خريطة الموقع" : "Calibrate Zoom and Center Location"}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-all border border-slate-700 cursor-pointer"
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>

                  {/* SVG RADAR WORKSPACE PORT */}
                  <div className="flex-1 w-full bg-slate-950/40 rounded-3xl relative border border-slate-900/40 cursor-crosshair overflow-hidden flex items-center justify-center min-h-[340px]">
                    {mapMode === 'earth' && (
                      (() => {
                        const iframeZoom = Math.min(21, Math.max(12, Math.round(17 + Math.log2(mapZoom))));
                        return (
                          <iframe
                            src={`https://maps.google.com/maps?q=${geofenceCenter.lat},${geofenceCenter.lng}&t=k&z=${iframeZoom}&output=embed`}
                            className="absolute inset-0 w-full h-full rounded-2xl border-0"
                            allowFullScreen
                            loading="lazy"
                            title="Stonehenge Google Earth"
                          />
                        );
                      })()
                    )}

                    <svg
                      width="100%"
                      height="100%"
                      viewBox="0 0 500 500"
                      id="tactical-geofence-radar"
                      onClick={(e) => {
                        // Converts viewport clicks back to GPS coordinates
                        const svg = e.currentTarget;
                        const rect = svg.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const clickY = e.clientY - rect.top;
                        
                        const pctX = (clickX / rect.width) * 100;
                        const pctY = (clickY / rect.height) * 100;
                        
                        // Scale based on maximum meters extent calculated dynamically
                        const offsets = projectedPositions.map(p => Math.max(Math.abs(p.dx), Math.abs(p.dy)));
                        const maxOffset = offsets.length > 0 ? Math.max(...offsets) : 0;
                        const extent = Math.max(geofenceRadius * 1.3, maxOffset * 1.1, 100) / mapZoom;

                        const dx = ((pctX - 50) / 50) * extent;
                        const dy = ((50 - pctY) / 50) * extent;
                        
                        const R = 6371000;
                        const centerLatRad = (geofenceCenter.lat * Math.PI) / 180;
                        const newLng = geofenceCenter.lng + dx / (R * (Math.PI / 180) * Math.cos(centerLatRad));
                        const newLat = geofenceCenter.lat + dy / (R * (Math.PI / 180));
                        
                        if (boundaryType === "polygon") {
                          const updated = [...polygonPoints, { lat: newLat, lng: newLng }];
                          setPolygonPoints(updated);
                        } else {
                          setGeofenceCenter({ lat: newLat, lng: newLng });
                          setMapCenterLabel("Manual Selected Coordinate");
                        }
                      }}
                      className="absolute inset-0 select-none z-10 pointer-events-auto"
                    >
                      {/* Invisible background click catcher so we can click anywhere on the visual Map */}
                      <rect width="100%" height="100%" fill="transparent" className="pointer-events-auto cursor-crosshair" />

                      {/* Dynamic concentric grid radar scale boundaries */}
                      {(() => {
                        const offsets = projectedPositions.map(p => Math.max(Math.abs(p.dx), Math.abs(p.dy)));
                        const maxOffset = offsets.length > 0 ? Math.max(...offsets) : 0;
                        const extent = Math.max(geofenceRadius * 1.3, maxOffset * 1.1, 100) / mapZoom;

                        // concentric guide circle ranges (meters)
                        const ranges = [extent * 0.25, extent * 0.5, extent * 0.75, extent * 1.0];
                        
                        return (
                          <g id="concentric-grids" className="pointer-events-none">
                            {/* Grid Lines Crosshairs */}
                            <line x1="250" y1="20" x2="250" y2="480" stroke={mapMode === 'earth' ? "#34d399" : "#334155"} strokeWidth="1" strokeDasharray="4 6" opacity={mapMode === 'earth' ? "0.4" : "0.3"} />
                            <line x1="20" y1="250" x2="480" y2="250" stroke={mapMode === 'earth' ? "#34d399" : "#334155"} strokeWidth="1" strokeDasharray="4 6" opacity={mapMode === 'earth' ? "0.4" : "0.3"} />

                            {/* Concentric Circle Guides */}
                            {ranges.map((dist, idx) => {
                              const r_px = (dist / extent) * 250;
                              return (
                                <g key={idx}>
                                  <circle cx="250" cy="250" r={r_px} fill="none" stroke={mapMode === 'earth' ? "#10b981" : "#334155"} strokeWidth="1.2" strokeDasharray="3 4" opacity={mapMode === 'earth' ? "0.45" : "0.25"} />
                                  <text x="255" y={250 - r_px + 12} fill={mapMode === 'earth' ? "#34d399" : "#64748b"} className="text-[9px] font-mono font-bold font-semibold opacity-85">
                                    {Math.round(dist)}m
                                  </text>
                                </g>
                              );
                            })}

                            {/* ACTIVE GEOFENCE DIAMETER CIRCLE RING */}
                            {boundaryType === "circle" && (() => {
                              const rad_px = (geofenceRadius / extent) * 250;
                              const alertTriggered = activeViolations.length > 0;
                              return (
                                <g>
                                  <circle
                                    cx="250"
                                    cy="250"
                                    r={rad_px}
                                    fill="none"
                                    stroke={alertTriggered ? "#f43f5e" : (mapMode === 'earth' ? "#818cf8" : "#6366f1")}
                                    strokeWidth={alertTriggered ? "2.5" : "1.8"}
                                    strokeDasharray={alertTriggered ? "6 4" : "4 4"}
                                    className={cn("transition-all duration-300", alertTriggered && "animate-pulse")}
                                    opacity="0.8"
                                  />
                                  <circle
                                    cx="250"
                                    cy="250"
                                    r={rad_px}
                                    fill={alertTriggered ? "#f43f5e" : (mapMode === 'earth' ? "#818cf8" : "#6366f1")}
                                    fillOpacity={alertTriggered ? "0.03" : "0.01"}
                                    className="transition-all duration-300"
                                  />
                                  {/* Perimeter Alert Text Badge */}
                                  <text
                                    x="250"
                                    y={250 + rad_px - 8}
                                    textAnchor="middle"
                                    fill={alertTriggered ? "#fda4af" : (mapMode === 'earth' ? "#a5b4fc" : "#818cf8")}
                                    className="text-[9px] font-black uppercase tracking-wider pointer-events-none"
                                    opacity="0.9"
                                  >
                                    {alertTriggered ? (language === "ar" ? "⚠️ تنبيه: تم رصد تجاوز للنطاق" : "⚠️ Perimeter Breach Boundary") : (language === "ar" ? "🛡️ محيط السياج الجغرافي المعيّن" : "🛡️ Configured Geofence Fence")}
                                  </text>
                                </g>
                              );
                            })()}

                            {/* ACTIVE HAND-DRAWN POLYGON SHAPE */}
                            {boundaryType === "polygon" && polygonPoints.length >= 2 && (() => {
                              const R = 6371000;
                              const centerLatRad = (geofenceCenter.lat * Math.PI) / 180;
                              const pointsString = polygonPoints.map(p => {
                                const dx = R * (p.lng - geofenceCenter.lng) * (Math.PI / 180) * Math.cos(centerLatRad);
                                const dy = R * (p.lat - geofenceCenter.lat) * (Math.PI / 180);
                                const x_px = 250 + (dx / extent) * 250;
                                const y_px = 250 - (dy / extent) * 250;
                                return `${x_px},${y_px}`;
                              }).join(" ");
                              const alertTriggered = activeViolations.length > 0;
                              return (
                                <g>
                                  <polygon
                                    points={pointsString}
                                    fill={alertTriggered ? "rgba(244, 63, 94, 0.05)" : "rgba(99, 102, 241, 0.05)"}
                                    stroke={alertTriggered ? "#f43f5e" : (mapMode === 'earth' ? "#818cf8" : "#6366f1")}
                                    strokeWidth="2.5"
                                    strokeDasharray="5 3"
                                    className={cn("transition-all duration-300", alertTriggered && "animate-pulse")}
                                  />
                                </g>
                              );
                            })()}

                            {/* POLYGON INTERACTIVE NODE HANDLES */}
                            {boundaryType === "polygon" && polygonPoints.map((p, idx) => {
                              const R = 6371000;
                              const centerLatRad = (geofenceCenter.lat * Math.PI) / 180;
                              const dx = R * (p.lng - geofenceCenter.lng) * (Math.PI / 180) * Math.cos(centerLatRad);
                              const dy = R * (p.lat - geofenceCenter.lat) * (Math.PI / 180);
                              const x_px = 250 + (dx / extent) * 250;
                              const y_px = 250 - (dy / extent) * 250;
                              return (
                                <g
                                  key={`poly-node-${idx}`}
                                  transform={`translate(${x_px}, ${y_px})`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updated = polygonPoints.filter((_, i) => i !== idx);
                                    setPolygonPoints(updated);
                                  }}
                                  className="cursor-pointer group pointer-events-auto"
                                >
                                  <circle r="8" fill="rgba(99, 102, 241, 0.2)" className="animate-ping" style={{ animationDuration: '3s' }} />
                                  <circle r="5" fill="#6366f1" stroke="#ffffff" strokeWidth="1.5" className="group-hover:fill-red-500 duration-150 transition-colors" />
                                  {/* Point index marker badge */}
                                  <text y="3" textAnchor="middle" fill="white" className="text-[7px] font-black pointer-events-none">
                                    {idx + 1}
                                  </text>
                                  <title>
                                    {language === "ar" ? `نقطة السياج ${idx + 1} - اضغط لحذفها` : `Fence Vertex node ${idx + 1} - Click to delete`}
                                  </title>
                                </g>
                              );
                            })}

                            {/* CENTER BASE NODE PINS */}
                            <g transform="translate(250, 250)" className="pointer-events-auto cursor-default">
                              <circle r="18" fill="#6366f1" fillOpacity="0.12" className="animate-ping" style={{ animationDuration: '4s' }} />
                              <circle r="10" fill="#4f46e5" stroke="#ffffff" strokeWidth="2" className="shadow-lg" />
                              <path d="M-4,3 L-4,-4 L-2,-4 L-2,-2 L0,-2 L0,-4 L2,-4 L2,-2 L4,-2 L4,3 Z" fill="white" />
                            </g>
                          </g>
                        );
                      })()}

                      {/* STAFF COORDINATE pins plottings */}
                      {(() => {
                        const offsets = projectedPositions.map(p => Math.max(Math.abs(p.dx), Math.abs(p.dy)));
                        const maxOffset = offsets.length > 0 ? Math.max(...offsets) : 0;
                        const extent = Math.max(geofenceRadius * 1.3, maxOffset * 1.1, 100) / mapZoom;

                        return (
                          <g id="staff-plotted-markers">
                            {projectedPositions.map((pos) => {
                              const x_px = 250 + (pos.dx / extent) * 250;
                              const y_px = 250 - (pos.dy / extent) * 250;
                              
                              const isViolatorRed = pos.isOnline && pos.isViolating;
                              const isOfflineGray = !pos.isOnline;
                              
                              const isSelected = selectedLogOnMap?.id === pos.id;

                              return (
                                <g
                                  key={pos.id}
                                  transform={`translate(${x_px}, ${y_px})`}
                                  onClick={(e) => {
                                    e.stopPropagation(); // Stop re-centering
                                    setSelectedLogOnMap(pos);
                                  }}
                                  className="cursor-pointer group pointer-events-auto"
                                >
                                  {/* Selection boundary highlight */}
                                  {isSelected && (
                                    <circle r="22" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3 2" className="animate-spin" style={{ animationDuration: '10s' }} />
                                  )}

                                  {/* Ring Radar Halo */}
                                  {isViolatorRed ? (
                                    <>
                                      <circle r="18" fill="none" stroke="#f43f5e" strokeWidth="1" className="animate-ping" style={{ animationDuration: '2s' }} />
                                      <circle r="13" fill="#f43f5e" fillOpacity="0.15" />
                                      <circle r="10" fill="#e11d48" stroke="#ffffff" strokeWidth="2" className="shadow-md" />
                                    </>
                                  ) : isOfflineGray ? (
                                    <>
                                      <circle r="10" fill="#94a3b8" stroke="#ffffff" strokeWidth="2" className="shadow-sm" />
                                    </>
                                  ) : (
                                    <>
                                      <circle r="14" fill="none" stroke="#10b981" strokeWidth="1.2" className="animate-pulse" />
                                      <circle r="10" fill="#10b981" stroke="#ffffff" strokeWidth="2" className="shadow-md" />
                                    </>
                                  )}

                                  {/* Initial Label inside Pin */}
                                  <text y="3.5" textAnchor="middle" fill="white" className="text-[10px] font-black tracking-tighter">
                                    {pos.user_name ? pos.user_name.charAt(0) : "W"}
                                  </text>

                                  {/* Standard hovering tooltips on SVG */}
                                  <title>
                                    {pos.user_name} ({pos.department})\n
                                    Status: {pos.isOnline ? "Duty ON" : "Duty OFF"}\n
                                    Action: {pos.type === "clock_in" ? "Clock In" : "Clock Out"}\n
                                    Distance: {Math.round(pos.distance)}m from Site Geocenter\n
                                    Perimeter: {pos.isViolating && pos.isOnline ? "🚨 BREACH OUT OF RANGE" : "🟢 Inside Limits"}
                                  </title>
                                </g>
                              );
                            })}
                          </g>
                        );
                      })()}
                    </svg>

                    {/* Draggable/Manual coordinate setting helper banner */}
                    <p className={cn("absolute bottom-3 text-[9.5px] uppercase font-black text-slate-100 tracking-wider bg-slate-950/90 backdrop-blur-md py-1.5 px-3 rounded-full border border-slate-850 pointer-events-none z-20 shadow-lg", isRtl ? "right-4" : "left-4")}>
                      {boundaryType === "polygon" ? (
                        language === "ar"
                          ? "💡 وضع الرسم المضلع: انقر مباشرة على الخريطة لإضافة نقاط للحدود، وانقر على العلامة لإزالتها."
                          : "💡 Custom Polygon Mode: Click directly on Map to add fence corners. Click a node index to delete."
                      ) : (
                        language === "ar" 
                          ? "💡 انقر مباشرة على الخريطة لتغيير إحداثيات مركز الرصد الدائري." 
                          : "💡 Circle Mode: Click directly on Map to center the geofence radius on that spot."
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Side: Geofencing Control Center panel */}
              <div className="lg:col-span-4 space-y-6">
                {/* Geofence Threshold Slider config */}
                <div className="bg-white border border-slate-200 p-6 rounded-[2.5rem] shadow-xs space-y-4">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={16} className="text-indigo-600" />
                      {t("configure_barrier")}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Configure circular or hand-drawn custom polygonal barriers.
                    </p>
                  </div>

                  {/* Boundary Barrier Type Selector */}
                  <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                    <button
                      onClick={() => setBoundaryType("circle")}
                      className={cn(
                        "py-1.5 text-center text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer",
                        boundaryType === "circle"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      ⭕ {language === "ar" ? "نطاق دائري" : "Circular Radius"}
                    </button>
                    <button
                      onClick={() => setBoundaryType("polygon")}
                      className={cn(
                        "py-1.5 text-center text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer",
                        boundaryType === "polygon"
                          ? "bg-white text-indigo-600 shadow-sm"
                          : "text-slate-500 hover:text-indigo-600"
                      )}
                    >
                      ⬡ {language === "ar" ? "رسم مضلع يدوي" : "Drawn Polygon"}
                    </button>
                  </div>

                  {/* Radius slider value */}
                  {boundaryType === "circle" && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span>Perimeter Radius:</span>
                        <span className="text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100/40">
                          {geofenceRadius} meters
                        </span>
                      </div>

                      <input
                        type="range"
                        min="20"
                        max="1500"
                        step="10"
                        value={geofenceRadius}
                        onChange={(e) => setGeofenceRadius(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
                      />

                      <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <span>20m (Tight)</span>
                        <span>1500m (General)</span>
                      </div>
                    </div>
                  )}

                  {/* Manual polygon drawn settings controls */}
                  {boundaryType === "polygon" && (
                    <div className="space-y-3 bg-indigo-50/50 p-4 rounded-[1.8rem] border border-indigo-100/50">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span>{language === "ar" ? "النقاط المرسومة:" : "Corner Vertices:"}</span>
                        <span className="text-xs font-black text-indigo-600 bg-indigo-100/50 py-0.5 px-2.5 rounded-full border border-indigo-200/40">
                          {polygonPoints.length} vertices
                        </span>
                      </div>
                      
                      {polygonPoints.length < 3 ? (
                        <p className="text-[10px] text-amber-600 font-bold bg-amber-50 p-2.5 rounded-xl border border-amber-200/40 flex items-start gap-1.5">
                          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                          <span>
                            {language === "ar" 
                              ? "⚠️ ارسم 3 نقاط على الأقل على الخريطة لتشكيل الحدود." 
                              : "⚠️ Click at least 3 corner points on the map grid to enclose a functional polygon fence."}
                          </span>
                        </p>
                      ) : (
                        <p className="text-[10px] text-emerald-600 font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200/40 flex items-start gap-1.5">
                          <Sparkles size={12} className="shrink-0 text-emerald-500 mt-0.5" />
                          <span>
                            {language === "ar" 
                              ? "🟢 السياج المضلع نشط ومطبق بالكامل الآن ومراقب للأعطال!" 
                              : "🟢 Custom polygon fence is fully functional & verifying duty breaches!"}
                          </span>
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setPolygonPoints([]);
                          }}
                          className="py-2 px-2 bg-white hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-200 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          🗑️ {language === "ar" ? "تفريغ النقاط" : "Clear Fence"}
                        </button>
                        <button
                          onClick={() => {
                            if (polygonPoints.length === 0) return;
                            // Centroid Shift
                            let sumLat = 0;
                            let sumLng = 0;
                            polygonPoints.forEach(p => {
                              sumLat += p.lat;
                              sumLng += p.lng;
                            });
                            const cLat = sumLat / polygonPoints.length;
                            const cLng = sumLng / polygonPoints.length;
                            const dLat = geofenceCenter.lat - cLat;
                            const dLng = geofenceCenter.lng - cLng;
                            
                            setPolygonPoints(polygonPoints.map(p => ({
                              lat: p.lat + dLat,
                              lng: p.lng + dLng
                            })));
                          }}
                          disabled={polygonPoints.length === 0}
                          className="py-2 px-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-150 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                          title="Snap drawn boundaries to match with active base map target coordinate center"
                        >
                          🔄 {language === "ar" ? "محاذاة للمركز" : "Snap to Pivot"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Preset Geolocations selection */}
                  <div className="border-t border-slate-100 pt-4 space-y-2">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-1">
                      Target Center Preset Points
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setGeofenceCenter({ lat: 51.1789, lng: -1.8262 });
                          setMapCenterLabel("Stonehenge (Wiltshire, UK)");
                        }}
                        className={cn(
                          "py-2 px-2 text-left rounded-xl transition-all border text-[10px] font-bold truncate cursor-pointer",
                          geofenceCenter.lat === 51.1789 
                            ? "bg-slate-900 border-slate-900 text-white shadow-sm" 
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                        )}
                      >
                        🏰 Stonehenge
                      </button>
                      <button
                        onClick={() => {
                          setGeofenceCenter({ lat: 51.5081, lng: -0.0759 });
                          setMapCenterLabel("Tower of London (London, UK)");
                        }}
                        className={cn(
                          "py-2 px-2 text-left rounded-xl transition-all border text-[10px] font-bold truncate cursor-pointer",
                          geofenceCenter.lat === 51.5081 
                            ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                        )}
                      >
                        🏰 Tower of London
                      </button>
                      <button
                        onClick={() => {
                          setGeofenceCenter({ lat: 51.3811, lng: -2.3597 });
                          setMapCenterLabel("Roman Baths (Somerset, UK)");
                        }}
                        className={cn(
                          "py-2 px-2 text-left rounded-xl transition-all border text-[10px] font-bold truncate cursor-pointer",
                          geofenceCenter.lat === 51.3811 
                            ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                        )}
                      >
                        🏛️ Roman Baths
                      </button>
                      <button
                        onClick={handleGetCurrentLocation}
                        title="Acquire live coordinates on user browser sandbox"
                        className="py-2 px-2 text-left rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100/60 font-black text-[10px] truncate transition-all cursor-pointer"
                      >
                        📍 Use My Live GPS
                      </button>
                    </div>

                    {/* Coordinates input panels for direct custom adjustment */}
                    <div className="grid grid-cols-2 gap-2 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/50">
                      <div>
                        <span className="text-[8px] text-slate-400 block font-black uppercase tracking-widest">Latitude</span>
                        <input
                          type="number"
                          step="0.0001"
                          value={Number(geofenceCenter.lat).toFixed(5)}
                          onChange={(e) => {
                            setGeofenceCenter(prev => ({ ...prev, lat: Number(e.target.value) }));
                            setMapCenterLabel("Custom manual latitude settings");
                          }}
                          className="w-full bg-transparent border-0 p-0 text-xs font-mono font-black text-slate-700 focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 block font-black uppercase tracking-widest">Longitude</span>
                        <input
                          type="number"
                          step="0.0001"
                          value={Number(geofenceCenter.lng).toFixed(5)}
                          onChange={(e) => {
                            setGeofenceCenter(prev => ({ ...prev, lng: Number(e.target.value) }));
                            setMapCenterLabel("Custom manual longitude settings");
                          }}
                          className="w-full bg-transparent border-0 p-0 text-xs font-mono font-black text-slate-700 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seed Demo Coordinates Logs */}
                  <div className="border-t border-slate-100 pt-4">
                    <button
                      onClick={handleInjectDemoLogs}
                      disabled={isSimulatingCoords}
                      className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      {isSimulatingCoords ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Generating mock geo-data...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={13} className="text-amber-400 animate-pulse" />
                          <span>Seed Demo Boundary Logs</span>
                        </>
                      )}
                    </button>
                    <p className="text-[9.5px] text-center text-slate-400 mt-2 font-medium leading-relaxed">
                      Creates 4 dummy records centered at this selected monument to demonstrate alerts and active violations beautifully.
                    </p>
                  </div>
                </div>

                {/* Selected log inspector card */}
                <AnimatePresence mode="wait">
                  {selectedLogOnMap ? (
                    <motion.div
                      key="map-inspector"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={cn(
                        "p-5 rounded-[2rem] border transition-all space-y-3 relative overflow-hidden",
                        selectedLogOnMap.isViolating && selectedLogOnMap.isOnline
                          ? "bg-rose-50 border-rose-200 shadow-md shadow-rose-200/50" 
                          : "bg-white border-slate-200"
                      )}
                    >
                      <button 
                        onClick={() => setSelectedLogOnMap(null)}
                        className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <X size={14} />
                      </button>

                      <div>
                        <span className={cn(
                          "px-2 py-0.5 text-[8.5px] font-black uppercase tracking-widest rounded-md border",
                          selectedLogOnMap.isViolating && selectedLogOnMap.isOnline
                            ? "bg-rose-100 border-rose-200 text-rose-800" 
                            : "bg-emerald-50 border-emerald-100 text-emerald-800"
                        )}>
                          {selectedLogOnMap.isViolating && selectedLogOnMap.isOnline ? "🚨 BREACH OUT OF RANGE" : "🟢 COMPLIANCE OK"}
                        </span>
                        
                        <h4 className="text-sm font-black text-slate-800 mt-2">{selectedLogOnMap.user_name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedLogOnMap.department}</p>
                      </div>

                      <div className="space-y-1.5 bg-slate-50/55 p-3 rounded-xl text-xs font-semibold text-slate-600 border border-slate-100">
                        <div className="flex justify-between">
                          <span>{language === "ar" ? "حالة الموظف الميداني:" : "Staff Status:"}</span>
                          <span className={cn("font-black", selectedLogOnMap.isOnline ? "text-emerald-600 font-extrabold" : "text-slate-400")}>
                            {selectedLogOnMap.isOnline ? "DUTY ON (ONLINE)" : "DUTY OFF"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Computed Center offset:</span>
                          <span className="font-mono font-bold text-slate-700">{Math.round(selectedLogOnMap.distance)} meters</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Accuracy Tag:</span>
                          <span className="font-mono text-slate-500">±{Math.round(selectedLogOnMap.accuracy || 10)}m</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Latest log format:</span>
                          <span className="font-bold text-slate-700 text-[11px]">
                            {selectedLogOnMap.type === "clock_in" ? "🟢 Check-In" : "🔴 Check-Out"}
                          </span>
                        </div>
                        {selectedLogOnMap.notes && (
                          <div className="border-t border-slate-200/50 mt-1.5 pt-1.5">
                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Comment log:</p>
                            <p className="text-[11px] text-slate-600 italic font-medium mt-0.5">"{selectedLogOnMap.notes}"</p>
                          </div>
                        )}
                        <div className="border-t border-slate-200/50 mt-1.5 pt-1.5">
                          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Log Timestamp:</p>
                          <p className="text-[11px] text-slate-700 font-bold mt-0.5">{formatLogTime(selectedLogOnMap.timestamp)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 font-bold">
                        <a
                          href={`https://www.google.com/maps?q=${selectedLogOnMap.latitude},${selectedLogOnMap.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-extrabold text-center inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                        >
                          <ExternalLink size={10} />
                          <span>Google Maps</span>
                        </a>
                        <button
                          onClick={() => {
                            setGeofenceCenter({ lat: selectedLogOnMap.latitude, lng: selectedLogOnMap.longitude });
                            setMapCenterLabel(`Recentered: ${selectedLogOnMap.user_name}`);
                          }}
                          className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-[10px] font-extrabold text-center cursor-pointer transition-colors"
                        >
                          🏰 Snap geofence
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 p-5 rounded-[2.5rem] flex flex-col items-center justify-center text-center py-8">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-slate-200 shadow-xs mb-3 text-slate-400">
                        <MapPin size={18} />
                      </div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Select a Map Pin</h4>
                      <p className="text-[11px] text-slate-400 max-w-[200px] mt-1 font-medium leading-relaxed">
                        Click any plotted node coordinates on the tactical radar to inspect detailed coordinates accuracy and deployment status tags.
                      </p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Quick overview roster with distance indexes for easy reading */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-6 space-y-4">
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">{language === "ar" ? "كشف تتبع الحضور والمغادرة الميداني" : "Live Perimeter Roll-Call"}</h4>
                <p className="text-xs text-slate-500 font-medium">{language === "ar" ? "التحقق من تداخل مواقع الموظفين المناوبين مع السياج الجغرافي." : "Verify actual on-duty offsets and compliance of all staff."}</p>
              </div>

              {projectedPositions.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                  No GPS logs generated yet. Use the clocking module to check-in, or seed demo mock data logs above!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projectedPositions.map((pos) => {
                    const isViolator = pos.isOnline && pos.isViolating;
                    return (
                      <div
                        key={pos.id}
                        onClick={() => {
                          setSelectedLogOnMap(pos);
                          // Scroll to visual map container
                          document.getElementById('tactical-geofence-radar')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className={cn(
                          "p-4 rounded-2xl border transition-all flex items-center justify-between cursor-pointer text-left hover:scale-[1.01]",
                          isViolator 
                            ? "bg-rose-50/50 border-rose-200/70 hover:border-rose-300" 
                            : pos.isOnline 
                              ? "bg-emerald-50/20 border-emerald-100 hover:border-emerald-300" 
                              : "bg-slate-50/50 border-slate-200/50 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs text-white",
                            isViolator ? "bg-rose-500" : pos.isOnline ? "bg-emerald-500" : "bg-slate-400"
                          )}>
                            {pos.user_name.charAt(0)}
                          </div>
                          <div>
                            <h5 className="text-xs font-black text-slate-800 leading-tight">{pos.user_name}</h5>
                            <span className="text-[9px] text-slate-400 uppercase tracking-wider font-extrabold">{pos.department}</span>
                          </div>
                        </div>

                        <div className="text-right space-y-0.5">
                          <span className={cn(
                            "px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-md",
                            isViolator 
                              ? "bg-rose-100 text-rose-800" 
                              : pos.isOnline 
                                ? "bg-emerald-100 text-emerald-800" 
                                : "bg-slate-100 text-slate-500"
                          )}>
                            {isViolator ? "BREACHED" : pos.isOnline ? "INSIDE" : "OFF DUTY"}
                          </span>
                          <p className="text-[10px] font-mono font-bold text-slate-500">offset {Math.round(pos.distance)}m</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                {editingUser ? "Edit Staff Member" : "Add New Staff Member"}
              </h3>
              <motion.button 
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </motion.button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Full Name</label>
                <input 
                  required
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  placeholder="e.g., Jane Doe"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Designation (Role)</label>
                  <select 
                    value={newUser.role}
                    onChange={e => setNewUser({...newUser, role: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Department</label>
                  <select 
                    value={newUser.department}
                    onChange={e => setNewUser({...newUser, department: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white"
                  >
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="pt-4 flex gap-3">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
                >
                  {editingUser ? "Save Changes" : "Add Staff"}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
