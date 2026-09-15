import React, { useState, useEffect } from "react";
import { apiFetch } from "../../lib/api";
import { CalendarCheck, List, Users, CheckSquare, Settings } from "lucide-react";

export default function LabourAttendanceTab({ locationId }: { locationId: number }) {
  const [activeSubTab, setActiveSubTab] = useState<"daywise" | "tcwise" | "records">("daywise");

  const [workers, setWorkers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Day-wise state
  const [dayForm, setDayForm] = useState({
    date: new Date().toISOString().split("T")[0],
    teamId: "",
    labourId: "",
    attendanceType: "Full Day",
    rate: ""
  });

  // TC-wise state
  const [tcForm, setTcForm] = useState({
    date: new Date().toISOString().split("T")[0],
    attendanceType: "Full Day",
    quantity: "",
    rate: ""
  });

  useEffect(() => {
    loadData();
  }, [locationId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [workersData, teamsData, attendanceData] = await Promise.all([
        apiFetch(`/master/labour?locationId=${locationId}`).catch(() => []),
        apiFetch(`/master/teams?locationId=${locationId}`).catch(() => []),
        apiFetch(`/labour?locationId=${locationId}`).catch(() => [])
      ]);
      setWorkers(workersData || []);
      setTeams(teamsData || []);
      setRecords(attendanceData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const worker = workers.find(w => w.id.toString() === dayForm.labourId);
      const team = teams.find(t => t.id.toString() === dayForm.teamId);
      
      const days = dayForm.attendanceType === "Full Day" ? 1 : 0.5;
      const rate = parseFloat(dayForm.rate) || 0;
      const gross = days * rate;

      await apiFetch("/labour", {
        method: "POST",
        body: JSON.stringify({
          locationId,
          date: dayForm.date,
          labourName: worker ? worker.name : "Unknown",
          labourTeam: team ? team.name : "Unknown",
          attendanceType: dayForm.attendanceType,
          days: days,
          dailyRate: rate,
          grossSalary: gross,
          upad: 0,
          paymentAmount: 0,
          balance: gross,
          description: "Day-wise attendance"
        })
      });
      alert("Day-wise Attendance Saved!");
      loadData();
      setDayForm({...dayForm, labourId: "", attendanceType: "Full Day", rate: ""});
    } catch (err) {
      alert("Failed to save.");
    }
  };

  const handleTcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const qty = parseFloat(tcForm.quantity) || 0;
      const rate = parseFloat(tcForm.rate) || 0;
      const gross = qty * rate;

      await apiFetch("/labour", {
        method: "POST",
        body: JSON.stringify({
          locationId,
          date: tcForm.date,
          labourName: "TC Worker", // TC is usually contract, might not map to a specific worker
          labourTeam: "TC Team",
          attendanceType: tcForm.attendanceType + " (TC)",
          days: tcForm.attendanceType === "Full Day" ? 1 : 0.5,
          dailyRate: rate,
          grossSalary: gross,
          upad: 0,
          paymentAmount: 0,
          balance: gross,
          description: `TC Quantity: ${qty}`,
          notes: tcForm.quantity
        })
      });
      alert("TC-wise Attendance Saved!");
      loadData();
      setTcForm({...tcForm, quantity: "", rate: ""});
    } catch (err) {
      alert("Failed to save.");
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
            <p className="text-xs text-slate-600">Manage daily and TC-wise attendance records.</p>
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
            onClick={() => setActiveSubTab("tcwise")}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-colors ${activeSubTab === "tcwise" ? "bg-amber-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            TC-wise
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
                <input type="text" disabled value="Current Location" className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Team</label>
                <select required value={dayForm.teamId} onChange={e => setDayForm({...dayForm, teamId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500">
                  <option value="">-- Select Team --</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Labour</label>
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
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Half/Full Day</label>
                <select value={dayForm.attendanceType} onChange={e => setDayForm({...dayForm, attendanceType: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500">
                  <option value="Full Day">Full Day</option>
                  <option value="Half Day">Half Day</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Rate (₹)</label>
                <input type="number" required value={dayForm.rate} onChange={e => setDayForm({...dayForm, rate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>

            <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg shadow-md transition-colors mt-4">
              Save Day-wise Attendance
            </button>
          </form>
        </div>
      )}

      {activeSubTab === "tcwise" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-3xl">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-600" /> Record TC-wise Attendance
          </h3>
          <form onSubmit={handleTcSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Date</label>
                <input type="date" required value={tcForm.date} onChange={e => setTcForm({...tcForm, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Location</label>
                <input type="text" disabled value="Current Location" className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Half/Full Day</label>
                <select value={tcForm.attendanceType} onChange={e => setTcForm({...tcForm, attendanceType: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500">
                  <option value="Full Day">Full Day</option>
                  <option value="Half Day">Half Day</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Quantity</label>
                <input type="number" step="0.01" required value={tcForm.quantity} onChange={e => setTcForm({...tcForm, quantity: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Rate (₹)</label>
                <input type="number" required value={tcForm.rate} onChange={e => setTcForm({...tcForm, rate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>

            <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg shadow-md transition-colors mt-4">
              Save TC-wise Attendance
            </button>
          </form>
        </div>
      )}

      {activeSubTab === "records" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-900 flex items-center gap-2"><List className="w-5 h-5 text-amber-600" /> Overall Attendance Records</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Labour / Team</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Qty/Days</th>
                  <th className="p-3 text-right">Rate (₹)</th>
                  <th className="p-3 text-right">Gross Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-600">{r.date}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{r.labourName}</div>
                      {r.labourTeam && <div className="text-[10px] text-slate-500">{r.labourTeam}</div>}
                    </td>
                    <td className="p-3 font-medium text-amber-700">{r.attendanceType}</td>
                    <td className="p-3 text-right font-bold">{r.attendanceType.includes('TC') ? r.notes : r.days}</td>
                    <td className="p-3 text-right text-slate-600">{r.dailyRate}</td>
                    <td className="p-3 text-right font-black text-slate-900">₹{Number(r.grossSalary).toLocaleString()}</td>
                  </tr>
                ))}
                {records.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No attendance records found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
