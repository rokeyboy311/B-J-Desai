import React, { useState, useEffect } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Plus, Trash2, Settings2 } from "lucide-react";
import { useLiveSync } from "../../hooks/useLiveSync";
import { useToast } from "../../contexts/ToastContext";

interface MasterItem {
  id: number;
  name: string;
}

export default function IncomeExpenseTab({ locationId }: { locationId: number }) {
  const { showToast, confirmAction } = useToast();
  const [records, setRecords] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ totalExpense: 0, totalRefundable: 0 });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [parties, setParties] = useState<MasterItem[]>([]);
  const [teams, setTeams] = useState<MasterItem[]>([]);
  const [isManagePartiesOpen, setIsManagePartiesOpen] = useState(false);
  const [isManageTeamsOpen, setIsManageTeamsOpen] = useState(false);
  const [newPartyName, setNewPartyName] = useState("");
  const [newTeamName, setNewTeamName] = useState("");

  const [formData, setFormData] = useState({
    type: "EXPENSE",
    date: new Date().toISOString().split("T")[0],
    partyName: "",
    teamName: "",
    amount: "",
    refundableAmount: "0",
    description: "",
  });

  const loadData = async (isBackground = false) => {
    try {
      if (!isBackground && records.length === 0) setLoading(true);
      const [recordsRes, metricsRes] = await Promise.all([
        apiFetch(`/records?locationId=${locationId}&type=EXPENSE`),
        apiFetch(`/records/metrics?locationId=${locationId}`)
      ]);
      setRecords(recordsRes.filter((r: any) => r.type === "EXPENSE"));
      setMetrics(metricsRes);
    } catch (error) {
      console.error("Failed to load records/metrics", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMasterData = async () => {
    try {
      const [partiesRes, teamsRes] = await Promise.all([
        apiFetch(`/master/parties?locationId=${locationId}`),
        apiFetch(`/master/teams?locationId=${locationId}`)
      ]);
      setParties(Array.isArray(partiesRes) ? partiesRes : []);
      setTeams(Array.isArray(teamsRes) ? teamsRes : []);
    } catch (e) {
      console.error("Failed to load master data", e);
    }
  };

  useEffect(() => {
    loadData(false);
    loadMasterData();
  }, [locationId]);

  useLiveSync(() => {
    loadData(true);
  }, 3500);

  const handleAddParty = async () => {
    const trimmed = newPartyName.trim();
    if (!trimmed) {
      showToast("Please enter a party name", "error");
      return;
    }
    if (parties.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast("Party already exists", "error");
      return;
    }
    try {
      await apiFetch("/master/parties", {
        method: "POST",
        body: JSON.stringify({ name: trimmed, locationId })
      });
      setNewPartyName("");
      await loadMasterData();
      showToast(`Party "${trimmed}" added successfully`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to add party", "error");
    }
  };

  const handleRemoveParty = async (party: MasterItem) => {
    const confirmed = await confirmAction({
      title: "Remove Party",
      message: `Are you sure you want to remove party "${party.name}"?`,
      confirmLabel: "Remove",
      isDanger: true
    });
    if (!confirmed) return;

    try {
      await apiFetch(`/master/parties/${party.id}`, { method: "DELETE" });
      if (formData.partyName === party.name) {
        setFormData({ ...formData, partyName: "" });
      }
      await loadMasterData();
      showToast(`Party "${party.name}" removed`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to delete party", "error");
    }
  };

  const handleAddTeam = async () => {
    const trimmed = newTeamName.trim();
    if (!trimmed) {
      showToast("Please enter a team name", "error");
      return;
    }
    if (teams.some(t => t.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast("Team already exists", "error");
      return;
    }
    try {
      await apiFetch("/master/teams", {
        method: "POST",
        body: JSON.stringify({ name: trimmed, locationId })
      });
      setNewTeamName("");
      await loadMasterData();
      showToast(`Team "${trimmed}" added successfully`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to add team", "error");
    }
  };

  const handleRemoveTeam = async (team: MasterItem) => {
    const confirmed = await confirmAction({
      title: "Remove Team",
      message: `Are you sure you want to remove team "${team.name}"?`,
      confirmLabel: "Remove",
      isDanger: true
    });
    if (!confirmed) return;

    try {
      await apiFetch(`/master/teams/${team.id}`, { method: "DELETE" });
      if (formData.teamName === team.name) {
        setFormData({ ...formData, teamName: "" });
      }
      await loadMasterData();
      showToast(`Team "${team.name}" removed`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to delete team", "error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast("Please enter a valid amount greater than 0", "error");
      return;
    }
    if (!formData.partyName.trim()) {
      showToast("Please select or enter a party name", "error");
      return;
    }

    try {
      await apiFetch("/records", {
        method: "POST",
        body: JSON.stringify({ ...formData, locationId }),
      });
      setIsModalOpen(false);
      setFormData({
        type: "EXPENSE",
        date: new Date().toISOString().split("T")[0],
        partyName: "",
        teamName: "",
        amount: "",
        refundableAmount: "0",
        description: "",
      });
      showToast("Expense record saved successfully", "success");
      loadData();
    } catch (error: any) {
      showToast(error.message || "Failed to save record", "error");
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirmAction({
      title: "Delete Expense",
      message: "Are you sure you want to delete this expense record?",
      confirmLabel: "Delete",
      isDanger: true
    });
    if (!confirmed) return;

    try {
      await apiFetch(`/records/${id}`, { method: "DELETE" });
      showToast("Expense deleted", "success");
      loadData();
    } catch (error: any) {
      showToast(error.message || "Failed to delete record", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
          <div className="text-red-600 text-xs font-bold uppercase tracking-wider">Actual Expense</div>
          <div className="text-2xl font-black text-red-700 mt-1">₹{(Number(metrics?.totalExpense || 0)).toLocaleString()}</div>
          <div className="text-[11px] text-red-600/70 mt-0.5">Excludes refundable security amounts</div>
        </div>
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="text-slate-600 text-xs font-bold uppercase tracking-wider">Refundable Amount</div>
          <div className="text-2xl font-black text-slate-900 mt-1">₹{(Number(metrics?.totalRefundable || 0)).toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Tracked separately from actual project expense</div>
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          type="button" 
          onClick={() => setIsModalOpen(true)} 
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-xs hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Expenses
        </button>
      </div>

      <div className="overflow-x-auto bg-white rounded-2xl border border-slate-100 shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="p-4 font-semibold">Date</th>
              <th className="p-4 font-semibold">Party Name</th>
              <th className="p-4 font-semibold">Team Name</th>
              <th className="p-4 font-semibold">Details</th>
              <th className="p-4 font-semibold text-right">Amount</th>
              <th className="p-4 font-semibold text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                  No expense records found for this location.
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5 whitespace-nowrap text-slate-700 font-medium text-xs">{r.date}</td>
                  <td className="px-4 py-3.5 font-bold text-slate-900 text-xs">{r.partyName}</td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 text-xs">{r.teamName || '-'}</td>
                  <td className="px-4 py-3.5 text-slate-600 text-xs max-w-[200px] truncate" title={r.description}>{r.description || '-'}</td>
                  <td className="px-4 py-3.5 text-right font-bold text-rose-600 text-xs">
                    ₹{Number(r.amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-center font-medium">
                    <button 
                      type="button" 
                      onClick={() => handleDelete(r.id)} 
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg hover:text-rose-700 transition-colors"
                      title="Delete expense"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Expenses">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Date *</label>
              <input 
                type="date" 
                value={formData.date} 
                onChange={e => setFormData({...formData, date: e.target.value})} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" 
                required 
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-700">Select Party *</label>
                <button 
                  type="button" 
                  onClick={() => setIsManagePartiesOpen(true)}
                  className="text-xs text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-1"
                >
                  <Settings2 className="w-3 h-3" /> Manage Party
                </button>
              </div>
              <select 
                value={formData.partyName} 
                onChange={e => setFormData({...formData, partyName: e.target.value})} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" 
                required 
              >
                <option value="" disabled>Select a party...</option>
                {parties.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-700">Select Team</label>
                <button 
                  type="button" 
                  onClick={() => setIsManageTeamsOpen(true)}
                  className="text-xs text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-1"
                >
                  <Settings2 className="w-3 h-3" /> Manage Teams
                </button>
              </div>
              <select 
                value={formData.teamName} 
                onChange={e => setFormData({...formData, teamName: e.target.value})} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" 
              >
                <option value="">No team / None</option>
                {teams.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Amount (₹) *</label>
              <input 
                type="number" 
                inputMode="decimal" 
                step="0.01" 
                min="0.01"
                value={formData.amount} 
                onChange={e => setFormData({...formData, amount: e.target.value})} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" 
                placeholder="0.00"
                required 
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Details (Description)</label>
              <textarea 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" 
                rows={2} 
                placeholder="Enter expense details..."
              ></textarea>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-3">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)} 
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-indigo-700 transition-colors"
            >
              Save Expense
            </button>
          </div>
        </form>
      </Modal>

      {/* Manage Parties Modal */}
      <Modal isOpen={isManagePartiesOpen} onClose={() => setIsManagePartiesOpen(false)} title="Manage Parties">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Enter new party name" 
              value={newPartyName} 
              onChange={e => setNewPartyName(e.target.value)} 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-xs"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddParty())}
            />
            <button 
              type="button" 
              onClick={handleAddParty}
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-indigo-700 transition-colors shrink-0"
            >
              Add
            </button>
          </div>
          
          <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
            <ul className="divide-y divide-slate-100">
              {parties.length === 0 ? (
                <li className="p-4 text-center text-xs text-slate-500">No parties added yet.</li>
              ) : (
                parties.map(party => (
                  <li key={party.id} className="flex justify-between items-center p-3 hover:bg-slate-50 transition-colors">
                    <span className="text-xs font-bold text-slate-800">{party.name}</span>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveParty(party)}
                      className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg hover:text-rose-700 transition-colors"
                      title="Remove party"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
          <button 
            type="button" 
            onClick={() => setIsManagePartiesOpen(false)} 
            className="w-full py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors text-xs font-bold"
          >
            Done
          </button>
        </div>
      </Modal>

      {/* Manage Teams Modal */}
      <Modal isOpen={isManageTeamsOpen} onClose={() => setIsManageTeamsOpen(false)} title="Manage Teams">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Enter new team name" 
              value={newTeamName} 
              onChange={e => setNewTeamName(e.target.value)} 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-xs"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTeam())}
            />
            <button 
              type="button" 
              onClick={handleAddTeam}
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-indigo-700 transition-colors shrink-0"
            >
              Add
            </button>
          </div>
          
          <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
            <ul className="divide-y divide-slate-100">
              {teams.length === 0 ? (
                <li className="p-4 text-center text-xs text-slate-500">No teams added yet.</li>
              ) : (
                teams.map(team => (
                  <li key={team.id} className="flex justify-between items-center p-3 hover:bg-slate-50 transition-colors">
                    <span className="text-xs font-bold text-slate-800">{team.name}</span>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveTeam(team)}
                      className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg hover:text-rose-700 transition-colors"
                      title="Remove team"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
          <button 
            type="button" 
            onClick={() => setIsManageTeamsOpen(false)} 
            className="w-full py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors text-xs font-bold"
          >
            Done
          </button>
        </div>
      </Modal>
    </div>
  );
}
