import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Pencil } from "lucide-react";
import { Plus, Trash2, HardHat, Package, ArrowRightCircle } from "lucide-react";

export default function SiteSupplyTab({ locationId }: { locationId: number }) {
  const [records, setRecords] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    teamId: "",
    materialId: "",
    quantity: "",
    rate: "0",
    description: "",
  });

  useEffect(() => {
    loadData();
  }, [locationId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [supplies, mats, labTeams] = await Promise.all([
        apiFetch(`/site-supplies?locationId=${locationId}`).catch(() => []),
        apiFetch(`/master/materials?locationId=${locationId}`).catch(() => []),
        apiFetch(`/master/teams?locationId=${locationId}`).catch(() => [])
      ]);
      setRecords(supplies || []);
      setMaterials(mats || []);
      setTeams(labTeams || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/site-supplies/${editingId}` : "/site-supplies";
      const method = editingId ? "PUT" : "POST";

      await apiFetch(url, {
        method, 
        body: JSON.stringify({
          locationId,
          date: formData.date,
          teamId: formData.teamId ? parseInt(formData.teamId) : null,
          notes: formData.description,
          items: [{
            materialId: parseInt(formData.materialId),
            quantity: formData.quantity,
            rate: formData.rate || 0
          }]
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
      teamId: "",
      materialId: "",
      quantity: "",
      rate: "0",
      description: "",
    });
  };

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    const item = record.items?.[0] || {};
    setFormData({
      date: record.date || new Date().toISOString().split("T")[0],
      teamId: record.teamId?.toString() || "",
      materialId: item.materialId?.toString() || "",
      quantity: item.quantity || "",
      rate: item.rate || "0",
      description: record.notes || "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this site supply record? Stock will be reverted.")) return;
    try {
      await apiFetch(`/site-supplies/${id}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      alert("Failed to delete supply");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-teal-500/10 border border-teal-200/80 p-5 rounded-2xl flex justify-between items-center">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-teal-600 text-white rounded-xl shadow-md">
            <ArrowRightCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Site Supply</h2>
            <p className="text-xs text-slate-600">Supply materials to site labor/teams. Reduces inventory stock.</p>
          </div>
        </div>
        <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-teal-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Site Supply
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-900">Labour/Team Supply Records</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Labour Team</th>
                <th className="p-3">Material</th>
                <th className="p-3 text-right">Qty Supplied</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="p-3 text-slate-600">{r.date}</td>
                  <td className="p-3">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5"><HardHat className="w-3.5 h-3.5 text-teal-600" /> {teams.find(t => t.id === r.teamId)?.name || "-"}</div>
                  </td>
                  <td className="p-3 text-teal-700 font-semibold">{r.items?.[0] ? materials.find(m => m.id === r.items[0].materialId)?.name : '-'}</td>
                  <td className="p-3 text-right font-bold">{r.items?.[0]?.quantity} {materials.find(m => m.id === r.items?.[0]?.materialId)?.defaultUnit}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => handleEdit(r)} className="text-slate-400 hover:text-amber-600 p-1"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(r.id)} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {records.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No site supply records.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Site Supply" : "Issue Material to Site Labour"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
              <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Labour Team</label>
              <select required value={formData.teamId} onChange={e => setFormData({...formData, teamId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">-- Select --</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Material</label>
              <select required value={formData.materialId} onChange={e => {
                  setFormData({...formData, materialId: e.target.value});
                }} 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">-- Select --</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quantity</label>
              <input type="number" step="0.01" required value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Description (Optional)</label>
            <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-lg">{editingId ? "Update Supply" : "Issue Supply & Deduct Stock"}</button>
        </form>
      </Modal>
    </div>
  );
}
