import React, { useState, useEffect } from "react";
import { apiFetch, getStoredPinToken, getApiUrl } from "../lib/api";
import { Receipt, Search, Filter, Download, Pencil, Trash2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Modal } from "../components/ui/Modal";
import { useLiveSync, triggerSync } from "../hooks/useLiveSync";
import { useToast } from "../contexts/ToastContext";

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
  const { showToast, confirmAction } = useToast();
  const [searchParams] = useSearchParams();
  const [records, setRecords] = useState<GlobalRecord[]>(() => {
    try {
      const saved = sessionStorage.getItem('bd_erp_records_cache');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const saved = sessionStorage.getItem('bd_erp_records_cache');
      return !(saved && JSON.parse(saved).length > 0);
    } catch {
      return true;
    }
  });
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const navigate = useNavigate();

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<GlobalRecord | null>(null);
  const [editForm, setEditForm] = useState({
    amount: "",
    date: "",
    partyName: "",
    category: "",
    description: "",
    type: "EXPENSE" as 'INCOME' | 'EXPENSE'
  });

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
      let url = getApiUrl('/reports/export-all');
      const params = new URLSearchParams();
      if (exportStartDate) params.append("startDate", exportStartDate);
      if (exportEndDate) params.append("endDate", exportEndDate);
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      const token = getStoredPinToken();
      const response = await fetch(url, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'x-app-pin-token': token || ''
        }
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'BJ-Export.xlsx';
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
      showToast("Export file downloaded successfully", "success");
    } catch (error: any) {
      console.error('Export failed:', error);
      showToast('Failed to generate export file.', 'error');
    }
  };

  const fetchRecords = async (isBackground = false) => {
    try {
      if (!isBackground && records.length === 0) setLoading(true);
      const data = await apiFetch("/records/all");
      if (Array.isArray(data)) {
        setRecords(data);
        try {
          sessionStorage.setItem('bd_erp_records_cache', JSON.stringify(data));
        } catch {}
      }
    } catch (error) {
      console.error("Failed to load records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords(false);
  }, []);

  useLiveSync(() => {
    fetchRecords(true);
  }, 3500);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  const handleOpenEdit = (record: GlobalRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingRecord(record);
    setEditForm({
      amount: String(record.amount || ""),
      date: record.date || new Date().toISOString().split("T")[0],
      partyName: record.partyName || "",
      category: record.category || "",
      description: record.description || "",
      type: record.type || "EXPENSE"
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    const amt = parseFloat(editForm.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast("Please enter a valid positive amount", "error");
      return;
    }

    try {
      await apiFetch(`/records/${editingRecord.id}`, {
        method: "PUT",
        body: JSON.stringify({
          locationId: editingRecord.locationId,
          type: editForm.type,
          amount: amt,
          date: editForm.date,
          partyName: editForm.partyName.trim() || undefined,
          category: editForm.category.trim() || undefined,
          description: editForm.description.trim() || undefined
        })
      });

      showToast("Record updated successfully", "success");
      setIsEditModalOpen(false);
      setEditingRecord(null);
      triggerSync("records");
      fetchRecords(true);
    } catch (err: any) {
      showToast(err.message || "Failed to update record", "error");
    }
  };

  const handleDeleteRecord = async (record: GlobalRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const confirmed = await confirmAction({
      title: "Delete Record",
      message: `Are you sure you want to delete this ${record.type.toLowerCase()} record of ₹${parseFloat(record.amount).toLocaleString('en-IN')} for ${record.partyName}?`,
      confirmLabel: "Delete",
      isDanger: true
    });

    if (!confirmed) return;

    try {
      await apiFetch(`/records/${record.id}`, { method: "DELETE" });
      showToast("Record deleted successfully", "success");
      triggerSync("records");
      fetchRecords(true);
    } catch (err: any) {
      showToast(err.message || "Failed to delete record", "error");
    }
  };

  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

  const filteredRecords = records.filter(r => {
    const matchesSearch = 
      r.partyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (r.category && r.category.toLowerCase().includes(searchTerm.toLowerCase())) || 
      (r.locationName && r.locationName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = typeFilter === 'ALL' || r.type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-indigo-600" /> All Records
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Centralized financial transaction ledger across all locations.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search party, category, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-xs"
            />
          </div>
          <button type="button" 
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-all shrink-0 cursor-pointer"
          >
            <Download size={15} />
            Export Excel
          </button>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setTypeFilter('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            typeFilter === 'ALL'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All Records ({records.length})
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter('INCOME')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            typeFilter === 'INCOME'
              ? 'bg-emerald-600 text-white'
              : 'bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50/50'
          }`}
        >
          Income ({records.filter(r => r.type === 'INCOME').length})
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter('EXPENSE')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            typeFilter === 'EXPENSE'
              ? 'bg-rose-600 text-white'
              : 'bg-white border border-slate-200 text-rose-700 hover:bg-rose-50/50'
          }`}
        >
          Expenses ({records.filter(r => r.type === 'EXPENSE').length})
        </button>
      </div>

      {/* Mobile Card View (< 640px) */}
      <div className="block sm:hidden space-y-3">
        {filteredRecords.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            <Receipt className="mx-auto text-slate-300 mb-2" size={32} />
            <p className="font-semibold text-slate-700">No records found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          filteredRecords.map((record) => (
            <div
              key={record.id}
              onClick={() => navigate(`/locations/${record.locationId}`)}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-2.5 active:bg-slate-50 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm leading-tight">{record.partyName}</h4>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                    <span>{record.date}</span>
                    <span>•</span>
                    <span className="text-indigo-600 font-medium truncate max-w-[140px]">{record.locationName || 'Location'}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`font-bold text-base tracking-tight block ${
                    record.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {record.type === 'INCOME' ? '+' : '-'}{formatCurrency(Number(record.amount))}
                  </span>
                  <span className={`inline-block text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                    record.type === 'INCOME' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {record.type}
                  </span>
                </div>
              </div>
              {record.category && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium">{record.category}</span>
                  <span className="text-indigo-600 text-xs font-semibold">View Details →</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Desktop / Tablet Table View (>= 640px) */}
      <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-3.5 font-semibold">Date</th>
                <th className="px-6 py-3.5 font-semibold">Party Name</th>
                <th className="px-6 py-3.5 font-semibold">Location</th>
                <th className="px-6 py-3.5 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-slate-500 bg-slate-50/30">
                    <div className="w-16 h-16 bg-white border border-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xs">
                      <Receipt className="text-slate-300" size={28} />
                    </div>
                    <p className="font-semibold text-slate-600">No records found.</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr 
                    key={record.id} 
                    onClick={() => navigate(`/locations/${record.locationId}`)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-3.5 whitespace-nowrap text-slate-700 font-medium">{record.date}</td>
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{record.partyName}</div>
                      {record.category && <div className="text-xs text-slate-500 mt-0.5 font-medium bg-slate-100 inline-block px-2 py-0.5 rounded-md">{record.category}</div>}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100/50">
                        {record.locationName || 'Unknown Location'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-right">
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
          <p className="text-xs sm:text-sm text-slate-500 mb-2 font-medium">
            Select a date range to export records across all locations. Leave fields empty to export all records.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label htmlFor="exportStartDate" className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">From Date</label>
              <input
                id="exportStartDate"
                type="date"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
              />
            </div>
            <div>
              <label htmlFor="exportEndDate" className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">To Date</label>
              <input
                id="exportEndDate"
                type="date"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
              />
            </div>
          </div>
          
          <div className="pt-4 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsExportModalOpen(false)}
              className="px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Download size={15} />
              Download Excel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
