import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { CalendarCheck, List, Users, CheckSquare, Settings, Pencil, Trash2, HardHat, Plus } from "lucide-react";
import { Modal } from "../ui/Modal";
import { ManageLabourModal } from "../ui/ManageLabourModal";
import { ManageTeamsModal } from "../ui/ManageTeamsModal";
import { useLiveSync, triggerSync } from "../../hooks/useLiveSync";

const COMMON_UNITS = ["Nos", "Brass", "Sq.Ft", "R.Ft", "Cu.Ft", "Bags", "Kg", "Ton", "Hours", "Days"];

export default function LabourAttendanceTab({ locationId }: { locationId: number }) {
  const [activeSubTab, setActiveSubTab] = useState<"daywise" | "workwise" | "records">("daywise");

  const [workers, setWorkers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Manage Modals State
  const [isManageLabourOpen, setIsManageLabourOpen] = useState(false);
  const [isManageTeamOpen, setIsManageTeamOpen] = useState(false);
  const [targetFormType, setTargetFormType] = useState<"day" | "work">("day");

  // Edit Modal State
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Day-wise state
  const [dayForm, setDayForm] = useState({
    date: new Date().toISOString().split("T")[0],
    teamId: "",
    labourId: "",
    attendanceType: "Full Day",
    rate: "",
    notes: ""
  });

  // Work-wise state
  const [workForm, setWorkForm] = useState({
    date: new Date().toISOString().split("T")[0],
    teamId: "",
    labourId: "",
    workName: "",
    attendanceType: "Full Day",
    quantity: "",
    unitOfMeasurement: "Nos",
    rate: "",
    notes: ""
  });


  const loadData = async (isBackground = false) => {
    if (!isBackground && records.length === 0) setLoading(true);
    try {
      const [workersData, teamsData, attendanceData, locsData] = await Promise.all([
        apiFetch(`/master/labour?locationId=${locationId}`).catch(() => []),
        apiFetch(`/master/teams?locationId=${locationId}`).catch(() => []),
        apiFetch(`/labour?locationId=${locationId}`).catch(() => []),
        apiFetch(`/locations`).catch(() => [])
      ]);
      setWorkers(workersData || []);
      setTeams(teamsData || []);
      setRecords(attendanceData || []);
      setLocations(locsData || []);
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

  const currentLocationName = useMemo(() => {
    return locations.find(l => l.id === locationId)?.name || `Site #${locationId}`;
  }, [locations, locationId]);

  const handleDaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const worker = workers.find(w => w.id.toString() === dayForm.labourId);
      const team = teams.find(t => t.id.toString() === dayForm.teamId);
      
      const days = dayForm.attendanceType === "Full Day" ? "1" : "0.5";
      const rate = parseFloat(dayForm.rate) || 0;

      await apiFetch("/labour", {
        method: "POST",
        body: JSON.stringify({
          locationId,
          siteLocationName: currentLocationName,
          date: dayForm.date,
          labourMasterId: worker?.id || null,
          labourName: worker ? worker.name : "Unknown",
          labourTeam: team ? team.name : (worker?.teamName || "General"),
          attendanceType: dayForm.attendanceType,
          days,
          dailyRate: rate,
          notes: dayForm.notes || "Day-wise attendance"
        })
      });
      triggerSync("labour_attendance");
      loadData();
      setDayForm({
        date: new Date().toISOString().split("T")[0],
        teamId: "",
        labourId: "",
        attendanceType: "Full Day",
        rate: "",
        notes: ""
      });
    } catch (err) {
      alert("Failed to save day-wise attendance.");
    }
  };

  const handleWorkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const team = teams.find(t => t.id.toString() === workForm.teamId);
      const worker = workers.find(w => w.id.toString() === workForm.labourId);
      const qty = parseFloat(workForm.quantity) || 0;
      const rate = parseFloat(workForm.rate) || 0;

      await apiFetch("/labour", {
        method: "POST",
        body: JSON.stringify({
          locationId,
          siteLocationName: currentLocationName,
          date: workForm.date,
          labourMasterId: worker?.id || null,
          labourName: worker ? worker.name : (team ? `${team.name} Crew` : "Work-wise Crew"),
          labourTeam: team ? team.name : "Work Team",
          workName: workForm.workName || "General Work",
          attendanceType: workForm.attendanceType + " (Work)",
          unitOfMeasurement: workForm.unitOfMeasurement,
          quantity: qty,
          rate: rate,
          notes: workForm.notes || workForm.workName || "Work-wise attendance"
        })
      });
      triggerSync("labour_attendance");
      loadData();
      setWorkForm({
        date: new Date().toISOString().split("T")[0],
        teamId: "",
        labourId: "",
        workName: "",
        attendanceType: "Full Day",
        quantity: "",
        unitOfMeasurement: "Nos",
        rate: "",
        notes: ""
      });
    } catch (err) {
      alert("Failed to save work-wise attendance.");
    }
  };

  const handleDeleteRecord = async (id: number) => {
    if (!confirm("Are you sure you want to delete this attendance entry?")) return;
    try {
      await apiFetch(`/labour/${id}`, { method: "DELETE" });
      triggerSync("labour_attendance");
      loadData();
    } catch (err) {
      alert("Failed to delete record.");
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    try {
      await apiFetch(`/labour/${editingRecord.id}`, {
        method: "PUT",
        body: JSON.stringify(editingRecord)
      });
      triggerSync("labour_attendance");
      setIsEditModalOpen(false);
      setEditingRecord(null);
      loadData();
    } catch (err) {
      alert("Failed to update record.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 border border-amber-200/80 p-5 rounded-2xl flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-amber-600 text-white rounded-xl shadow-md">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Labour Attendance</h2>
            <p className="text-xs text-slate-600">Site: <span className="font-bold text-slate-800">{currentLocationName}</span> • Track day-wise and work-wise contracts.</p>
          </div>
        </div>

        <div className="flex bg-white rounded-lg p-1 border border-amber-100 shadow-sm w-max">
          <button
            onClick={() => setActiveSubTab("daywise")}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-colors ${activeSubTab === "daywise" ? "bg-amber-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            Day-wise
          </button>
          <button
            onClick={() => setActiveSubTab("workwise")}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-colors ${activeSubTab === "workwise" ? "bg-amber-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            Work-wise
          </button>
          <button
            onClick={() => setActiveSubTab("records")}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-colors ${activeSubTab === "records" ? "bg-amber-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            Attendance Records
          </button>
        </div>
      </div>

      {activeSubTab === "daywise" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-3xl">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-amber-600" /> Record Day-wise Attendance
          </h3>
          <form onSubmit={handleDaySubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Date</label>
                <input type="date" required value={dayForm.date} onChange={e => setDayForm({...dayForm, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Location</label>
                <input type="text" disabled value={currentLocationName} className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 font-semibold cursor-not-allowed" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">Select Team</label>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetFormType("day");
                      setIsManageTeamOpen(true);
                    }}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Manage Team
                  </button>
                </div>
                <select value={dayForm.teamId} onChange={e => setDayForm({...dayForm, teamId: e.target.value, labourId: ""})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500">
                  <option value="">-- All Teams --</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">Select Labour</label>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetFormType("day");
                      setIsManageLabourOpen(true);
                    }}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Manage Labour
                  </button>
                </div>
                <select required value={dayForm.labourId} onChange={e => {
                   const w = workers.find(x => x.id.toString() === e.target.value);
                   setDayForm({...dayForm, labourId: e.target.value, rate: w?.dailyRate || ""});
                }} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500">
                  <option value="">-- Select Labour --</option>
                  {workers.filter(w => !dayForm.teamId || w.teamId?.toString() === dayForm.teamId).map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Shift (Half / Full Day)</label>
                <select value={dayForm.attendanceType} onChange={e => setDayForm({...dayForm, attendanceType: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500">
                  <option value="Full Day">Full Day (1.0)</option>
                  <option value="Half Day">Half Day (0.5)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Daily Rate (₹)</label>
                <input type="number" step="0.01" required value={dayForm.rate} onChange={e => setDayForm({...dayForm, rate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" placeholder="0.00" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Notes / Remark</label>
              <input type="text" value={dayForm.notes} onChange={e => setDayForm({...dayForm, notes: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" placeholder="Optional notes..." />
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-600">Calculated Wages:</span>
              <span className="text-xl font-black text-amber-700">
                ₹{((dayForm.attendanceType === 'Half Day' ? 0.5 : 1) * (parseFloat(dayForm.rate) || 0)).toLocaleString()}
              </span>
            </div>

            <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg shadow-md transition-colors">
              Save Day-wise Attendance
            </button>
          </form>
        </div>
      )}

      {activeSubTab === "workwise" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-3xl">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-600" /> Record Work-wise Attendance
          </h3>
          <form onSubmit={handleWorkSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Date</label>
                <input type="date" required value={workForm.date} onChange={e => setWorkForm({...workForm, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Location</label>
                <input type="text" disabled value={currentLocationName} className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 font-semibold cursor-not-allowed" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">Labour Team</label>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetFormType("work");
                      setIsManageTeamOpen(true);
                    }}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Manage Team
                  </button>
                </div>
                <select value={workForm.teamId} onChange={e => setWorkForm({...workForm, teamId: e.target.value, labourId: ""})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500">
                  <option value="">-- Select Team --</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">Labour / Contractor (Optional)</label>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetFormType("work");
                      setIsManageLabourOpen(true);
                    }}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Manage Labour
                  </button>
                </div>
                <select value={workForm.labourId} onChange={e => setWorkForm({...workForm, labourId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500">
                  <option value="">-- Entire Team / Specific Labour --</option>
                  {workers.filter(w => !workForm.teamId || w.teamId?.toString() === workForm.teamId).map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Work Description / Task</label>
              <input type="text" required value={workForm.workName} onChange={e => setWorkForm({...workForm, workName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" placeholder="e.g. Plastering, Brickwork, Excavation" />
            </div>

            <div className="grid grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Quantity Completed</label>
                <input type="number" step="0.01" required value={workForm.quantity} onChange={e => setWorkForm({...workForm, quantity: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Unit (UOM)</label>
                <select value={workForm.unitOfMeasurement} onChange={e => setWorkForm({...workForm, unitOfMeasurement: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500">
                  {COMMON_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Rate per Unit (₹)</label>
                <input type="number" step="0.01" required value={workForm.rate} onChange={e => setWorkForm({...workForm, rate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" placeholder="0.00" />
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-600">Total Work Amount:</span>
              <span className="text-xl font-black text-amber-700">
                ₹{((parseFloat(workForm.quantity) || 0) * (parseFloat(workForm.rate) || 0)).toLocaleString()}
              </span>
            </div>

            <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg shadow-md transition-colors">
              Save Work-wise Attendance
            </button>
          </form>
        </div>
      )}

      {activeSubTab === "records" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-900 flex items-center gap-2"><List className="w-5 h-5 text-amber-600" /> Overall Attendance Records</h3>
            <span className="text-xs font-semibold text-slate-500">{records.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Labour / Team</th>
                  <th className="p-3">Mode & Task</th>
                  <th className="p-3 text-right">Qty / Days</th>
                  <th className="p-3 text-right">Rate (₹)</th>
                  <th className="p-3 text-right">Gross Amount (₹)</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map(r => {
                  const isWork = (r.attendanceType || "").includes("Work");
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-600">{r.date}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{r.labourName}</div>
                        {r.labourTeam && <div className="text-[10px] text-slate-500 flex items-center gap-1"><HardHat className="w-3 h-3 text-amber-600"/> {r.labourTeam}</div>}
                      </td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isWork ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                          {r.attendanceType}
                        </span>
                        {r.workType && <div className="text-[11px] text-slate-700 font-semibold mt-0.5">{r.workType}</div>}
                      </td>
                      <td className="p-3 text-right font-bold">
                        {isWork ? `${r.tcQuantity || r.notes || 0} ${r.unitOfMeasurement || ''}` : `${r.days} Days`}
                      </td>
                      <td className="p-3 text-right text-slate-600">₹{isWork ? (r.tcRate || r.dailyRate) : r.dailyRate}</td>
                      <td className="p-3 text-right font-black text-slate-900">₹{Number(r.grossSalary).toLocaleString()}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            setEditingRecord({ ...r });
                            setIsEditModalOpen(true);
                          }}
                          className="p-1 text-slate-400 hover:text-amber-600"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(r.id)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {records.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No attendance records found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Record Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setEditingRecord(null); }} title="Edit Attendance Record">
        {editingRecord && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                <input type="date" required value={editingRecord.date || ""} onChange={e => setEditingRecord({...editingRecord, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Labour Name</label>
                <input type="text" required value={editingRecord.labourName || ""} onChange={e => setEditingRecord({...editingRecord, labourName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Shift / Attendance Type</label>
                <input type="text" value={editingRecord.attendanceType || ""} onChange={e => setEditingRecord({...editingRecord, attendanceType: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Days / Qty</label>
                <input type="number" step="0.01" value={editingRecord.days || editingRecord.tcQuantity || 0} onChange={e => setEditingRecord({...editingRecord, days: e.target.value, tcQuantity: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rate (₹)</label>
                <input type="number" step="0.01" value={editingRecord.dailyRate || editingRecord.tcRate || 0} onChange={e => setEditingRecord({...editingRecord, dailyRate: e.target.value, tcRate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deduction (₹)</label>
                <input type="number" step="0.01" value={editingRecord.deduction || 0} onChange={e => setEditingRecord({...editingRecord, deduction: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Upad / Advance (₹)</label>
              <input type="number" step="0.01" value={editingRecord.upad || 0} onChange={e => setEditingRecord({...editingRecord, upad: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>

            <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-lg transition-colors">
              Update Attendance Record
            </button>
          </form>
        )}
      </Modal>

      {/* Quick Manage Labour Modal */}
      <ManageLabourModal
        isOpen={isManageLabourOpen}
        onClose={() => setIsManageLabourOpen(false)}
        locationId={locationId}
        currentSelectedId={targetFormType === "day" ? dayForm.labourId : workForm.labourId}
        onSelectLabour={(selectedLabour) => {
          if (targetFormType === "day") {
            setDayForm(prev => ({
              ...prev,
              labourId: String(selectedLabour.id),
              rate: selectedLabour.dailyRate ? String(selectedLabour.dailyRate) : prev.rate
            }));
          } else {
            setWorkForm(prev => ({
              ...prev,
              labourId: String(selectedLabour.id)
            }));
          }
          loadData(true);
        }}
      />

      {/* Quick Manage Team Modal */}
      <ManageTeamsModal
        isOpen={isManageTeamOpen}
        onClose={() => setIsManageTeamOpen(false)}
        locationId={locationId}
        currentSelectedId={targetFormType === "day" ? dayForm.teamId : workForm.teamId}
        onSelectTeam={(selectedTeam) => {
          if (targetFormType === "day") {
            setDayForm(prev => ({
              ...prev,
              teamId: String(selectedTeam.id)
            }));
          } else {
            setWorkForm(prev => ({
              ...prev,
              teamId: String(selectedTeam.id)
            }));
          }
          loadData(true);
        }}
      />
    </div>
  );
}

