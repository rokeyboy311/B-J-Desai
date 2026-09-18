import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Pencil, Plus, Trash2, HardHat, ArrowRightCircle } from "lucide-react";
import { useLiveSync, triggerSync } from "../../hooks/useLiveSync";
import { ManageMaterialsModal } from "../ui/ManageMaterialsModal";
import { ManageTeamsModal } from "../ui/ManageTeamsModal";

export default function SiteSupplyTab({ locationId }: { locationId: number }) {
  const [records, setRecords] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManageMaterialOpen, setIsManageMaterialOpen] = useState(false);
  const [isManageTeamOpen, setIsManageTeamOpen] = useState(false);
  const [targetItemIndex, setTargetItemIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    siteLocationId: locationId.toString(),
    teamId: "",
    notes: "",
    items: [{ materialId: "", quantity: "", unit: "Nos", rate: "0" }]
  });

  const loadData = async (isBackground = false) => {
    if (!isBackground && records.length === 0) setLoading(true);
    try {
      const [supplies, mats, labTeams, locs] = await Promise.all([
        apiFetch(`/site-supplies?locationId=${locationId}`).catch(() => []),
        apiFetch(`/master/materials?locationId=${locationId}`).catch(() => []),
        apiFetch(`/master/teams?locationId=${locationId}`).catch(() => []),
        apiFetch(`/locations`).catch(() => [])
      ]);
      setRecords(supplies || []);
      setMaterials(mats || []);
      setTeams(labTeams || []);
      setLocations(locs || []);
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

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { materialId: "", quantity: "", unit: "Nos", rate: "0" }]
    });
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-update unit if material changes
    if (field === "materialId") {
      const mat = materials.find(m => m.id.toString() === value);
      if (mat && mat.defaultUnit) {
        newItems[index].unit = mat.defaultUnit;
      }
      if (mat && mat.defaultRate && (!newItems[index].rate || newItems[index].rate === "0")) {
        newItems[index].rate = String(mat.defaultRate);
      }
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index: number) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validate items
      const validItems = formData.items.filter(i => i.materialId && i.quantity && parseFloat(i.quantity) > 0);
      if (validItems.length === 0) {
        alert("Please add at least one material with a valid quantity");
        return;
      }
      
      const url = editingId ? `/site-supplies/${editingId}` : "/site-supplies";
      const method = editingId ? "PUT" : "POST";
      
      await apiFetch(url, {
        method, 
        body: JSON.stringify({
          locationId: parseInt(formData.siteLocationId) || locationId,
          date: formData.date,
          teamId: formData.teamId ? parseInt(formData.teamId) : null,
          notes: formData.notes,
          items: validItems.map(i => ({
            materialId: parseInt(i.materialId),
            quantity: parseFloat(i.quantity),
            unit: i.unit || 'Nos',
            rate: parseFloat(i.rate) || 0
          }))
        }),
      });
      triggerSync("site_supplies");
      triggerSync("stock");
      triggerSync("materials");
      triggerSync("reports");
      setIsModalOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      console.error("Failed to save supply:", err);
      alert("Failed to save site supply");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      siteLocationId: locationId.toString(),
      teamId: "",
      notes: "",
      items: [{ materialId: "", quantity: "", unit: "Nos", rate: "0" }]
    });
  };

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    
    const items = (record.items && record.items.length > 0) ? record.items.map((i: any) => ({
      materialId: i.materialId?.toString() || "",
      quantity: i.quantity?.toString() || "",
      unit: i.unit || "Nos",
      rate: i.rate?.toString() || "0"
    })) : [{ materialId: "", quantity: "", unit: "Nos", rate: "0" }];
    
    setFormData({
      date: record.date || new Date().toISOString().split("T")[0],
      siteLocationId: record.locationId?.toString() || locationId.toString(),
      teamId: record.teamId?.toString() || "",
      notes: record.notes || "",
      items
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this site supply record? Stock will be reverted.")) return;
    try {
      await apiFetch(`/site-supplies/${id}`, { method: "DELETE" });
      triggerSync("site_supplies");
      triggerSync("stock");
      triggerSync("materials");
      triggerSync("reports");
      await loadData();
    } catch (err) {
      alert("Failed to delete supply");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-teal-500/10 border border-teal-200/80 p-5 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-teal-600 text-white rounded-xl shadow-md shrink-0">
            <ArrowRightCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Site Material Supply</h2>
            <p className="text-xs text-slate-600">Issue materials to internal teams & site. Reduces inventory stock.</p>
          </div>
        </div>
        <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-teal-700 transition-colors shrink-0 cursor-pointer">
          <Plus className="w-4 h-4" /> Add Site Supply
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-900">Site Supply Records</h3>
          <span className="text-xs text-slate-500 font-semibold">{records.length} records</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Site Location</th>
                <th className="p-3">Labour Team</th>
                <th className="p-3">Materials</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="p-3 text-slate-600">{r.date}</td>
                  <td className="p-3 font-semibold text-slate-700">
                     {locations.find(l => l.id === r.locationId)?.name || `Location ${r.locationId}`}
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5"><HardHat className="w-3.5 h-3.5 text-teal-600" /> {teams.find(t => t.id === r.teamId)?.name || "-"}</div>
                  </td>
                  <td className="p-3">
                    <div className="space-y-1">
                      {r.items && r.items.map((item: any, i: number) => {
                         const matName = materials.find(m => m.id === item.materialId)?.name || 'Unknown';
                         return (
                           <div key={i} className="flex gap-2 items-center text-[11px]">
                             <span className="font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">{matName}</span>
                             <span className="text-slate-600 font-semibold">{item.quantity} {item.unit || ''}</span>
                             {parseFloat(item.rate) > 0 && <span className="text-slate-400">(₹{item.rate})</span>}
                           </div>
                         )
                      })}
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleEdit(r)} className="text-slate-400 hover:text-teal-600 p-1.5 rounded-lg hover:bg-teal-50 transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(r.id)} className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {records.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No site supply records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Site Supply" : "Add Site Supply"} maxWidth="lg">
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date *</label>
              <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Site Location Name *</label>
              <select required value={formData.siteLocationId} onChange={e => setFormData({...formData, siteLocationId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 font-medium">
                <option value="">-- Select Site --</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">Labour Team</label>
              <button
                type="button"
                onClick={() => setIsManageTeamOpen(true)}
                className="text-[11px] font-bold text-teal-700 hover:text-teal-900 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Manage Team
              </button>
            </div>
            <select value={formData.teamId} onChange={e => setFormData({...formData, teamId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 font-medium">
              <option value="">-- Select Team (Optional) --</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          
          <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
            <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">MATERIAL LIST</span>
              <button
                type="button"
                onClick={() => {
                  setTargetItemIndex(null);
                  setIsManageMaterialOpen(true);
                }}
                className="text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Manage Material
              </button>
            </div>
            <div className="p-3 space-y-3 bg-white">
               {formData.items.map((item, index) => (
                 <div key={index} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                   <div className="flex items-center justify-between">
                     <span className="text-xs font-bold text-slate-700">Material #{index + 1}</span>
                     {formData.items.length > 1 && (
                       <button
                         type="button"
                         onClick={() => removeItem(index)}
                         className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
                       >
                         <Trash2 className="w-3.5 h-3.5" /> Remove
                       </button>
                     )}
                   </div>
                   
                   <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                     <div className="sm:col-span-6">
                       <label className="block text-[11px] font-bold text-slate-600 mb-1">Material *</label>
                       <select required value={item.materialId} onChange={e => updateItem(index, 'materialId', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-medium">
                         <option value="">- Select Material -</option>
                         {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                       </select>
                     </div>
                     <div className="grid grid-cols-3 sm:col-span-6 gap-2">
                       <div>
                         <label className="block text-[11px] font-bold text-slate-600 mb-1">Qty *</label>
                         <input type="number" step="any" inputMode="decimal" required placeholder="0.00" value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold" />
                       </div>
                       <div>
                         <label className="block text-[11px] font-bold text-slate-600 mb-1">Unit</label>
                         <input type="text" placeholder="Unit" value={item.unit} onChange={e => updateItem(index, 'unit', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs" />
                       </div>
                       <div>
                         <label className="block text-[11px] font-bold text-slate-600 mb-1">Rate (₹)</label>
                         <input type="number" step="any" inputMode="decimal" placeholder="0.00" value={item.rate} onChange={e => updateItem(index, 'rate', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs" />
                       </div>
                     </div>
                   </div>
                 </div>
               ))}
               <button type="button" onClick={addItem} className="w-full py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                 <Plus className="w-3.5 h-3.5" /> Add another material
               </button>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
            <input type="text" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Optional remarks" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500" />
          </div>
          <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm cursor-pointer">
            {editingId ? "Update Site Supply" : "Save Site Supply"}
          </button>
        </form>
      </Modal>

      {/* Quick Manage Material Modal */}
      <ManageMaterialsModal
        isOpen={isManageMaterialOpen}
        onClose={() => {
          setIsManageMaterialOpen(false);
          setTargetItemIndex(null);
        }}
        locationId={locationId}
        onSelectMaterial={(selectedMat) => {
          if (targetItemIndex !== null && formData.items[targetItemIndex]) {
            updateItem(targetItemIndex, 'materialId', String(selectedMat.id));
          } else {
            // Check if last item is empty
            const lastIdx = formData.items.length - 1;
            if (lastIdx >= 0 && !formData.items[lastIdx].materialId) {
              updateItem(lastIdx, 'materialId', String(selectedMat.id));
            } else {
              setFormData(prev => ({
                ...prev,
                items: [
                  ...prev.items,
                  {
                    materialId: String(selectedMat.id),
                    quantity: "",
                    unit: selectedMat.defaultUnit || "Nos",
                    rate: selectedMat.defaultRate ? String(selectedMat.defaultRate) : "0"
                  }
                ]
              }));
            }
          }
          loadData(true);
        }}
      />

      {/* Quick Manage Team Modal */}
      <ManageTeamsModal
        isOpen={isManageTeamOpen}
        onClose={() => setIsManageTeamOpen(false)}
        locationId={locationId}
        currentSelectedId={formData.teamId}
        onSelectTeam={(selectedTeam) => {
          setFormData(prev => ({
            ...prev,
            teamId: String(selectedTeam.id)
          }));
          loadData(true);
        }}
      />
    </div>
  );
}
