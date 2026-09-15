import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { 
  Plus, Trash2, User, IndianRupee, Pencil, CheckCircle2, 
  AlertTriangle, ArrowRightLeft, ShieldAlert, Eye 
} from "lucide-react";

export default function SupervisorCostTab({ locationId }: { locationId: number }) {
  const [records, setRecords] = useState<any[]>([]);
  const [siteSupplies, setSiteSupplies] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
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
      const [supRes, siteRes] = await Promise.all([
        apiFetch(`/supervisor-costs?locationId=${locationId}`),
        apiFetch(`/materials/labour-supply?locationId=${locationId}`)
      ]);
      setRecords(supRes || []);
      setSiteSupplies(siteRes || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEdit = (r: any) => {
    setEditingId(r.id);
    setFormData({
      date: r.date || new Date().toISOString().split("T")[0],
      supervisorName: r.supervisorName || "",
      amount: String(r.amount || ""),
      description: r.description || "",
      paymentMethod: r.paymentMethod || "CASH",
      referenceNumber: r.referenceNumber || ""
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        locationId,
        ...formData,
        amount: Number(formData.amount)
      };

      if (editingId) {
        await apiFetch(`/supervisor-costs/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/supervisor-costs", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error(error);
      alert("Failed to save supervisor record");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this supervisor record?")) return;
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
    setEditingId(null);
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

  const totalSiteSupplyCost = useMemo(() => 
    siteSupplies.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0)
  , [siteSupplies]);

  const auditVariance = useMemo(() => 
    Math.round((totalCost - totalSiteSupplyCost) * 100) / 100
  , [totalCost, totalSiteSupplyCost]);

  return (
    <div className="space-y-6">
      {/* Information Banner: Strictly Separate from Investment */}
      <div className="p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl mt-0.5 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Supervisor Cost Management & Site Supply Audit</h4>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
              This section is <span className="font-semibold text-indigo-900">completely independent from total investment calculations</span>. Its core purpose is to record money disbursed to supervisors and verify whether disbursements match actual site supplies executed.
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider bg-white px-3 py-1 rounded-full border border-indigo-200 shadow-xs">
            Separate Audit Ledger
          </span>
        </div>
      </div>

      {/* Audit Reconciliation Checker Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cash Given to Supervisors</span>
          <div className="text-2xl font-bold text-indigo-600 mt-1">₹{totalCost.toLocaleString()}</div>
          <p className="text-xs text-slate-400 mt-0.5">{records.length} disbursements recorded</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Site Supply Total Incurred</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">₹{totalSiteSupplyCost.toLocaleString()}</div>
          <p className="text-xs text-slate-400 mt-0.5">{siteSupplies.length} site supply records</p>
        </div>

        <div className={`p-4 rounded-xl border shadow-xs ${
          Math.abs(auditVariance) <= 1 
            ? "bg-emerald-50 border-emerald-200" 
            : auditVariance > 0 
              ? "bg-amber-50 border-amber-200" 
              : "bg-rose-50 border-rose-200"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Reconciliation Match</span>
            {Math.abs(auditVariance) <= 1 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className={`w-4 h-4 ${auditVariance > 0 ? "text-amber-600" : "text-rose-600"}`} />
            )}
          </div>
          <div className={`text-2xl font-bold mt-1 ${
            Math.abs(auditVariance) <= 1 
              ? "text-emerald-700" 
              : auditVariance > 0 
                ? "text-amber-800" 
                : "text-rose-800"
          }`}>
            ₹{Math.abs(auditVariance).toLocaleString()} {auditVariance > 0 ? "Surplus" : auditVariance < 0 ? "Deficit" : ""}
          </div>
          <p className="text-xs mt-0.5 font-medium text-slate-600">
            {Math.abs(auditVariance) <= 1 
              ? "Exact Match: Site supply perfectly matches supervisor cash." 
              : auditVariance > 0 
                ? "Supervisor holds unspent advance cash." 
                : "Site supplies exceed supervisor cash given."}
          </p>
        </div>
      </div>

      {/* Header and Add Button */}
      <div className="flex justify-between items-center pt-2">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Supervisor Cost Records</h3>
          <p className="text-xs text-slate-500">Create, edit, view and verify supervisor funds</p>
        </div>
        <button type="button"
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl shadow-xs hover:bg-indigo-700 transition-colors text-sm font-medium cursor-pointer"
        >
          <Plus size={16} />
          Record Supervisor Payment
        </button>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Date</th>
                <th className="px-4 py-3">Supervisor Name</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Amount</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Payment Info</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <User className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No supervisor costs recorded yet
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-600">{r.date}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-900 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                        {r.supervisorName?.charAt(0)?.toUpperCase() || "S"}
                      </div>
                      {r.supervisorName}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-indigo-700 text-right">₹{Number(r.amount).toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-slate-600 max-w-xs truncate">{r.description || "-"}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {r.paymentMethod || "CASH"}
                      </span>
                      {r.referenceNumber && <span className="text-xs text-slate-400 ml-2">Ref: {r.referenceNumber}</span>}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button"
                          onClick={() => {
                            setSelectedRecord(r);
                            setIsDetailsOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button type="button"
                          onClick={() => handleEdit(r)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Record"
                        >
                          <Pencil size={16} />
                        </button>
                        <button type="button" 
                          onClick={() => handleDelete(r.id)}
                          disabled={isDeleting === r.id}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Record"
                        >
                          <Trash2 size={16} />
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

      {/* Create / Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }} 
        title={editingId ? "Edit Supervisor Cost Record" : "Record Cash Given to Supervisor"} 
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed">
            Record cash or advance handed over to the site supervisor. This ledger is tracked separately for site supply reconciliation.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Disbursement Date *</label>
              <input 
                type="date" 
                value={formData.date} 
                onChange={e => setFormData({...formData, date: e.target.value})} 
                className="w-full p-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden" 
                required 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supervisor Name *</label>
              <input 
                type="text" 
                value={formData.supervisorName} 
                onChange={e => setFormData({...formData, supervisorName: e.target.value})} 
                className="w-full p-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden" 
                required 
                placeholder="e.g. Ramesh Patel" 
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Amount Given (₹) *</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <IndianRupee className="w-4 h-4 text-slate-400" />
              </div>
              <input 
                type="number" 
                inputMode="decimal" 
                min="0" 
                step="0.01" 
                value={formData.amount} 
                onChange={e => setFormData({...formData, amount: e.target.value})} 
                className="w-full pl-9 p-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden font-bold" 
                required 
                placeholder="0.00" 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Purpose / Description</label>
            <textarea 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              className="w-full p-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden" 
              rows={3} 
              placeholder="e.g. Cash advance for site material unloading and daily supervisor expenses" 
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
              <select 
                value={formData.paymentMethod} 
                onChange={e => setFormData({...formData, paymentMethod: e.target.value})} 
                className="w-full p-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="UPI">UPI / Google Pay</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / Voucher Number</label>
              <input 
                type="text" 
                value={formData.referenceNumber} 
                onChange={e => setFormData({...formData, referenceNumber: e.target.value})} 
                className="w-full p-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden" 
                placeholder="e.g. Voucher #42 or UPI Ref" 
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button"  
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }} 
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit"  
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-xs shadow-indigo-200 cursor-pointer"
            >
              {editingId ? "Update Record" : "Save Record"}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Record Details Modal */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedRecord(null);
        }}
        title="Supervisor Cost Voucher Details"
        maxWidth="md"
      >
        {selectedRecord && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-xs text-slate-500 font-medium">Supervisor Name</span>
                <span className="font-bold text-slate-900">{selectedRecord.supervisorName}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-xs text-slate-500 font-medium">Disbursement Date</span>
                <span className="font-semibold text-slate-800">{selectedRecord.date}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-xs text-slate-500 font-medium">Amount Disbursed</span>
                <span className="font-bold text-xl text-indigo-600">₹{Number(selectedRecord.amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-xs text-slate-500 font-medium">Payment Mode</span>
                <span className="font-semibold text-slate-800">{selectedRecord.paymentMethod || "CASH"}</span>
              </div>
              {selectedRecord.referenceNumber && (
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 font-medium">Reference Number</span>
                  <span className="font-semibold text-slate-800">{selectedRecord.referenceNumber}</span>
                </div>
              )}
              {selectedRecord.description && (
                <div>
                  <span className="text-xs text-slate-500 font-medium block mb-1">Description / Purpose</span>
                  <p className="text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-200">
                    {selectedRecord.description}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDetailsOpen(false);
                  handleEdit(selectedRecord);
                }}
                className="px-4 py-2 text-sm font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Pencil size={15} /> Edit Record
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDetailsOpen(false);
                  setSelectedRecord(null);
                }}
                className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
