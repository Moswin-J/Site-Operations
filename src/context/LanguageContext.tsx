import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "en" | "ar";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  dir: "ltr" | "rtl";
  t: (key: string) => string;
  tData: (text: any) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Nav Items
    "dashboard": "Dashboard",
    "gate": "Gate Control",
    "tasks": "Tasks",
    "incidents": "Incidents",
    "planning": "Planning",
    "staff": "Staff",
    "rota": "Rota",
    "analytics": "Analytics",
    "emergency": "Emergency",
    "settings": "Settings",
    "handover": "Shift Handover",
    "permits": "Permits",
    "permits_title": "Site Operational Permits",
    "permits_subtitle": "Authorize and verify high-risk works, research, drone flights, and special access.",
    "apply_for_permit": "Request Operational Permit",
    "active_permits": "Active Permits",
    "pending_permits": "Pending Approval",
    "rejected_permits": "Rejected",
    "expired_permits": "Expired",
    "all_permits": "All Permits",
    "permit_type": "Permit Type",
    "applicant": "Applicant",
    "priority_level": "Risk Profile",
    "approved_by": "Approved By",
    "start_date": "Starts At",
    "end_date": "Expires At",
    "area": "Designated Site Zone",
    "risk_profile": "Risk / Safety Level",
    "action_approve": "Approve Permit",
    "action_reject": "Reject Permit",
    "sign_out": "Sign Out",
    "path": "Path",
    "global_clock": "Global Clock",
    "operational_date": "Operational Date",
    "access_restricted": "Access Restricted",
    "restricted_message": "You do not have the required permissions to view this section.",

    // General Words & Actions
    "save": "Save",
    "cancel": "Cancel",
    "add": "Add New",
    "delete": "Delete",
    "edit": "Edit",
    "search": "Search...",
    "status": "Status",
    "active": "Active",
    "offline": "Offline",
    "online": "Online",
    "loading": "Loading...",
    "all": "All",
    "close": "Close",
    "export": "Export",
    "actions": "Actions",
    "back": "Back",
    "priority": "Priority",
    "department": "Department",
    "assigned_to": "Assigned To",
    "due_date": "Due Date",
    "location": "Location",
    "creator": "Creator",
    "comments": "Comments",
    "add_comment": "Add Comment",
    "view_details": "View Details",
    "success": "Success",
    "error": "Error",
    "add_new_task": "Add New Task",
    "title": "Title",
    "description": "Description",

    // Dashboard Screen (and widgets)
    "dashboard_title": "Mission Control Dashboard",
    "dashboard_subtitle": "Overview of active operations and safety metrics.",
    "gate_status": "Gate Status",
    "open_gates": "Open Gates",
    "active_tasks": "Active Tasks",
    "urgent_incidents": "Urgent Incidents",
    "patrol_team": "Patrol Team",
    "on_duty_wardens": "On Duty Staff",
    "emergency_status": "Emergency Status",
    "secured": "SECURED",
    "active_alerts": "ACTIVE ALERTS",
    "quick_actions": "Quick Actions",
    "trigger_alarm": "Trigger Emergency Alarm",
    "report_incident": "Report Active Incident",
    "verify_gate": "Verify Gate Access",
    "export_pdf": "Export operational report to PDF",
    "visitor_flow": "Visitor Footfall & Capacity",
    "current_occupancy": "Current Occupancy",
    "capacity_reached": "Capacity Reached",
    "capacity_limit": "Max Site Capacity Limit",
    "site_status_monitor": "Site Infrastructure Status",
    "total_completed": "Total Completed",
    "pending_task_count": "Pending Actions",
    "recent_activity": "Live Stream Activity Feed",
    "view_all_staff": "View On Duty Roster",
    "daily_weather": "Daily Weather Forecast",
    "today_briefing": "Daily Shift Briefing Instructions",
    "weather": "Weather",
    "visitors": "Visitors",
    "operations": "Operations",
    "metrics": "Metrics",

    // Gate Control Screen
    "gate_title": "Secure Gate Infrastructure",
    "gate_subtitle": "Manage site access, lock status, and entry authorization.",
    "live_visitor_counter": "Live Visitor Counter Engine",
    "visitor_counter_subtitle": "Increments represent entry and exit triggers.",
    "total_site_entries": "Total Site Entries Today",
    "main_entrance_stats": "Main Entrance Flow Rate",
    "inner_monument_pod": "Inner Monument POD Access",
    "inner_occupancy": "Inner Occupancy Flow",
    "recent_gate_trigger_logs": "Recent Gate Trigger Logs",
    "direction": "Direction",
    "gate_name": "Gate Name",
    "time": "Time",
    "manual_gate_overrides": "Manual Gate Overrides & Backfills",
    "manual_override_subtitle": "Override gate status in case of card reader failure.",
    "override_gate_status": "Lock Override Gate Control",
    "unlocked_normal": "UNLOCKED (NORMAL)",
    "locked_secured": "LOCKED (SECURED)",
    "backfill_single_log": "Backfill Single Entry/Exit",
    "backfill_bulk_logs": "Bulk CSV Backfill Logs",
    "gate_flow_trends": "Gate Entry Trends",
    "visitor_footfall_by_hour": "Visitor Footfall Volume By Hour",

    // Tasks Screen
    "tasks_title": "Operation & Patrol Task Lists",
    "tasks_subtitle": "Assign and monitor guardian patrols, site maintenance, and preservation tasks.",
    "tasks_completed": "Tasks Completed",
    "tasks_pending": "Tasks Pending",
    "compliance_rate": "Operations Compliance Rate",
    "create_task": "Create Operational Shift Task",
    "task_filters": "Task Query Controls",
    "search_placeholder": "Search tasks, assignees, or locations...",
    "sorting": "Sorting Order",
    "newest_first": "Newest First",
    "oldest_first": "Oldest First",
    "highest_priority": "Highest Priority",
    "unassigned": "Unassigned Wards",

    // Incidents Screen
    "incidents_title": "Tactical Incident Desk",
    "incidents_subtitle": "Report, track, and manage safety alerts and preservation incidents.",
    "active_incidents": "Active Incidents",
    "resolved_incidents": "Resolved Incidents",
    "report_new_incident": "File New Incident Incident Report",
    "incident_category": "Incident Category",
    "severity_level": "Severity Level",
    "assignee": "Responding Officer",
    "reported_by": "Reporting Officer",
    "date_reported": "Date Reported",
    "mark_resolved": "Mark Resolved",

    // Planning Screen
    "planning_title": "Resource & Shift Planning",
    "planning_subtitle": "Visual planner of staff assignments and equipment logistics.",
    "shift_calendar": "Staff Shift Calendar",
    "daily_shifts": "Daily Scheduled Shifts",
    "equipment_allocation": "Equipment Allocation Logs",
    "gear_id": "Gear Block ID",
    "radio_id": "Radio ID",
    "veh_id": "Vehicle Assignment",
    "dispatch_gear": "Dispatch Tactical Gear Pack",

    // Staff / Map Screen
    "staff_title": "Staff Location Engine",
    "staff_subtitle": "Map and geofence boundary coordinate engine.",
    "map_geofence": "Perimeter Map & Geofence",
    "geofence_secured": "Geofence Status: SECURED",
    "geofence_secured_desc": "All active on-duty staff are verified inside boundary definitions. Perimeter integrity optimized.",
    "geofence_breach": "Perimeter Breach Warning!",
    "geofence_breach_desc": "active staff member(s) clocked-in outside the geofence radius. Review exact coordinates.",
    "bound_tracked": "Bound Tracked",
    "safe_inside": "Safe Inside",
    "configure_barrier": "Configure Boundary Barrier",
    "perimeter_radius": "Perimeter Radius:",
    "preset_locations": "Target Center Preset Points",
    "seed_demo_logs": "Seed Demo Boundary Logs",

    // Rota Screen
    "rota_title": "Shift & Rota Management",
    "rota_subtitle": "Coordinate staff schedules and site coverage."
  },
  ar: {
    // Nav Items
    "dashboard": "لوحة القيادة",
    "gate": "التحكم بالبوابة",
    "tasks": "المهام",
    "incidents": "الحوادث",
    "planning": "التخطيط",
    "staff": "الموظفين",
    "rota": "جدول المناوبات",
    "analytics": "التحليلات",
    "emergency": "الطوارئ",
    "settings": "الإعدادات",
    "handover": "تسليم المناوبات",
    "permits": "التصاريح",
    "permits_title": "تصاريح عمليات الموقع",
    "permits_subtitle": "ترخيص والتحقق من الأعمال عالية المخاطر، والأبحاث، وتحليق الطائرات بدون طيار، والوصول الخاص.",
    "apply_for_permit": "طلب تصريح عمليات",
    "active_permits": "التصاريح النشطة",
    "pending_permits": "قيد الانتظار",
    "rejected_permits": "المرفوضة",
    "expired_permits": "منتهية الصلاحية",
    "all_permits": "جميع التصاريح",
    "permit_type": "نوع التصريح",
    "applicant": "مقدم الطلب",
    "priority_level": "مستوى الخطورة",
    "approved_by": "تمت الموافقة من قِبَل",
    "start_date": "تاريخ البدء",
    "end_date": "تاريخ الانتهاء",
    "area": "المنطقة المحددة بالموقع",
    "risk_profile": "مستوى الأمان / المخاطر",
    "action_approve": "تفعيل / موافقة",
    "action_reject": "رفض الطلب",
    "sign_out": "تسجيل الخروج",
    "path": "المسار",
    "global_clock": "الساعة العالمية",
    "operational_date": "تاريخ العمليات",
    "access_restricted": "الوصول مقيد",
    "restricted_message": "ليس لديك الصلاحيات اللازمة لعرض هذا القسم.",

    // General Words & Actions
    "save": "حفظ",
    "cancel": "إلغاء",
    "add": "إضافة جديد",
    "delete": "حذف",
    "edit": "تعديل",
    "search": "بحث...",
    "status": "الحالة",
    "active": "نشط",
    "offline": "غير متصل",
    "online": "متصل",
    "loading": "جاري التحميل...",
    "all": "الكل",
    "close": "إغلاق",
    "export": "تصدير",
    "actions": "الإجراءات",
    "back": "رجوع",
    "priority": "الأهمية",
    "department": "القسم",
    "assigned_to": "المعين له",
    "due_date": "تاريخ الاستحقاق",
    "location": "الموقع الجغرافي",
    "creator": "المنشئ",
    "comments": "التعليقات",
    "add_comment": "إضافة تعليق",
    "view_details": "عرض التفاصيل",
    "success": "نجاح العملية",
    "error": "خطأ",
    "add_new_task": "إضافة مهمة جديدة",
    "title": "العنوان",
    "description": "الوصف التفصيلي",

    // Dashboard Screen
    "dashboard_title": "لوحة عمليات التحكم الرئيسية",
    "dashboard_subtitle": "نظرة عامة على العمليات النشطة ومقاييس السلامة والأمن.",
    "gate_status": "حالة البوابة",
    "open_gates": "البوابات المفتوحة",
    "active_tasks": "المهام النشطة",
    "urgent_incidents": "الحوادث الطارئة",
    "patrol_team": "فريق الدورية",
    "on_duty_wardens": "الموظفين المناوبين",
    "emergency_status": "حالة الطوارئ",
    "secured": "مؤمن بالكامل",
    "active_alerts": "تنبيهات نشطة",
    "quick_actions": "إجراءات سريعة",
    "trigger_alarm": "إطلاق جرس إنذار الطوارئ",
    "report_incident": "أبلغ عن حادث نشط",
    "verify_gate": "التحقق من تصريح البوابة",
    "export_pdf": "تصدير تقرير العمليات لملف PDF",
    "visitor_flow": "تدفق الزوار والسعة الاستيعابية",
    "current_occupancy": "الإشغال الحالي للموقع",
    "capacity_reached": "تم الوصول للحد الأقصى",
    "capacity_limit": "الحد الأقصى لسعة الموقع",
    "site_status_monitor": "مراقبة البنية التحتية والأنظمة",
    "total_completed": "إجمالي المهام المكتملة",
    "pending_task_count": "الإجراءات المعلقة",
    "recent_activity": "تغذية البث المباشر للأنشطة",
    "view_all_staff": "عرض قائمة الحراس المناوبين",
    "daily_weather": "النشرة الجوية اليومية للموقع",
    "today_briefing": "تعليمات وتوجيهات المناوبة اليومية",
    "weather": "طقس اليوم",
    "visitors": "الزوار الحاليين",
    "operations": "العمليات",
    "metrics": "المؤشرات والأرقام",

    // Gate Control Screen
    "gate_title": "بنية بوابات الحماية الآمنة",
    "gate_subtitle": "إدارة تصاريح الدخول للموقع، حالة الأقفال والتراخيص الأمنية.",
    "live_visitor_counter": "محرك عداد الزوار الفوري المباشر",
    "visitor_counter_subtitle": "الزيادات تمثل إشارات استشعار بوابات الدخول والخروج.",
    "total_site_entries": "مجموع من دخلوا الموقع اليوم",
    "main_entrance_stats": "معدل تدفق مدخل البوابة الرئيسية",
    "inner_monument_pod": "بوابة النطاق الداخلي (POD)",
    "inner_occupancy": "تدفق الإشغال الداخلي للموقع",
    "recent_gate_trigger_logs": "سجلات الحضور وتجاوز البوابات الأخيرة",
    "direction": "الاتجاه",
    "gate_name": "اسم البوابة",
    "time": "التوقيت",
    "manual_gate_overrides": "التجاوز اليدوي وتصحيح الحضور للبوابات",
    "manual_override_subtitle": "التحكم اليدوي المباشر وفترات تصحيح الأخطاء في أجهزة القراءة.",
    "override_gate_status": "التحكم في تجاوز قفل البوابة المالي",
    "unlocked_normal": "مفتوح (اعتيادي)",
    "locked_secured": "مغلق ومؤمن (حالة طوارئ)",
    "backfill_single_log": "تسجيل دخول/خروج فردي يدوي",
    "backfill_bulk_logs": "تسجيل كميات ضخمة عبر ملف CSV",
    "gate_flow_trends": "اتجاهات تدفق البوابة التاريخية",
    "visitor_footfall_by_hour": "مستويات إقبال الزوار حسب الساعات اليومية",

    // Tasks Screen
    "tasks_title": "قوائم مهام العمليات والدوريات",
    "tasks_subtitle": "تعيين ومراقبة دوريات الحراسة، صيانة الموقع، ومهام حفظ المعالم التاريخية.",
    "tasks_completed": "المهام التي تم إنجازها",
    "tasks_pending": "المهام التي لم تنجز بعد",
    "compliance_rate": "معدل امتثال العمليات الميدانية",
    "create_task": "إنشاء مهمة عمل تشغيلية جديدة",
    "task_filters": "عناصر تصفية وفرز المهام الميدانية",
    "search_placeholder": "البحث في المهام، المنفذين، أو الأماكن...",
    "sorting": "طريقة الترتيب والعرض",
    "newest_first": "الأحدث أولاً",
    "oldest_first": "الأقدم أولاً",
    "highest_priority": "الأهم فالأهم",
    "unassigned": "نطاقات غير معينة لأحد الموظفين",

    // Incidents Screen
    "incidents_title": "مكتب إدارة الحوادث التكتيكية",
    "incidents_subtitle": "الإبلاغ عن التنبيهات الأمنية، تتبعها، وإدارة حوادث حفظ وسلامة الموقع.",
    "active_incidents": "الحوادث المفتوحة والنشطة",
    "resolved_incidents": "الحوادث التي تم حلها وإغلاقها",
    "report_new_incident": "رفع نموذج تقرير وإثبات حادث ميداني",
    "incident_category": "تصنيف الحادث الميداني",
    "severity_level": "مستوى الخطورة والحرجية",
    "assignee": "الضابط المستجيب للحالة",
    "reported_by": "الضابط الذي أبلغ عن الحالة",
    "date_reported": "تاريخ ووقت التقرير الميداني",
    "mark_resolved": "تحديد كمحلول ومغلق",

    // Planning Screen
    "planning_title": "تخطيط الموارد والمناوبات",
    "planning_subtitle": "مخطط مرئي لتوزيع مهام الموظفين واللوجستيات والمعدات.",
    "shift_calendar": "جدول مناوبات عمل الموظفين الرقمي",
    "daily_shifts": "كتل المناوبات اليومية المجدولة",
    "equipment_allocation": "سجل تخصيص العتاد والأجهزة التكتيكية",
    "gear_id": "رقم تعريف العتاد",
    "radio_id": "شبكة الراديو واللاسلكي",
    "veh_id": "مركبة الدورية المخصصة",
    "dispatch_gear": "صرف حقيبة عتاد تكتيكي ميداني",

    // Staff / Map Screen
    "staff_title": "محرك تحديد مواقع الموظفين",
    "staff_subtitle": "محرك الخريطة الرقمية وإحداثيات السياج الجغرافي.",
    "map_geofence": "خريطة النطاق والسياج الجغرافي",
    "geofence_secured": "حالة السياج الجغرافي: آمن",
    "geofence_secured_desc": "تم التحقق من وجود جميع الموظفين النشطين داخل النطاق المحدد. تكامل أمني محصن.",
    "geofence_breach": "تحذير من اختراق النطاق التجريبي!",
    "geofence_breach_desc": "موظف(عون) نشط سجل الحضور خارج نطاق القطر المحدد. تفقد الإحداثيات الدقيقة بالأسفل.",
    "bound_tracked": "الحدود المتعقبة",
    "safe_inside": "آمن بالداخل",
    "configure_barrier": "تعديل سياج الحماية",
    "perimeter_radius": "قطر سياج الحماية:",
    "preset_locations": "نقاط الارتكاز الأثرية المحددة مسبقاً",
    "seed_demo_logs": "توليد سجلات إحداثيات تجريبية",

    // Rota Screen
    "rota_title": "إدارة المناوبات والجداول",
    "rota_subtitle": "تنسيق جداول الموظفين وتغطية الموقع بالكامل."
  }
};

