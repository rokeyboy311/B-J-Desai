import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import {
  Coffee, Plus, Pencil, Trash2, Search, Filter, IndianRupee,
  Receipt, Wrench, Shield, CheckCircle2, ChevronRight, Calculator,
  Calendar, Layers, Sparkles, Building, AlertCircle, Download, FileSpreadsheet
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { useLiveSync, triggerSync } from "../../hooks/useLiveSync";
import { useToast } from "../../contexts/ToastContext";
import { downloadExcelReport } from "../../lib/excelExport";
import { formatINR, formatDate } from "../../lib/formatters";
import { DateInput } from "../ui/DateInput";

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

const EXPENSE_SUBTITLES: Record<string, string> = {
  "Tea & Refreshments": "Beverages & refreshments",
  "Food & Bhattha": "Daily food & allowance",
  "Travel & Transport": "Site travel & transit",
  "Tools & Maintenance": "Tools & site maintenance",
  "Safety Equipment": "Safety & protective gear",
  "Medical & First Aid": "Medical & first aid",
  "Fuel & Generator": "Fuel & generator power",
  "Site Sundries & Misc": "Incidental site expenses"
};

const PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "UPI / Google Pay / PhonePe",
  "Cheque",
  "Other"
];

export default function OtherKharchTab({ locationId }: { locationId: number }) {
  const { showToast, confirmAction } = useToast();

  const [records, setRecords] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  // Add Form State
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    expenseCategory: EXPENSE_CATEGORIES[0],
    customCategory: "",
    teamName: "",
    amount: "",
    paymentMethod: "Cash",
    referenceNumber: "",
    notes: ""
  });

  // Edit Form State
  const [editForm, setEditForm] = useState({
    date: new Date().toISOString().split("T")[0],
    expenseCategory: EXPENSE_CATEGORIES[0],
    teamName: "",
    amount: "",
    paymentMethod: "Cash",
    referenceNumber: "",
    notes: ""
  });

  const loadData = async (isBackground = false) => {
    if (!isBackground && records.length === 0) setLoading(true);
    try {
      const [salariesRes, teamsRes] = await Promise.all([
        apiFetch(`/labour?locationId=${locationId}`).catch(() => []),
        apiFetch(`/master/teams?locationId=${locationId}`).catch(() => [])
      ]);

      const allRecords = Array.isArray(salariesRes) ? salariesRes : (salariesRes?.salaries || []);
      // Filter strictly for Other Kharch entries
      const kharchOnly = allRecords.filter((r: any) => {
        const type = String(r.attendanceType || "").toUpperCase();
        return type.includes("KHARCH") || type.includes("EXPENSE") || type === "OTHER_KHARCH";
      });

      setRecords(kharchOnly);
      setTeams(Array.isArray(teamsRes) ? teamsRes : (teamsRes?.teams || []));
    } catch (err) {
      console.error("Failed to load other kharch data:", err);
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

  // Aggregated Analytics
  const summary = useMemo(() => {
    const totalAmount = records.reduce((sum, r) => {
      const amt = parseFloat(String(r.paymentAmount || r.grossSalary || r.netSalary || r.amount || 0)) || 0;
      return sum + amt;
    }, 0);

    const categoryBreakdown: Record<string, number> = {};
    records.forEach(r => {
      const cat = r.workType || r.notes || "Site Misc";
      const amt = parseFloat(String(r.paymentAmount || r.grossSalary || r.netSalary || r.amount || 0)) || 0;
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + amt;
    });

    return {
      totalAmount: Math.round(totalAmount * 100) / 100,
      count: records.length,
      categoryBreakdown,
      avgPerRecord: records.length > 0 ? Math.round((totalAmount / records.length) * 100) / 100 : 0
    };
  }, [records]);

  // Filtered List
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const cat = r.workType || r.notes || "";
      const matchesCategory = categoryFilter === "ALL" || cat.toLowerCase().includes(categoryFilter.toLowerCase());
      const matchesDate = !dateFilter || r.date === dateFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (r.labourTeam || "").toLowerCase().includes(q) ||
        (r.workType || "").toLowerCase().includes(q) ||
        (r.notes || "").toLowerCase().includes(q) ||
        (r.referenceNumber || "").toLowerCase().includes(q) ||
        (r.paymentMethod || "").toLowerCase().includes(q);

      return matchesCategory && matchesDate && matchesSearch;
    });
  }, [records, categoryFilter, dateFilter, searchQuery]);

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast("Please enter a valid positive amount", "error");
      return;
    }

    const selectedCategory = form.expenseCategory === "CUSTOM" ? (form.customCategory.trim() || "Custom Expense") : form.expenseCategory;

    try {
      await apiFetch("/labour", {
        method: "POST",
        body: JSON.stringify({
          locationId,
          attendanceType: "OTHER_KHARCH",
          date: form.date,
          labourTeam: form.teamName.trim() || "Site General",
          workType: selectedCategory,
          amount: amt,
          paymentAmount: amt,
          paymentMethod: form.paymentMethod,
          referenceNumber: form.referenceNumber.trim() || null,
          notes: form.notes.trim() || `${selectedCategory} expense`
        })
      });

      triggerSync("labour");
      triggerSync("investments");
      triggerSync("reports");
      setIsAddModalOpen(false);
      setForm({
        date: new Date().toISOString().split("T")[0],
        expenseCategory: EXPENSE_CATEGORIES[0],
        customCategory: "",
        teamName: "",
        amount: "",
        paymentMethod: "Cash",
        referenceNumber: "",
        notes: ""
      });
      showToast("Other expense recorded and deducted from Investment Capital", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to save other kharch", "error");
    }
  };

  const handleOpenEdit = (rec: any) => {
    setEditingRecord(rec);
    const amt = rec.paymentAmount || rec.grossSalary || rec.netSalary || rec.amount || "0";
    setEditForm({
      date: rec.date || new Date().toISOString().split("T")[0],
      expenseCategory: rec.workType || EXPENSE_CATEGORIES[0],
      teamName: rec.labourTeam || "",
      amount: String(amt),
      paymentMethod: rec.paymentMethod || "Cash",
      referenceNumber: rec.referenceNumber || "",
      notes: rec.notes || ""
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    const amt = parseFloat(editForm.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast("Please enter a valid positive amount", "error");
      return;
    }

    try {
      await apiFetch(`/labour/${editingRecord.id}`, {
        method: "PUT",
        body: JSON.stringify({
          locationId,
          attendanceType: "OTHER_KHARCH",
          date: editForm.date,
          labourTeam: editForm.teamName.trim() || "Site General",
          workType: editForm.expenseCategory,
          amount: amt,
          paymentAmount: amt,
          paymentMethod: editForm.paymentMethod,
          referenceNumber: editForm.referenceNumber.trim() || null,
          notes: editForm.notes.trim() || `${editForm.expenseCategory} expense`
        })
      });

      triggerSync("labour");
      triggerSync("investments");
      triggerSync("reports");
      setIsEditModalOpen(false);
      setEditingRecord(null);
      showToast("Other kharch updated successfully", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to update expense", "error");
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirmAction({
      title: "Delete Other Kharch",
      message: "Are you sure you want to delete this expense record? The deducted amount will be restored to Category 2 Investment Capital.",
      confirmLabel: "Delete Expense",
      isDanger: true
    });

    if (!confirmed) return;

    try {
      await apiFetch(`/labour/${id}`, { method: "DELETE" });
      triggerSync("labour");
      triggerSync("investments");
      triggerSync("reports");
      showToast("Expense record deleted and restored in Investment Capital", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete record", "error");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0 max-w-full">
      {/* Category Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 bg-gradient-to-r from-rose-50 via-white to-orange-50/40 p-3.5 sm:p-5 rounded-2xl border border-rose-100 shadow-xs min-w-0">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="p-2.5 sm:p-3 bg-rose-600 text-white rounded-2xl shadow-sm shrink-0">
            <Coffee className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200 uppercase tracking-wider shrink-0">
                Category 6
              </span>
              <h2 className="text-base sm:text-xl font-black text-slate-900 break-words min-w-0">Other Expenses (Site Incidentals &amp; Sundries)</h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5 break-words">
              Site Operations Miscellaneous Expenses &bull; Tea, Food, Travel, Tools, Fuel &amp; Sundries
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <button
            type="button"
            onClick={() => downloadExcelReport(`/reports/export-location/${locationId}?tab=labour`, `Other_Kharch_Location_${locationId}.xlsx`)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Export (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>+ Add Other Kharch</span>
          </button>
        </div>
      </div>

      {/* Critical Explicit Financial Linkage Notice Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 sm:p-4 flex items-start gap-3 min-w-0">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed min-w-0 break-words">
          <span className="font-black text-amber-950">Direct Capital Deduction: </span>
          All recorded other site expenses (tea, refreshments, transit, tools, fuel) are automatically deducted from <strong>Investor Investment Capital</strong>.
        </div>
      </div>

      {/* 3 Metric Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-stretch">
        {/* Total Other Kharch */}
        <div className="bg-white h-full border border-rose-100 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2 text-rose-700">
            <span className="text-xs font-bold uppercase tracking-wider break-words min-w-0">Total Other Expenses</span>
            <div className="p-2 bg-rose-50 rounded-xl shrink-0">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <div className="text-lg sm:text-2xl font-black text-rose-600 tabular-nums whitespace-nowrap">
              ₹{formatINR(summary.totalAmount)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium break-words">
              Fully deducted from Investor Investment Capital
            </p>
          </div>
        </div>

        {/* Total Entries Count */}
        <div className="bg-white h-full border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2 text-slate-700">
            <span className="text-xs font-bold uppercase tracking-wider break-words min-w-0">Total Records</span>
            <div className="p-2 bg-slate-100 rounded-xl shrink-0">
              <Receipt className="w-4 h-4 text-slate-600" />
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <div className="text-lg sm:text-2xl font-black text-slate-900 tabular-nums whitespace-nowrap">
              {summary.count}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium break-words">
              Recorded site expense vouchers
            </p>
          </div>
        </div>

        {/* Average per Record */}
        <div className="bg-white h-full border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2 text-slate-700">
            <span className="text-xs font-bold uppercase tracking-wider break-words min-w-0">Average per Entry</span>
            <div className="p-2 bg-slate-100 rounded-xl shrink-0">
              <Calculator className="w-4 h-4 text-slate-600" />
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <div className="text-lg sm:text-2xl font-black text-slate-900 tabular-nums whitespace-nowrap">
              ₹{formatINR(summary.avgPerRecord)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium break-words">
              Average voucher amount
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 min-w-0">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by category, team, voucher or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="w-full sm:w-auto flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl min-w-0">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-700 focus:outline-hidden min-w-0"
            >
              <option value="ALL">All Categories ({records.length})</option>
              {EXPENSE_CATEGORIES.map((cat, idx) => (
                <option key={idx} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-36">
            <DateInput
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              placeholder="DD-MM-YYYY"
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-hidden"
            />
          </div>

          {(searchQuery || categoryFilter !== "ALL" || dateFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setCategoryFilter("ALL");
                setDateFilter("");
              }}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden min-w-0">
        <div className="p-3.5 sm:p-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Receipt className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider break-words">
              Other Kharch Entries ({filteredRecords.length})
            </span>
          </div>
          <span className="text-xs font-bold text-slate-500 break-words">
            Total Filtered: ₹{formatINR(filteredRecords.reduce((sum, r) => sum + (parseFloat(String(r.paymentAmount || r.grossSalary || r.netSalary || r.amount || 0)) || 0), 0))}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs font-bold text-slate-400">Loading expense records...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center">
            <Coffee className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">No other kharch entries found</p>
            <p className="text-xs text-slate-400 mt-1">Click "+ Add Other Kharch" to record site expenses.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Expense Category</th>
                  <th className="py-3 px-4">Team / Vendor / Person</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Ref / Voucher</th>
                  <th className="py-3 px-4">Notes / Purpose</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((rec) => {
                  const amt = parseFloat(String(rec.paymentAmount || rec.grossSalary || rec.netSalary || rec.amount || 0)) || 0;
                  const cat = rec.workType || "Site Expense";
                  const subtitle = EXPENSE_SUBTITLES[cat] || "";

                  return (
                    <tr key={rec.id} className="hover:bg-rose-50/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-700">{formatDate(rec.date)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          <div>
                            <span className="font-bold text-slate-900 break-words">{cat}</span>
                            {subtitle && <span className="block text-[10px] text-slate-400 font-medium break-words">{subtitle}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700 break-words">
                        {rec.labourTeam || "Site General"}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 font-semibold text-[11px]">
                          {rec.paymentMethod || "Cash"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 break-words">{rec.referenceNumber || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs break-words">{rec.notes || "-"}</td>
                      <td className="py-3 px-4 text-right font-black text-rose-600 text-sm">
                        ₹{formatINR(amt)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(rec)}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(rec.id)}
                            className="p-1.5 hover:bg-rose-100 text-rose-600 hover:text-rose-800 rounded-lg transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Other Expense"
        maxWidth="xl"
      >
        <form onSubmit={handleSaveAdd} className="space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900">
            <strong>Deduction Notice:</strong> This amount is automatically deducted from Category 2 Investment Capital.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Date (DD-MM-YYYY) *
              </label>
              <DateInput
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Expense Category Select */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Expense Category *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
              {EXPENSE_CATEGORIES.map((cat, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setForm({ ...form, expenseCategory: cat })}
                  className={`text-[11px] p-2 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                    form.expenseCategory === cat
                      ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  <div>{cat}</div>
                  <div className={`text-[9px] ${form.expenseCategory === cat ? "text-rose-100" : "text-slate-400"}`}>
                    {EXPENSE_SUBTITLES[cat] || ""}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, expenseCategory: "CUSTOM" })}
                className={`text-xs px-3 py-1.5 rounded-lg border font-bold cursor-pointer ${
                  form.expenseCategory === "CUSTOM"
                    ? "bg-rose-600 text-white border-rose-600"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                Custom Category...
              </button>
              {form.expenseCategory === "CUSTOM" && (
                <input
                  type="text"
                  placeholder="Enter custom expense type..."
                  value={form.customCategory}
                  onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:outline-hidden"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Team / Vendor / Recipient
              </label>
              <input
                type="text"
                list="teams-datalist"
                placeholder="e.g. Site General, Ramesh Tea Stall"
                value={form.teamName}
                onChange={(e) => setForm({ ...form, teamName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
              <datalist id="teams-datalist">
                <option value="Site General" />
                {teams.map((t, idx) => (
                  <option key={idx} value={t.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Payment Method
              </label>
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              >
                {PAYMENT_METHODS.map((m, idx) => (
                  <option key={idx} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Voucher / Reference No.
              </label>
              <input
                type="text"
                placeholder="e.g. VCH-001, Bill #123"
                value={form.referenceNumber}
                onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Notes / Purpose
              </label>
              <input
                type="text"
                placeholder="e.g. Afternoon tea for 15 workers"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm"
            >
              Save Other Kharch
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Other Kharch"
        maxWidth="xl"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Date (DD-MM-YYYY) *
              </label>
              <DateInput
                required
                value={editForm.date}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Expense Category
            </label>
            <select
              value={editForm.expenseCategory}
              onChange={(e) => setEditForm({ ...editForm, expenseCategory: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-hidden"
            >
              {editForm.expenseCategory && !EXPENSE_CATEGORIES.includes(editForm.expenseCategory) && (
                <option value={editForm.expenseCategory}>{editForm.expenseCategory}</option>
              )}
              {EXPENSE_CATEGORIES.map((c, idx) => (
                <option key={idx} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Team / Vendor
              </label>
              <input
                type="text"
                value={editForm.teamName}
                onChange={(e) => setEditForm({ ...editForm, teamName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Payment Method
              </label>
              <select
                value={editForm.paymentMethod}
                onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-hidden"
              >
                {PAYMENT_METHODS.map((m, idx) => (
                  <option key={idx} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Reference No.
              </label>
              <input
                type="text"
                value={editForm.referenceNumber}
                onChange={(e) => setEditForm({ ...editForm, referenceNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Notes
              </label>
              <input
                type="text"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm"
            >
              Update Kharch
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
