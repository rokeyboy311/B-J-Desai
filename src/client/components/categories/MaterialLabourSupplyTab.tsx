import React, { useState, useEffect } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Plus, PackageOpen, Trash2, Settings2 } from "lucide-react";

const PRESET_MATERIALS = [
  "Fuse box",
  "Lugs",
  "Wire 1.5 sqmm",
  "Wire 2.5 sqmm",
  "Switches",
  "Sockets",
  "MCB 10A",
  "MCB 16A",
  "MCB 32A",
  "PVC Pipe",
  "Casing Capping"
];

const PRESET_TEAMS = [
  "Team Alpha",
  "Team Beta",
  "Fitting Team 1"
];

export default function MaterialLabourSupplyTab({ locationId }: { locationId: number }) {
  const [records, setRecords] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [materialOptions, setMaterialOptions] = useState<string[]>(PRESET_MATERIALS);
  
  const [teamOptions, setTeamOptions] = useState<string[]>([]);
  const [isManageTeamsOpen, setIsManageTeamsOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    siteLocationName: "",
    teamName: "",
  });

  const [materials, setMaterials] = useState([{ name: "", quantity: "" }]);

  useEffect(() => { 
    loadData();
    const savedTeams = localStorage.getItem(`managed_teams_${locationId}`);
    if (savedTeams) {
      setTeamOptions(JSON.parse(savedTeams));
    } else {
      setTeamOptions(PRESET_TEAMS);
    }
  }, [locationId]);

  const loadData = async () => {
    try {
      const res = await apiFetch(`/materials/labour-supply?locationId=${locationId}`);
      setRecords(res || []);
      
      if (res && res.length > 0) {
        const historyMats = res.map((r: any) => r.materialName).filter(Boolean);
        const uniqueMats = Array.from(new Set([...PRESET_MATERIALS, ...historyMats]));
        setMaterialOptions(uniqueMats as string[]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveTeamOptions = (newOptions: string[]) => {
    setTeamOptions(newOptions);
    localStorage.setItem(`managed_teams_${locationId}`, JSON.stringify(newOptions));
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
      await Promise.all(materials.map(mat => 
        apiFetch("/materials/labour-supply", {
          method: "POST",
          body: JSON.stringify({ 
            ...formData, 
            locationId,
            partyName: formData.teamName || "N/A", 
            workDescription: formData.siteLocationName || "N/A",
            materialName: mat.name,
            materialQuantity: mat.quantity || "0",
            materialAmount: 0,
            labourAmount: 0,
            taxPercentage: 0,
            paymentStatus: "UNPAID"
          }),
        })
      ));
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this record?")) return;
    try {
      await apiFetch(`/materials/labour-supply/${id}`, { method: "DELETE" });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split("T")[0],
      siteLocationName: "",
      teamName: "",
    });
    setMaterials([{ name: "", quantity: "" }]);
  };

  const updateMaterial = (index: number, field: "name" | "quantity", value: string) => {
    const newMats = [...materials];
    newMats[index][field] = value;
    setMaterials(newMats);
  };

  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const addMaterialRow = () => {
    setMaterials([...materials, { name: "", quantity: "" }]);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h3 className="font-bold text-gray-900">Site Supplies</h3>
          <p className="text-xs text-gray-500">Track materials and teams assigned to sites</p>
        </div>
        <button type="button" onClick={() => { resetForm(); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 transition-colors text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Site Supply
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/80 text-gray-600 border-b border-gray-100">
              <tr>
                <th className="p-4 font-semibold text-xs uppercase tracking-wider">Date</th>
                <th className="p-4 font-semibold text-xs uppercase tracking-wider">Site Location</th>
                <th className="p-4 font-semibold text-xs uppercase tracking-wider">Team Name</th>
                <th className="p-4 font-semibold text-xs uppercase tracking-wider">Material</th>
                <th className="p-4 font-semibold text-xs uppercase tracking-wider text-right">Qty</th>
                <th className="p-4 font-semibold text-xs uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    <PackageOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No site supplies recorded yet.
                  </td>
                </tr>
              ) : records.map(r => (
                <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="p-4 whitespace-nowrap text-gray-700">
                    {new Date(r.date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="p-4 font-medium text-gray-900">
                    {r.siteLocationName || r.workDescription || '-'}
                  </td>
                  <td className="p-4 text-gray-700">
                    {r.teamName || r.partyName || '-'}
                  </td>
                  <td className="p-4">
                    <span className="inline-flex px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-semibold">
                      {r.materialName || '-'}
                    </span>
                  </td>
                  <td className="p-4 text-right font-medium text-gray-900">
                    {Number(r.materialQuantity || 0).toLocaleString()}
                  </td>
                  <td className="p-4 text-center">
                    <button type="button" onClick={() => handleDelete(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Site Supply Record">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500" required />
            </div>
            
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Site Location Name *</label>
              <input type="text" placeholder="e.g. Tower B, Floor 3" value={formData.siteLocationName} onChange={e => setFormData({...formData, siteLocationName: e.target.value})} className="w-full p-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500" required />
            </div>

            <div className="sm:col-span-2">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-gray-700">Team Name *</label>
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
                className="w-full p-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" 
                required 
              >
                <option value="" disabled>Select a team...</option>
                {teamOptions.map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t mt-4 space-y-3">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Material List *</label>
            {materials.map((mat, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1">
                  <input 
                    type="text" 
                    list="material-options"
                    placeholder="Select or enter material..." 
                    value={mat.name} 
                    onChange={e => updateMaterial(index, "name", e.target.value)} 
                    className="w-full p-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50" 
                    required 
                  />
                </div>
                <div className="w-24">
                  <input 
                    type="number" inputMode="decimal" 
                    step="0.01" 
                    placeholder="Qty" 
                    value={mat.quantity} 
                    onChange={e => updateMaterial(index, "quantity", e.target.value)} 
                    className="w-full p-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50" 
                    required 
                  />
                </div>
                {materials.length > 1 && (
                  <button type="button"  onClick={() => removeMaterial(index)} className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
            <button type="button"  onClick={addMaterialRow} className="mt-2 text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> Add another material
            </button>
            <datalist id="material-options">
              {materialOptions.map(mat => (
                <option key={mat} value={mat} />
              ))}
            </datalist>
          </div>

          <button type="submit"  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow transition-colors mt-6">
            Save Site Supply
          </button>
        </form>
      </Modal>

      <Modal isOpen={isManageTeamsOpen} onClose={() => setIsManageTeamsOpen(false)} title="Manage Teams">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Enter new team name" 
              value={newTeamName} 
              onChange={e => setNewTeamName(e.target.value)} 
              className="flex-1 p-2 border rounded-lg text-sm"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTeam())}
            />
            <button 
              type="button" 
              onClick={handleAddTeam}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              Add
            </button>
          </div>
          
          <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
            <ul className="divide-y">
              {teamOptions.length === 0 ? (
                <li className="p-4 text-center text-sm text-gray-500">No teams added.</li>
              ) : (
                teamOptions.map(team => (
                  <li key={team} className="flex justify-between items-center p-3 hover:bg-gray-50">
                    <span className="text-sm font-medium text-gray-800">{team}</span>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveTeam(team)}
                      className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                      title="Remove team"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
          <button type="button"  onClick={() => setIsManageTeamsOpen(false)} className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            Done
          </button>
        </div>
      </Modal>
    </div>
  );
}