const dataTranslations: Record<string, string> = {
  // Roles
  "admin": "مسؤول النظام",
  "manager": "المدير الميداني",
  "user": "عضو الفريق الميداني",
  "warden": "الموظف الميداني",
  "guard": "الموظف الميداني",
  "Admin": "مسؤول النظام",
  "Manager": "المدير الميداني",
  "User": "عضو الفريق الميداني",
  "Warden": "الموظف الميداني",
  "Guard": "الموظف الميداني",

  // Departments
  "Visitor Experience": "تجربة الزوار",
  "Visitor Services": "خدمات الزوار",
  "Business Support": "الدعم الإداري",
  "Facility Management": "إدارة المرافق والخدمات",
  "Security": "الأمن والمراقبة الميدانية",
  "Conservation": "الصون والحفاظ الأثري",
  "Heritage Management": "إدارة وحماية التراث",
  "Visitor experience": "تجربة الزوار",
  "Visitor services": "خدمات الزوار",
  "Business support": "الدعم الإداري",
  "Facility management": "إدارة المرافق والخدمات",
  "security": "الأمن والمراقبة الميدانية",
  "conservation": "الصون والحفاظ الأثري",
  "heritage management": "إدارة وحماية التراث",

  // Priorities / Severities
  "high": "مرتفع الخطورة",
  "medium": "متوسط الأهمية",
  "low": "منخفض الأهمية",
  "critical": "عاجل وحرج جداً",
  "High": "مرتفع الخطورة",
  "Medium": "متوسط الأهمية",
  "Low": "منخفض الأهمية",
  "Critical": "عاجل وحرج جداً",

  // Statuses
  "pending": "قيد الانتظار",
  "completed": "تم الإنجاز ومكتمل",
  "in_progress": "قيد التنفيذ والمتابعة",
  "in-progress": "قيد التنفيذ والمتابعة",
  "In Progress": "قيد التنفيذ والمتابعة",
  "resolved": "تم الحل والإغلاق",
  "unresolved": "لم يحل بعد",
  "active": "نشط وفوري",
  "inactive": "غير نشط",
  "online": "متصل بالشبكة",
  "offline": "غير متصل بالشبكة",
  "open": "مفتوح بنجاح",
  "closed": "مغلق ومقفل",
  "locked": "مغلق مع تأمين القفل",
  "unlocked": "مفتوح وغير مقفل",
  "secured": "مؤمن بالكامل",
  "alarm": "جرس الإنذار الميداني",
  "checked": "تم الفحص والتحقق",
  "approved": "تمت الموافقة الرسمية",
  "declined": "تم الرفض والرد",
  "rejected": "تم الرفض والرد",
  "requested": "مرفوع للمراجعة",
  "on Duty": "على رأس المناوبة",
  "on duty": "على رأس المناوبة",
  "On Duty": "على رأس المناوبة",

  // Gate actions / directions
  "entry": "تسجيل دخول زائر",
  "exit": "تسجيل خروج زائر",
  "Entry": "تسجيل دخول زائر",
  "Exit": "تسجيل خروج زائر",
  "clock_in": "تسجيل حضور الموظف",
  "clock_out": "تسجيل انصراف الموظف",
  "clock in": "تسجيل حضور الموظف",
  "clock out": "تسجيل انصراف الموظف",
  "Clock In": "تسجيل حضور الموظف",
  "Clock Out": "تسجيل انصراف الموظف",

  // Map and Location presets
  "Stonehenge (Wiltshire, UK)": "موقع ستونهنج الأثري (ويلتشير، بريطانيا)",
  "Your Current Physical Location": "موقعك الجغرافي الفعلي الحالي",
  "Visitor Center": "مركز استقبال الزوار الرئيسي",
  "North Barrow": "منطقة التل الأثري الشمالي",
  "Stone Circle Center": "مركز حلقة الأحجار الدائرية الأثرية",
  "Heel Stone Viewpoint": "نقطة مشاهدة حجر كعب الأثرية",
  "All Active On-duty Positions": "جميع مواقع انتشار الحراس المناوبين",
  "Stonehenge Arch": "قوس ستونهنج الأثري المعلمي",
  "East Chamber": "غرفة معالم الجهة الشرقية",
  "South Gatehouse": "مبنى بوابات الأمن الجنوبي",
  "Stone Stonehenge Center": "مركز معالم أحجار ستونهنج الوسطى",

  // Common Task titles/descriptions
  "Patrol of Stonehenge Perimeter": "دورية ميدانية تفقدية حول محيط ستونهنج",
  "Wayside maintenance check": "صيانة ممرات المشاة وفحص العلامات الإرشادية",
  "Inspect Standing Stones for weathering": "فحص هيكلية الأحجار لرصد أي تأثر بالتعرية الجوية",
  "Verify fire extinguisher status": "التحقق من صلاحية وجاهزية طفايات الحريق في الميدان",
  "Replenish educational brochures": "تغذية منصات الاستعلام بالكتيبات الإرشادية للزوار",
  "Clean Visitor Center surroundings": "أعمال تنظيف وصيانة الساحة الخارجية لمركز الزوار",
  "Monitor main entrance crowd": "مراقبة تنظيم الكثافات البشرية عند المعبر الرئيسي للموقع",
  "Update daily shift report": "تسجيل وتحديث ملخص المناوبة وتقرير العمليات اليومي",
  "Coordinate school visit path": "جدولة وتحديد مسار الرحلات الطلابية داخل المعالم الأثرية",
  "Check emergency exits": "فحص وفتح مخارج الطوارئ وفحص اللوحات المضيئة لسلامتها",

  // Common Incidents
  "Suspicious activity near West Wall": "رصد سلوك مريب ومحاولة تجاوز سياج الحماية الغربي",
  "Minor cracks on standing stones": "ظهور شقوق طفيفة تتطلب فحص مهندسي الآثار",
  "Visitor fence breach attempt": "محاولة تسلق متكررة لسياج الحافة بالقرب من الحبل الأثري",
  "Water leakage in facility restroom": "تسرب مياه نشط وتلف في السباكة الخارجية بفيلا الإدارة",
  "Severe weather warning": "تحذير طوارئ جوية واحتمال هطول أمطار غزيرة وعواصف",
  "Trash accumulation near trail": "امتلاء وتراكم سلات النفايات بالمحاذاة من الممر الدائري",
  "Broken lighting on south path": "انقطاع التيار وتلف الإنارة العامة في المسار السياحي الجنوبي",
  "Suspicious Activity": "نشاط أمني مشبوه",
  "Debris in Pathway": "وجود عوائق وحجارة في الممر السياحي",
  "Water Leak": "تسريب للمياه في البنية والمرافق",
  "Fire": "اندلاع حريق ميداني",
  "Theft": "بلاغ سرقة أو ممتلكات مفقودة",
  "Medical": "حالة وحادث صحي استدعى تدخلاً طبياً",
  "Other": "حدث آخر غير مصنف",
  "Debris": "عوائق في الممر",
  "Leak": "تسريب للمياه",
  "theft": "بلاغ سرقة أو فقد ممتلكات",
  "medical": "حالة وطوارئ طبية",
  "other": "نص آخر أو حدث غير مصنف",

  // Staff User Names
  "John Doe": "جون دو (حارس)",
  "Jane Smith": "جين سميث (مشرفة)",
  "Sarah Connor": "سارة كونور (مسؤولة)",
  "Alex Mercer": "أليكس ميرسر (أمن)",
  "Admin User": "مسؤول النظام الرئيسي",
  "Test User": "المستخدم التجريبي العام",
  "System": "نظام الأتمتة التلقائي",
  "system": "نظام الأتمتة التلقائي",

  // Days of the week for Rota/Planning
  "Monday": "الإثنين",
  "Tuesday": "الثلاثاء",
  "Wednesday": "الأربعاء",
  "Thursday": "الخميس",
  "Friday": "الجمعة",
  "Saturday": "السبت",
  "Sunday": "الأحد",
  "Mon": "الإثنين",
  "Tue": "الثلاثاء",
  "Wed": "الأربعاء",
  "Thu": "الخميس",
  "Fri": "الجمعة",
  "Sat": "السبت",
  "Sun": "الأحد",

  // Shift types
  "Morning Shift": "المناوبة الميدانية الصباحية",
  "Day Shift": "المناوبة الميدانية النهارية",
  "Evening Shift": "المناوبة الميدانية المسائية",
  "Night Shift": "المناوبة الميدانية الليلية",
  "morning": "صباحية",
  "evening": "مسائية",
  "night": "ليلية",

  // Clock Log details & notes
  "Regular clock in from site entrance": "تسجيل حضور اعتيادي عند بوابات الدخول للموقع",
  "Clocked in near Stonehenge monument": "تسجيل دخول ميداني مع رصد نظام GPS بالقرب من النطاق",
  "Manual coordinator seed log": "سجل إحداثيات مصنع لأغراض المحاكاة والتجربة المفتوحة",
  "Automatic GPS tracking update": "تحديث تلقائي لإحداثيات التتبع الجغرافي عبر هاتف الموظف",

  // Emergency situations
  "Intruder": "مقتحم أو متسلل خارجي للموقع",
  "Fire alarm triggered": "تم تفعيل إنذار الحريق العام في الميدان",
  "Power outage": "انقطاع كلي للتيار الكهربائي عن المرافق",
  "Medical emergency": "حالة صحية حرجة تستدعي الإسعاف الفوري",
  "Structural damage control": "تضرر جزء من المنشأة وجاري السيطرة الإنشائية",
  "High alert briefing": "بيان عاجل وتوجيهات الطوارئ ذات الكثافة العالية"
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("app_lang");
    return (saved === "ar" || saved === "en") ? saved : "en";
  });

  const dir = language === "ar" ? "rtl" : "ltr";

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("app_lang", lang);
  };

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language, dir]);

  const t = (key: string): string => {
    if (!key) return "";
    const cleanKey = key.trim().toLowerCase();
    return translations[language][cleanKey] || translations[language][key] || translations["en"][cleanKey] || translations["en"][key] || key;
  };

  const tData = (value: any): string => {
    if (value === null || value === undefined) return "";
    if (typeof value !== "string") return String(value);
    
    if (language === "en") return value;
    
    const text = value.trim();
    
    // Check exact match
    if (dataTranslations[text]) {
      return dataTranslations[text];
    }
    
    // Check lowercase key-insensitive match
    if (dataTranslations[text.toLowerCase()]) {
      return dataTranslations[text.toLowerCase()];
    }
    
    // Fallback search and partial replacement logic for common strings
    let translated = text;
    const phrases = Object.keys(dataTranslations).sort((a, b) => b.length - a.length);
    for (const phrase of phrases) {
      if (phrase.length > 2) {
        // Safe replacement
        const escapedPhrase = phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedPhrase}\\b`, 'gi');
        if (regex.test(translated)) {
          translated = translated.replace(regex, dataTranslations[phrase]);
        }
      }
    }
    
    return translated;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, dir, t, tData }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
