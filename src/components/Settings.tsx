import React, { useState, useEffect } from "react";
import { 
  Globe, 
  Bell, 
  Palette, 
  ShieldCheck, 
  Download, 
  Save,
  History,
  AlertCircle,
  CheckCircle2,
  Lock,
  Fingerprint
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { BiometricModal } from "./BiometricModal";
import { collection, onSnapshot, query, orderBy, doc, setDoc, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export function Settings() {
  const { language, tData, dir } = useLanguage();
  const [settings, setSettings] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [rolePermissions, setRolePermissions] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState("site");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});

  const [isBioModalOpen, setIsBioModalOpen] = useState(false);
  const [bioModalMode, setBioModalMode] = useState<"enroll" | "verify">("enroll");

  const { 
    user: currentUser, 
    isBiometricEnrolled, 
    enrollBiometrics, 
    disenrollBiometrics 
  } = useAuth();

  const handleBioSuccess = async () => {
    if (bioModalMode === "enroll" && currentUser) {
      await enrollBiometrics(currentUser.id, currentUser.email);
    }
    setIsBioModalOpen(false);
  };

  useEffect(() => {
    if (!currentUser) return;

    // Listen for settings
    const settingsPath = "settings";
    const settingsQuery = collection(db, settingsPath);
    const unsubscribeSettings = onSnapshot(settingsQuery, (snapshot) => {
      setSettings(snapshot.docs.map(doc => ({ key: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, settingsPath);
    });

    // Listen for audit logs
    const logsPath = "audit_logs";
    const logsQuery = query(collection(db, logsPath), orderBy("created_at", "desc"));
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString()
      })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, logsPath);
    });

    // Listen for role permissions
    const permissionsPath = "role_permissions";
    const unsubscribePermissions = onSnapshot(collection(db, permissionsPath), (snapshot) => {
      setRolePermissions(snapshot.docs.map(doc => ({ role: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, permissionsPath);
    });

    return () => {
      unsubscribeSettings();
      unsubscribeLogs();
      unsubscribePermissions();
    };
  }, [currentUser]);

  const handleInputChange = (key: string, value: string) => {
    setPendingChanges(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (Object.keys(pendingChanges).length === 0 || !currentUser) return;
    
    setIsSaving(true);
    try {
      // Update each setting in Firestore
      const promises: Promise<any>[] = Object.entries(pendingChanges).map(([key, value]) => 
        setDoc(doc(db, "settings", key), { value, updated_at: serverTimestamp() }, { merge: true })
      );
      
      // Add audit log
      promises.push(addDoc(collection(db, "audit_logs"), {
        user_id: currentUser.id,
        user_name: currentUser.name,
        action: "update_settings",
        details: `Updated settings: ${Object.keys(pendingChanges).join(", ")}`,
        created_at: serverTimestamp()
      }));

      await Promise.all(promises);
      
      setSaveSuccess(true);
      setPendingChanges({});
      
      // Notify other components (like Sidebar) that settings have changed
      window.dispatchEvent(new CustomEvent('settingsUpdated'));
      
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save settings", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const settingsSnap = await getDocs(collection(db, "settings"));
      const logsSnap = await getDocs(collection(db, "audit_logs"));
      const tasksSnap = await getDocs(collection(db, "tasks"));
      const incidentsSnap = await getDocs(collection(db, "incidents"));

      const data = {
        settings: settingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        audit_logs: logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        tasks: tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        incidents: incidentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `heritage_ops_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed", error);
    }
  };

  const sections = [
    { id: "site", label: language === "ar" ? "تكوين وبيانات الموقع" : "Site Configuration", icon: Globe },
    { id: "ops", label: language === "ar" ? "القيم المحددة افتراضياً" : "Operational Defaults", icon: ShieldCheck },
    { id: "biometrics", label: language === "ar" ? "الأمان والتحقق الحيوي" : "Biometric Security", icon: Fingerprint },
    { id: "permissions", label: language === "ar" ? "صلاحيات المجموعات والوظائف" : "Role Permissions", icon: Lock },
    { id: "notify", label: language === "ar" ? "إشعارات النظام" : "Notifications", icon: Bell },
    { id: "appearance", label: language === "ar" ? "المظهر الخارجي" : "Appearance", icon: Palette },
    { id: "logs", label: language === "ar" ? "سجلات المراجعة والأمان" : "Audit Logs", icon: History },
  ];

  const PERMISSIONS = [
    { id: "view_dashboard", label: language === "ar" ? "عرض لوحة القيادة" : "View Dashboard" },
    { id: "manage_gate", label: language === "ar" ? "إدارة بوابات الأمن" : "Manage Gate" },
    { id: "manage_tasks", label: language === "ar" ? "إدارة وتوزيع المهام" : "Manage Tasks" },
    { id: "report_incidents", label: language === "ar" ? "الإبلاغ عن حوادث ميدانية" : "Report Incidents" },
    { id: "manage_planning", label: language === "ar" ? "إدارة وتخطيط الموارد" : "Manage Planning" },
    { id: "view_staff", label: language === "ar" ? "عرض بيانات الحراس" : "View Staff" },
    { id: "manage_staff", label: language === "ar" ? "إدارة وتعديل طاقم العمل" : "Manage Staff" },
    { id: "view_rota", label: language === "ar" ? "عرض جدول المناوبات" : "View Rota" },
    { id: "manage_rota", label: language === "ar" ? "إدارة وجدولة وتعديل المناوبات" : "Manage Rota" },
    { id: "view_analytics", label: language === "ar" ? "عرض التحليلات البيانية والمؤشرات" : "View Analytics" },
    { id: "manage_emergency", label: language === "ar" ? "إدارة وتفعيل خطط الطوارئ" : "Manage Emergency" },
    { id: "manage_settings", label: language === "ar" ? "إدارة وتكوين إعدادات النظام" : "Manage Settings" },
  ];

  const ROLES = ["admin", "manager", "user"];

  const handlePermissionToggle = async (role: string, permissionId: string) => {
    const currentRolePerms = rolePermissions.find(rp => rp.role === role);
    const currentPerms = currentRolePerms?.permissions || [];
    
    let newPerms;
    if (currentPerms.includes(permissionId)) {
      newPerms = currentPerms.filter((p: string) => p !== permissionId);
    } else {
      newPerms = [...currentPerms, permissionId];
    }

    try {
      await setDoc(doc(db, "role_permissions", role), {
        permissions: newPerms,
        updated_at: serverTimestamp()
      });
      
      // Add audit log
      await addDoc(collection(db, "audit_logs"), {
        user_id: currentUser?.id,
        user_name: currentUser?.name,
        action: "update_permissions",
        details: `Updated permissions for role: ${role}`,
        created_at: serverTimestamp()
      });
    } catch (error) {
      console.error("Failed to update permissions", error);
    }
  };

  const getSettingValue = (key: string) => {
    return pendingChanges[key] ?? settings.find(s => s.key === key)?.value ?? "";
  };

  const renderSectionContent = () => {
    const isRtl = dir === "rtl";

    switch (activeSection) {
      case "site":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 text-start">
                <label className="text-sm font-semibold text-slate-700">
                  {language === "ar" ? "اسم الموقع الجغرافي" : "Site Name"}
                </label>
                <input 
                  type="text"
                  value={getSettingValue("site_name")}
                  onChange={(e) => handleInputChange("site_name", e.target.value)}
                  className={cn(
                    "w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-slate-700",
                    isRtl ? "text-right" : "text-left"
                  )}
                />
              </div>
              <div className="space-y-2 text-start">
                <label className="text-sm font-semibold text-slate-700">
                  {language === "ar" ? "إحداثيات المركز والموقع" : "Location Coordinates"}
                </label>
                <input 
                  type="text"
                  value={getSettingValue("site_location")}
                  onChange={(e) => handleInputChange("site_location", e.target.value)}
                  className={cn(
                    "w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-slate-700",
                    isRtl ? "text-right" : "text-left"
                  )}
                />
              </div>
              <div className="space-y-2 text-start">
                <label className="text-sm font-semibold text-slate-700">
                  {language === "ar" ? "أوقات وتوقيتات الفتح للجمهور" : "Opening Hours"}
                </label>
                <input 
                  type="text"
                  value={getSettingValue("opening_hours")}
                  onChange={(e) => handleInputChange("opening_hours", e.target.value)}
                  className={cn(
                    "w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-slate-700",
                    isRtl ? "text-right" : "text-left"
                  )}
                />
              </div>
              <div className="space-y-2 text-start">
                <label className="text-sm font-semibold text-slate-700">
                  {language === "ar" ? "السعة الاستيعابية القصوى للموقع" : "Max Visitor Capacity"}
                </label>
                <input 
                  type="number"
                  value={getSettingValue("max_capacity")}
                  onChange={(e) => handleInputChange("max_capacity", e.target.value)}
                  className={cn(
                    "w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-slate-700",
                    isRtl ? "text-right" : "text-left"
                  )}
                />
              </div>
            </div>

            <div className="mt-8 p-6 bg-slate-900 rounded-2xl border border-slate-800 text-white text-start">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-emerald-500/20 rounded-xl shrink-0">
                  <ShieldCheck className="text-emerald-400" size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-lg">
                    {language === "ar" ? "تأمين لوائح وحوكمة توطين البيانات الوطنية" : "Data Residency Compliance"}
                  </h4>
                  <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                    {language === "ar" 
                      ? "تم تهيئة وتكوين خوادم وتخزين بيانات هذه المنصة بشكل تام داخل منطقة المملكة العربية السعودية (me-central1). يتم معالجة وتوطين كافة السجلات الميدانية، معلومات المستخدمين، وسجلات المتابعة والتدقيق داخل منصة سحابية محلية لضمان الامتثال التام للسياسات الوطنية لحوكمة وحفظ البيانات."
                      : "This application is configured for deployment in the Saudi Arabia (me-central1) region. All operational data, user credentials, and audit logs are stored within the Kingdom to comply with national data residency policies."}
                  </p>
                  <div className="flex items-center gap-2 mt-4 text-emerald-400 text-xs font-black uppercase tracking-widest">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    {language === "ar" ? "المنطقة النشطة: الدمام (me-central1)" : "Region: Dammam (me-central1)"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "biometrics":
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm text-start">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-slate-100 rounded-2xl text-slate-700">
                  <Fingerprint size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    {language === "ar" ? "تسجيل الدخول الحيوي للموظفين" : "Staff Biometric Activation"}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {language === "ar"
                      ? "قم بتنشيط ميزة التحقق بالبصمة (TouchID/FaceID) على هذا الجهاز لتسجيل الدخول السريع والآمن دون الحاجة لكتابة كلمة المرور في كل مرة."
                      : "Register TouchID or FaceID on this device to sign in instantly without typing your password each time."}
                  </p>
                </div>
              </div>

              <div className="mt-8 border-t border-slate-100 pt-8">
                {isBiometricEnrolled ? (
                  <div className="space-y-6">
                    <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                          <h4 className="text-emerald-900 font-extrabold text-sm uppercase tracking-wider">
                            {language === "ar" ? "نشط ومفعل على هذا الجهاز" : "Active on this Device"}
                          </h4>
                        </div>
                        <p className="text-xs text-slate-500">
                          {language === "ar"
                            ? "تم ربط حسابك بالخصائص الحيوية للمتصفح الحالي بنجاح."
                            : "Your credentials are securely linked to this browser's secure enclave."}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => {
                            setBioModalMode("verify");
                            setIsBioModalOpen(true);
                          }}
                          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
                        >
                          {language === "ar" ? "تجربة التحقق" : "Test Scan"}
                        </button>

                        <button
                          onClick={disenrollBiometrics}
                          className="px-4 py-2.5 bg-rose-50 hover:bg-rose-150 text-rose-700 font-extrabold text-xs rounded-xl border border-rose-100 transition-all cursor-pointer"
                        >
                          {language === "ar" ? "إلغاء التنشيط" : "Disenroll"}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block bg-transparent">
                          {language === "ar" ? "المستند المسجل" : "Registered Identity"}
                        </span>
                        <span className="text-sm font-bold text-slate-800 break-all bg-transparent">
                          {currentUser?.email || "N/A"}
                        </span>
                      </div>
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block bg-transparent">
                          {language === "ar" ? "تاريخ التسجيل" : "Enrolled At"}
                        </span>
                        <span className="text-sm font-bold text-slate-800 bg-transparent">
                          {(() => {
                            const cred = localStorage.getItem("biometric_credential");
                            if (cred) {
                              try {
                                return new Date(JSON.parse(cred).registeredAt).toLocaleDateString(
                                  language === "ar" ? "ar-SA" : "en-US",
                                  { dateStyle: "medium" }
                                );
                              } catch (e) {}
                            }
                            return "N/A";
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-transparent">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 mx-auto mb-4">
                      <Fingerprint size={28} className="text-slate-400 animate-pulse" />
                    </div>
                    <h4 className="font-bold text-slate-800 bg-transparent">
                      {language === "ar" ? "البصمة غير منشطة بعد" : "Biometrics not yet enabled"}
                    </h4>
                    <p className="text-slate-500 text-xs max-w-sm mx-auto mt-1 mb-6 bg-transparent">
                      {language === "ar"
                        ? "قم بتوطين البصمة محلياً لتمكين حراس وباقي طاقم العمل من الدخول بلمسة واحدة."
                        : "Enable easy multi-factor credential caching for immediate security terminal sign-in."}
                    </p>
                    <button
                      onClick={() => {
                        setBioModalMode("enroll");
                        setIsBioModalOpen(true);
                      }}
                      className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-2xl shadow-md cursor-pointer transition-all active:scale-95 inline-block mx-auto"
                    >
                      {language === "ar" ? "ربط هذا الجهاز بالبصمة" : "Activate Secure Link"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border border-slate-100 bg-slate-50 rounded-2xl flex items-start gap-3 text-start">
              <Lock className="text-slate-400 shrink-0 mt-0.5" size={18} />
              <div>
                <h5 className="font-bold text-xs text-slate-700 bg-transparent">
                  {language === "ar" ? "حماية خصوصيتك الحيوية" : "Local Biometric Privacy Guard"}
                </h5>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed bg-transparent">
                  {language === "ar"
                    ? "لا يتم مطلقاً مشاركة أي من ملامح الوجه أو تضاريس بصمات الأصابع مع خوادمنا. تتم عملية التحقق بالكامل بأمان داخلي مشفر على العتاد الخاص بجهازك، وتعود النتيجة مصادق عليها فقط إلى متصفح الموقع."
                    : "Heritage Ops never has access to, nor transfers, your fingerprint or facial scans. Processing is performed securely within your device's isolated secure enclave and hardware chip level."}
                </p>
              </div>
            </div>
          </div>
        );
      case "ops":
        return (
          <div className="space-y-6">
            <div className={cn("p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3 text-start", isRtl && "flex-row-reverse")}>
              <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-amber-800 font-bold">
                {language === "ar" 
                  ? "تحدد مستهدفات مستويات الخدمة (SLA) وقت الاستجابة الميدانية المطلوبة بالدقائق لطاقم العمل وحراس الأمن لمراجعة وتعيين المهام المفتوحة."
                  : "SLA targets define the expected response time in minutes for staff to review and assign tasks."}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 text-start">
                <label className="text-sm font-semibold text-slate-700">
                  {language === "ar" ? "مستهدف الحالات العاجلة جداً (الدقائق)" : "Critical SLA (Minutes)"}
                </label>
                <input 
                  type="number"
                  value={getSettingValue("sla_critical")}
                  onChange={(e) => handleInputChange("sla_critical", e.target.value)}
                  className={cn(
                    "w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-slate-700",
                    isRtl ? "text-right" : "text-left"
                  )}
                />
              </div>
              <div className="space-y-2 text-start">
                <label className="text-sm font-semibold text-slate-700">
                  {language === "ar" ? "مستهدف حالات التنبيه المتوسطة (الدقائق)" : "Warning SLA (Minutes)"}
                </label>
                <input 
                  type="number"
                  value={getSettingValue("sla_warning")}
                  onChange={(e) => handleInputChange("sla_warning", e.target.value)}
                  className={cn(
                    "w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-slate-700",
                    isRtl ? "text-right" : "text-left"
                  )}
                />
              </div>
            </div>
          </div>
        );
      case "permissions":
        return (
          <div className="space-y-8">
            <div className={cn("p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex gap-3 text-start", isRtl && "flex-row-reverse")}>
              <ShieldCheck className="text-indigo-600 shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-indigo-800 font-bold">
                {language === "ar" 
                  ? "قم بتحديد الصلاحيات المخصصة والوصول الممنوح لكل رتبة ميدانية في النظام. يحصل مسؤولو النظام على وصول نهائي وكامل على الدوام."
                  : "Define what each user type can access and manage within the system. Admin users always have full access."}
              </p>
            </div>

            <div className="space-y-6 text-start">
              {ROLES.filter(r => r !== "admin").map(role => (
                <div key={role} className="space-y-4">
                  <h4 className={cn("font-bold text-slate-900 flex items-center gap-2", isRtl && "flex-row-reverse")}>
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      role === "manager" ? "bg-amber-500" : "bg-indigo-500"
                    )} />
                    <span className="capitalize">{tData(role)}</span>
                    <span>{language === "ar" ? "صلاحيات رتبة:" : "Permissions"}</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {PERMISSIONS.map(perm => {
                      const isGranted = rolePermissions.find(rp => rp.role === role)?.permissions?.includes(perm.id);
                      const isRotaRestricted = perm.id === "view_rota" || perm.id === "manage_rota";
                      
                      return (
                        <button
                          key={perm.id}
                          onClick={() => !isRotaRestricted && handlePermissionToggle(role, perm.id)}
                          disabled={isRotaRestricted}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                            isGranted 
                              ? "bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm" 
                              : "bg-white border-slate-100 text-slate-500 hover:border-slate-200",
                            isRotaRestricted && "opacity-50 cursor-not-allowed grayscale",
                            isRtl ? "text-right flex-row-reverse" : "text-left"
                          )}
                        >
                          <div className={cn("flex flex-col min-w-0 flex-1", isRtl ? "text-right items-end pr-1" : "text-left items-start pl-1")}>
                            <span className="text-sm font-medium leading-normal">{perm.label}</span>
                            {isRotaRestricted && (
                              <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider mt-0.5">
                                {language === "ar" ? "متاح للمسؤولين فقط" : "Admin Only"}
                              </span>
                            )}
                          </div>
                          <div className={cn(
                            "w-10 h-5 rounded-full relative transition-colors shrink-0",
                            isGranted ? "bg-emerald-500" : "bg-slate-200"
                          )}>
                            <div className={cn(
                              "absolute top-1 w-3 h-3 bg-white rounded-full transition-transform",
                              isGranted 
                                ? (isRtl ? "translate-x-1" : "translate-x-6") 
                                : (isRtl ? "translate-x-6" : "translate-x-1")
                            )} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case "notify":
        return (
          <div className="space-y-6">
            <div className="divide-y divide-slate-100 text-start">
              <div className={cn("py-4 flex items-center justify-between", isRtl && "flex-row-reverse")}>
                <div>
                  <p className="font-semibold text-slate-900">
                    {language === "ar" ? "تنبيهات إشغال الموقع للمدرير الميدانيين" : "Capacity Alerts"}
                  </p>
                  <p className="text-sm text-slate-500">
                    {language === "ar" ? "تنبيه المدير الميداني والعمليات تلقائياً عند وصول كثافة الزوار لـ 90% أو أكثر" : "Notify managers when site reaches 90% capacity"}
                  </p>
                </div>
                <button 
                  onClick={() => handleInputChange("notify_capacity", getSettingValue("notify_capacity") === "true" ? "false" : "true")}
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative cursor-pointer",
                    getSettingValue("notify_capacity") === "true" ? "bg-emerald-500" : "bg-slate-200"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                    getSettingValue("notify_capacity") === "true" 
                      ? (isRtl ? "translate-x-1" : "translate-x-7") 
                      : (isRtl ? "translate-x-7" : "translate-x-1")
                  )} />
                </button>
              </div>
              <div className={cn("py-4 flex items-center justify-between", isRtl && "flex-row-reverse")}>
                <div>
                  <p className="font-semibold text-slate-900">
                    {language === "ar" ? "إشارات الحوادث الميدانية المسجلة" : "Incident Reports"}
                  </p>
                  <p className="text-sm text-slate-500">
                    {language === "ar" ? "استقبال تنبيهات مباشرة عند رصد أو تعديل بلاغات الحوادث الأمنية" : "Receive real-time alerts for new incident reports"}
                  </p>
                </div>
                <button 
                  onClick={() => handleInputChange("notify_incidents", getSettingValue("notify_incidents") === "true" ? "false" : "true")}
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative cursor-pointer",
                    getSettingValue("notify_incidents") === "true" ? "bg-emerald-500" : "bg-slate-200"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                    getSettingValue("notify_incidents") === "true" 
                      ? (isRtl ? "translate-x-1" : "translate-x-7") 
                      : (isRtl ? "translate-x-7" : "translate-x-1")
                  )} />
                </button>
              </div>
            </div>
          </div>
        );
      case "appearance":
        return (
          <div className="space-y-6 text-start">
            <div className="space-y-4">
              <label className="text-sm font-semibold text-slate-700">
                {language === "ar" ? "لون التمييز الرئيسي لواجهة المستخدم" : "Primary Accent Color"}
              </label>
              <div className={cn("flex gap-4", isRtl && "flex-row-reverse justify-end")}>
                {["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"].map(color => (
                  <button
                    key={color}
                    onClick={() => handleInputChange("accent_color", color)}
                    className={cn(
                      "w-10 h-10 rounded-full border-4 transition-all cursor-pointer",
                      getSettingValue("accent_color") === color ? "border-slate-900 scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-sm font-semibold text-slate-700">
                {language === "ar" ? "مظهر خريطة النظام" : "System Theme"}
              </label>
              <div className="grid grid-cols-3 gap-4">
                {["light", "dark", "system"].map(theme => {
                  const themeLabel = theme === "light" 
                    ? (language === "ar" ? "مضيء" : "Light") 
                    : theme === "dark" 
                      ? (language === "ar" ? "داكن / ليلي" : "Dark") 
                      : (language === "ar" ? "تلقائي حسب النظام" : "System");
                  return (
                    <button
                      key={theme}
                      onClick={() => handleInputChange("theme", theme)}
                      className={cn(
                        "px-4 py-3 rounded-xl border text-sm font-bold capitalize transition-all cursor-pointer",
                        getSettingValue("theme") === theme 
                          ? "bg-slate-900 text-white border-slate-900 shadow-lg" 
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      )}
                    >
                      {themeLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      case "logs":
        return (
          <div className="space-y-4 text-start">
            <div className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2", isRtl && "sm:flex-row-reverse")}>
              <p className="text-sm text-slate-500">
                {language === "ar" ? "استعرض سجلات التعديلات الأمنية والعمليات الفورية المسجلة على الخادم." : "Recent system activity and configuration changes."}
              </p>
              <button 
                onClick={handleExport}
                className="flex items-center gap-2 text-sm font-black text-emerald-600 hover:underline cursor-pointer shrink-0"
              >
                <Download size={16} />
                {language === "ar" ? "تصدير البيانات والتقارير كاملة" : "Export System Data"}
              </button>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto">
              <table className={cn("w-full text-sm", isRtl ? "text-right" : "text-left")}>
                <thead>
                  <tr className="bg-white border-b border-slate-200">
                    <th className="px-4 py-3 font-semibold text-slate-700">{language === "ar" ? "الموظف" : "User"}</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">{language === "ar" ? "الإجراء" : "Action"}</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">{language === "ar" ? "التفاصيل" : "Details"}</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">{language === "ar" ? "الوقت / تاريخ" : "Time"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map(log => {
                    let friendlyAction = log.action.replace('_', ' ');
                    if (language === "ar") {
                      if (log.action === "update_settings") friendlyAction = "تحديث الإعدادات";
                      if (log.action === "update_permissions") friendlyAction = "تحديث الصلاحيات";
                    }
                    return (
                      <tr key={log.id} className="hover:bg-white transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900">{tData(log.user_name)}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold uppercase whitespace-nowrap">
                            {friendlyAction}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-medium">{tData(log.details)}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString(language === "ar" ? "ar-EG" : "en-US")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="pb-12 space-y-8">
      <div className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4", dir === "rtl" && "sm:flex-row-reverse")}>
        <div className={cn("text-start", dir === "rtl" && "text-right")}>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {language === "ar" ? "إعدادات منصة النظام والعمليات" : "System Settings"}
          </h2>
          <p className="text-slate-500 font-medium">
            {language === "ar" 
              ? "إدارة وتعديل بنيات الموقع الأساسية، القوائم التشغيلية، وصيانة سجلات المراجعة والأمان للعمليات." 
              : "Manage site configuration, operational rules, and audit logs."}
          </p>
        </div>
        <div className={cn("flex items-center gap-3", dir === "rtl" && "flex-row-reverse")}>
          <AnimatePresence>
            {saveSuccess && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-2 text-emerald-600 font-extrabold text-sm"
              >
                <CheckCircle2 size={18} />
                {language === "ar" ? "تم حفظ التعديلات وحفظ البث" : "Settings Saved"}
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={handleSave}
            disabled={isSaving || Object.keys(pendingChanges).length === 0}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl font-black transition-all shadow-lg cursor-pointer",
              Object.keys(pendingChanges).length > 0
                ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            )}
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={20} />
            )}
            {language === "ar" ? "حفظ كافة التغييرات" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <aside className="space-y-1 sticky top-24">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all cursor-pointer",
                  activeSection === section.id
                    ? "bg-white text-emerald-600 shadow-sm border border-slate-200"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                  dir === "rtl" ? "flex-row-reverse text-right" : "text-left"
                )}
              >
                <section.icon size={20} className="shrink-0" />
                <span className="truncate">{section.label}</span>
              </button>
            ))}
          </aside>
        </div>

        <div className="lg:col-span-3">
          <main className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm min-h-[600px] text-start">
            <div className={cn("mb-8", dir === "rtl" ? "text-right" : "text-left")}>
              <h3 className="text-xl font-black text-slate-900">
                {sections.find(s => s.id === activeSection)?.label}
              </h3>
              <div className={cn("h-1 w-12 bg-emerald-500 rounded-full mt-2", dir === "rtl" ? "ml-auto mr-0" : "mr-auto ml-0")}></div>
            </div>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {renderSectionContent()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {currentUser && (
        <BiometricModal
          isOpen={isBioModalOpen}
          mode={bioModalMode}
          userId={currentUser.id}
          email={currentUser.email}
          onSuccess={handleBioSuccess}
          onCancel={() => setIsBioModalOpen(false)}
        />
      )}
    </div>
  );
}
