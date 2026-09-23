import React, { useState, useEffect } from "react";
import { History, Search, RefreshCw, Filter } from "lucide-react";
import { apiFetch } from "../lib/api";

export default function ActivityLogPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/audit-logs").catch(() => []);
      if (Array.isArray(res)) setActivities(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = activities.filter((act) => {
    const matchMod = moduleFilter === "ALL" || act.module === moduleFilter;
    const matchSearch = (act.action || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (act.reference || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (act.user || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchMod && matchSearch;
  });

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header matching 13_activity_log.svg */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Activity Log</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Audit trail of system activity</p>
        </div>

        <button
          type="button"
          onClick={loadLogs}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Refresh Audit Logs</span>
        </button>
      </div>

      {/* Filters Box matching 13_activity_log.svg */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="text-xs font-bold text-slate-800">Filters</div>
        
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search activity or reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-60 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none"
          />
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            <option value="ALL">All Modules</option>
            <option value="Material Purchase">Material Purchase</option>
            <option value="Site Supply">Site Supply</option>
            <option value="Customer Supply">Customer Supply</option>
            <option value="Investor Capital">Investor Capital</option>
            <option value="Contractor Cost">Contractor Cost</option>
          </select>
        </div>
      </div>

      {/* System Activity Table matching 13_activity_log.svg */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">System Activity</h2>
          <span className="text-xs font-semibold text-slate-500">{filtered.length} Entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="p-3.5">Date / Time</th>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Module</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Reference</th>
                <th className="p-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">No activity log entries found.</td>
                </tr>
              ) : (
                filtered.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 text-slate-600 font-medium whitespace-nowrap">{act.date}</td>
                    <td className="p-3.5 font-bold text-slate-900">{act.user}</td>
                    <td className="p-3.5 font-semibold text-blue-700">{act.module}</td>
                    <td className="p-3.5 font-medium text-slate-800">{act.action}</td>
                    <td className="p-3.5 font-mono text-slate-500">{act.reference}</td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold uppercase">
                        {act.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
