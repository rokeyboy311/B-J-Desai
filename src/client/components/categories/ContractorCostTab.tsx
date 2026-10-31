import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import {
  HardHat, Plus, Trash2, Pencil, Search, Calendar, FileText,
  Banknote, ArrowDownLeft, ArrowUpRight, Scale, CheckCircle2,
  AlertTriangle, DollarSign, Download, FileSpreadsheet, RefreshCw,
  Clock, ShieldCheck, ChevronRight, Layers, Tag, Landmark
} from "lucide-react";
import { useLiveSync, triggerSync } from "../../hooks/useLiveSync";
import { useToast } from "../../contexts/ToastContext";
import { downloadExcelReport } from "../../lib/excelExport";
import { formatINR, formatDate } from "../../lib/formatters";
import { DateInput } from "../ui/DateInput";

interface ContractorCost {
  id: number;
  locationId: number;
  date: string;
  contractorName: string;
  workDescription: string | null;
  amount: string;
  deductionAmount: string;
  netAmount: string;
  paymentStatus: "PAID" | "PENDING" | "PARTIAL";
  paymentMethod: string | null;
  referenceNumber: string | null;
  notes: string | null;
  createdAt: string;
}

interface ReconciliationData {
  summary: {
    totalSiteSupplies: number;
    totalLabourCost: number;
    expectedCost: number;
    recordedCost: number;
    variance: number;
    reconciliationStatus: "MATCHED" | "SURPLUS" | "DEFICIT";
    contractorCostCount: number;
    contractorCount?: number;
    siteSupplyCount: number;
    labourCount: number;
    investmentStatus?: "MATCHED" | "SURPLUS" | "DEFICIT";
    totalInvestmentCapital?: number;
    totalCustomerMaterialSupply?: number;
    totalThreeSiteExpenses?: number;
  };
  contractorCosts: ContractorCost[];
  siteSupplies: any[];
  labourSalaries: any[];
}

