import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { motion } from "motion/react";
import { Shield, User, Mail, Lock, ArrowRight, AlertCircle, Loader2, Building2 } from "lucide-react";
import { cn } from "../lib/utils";

interface RegisterPageProps {
  onSwitchToLogin: () => void;
}

const contentDict = {
  en: {
    headerTitle: "Join the Team",
    headerSubtitle: "Create your Heritage Ops account",
    fullName: "Full Name",
    companyEmail: "Company Email",
    department: "Department",
    password: "Password",
    createAccount: "Create Account",
    alreadyHaveAccount: "Already have an account?",
    signIn: "Sign in",
    restrictError: "Registration is restricted to @heritage-site.com email addresses.",
    placeholderName: "John Doe",
    placeholderEmail: "name@heritage-site.com"
  },
  ar: {
    headerTitle: "انضم إلى الفريق الميداني",
    headerSubtitle: "قم بإنشاء حسابك الخاص على بوابة العمليات",
    fullName: "الاسم الكامل للموظف",
    companyEmail: "البريد الإلكتروني للشركة",
    department: "القسم التابع له",
    password: "كلمة المرور الحسابية",
    createAccount: "إنشاء حساب جديد",
    alreadyHaveAccount: "هل لديك حساب بالفعل؟",
    signIn: "تسجيل الدخول",
    restrictError: "التسجيل مقصور فقط على العناوين المنتهية بنطاق @heritage-site.com رسميًا.",
    placeholderName: "جون دو",
    placeholderEmail: "name@heritage-site.com"
  }
};

const DEPARTMENTS = [
  "Visitor Experience",
  "Security",
  "Conservation",
  "Facility Management",
  "Heritage Management"
];

export function RegisterPage({ onSwitchToLogin }: RegisterPageProps) {
  const { register, error, isLoading } = useAuth();
  const { language, dir, tData } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("Visitor Experience");
  const [localError, setLocalError] = useState<string | null>(null);

  const COMPANY_DOMAIN = "@heritage-site.com";
  const tLocal = contentDict[language];
  const isRtl = dir === "rtl";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email.endsWith(COMPANY_DOMAIN)) {
      setLocalError(tLocal.restrictError);
      return;
    }

    await register({ name, email, password, department });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-200 mb-4">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{tLocal.headerTitle}</h1>
          <p className="text-slate-500 font-medium mt-2">{tLocal.headerSubtitle}</p>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50">
          <form onSubmit={handleSubmit} className="space-y-5">
            {(error || localError) && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600"
              >
                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                <p className="text-sm font-bold">{tData(error || localError)}</p>
              </motion.div>
            )}

            <div className="space-y-2">
              <label className={cn(
                "text-xs font-black text-slate-400 uppercase tracking-widest block",
                isRtl ? "mr-1 text-right" : "ml-1 text-left"
              )}>
                {tLocal.fullName}
              </label>
              <div className="relative">
                <User className={cn("absolute top-1/2 -translate-y-1/2 text-slate-400", isRtl ? "right-4" : "left-4")} size={18} />
                <input 
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tLocal.placeholderName}
                  className={cn(
                    "w-full py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700",
                    isRtl ? "pr-12 pl-4 text-right" : "pl-12 pr-4 text-left"
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className={cn(
                "text-xs font-black text-slate-400 uppercase tracking-widest block",
                isRtl ? "mr-1 text-right" : "ml-1 text-left"
              )}>
                {tLocal.companyEmail}
              </label>
              <div className="relative">
                <Mail className={cn("absolute top-1/2 -translate-y-1/2 text-slate-400", isRtl ? "right-4" : "left-4")} size={18} />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={tLocal.placeholderEmail}
                  className={cn(
                    "w-full py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700",
                    isRtl ? "pr-12 pl-4 text-right" : "pl-12 pr-4 text-left"
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className={cn(
                "text-xs font-black text-slate-400 uppercase tracking-widest block",
                isRtl ? "mr-1 text-right" : "ml-1 text-left"
              )}>
                {tLocal.department}
              </label>
              <div className="relative">
                <Building2 className={cn("absolute top-1/2 -translate-y-1/2 text-slate-400", isRtl ? "right-4" : "left-4")} size={18} />
                <select 
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className={cn(
                    "w-full py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer",
                    isRtl ? "pr-12 pl-8 text-right" : "pl-12 pr-8 text-left"
                  )}
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {tData(dept)}
                    </option>
                  ))}
                </select>
                <div className={cn("absolute pointer-events-none top-1/2 -translate-y-1/2 text-slate-400", isRtl ? "left-4" : "right-4")}>
                  ▼
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className={cn(
                "text-xs font-black text-slate-400 uppercase tracking-widest block",
                isRtl ? "mr-1 text-right" : "ml-1 text-left"
              )}>
                {tLocal.password}
              </label>
              <div className="relative">
                <Lock className={cn("absolute top-1/2 -translate-y-1/2 text-slate-400", isRtl ? "right-4" : "left-4")} size={18} />
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(
                    "w-full py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700",
                    isRtl ? "pr-12 pl-4 text-dark" : "pl-12 pr-4 text-dark"
                  )}
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2 group disabled:opacity-70 mt-4 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <div className="flex items-center gap-2">
                  <span>{tLocal.createAccount}</span>
                  <ArrowRight className={cn("transition-transform", isRtl ? "rotate-180 group-hover:-translate-x-1" : "group-hover:translate-x-1")} size={20} />
                </div>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-100 text-center">
            <p className="text-slate-500 font-bold text-sm">
              {tLocal.alreadyHaveAccount}{" "}
              <button 
                onClick={onSwitchToLogin}
                className="text-emerald-600 hover:underline font-extrabold cursor-pointer"
              >
                {tLocal.signIn}
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
