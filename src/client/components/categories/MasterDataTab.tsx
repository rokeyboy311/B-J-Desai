import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Plus, Pencil, Trash2, Box, HardHat, Search } from "lucide-react";
import { useLiveSync, triggerSync } from "../../hooks/useLiveSync";
import { useToast } from "../../contexts/ToastContext";

const PRESET_UNITS = [
  "Nos", "Bags", "Ton", "Kg", "Brass", "CFT", "Cum", "Sq.ft", "Sq.m",
  "Trip", "Load", "Ltr", "Mtr", "Custom"
];

export default function MasterDataTab({ locationId }: { locationId: number }) {
  const { showToast, confirmAction } = useToast();
  const [activeTab, setActiveTab] = useState<'materials' | 'teams'>('materials');
  const [data, setData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<any>({
    name: "",
    category: "",
    defaultUnit: "Nos",
    defaultRate: "",
    notes: ""
  });

  const fetchData = async () => {
    try {
      const endpoint = activeTab === 'materials' ? '/master/materials' : '/master/teams';
      const result = await apiFetch(`${endpoint}?locationId=${locationId}`);
      setData(result || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, locationId]);

  useLiveSync(() => {
    fetchData();
  }, 3500);

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: "",
      category: "",
      defaultUnit: "Nos",
      defaultRate: "",
      notes: ""
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      showToast("Name is required", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const url = editingId ? `/master/${activeTab}/${editingId}` : `/master/${activeTab}`;
      const method = editingId ? "PUT" : "POST";
      const payload: any = { locationId, ...formData };
      
      await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });
      triggerSync("master_data");
      setIsModalOpen(false);
      resetForm();
      showToast(editingId ? "Master record updated" : "Master record created", "success");
      fetchData();
    } catch (err: any) {
      showToast(err.message || "Failed to save master record.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const openEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      name: item.name || "",
      category: item.category || "",
      defaultUnit: item.defaultUnit || "Nos",
      defaultRate: item.defaultRate !== undefined && item.defaultRate !== null ? String(item.defaultRate) : "",
      notes: item.notes || ""
    });
    setIsModalOpen(true);
  };
  
  const handleDelete = async (id: number) => {
    const confirmed = await confirmAction({
      title: "Delete Master Record",
      message: "Are you sure you want to delete this master record?",
      confirmLabel: "Delete",
      isDanger: true
    });
    if (!confirmed) return;
    try {
      const endpoint = activeTab === 'materials' ? `/master/materials/${id}` : `/master/teams/${id}`;
      await apiFetch(endpoint, { method: "DELETE" });
      triggerSync("master_data");
      showToast("Record deleted", "success");
      fetchData();
    } catch (e: any) {
      showToast(e.message || "Error deleting record", "error");
    }
  };

  const openModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const q = searchTerm.toLowerCase();
    return data.filter(item => 
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q)) ||
      (item.notes && item.notes.toLowerCase().includes(q))
    );
  }, [data, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl max-w-md">
        <button
          onClick={() => { setActiveTab('materials'); setSearchTerm(''); }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'materials' ? 'bg-white shadow-sm text-indigo-700 font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Box className="w-4 h-4" /> Materials Master
        </button>
        <button
          onClick={() => { setActiveTab('teams'); setSearchTerm(''); }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'teams' ? 'bg-white shadow-sm text-indigo-700 font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <HardHat className="w-4 h-4" /> Labour Teams
        </button>
      </div>

      {/* Header with Search & Add Button */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder={`Search ${activeTab === 'materials' ? 'materials' : 'teams'}...`}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={openModal}
          className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" /> Add {activeTab === 'materials' ? 'Material' : 'Team'}
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">{activeTab === 'materials' ? 'Material Name' : 'Team / Contractor Name'}</th>
                {activeTab === 'materials' && (
                  <>
                    <th className="p-3">Category</th>
                    <th className="p-3">Default Unit</th>
                    <th className="p-3">Default Rate (₹)</th>
                  </>
                )}
                {activeTab === 'teams' && (
                  <th className="p-3">Notes / Scope</th>
                )}
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="p-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                  <td className="p-3 font-bold text-slate-900">{item.name}</td>
                  
                  {activeTab === 'materials' && (
                    <>
                      <td className="p-3 text-slate-600">{item.category || "-"}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {item.defaultUnit || "Nos"}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-medium text-slate-800">
                        {item.defaultRate ? `₹${Number(item.defaultRate).toLocaleString()}` : "-"}
                      </td>
                    </>
                  )}

                  {activeTab === 'teams' && (
                    <td className="p-3 text-slate-500 max-w-xs truncate">{item.notes || "-"}</td>
                  )}

                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No {activeTab === 'materials' ? 'materials' : 'teams'} found. Click &quot;Add {activeTab === 'materials' ? 'Material' : 'Team'}&quot; to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Responsive Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? `Edit ${activeTab === 'materials' ? 'Material' : 'Team'}` : `Add New ${activeTab === 'materials' ? 'Material' : 'Team'}`}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {activeTab === 'materials' ? 'Material Name' : 'Team / Contractor Name'} *
            </label>
            <input
              required
              type="text"
              placeholder={activeTab === 'materials' ? 'e.g. Cement, Sand, Steel, Gravel' : 'e.g. RCC Team, Mason Team, Plumbing'}
              value={formData.name || ''}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          {activeTab === 'materials' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category / Group</label>
                  <input
                    type="text"
                    placeholder="e.g. Civil, Finishing, Electrical"
                    value={formData.category || ''}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Default Unit</label>
                  <select
                    value={formData.defaultUnit || 'Nos'}
                    onChange={e => setFormData({...formData, defaultUnit: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    {PRESET_UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Default Rate (₹)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={formData.defaultRate || ''}
                  onChange={e => setFormData({...formData, defaultRate: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            </>
          )}

          {activeTab === 'teams' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Scope of Work</label>
              <textarea
                rows={3}
                placeholder="Details about this team or contractor"
                value={formData.notes || ''}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-md transition-colors cursor-pointer"
          >
            {isSubmitting ? "Saving..." : (editingId ? "Update Record" : "Save Record")}
          </button>
        </form>
      </Modal>
    </div>
  );
}
