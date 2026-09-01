import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  Timestamp,
  getDocs
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { 
  Sparkles, 
  FileText, 
  CheckCircle, 
  Clock, 
  ShieldAlert, 
  Plus, 
  Trash2, 
  Printer, 
  Save, 
  Signature, 
  Activity, 
  ArrowRightLeft, 
  ChevronDown, 
  ChevronUp, 
  CheckSquare, 
  FileWarning, 
  MapPin, 
  Lock, 
  AlertCircle 
} from "lucide-react";
import { toast } from "sonner";

interface Incident {
  id: string;
  type: string;
  description: string;
  severity: string;
  status: string;
  location?: string;
  created_at: any;
  reported_by?: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: "pending" | "completed";
  priority: string;
  assigned_to?: string;
  created_at: any;
}

interface ClockLog {
  user_name: string;
  type: string;
  timestamp: any;
  latitude: number | null;
  longitude: number | null;
  department?: string;
}

interface GateLog {
  type: "entry" | "exit";
  timestamp: any;
}

interface HandoverReport {
  id?: string;
  outgoing_shift_name: string;
  incoming_shift_name: string;
  date: string;
  outgoing_supervisor: string;
  incoming_supervisor: string;
  summary: string;
  incidents_summary: string;
  tasks_summary: string;
  geofence_summary: string;
  gate_activity_summary: string;
  special_instructions: string;
  safety_focus: string;
  checklist: Array<{ task: string; completed: boolean; verified_by?: string }>;
  additional_notes: string;
  status: "draft" | "submitted" | "signed_off";
  created_at: any;
  created_by_name: string;
  created_by_uid: string;
  signed_off_by_name?: string | null;
  signed_off_by_uid?: string | null;
  signed_off_at?: any | null;
}

