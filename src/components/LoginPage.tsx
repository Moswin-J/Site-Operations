import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { motion } from "motion/react";
import { Shield, Mail, Lock, ArrowRight, AlertCircle, Loader2, Languages, Fingerprint, ScanEye } from "lucide-react";
import { cn } from "../lib/utils";
import { BiometricModal } from "./BiometricModal";

interface LoginPageProps {
  onSwitchToRegister: () => void;
}

const contentDict = {
  en: {
    portal: "Secure Management Portal",
    companyEmail: "Company Email",
    password: "Password",
    signIn: "Sign In",
    newTeam: "New to the team?",
    createAccount: "Create an account",
    authorizedOnly: "Authorized Personnel Only",
    placeholderEmail: "name@heritage-site.com",
    switchLanguage: "العربية / Arabic"
  },
  ar: {
    portal: "بوابة الإدارة والمراقبة الآمنة",
    companyEmail: "البريد الإلكتروني للشركة",
    password: "كلمة المرور والأمان",
    signIn: "تسجيل الدخول المباشر",
    newTeam: "هل أنت عضو جديد في الفريق؟",
    createAccount: "إنشاء حساب موظف",
    authorizedOnly: "يسمح بالدخول للموظفين المصرح لهم فقط",
    placeholderEmail: "name@heritage-site.com",
    switchLanguage: "إنجليزي / English"
  }
};

export function LoginPage({ onSwitchToRegister }: LoginPageProps) {
  const { login, error, isLoading, isBiometricEnrolled, loginWithBiometrics } = useAuth();
  const { language, setLanguage, dir, tData } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isBioModalOpen, setIsBioModalOpen] = useState(false);
  const [enrolledEmail, setEnrolledEmail] = useState(() => {
    const stored = localStorage.getItem("biometric_credential");
    if (stored) {
      try {
        return JSON.parse(stored).email;
      } catch (e) {
        return "";
      }
    }
    return "";
  });

  const tLocal = contentDict[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  const handleBioSuccess = async () => {
    try {
      await loginWithBiometrics();
    } catch (err) {
      console.error(err);
    } finally {
      setIsBioModalOpen(false);
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "ar" : "en");
  };

  const isRtl = dir === "rtl";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative">
      {/* Language Toggle in Top Corner */}
      <div className="absolute top-6 right-6">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          <Languages size={14} className="text-emerald-600" />
          <span>{tLocal.switchLanguage}</span>
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mt-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-200 mb-4">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            {language === "ar" ? "إدارة عمليات التراث" : "Heritage Ops"}
          </h1>
          <p className="text-slate-500 font-medium mt-2">{tLocal.portal}</p>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600"
              >
                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                <p className="text-sm font-bold">{tData(error)}</p>
              </motion.div>
            )}

            {isBiometricEnrolled && enrolledEmail && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between text-emerald-800 text-xs">
                <div className="flex items-center gap-2">
                  <Fingerprint size={16} className="text-emerald-600 shrink-0" />
                  <span className="font-bold">
                    {language === "ar"
                      ? "تم تفعيل تسجيل الدخول بالبصمة"
                      : "TouchID/FaceID enrolled"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBioModalOpen(true)}
                  className="font-extrabold text-emerald-600 hover:underline cursor-pointer"
                >
                  {language === "ar" ? "تحقق بالبصمة" : "Verify now"}
                </button>
              </div>
            )}

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
                    "w-full py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700",
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
                    "w-full py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700",
                    isRtl ? "pr-12 pl-4 text-dark" : "pl-12 pr-4 text-dark"
                  )}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                type="submit"
                disabled={isLoading}
                className={cn(
                  "py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2 group disabled:opacity-70 cursor-pointer shadow-md",
                  isBiometricEnrolled ? "flex-1" : "w-full"
                )}
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <div className="flex items-center gap-2">
                    <span>{tLocal.signIn}</span>
                    <ArrowRight className={cn("transition-transform", isRtl ? "rotate-180 group-hover:-translate-x-1" : "group-hover:translate-x-1")} size={20} />
                  </div>
                )}
              </button>

              {isBiometricEnrolled && (
                <button
                  type="button"
                  title="Sign in with TouchID or FaceID"
                  onClick={() => setIsBioModalOpen(true)}
                  className="px-5 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl flex items-center justify-center cursor-pointer transition-all shadow-md active:scale-95 shrink-0"
                >
                  <Fingerprint size={24} className="animate-pulse" />
                </button>
              )}
            </div>
          </form>

          <BiometricModal
            isOpen={isBioModalOpen}
            mode="verify"
            email={enrolledEmail || email || "staff@heritage-site.com"}
            onSuccess={handleBioSuccess}
            onCancel={() => setIsBioModalOpen(false)}
          />

          <div className="mt-8 pt-8 border-t border-slate-100 text-center">
            <p className="text-slate-500 font-bold text-sm">
              {tLocal.newTeam}{" "}
              <button 
                onClick={onSwitchToRegister}
                className="text-emerald-600 hover:underline font-extrabold cursor-pointer"
              >
                {tLocal.createAccount}
              </button>
            </p>
          </div>
        </div>

        <p className="text-center mt-8 text-slate-400 text-xs font-bold uppercase tracking-widest">
          {tLocal.authorizedOnly}
        </p>
      </motion.div>
    </div>
  );
}
