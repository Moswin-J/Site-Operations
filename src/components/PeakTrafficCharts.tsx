import React from "react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Legend
} from "recharts";
import { Gauge, Clock, AlertTriangle, Users, TrendingUp, Sparkles, Activity } from "lucide-react";
import { cn } from "../lib/utils";

interface PeakTrafficChartsProps {
  currentMainCount: number;
  currentPodCount: number;
  capacity: number;
  language: "en" | "ar";
}

export function PeakTrafficCharts({ currentMainCount, currentPodCount, capacity, language }: PeakTrafficChartsProps) {
  const isRtl = language === "ar";
  const totalLive = currentMainCount + currentPodCount;
  const occupancyPercent = Math.min(100, Math.round((totalLive / capacity) * 100));

  // Generate realistic hourly profile representation
  const hourlyData = [
    { hour: "08:00", main: 45, pod: 12, total: 57 },
    { hour: "09:00", main: 82, pod: 18, total: 100 },
    { hour: "10:00", main: 154, pod: 42, total: 196 }, // Peak 1: Morning Tour buses
    { hour: "11:00", main: 190, pod: 58, total: 248 },
    { hour: "12:00", main: 165, pod: 64, total: 229 },
    { hour: "13:00", main: 130, pod: 50, total: 180 },
    { hour: "14:00", main: 215, pod: 78, total: 293 }, // Peak 2: General Afternoon surge
    { hour: "15:00", main: 240, pod: 95, total: 335 }, // Critical Peak
    { hour: "16:00", main: 180, pod: 85, total: 265 },
    { hour: "17:00", main: 110, pod: 45, total: 155 },
    { hour: "18:00", main: 95, pod: 30, total: 125 },
    { hour: "19:00", main: 135, pod: 55, total: 190 }, // Evening Solstice prep list
    { hour: "20:00", main: 175, pod: 120, total: 295 }, // Peak 3: Golden Hour/Sunset alignment
    { hour: "21:00", main: 80, pod: 50, total: 130 },
    { hour: "22:00", main: 25, pod: 5, total: 30 },
  ];

  // Dynamically inject the actual LIVE count into the current hour block for ultra realism!
  const currentHour = new Date().getHours();
  const currentHourStr = `${currentHour.toString().padStart(2, "0")}:00`;
  const existingHourIdx = hourlyData.findIndex(d => d.hour === currentHourStr);
  if (existingHourIdx !== -1) {
    hourlyData[existingHourIdx].main = currentMainCount;
    hourlyData[existingHourIdx].pod = currentPodCount;
    hourlyData[existingHourIdx].total = totalLive;
  }

  // Determine site status severity
  const getCapacityStatus = () => {
    if (occupancyPercent >= 90) {
      return {
        label_en: "CRITICAL LOAD",
        label_ar: "أقصى تحميل حركي",
        bg: "bg-rose-50 border-rose-200 text-rose-800",
        pings: "bg-rose-550",
        desc_en: "Site is nearing emergency threshold limit. Halt group entry queues at Main Gate.",
        desc_ar: "يفوق الموقع حاجز الطاقة الاستيعابية الفنية. يجب تعليق تفويج مجموعات الحافلات فورا.",
        severity: "critical"
      };
    } else if (occupancyPercent >= 70) {
      return {
        label_en: "HIGH CONGESTION WARNING",
        label_ar: "تحذير من كثافة مرتفعة",
        bg: "bg-amber-50 border-amber-200 text-amber-800",
        pings: "bg-amber-500",
        desc_en: "High volume detected. Anticipate backlog delay. Coordinate group entries.",
        desc_ar: "كثافات حضور قوية بالموقع. ينصح بتأخير التفويج لتقليل مستويات التكدس بين الأعمدة.",
        severity: "warning"
      };
    } else {
      return {
        label_en: "NOMINAL OCCUPANCY",
        label_ar: "حجم عبور اعتيادي",
        bg: "bg-emerald-50 border-emerald-200 text-emerald-800",
        pings: "bg-emerald-500",
        desc_en: "Smooth entries. Safety parameters are normal. Clear flow inside the ring.",
        desc_ar: "العمليات تجري بسلاسة. بارامترات التدفق ضمن الحدود الآمنة تمامًا والمؤشرات خضراء.",
        severity: "normal"
      };
    }
  };

  const status = getCapacityStatus();

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* 1. Real-Time Occupancy Analytics banner layout */}
      <div className={cn("grid grid-cols-1 lg:grid-cols-12 gap-6")}>
        
        {/* Occupancy Card (Left part of row - spanning 8 cols on large screens) */}
        <div className="lg:col-span-8 bg-white rounded-[2.5rem] border border-slate-200 p-6 flex flex-col justify-between shadow-2xs">
          
          <div className={cn("flex items-center justify-between border-b border-slate-100 pb-4 mb-4", isRtl && "flex-row-reverse")}>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-slate-100 text-slate-800 rounded-xl">
                <Gauge size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 leading-tight">
                  {language === "ar" ? "تحليلات الأداء والتدفق الزمني للموقع" : "Daily Flow Trends & Peaks Analysis"}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold">
                  {language === "ar" ? "يعرض كثافة الحضور مقارنة بمقاييس السلامة الفنية" : "Hourly visitors headcount compared to max security boundaries"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-xs font-black text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
              <span>LIVE FEED</span>
            </div>
          </div>

          {/* Core Recharts Stage */}
          <div className="h-64 w-full text-xs" id="peak-traffic-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={hourlyData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="mainFlowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="podFlowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="hour" 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  fontWeight={500} 
                  tickLine={false}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  fontWeight={500} 
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: "#0f172a", 
                    borderColor: "#1e293b", 
                    borderRadius: "14px", 
                    color: "#f8fafc",
                    fontSize: "11px",
                    fontWeight: "600"
                  }}
                  itemStyle={{ color: "#e2e8f0" }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="circle" 
                  iconSize={8}
                />
                
                {/* Reference safety threshold line */}
                <ReferenceLine 
                  y={capacity} 
                  stroke="#ef4444" 
                  strokeDasharray="4 4" 
                  strokeWidth={1.5}
                  label={{ 
                    value: isRtl ? "حد السلامة الفلكي الأقصى" : "Emergency Safety Cap", 
                    fill: "#f43f5e", 
                    fontSize: 10, 
                    fontWeight: 700,
                    position: "bottom"
                  }} 
                />

                {/* Area 1: Main Perimeter gate entries */}
                <Area 
                  name={isRtl ? "محيط البوابة الكبرى" : "Outer Perimeter Flow"}
                  type="monotone" 
                  dataKey="main" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#mainFlowGrad)" 
                />

                {/* Area 2: Inner Sanctum (Pod) entries */}
                <Area 
                  name={isRtl ? "أعضاء منطقة الحرم المغلقة" : "Inner Sanctum (Pod) Flow"}
                  type="monotone" 
                  dataKey="pod" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#podFlowGrad)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

        </div>

        {/* Capacity Meter Indicator Sidebar card (Spanning 4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Main Dial Progress Indicator */}
          <div className="bg-slate-900 text-white rounded-[2.5rem] p-6 border border-slate-800 flex flex-col justify-between flex-1 shadow-lg relative overflow-hidden">
            {/* Ambient background accent light glow */}
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
            
            <div className={cn("text-left space-y-1 block relative z-10", isRtl && "text-right")}>
              <span className="text-[9px] font-black uppercase text-indigo-400 tracking-widest leading-none block">
                {language === "ar" ? "معدل الإشغال العام" : "MONUMENT OCCUPANCY INDEX"}
              </span>
              <h4 className="text-lg font-black tracking-tight">{language === "ar" ? "الطاقة الاستيعابية الآن" : "Core Density Meter"}</h4>
            </div>

            {/* Visual Arc Dial Gauge Simulation */}
            <div className="my-6 relative flex flex-col items-center justify-center">
              <svg viewBox="0 0 100 60" className="w-40 h-full overflow-visible">
                {/* Background Track */}
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Colored Progress Arc */}
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke={occupancyPercent >= 90 ? "#f43f5e" : occupancyPercent >= 70 ? "#fbbf24" : "#10b981"}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(occupancyPercent / 100) * 125.6}, 125.6`}
                />
                
                {/* Center head-count indicator text */}
                <text x="50" y="44" className="fill-white font-black text-xs font-mono" textAnchor="middle">
                  {occupancyPercent}%
                </text>
              </svg>
              
              <div className="text-center mt-2 font-mono">
                <span className="text-xl font-bold tracking-tight text-white">{totalLive}</span>
                <span className="text-xs text-slate-500 font-extrabold mx-1">/</span>
                <span className="text-slate-400 font-extrabold text-xs">{capacity}</span>
                <p className="text-[8px] font-black text-slate-500 uppercase mt-1 tracking-widest leading-none">
                  {language === "ar" ? "زائر قائم بالموقع" : "Active Headcount"}
                </p>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-[10px] text-slate-400 font-black flex items-center justify-between font-mono">
              <div>
                <span className="text-slate-500 block text-[8px] uppercase">{language === "ar" ? "بوابة المحيط" : "OUTER GATE"}</span>
                <span className="text-emerald-400 text-xs font-bold">{currentMainCount}</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <span className="text-slate-500 block text-[8px] uppercase">{language === "ar" ? "البوابة الطوقية" : "INNER RING"}</span>
                <span className="text-amber-400 text-xs font-bold">{currentPodCount}</span>
              </div>
            </div>

          </div>

          {/* Alert Status Banner (Dynamic) */}
          <div className={cn("p-5 rounded-3xl border flex items-start gap-3.5 leading-relaxed text-xs", status.bg)}>
            <div className="p-2.5 rounded-2xl bg-white/75 shadow-xs shrink-0 flex items-center justify-center text-slate-900">
              <AlertTriangle size={15} className={cn("animate-pulse", status.severity !== "normal" ? "text-red-500" : "text-emerald-500")} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest block leading-3">{language === "ar" ? status.label_ar : status.label_en}</span>
              <p className="font-semibold text-[11px] mt-1 text-slate-800">
                {language === "ar" ? status.desc_ar : status.desc_en}
              </p>
            </div>
          </div>

        </div>

      </div>

      {/* 2. Bottleneck Predictions & Safety Forecast Checklist Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Forecast Box 1: Congestion Predictions for tomorrow */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-6 shadow-2xs text-left">
          <div className={cn("flex items-center gap-2 mb-4", isRtl && "flex-row-reverse text-right")}>
            <div className="p-2 bg-slate-50 text-indigo-600 rounded-xl">
              <TrendingUp size={16} />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-850">
                {language === "ar" ? "التنبؤ بالاختناقات المرورية المتوقعة" : "Calculated Flow Bottleneck Forecast"}
              </h4>
              <p className="text-[9px] text-slate-400 font-bold">
                {language === "ar" ? "يستخدم مسارات حجز الرحلات السياحية لحساب الكثافة الذروية" : "Predicting high congestion points based on scheduled group tours bookings"}
              </p>
            </div>
          </div>

          {/* Prediction timeline ticks */}
          <div className="space-y-3 pt-2">
            {[
              { time: "09:30 - 11:00", name_en: "Morning General Tour Surge", name_ar: "تدفق حافلات السياحة الصباحية", risk_en: "MODERATE", risk_ar: "متوسط", color: "bg-indigo-50 border-indigo-100/60 text-indigo-700 font-bold" },
              { time: "13:30 - 15:30", name_en: "Golden Circle Solstice Peak", name_ar: "قمة زحام مزار الدائرة الذهبية", risk_en: "CRITICAL LOAD", risk_ar: "أقصى حمل", color: "bg-rose-50 border-rose-100/60 text-rose-700 font-black animate-pulse" },
              { time: "20:15 - 21:00", name_en: "Sunset Celestial Alignment", name_ar: "توافق المحاذاة الشمسية لغروب اليوم", risk_en: "HIGH SURGE RISK", risk_ar: "خطر زحام مرتفع", color: "bg-amber-50 border-amber-100/60 text-amber-700 font-bold" }
            ].map((slot, index) => (
              <div key={index} className="flex items-center justify-between p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100/50 hover:bg-slate-50 hover:border-slate-200/60 transition-colors">
                <div className={cn("space-y-0.5 min-w-0 pr-2", isRtl && "text-right")}>
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-550 font-black">
                    <Clock size={11} className="text-slate-400 shrink-0" />
                    <span>{slot.time}</span>
                  </div>
                  <h5 className="text-xs font-black text-slate-900 truncate">
                    {language === "ar" ? slot.name_ar : slot.name_en}
                  </h5>
                </div>
                
                <span className={cn("px-2.5 py-1 rounded-lg border text-[8px] font-black uppercase tracking-wider shrink-0", slot.color)}>
                  {language === "ar" ? slot.risk_ar : slot.risk_en}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Forecast Box 2: Safety Guidelines checklist items */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-6 shadow-2xs text-left">
          <div className={cn("flex items-center gap-2 mb-4", isRtl && "flex-row-reverse text-right")}>
            <div className="p-2 bg-slate-50 text-emerald-600 rounded-xl">
              <Sparkles size={16} />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-850">
                {language === "ar" ? "صندوق تدابير الأمن والسلامة الفنية" : "Overwatch Automated Action checklist"}
              </h4>
              <p className="text-[9px] text-slate-400 font-bold">
                {language === "ar" ? "بروتوكولات فنية مقترحة لمنظمي الميدان لمعالجة الكثافة" : "Safety recommendations trigger dynamically depending on capacity risk metrics"}
              </p>
            </div>
          </div>

          <div className="space-y-3.5 pt-1.5 text-xs text-slate-600 font-semibold font-sans">
            {[
              {
                en: "Prepare bypass routes for tour bus parking areas.",
                ar: "تحضير وفتح قنوات تفريغ جانبية لحافلات الرحلات بمواقف السيارات.",
                active: occupancyPercent >= 60
              },
              {
                en: "Limit individual permit clearances for the Inner Sanctum.",
                ar: "تقليل وتقييد إصدار تصاريح الدخول الفردية لحرم البؤرة الدائم.",
                active: occupancyPercent >= 75
              },
              {
                en: "Initiate secondary entry spacing intervals at Main Gate.",
                ar: "تفعيل نظام تفريق زمن الدخول بفواصل دقيقتين ببوابات العبور الكبرى.",
                active: occupancyPercent >= 85
              }
            ].map((rec, index) => (
              <div key={index} className={cn("flex items-start gap-2.5 p-3 rounded-2xl border transition-all", rec.active ? "bg-amber-500/10 border-amber-500/10 text-amber-900" : "bg-slate-50/20 border-slate-100/50 text-slate-400 opacity-60")}>
                <div className="mt-0.5 shrink-0">
                  <Activity size={12} className={cn(rec.active ? "text-amber-600 animate-spin-slow" : "text-slate-400")} />
                </div>
                <p className="leading-tight text-[11px] font-medium">
                  {language === "ar" ? rec.ar : rec.en}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
