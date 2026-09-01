import React, { useState, useEffect, useRef } from "react";
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Save, 
  Trash2, 
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Upload,
  FileDown,
  Loader2
} from "lucide-react";
import Papa from "papaparse";
import { motion } from "motion/react";
import { LayoutItem } from '../context/LayoutContext';
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { toast } from "sonner";
import { CustomizableGrid } from "./CustomizableGrid";

interface Forecast {
  id: string;
  date: string;
  forecasted_count: number;
  updated_at?: any;
}

export function Planning() {
  const { language, tData, dir } = useLanguage();
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newCount, setNewCount] = useState(150);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const path = "footfall_forecasts";
    const q = query(collection(db, path), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setForecasts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Forecast)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddForecast = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = "footfall_forecasts";
    try {
      await addDoc(collection(db, path), {
        date: newDate,
        forecasted_count: newCount,
        updated_at: serverTimestamp()
      });
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleUpdateCount = async (id: string, count: number) => {
    const path = "footfall_forecasts";
    try {
      await updateDoc(doc(db, path, id), {
        forecasted_count: count,
        updated_at: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleDeleteForecast = async (id: string) => {
    const confirmMessage = language === "ar" 
      ? "هل أنت متأكد من رغبتك في حذف هذا التوقع لنسب الإقبال؟" 
      : "Are you sure you want to delete this forecast?";
    if (!window.confirm(confirmMessage)) return;
    const path = "footfall_forecasts";
    try {
      await deleteDoc(doc(db, path, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const path = "footfall_forecasts";
        try {
          const batch = writeBatch(db);
          let count = 0;

          results.data.forEach((row: any) => {
            const date = row.date || row.Date;
            const forecasted_count = parseInt(row.forecasted_count || row.count || row.Forecast);

            if (date && !isNaN(forecasted_count)) {
              const newDocRef = doc(collection(db, path));
              batch.set(newDocRef, {
                date,
                forecasted_count,
                updated_at: serverTimestamp()
              });
              count++;
            }
          });

          if (count > 0) {
            await batch.commit();
            toast.success(
              language === "ar" 
                ? `تم رفع ${count} من التوقعات لنسب العبور بنجاح` 
                : `Successfully uploaded ${count} forecasts`
            );
          } else {
            toast.error(
              language === "ar" 
                ? "تنبيه: لم يتم العثور على بيانات صالحة. تأكد أن مسميات الأعمدة هي 'date' و'forecasted_count'." 
                : "No valid data found in file. Ensure columns are 'date' and 'forecasted_count'."
            );
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, path);
          toast.error(language === "ar" ? "فشل تحميل وبث التوقعات" : "Failed to upload forecasts");
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
      error: (error) => {
        console.error("CSV Parsing Error:", error);
        toast.error(language === "ar" ? "خطأ في معالجة وفحص ملف CSV" : "Failed to parse CSV file");
        setIsUploading(false);
      }
    });
  };

  const downloadTemplate = () => {
    const csvContent = "date,forecasted_count\n2024-04-10,150\n2024-04-11,200\n2024-04-12,180";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "forecast_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const defaultLayout: LayoutItem[] = [
    { i: 'header', x: 0, y: 0, w: 12, h: 4 },
    { i: 'list', x: 0, y: 4, w: 8, h: 20 },
    { i: 'logic', x: 8, y: 4, w: 4, h: 15 },
  ];

  const isRtl = dir === "rtl";

  return (
    <div className="pb-12">
      <CustomizableGrid pageId="planning" defaultLayout={defaultLayout}>
        <div key="header" className="h-full">
          <div className={cn("flex flex-col sm:flex-row items-center justify-between gap-6 h-full", isRtl && "sm:flex-row-reverse")}>
            <div className={cn("text-left space-y-1 w-full", isRtl && "text-right")}>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {language === "ar" ? "تخطيط نسبة الإقبال للزوار" : "Footfall Planning"}
              </h2>
              <p className="text-slate-500 font-medium">
                {language === "ar" ? "إشراف وتدوين على توقعات العبور المليونية للموقع الأثري" : "Manage visitor forecasts and operational modeling"}
              </p>
            </div>
            <div className={cn("flex items-center gap-3 shrink-0", isRtl && "flex-row-reverse")}>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".csv" 
                className="hidden" 
              />
              <button 
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all cursor-pointer whitespace-nowrap"
              >
                <FileDown size={20} />
                <span>{language === "ar" ? "النموذج القياسي" : "Template"}</span>
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                <span>{language === "ar" ? "تحميل مجمّع" : "Bulk Upload"}</span>
              </button>
              <button 
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black transition-all shadow-lg shadow-emerald-200 cursor-pointer whitespace-nowrap"
              >
                <Plus size={20} />
                <span>{language === "ar" ? "إضافة توقع" : "Add Forecast"}</span>
              </button>
            </div>
          </div>
        </div>

        <div key="list" className="h-full">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
            <div className={cn("p-6 border-b border-slate-100 flex items-center bg-slate-50/50 shrink-0", isRtl ? "justify-end flex-row-reverse" : "justify-between")}>
              <h3 className={cn("font-bold text-slate-900 flex items-center gap-2", isRtl && "flex-row-reverse")}>
                <CalendarIcon size={18} className="text-emerald-600" />
                <span>{language === "ar" ? "التوقعات ونسب الحضور القادمة" : "Upcoming Forecasts"}</span>
              </h3>
            </div>

            <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
              {isAdding && (
                <motion.form 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleAddForecast}
                  className={cn("p-6 bg-emerald-50/30 flex flex-wrap items-end gap-4", isRtl && "flex-row-reverse text-right")}
                >
                  <div className="space-y-2">
                    <label className={cn("text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block", isRtl && "text-right")}>
                      {language === "ar" ? "التاريخ" : "Date"}
                    </label>
                    <input 
                      type="date"
                      required
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className={cn("px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none font-bold text-slate-700", isRtl && "text-right")}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={cn("text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block", isRtl && "text-right")}>
                      {language === "ar" ? "العدد المتوقع" : "Forecasted Count"}
                    </label>
                    <input 
                      type="number"
                      required
                      value={newCount}
                      onChange={(e) => setNewCount(parseInt(e.target.value))}
                      className={cn("px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none font-bold text-slate-700 w-32", isRtl && "text-right")}
                    />
                  </div>
                  <div className={cn("flex gap-2", isRtl && "flex-row-reverse")}>
                    <button 
                      type="submit"
                      className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer"
                    >
                      <Save size={20} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="p-2 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 transition-colors cursor-pointer"
                    >
                      <Plus size={20} className="rotate-45" />
                    </button>
                  </div>
                </motion.form>
              )}

              {forecasts.length > 0 ? (
                forecasts.map((f) => (
                  <div key={f.id} className={cn("p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group", isRtl && "flex-row-reverse")}>
                    <div className={cn("flex items-center gap-6", isRtl && "flex-row-reverse")}>
                      <div className="text-center min-w-[60px]">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {new Date(f.date).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", { month: 'short' })}
                        </p>
                        <p className="text-2xl font-black text-slate-900 leading-none mt-1">
                          {new Date(f.date).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", { day: '2-digit' })}
                        </p>
                      </div>
                      <div className="h-10 w-px bg-slate-100"></div>
                      <div className={cn(isRtl && "text-right")}>
                        <p className="text-sm font-bold text-slate-900">
                          {new Date(f.date).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", { weekday: 'long' })}
                        </p>
                        <div className={cn("flex items-center gap-3 mt-1", isRtl && "flex-row-reverse")}>
                          <div className={cn("flex items-center gap-1 text-slate-500 text-xs font-medium", isRtl && "flex-row-reverse")}>
                            <BarChart3 size={14} />
                            <span>{f.forecasted_count} {language === "ar" ? "زائر متوقع" : "Expected"}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={cn("flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity", isRtl && "flex-row-reverse")}>
                      <input 
                        type="number"
                        defaultValue={f.forecasted_count}
                        onBlur={(e) => handleUpdateCount(f.id, parseInt(e.target.value))}
                        className="w-20 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      />
                      <button 
                        onClick={() => handleDeleteForecast(f.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-slate-400">
                  <BarChart3 size={48} className="mx-auto mb-4 opacity-20" />
                  <p>{language === "ar" ? "لم يتم إدراج توقعات مجدولة" : "No forecasts scheduled"}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div key="logic" className="h-full">
          <div className={cn("bg-slate-900 p-8 rounded-[2rem] text-white shadow-xl shadow-slate-200 h-full overflow-y-auto", isRtl && "text-right")}>
            <h3 className={cn("text-lg font-bold mb-4 flex items-center gap-2", isRtl && "flex-row-reverse")}>
              <TrendingUp size={20} className="text-emerald-400" />
              <span>{language === "ar" ? "النمذجة والمنطق التشغيلي" : "Operational Logic"}</span>
            </h3>
            <div className="space-y-4">
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
                  <span className="text-sm font-medium text-slate-400">{language === "ar" ? "منخفض" : "Low"}</span>
                  <span className="text-sm font-bold text-blue-400">&lt; 1200</span>
                </div>
                <p className="text-[10px] text-slate-500 italic">
                  {language === "ar" ? "الترشيد والتركيز الاستباقي على الصيانة وإدارة الفقد." : "Optimize manning, focus on maintenance."}
                </p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
                  <span className="text-sm font-medium text-slate-400">{language === "ar" ? "طبيعي" : "Normal"}</span>
                  <span className="text-sm font-bold text-emerald-400">1200 - 2500</span>
                </div>
                <p className="text-[10px] text-slate-500 italic">
                  {language === "ar" ? "الهيكلية الاعتيادية والمسحات الروتينية المستقرة." : "Standard staffing and routine checks."}
                </p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
                  <span className="text-sm font-medium text-slate-400">{language === "ar" ? "مرتفع" : "High"}</span>
                  <span className="text-sm font-bold text-amber-400">2500 - 4800</span>
                </div>
                <p className="text-[10px] text-slate-500 italic">
                  {language === "ar" ? "مضاعفة الحراسات ومراقبة كفاءة التموين والممرات الترفيهية." : "Ramp up staffing, monitor supplies."}
                </p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
                  <span className="text-sm font-medium text-slate-400">{language === "ar" ? "ذروة" : "Peak"}</span>
                  <span className="text-sm font-bold text-red-400">4800+</span>
                </div>
                <p className="text-[10px] text-slate-500 italic">
                  {language === "ar" ? "الانتشار الكامل واستنفار كافة الحراس والمنقذين داخل المعلم." : "Maximum deployment, all hands on deck."}
                </p>
              </div>
            </div>
            <div className={cn("mt-6 p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex gap-3", isRtl && "flex-row-reverse")}>
              <AlertCircle className="text-emerald-400 shrink-0 mt-0.5" size={18} />
              <p className="text-xs text-emerald-100 leading-relaxed">
                {language === "ar" 
                  ? "المستويات التشغيلية هي مؤشرات مطلقة لمدى ازدحام الموقع الأثري، وتُستخدم لتحديد متطلبات التوظيف والإيجازات اليومية وحشد الإمدادات." 
                  : "Operational categories are absolute indicators of site busyness, used to determine staffing and supply requirements."}
              </p>
            </div>
          </div>
        </div>
      </CustomizableGrid>
    </div>
  );
}

