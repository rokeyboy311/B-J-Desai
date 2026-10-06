import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Plus, Trash2, Pencil, Package, ArrowUpRight, CheckCircle2, Download } from "lucide-react";
import { useLiveSync, triggerSync } from "../../hooks/useLiveSync";
import { ManageMaterialsModal } from "../ui/ManageMaterialsModal";
import { useToast } from "../../contexts/ToastContext";
import { downloadExcelReport } from "../../lib/excelExport";

export default function MaterialSupplyTab({ locationId }: { locationId: number }) {
  const { showToast, confirmAction } = useToast();
  const [records, setRecords] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManageMaterialOpen, setIsManageMaterialOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    partyName: "",
    partyId: "",
    materialId: "",
    quantity: "",
    rate: "",
    taxPercentage: "18", // GST default
    transportCost: "0",
    discount: "0",
    referenceNumber: "",
    description: "",
    unit: "Nos", paymentStatus: "UNPAID", paymentMethod: "", notes: ""
  });

  const loadData = async (isBackground = false) => {
    if (!isBackground && records.length === 0) setLoading(true);
    try {
      const [supplies, mats, parts] = await Promise.all([
        apiFetch(`/materials/supply?locationId=${locationId}`),
        apiFetch(`/master/materials`).catch(() => []),
        apiFetch(`/master/parties?locationId=${locationId}`).catch(() => [])
      ]);
      setRecords(supplies || []);
      setMaterials(mats || []);
      setParties(parts || []);
    } catch (err) {
      console.error(err);
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

  const calculations = useMemo(() => {
    const qty = parseFloat(formData.quantity) || 0;
    const rate = parseFloat(formData.rate) || 0;
    const transport = parseFloat(formData.transportCost) || 0;
    const discount = parseFloat(formData.discount) || 0;
    const taxPercentage = parseFloat(formData.taxPercentage) || 0;

    const subtotal = Math.round(qty * rate * 100) / 100;
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = Math.round(taxableAmount * (taxPercentage / 100) * 100) / 100;
    const total = Math.round((taxableAmount + tax + transport) * 100) / 100;
    
    return { subtotal, tax, total };
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/materials/supply/${editingId}` : "/materials/supply";
      const method = editingId ? "PUT" : "POST";
      
      const enteredPartyName = formData.partyName.trim();
      const matchedParty = parties.find(p => p.name.toLowerCase() === enteredPartyName.toLowerCase());
      const material = materials.find(m => m.id.toString() === formData.materialId);

      const payload = {
        date: formData.date,
        partyName: enteredPartyName || "Customer",
        partyId: matchedParty ? matchedParty.id : (formData.partyId ? parseInt(formData.partyId) : null),
        materialId: formData.materialId ? parseInt(formData.materialId) : null,
        materialName: material ? material.name : "",
        quantity: parseFloat(formData.quantity) || 0,
        unit: formData.unit || material?.defaultUnit || "Nos",
        rate: parseFloat(formData.rate) || 0,
        taxPercentage: parseFloat(formData.taxPercentage) || 0,
        tax: calculations.tax,
        subtotal: calculations.subtotal,
        transportCost: parseFloat(formData.transportCost) || 0,
        discount: parseFloat(formData.discount) || 0,
        totalAmount: calculations.total,
        paidAmount: formData.paymentStatus === 'PAID' ? calculations.total : 0,
        outstandingAmount: formData.paymentStatus === 'PAID' ? 0 : calculations.total,
        paymentStatus: formData.paymentStatus || 'UNPAID',
        paymentMethod: formData.paymentMethod || 'CASH',
        referenceNumber: formData.referenceNumber || null,
        description: formData.description || formData.notes || null,
        locationId: parseInt(String(locationId))
      };

      await apiFetch(url, {
        method, 
        body: JSON.stringify(payload),
      });
      triggerSync("materials");
      triggerSync("stock");
      triggerSync("reports");
      setIsModalOpen(false);
      resetForm();
      showToast(editingId ? "Material supply updated successfully" : "Material supply added successfully", "success");
      await loadData();
    } catch (err: any) {
      console.error("Failed to save supply:", err);
      showToast(err.message || "Failed to save material supply", "error");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      partyName: "",
      partyId: "",
      materialId: "",
      quantity: "",
      rate: "",
      taxPercentage: "18",
      transportCost: "0",
      discount: "0",
      referenceNumber: "",
      description: "",
      unit: "Nos",
      paymentStatus: "UNPAID",
      paymentMethod: "",
      notes: ""
    });
  };


  const handleEdit = (record: any) => {
    setEditingId(record.id);
    setFormData({
      date: record.date || new Date().toISOString().split("T")[0],
      partyName: record.partyName || "",
      partyId: record.partyId?.toString() || "",
      materialId: record.materialId?.toString() || "",
      quantity: record.quantity || "",
      rate: record.rate || "",
      taxPercentage: record.taxPercentage || "18",
      transportCost: record.transportCost || "0",
      discount: record.discount || "0",
      referenceNumber: record.referenceNumber || "",
      description: record.notes || record.description || "",
      unit: record.unit || "Nos",
      paymentStatus: record.paymentStatus || "UNPAID",
      paymentMethod: record.paymentMethod || "",
      notes: record.notes || ""
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirmAction({
      title: "Delete Material Supply",
      message: "Are you sure you want to delete this supply record? Stock will be automatically restored.",
      confirmLabel: "Delete",
      isDanger: true
    });
    if (!confirmed) return;
    try {
      await apiFetch(`/materials/supply/${id}`, { method: "DELETE" });
      triggerSync("materials");
      triggerSync("stock");
      triggerSync("reports");
      showToast("Supply record deleted and stock restored", "success");
      await loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete supply", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-orange-500/10 border border-orange-200/80 p-5 rounded-2xl flex justify-between items-center">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-orange-600 text-white rounded-xl shadow-md">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Material Supply (GST Bill)</h2>
            <p className="text-xs text-slate-600">Supply materials to external customers. Updates stock automatically.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadExcelReport(`/reports/export-customer-supplies?locationId=${locationId}`, `Customer_Supplies_Location_${locationId}.xlsx`)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-orange-300 text-orange-950 hover:bg-orange-50 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Export Customer Supplies & GST Bills to Excel"
          >
            <Download className="w-4 h-4 text-orange-600" /> Export Supplies (.xlsx)
          </button>
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-orange-700 transition-colors cursor-pointer">
            <Plus className="w-4 h-4" /> Add Supply Record
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-900">External Supply Records</h3>
            <p className="text-[11px] text-slate-500">Customer sales & outbound materials invoiced</p>
          </div>
          <span className="text-xs text-slate-500 font-semibold">{records.length} records</span>
        </div>
        
        {/* Mobile Cards View */}
        <div className="block md:hidden divide-y divide-slate-100">
          {records.map(r => (
            <div key={`ms-mob-${r.id}`} className="p-4 space-y-3 bg-white hover:bg-slate-50/60 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 text-xs font-medium">{r.date}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-orange-50 text-orange-800 border border-orange-200">
                  GST {r.taxPercentage || 0}%
                </span>
              </div>

              <div>
                <div className="text-sm font-extrabold text-slate-900">{r.partyName}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-bold text-orange-700">{r.materialName}</span>
                  <span className="text-xs font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                    {r.quantity} {r.unit}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Rate</div>
                  <div className="font-semibold text-slate-700">₹{r.rate}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total</div>
                  <div className="font-black text-slate-900 text-sm">₹{Number(r.totalAmount).toLocaleString()}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleEdit(r)}
                  className="flex-1 min-h-[42px] px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-600" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  className="flex-1 min-h-[42px] px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-rose-200 transition-colors cursor-pointer active:scale-95"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" /> Delete
                </button>
              </div>
            </div>
          ))}
          {records.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-xs">
              No external supply records.
            </div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Customer (GST)</th>
                <th className="p-3">Material</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">Rate</th>
                <th className="p-3 text-right">GST %</th>
                <th className="p-3 text-right">Total (₹)</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="p-3 text-slate-600">{r.date}</td>
                  <td className="p-3">
                    <div className="font-bold text-slate-900">{r.partyName}</div>
                  </td>
                  <td className="p-3 text-orange-700 font-semibold">{r.materialName}</td>
                  <td className="p-3 text-right font-bold">{r.quantity} {r.unit}</td>
                  <td className="p-3 text-right text-slate-600">₹{r.rate}</td>
                  <td className="p-3 text-right text-slate-600">{r.taxPercentage || 0}%</td>
                  <td className="p-3 text-right font-black text-slate-900">₹{Number(r.totalAmount).toLocaleString()}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleEdit(r)} className="text-slate-400 hover:text-amber-600 p-2 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(r.id)} className="text-slate-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {records.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">No external supply records.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Supply" : "Add Supply (GST Bill)"} maxWidth="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
              <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Party Name *</label>
              <input
                type="text"
                required
                placeholder="Enter Customer / Party Name"
                list="material-supply-party-list"
                value={formData.partyName}
                onChange={e => setFormData({ ...formData, partyName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 font-medium"
              />
              <datalist id="material-supply-party-list">
                {parties.map(p => (
                  <option key={p.id} value={p.name}>
                    {p.name} {p.gst ? `(GST: ${p.gst})` : ''}
                  </option>
                ))}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">Material *</label>
                <button
                  type="button"
                  onClick={() => setIsManageMaterialOpen(true)}
                  className="text-[11px] font-bold text-orange-600 hover:text-orange-800 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Manage Material
                </button>
              </div>
              <select required value={formData.materialId} onChange={e => {
                  const m = materials.find(x => x.id.toString() === e.target.value);
                  setFormData(prev => ({
                    ...prev,
                    materialId: e.target.value,
                    unit: m?.defaultUnit || 'Nos',
                    rate: m?.defaultRate ? String(m.defaultRate) : prev.rate
                  }));
                }} 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800">
                <option value="">-- Select Material --</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} (Stock: {m.currentStock ?? 0} {m.defaultUnit || 'Nos'})
                  </option>
                ))}
              </select>
              {formData.materialId && (
                <div className="mt-1 text-[11px] font-bold text-orange-700">
                  {(() => {
                    const sel = materials.find(m => m.id.toString() === formData.materialId);
                    return `Available Stock: ${sel?.currentStock ?? 0} ${sel?.defaultUnit || 'Nos'}`;
                  })()}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quantity</label>
                <input type="number" step="0.01" required value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rate</label>
                <input type="number" step="0.01" required value={formData.rate} onChange={e => setFormData({...formData, rate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">GST Percentage (%)</label>
              <input type="number" step="0.1" value={formData.taxPercentage} onChange={e => setFormData({...formData, taxPercentage: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
             <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Bill / Ref Number</label>
              <input type="text" value={formData.referenceNumber} onChange={e => setFormData({...formData, referenceNumber: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          
                    <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Transport Fee (₹) (+)</label>
              <input type="number" step="0.01" value={formData.transportCost} onChange={e => setFormData({...formData, transportCost: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
              <span className="text-[10px] text-slate-500">Excluded from GST (added separately)</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Discount (₹) (-)</label>
              <input type="number" step="0.01" value={formData.discount} onChange={e => setFormData({...formData, discount: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Status</label>
              <select value={formData.paymentStatus} onChange={e => setFormData({...formData, paymentStatus: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="UNPAID">UNPAID</option>
                <option value="PARTIAL">PARTIAL</option>
                <option value="PAID">PAID</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
              <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">-- None --</option>
                <option value="CASH">CASH</option>
                <option value="BANK">BANK / ONLINE</option>
                <option value="CHEQUE">CHEQUE</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
            <input type="text" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>

          <div className="bg-orange-50/50 p-3 rounded-lg border border-orange-100 flex flex-col gap-1.5 text-xs">
             <div className="flex justify-between text-slate-500"><span>Material Subtotal:</span> <span>₹{calculations.subtotal.toLocaleString()}</span></div>
             {Number(formData.discount) > 0 && <div className="flex justify-between text-emerald-600"><span>Discount:</span> <span>-₹{Number(formData.discount).toLocaleString()}</span></div>}
             <div className="flex justify-between text-slate-500"><span>GST ({formData.taxPercentage}% on taxable amount):</span> <span>₹{calculations.tax.toLocaleString()}</span></div>
             {Number(formData.transportCost) > 0 && <div className="flex justify-between text-amber-700 font-medium"><span>Transport Fee (No GST, added separately):</span> <span>+₹{Number(formData.transportCost).toLocaleString()}</span></div>}
             <div className="flex justify-between font-bold text-slate-800 text-base pt-1.5 border-t border-orange-200 mt-1"><span>Total Bill Amount:</span> <span className="text-orange-700">₹{calculations.total.toLocaleString()}</span></div>
          </div>

          <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-lg">Save Supply & Update Stock</button>
        </form>
      </Modal>

      {/* Quick Manage Material Modal */}
      <ManageMaterialsModal
        isOpen={isManageMaterialOpen}
        onClose={() => setIsManageMaterialOpen(false)}
        locationId={locationId}
        currentSelectedId={formData.materialId}
        onSelectMaterial={(selectedMat) => {
          setFormData(prev => ({
            ...prev,
            materialId: String(selectedMat.id),
            unit: selectedMat.defaultUnit || prev.unit || 'Nos',
            rate: selectedMat.defaultRate ? String(selectedMat.defaultRate) : prev.rate
          }));
          loadData(true);
        }}
      />
    </div>
  );
}
