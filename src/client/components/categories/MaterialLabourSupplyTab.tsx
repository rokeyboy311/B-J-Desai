import React, { useState, useEffect } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Plus, Trash2, Wrench, Package, FileText, Check } from "lucide-react";

export default function MaterialLabourSupplyTab({ locationId }: { locationId: number }) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  const [materials, setMaterials] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);

  // Parent form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    teamId: "",
    responsiblePerson: "",
    workDescription: "",
    referenceNumber: "",
    notes: "",
    investorId: "",
  });

  // Items list state
  const [items, setItems] = useState<any[]>([{ materialId: "", quantity: "", rate: "" }]);

  useEffect(() => {
    fetchData();
  }, [locationId]);

  const fetchData = async () => {
    try {
      const [data, mats, tms, invs] = await Promise.all([
        apiFetch(`/site-supplies?locationId=${locationId}`),
        apiFetch(`/master/materials?locationId=${locationId}`).catch(() => []),
        apiFetch(`/master/teams?locationId=${locationId}`).catch(() => []),
        apiFetch(`/master/parties?locationId=${locationId}`).catch(() => []), // as investors
      ]);
      setRecords(data || []);
      setMaterials(mats || []);
      setTeams(tms || []);
      setParties(invs || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => setItems([...items, { materialId: "", quantity: "", rate: "" }]);
  
  const removeItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    
    // Auto-fill rate based on material
    if (field === 'materialId') {
      const mat = materials.find(m => m.id.toString() === value);
      if (mat && mat.defaultRate) {
        newItems[index].rate = mat.defaultRate;
      }
    }
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        locationId,
        date: formData.date,
        teamId: formData.teamId ? parseInt(formData.teamId) : undefined,
        responsiblePerson: formData.responsiblePerson,
        workDescription: formData.workDescription,
        referenceNumber: formData.referenceNumber,
        notes: formData.notes,
        investorId: formData.investorId ? parseInt(formData.investorId) : undefined,
        items: items.filter(i => i.materialId && i.quantity).map(i => ({
          materialId: parseInt(i.materialId),
          quantity: i.quantity,
          rate: i.rate || "0"
        }))
      };

      await apiFetch(`/site-supplies`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setIsModalOpen(false);
      setFormData({
        date: new Date().toISOString().split("T")[0],
        teamId: "",
        responsiblePerson: "",
        workDescription: "",
        referenceNumber: "",
        notes: "",
        investorId: "",
      });
      setItems([{ materialId: "", quantity: "", rate: "" }]);
      fetchData();
    } catch (error) {
      alert("Failed to save site supply");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this record? Stock will be reversed.")) return;
    try {
      await apiFetch(`/site-supplies/${id}`, { method: "DELETE" });
      fetchData();
    } catch (error) {
      alert("Failed to delete record");
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.quantity||0) * parseFloat(item.rate||0)), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-slate-800">Site Supplies & Internal Usage</h3>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> New Site Supply
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-3 font-semibold text-slate-600">Date</th>
                <th className="p-3 font-semibold text-slate-600">Team / Person</th>
                <th className="p-3 font-semibold text-slate-600">Work Description</th>
                <th className="p-3 font-semibold text-slate-600 text-right">Items</th>
                <th className="p-3 font-semibold text-slate-600 text-right">Total Amount</th>
                <th className="p-3 font-semibold text-slate-600 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3">{r.date}</td>
                  <td className="p-3 font-medium text-slate-900">
                    {teams.find(t => t.id === r.teamId)?.name || r.responsiblePerson || 'N/A'}
                  </td>
                  <td className="p-3 text-slate-600 max-w-[200px] truncate">{r.workDescription || '-'}</td>
                  <td className="p-3 text-right">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold">
                      {r.items?.length || 0} items
                    </span>
                  </td>
                  <td className="p-3 text-right font-bold text-indigo-700">₹{Number(r.totalAmount).toLocaleString()}</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => { setSelectedRecord(r); setIsDetailsOpen(true); }}
                      className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg mr-2"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {records.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No site supply records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Site Supply">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
              <input type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Labour Team</label>
              <select value={formData.teamId} onChange={e => setFormData({ ...formData, teamId: e.target.value })} className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500">
                <option value="">-- Select Team --</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Work Description</label>
              <input type="text" required placeholder="What work is this for?" value={formData.workDescription} onChange={e => setFormData({ ...formData, workDescription: e.target.value })} className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          
          {/* Multi-Material Lines */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Materials Supplied</label>
            </div>
            
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-white p-2 border rounded-lg shadow-sm">
                  <div className="flex-1 min-w-[150px]">
                    <select
                      required
                      value={item.materialId}
                      onChange={e => updateItem(idx, 'materialId', e.target.value)}
                      className="w-full p-1.5 text-sm border-b focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">Select Material</option>
                      {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="w-[80px]">
                    <input
                      type="number"
                      required min="0" step="0.01"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={e => updateItem(idx, 'quantity', e.target.value)}
                      className="w-full p-1.5 text-sm border-b focus:border-indigo-500 focus:outline-none text-right"
                    />
                  </div>
                  <div className="w-[90px]">
                    <input
                      type="number"
                      min="0" step="0.01"
                      placeholder="Rate (₹)"
                      value={item.rate}
                      onChange={e => updateItem(idx, 'rate', e.target.value)}
                      className="w-full p-1.5 text-sm border-b focus:border-indigo-500 focus:outline-none text-right"
                    />
                  </div>
                  <div className="w-[90px] text-right font-bold text-slate-700 text-sm py-1.5">
                    ₹{((parseFloat(item.quantity||'0') * parseFloat(item.rate||'0'))).toFixed(2)}
                  </div>
                  <button type="button" onClick={() => removeItem(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="mt-3 flex justify-between items-center">
              <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded">
                <Plus className="w-3 h-3" /> Add Row
              </button>
              <div className="text-sm">
                <span className="text-slate-500">Total: </span>
                <span className="font-bold text-indigo-700">₹{totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow text-sm">
            Save Site Supply
          </button>
        </form>
      </Modal>

      {/* Details Modal */}
      {selectedRecord && (
        <Modal isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} title="Site Supply Details">
          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center pb-2 border-b">
              <h4 className="font-bold text-slate-900 text-base">{selectedRecord.workDescription}</h4>
              <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full text-xs font-bold">{selectedRecord.date}</span>
            </div>
            
            <div>
              <p className="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider">Materials Supplied</p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-2 font-medium">Material</th>
                      <th className="p-2 font-medium text-right">Qty</th>
                      <th className="p-2 font-medium text-right">Rate</th>
                      <th className="p-2 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(selectedRecord.items || []).map((item: any, i: number) => {
                      const matName = materials.find(m => m.id === item.materialId)?.name || 'Unknown';
                      return (
                        <tr key={i}>
                          <td className="p-2 font-medium">{matName}</td>
                          <td className="p-2 text-right">{item.quantity}</td>
                          <td className="p-2 text-right">₹{item.rate}</td>
                          <td className="p-2 text-right font-bold">₹{item.amount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-between font-bold text-base text-slate-900 pt-2">
              <span>Total Amount</span>
              <span className="text-indigo-600">₹{Number(selectedRecord.totalAmount).toLocaleString()}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
