import re

def update_file():
    filepath = "src/client/components/categories/LabourSalaryTab.tsx"
    
    # We will generate a complete new content for LabourSalaryTab.tsx
    new_content = """import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Plus, Users, Trash2, Settings2, Search, Calculator, UserCheck, FolderOpen } from "lucide-react";

const PRESET_TEAMS = [
  "Team Alpha",
  "Team Beta",
  "Fitting Team 1"
];

export default function LabourSalaryTab({ locationId }: { locationId: number }) {
  const [records, setRecords] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [teamOptions, setTeamOptions] = useState<string[]>([]);
  const [isManageTeamsOpen, setIsManageTeamsOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    siteLocationName: "",
    labourTeam: "",
  });

  const [attendances, setAttendances] = useState([
    { labourName: "", typeCategory: "Day-wise", attendanceType: "Full-day", tcQuantity: "", dailyRate: "" }
  ]);

  const [analyticsSearch, setAnalyticsSearch] = useState("");

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
      const res = await apiFetch(`/labour?locationId=${locationId}`);
      setRecords(res || []);
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
    if (formData.labourTeam === team) {
      setFormData({ ...formData, labourTeam: "" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await Promise.all(attendances.map(att => {
        const isDay = att.typeCategory === "Day-wise";
        const daysVal = isDay ? (att.attendanceType === "Half-day" ? 0.5 : 1) : Number(att.tcQuantity || 0);
        const typeVal = isDay ? att.attendanceType : "TC-wise";
        
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
            upad: 0,
            paymentAmount: 0
          }),
        })
      }));
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
      await apiFetch(`/labour/${id}`, { method: "DELETE" });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split("T")[0],
      siteLocationName: "",
      labourTeam: formData.labourTeam, 
    });
    setAttendances([{ labourName: "", typeCategory: "Day-wise", attendanceType: "Full-day", tcQuantity: "", dailyRate: "" }]);
  };

  const addAttendanceRow = () => {
    setAttendances([...attendances, { labourName: "", typeCategory: "Day-wise", attendanceType: "Full-day", tcQuantity: "", dailyRate: "" }]);
  };

  const updateAttendance = (index: number, field: string, value: string) => {
    const newAtt = [...attendances];
    (newAtt[index] as any)[field] = value;
    setAttendances(newAtt);
  };

  const removeAttendance = (index: number) => {
    setAttendances(attendances.filter((_, i) => i !== index));
  };

  // Analytics Computation
  const teamAnalytics = useMemo(() => {
    const teams: Record<string, any> = {};
    records.forEach(r => {
      const team = r.labourTeam || 'Unassigned';
      if (!teams[team]) {
        teams[team] = { 
          name: team, 
          totalGross: 0,
          totalPaid: 0,
          totalBalance: 0,
          totalDays: 0,
          totalTCs: 0,
          labours: {}
        };
      }
      teams[team].totalGross += Number(r.grossSalary || 0);
      teams[team].totalPaid += Number(r.paymentAmount || 0);
      teams[team].totalBalance += Number(r.balance || 0);

      if (r.attendanceType === "TC-wise") {
        teams[team].totalTCs += Number(r.days || 0);
      } else {
        teams[team].totalDays += Number(r.days || 0);
      }

      const labour = r.labourName || 'Unknown';
      if (!teams[team].labours[labour]) {
         teams[team].labours[labour] = {
           name: labour,
           totalGross: 0,
           totalDays: 0,
           totalTCs: 0,
         }
      }
      teams[team].labours[labour].totalGross += Number(r.grossSalary || 0);
      if (r.attendanceType === "TC-wise") {
        teams[team].labours[labour].totalTCs += Number(r.days || 0);
      } else {
        teams[team].labours[labour].totalDays += Number(r.days || 0);
      }
    });
    return Object.values(teams);
  }, [records]);

  const filteredAnalytics = useMemo(() => {
    if (!analyticsSearch.trim()) return teamAnalytics;
    const lower = analyticsSearch.toLowerCase();
    return teamAnalytics.filter((t: any) => 
      t.name.toLowerCase().includes(lower) || 
      Object.keys(t.labours).some(l => l.toLowerCase().includes(lower))
    );
  }, [teamAnalytics, analyticsSearch]);

  return (
    <div className="space-y-6">
      
      {/* Analytics Dashboard */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-600" /> Labour Attendance Analytics
            </h2>
            <p className="text-sm text-gray-500 mt-1">Search team or labour to view total attendance</p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search team or labour..."
              value={analyticsSearch}
              onChange={e => setAnalyticsSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-indigo-500 w-full sm:w-64 bg-gray-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAnalytics.length === 0 ? (
            <div className="col-span-full py-8 text-center text-gray-400 text-sm">
              No analytics data found. Add attendance records first.
            </div>
          ) : (
            filteredAnalytics.map((team: any, i) => (
              <div key={i} className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                <div className="flex justify-between items-start mb-3 border-b pb-3 border-gray-200">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{team.name}</h3>
                    <div className="text-xs text-gray-500 mt-0.5 flex gap-3">
                      <span>Days: <strong className="text-gray-900">{team.totalDays}</strong></span>
                      <span>TCs: <strong className="text-gray-900">{team.totalTCs}</strong></span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Gross</div>
                    <div className="font-bold text-indigo-700">₹{team.totalGross.toLocaleString()}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Labour Breakdown</div>
                  <div className="max-h-32 overflow-y-auto pr-1 space-y-1.5 no-scrollbar">
                    {Object.values(team.labours).map((labour: any, j) => (
                      <div key={j} className="flex justify-between items-center text-sm bg-white px-2 py-1.5 rounded-lg border border-gray-100 shadow-sm">
                        <span className="font-medium text-gray-800 line-clamp-1 flex-1">{labour.name}</span>
                        <div className="text-xs text-gray-500 flex gap-2 w-32 justify-end">
                          {labour.totalDays > 0 && <span className="bg-blue-50 text-blue-700 px-1.5 rounded">{labour.totalDays}D</span>}
                          {labour.totalTCs > 0 && <span className="bg-emerald-50 text-emerald-700 px-1.5 rounded">{labour.totalTCs}TC</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Raw Records Table */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-gray-600" /> Recent Attendance Records
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
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium rounded-tl-lg">Date</th>
                <th className="p-4 font-medium">Team</th>
                <th className="p-4 font-medium">Labour Name</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Qty (Days/TC)</th>
                <th className="p-4 font-medium">Rate</th>
                <th className="p-4 font-medium">Total Gross</th>
                <th className="p-4 font-medium text-center rounded-tr-lg">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    No attendance records found. Click "Add Attendance" to start.
                  </td>
                </tr>
              ) : records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 text-gray-900 whitespace-nowrap">
                    {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="p-4 text-gray-700">
                    {r.labourTeam || '-'}
                  </td>
                  <td className="p-4 font-medium text-gray-900">
                    {r.labourName || '-'}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                      r.attendanceType === 'TC-wise' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {r.attendanceType || '-'}
                    </span>
                  </td>
                  <td className="p-4 text-gray-900 font-medium">
                    {r.days} {r.attendanceType === 'TC-wise' ? 'TCs' : 'Days'}
                  </td>
                  <td className="p-4 text-gray-900 font-medium">
                    {Number(r.dailyRate) > 0 ? `₹${Number(r.dailyRate).toLocaleString()}` : '-'}
                  </td>
                  <td className="p-4 text-indigo-700 font-bold">
                    ₹{Number(r.grossSalary).toLocaleString()}
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Labour Attendance" maxWidth="4xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" required />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Site Location Name *</label>
              <input type="text" placeholder="e.g. Tower B, Floor 3" value={formData.siteLocationName} onChange={e => setFormData({...formData, siteLocationName: e.target.value})} className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" required />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-gray-700">Labour Team *</label>
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
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Attendance List *</label>
            {attendances.map((att, index) => (
              <div key={index} className="flex flex-wrap lg:flex-nowrap gap-3 items-center bg-white p-3 rounded-xl border border-gray-200">
                <div className="w-full lg:w-1/4">
                  <input 
                    type="text" 
                    placeholder="Labour Name" 
                    value={att.labourName} 
                    onChange={e => updateAttendance(index, "labourName", e.target.value)} 
                    className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500" 
                    required 
                  />
                </div>
                
                <div className="w-full lg:w-1/5">
                  <select 
                    value={att.typeCategory} 
                    onChange={e => updateAttendance(index, "typeCategory", e.target.value)} 
                    className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 bg-indigo-50 text-indigo-700 font-medium"
                    required
                  >
                    <option value="Day-wise">Day-wise</option>
                    <option value="TC-wise">TC-wise</option>
                  </select>
                </div>

                {att.typeCategory === "Day-wise" ? (
                  <div className="w-full lg:w-1/5">
                    <select 
                      value={att.attendanceType} 
                      onChange={e => updateAttendance(index, "attendanceType", e.target.value)} 
                      className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="Full-day">Full-day</option>
                      <option value="Half-day">Half-day</option>
                    </select>
                  </div>
                ) : (
                  <div className="w-full lg:w-1/5">
                    <input 
                      type="number" inputMode="decimal" min="0" step="0.01"
                      placeholder="No. of TCs" 
                      value={att.tcQuantity} 
                      onChange={e => updateAttendance(index, "tcQuantity", e.target.value)} 
                      className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500 border-emerald-200 bg-emerald-50"
                      required
                    />
                  </div>
                )}
                
                <div className="w-full lg:w-1/5">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                    <input 
                      type="number" inputMode="decimal" min="0" step="0.01"
                      placeholder={att.typeCategory === "Day-wise" ? "Daily Rate" : "Rate / TC"} 
                      value={att.dailyRate} 
                      onChange={e => updateAttendance(index, "dailyRate", e.target.value)} 
                      className="w-full pl-7 pr-2 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="w-full lg:w-auto flex justify-end">
                  {attendances.length > 1 && (
                    <button type="button" onClick={() => removeAttendance(index)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button type="button" onClick={addAttendanceRow} className="mt-2 text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> Add another attendance
            </button>
          </div>
          <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow transition-colors mt-6">
            Save Attendance
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
          <button type="button" onClick={() => setIsManageTeamsOpen(false)} className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            Done
          </button>
        </div>
      </Modal>
    </div>
  );
}
"""
    with open(filepath, "w") as f:
        f.write(new_content)

update_file()
