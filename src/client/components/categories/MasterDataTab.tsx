import React, { useState, useEffect } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Plus, Trash2, Box, Users, Truck } from "lucide-react";

export default function MasterDataTab({ locationId }: { locationId: number }) {
  const [activeTab, setActiveTab] = useState<'materials'|'labour'|'teams'|'parties'>('materials');
  const [data, setData] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const fetchData = async () => {
    try {
      let endpoint = '';
      if (activeTab === 'materials') endpoint = '/master/materials';
      else if (activeTab === 'labour') endpoint = '/master/labour';
      else if (activeTab === 'teams') endpoint = '/master/teams';
      else if (activeTab === 'parties') endpoint = '/master/parties';
      
      const result = await apiFetch(`${endpoint}?locationId=${locationId}`);
      setData(result || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, locationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let endpoint = '';
      if (activeTab === 'materials') endpoint = '/master/materials';
      else if (activeTab === 'labour') endpoint = '/master/labour';
      else if (activeTab === 'teams') endpoint = '/master/teams';
      else if (activeTab === 'parties') endpoint = '/master/parties';
      
      await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ ...formData, locationId }),
      });
      setIsModalOpen(false);
      setFormData({});
      fetchData();
    } catch (e) {
      alert("Error saving record");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this master record?')) return;
    try {
      let endpoint = '';
      if (activeTab === 'materials') endpoint = `/master/materials/${id}`;
      else if (activeTab === 'labour') endpoint = `/master/labour/${id}`;
      else if (activeTab === 'teams') endpoint = `/master/teams/${id}`;
      else if (activeTab === 'parties') endpoint = `/master/parties/${id}`;
      
      await apiFetch(endpoint, { method: "DELETE" });
      fetchData();
    } catch (e) {
      alert("Error deleting record");
    }
  };

  const openModal = () => {
    setFormData({});
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
        <button onClick={() => setActiveTab('materials')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'materials' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}>Materials</button>
        <button onClick={() => setActiveTab('labour')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'labour' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}>Labour List</button>
        <button onClick={() => setActiveTab('teams')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'teams' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}>Labour Teams</button>
        <button onClick={() => setActiveTab('parties')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'parties' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}>Parties / Customers</button>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-800 capitalize">{activeTab}</h3>
        <button onClick={openModal} className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Add New
        </button>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-3 font-semibold text-slate-600">Name</th>
              {activeTab === 'materials' && <th className="p-3 font-semibold text-slate-600">Default Rate</th>}
              {activeTab === 'labour' && <th className="p-3 font-semibold text-slate-600">Daily Rate</th>}
              <th className="p-3 font-semibold text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map(item => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="p-3 font-medium text-slate-900">{item.name}</td>
                {activeTab === 'materials' && <td className="p-3 text-slate-600">₹{item.defaultRate}</td>}
                {activeTab === 'labour' && <td className="p-3 text-slate-600">₹{item.dailyRate}</td>}
                <td className="p-3 text-right">
                  <button onClick={() => handleDelete(item.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500">No {activeTab} found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Add ${activeTab.replace(/s$/, '')}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
            <input required type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
          </div>
          
          {activeTab === 'materials' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Default Rate (₹)</label>
              <input type="number" step="0.01" value={formData.defaultRate || ''} onChange={e => setFormData({...formData, defaultRate: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
            </div>
          )}

          {activeTab === 'labour' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Daily Rate (₹)</label>
              <input type="number" step="0.01" value={formData.dailyRate || ''} onChange={e => setFormData({...formData, dailyRate: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
            </div>
          )}

          <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">
            Save
          </button>
        </form>
      </Modal>
    </div>
  );
}
