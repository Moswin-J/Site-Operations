import React, { useEffect, useState } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar,
  User,
  Flag,
  MapPin,
  Camera,
  Check,
  X as XIcon,
  TrendingUp
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LayoutItem } from '../context/LayoutContext';
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { CustomizableGrid } from "./CustomizableGrid";

const DEPARTMENTS = [
  "Visitor Experience",
  "Visitor Services",
  "Business Support",
  "Facility Management",
  "Security",
  "Conservation",
  "Heritage Management"
];

export function Tasks() {
  const { language, tData, dir } = useLanguage();
  const [tasks, setTasks] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [completionComment, setCompletionComment] = useState("");
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  
  const { user: currentUser } = useAuth();

  const canReviewTask = (task: any) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return currentUser.role === 'manager' && 
           currentUser.department === task.department;
  };

  const [newTask, setNewTask] = useState({ 
    title: "", 
    description: "", 
    assigned_to: "", 
    priority: "medium", 
    department: "",
    due_date: "",
    location: "",
    image_url: "",
    created_by: ""
  });
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    if (!currentUser) return;

    const path = "tasks";
    const q = query(collection(db, path), orderBy("created_at", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
        due_date: doc.data().due_date?.toDate?.()?.toISOString() || doc.data().due_date
      }));
      setTasks(taskList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    const fetchUsers = async () => {
      const usersPath = "users";
      try {
        const userSnapshot = await getDocs(collection(db, usersPath));
        setUsers(userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, usersPath);
      }
    };

    fetchUsers();
    return () => unsubscribe();
  }, [currentUser]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, stateSetter: any, state: any) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        stateSetter({ ...state, image_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      await addDoc(collection(db, "tasks"), {
        ...newTask,
        created_by: currentUser.id,
        creator_name: currentUser.name,
        status: "pending",
        created_at: serverTimestamp()
      });
      
      setIsModalOpen(false);
      setNewTask({ 
        title: "", 
        description: "", 
        assigned_to: "", 
        priority: "medium", 
        department: "",
        due_date: "",
        location: "",
        image_url: "",
        created_by: ""
      });
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    if (currentStatus === 'pending') {
      const task = tasks.find(t => t.id === id);
      setSelectedTask(task);
      setCompletionComment("");
      setIsCompletionModalOpen(true);
    } else {
      try {
        await updateDoc(doc(db, "tasks", id), {
          status: 'pending',
          completion_comment: null
        });
      } catch (error) {
        console.error("Error updating task status:", error);
      }
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    try {
      await updateDoc(doc(db, "tasks", selectedTask.id), {
        status: 'completed',
        completion_comment: completionComment
      });
      setIsCompletionModalOpen(false);
      setCompletionComment("");
      setSelectedTask(null);
    } catch (error) {
      console.error("Error completing task:", error);
    }
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    try {
      const assignedUser = users.find(u => u.id === selectedTask.assigned_to);
      await updateDoc(doc(db, "tasks", selectedTask.id), {
        assigned_to: selectedTask.assigned_to,
        assigned_name: assignedUser?.name || "Unassigned",
        due_date: selectedTask.due_date
      });
      setIsReviewModalOpen(false);
      setSelectedTask(null);
    } catch (error) {
      console.error("Error reviewing task:", error);
    }
  };

  const filteredTasks = tasks.filter(task => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = task.title.toLowerCase().includes(searchLower) || 
                         task.description?.toLowerCase().includes(searchLower) ||
                         task.creator_name?.toLowerCase().includes(searchLower) ||
                         task.location?.toLowerCase().includes(searchLower) ||
                         new Date(task.created_at).toLocaleDateString().toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    const matchesDepartment = departmentFilter === "all" || task.department === departmentFilter;
    
    return matchesSearch && matchesStatus && matchesPriority && matchesDepartment;
  }).sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "due_asc":
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      case "due_desc":
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
      case "assignee":
        return (a.assigned_name || "").localeCompare(b.assigned_name || "");
      default:
        return 0;
    }
  });

  const defaultLayout: LayoutItem[] = [
    { i: 'filters', x: 0, y: 0, w: 9, h: 4 },
    { i: 'actions', x: 9, y: 0, w: 3, h: 4 },
    { i: 'task_list', x: 0, y: 4, w: 12, h: 20 },
  ];

  const isRtl = dir === "rtl";

  return (
    <div className={cn("pb-12 space-y-8 max-w-7xl mx-auto", isRtl && "text-right")}>
      {/* Header & Controls */}
      <div className={cn("flex flex-col lg:flex-row lg:items-center justify-between gap-6", isRtl && "lg:flex-row-reverse")}>
        <div className="space-y-4 flex-1">
          <div className="relative group">
            <Search className={cn("absolute top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors", isRtl ? "right-4" : "left-4")} size={18} />
            <input 
              type="text" 
              placeholder={language === "ar" ? "البحث في مهام العمليات الميدانية..." : "Query task matrix..."} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn("w-full py-4 bg-white border border-slate-200 rounded-[2rem] focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium text-slate-600 shadow-sm", isRtl ? "pl-4 pr-12 text-right" : "pl-12 pr-4 text-left")}
            />
          </div>
          
          <div className={cn("flex flex-wrap items-center gap-2", isRtl && "flex-row-reverse")}>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={cn("px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer", isRtl && "text-right")}
            >
              <option value="all">{language === "ar" ? "جميع الحالات" : "Every Status"}</option>
              <option value="pending">{language === "ar" ? "مهام معلقة" : "Pending Ops"}</option>
              <option value="completed">{language === "ar" ? "مهام مكتملة ومؤكدة" : "Verified Meta"}</option>
            </select>
            <select 
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className={cn("px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer", isRtl && "text-right")}
            >
              <option value="all">{language === "ar" ? "أي مستوى أهمية" : "Any Priority"}</option>
              <option value="low">{language === "ar" ? "أهمية: منخفضة" : "Priority: Low"}</option>
              <option value="medium">{language === "ar" ? "أهمية: متوسطة" : "Priority: Med"}</option>
              <option value="high">{language === "ar" ? "أهمية: عالية" : "Priority: High"}</option>
            </select>
            <select 
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className={cn("px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer", isRtl && "text-right")}
            >
              <option value="all">{language === "ar" ? "جميع قطاعات الموقع" : "All Sectors"}</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{tData(d)}</option>)}
            </select>
            <button 
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setPriorityFilter("all");
                setDepartmentFilter("all");
                setSortBy("newest");
              }}
              className="p-2 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors text-slate-300 hover:text-red-500 cursor-pointer"
            >
              <XIcon size={18} />
            </button>
          </div>
        </div>

        <div className={cn("flex items-center gap-4", isRtl && "flex-row-reverse")}>
           <div className={cn("hidden sm:flex flex-col text-right", isRtl ? "text-left" : "text-right")}>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                {language === "ar" ? "ترتيب المهام" : "Matrix Sort"}
              </span>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={cn("text-xs font-bold text-slate-900 bg-transparent outline-none cursor-pointer appearance-none", isRtl ? "text-left" : "text-right")}
              >
                <option value="newest">{language === "ar" ? "الأحدث أولاً" : "Latest Chronology"}</option>
                <option value="oldest">{language === "ar" ? "الأقدم أولاً" : "Historical Log"}</option>
                <option value="due_asc">{language === "ar" ? "تاريخ الاستحقاق (الأقرب)" : "Criticality (Soonest)"}</option>
              </select>
           </div>
           <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 group cursor-pointer"
            >
              <Plus size={18} className="group-hover:rotate-90 transition-transform" />
              <span>{language === "ar" ? "إضافة توجية/مهمة" : "Directives"}</span>
            </button>
        </div>
      </div>

      {/* Task List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredTasks.map((task) => (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "mission-control-card flex flex-col group overflow-hidden border-2",
                task.status === 'completed' ? "border-emerald-100 bg-emerald-50/10" : "border-slate-100 bg-white",
                isRtl && "text-right"
              )}
            >
              <div className="p-8 flex-1 space-y-6">
                <div className={cn("flex items-start justify-between", isRtl && "flex-row-reverse")}>
                  <div className={cn("flex items-center gap-4", isRtl && "flex-row-reverse")}>
                    <button 
                      onClick={() => toggleStatus(task.id, task.status)}
                      className={cn(
                        "w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer",
                        task.status === 'completed' 
                          ? "bg-emerald-500 border-emerald-500 text-white" 
                          : "border-slate-200 hover:border-emerald-500"
                      )}
                    >
                      {task.status === 'completed' && <Check size={14} strokeWidth={4} />}
                    </button>
                    <div className={cn(isRtl && "text-right")}>
                      <h4 className={cn("text-xl font-black text-slate-900 tracking-tight transition-all", task.status === 'completed' && "opacity-40 italic")}>
                        {task.title}
                      </h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        {language === "ar" ? "نطاق العمل الميداني: " : "Deployment Zone: "}{" "}
                        <span className="text-slate-900">
                          {task.location ? tData(task.location) : (language === "ar" ? "كامل أرجاء الموقع" : "Site Wide")}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border",
                    task.priority === 'high' ? "bg-red-50 border-red-100 text-red-600" : 
                    task.priority === 'medium' ? "bg-amber-50 border-amber-100 text-amber-600" : 
                    "bg-slate-50 border-slate-100 text-slate-400"
                  )}>
                    {task.priority === 'high' ? (language === "ar" ? "عالية" : "high") : 
                     task.priority === 'medium' ? (language === "ar" ? "متوسطة" : "medium") : 
                     (language === "ar" ? "منخفضة" : "low")}
                  </div>
                </div>

                <p className="text-sm text-slate-500 font-medium leading-relaxed italic">
                  "{task.description}"
                </p>

                {task.image_url && (
                  <div className="relative h-40 rounded-3xl overflow-hidden border border-slate-100 bg-slate-50 grayscale group-hover:grayscale-0 transition-all duration-700">
                    <img src={task.image_url} alt="A-Attachment" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-900/80 to-transparent">
                       <span className={cn("text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2", isRtl && "flex-row-reverse")}>
                         <Camera size={12} strokeWidth={3} /> 
                         <span>{language === "ar" ? "المرفق البصري والمثبت الميداني" : "Visual Telemetry"}</span>
                       </span>
                    </div>
                  </div>
                )}
              </div>

              <div className={cn("px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between", isRtl && "flex-row-reverse")}>
                <div className={cn("flex items-center gap-6", isRtl && "flex-row-reverse")}>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      {language === "ar" ? "الوحدة المعنية" : "Assigned Unit"}
                    </span>
                    <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">
                      {task.assigned_name ? tData(task.assigned_name) : (language === "ar" ? "غير معين بعد" : "Unassigned")}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      {language === "ar" ? "تاريخ الاستحقاق" : "Due Date"}
                    </span>
                    <span className={cn("text-xs font-bold", 
                      task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'font-black text-red-600 animate-pulse' : 'text-slate-700'
                    )}>
                      {task.due_date ? new Date(task.due_date).toLocaleDateString(language === "ar" ? "ar-EG" : "en-GB", { day: '2-digit', month: 'short' }).toUpperCase() : (language === "ar" ? "بالانتظار" : "TBD")}
                    </span>
                  </div>
                </div>
                
                <div className={cn("flex items-center gap-2", isRtl && "flex-row-reverse")}>
                  {canReviewTask(task) && (!task.assigned_to || !task.due_date) && task.status !== 'completed' && (
                    <button
                      onClick={() => {
                        setSelectedTask({ ...task });
                        setIsReviewModalOpen(true);
                      }}
                      className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-emerald-500 hover:border-emerald-500 transition-all shadow-sm cursor-pointer"
                    >
                      <User size={18} />
                    </button>
                  )}
                  <div className={cn("w-3 h-3 rounded-full border-2 border-white shadow-sm", 
                    task.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-400 pulse'
                  )} />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* New Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn("bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden", isRtl && "text-right")}
          >
            <div className={cn("p-6 border-b border-slate-100 flex items-center justify-between", isRtl && "flex-row-reverse")}>
              <h3 className="text-xl font-bold text-slate-900">
                {language === "ar" ? "إنشاء توجيه ميداني جديد" : "Create New Task"}
              </h3>
              <motion.button 
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <XIcon size={24} />
              </motion.button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 block">
                  {language === "ar" ? "عنوان التوجيه/المهمة" : "Task Title"}
                </label>
                <input 
                  required
                  value={newTask.title}
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                  className={cn("w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none", isRtl && "text-right")}
                  placeholder={language === "ar" ? "مثال: فحص البوابة الشرقية وجدرانها الارتكازية" : "e.g., Inspect East Gate masonry"}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 block">
                  {language === "ar" ? "الوصف التفصيلي" : "Description"}
                </label>
                <textarea 
                  value={newTask.description}
                  onChange={e => setNewTask({...newTask, description: e.target.value})}
                  className={cn("w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none min-h-[100px]", isRtl && "text-right")}
                  placeholder={language === "ar" ? "اكتب هنا التفاصيل الكاملة للمهمة المطلوبة..." : "Details about the task..."}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 block">
                    {language === "ar" ? "القسم المسؤول" : "Department"}
                  </label>
                  <select 
                    value={newTask.department}
                    onChange={e => setNewTask({...newTask, department: e.target.value})}
                    className={cn("w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white cursor-pointer", isRtl && "text-right")}
                  >
                    <option value="">{language === "ar" ? "اختر القسم" : "Select Department"}</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{tData(d)}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 block">
                    {language === "ar" ? "مستوى الأهمية" : "Priority"}
                  </label>
                  <select 
                    value={newTask.priority}
                    onChange={e => setNewTask({...newTask, priority: e.target.value})}
                    className={cn("w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white cursor-pointer", isRtl && "text-right")}
                  >
                    <option value="low">{language === "ar" ? "منخفض" : "Low"}</option>
                    <option value="medium">{language === "ar" ? "متوسط" : "Medium"}</option>
                    <option value="high">{language === "ar" ? "عالي" : "High"}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 block">
                    {language === "ar" ? "نطاق العمل" : "Location"}
                  </label>
                  <input 
                    type="text"
                    placeholder={language === "ar" ? "مثال: القاعة الكبرى أو الساحة الوسطى" : "e.g., Great Hall"}
                    value={newTask.location}
                    onChange={e => setNewTask({...newTask, location: e.target.value})}
                    className={cn("w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white", isRtl && "text-right")}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 block">
                    {language === "ar" ? "بواسطة (الضابط المسؤول)" : "Created By"}
                  </label>
                  <select 
                    required
                    value={newTask.created_by}
                    onChange={e => setNewTask({...newTask, created_by: e.target.value})}
                    className={cn("w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white cursor-pointer", isRtl && "text-right")}
                  >
                    <option value="">{language === "ar" ? "اختر الضابط المبلغ" : "Select Reporter"}</option>
                    {users.map(u => <option key={u.id} value={u.id}>{tData(u.name)}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 block">
                  {language === "ar" ? "مرفقات (صورة ميدانية أو رابط ملف)" : "Attachment (Photo or File URL)"}
                </label>
                <div className={cn("flex gap-2", isRtl && "flex-row-reverse")}>
                  <input 
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={newTask.image_url}
                    onChange={e => setNewTask({...newTask, image_url: e.target.value})}
                    className={cn("flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white text-sm", isRtl && "text-right")}
                  />
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={(e) => handleFileChange(e, setNewTask, newTask)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl flex items-center gap-2 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      <Camera size={18} />
                      <span className="text-sm font-semibold">{language === "ar" ? "رفع صورة" : "Upload"}</span>
                    </motion.div>
                  </div>
                </div>
                {newTask.image_url && newTask.image_url.startsWith('data:') && (
                  <p className={cn("text-[10px] text-emerald-600 font-medium mt-1 flex items-center gap-1", isRtl && "flex-row-reverse")}>
                    <Check size={10} /> 
                    <span>{language === "ar" ? "تم إرفاق الملف الميداني بنجاح" : "File attached successfully"}</span>
                  </p>
                )}
              </div>
              
              <div className={cn("pt-4 flex gap-3", isRtl && "flex-row-reverse")}>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {language === "ar" ? "إلغاء الأمر" : "Cancel"}
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  {language === "ar" ? "إنشاء وتعميم المهمة" : "Create Task"}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Review & Assign Modal */}
      {isReviewModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn("bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden", isRtl && "text-right")}
          >
            <div className={cn("p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-50", isRtl && "flex-row-reverse")}>
              <h3 className="text-xl font-bold text-slate-900">
                {language === "ar" ? "مراجعة وتعيين المهمة التشغيلية" : "Review & Assign Task"}
              </h3>
              <motion.button 
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsReviewModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <XIcon size={24} />
              </motion.button>
            </div>
            <div className="p-6 bg-slate-50 border-b border-slate-100">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">
                {language === "ar" ? "تفاصيل هذه المهمة" : "Task Details"}
              </p>
              <h4 className="font-bold text-slate-900">{selectedTask.title}</h4>
              <p className="text-sm text-slate-600 mt-1">{selectedTask.description}</p>
            </div>
            <form onSubmit={handleReview} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 block">
                  {language === "ar" ? "إسناد وتكليف حارس" : "Assign To Staff"}
                </label>
                <select 
                  required
                  value={selectedTask.assigned_to || ""}
                  onChange={e => setSelectedTask({...selectedTask, assigned_to: e.target.value})}
                  className={cn("w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white cursor-pointer", isRtl && "text-right")}
                >
                  <option value="">{language === "ar" ? "اختر الحارس أو الموظف" : "Select Staff"}</option>
                  {users
                    .filter(u => currentUser.role === 'admin' || u.department === selectedTask.department)
                    .map(u => <option key={u.id} value={u.id}>{tData(u.name)}</option>)
                  }
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 block">
                  {language === "ar" ? "تحديد وقت وتاريخ الاستحقاق" : "Set Due Date"}
                </label>
                <input 
                  required
                  type="date"
                  value={selectedTask.due_date || ""}
                  onChange={e => setSelectedTask({...selectedTask, due_date: e.target.value})}
                  className={cn("w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white", isRtl && "text-right")}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 block">
                  {language === "ar" ? "تحديث المرفق" : "Update Attachment"}
                </label>
                <div className={cn("flex gap-2", isRtl && "flex-row-reverse")}>
                  <input 
                    type="url"
                    placeholder={language === "ar" ? "أدخل رابط الصورة أو الملف المحدث..." : "Update photo or file URL..."}
                    value={selectedTask.image_url || ""}
                    onChange={e => setSelectedTask({...selectedTask, image_url: e.target.value})}
                    className={cn("flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white text-sm", isRtl && "text-right")}
                  />
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={(e) => handleFileChange(e, setSelectedTask, selectedTask)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl flex items-center gap-2 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      <Camera size={18} />
                    </motion.div>
                  </div>
                </div>
              </div>
              <div className={cn("pt-4 flex gap-3", isRtl && "flex-row-reverse")}>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {language === "ar" ? "إلغاء الأمر" : "Cancel"}
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  {language === "ar" ? "اعتماد وإسناد المهمة" : "Approve & Assign"}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Completion Modal */}
      {isCompletionModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn("bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden", isRtl && "text-right")}
          >
            <div className={cn("p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-500 text-white", isRtl && "flex-row-reverse")}>
              <h3 className="text-xl font-bold">
                {language === "ar" ? "تأكيد إنجاز المهمة" : "Complete Task"}
              </h3>
              <motion.button 
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsCompletionModalOpen(false)} 
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <XIcon size={24} />
              </motion.button>
            </div>
            <form onSubmit={handleComplete} className="p-6 space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                  {language === "ar" ? "المهمة" : "Task"}
                </p>
                <p className="font-semibold text-slate-900">{selectedTask.title}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 block">
                  {language === "ar" ? "تعليقات وملاحظات الإنجاز الميداني" : "Completion Comments"}
                </label>
                <textarea 
                  required
                  placeholder={language === "ar" ? "اكتب بالتفصيل ما الذي تم إنجازه ميدانياً..." : "Describe what was done..."}
                  value={completionComment}
                  onChange={e => setCompletionComment(e.target.value)}
                  className={cn("w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white min-h-[120px] resize-none", isRtl && "text-right")}
                />
              </div>
              <div className={cn("pt-4 flex gap-3", isRtl && "flex-row-reverse")}>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setIsCompletionModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {language === "ar" ? "إلغاء الأمر" : "Cancel"}
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  {language === "ar" ? "حفظ وتأكيد إكمال الإنجاز" : "Confirm Completion"}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function XIconComponent({ size, className }: { size?: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
  );
}
