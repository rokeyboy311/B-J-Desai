import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Plus, Pencil, Trash2, Box, Users, HardHat, Building2, Search, Check } from "lucide-react";
import { useLiveSync, triggerSync } from "../../hooks/useLiveSync";
import { useToast } from "../../contexts/ToastContext";

export default function MasterDataTab({ locationId }: { locationId: number }) {
  const { showToast, confirmAction } = useToast();
  const [activeTab, setActiveTab] = useState<'materials'|'labour'|'teams'|'parties'>('materials');
  const [data, setData] = useState<any[]>([]);
  const [teamsList, setTeamsList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<any>({
    name: "",
    category: "",
    defaultUnit: "Nos",
    defaultRate: "",
    minStock: "",
    mobile: "",
    workType: "",
    dailyRate: "",
    teamId: "",
    phone: "",
    gst: "",
    address: "",
    notes: ""
  });

  const fetchData = async () => {
    try {
      let endpoint = '';
      if (activeTab === 'materials') endpoint = '/master/materials';
      else if (activeTab === 'labour') endpoint = '/master/labour';
      else if (activeTab === 'teams') endpoint = '/master/teams';
      else if (activeTab === 'parties') endpoint = '/master/parties';
      
      const result = await apiFetch(`${endpoint}?locationId=${locationId}`);
      setData(result || []);

      if (activeTab === 'labour') {
        const teams = await apiFetch(`/master/teams?locationId=${locationId}`).catch(() => []);
        setTeamsList(teams || []);
      }
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
      minStock: "",
      mobile: "",
      workType: "",
      dailyRate: "",
      teamId: "",
      phone: "",
      gst: "",
      address: "",
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
      minStock: item.minStock !== undefined && item.minStock !== null ? String(item.minStock) : "",
      mobile: item.mobile || "",
      workType: item.workType || "",
      dailyRate: item.dailyRate !== undefined && item.dailyRate !== null ? String(item.dailyRate) : "",
      teamId: item.teamId ? String(item.teamId) : "",
      phone: item.phone || "",
      gst: item.gst || "",
      address: item.address || "",
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
      let endpoint = '';
      if (activeTab === 'materials') endpoint = `/master/materials/${id}`;
      else if (activeTab === 'labour') endpoint = `/master/labour/${id}`;
      else if (activeTab === 'teams') endpoint = `/master/teams/${id}`;
      else if (activeTab === 'parties') endpoint = `/master/parties/${id}`;
      
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
      (item.gst && item.gst.toLowerCase().includes(q)) ||
      (item.phone && item.phone.toLowerCase().includes(q)) ||
      (item.mobile && item.mobile.toLowerCase().includes(q))
    );
  }, [data, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Tab Navigation - Mobile scrollable */}
      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl overflow-x-auto no-scrollbar">
        <button
          onClick={() => { setActiveTab('materials'); setSearchTerm(''); }}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'materials' ? 'bg-white shadow-sm text-indigo-700 font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Box className="w-4 h-4" /> Materials
        </button>
        <button
          onClick={() => { setActiveTab('labour'); setSearchTerm(''); }}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'labour' ? 'bg-white shadow-sm text-indigo-700 font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Users className="w-4 h-4" /> Labour Workers
        </button>
        <button
          onClick={() => { setActiveTab('teams'); setSearchTerm(''); }}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'teams' ? 'bg-white shadow-sm text-indigo-700 font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <HardHat className="w-4 h-4" /> Labour Teams
        </button>
        <button
          onClick={() => { setActiveTab('parties'); setSearchTerm(''); }}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'parties' ? 'bg-white shadow-sm text-indigo-700 font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Building2 className="w-4 h-4" /> Parties / Vendors
        </button>
      </div>

      {/* Header with Search & Add Button */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={openModal}
          className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" /> Add {activeTab === 'materials' ? 'Material' : activeTab === 'labour' ? 'Labour' : activeTab === 'teams' ? 'Team' : 'Party'}
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
              <tr>
                <th className="p-3">Name</th>
                {activeTab === 'parties' && (
                  <>
                    <th className="p-3">GST Number</th>
                    <th className="p-3">Address</th>
                  </>
                )}
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{item.name}</td>
                  
                  {activeTab === 'parties' && (
                    <>
                      <td className="p-3 font-mono font-medium text-slate-700">{item.gst || "-"}</td>
                      <td className="p-3 text-slate-500 max-w-xs truncate">{item.address || "-"}</td>
                    </>
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
                    No {activeTab} found. Click &quot;Add {activeTab.replace(/s$/, '')}&quot; to create one.
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
        title={editingId ? `Edit ${activeTab.replace(/s$/, '')}` : `Add New ${activeTab.replace(/s$/, '')}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {activeTab === 'materials' ? 'Material Name' : activeTab === 'labour' ? 'Labour Worker Name' : activeTab === 'teams' ? 'Team / Contractor Name' : 'Party / Company Name'} *
            </label>
            <input
              required
              type="text"
              placeholder="Enter name"
              value={formData.name || ''}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>
          
          {/* PARTIES SPECIFIC FIELDS */}
          {activeTab === 'parties' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">GST Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 24AAAAA0000A1Z5"
                    value={formData.gst || ''}
                    onChange={e => setFormData({...formData, gst: e.target.value.toUpperCase()})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Address / Location</label>
                  <input
                    type="text"
                    placeholder="City or Full Address"
                    value={formData.address || ''}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </>
          )}

          {activeTab !== 'materials' && activeTab !== 'teams' && activeTab !== 'labour' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Remarks</label>
              <input
                type="text"
                placeholder="Optional description or details"
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
