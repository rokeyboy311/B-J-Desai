import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Layers, ArrowDownToLine, Search, Filter, RefreshCw, 
  TrendingUp, TrendingDown, Package, DollarSign, ShoppingCart, 
  Truck, ArrowRight, Eye, X, CheckCircle2, AlertCircle, 
  AlertTriangle, ShieldCheck, ChevronRight, Trash2
} from 'lucide-react';
import { apiFetch, getStoredPinToken } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

interface MaterialAnalyticsData {
  summary: {
    totalPurchasedValue: number;
    totalPurchasedQty: number;
    totalMaterialSupplyValue: number;
    totalMaterialSupplyQty: number;
    totalSiteSupplyValue: number;
    totalSiteSupplyQty: number;
    totalOverallSuppliedValue: number;
    totalOverallSuppliedQty: number;
    totalStockInventoryValuation: number;
    totalGrossProfit: number;
    distinctMaterialsCount: number;
  };
  materials: Array<{
    materialId?: number;
    materialName: string;
    category: string;
    unit: string;
    purchasedQty: number;
    totalPurchaseCost: number;
    avgPurchaseRate: number;
    minPurchaseRate: number;
    maxPurchaseRate: number;
    purchaseCount: number;
    materialSupplyQty: number;
    materialSupplyAmount: number;
    avgMaterialSupplyRate: number;
    siteSupplyQty: number;
    siteSupplyAmount: number;
    avgSiteSupplyRate: number;
    totalSuppliedQty: number;
    totalSuppliedAmount: number;
    avgOverallSupplyRate: number;
    currentStock: number;
    stockValuation: number;
    status: string;
    rateSpread: number;
    grossProfit: number;
    marginPercent: number;
    purchases: any[];
    materialSupplies: any[];
    siteSupplies: any[];
  }>;
}

interface MaterialAnalyticsSectionProps {
  selectedLocation?: string;
  locationName?: string;
}

