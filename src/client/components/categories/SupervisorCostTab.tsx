import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Plus, Trash2, User, IndianRupee } from "lucide-react";

export default function SupervisorCostTab({ locationId }: { locationId: number }) {
  const [records, setRecords] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    supervisorName: "",
    amount: "",
    description: "",
    paymentMethod: "CASH",
    referenceNumber: ""
  });

  useEffect(() => { 
    loadData();
  }, [locationId]);

  const loadData = async () => {
    try {
      const res = await apiFetch(`/supervisor-costs?locationId=${locationId}`);
      setRecords(res || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/supervisor-costs", {
        method: "POST",
        body: JSON.stringify({ 
          locationId,
          ...formData,
          amount: Number(formData.amount)
        }),
      });
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error(error);
      alert("Failed to add record");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this record?")) return;
    setIsDeleting(id);
    try {
      await apiFetch(`/supervisor-costs/${id}`, { method: "DELETE" });
      loadData();
    } catch (error) {
      console.error(error);
      alert("Failed to delete record");
    } finally {
      setIsDeleting(null);
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split("T")[0],
      supervisorName: "",
      amount: "",
      description: "",
      paymentMethod: "CASH",
      referenceNumber: ""
    });
  };

  const totalCost = useMemo(() => 
    records.reduce((sum, r) => sum + Number(r.amount || 0), 0)
  , [records]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between max-w-sm">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Supervisor Cost</span>
          <div className="text-xl font-bold text-slate-900 mt-1">₹{totalCost.toLocaleString()}</div>
          <p className="text-xs text-slate-400 mt-0.5">{records.length} records</p>
        </div>
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
          <User className="w-5 h-5" />
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-900">Site Supervisor Costs</h3>
        <button type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl shadow-sm hover:bg-indigo-700 transition-colors hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm shadow-indigo-200"
        >
          <Plus size={16} />
          Add Cost
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider font-medium border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Date</th>
                <th className="px-4 py-3">Supervisor Name</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Amount</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Payment Info</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No supervisor costs recorded yet
                  </td>
                </tr>
              ) : (
                records.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{r.date}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.supervisorName}</td>
                    <td className="px-4 py-3 font-bold text-slate-900 text-right">₹{Number(r.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-600">{r.description || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-slate-900">{r.paymentMethod}</div>
                      {r.referenceNumber && <div className="text-xs text-slate-500">{r.referenceNumber}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" 
                        onClick={() => handleDelete(r.id)}
                        disabled={isDeleting === r.id}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg hover:text-rose-700 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Site Supervisor Cost" maxWidth="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date *</label>
              <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Supervisor Name *</label>
              <input type="text" value={formData.supervisorName} onChange={e => setFormData({...formData, supervisorName: e.target.value})} className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500" required placeholder="Enter name" />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Amount (₹) *</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <IndianRupee className="w-4 h-4 text-slate-400" />
              </div>
              <input type="number" inputMode="decimal" min="0" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full pl-9 p-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500" required placeholder="0.00" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500" rows={3} placeholder="Add notes or details here..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method</label>
              <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500">
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Reference Number</label>
              <input type="text" value={formData.referenceNumber} onChange={e => setFormData({...formData, referenceNumber: e.target.value})} className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="e.g. UTR or Cheque No." />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button"  onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit"  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm shadow-indigo-200">
              Save Record
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
