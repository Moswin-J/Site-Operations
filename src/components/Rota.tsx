import React, { useState, useEffect, useCallback } from "react";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Filter,
  Copy,
  ClipboardPaste,
  MoreVertical,
  X as XIcon,
  Download,
  Shuffle,
  ArrowLeftRight,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LayoutItem } from '../context/LayoutContext';
import { cn } from "../lib/utils";
import { collection, onSnapshot, query, orderBy, doc, addDoc, updateDoc, deleteDoc, getDocs, writeBatch, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { CustomizableGrid } from "./CustomizableGrid";

interface Shift {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  user_department: string;
  start_time: string;
  end_time: string;
  role: string;
  location: string;
  notes: string;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
}

interface ShiftSwap {
  id: string;
  requester_id: string;
  requester_name: string;
  requester_shift_id: string;
  colleague_id: string;
  colleague_name: string;
  colleague_shift_id: string | null;
  status: 'pending_colleague' | 'pending_manager' | 'approved' | 'rejected' | 'cancelled';
  notes: string;
  created_at: any;
}

export function Rota() {
  const { language, t, tData, dir } = useLanguage();
  const isRtl = dir === "rtl";
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [swaps, setSwaps] = useState<ShiftSwap[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('monthly');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [clipboard, setClipboard] = useState<Partial<Shift> | null>(null);
  const [lastAction, setLastAction] = useState<'paste' | 'delete' | null>(null);
  const [selection, setSelection] = useState<{ startUser: string, startDay: number, endUser: string, endDay: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [draggedShiftId, setDraggedShiftId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ userId: string; day: number } | null>(null);
  const [dragOverUserDaily, setDragOverUserDaily] = useState<string | null>(null);
  
  // Swap request form states
  const [isRequestingSwap, setIsRequestingSwap] = useState(false);
  const [swapColleagueId, setSwapColleagueId] = useState("");
  const [swapColleagueShiftId, setSwapColleagueShiftId] = useState<string | null>(null);
  const [swapNotes, setSwapNotes] = useState("");
  const [swapSuccessMsg, setSwapSuccessMsg] = useState("");

  const [newShift, setNewShift] = useState({
    user_id: "",
    start_time: "",
    end_time: "",
    role: "",
    location: "",
    notes: ""
  });

  const { user: currentUser } = useAuth();

  useEffect(() => {
    setIsRequestingSwap(false);
    setSwapColleagueId("");
    setSwapColleagueShiftId(null);
    setSwapNotes("");
    setSwapSuccessMsg("");
  }, [selectedShift]);

  useEffect(() => {
    if (!currentUser) return;

    // Listen for shifts
    const shiftsPath = "shifts";
    const shiftsQuery = collection(db, shiftsPath);
    const unsubscribeShifts = onSnapshot(shiftsQuery, (snapshot) => {
      setShifts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, shiftsPath);
    });

    // Listen for users
    const usersPath = "users";
    const usersQuery = collection(db, usersPath);
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, usersPath);
    });

    // Listen for shift_swaps
    const swapsPath = "shift_swaps";
    const swapsQuery = collection(db, swapsPath);
    const unsubscribeSwaps = onSnapshot(swapsQuery, (snapshot) => {
      setSwaps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, swapsPath);
    });

    // Listen for presets
    const presetsPath = "shift_presets";
    const presetsQuery = collection(db, presetsPath);
    const unsubscribePresets = onSnapshot(presetsQuery, (snapshot) => {
      setPresets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, presetsPath);
    });

    return () => {
      unsubscribeShifts();
      unsubscribeUsers();
      unsubscribeSwaps();
      unsubscribePresets();
    };
  }, [currentUser]);

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = users.find(u => u.id === newShift.user_id);
      await addDoc(collection(db, "shifts"), {
        ...newShift,
        user_id: newShift.user_id,
        user_name: user?.name || "Unknown",
        user_role: user?.role || "Unknown",
        user_department: user?.department || "Unknown",
        status: "scheduled",
        created_at: serverTimestamp()
      });
      setIsAdding(false);
      setNewShift({
        user_id: "",
        start_time: "",
        end_time: "",
        role: "",
        location: "",
        notes: ""
      });
    } catch (error) {
      console.error("Failed to add shift", error);
    }
  };

  const handleUpdateShiftStatus = async (id: string, status: Shift['status']) => {
    try {
      await updateDoc(doc(db, "shifts", id), { status });
      if (selectedShift && selectedShift.id === id) {
        setSelectedShift(prev => prev ? { ...prev, status } : null);
      }
    } catch (error) {
      console.error("Failed to update shift status", error);
    }
  };

  const handleUpdateShiftDetails = async (id: string, details: Partial<Shift>) => {
    try {
      await updateDoc(doc(db, "shifts", id), details);
      if (selectedShift && selectedShift.id === id) {
        setSelectedShift(prev => prev ? { ...prev, ...details } : null);
      }
    } catch (error) {
      console.error("Failed to update shift details", error);
    }
  };

  const handleDeleteShift = async (id: string) => {
    if (!confirm("Are you sure you want to delete this shift?")) return;
    try {
      await deleteDoc(doc(db, "shifts", id));
      setLastAction('delete');
    } catch (error) {
      console.error("Failed to delete shift", error);
    }
  };

  const handleDragStart = (e: React.DragEvent, shiftId: string) => {
    e.dataTransfer.setData("shiftId", shiftId);
    setDraggedShiftId(shiftId);
  };

  const handleDragEnd = () => {
    setDraggedShiftId(null);
    setDragOverTarget(null);
    setDragOverUserDaily(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCopyShift = (shift: Shift) => {
    setClipboard(shift);
    setLastAction('paste');
  };

  const handlePasteShift = async (userId: string, day: number) => {
    if (!clipboard) return;

    const sourceStart = new Date(clipboard.start_time!);
    const sourceEnd = new Date(clipboard.end_time!);
    
    const targetStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day, sourceStart.getHours(), sourceStart.getMinutes());
    const targetEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day, sourceEnd.getHours(), sourceEnd.getMinutes());

    const formatDateForInput = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    try {
      const user = users.find(u => u.id === userId);
      await addDoc(collection(db, "shifts"), {
        user_id: userId,
        user_name: user?.name || "Unknown",
        user_role: user?.role || "Unknown",
        user_department: user?.department || "Unknown",
        start_time: formatDateForInput(targetStart),
        end_time: formatDateForInput(targetEnd),
        role: clipboard.role,
        location: clipboard.location,
        notes: clipboard.notes,
        status: "scheduled",
        created_at: serverTimestamp()
      });
      setLastAction('paste');
    } catch (error) {
      console.error("Failed to paste shift", error);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetUserId: string, targetDay: number) => {
    e.preventDefault();
    const shiftId = e.dataTransfer.getData("shiftId");
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return;

    // Calculate new times
    const sourceStart = new Date(shift.start_time);
    const sourceEnd = new Date(shift.end_time);
    const duration = sourceEnd.getTime() - sourceStart.getTime();

    const targetStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), targetDay, sourceStart.getHours(), sourceStart.getMinutes());
    const targetEnd = new Date(targetStart.getTime() + duration);

    const formatDateForInput = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    try {
      const user = users.find(u => u.id === targetUserId);
      await updateDoc(doc(db, "shifts", shiftId), {
        user_id: targetUserId,
        user_name: user?.name || "Unknown",
        user_role: user?.role || "Unknown",
        user_department: user?.department || "Unknown",
        start_time: formatDateForInput(targetStart),
        end_time: formatDateForInput(targetEnd)
      });
    } catch (error) {
      console.error("Failed to move shift", error);
    }
  };

  const handleExportCSV = () => {
    // Determine the week containing selectedDate
    const current = new Date(selectedDate);
    const day = current.getDay();
    // distance to Sunday (0).
    const diffToSunday = current.getDate() - day;
    const sunday = new Date(current.getFullYear(), current.getMonth(), diffToSunday, 0, 0, 0, 0);

    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    saturday.setHours(23, 59, 59, 999);

    // Filter shifts for that week
    const weekShifts = shifts.filter(shift => {
      const shiftDate = new Date(shift.start_time);
      return shiftDate >= sunday && shiftDate <= saturday;
    });

    // Sort by start_time
    weekShifts.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    // CSV generator helper
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return "";
      const escaped = val.toString().replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const headers = [
      "Shift ID",
      "Staff Name",
      "Department",
      "Role",
      "Date",
      "Start Time",
      "End Time",
      "Location",
      "Notes",
      "Status"
    ];

    const rows = weekShifts.map(shift => {
      const sDate = new Date(shift.start_time);
      const eDate = new Date(shift.end_time);
      
      const dateFormatted = sDate.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const startTimeFormatted = sDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const endTimeFormatted = eDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

      return [
        escapeCSV(shift.id),
        escapeCSV(shift.user_name),
        escapeCSV(shift.user_department || "Unknown"),
        escapeCSV(shift.role),
        escapeCSV(dateFormatted),
        escapeCSV(startTimeFormatted),
        escapeCSV(endTimeFormatted),
        escapeCSV(shift.location),
        escapeCSV(shift.notes),
        escapeCSV(shift.status)
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    // Format download filename
    const sundayStr = sunday.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const saturdayStr = saturday.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    
    link.setAttribute("href", url);
    link.setAttribute("download", `schedule_week_${sundayStr.replace(/\s+/g, '_')}_to_${saturdayStr.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmitSwapRequest = async (requesterShiftId: string, colleagueId: string, colleagueShiftId: string | null, notes: string) => {
    if (!currentUser) return;
    try {
      const colleague = users.find(u => u.id === colleagueId);
      if (!colleague) throw new Error("Colleague not found");

      await addDoc(collection(db, "shift_swaps"), {
        requester_id: currentUser.id,
        requester_name: currentUser.name || "Unknown",
        requester_shift_id: requesterShiftId,
        colleague_id: colleagueId,
        colleague_name: colleague.name || "Unknown",
        colleague_shift_id: colleagueShiftId || null,
        status: "pending_colleague",
        notes: notes,
        created_at: new Date().toISOString()
      });

      // Audit log
      await addDoc(collection(db, "audit_logs"), {
        user_id: currentUser.id,
        action: "shift_swap_request_sent",
        details: `Sent swap request to ${colleague.name} for shift ID: ${requesterShiftId}`,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to submit shift swap request", err);
    }
  };

  const handleColleagueAction = async (swapId: string, action: 'accept' | 'reject') => {
    if (!currentUser) return;
    try {
      const status = action === 'accept' ? 'pending_manager' : 'rejected';
      await updateDoc(doc(db, "shift_swaps", swapId), { status });

      // Audit log
      await addDoc(collection(db, "audit_logs"), {
        user_id: currentUser.id,
        action: `shift_swap_colleague_${action}`,
        details: `Colleague ${currentUser.name} has ${action}ed swap request ID: ${swapId}`,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to update swap request status by colleague", err);
    }
  };

  const handleManagerApproval = async (swapId: string, action: 'approve' | 'reject') => {
    if (!currentUser) return;
    const isMgr = currentUser.role === 'manager' || currentUser.role === 'admin';
    if (!isMgr) {
      console.error("Unauthorized: only managers can resolve requests");
      return;
    }

    try {
      const swap = swaps.find(s => s.id === swapId);
      if (!swap) throw new Error("Swap request not found in state");

      if (action === 'reject') {
        await updateDoc(doc(db, "shift_swaps", swapId), { status: 'rejected' });
        // Audit log
        await addDoc(collection(db, "audit_logs"), {
          user_id: currentUser.id,
          action: "shift_swap_manager_reject",
          details: `Manager ${currentUser.name} rejected swap request ID: ${swapId}`,
          created_at: new Date().toISOString()
        });
        return;
      }

      // Action: Approve -> atomic swap of the actual shifts!
      const colleagueUser = users.find(u => u.id === swap.colleague_id);
      const requesterUser = users.find(u => u.id === swap.requester_id);

      const batch = writeBatch(db);

      // 1) Assign requester's shift to the colleague
      batch.update(doc(db, "shifts", swap.requester_shift_id), {
        user_id: swap.colleague_id,
        user_name: swap.colleague_name,
        user_role: colleagueUser?.role || "Unknown",
        user_department: colleagueUser?.department || "Unknown"
      });

      // 2) If colleague shift is provided, assign that shift to requester
      if (swap.colleague_shift_id) {
        batch.update(doc(db, "shifts", swap.colleague_shift_id), {
          user_id: swap.requester_id,
          user_name: swap.requester_name,
          user_role: requesterUser?.role || "Unknown",
          user_department: requesterUser?.department || "Unknown"
        });
      }

      // 3) Update status of the swap request to approved
      batch.update(doc(db, "shift_swaps", swapId), {
        status: 'approved'
      });

      await batch.commit();

      // Audit log
      await addDoc(collection(db, "audit_logs"), {
        user_id: currentUser.id,
        action: "shift_swap_manager_approve",
        details: `Manager ${currentUser.name} approved and executed swap request ID: ${swapId}`,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to approve shift swap", err);
    }
  };

  const handleCancelSwapRequest = async (swapId: string) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, "shift_swaps", swapId), { status: 'cancelled' });
      // Audit log
      await addDoc(collection(db, "audit_logs"), {
        user_id: currentUser.id,
        action: "shift_swap_cancelled",
        details: `Requester cancelled swap request ID: ${swapId}`,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to cancel swap request", err);
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return "bg-blue-50 text-blue-600 border-blue-100";
      case 'ongoing': return "bg-amber-50 text-amber-600 border-amber-100 animate-pulse";
      case 'completed': return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case 'cancelled': return "bg-red-50 text-red-600 border-red-100";
      default: return "bg-slate-50 text-slate-600 border-slate-100";
    }
  };

  // Monthly Grid Logic
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const daysInMonth = getDaysInMonth(selectedDate.getFullYear(), selectedDate.getMonth());
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = deptFilter === "all" || user.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  const getShiftsForUserOnDay = useCallback((userId: string, day: number) => {
    return shifts
      .filter(shift => {
        const shiftDate = new Date(shift.start_time);
        return shift.user_id === userId && 
               shiftDate.getDate() === day && 
               shiftDate.getMonth() === selectedDate.getMonth() && 
               shiftDate.getFullYear() === selectedDate.getFullYear();
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [shifts, selectedDate]);

  const departments = Array.from(new Set(users.map(u => u.department))).filter(Boolean);

  const handleBulkPaste = async () => {
    if (!clipboard || !selection) return;

    const userIds = filteredUsers.map(u => u.id);
    const startUserIdx = userIds.indexOf(selection.startUser);
    const endUserIdx = userIds.indexOf(selection.endUser);
    
    const minUserIdx = Math.min(startUserIdx, endUserIdx);
    const maxUserIdx = Math.max(startUserIdx, endUserIdx);
    const minDay = Math.min(selection.startDay, selection.endDay);
    const maxDay = Math.max(selection.startDay, selection.endDay);

    const targetUsers = userIds.slice(minUserIdx, maxUserIdx + 1);
    const targetDays = Array.from({ length: maxDay - minDay + 1 }, (_, i) => minDay + i);

    const sourceStart = new Date(clipboard.start_time!);
    const sourceEnd = new Date(clipboard.end_time!);

    const formatDateForInput = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const batch = writeBatch(db);
    let count = 0;

    for (const userId of targetUsers) {
      for (const day of targetDays) {
        // Skip if shift already exists for this user on this day
        if (getShiftsForUserOnDay(userId, day).length > 0) continue;

        const targetStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day, sourceStart.getHours(), sourceStart.getMinutes());
        const targetEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day, sourceEnd.getHours(), sourceEnd.getMinutes());
        if (targetEnd <= targetStart) targetEnd.setDate(targetEnd.getDate() + 1);

        const user = users.find(u => u.id === userId);
        const newShiftRef = doc(collection(db, "shifts"));
        batch.set(newShiftRef, {
          user_id: userId,
          user_name: user?.name || "Unknown",
          user_role: user?.role || "Unknown",
          user_department: user?.department || "Unknown",
          start_time: formatDateForInput(targetStart),
          end_time: formatDateForInput(targetEnd),
          role: clipboard.role,
          location: clipboard.location,
          notes: clipboard.notes,
          status: "scheduled",
          created_at: serverTimestamp()
        });
        count++;
      }
    }

    if (count === 0) {
      setSelection(null);
      return;
    }

    try {
      await batch.commit();
      setSelection(null);
      setLastAction('paste');
    } catch (error) {
      console.error("Failed bulk paste", error);
    }
  };

  const handleBulkDelete = async () => {
    if (!selection) return;

    const userIds = filteredUsers.map(u => u.id);
    const startUserIdx = userIds.indexOf(selection.startUser);
    const endUserIdx = userIds.indexOf(selection.endUser);
    
    const minUserIdx = Math.min(startUserIdx, endUserIdx);
    const maxUserIdx = Math.max(startUserIdx, endUserIdx);
    const minDay = Math.min(selection.startDay, selection.endDay);
    const maxDay = Math.max(selection.startDay, selection.endDay);

    const targetUsers = userIds.slice(minUserIdx, maxUserIdx + 1);
    const targetDays = Array.from({ length: maxDay - minDay + 1 }, (_, i) => minDay + i);

    const batch = writeBatch(db);
    let count = 0;

    for (const userId of targetUsers) {
      for (const day of targetDays) {
        const dayShifts = getShiftsForUserOnDay(userId, day);
        dayShifts.forEach(s => {
          batch.delete(doc(db, "shifts", s.id));
          count++;
        });
      }
    }

    if (count === 0) {
      setSelection(null);
      return;
    }

    try {
      await batch.commit();
      setSelection(null);
      setLastAction('delete');
    } catch (error) {
      console.error("Failed bulk delete", error);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcut if user is typing in an input
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        handleBulkDelete();
      }
      
      if (e.key === "Escape") {
        setSelection(null);
      }

      // Ctrl+C Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selection) {
        e.preventDefault();
        const userIds = filteredUsers.map(u => u.id);
        const startUserIdx = userIds.indexOf(selection.startUser);
        const endUserIdx = userIds.indexOf(selection.endUser);
        const minUserIdx = Math.min(startUserIdx, endUserIdx);
        const maxUserIdx = Math.max(startUserIdx, endUserIdx);
        const minDay = Math.min(selection.startDay, selection.endDay);
        const maxDay = Math.max(selection.startDay, selection.endDay);

        for (let i = minUserIdx; i <= maxUserIdx; i++) {
          for (let d = minDay; d <= maxDay; d++) {
            const cellShifts = getShiftsForUserOnDay(userIds[i], d);
            if (cellShifts.length > 0) {
              setClipboard(cellShifts[0]);
              return;
            }
          }
        }
      }

      // Ctrl+V Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && selection && clipboard) {
        e.preventDefault();
        handleBulkPaste();
      }

      // Arrow Key Navigation
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const userIds = filteredUsers.map(u => u.id);
        if (userIds.length === 0) return;

        let nextEndUser = selection?.endUser ?? userIds[0];
        let nextEndDay = selection?.endDay ?? 1;

        const currentEndUserIdx = userIds.indexOf(nextEndUser);
        
        if (e.ctrlKey || e.metaKey) {
          if (e.key === "ArrowUp") {
            let i = currentEndUserIdx;
            if (i > 0) {
              const currentEmpty = getShiftsForUserOnDay(userIds[i], nextEndDay).length === 0;
              const nextEmpty = getShiftsForUserOnDay(userIds[i - 1], nextEndDay).length === 0;
              if (currentEmpty !== nextEmpty) i--;
              const targetEmpty = getShiftsForUserOnDay(userIds[i], nextEndDay).length === 0;
              while (i > 0 && (getShiftsForUserOnDay(userIds[i - 1], nextEndDay).length === 0) === targetEmpty) i--;
              nextEndUser = userIds[i];
            }
          } else if (e.key === "ArrowDown") {
            let i = currentEndUserIdx;
            if (i < userIds.length - 1) {
              const currentEmpty = getShiftsForUserOnDay(userIds[i], nextEndDay).length === 0;
              const nextEmpty = getShiftsForUserOnDay(userIds[i + 1], nextEndDay).length === 0;
              if (currentEmpty !== nextEmpty) i++;
              const targetEmpty = getShiftsForUserOnDay(userIds[i], nextEndDay).length === 0;
              while (i < userIds.length - 1 && (getShiftsForUserOnDay(userIds[i + 1], nextEndDay).length === 0) === targetEmpty) i++;
              nextEndUser = userIds[i];
            }
          } else if (e.key === "ArrowLeft") {
            let d = nextEndDay;
            if (d > 1) {
              const currentEmpty = getShiftsForUserOnDay(nextEndUser, d).length === 0;
              const nextEmpty = getShiftsForUserOnDay(nextEndUser, d - 1).length === 0;
              if (currentEmpty !== nextEmpty) d--;
              const targetEmpty = getShiftsForUserOnDay(nextEndUser, d).length === 0;
              while (d > 1 && (getShiftsForUserOnDay(nextEndUser, d - 1).length === 0) === targetEmpty) d--;
              nextEndDay = d;
            }
          } else if (e.key === "ArrowRight") {
            let d = nextEndDay;
            if (d < daysInMonth) {
              const currentEmpty = getShiftsForUserOnDay(nextEndUser, d).length === 0;
              const nextEmpty = getShiftsForUserOnDay(nextEndUser, d + 1).length === 0;
              if (currentEmpty !== nextEmpty) d++;
              const targetEmpty = getShiftsForUserOnDay(nextEndUser, d).length === 0;
              while (d < daysInMonth && (getShiftsForUserOnDay(nextEndUser, d + 1).length === 0) === targetEmpty) d++;
              nextEndDay = d;
            }
          }
        } else {
          if (e.key === "ArrowUp") {
            const nextIdx = Math.max(0, currentEndUserIdx - 1);
            nextEndUser = userIds[nextIdx];
          } else if (e.key === "ArrowDown") {
            const nextIdx = Math.min(userIds.length - 1, currentEndUserIdx + 1);
            nextEndUser = userIds[nextIdx];
          } else if (e.key === "ArrowLeft") {
            nextEndDay = Math.max(1, nextEndDay - 1);
          } else if (e.key === "ArrowRight") {
            nextEndDay = Math.min(daysInMonth, nextEndDay + 1);
          }
        }

        if (e.shiftKey && selection) {
          setSelection({ ...selection, endUser: nextEndUser, endDay: nextEndDay });
        } else {
          setSelection({ startUser: nextEndUser, startDay: nextEndDay, endUser: nextEndUser, endDay: nextEndDay });
        }
      }

      // F4 Repeat
      if (e.key === "F4" && selection) {
        e.preventDefault();
        if (lastAction === 'paste' && clipboard) {
          handleBulkPaste();
        } else if (lastAction === 'delete') {
          handleBulkDelete();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selection, filteredUsers, shifts, clipboard, daysInMonth, lastAction, getShiftsForUserOnDay]);

  const handleMouseDown = (userId: string, day: number) => {
    setIsSelecting(true);
    setSelection({ startUser: userId, startDay: day, endUser: userId, endDay: day });
  };

  const handleMouseEnter = (userId: string, day: number) => {
    if (isSelecting && selection) {
      setSelection({ ...selection, endUser: userId, endDay: day });
    }
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };

  const isInSelection = (userId: string, day: number) => {
    if (!selection) return false;
    const userIds = filteredUsers.map(u => u.id);
    const startUserIdx = userIds.indexOf(selection.startUser);
    const endUserIdx = userIds.indexOf(selection.endUser);
    const currentUserIdx = userIds.indexOf(userId);

    const minUserIdx = Math.min(startUserIdx, endUserIdx);
    const maxUserIdx = Math.max(startUserIdx, endUserIdx);
    const minDay = Math.min(selection.startDay, selection.endDay);
    const maxDay = Math.max(selection.startDay, selection.endDay);

    return currentUserIdx >= minUserIdx && currentUserIdx <= maxUserIdx &&
           day >= minDay && day <= maxDay;
  };

  const openAddModalForUser = (userId: string, day: number) => {
    const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day, 9, 0);
    const endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day, 17, 0);
    
    // Format for datetime-local input: YYYY-MM-DDTHH:mm
    const formatDateForInput = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setNewShift({
      user_id: userId.toString(),
      start_time: formatDateForInput(date),
      end_time: formatDateForInput(endDate),
      role: "",
      location: "",
      notes: ""
    });
    setIsAdding(true);
  };

  const applyPreset = (presetId: string) => {
    const preset = presets.find(p => p.id.toString() === presetId);
    if (!preset) return;

    const currentStart = new Date(newShift.start_time);
    const currentEnd = new Date(newShift.end_time);

    const [startH, startM] = preset.start_time.split(':');
    const [endH, endM] = preset.end_time.split(':');

    const newStart = new Date(currentStart);
    newStart.setHours(parseInt(startH), parseInt(startM), 0, 0);

    const newEnd = new Date(currentStart);
    newEnd.setHours(parseInt(endH), parseInt(endM), 0, 0);

    // If end time is before or same as start time, assume it's the next day
    if (newEnd <= newStart) {
      newEnd.setDate(newEnd.getDate() + 1);
    }

    const formatDateForInput = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setNewShift({
      ...newShift,
      start_time: formatDateForInput(newStart),
      end_time: formatDateForInput(newEnd),
      role: preset.role || newShift.role,
      location: preset.location || newShift.location
    });
  };

  const defaultLayout: LayoutItem[] = [
    { i: 'header', x: 0, y: 0, w: 9, h: 4 },
    { i: 'actions', x: 9, y: 0, w: 3, h: 4 },
    { i: 'filters', x: 0, y: 4, w: 12, h: 4 },
    { i: 'rota_view', x: 0, y: 8, w: 12, h: 24 },
  ];

  return (
    <div className="pb-12" dir={dir}>
      <CustomizableGrid pageId="rota" defaultLayout={defaultLayout}>
        <div key="header" className="h-full">
          <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-4 h-full", isRtl && "md:flex-row-reverse text-right")}>
            <div className={isRtl ? "text-right" : "text-left"}>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">{t("rota_title")}</h2>
              <p className="text-slate-500 mt-1 font-medium">{t("rota_subtitle")}</p>
            </div>
            <div className={cn("flex bg-slate-100 p-1 rounded-xl", isRtl && "flex-row-reverse")}>
              <button
                onClick={() => setViewMode('daily')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  viewMode === 'daily' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {language === "ar" ? "يومي" : "Daily"}
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  viewMode === 'monthly' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {language === "ar" ? "الشبكة الشهرية" : "Monthly Grid"}
              </button>
            </div>
          </div>
        </div>

        <div key="actions" className="h-full">
          <div className={cn("flex md:flex-row flex-col items-center gap-3 justify-end h-full w-full", isRtl && "md:flex-row-reverse")}>
            <button 
              onClick={handleExportCSV}
              className={cn("flex items-center gap-2 px-4 py-3 bg-white text-slate-700 border border-slate-200 hover:border-slate-300 rounded-2xl font-bold hover:bg-slate-50 transition-all shadow-sm w-full md:w-auto justify-center text-xs whitespace-nowrap cursor-pointer hover:shadow", isRtl && "flex-row-reverse")}
              title={language === "ar" ? "تصدير جدول الأسبوع الحالي إلى ملف CSV للسجلات" : "Export current week's schedule to CSV for records"}
              id="export-week-csv-btn"
            >
              <Download size={16} className="text-slate-500" />
              <span>{language === "ar" ? "تصدير الأسبوع" : "Export Week"}</span>
            </button>
            <button 
              onClick={() => setIsAdding(true)}
              className={cn("flex items-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 w-full md:w-auto justify-center text-xs whitespace-nowrap cursor-pointer", isRtl && "flex-row-reverse")}
              id="schedule-shift-btn"
            >
              <Plus size={16} />
              <span>{language === "ar" ? "جدولة مناوبة" : "Schedule Shift"}</span>
            </button>
          </div>
        </div>

        <div key="filters" className="h-full">
          <div className={cn("bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 h-full", isRtl && "lg:flex-row-reverse")}>
            <div className={cn("flex flex-wrap items-center gap-4", isRtl && "flex-row-reverse")}>
              <div className="relative">
                <Filter className={cn("absolute top-1/2 -translate-y-1/2 text-slate-400", isRtl ? "right-4" : "left-4")} size={18} />
                <input 
                  type="text"
                  placeholder={language === "ar" ? "البحث في الموظفين..." : "Search staff..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn("py-2 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-slate-900 transition-all outline-none w-64", isRtl ? "pr-12 pl-6 text-right" : "pl-12 pr-6 text-left")}
                />
              </div>
              <select 
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className={cn("px-6 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-slate-900 transition-all outline-none", isRtl && "text-right")}
              >
                <option value="all">{language === "ar" ? "جميع الأقسام" : "All Departments"}</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{tData(dept)}</option>
                ))}
              </select>
            </div>

            <div className={cn("flex items-center gap-4 bg-slate-50 p-1 rounded-xl", isRtl && "flex-row-reverse")}>
              {selection && clipboard && (
                <button 
                  onClick={handleBulkPaste}
                  className={cn("flex items-center gap-2 px-3 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 cursor-pointer", isRtl && "flex-row-reverse")}
                >
                  <ClipboardPaste size={12} />
                  {language === "ar" ? "لصق" : "Paste"}
                </button>
              )}
              {selection && (
                <button 
                  onClick={handleBulkDelete}
                  className={cn("flex items-center gap-2 px-3 py-1 bg-rose-100 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-200 transition-all border border-rose-200 cursor-pointer", isRtl && "flex-row-reverse")}
                >
                  <Trash2 size={12} />
                  {language === "ar" ? "حذف" : "Delete"}
                </button>
              )}
              {clipboard && (
                <div className={cn("flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-200", isRtl && "flex-row-reverse")}>
                  <ClipboardPaste size={12} />
                  {language === "ar" ? "مستنسخ" : "Copied"}
                  <button onClick={() => setClipboard(null)} className="ml-1 hover:text-emerald-900 cursor-pointer">
                    <XCircle size={12} />
                  </button>
                </div>
              )}
              <button 
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setMonth(d.getMonth() - (isRtl ? -1 : 1));
                  setSelectedDate(d);
                }}
                className="p-1.5 hover:bg-white rounded-lg transition-all shadow-sm cursor-pointer"
              >
                {isRtl ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              <div className="px-2 text-center min-w-[120px]">
                <p className="text-xs font-black text-slate-900 uppercase tracking-widest">
                  {selectedDate.toLocaleDateString(language === "ar" ? 'ar-EG' : 'en-US', { month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button 
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setMonth(d.getMonth() + (isRtl ? -1 : 1));
                  setSelectedDate(d);
                }}
                className="p-1.5 hover:bg-white rounded-lg transition-all shadow-sm cursor-pointer"
              >
                {isRtl ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </button>
            </div>
          </div>
        </div>

        <div key="rota_view" className="h-full">
          {viewMode === 'monthly' ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
              <div className="overflow-x-auto flex-1">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className={cn("sticky z-10 bg-slate-50 p-4 min-w-[200px]", isRtl ? "right-0 text-right border-l" : "left-0 text-left border-r")}>
                        <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{language === "ar" ? "الموظف" : "Staff Member"}</span>
                          {selection && (
                            <button 
                              onClick={() => setSelection(null)}
                              className="p-1 hover:bg-slate-200 rounded text-slate-400 cursor-pointer"
                              title={language === "ar" ? "إلغاء التحديد" : "Clear Selection"}
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>
                      </th>
                      {monthDays.map(day => {
                        const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        return (
                          <th key={day} className={cn(
                            "p-2 text-center min-w-[40px] border-r border-slate-200",
                            isWeekend ? "bg-slate-100/50" : ""
                          )}>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{tData(date.toLocaleDateString('en-US', { weekday: 'short' }))}</p>
                            <p className="text-sm font-black text-slate-900">{day}</p>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
                      <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className={cn("sticky z-10 bg-white p-4 shadow-[2px_0_5px_rgba(0,0,0,0.02)]", isRtl ? "right-0 text-right border-l" : "left-0 text-left border-r")}>
                          <div className={cn("flex items-center gap-3", isRtl && "flex-row-reverse")}>
                            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-xs font-bold">
                              {user.name.charAt(0)}
                            </div>
                            <div className={isRtl ? "text-right" : "text-left"}>
                              <p className="text-sm font-bold text-slate-900">{tData(user.name)}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{tData(user.department)}</p>
                            </div>
                          </div>
                        </td>
                        {monthDays.map(day => {
                          const dayShifts = getShiftsForUserOnDay(user.id, day);
                          const selected = isInSelection(user.id, day);
                          const isDragTarget = dragOverTarget?.userId === user.id && dragOverTarget?.day === day;
                          return (
                            <td 
                              key={day} 
                              className={cn(
                                "p-1 border-r border-slate-100 h-16 min-w-[60px] relative group cursor-pointer transition-colors select-none",
                                selected ? "bg-emerald-50/50 ring-2 ring-emerald-500 ring-inset z-10" : 
                                isDragTarget ? "bg-indigo-50/60 ring-2 ring-indigo-500 ring-inset z-10" : 
                                "hover:bg-slate-50/80"
                              )}
                              onMouseDown={() => handleMouseDown(user.id, day)}
                              onMouseEnter={() => handleMouseEnter(user.id, day)}
                              onMouseUp={handleMouseUp}
                              onDragOver={handleDragOver}
                              onDragEnter={(e) => {
                                e.preventDefault();
                                setDragOverTarget({ userId: user.id, day });
                              }}
                              onDragLeave={() => {
                                if (dragOverTarget?.userId === user.id && dragOverTarget?.day === day) {
                                  setDragOverTarget(null);
                                }
                              }}
                              onDrop={(e) => {
                                setDragOverTarget(null);
                                handleDrop(e, user.id, day);
                              }}
                            >
                              {dayShifts.length > 0 ? (
                                <div className="space-y-1">
                                  {dayShifts.map(shift => (
                                    <div 
                                      key={shift.id}
                                      id={`shift-monthly-${shift.id}`}
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, shift.id)}
                                      onDragEnd={handleDragEnd}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedShift(shift);
                                      }}
                                      className={cn(
                                        "p-1 rounded-md text-[9px] font-bold border truncate relative group/shift cursor-grab active:cursor-grabbing transition-all",
                                        draggedShiftId === shift.id ? "opacity-30 border-dashed border-indigo-400 bg-indigo-50/50" : getStatusColor(shift.status)
                                      )}
                                      title={`${formatTime(shift.start_time)} - ${formatTime(shift.end_time)} at ${shift.location}`}
                                    >
                                      {formatTime(shift.start_time)}
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopyShift(shift);
                                        }}
                                        className="absolute right-0 top-0 bottom-0 bg-white/80 px-1 opacity-0 group-hover/shift:opacity-100 transition-opacity"
                                      >
                                        <Copy size={10} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-full transition-opacity gap-1">
                                  <button 
                                    onClick={() => openAddModalForUser(user.id, day)}
                                    className="p-1 hover:bg-slate-100 rounded"
                                  >
                                    <Plus size={14} className="text-slate-300" />
                                  </button>
                                  {clipboard && (
                                    <button 
                                      onClick={() => handlePasteShift(user.id, day)}
                                      className="p-1 hover:bg-emerald-50 text-emerald-500 rounded cursor-pointer"
                                      title={language === "ar" ? "لصق المناوبة" : "Paste Shift"}
                                    >
                                      <ClipboardPaste size={14} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-full overflow-y-auto pr-2", isRtl && "text-right")}>
              {filteredUsers.map(user => {
                const dayShifts = getShiftsForUserOnDay(user.id, selectedDate.getDate());
                const isDragOverDailyUser = dragOverUserDaily === user.id;
                return (
                  <div 
                    key={user.id}
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setDragOverUserDaily(user.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverUserDaily === user.id) {
                        setDragOverUserDaily(null);
                      }
                    }}
                    onDrop={(e) => {
                      setDragOverUserDaily(null);
                      handleDrop(e, user.id, selectedDate.getDate());
                    }}
                    className={cn(
                      "bg-white p-6 rounded-3xl border transition-all duration-200 shadow-sm hover:shadow-md",
                      isDragOverDailyUser 
                        ? "border-indigo-500 bg-indigo-50/20 ring-2 ring-indigo-200" 
                        : "border-slate-200"
                    )}
                  >
                    <div className={cn("flex items-center justify-between mb-4", isRtl && "flex-row-reverse")}>
                      <div className={cn("flex items-center gap-3", isRtl && "flex-row-reverse")}>
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold">
                          {user.name.charAt(0)}
                        </div>
                        <div className={isRtl ? "text-right" : "text-left"}>
                          <p className="font-bold text-slate-900">{tData(user.name)}</p>
                          <p className="text-xs text-slate-500 font-medium">{tData(user.department)}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => openAddModalForUser(user.id, selectedDate.getDate())}
                        className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all cursor-pointer"
                      >
                        <Plus size={20} />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {dayShifts.length > 0 ? (
                        dayShifts.map(shift => (
                          <div 
                            key={shift.id}
                            id={`shift-daily-${shift.id}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, shift.id)}
                            onDragEnd={handleDragEnd}
                            onClick={() => setSelectedShift(shift)}
                            className={cn(
                              "p-4 rounded-2xl border-2 cursor-grab active:cursor-grabbing transition-all hover:scale-[1.02]",
                              draggedShiftId === shift.id 
                                ? "opacity-30 border-dashed border-indigo-400 bg-indigo-50/50" 
                                : getStatusColor(shift.status)
                            )}
                          >
                            <div className={cn("flex items-center justify-between mb-2", isRtl && "flex-row-reverse")}>
                              <div className={cn("flex items-center gap-2", isRtl && "flex-row-reverse")}>
                                <Clock size={14} />
                                <span className="text-sm font-bold" dir="ltr">{formatTime(shift.start_time)} - {formatTime(shift.end_time)}</span>
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-white/50 rounded-full">
                                {tData(shift.status)}
                              </span>
                            </div>
                            <p className="font-bold text-sm mb-1">{tData(shift.role || "General Shift")}</p>
                            <div className={cn("flex items-center gap-2 opacity-70", isRtl && "flex-row-reverse")}>
                              <MapPin size={12} />
                              <span className="text-xs font-medium">{tData(shift.location || "Main Site")}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-8 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-300">
                          <CalendarIcon size={24} className="mb-2" />
                          <p className="text-xs font-bold uppercase tracking-widest">{language === "ar" ? "لا توجد مناوبات مجدولة" : "No Shifts Scheduled"}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CustomizableGrid>

      {/* Shift Swap & Cover Hub */}
      <div className="mt-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm" id="shift-swap-workfows-hub">
        <div className={cn("flex items-center justify-between border-b border-slate-100 pb-4 mb-6", isRtl && "flex-row-reverse text-right")}>
          <div className={cn("flex items-center gap-3", isRtl && "flex-row-reverse")}>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
              <Shuffle size={20} />
            </div>
            <div className={isRtl ? "text-right" : "text-left"}>
              <h3 className="text-lg font-black text-slate-900 leading-tight">{language === "ar" ? "عمليات تبادل وتغطية المناوبات" : "Shift Swap & Cover Workflows"}</h3>
              <p className="text-xs text-slate-500 font-medium">{language === "ar" ? "تنسيق عمليات تبادل المناوبات وتغطية الفريق وتغيير الحالات مع مراجعة واعتماد الإدارة الفورية." : "Coordinate shift trades, team coverage, and status changes with atomic manager verification."}</p>
            </div>
          </div>
        </div>

        <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-6", isRtl && "text-right")}>
          {/* Left Column: Received Invitations & Sent Requests */}
          <div className="space-y-6">
            {/* Received Requests from Colleagues (Acceptance Required) */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 space-y-4">
              <h4 className={cn("text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5", isRtl && "flex-row-reverse")}>
                <ArrowLeftRight size={12} className="text-indigo-500" />
                {language === "ar" ? "الطلبات الواردة (تتطلب موافقتك)" : "Received Requests (Consent Required)"}
              </h4>
              {swaps.filter(sw => sw.colleague_id === currentUser?.id && sw.status === 'pending_colleague').length === 0 ? (
                <p className="text-xs text-slate-400 font-medium">{language === "ar" ? "لا توجد أي طلبات معلقة من الزملاء تتطلب موافقتك حالياً." : "No pending requests from colleagues requiring your consent."}</p>
              ) : (
                <div className="space-y-4">
                  {swaps
                    .filter(sw => sw.colleague_id === currentUser?.id && sw.status === 'pending_colleague')
                    .map(sw => {
                      const s = shifts.find(item => item.id === sw.requester_shift_id);
                      const colS = sw.colleague_shift_id ? shifts.find(item => item.id === sw.colleague_shift_id) : null;
                      return (
                        <div key={sw.id} className="bg-white border border-slate-200 p-4 rounded-xl space-y-3 shadow-xs">
                          <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
                            <p className="text-xs font-black text-slate-800">{language === "ar" ? `مقترح تبادل من ${tData(sw.requester_name)}` : `Proposal from ${sw.requester_name}`}</p>
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-[9px] font-bold uppercase tracking-wider">
                              {language === "ar" ? "في انتظار الموافقة" : "Awaiting Consent"}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">{language === "ar" ? "مناوبتهم" : "Their Shift"}</p>
                              {s ? (
                                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl space-y-1">
                                  <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-white border border-slate-200/60 px-1.5 py-0.5 rounded-md">{tData(s.role)}</span>
                                    <span className="text-[10px] text-slate-500 font-bold">{tData(s.location)}</span>
                                  </div>
                                  <p className="text-xs font-black text-slate-800" dir={isRtl ? "rtl" : "ltr"}>{new Date(s.start_time).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                  <p className="text-[10px] text-slate-500 font-bold" dir="ltr">
                                    {new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - {new Date(s.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                  </p>
                                </div>
                              ) : (
                                <div className="p-3 bg-red-50 text-red-500 rounded-xl text-center text-xs font-bold">{language === "ar" ? "مفقودة أو محذوفة" : "Missing or deleted"}</div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">{language === "ar" ? "مناوبتك المقابلة للتبادل" : "Your Shift in Return"}</p>
                              {sw.colleague_shift_id ? (
                                colS ? (
                                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl space-y-1">
                                    <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
                                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-white border border-slate-200/60 px-1.5 py-0.5 rounded-md">{tData(colS.role)}</span>
                                      <span className="text-[10px] text-slate-500 font-bold">{tData(colS.location)}</span>
                                    </div>
                                    <p className="text-xs font-black text-slate-800" dir={isRtl ? "rtl" : "ltr"}>{new Date(colS.start_time).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                    <p className="text-[10px] text-slate-500 font-bold" dir="ltr">
                                      {new Date(colS.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - {new Date(colS.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="p-3 bg-red-50 text-red-500 rounded-xl text-center text-xs font-bold">{language === "ar" ? "مفقودة أو محذوفة" : "Missing or deleted"}</div>
                                )
                              ) : (
                                <div className="h-full flex items-center justify-center p-3 bg-indigo-50/40 border border-dashed border-indigo-100 rounded-xl text-center text-xs font-bold text-indigo-700 min-h-[90px]">
                                  {language === "ar" ? "طُلب تغطية فقط" : "Coverage Only Requested"}
                                </div>
                              )}
                            </div>
                          </div>

                          {sw.notes && (
                            <div className="p-2.5 bg-slate-50 rounded-lg text-xs font-medium text-slate-600 border border-slate-100">
                              <strong>{language === "ar" ? "ملاحظة:" : "Note:"}</strong> "{sw.notes}"
                            </div>
                          )}

                          <div className={cn("flex items-center gap-2 pt-2", isRtl && "flex-row-reverse")}>
                            <button
                              onClick={() => handleColleagueAction(sw.id, "accept")}
                              className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                              id={`colleague-accept-${sw.id}`}
                            >
                              <Check size={12} /> {language === "ar" ? "قبول التبادل" : "Accept trade"}
                            </button>
                            <button
                              onClick={() => handleColleagueAction(sw.id, "reject")}
                              className="py-2 px-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                              id={`colleague-reject-${sw.id}`}
                            >
                              {language === "ar" ? "رفض" : "Decline"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* My Sent Swap / Coverage Requests */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 space-y-4">
              <h4 className={cn("text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5", isRtl && "flex-row-reverse")}>
                <Shuffle size={12} className="text-slate-500" />
                {language === "ar" ? "طلباتي المرسلة" : "My Sent Requests"}
              </h4>
              {swaps.filter(sw => sw.requester_id === currentUser?.id).length === 0 ? (
                <p className="text-xs text-slate-400 font-medium">{language === "ar" ? "لم تقم بإرسال أي طلبات تبادل بعد." : "You haven't submitted any swap requests yet."}</p>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {swaps
                    .filter(sw => sw.requester_id === currentUser?.id)
                    .map(sw => {
                      const s = shifts.find(item => item.id === sw.requester_shift_id);
                      const colS = sw.colleague_shift_id ? shifts.find(item => item.id === sw.colleague_shift_id) : null;
                      return (
                        <div key={sw.id} className="bg-white border border-slate-150 p-4 rounded-xl space-y-3 shadow-xs">
                          <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
                            <p className="text-xs font-black text-slate-800">{language === "ar" ? `تبادل مع ${tData(sw.colleague_name)}` : `Swap with ${sw.colleague_name}`}</p>
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                              sw.status === 'pending_colleague' ? "bg-amber-50 text-amber-700 border-amber-200" :
                              sw.status === 'pending_manager' ? "bg-indigo-50 text-indigo-700 border-indigo-250 animate-pulse" :
                              sw.status === 'approved' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              sw.status === 'rejected' ? "bg-rose-50 text-rose-700 border-rose-200" :
                              "bg-slate-50 text-slate-500 border-slate-200"
                            )}>
                              {tData(sw.status)}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{language === "ar" ? "مناوبتك" : "Your Shift"}</p>
                              {s ? (
                                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-[11px] font-bold text-slate-700">
                                  <p className="font-extrabold text-slate-900 leading-none mb-1 text-xs">{tData(s.role)}</p>
                                  <p dir={isRtl ? "rtl" : "ltr"}>{new Date(s.start_time).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", { month: 'short', day: 'numeric' })}</p>
                                  <p className="text-[10px] text-slate-400 font-medium" dir="ltr">
                                    {new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - {new Date(s.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                  </p>
                                </div>
                              ) : (
                                <div className="p-2.5 bg-red-50 text-red-500 rounded-xl text-center text-[10px]">{language === "ar" ? "تم حذف المناوبة" : "Shift Deleted"}</div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{language === "ar" ? "مناوبتهم المقابلة" : "Their Return"}</p>
                              {sw.colleague_shift_id ? (
                                colS ? (
                                  <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-[11px] font-bold text-slate-700">
                                    <p className="font-extrabold text-slate-900 leading-none mb-1 text-xs">{tData(colS.role)}</p>
                                    <p dir={isRtl ? "rtl" : "ltr"}>{new Date(colS.start_time).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", { month: 'short', day: 'numeric' })}</p>
                                    <p className="text-[10px] text-slate-400 font-medium" dir="ltr">
                                      {new Date(colS.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - {new Date(colS.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="p-2.5 bg-red-50 text-red-500 rounded-xl text-center text-[10px]">{language === "ar" ? "تم حذف المناوبة" : "Shift Deleted"}</div>
                                )
                              ) : (
                                <div className="h-full flex items-center justify-center p-2.5 bg-indigo-50/30 border border-dashed border-indigo-100 rounded-xl text-center text-[10px] font-bold text-indigo-700 min-h-[70px]">
                                  {language === "ar" ? "تغطية المناوبة" : "Coverage trade"}
                                </div>
                              )}
                            </div>
                          </div>

                          {sw.notes && (
                            <p className="text-[10px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                              {language === "ar" ? "ملاحظة:" : "Note:"} "{sw.notes}"
                            </p>
                          )}

                          {(sw.status === 'pending_colleague' || sw.status === 'pending_manager') && (
                            <button
                              onClick={() => handleCancelSwapRequest(sw.id)}
                              className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                              id={`cancel-swap-${sw.id}`}
                            >
                              {language === "ar" ? "إلغاء طلب التبادل" : "Cancel Swap Request"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Manager Verification Desk & Overall History */}
          <div className="space-y-6">
            {/* Manager Verification Review Desk */}
            {(currentUser?.role === 'manager' || currentUser?.role === 'admin') && (
              <div className="border border-indigo-100 bg-indigo-50/10 rounded-2xl p-5 space-y-4">
                <div className={cn("flex items-center justify-between pb-2 border-b border-indigo-100/60", isRtl && "flex-row-reverse")}>
                  <div className={cn("flex items-center gap-2", isRtl && "flex-row-reverse")}>
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                    <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest">{language === "ar" ? "قائمة مراجعة الإدارة" : "Manager review queue"}</h4>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {language === "ar" 
                      ? `${swaps.filter(sw => sw.status === 'pending_manager').length} طلب معلق`
                      : `${swaps.filter(sw => sw.status === 'pending_manager').length} Actionable`
                    }
                  </span>
                </div>

                {swaps.filter(sw => sw.status === 'pending_manager').length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium bg-white border border-slate-100 p-4 rounded-xl text-center">{language === "ar" ? "لا توجد معاملات تبادل بانتظار قرار مراجعة واعتماد الإدارة حالياً." : "No swap transactions currently awaiting manager verification decision."}</p>
                ) : (
                  <div className="space-y-4">
                    {swaps
                      .filter(sw => sw.status === 'pending_manager')
                      .map(sw => {
                        const s = shifts.find(item => item.id === sw.requester_shift_id);
                        const colS = sw.colleague_shift_id ? shifts.find(item => item.id === sw.colleague_shift_id) : null;
                        return (
                          <div key={sw.id} className="bg-white border border-indigo-100 p-4 rounded-xl space-y-3 shadow-xs">
                            <div className={cn("flex items-center justify-between text-xs border-b border-slate-100 pb-2", isRtl && "flex-row-reverse")}>
                              <div className={isRtl ? "text-right" : "text-left"}>
                                <p className="font-extrabold text-slate-900">{tData(sw.requester_name)} ⇄ {tData(sw.colleague_name)}</p>
                                <p className="text-[10px] text-slate-400 font-medium">{language === "ar" ? "وافق كلا الموظفين. بانتظار موافقتك النهائية." : "Both employees consented. Awaiting your approval."}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{language === "ar" ? `مناوبة ${tData(sw.requester_name)}` : `${sw.requester_name}'s Shift`}</p>
                                {s ? (
                                  <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl text-[11px] text-slate-700">
                                    <p className="font-extrabold text-slate-800 text-xs">{tData(s.role)}</p>
                                    <p className="font-bold" dir={isRtl ? "rtl" : "ltr"}>{new Date(s.start_time).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", { month: 'short', day: 'numeric' })}</p>
                                    <p className="text-[10px] text-slate-400 font-medium" dir="ltr">
                                      {new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - {new Date(s.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="p-2.5 bg-red-50 text-red-500 rounded-xl text-center text-[10px]">{language === "ar" ? "تم حذف المناوبة" : "Shift Deleted"}</div>
                                )}
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{language === "ar" ? `مناوبة ${tData(sw.colleague_name)} المقابلة` : `${sw.colleague_name}'s Settle/Return`}</p>
                                {sw.colleague_shift_id ? (
                                  colS ? (
                                    <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl text-[11px] text-slate-700">
                                      <p className="font-extrabold text-slate-800 text-xs">{tData(colS.role)}</p>
                                      <p className="font-bold" dir={isRtl ? "rtl" : "ltr"}>{new Date(colS.start_time).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", { month: 'short', day: 'numeric' })}</p>
                                      <p className="text-[10px] text-slate-400 font-medium" dir="ltr">
                                        {new Date(colS.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - {new Date(colS.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="p-2.5 bg-red-50 text-red-500 rounded-xl text-center text-[10px]">{language === "ar" ? "تم حذف المناوبة" : "Shift Deleted"}</div>
                                  )
                                ) : (
                                  <div className="h-full flex items-center justify-center p-2 rounded-xl bg-orange-50/50 border border-dashed border-orange-200 text-orange-700 text-[10px] font-bold min-h-[60px]">
                                    {language === "ar" ? "تغطية وجهة واحدة (استلام المناوبة)" : "One-Way Coverage (Takeover)"}
                                  </div>
                                )}
                              </div>
                            </div>

                            {sw.notes && (
                              <div className="p-2.5 bg-slate-50 rounded-lg text-xs font-medium text-slate-700 border border-slate-100">
                                <strong>{language === "ar" ? "السبب المقدم:" : "Reason provided:"}</strong> "{sw.notes}"
                              </div>
                            )}

                            <div className={cn("flex items-center gap-2 pt-1", isRtl && "flex-row-reverse")}>
                              <button
                                onClick={() => handleManagerApproval(sw.id, "approve")}
                                className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1"
                                id={`manager-approve-${sw.id}`}
                              >
                                <Check size={12} /> {language === "ar" ? "اعتماد التبادل" : "Approve Swap"}
                              </button>
                              <button
                                onClick={() => handleManagerApproval(sw.id, "reject")}
                                className="py-1.5 px-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                id={`manager-reject-${sw.id}`}
                              >
                                {language === "ar" ? "رفض" : "Decline"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* Resolved Swap Archives/History */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 space-y-4">
              <h4 className={cn("text-xs font-black text-slate-500 uppercase tracking-widest", isRtl && "text-right")}>{language === "ar" ? "سجلات التبادل والأرشيف" : "Trade Logs & Archive"}</h4>
              {swaps.filter(sw => ['approved', 'rejected', 'cancelled'].includes(sw.status)).length === 0 ? (
                <p className="text-xs text-slate-400 font-medium">{language === "ar" ? "لا توجد معاملات تبادل مؤرشفة مسجلة بعد." : "No archived trade transactions recorded."}</p>
              ) : (
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {swaps
                    .filter(sw => ['approved', 'rejected', 'cancelled'].includes(sw.status))
                    .slice()
                    .reverse()
                    .map(sw => (
                      <div key={sw.id} className={cn("bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between text-xs shadow-xs", isRtl && "flex-row-reverse")}>
                        <div className={cn("space-y-0.5", isRtl ? "text-right" : "text-left")}>
                          <p className="font-bold text-slate-800">{tData(sw.requester_name)} ⇄ {tData(sw.colleague_name)}</p>
                          <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
                            {language === "ar" ? "السبب:" : "Reason:"} {sw.notes || (language === "ar" ? "لم يُحدد" : "Not specified")}
                          </p>
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border",
                          sw.status === 'approved' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                          sw.status === 'rejected' ? "bg-rose-50 text-rose-700 border-rose-100" :
                          "bg-slate-100 text-slate-500 border-slate-200"
                        )}>
                          {tData(sw.status)}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Shift Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
              dir={dir}
            >
              <div className={cn("p-8 bg-slate-900 text-white flex items-center justify-between", isRtl && "flex-row-reverse text-right")}>
                <div className={isRtl ? "text-right" : "text-left"}>
                  <h3 className="text-2xl font-black tracking-tight">{language === "ar" ? "جدولة مناوبة جديدة" : "Schedule New Shift"}</h3>
                  <p className="text-slate-400 text-sm font-medium mt-1">{language === "ar" ? "تعيين موظف لوقت ومهمة محددة." : "Assign staff to a specific time and role."}</p>
                </div>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors cursor-pointer">
                  <XIcon size={24} />
                </button>
              </div>

              <form onSubmit={handleAddShift} className={cn("p-8 space-y-6", isRtl && "text-right")}>
                <div className="space-y-2">
                  <label className={cn("text-xs font-black text-slate-400 uppercase tracking-widest block", isRtl ? "mr-1" : "ml-1")}>{language === "ar" ? "استخدام مناوبة جاهزة" : "Use Preset Shift"}</label>
                  <select
                    onChange={(e) => applyPreset(e.target.value)}
                    className={cn("w-full p-4 bg-emerald-50 border-2 border-emerald-100 text-emerald-900 rounded-2xl focus:border-emerald-500 transition-all outline-none font-bold", isRtl && "text-right")}
                  >
                    <option value="">{language === "ar" ? "جدول مخصص / اختر مناوبة جاهزة..." : "Custom Schedule / Select Preset..."}</option>
                    {presets.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.start_time} - {p.end_time})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className={cn("text-xs font-black text-slate-400 uppercase tracking-widest block", isRtl ? "mr-1" : "ml-1")}>{language === "ar" ? "عضو فريق العمل" : "Staff Member"}</label>
                    <select
                      required
                      value={newShift.user_id}
                      onChange={(e) => setNewShift({ ...newShift, user_id: e.target.value })}
                      className={cn("w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 transition-all outline-none", isRtl && "text-right")}
                    >
                      <option value="">{language === "ar" ? "اختر الموظف" : "Select Staff"}</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{tData(user.name)} ({tData(user.role)})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className={cn("text-xs font-black text-slate-400 uppercase tracking-widest block", isRtl ? "mr-1" : "ml-1")}>{language === "ar" ? "الموقع" : "Location"}</label>
                    <input
                      type="text"
                      placeholder={language === "ar" ? "مثال: البوابة الرئيسية، صالة أ" : "e.g. Main Gate, Gallery A"}
                      value={newShift.location}
                      onChange={(e) => setNewShift({ ...newShift, location: e.target.value })}
                      className={cn("w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 transition-all outline-none", isRtl && "text-right")}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={cn("text-xs font-black text-slate-400 uppercase tracking-widest block", isRtl ? "mr-1" : "ml-1")}>{language === "ar" ? "وقت البدء" : "Start Time"}</label>
                    <input
                      required
                      type="datetime-local"
                      value={newShift.start_time}
                      onChange={(e) => setNewShift({ ...newShift, start_time: e.target.value })}
                      className={cn("w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 transition-all outline-none", isRtl && "text-right")}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={cn("text-xs font-black text-slate-400 uppercase tracking-widest block", isRtl ? "mr-1" : "ml-1")}>{language === "ar" ? "وقت الانتهاء" : "End Time"}</label>
                    <input
                      required
                      type="datetime-local"
                      value={newShift.end_time}
                      onChange={(e) => setNewShift({ ...newShift, end_time: e.target.value })}
                      className={cn("w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 transition-all outline-none", isRtl && "text-right")}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={cn("text-xs font-black text-slate-400 uppercase tracking-widest block", isRtl ? "mr-1" : "ml-1")}>{language === "ar" ? "ملاحظات / تعليمات" : "Notes / Instructions"}</label>
                  <textarea
                    rows={3}
                    placeholder={language === "ar" ? "مهام محددة أو ملاحظات التسليم..." : "Specific duties or handover notes..."}
                    value={newShift.notes}
                    onChange={(e) => setNewShift({ ...newShift, notes: e.target.value })}
                    className={cn("w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 transition-all outline-none resize-none", isRtl && "text-right")}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 cursor-pointer"
                >
                  {language === "ar" ? "تأكيد الجدولة" : "Confirm Schedule"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Shift Control Modal */}
      <AnimatePresence>
        {selectedShift && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
              dir={dir}
            >
              <div className={cn("p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50", isRtl && "flex-row-reverse text-right")}>
                <div className={cn("flex items-center gap-4", isRtl && "flex-row-reverse")}>
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg", 
                    selectedShift.status === 'scheduled' ? "bg-slate-500 shadow-slate-500/20" :
                    selectedShift.status === 'ongoing' ? "bg-amber-500 shadow-amber-500/20" :
                    selectedShift.status === 'completed' ? "bg-emerald-500 shadow-emerald-500/20" :
                    "bg-rose-500 shadow-rose-500/20"
                  )}>
                    <Clock size={24} />
                  </div>
                  <div className={isRtl ? "text-right" : "text-left"}>
                    <h3 className="text-xl font-black text-slate-900 leading-tight">{language === "ar" ? "التحكم في المناوبة" : "Shift Control"}</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{tData(selectedShift.user_name)} • {tData(selectedShift.role)}</p>
                  </div>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedShift(null)} 
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <XIcon size={32} />
                </motion.button>
              </div>

              <div className={cn("p-8 space-y-8", isRtl && "text-right")}>
                {/* Status Controls */}
                <div className="space-y-4">
                  <label className={cn("text-xs font-black text-slate-400 uppercase tracking-widest block", isRtl && "text-right")}>{language === "ar" ? "حالة المناوبة" : "Shift Status"}</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(['scheduled', 'ongoing', 'completed', 'cancelled'] as Shift['status'][]).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleUpdateShiftStatus(selectedShift.id, status)}
                        className={cn(
                          "px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all cursor-pointer",
                          selectedShift.status === status 
                            ? cn("border-current shadow-lg", getStatusColor(status))
                            : "border-slate-100 text-slate-400 hover:border-slate-200"
                        )}
                      >
                        {language === "ar" 
                          ? (status === "scheduled" ? "مجدولة" : status === "ongoing" ? "جارية" : status === "completed" ? "مكتملة" : "ملغاة") 
                          : status
                        }
                      </button>
                    ))}
                  </div>
                </div>

                {/* Details Form */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className={cn("text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2", isRtl && "flex-row-reverse text-right")}>
                      <MapPin size={14} /> {language === "ar" ? "الموقع" : "Location"}
                    </label>
                    <input 
                      value={selectedShift.location}
                      onChange={e => handleUpdateShiftDetails(selectedShift.id, { location: e.target.value })}
                      className={cn("w-full px-5 py-3 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold text-slate-700", isRtl && "text-right")}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={cn("text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2", isRtl && "flex-row-reverse text-right")}>
                      <User size={14} /> {language === "ar" ? "المهمة / الدور" : "Role"}
                    </label>
                    <input 
                      value={selectedShift.role}
                      onChange={e => handleUpdateShiftDetails(selectedShift.id, { role: e.target.value })}
                      className={cn("w-full px-5 py-3 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold text-slate-700", isRtl && "text-right")}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={cn("text-xs font-black text-slate-400 uppercase tracking-widest block", isRtl && "text-right")}>{language === "ar" ? "ملاحظات المناوبة" : "Shift Notes"}</label>
                  <textarea 
                    value={selectedShift.notes}
                    onChange={e => handleUpdateShiftDetails(selectedShift.id, { notes: e.target.value })}
                    rows={3}
                    className={cn("w-full px-5 py-3 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 resize-none", isRtl && "text-right")}
                    placeholder={language === "ar" ? "أضف أي تعليمات محددة لهذه المناوبة..." : "Add any specific instructions for this shift..."}
                  />
                </div>

                {/* Shift Swap flow for staff */}
                {selectedShift.user_id === currentUser?.id && selectedShift.status === 'scheduled' && (
                  <div className="border-t border-slate-100 pt-6 space-y-4">
                    {!isRequestingSwap ? (
                      <button
                        type="button"
                        onClick={() => setIsRequestingSwap(true)}
                        className={cn("w-full py-3 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer", isRtl && "flex-row-reverse")}
                        id="open-swap-panel-btn"
                      >
                        <Shuffle size={14} />
                        {language === "ar" ? "طلب تبادل مناوبة أو تغطية" : "Request Shift Swap or Coverage"}
                      </button>
                    ) : (
                      <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-200/50 space-y-4">
                        <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
                          <h4 className={cn("text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5", isRtl && "flex-row-reverse")}>
                            <Shuffle size={12} className="text-indigo-600" />
                            {language === "ar" ? "طلب تبادل مناوبة جديد" : "New Shift Swap Request"}
                          </h4>
                          <button
                            type="button"
                            onClick={() => setIsRequestingSwap(false)}
                            className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                          >
                            {language === "ar" ? "إلغاء" : "Cancel"}
                          </button>
                        </div>

                        {swapSuccessMsg ? (
                          <div className={cn("p-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-center text-xs font-bold flex items-center gap-2 justify-center", isRtl && "flex-row-reverse")}>
                            <Check size={14} />
                            {language === "ar" ? "تم تقديم طلب تبادل المناوبة بنجاح!" : swapSuccessMsg}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="space-y-1.5 text-left">
                              <label className={cn("text-[10px] font-black text-slate-400 uppercase tracking-widest block", isRtl && "text-right")}>
                                {language === "ar" ? "١. اختر الزميل" : "1. Select Colleague"}
                              </label>
                              <select
                                value={swapColleagueId}
                                onChange={(e) => {
                                  setSwapColleagueId(e.target.value);
                                  setSwapColleagueShiftId(null);
                                }}
                                className={cn("w-full px-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-slate-700", isRtl && "text-right")}
                              >
                                <option value="">{language === "ar" ? "-- اختر الزميل --" : "-- Choose Colleague --"}</option>
                                {users
                                  .filter(u => u.id !== currentUser?.id)
                                  .map(u => (
                                    <option key={u.id} value={u.id}>
                                      {tData(u.name)} ({tData(u.department) || (language === "ar" ? "موظف" : "Staff")})
                                    </option>
                                  ))}
                              </select>
                            </div>

                            {swapColleagueId && (
                              <div className="space-y-1.5 text-left">
                                <label className={cn("text-[10px] font-black text-slate-400 uppercase tracking-widest block", isRtl && "text-right")}>
                                  {language === "ar" ? "٢. اختر مناوبة التبادل (اختياري)" : "2. Select Swap Shift (Optional)"}
                                </label>
                                <select
                                  value={swapColleagueShiftId || ""}
                                  onChange={(e) => setSwapColleagueShiftId(e.target.value || null)}
                                  className={cn("w-full px-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-slate-700", isRtl && "text-right")}
                                >
                                  <option value="">{language === "ar" ? "تغطية فقط (لا توجد مناوبة مقابلة)" : "Coverage Only (No Shift in Return)"}</option>
                                  {shifts
                                    .filter(s => s.user_id === swapColleagueId && s.status === 'scheduled')
                                    .map(s => {
                                      const sDate = new Date(s.start_time);
                                      const eDate = new Date(s.end_time);
                                      const dateStr = sDate.toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", { month: 'short', day: 'numeric' });
                                      const timeStr = `${sDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: false})} - ${eDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: false})}`;
                                      return (
                                        <option key={s.id} value={s.id}>
                                          {dateStr} | {timeStr} ({tData(s.role)})
                                        </option>
                                      );
                                    })}
                                </select>
                              </div>
                            )}

                            <div className="space-y-1.5 text-left">
                              <label className={cn("text-[10px] font-black text-slate-400 uppercase tracking-widest block", isRtl && "text-right")}>
                                {language === "ar" ? "السبب / الملاحظات" : "Reason / Notes"}
                              </label>
                              <textarea
                                value={swapNotes}
                                onChange={(e) => setSwapNotes(e.target.value)}
                                rows={2}
                                placeholder={language === "ar" ? "مثال: التزام عائلي، موعد طبيب..." : "E.g., doctor appointment, family commitment..."}
                                className={cn("w-full px-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-slate-700 resize-none", isRtl && "text-right")}
                              />
                            </div>

                            <button
                              type="button"
                              disabled={!swapColleagueId}
                              onClick={async () => {
                                if (!swapColleagueId) return;
                                await handleSubmitSwapRequest(selectedShift.id, swapColleagueId, swapColleagueShiftId, swapNotes);
                                setSwapSuccessMsg("Swap request submitted successfully!");
                              }}
                              className={cn("w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer", isRtl && "flex-row-reverse")}
                              id="submit-swap-request-btn"
                            >
                              <Shuffle size={12} />
                              {language === "ar" ? "تقديم طلب تبادل المناوبة" : "Submit Swap Request"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className={cn("pt-4 flex gap-4", isRtl && "flex-row-reverse")}>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      handleDeleteShift(selectedShift.id);
                      setSelectedShift(null);
                    }}
                    className={cn("flex-1 px-6 py-4 bg-rose-50 text-rose-600 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-rose-100 transition-colors flex items-center justify-center gap-2 cursor-pointer", isRtl && "flex-row-reverse")}
                  >
                    <Trash2 size={18} /> {language === "ar" ? "حذف المناوبة" : "Delete Shift"}
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedShift(null)}
                    className="flex-1 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-slate-800 transition-colors shadow-xl shadow-slate-900/20 cursor-pointer"
                  >
                    {language === "ar" ? "تم" : "Done"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