const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Radius of the Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function Handover() {
  const { user: currentUser } = useAuth();
  const { language, dir, t, tData } = useLanguage();

  // App state
  const [reports, setReports] = useState<HandoverReport[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<HandoverReport | null>(null);
  
  // Real-time telemetry counters for current shift
  const [currentIncidents, setCurrentIncidents] = useState<Incident[]>([]);
  const [currentTasks, setCurrentTasks] = useState<Task[]>([]);
  const [currentClockLogs, setCurrentClockLogs] = useState<ClockLog[]>([]);
  const [currentGateActivity, setCurrentGateActivity] = useState<{ entries: number; exits: number }>({ entries: 0, exits: 0 });
  const [geofenceBreachCount, setGeofenceBreachCount] = useState(0);

  // Form states for creating/editing reports
  const [outgoingShift, setOutgoingShift] = useState("Night Shift");
  const [incomingShift, setIncomingShift] = useState("Day Shift");
  const [dateStr, setDateStr] = useState(new Date().toISOString().substring(0, 10));
  const [incomingSupervisor, setIncomingSupervisor] = useState("");
  const [userCustomNote, setUserCustomNote] = useState("");

  // Report details currently being built or reviewed
  const [draftSummary, setDraftSummary] = useState("");
  const [draftIncSummary, setDraftIncSummary] = useState("");
  const [draftTaskSummary, setDraftTaskSummary] = useState("");
  const [draftGeofenceSummary, setDraftGeofenceSummary] = useState("");
  const [draftGateSummary, setDraftGateSummary] = useState("");
  const [draftInstructions, setDraftInstructions] = useState("");
  const [draftSafetyFocus, setDraftSafetyFocus] = useState("");
  const [draftChecklist, setDraftChecklist] = useState<Array<{ task: string; completed: boolean; verified_by?: string }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Co-signature verification state
  const [signatureName, setSignatureName] = useState("");

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Local Arabic/English labels dictionary for high-fidelity bilingual support
  const localLabels: Record<string, Record<string, string>> = {
    en: {
      section_title: "Smart Shift Handover Reports",
      section_subtitle: "Assemble, finalize, and securely sign off on shift operational transitions backed by Gemini AI.",
      history: "Handover Records Log",
      create_new: "Initialize Shift Handover",
      setup: "Shift Configurations",
      telemetry_title: "Pre-assembled Shift Metadata",
      telemetry_subtitle: "Aggregated live operational records for the selected date.",
      generated_by_ai: "Generated by SiteOps Intelligence",
      total_incidents_logged: "Incidents logged during shift",
      total_tasks_tracked: "Tasks verified (pending/completed)",
      clock_ins_scanned: "Staff check-ins tracked",
      geofence_violations: "Geofence perimeter breaches",
      gate_exits: "Gate exits verified",
      gate_entries: "Gate entries verified",
      out_of_radius: "m out of boundary",
      generator_btn: "Synthesize Gemini AI Summary",
      custom_notes_label: "Supervisor's Critical Notes (Optional)",
      custom_notes_placeholder: "Type specific highlights, temporary instructions, or unexpected incidents to contextually guide the AI report writer...",
      summary_fields: "Shift Synthesis Reports",
      summary_field: "Executive Shift Summary",
      inc_field: "Incident Response Log",
      task_field: "Task Accomplishment Log",
      geofence_field: "Staff Attendance & Compliance Log",
      gate_field: "Footfall & Site Load Report",
      instructions_field: "Special Handoff Orders for Incoming Team",
      safety_field: "Operational Safety Focus",
      checklist_field: "Handover Operational Checklist",
      add_checklist_item: "Add Checklist Task",
      incoming_super_label: "Incoming Shift Supervisor Name",
      outgoing_super_label: "Outgoing Shift Supervisor",
      date_label: "Operational Handover Date",
      outgoing_shift_lbl: "Outgoing Operational Shift",
      incoming_shift_lbl: "Incoming Target Shift",
      save_as_draft: "Save Draft Report",
      submit_for_sign: "Authorize & Distribute",
      report_details: "Shift Handover Review",
      details: "Details Log",
      status_draft: "DRAFT",
      status_submitted: "AWAITING SIGN-OFF",
      status_signed: "COMPLETED & SIGNED",
      sign_off_title: "Incoming Supervisor Countersign",
      sign_off_desc: "Confirm review and command handover of all responsibilities and site security protocols.",
      sign_off_label: "Incoming Signature Confirmation",
      sign_off_placeholder: "Type your full name to electronically countersign...",
      authorize_btn: "✍️ Countersign & Close Handover",
      verified_by: "Verified by:",
      print_btn: "Print Handover Document",
      search_placeholder_local: "Search handover summaries, officers, or shifts...",
      no_reports: "No shift handover reports found. Initialize a new report above.",
      delete_success: "Report successfully discarded",
      save_success: "Report successfully saved as Draft",
      submit_success: "Report successfully authorized and published for sign-off",
      sign_success: "Shift Handover successfully closed and countersigned by incoming supervisor!",
      ai_error: "AI Generation error: Make sure GEMINI_API_KEY is configured",
      api_key_warn: "Gemini API key is missing. Fallback outline loaded.",
      checklist_task_placeholder: "Verify secondary keys, inspect radios, etc.",
      all_reports: "All Reports",
      drafts: "Drafts",
      awaiting: "Awaiting Sign-Off",
      completed: "Completed"
    },
    ar: {
      section_title: "تقارير وتقسيم المناوبات الذكي",
      section_subtitle: "تجميع، صياغة، والتوقيع الأمني على تسليم المناوبات بالاعتماد على ذكاء جيميناي.",
      history: "سجل تقارير تسليم المناوبات",
      create_new: "بدء تقرير تسليم مناوبة جديد",
      setup: "إعدادات وتفاصيل المناوبة",
      telemetry_title: "البيانات العملياتية المجمعة للمناوبة",
      telemetry_subtitle: "السجلات الميدانية الفورية الحالية للتاريخ واليوم المحدد.",
      generated_by_ai: "صيغ بواسطة ذكاء النظام (جيميناي)",
      total_incidents_logged: "الحوادث المرصودة خلال المناوبة",
      total_tasks_tracked: "المهام والعمليات التشغيلية المتابعة",
      clock_ins_scanned: "عمليات تسجيل حضور وغياب الحراس",
      geofence_violations: "اختراقات النطاق الأمني الجغرافي",
      gate_exits: "إجمالي عمليات الخروج المسجلة للبوابات",
      gate_entries: "إجمالي عمليات الدخول المسجلة للبوابات",
      out_of_radius: "متر خارج نطاق الحماية",
      generator_btn: "توليد ملخص جيميناي الذكي",
      custom_notes_label: "ملاحظات وتوجيهات المشرف الإضافية (اختياري)",
      custom_notes_placeholder: "اكتب تفاصيل خاصة، حوادث غير متوقعة، أو توجيهات لمركز استقبال ذكاء جيميناي ليدمجها بالتقرير...",
      summary_fields: "تقارير وملخصات المناوبة والعمليات",
      summary_field: "الملخص التنفيذي للمناوبة",
      inc_field: "تقرير الاستجابة والمخاطر الأمنية",
      task_field: "تقرير إنجاز المهام والبروتوكولات",
      geofence_field: "تقرير الحضور والامتثال للموقع والحدود",
      gate_field: "تقرير الحركة وإقبال الزوار على الموقع",
      instructions_field: "أوامر وتكليفات خاصة للمناوبة القادمة",
      safety_field: "محور التركيز والسلامة المهنية للمناوبة",
      checklist_field: "قائمة التحقق الميدانية للمناوبة المستلمة",
      add_checklist_item: "إضافة مهمة لقائمة التحقق",
      incoming_super_label: "اسم مشرف المناوبة المستلمة (القادمة)",
      outgoing_super_label: "مشرف المناوبة المسلمة (الحالي)",
      date_label: "تاريخ عمليات تسليم المناوبة",
      outgoing_shift_lbl: "المناوبة المسلمة الحالية",
      incoming_shift_lbl: "المناوبة المستلمة القادمة",
      save_as_draft: "حفظ كمسودة عمليات",
      submit_for_sign: "اعتماد ونشر للتوقيع والمطابقة",
      report_details: "مراجعة تقرير تسليم المناوبة",
      details: "سجل التفاصيل والملخصات",
      status_draft: "مسودة",
      status_submitted: "في انتظار توقيع المستلم",
      status_signed: "مكتمل ومعتمد رسمياً",
      sign_off_title: "توقيع ومطابقة المشرف المستلم",
      sign_off_desc: "تأكيد الاطلاع ومطابقة المهام الميدانية والموافقة على استلام المسؤوليات الأمنية.",
      sign_off_label: "أدخل اسمك للتصديق الإلكتروني",
      sign_off_placeholder: "اكتب اسمك الثلاثي كاملاً للتوقيع الرقمي...",
      authorize_btn: "✍️ تصديق إلكتروني وإغلاق المناوبة",
      verified_by: "تم التحقق بواسطة:",
      print_btn: "طباعة وثيقة التسليم الرسمية",
      search_placeholder_local: "البحث في التقارير، المناوبات، أو أسماء الضباط...",
      no_reports: "لا توجد تقارير تسليم مناوبات حالية. ابدأ واحداً جديداً من الأعلى.",
      delete_success: "تم التخلص من مسودة التقرير بنجاح",
      save_success: "تم حفظ التقرير كمسودة تشغيلية بنجاح",
      submit_success: "تم نشر التقرير وتفويضه ليقوم المشرف القادم بالاطلاع والمطابقة والتوقيع",
      sign_success: "تم إغلاق وتسليم المناوبة رسمياً بال countersign الإلكتروني للمشرف المستلم!",
      ai_error: "فشل تجميع تقرير الذكاء الاصطناعي. تفقد مفتاح GEMINI_API_KEY",
      api_key_warn: "مفتاح جيميناي غير مهيأ. تم تحميل هيكل خارجي افتراضي.",
      checklist_task_placeholder: "فحص خزائن الأمن، مراجعة مفاتيح الدعم وغرفة اللاسلكي..",
      all_reports: "جميع التقارير",
      drafts: "المسودات",
      awaiting: "في انتظار التوقيع",
      completed: "المكتملة"
    }
  };

  const getLabel = (key: string): string => {
    const lang = language === "ar" ? "ar" : "en";
    return localLabels[lang][key] || key;
  };

  // 1. Fetch historical reports from Firestore
  useEffect(() => {
    const qReports = query(collection(db, "handover_reports"), orderBy("created_at", "desc"));
    const unsubscribe = onSnapshot(qReports, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HandoverReport[];
      setReports(list);
    });

    return () => unsubscribe();
  }, []);

  // 2. Telemetry Aggregator for the selected date
  useEffect(() => {
    if (!isCreating) return;

    // Build day bounds
    const baseDate = new Date(dateStr);
    const startOfDay = new Date(baseDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(baseDate.setHours(23, 59, 59, 999));

    // Fetch Incidents for date
    const qIncidents = query(collection(db, "incidents"), orderBy("created_at", "desc"));
    const unsubInc = onSnapshot(qIncidents, (snapshot) => {
      const filtered = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Incident))
        .filter(inc => {
          if (!inc.created_at) return false;
          // Verify if within day or within 24h
          const incDate = inc.created_at.toDate ? inc.created_at.toDate() : new Date(inc.created_at);
          return incDate >= startOfDay && incDate <= endOfDay;
        });
      setCurrentIncidents(filtered);
    });

    // Fetch Tasks for date
    const qTasks = query(collection(db, "tasks"), orderBy("created_at", "desc"));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      const filtered = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Task))
        .filter(t => {
          if (!t.created_at) return false;
          const taskDate = t.created_at.toDate ? t.created_at.toDate() : new Date(t.created_at);
          return taskDate >= startOfDay && taskDate <= endOfDay;
        });
      setCurrentTasks(filtered);
    });

    // Fetch Clock Logs & Geofence Breaches
    const qClock = query(collection(db, "clock_logs"));
    const unsubClock = onSnapshot(qClock, (snapshot) => {
      const savedCenter = localStorage.getItem("geofence_center");
      const center = savedCenter ? JSON.parse(savedCenter) : { lat: 51.1789, lng: -1.8262 };
      const savedRadius = localStorage.getItem("geofence_radius");
      const radius = savedRadius ? Number(savedRadius) : 150;

      let violations = 0;
      const filtered = snapshot.docs
        .map(doc => doc.data() as ClockLog)
        .filter(log => {
          if (!log.timestamp) return false;
          const logDate = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
          const matchDate = logDate >= startOfDay && logDate <= endOfDay;
          
          if (matchDate && log.latitude !== null && log.longitude !== null) {
            const distance = getHaversineDistance(log.latitude, log.longitude, center.lat, center.lng);
            if (distance > radius) {
              violations++;
            }
          }
          return matchDate;
        });

      setCurrentClockLogs(filtered);
      setGeofenceBreachCount(violations);
    });

    // Fetch Gate Entries Stats
    const qGate = query(collection(db, "gate_logs"));
    const unsubGate = onSnapshot(qGate, (snapshot) => {
      let entries = 0;
      let exits = 0;
      snapshot.docs.forEach(doc => {
        const log = doc.data() as GateLog;
        if (!log.timestamp) return;
        const logDate = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
        if (logDate >= startOfDay && logDate <= endOfDay) {
          if (log.type === "entry") entries++;
          if (log.type === "exit") exits++;
        }
      });
      setCurrentGateActivity({ entries, exits });
    });

    return () => {
      unsubInc();
      unsubTasks();
      unsubClock();
      unsubGate();
    };

  }, [isCreating, dateStr]);

  // 3. Smart AI Report synthesis method calling server backend
  const generateAISummaries = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/gemini/handover-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outgoing_shift_name: outgoingShift,
          incoming_shift_name: incomingShift,
          incidents: currentIncidents,
          tasks: currentTasks,
          clock_logs: currentClockLogs,
          gate_activity: {
            entries: currentGateActivity.entries,
            exits: currentGateActivity.exits,
            peak_info: `Checked entry records: total of ${currentGateActivity.entries} entries verified.`
          },
          additional_notes: userCustomNote,
          language: language === "ar" ? "ar" : "en"
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Backend failing");
      }

      const data = await response.json();
      
      // Update form highlights
      setDraftSummary(data.summary || "");
      setDraftIncSummary(data.incidents_summary || "");
      setDraftTaskSummary(data.tasks_summary || "");
      setDraftGeofenceSummary(data.geofence_summary || "");
      setDraftGateSummary(data.gate_activity_summary || "");
      setDraftInstructions(data.special_instructions || "");
      setDraftSafetyFocus(data.safety_focus || "");
      
      // Map suggested checklists
      if (data.suggested_checklist && Array.isArray(data.suggested_checklist)) {
        const items = data.suggested_checklist.map((task: string) => ({
          task,
          completed: false
        }));
        setDraftChecklist(items);
      } else {
        setDraftChecklist([]);
      }

      toast.success(language === "ar" ? "تم بنجاح استخلاص وصياغة ملخص التقرير الذكي!" : "AI synthesis successfully finalized!");
    } catch (error: any) {
      console.error(error);
      toast.error(getLabel("ai_error"));
      
      // Fallback draft template context to ensure usability even in case of connection limits/missing keys
      const fallbackSummary = language === "ar" 
        ? `تقرير تسليم المناوبة من مناوبة ${outgoingShift} لـ ${incomingShift} ليوم ${dateStr}. تمت إدارة العمليات بالكامل ومراجعة كتل الأبواب الدائرية وفحص السياج الجغرافي المعلمي.`
        : `Shift operations handover from ${outgoingShift} to ${incomingShift} on ${dateStr}. All standard security procedures performed and checkpoint gates verified under supervisor command.`;
      
      const fallbackInc = language === "ar"
        ? `الحوادث المسجلة خلال المناوبة: ${currentIncidents.length} حادث أمني وبلاغ.`
        : `Logged Incidents during outgoing period: ${currentIncidents.length} incidents resolved or escalated.`;

      const fallbackTask = language === "ar"
        ? `المهام والعمليات: تم التحقق من ${currentTasks.filter(t => t.status === 'completed').length} مهمة مكتملة، و ${currentTasks.filter(t => t.status === 'pending').length} قيد المتابعة.`
        : `Operational Tasks: verified ${currentTasks.filter(t => t.status === 'completed').length} completed tasks and ${currentTasks.filter(t => t.status === 'pending').length} pending actions.`;

      const fallbackGeofence = language === "ar"
        ? `حالة السياج الجغرافي: رصد ${geofenceBreachCount} مخالفات للحدود الجغرافية الرقمية المحددة.`
        : `Geofencing Perimeter logs: recorded total of ${geofenceBreachCount} boundary alerts inside coordinates buffer.`;

      const fallbackGate = language === "ar"
        ? `نشاطات البوابات وسعة الإشغال: تم رصد ${currentGateActivity.entries} إشارات دخول زوار و ${currentGateActivity.exits} عمليات خروج.`
        : `Gate flow activity logs: registered ${currentGateActivity.entries} guest credentials entered and ${currentGateActivity.exits} guest exits.`;

      const fallbackInstructions = language === "ar"
        ? "متابعة الممر الدائري والمحافظة على الالتزام السياحي، ومراقبة بوابات الإشغال الأثري."
        : "Maintain rigorous patrol routine at Stonehenge inner circle, verify radio check-ins hourly.";

      setDraftSummary(fallbackSummary);
      setDraftIncSummary(fallbackInc);
      setDraftTaskSummary(fallbackTask);
      setDraftGeofenceSummary(fallbackGeofence);
      setDraftGateSummary(fallbackGate);
      setDraftInstructions(fallbackInstructions);
      setDraftSafetyFocus(language === "ar" ? "التحقق الدقيق من سلامة الأسلاك الكهربائية المحيطة بمركز الزوار" : "Inspect trailing cords and verify wet-weather protocols around high-voltage equipment.");
      setDraftChecklist([
        { task: language === "ar" ? "فحص قراءة تصاريح دوريات اللاسلكي" : "Conduct mandatory tactical radio diagnostics", completed: false },
        { task: language === "ar" ? "تأمين وحصر حاملي المفاتيح الفرعية للبوابات" : "Verify site key custody with on-coming supervisor", completed: false },
        { task: language === "ar" ? "تعديل حلقة الحماية المحيطة بالأثر" : "Ensure secure rope boundary placements around standing stones", completed: false }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  // 4. Save report in Firestore
  const saveHandoverReport = async (status: "draft" | "submitted") => {
    if (!currentUser) return;
    
    if (status === "submitted" && !incomingSupervisor.trim()) {
      toast.error(language === "ar" ? "يرجى كتابة اسم المشرف القادم المفوض بالتوقيع" : "Please declare incoming supervisor name for verify protocol");
      return;
    }

    const payload: HandoverReport = {
      outgoing_shift_name: outgoingShift,
      incoming_shift_name: incomingShift,
      date: dateStr,
      outgoing_supervisor: currentUser.name,
      incoming_supervisor: incomingSupervisor || "Operational Shift Staff",
      summary: draftSummary,
      incidents_summary: draftIncSummary,
      tasks_summary: draftTaskSummary,
      geofence_summary: draftGeofenceSummary,
      gate_activity_summary: draftGateSummary,
      special_instructions: draftInstructions,
      safety_focus: draftSafetyFocus,
      checklist: draftChecklist,
      additional_notes: userCustomNote,
      status,
      created_at: Timestamp.now(),
      created_by_name: currentUser.name,
      created_by_uid: currentUser.id,
      signed_off_by_name: null,
      signed_off_by_uid: null,
      signed_off_at: null
    };

    try {
      await addDoc(collection(db, "handover_reports"), payload);
      toast.success(status === "draft" ? getLabel("save_success") : getLabel("submit_success"));
      setIsCreating(false);
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error(t("error"));
    }
  };

  // 5. Electronically countersign a submitted report
  const countersignReport = async () => {
    if (!selectedReport || !selectedReport.id || !currentUser) return;
    if (!signatureName.trim()) {
      toast.error(language === "ar" ? "يرجى كتابة اسمك الثلاثي كاملاً لتصديق المستند" : "Please write down your full name to certify signature validation");
      return;
    }

    try {
      const docRef = doc(db, "handover_reports", selectedReport.id);
      
      // Update local checklist status if we checked items during verification
      await updateDoc(docRef, {
        status: "signed_off",
        signed_off_by_name: signatureName,
        signed_off_by_uid: currentUser.id,
        signed_off_at: Timestamp.now(),
        checklist: selectedReport.checklist // Keeps updated checkmarks
      });

      toast.success(getLabel("sign_success"));
      setSelectedReport(null);
      setSignatureName("");
    } catch (e) {
      console.error(e);
      toast.error(t("error"));
    }
  };

  // Delete a report (only Admin/Manager or report creator draft)
  const discardReport = async (reportId: string, authorUid: string, status: string) => {
    if (!currentUser) return;
    
    // Check permission
    const canDelete = 
      currentUser.role === "admin" || 
      currentUser.role === "manager" || 
      (currentUser.id === authorUid && status === "draft");

    if (!canDelete) {
      toast.error(t("access_restricted"));
      return;
    }

    try {
      await deleteDoc(doc(db, "handover_reports", reportId));
      toast.success(getLabel("delete_success"));
      if (selectedReport?.id === reportId) {
        setSelectedReport(null);
      }
    } catch (e) {
      console.error(e);
      toast.error(t("error"));
    }
  };

  const resetForm = () => {
    setOutgoingShift("Night Shift");
    setIncomingShift("Day Shift");
    setDateStr(new Date().toISOString().substring(0, 10));
    setIncomingSupervisor("");
    setUserCustomNote("");
    setDraftSummary("");
    setDraftIncSummary("");
    setDraftTaskSummary("");
    setDraftGeofenceSummary("");
    setDraftGateSummary("");
    setDraftInstructions("");
    setDraftSafetyFocus("");
    setDraftChecklist([]);
  };

  const handleCustomChecklistToggle = (index: number) => {
    const updated = [...draftChecklist];
    updated[index].completed = !updated[index].completed;
    if (updated[index].completed && currentUser) {
      updated[index].verified_by = currentUser.name;
    } else {
      updated[index].verified_by = undefined;
    }
    setDraftChecklist(updated);
  };

  const handleReviewChecklistToggle = (index: number) => {
    if (!selectedReport) return;
    
    // Only allow checking if report is not fully signed off yet
    if (selectedReport.status === "signed_off") return;

    const list = [...selectedReport.checklist];
    list[index].completed = !list[index].completed;
    if (list[index].completed && currentUser) {
      list[index].verified_by = currentUser.name;
    } else {
      list[index].verified_by = undefined;
    }
    
    setSelectedReport({
      ...selectedReport,
      checklist: list
    });
  };

  const addNewChecklistTask = () => {
    setDraftChecklist([...draftChecklist, { task: "", completed: false }]);
  };

  const removeChecklistItem = (index: number) => {
    setDraftChecklist(draftChecklist.filter((_, i) => i !== index));
  };

  const triggerPrintLayout = () => {
    window.print();
  };

  // Search filter implementation
  const filteredReports = reports.filter(r => {
    const matchesSearch = 
      r.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.outgoing_supervisor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.incoming_supervisor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.outgoing_shift_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.incoming_shift_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = 
      statusFilter === "all" ||
      r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 bg-transparent print:bg-white print:p-0 print:m-0" id="smart-handover-panel">
      {/* Page Title Header (Hides in print mode) */}
      <div className={dir === "rtl" ? "text-right print:hidden" : "text-start print:hidden"}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Sparkles className="text-emerald-500 shrink-0" size={26} />
              {getLabel("section_title")}
            </h2>
            <p className="text-slate-500 font-medium text-sm mt-1 max-w-2xl leading-relaxed">
              {getLabel("section_subtitle")}
            </p>
          </div>
          
          {!isCreating && (
            <button
              onClick={() => {
                resetForm();
                setIsCreating(true);
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-md cursor-pointer shrink-0"
            >
              <Plus size={16} />
              {getLabel("create_new")}
            </button>
          )}
        </div>
      </div>

      {/* CREATE NEW HANDOVER BUILDER SYSTEM */}
      {isCreating && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8 print:hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                <FileText size={22} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-lg">{getLabel("create_new")}</h3>
                <p className="text-xs text-slate-400 font-medium">{outgoingShift} → {incomingShift}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsCreating(false);
                resetForm();
              }}
              className="px-4 py-2 text-slate-400 hover:text-slate-700 font-extrabold text-xs bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl transition-all cursor-pointer"
            >
              {t("cancel")}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Options Block: Setup parameters */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-5">
                <h4 className="font-black text-xs text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Activity size={14} className="text-slate-400" />
                  {getLabel("setup")}
                </h4>

                <div className="space-y-4">
                  {/* Date Input */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-600">{getLabel("date_label")}</label>
                    <input
                      type="date"
                      value={dateStr}
                      onChange={(e) => setDateStr(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Outgoing Shift */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-600">{getLabel("outgoing_shift_lbl")}</label>
                    <select
                      value={outgoingShift}
                      onChange={(e) => setOutgoingShift(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="Morning Shift">{tData("Morning Shift")}</option>
                      <option value="Day Shift">{tData("Day Shift")}</option>
                      <option value="Evening Shift">{tData("Evening Shift")}</option>
                      <option value="Night Shift">{tData("Night Shift")}</option>
                    </select>
                  </div>

                  {/* Incoming Shift */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-600">{getLabel("incoming_shift_lbl")}</label>
                    <select
                      value={incomingShift}
                      onChange={(e) => setIncomingShift(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="Morning Shift">{tData("Morning Shift")}</option>
                      <option value="Day Shift">{tData("Day Shift")}</option>
                      <option value="Evening Shift">{tData("Evening Shift")}</option>
                      <option value="Night Shift">{tData("Night Shift")}</option>
                    </select>
                  </div>

                  {/* Outgoing supervisor (Locked as current officer) */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-400">{getLabel("outgoing_super_label")}</label>
                    <div className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm font-bold text-slate-500 select-none">
                      {currentUser?.name}
                    </div>
                  </div>

                  {/* Incoming supervisor */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-600">{getLabel("incoming_super_label")}</label>
                    <input
                      type="text"
                      placeholder="e.g. Jane Smith, John Doe"
                      value={incomingSupervisor}
                      onChange={(e) => setIncomingSupervisor(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Custom supervisor insights entry box */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>{getLabel("custom_notes_label")}</span>
                </label>
                <textarea
                  rows={4}
                  placeholder={getLabel("custom_notes_placeholder")}
                  value={userCustomNote}
                  onChange={(e) => setUserCustomNote(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none resize-none bg-white font-medium"
                />
              </div>

              {/* AI Trigger Block */}
              <button
                type="button"
                onClick={generateAISummaries}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white rounded-2xl transition-all shadow-md hover:shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={isGenerating ? "animate-pulse text-emerald-400" : "text-emerald-400"} size={20} />
                <span className="text-xs font-black uppercase tracking-widest">
                  {isGenerating ? t("loading") : getLabel("generator_btn")}
                </span>
              </button>
            </div>

            {/* Right Aggregated Telemetry Summary & Builder Output */}
            <div className="lg:col-span-2 space-y-6">
              {/* Pre-assembled Telemetry Badge Feed */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <div className="flex flex-col space-y-1 text-start">
                  <h4 className="font-extrabold text-xs text-slate-800">{getLabel("telemetry_title")}</h4>
                  <p className="text-[11px] text-slate-400 font-medium">{getLabel("telemetry_subtitle")}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                  <div className="p-3 bg-white border border-slate-100 rounded-xl flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">{t("incidents")}</span>
                    <span className="text-lg font-black text-slate-800 mt-1">{currentIncidents.length}</span>
                  </div>
                  <div className="p-3 bg-white border border-slate-100 rounded-xl flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">{t("tasks")}</span>
                    <span className="text-lg font-black text-slate-800 mt-1">{currentTasks.length}</span>
                  </div>
                  <div className="p-3 bg-white border border-slate-100 rounded-xl flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">{getLabel("clock_ins_scanned")}</span>
                    <span className="text-lg font-black text-slate-800 mt-1">{currentClockLogs.length}</span>
                  </div>
                  <div className="p-3 bg-white border border-slate-100 rounded-xl flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">{getLabel("geofence_violations")}</span>
                    <span className={`text-lg font-black mt-1 ${geofenceBreachCount > 0 ? "text-rose-600 font-bold" : "text-slate-800"}`}>
                      {geofenceBreachCount}
                    </span>
                  </div>
                  <div className="p-3 bg-white border border-slate-100 rounded-xl flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">{getLabel("gate_entries")}</span>
                    <span className="text-lg font-black text-slate-800 mt-1">{currentGateActivity.entries}</span>
                  </div>
                  <div className="p-3 bg-white border border-slate-100 rounded-xl flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">{getLabel("gate_exits")}</span>
                    <span className="text-lg font-black text-slate-800 mt-1">{currentGateActivity.exits}</span>
                  </div>
                </div>
              </div>

              {/* Editable output summaries of builder */}
              <div className="space-y-4">
                <h4 className="font-black text-xs text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <CheckSquare size={14} />
                  {getLabel("summary_fields")}
                </h4>

                {/* Main Executive Summary */}
                <div className="flex flex-col gap-1 text-start">
                  <label className="text-xs font-bold text-slate-700">{getLabel("summary_field")}</label>
                  <textarea
                    rows={3}
                    value={draftSummary}
                    onChange={(e) => setDraftSummary(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>

                {/* Sub reports layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Incident Summary */}
                  <div className="flex flex-col gap-1 text-start">
                    <label className="text-xs font-bold text-slate-700">{getLabel("inc_field")}</label>
                    <textarea
                      rows={3}
                      value={draftIncSummary}
                      onChange={(e) => setDraftIncSummary(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>

                  {/* Task Summary */}
                  <div className="flex flex-col gap-1 text-start">
                    <label className="text-xs font-bold text-slate-700">{getLabel("task_field")}</label>
                    <textarea
                      rows={3}
                      value={draftTaskSummary}
                      onChange={(e) => setDraftTaskSummary(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>

                  {/* Geofence Compliance Summary */}
                  <div className="flex flex-col gap-1 text-start">
                    <label className="text-xs font-bold text-slate-700">{getLabel("geofence_field")}</label>
                    <textarea
                      rows={3}
                      value={draftGeofenceSummary}
                      onChange={(e) => setDraftGeofenceSummary(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>

                  {/* Gate flow Summary */}
                  <div className="flex flex-col gap-1 text-start">
                    <label className="text-xs font-bold text-slate-700">{getLabel("gate_field")}</label>
                    <textarea
                      rows={3}
                      value={draftGateSummary}
                      onChange={(e) => setDraftGateSummary(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                </div>

                {/* Special Instructions & Safety Focus */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Instructions */}
                  <div className="flex flex-col gap-1 text-start">
                    <label className="text-xs font-bold text-slate-700">{getLabel("instructions_field")}</label>
                    <textarea
                      rows={3}
                      value={draftInstructions}
                      onChange={(e) => setDraftInstructions(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>

                  {/* Safety Focus */}
                  <div className="flex flex-col gap-1 text-start">
                    <label className="text-xs font-bold text-slate-700">{getLabel("safety_field")}</label>
                    <textarea
                      rows={3}
                      value={draftSafetyFocus}
                      onChange={(e) => setDraftSafetyFocus(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-semibold text-rose-700 bg-rose-50/50"
                    />
                  </div>
                </div>

                {/* Checklist Custom Builder */}
                <div className="border border-slate-100 bg-slate-50 rounded-2xl p-4 text-start space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase text-slate-500 tracking-wider">
                      {getLabel("checklist_field")}
                    </label>
                    <button
                      type="button"
                      onClick={addNewChecklistTask}
                      className="text-xs flex items-center gap-1.5 font-bold text-emerald-600 hover:underline cursor-pointer"
                    >
                      <Plus size={14} />
                      {getLabel("add_checklist_item")}
                    </button>
                  </div>

                  {draftChecklist.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400">
                      Generate AI Summary, or add checklist tasks manually to populate hand-off instructions.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {draftChecklist.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => handleCustomChecklistToggle(index)}
                            className="w-4 h-4 rounded text-emerald-500 border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            value={item.task}
                            onChange={(e) => {
                              const list = [...draftChecklist];
                              list[index].task = e.target.value;
                              setDraftChecklist(list);
                            }}
                            placeholder={getLabel("checklist_task_placeholder")}
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => removeChecklistItem(index)}
                            className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Builder Action Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => saveHandoverReport("draft")}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs  rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Save size={14} />
                  {getLabel("save_as_draft")}
                </button>
                <button
                  type="button"
                  onClick={() => saveHandoverReport("submitted")}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-500/10"
                >
                  <CheckCircle size={14} />
                  {getLabel("submit_for_sign")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HISTORICAL HANDOVER REPORTS LIST */}
      {!isCreating && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:block">
          {/* Left: Filter control & list block */}
          <div className="lg:col-span-1 space-y-4 print:hidden">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 text-start">
              <h3 className="font-extrabold text-slate-800 text-sm">{getLabel("history")}</h3>
              
              {/* Search query info */}
              <div className="relative">
                <input
                  type="text"
                  placeholder={getLabel("search_placeholder_local")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700"
                />
              </div>

              {/* Status Filters buttons */}
              <div className="flex flex-col gap-1.5 pt-2">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black flex items-center justify-between cursor-pointer ${statusFilter === "all" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <span>{language === "ar" ? "الكل" : "All Accounts"}</span>
                  <span className="p-0.5 px-1.5 bg-slate-500 text-[9px] rounded-full text-white">{reports.length}</span>
                </button>
                <button
                  onClick={() => setStatusFilter("draft")}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black flex items-center justify-between cursor-pointer ${statusFilter === "draft" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <span>{getLabel("drafts")}</span>
                  <span className="p-0.5 px-1.5 bg-slate-500 text-[9px] rounded-full text-white">{reports.filter(r => r.status === 'draft').length}</span>
                </button>
                <button
                  onClick={() => setStatusFilter("submitted")}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black flex items-center justify-between cursor-pointer ${statusFilter === "submitted" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <span>{getLabel("awaiting")}</span>
                  <span className="p-0.5 px-1.5 bg-emerald-600 text-[9px] rounded-full text-white">{reports.filter(r => r.status === 'submitted').length}</span>
                </button>
                <button
                  onClick={() => setStatusFilter("signed_off")}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black flex items-center justify-between cursor-pointer ${statusFilter === "signed_off" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <span>{getLabel("completed")}</span>
                  <span className="p-0.5 px-1.5 bg-slate-500 text-[9px] rounded-full text-white">{reports.filter(r => r.status === 'signed_off').length}</span>
                </button>
              </div>
            </div>

            {/* Reports List feed */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {filteredReports.length === 0 ? (
                <div className="border border-slate-100 bg-slate-50 p-6 rounded-2xl text-center text-xs text-slate-400">
                  {getLabel("no_reports")}
                </div>
              ) : (
                filteredReports.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className={`p-4 border text-start rounded-2xl cursor-pointer transition-all ${selectedReport?.id === report.id ? "bg-emerald-50 border-emerald-300 shadow-sm" : "bg-white border-slate-100 hover:border-slate-200"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono">{report.date}</span>
                      <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${report.status === 'signed_off' ? "bg-emerald-100 text-emerald-800" : report.status === 'submitted' ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"}`}>
                        {report.status === 'signed_off' ? getLabel("status_signed") : report.status === 'submitted' ? getLabel("status_submitted") : getLabel("status_draft")}
                      </span>
                    </div>

                    <h4 className="font-extrabold text-sm text-slate-800 mt-2">
                      {report.outgoing_shift_name} → {report.incoming_shift_name}
                    </h4>

                    <div className="flex items-center justify-between text-slate-400 text-xs mt-3">
                      <span className="truncate max-w-[120px]">
                        By: {report.outgoing_supervisor}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (report.id && report.created_by_uid) {
                            discardReport(report.id, report.created_by_uid, report.status);
                          }
                        }}
                        className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Detailed report reviewer & countersignature board */}
          <div className="lg:col-span-2 print:col-span-3">
            {selectedReport ? (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8 print:border-none print:shadow-none print:p-0">
                
                {/* Print Title (Shows only in print layout) */}
                <div className="hidden print:block text-center border-b pb-4 mb-4">
                  <h1 className="text-2xl font-black">{localLabels[language === "ar" ? "ar" : "en"].section_title}</h1>
                  <p className="text-xs text-slate-400 mt-1">{selectedReport.date} | Outgoing: {selectedReport.outgoing_shift_name} → Incoming: {selectedReport.incoming_shift_name}</p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 print:hidden">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 text-xs font-black uppercase rounded-lg ${selectedReport.status === 'signed_off' ? "bg-emerald-100 text-emerald-800" : selectedReport.status === 'submitted' ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"}`}>
                      {selectedReport.status === 'signed_off' ? getLabel("status_signed") : selectedReport.status === 'submitted' ? getLabel("status_submitted") : getLabel("status_draft")}
                    </span>
                    <span className="text-xs font-mono text-slate-400">{selectedReport.date}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={triggerPrintLayout}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                    >
                      <Printer size={14} />
                      {getLabel("print_btn")}
                    </button>
                    <button
                      onClick={() => setSelectedReport(null)}
                      className="px-3 py-2 text-slate-400 hover:text-slate-600 font-extrabold text-xs bg-slate-50 border border-slate-200 rounded-xl print:hidden cursor-pointer"
                    >
                      {t("close")}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 leading-relaxed">
                  <div className="bg-slate-50 p-4 border border-slate-100 rounded-2xl flex items-center gap-3">
                    <ArrowRightLeft className="text-slate-400" size={18} />
                    <div className="text-start">
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black block">{language === "ar" ? "مسار المناوبات" : "Operational Shift Flow"}</span>
                      <span className="text-sm font-black text-slate-800">{selectedReport.outgoing_shift_name} → {selectedReport.incoming_shift_name}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 border border-slate-100 rounded-2xl flex items-center gap-3">
                    <Signature className="text-slate-400" size={18} />
                    <div className="text-start">
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black block">{language === "ar" ? "المشرفين المعنيين" : "Supervisors Verified"}</span>
                      <span className="text-sm font-black text-slate-800">{selectedReport.outgoing_supervisor} → {selectedReport.incoming_supervisor}</span>
                    </div>
                  </div>
                </div>

                {/* Main executive content detail boxes */}
                <div className="space-y-6 text-start">
                  
                  {/* Executive Summary */}
                  {selectedReport.summary && (
                    <div className="space-y-1.5">
                      <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <FileText size={14} className="text-emerald-500 shrink-0" />
                        {getLabel("summary_field")}
                      </h4>
                      <p className="text-sm text-slate-700 bg-white border border-slate-100 p-4 rounded-2xl leading-relaxed whitespace-pre-line font-medium shadow-sm">
                        {selectedReport.summary}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Incidents Responses */}
                    {selectedReport.incidents_summary && (
                      <div className="space-y-1.5">
                        <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <FileWarning size={14} className="text-amber-500 shrink-0" />
                          {getLabel("inc_field")}
                        </h4>
                        <p className="text-xs text-slate-600 bg-slate-50/50 p-3.5 border border-slate-100 rounded-xl leading-relaxed whitespace-pre-line font-medium">
                          {selectedReport.incidents_summary}
                        </p>
                      </div>
                    )}

                    {/* Tasks Responses */}
                    {selectedReport.tasks_summary && (
                      <div className="space-y-1.5">
                        <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                          {getLabel("task_field")}
                        </h4>
                        <p className="text-xs text-slate-600 bg-slate-50/50 p-3.5 border border-slate-100 rounded-xl leading-relaxed whitespace-pre-line font-medium">
                          {selectedReport.tasks_summary}
                        </p>
                      </div>
                    )}

                    {/* Geofence Responses */}
                    {selectedReport.geofence_summary && (
                      <div className="space-y-1.5">
                        <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <MapPin size={14} className="text-rose-500 shrink-0" />
                          {getLabel("geofence_field")}
                        </h4>
                        <p className="text-xs text-slate-600 bg-slate-50/50 p-3.5 border border-slate-100 rounded-xl leading-relaxed whitespace-pre-line font-medium">
                          {selectedReport.geofence_summary}
                        </p>
                      </div>
                    )}

                    {/* Gate flow responses */}
                    {selectedReport.gate_activity_summary && (
                      <div className="space-y-1.5">
                        <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Activity size={14} className="text-blue-500 shrink-0" />
                          {getLabel("gate_field")}
                        </h4>
                        <p className="text-xs text-slate-600 bg-slate-50/50 p-3.5 border border-slate-100 rounded-xl leading-relaxed whitespace-pre-line font-medium">
                          {selectedReport.gate_activity_summary}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Special handoff instructions & alerts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {selectedReport.special_instructions && (
                      <div className="space-y-1.5">
                        <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <AlertCircle size={14} className="text-indigo-500 shrink-0" />
                          {getLabel("instructions_field")}
                        </h4>
                        <p className="text-sm text-slate-700 bg-indigo-50/20 border border-indigo-100/50 p-4 rounded-2xl leading-relaxed font-semibold">
                          {selectedReport.special_instructions}
                        </p>
                      </div>
                    )}

                    {selectedReport.safety_focus && (
                      <div className="space-y-1.5">
                        <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Lock size={14} className="text-rose-500 shrink-0" />
                          {getLabel("safety_field")}
                        </h4>
                        <p className="text-sm text-rose-800 bg-rose-50 border border-rose-100 p-4 rounded-2xl leading-relaxed font-black">
                          {selectedReport.safety_focus}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Operational Checklist Review and Verify */}
                  {selectedReport.checklist && selectedReport.checklist.length > 0 && (
                    <div className="border border-slate-100 bg-slate-50 rounded-2xl p-5 space-y-3 print:bg-transparent print:border">
                      <h4 className="font-black text-xs text-slate-400 uppercase tracking-widest">
                        {getLabel("checklist_field")}
                      </h4>
                      <div className="space-y-2">
                        {selectedReport.checklist.map((item, id) => (
                          <div 
                            key={id} 
                            onClick={() => handleReviewChecklistToggle(id)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${selectedReport.status !== 'signed_off' ? "cursor-pointer" : ""} ${item.completed ? "bg-emerald-50/50 border-emerald-100" : "bg-white border-slate-100"}`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={item.completed}
                                disabled={selectedReport.status === 'signed_off'}
                                onChange={() => {}} // Handled by onClick of container
                                className="w-4 h-4 text-emerald-500 border-slate-300 focus:ring-emerald-500 rounded cursor-pointer"
                              />
                              <span className={`text-xs font-bold leading-none ${item.completed ? "line-through text-slate-400" : "text-slate-700"}`}>
                                {item.task}
                              </span>
                            </div>

                            {item.verified_by && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold font-mono">
                                {getLabel("verified_by")} {item.verified_by}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Supervisor comments or custom details */}
                  {selectedReport.additional_notes && (
                    <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black block">{getLabel("custom_notes_label")}</span>
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed font-semibold italic">"{selectedReport.additional_notes}"</p>
                    </div>
                  )}

                  {/* CO-SIGNATURE WORKFLOW BOARD */}
                  {selectedReport.status === "submitted" ? (
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-white space-y-4 print:hidden">
                      <div className="flex items-start gap-3">
                        <Signature className="text-emerald-400 shrink-0 mt-1" size={24} />
                        <div>
                          <h4 className="font-black text-sm tracking-wide">{getLabel("sign_off_title")}</h4>
                          <p className="text-xs text-slate-400 font-medium leading-relaxed mt-0.5">{getLabel("sign_off_desc")}</p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-end gap-3 pt-2">
                        <div className="flex-1 text-left space-y-1 w-full">
                          <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">{getLabel("sign_off_label")}</label>
                          <input
                            type="text"
                            placeholder={getLabel("sign_off_placeholder")}
                            value={signatureName}
                            onChange={(e) => setSignatureName(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-sm font-bold text-slate-100 placeholder-slate-500 outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={countersignReport}
                          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-lg shadow-emerald-500/20 active:scale-95"
                        >
                          {getLabel("authorize_btn")}
                        </button>
                      </div>
                    </div>
                  ) : selectedReport.status === "signed_off" ? (
                    <div className="p-4 border border-emerald-100 bg-emerald-50/30 rounded-2xl flex items-center justify-between text-start gap-4">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black block">ELECTRONIC SIGNATURE CERTIFICATE</span>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed font-bold">
                          Closed & Countersigned by incoming officer: <span className="text-emerald-600 font-black">{selectedReport.signed_off_by_name}</span>.
                        </p>
                      </div>
                      <div className="text-[9px] font-mono text-slate-400 font-bold shrink-0 self-end text-right">
                        VERIFIED: {selectedReport.signed_off_at?.toDate ? selectedReport.signed_off_at.toDate().toLocaleString() : new Date(selectedReport.signed_off_at).toLocaleString()}
                      </div>
                    </div>
                  ) : null}

                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm text-slate-400 flex flex-col items-center justify-center min-h-[400px]">
                <FileText size={48} className="text-slate-200 mb-4" />
                <h3 className="font-extrabold text-slate-650">{language === "ar" ? "حدد تـقـريـر تسليم مـفـصـل مـن الـقـائـمـة لـلـمـراجـعـة" : "Select a Handover Report from the Log to Review Details"}</h3>
                <p className="text-slate-400 text-xs mt-1 max-w-sm">Site supervisors can consult past reports or initialize a new digital handover with automated smart insights.</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