export default function MaterialAnalyticsSection({
  selectedLocation = "ALL",
  locationName = "All Project Sites"
}: MaterialAnalyticsSectionProps) {
  const { showToast, confirmAction } = useToast();
  const [data, setData] = useState<MaterialAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedMaterial, setSelectedMaterial] = useState<any | null>(null);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'ALL' | 'PURCHASES' | 'MATERIAL_SUPPLY' | 'SITE_SUPPLY'>('ALL');

  const fetchAnalytics = async (isBackground = false) => {
    try {
      if (!isBackground && !data) setLoading(true);
      const queryParam = selectedLocation && selectedLocation !== 'ALL' ? `?locationId=${selectedLocation}` : '';
      const res = await apiFetch(`/reports/material-analytics${queryParam}`);
      setData(res);
    } catch (err: any) {
      console.error('Failed to load material analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(false);
  }, [selectedLocation]);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const queryParam = selectedLocation && selectedLocation !== 'ALL' ? `?locationId=${selectedLocation}` : '';
      const url = `/api/reports/export-material-analytics${queryParam}`;
      const token = getStoredPinToken();
      const response = await fetch(url, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'x-app-pin-token': token || '',
        },
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `Material_Purchase_Supply_Analytics_${locationName.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Material Analytics Excel file downloaded successfully.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const handleDeleteMaterial = async (matId?: number, matName?: string) => {
    if (!matId) {
      showToast("Cannot delete: Material ID not found", "error");
      return;
    }
    const confirmed = await confirmAction({
      title: "Delete Material from Stock",
      message: `Are you sure you want to delete "${matName || 'this material'}" from Central Stock?`,
      confirmLabel: "Delete Material",
      isDanger: true
    });
    if (!confirmed) return;

    try {
      await apiFetch(`/materials/stock/${matId}`, { method: "DELETE" });
      showToast(`Material "${matName}" deleted successfully`, "success");
      fetchAnalytics(false);
    } catch (err: any) {
      showToast(err.message || "Failed to delete material", "error");
    }
  };

  const filteredMaterials = useMemo(() => {
    if (!data?.materials) return [];
    return data.materials.filter(m => {
      const matchSearch = m.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.category && m.category.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchStatus = statusFilter === 'ALL' || m.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [data?.materials, searchTerm, statusFilter]);

  const chartData = useMemo(() => {
    if (!data?.materials) return [];
    // Sort by total purchase cost descending, top 8 materials
    return [...data.materials]
      .sort((a, b) => b.totalPurchaseCost - a.totalPurchaseCost)
      .slice(0, 8)
      .map(m => ({
        name: m.materialName.length > 12 ? m.materialName.substring(0, 10) + '..' : m.materialName,
        fullName: m.materialName,
        'Purchase Cost': m.totalPurchaseCost,
        'Supplied Value': m.totalSuppliedAmount,
        'Stock Valuation': m.stockValuation
      }));
  }, [data?.materials]);

  if (loading && !data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mb-4 animate-spin">
          <RefreshCw className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800">મટિરિયલ એનાલિટિક્સ લોડ થઈ રહ્યું છે...</h3>
        <p className="text-xs text-slate-500 mt-1">Calculating material purchase prices, supply rates, and stock ledgers...</p>
      </div>
    );
  }

  const summary = data?.summary || {
    totalPurchasedValue: 0,
    totalPurchasedQty: 0,
    totalMaterialSupplyValue: 0,
    totalMaterialSupplyQty: 0,
    totalSiteSupplyValue: 0,
    totalSiteSupplyQty: 0,
    totalOverallSuppliedValue: 0,
    totalOverallSuppliedQty: 0,
    totalStockInventoryValuation: 0,
    totalGrossProfit: 0,
    distinctMaterialsCount: 0
  };

  return (
    <div id="material-analytics-module" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-indigo-600/10 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30 mb-2">
              <Layers className="w-3.5 h-3.5" />
              <span>મટિરિયલ ખરીદી vs સપ્લાય ભાવ પૃથ્થકરણ (Costing & Pricing Audit)</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Material Purchase vs Supply Analytics
            </h2>
            <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-2xl">
              Real-time audit comparing material purchase prices against material supplies (Cat 4) and site dispatches (Cat 5) with exact stock deduction and gross profit metrics.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="refresh-material-analytics-btn"
              onClick={() => fetchAnalytics(false)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/15"
              title="Refresh Analytics"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
            <button
              id="export-material-analytics-excel-btn"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>{isExporting ? 'Exporting...' : 'Export Excel (.xlsx)'}</span>
            </button>
          </div>
        </div>

        {/* Top 4 Summary Cards inside the header */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-medium text-slate-300 block">Total Material Purchases</span>
            <div className="text-lg md:text-xl font-bold text-white mt-0.5">
              {formatCurrency(summary.totalPurchasedValue)}
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold mt-0.5 block">
              {summary.totalPurchasedQty.toLocaleString()} Total Units Bought
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-medium text-slate-300 block">Total Overall Supplies</span>
            <div className="text-lg md:text-xl font-bold text-white mt-0.5">
              {formatCurrency(summary.totalOverallSuppliedValue)}
            </div>
            <span className="text-[10px] text-blue-300 font-semibold mt-0.5 block">
              {summary.totalOverallSuppliedQty.toLocaleString()} Units (Cat 4 + Cat 5)
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-medium text-slate-300 block">Current Stock Valuation</span>
            <div className="text-lg md:text-xl font-bold text-amber-300 mt-0.5">
              {formatCurrency(summary.totalStockInventoryValuation)}
            </div>
            <span className="text-[10px] text-slate-300 font-semibold mt-0.5 block">
              Remaining in Warehouse Stock
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-medium text-slate-300 block">Estimated Trading Profit</span>
            <div className={`text-lg md:text-xl font-bold mt-0.5 ${summary.totalGrossProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(summary.totalGrossProfit)}
            </div>
            <span className="text-[10px] text-slate-300 font-semibold mt-0.5 block">
              Rate Spread on Supplied Materials
            </span>
          </div>
        </div>
      </div>

      {/* Sub-breakdown: Cat 4 Material Supply vs Cat 5 Site Supply */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs text-slate-500 font-medium block">Category 4: Material Supplies</span>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {formatCurrency(summary.totalMaterialSupplyValue)}
            </div>
            <span className="text-[11px] text-slate-500">
              {summary.totalMaterialSupplyQty.toLocaleString()} units supplied to clients
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs text-slate-500 font-medium block">Category 5: Site Dispatches</span>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {formatCurrency(summary.totalSiteSupplyValue)}
            </div>
            <span className="text-[11px] text-slate-500">
              {summary.totalSiteSupplyQty.toLocaleString()} units delivered to teams
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs text-slate-500 font-medium block">Cataloged Materials</span>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {summary.distinctMaterialsCount} Unique Items
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold">
              All Normalized in UPPERCASE
            </span>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Top Materials: Purchase vs Supply Financial Comparison</h3>
              <p className="text-xs text-slate-500 mt-0.5">High-volume items comparing total procurement investment against supplied revenue</p>
            </div>
            <span className="text-xs font-bold text-slate-400">Top {chartData.length} Items</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} interval={0} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(val) => `₹${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`} />
                <Tooltip
                  formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, '']}
                  contentStyle={{ backgroundColor: "#1e293b", borderRadius: "8px", color: "#fff", border: "none", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                <Bar dataKey="Purchase Cost" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Supplied Value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Stock Valuation" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="material-analytics-search-input"
              type="text"
              placeholder="Search material by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Stock Status:</span>
            {['ALL', 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'NEGATIVE_ALERT'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st === 'ALL' ? 'All' : st.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Granular Material Analytics Table */}
        <div className="overflow-x-auto mt-4 border rounded-xl border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200/80">
              <tr>
                <th className="px-4 py-3">Material Name</th>
                <th className="px-3 py-3 text-right">Purchased (Qty / Cost)</th>
                <th className="px-3 py-3 text-right">Avg Purchase Rate</th>
                <th className="px-3 py-3 text-right">Supplied (Qty / Value)</th>
                <th className="px-3 py-3 text-right">Avg Supply Rate</th>
                <th className="px-3 py-3 text-right">Current Stock</th>
                <th className="px-3 py-3 text-right">Stock Valuation</th>
                <th className="px-3 py-3 text-right">Profit / Margin</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-3 py-3 text-center">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-xs text-slate-400">
                    No matching materials found for this filter.
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((m, idx) => {
                  const isNegative = m.currentStock < 0;
                  const isOut = m.currentStock === 0;
                  const isLow = m.currentStock > 0 && m.currentStock <= 15;

                  const statusBadge = isNegative ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                      <AlertTriangle className="w-3 h-3" /> Neg Alert
                    </span>
                  ) : isOut ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      Out of Stock
                    </span>
                  ) : isLow ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                      Low Stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                      In Stock
                    </span>
                  );

                  return (
                    <tr key={m.materialId || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 tracking-wide">{m.materialName}</div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          Unit: {m.unit} • {m.category || 'General'}
                        </div>
                      </td>

                      <td className="px-3 py-3.5 text-right">
                        <div className="font-bold text-slate-800">{m.purchasedQty.toLocaleString()} {m.unit}</div>
                        <div className="text-[10px] text-slate-500 font-semibold">{formatCurrency(m.totalPurchaseCost)}</div>
                      </td>

                      <td className="px-3 py-3.5 text-right font-bold text-indigo-700">
                        {m.avgPurchaseRate > 0 ? `₹${m.avgPurchaseRate.toFixed(2)}` : '-'}
                        {m.minPurchaseRate > 0 && m.maxPurchaseRate !== m.minPurchaseRate && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            Min: ₹{m.minPurchaseRate} | Max: ₹{m.maxPurchaseRate}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3.5 text-right">
                        <div className="font-bold text-slate-800">{m.totalSuppliedQty.toLocaleString()} {m.unit}</div>
                        <div className="text-[10px] text-slate-500 font-semibold">{formatCurrency(m.totalSuppliedAmount)}</div>
                        <div className="text-[9px] text-slate-400">
                          Cat4: {m.materialSupplyQty} | Site: {m.siteSupplyQty}
                        </div>
                      </td>

                      <td className="px-3 py-3.5 text-right font-bold text-cyan-700">
                        {m.avgOverallSupplyRate > 0 ? `₹${m.avgOverallSupplyRate.toFixed(2)}` : '-'}
                      </td>

                      <td className="px-3 py-3.5 text-right">
                        <span className={`font-extrabold ${isNegative ? 'text-rose-600' : isOut ? 'text-slate-400' : 'text-slate-900'}`}>
                          {m.currentStock.toLocaleString()} {m.unit}
                        </span>
                      </td>

                      <td className="px-3 py-3.5 text-right font-bold text-amber-700">
                        {formatCurrency(m.stockValuation)}
                      </td>

                      <td className="px-3 py-3.5 text-right">
                        <div className={`font-bold ${m.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatCurrency(m.grossProfit)}
                        </div>
                        {m.marginPercent !== 0 && (
                          <div className={`text-[10px] font-semibold ${m.marginPercent > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {m.marginPercent > 0 ? `+${m.marginPercent}%` : `${m.marginPercent}%`}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3.5 text-center">
                        {statusBadge}
                      </td>

                      <td className="px-3 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            id={`view-mat-detail-${idx}`}
                            onClick={() => {
                              setSelectedMaterial(m);
                              setActiveHistoryTab('ALL');
                            }}
                            title={`View ${m.materialName} Ledger`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all border border-indigo-200/60"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ledger</span>
                          </button>
                          {m.materialId && (
                            <button
                              id={`delete-mat-${m.materialId}`}
                              type="button"
                              onClick={() => handleDeleteMaterial(m.materialId, m.materialName)}
                              title={`Delete ${m.materialName}`}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Itemized Material Transaction History Modal */}
      {selectedMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                  Material Transaction Audit
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  {selectedMaterial.materialName} ({selectedMaterial.unit})
                </h3>
              </div>
              <button
                onClick={() => setSelectedMaterial(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Material Quick Metric Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-indigo-50/40 border-b border-indigo-100/50 text-xs">
              <div>
                <span className="text-slate-500 font-medium block">Purchased Qty / Cost</span>
                <span className="font-bold text-slate-900">
                  {selectedMaterial.purchasedQty} {selectedMaterial.unit} (₹{selectedMaterial.totalPurchaseCost.toLocaleString()})
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Supplied Qty / Value</span>
                <span className="font-bold text-slate-900">
                  {selectedMaterial.totalSuppliedQty} {selectedMaterial.unit} (₹{selectedMaterial.totalSuppliedAmount.toLocaleString()})
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Remaining Warehouse Stock</span>
                <span className="font-bold text-emerald-700">
                  {selectedMaterial.currentStock} {selectedMaterial.unit}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Avg Price Spread</span>
                <span className={`font-bold ${selectedMaterial.rateSpread >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  ₹{selectedMaterial.rateSpread} / unit ({selectedMaterial.marginPercent}%)
                </span>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="px-5 pt-3 border-b border-slate-100 flex gap-2">
              <button
                onClick={() => setActiveHistoryTab('ALL')}
                className={`pb-2.5 px-2 text-xs font-bold border-b-2 transition-all ${
                  activeHistoryTab === 'ALL'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                All Entries ({selectedMaterial.purchases.length + selectedMaterial.materialSupplies.length + selectedMaterial.siteSupplies.length})
              </button>
              <button
                onClick={() => setActiveHistoryTab('PURCHASES')}
                className={`pb-2.5 px-2 text-xs font-bold border-b-2 transition-all ${
                  activeHistoryTab === 'PURCHASES'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Purchases ({selectedMaterial.purchases.length})
              </button>
              <button
                onClick={() => setActiveHistoryTab('MATERIAL_SUPPLY')}
                className={`pb-2.5 px-2 text-xs font-bold border-b-2 transition-all ${
                  activeHistoryTab === 'MATERIAL_SUPPLY'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Material Supply ({selectedMaterial.materialSupplies.length})
              </button>
              <button
                onClick={() => setActiveHistoryTab('SITE_SUPPLY')}
                className={`pb-2.5 px-2 text-xs font-bold border-b-2 transition-all ${
                  activeHistoryTab === 'SITE_SUPPLY'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Site Supply Dispatches ({selectedMaterial.siteSupplies.length})
              </button>
            </div>

            {/* Modal Scrollable Table */}
            <div className="p-5 overflow-y-auto max-h-[50vh]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Transaction Type</th>
                    <th className="px-3 py-2.5">Party / Team / Person</th>
                    <th className="px-3 py-2.5 text-right">Quantity</th>
                    <th className="px-3 py-2.5 text-right">Rate</th>
                    <th className="px-3 py-2.5 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Purchases */}
                  {(activeHistoryTab === 'ALL' || activeHistoryTab === 'PURCHASES') &&
                    selectedMaterial.purchases.map((p: any) => (
                      <tr key={`pur-${p.id}`} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 text-slate-600">{p.date}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800">
                            PURCHASE (IN)
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">{p.partyName || '-'}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-indigo-700">+{p.quantity} {p.unit}</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">₹{p.rate}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-900">₹{p.totalAmount.toLocaleString()}</td>
                      </tr>
                    ))}

                  {/* Material Supplies */}
                  {(activeHistoryTab === 'ALL' || activeHistoryTab === 'MATERIAL_SUPPLY') &&
                    selectedMaterial.materialSupplies.map((s: any) => (
                      <tr key={`sup-${s.id}`} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 text-slate-600">{s.date}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-100 text-cyan-800">
                            MAT SUPPLY (OUT)
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">{s.partyName || '-'}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-rose-600">-{s.quantity} {s.unit}</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">₹{s.rate}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-900">₹{s.totalAmount.toLocaleString()}</td>
                      </tr>
                    ))}

                  {/* Site Supplies */}
                  {(activeHistoryTab === 'ALL' || activeHistoryTab === 'SITE_SUPPLY') &&
                    selectedMaterial.siteSupplies.map((st: any) => (
                      <tr key={`site-${st.id}-${st.itemId}`} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 text-slate-600">{st.date}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800">
                            SITE SUPPLY (OUT)
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">
                          {st.teamName} {st.responsiblePerson ? `(${st.responsiblePerson})` : ''}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-rose-600">-{st.quantity} {st.unit}</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">₹{st.rate}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-900">₹{st.totalAmount.toLocaleString()}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setSelectedMaterial(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