export default function ContractorCostTab({ locationId }: { locationId: number }) {
  const { showToast, confirmAction } = useToast();
  
  const [activeSubTab, setActiveSubTab] = useState<"records" | "reconciliation">("records");
  const [loading, setLoading] = useState(true);
  const [costs, setCosts] = useState<ContractorCost[]>([]);
  const [reconciliation, setReconciliation] = useState<ReconciliationData | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    contractorName: "",
    workDescription: "",
    amount: "",
    deductionAmount: "0",
    paymentStatus: "PAID" as "PAID" | "PENDING" | "PARTIAL",
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    notes: ""
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const loadData = async (isBackground = false) => {
    if (!isBackground && costs.length === 0) setLoading(true);
    try {
      const [costsRes, reconRes] = await Promise.all([
        apiFetch(`/contractor-costs?locationId=${locationId}`).catch(() => []),
        apiFetch(`/contractor-costs/reconciliation?locationId=${locationId}`).catch(() => null)
      ]);
      setCosts(Array.isArray(costsRes) ? costsRes : []);
      setReconciliation(reconRes);
    } catch (err) {
      console.error("Failed to load contractor costs", err);
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

  const netAmountCalc = useMemo(() => {
    const gross = parseFloat(formData.amount || "0") || 0;
    const ded = parseFloat(formData.deductionAmount || "0") || 0;
    return Math.max(0, Math.round((gross - ded) * 100) / 100);
  }, [formData.amount, formData.deductionAmount]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      contractorName: "",
      workDescription: "",
      amount: "",
      deductionAmount: "0",
      paymentStatus: "PAID",
      paymentMethod: "Bank Transfer",
      referenceNumber: "",
      notes: ""
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cost: ContractorCost) => {
    setEditingId(cost.id);
    setFormData({
      date: cost.date ? cost.date.split("T")[0] : new Date().toISOString().split("T")[0],
      contractorName: cost.contractorName,
      workDescription: cost.workDescription || "",
      amount: cost.amount,
      deductionAmount: cost.deductionAmount || "0",
      paymentStatus: cost.paymentStatus,
      paymentMethod: cost.paymentMethod || "Bank Transfer",
      referenceNumber: cost.referenceNumber || "",
      notes: cost.notes || ""
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contractorName.trim()) {
      showToast("Contractor Name is required", "error");
      return;
    }
    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast("Please enter a valid positive gross amount", "error");
      return;
    }

    try {
      if (editingId) {
        await apiFetch(`/contractor-costs/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(formData)
        });
        showToast("Contractor cost record updated", "success");
      } else {
        await apiFetch("/contractor-costs", {
          method: "POST",
          body: JSON.stringify({ ...formData, locationId })
        });
        showToast("Contractor cost record created", "success");
      }
      setIsModalOpen(false);
      triggerSync();
      loadData(false);
    } catch (err: any) {
      console.error("Failed to save contractor cost", err);
      showToast(err.message || "Failed to save record", "error");
    }
  };

  const handleDelete = async (id: number, contractorName: string) => {
    const confirmed = await confirmAction({
      title: "Delete Contractor Cost Record",
      message: `Are you sure you want to delete the cost record for '${contractorName}'? This action is irreversible.`,
      confirmLabel: "Verify & Delete",
      isDanger: true,
      requirePassword: true
    });

    if (!confirmed) return;

    try {
      await apiFetch(`/contractor-costs/${id}`, { method: "DELETE" });
      showToast("Contractor cost record deleted", "success");
      triggerSync();
      loadData(false);
    } catch (err: any) {
      console.error("Failed to delete contractor cost", err);
      showToast(err.message || "Failed to delete record", "error");
    }
  };

  const filteredCosts = useMemo(() => {
    return costs.filter(c => {
      const matchesSearch = !searchTerm || 
        c.contractorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.workDescription && c.workDescription.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.referenceNumber && c.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === "ALL" || c.paymentStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [costs, searchTerm, statusFilter]);

  const totalGross = useMemo(() => costs.reduce((sum, c) => sum + parseFloat(c.amount || "0"), 0), [costs]);
  const totalNet = useMemo(() => costs.reduce((sum, c) => sum + parseFloat(c.netAmount || "0"), 0), [costs]);
  const totalPaid = useMemo(() => costs.filter(c => c.paymentStatus === "PAID").reduce((sum, c) => sum + parseFloat(c.netAmount || "0"), 0), [costs]);

  const handleExportExcel = async () => {
    try {
      await downloadExcelReport(
        `/contractor-costs/export?locationId=${locationId}`,
        `Contractor_Costs_Location_${locationId}.xlsx`
      );
      showToast("Contractor costs Excel downloaded", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to download contractor costs", "error");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0 max-w-full">
      {/* Category Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 border-b border-slate-100 pb-4 min-w-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
              Category 5
            </span>
            <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight break-words min-w-0">Contractor Cost &amp; Reconciliation Matrix</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 break-words">
            Reconcile Site Supply + Labour Attendance total against recorded Contractor Invoices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Export Excel</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Add Contractor Cost</span>
          </button>
        </div>
      </div>

      {/* Prominent Operational Reconciliation Equation Banner */}
      <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all min-w-0 ${
        reconciliation?.summary.reconciliationStatus === "MATCHED"
          ? "bg-emerald-50/80 border-emerald-200"
          : reconciliation?.summary.reconciliationStatus === "SURPLUS"
          ? "bg-blue-50/80 border-blue-200"
          : "bg-amber-50/80 border-amber-200"
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Scale className="w-4 h-4 text-purple-700 shrink-0" />
              <span className="text-xs font-black text-slate-900 uppercase tracking-wide break-words">
                Reconciliation Equation
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                reconciliation?.summary.reconciliationStatus === "MATCHED"
                  ? "bg-emerald-200 text-emerald-900"
                  : reconciliation?.summary.reconciliationStatus === "SURPLUS"
                  ? "bg-blue-200 text-blue-900"
                  : "bg-amber-200 text-amber-900"
              }`}>
                {reconciliation?.summary.reconciliationStatus === "MATCHED"
                  ? "✓ 100% PERFECT MATCH"
                  : reconciliation?.summary.reconciliationStatus === "SURPLUS"
                  ? "+ SURPLUS RECORDED"
                  : "⚠ DEFICIT (ENTRY PENDING)"}
              </span>
            </div>
            <div className="text-xs font-bold text-slate-700 flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 min-w-0">
              <span className="px-2 py-1 bg-white rounded-lg border border-slate-200 shadow-xs break-words">
                Cat 3 Site Supply: <strong className="text-teal-700">₹{formatINR(reconciliation?.summary.totalSiteSupplies || 0)}</strong>
              </span>
              <span>+</span>
              <span className="px-2 py-1 bg-white rounded-lg border border-slate-200 shadow-xs break-words">
                Cat 4 Labour Attendance: <strong className="text-rose-700">₹{formatINR(reconciliation?.summary.totalLabourCost || 0)}</strong>
              </span>
              <span>=</span>
              <span className="px-2.5 py-1 bg-amber-100/80 rounded-lg border border-amber-300 text-amber-950 font-black shadow-xs break-words">
                Expected: ₹{formatINR(reconciliation?.summary.expectedCost || 0)}
              </span>
              <span>&harr;</span>
              <span className="px-2.5 py-1 bg-purple-100/80 rounded-lg border border-purple-300 text-purple-950 font-black shadow-xs break-words">
                Recorded: ₹{formatINR(reconciliation?.summary.recordedCost || 0)}
              </span>
            </div>
          </div>

          <div className="md:text-right shrink-0 min-w-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200/60">
            <span className="text-[11px] text-slate-500 block font-medium">Difference / Variance:</span>
            <span className={`text-sm sm:text-base font-black break-all ${
              reconciliation?.summary.reconciliationStatus === "MATCHED"
                ? "text-emerald-700"
                : reconciliation?.summary.reconciliationStatus === "SURPLUS"
                ? "text-blue-700"
                : "text-amber-700"
            }`}>
              {(reconciliation?.summary.variance || 0) >= 0 ? "+" : ""}
              ₹{formatINR(reconciliation?.summary.variance || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider break-words min-w-0">Total Recorded Cost</span>
            <HardHat className="w-4 h-4 text-purple-600 shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 mt-2 tabular-nums break-all sm:break-words">
            ₹{formatINR(totalNet)}
          </div>
          <p className="text-[11px] text-purple-600 mt-1 font-medium">{costs.length} records</p>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider break-words min-w-0">Paid Amount</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-emerald-900 mt-2 tabular-nums break-all sm:break-words">
            ₹{formatINR(totalPaid)}
          </div>
          <p className="text-[11px] text-emerald-600 mt-1 font-medium">Fully settled records</p>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/70 border border-amber-100 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider break-words min-w-0">Expected Operational Cost</span>
            <Scale className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-amber-900 mt-2 tabular-nums break-all sm:break-words">
            ₹{formatINR(reconciliation?.summary.expectedCost || 0)}
          </div>
          <p className="text-[11px] text-amber-600 mt-1 font-medium">Site Supply + Labour Salaries</p>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-blue-50/70 border border-blue-100 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider break-words min-w-0">Reconciliation Status</span>
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 mt-2 flex items-center gap-2 break-all sm:break-words">
            {reconciliation?.summary.reconciliationStatus === "MATCHED" ? (
              <span className="text-emerald-700">Balanced (₹0)</span>
            ) : reconciliation?.summary.reconciliationStatus === "SURPLUS" ? (
              <span className="text-blue-700">+₹{formatINR(Math.abs(reconciliation?.summary.variance || 0))} (Surplus)</span>
            ) : (
              <span className="text-rose-700">-₹{formatINR(Math.abs(reconciliation?.summary.variance || 0))} (Deficit)</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Recorded vs Expected</p>
        </div>
      </div>

      {/* Subtabs */}
      <div className="flex flex-wrap border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveSubTab("records")}
          className={`px-3 sm:px-4 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeSubTab === "records"
              ? "border-purple-600 text-purple-700 bg-purple-50/40"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Contractor Cost Ledger ({costs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("reconciliation")}
          className={`px-3 sm:px-4 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "reconciliation"
              ? "border-purple-600 text-purple-700 bg-purple-50/40"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Scale className="w-3.5 h-3.5 shrink-0" />
          <span>Audit &amp; Reconciliation Matrix</span>
        </button>
      </div>

      {activeSubTab === "records" && (
        <div className="space-y-4 min-w-0">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search contractor, work description, reference..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="PAID">PAID</option>
              <option value="PENDING">PENDING</option>
              <option value="PARTIAL">PARTIAL</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs min-w-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Contractor</th>
                    <th className="py-3 px-4">Work / Description</th>
                    <th className="py-3 px-4 text-right">Gross Amount</th>
                    <th className="py-3 px-4 text-right">Deduction</th>
                    <th className="py-3 px-4 text-right">Net Cost</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Payment Info</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">Loading contractor costs...</td>
                    </tr>
                  ) : filteredCosts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <HardHat className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold">No contractor cost records found</p>
                        <p className="text-[11px] text-slate-400 mt-1">Click 'Add Contractor Cost' to record a new contractor bill</p>
                      </td>
                    </tr>
                  ) : (
                    filteredCosts.map(cost => (
                      <tr key={cost.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-700">
                          {formatDate(cost.date)}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 break-words">
                          {cost.contractorName}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-[200px] break-words" title={cost.workDescription || ""}>
                          {cost.workDescription || "-"}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-600">
                          ₹{formatINR(cost.amount || "0")}
                        </td>
                        <td className="py-3 px-4 text-right text-rose-600 font-medium">
                          {parseFloat(cost.deductionAmount || "0") > 0 ? `₹${formatINR(cost.deductionAmount)}` : "-"}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-purple-900">
                          ₹{formatINR(cost.netAmount || "0")}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            cost.paymentStatus === "PAID"
                              ? "bg-emerald-100 text-emerald-800"
                              : cost.paymentStatus === "PARTIAL"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}>
                            {cost.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          <span className="font-medium text-slate-700">{cost.paymentMethod || "Bank"}</span>
                          {cost.referenceNumber && (
                            <span className="text-[10px] text-slate-400 block break-words">Ref: {cost.referenceNumber}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(cost)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-purple-600 transition-colors cursor-pointer"
                              title="Edit record"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(cost.id, cost.contractorName)}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Delete record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "reconciliation" && reconciliation && (
        <div className="space-y-6 min-w-0">
          {/* Complete 5-Tier Financial Flow Context */}
          <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 rounded-2xl sm:rounded-3xl text-white shadow-lg space-y-5 sm:space-y-6 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-white/10 min-w-0">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 bg-purple-900/50 px-2.5 py-1 rounded-md border border-purple-500/30 inline-block">
                  Full Chain Reconciliation
                </span>
                <h3 className="text-sm sm:text-lg font-black text-white mt-1.5 flex items-center gap-2 break-words">
                  <Scale className="w-5 h-5 text-purple-400 shrink-0" />
                  <span className="break-words min-w-0">Admin &rarr; Investor &rarr; Investment &rarr; (Material+Site+Labour) &rarr; Contractor Cost</span>
                </h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-black self-start sm:self-auto shrink-0 ${
                reconciliation.summary.reconciliationStatus === "MATCHED" && reconciliation.summary.investmentStatus === "MATCHED"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-purple-500/20 text-purple-200 border border-purple-500/30"
              }`}>
                {reconciliation.summary.reconciliationStatus === "MATCHED" && reconciliation.summary.investmentStatus === "MATCHED"
                  ? "✓ Both Equations 100% Balanced"
                  : "Chain In Progress"}
              </span>
            </div>

            {/* Upstream Rule 1: Investment Capital vs 3 Site Expenses */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 sm:p-4 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 min-w-0">
                  <Landmark className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="break-words">Upstream Rule 1: Investor Investment Capital vs 3 Site Expenses</span>
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  reconciliation.summary.investmentStatus === "MATCHED"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : reconciliation.summary.investmentStatus === "SURPLUS"
                    ? "bg-blue-500/20 text-blue-300"
                    : "bg-rose-500/20 text-rose-300"
                }`}>
                  {reconciliation.summary.investmentStatus === "MATCHED"
                    ? "✓ MATCHED"
                    : reconciliation.summary.investmentStatus === "SURPLUS"
                    ? "+ SURPLUS UNSPENT"
                    : "⚠ CAPITAL SHORTFALL"}
                </span>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                <div className="min-w-0">
                  <span className="text-slate-400 text-[11px] block">Investor Investment Capital:</span>
                  <span className="text-white font-bold text-sm break-all sm:break-words">
                    ₹{formatINR(reconciliation.summary.totalInvestmentCapital || 0)}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-400 text-[11px] block">Cat 2 Material Supply:</span>
                  <span className="text-blue-300 font-bold break-all sm:break-words">
                    ₹{formatINR(reconciliation.summary.totalCustomerMaterialSupply || 0)}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-400 text-[11px] block">Cat 3 + Cat 4 Spend:</span>
                  <span className="text-amber-300 font-bold break-all sm:break-words">
                    ₹{formatINR(reconciliation.summary.expectedCost || 0)}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-400 text-[11px] block">Combined 3-Spend Total:</span>
                  <span className="text-emerald-300 font-black text-sm break-all sm:break-words">
                    ₹{formatINR(reconciliation.summary.totalThreeSiteExpenses || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Downstream Rule 2: Operational Spend vs Contractor Cost */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 sm:p-4 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5 min-w-0">
                  <HardHat className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="break-words">Downstream Rule 2: (Site Supply + Labour Attendance) vs Contractor Cost</span>
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  reconciliation.summary.reconciliationStatus === "MATCHED"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : reconciliation.summary.reconciliationStatus === "SURPLUS"
                    ? "bg-blue-500/20 text-blue-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}>
                  {reconciliation.summary.reconciliationStatus === "MATCHED"
                    ? "✓ 100% MATCHED"
                    : reconciliation.summary.reconciliationStatus === "SURPLUS"
                    ? "+ SURPLUS RECORDED"
                    : "⚠ ENTRY PENDING"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-3">
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">1. Cat 3 Site Supplies to Labour:</p>
                  <p className="text-lg sm:text-xl font-black text-teal-400 mt-0.5 break-all sm:break-words">
                    ₹{formatINR(reconciliation.summary.totalSiteSupplies)}
                  </p>
                  <p className="text-[10px] text-slate-400">{reconciliation.summary.siteSupplyCount} supply entries</p>
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-slate-400">2. Cat 4 Labour Attendance / Salaries:</p>
                  <p className="text-lg sm:text-xl font-black text-amber-400 mt-0.5 break-all sm:break-words">
                    ₹{formatINR(reconciliation.summary.totalLabourCost)}
                  </p>
                  <p className="text-[10px] text-slate-400">{reconciliation.summary.labourCount} wage entries</p>
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-slate-400">3. Expected Contractor Cost:</p>
                  <p className="text-lg sm:text-xl font-black text-white mt-0.5 break-all sm:break-words">
                    ₹{formatINR(reconciliation.summary.expectedCost)}
                  </p>
                  <p className="text-[10px] text-purple-300">Target to match Cat 5 records</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-xs break-words min-w-0">
                  <span className="text-slate-400">Cat 5 Recorded Contractor Cost: </span>
                  <span className="text-base font-bold text-purple-300 ml-1 break-all">
                    ₹{formatINR(reconciliation.summary.recordedCost)}
                  </span>
                  <span className="text-[11px] text-slate-400 ml-1">({reconciliation.summary.contractorCount} bills)</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-300 font-medium">Difference / Variance:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-black break-all ${
                    reconciliation.summary.variance >= 0
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  }`}>
                    {reconciliation.summary.variance >= 0 ? "+" : ""}₹{formatINR(reconciliation.summary.variance)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add / Edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? "Edit Contractor Cost" : "Add Contractor Cost"}
        maxWidth="xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date (DD-MM-YYYY) *</label>
              <DateInput
                required
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Contractor Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Construction / ABC Infra"
                value={formData.contractorName}
                onChange={e => setFormData({ ...formData, contractorName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Work Description</label>
            <input
              type="text"
              placeholder="e.g. Structure RCC Casting, Brickwork & Plaster"
              value={formData.workDescription}
              onChange={e => setFormData({ ...formData, workDescription: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-700">Gross Amount (₹) *</label>
                {!editingId && (reconciliation?.summary.variance || 0) < -0.01 && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, amount: Math.abs(reconciliation.summary.variance).toFixed(2) })}
                    className="text-[10px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 cursor-pointer"
                    title="Fill exact missing amount to balance contractor cost"
                  >
                    Auto-Fill Deficit: ₹{formatINR(Math.abs(reconciliation.summary.variance))}
                  </button>
                )}
              </div>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Deduction / TDS (₹)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.deductionAmount}
                onChange={e => setFormData({ ...formData, deductionAmount: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Net Payable (₹)</label>
              <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-black text-slate-900 font-mono truncate tabular-nums">
                ₹{formatINR(netAmountCalc)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Status</label>
              <select
                value={formData.paymentStatus}
                onChange={e => setFormData({ ...formData, paymentStatus: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
              >
                <option value="PAID">PAID</option>
                <option value="PENDING">PENDING</option>
                <option value="PARTIAL">PARTIAL</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={formData.paymentMethod}
                onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
              >
                <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reference / Bill No</label>
              <input
                type="text"
                placeholder="e.g. RA-BILL-01"
                value={formData.referenceNumber}
                onChange={e => setFormData({ ...formData, referenceNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
            <textarea
              rows={2}
              placeholder="Additional notes or measurement details..."
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              {editingId ? "Update Record" : "Save Contractor Cost"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
