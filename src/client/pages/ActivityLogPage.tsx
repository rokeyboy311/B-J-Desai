import React, { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { History, FileText, MapPin } from "lucide-react";

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

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await apiFetch("/audit-logs");
        setLogs(data);
      } catch (error) {
        console.error("Failed to load audit logs");
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

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
        <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
        <p className="text-sm text-gray-500 mt-1">Audit trail of all actions performed in your Hisab-Kitab.</p>
      </header>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <History className="mx-auto mb-3 text-gray-400" size={32} />
            <p>No activity recorded yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {logs.map((log) => (
              <li key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="mt-1">
                      {log.entityType === 'LOCATION' ? (
                        <MapPin className="text-indigo-500" size={18} />
                      ) : (
                        <FileText className="text-indigo-500" size={18} />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatAction(log.action)}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {log.entityType} #{log.entityId}
                      </p>
                      {log.metadata && (
                        <p className="text-xs text-gray-400 mt-1 font-mono bg-gray-50 p-1 rounded border border-gray-100 inline-block">
                          {log.metadata}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                      {log.action.split('_')[0]}
                    </span>
                    <p className="text-xs text-gray-500 mt-2">
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
