import React, { useEffect, useState } from "react";
import { 
  Users, 
  Eye, 
  TrendingUp, 
  AlertCircle,
  Clock,
  CheckCircle2,
  BarChart3,
  Activity,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  UserCheck,
  Check,
  Briefcase,
  ShieldAlert,
  Map,
  Compass,
  Radio,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Navigation,
  MapPin,
  Filter,
  Info,
  X,
  Search,
  History,
  Download,
  Calendar,
  Globe
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LayoutItem } from '../context/LayoutContext';
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { collection, query, orderBy, limit, onSnapshot, getDocs, doc, setDoc, serverTimestamp, addDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { CustomizableGrid } from "./CustomizableGrid";
import { StaffClock } from "./StaffClock";
import { toast } from "sonner";

interface Stats {
  count: number;
  pod_count: number;
  capacity: number;
}

export function Dashboard() {
  const { t, language, tData } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [siteStatus, setSiteStatus] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [activeGateEmergency, setActiveGateEmergency] = useState<any>(null);
  const [dismissedEmergencyId, setDismissedEmergencyId] = useState<string | null>(null);
  const [briefingAcknowledged, setBriefingAcknowledged] = useState(false);
  const [briefingExpanded, setBriefingExpanded] = useState(true);
  const [clockLogs, setClockLogs] = useState<any[]>([]);
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [mapTabView, setMapTabView] = useState<'radar' | 'earth' | 'history'>('radar');
  const [radarBackdrop, setRadarBackdrop] = useState<'blueprint' | 'satellite'>('blueprint');
  const [mapZoom, setMapZoom] = useState(1.0);
  const [dashboardMapFilter, setDashboardMapFilter] = useState<'all' | 'staff' | 'incidents'>('all');
  const [selectedPin, setSelectedPin] = useState<any | null>(null);
  const [mapSearch, setMapSearch] = useState("");
  const [historyDeptFilter, setHistoryDeptFilter] = useState("all");
  const [historyBreachFilter, setHistoryBreachFilter] = useState("all");
  const [simSelectedUserId, setSimSelectedUserId] = useState("");
  const [simLocationType, setSimLocationType] = useState<"inside" | "west_breach" | "north_breach" | "south_breach">("inside");
  const [simCustomNotes, setSimCustomNotes] = useState("");
  const [telemetryTriggerLoading, setTelemetryTriggerLoading] = useState(false);
  const [isSimCardExpanded, setIsSimCardExpanded] = useState(false);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;

    // Listen for tasks
    const tasksPath = "tasks";
    const tasksQuery = query(collection(db, tasksPath), orderBy("created_at", "desc"));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, tasksPath);
    });

    // Listen for incidents
    const incidentsPath = "incidents";
    const incidentsQuery = query(collection(db, incidentsPath), orderBy("created_at", "desc"));
    const unsubscribeIncidents = onSnapshot(incidentsQuery, (snapshot) => {
      setIncidents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, incidentsPath);
    });

    // Listen for staff (users)
    const staffPath = "users";
    const staffQuery = collection(db, staffPath);
    const unsubscribeStaff = onSnapshot(staffQuery, (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, staffPath);
    });

    // Listen for site status
    const statusPath = "site_status";
    const statusQuery = collection(db, statusPath);
    const unsubscribeStatus = onSnapshot(statusQuery, (snapshot) => {
      setSiteStatus(snapshot.docs.map(doc => ({ key: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, statusPath);
    });

    // Listen for settings
    const settingsPath = "settings";
    const settingsQuery = collection(db, settingsPath);
    const unsubscribeSettings = onSnapshot(settingsQuery, (snapshot) => {
      setSettings(snapshot.docs.map(doc => ({ key: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, settingsPath);
    });

    // Listen for stats in real-time
    const statsPath = "stats";
    const unsubscribeStats = onSnapshot(doc(db, statsPath, "current"), (snapshot) => {
      if (snapshot.exists()) {
        setStats(snapshot.data() as Stats);
      } else if (currentUser) {
        // Initialize if doesn't exist and user is logged in
        setDoc(doc(db, statsPath, "current"), { 
          count: 0, 
          pod_count: 0,
          capacity: 500, 
          updated_at: serverTimestamp() 
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, statsPath);
    });

    // Listen for latest active gate emergency broadcast
    const gateNotificationsQuery = query(collection(db, "gate_notifications"), orderBy("timestamp", "desc"), limit(1));
    const unsubscribeGateNotifications = onSnapshot(gateNotificationsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        const id = snapshot.docs[0].id;
        if (docData.status === "active") {
          setActiveGateEmergency({ id, ...docData });
        } else {
          setActiveGateEmergency(null);
        }
      } else {
        setActiveGateEmergency(null);
      }
    }, (error) => {
      console.error("Gate notifications snapshot error:", error);
    });

    // Fetch forecast for today
    const fetchForecast = async () => {
      const forecastPath = "footfall_forecasts";
      const today = new Date().toISOString().split('T')[0];
      try {
        const forecastQuery = query(collection(db, forecastPath), limit(1)); // Simplified for now, ideally filter by date
        const forecastDoc = await getDocs(forecastQuery);
        if (!forecastDoc.empty) {
          setForecast(forecastDoc.docs[0].data());
        } else {
          setForecast({ forecasted_count: 150 }); // Default fallback
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, forecastPath);
      }
    };

    fetchForecast();

    // Listen for clock logs
    const clockLogsPath = "clock_logs";
    const clockLogsQuery = query(collection(db, clockLogsPath));
    const unsubscribeClockLogs = onSnapshot(clockLogsQuery, (snapshot) => {
      setClockLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, clockLogsPath);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeIncidents();
      unsubscribeStaff();
      unsubscribeStatus();
      unsubscribeSettings();
      unsubscribeStats();
      unsubscribeGateNotifications();
      unsubscribeClockLogs();
    };
  }, [currentUser]);

  const maxCapacity = parseInt(settings.find(s => s.key === 'max_capacity')?.value || "500");

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const pendingTasksCount = tasks.filter(t => t.status === "pending").length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;

  const podCapacity = 150;
  const podPercentage = Math.round(((stats?.pod_count || 0) / podCapacity) * 100);

  const totalIncidents = incidents.length;
  const activeIncidents = incidents.filter(i => i.status !== "resolved").length;
  const criticalIncidents = incidents.filter(i => i.status !== "resolved" && (i.severity === "High" || i.severity === "Critical" || i.severity === "critical")).length;
  const resolvedIncidents = incidents.filter(i => i.status === "resolved").length;

  const totalStaff = staff.length;
  const onlineStaff = staff.filter(s => s.status === "online").length;
  const staffOnlinePercentage = totalStaff > 0 ? Math.round((onlineStaff / totalStaff) * 100) : 0;

  // Geofencing and coordinate projection calculations for Dashboard Site Map
  const geofenceCenter = React.useMemo(() => {
    try {
      const saved = localStorage.getItem("geofence_center");
      return saved ? JSON.parse(saved) : { lat: 51.1789, lng: -1.8262 };
    } catch {
      return { lat: 51.1789, lng: -1.8262 };
    }
  }, []);

  const geofenceRadius = React.useMemo(() => {
    try {
      const saved = localStorage.getItem("geofence_radius");
      return saved ? Number(saved) : 150;
    } catch {
      return 150;
    }
  }, []);

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

  // Group clock logs by user to find their last known GPS position
  const lastKnownStaffPositions = React.useMemo(() => {
    const mapObj: Record<string, any> = {};
    // Sort clock logs chronologically (oldest first, so newer overwrites)
    const sortedLogs = [...clockLogs].sort((a, b) => {
      const aTime = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp).getTime();
      const bTime = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp).getTime();
      return aTime - bTime;
    });

    sortedLogs.forEach(log => {
      if (log.latitude !== null && log.latitude !== undefined && log.user_id) {
        mapObj[log.user_id] = log;
      }
    });
    return Object.values(mapObj);
  }, [clockLogs]);

  // Projected positions of active online staff on dashboard
  const projectedStaff = React.useMemo(() => {
    const R = 6371000;
    const centerLatRad = (geofenceCenter.lat * Math.PI) / 180;
    
    return lastKnownStaffPositions.map((pos: any) => {
      const lat = pos.latitude!;
      const lon = pos.longitude!;
      
      const dx = R * (lon - geofenceCenter.lng) * (Math.PI / 180) * Math.cos(centerLatRad);
      const dy = R * (lat - geofenceCenter.lat) * (Math.PI / 180);
      const distance = getHaversineDistance(lat, lon, geofenceCenter.lat, geofenceCenter.lng);
      
      const userProfile = staff.find(u => u.id === pos.user_id);
      const userStatus = userProfile?.status || "offline";
      const isOnline = userStatus === "online";
      
      return {
        ...pos,
        id: `staff_${pos.user_id}`,
        pinType: 'staff' as const,
        dx,
        dy,
        distance,
        isOnline,
        userRole: userProfile?.role || "user",
        department: userProfile?.department || pos.department || "Field Operations",
        name: userProfile?.name || pos.user_name || "Unknown Staff"
      };
    }).filter((p: any) => p.isOnline);
  }, [lastKnownStaffPositions, geofenceCenter, staff]);

  // Projected active incidents
  const projectedIncidents = React.useMemo(() => {
    const R = 6371000;
    const centerLatRad = (geofenceCenter.lat * Math.PI) / 180;
    
    return incidents
      .filter(inc => inc.latitude !== undefined && inc.latitude !== null && inc.status !== "resolved")
      .map(inc => {
        const lat = Number(inc.latitude);
        const lon = Number(inc.longitude);
        
        const dx = R * (lon - geofenceCenter.lng) * (Math.PI / 180) * Math.cos(centerLatRad);
        const dy = R * (lat - geofenceCenter.lat) * (Math.PI / 180);
        const distance = getHaversineDistance(lat, lon, geofenceCenter.lat, geofenceCenter.lng);
        
        return {
          ...inc,
          id: `incident_${inc.id}`,
          pinType: 'incident' as const,
          dx,
          dy,
          distance,
          name: inc.title || inc.type || "Active Incident"
        };
      });
  }, [incidents, geofenceCenter]);

  // Combined searchable pins list
  const combinedPins = React.useMemo(() => {
    const pins: any[] = [];
    if (dashboardMapFilter === 'all' || dashboardMapFilter === 'staff') {
      pins.push(...projectedStaff);
    }
    if (dashboardMapFilter === 'all' || dashboardMapFilter === 'incidents') {
      pins.push(...projectedIncidents);
    }
    
    if (!mapSearch) return pins;
    return pins.filter(p => 
      p.name.toLowerCase().includes(mapSearch.toLowerCase()) ||
      (p.department && p.department.toLowerCase().includes(mapSearch.toLowerCase())) ||
      (p.type && p.type.toLowerCase().includes(mapSearch.toLowerCase())) ||
      (p.location && p.location.toLowerCase().includes(mapSearch.toLowerCase()))
    );
  }, [projectedStaff, projectedIncidents, dashboardMapFilter, mapSearch]);

  // Shared extent and satellite backdrop calculations for the map canvas
  const mapExtent = React.useMemo(() => {
    const maxStaffOffset = projectedStaff.map(p => Math.max(Math.abs(p.dx), Math.abs(p.dy)));
    const maxIncOffset = projectedIncidents.map(p => Math.max(Math.abs(p.dx), Math.abs(p.dy)));
    const maxOffset = Math.max(...maxStaffOffset, ...maxIncOffset, 0);
    return Math.max(geofenceRadius * 1.3, maxOffset * 1.1, 100) / mapZoom;
  }, [projectedStaff, projectedIncidents, geofenceRadius, mapZoom]);

  const satelliteMapUrl = React.useMemo(() => {
    const R_earth = 6371000;
    const centerLatRad = (geofenceCenter.lat * Math.PI) / 180;
    const meters_per_deg_lat = R_earth * (Math.PI / 180);
    const meters_per_deg_lng = R_earth * (Math.PI / 180) * Math.cos(centerLatRad);
    const d_lat = mapExtent / meters_per_deg_lat;
    const d_lng = mapExtent / meters_per_deg_lng;

    const min_lat = geofenceCenter.lat - d_lat;
    const max_lat = geofenceCenter.lat + d_lat;
    const min_lng = geofenceCenter.lng - d_lng;
    const max_lng = geofenceCenter.lng + d_lng;

    const cleanMinLng = Math.max(-180, Math.min(180, min_lng));
    const cleanMaxLng = Math.max(-180, Math.min(180, max_lng));
    const cleanMinLat = Math.max(-85, Math.min(85, min_lat));
    const cleanMaxLat = Math.max(-85, Math.min(85, max_lat));

    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${cleanMinLng},${cleanMinLat},${cleanMaxLng},${cleanMaxLat}&bboxSR=4326&size=500,500&format=png24&f=image`;
  }, [geofenceCenter, mapExtent]);

  // Computation of location history list from clock logs
  const parsedHistoryLogs = React.useMemo(() => {
    return [...clockLogs]
      .sort((a: any, b: any) => {
        const aTime = a.timestamp?.seconds 
          ? a.timestamp.seconds * 1000 
          : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
        const bTime = b.timestamp?.seconds 
          ? b.timestamp.seconds * 1000 
          : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
        return bTime - aTime;
      })
      .map((log: any) => {
        let isBreach = false;
        let calculatedDistance = null;
        if (log.latitude !== undefined && log.latitude !== null && log.longitude !== undefined && log.longitude !== null) {
          calculatedDistance = getHaversineDistance(Number(log.latitude), Number(log.longitude), geofenceCenter.lat, geofenceCenter.lng);
          isBreach = calculatedDistance > geofenceRadius;
        }
        return {
          ...log,
          distance: calculatedDistance,
          isBreach
        };
      });
  }, [clockLogs, geofenceCenter, geofenceRadius]);

  const filteredHistoryLogs = React.useMemo(() => {
    let list = parsedHistoryLogs;
    
    if (historyStartDate) {
      const startMs = new Date(historyStartDate + "T00:00:00").getTime();
      list = list.filter((log: any) => {
        const logTime = log.timestamp?.seconds 
          ? log.timestamp.seconds * 1000 
          : (log.timestamp ? new Date(log.timestamp).getTime() : 0);
        return logTime >= startMs;
      });
    }

    if (historyEndDate) {
      const endMs = new Date(historyEndDate + "T23:59:59").getTime();
      list = list.filter((log: any) => {
        const logTime = log.timestamp?.seconds 
          ? log.timestamp.seconds * 1000 
          : (log.timestamp ? new Date(log.timestamp).getTime() : 0);
        return logTime <= endMs;
      });
    }

    if (historyDeptFilter && historyDeptFilter !== "all") {
      list = list.filter((log: any) => 
        log.department && log.department.toLowerCase() === historyDeptFilter.toLowerCase()
      );
    }

    if (historyBreachFilter && historyBreachFilter !== "all") {
      list = list.filter((log: any) => {
        if (historyBreachFilter === "breached") return log.isBreach === true;
        if (historyBreachFilter === "inside") return log.isBreach === false;
        return true;
      });
    }

    if (mapSearch) {
      const term = mapSearch.toLowerCase();
      list = list.filter((log: any) => 
        (log.user_name && log.user_name.toLowerCase().includes(term)) ||
        (log.type && log.type.toLowerCase().includes(term)) ||
        (log.department && log.department.toLowerCase().includes(term)) ||
        (log.notes && log.notes.toLowerCase().includes(term))
      );
    }
    return list;
  }, [parsedHistoryLogs, mapSearch, historyStartDate, historyEndDate, historyDeptFilter, historyBreachFilter]);

  const handleExportHistory = () => {
    if (filteredHistoryLogs.length === 0) {
      toast.error(language === "ar" ? "لا توجد سجلات لتصديرها" : "No records to export");
      return;
    }

    // CSV Headers
    const headers = [
      language === "ar" ? "الاسم" : "Name",
      language === "ar" ? "نوع العملية" : "Action Type",
      language === "ar" ? "القسم" : "Department",
      language === "ar" ? "التاريخ والوقت" : "Timestamp",
      language === "ar" ? "خط العرض" : "Latitude",
      language === "ar" ? "خط الطول" : "Longitude",
      language === "ar" ? "المسافة لمركز المعلم (متر)" : "Distance to Geocenter (m)",
      language === "ar" ? "تجاوز النطاق" : "Sectored Geofence Breach",
      language === "ar" ? "ملاحظات" : "Notes"
    ];

    // CSV Rows
    const rows = filteredHistoryLogs.map((log: any) => {
      const logDate = log.timestamp?.seconds 
        ? new Date(log.timestamp.seconds * 1000) 
        : (log.timestamp ? new Date(log.timestamp) : new Date());
      const formattedTimestamp = logDate.toISOString();
      const actionLabel = log.type === "clock_in"
        ? "Entrance Clock-In"
        : log.type === "clock_out"
          ? "Departure Clock-Out"
          : "Location Captured";

      return [
        `"${(log.user_name || "Unknown").replace(/"/g, '""')}"`,
        `"${actionLabel}"`,
        `"${(log.department || "Field Operations").replace(/"/g, '""')}"`,
        `"${formattedTimestamp}"`,
        log.latitude ?? "",
        log.longitude ?? "",
        log.distance !== null ? Math.round(log.distance) : "",
        log.isBreach ? "YES" : "NO",
        `"${(log.notes || "").replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    const startStr = historyStartDate ? `_from_${historyStartDate}` : "";
    const endStr = historyEndDate ? `_to_${historyEndDate}` : "";
    link.setAttribute("download", `stonehenge_field_telemetry_history${startStr}${endStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(
      language === "ar"
        ? `تم تصدير ${filteredHistoryLogs.length} سجلاً بنجاح`
        : `Successfully exported ${filteredHistoryLogs.length} telemetry records`
    );
  };

  const handleTriggerSimulation = async () => {
    if (!simSelectedUserId) {
      toast.error(language === "ar" ? "الرجاء اختيار موظف أولاً" : "Please select a staff member first");
      return;
    }
    const staffMember = staff.find(s => s.id === simSelectedUserId);
    if (!staffMember) {
      toast.error("Staff member not found");
      return;
    }

    setTelemetryTriggerLoading(true);
    
    // Choose coordinates based on selection TYPE
    let lat = geofenceCenter.lat;
    let lng = geofenceCenter.lng;
    let locationLabel = "Inside Monument Circle";
    
    if (simLocationType === "inside") {
      // Offset slightly closer to center
      lat += (Math.random() - 0.5) * 0.0004;
      lng += (Math.random() - 0.5) * 0.0004;
      locationLabel = "Inside Monument Perimeter";
    } else if (simLocationType === "west_breach") {
      // West Breach location
      lat += (Math.random() - 0.5) * 0.0004;
      lng -= 0.0035; // Outside geofence radius
      locationLabel = "West Wood Ridge Field (BREACH)";
    } else if (simLocationType === "north_breach") {
      // North Breach location
      lat += 0.0032; // Outside geofence radius
      lng += (Math.random() - 0.5) * 0.0004;
      locationLabel = "A303 Boundary North (BREACH)";
    } else if (simLocationType === "south_breach") {
      // South Breach location
      lat -= 0.0030; // Outside geofence radius
      lng += (Math.random() - 0.5) * 0.0004;
      locationLabel = "Normanton Down South (BREACH)";
    }

    try {
      await addDoc(collection(db, "clock_logs"), {
        user_id: staffMember.id,
        user_name: staffMember.name,
        role: staffMember.role || "user",
        department: staffMember.department || "Visitor Experience",
        type: "location_update",
        latitude: lat,
        longitude: lng,
        notes: simCustomNotes || `${locationLabel} - Live GPS simulation telemetry update`,
        timestamp: {
          seconds: Math.floor(Date.now() / 1000),
          nanoseconds: 0
        }
      });
      toast.success(
        language === "ar"
          ? `تم تحديث الملاحة لـ ${staffMember.name} بنجاح!`
          : `Simulated path updated for ${staffMember.name}!`
      );
      setSimCustomNotes("");
    } catch (err: any) {
      console.error(err);
      toast.error("Simulation failed: " + err.message);
    } finally {
      setTelemetryTriggerLoading(false);
    }
  };

  const handleVerifyStaffSafety = async (staffId: string, staffName: string) => {
    try {
      await addDoc(collection(db, "clock_logs"), {
        user_id: staffId,
        user_name: staffName,
        role: "user",
        department: "Heritage Management",
        type: "safety_acknowledgement",
        latitude: geofenceCenter.lat,
        longitude: geofenceCenter.lng,
        notes: language === "ar" 
          ? `تم التحقق من سلامة الموظف وتأكيده مع المشرف يدوياً`
          : `Safety & perimeter status verified: Team member accounted for & clear of hazard`,
        timestamp: {
          seconds: Math.floor(Date.now() / 1000),
          nanoseconds: 0
        }
      });
      toast.success(
        language === "ar"
          ? `تم تسجيل التحقق من سلامة ${staffName} والموافقة الأمنية`
          : `Acknowledge noted and safe status recorded for ${staffName}`
      );
      setSelectedPin(null);
    } catch (err: any) {
      toast.error("Safety action failed: " + err.message);
    }
  };

  const highPriorityPendingTasks = tasks.filter(t => t.status === "pending" && t.priority === "high").length;

  let briefStatus = "Optimal";
  let briefStatusColor = "text-emerald-500 bg-emerald-50 border-emerald-100";
  if (criticalIncidents > 0) {
    briefStatus = "Critical Attention Required";
    briefStatusColor = "text-red-600 bg-red-50 border-red-100 animate-pulse";
  } else if (activeIncidents > 0 || highPriorityPendingTasks > 0) {
    briefStatus = "At Risk / In Progress";
    briefStatusColor = "text-amber-600 bg-amber-50 border-amber-100";
  }

  const generateExecutiveSummary = () => {
    const parts = [];
    if (language === "ar") {
      if (criticalIncidents > 0) {
        parts.push(`تنبيه حرج: هناك ${criticalIncidents} حادث نشط عالي الخطورة يتطلب استجابة فورية من المشرف.`);
      } else if (activeIncidents > 0) {
        parts.push(`تحذير ميداني: هناك ${activeIncidents} حادث قيد الاستجابة والمتابعة من قبل فرق الأمن الميداني.`);
      } else {
        parts.push("القطاعات آمنة: لا توجد حوادث أمنية أو تشغيلية نشطة مبلّغ عنها حالياً.");
      }

      if (onlineStaff === 0) {
        parts.push("خطر بالجدول: تشير السجلات إلى وجود 0 موظف متصل بالشبكة في هذه المناوبة.");
      } else {
        parts.push(`المستويات مستقرة: ${onlineStaff} من أصل ${totalStaff} حارس أمني (${staffOnlinePercentage}%) نشطون وعلى اتصال بالشبكة.`);
      }

      if (highPriorityPendingTasks > 0) {
        parts.push(`مطلوب الانتباه للمهام: هناك ${highPriorityPendingTasks} توجيهات عاجلة لم يتم حلها بعد.`);
      } else {
        parts.push(`درجة الجاهزية التشغيلية مرتفعة جداً مع معدل نجاح وإنجاز مهام يبلغ ${completionRate}%.`);
      }
    } else {
      if (criticalIncidents > 0) {
        parts.push(`CRITICAL ALERT: There ${criticalIncidents === 1 ? "is" : "are"} ${criticalIncidents} active high-severity incident${criticalIncidents === 1 ? "" : "s"} requiring immediate supervisor response.`);
      } else if (activeIncidents > 0) {
        parts.push(`Ground Warning: ${activeIncidents} incident${activeIncidents === 1 ? " is" : "s are"} under active deployment by ground responders.`);
      } else {
        parts.push("Sectors Clear: No active security or facility incidents reported.");
      }

      if (onlineStaff === 0) {
        parts.push("Roster Danger: Roster indicates 0 online staff members on shift.");
      } else {
        parts.push(`Staff levels are stable: ${onlineStaff} of ${totalStaff} team members (${staffOnlinePercentage}%) are active and online.`);
      }

      if (highPriorityPendingTasks > 0) {
        parts.push(`Attention required on tasks: ${highPriorityPendingTasks} urgent directive${highPriorityPendingTasks === 1 ? " remains" : "s remain"} unresolved.`);
      } else {
        parts.push(`Ops readiness is high with a ${completionRate}% task success clear rate.`);
      }
    }

    return parts.join(" ");
  };

  const getOperationalCategory = (count: number) => {
    if (count < 1200) return { label: "Low", color: "text-blue-600", bg: "bg-blue-50" };
    if (count <= 2500) return { label: "Normal", color: "text-emerald-600", bg: "bg-emerald-50" };
    if (count <= 4800) return { label: "High", color: "text-amber-600", bg: "bg-amber-50" };
    return { label: "Peak", color: "text-red-600", bg: "bg-red-50" };
  };

  const liveModel = getOperationalCategory(stats?.count || 0);
  const forecastModel = getOperationalCategory(forecast?.forecasted_count || 0);

  const dashboardCards = [
    { id: "live_visitors", label: t("visitors"), value: stats?.count || 0, icon: Users, color: "text-blue-600", bg: "bg-blue-50", subValue: tData(liveModel.label) },
    { id: "pod_visitors", label: t("inner_monument_pod"), value: stats?.pod_count || 0, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50" },
    { id: "op_state", label: t("operations"), value: tData(liveModel.label), icon: Activity, color: liveModel.color, bg: liveModel.bg, description: `Planned: ${tData(forecastModel.label)}` },
    { id: "pending_tasks", label: t("pending_task_count"), value: tasks.filter(t => t.status === 'pending').length, icon: Clock, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  const defaultLayout: LayoutItem[] = [
    { i: 'live_visitors', x: 0, y: 0, w: 3, h: 4 },
    { i: 'pod_visitors', x: 3, y: 0, w: 3, h: 4 },
    { i: 'op_state', x: 6, y: 0, w: 3, h: 4 },
    { i: 'pending_tasks', x: 9, y: 0, w: 3, h: 4 },
    { i: 'recent_tasks', x: 0, y: 4, w: 8, h: 12 },
    { i: 'site_status', x: 8, y: 4, w: 4, h: 12 },
  ];

  const getStatusColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600';
      case 'warning': return 'text-amber-600';
      default: return 'text-emerald-600';
    }
  };

  const formatKey = (key: string) => {
    if (key === 'retail_f&b') return 'Retail & F&B';
    if (key === 'visitor_pulse') return 'Visitor Pulse (CSAT)';
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Real-time Gate Emergency Broadcast Decree */}
      {activeGateEmergency && dismissedEmergencyId !== activeGateEmergency.id && !localStorage.getItem(`ack_gate_alert_${activeGateEmergency.id}`) && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 rounded-3xl bg-red-950 border border-red-800 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-red-800/10 rounded-full blur-xl" />
          <div className="flex items-start gap-4 flex-1">
            <div className="p-3 bg-red-500 rounded-2xl shrink-0 text-white animate-pulse">
              <ShieldAlert size={22} />
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-red-400 px-2.5 py-0.5 rounded-full bg-red-900 border border-red-800">
                {language === "ar" ? "توجيه طوارئ البوابات" : "EMERGENCY GATE BROADCAST"}
              </span>
              <h4 className="text-base font-extrabold tracking-tight">
                {activeGateEmergency.type === 'emergency_open' 
                  ? (language === "ar" ? "أمر طارئ بفتح جميع البوابات فوراً" : "MANDATORY RE-ENTRY COMMAND: OVERRIDE OPEN ALL GATES")
                  : (language === "ar" ? "أمر طارئ بإغلاق وتأمين حدود الموقع بالكامل" : "MANDATORY SECURE COMMAND: CLOSE ALL PERIMETERS")
                }
              </h4>
              <p className="text-xs font-bold text-red-200">
                {language === "ar" ? `السبب: ${activeGateEmergency.reason}` : `Reason: ${activeGateEmergency.reason}`}
              </p>
              <p className="text-xs text-slate-300 italic font-medium leading-relaxed">
                "{activeGateEmergency.notes}"
              </p>
              <p className="text-[10px] text-red-400 font-bold">
                {language === "ar" ? "مرسل بواسطة: " : "Issued by: "} {activeGateEmergency.sender_name} • {new Date(activeGateEmergency.timestamp?.seconds * 1000 || Date.now()).toLocaleTimeString()}
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <button
              onClick={() => {
                localStorage.setItem(`ack_gate_alert_${activeGateEmergency.id}`, "true");
                setDismissedEmergencyId(activeGateEmergency.id);
                toast.success(language === "ar" ? "تم إقرار استلام التوجيه بنجاح" : "Emergency notification acknowledged");
              }}
              className="px-5 py-2.5 bg-white text-red-950 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-150 transition-all cursor-pointer shadow-lg active:scale-95"
            >
              {language === "ar" ? "إقرار الاستلام" : "Acknowledge"}
            </button>
          </div>
        </motion.div>
      )}

      {/* Header / Intro */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">{t("dashboard_title")}</h1>
          <p className="text-slate-500 font-medium mt-1">{t("dashboard_subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-600">
            {language === "ar" ? "الموقع نشط" : "Site Live"}
          </span>
        </div>
      </div>

      {/* Daily Operations Briefing Widget */}
      <AnimatePresence>
        {!briefingAcknowledged && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className={cn(
              "mission-control-card bg-white border border-slate-200 overflow-hidden relative shadow-sm",
              criticalIncidents > 0 ? "border-l-4 border-l-red-500" :
              (activeIncidents > 0 || highPriorityPendingTasks > 0) ? "border-l-4 border-l-amber-500" :
              "border-l-4 border-l-emerald-500"
            )}
            id="ops-briefing-widget"
          >
            {/* Header / Brief Summary Bar */}
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2.5 rounded-xl",
                  criticalIncidents > 0 ? "bg-red-50 text-red-600" :
                  (activeIncidents > 0 || highPriorityPendingTasks > 0) ? "bg-amber-50 text-amber-600" :
                  "bg-emerald-50 text-emerald-600"
                )}>
                  <Sparkles size={20} className={criticalIncidents > 0 ? "animate-pulse" : ""} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 tracking-tight text-lg flex items-center gap-2">
                    {t("today_briefing")}
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border",
                      briefStatus === "Optimal" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                      briefStatus === "Critical Attention Required" ? "bg-red-50 border-red-200 text-red-700 animate-pulse" :
                      "bg-amber-50 border-amber-200 text-amber-700"
                    )}>
                      {tData(briefStatus)}
                    </span>
                  </h3>
                  <p className="text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-wider">
                    {language === "ar" ? "تقرير حالة الموقع · تجميع فوري للمؤشرات" : "Site Status Report • Live metrics synthesized"}
                  </p>
                </div>
              </div>
 
              <div className="flex items-center gap-3 self-end md:self-auto">
                <button
                  onClick={() => setBriefingExpanded(!briefingExpanded)}
                  className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-100 active:bg-slate-200 text-slate-600 text-xs font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                >
                  {briefingExpanded ? (
                    <>
                      <span>{language === "ar" ? "طي" : "Collapse"}</span>
                      <ChevronUp size={16} />
                    </>
                  ) : (
                    <>
                      <span>{t("view_details")}</span>
                      <ChevronDown size={16} />
                    </>
                  )}
                </button>
                <button
                  onClick={() => setBriefingAcknowledged(true)}
                  className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                  title={language === "ar" ? "إقرار وإغلاق" : "Acknowledge & Close"}
                >
                  <Check size={18} />
                </button>
              </div>
            </div>

            {/* Expanded Detailed Section */}
            <motion.div
              initial={false}
              animate={{ height: briefingExpanded ? "auto" : 0, opacity: briefingExpanded ? 1 : 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="p-6 space-y-6">
                {/* Dynamically Generated Summary Note */}
                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                  <p className="text-sm font-medium text-slate-700 leading-relaxed selection:bg-emerald-100">
                    {generateExecutiveSummary()}
                  </p>
                </div>

                {/* Grid of Key System metrics with Motion Loaders */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* METRIC 1: Directives & Tasks */}
                  <div className="space-y-3 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                          <CheckCircle2 size={14} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {language === "ar" ? "الجاهزية والامتثال" : "Ops Readiness"}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-600">{completedTasks}/{totalTasks} {language === "ar" ? "مكتمل" : "Cleared"}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-slate-900 tracking-tight">{completionRate}%</span>
                        <span className="text-[10px] font-bold text-slate-400">{pendingTasksCount} {language === "ar" ? "قيد الانتظار" : "Pending"}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                           initial={{ width: 0 }}
                           animate={{ width: `${completionRate}%` }}
                           transition={{ duration: 1.2, ease: "easeOut" }}
                           className="h-full bg-indigo-500 rounded-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* METRIC 2: Field Staff On Roster */}
                  <div className="space-y-3 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                          <UserCheck size={14} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {language === "ar" ? "حالة الطاقم" : "Crew Status"}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-600">{onlineStaff}/{totalStaff} {language === "ar" ? "نشط" : "Active"}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-slate-900 tracking-tight">{staffOnlinePercentage}%</span>
                        <span className="text-[10px] font-bold text-slate-400">{totalStaff - onlineStaff} {language === "ar" ? "خارج الخدمة" : "Offline"}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                           initial={{ width: 0 }}
                           animate={{ width: `${staffOnlinePercentage}%` }}
                           transition={{ duration: 1.2, ease: "easeOut" }}
                           className="h-full bg-emerald-500 rounded-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* METRIC 3: Ground Incidents */}
                  <div className="space-y-3 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "p-1.5 rounded-lg",
                          activeIncidents > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-500"
                        )}>
                          <AlertTriangle size={14} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {language === "ar" ? "الحوادث الميدانية" : "Ground Incidents"}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-600">{resolvedIncidents}/{totalIncidents} {language === "ar" ? "محلولة" : "Solved"}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-slate-900 tracking-tight">
                          {activeIncidents} <span className="text-sm font-medium text-slate-400">{language === "ar" ? "مفتوح" : "Open"}</span>
                        </span>
                        <span className={cn(
                          "text-[10px] font-bold",
                          criticalIncidents > 0 ? "text-red-500 font-extrabold animate-pulse" : "text-slate-400"
                        )}>
                          {criticalIncidents} {language === "ar" ? "حرج" : "Critical"}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                           initial={{ width: 0 }}
                           animate={{ width: `${totalIncidents > 0 ? Math.round((resolvedIncidents / totalIncidents) * 100) : 100}%` }}
                           transition={{ duration: 1.2, ease: "easeOut" }}
                           className={cn(
                             "h-full rounded-full",
                             criticalIncidents > 0 ? "bg-red-500" :
                             activeIncidents > 0 ? "bg-amber-500" :
                             "bg-emerald-500"
                           )}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actionable dispatcher notifications (Tasks/Incidents of high priority/alert status) */}
                {(criticalIncidents > 0 || activeIncidents > 0 || highPriorityPendingTasks > 0) && (
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {language === "ar" ? "تنبيهات الإرسال النشطة عالية الأولوية" : "Active High-Priority Dispatch Alerts"}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* High-priority Pending Tasks */}
                      {tasks.filter(t => t.status === "pending" && t.priority === "high").slice(0, 3).map(task => (
                        <div key={task.id} className="p-3 bg-red-50/50 border border-red-100 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2 max-w-[80%]">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            <p className="text-xs font-bold text-slate-700 truncate">{tData(task.title)}</p>
                          </div>
                          <span className="text-[9px] font-black text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md uppercase tracking-wide shrink-0">
                            {language === "ar" ? "أولوية المهمة" : "Task Priority"}
                          </span>
                        </div>
                      ))}

                      {/* Active Ground Incidents */}
                      {incidents.filter(i => i.status !== "resolved").slice(0, 3).map(incident => (
                        <div key={incident.id} className="p-3 bg-amber-50/50 border border-amber-150 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2 max-w-[80%]">
                            <span className={cn(
                              "w-2 h-2 rounded-full",
                              incident.severity === "High" || incident.severity === "Critical" || incident.severity === "critical" ? "bg-red-500" : "bg-amber-500"
                            )} />
                            <p className="text-xs font-bold text-slate-700 truncate">
                              [{tData(incident.location || "Ground")}] {tData(incident.description || incident.type)}
                            </p>
                          </div>
                          <span className={cn(
                            "text-[9px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wide shrink-0",
                            incident.severity === "High" || incident.severity === "Critical" || incident.severity === "critical"
                              ? "text-red-600 bg-red-50 border-red-100 font-extrabold animate-pulse"
                              : "text-amber-800 bg-amber-50 border-amber-150"
                          )}>
                            {tData(incident.severity || "Medium")} {language === "ar" ? "تنبيه" : "Alert"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer Controls */}
                <div className="pt-4 border-t border-slate-150 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                    <Clock size={12} className="text-slate-300" />
                    <span>{language === "ar" ? "تم الحساب في" : "Calculated"} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setBriefingExpanded(false)}
                      className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      {language === "ar" ? "تصغير" : "Minimize"}
                    </button>
                    <button
                      onClick={() => setBriefingAcknowledged(true)}
                      className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
                    >
                      {language === "ar" ? "تأكيد واستلام الإيجاز" : "Acknowledge Briefing"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {briefingAcknowledged && (
        <div className="flex justify-end -mt-4 mb-2">
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => {
              setBriefingAcknowledged(false);
              setBriefingExpanded(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-slate-200 shadow-sm cursor-pointer"
          >
            <Sparkles size={11} className="text-purple-600" />
            <span>{language === "ar" ? "إظهار ملخص العمليات اليومي" : "Show Briefing Widget"}</span>
          </motion.button>
        </div>
      )}

      {/* Primary Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Live Visitor Main Card */}
        <div className="md:col-span-12 lg:col-span-8 mission-control-card p-8 flex flex-col justify-between min-h-[320px] bg-slate-900 border-slate-800 text-white relative group cursor-pointer selection:bg-emerald-500/30">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users size={120} strokeWidth={1} />
          </div>
          
          <div className="space-y-1">
            <p className="data-label text-slate-400">
              {language === "ar" ? "نسبة إشغال الموقع الرئيسي" : "Main Site Occupancy"}
            </p>
            <div className="flex items-baseline gap-4">
              <motion.h2 
                key={stats?.count}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-8xl font-black tabular-nums tracking-tighter"
              >
                {stats?.count || 0}
              </motion.h2>
              <div className="flex flex-col">
                <span className={cn("text-xs font-black px-2.5 py-1 rounded-lg w-fit uppercase tracking-wider", liveModel.bg, liveModel.color)}>
                  {tData(liveModel.label)}
                </span>
                <span className="text-xs font-medium text-slate-500 mt-1">/ {maxCapacity} {language === "ar" ? "السعة" : "Capacity"}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-8">
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-800 shadow-inner">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, ((stats?.count || 0) / maxCapacity) * 100)}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className={cn("h-full transition-all duration-1000", 
                  liveModel.label === 'Peak' ? "bg-red-500" : 
                  liveModel.label === 'High' ? "bg-amber-500" : 
                  "bg-emerald-500"
                )}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
              <div className="flex items-center gap-2">
                <Clock size={12} />
                <span>
                  {language === "ar" ? "مزامنة فورية نشطة" : "Real-time sync active"}
                </span>
              </div>
              <span>{Math.round(((stats?.count || 0) / maxCapacity) * 100)}% {language === "ar" ? "معدل الاستخدام" : "Utilization"}</span>
            </div>
          </div>
        </div>

        {/* Staff Clock-In / Out Portal Card */}
        <div className="md:col-span-12 lg:col-span-4">
          <StaffClock />
        </div>

        {/* POD Occupancy Card */}
        <div className="md:col-span-12 lg:col-span-4 mission-control-card p-8 flex flex-col justify-between min-h-[320px] bg-emerald-950 border-emerald-900 text-white group cursor-pointer">
          <div className="space-y-1">
            <p className="data-label text-emerald-400">
              {language === "ar" ? "إشغال الـ POD" : "POD Occupancy"}
            </p>
            <motion.h2 
              key={stats?.pod_count}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-6xl font-black tabular-nums tracking-tighter"
            >
              {stats?.pod_count || 0}
            </motion.h2>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="h-1.5 bg-emerald-900 rounded-full overflow-hidden border border-emerald-900 shadow-inner">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${Math.min(100, podPercentage)}%` }}
                   transition={{ duration: 1.2, ease: "easeOut" }}
                   className="h-full bg-emerald-400"
                />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 text-right">
                {podPercentage}% {language === "ar" ? "معدل الاستخدام" : "Utilization"}
              </p>
            </div>

            <div className="p-4 bg-emerald-905/40 rounded-2xl border border-emerald-800/30">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">
                {language === "ar" ? "الحالة" : "Status"}
              </p>
              <p className="text-sm font-medium text-emerald-100">
                {language === "ar" ? "يعمل ضمن المعايير المتوقعة." : "Operating within expected parameters."}
              </p>
            </div>
          </div>
        </div>

        {/* Tasks Summary Card */}
        <div className="md:col-span-12 lg:col-span-8 mission-control-card p-8 flex flex-col justify-between min-h-[320px] bg-white border-slate-200 group cursor-pointer overflow-hidden relative">
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="data-label text-slate-400">
                {language === "ar" ? "جاهزية العمليات" : "Ops Readiness"}
              </p>
              <div className="flex items-baseline gap-1">
                <motion.h2 
                  key={completionRate}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-5xl font-black tabular-nums tracking-tighter text-slate-900"
                >
                  {completionRate}%
                </motion.h2>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {language === "ar" ? "معدل الإنجاز" : "Completion Rate"}
              </p>
            </div>

            {/* Circular Progress Loader */}
            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-purple-100 fill-none"
                  strokeWidth="8"
                />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-purple-600 fill-none drop-shadow-[0_2px_4px_rgba(147,51,234,0.1)]"
                  strokeWidth="8"
                  strokeLinecap="round"
                  initial={{ strokeDashoffset: 251.2 }}
                  animate={{ strokeDashoffset: 251.2 - (251.2 * completionRate) / 100 }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  style={{
                    strokeDasharray: 251.2,
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <CheckCircle2 size={24} className="text-purple-600" />
              </div>
            </div>
          </div>

          <div className="space-y-3 relative z-10 mt-2">
            <div className="flex justify-between items-center text-xs font-bold text-slate-600 border-b border-slate-150 pb-2">
              <span>{completedTasks} {language === "ar" ? "مكتملة ومؤكدة" : "Verified"}</span>
              <span className="text-purple-600">{pendingTasksCount} {language === "ar" ? "قيد التنفيذ" : "Pending"}</span>
            </div>
            <div className="space-y-2">
              {tasks.filter(t => t.status === 'pending').slice(0, 2).map((task) => (
                <div key={task.id} className="flex items-center gap-3 p-2 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className={cn("w-1.5 h-1.5 rounded-full", task.priority === 'high' ? 'bg-red-500' : 'bg-slate-400')} />
                  <p className="text-xs font-medium text-slate-600 truncate">{tData(task.title)}</p>
                </div>
              ))}
              {tasks.filter(t => t.status === 'pending').length === 0 && (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold select-none">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {language === "ar" ? "تم إنجاز كافة التعليمات!" : "All directives cleared!"}
                </div>
              )}
            </div>
            <button className="w-full py-3 bg-slate-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors mt-1 shadow-sm cursor-pointer">
              {language === "ar" ? "بوابة العمليات والإدارة" : "Management Portal"}
            </button>
          </div>
        </div>

        {/* INTERACTIVE SITE MAP & RESOURCE RADAR */}
        <div id="dashboard-interactive-map-card" className="md:col-span-12 bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col min-h-[580px]">
          {/* Header */}
          <div className={cn("p-8 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/40", language === "ar" && "lg:flex-row-reverse text-right")}>
            <div>
              <div className="flex items-center gap-2 mb-1 justify-start">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Map size={18} />
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  {language === "ar" ? "رصد الموقع الجغرافي والنشاط الميداني" : "Interactive Site Map & Field Operations Radar"}
                </h3>
              </div>
              <p className="text-sm text-slate-400 font-medium select-none mb-3">
                {language === "ar" ? "تتبع موظفي الخدمة النشطين ومواقع البلاغات وعمليات الدوران بصرياً وتاريخياً" : "Real-time geographical radar map and chronological field action logs with secure geofence tracking"}
              </p>

              {/* RADAR VS HISTORY TIMELINE SWITCH */}
              <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit gap-1 border border-slate-200/60 mt-1 select-none">
                <button
                  onClick={() => setMapTabView('radar')}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                    mapTabView === 'radar'
                      ? "bg-slate-950 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <Compass size={11} className={cn(mapTabView === 'radar' && "animate-spin text-emerald-400")} style={{ animationDuration: '8s' }} />
                  {language === "ar" ? "رادار الخريطة الحي" : "Live Radar Map"}
                </button>
                <button
                  onClick={() => setMapTabView('earth')}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                    mapTabView === 'earth'
                      ? "bg-slate-950 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <Globe size={11} className={cn(mapTabView === 'earth' && "animate-pulse text-indigo-400")} />
                  {language === "ar" ? "جوجل إيرث ثلاثي الأبعاد" : "Google Earth View"}
                </button>
                <button
                  onClick={() => setMapTabView('history')}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                    mapTabView === 'history'
                      ? "bg-slate-950 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <History size={11} className={cn(mapTabView === 'history' && "text-indigo-400")} />
                  {language === "ar" ? "سجل حركة المواقع" : "Location History Log"}
                </button>
              </div>
            </div>

            {/* Map HUD filter buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* DEFAULT VS GOOGLE EARTH TOGGLE SWITCH */}
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 select-none items-center shadow-inner">
                <button
                  onClick={() => setMapTabView(mapTabView === 'earth' ? 'radar' : 'earth')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm border",
                    mapTabView === 'earth'
                      ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
                      : "bg-indigo-650 border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white"
                  )}
                >
                  {mapTabView === 'earth' ? (
                    <>
                      <Compass size={13} className="animate-spin text-emerald-400" style={{ animationDuration: '8s' }} />
                      <span>{language === "ar" ? "العودة للرادار الافتراضي" : "Return to Default Radar"}</span>
                    </>
                  ) : (
                    <>
                      <Globe size={13} className="animate-pulse text-indigo-200" />
                      <span>{language === "ar" ? "عرض قمر جوجل إيرث" : "Google Earth View"}</span>
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={() => { setDashboardMapFilter('all'); setSelectedPin(null); }}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer",
                  dashboardMapFilter === 'all'
                    ? "bg-slate-950 text-white border-transparent shadow-sm"
                    : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
                )}
              >
                {language === "ar" ? "عرض الكل" : "Show All"} ({projectedStaff.length + projectedIncidents.length})
              </button>
              <button
                onClick={() => { setDashboardMapFilter('staff'); setSelectedPin(null); }}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-1.5",
                  dashboardMapFilter === 'staff'
                    ? "bg-indigo-600 text-white border-transparent shadow-sm"
                    : "bg-indigo-50/50 hover:bg-indigo-50 text-indigo-600 border-indigo-150/40"
                )}
              >
                <Users size={12} />
                {language === "ar" ? "الموظفين الميدانيين" : "Active Staff"} ({projectedStaff.length})
              </button>
              <button
                onClick={() => { setDashboardMapFilter('incidents'); setSelectedPin(null); }}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-1.5",
                  dashboardMapFilter === 'incidents'
                    ? "bg-red-600 text-white border-transparent shadow-sm"
                    : "bg-red-50/50 hover:bg-red-50 text-red-600 border-red-150/40"
                )}
              >
                <AlertTriangle size={12} />
                {language === "ar" ? "الحوادث النشطة" : "Active Incidents"} ({projectedIncidents.length})
              </button>
            </div>
          </div>

          {/* Map Grid Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 flex-1 min-h-[500px]">
            {/* Left side: Interactive SVG Map Canvas OR Location History Log */}
            {mapTabView === 'history' ? (
              <div className="lg:col-span-8 p-6 bg-slate-950 border-transparent relative overflow-hidden flex flex-col justify-start min-h-[420px] lg:min-h-0">
                {/* Starry/Mesh Overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

                {/* Header info bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-900 z-10 select-none">
                  <div className="flex items-center gap-2">
                    <History size={14} className="text-indigo-400 rotate-180 animate-pulse" />
                    <span className="text-[10px] font-mono text-slate-400 font-extrabold uppercase tracking-widest">
                      {language === "ar" ? "قائمة رصد الحركة التاريخية" : "CHRONOLOGICAL TELEMETRY LOG"}
                    </span>
                  </div>
                  
                  {/* Export and Logs info */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-[10px] font-mono text-slate-450 font-bold bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-xl">
                      {language === "ar" ? `السجلات: ${filteredHistoryLogs.length}` : `LOGS: ${filteredHistoryLogs.length}`}
                    </div>
                    {/* Export Button */}
                    <button
                      onClick={handleExportHistory}
                      className="bg-indigo-600 hover:bg-indigo-505 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase tracking-wider py-1.5 px-3.5 rounded-xl border border-indigo-500/10 hover:border-indigo-400/30 shadow-md hover:shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download size={11} />
                      {language === "ar" ? "تصدير الملف CSV" : "Export CSV"}
                    </button>
                  </div>
                </div>

                {/* Date range & Advanced Filters filter component */}
                <div className="bg-slate-900/60 border border-slate-900 rounded-2xl p-4 mb-4 space-y-3.5 z-10 select-none">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3.5 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-indigo-400" />
                      <span className="text-[10px] font-mono font-bold uppercase text-slate-500">
                        {language === "ar" ? "من تاريخ:" : "From:"}
                      </span>
                      <input
                        type="date"
                        value={historyStartDate}
                        onChange={(e) => setHistoryStartDate(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-2.5 py-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-indigo-400" />
                      <span className="text-[10px] font-mono font-bold uppercase text-slate-500">
                        {language === "ar" ? "إلى تاريخ:" : "To:"}
                      </span>
                      <input
                        type="date"
                        value={historyEndDate}
                        onChange={(e) => setHistoryEndDate(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-2.5 py-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    {/* Department Selector */}
                    <div className="flex items-center gap-2">
                      <Filter size={11} className="text-indigo-400" />
                      <span className="text-[10px] font-mono font-bold uppercase text-slate-500">
                        {language === "ar" ? "القسم:" : "Dept:"}
                      </span>
                      <select
                        value={historyDeptFilter}
                        onChange={(e) => setHistoryDeptFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-slate-205 text-slate-200 rounded-xl px-2.5 py-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="all">{language === "ar" ? "كل الأقسام" : "All departments"}</option>
                        <option value="Heritage Management">Heritage Management</option>
                        <option value="Security">Security</option>
                        <option value="Conservation">Conservation</option>
                        <option value="Visitor Experience">Visitor Experience</option>
                        <option value="Visitor Services">Visitor Services</option>
                        <option value="Business Support">Business Support</option>
                        <option value="Facility Management">Facility Management</option>
                      </select>
                    </div>

                    {/* Perimeter Breach Filter */}
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={11} className="text-indigo-400" />
                      <span className="text-[10px] font-mono font-bold uppercase text-slate-500">
                        {language === "ar" ? "النطاق:" : "Geofence:"}
                      </span>
                      <select
                        value={historyBreachFilter}
                        onChange={(e) => setHistoryBreachFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-slate-205 text-slate-200 rounded-xl px-2.5 py-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="all">{language === "ar" ? "كل السجلات" : "All states"}</option>
                        <option value="breached">{language === "ar" ? "تجاوز النطاق فقط" : "Breaches Only"}</option>
                        <option value="inside">{language === "ar" ? "داخل الحدود الآمنة" : "Safe Zone Only"}</option>
                      </select>
                    </div>
                  </div>

                  {(historyStartDate || historyEndDate || historyDeptFilter !== "all" || historyBreachFilter !== "all") && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => {
                          setHistoryStartDate("");
                          setHistoryEndDate("");
                          setHistoryDeptFilter("all");
                          setHistoryBreachFilter("all");
                        }}
                        className="text-[9px] font-mono font-black uppercase text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                      >
                        {language === "ar" ? "إعادة تعيين كافة عوامل التصفية" : "Reset All Active Filters"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Onsite Telemetry Statistics Dashboard Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 z-10 select-none">
                  <div className="bg-slate-900/40 border border-slate-900 p-3 rounded-2xl">
                    <span className="text-[8px] font-mono uppercase tracking-widest text-slate-500 block mb-0.5">
                      {language === "ar" ? "إجمالي السجلات" : "Captured Pings"}
                    </span>
                    <span className="text-sm font-mono font-black text-indigo-300">
                      {filteredHistoryLogs.length}
                    </span>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-900 p-3 rounded-2xl">
                    <span className="text-[8px] font-mono uppercase tracking-widest text-slate-500 block mb-0.5">
                      {language === "ar" ? "الكوادر النشطة" : "Active Staff"}
                    </span>
                    <span className="text-sm font-mono font-black text-emerald-400">
                      {new Set(filteredHistoryLogs.map((l: any) => l.user_id).filter(Boolean)).size}
                    </span>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-900 p-3 rounded-2xl">
                    <span className="text-[8px] font-mono uppercase tracking-widest text-slate-500 block mb-0.5">
                      {language === "ar" ? "انتهاكات الحدود" : "Perimeter Breaches"}
                    </span>
                    <span className={cn(
                      "text-sm font-mono font-black",
                      filteredHistoryLogs.filter((l: any) => l.isBreach).length > 0 ? "text-rose-400 font-extrabold animate-pulse" : "text-slate-400"
                    )}>
                      {filteredHistoryLogs.filter((l: any) => l.isBreach).length}
                    </span>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-900 p-3 rounded-2xl">
                    <span className="text-[8px] font-mono uppercase tracking-widest text-slate-500 block mb-0.5">
                      {language === "ar" ? "معدل السلامة المعياري" : "Perimeter Compliance"}
                    </span>
                    <span className="text-sm font-mono font-black text-teal-400">
                      {filteredHistoryLogs.length > 0 
                        ? Math.round(((filteredHistoryLogs.length - filteredHistoryLogs.filter((l: any) => l.isBreach).length) / filteredHistoryLogs.length) * 100)
                        : 100}%
                    </span>
                  </div>
                </div>

                {/* Timeline scroll area */}
                <div className="flex-1 overflow-y-auto max-h-[420px] space-y-3 pr-1.5 z-10 scrollbar-thin select-none">
                  {filteredHistoryLogs.length > 0 ? (
                    filteredHistoryLogs.map((log: any) => {
                      const logDate = log.timestamp?.seconds 
                        ? new Date(log.timestamp.seconds * 1000) 
                        : (log.timestamp ? new Date(log.timestamp) : new Date());
                      
                      const formattedTime = logDate.toLocaleTimeString(language === "ar" ? "ar-EG" : "en-US", { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      const formattedDate = logDate.toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", { month: 'short', day: 'numeric', year: 'numeric' });
                      
                      const isBreach = log.isBreach;
                      const hasCoarseGPS = log.latitude !== undefined && log.latitude !== null;
                      
                      const actionTypeBadge = log.type === "clock_in" 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                        : log.type === "clock_out"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";

                      const actionLabel = log.type === "clock_in"
                        ? (language === "ar" ? "تسجيل حضور جغرافي" : "Entrance Clock-In")
                        : log.type === "clock_out"
                          ? (language === "ar" ? "تسجيل انصراف ميداني" : "Departure Clock-Out")
                          : (language === "ar" ? "تحديث موقع الرصد" : "Location Captured");

                      return (
                        <div 
                          key={log.id} 
                          onClick={() => {
                            if (hasCoarseGPS) {
                              setSelectedPin({
                                id: `log_${log.id}`,
                                pinType: 'staff',
                                name: log.user_name || "Staff Member",
                                userRole: log.role || log.user_role || "Ranger",
                                department: log.department || "Field Operations",
                                distance: log.distance || 0,
                                accuracy: log.accuracy || 10,
                                latitude: log.latitude,
                                longitude: log.longitude,
                                notes: log.notes || "",
                                timestamp: log.timestamp
                              });
                            }
                          }}
                          className={cn(
                            "relative overflow-hidden bg-slate-900/35 hover:bg-slate-900/85 border border-slate-900 hover:border-slate-800 rounded-2xl p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer",
                            language === "ar" && "md:flex-row-reverse text-right"
                          )}
                        >
                          <div className={cn("absolute top-0 w-1 h-full bg-slate-800 hover:bg-indigo-500 transition-all", language === "ar" ? "right-0" : "left-0")} />

                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-xs font-black text-slate-400 font-mono shrink-0 border border-slate-800">
                              {(log.user_name || "S").charAt(0).toUpperCase()}
                            </div>

                            <div className="min-w-0">
                              <div className={cn("flex items-center gap-2 flex-wrap mb-1", language === "ar" && "flex-row-reverse")}>
                                <h4 className="text-xs font-black text-slate-200 truncate">{log.user_name || "Staff Member"}</h4>
                                <span className={cn("px-2 py-0.5 rounded-md text-[8px] font-mono font-bold border", actionTypeBadge)}>
                                  {actionLabel}
                                </span>
                              </div>

                              <div className={cn("flex gap-x-2.5 gap-y-1 items-center flex-wrap text-[10px] text-slate-500 font-bold", language === "ar" && "flex-row-reverse")}>
                                <span>{tData(log.department || "Operations")}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-800" />
                                <span className="font-mono text-slate-400">{formattedDate} • {formattedTime}</span>
                              </div>

                              {log.notes && (
                                <p className="text-[11px] text-slate-400 italic mt-2 bg-slate-950/50 p-2 rounded-xl border border-slate-900 max-w-lg">
                                  "{log.notes}"
                                </p>
                              )}
                            </div>
                          </div>

                          <div className={cn("flex flex-col items-start md:items-end justify-center shrink-0 min-w-[150px]", language === "ar" && "md:items-start text-right")}>
                            {hasCoarseGPS ? (
                              <>
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest mb-1 shadow-sm border flex items-center gap-1",
                                  isBreach
                                    ? "bg-rose-500/10 text-rose-450 border-rose-500/20 text-rose-400"
                                    : "bg-emerald-500/10 text-emerald-450 border-emerald-500/20 text-emerald-400"
                                )}>
                                  <span className={cn("w-1 h-1 rounded-full", isBreach ? "bg-rose-400 animate-ping" : "bg-emerald-400")} />
                                  {isBreach 
                                    ? (language === "ar" ? "تجاوز النطاق" : "BREACH DETECTED") 
                                    : (language === "ar" ? "داخل الموقع الآمن" : "INSIDE RANGE")
                                  }
                                </span>
                                <span className="text-[10px] font-mono font-medium text-slate-400 block">
                                  GPS: {Number(log.latitude).toFixed(5)}, {Number(log.longitude).toFixed(5)}
                                </span>
                                {log.distance !== null && (
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {language === "ar" ? `المسافة لمركز المعلم: ~${Math.round(log.distance)}م` : `Geocenter dist: ~${Math.round(log.distance)}m`}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-[8px] font-mono text-slate-600 uppercase tracking-wider block bg-slate-900 border border-slate-900 px-2 py-1 rounded-md">
                                ⚠️ {language === "ar" ? "بدون تحديد موقع" : "NO GEOTAG CAPTURED"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-20 text-center flex flex-col items-center justify-center">
                      <History size={36} className="text-slate-800 animate-pulse mb-2.5" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {language === "ar" ? "لا توجد سجلات رصد متطابقة للبحث" : "NO RELEVANT RADAR JOURNALS FOUND"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : mapTabView === 'earth' ? (
              <div className="lg:col-span-8 p-6 bg-slate-900 border-transparent relative overflow-hidden flex flex-col justify-between min-h-[420px] lg:min-h-0 select-none">
                {/* Embedded Earth Backdrop */}
                <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />
                
                {/* Embedded Earth Info Overlay */}
                <div className="flex items-center justify-between mb-4 z-10">
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-emerald-400 rotate-12 animate-pulse" />
                    <span className="text-[10px] font-mono text-slate-300 font-extrabold uppercase tracking-widest block text-left">
                      {language === "ar" ? "قمر رصد المواقع المباشر - جوجل إيرث" : "GOOGLE EARTH LIVE SATELLITE FEED"}
                    </span>
                  </div>
                  <div className="text-[9px] font-mono text-slate-400 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-xl">
                    GEO-COORD: {geofenceCenter.lat.toFixed(5)}°N, {geofenceCenter.lng.toFixed(5)}°W
                  </div>
                </div>

                {/* Google Earth Map Frame */}
                <div className="flex-1 w-full bg-slate-950 rounded-[2rem] overflow-hidden border border-slate-800 shadow-inner relative min-h-[380px] flex">
                  {(() => {
                    const iframeZoom = Math.min(21, Math.max(12, Math.round(17 + Math.log2(mapZoom))));
                    return (
                      <iframe
                        src={`https://maps.google.com/maps?q=${geofenceCenter.lat},${geofenceCenter.lng}&t=k&z=${iframeZoom}&output=embed`}
                        className="w-full h-full min-h-[380px] rounded-[2rem] border-0"
                        allowFullScreen
                        loading="lazy"
                        title="Stonehenge Google Earth"
                      />
                    );
                  })()}

                  {/* SVG overlay on top of standard Google Earth */}
                  <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 500 500"
                    className="absolute inset-0 select-none pointer-events-none z-10"
                  >
                    {/* Outer Stonehenge Circle Bank */}
                    <circle cx="250" cy="250" r="190" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="3 6" opacity="0.25" />
                    <circle cx="250" cy="250" r="160" fill="none" stroke="#818cf8" strokeWidth="1.2" opacity="0.2" strokeDasharray="2 4" />

                    {/* Concentric Guide Circles indicating metrics */}
                    {(() => {
                      const extent = mapExtent;
                      const ranges = [extent * 0.25, extent * 0.5, extent * 0.75, extent * 1.0];
                      return (
                        <g className="pointer-events-none">
                          {/* Axes Crosshairs */}
                          <line x1="250" y1="20" x2="250" y2="480" stroke="#818cf8" strokeWidth="0.8" strokeDasharray="4 6" opacity="0.3" />
                          <line x1="20" y1="250" x2="480" y2="250" stroke="#818cf8" strokeWidth="0.8" strokeDasharray="4 6" opacity="0.3" />

                          {/* concentric circle guide lines */}
                          {ranges.map((dist, idx) => {
                            const r_px = (dist / extent) * 250;
                            return (
                              <g key={idx}>
                                <circle cx="250" cy="250" r={r_px} fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
                                <text x="255" y={250 - r_px + 12} fill="#34d399" className="text-[8px] font-mono font-black select-none" opacity="0.8">
                                  {Math.round(dist)}m
                                </text>
                              </g>
                            );
                          })}

                          {/* Stonehenge stones concentric blueprint */}
                          <g opacity="0.35">
                            {/* Inner Circle Pillars */}
                            {Array.from({ length: 12 }).map((_, i) => {
                              const angle = (i * 2 * Math.PI) / 12;
                              const radius = 55;
                              const x = 250 + radius * Math.cos(angle);
                              const y = 250 + radius * Math.sin(angle);
                              return (
                                <rect
                                  key={`earth_stone_inner_${i}`}
                                  x={x - 3}
                                  y={y - 5}
                                  width="6"
                                  height="10"
                                  rx="1.5"
                                  fill="#818cf8"
                                  transform={`rotate(${(angle * 180) / Math.PI}, ${x}, ${y})`}
                                />
                              );
                            })}
                            {/* Outer Stone Pillars */}
                            {Array.from({ length: 20 }).map((_, i) => {
                              const angle = (i * 2 * Math.PI) / 20;
                              const radius = 95;
                              const x = 250 + radius * Math.cos(angle);
                              const y = 250 + radius * Math.sin(angle);
                              return (
                                <rect
                                  key={`earth_stone_outer_${i}`}
                                  x={x - 4}
                                  y={y - 8}
                                  width="8"
                                  height="16"
                                  rx="2"
                                  fill="#a5b4fc"
                                  transform={`rotate(${(angle * 180) / Math.PI}, ${x}, ${y})`}
                                />
                              );
                            })}
                          </g>

                          {/* Geofence circular perimeter limits */}
                          {(() => {
                            const rad_px = (geofenceRadius / extent) * 250;
                            return (
                              <g>
                                <circle
                                  cx="250"
                                  cy="250"
                                  r={rad_px}
                                  fill="none"
                                  stroke="#ef4444"
                                  strokeWidth="1.5"
                                  strokeDasharray="4 4"
                                  opacity="0.6"
                                />
                                <text
                                  x="250"
                                  y={250 - rad_px - 6}
                                  textAnchor="middle"
                                  fill="#fca5a5"
                                  className="text-[8px] font-black uppercase tracking-wider select-none"
                                  opacity="0.8"
                                >
                                  {language === "ar" ? "سياج الأمان المعيّن" : "Secured Perimeter"}
                                </text>
                              </g>
                            );
                          })()}

                          {/* Centerpoint Stonehenge monument badge */}
                          <g transform="translate(250, 250)">
                            <circle r="7" fill="#6366f1" stroke="#ffffff" strokeWidth="1.5" opacity="0.9" />
                            <circle r="14" fill="none" stroke="#6366f1" strokeWidth="1" className="animate-pulse" opacity="0.5" />
                          </g>
                        </g>
                      );
                    })()}

                    {/* ACTIVE PLOTTED PIN MARKERS OVERLAY */}
                    {(() => {
                      const extent = mapExtent;
                      return (
                        <g id="earth-plotted-pins-dashboard" className="pointer-events-auto">
                          {combinedPins.map((pin) => {
                            const x_px = 250 + (pin.dx / extent) * 250;
                            const y_px = 250 - (pin.dy / extent) * 250;
                            
                            const isSelected = selectedPin?.id === pin.id;
                            const isStaff = pin.pinType === 'staff';
                            
                            // Styling for pins
                            const indicatorColor = isStaff 
                              ? (pin.userRole === "manager" || pin.userRole === "admin" ? "#6366f1" : "#10b981") 
                              : (pin.severity === "High" || pin.severity === "Critical" || pin.severity === "critical" ? "#ef4444" : "#f59e0b");

                            return (
                              <g
                                key={`earth_pin_${pin.id}`}
                                transform={`translate(${x_px}, ${y_px})`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPin(pin);
                                }}
                                className="cursor-pointer group pointer-events-auto"
                              >
                                {/* Selection spin circle */}
                                {isSelected ? (
                                  <circle r="22" fill="none" stroke={indicatorColor} strokeWidth="1.5" strokeDasharray="3 2" className="animate-spin" style={{ animationDuration: '8s' }} />
                                ) : (
                                  <circle r="16" fill="none" stroke={indicatorColor} strokeWidth="1" opacity="0" className="group-hover:opacity-100 group-hover:scale-110 transition-all duration-250" />
                                )}

                                {/* Alert Ring for Breaches or Critical incidents */}
                                {isStaff ? (
                                  pin.distance > geofenceRadius ? (
                                    <>
                                      <circle r="18" fill="none" stroke="#ef4444" strokeWidth="1" className="animate-ping" style={{ animationDuration: '2.5s' }} />
                                      <circle r="12" fill="#ef4444" fillOpacity="0.12" />
                                    </>
                                  ) : (
                                    <circle r="11" fill="none" stroke="#10b981" strokeWidth="1.2" className="animate-pulse" />
                                  )
                                ) : (
                                  <circle r="18" fill="none" stroke={indicatorColor} strokeWidth="1.5" className="animate-ping" style={{ animationDuration: '1.8s' }} />
                                )}

                                {/* Pin Solid Center */}
                                <circle
                                  r="10"
                                  fill={indicatorColor}
                                  stroke="#ffffff"
                                  strokeWidth="2"
                                  className="shadow-md"
                                />

                                {/* Key Character/Icon Badge */}
                                <text y="3.5" textAnchor="middle" fill="#ffffff" className="text-[9px] font-black pointer-events-none">
                                  {isStaff ? pin.name.charAt(0) : "!"}
                                </text>

                                {/* Simple Title */}
                                <title>
                                  {pin.name}\n
                                  {isStaff ? `${pin.department} (${pin.userRole})` : `${language === "ar" ? "بلاغ خطير" : "Ground Incident"}: ${pin.severity}`}
                                </title>
                              </g>
                            );
                          })}
                        </g>
                      );
                    })()}
                  </svg>

                  {/* Zoom Buttons overlay over Google Earth */}
                  <div className="absolute top-4 right-4 z-15 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-2xl border border-slate-800/80">
                    <button
                      onClick={() => setMapZoom(prev => Math.min(prev + 0.25, 4.0))}
                      className="p-1 px-2.5 text-slate-300 hover:text-white hover:bg-slate-800 text-[10px] font-black rounded-lg transition-colors cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn size={12} />
                    </button>
                    <div className="w-px h-3 bg-slate-800" />
                    <button
                      onClick={() => setMapZoom(prev => Math.max(prev - 0.25, 0.5))}
                      className="p-1 px-2.5 text-slate-300 hover:text-white hover:bg-slate-800 text-[10px] font-black rounded-lg transition-colors cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut size={12} />
                    </button>
                    <div className="w-px h-3 bg-slate-800" />
                    <button
                      onClick={() => setMapZoom(1.0)}
                      className="p-1 px-2 text-slate-300 hover:text-white hover:bg-slate-800 text-[10px] font-black rounded-lg transition-colors cursor-pointer"
                      title="Reset Zoom"
                    >
                      <RotateCcw size={11} />
                    </button>
                  </div>

                  {/* Legend indicator bar overlay */}
                  <div className="absolute bottom-3 left-3 bg-slate-900/95 backdrop-blur-md border border-slate-800/80 px-3.5 py-1.5 rounded-2xl flex flex-wrap items-center gap-3.5 text-[9px] font-black uppercase tracking-wider text-slate-400 select-none max-w-[90%] z-15">
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] border border-white" />
                      <span>{language === "ar" ? "موظف ميداني" : "Field Ranger"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#6366f1] border border-white" />
                      <span>{language === "ar" ? "مشرف" : "Supervisor"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] border border-white" />
                      <span>{language === "ar" ? "بلاغ عادي" : "Warning Alert"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] border border-white animate-pulse" />
                      <span>{language === "ar" ? "بلاغ حرج" : "Critical Incident"}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-slate-400 text-[10px] font-semibold flex items-center gap-1.5 z-10 px-1 select-none text-left">
                  <Info size={11} className="text-indigo-400 shrink-0" />
                  <span>
                    {language === "ar" 
                      ? "جوجل إيرث يعرض صوراً فضائية حقيقية لسهول ستونهنج ومعالم الحماية الجغرافية المحيطة بها." 
                      : "Google Earth satellite feed displays high-fidelity real aerial terrain photography of Stonehenge and surroundings."
                    }
                  </span>
                </div>
              </div>
            ) : (
              <div className="lg:col-span-8 p-6 bg-slate-950 border-transparent relative overflow-hidden flex flex-col justify-between min-h-[420px] lg:min-h-0 select-none">
                {/* Starry/Mesh Overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

                {/* Map HUD overlay labels */}
                <div className="absolute top-4 left-4 z-10 bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-slate-800/80 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[10px] font-mono text-slate-400 font-extrabold uppercase tracking-widest">
                    {language === "ar" ? "رادار المراقبة النشط" : "LIVE TARGET ACQUISITION RADAR"}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 font-bold border-l border-slate-800 pl-2">
                    Z: {mapZoom.toFixed(1)}x
                  </span>
                </div>

                {/* Angle HUD indicators */}
                <div className="absolute bottom-4 right-4 z-10 hidden sm:flex items-center gap-4 bg-slate-900/40 px-3 py-1 text-[9px] text-slate-500 font-mono font-bold rounded-xl border border-slate-800/40">
                  <span>GEO-LOC: {geofenceCenter.lat.toFixed(4)}°N, {geofenceCenter.lng.toFixed(4)}°W</span>
                </div>

                {/* Backdrop Layer Switcher */}
                <div className="absolute bottom-4 left-4 z-10 flex items-center bg-slate-900/90 backdrop-blur-md p-1 rounded-2xl border border-slate-800/80 select-none">
                  <span className="text-[9px] font-mono text-slate-400 font-black px-2 uppercase tracking-widest">
                    {language === "ar" ? "الرادار:" : "Radar Mode:"}
                  </span>
                  <div className="flex bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                    <button
                      onClick={() => setRadarBackdrop('blueprint')}
                      className={cn(
                        "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        radarBackdrop === 'blueprint'
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-300"
                      )}
                    >
                      {language === "ar" ? "رادار ذكي" : "HUD Vector"}
                    </button>
                    <button
                      onClick={() => setRadarBackdrop('satellite')}
                      className={cn(
                        "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        radarBackdrop === 'satellite'
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-300"
                      )}
                    >
                      {language === "ar" ? "قمر صناعي" : "Satellite"}
                    </button>
                  </div>
                </div>

                {/* Zoom Buttons overlay */}
                <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-2xl border border-slate-800/80">
                  <button
                    onClick={() => setMapZoom(prev => Math.min(prev + 0.25, 4.0))}
                    className="p-1 px-2.5 text-slate-300 hover:text-white hover:bg-slate-800 text-[10px] font-black rounded-lg transition-colors cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn size={12} />
                  </button>
                  <div className="w-px h-3 bg-slate-800" />
                  <button
                    onClick={() => setMapZoom(prev => Math.max(prev - 0.25, 0.5))}
                    className="p-1 px-2.5 text-slate-300 hover:text-white hover:bg-slate-800 text-[10px] font-black rounded-lg transition-colors cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut size={12} />
                  </button>
                  <div className="w-px h-3 bg-slate-800" />
                  <button
                    onClick={() => setMapZoom(1.0)}
                    className="p-1 px-2 text-slate-300 hover:text-white hover:bg-slate-800 text-[10px] font-black rounded-lg transition-colors cursor-pointer"
                    title="Reset Zoom"
                  >
                    <RotateCcw size={11} />
                  </button>
                </div>

                {/* Main SVG Radar Drawing */}
                <div className="flex-1 w-full bg-slate-950/40 relative border border-slate-900/40 rounded-[2rem] overflow-hidden flex items-center justify-center min-h-[380px]">
                  <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 500 500"
                    id="dashboard-floorplan"
                    className="absolute inset-0 select-none cursor-pointer"
                  >
                    {/* Satellite Backdrop Layer */}
                    {radarBackdrop === 'satellite' && (
                      <image
                        href={satelliteMapUrl}
                        x="0"
                        y="0"
                        width="500"
                        height="500"
                        opacity="0.75"
                      />
                    )}

                    {/* Outer Stonehenge Circle Bank */}
                    <circle cx="250" cy="250" r="190" fill="none" stroke="#22c55e" strokeWidth="1" strokeDasharray="3 6" opacity="0.12" />
                    <circle cx="250" cy="250" r="160" fill="none" stroke="#64748b" strokeWidth="1.2" opacity="0.08" />

                    {/* Concentric Guide Circles indicating metrics */}
                    {(() => {
                      const extent = mapExtent;
                      const ranges = [extent * 0.25, extent * 0.5, extent * 0.75, extent * 1.0];
                      return (
                        <g className="pointer-events-none">
                          {/* Axes Crosshairs */}
                          <line x1="250" y1="20" x2="250" y2="480" stroke="#334155" strokeWidth="1" strokeDasharray="4 6" opacity="0.25" />
                          <line x1="20" y1="250" x2="480" y2="250" stroke="#334155" strokeWidth="1" strokeDasharray="4 6" opacity="0.25" />

                          {/* concentric circle guide lines */}
                          {ranges.map((dist, idx) => {
                            const r_px = (dist / extent) * 250;
                            return (
                              <g key={idx}>
                                <circle cx="250" cy="250" r={r_px} fill="none" stroke="#1e293b" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.4" />
                                <text x="255" y={250 - r_px + 12} fill="#475569" className="text-[8px] font-mono font-bold select-none" opacity="0.45">
                                  {Math.round(dist)}m
                                </text>
                              </g>
                            );
                          })}

                          {/* Stonehenge stones concentric blueprint */}
                          <g opacity={radarBackdrop === 'satellite' ? "0.15" : "0.25"}>
                            {/* Inner Circle Pillars */}
                            {Array.from({ length: 12 }).map((_, i) => {
                              const angle = (i * 2 * Math.PI) / 12;
                              const radius = 55;
                              const x = 250 + radius * Math.cos(angle);
                              const y = 250 + radius * Math.sin(angle);
                              return (
                                <rect
                                  key={`d_stone_inner_${i}`}
                                  x={x - 3}
                                  y={y - 5}
                                  width="6"
                                  height="10"
                                  rx="1.5"
                                  fill="#4f46e5"
                                  transform={`rotate(${(angle * 180) / Math.PI}, ${x}, ${y})`}
                                />
                              );
                            })}
                            {/* Outer Stone Pillars */}
                            {Array.from({ length: 20 }).map((_, i) => {
                              const angle = (i * 2 * Math.PI) / 20;
                              const radius = 95;
                              const x = 250 + radius * Math.cos(angle);
                              const y = 250 + radius * Math.sin(angle);
                              return (
                                <rect
                                  key={`d_stone_outer_${i}`}
                                  x={x - 4}
                                  y={y - 8}
                                  width="8"
                                  height="16"
                                  rx="2"
                                  fill="#6366f1"
                                  transform={`rotate(${(angle * 180) / Math.PI}, ${x}, ${y})`}
                                />
                              );
                            })}
                          </g>

                          {/* Geofence circular perimeter limits */}
                          {(() => {
                            const rad_px = (geofenceRadius / extent) * 250;
                            return (
                              <g>
                                <circle
                                  cx="250"
                                  cy="250"
                                  r={rad_px}
                                  fill="none"
                                  stroke="#6366f1"
                                  strokeWidth="1.2"
                                  strokeDasharray="5 5"
                                  opacity="0.4"
                                />
                                <text
                                  x="250"
                                  y={250 - rad_px - 6}
                                  textAnchor="middle"
                                  fill="#818cf8"
                                  className="text-[8px] font-black uppercase tracking-wider select-none"
                                  opacity="0.35"
                                >
                                  {language === "ar" ? "سياج الأمان المعيّن" : "Secured Perimeter"}
                                </text>
                              </g>
                            );
                          })()}

                          {/* Centerpoint Stonehenge monument badge */}
                          <g transform="translate(250, 250)">
                            <circle r="7" fill="#6366f1" stroke="#ffffff" strokeWidth="1.5" opacity="0.9" />
                            <circle r="14" fill="none" stroke="#6366f1" strokeWidth="1" className="animate-pulse" opacity="0.5" />
                          </g>
                        </g>
                      );
                    })()}

                    {/* ACTIVE PLOTTED PIN MARKERS */}
                    {(() => {
                      const extent = mapExtent;

                      return (
                        <g id="plotted-pins-dashboard">
                          {combinedPins.map((pin) => {
                            const x_px = 250 + (pin.dx / extent) * 250;
                            const y_px = 250 - (pin.dy / extent) * 250;
                            
                            const isSelected = selectedPin?.id === pin.id;
                            const isStaff = pin.pinType === 'staff';
                            
                            // Styling for pins
                            const indicatorColor = isStaff 
                              ? (pin.userRole === "manager" || pin.userRole === "admin" ? "#6366f1" : "#10b981") 
                              : (pin.severity === "High" || pin.severity === "Critical" || pin.severity === "critical" ? "#ef4444" : "#f59e0b");

                            return (
                              <g
                                key={pin.id}
                                transform={`translate(${x_px}, ${y_px})`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPin(pin);
                                }}
                                className="cursor-pointer group"
                              >
                                {/* Selection spin circle */}
                                {isSelected ? (
                                  <circle r="22" fill="none" stroke={indicatorColor} strokeWidth="1.5" strokeDasharray="3 2" className="animate-spin" style={{ animationDuration: '8s' }} />
                                ) : (
                                  <circle r="16" fill="none" stroke={indicatorColor} strokeWidth="1" opacity="0" className="group-hover:opacity-100 group-hover:scale-110 transition-all duration-250" />
                                )}

                                {/* Alert Ring for Breaches or Critical incidents */}
                                {isStaff ? (
                                  pin.distance > geofenceRadius ? (
                                    <>
                                      <circle r="18" fill="none" stroke="#ef4444" strokeWidth="1" className="animate-ping" style={{ animationDuration: '2.5s' }} />
                                      <circle r="12" fill="#ef4444" fillOpacity="0.12" />
                                    </>
                                  ) : (
                                    <circle r="11" fill="none" stroke="#10b981" strokeWidth="1.2" className="animate-pulse" />
                                  )
                                ) : (
                                  <circle r="18" fill="none" stroke={indicatorColor} strokeWidth="1.5" className="animate-ping" style={{ animationDuration: '1.8s' }} />
                                )}

                                {/* Pin Solid Center */}
                                <circle
                                  r="10"
                                  fill={indicatorColor}
                                  stroke="#ffffff"
                                  strokeWidth="2"
                                  className="shadow-md"
                                />

                                {/* Key Character/Icon Badge */}
                                <text y="3.5" textAnchor="middle" fill="#ffffff" className="text-[9px] font-black">
                                  {isStaff ? pin.name.charAt(0) : "!"}
                                </text>

                                {/* Simple Title */}
                                <title>
                                  {pin.name}\n
                                  {isStaff ? `${pin.department} (${pin.userRole})` : `${language === "ar" ? "بلاغ خطير" : "Ground Incident"}: ${pin.severity}`}
                                </title>
                              </g>
                            );
                          })}
                        </g>
                      );
                    })()}
                  </svg>

                  {/* Legend indicator bar overlay */}
                  <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-md border border-slate-800/80 px-3.5 py-1.5 rounded-2xl flex flex-wrap items-center gap-3.5 text-[9px] font-black uppercase tracking-wider text-slate-400 select-none max-w-[90%]">
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] border border-white" />
                      <span>{language === "ar" ? "موظف ميداني" : "Field Ranger"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#6366f1] border border-white" />
                      <span>{language === "ar" ? "مشرف" : "Supervisor"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] border border-white" />
                      <span>{language === "ar" ? "بلاغ عادي" : "Warning Alert"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] border border-white animate-pulse" />
                      <span>{language === "ar" ? "بلاغ حرج" : "Critical Incident"}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Right side: Search, Filters list or Details dashboard Panel */}
            <div className="lg:col-span-4 p-6 bg-white flex flex-col justify-start">
              {/* Detailed view panel if a pin is active */}
              {selectedPin ? (
                <div id="selected-pin-details-panel" className="space-y-6 text-start flex-1 flex flex-col justify-between">
                  <div className="space-y-5">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-3 rounded-2xl",
                          selectedPin.pinType === 'staff' ? "bg-indigo-50 text-indigo-600" : "bg-red-50 text-red-600"
                        )}>
                          {selectedPin.pinType === 'staff' ? <Users size={20} /> : <ShieldAlert size={20} />}
                        </div>
                        <div>
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                            selectedPin.pinType === 'staff' 
                              ? (selectedPin.distance > geofenceRadius ? "bg-rose-50 text-rose-600 border border-rose-200 animate-pulse" : "bg-emerald-50 text-emerald-600 border border-emerald-100")
                              : (selectedPin.severity === "High" || selectedPin.severity === "Critical" || selectedPin.severity === "critical" ? "bg-red-50 text-red-600 border border-red-150 font-black animate-pulse" : "bg-amber-50 text-amber-600 border border-amber-100")
                          )}>
                            {selectedPin.pinType === 'staff' 
                              ? (selectedPin.distance > geofenceRadius ? (language === "ar" ? "خارج النطاق المعيّن" : "BREACH RANGE") : (language === "ar" ? "داخل النطاق الآمن" : "INSIDE RANGE"))
                              : (language === "ar" ? "بلاغ نشط" : "ACTIVE ALARM")
                            }
                          </span>
                          <h4 className="font-black text-slate-800 text-base mt-1 leading-snug">{selectedPin.name}</h4>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setSelectedPin(null)}
                        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                        title="Close details"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="border-t border-slate-100 pt-4 space-y-4">
                      {/* Staff Details */}
                      {selectedPin.pinType === 'staff' && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">{language === "ar" ? "الدور الوظيفي" : "Operational Role"}</span>
                              <span className="text-xs font-bold text-slate-700 capitalize">{selectedPin.userRole}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">{language === "ar" ? "القسم المشرف" : "Department"}</span>
                              <span className="text-xs font-semibold text-slate-600 truncate block">{tData(selectedPin.department)}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">{language === "ar" ? "المسافة من المركز" : "Distance to Geocenter"}</span>
                              <span className="text-xs font-mono font-black text-slate-700">{Math.round(selectedPin.distance)} meters</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">{language === "ar" ? "دقة الرصد" : "Tracker Accuracy"}</span>
                              <span className="text-xs font-mono font-bold text-slate-500">±{selectedPin.accuracy || 10}m</span>
                            </div>
                          </div>

                          {selectedPin.notes && (
                            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                              <span className="text-[9px] text-indigo-600 font-black uppercase tracking-widest block mb-1">{language === "ar" ? "مذكرة الخدمة الميدانية" : "Deployment Notes"}</span>
                              <p className="text-xs text-slate-600 font-medium leading-relaxed italic">"{selectedPin.notes}"</p>
                            </div>
                          )}
                        </>
                      )}

                      {/* Incident Details */}
                      {selectedPin.pinType === 'incident' && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">{language === "ar" ? "نوع البلاغ" : "Alarm Category"}</span>
                              <span className="text-xs font-bold text-slate-700">{tData(selectedPin.type || "Special Operations")}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">{language === "ar" ? "الموقع" : "Location"}</span>
                              <span className="text-xs font-semibold text-slate-600">{tData(selectedPin.location || "Central Compound")}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">{language === "ar" ? "مستوى الخطورة" : "Severity Level"}</span>
                              <span className={cn(
                                "text-xs font-mono font-black",
                                selectedPin.severity === "High" || selectedPin.severity === "Critical" || selectedPin.severity === "critical" ? "text-red-550 text-red-600" : "text-amber-500"
                              )}>{tData(selectedPin.severity || "Medium")}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">{language === "ar" ? "المبلغ عنه بواسطة" : "Logged Agent"}</span>
                              <span className="text-xs font-bold text-slate-600 truncate block">{tData(selectedPin.reported_by || "System Monitor")}</span>
                            </div>
                          </div>

                          {selectedPin.description && (
                            <div className="p-3 bg-red-50/10 border border-red-100/50 rounded-xl">
                              <span className="text-[9px] text-red-500 font-black uppercase tracking-widest block mb-1">{language === "ar" ? "تفاصيل البلاغ والاحتياطات" : "Incident Details"}</span>
                              <p className="text-xs text-slate-700 font-medium leading-relaxed">{tData(selectedPin.description)}</p>
                            </div>
                          )}

                          {selectedPin.image_url && (
                            <div className="rounded-xl overflow-hidden border border-slate-150">
                              <img referrerPolicy="no-referrer" src={selectedPin.image_url} alt="Incident Field Snapshot" className="h-28 w-full object-cover" />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 space-y-3">
                    {selectedPin.pinType === 'staff' && selectedPin.distance > geofenceRadius && (
                      <button
                        onClick={() => handleVerifyStaffSafety(selectedPin.user_id || selectedPin.id.replace('staff_', '').replace('log_', ''), selectedPin.name)}
                        className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer text-center shadow-lg shadow-rose-600/20 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <UserCheck size={13} />
                        {language === "ar" ? "تفويض الأمان وحل التجاوز يدوياً" : "Verify Safety & Resolve Breach"}
                      </button>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setMapTabView('radar'); // direct to active radar map
                          setMapZoom(2.2);
                          toast.info(language === "ar" ? `تم تسليط بؤرة المتابعة المباشرة على ${selectedPin.name}` : `Active focus directed onto ${selectedPin.name} direct coordinates`);
                        }}
                        className="flex-1 py-3 border border-slate-200 text-indigo-600 hover:bg-indigo-50/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer text-center font-bold flex items-center justify-center gap-1.5"
                      >
                        <Navigation size={11} className="text-indigo-500 animate-pulse" />
                        {language === "ar" ? "تحديد على الخريطة" : "Focus on Radar"}
                      </button>
                      <button
                        onClick={() => setSelectedPin(null)}
                        className="px-5 py-3 bg-slate-950 text-white hover:bg-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer text-center font-bold"
                      >
                        {language === "ar" ? "إغلاق التفاصيل" : "Close Details"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div id="pin-explorer-panel" className="text-start flex flex-col justify-between flex-1 space-y-4">
                  {/* Search and Filter HUD */}
                  <div className="space-y-3.5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                        type="text"
                        placeholder={language === "ar" ? "البحث عن موظف أو بلاغ..." : "Search staff or incident..."}
                        value={mapSearch}
                        onChange={(e) => setMapSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-150 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-semibold text-xs text-slate-700"
                      />
                    </div>
                    
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block">
                      {language === "ar" ? "قائمة العناصر المحددة" : "DEPLOYED RESOURCE LOGS"} ({combinedPins.length})
                    </span>
                  </div>

                  {/* Scrolling Feed of items */}
                  <div className="flex-1 overflow-y-auto max-h-[300px] divide-y divide-slate-100 pr-1 select-none">
                    {combinedPins.length > 0 ? (
                      combinedPins.map((pin) => {
                        const isStaff = pin.pinType === 'staff';
                        return (
                          <div
                            key={pin.id}
                            onClick={() => setSelectedPin(pin)}
                            className="py-3 flex items-center justify-between group hover:bg-slate-50/50 rounded-lg px-2 -mx-2 transition-all cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={cn(
                                "w-2.5 h-2.5 rounded-full shrink-0",
                                isStaff 
                                  ? (pin.distance > geofenceRadius ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.4)]" : "bg-emerald-500")
                                  : (pin.severity === "High" || pin.severity === "Critical" || pin.severity === "critical" ? "bg-red-500 animate-pulse" : "bg-amber-400")
                              )} />
                              
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-800 truncate group-hover:text-indigo-650 group-hover:text-indigo-600 transition-colors font-bold">{pin.name}</p>
                                <p className="text-[10px] font-medium text-slate-400 truncate">
                                  {isStaff ? tData(pin.department) : tData(pin.location || "Ground")}
                                </p>
                              </div>
                            </div>
                            
                            <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-md shrink-0">
                              {isStaff ? `${Math.round(pin.distance)}m` : (language === "ar" ? "بلاغ" : "Alarm")}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-12 text-center text-slate-300 flex flex-col items-center justify-center">
                        <Compass className="animate-spin mb-2 text-slate-200" size={32} style={{ animationDuration: '6s' }} />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {language === "ar" ? "لا توجد تطابقات للبحث" : "NO ACTIVE ELEMENTS PLOTTED"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Collapsible Telemetry Simulation Controller */}
                  <div className="border border-slate-250 border-slate-200 rounded-2xl overflow-hidden select-none transition-all duration-300">
                    <button
                      onClick={() => setIsSimCardExpanded(!isSimCardExpanded)}
                      className="w-full flex items-center justify-between p-3.5 bg-slate-50 text-slate-700 hover:bg-slate-100/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Radio size={14} className={cn("text-indigo-600", telemetryTriggerLoading && "animate-pulse")} />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          {language === "ar" ? "📡 محاكاة الإشارة اللاسلكية للموظف" : "📡 Telemetry Simulation Tool"}
                        </span>
                      </div>
                      <span className="text-slate-400 text-xs font-bold font-mono">
                        {isSimCardExpanded ? "−" : "+"}
                      </span>
                    </button>
                    
                    {isSimCardExpanded && (
                      <div className="p-4 bg-white border-t border-slate-100 space-y-4 text-start">
                        {/* Selected Staff */}
                        <div className="space-y-1">
                          <label className="text-[8px] font-mono uppercase tracking-widest text-slate-400 block font-black">
                            {language === "ar" ? "حدد الموظف الميداني لتعديل موقعه" : "Onsite Teammate"}
                          </label>
                          <select
                            value={simSelectedUserId}
                            onChange={(e) => setSimSelectedUserId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-150 rounded-xl px-2.5 py-2 text-xs text-slate-750 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                          >
                            <option value="">{language === "ar" ? "-- اختر عضواً --" : "-- Choose Teammate --"}</option>
                            {staff.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.department || "Onsite Role"})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Location / Waypoint Type */}
                        <div className="space-y-1">
                          <label className="text-[8px] font-mono uppercase tracking-widest text-slate-400 block font-black">
                            {language === "ar" ? "نقطة المرور الجغرافية المحددة" : "Simulated GPS Waypoint"}
                          </label>
                          <select
                            value={simLocationType}
                            onChange={(e) => setSimLocationType(e.target.value as any)}
                            className="w-full bg-slate-50 border border-slate-150 rounded-xl px-2.5 py-2 text-xs text-slate-750 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                          >
                            <option value="inside">🟢 {language === "ar" ? "داخل حدود الموقع الآمنة" : "Inside Safe Monuments Perimeter"}</option>
                            <option value="west_breach">🚨 {language === "ar" ? "تجاوز الحدود - التلال الغربية" : "West Wood Ridge Breach (BREACH)"}</option>
                            <option value="north_breach">🚨 {language === "ar" ? "تجاوز الحدود - تقاطع A303 الشمالي" : "A303 North Crossing (BREACH)"}</option>
                            <option value="south_breach">🚨 {language === "ar" ? "تجاوز الحدود - سهول نورمانتون" : "Normanton Plains South (BREACH)"}</option>
                          </select>
                        </div>

                        {/* Custom notes */}
                        <div className="space-y-1">
                          <label className="text-[8px] font-mono uppercase tracking-widest text-slate-400 block font-black">
                            {language === "ar" ? "ملاحظة البث الإضافية (اختياري)" : "Simulation Dispatch Memo"}
                          </label>
                          <input
                            type="text"
                            placeholder={language === "ar" ? "الرصد اللاسلكي..." : "e.g. Setting up camera sensor..."}
                            value={simCustomNotes}
                            onChange={(e) => setSimCustomNotes(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-150 rounded-xl px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                          />
                        </div>

                        {/* Trigger button */}
                        <button
                          onClick={handleTriggerSimulation}
                          disabled={telemetryTriggerLoading}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Radio size={12} className={cn("text-white", telemetryTriggerLoading && "animate-ping")} />
                          {telemetryTriggerLoading 
                            ? (language === "ar" ? "تحديث البث اللاسلكي..." : "Broadcasting Live GPS...") 
                            : (language === "ar" ? "بث إشارة الرصد اللاسلكي" : "Broadcast Simulated GPS Coordinate")}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* General site radar brief indicator */}
                  <div className="p-4 bg-indigo-50/40 border border-indigo-100/50 rounded-2xl select-none mt-auto">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Compass size={14} className="text-indigo-600 animate-spin" style={{ animationDuration: '24s' }} />
                      <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">{language === "ar" ? "نظرة عامة على الرصد" : "RADAR OPERATIONAL STATUS"}</span>
                    </div>
                    <p className="text-[11px] font-medium text-indigo-800 leading-relaxed">
                      {language === "ar" ? (
                        `يتم تتبع ${onlineStaff} موظفين ميدانيين نشطين. توجد حالياً ${projectedIncidents.length} حوادث مفتوحة مبرمجة في منطقة العمل الآمنة.`
                      ) : (
                        `Actively tracking ${onlineStaff} members on shift. Currently ${projectedIncidents.length} pending incident coordinates mapped.`
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Secondary Info Grid */}
        <div className="md:col-span-8 mission-control-card min-h-[400px]">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-900">
                {language === "ar" ? "سجل التشغيل الميداني" : "Operational Log"}
              </h3>
              <p className="text-sm text-slate-400 font-medium">
                {language === "ar" ? "متابعة وتوثيق التحركات الميدانية الحرجة" : "Tracking critical site movements"}
              </p>
            </div>
            <div className="flex gap-2">
               <button className="p-2 hover:bg-slate-50 rounded-lg border border-slate-100 transition-colors">
                 <Clock size={18} className="text-slate-400" />
               </button>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {tasks.length > 0 ? (
              tasks.slice(0, 5).map((task) => (
                <div key={task.id} className="p-6 flex items-center justify-between group hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-6">
                    <div className="hidden sm:block text-right min-w-[80px]">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                        {language === "ar" ? "مسجل" : "Recorded"}
                      </p>
                      <p className="text-xs font-mono text-slate-400">{new Date(task.created_at?.seconds * 1000 || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">{tData(task.title)}</p>
                      <p className="text-xs text-slate-500 font-medium">{tData(task.assigned_name || 'System')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      task.priority === 'high' ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"
                    )}>
                      {task.priority === 'high' ? (language === "ar" ? "عالية" : "High") : (language === "ar" ? "عادية" : "Normal")}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center flex flex-col items-center justify-center opacity-20">
                <Activity size={48} className="mb-4" />
                <p className="font-black uppercase tracking-widest text-xs">
                  {language === "ar" ? "بانتظار موافاة البيانات..." : "Awaiting Site Data"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Site Vitals Card */}
        <div className="md:col-span-4 mission-control-card flex flex-col min-h-[400px]">
          <div className="p-8 border-b border-slate-100 bg-slate-50/30">
            <h3 className="text-xl font-black text-slate-900">
              {language === "ar" ? "المؤشرات الحيوية" : "Site Vitals"}
            </h3>
            <p className="text-sm text-slate-400 font-medium">
              {language === "ar" ? "البيئة وحالة الأصول العامة" : "Environmental & Asset Status"}
            </p>
          </div>
          <div className="p-8 space-y-8 flex-1">
            <div className="space-y-4">
               {siteStatus.map((status) => {
                 const parsedVal = parseInt(status.value as string);
                 const barWidth = isNaN(parsedVal) ? 100 : Math.min(100, Math.max(0, parsedVal));
                 
                 // Translate keys
                 const keyName = formatKey(status.key);
                 const translatedKey = language === "ar" ? (
                   status.key === 'hvac' || keyName.toLowerCase().includes('hvac') ? 'مستوى التكييف' :
                   status.key === 'power' || keyName.toLowerCase().includes('power') ? 'شبكة الطاقة' :
                   status.key === 'network' || keyName.toLowerCase().includes('network') ? 'إشارة الشبكة' :
                   status.key === 'water' || keyName.toLowerCase().includes('water') ? 'إمدادات المياه' :
                   status.key === 'noise' || keyName.toLowerCase().includes('noise') ? 'مستوى الضجيج' :
                   status.key === 'air' || keyName.toLowerCase().includes('air') ? 'جودة الهواء' : keyName
                 ) : keyName;

                 return (
                  <div key={status.key} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{translatedKey}</span>
                      <span className={cn("text-xs font-bold", getStatusColor(status.status_level))}>{tData(status.value)}</span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        className={cn("h-full", 
                          status.status_level === 'critical' ? 'bg-red-500' : 
                          status.status_level === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                        )} 
                      />
                    </div>
                  </div>
                 );
               })}
            </div>

            <div className="pt-8 border-t border-slate-100 mt-auto">
               <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={14} className="text-emerald-600" />
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                      {language === "ar" ? "رؤية استراتيجية" : "Strategic Insight"}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                    {language === "ar" ? (
                      <>
                        مؤشر حركة الزوار {liveModel.label === 'Normal' ? 'مستقر حالياً' : 'يشير إلى تغير مستمر'}. 
                        يُنصح بتوجيه الموارد للتركيز على {liveModel.label === 'Peak' ? 'تنظيم التدفق وتأمين المنافذ' : 'أعمال التهيئة والصيانة الدورية'}.
                      </>
                    ) : (
                      <>
                        Visitor pulse is {liveModel.label === 'Normal' ? 'stable' : 'shifting'}. 
                        Resource allocation should prioritize {liveModel.label === 'Peak' ? 'security and flow' : 'maintenance and prep'}.
                      </>
                    )}
                  </p>
               </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
