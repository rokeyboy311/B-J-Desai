import React, { useState, useEffect } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Plus, Trash2, Settings2 } from "lucide-react";

const PRESET_PARTIES = ["Supplier A", "Contractor B"];
const PRESET_TEAMS = ["Team Alpha", "Team Beta"];

export default function IncomeExpenseTab({ locationId }: { locationId: number }) {
  const [records, setRecords] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ totalExpense: 0, totalRefundable: 0 });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [partyOptions, setPartyOptions] = useState<string[]>([]);
  const [teamOptions, setTeamOptions] = useState<string[]>([]);
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
    description: "",
  });

  useEffect(() => {
    loadData();
    loadMasterData();
  }, [locationId]);

  const loadMasterData = async () => {
    try {
      const parties = await apiFetch(`/master/parties?locationId=${locationId}`);
      if (parties && parties.length > 0) {
        setPartyOptions(parties.map((p: any) => p.name));
      } else {
        setPartyOptions(PRESET_PARTIES);
      }
      const teams = await apiFetch(`/master/teams?locationId=${locationId}`);
      if (teams && teams.length > 0) {
        setTeamOptions(teams.map((t: any) => t.name));
      } else {
        setTeamOptions(PRESET_TEAMS);
      }
    } catch (e) {
      console.error(e);
      setPartyOptions(PRESET_PARTIES);
      setTeamOptions(PRESET_TEAMS);
    }
  };

  const loadData = async () => {
    try {
      const [recordsRes, metricsRes] = await Promise.all([
        apiFetch(`/records?locationId=${locationId}&type=EXPENSE`),
        apiFetch(`/records/metrics?locationId=${locationId}`)
      ]);
      setRecords(recordsRes.filter((r: any) => r.type === "EXPENSE"));
      setMetrics(metricsRes);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const savePartyOptions = (newOptions: string[]) => {
    setPartyOptions(newOptions);
    localStorage.setItem(`managed_parties_${locationId}`, JSON.stringify(newOptions));
  };

  const saveTeamOptions = (newOptions: string[]) => {
    setTeamOptions(newOptions);
    localStorage.setItem(`managed_teams_${locationId}`, JSON.stringify(newOptions));
  };

  const handleAddParty = () => {
    if (newPartyName.trim() && !partyOptions.includes(newPartyName.trim())) {
      savePartyOptions([...partyOptions, newPartyName.trim()]);
      setNewPartyName("");
    }
  };

  const handleRemoveParty = (party: string) => {
    savePartyOptions(partyOptions.filter(p => p !== party));
    if (formData.partyName === party) {
      setFormData({ ...formData, partyName: "" });
    }
  };

  const handleAddTeam = () => {
    if (newTeamName.trim() && !teamOptions.includes(newTeamName.trim())) {
      saveTeamOptions([...teamOptions, newTeamName.trim()]);
      setNewTeamName("");
    }
  };

  const handleRemoveTeam = (team: string) => {
    saveTeamOptions(teamOptions.filter(t => t !== team));
    if (formData.teamName === team) {
      setFormData({ ...formData, teamName: "" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/records", {
        method: "POST",
        body: JSON.stringify({ ...formData, locationId }),
      });
      setIsModalOpen(false);
      setFormData({
        ...formData,
        amount: "",
        description: "",
      });
      loadData();
    } catch (error) {
      alert("Failed to save record");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    try {
      await apiFetch(`/records/${id}`, { method: "DELETE" });
      loadData();
    } catch (error) {
      alert("Failed to delete");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
          <div className="text-red-600 text-sm font-medium">Actual Expense</div>
          <div className="text-2xl font-bold text-red-700">₹{(Number(metrics?.totalExpense || 0)).toLocaleString()}</div>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-gray-200">
          <div className="text-slate-600 text-sm font-medium">Refundable</div>
          <div className="text-2xl font-bold text-slate-900">₹{(Number(metrics?.totalRefundable || 0)).toLocaleString()}</div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl shadow-sm hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Expenses
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="p-4 rounded-tl-xl font-medium">Date</th>
              <th className="p-4 font-medium">Party Name</th>
              <th className="p-4 font-medium">Team Name</th>
              <th className="p-4 font-medium">Details</th>
              <th className="p-4 font-medium text-right">Amount</th>
              <th className="p-4 rounded-tr-xl font-medium text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-slate-700 font-medium">{new Date(r.date).toLocaleDateString()}</td>
                <td className="p-4 font-medium">{r.partyName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-slate-700 font-medium">{r.teamName || '-'}</td>
                <td className="p-4 text-slate-600 max-w-[200px] truncate" title={r.description}>{r.description || '-'}</td>
                <td className="p-4 text-right font-medium text-red-600">
                  ₹{Number(r.amount).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center font-medium">
                  <button type="button" onClick={() => handleDelete(r.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg hover:text-rose-700"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Expenses">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date *</label>
              <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" required />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-semibold text-slate-700">Select Party *</label>
                <button 
                  type="button" 
                  onClick={() => setIsManagePartiesOpen(true)}
                  className="text-xs text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1"
                >
                  <Settings2 className="w-3 h-3" /> Manage Party
                </button>
              </div>
              <select 
                value={formData.partyName} 
                onChange={e => setFormData({...formData, partyName: e.target.value})} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white" 
                required 
              >
                <option value="" disabled>Select a party...</option>
                {partyOptions.map(party => (
                  <option key={party} value={party}>{party}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-semibold text-slate-700">Select Team</label>
                <button 
                  type="button" 
                  onClick={() => setIsManageTeamsOpen(true)}
                  className="text-xs text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1"
                >
                  <Settings2 className="w-3 h-3" /> Manage Teams
                </button>
              </div>
              <select 
                value={formData.teamName} 
                onChange={e => setFormData({...formData, teamName: e.target.value})} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white" 
              >
                <option value="">No team / None</option>
                {teamOptions.map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Amount *</label>
              <input type="number" inputMode="decimal" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" required />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Details (Description)</label>
              <textarea 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" 
                rows={3} 
                placeholder="Enter expense details..."
              ></textarea>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <button type="button"  onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit"  className="px-4 py-2 bg-indigo-600 text-white rounded-xl shadow-sm hover:bg-indigo-700 transition-colors">Save Expense</button>
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddParty())}
            />
            <button 
              type="button" 
              onClick={handleAddParty}
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-indigo-700 transition-colors"
            >
              Add
            </button>
          </div>
          
          <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
            <ul className="divide-y">
              {partyOptions.length === 0 ? (
                <li className="p-4 text-center text-sm text-slate-500">No parties added.</li>
              ) : (
                partyOptions.map(party => (
                  <li key={party} className="flex justify-between items-center p-3 hover:bg-slate-50 transition-colors">
                    <span className="text-sm font-medium text-slate-800">{party}</span>
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
          <button type="button"  onClick={() => setIsManagePartiesOpen(false)} className="w-full py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium">
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTeam())}
            />
            <button 
              type="button" 
              onClick={handleAddTeam}
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-indigo-700 transition-colors"
            >
              Add
            </button>
          </div>
          
          <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
            <ul className="divide-y">
              {teamOptions.length === 0 ? (
                <li className="p-4 text-center text-sm text-slate-500">No teams added.</li>
              ) : (
                teamOptions.map(team => (
                  <li key={team} className="flex justify-between items-center p-3 hover:bg-slate-50 transition-colors">
                    <span className="text-sm font-medium text-slate-800">{team}</span>
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
          <button type="button"  onClick={() => setIsManageTeamsOpen(false)} className="w-full py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium">
            Done
          </button>
        </div>
      </Modal>
    </div>
  );
}
