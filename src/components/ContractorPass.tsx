import React, { useRef } from "react";
import { X, Printer, ShieldCheck, CheckCircle2, AlertTriangle, QrCode } from "lucide-react";
import { cn } from "../lib/utils";

interface ContractorPassProps {
  permit: any;
  onClose: () => void;
  language: "en" | "ar";
}

export function ContractorPass({ permit, onClose, language }: ContractorPassProps) {
  const isRtl = language === "ar";
  const passRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    // Print the specific ticket element nicely
    const printContent = passRef.current?.innerHTML;
    const originalContent = document.body.innerHTML;
    
    if (printContent) {
      // Create simple printing iframe or override body
      const style = document.createElement("style");
      style.innerHTML = `
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            padding: 20px !important;
            font-family: system-ui, sans-serif !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            border: 2px solid #000 !important;
            border-radius: 12px !important;
            padding: 24px !important;
            max-width: 450px !important;
            margin: 0 auto !important;
            box-shadow: none !important;
          }
        }
      `;
      document.head.appendChild(style);
      window.print();
      document.head.removeChild(style);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "critical":
        return "border-rose-500 bg-rose-500 text-white";
      case "high":
        return "border-amber-500 bg-amber-500 text-slate-950";
      case "medium":
        return "border-indigo-500 bg-indigo-500 text-white";
      default:
        return "border-emerald-500 bg-emerald-500 text-white";
    }
  };

  const getBarcodeLines = () => {
    const lines = [];
    const pattern = [2, 1, 3, 1, 4, 1, 2, 3, 1, 2, 4, 2, 1, 3, 1, 4, 2, 1, 2, 2, 3, 1];
    for (let i = 0; i < 26; i++) {
      const widthNum = pattern[i % pattern.length];
      const isBlack = i % 2 === 0;
      lines.push(
        <div 
          key={i} 
          className={cn(isBlack ? "bg-slate-950" : "bg-transparent")} 
          style={{ width: `${widthNum}px`, height: "40px" }} 
        />
      );
    }
    return lines;
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col no-print">
        {/* Modal Toolbar */}
        <div className={cn("p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50", isRtl && "flex-row-reverse")}>
          <div className="flex items-center gap-2">
            <Printer size={16} className="text-slate-550" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              {language === "ar" ? "قسيمة تصريح المقاول / الباحث" : "Contractor Field Access Pass"}
            </h3>
          </div>
          <div className={cn("flex items-center gap-2.5", isRtl && "flex-row-reverse")}>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-505 text-white text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Printer size={13} />
              <span>{language === "ar" ? "طباعة القسيمة" : "Print Pass"}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-205 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Badge Area Scrollable inside screen */}
        <div className="p-8 overflow-y-auto max-h-[70vh] bg-slate-100/50 flex flex-col items-center">
          
          <div 
            ref={passRef}
            className="print-container bg-white border-[3px] border-slate-900 rounded-[2rem] p-6 max-w-[400px] w-full shadow-lg relative overflow-hidden"
          >
            {/* Header branding */}
            <div className="text-center pb-4 border-b-2 border-slate-900">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest rounded mb-2">
                <ShieldCheck size={10} className="text-emerald-400" />
                STONEHENGE AUTHORITY
              </span>
              <h2 className="text-xs font-bold font-mono tracking-tight text-slate-900 leading-none">
                HISTORIC SITE OVERWATCH SYSTEM
              </h2>
              <p className="text-[8px] text-slate-500 font-bold uppercase mt-1 tracking-wider leading-none">
                {language === "ar" ? "الهيئة المعنية لإدارة المعلم والمزار الأثري" : "Heritage Site Operator Digital Pass"}
              </p>
            </div>

            {/* Badge Status Band */}
            <div className="flex bg-slate-50 border-b-2 border-slate-900 leading-none">
              <div className="flex-1 p-3 border-r-2 border-slate-900 text-center">
                <span className="text-[7px] font-black uppercase text-slate-400 block tracking-wider mb-1">
                  {language === "ar" ? "رقم التصريح الفني" : "PERMIT ID"}
                </span>
                <span className="text-xs font-bold font-mono text-slate-900">
                  #{permit.id?.substring(0, 8).toUpperCase() || "HOSP-9442"}
                </span>
              </div>
              <div className="flex-1 p-3 text-center">
                <span className="text-[7px] font-black uppercase text-slate-400 block tracking-wider mb-1">
                  {language === "ar" ? "حالة الأمان والاعتماد" : "SECURITY CLEARANCE"}
                </span>
                <span className="text-xs font-black text-emerald-600 block leading-3 flex items-center justify-center gap-1">
                  <CheckCircle2 size={12} className="inline" />
                  {permit.status?.toUpperCase() || "APPROVED"}
                </span>
              </div>
            </div>

            {/* Main Applicant Picture / Icon Core Info Block */}
            <div className="py-5 flex items-center gap-4 border-b-2 border-slate-900">
              {/* Photo Area / Mock RFID Chip */}
              <div className="w-16 h-20 bg-slate-100 border-2 border-slate-800 rounded-lg flex flex-col items-center justify-center shrink-0 relative overflow-hidden">
                <div className="absolute top-1 left-1.5 w-7 h-5 bg-amber-400/80 border border-amber-600/70 rounded-xs" /> {/* RFID Gold Chip */}
                <div className="w-10 h-10 mt-6 rounded-full bg-slate-300 border border-slate-400 flex items-center justify-center text-slate-500 font-mono font-bold text-[10px]">
                  ID
                </div>
              </div>

              {/* Applicant Name & Company */}
              <div className="flex-1 min-w-0 text-left">
                <span className="text-[7px] font-black uppercase text-slate-400 tracking-wider">
                  {language === "ar" ? "الاسم الكامل المعتمد" : "AUTHORIZED INDIVIDUAL / ENTITY"}
                </span>
                <h3 className="text-sm font-black text-slate-900 truncate leading-tight mt-0.5">
                  {permit.applicant_name}
                </h3>
                
                <div className="mt-2.5">
                  <span className="text-[7px] font-black uppercase text-slate-400 tracking-wider block">
                    {language === "ar" ? "المجموعة المصنفة" : "OPERATIONAL TYPE / GROUP"}
                  </span>
                  <span className="text-[10px] font-bold text-slate-700 block">
                    {permit.title}
                  </span>
                </div>
              </div>
            </div>

            {/* Site Constraints Grid */}
            <div className="border-b-2 border-slate-900 bg-slate-50/50">
              <div className="grid grid-cols-2 border-b border-slate-900 text-left">
                <div className="p-3 border-r-2 border-slate-900">
                  <span className="text-[7px] font-black uppercase text-slate-400 block tracking-wider">
                    {language === "ar" ? "منطقة الدخول المصرحة" : "ALLOWED ACCESS ZONE"}
                  </span>
                  <span className="text-[10px] font-black text-slate-900 truncate block mt-0.5">
                    {permit.area}
                  </span>
                </div>
                <div className="p-3">
                  <span className="text-[7px] font-black uppercase text-slate-400 block tracking-wider">
                    {language === "ar" ? "صنف النشاط الميداني" : "ACTIVITY CATEGORY"}
                  </span>
                  <span className="text-[10px] font-extrabold text-slate-800 uppercase block mt-0.5">
                    {permit.category || "General Work"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 text-left">
                <div className="p-3 border-r-2 border-slate-900">
                  <span className="text-[7px] font-black uppercase text-slate-400 block tracking-wider">
                    {language === "ar" ? "صلاحية الدخول من" : "VALID FROM"}
                  </span>
                  <span className="text-[9px] font-bold font-mono text-slate-700 block mt-0.5">
                    {new Date(permit.start_time).toLocaleString(language === "ar" ? "ar-EG" : "en-GB", { hour12: false, dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
                <div className="p-3">
                  <span className="text-[7px] font-black uppercase text-slate-400 block tracking-wider">
                    {language === "ar" ? "تنتهي الصلاحية في" : "EXPIRATION DATE"}
                  </span>
                  <span className="text-[9px] font-bold font-mono text-slate-700 block mt-0.5">
                    {new Date(permit.end_time).toLocaleString(language === "ar" ? "ar-EG" : "en-GB", { hour12: false, dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
              </div>
            </div>

            {/* Risk rating safety note stamp */}
            <div className="p-3 border-b-2 border-slate-900 flex items-center justify-between">
              <div className="text-left max-w-[210px]">
                <span className="text-[7px] font-black uppercase text-slate-400 tracking-wider block">
                  {language === "ar" ? "إقرار الأمان ومكافحة المخاطر" : "OPERATIONAL RISK SIGN-OFF"}
                </span>
                <p className="text-[8px] text-slate-500 font-semibold leading-tight mt-0.5">
                  {language === "ar" 
                    ? "غير مسموح بترك معدات التشغيل دون مراقبة. التزم بقنوات الاتصال ومسافات الأمان." 
                    : "Lichen preservation, low vibration. Maintain continuous radio contact with Overwatch Core."}
                </p>
              </div>

              {/* High precision compact hazard rating */}
              <div className={cn("px-2.5 py-1.5 rounded-lg border-2 text-[9px] font-black uppercase tracking-wider text-center flex items-center justify-center gap-1 shrink-0", getRiskColor(permit.risk_level))}>
                <AlertTriangle size={11} />
                <span>{permit.risk_level?.toUpperCase() || "LOW"}</span>
              </div>
            </div>

            {/* Digital barcode block + signature stamp */}
            <div className="pt-4 flex items-end justify-between">
              {/* Left Barcode & Digital Identifier */}
              <div className="flex flex-col items-start gap-1">
                <div className="flex gap-[1.5px] items-center">
                  {getBarcodeLines()}
                </div>
                <span className="text-[7px] font-mono font-bold text-slate-400 tracking-widest pl-1 leading-none uppercase">
                  *{permit.id?.substring(0, 10).toUpperCase() || "STONEHENGEPASS"}*
                </span>
              </div>

              {/* Right Signature Stamp */}
              <div className="text-right flex flex-col items-end">
                <span className="text-[7px] font-black uppercase text-slate-400 tracking-wider">
                  {language === "ar" ? "المشرف المعتمد" : "ISSUING AUTHORITY"}
                </span>
                <div className="relative pr-1 pt-1">
                  <span className="text-[9px] italic font-black text-indigo-600/90 tracking-wide font-sans block leading-tight">
                    {permit.approved_by || "Administrator"}
                  </span>
                  <span className="text-[6px] font-mono text-slate-400 block text-right leading-none">
                    OVERWATCH SIGNED
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
