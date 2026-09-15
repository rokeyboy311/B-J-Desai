import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Plus, Trash2, Settings2, Search, FolderOpen, Pencil, X } from "lucide-react";

const PRESET_TEAMS = [
  "Team Alpha",
  "Team Beta",
  "Fitting Team 1"
];

export default function LabourSalaryTab({ locationId }: { locationId: number }) {
  const [records, setRecords] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [teamOptions, setTeamOptions] = useState<string[]>([]);
  const [isManageTeamsOpen, setIsManageTeamsOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  
  // Details Modal
    const [selectedDetails, setSelectedDetails] = useState<{type: 'team'|'labour', name: string, teamName?: string} | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    siteLocationName: "",
    labourTeam: "",
  });

  const [attendances, setAttendances] = useState([
    { labourName: "", typeCategory: "Day", attendanceType: "Full-day", tcQuantity: "", dailyRate: "", upad: "", paymentAmount: "" }
  ]);

  
  useEffect(() => {
    loadData();
    loadMasterData();
  }, [locationId]);

  const loadMasterData = async () => {
    try {
      const parties = await apiFetch(`/master/parties?locationId=${locationId}`);
      if (parties && parties.length > 0) {
        
      } else {
        
      }
      
      const teams = await apiFetch(`/master/teams?locationId=${locationId}`);
      if (teams && teams.length > 0) {
        setTeamOptions(teams.map((t: any) => t.name));
      } else {
        
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadData = async () => {
    try {
      const res = await apiFetch(`/labour?locationId=${locationId}`);
      setRecords(res || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddTeam = async () => {
    const trimmed = newTeamName.trim();
    if (trimmed && !teamOptions.includes(trimmed)) {
      try {
        await apiFetch("/master/teams", {
          method: "POST",
          body: JSON.stringify({ name: trimmed, locationId })
        });
      } catch (err) {
        console.error("Failed to save team:", err);
      }
      setTeamOptions([...teamOptions, trimmed]);
      setNewTeamName("");
    }
  };

  const handleRemoveTeam = (team: string) => {
    setTeamOptions(teamOptions.filter(t => t !== team));
    if (formData.labourTeam === team) {
      setFormData({ ...formData, labourTeam: "" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const att = attendances[0];
        const isDay = att.typeCategory === "Day";
        const daysVal = isDay ? (att.attendanceType === "Half-day" ? 0.5 : 1) : Number(att.tcQuantity || 0);
        const typeVal = isDay ? att.attendanceType : "TC";

        await apiFetch(`/labour/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({ 
            locationId,
            date: formData.date,
            siteLocationName: formData.siteLocationName,
            labourName: att.labourName || "N/A",
            labourTeam: formData.labourTeam,
            attendanceType: typeVal,
            tcNumber: "", 
            dailyRate: att.dailyRate || 0,
            days: daysVal,
            otherEarnings: 0,
            deduction: 0,
            upad: att.upad || 0,
            paymentAmount: att.paymentAmount || 0
          }),
        });
      } else {
        await Promise.all(attendances.map(att => {
          const isDay = att.typeCategory === "Day";
          const daysVal = isDay ? (att.attendanceType === "Half-day" ? 0.5 : 1) : Number(att.tcQuantity || 0);
          const typeVal = isDay ? att.attendanceType : "TC";
          
          return apiFetch("/labour", {
            method: "POST",
            body: JSON.stringify({ 
              locationId,
              date: formData.date,
              siteLocationName: formData.siteLocationName,
              labourName: att.labourName || "N/A",
              labourTeam: formData.labourTeam,
              attendanceType: typeVal,
              tcNumber: "", 
              dailyRate: att.dailyRate || 0,
              days: daysVal,
              otherEarnings: 0,
              deduction: 0,
              upad: att.upad || 0,
              paymentAmount: att.paymentAmount || 0
            }),
          })
        }));
      }
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (r: any) => {
    setEditingId(r.id);
    setFormData({
      date: r.date,
      siteLocationName: r.siteLocationName || "",
      labourTeam: r.labourTeam || "",
    });
    
    let typeCategory = "Day";
    let attendanceType = r.attendanceType || "Full-day";
    let tcQuantity = "";
    
    if (r.attendanceType === "TC" || r.attendanceType === "TC-wise") {
      typeCategory = "TC";
      tcQuantity = r.days;
    } else {
      if (Number(r.days) === 0.5) attendanceType = "Half-day";
      else attendanceType = "Full-day";
    }

    setAttendances([{
      labourName: r.labourName || "",
      typeCategory,
      attendanceType,
      tcQuantity,
      dailyRate: r.dailyRate || "",
      upad: r.upad || "",
      paymentAmount: r.paymentAmount || ""
    }]);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this record?")) return;
    try {
      await apiFetch(`/labour/${id}`, { method: "DELETE" });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      siteLocationName: "",
      labourTeam: formData.labourTeam, 
    });
    setAttendances([{ labourName: "", typeCategory: "Day", attendanceType: "Full-day", tcQuantity: "", dailyRate: "", upad: "", paymentAmount: "" }]);
  };

  const addAttendanceRow = () => {
    setAttendances([...attendances, { labourName: "", typeCategory: "Day", attendanceType: "Full-day", tcQuantity: "", dailyRate: "", upad: "", paymentAmount: "" }]);
  };

  const updateAttendance = (index: number, field: string, value: string) => {
    const newAtt = [...attendances];
    newAtt[index] = { ...newAtt[index], [field]: value };
    
    // Auto-reset when changing typeCategory
    if (field === "typeCategory") {
      if (value === "Day") {
        newAtt[index].attendanceType = "Full-day";
      } else {
        newAtt[index].attendanceType = "TC";
      }
    }
    
    setAttendances(newAtt);
  };

  const removeAttendance = (index: number) => {
    setAttendances(attendances.filter((_, i) => i !== index));
  };

  // Analytics Computation
  
  
  
  return (
    <div className="space-y-6">
      
      {/* Raw Records Table */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-slate-600" /> Recent Attendance Records
            </h2>
          </div>
          <button type="button"
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> Add Attendance
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-4 font-medium rounded-tl-lg">Date</th>
                <th className="p-4 font-medium">Team</th>
                <th className="p-4 font-medium">Labour Name</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Qty</th>
                <th className="p-4 font-medium">Rate</th>
                <th className="p-4 font-medium">Gross</th>
                <th className="p-4 font-medium">Upad</th>
                <th className="p-4 font-medium">Paid</th>
                <th className="p-4 font-medium">Balance</th>
                <th className="p-4 font-medium text-center rounded-tr-lg">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-500">
                    No attendance records found. Click "Add Attendance" to start.
                  </td>
                </tr>
              ) : records.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors/50 transition-colors">
                  <td className="p-4 text-slate-900">
                    {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="p-4 text-slate-700">
                    {r.labourTeam || '-'}
                  </td>
                  <td className="p-4 font-medium text-slate-900">
                    {r.labourName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-700 font-medium">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                      r.attendanceType === 'TC-wise' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {r.attendanceType || '-'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-900 font-medium">
                    {r.days} {r.attendanceType === 'TC-wise' ? 'TCs' : 'Days'}
                  </td>
                  <td className="p-4 text-slate-900 font-medium">
                    {Number(r.dailyRate) > 0 ? `₹${Number(r.dailyRate).toLocaleString()}` : '-'}
                  </td>
                  <td className="p-4 text-indigo-700 font-bold">
                    ₹{Number(r.grossSalary).toLocaleString()}
                  </td>
                  <td className="p-4 text-amber-700 font-medium">
                    ₹{Number(r.upad).toLocaleString()}
                  </td>
                  <td className="p-4 text-green-700 font-medium">
                    ₹{Number(r.paymentAmount).toLocaleString()}
                  </td>
                  <td className="p-4 text-slate-900 font-bold">
                    ₹{Number(r.balance).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={() => handleEdit(r)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg hover:text-rose-700 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal for Analytics */}
      

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Labour Attendance" : "Add Labour Attendance"} maxWidth="5xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-gray-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date *</label>
              <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" required />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Site Location Name *</label>
              <input type="text" placeholder="e.g. Tower B, Floor 3" value={formData.siteLocationName} onChange={e => setFormData({...formData, siteLocationName: e.target.value})} className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" required />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-slate-700">Labour Team *</label>
                <button 
                  type="button" 
                  onClick={() => setIsManageTeamsOpen(true)}
                  className="text-xs text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1"
                >
                  <Settings2 className="w-3 h-3" /> Manage Teams
                </button>
              </div>
              <select 
                value={formData.labourTeam} 
                onChange={e => setFormData({...formData, labourTeam: e.target.value})} 
                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" 
                required 
              >
                <option value="" disabled>Select a team...</option>
                {teamOptions.map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Attendance & Salary Details *</label>
            {attendances.map((att, index) => (
              <div key={index} className="flex flex-wrap gap-3 items-end bg-white p-3 rounded-xl border border-gray-200">
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-[10px] uppercase text-slate-500 font-semibold mb-1">Labour Name</label>
                  <input 
                    type="text" 
                    placeholder="Enter name" 
                    value={att.labourName} 
                    onChange={e => updateAttendance(index, "labourName", e.target.value)} 
                    className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500" 
                    required 
                  />
                </div>
                
                <div className="w-[100px]">
                  <label className="block text-[10px] uppercase text-slate-500 font-semibold mb-1">Unit Type</label>
                  <select 
                    value={att.typeCategory} 
                    onChange={e => updateAttendance(index, "typeCategory", e.target.value)} 
                    className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 bg-indigo-50 text-indigo-700 font-medium"
                    required
                  >
                    <option value="Day">Day</option>
                    <option value="TC">TC</option>
                  </select>
                </div>

                {att.typeCategory === "Day" ? (
                  <div className="w-[100px]">
                    <label className="block text-[10px] uppercase text-slate-500 font-semibold mb-1">Shift</label>
                    <select 
                      value={att.attendanceType} 
                      onChange={e => updateAttendance(index, "attendanceType", e.target.value)} 
                      className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="Full-day">Full</option>
                      <option value="Half-day">Half</option>
                    </select>
                  </div>
                ) : (
                  <div className="w-[100px]">
                    <label className="block text-[10px] uppercase text-slate-500 font-semibold mb-1">No. of TCs</label>
                    <input 
                      type="number" inputMode="decimal" min="0" step="0.01"
                      placeholder="Qty" 
                      value={att.tcQuantity} 
                      onChange={e => updateAttendance(index, "tcQuantity", e.target.value)} 
                      className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500 border-emerald-200 bg-emerald-50"
                      required
                    />
                  </div>
                )}
                
                <div className="w-[100px]">
                  <label className="block text-[10px] uppercase text-slate-500 font-semibold mb-1">Rate</label>
                  <input 
                    type="number" inputMode="decimal" min="0" step="0.01"
                    placeholder="Rate" 
                    value={att.dailyRate} 
                    onChange={e => updateAttendance(index, "dailyRate", e.target.value)} 
                    className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="w-[100px]">
                  <label className="block text-[10px] uppercase text-amber-600 font-semibold mb-1">Upad</label>
                  <input 
                    type="number" inputMode="decimal" min="0" step="0.01"
                    placeholder="0" 
                    value={att.upad} 
                    onChange={e => updateAttendance(index, "upad", e.target.value)} 
                    className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500 border-amber-200 bg-amber-50"
                  />
                </div>

                <div className="w-[100px]">
                  <label className="block text-[10px] uppercase text-green-600 font-semibold mb-1">Paid</label>
                  <input 
                    type="number" inputMode="decimal" min="0" step="0.01"
                    placeholder="0" 
                    value={att.paymentAmount} 
                    onChange={e => updateAttendance(index, "paymentAmount", e.target.value)} 
                    className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 border-green-200 bg-green-50"
                  />
                </div>

                <div className="w-auto flex justify-end pb-1">
                  {attendances.length > 1 && (
                    <button type="button" onClick={() => removeAttendance(index)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!editingId && (
              <button type="button" onClick={addAttendanceRow} className="mt-2 text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                <Plus className="w-4 h-4" /> Add another attendance
              </button>
            )}
          </div>
          <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow transition-colors mt-6">
            {editingId ? "Save Changes" : "Save Attendance"}
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
          <button type="button" onClick={() => setIsManageTeamsOpen(false)} className="w-full py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium">
            Done
          </button>
        </div>
      </Modal>
    </div>
  );
}
