import React, { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { Receipt, Search, Filter, Download } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Modal } from "../components/ui/Modal";

interface GlobalRecord {
  id: number;
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  date: string;
  partyName: string;
  category: string | null;
  description: string | null;
  locationId: number;
  locationName: string | null;
}

export default function GlobalRecordsPage() {
  const [searchParams] = useSearchParams();
  const [records, setRecords] = useState<GlobalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const navigate = useNavigate();

  useEffect(() => {
    const urlSearch = searchParams.get("search");
    if (urlSearch !== null) {
      setSearchTerm(urlSearch);
    }
  }, [searchParams]);

  // Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let url = `/api/reports/export-all`;
      const params = new URLSearchParams();
      if (exportStartDate) params.append("startDate", exportStartDate);
      if (exportEndDate) params.append("endDate", exportEndDate);
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${await (await import('../lib/firebase')).auth.currentUser?.getIdToken()}`
        }
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'Bina-Enterprise-Export.xlsx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      setIsExportModalOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to generate export file.');
    }
  };

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const data = await apiFetch("/records/all");
        setRecords(data);
      } catch (error) {
        console.error("Failed to load records");
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  const filteredRecords = records.filter(r => 
    r.partyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.category?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.locationName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-indigo-500" /> All Records
          </h1>
          <p className="text-sm text-slate-500 mt-1">View the complete ledger across all your locations.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search party, category, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
            />
          </div>
          <button type="button" 
            onClick={() => setIsExportModalOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-all shrink-0"
          >
            <Download size={16} />
            Export All
          </button>
        </div>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Party Name</th>
                <th className="px-6 py-4 font-semibold">Location</th>
                <th className="px-6 py-4 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-slate-500 bg-slate-50/30">
                    <div className="w-16 h-16 bg-white border border-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <Receipt className="text-slate-300" size={28} />
                    </div>
                    <p className="font-medium text-slate-600">No records found.</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr 
                    key={record.id} 
                    onClick={() => navigate(`/locations/${record.locationId}`)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-slate-700 font-medium">{record.date}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{record.partyName}</div>
                      {record.category && <div className="text-xs text-slate-500 mt-1 font-medium bg-slate-100 inline-block px-2 py-0.5 rounded-md">{record.category}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100/50">
                        {record.locationName || 'Unknown Location'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`font-bold text-base tracking-tight ${record.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {record.type === 'INCOME' ? '+' : '-'}{formatCurrency(Number(record.amount))}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Modal */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Export All Data"
      >
        <form onSubmit={handleExport} className="space-y-4">
          <p className="text-sm text-slate-500 mb-4 font-medium">
            Select a date range to export records across all locations. Leave fields empty to export all records.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="exportStartDate" className="block text-sm font-semibold text-slate-700 mb-1.5">From Date</label>
              <input
                id="exportStartDate"
                type="date"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <div>
              <label htmlFor="exportEndDate" className="block text-sm font-semibold text-slate-700 mb-1.5">To Date</label>
              <input
                id="exportEndDate"
                type="date"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          </div>
          
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsExportModalOpen(false)}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors flex items-center gap-2"
            >
              <Download size={16} />
              Download Excel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
