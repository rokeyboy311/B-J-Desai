import React, { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { History, FileText, MapPin } from "lucide-react";
import { useLiveSync } from "../hooks/useLiveSync";

interface AuditLog {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  metadata: string | null;
  createdAt: string;
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async (isBackground = false) => {
    try {
      if (!isBackground && logs.length === 0) setLoading(true);
      const data = await apiFetch("/audit-logs");
      setLogs(data || []);
    } catch (error) {
      console.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(false);
  }, []);

  useLiveSync(() => {
    fetchLogs(true);
  }, 3500);

  const formatAction = (action: string) => {
    return action.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  };

  const getActionColor = (action: string) => {
    if (action.includes('CREATE')) return 'bg-emerald-100 text-emerald-800';
    if (action.includes('UPDATE')) return 'bg-amber-100 text-amber-800';
    if (action.includes('DELETE')) return 'bg-rose-100 text-rose-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <History className="w-6 h-6 text-indigo-600" /> Activity Log
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Centralized audit trail of system events and financial mutations.</p>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <History className="mx-auto mb-3 text-slate-300" size={36} />
            <p className="font-semibold text-slate-700">No activity recorded yet</p>
            <p className="text-xs text-slate-400 mt-1">Actions performed across locations will appear here</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {logs.map((log) => (
              <li key={log.id} className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 p-2 rounded-xl bg-slate-100 text-slate-600 shrink-0">
                      {log.entityType === 'LOCATION' ? (
                        <MapPin size={16} />
                      ) : (
                        <FileText size={16} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-900">
                          {formatAction(log.action)}
                        </p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${getActionColor(log.action)}`}>
                          {log.action.split('_')[0]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {log.entityType} #{log.entityId}
                      </p>
                      {log.metadata && (
                        <p className="text-xs text-slate-500 mt-1 font-mono bg-slate-50 p-2 rounded-xl border border-slate-100 break-all max-w-xl">
                          {log.metadata}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-left sm:text-right shrink-0 pl-11 sm:pl-0">
                    <p className="text-xs font-medium text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
