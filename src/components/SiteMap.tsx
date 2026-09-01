import React, { useState } from "react";
import { Map, RefreshCw } from "lucide-react";
import { cn } from "../lib/utils";

// Normalizes the area name to one of our map zone IDs
export const normalizeAreaToZoneId = (area: string): string => {
  if (!area) return "";
  const a = area.toLowerCase();
  if (a.includes("inner") || a.includes("sanctum") || a.includes("grid b") || a.includes("horseshoe")) {
    return "inner";
  }
  if (a.includes("trench") || a.includes("perimeter") || a.includes("boundary")) {
    return "trenches";
  }
  if (a.includes("axis") || a.includes("portal") || a.includes("alignment") || a.includes("avenue")) {
    return "axis";
  }
  if (a.includes("sarsen") || a.includes("stone") || a.includes("outer") || a.includes("ring")) {
    return "sarsen";
  }
  return "";
};

interface SiteMapProps {
  selectedArea: string;
  onSelectZone: (zoneId: string | null) => void;
  language: "en" | "ar";
}

export function SiteMap({ selectedArea, onSelectZone, language }: SiteMapProps) {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const activeZoneId = normalizeAreaToZoneId(selectedArea);

  const zones = [
    {
      id: "inner",
      name_en: "Inner Sanctum Ring-B",
      name_ar: "حرم الهيكل الداخلي - حلقة ب",
      color: "stroke-emerald-500 fill-emerald-500/20 hover:fill-emerald-500/35",
      highlightColor: "stroke-emerald-400 fill-emerald-500/40 text-emerald-400 shadow-emerald-500/50",
      description_en: "Central horseshoe trilithons. Max restriction. Authorized scientific GPR or laser scan only.",
      description_ar: "المجموعة المركزية الأثرية. أقصى درجات الحماية. مصرح للأبحاث العلمية المعتمدة فقط.",
    },
    {
      id: "sarsen",
      name_en: "Sarsen Outer Stones Ring",
      name_ar: "محيط أحجار السارسن الخارجية",
      color: "stroke-indigo-500 fill-indigo-500/15 hover:fill-indigo-500/30",
      highlightColor: "stroke-indigo-400 fill-indigo-500/35 text-indigo-400 shadow-indigo-500/50",
      description_en: "Great circle standing stones. Moderate lichen restoration activity permitted here.",
      description_ar: "دائرة أحجار العبور القائمة الكبرى. يسمح بأنشطة ترميم وتصوير خفيفة.",
    },
    {
      id: "trenches",
      name_en: "Perimeter Trenches & Boundary",
      name_ar: "الخنادق والحدود الخارجية",
      color: "stroke-sky-500 fill-sky-500/15 hover:fill-sky-500/30",
      highlightColor: "stroke-sky-400 fill-sky-500/35 text-sky-450 shadow-sky-500/50",
      description_en: "Surrounding grassy bank & soil borders. Ground resistivity sensing and surveying.",
      description_ar: "المحيط الترابي والخنادق الدائرية. تفيد لمسح المقاومة الكهربائية والمقاييس المترية.",
    },
    {
      id: "axis",
      name_en: "Sunset Axis Alignment Portal",
      name_ar: "محور درب الاعتدال الشمسي",
      color: "stroke-amber-500 fill-amber-500/15 hover:fill-amber-500/30",
      highlightColor: "stroke-amber-400 fill-amber-500/35 text-amber-400 shadow-amber-500/50",
      description_en: "Northeast avenue pathway aligned to solstice sunset axis. Photography & filming hotspot.",
      description_ar: "طريق الدخول الشمالي الشرقي المحاذي لغروب الاعتدال. منطقة تصوير وإرشاد مكثف.",
    }
  ];

  const handleZoneClick = (id: string) => {
    // If clicking already active zone, toggle filter off
    if (activeZoneId === id) {
      onSelectZone(null);
    } else {
      onSelectZone(id);
    }
  };

  const getActiveZoneInfo = () => {
    return zones.find(z => z.id === (hoveredZone || activeZoneId));
  };

  const activeInfo = getActiveZoneInfo();
  const isRtl = language === "ar";

  return (
    <div className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 p-5 shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[380px]">
      {/* Background Grid Pattern Overlay for High Tech Cartographic feel */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:14px_14px] opacity-25 pointer-events-none" />
      
      {/* Map Header */}
      <div className={cn("flex items-center justify-between border-b border-slate-800 pb-3 relative z-10", isRtl && "flex-row-reverse text-right")}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <Map size={14} />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">
              {language === "ar" ? "خريطة الموقع التفاعلية للتصاريح" : "Live Permit Area Site Map"}
            </h4>
            <p className="text-[10px] text-slate-400 font-medium">
              {language === "ar" ? "انقر على منطقة لمطابقتها وفلترة التصاريح الصادرة لها" : "Interactive SVG vectors. Click zones to select/filter permits"}
            </p>
          </div>
        </div>
        {activeZoneId && (
          <button
            onClick={() => onSelectZone(null)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-[9px] font-bold text-slate-300 rounded-lg flex items-center gap-1 border border-slate-700 active:scale-95 duration-100 cursor-pointer text-center"
          >
            <RefreshCw size={10} className="animate-spin-slow" />
            <span>{language === "ar" ? "إعادة تعيين" : "Reset Filter"}</span>
          </button>
        )}
      </div>

      {/* Interactive Vector Stage */}
      <div className="my-4 flex items-center justify-center relative min-h-[180px] z-10">
        <svg viewBox="0 0 400 300" className="w-full max-w-[340px] h-full overflow-visible">
          {/* DEFINITIONS FOR NEON GLOWS */}
          <defs>
            <filter id="glow-emerald" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-indigo" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-sky" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 1. OUTER TRENCHES ZONE (Sky) */}
          <g
            id="zone-trenches"
            className="cursor-pointer transition-all duration-350"
            onClick={() => handleZoneClick("trenches")}
            onMouseEnter={() => setHoveredZone("trenches")}
            onMouseLeave={() => setHoveredZone(null)}
          >
            {/* Outer Circular Embankment Ring */}
            <circle
              cx="200"
              cy="150"
              r="125"
              className={cn(
                "fill-none stroke-2 transition-all duration-300",
                activeZoneId === "trenches" ? "stroke-sky-400 stroke-[4px]" : "stroke-slate-700 hover:stroke-sky-500",
                "stroke-dasharray-4"
              )}
              style={{ strokeDasharray: "6,6" }}
              filter={activeZoneId === "trenches" ? "url(#glow-sky)" : undefined}
            />
            {/* Left and Right Boundary earth arcs */}
            <path
              d="M 95 70 A 110 110 0 0 0 95 230"
              className={cn(
                "fill-none stroke-[8px] opacity-15 hover:opacity-40 transition-all",
                activeZoneId === "trenches" ? "stroke-sky-400 opacity-80" : "stroke-slate-400"
              )}
            />
            <path
              d="M 305 70 A 110 110 0 0 1 305 230"
              className={cn(
                "fill-none stroke-[8px] opacity-15 hover:opacity-40 transition-all",
                activeZoneId === "trenches" ? "stroke-sky-400 opacity-80" : "stroke-slate-400"
              )}
            />
          </g>

          {/* 2. SUNSET AXIS PATHWAY AVENUE ZONE (Amber) */}
          <g
            id="zone-axis"
            className="cursor-pointer transition-all duration-350"
            onClick={() => handleZoneClick("axis")}
            onMouseEnter={() => setHoveredZone("axis")}
            onMouseLeave={() => setHoveredZone(null)}
          >
            {/* Radial Pathway intersecting Center to Top-East */}
            <line
              x1="200"
              y1="150"
              x2="340"
              y2="45"
              className={cn(
                "stroke-amber-500 transition-all",
                activeZoneId === "axis" ? "stroke-amber-400 stroke-4" : "stroke-slate-500 stroke-2",
                "stroke-dasharray-3"
              )}
              style={{ strokeDasharray: "4,4" }}
            />
            {/* Heel Stone Marker Icon near avenue end */}
            <circle
              cx="310"
              cy="68"
              r="7"
              className={cn(
                "transition-all stroke-1.5",
                activeZoneId === "axis" ? "fill-amber-400 stroke-amber-200" : "fill-slate-800 stroke-slate-500 hover:stroke-amber-400"
              )}
              filter={activeZoneId === "axis" ? "url(#glow-amber)" : undefined}
            />
            <text x="312" y="55" className="fill-amber-400 text-[8px] font-mono font-bold font-sans">Heel Stone</text>
            
            {/* Avenue path boundaries */}
            <polygon
              points="195,140 325,30 345,50 210,155"
              className={cn(
                "stroke-1 cursor-pointer transition-all duration-200",
                activeZoneId === "axis" 
                  ? "stroke-amber-400 fill-amber-500/25" 
                  : "stroke-slate-800 fill-amber-500/5 hover:fill-amber-500/15"
              )}
            />
          </g>

          {/* 3. SARSEN STANDING STONES OUTER RING (Indigo) */}
          <g
            id="zone-sarsen"
            className="cursor-pointer transition-all duration-350"
            onClick={() => handleZoneClick("sarsen")}
            onMouseEnter={() => setHoveredZone("sarsen")}
            onMouseLeave={() => setHoveredZone(null)}
          >
            {/* Outer stone ring placement circle guide */}
            <circle
              cx="200"
              cy="150"
              r="70"
              className="fill-none stroke-slate-800 stroke-1"
              style={{ strokeDasharray: "2,4" }}
            />
            
            {/* Render 12 mini rect stone monoliths forming outer ring */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, index) => {
              const rad = (angle * Math.PI) / 180;
              const r = 70;
              const cx = 200 + r * Math.cos(rad);
              const cy = 150 + r * Math.sin(rad);
              const isAccent = angle === 210 || angle === 90; // mock stone #56
              return (
                <rect
                  key={index}
                  x={cx - 5}
                  y={cy - 4}
                  width="10"
                  height="8"
                  transform={`rotate(${angle}, ${cx}, ${cy})`}
                  className={cn(
                    "stroke transition-all duration-250",
                    activeZoneId === "sarsen" 
                      ? "fill-indigo-400 stroke-indigo-200" 
                      : isAccent && activeZoneId === "" 
                        ? "fill-teal-500/60 stroke-teal-300 animate-pulse"
                        : "fill-slate-700 stroke-slate-500 hover:fill-indigo-400"
                  )}
                  filter={activeZoneId === "sarsen" ? "url(#glow-indigo)" : undefined}
                />
              );
            })}
          </g>

          {/* 4. INNER SANCTUM ACCESS RING (Emerald) */}
          <g
            id="zone-inner"
            className="cursor-pointer transition-all duration-350"
            onClick={() => handleZoneClick("inner")}
            onMouseEnter={() => setHoveredZone("inner")}
            onMouseLeave={() => setHoveredZone(null)}
          >
            {/* Horseshoe inner path ring */}
            <path
              d="M 160 175 A 40 40 0 1 1 240 175 L 225 140 A 25 25 0 1 0 175 140 Z"
              className={cn(
                "stroke transition-all duration-200",
                activeZoneId === "inner" 
                  ? "stroke-emerald-400 fill-emerald-500/35" 
                  : "stroke-slate-800 fill-emerald-500/5 hover:fill-emerald-500/20"
              )}
              filter={activeZoneId === "inner" ? "url(#glow-emerald)" : undefined}
            />

            {/* Giant trilithons (5 distinct groups in inner sanctum horseshoe layout) */}
            {[
              { x: 170, y: 165, w: 14, h: 7, r: 40 },
              { x: 165, y: 135, w: 14, h: 7, r: 75 },
              { x: 200, y: 120, w: 16, h: 8, r: 0 },
              { x: 235, y: 135, w: 14, h: 7, r: -75 },
              { x: 230, y: 165, w: 14, h: 7, r: -40 }
            ].map((stone, idx) => (
              <rect
                key={idx}
                x={stone.x - stone.w / 2}
                y={stone.y - stone.h / 2}
                width={stone.w}
                height={stone.h}
                transform={`rotate(${stone.r}, ${stone.x}, ${stone.y})`}
                className={cn(
                  "stroke-1.5 transition-all duration-150",
                  activeZoneId === "inner" 
                    ? "fill-emerald-400 stroke-emerald-100" 
                    : "fill-slate-500 stroke-slate-300 hover:fill-emerald-400"
                )}
              />
            ))}
          </g>

          {/* Center compass/location pin */}
          <circle cx="200" cy="150" r="3.5" className="fill-slate-100" />
          <circle cx="200" cy="150" r="10" className="fill-none stroke-slate-500 stroke-0.5" />
        </svg>
      </div>

      {/* Dynamic Zone Description Footnote card wrapper */}
      <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 text-xs transition-all relative">
        {activeInfo ? (
          <div>
            <div className={cn("flex items-center gap-1.5", isRtl && "flex-row-reverse text-right")}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="font-black text-slate-200 text-xs">
                {language === "ar" ? activeInfo.name_ar : activeInfo.name_en}
              </span>
              <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-indigo-400 font-mono text-[9px] font-black uppercase tracking-wider">
                {activeInfo.id}
              </span>
            </div>
            <p className={cn("text-slate-400 mt-1 font-medium leading-relaxed text-[10.5px]", isRtl && "text-right")}>
              {language === "ar" ? activeInfo.description_ar : activeInfo.description_en}
            </p>
          </div>
        ) : (
          <div className="text-center py-2 text-slate-500">
            <p className="text-[10px] font-black uppercase tracking-widest">
              {language === "ar" ? "قائمة المناطق الجغرافية المعتمدة" : "Select Region Contour"}
            </p>
            <p className="text-[9px] font-bold text-slate-600 mt-0.5">
              {language === "ar" ? "انقر على أحد مسارات خريطة الهيكل لمشاهدة تفاصيل الترخيص" : "Hover or click geometric contours to analyze localized deployment rules"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
