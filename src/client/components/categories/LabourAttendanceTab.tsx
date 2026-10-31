import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import {
  CalendarCheck, Users, Plus, Pencil, Trash2, Search,
  Filter, IndianRupee, ArrowDownRight, ArrowUpRight, Receipt,
  Coffee, Wrench, Shield, CheckCircle2, ChevronRight, Calculator,
  Calendar, Layers, Sparkles, Building, AlertCircle
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { ManageTeamsModal } from "../ui/ManageTeamsModal";
import { useLiveSync, triggerSync } from "../../hooks/useLiveSync";
import { useToast } from "../../contexts/ToastContext";
import { formatINR, formatDate } from "../../lib/formatters";
import { DateInput } from "../ui/DateInput";

const COMMON_UNITS = ["Nos", "Brass", "Sq.Ft", "R.Ft", "Cu.Ft", "Bags", "Kg", "Ton", "Hours", "Days", "Units"];

const EXPENSE_CATEGORIES = [
  "Tea & Refreshments",
  "Food & Bhattha",
  "Travel & Transport",
  "Tools & Maintenance",
  "Safety Equipment",
  "Medical & First Aid",
  "Fuel & Generator",
  "Site Sundries & Misc"
];

interface TeamSelectInputProps {
  value: string;
  onChange: (value: string) => void;
  availableTeams: string[];
  onOpenManageTeams: () => void;
  label?: string;
  required?: boolean;
  themeColor?: "amber" | "indigo" | "rose";
  placeholder?: string;
  allowGeneral?: boolean;
}

function TeamSelectInput({
  value,
  onChange,
  availableTeams,
  onOpenManageTeams,
  label = "Select Team *",
  required = false,
  themeColor = "amber",
  placeholder = "Choose or enter Team name...",
  allowGeneral = false,
}: TeamSelectInputProps) {
  const [isCustomMode, setIsCustomMode] = useState(false);

  const ringClass =
    themeColor === "indigo"
      ? "focus:ring-indigo-500"
      : themeColor === "rose"
      ? "focus:ring-rose-500"
      : "focus:ring-amber-500";

  const textBtnClass =
    themeColor === "indigo"
      ? "text-indigo-700 hover:text-indigo-900"
      : themeColor === "rose"
      ? "text-rose-700 hover:text-rose-900"
      : "text-amber-700 hover:text-amber-900";

  const chipActive =
    themeColor === "indigo"
      ? "bg-indigo-100 text-indigo-800 border-indigo-300 font-bold"
      : themeColor === "rose"
      ? "bg-rose-100 text-rose-800 border-rose-300 font-bold"
      : "bg-amber-100 text-amber-800 border-amber-300 font-bold";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {availableTeams.length > 0 && (
            <button
              type="button"
              onClick={() => setIsCustomMode(!isCustomMode)}
              className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              {isCustomMode ? "Select list" : "Type custom"}
            </button>
          )}
          <button
            type="button"
            onClick={onOpenManageTeams}
            className={`text-[10px] font-bold ${textBtnClass} hover:underline flex items-center gap-0.5 cursor-pointer`}
          >
            <Plus className="w-3 h-3" />
            + New Team
          </button>
        </div>
      </div>

      {isCustomMode || availableTeams.length === 0 ? (
        <div className="relative">
          <input
            type="text"
            list="available-teams-datalist"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 ${ringClass} focus:outline-hidden`}
          />
          <datalist id="available-teams-datalist">
            {availableTeams.map((t, idx) => (
              <option key={idx} value={t} />
            ))}
          </datalist>
        </div>
      ) : (
        <div className="relative">
          <select
            value={value}
            onChange={(e) => {
              if (e.target.value === "__NEW__") {
                onOpenManageTeams();
              } else if (e.target.value === "__CUSTOM__") {
                setIsCustomMode(true);
              } else {
                onChange(e.target.value);
              }
            }}
            className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 ${ringClass} focus:outline-hidden`}
          >
            <option value="">-- Choose Team ({availableTeams.length}) --</option>
            {allowGeneral && <option value="Site General">Site General</option>}
            {availableTeams.map((teamName, idx) => (
              <option key={idx} value={teamName}>
                {teamName}
              </option>
            ))}
            <option value="__NEW__">+ Add New Team in Master...</option>
            <option value="__CUSTOM__">✎ Type Custom Team Name...</option>
          </select>
        </div>
      )}

      {/* Quick click team pills for fast selection */}
      {availableTeams.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          {allowGeneral && (
            <button
              type="button"
              onClick={() => {
                setIsCustomMode(false);
                onChange("Site General");
              }}
              className={`text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                value === "Site General"
                  ? chipActive
                  : "bg-slate-100/80 hover:bg-slate-200 text-slate-600 border-slate-200"
              }`}
            >
              Site General
            </button>
          )}
          {availableTeams.slice(0, 5).map((t, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setIsCustomMode(false);
                onChange(t);
              }}
              className={`text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                value === t
                  ? chipActive
                  : "bg-slate-100/80 hover:bg-slate-200 text-slate-600 border-slate-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const getRecordAmount = (r: any): number => {
  if (!r) return 0;
  const upadVal = parseFloat(String(r.upad ?? 0)) || 0;
  const payVal = parseFloat(String(r.paymentAmount ?? 0)) || 0;
  const amtVal = parseFloat(String(r.amount ?? 0)) || 0;
  const grossVal = parseFloat(String(r.grossSalary ?? 0)) || 0;
  const netVal = parseFloat(String(r.netSalary ?? 0)) || 0;

  const attUpper = String(r.attendanceType || "").toUpperCase();
  const isUpad = attUpper.includes("UPAD") || attUpper === "TEAM_UPAD";
  const isKharch = attUpper.includes("KHARCH") || attUpper === "OTHER_KHARCH" || attUpper === "EXPENSE";

  if (isUpad) {
    return upadVal || payVal || amtVal || grossVal || 0;
  }
  if (isKharch) {
    return payVal || grossVal || netVal || amtVal || 0;
  }
  return grossVal || netVal || payVal || amtVal || 0;
};

export default function LabourAttendanceTab({ locationId }: { locationId: number }) {
  const { showToast, confirmAction } = useToast();

  // Primary 3 Subtabs requested by user:
  // 1st: add_attendance (with Day-wise and TC-wise options, no select labour field)
  // 2nd: team_upad
  // 3rd: other_kharch
  const [activeSubTab, setActiveSubTab] = useState<"add_attendance" | "team_upad" | "other_kharch">("add_attendance");

  // Attendance Mode (Day Wise vs TC Wise)
  const [attendanceMode, setAttendanceMode] = useState<"day_wise" | "tc_wise">("day_wise");

  // Data states
  const [teams, setTeams] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Team Modal State & Target Form
  const [isManageTeamOpen, setIsManageTeamOpen] = useState(false);
  const [manageTeamTarget, setManageTeamTarget] = useState<"day" | "tc" | "upad" | "kharch" | "edit" | null>(null);

  // Edit Modal State
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");

  // 1. Add Attendance: Day Wise Form State (NO Select Labour field)
  const [dayForm, setDayForm] = useState({
    date: new Date().toISOString().split("T")[0],
    teamName: "",
    attendanceType: "Full Day", // Full Day (1), Half Day (0.5), Custom Days
    customDays: "1",
    dailyRate: "",
    notes: ""
  });

  // 1. Add Attendance: TC Wise Form State (NO Select Labour field)
  const [tcForm, setTcForm] = useState({
    date: new Date().toISOString().split("T")[0],
    teamName: "",
    workName: "", // Task name (Masonry, Plaster, Slab, etc.)
    unitOfMeasurement: "Sq.Ft",
    quantity: "",
    rate: "",
    notes: ""
  });

  // 2. Team Upad Form State
  const [upadForm, setUpadForm] = useState({
    date: new Date().toISOString().split("T")[0],
    teamName: "",
    amount: "",
    paymentMethod: "Cash",
    referenceNumber: "",
    notes: ""
  });

  // 3. Other Kharch Form State
  const [kharchForm, setKharchForm] = useState({
    date: new Date().toISOString().split("T")[0],
    teamName: "Site General",
    expenseCategory: "Tea & Refreshments",
    amount: "",
    paymentMethod: "Cash",
    referenceNumber: "",
    notes: ""
  });

  // Load Data
  const loadData = async (isBackground = false) => {
    if (!isBackground && records.length === 0) setLoading(true);
    try {
      const [teamsData, attendanceData, locsData] = await Promise.all([
        apiFetch(`/master/teams?locationId=${locationId}`).catch(() => []),
        apiFetch(`/labour?locationId=${locationId}`).catch(() => []),
        apiFetch(`/locations`).catch(() => [])
      ]);

      setTeams(Array.isArray(teamsData) ? teamsData : (teamsData?.teams || []));
      setRecords(Array.isArray(attendanceData) ? attendanceData : (attendanceData?.records || []));
      setLocations(Array.isArray(locsData) ? locsData : (locsData?.locations || []));
    } catch (err) {
      console.error("Failed to fetch labour data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, [locationId]);

  useLiveSync(() => {
    loadData(true);
  }, 3500);

  // Derived unique team list from master teams + any previously entered teams in records
  const availableTeams = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    teams.forEach(t => {
      const n = (t.name || "").trim();
      if (n && !seen.has(n.toLowerCase())) {
        seen.add(n.toLowerCase());
        list.push(n);
      }
    });

    records.forEach(r => {
      const n = (r.labourTeam || r.teamName || "").trim();
      if (n && n !== "Site General" && !seen.has(n.toLowerCase())) {
        seen.add(n.toLowerCase());
        list.push(n);
      }
    });

    return list.sort();
  }, [teams, records]);

  // Auto-select first available team when list populates so user never has to search or leave it blank
  useEffect(() => {
    if (availableTeams.length > 0) {
      setDayForm(prev => prev.teamName ? prev : { ...prev, teamName: availableTeams[0] });
      setTcForm(prev => prev.teamName ? prev : { ...prev, teamName: availableTeams[0] });
      setUpadForm(prev => prev.teamName ? prev : { ...prev, teamName: availableTeams[0] });
    }
  }, [availableTeams]);

  // Overall Financial & Attendance Summary Calculations
  const summaries = useMemo(() => {
    let totalAttendanceWages = 0;
    let totalDayWiseWages = 0;
    let totalTcWiseWages = 0;
    let totalDayWiseDays = 0;
    let totalTeamUpad = 0;
    let totalOtherKharch = 0;

    records.forEach(r => {
      const attUpper = String(r.attendanceType || "").toUpperCase();
      const isUpad = attUpper.includes("UPAD") || attUpper === "TEAM_UPAD";
      const isKharch = attUpper.includes("KHARCH") || attUpper === "OTHER_KHARCH" || attUpper === "EXPENSE";
      const isWork = attUpper.includes("WORK") || attUpper.includes("TC") || attUpper === "TC_WISE";

      const recAmt = getRecordAmount(r);

      if (isUpad) {
        totalTeamUpad += recAmt;
      } else if (isKharch) {
        totalOtherKharch += recAmt;
      } else if (isWork) {
        totalTcWiseWages += recAmt;
        totalAttendanceWages += recAmt;
      } else {
        // Day Wise
        totalDayWiseWages += recAmt;
        totalDayWiseDays += parseFloat(String(r.days || "0")) || 0;
        totalAttendanceWages += recAmt;
      }
    });

    // Total Labour Deduction from Project Investment Capital (Cat 2)
    const totalLabourOutflow = totalAttendanceWages + totalTeamUpad + totalOtherKharch;

    return {
      totalAttendanceWages: Math.round(totalAttendanceWages * 100) / 100,
      totalDayWiseWages: Math.round(totalDayWiseWages * 100) / 100,
      totalTcWiseWages: Math.round(totalTcWiseWages * 100) / 100,
      totalDayWiseDays: Math.round(totalDayWiseDays * 10) / 10,
      totalTeamUpad: Math.round(totalTeamUpad * 100) / 100,
      totalOtherKharch: Math.round(totalOtherKharch * 100) / 100,
      totalLabourOutflow: Math.round(totalLabourOutflow * 100) / 100,
    };
  }, [records]);

  // Filtered Records based on Active Subtab
  const currentTabRecords = useMemo(() => {
    return records.filter(r => {
      const attUpper = String(r.attendanceType || "").toUpperCase();
      const isUpad = attUpper.includes("UPAD") || attUpper === "TEAM_UPAD";
      const isKharch = attUpper.includes("KHARCH") || attUpper === "OTHER_KHARCH" || attUpper === "EXPENSE";
      const isAttendance = !isUpad && !isKharch;

      if (activeSubTab === "add_attendance" && !isAttendance) return false;
      if (activeSubTab === "team_upad" && !isUpad) return false;
      if (activeSubTab === "other_kharch" && !isKharch) return false;

      // Team filter
      const teamName = (r.labourTeam || r.teamName || r.labourName || "").toLowerCase();
      if (teamFilter !== "ALL" && teamName !== teamFilter.toLowerCase()) return false;

      // Date filter
      if (dateFilter && r.date !== dateFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matches =
          teamName.includes(query) ||
          (r.workType || "").toLowerCase().includes(query) ||
          (r.notes || "").toLowerCase().includes(query) ||
          (r.referenceNumber || "").toLowerCase().includes(query) ||
          (r.paymentMethod || "").toLowerCase().includes(query);
        if (!matches) return false;
      }

      return true;
    });
  }, [records, activeSubTab, teamFilter, dateFilter, searchQuery]);

  // Handle Day Wise Attendance Submit
  const handleDaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTeam = (dayForm.teamName || availableTeams[0] || "General Team").trim();

    const rate = parseFloat(dayForm.dailyRate) || 0;
    let daysCount = 1;
    if (dayForm.attendanceType === "Half Day") daysCount = 0.5;
    else if (dayForm.attendanceType === "Custom") daysCount = parseFloat(dayForm.customDays) || 1;

    try {
      await apiFetch("/labour", {
        method: "POST",
        body: JSON.stringify({
          locationId,
          date: dayForm.date,
          teamName: targetTeam,
          attendanceType: "DAY_WISE",
          days: daysCount.toString(),
          dailyRate: rate.toString(),
          notes: dayForm.notes.trim() || undefined
        })
      });

      showToast(`Day Attendance recorded for team "${targetTeam}"`, "success");
      setDayForm(prev => ({
        ...prev,
        dailyRate: "",
        notes: ""
      }));
      triggerSync("labour");
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to record day attendance", "error");
    }
  };

  // Handle TC Wise Attendance Submit
  const handleTcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTeam = (tcForm.teamName || availableTeams[0] || "General Team").trim();

    if (!tcForm.workName.trim()) {
      showToast("Please enter the Work Name / TC Task.", "error");
      return;
    }

    const qty = parseFloat(tcForm.quantity) || 0;
    const rate = parseFloat(tcForm.rate) || 0;

    try {
      await apiFetch("/labour", {
        method: "POST",
        body: JSON.stringify({
          locationId,
          date: tcForm.date,
          teamName: targetTeam,
          attendanceType: "TC_WISE",
          workName: tcForm.workName.trim(),
          unitOfMeasurement: tcForm.unitOfMeasurement,
          quantity: qty.toString(),
          rate: rate.toString(),
          notes: tcForm.notes.trim() || undefined
        })
      });

      showToast(`TC Work Attendance recorded for team "${targetTeam}"`, "success");
      setTcForm(prev => ({
        ...prev,
        workName: "",
        quantity: "",
        rate: "",
        notes: ""
      }));
      triggerSync("labour");
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to record TC attendance", "error");
    }
  };

  // Handle Team Upad Submit
  const handleUpadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTeam = (upadForm.teamName || availableTeams[0] || "General Team").trim();

    const amt = parseFloat(upadForm.amount) || 0;
    if (amt <= 0) {
      showToast("Please enter a valid Upad amount.", "error");
      return;
    }

    try {
      await apiFetch("/labour", {
        method: "POST",
        body: JSON.stringify({
          locationId,
          date: upadForm.date,
          teamName: targetTeam,
          attendanceType: "TEAM_UPAD",
          amount: amt.toString(),
          upad: amt.toString(),
          paymentAmount: amt.toString(),
          paymentMethod: upadForm.paymentMethod,
          referenceNumber: upadForm.referenceNumber.trim() || undefined,
          notes: upadForm.notes.trim() || undefined
        })
      });

      showToast(`Team Upad of ₹${formatINR(amt)} recorded for "${targetTeam}"`, "success");
      setUpadForm(prev => ({
        ...prev,
        amount: "",
        referenceNumber: "",
        notes: ""
      }));
      triggerSync("labour");
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to record team upad", "error");
    }
  };

  // Handle Other Kharch Submit
  const handleKharchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(kharchForm.amount) || 0;
    if (amt <= 0) {
      showToast("Please enter a valid expense amount.", "error");
      return;
    }

    try {
      await apiFetch("/labour", {
        method: "POST",
        body: JSON.stringify({
          locationId,
          date: kharchForm.date,
          teamName: kharchForm.teamName.trim() || "Site General",
          attendanceType: "OTHER_KHARCH",
          expenseCategory: kharchForm.expenseCategory,
          amount: amt.toString(),
          paymentAmount: amt.toString(),
          paymentMethod: kharchForm.paymentMethod,
          referenceNumber: kharchForm.referenceNumber.trim() || undefined,
          notes: kharchForm.notes.trim() || undefined
        })
      });

      showToast(`Other Kharch of ₹${formatINR(amt)} recorded`, "success");
      setKharchForm(prev => ({
        ...prev,
        amount: "",
        referenceNumber: "",
        notes: ""
      }));
      triggerSync("labour");
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to record expense", "error");
    }
  };

  // Delete Record
  const handleDeleteRecord = async (id: number) => {
    const confirmed = await confirmAction({
      title: "Delete Entry",
      message: "Are you sure you want to delete this labour/attendance record? This will adjust your Category 2 deductions.",
      confirmLabel: "Delete",
      isDanger: true
    });
    if (!confirmed) return;
    try {
      await apiFetch(`/labour/${id}`, { method: "DELETE" });
      showToast("Record deleted successfully", "success");
      triggerSync("labour");
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to delete record", "error");
    }
  };

  // Open Edit Modal
  const handleEditClick = (record: any) => {
    const editAmount = getRecordAmount(record);
    const daysVal = parseFloat(record.days || "1") || 1;
    const qtyVal = parseFloat(record.tcQuantity || record.quantity || "1") || 1;
    let derivedDailyRate = record.dailyRate || "0";
    if (record.attendanceType === "DAY_WISE" && (parseFloat(derivedDailyRate) <= 0 || isNaN(parseFloat(derivedDailyRate))) && editAmount > 0) {
      derivedDailyRate = String(Math.round((editAmount / daysVal) * 100) / 100);
    }
    let derivedRate = record.tcRate || record.rate || record.dailyRate || "0";
    if (record.attendanceType === "TC_WISE" && (parseFloat(derivedRate) <= 0 || isNaN(parseFloat(derivedRate))) && editAmount > 0) {
      derivedRate = String(Math.round((editAmount / qtyVal) * 100) / 100);
    }

    setEditingRecord({
      ...record,
      teamName: record.labourTeam || record.teamName || record.labourName || "",
      amount: String(editAmount || "0"),
      workName: record.workType || record.tcNumber || "",
      rate: derivedRate,
      quantity: record.tcQuantity || record.quantity || "0",
      days: record.days || "1",
      dailyRate: derivedDailyRate,
      unitOfMeasurement: record.unitOfMeasurement || "Sq.Ft",
      notes: record.notes || "",
      referenceNumber: record.referenceNumber || "",
      paymentMethod: record.paymentMethod || "Cash"
    });
    setIsEditModalOpen(true);
  };

  // Save Edit Record
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    const isUpad = editingRecord.attendanceType === "TEAM_UPAD";
    const isKharch = editingRecord.attendanceType === "OTHER_KHARCH";

    try {
      await apiFetch(`/labour/${editingRecord.id}`, {
        method: "PUT",
        body: JSON.stringify({
          locationId,
          date: editingRecord.date,
          teamName: editingRecord.teamName,
          attendanceType: editingRecord.attendanceType,
          workName: editingRecord.workName,
          unitOfMeasurement: editingRecord.unitOfMeasurement,
          quantity: editingRecord.quantity,
          rate: editingRecord.rate,
          days: editingRecord.days,
          dailyRate: editingRecord.dailyRate,
          amount: editingRecord.amount,
          upad: isUpad ? editingRecord.amount : "0",
          paymentAmount: (isUpad || isKharch) ? editingRecord.amount : "0",
          paymentMethod: editingRecord.paymentMethod,
          referenceNumber: editingRecord.referenceNumber,
          notes: editingRecord.notes
        })
      });

      showToast("Record updated successfully", "success");
      setIsEditModalOpen(false);
      setEditingRecord(null);
      triggerSync("labour");
      triggerSync("investments");
      triggerSync("reports");
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to update record", "error");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0 max-w-full">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-2 border-b border-slate-200 min-w-0">
        <div className="min-w-0">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0">
              <CalendarCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider shrink-0">
                  Category 5
                </span>
                <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight break-words min-w-0">
                  Labour Attendance &amp; Team Advances
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5 break-words">
                Record worker attendance (Day-wise &amp; TC-wise) and track Team Upad advances. (Other Kharch is recorded in Category 6).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsManageTeamOpen(true)}
            className="w-full sm:w-auto px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span>Manage Teams ({teams.length})</span>
          </button>
        </div>
      </div>

      {/* High-Level Overview Metrics Cards (Attendance - Upad = Balance) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-stretch">
        {/* 1. Total Attendance Wages */}
        <div className="bg-white h-full flex flex-col justify-between border border-amber-200/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs min-w-0">
          <div>
            <div className="flex items-center justify-between gap-2 text-slate-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 break-words min-w-0">1. Attendance Wages Earned</span>
              <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
            </div>
            <p className="text-lg sm:text-2xl font-black text-slate-900 tabular-nums whitespace-nowrap">₹{formatINR(summaries.totalAttendanceWages)}</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
            <span className="whitespace-nowrap">Day: ₹{formatINR(summaries.totalDayWiseWages)} ({summaries.totalDayWiseDays}d)</span>
            <span className="whitespace-nowrap">TC: ₹{formatINR(summaries.totalTcWiseWages)}</span>
          </div>
        </div>

        {/* 2. Total Team Upad */}
        <div className="bg-white h-full flex flex-col justify-between border border-indigo-200/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs min-w-0">
          <div>
            <div className="flex items-center justify-between gap-2 text-slate-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-800 break-words min-w-0">2. Team Upad (Advances Paid)</span>
              <ArrowDownRight className="w-4 h-4 text-indigo-600 shrink-0" />
            </div>
            <p className="text-lg sm:text-2xl font-black text-indigo-700 tabular-nums whitespace-nowrap">₹{formatINR(summaries.totalTeamUpad)}</p>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100 break-words">
            Cash &amp; online advances given to teams
          </p>
        </div>

        {/* 3. Net Outstanding Wages (Attendance Wages - Upad) */}
        <div className="bg-slate-900 text-white h-full rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between min-w-0">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 text-amber-400 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider break-words min-w-0">Net Outstanding Balance</span>
              <Calculator className="w-4 h-4 shrink-0" />
            </div>
            <p className="text-lg sm:text-2xl font-black text-white tabular-nums whitespace-nowrap">
              ₹{formatINR(summaries.totalAttendanceWages - summaries.totalTeamUpad)}
            </p>
          </div>
          <p className="text-[11px] text-slate-300 mt-2 pt-2 border-t border-slate-800 break-words">
            Net Wages (Attendance Wages - Team Advances)
          </p>
        </div>
      </div>

      {/* Primary Category 5 Subtabs: 1. Add Attendance, 2. Team Upad */}
      <div className="bg-slate-100/80 p-1.5 rounded-2xl flex flex-col sm:flex-row gap-1.5 border border-slate-200 min-w-0">
        <button
          type="button"
          onClick={() => setActiveSubTab("add_attendance")}
          className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl font-bold text-xs sm:text-sm flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer min-w-0 ${
            activeSubTab === "add_attendance"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <CalendarCheck className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="break-words">1. Add Attendance (Day &amp; TC)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-black break-all">
            ₹{formatINR(summaries.totalAttendanceWages)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("team_upad")}
          className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl font-bold text-xs sm:text-sm flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer min-w-0 ${
            activeSubTab === "team_upad"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <ArrowDownRight className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="break-words">2. Team Upad (Advances)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-black break-all">
            ₹{formatINR(summaries.totalTeamUpad)}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. SUBTAB: ADD ATTENDANCE (DAY WISE & TC WISE - NO SELECT LABOUR FIELD) */}
      {/* ========================================================================= */}
      {activeSubTab === "add_attendance" && (
        <div className="space-y-6 min-w-0">
          {/* Day Wise vs TC Wise Mode Toggle */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 min-w-0">
              <div className="min-w-0">
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Select Attendance Mode</span>
                </h3>
                <p className="text-xs text-slate-500 break-words">
                  Select Team and record attendance by Days or Task/Contract Quantity (TC).
                </p>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setAttendanceMode("day_wise")}
                  className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                    attendanceMode === "day_wise"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Day Wise Attendance
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceMode("tc_wise")}
                  className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                    attendanceMode === "tc_wise"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  TC Wise Attendance
                </button>
              </div>
            </div>

            {/* A. Day Wise Attendance Form */}
            {attendanceMode === "day_wise" && (
              <form onSubmit={handleDaySubmit} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* Date */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Date (DD-MM-YYYY) *</label>
                    <DateInput
                      required
                      value={dayForm.date}
                      onChange={e => setDayForm({ ...dayForm, date: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>

                  {/* Team Name Dropdown / Input with Quick Select & Manage Teams */}
                  <div className="sm:col-span-1 lg:col-span-1">
                    <TeamSelectInput
                      value={dayForm.teamName}
                      onChange={(name) => setDayForm({ ...dayForm, teamName: name })}
                      availableTeams={availableTeams}
                      onOpenManageTeams={() => {
                        setManageTeamTarget("day");
                        setIsManageTeamOpen(true);
                      }}
                      label="Select Team *"
                      themeColor="amber"
                      placeholder="Select or enter Team..."
                    />
                  </div>

                  {/* Attendance Type / Days */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Attendance Type</label>
                    <select
                      value={dayForm.attendanceType}
                      onChange={e => setDayForm({ ...dayForm, attendanceType: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    >
                      <option value="Full Day">Full Day (1.0)</option>
                      <option value="Half Day">Half Day (0.5)</option>
                      <option value="Custom">Custom Days (Team Total)</option>
                    </select>
                  </div>

                  {/* Custom Days if selected */}
                  {dayForm.attendanceType === "Custom" ? (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Total Days Count *</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        required
                        placeholder="e.g. 5.5 worker-days"
                        value={dayForm.customDays}
                        onChange={e => setDayForm({ ...dayForm, customDays: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Daily Rate (₹) *</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        required
                        placeholder="e.g. 700"
                        value={dayForm.dailyRate}
                        onChange={e => setDayForm({ ...dayForm, dailyRate: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
                  )}

                  {/* Calculated Gross Wages & Submit */}
                  {dayForm.attendanceType === "Custom" ? (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Rate per Day (₹) *</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        required
                        placeholder="e.g. 600"
                        value={dayForm.dailyRate}
                        onChange={e => setDayForm({ ...dayForm, dailyRate: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Calculated Total (₹)</label>
                      <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-black text-amber-900 break-all">
                        ₹{(() => {
                          const days = dayForm.attendanceType === "Half Day" ? 0.5 : 1;
                          const rate = parseFloat(dayForm.dailyRate) || 0;
                          return formatINR(days * rate);
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <input
                    type="text"
                    placeholder="Work description / notes (optional)..."
                    value={dayForm.notes}
                    onChange={e => setDayForm({ ...dayForm, notes: e.target.value })}
                    className="w-full sm:flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />

                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Save Day Attendance
                  </button>
                </div>
              </form>
            )}

            {/* B. TC Wise Attendance Form */}
            {attendanceMode === "tc_wise" && (
              <form onSubmit={handleTcSubmit} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                  {/* Date */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Date (DD-MM-YYYY) *</label>
                    <DateInput
                      required
                      value={tcForm.date}
                      onChange={e => setTcForm({ ...tcForm, date: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>

                  {/* Team Name */}
                  <div className="sm:col-span-1 lg:col-span-1">
                    <TeamSelectInput
                      value={tcForm.teamName}
                      onChange={(name) => setTcForm({ ...tcForm, teamName: name })}
                      availableTeams={availableTeams}
                      onOpenManageTeams={() => {
                        setManageTeamTarget("tc");
                        setIsManageTeamOpen(true);
                      }}
                      label="Select Team *"
                      themeColor="amber"
                      placeholder="Select or enter Team..."
                    />
                  </div>

                  {/* Work Name / TC Task */}
                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Work / TC Task Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Masonry, Brickwork, Plaster, Slab Casting..."
                      value={tcForm.workName}
                      onChange={e => setTcForm({ ...tcForm, workName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>

                  {/* Unit of Measurement */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Unit</label>
                    <select
                      value={tcForm.unitOfMeasurement}
                      onChange={e => setTcForm({ ...tcForm, unitOfMeasurement: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    >
                      {COMMON_UNITS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Quantity *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="e.g. 500"
                      value={tcForm.quantity}
                      onChange={e => setTcForm({ ...tcForm, quantity: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Rate per Unit */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Rate per {tcForm.unitOfMeasurement} (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="e.g. 35"
                      value={tcForm.rate}
                      onChange={e => setTcForm({ ...tcForm, rate: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>

                  {/* Live Total Calculation */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Calculated Total Wages (₹)</label>
                    <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-black text-amber-900 break-all">
                      ₹{formatINR((parseFloat(tcForm.quantity) || 0) * (parseFloat(tcForm.rate) || 0))}
                    </div>
                  </div>

                  {/* Notes & Submit */}
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Save TC Wise Attendance
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SUBTAB: TEAM UPAD (ADVANCES GIVEN TO TEAMS) */}
      {/* ========================================================================= */}
      {activeSubTab === "team_upad" && (
        <div className="space-y-6 min-w-0">
          <div className="bg-white border border-indigo-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs min-w-0">
            <div className="pb-3 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <h3 className="font-black text-indigo-900 text-sm flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="break-words">Record Team Upad (Advance Payment)</span>
                </h3>
                <p className="text-xs text-indigo-600 break-words">
                  Track advance money issued to Teams for worker payouts, food/ration, or weekly advances.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200 break-all">
                Total Upad: ₹{formatINR(summaries.totalTeamUpad)}
              </span>
            </div>

            <form onSubmit={handleUpadSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Date */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Date (DD-MM-YYYY) *</label>
                  <DateInput
                    required
                    value={upadForm.date}
                    onChange={e => setUpadForm({ ...upadForm, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                {/* Team Name */}
                <div className="sm:col-span-1 lg:col-span-1">
                  <TeamSelectInput
                    value={upadForm.teamName}
                    onChange={(name) => setUpadForm({ ...upadForm, teamName: name })}
                    availableTeams={availableTeams}
                    onOpenManageTeams={() => {
                      setManageTeamTarget("upad");
                      setIsManageTeamOpen(true);
                    }}
                    label="Select Team *"
                    themeColor="indigo"
                    placeholder="Select or enter Team..."
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Upad Amount (₹) *</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    placeholder="e.g. 5000"
                    value={upadForm.amount}
                    onChange={e => setUpadForm({ ...upadForm, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-indigo-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Payment Mode</label>
                  <select
                    value={upadForm.paymentMethod}
                    onChange={e => setUpadForm({ ...upadForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Online / UPI">Online / UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Ref / Receipt / Trans ID</label>
                  <input
                    type="text"
                    placeholder="e.g. UPI-984729"
                    value={upadForm.referenceNumber}
                    onChange={e => setUpadForm({ ...upadForm, referenceNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div className="sm:col-span-2 flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                  <div className="flex-1 min-w-0">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Purpose / Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Weekly advance, Festival food advance..."
                      value={upadForm.notes}
                      onChange={e => setUpadForm({ ...upadForm, notes: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Record Team Upad
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SUBTAB: OTHER KHARCH (SITE & LABOUR SUNDRY EXPENSES) */}
      {/* ========================================================================= */}
      {activeSubTab === "other_kharch" && (
        <div className="space-y-6 min-w-0">
          <div className="bg-white border border-rose-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs min-w-0">
            <div className="pb-3 border-b border-rose-100 flex flex-wrap items-center justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <h3 className="font-black text-rose-900 text-sm flex items-center gap-2">
                  <Coffee className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="break-words">Record Other Kharch (Site Miscellaneous Expenses)</span>
                </h3>
                <p className="text-xs text-rose-600 break-words">
                  Record Tea, Snacks, Bhattha, Tools repairs, Medical aid, and miscellaneous site expenses.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 break-all">
                Total Other Kharch: ₹{formatINR(summaries.totalOtherKharch)}
              </span>
            </div>

            <form onSubmit={handleKharchSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Date */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Date (DD-MM-YYYY) *</label>
                  <DateInput
                    required
                    value={kharchForm.date}
                    onChange={e => setKharchForm({ ...kharchForm, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  />
                </div>

                {/* Team / Beneficiary */}
                <div className="sm:col-span-1 lg:col-span-1">
                  <TeamSelectInput
                    value={kharchForm.teamName}
                    onChange={(name) => setKharchForm({ ...kharchForm, teamName: name })}
                    availableTeams={availableTeams}
                    onOpenManageTeams={() => {
                      setManageTeamTarget("kharch");
                      setIsManageTeamOpen(true);
                    }}
                    label="Team / Spent On"
                    themeColor="rose"
                    placeholder="e.g. Site General or Team Name"
                    allowGeneral={true}
                    required={false}
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Expense Type *</label>
                  <select
                    value={kharchForm.expenseCategory}
                    onChange={e => setKharchForm({ ...kharchForm, expenseCategory: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  >
                    {EXPENSE_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    placeholder="e.g. 450"
                    value={kharchForm.amount}
                    onChange={e => setKharchForm({ ...kharchForm, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-rose-900 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Payment Mode</label>
                  <select
                    value={kharchForm.paymentMethod}
                    onChange={e => setKharchForm({ ...kharchForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Online / UPI">Online / UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Bill / Voucher No.</label>
                  <input
                    type="text"
                    placeholder="e.g. Bill #104"
                    value={kharchForm.referenceNumber}
                    onChange={e => setKharchForm({ ...kharchForm, referenceNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  />
                </div>

                <div className="sm:col-span-2 flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                  <div className="flex-1 min-w-0">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Details / Items</label>
                    <input
                      type="text"
                      placeholder="e.g. Morning tea and breakfast for 12 masons..."
                      value={kharchForm.notes}
                      onChange={e => setKharchForm({ ...kharchForm, notes: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Record Kharch
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RECORDS LEDGER TABLE FOR THE ACTIVE SUBTAB */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-w-0">
        {/* Table Filter Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between min-w-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2 min-w-0">
              <CalendarCheck className="w-4 h-4 text-slate-700 shrink-0" />
              <span className="break-words">
                {activeSubTab === "add_attendance" && "Attendance History (Day & TC Wise)"}
                {activeSubTab === "team_upad" && "Team Upad & Advances Ledger"}
                {activeSubTab === "other_kharch" && "Other Kharch & Expenses Register"}
              </span>
            </h4>
            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold shrink-0">
              {currentTabRecords.length} records
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto min-w-0">
            {/* Team Filter */}
            <select
              value={teamFilter}
              onChange={e => setTeamFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden"
            >
              <option value="ALL">All Teams</option>
              {availableTeams.map((t, idx) => (
                <option key={idx} value={t}>{t}</option>
              ))}
            </select>

            {/* Date Filter */}
            <div className="w-full sm:w-36">
              <DateInput
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                placeholder="DD-MM-YYYY"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden"
              />
            </div>
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter("")}
                className="text-[11px] text-slate-400 hover:text-slate-700 font-bold"
              >
                Clear
              </button>
            )}

            {/* Search Input */}
            <div className="relative w-full sm:w-44">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Team / Spent On</th>
                <th className="py-3 px-4">
                  {activeSubTab === "add_attendance" && "Attendance Type & Work"}
                  {activeSubTab === "team_upad" && "Payment Mode & Ref"}
                  {activeSubTab === "other_kharch" && "Kharch Category"}
                </th>
                <th className="py-3 px-4">
                  {activeSubTab === "add_attendance" && "Quantity / Days & Rate"}
                  {activeSubTab === "team_upad" && "Purpose / Notes"}
                  {activeSubTab === "other_kharch" && "Payment Mode & Ref"}
                </th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {currentTabRecords.map((r, idx) => {
                const attUpper = String(r.attendanceType || "").toUpperCase();
                const isUpad = attUpper.includes("UPAD") || attUpper === "TEAM_UPAD";
                const isKharch = attUpper.includes("KHARCH") || attUpper === "OTHER_KHARCH" || attUpper === "EXPENSE";
                const isWork = attUpper.includes("WORK") || attUpper.includes("TC") || attUpper === "TC_WISE";
                const amount = getRecordAmount(r);

                return (
                  <tr key={r.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    {/* Date */}
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {formatDate(r.date)}
                    </td>

                    {/* Team */}
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="break-words">{r.labourTeam || r.teamName || r.labourName || "General Team"}</span>
                      </div>
                      {r.notes && (
                        <p className="text-[11px] text-slate-400 font-normal break-words max-w-xs mt-0.5">
                          {r.notes}
                        </p>
                      )}
                    </td>

                    {/* Column 3: Type/Category */}
                    <td className="py-3 px-4">
                      {activeSubTab === "add_attendance" && (
                        <div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            isWork ? "bg-purple-100 text-purple-800" : "bg-amber-100 text-amber-800"
                          }`}>
                            {isWork ? "TC WISE WORK" : "DAY WISE"}
                          </span>
                          {isWork && r.workType && (
                            <div className="font-bold text-slate-800 text-[11px] mt-0.5 break-words">{r.workType}</div>
                          )}
                        </div>
                      )}

                      {activeSubTab === "team_upad" && (
                        <div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-800">
                            {r.paymentMethod || "Cash"}
                          </span>
                          {r.referenceNumber && (
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5 break-words">
                              Ref: {r.referenceNumber}
                            </div>
                          )}
                        </div>
                      )}

                      {activeSubTab === "other_kharch" && (
                        <div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800">
                            {r.workType || r.expenseCategory || "Site Kharch"}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Column 4: Details / Breakdown */}
                    <td className="py-3 px-4 text-slate-600">
                      {activeSubTab === "add_attendance" && (
                        <div>
                          {isWork ? (
                            <span>{formatINR(r.tcQuantity || r.quantity || 0)} {r.unitOfMeasurement || "Nos"} @ ₹{formatINR(r.tcRate || r.rate || 0)}</span>
                          ) : (
                            <span>{r.days || 1} Days @ ₹{formatINR(r.dailyRate || 0)}/day</span>
                          )}
                        </div>
                      )}

                      {activeSubTab === "team_upad" && (
                        <span className="text-slate-600 break-words">{r.notes || "Team advance"}</span>
                      )}

                      {activeSubTab === "other_kharch" && (
                        <div>
                          <span className="font-semibold text-slate-700">{r.paymentMethod || "Cash"}</span>
                          {r.referenceNumber && <span className="text-slate-400 ml-1.5 font-mono">({r.referenceNumber})</span>}
                        </div>
                      )}
                    </td>

                    {/* Column 5: Amount */}
                    <td className="py-3 px-4 text-right">
                      <span className={`text-sm font-black ${
                        isUpad ? "text-indigo-700" : isKharch ? "text-rose-700" : "text-amber-800"
                      }`}>
                        ₹{formatINR(amount)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditClick(r)}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(r.id)}
                          className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {currentTabRecords.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <CalendarCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-bold text-xs">No records found for this section.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Use the form above to add an entry.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Team Management Modal */}
      <ManageTeamsModal
        isOpen={isManageTeamOpen}
        onClose={() => {
          setIsManageTeamOpen(false);
          setManageTeamTarget(null);
          loadData(true);
        }}
        locationId={locationId}
        onSelectTeam={(team) => {
          if (manageTeamTarget === "day") {
            setDayForm((prev) => ({ ...prev, teamName: team.name }));
          } else if (manageTeamTarget === "tc") {
            setTcForm((prev) => ({ ...prev, teamName: team.name }));
          } else if (manageTeamTarget === "upad") {
            setUpadForm((prev) => ({ ...prev, teamName: team.name }));
          } else if (manageTeamTarget === "kharch") {
            setKharchForm((prev) => ({ ...prev, teamName: team.name }));
          } else if (manageTeamTarget === "edit") {
            setEditingRecord((prev: any) => (prev ? { ...prev, teamName: team.name } : null));
          }
          setIsManageTeamOpen(false);
          setManageTeamTarget(null);
          loadData(true);
        }}
      />

      {/* Edit Record Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingRecord(null);
        }}
        title="Edit Labour / Expense Record"
        maxWidth="xl"
      >
        {editingRecord && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date (DD-MM-YYYY)</label>
                <DateInput
                  required
                  value={editingRecord.date}
                  onChange={e => setEditingRecord({ ...editingRecord, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>

              <div>
                <TeamSelectInput
                  value={editingRecord.teamName || ""}
                  onChange={(name) => setEditingRecord({ ...editingRecord, teamName: name })}
                  availableTeams={availableTeams}
                  onOpenManageTeams={() => {
                    setManageTeamTarget("edit");
                    setIsManageTeamOpen(true);
                  }}
                  label="Team Name *"
                  themeColor="amber"
                  allowGeneral={editingRecord.attendanceType === "OTHER_KHARCH"}
                />
              </div>
            </div>

            {/* Attendance fields */}
            {editingRecord.attendanceType !== "TEAM_UPAD" && editingRecord.attendanceType !== "OTHER_KHARCH" && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Type</label>
                    <select
                      value={editingRecord.attendanceType}
                      onChange={e => setEditingRecord({ ...editingRecord, attendanceType: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                    >
                      <option value="DAY_WISE">Day Wise</option>
                      <option value="TC_WISE">TC Wise</option>
                    </select>
                  </div>

                  {editingRecord.attendanceType === "TC_WISE" ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Work / TC Task</label>
                      <input
                        type="text"
                        value={editingRecord.workName}
                        onChange={e => setEditingRecord({ ...editingRecord, workName: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Days Count</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editingRecord.days}
                        onChange={e => {
                          const newDays = e.target.value;
                          const calcAmt = Math.round((parseFloat(newDays) || 0) * (parseFloat(editingRecord.dailyRate) || 0) * 100) / 100;
                          setEditingRecord({ ...editingRecord, days: newDays, amount: String(calcAmt) });
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                      />
                    </div>
                  )}
                </div>

                {editingRecord.attendanceType === "TC_WISE" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
                      <select
                        value={editingRecord.unitOfMeasurement}
                        onChange={e => setEditingRecord({ ...editingRecord, unitOfMeasurement: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                      >
                        {COMMON_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Quantity</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingRecord.quantity}
                        onChange={e => {
                          const newQty = e.target.value;
                          const calcAmt = Math.round((parseFloat(newQty) || 0) * (parseFloat(editingRecord.rate) || 0) * 100) / 100;
                          setEditingRecord({ ...editingRecord, quantity: newQty, amount: String(calcAmt) });
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Rate (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingRecord.rate}
                        onChange={e => {
                          const newRate = e.target.value;
                          const calcAmt = Math.round((parseFloat(editingRecord.quantity) || 0) * (parseFloat(newRate) || 0) * 100) / 100;
                          setEditingRecord({ ...editingRecord, rate: newRate, amount: String(calcAmt) });
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Daily Rate (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingRecord.dailyRate}
                      onChange={e => {
                        const newDailyRate = e.target.value;
                        const calcAmt = Math.round((parseFloat(editingRecord.days) || 0) * (parseFloat(newDailyRate) || 0) * 100) / 100;
                        setEditingRecord({ ...editingRecord, dailyRate: newDailyRate, amount: String(calcAmt) });
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Total Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingRecord.amount}
                    onChange={e => {
                      const newAmt = e.target.value;
                      const numAmt = parseFloat(newAmt) || 0;
                      if (editingRecord.attendanceType === "TC_WISE") {
                        const qty = parseFloat(editingRecord.quantity) || 1;
                        const calcRate = qty > 0 ? Math.round((numAmt / qty) * 100) / 100 : 0;
                        setEditingRecord({ ...editingRecord, amount: newAmt, rate: String(calcRate) });
                      } else {
                        const days = parseFloat(editingRecord.days) || 1;
                        const calcDailyRate = days > 0 ? Math.round((numAmt / days) * 100) / 100 : 0;
                        setEditingRecord({ ...editingRecord, amount: newAmt, dailyRate: String(calcDailyRate) });
                      }
                    }}
                    className="w-full px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-black text-amber-800"
                  />
                </div>
              </div>
            )}

            {/* Upad / Kharch Amount fields */}
            {(editingRecord.attendanceType === "TEAM_UPAD" || editingRecord.attendanceType === "OTHER_KHARCH") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={editingRecord.amount}
                    onChange={e => setEditingRecord({ ...editingRecord, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={editingRecord.paymentMethod}
                    onChange={e => setEditingRecord({ ...editingRecord, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Online / UPI">Online / UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Description</label>
              <input
                type="text"
                value={editingRecord.notes}
                onChange={e => setEditingRecord({ ...editingRecord, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
