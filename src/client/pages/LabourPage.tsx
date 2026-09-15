import React, { useState, useEffect, useMemo } from "react";
import { 
  Users, Plus, Search, Filter, Trash2, Pencil, 
  IndianRupee, CheckCircle2, AlertCircle, X, Building2, 
  Wallet, Clock, Calendar, ArrowUpRight, ArrowDownRight, UserCheck
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { Modal } from "../components/ui/Modal";

interface LabourRecord {
  id: number;
  locationId: number;
  date: string;
  siteLocationName?: string | null;
  labourName: string;
  labourTeam?: string | null;
  attendanceType?: string | null;
  tcNumber?: string | null;
  description?: string | null;
  days: string | number;
  dailyRate: string | number;
  otherEarnings: string | number;
  grossSalary: string | number;
  deduction: string | number;
  netSalary: string | number;
  upad: string | number;
  paymentAmount: string | number;
  balance: string | number;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
}

export default function LabourPage() {
  const [records, setRecords] = useState<LabourRecord[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"wages" | "upad" | "teams">("wages");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("ALL");
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("ALL");

  // Notifications
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isManageTeamsOpen, setIsManageTeamsOpen] = useState(false);
  const [newTeamInput, setNewTeamInput] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    locationId: 0,
    date: new Date().toISOString().split("T")[0],
    siteLocationName: "",
    labourName: "",
    labourTeam: "",
    attendanceType: "Full-day",
    tcNumber: "",
    days: 1,
    dailyRate: 500,
    otherEarnings: 0,
    deduction: 0,
    upad: 0,
    paymentAmount: 0,
    paymentMethod: "CASH",
    referenceNumber: "",
    notes: ""
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [labourData, locData, teamData] = await Promise.all([
        apiFetch("/labour").catch(() => []),
        apiFetch("/locations").catch(() => []),
        apiFetch("/master/teams").catch(() => [])
      ]);

      const locs = Array.isArray(locData) ? locData : [];
      setLocations(locs);
      setRecords(Array.isArray(labourData) ? labourData : []);

      const teamList = Array.isArray(teamData) ? teamData.map((t: any) => t.name) : [];
      // Combine with existing teams from records
      const existingRecordTeams = (Array.isArray(labourData) ? labourData : [])
        .map(r => r.labourTeam)
        .filter(Boolean) as string[];
      const uniqueTeams = Array.from(new Set([...teamList, ...existingRecordTeams]));
      setTeams(uniqueTeams);

      if (locs.length > 0 && formData.locationId === 0) {
        setFormData(prev => ({ ...prev, locationId: locs[0].id, siteLocationName: locs[0].name }));
      }
    } catch (err) {
      console.error("Failed to load labour records:", err);
      setActionError("Failed to load labour records. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (val: string | number) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(num);
  };

  // Live computed salary fields for form
  const computedGross = useMemo(() => {
    const d = Number(formData.days) || 0;
    const r = Number(formData.dailyRate) || 0;
    const o = Number(formData.otherEarnings) || 0;
    return Math.round(((d * r) + o) * 100) / 100;
  }, [formData.days, formData.dailyRate, formData.otherEarnings]);

  const computedNet = useMemo(() => {
    const ded = Number(formData.deduction) || 0;
    return Math.max(0, Math.round((computedGross - ded) * 100) / 100);
  }, [computedGross, formData.deduction]);

  const computedBalance = useMemo(() => {
    const u = Number(formData.upad) || 0;
    const p = Number(formData.paymentAmount) || 0;
    return Math.round((computedNet - u - p) * 100) / 100;
  }, [computedNet, formData.upad, formData.paymentAmount]);

  // Handle Attendance Type preset changes
  const handleAttendanceTypeChange = (type: string) => {
    let d = 1;
    if (type === "Full-day") d = 1;
    else if (type === "Half-day") d = 0.5;
    else if (type === "1.5 Days") d = 1.5;
    else if (type === "2 Days") d = 2;
    else if (type === "Overtime") d = 1.25;

    setFormData(prev => ({
      ...prev,
      attendanceType: type,
      days: d
    }));
  };

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setFormData({
      locationId: locations[0]?.id || 0,
      date: new Date().toISOString().split("T")[0],
      siteLocationName: locations[0]?.name || "",
      labourName: "",
      labourTeam: teams[0] || "",
      attendanceType: "Full-day",
      tcNumber: "",
      days: 1,
      dailyRate: 500,
      otherEarnings: 0,
      deduction: 0,
      upad: 0,
      paymentAmount: 0,
      paymentMethod: "CASH",
      referenceNumber: "",
      notes: ""
    });
    setIsRecordModalOpen(true);
  };

  const handleEdit = (rec: LabourRecord) => {
    setEditingId(rec.id);
    setFormData({
      locationId: rec.locationId,
      date: rec.date,
      siteLocationName: rec.siteLocationName || "",
      labourName: rec.labourName,
      labourTeam: rec.labourTeam || "",
      attendanceType: rec.attendanceType || "Full-day",
      tcNumber: rec.tcNumber || "",
      days: Number(rec.days) || 1,
      dailyRate: Number(rec.dailyRate) || 0,
      otherEarnings: Number(rec.otherEarnings) || 0,
      deduction: Number(rec.deduction) || 0,
      upad: Number(rec.upad) || 0,
      paymentAmount: Number(rec.paymentAmount) || 0,
      paymentMethod: rec.paymentMethod || "CASH",
      referenceNumber: rec.referenceNumber || "",
      notes: rec.notes || ""
    });
    setIsRecordModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this labour record?")) return;
    try {
      await apiFetch(`/labour/${id}`, { method: "DELETE" });
      setActionSuccess("Labour record removed successfully");
      fetchData();
    } catch (err: any) {
      setActionError(err.message || "Failed to delete record");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (!formData.labourName.trim()) {
      setActionError("Labour / Worker name is required");
      return;
    }

    if (!formData.locationId && locations.length > 0) {
      formData.locationId = locations[0].id;
    }

    try {
      const payload = {
        ...formData,
        days: Number(formData.days) || 0,
        dailyRate: Number(formData.dailyRate) || 0,
        otherEarnings: Number(formData.otherEarnings) || 0,
        deduction: Number(formData.deduction) || 0,
        upad: Number(formData.upad) || 0,
        paymentAmount: Number(formData.paymentAmount) || 0,
      };

      if (editingId) {
        await apiFetch(`/labour/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        setActionSuccess("Labour record updated successfully");
      } else {
        await apiFetch("/labour", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setActionSuccess("Labour entry recorded successfully");
      }

      setIsRecordModalOpen(false);
      fetchData();
    } catch (err: any) {
      setActionError(err.message || "Failed to save labour record");
    }
  };

  const handleAddTeam = async () => {
    const trimmed = newTeamInput.trim();
    if (!trimmed) return;
    if (teams.includes(trimmed)) {
      setActionError("Team already exists");
      return;
    }

    try {
      await apiFetch("/master/teams", {
        method: "POST",
        body: JSON.stringify({ name: trimmed, locationId: locations[0]?.id || 1 })
      });
      setTeams(prev => [...prev, trimmed]);
      setNewTeamInput("");
      setActionSuccess(`Team "${trimmed}" registered`);
    } catch (err: any) {
      setActionError(err.message || "Failed to add team");
    }
  };

  // Filtered list
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchSearch = 
        r.labourName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.labourTeam && r.labourTeam.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.siteLocationName && r.siteLocationName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchLocation = selectedLocationId === "ALL" || r.locationId === Number(selectedLocationId);
      const matchTeam = selectedTeamFilter === "ALL" || r.labourTeam === selectedTeamFilter;

      return matchSearch && matchLocation && matchTeam;
    });
  }, [records, searchQuery, selectedLocationId, selectedTeamFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    return filteredRecords.reduce((acc, r) => {
      acc.totalGross += Number(r.grossSalary) || 0;
      acc.totalNet += Number(r.netSalary) || 0;
      acc.totalUpad += Number(r.upad) || 0;
      acc.totalPaid += Number(r.paymentAmount) || 0;
      acc.totalBalance += Number(r.balance) || 0;
      return acc;
    }, {
      totalGross: 0,
      totalNet: 0,
      totalUpad: 0,
      totalPaid: 0,
      totalBalance: 0,
    });
  }, [filteredRecords]);

  // Unique workers count
  const uniqueWorkersCount = useMemo(() => {
    return new Set(filteredRecords.map(r => r.labourName.trim().toLowerCase())).size;
  }, [filteredRecords]);

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center justify-between text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-rose-500 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-rose-600">
            <X size={16} />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center justify-between text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-emerald-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Users className="w-7 h-7 text-indigo-600" />
            Labour & Employees
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Workforce attendance, daily wage calculations, advances (upad), and contractor team settlements
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsManageTeamsOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-sm rounded-xl transition shadow-sm"
          >
            <Users size={16} className="text-slate-500" />
            Manage Teams ({teams.length})
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition shadow-sm shadow-indigo-200"
          >
            <Plus size={16} />
            Record Wage Voucher
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Wages</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <IndianRupee size={15} />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900">{formatCurrency(metrics.totalGross)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{filteredRecords.length} wage records</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Advances (Upad)</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <ArrowDownRight size={15} />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-600">{formatCurrency(metrics.totalUpad)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Recovered from wages</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Paid Out</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Wallet size={15} />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-600">{formatCurrency(metrics.totalPaid)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Disbursed cash & bank</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Balance</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <Clock size={15} />
            </div>
          </div>
          <div className="text-xl font-bold text-rose-600">{formatCurrency(metrics.totalBalance)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Unsettled wages</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Labour</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <UserCheck size={15} />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900">{uniqueWorkersCount} Workers</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Across {teams.length} contractor teams</div>
        </div>
      </div>

      {/* Navigation Tabs & Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl w-full md:w-auto">
            <button
              onClick={() => setActiveTab("wages")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "wages" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Wage & Salary Records
            </button>
            <button
              onClick={() => setActiveTab("upad")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "upad" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Advance / Upad Register
            </button>
            <button
              onClick={() => setActiveTab("teams")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "teams" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Contractor Teams ({teams.length})
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            {/* Search */}
            <div className="relative flex-1 sm:w-60">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search worker or team..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Location Filter */}
            <div className="flex items-center gap-1 text-xs">
              <Building2 size={14} className="text-slate-400" />
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="ALL">All Branches</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            {/* Team Filter */}
            <div className="flex items-center gap-1 text-xs">
              <Filter size={14} className="text-slate-400" />
              <select
                value={selectedTeamFilter}
                onChange={(e) => setSelectedTeamFilter(e.target.value)}
                className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="ALL">All Teams</option>
                {teams.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tab 1: Wages Table */}
        {activeTab === "wages" && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-12 text-slate-400">Loading wage records...</div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Users size={32} className="mx-auto mb-2 text-slate-300" />
                <p>No labour records found matching criteria.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Worker & Team</th>
                    <th className="py-2.5 px-3">Days / Rate</th>
                    <th className="py-2.5 px-3 text-right">Gross Salary</th>
                    <th className="py-2.5 px-3 text-right">Upad (Adv)</th>
                    <th className="py-2.5 px-3 text-right">Paid Now</th>
                    <th className="py-2.5 px-3 text-right">Balance Due</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredRecords.map((r) => {
                    const balanceNum = Number(r.balance) || 0;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition group">
                        <td className="py-3 px-3 font-medium text-slate-900 whitespace-nowrap">
                          {r.date}
                          {r.siteLocationName && (
                            <div className="text-[10px] text-slate-400">{r.siteLocationName}</div>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{r.labourName}</div>
                          <div className="text-[11px] text-indigo-600 font-medium">{r.labourTeam || "Individual"}</div>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-800">{r.days} Days</span>
                          <span className="text-slate-400"> @ ₹{r.dailyRate}/day</span>
                          {Number(r.otherEarnings) > 0 && (
                            <div className="text-[10px] text-emerald-600">+₹{r.otherEarnings} extra</div>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                          {formatCurrency(r.grossSalary)}
                        </td>

                        <td className="py-3 px-3 text-right font-medium text-amber-600 whitespace-nowrap">
                          {Number(r.upad) > 0 ? formatCurrency(r.upad) : "-"}
                        </td>

                        <td className="py-3 px-3 text-right font-medium text-emerald-600 whitespace-nowrap">
                          {Number(r.paymentAmount) > 0 ? formatCurrency(r.paymentAmount) : "-"}
                          {r.paymentMethod && (
                            <div className="text-[9px] text-slate-400 uppercase">{r.paymentMethod}</div>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            balanceNum > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                          }`}>
                            {formatCurrency(balanceNum)}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleEdit(r)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition"
                              title="Edit Record"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(r.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                              title="Delete Record"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Upad & Advance Register */}
        {activeTab === "upad" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Worker Name</th>
                  <th className="py-2.5 px-3">Contractor Team</th>
                  <th className="py-2.5 px-3 text-right">Advance (Upad)</th>
                  <th className="py-2.5 px-3 text-right">Total Gross</th>
                  <th className="py-2.5 px-3 text-right">Disbursed</th>
                  <th className="py-2.5 px-3 text-right">Net Remaining Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredRecords.filter(r => Number(r.upad) > 0).map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 font-medium text-slate-900">{r.date}</td>
                    <td className="py-3 px-3 font-semibold text-slate-900">{r.labourName}</td>
                    <td className="py-3 px-3 text-indigo-600">{r.labourTeam || "Individual"}</td>
                    <td className="py-3 px-3 text-right font-bold text-amber-600">{formatCurrency(r.upad)}</td>
                    <td className="py-3 px-3 text-right text-slate-600">{formatCurrency(r.grossSalary)}</td>
                    <td className="py-3 px-3 text-right text-emerald-600">{formatCurrency(r.paymentAmount)}</td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-900">{formatCurrency(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Teams Roster */}
        {activeTab === "teams" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
            {teams.map(team => {
              const teamRecords = records.filter(r => r.labourTeam === team);
              const teamTotalGross = teamRecords.reduce((sum, r) => sum + (Number(r.grossSalary) || 0), 0);
              const teamTotalPaid = teamRecords.reduce((sum, r) => sum + (Number(r.paymentAmount) || 0), 0);
              const teamMembers = Array.from(new Set(teamRecords.map(r => r.labourName)));

              return (
                <div key={team} className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-900 text-sm">{team}</span>
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold">
                        {teamMembers.length} Workers
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mb-3">
                      Workers: {teamMembers.slice(0, 3).join(", ") || "No records yet"}
                      {teamMembers.length > 3 ? ` +${teamMembers.length - 3} more` : ""}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Wages:</span>
                      <span className="font-bold text-slate-800">{formatCurrency(teamTotalGross)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Disbursed:</span>
                      <span className="font-bold text-emerald-600">{formatCurrency(teamTotalPaid)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Record Wage Modal */}
      <Modal 
        isOpen={isRecordModalOpen} 
        onClose={() => setIsRecordModalOpen(false)}
        title={editingId ? "Edit Labour Wage Record" : "Record Labour Attendance & Wage"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Location / Branch *</label>
              <select
                value={formData.locationId}
                onChange={(e) => {
                  const locId = Number(e.target.value);
                  const loc = locations.find(l => l.id === locId);
                  setFormData(prev => ({ ...prev, locationId: locId, siteLocationName: loc?.name || "" }));
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              >
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Worker Name *</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={formData.labourName}
                onChange={(e) => setFormData(prev => ({ ...prev, labourName: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contractor Team</label>
              <select
                value={formData.labourTeam}
                onChange={(e) => setFormData(prev => ({ ...prev, labourTeam: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">None (Individual)</option>
                {teams.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Attendance and Calculation Row */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Attendance & Wage Calculation</span>
              <div className="flex gap-1">
                {["Full-day", "Half-day", "1.5 Days", "Overtime"].map(type => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => handleAttendanceTypeChange(type)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                      formData.attendanceType === type ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Days Worked</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.days}
                  onChange={(e) => setFormData(prev => ({ ...prev, days: Number(e.target.value) }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Daily Rate (₹)</label>
                <input
                  type="number"
                  value={formData.dailyRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dailyRate: Number(e.target.value) }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Other Earnings (₹)</label>
                <input
                  type="number"
                  value={formData.otherEarnings}
                  onChange={(e) => setFormData(prev => ({ ...prev, otherEarnings: Number(e.target.value) }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-center">
              <div>
                <span className="text-[10px] text-slate-400 block">Gross</span>
                <span className="text-xs font-bold text-slate-800">₹{computedGross}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Deduction</span>
                <input
                  type="number"
                  value={formData.deduction}
                  onChange={(e) => setFormData(prev => ({ ...prev, deduction: Number(e.target.value) }))}
                  className="w-full px-1.5 py-0.5 text-xs text-center bg-white border border-slate-200 rounded"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Net Wage</span>
                <span className="text-xs font-bold text-indigo-600">₹{computedNet}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Balance Due</span>
                <span className={`text-xs font-bold ${computedBalance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  ₹{computedBalance}
                </span>
              </div>
            </div>
          </div>

          {/* Disbursements & Advance (Upad) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Advance / Upad (₹)</label>
              <input
                type="number"
                value={formData.upad}
                onChange={(e) => setFormData(prev => ({ ...prev, upad: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Paid Now (₹)</label>
              <input
                type="number"
                value={formData.paymentAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, paymentAmount: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Mode</label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="CASH">Cash</option>
                <option value="BANK">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Description</label>
            <input
              type="text"
              placeholder="e.g. Masonry work on 2nd floor, TC #104"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsRecordModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm"
            >
              {editingId ? "Update Voucher" : "Save Wage Voucher"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Manage Teams Modal */}
      <Modal
        isOpen={isManageTeamsOpen}
        onClose={() => setIsManageTeamsOpen(false)}
        title="Contractor & Labour Teams"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="New team name (e.g. Team Gamma)"
              value={newTeamInput}
              onChange={(e) => setNewTeamInput(e.target.value)}
              className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              onClick={handleAddTeam}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition"
            >
              Add Team
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {teams.map(t => (
              <div key={t} className="py-2.5 flex items-center justify-between text-xs text-slate-700">
                <span className="font-medium">{t}</span>
                <span className="text-[10px] text-slate-400">
                  {records.filter(r => r.labourTeam === t).length} records
                </span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
