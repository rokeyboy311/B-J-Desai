import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Plus, Trash2, Pencil, Package, ArrowUpRight, CheckCircle2 } from "lucide-react";

export default function MaterialSupplyTab({ locationId }: { locationId: number }) {
  const [records, setRecords] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    partyId: "",
    materialId: "",
    quantity: "",
    rate: "",
    taxPercentage: "18", // GST default
    transportCost: "0",
    discount: "0",
    referenceNumber: "",
    description: "",
    unit: "Nos"
  });

  useEffect(() => {
    loadData();
  }, [locationId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [supplies, mats, parts] = await Promise.all([
        apiFetch(`/materials/supply?locationId=${locationId}`),
        apiFetch(`/master/materials?locationId=${locationId}`).catch(() => []),
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

  const calculations = useMemo(() => {
    const qty = parseFloat(formData.quantity) || 0;
    const rate = parseFloat(formData.rate) || 0;
    const transport = parseFloat(formData.transportCost) || 0;
    const discount = parseFloat(formData.discount) || 0;
    const taxPercentage = parseFloat(formData.taxPercentage) || 0;

    const subtotal = Math.round(qty * rate * 100) / 100;
    const taxableAmount = subtotal - discount;
    const tax = Math.round(taxableAmount * (taxPercentage / 100) * 100) / 100;
    const total = Math.round((taxableAmount + tax + transport) * 100) / 100;
    
    return { subtotal, tax, total };
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/materials/supply/${editingId}` : "/materials/supply";
      const method = editingId ? "PUT" : "POST";
      
      const party = parties.find(p => p.id.toString() === formData.partyId);
      const material = materials.find(m => m.id.toString() === formData.materialId);

      await apiFetch(url, {
        method, 
        body: JSON.stringify({
          ...formData,
          partyName: party ? party.name : "",
          materialName: material ? material.name : "",
          locationId
        }),
      });
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error("Failed to save supply:", err);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      partyId: "",
      materialId: "",
      quantity: "",
      rate: "",
      taxPercentage: "18",
      transportCost: "0",
      discount: "0",
      referenceNumber: "",
      description: "",
      unit: "Nos"
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this supply record? Stock will be reverted.")) return;
    try {
      await apiFetch(`/materials/supply/${id}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      alert("Failed to delete supply");
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
        <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-orange-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Supply Record
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-900">External Supply Records</h3>
        </div>
        
        <div className="overflow-x-auto">
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
                    <button onClick={() => handleDelete(r.id)} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {records.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">No external supply records.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Supply (GST Bill)">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
              <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Party</label>
              <select required value={formData.partyId} onChange={e => setFormData({...formData, partyId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">-- Select --</option>
                {parties.map(p => <option key={p.id} value={p.id}>{p.name} {p.gst ? `(GST: ${p.gst})` : ''}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Material</label>
              <select required value={formData.materialId} onChange={e => {
                  const m = materials.find(x => x.id.toString() === e.target.value);
                  setFormData({...formData, materialId: e.target.value, unit: m?.defaultUnit || 'Nos'});
                }} 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">-- Select --</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
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
          
          <div className="bg-orange-50/50 p-3 rounded-lg border border-orange-100 flex flex-col gap-1">
             <div className="flex justify-between text-xs text-slate-500"><span>Subtotal:</span> <span>₹{calculations.subtotal.toLocaleString()}</span></div>
             <div className="flex justify-between text-xs text-slate-500"><span>GST ({formData.taxPercentage}%):</span> <span>₹{calculations.tax.toLocaleString()}</span></div>
             <div className="flex justify-between font-bold text-slate-800 text-base pt-1 border-t border-orange-100 mt-1"><span>Total Bill Amount:</span> <span className="text-orange-700">₹{calculations.total.toLocaleString()}</span></div>
          </div>

          <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-lg">Save Supply & Update Stock</button>
        </form>
      </Modal>
    </div>
  );
}
