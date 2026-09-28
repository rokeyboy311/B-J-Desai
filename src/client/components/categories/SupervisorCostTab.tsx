import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import {
  HardHat, Plus, Trash2, Pencil, Search, Calendar, FileText,
  Banknote, ArrowDownLeft, ArrowUpRight, Scale, CheckCircle2,
  AlertTriangle, DollarSign, Download, FileSpreadsheet, RefreshCw,
  Clock, ShieldCheck, ChevronRight, UserCheck, Shield
} from "lucide-react";
import { useLiveSync, triggerSync } from "../../hooks/useLiveSync";
import { useToast } from "../../contexts/ToastContext";
import { downloadExcelReport } from "../../lib/excelExport";

interface SupervisorCost {
  id: number;
  locationId: number;
  date: string;
  supervisorName: string;
  amount: string;
  description: string | null;
  paymentMethod: string | null;
  referenceNumber: string | null;
  createdAt: string;
}

export default function SupervisorCostTab({ locationId }: { locationId: number }) {
  const { showToast, confirmAction } = useToast();
  
  const [costs, setCosts] = useState<SupervisorCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    supervisorName: "",
    amount: "",
    description: "",
    paymentMethod: "Bank Transfer",
    referenceNumber: ""
  });

  const [searchTerm, setSearchTerm] = useState("");

  const loadData = async (isBackground = false) => {
    if (!isBackground && costs.length === 0) setLoading(true);
    try {
      const res = await apiFetch(`/supervisor-costs?locationId=${locationId}`).catch(() => []);
      setCosts(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Failed to load supervisor costs", err);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(formData.amount);
    if (!formData.supervisorName.trim()) {
      showToast("Please enter supervisor name", "error");
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      showToast("Please enter a valid positive amount", "error");
      return;
    }

    try {
      const payload = {
        locationId,
        date: formData.date,
        supervisorName: formData.supervisorName.trim(),
        amount: amt.toString(),
        description: formData.description.trim() || null,
        paymentMethod: formData.paymentMethod || "Bank Transfer",
        referenceNumber: formData.referenceNumber.trim() || null
      };

      if (editingId) {
        await apiFetch(`/supervisor-costs/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        showToast("Supervisor cost updated successfully", "success");
      } else {
        await apiFetch("/supervisor-costs", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        showToast("Supervisor cost recorded successfully", "success");
      }

      setIsModalOpen(false);
      setEditingId(null);
      setFormData({
        date: new Date().toISOString().split("T")[0],
        supervisorName: "",
        amount: "",
        description: "",
        paymentMethod: "Bank Transfer",
        referenceNumber: ""
      });
      triggerSync("supervisor_costs");
      await loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to save supervisor cost", "error");
    }
  };

  const handleEdit = (cost: SupervisorCost) => {
    setEditingId(cost.id);
    setFormData({
      date: cost.date || new Date().toISOString().split("T")[0],
      supervisorName: cost.supervisorName || "",
      amount: cost.amount || "",
      description: cost.description || "",
      paymentMethod: cost.paymentMethod || "Bank Transfer",
      referenceNumber: cost.referenceNumber || ""
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number, name: string, amount: string) => {
    const confirmed = await confirmAction({
      title: "Delete Supervisor Cost",
      message: `Are you sure you want to delete supervisor cost of ₹${parseFloat(amount).toLocaleString("en-IN")} for ${name}?`,
      confirmLabel: "Delete Record",
      isDanger: true
    });

    if (!confirmed) return;

    try {
      await apiFetch(`/supervisor-costs/${id}`, { method: "DELETE" });
      showToast("Supervisor cost deleted successfully", "success");
      triggerSync("supervisor_costs");
      await loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to delete supervisor cost", "error");
    }
  };

  const filteredCosts = useMemo(() => {
    return costs.filter((c) => {
      const q = searchTerm.toLowerCase().trim();
      if (!q) return true;
      return (
        (c.supervisorName && c.supervisorName.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (c.paymentMethod && c.paymentMethod.toLowerCase().includes(q)) ||
        (c.referenceNumber && c.referenceNumber.toLowerCase().includes(q)) ||
        (c.date && c.date.includes(q))
      );
    });
  }, [costs, searchTerm]);

  const totalExpense = useMemo(() => {
    return costs.reduce((sum, c) => sum + (parseFloat(c.amount || "0") || 0), 0);
  }, [costs]);

  return (
    <div className="space-y-6">
      
      {/* Header with KPI & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-600" />
            <span>Supervisor Cost (સુપરવાઇઝર ખર્ચ)</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Track site supervisor salaries, allowances, and site management expenses
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => downloadExcelReport(`/reports/export-location/${locationId}?tab=supervisor`, `Supervisor_Costs_Location_${locationId}.xlsx`)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setFormData({
                date: new Date().toISOString().split("T")[0],
                supervisorName: "",
                amount: "",
                description: "",
                paymentMethod: "Bank Transfer",
                referenceNumber: ""
              });
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Supervisor Cost</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total Supervisor Cost</span>
            <span className="text-lg font-black text-indigo-900 tabular-nums">
              ₹{totalExpense.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total Entries</span>
            <span className="text-lg font-black text-slate-800 tabular-nums">
              {costs.length} Records
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Latest Entry</span>
            <span className="text-sm font-bold text-slate-800">
              {costs[0]?.date || "No records"}
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by supervisor, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Showing {filteredCosts.length} of {costs.length} records
          </span>
        </div>

        {/* Records Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Supervisor Name</th>
                <th className="p-3 text-right">Amount (₹)</th>
                <th className="p-3">Payment Method</th>
                <th className="p-3">Reference No</th>
                <th className="p-3">Description / Work</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && costs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">Loading supervisor records...</td>
                </tr>
              ) : filteredCosts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">No supervisor costs recorded yet.</td>
                </tr>
              ) : (
                filteredCosts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-medium text-slate-700 whitespace-nowrap">{c.date}</td>
                    <td className="p-3 font-bold text-slate-900">{c.supervisorName}</td>
                    <td className="p-3 text-right font-black text-indigo-700 tabular-nums">
                      ₹{parseFloat(c.amount || "0").toLocaleString("en-IN")}
                    </td>
                    <td className="p-3 text-slate-600">{c.paymentMethod || "Bank Transfer"}</td>
                    <td className="p-3 text-slate-500 font-mono">{c.referenceNumber || "-"}</td>
                    <td className="p-3 text-slate-600 max-w-xs truncate">{c.description || "-"}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEdit(c)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id, c.supervisorName, c.amount)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete"
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

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingId(null);
        }}
        title={editingId ? "Edit Supervisor Cost" : "+ Add Supervisor Cost (સુપરવાઇઝર ખર્ચ)"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Supervisor Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Nilesh Bhai"
                value={formData.supervisorName}
                onChange={(e) => setFormData({ ...formData, supervisorName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="25000"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Method</label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Bank Transfer">Bank Transfer / NEFT / RTGS</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="UPI">UPI / GPay</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Reference / Cheque Number</label>
            <input
              type="text"
              placeholder="Ref # (optional)"
              value={formData.referenceNumber}
              onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description / Notes</label>
            <textarea
              rows={2}
              placeholder="Monthly site supervision salary / allowances..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingId(null);
              }}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
            >
              {editingId ? "Update Record" : "Save Record"}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
