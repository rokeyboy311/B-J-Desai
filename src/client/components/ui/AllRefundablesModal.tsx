import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './Modal';
import { apiFetch } from '../../lib/api';
import { downloadExcelReport } from '../../lib/excelExport';
import { useToast } from '../../contexts/ToastContext';
import { 
  Receipt, Search, Download, CheckCircle2, Clock, 
  ArrowUpRight, AlertCircle, Building, Filter, RefreshCw
} from 'lucide-react';

interface AllRefundablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLocationId?: number | string;
}

export function AllRefundablesModal({ isOpen, onClose, initialLocationId }: AllRefundablesModalProps) {
  const { showToast } = useToast();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PARTIAL' | 'REFUNDED'>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>(
    initialLocationId && initialLocationId !== 'ALL' ? String(initialLocationId) : 'ALL'
  );
  const [locationsList, setLocationsList] = useState<{ id: number; name: string }[]>([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLocations();
      loadRecords();
    }
  }, [isOpen, selectedLocation]);

  const loadLocations = async () => {
    try {
      const data = await apiFetch('/locations');
      if (Array.isArray(data)) {
        setLocationsList(data);
      }
    } catch (err) {
      console.error('Failed to load locations:', err);
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      const query = selectedLocation && selectedLocation !== 'ALL' ? `?locationId=${selectedLocation}` : '';
      const data = await apiFetch(`/reports/all-refundable-records${query}`);
      setRecords(Array.isArray(data) ? data : []);
    } catch (err: any) {
      showToast(err.message || 'Failed to load refundable records', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = !term ||
        (r.partyName || '').toLowerCase().includes(term) ||
        (r.locationName || '').toLowerCase().includes(term) ||
        (r.description || '').toLowerCase().includes(term) ||
        (r.referenceNumber || '').toLowerCase().includes(term) ||
        (r.notes || '').toLowerCase().includes(term);

      const status = (r.refundStatus || 'PENDING').toUpperCase();
      let matchStatus = true;
      if (statusFilter === 'PENDING') matchStatus = status === 'PENDING';
      else if (statusFilter === 'PARTIAL') matchStatus = status === 'PARTIAL';
      else if (statusFilter === 'REFUNDED') matchStatus = status === 'REFUNDED' || status === 'FULL';

      return matchSearch && matchStatus;
    });
  }, [records, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    let totalDisbursed = 0;
    let totalRefunded = 0;
    records.forEach(r => {
      totalDisbursed += Number(r.refundableAmount || r.amount || 0);
      totalRefunded += Number(r.refundedAmount || 0);
    });
    const pending = Math.max(0, Math.round((totalDisbursed - totalRefunded) * 100) / 100);
    return {
      totalDisbursed: Math.round(totalDisbursed * 100) / 100,
      totalRefunded: Math.round(totalRefunded * 100) / 100,
      pending,
      count: records.length
    };
  }, [records]);

  const handleExportExcel = async () => {
    setDownloading(true);
    try {
      const query = selectedLocation && selectedLocation !== 'ALL' ? `?locationId=${selectedLocation}` : '';
      await downloadExcelReport(`/reports/export-refundable-records${query}`, `Refundable_Records_${selectedLocation}.xlsx`);
      showToast('Excel file downloaded successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to download Excel', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="All Refundable Records (બધા રિફન્ડેબલ ડિપોઝિટ અને એડવાન્સ રેકોર્ડ)"
      maxWidth="max-w-6xl"
    >
      <div className="space-y-4">
        {/* Top Financial Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-gradient-to-r from-purple-900/90 via-indigo-900 to-slate-900 p-4 rounded-2xl text-white shadow-sm border border-purple-500/20">
          <div>
            <div className="text-[11px] font-bold text-purple-200 uppercase tracking-wider">Total Disbursed (કુલ ડિપોઝિટ)</div>
            <div className="text-xl font-black text-white mt-0.5">₹{Number(summary?.totalDisbursed || 0).toLocaleString("en-IN")}</div>
            <div className="text-[10px] text-purple-300 mt-0.5">{summary?.count || 0} Total Records</div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">Received Back (પરત મળેલ)</div>
            <div className="text-xl font-black text-emerald-400 mt-0.5">₹{Number(summary?.totalRefunded || 0).toLocaleString("en-IN")}</div>
            <div className="text-[10px] text-emerald-200 mt-0.5">Reconciled to Cash/Bank</div>
          </div>
          <div className="sm:col-span-2 bg-white/10 p-3 rounded-xl border border-white/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">લેવાના બાકી (Pending Balance)</div>
              <div className="text-xl sm:text-2xl font-black text-amber-300 mt-0.5">₹{Number(summary?.pending || 0).toLocaleString("en-IN")}</div>
              <div className="text-[10px] text-slate-300 mt-0.5">Project Capital Receivable</div>
            </div>
            <button
              onClick={handleExportExcel}
              disabled={downloading}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs shrink-0 cursor-pointer disabled:opacity-50 min-h-[36px]"
            >
              <Download className="w-4 h-4" />
              {downloading ? 'Exporting...' : 'Export Excel (.xlsx)'}
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Location Select */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedLocation}
                onChange={e => setSelectedLocation(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-bold text-slate-800 cursor-pointer"
              >
                <option value="ALL">All Project Locations (બધા પ્રોજેક્ટ)</option>
                {locationsList.map(l => (
                  <option key={l.id} value={String(l.id)}>{l.name}</option>
                ))}
              </select>
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs text-xs">
              {[
                { key: 'ALL', label: 'All' },
                { key: 'PENDING', label: 'Pending (લેવાના બાકી)' },
                { key: 'PARTIAL', label: 'Partial' },
                { key: 'REFUNDED', label: 'Completed' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key as any)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    statusFilter === tab.key
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Input & Refresh */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search party, description, ref..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={loadRecords}
              className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 shadow-2xs cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Detailed Table & Mobile Cards */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
          {/* Mobile Card List (< 640px) */}
          <div className="block sm:hidden divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
            {filteredRecords.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-sm text-slate-600">No refundable records found.</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search term.</p>
              </div>
            ) : (
              filteredRecords.map((r, i) => {
                const orig = Number(r.refundableAmount || r.amount || 0);
                const refd = Number(r.refundedAmount || 0);
                const pend = Math.max(0, Math.round((orig - refd) * 100) / 100);
                const status = (r.refundStatus || 'PENDING').toUpperCase();

                return (
                  <div key={r.id || i} className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{r.partyName}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
                          <span>{r.date}</span>
                          <span>•</span>
                          <span className="font-medium text-purple-700">{r.locationName}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                        status === 'REFUNDED' || status === 'FULL'
                          ? 'bg-emerald-100 text-emerald-800'
                          : status === 'PARTIAL'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {status === 'REFUNDED' || status === 'FULL' ? '✓ REFUNDED' : status === 'PARTIAL' ? 'PARTIAL' : 'PENDING'}
                      </span>
                    </div>

                    {r.description && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">
                        {r.description}
                      </p>
                    )}

                    <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 rounded-xl text-center">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Deposit</span>
                        <span className="text-xs font-bold text-slate-900">₹{orig.toLocaleString("en-IN")}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Refunded</span>
                        <span className="text-xs font-bold text-emerald-600">₹{refd.toLocaleString("en-IN")}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Pending</span>
                        <span className="text-xs font-bold text-amber-700">₹{pend.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table (>= 640px) */}
          <div className="hidden sm:block max-h-[480px] overflow-y-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Project / Location</th>
                  <th className="p-3.5">Party / Receiver Name</th>
                  <th className="p-3.5">Purpose / Deposit Type</th>
                  <th className="p-3.5 text-right">Total Deposit (₹)</th>
                  <th className="p-3.5 text-right text-emerald-700">Refunded (₹)</th>
                  <th className="p-3.5 text-right text-amber-700">Pending (₹)</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5">Payment Method & Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r, i) => {
                  const orig = Number(r.refundableAmount || r.amount || 0);
                  const refd = Number(r.refundedAmount || 0);
                  const pend = Math.max(0, Math.round((orig - refd) * 100) / 100);
                  const status = (r.refundStatus || 'PENDING').toUpperCase();

                  return (
                    <tr key={r.id || i} className="hover:bg-purple-50/40 transition-colors">
                      <td className="p-3.5 font-medium text-slate-600">{r.date}</td>
                      <td className="p-3.5 font-bold text-slate-800">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px]">
                          {r.locationName}
                        </span>
                      </td>
                      <td className="p-3.5 font-black text-slate-900">{r.partyName}</td>
                      <td className="p-3.5 text-slate-700 max-w-[200px] truncate" title={r.description}>
                        {r.description || 'Security Deposit'}
                      </td>
                      <td className="p-3.5 text-right font-black text-slate-900">
                        ₹{orig.toLocaleString("en-IN")}
                      </td>
                      <td className="p-3.5 text-right font-bold text-emerald-600">
                        ₹{refd.toLocaleString("en-IN")}
                      </td>
                      <td className="p-3.5 text-right font-black text-amber-700">
                        ₹{pend.toLocaleString("en-IN")}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                          status === 'REFUNDED' || status === 'FULL'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : status === 'PARTIAL'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {status === 'REFUNDED' || status === 'FULL' ? '✓ FULLY REFUNDED' : status === 'PARTIAL' ? '⚡ PARTIAL REFUND' : '⏳ PENDING'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600 font-mono text-[11px]">
                        {r.paymentMethod || '-'} {r.referenceNumber ? `(${r.referenceNumber})` : ''}
                      </td>
                    </tr>
                  );
                })}

                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-slate-400">
                      <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-sm text-slate-600">No refundable records found.</p>
                      <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search term.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
          <span>Showing {filteredRecords.length} of {records.length} records</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition-all cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
    </Modal>
  );
}
