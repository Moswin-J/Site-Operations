import React, { useEffect, useRef } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { toast } from "sonner";
import { ShieldAlert, MapPin, Eye } from "lucide-react";

interface ClockLog {
  id: string;
  user_id: string;
  user_name: string;
  type: "clock_in" | "clock_out" | string;
  timestamp: any;
  latitude: number | null;
  longitude: number | null;
  department?: string;
  notes?: string;
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

export function GeofenceAlertManager() {
  const { user: currentUser, hasPermission } = useAuth();
  const { language } = useLanguage();
  const isFirstLoad = useRef(true);
  const knownLogIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUser) return;

    // We restrict toast alerts to managers and admins
    const isManager =
      currentUser.role === "manager" ||
      currentUser.role === "admin" ||
      hasPermission("view_staff") ||
      hasPermission("manage_staff");

    if (!isManager) return;

    const clockLogsPath = "clock_logs";
    const q = query(collection(db, clockLogsPath));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Collect all logs in this snap
        const currentLogs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ClockLog[];

        // If this is the initial snapshot fetch, populate known logs and do not fire old toasts
        if (isFirstLoad.current) {
          currentLogs.forEach((log) => {
            knownLogIds.current.add(log.id);
          });
          isFirstLoad.current = false;
          return;
        }

        // Detect new clock_in logs
        currentLogs.forEach((log) => {
          if (!knownLogIds.current.has(log.id)) {
            // Add to known
            knownLogIds.current.add(log.id);

            // Verify check-in with GPS tags
            if (log.type === "clock_in" && log.latitude !== null && log.longitude !== null) {
              // Retrieve geofence coordinates from localStorage (same as Staff.tsx)
              const savedCenter = localStorage.getItem("geofence_center");
              const center = savedCenter ? JSON.parse(savedCenter) : { lat: 51.1789, lng: -1.8262 };
              const savedRadius = localStorage.getItem("geofence_radius");
              const radius = savedRadius ? Number(savedRadius) : 150;

              const distance = getHaversineDistance(
                log.latitude,
                log.longitude,
                center.lat,
                center.lng
              );

              if (distance > radius) {
                // Play warning notification sound if possible
                try {
                  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                  const oscillator = audioCtx.createOscillator();
                  const gainNode = audioCtx.createGain();
                  oscillator.connect(gainNode);
                  gainNode.connect(audioCtx.destination);
                  oscillator.type = "sine";
                  oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
                  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                  oscillator.start();
                  oscillator.stop(audioCtx.currentTime + 0.15);
                } catch (e) {
                  // Ignore audio playback block
                }

                const outByValue = Math.round(distance - radius);

                // Localize title/body
                const titleText =
                  language === "ar"
                    ? "⚠️ انتهاك النطاق الجغرافي للموظفين!"
                    : "⚠️ Geofence Boundary Violation!";
                const descText =
                  language === "ar"
                    ? `قام ${log.user_name} (${log.department || "الأمن"}) بتسجيل الحضور خارج الحدود بمسافة ${outByValue}م.`
                    : `${log.user_name} (${log.department || "Security"}) checked in ${outByValue}m outside the perimeter.`;

                // Display stylish rich Toast
                toast.error(
                  <div className="flex flex-col text-start gap-1 p-1 bg-transparent">
                    <div className="flex items-center gap-1.5 font-black text-rose-700">
                      <ShieldAlert size={16} />
                      <span className="bg-transparent">{titleText}</span>
                    </div>
                    <span className="text-xs text-slate-700 bg-transparent">{descText}</span>
                    <div className="flex items-center gap-1.5 mt-2 bg-transparent">
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-105 px-1 py-0.5 rounded">
                        Lat: {log.latitude.toFixed(4)}, Lon: {log.longitude.toFixed(4)}
                      </span>
                      <button
                        onClick={() => {
                          // Try scrolling or focusing on the map elements if they exist
                          const element = document.getElementById("tactical-geofence-radar") || document.getElementById("tab-map-geofence");
                          if (element) {
                            element.scrollIntoView({ behavior: "smooth" });
                            element.click();
                          }
                        }}
                        className="text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold px-2 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ml-auto"
                      >
                        <Eye size={11} />
                        {language === "ar" ? "رصد وإجراء" : "Locate Staff"}
                      </button>
                    </div>
                  </div>,
                  {
                    duration: 10000,
                    style: {
                      borderRadius: "1.25rem",
                      border: "1px solid #fecaca",
                      backgroundColor: "#fff",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
                    },
                  }
                );
              }
            }
          }
        });
      },
      (error) => {
        console.error("GeofenceAlertManager clock_logs listener fail:", error);
      }
    );

    return () => unsubscribe();
  }, [currentUser, language, hasPermission]);

  return null;
}
