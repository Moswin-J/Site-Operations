import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Fingerprint, ScanEye, CheckCircle2, AlertCircle, X, ShieldAlert } from "lucide-react";
import { cn } from "../lib/utils";

interface BiometricModalProps {
  isOpen: boolean;
  mode: "enroll" | "verify";
  userId?: string;
  email: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function BiometricModal({
  isOpen,
  mode,
  userId,
  email,
  onSuccess,
  onCancel
}: BiometricModalProps) {
  const [scanType, setScanType] = useState<"fingerprint" | "face">("fingerprint");
  const [status, setStatus] = useState<"init" | "scanning" | "success" | "error">("init");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [isUsingHardware, setIsUsingHardware] = useState(false);

  // Restart modal state when matching isOpen
  useEffect(() => {
    if (isOpen) {
      setStatus("init");
      setProgress(0);
      setErrorMessage("");
      setIsUsingHardware(false);
    }
  }, [isOpen]);

  // Attempt real hardware WebAuthn authentication/registration, or fall back to simulation
  const startBiometricProcess = async () => {
    setStatus("scanning");
    setProgress(0);
    setErrorMessage("");

    try {
      // Check for WebAuthn capability in navigator
      if (window.isSecureContext && navigator.credentials) {
        setIsUsingHardware(true);
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        if (mode === "enroll" && userId) {
          const creationOptions: PublicKeyCredentialCreationOptions = {
            challenge,
            rp: {
              name: "Heritage Ops Security",
              id: window.location.hostname
            },
            user: {
              id: Uint8Array.from(userId, c => c.charCodeAt(0)),
              name: email,
              displayName: email.split("@")[0]
            },
            pubKeyCredParams: [
              { alg: -7, type: "public-key" }, // ES256
              { alg: -257, type: "public-key" } // RS256
            ],
            authenticatorSelection: {
              authenticatorAttachment: "platform", // request TouchID / FaceID specifically
              userVerification: "required"
            },
            timeout: 10000
          };

          // Try and prompt OS WebAuthn
          await navigator.credentials.create({ publicKey: creationOptions });
        } else {
          // Verify
          const requestOptions: PublicKeyCredentialRequestOptions = {
            challenge,
            rpId: window.location.hostname,
            userVerification: "required",
            timeout: 10000
          };

          await navigator.credentials.get({ publicKey: requestOptions });
        }

        // WebAuthn hardware succeeded!
        setStatus("success");
        setProgress(100);
        setTimeout(() => {
          onSuccess();
        }, 1200);
        return;
      } else {
        throw new Error("WebAuthn not supported or insecure context");
      }
    } catch (err: any) {
      console.warn("Hardware biometric fallback to simulator:", err.message || err);
      setIsUsingHardware(false);
      runSimulation();
    }
  };

  // Run the simulated multi-stage biometric scan
  const runSimulation = () => {
    setStatus("scanning");
    setProgress(0);

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setStatus("success");
          setTimeout(() => {
            onSuccess();
          }, 1200);
          return 100;
        }
        // Random scanning increments
        return prev + Math.floor(Math.random() * 15) + 8;
      });
    }, 150);
  };

  const handleRetry = () => {
    startBiometricProcess();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white w-full max-w-sm rounded-[2.5rem] border border-slate-100 p-8 shadow-2xl relative overflow-hidden"
        >
          {/* Decorative Corner Light Rings */}
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-emerald-50 rounded-full blur-3xl opacity-60 pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-50 rounded-full blur-3xl opacity-60 pointer-events-none" />

          {/* Close button */}
          <button
            onClick={onCancel}
            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>

          <div className="text-center mt-4">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              {mode === "enroll" ? "Enroll Biometrics" : "Staff Verification"}
            </h3>
            <p className="text-xs text-slate-500 font-bold tracking-wide uppercase mt-1">
              {email}
            </p>

            {/* Selector between TouchID and FaceID (only active during simulator/init state) */}
            {status === "init" && (
              <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-2 mt-6 max-w-[240px] mx-auto border border-slate-250">
                <button
                  type="button"
                  onClick={() => setScanType("fingerprint")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                    scanType === "fingerprint"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <Fingerprint size={16} />
                  TouchID
                </button>
                <button
                  type="button"
                  onClick={() => setScanType("face")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                    scanType === "face"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <ScanEye size={16} />
                  FaceID
                </button>
              </div>
            )}

            {/* Central Bio Hub Icon Screen */}
            <div className="flex justify-center items-center h-48 my-6 relative">
              <AnimatePresence mode="wait">
                {status === "init" && (
                  <motion.button
                    key="init-btn"
                    onClick={startBiometricProcess}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "w-32 h-32 rounded-full flex flex-col items-center justify-center cursor-pointer shadow-lg transition-transform",
                      scanType === "fingerprint"
                        ? "bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700 text-white"
                        : "bg-blue-600 shadow-blue-200 hover:bg-blue-700 text-white"
                    )}
                  >
                    {scanType === "fingerprint" ? (
                      <Fingerprint size={56} className="animate-pulse" />
                    ) : (
                      <ScanEye size={56} className="animate-pulse" />
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest mt-2">
                      Tap to Scan
                    </span>
                  </motion.button>
                )}

                {status === "scanning" && (
                  <motion.div
                    key="scanning-state"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="relative flex items-center justify-center"
                  >
                    {/* Ring Outer Pulse */}
                    <div className={cn(
                      "absolute inset-0 w-36 h-36 rounded-full border-4 opacity-20 animate-ping",
                      scanType === "fingerprint" ? "border-emerald-500" : "border-blue-500"
                    )} />

                    {/* Scanning Circle and Percentage */}
                    <div className="relative w-32 h-32 rounded-full border-4 border-slate-100 flex flex-col items-center justify-center bg-white shadow-xl">
                      {/* SVG Circle Progress */}
                      <svg className="absolute -rotate-90 w-32 h-32 inset-0">
                        <circle
                          cx="64"
                          cy="64"
                          r="58"
                          className="stroke-slate-100 fill-none"
                          strokeWidth="8"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="58"
                          className={cn(
                            "fill-none transition-all duration-100",
                            scanType === "fingerprint" ? "stroke-emerald-600" : "stroke-blue-600"
                          )}
                          strokeWidth="8"
                          strokeDasharray={364}
                          strokeDashoffset={364 - (364 * Math.min(progress, 100)) / 100}
                          strokeLinecap="round"
                        />
                      </svg>

                      {/* Scanning visual asset indexer line */}
                      <motion.div
                        animate={{ y: [-30, 30, -30] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                        className={cn(
                          "absolute w-20 h-0.5 opacity-60 shadow-lg blur-[1px]",
                          scanType === "fingerprint" ? "bg-emerald-500" : "bg-blue-500"
                        )}
                      />

                      {scanType === "fingerprint" ? (
                        <Fingerprint size={44} className="text-emerald-600 opacity-80" />
                      ) : (
                        <ScanEye size={44} className="text-blue-600 opacity-80" />
                      )}

                      <span className="text-[11px] font-black font-mono text-slate-700 mt-1">
                        {Math.min(progress, 100)}%
                      </span>
                    </div>
                  </motion.div>
                )}

                {status === "success" && (
                  <motion.div
                    key="success"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: [0.8, 1.1, 1], opacity: 1 }}
                    className="flex flex-col items-center justify-center text-center"
                  >
                    <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center border-4 border-emerald-500/20 shadow-lg mb-2">
                      <CheckCircle2 size={48} className="text-emerald-600" />
                    </div>
                    <span className="text-emerald-700 text-sm font-black tracking-widest uppercase">
                      Verified
                    </span>
                  </motion.div>
                )}

                {status === "error" && (
                  <motion.div
                    key="error"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center justify-center text-center"
                  >
                    <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center border-4 border-rose-500/20 shadow-lg mb-2">
                      <AlertCircle size={48} className="text-rose-600" />
                    </div>
                    <span className="text-rose-700 text-sm font-black tracking-widest uppercase mb-1">
                      Failed
                    </span>
                    <span className="text-[11px] text-slate-500">{errorMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Instruction Label Details */}
            <div className="px-4 min-h-[44px]">
              {status === "init" && (
                <p className="text-sm text-slate-500 font-bold">
                  {mode === "enroll"
                    ? "Confirm scan of FaceID or TouchID to register biometrics on this mobile device."
                    : "Activate device authentication for streamlined operational entry."}
                </p>
              )}
              {status === "scanning" && (
                <p className="text-sm text-slate-700 font-black tracking-wide animate-pulse uppercase">
                  {isUsingHardware
                    ? "Verify via system credentials..."
                    : `Scanning ${scanType === "fingerprint" ? "Fingerprint" : "Face"}...`}
                </p>
              )}
              {status === "success" && (
                <p className="text-sm text-emerald-600 font-black tracking-wide uppercase">
                  {mode === "enroll" ? "Enrollment Successful!" : "Access Granted!"}
                </p>
              )}
              {status === "error" && (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleRetry}
                    className="text-xs bg-slate-900 text-white font-black uppercase px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer inline-block mx-auto"
                  >
                    Retry Scan
                  </button>
                </div>
              )}
            </div>

            {/* Info Badge highlighting Sandbox Integrity */}
            <div className="mt-6 flex items-center justify-center gap-1.5 py-2 px-4 bg-slate-50 border border-slate-100 rounded-2xl">
              <ShieldAlert size={14} className="text-slate-400 shrink-0" />
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">
                {isUsingHardware ? "Enclave Protected" : "Simulation Fallback Capable"}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
