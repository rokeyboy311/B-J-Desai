import React, { useState, useEffect } from "react";
import { apiFetch, getStoredPinToken } from "../lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { FileSpreadsheet, Filter, MapPin, TrendingUp, TrendingDown, Wallet, Scale, ArrowDownRight, ArrowUpRight, CheckCircle, AlertTriangle, Layers, BarChart3, ShieldCheck } from "lucide-react";
import { useLiveSync } from "../hooks/useLiveSync";
import { useToast } from "../contexts/ToastContext";
import MaterialAnalyticsSection from "../components/MaterialAnalyticsSection";

interface LocationOption {
  id: number;
  name: string;
}

export default function ReportsPage() {
  const { showToast } = useToast();
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"MATERIAL_ANALYTICS" | "OVERVIEW" | "RECONCILIATION">("MATERIAL_ANALYTICS");
  const [reconciliation, setReconciliation] = useState<any[]>([]);
  const [data, setData] = useState<{
    monthly: any[];
    categories: any[];
  } | null>(null);
  const [kpiMetrics, setKpiMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const fetchLocations = async () => {
    try {
      const locs = await apiFetch("/locations");
      setLocations(locs || []);
    } catch (err) {
      console.error("Failed to load locations", err);
    }
  };

  const fetchReportsData = async (isBackground = false) => {
    try {
      if (!isBackground && !data) setLoading(true);
      const queryParam = selectedLocation && selectedLocation !== "ALL" ? `?locationId=${selectedLocation}` : "";
      
      const [analyticsRes, reconRes, dashboardRes] = await Promise.all([
        apiFetch(`/reports/analytics${queryParam}`),
        apiFetch("/reports/reconciliation"),
        apiFetch(`/reports/dashboard${queryParam}`),
      ]);

      setData(analyticsRes);
      setReconciliation(reconRes || []);
      setKpiMetrics(dashboardRes);
    } catch (error) {
      console.error("Failed to load reports data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    fetchReportsData(false);
  }, [selectedLocation]);

  useLiveSync(() => {
    fetchReportsData(true);
  }, 4000);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const url = selectedLocation === "ALL"
        ? "/api/reports/export-all"
        : `/api/reports/export-location/${selectedLocation}?tab=all`;

      const token = getStoredPinToken();
      const response = await fetch(url, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "x-app-pin-token": token || "",
        },
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      const contentDisposition = response.headers.get("content-disposition");
      let filename = `Bina_ERP_Report_${selectedLocation === "ALL" ? "All_Locations" : `Loc_${selectedLocation}`}.xlsx`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Excel report exported successfully.", "success");
    } catch (err) {
      console.error("Export error", err);
      showToast("Failed to export Excel report.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
  };

  const COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Filter reconciliation by selected location if not ALL
  const filteredReconciliation = selectedLocation === "ALL"
    ? reconciliation
    : reconciliation.filter((r) => String(r.locationId) === String(selectedLocation));

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Scale className="w-6 h-6 text-indigo-600" />
            Reports & Financial Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Reconciliation, monthly trends, and comprehensive operational balance audit.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          {/* Location Filter */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-xs">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer w-full"
            >
              <option value="ALL">All Operating Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Export Button */}
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 min-h-[38px] cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {isExporting ? "Generating Excel..." : "Export Excel"}
          </button>
        </div>
      </header>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          id="tab-material-analytics"
          onClick={() => setActiveTab("MATERIAL_ANALYTICS")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "MATERIAL_ANALYTICS"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>મટિરિયલ ખરીદી vs સપ્લાય ભાવ (Material Analytics)</span>
        </button>

        <button
          id="tab-overview"
          onClick={() => setActiveTab("OVERVIEW")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "OVERVIEW"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>નાણાકીય પ્રવાહ અને ચાર્ટ્સ (Cashflow & KPIs)</span>
        </button>

        <button
          id="tab-reconciliation"
          onClick={() => setActiveTab("RECONCILIATION")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === "RECONCILIATION"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          <span>સાઇટ સપ્લાય ઑડિટ (Site Reconciliation)</span>
        </button>
      </div>

      {/* Tab 1: Material Pricing & Purchase vs Supply Analytics */}
      {activeTab === "MATERIAL_ANALYTICS" && (
        <MaterialAnalyticsSection
          selectedLocation={selectedLocation}
          locationName={
            selectedLocation === "ALL"
              ? "All Project Locations"
              : (locations.find((l) => String(l.id) === selectedLocation)?.name || `Location #${selectedLocation}`)
          }
        />
      )}

      {/* Tab 2: Financial KPIs and Trend Charts */}
      {activeTab === "OVERVIEW" && (
        <div className="space-y-8">
          {/* KPI Cards */}
          {kpiMetrics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Capital / Inflow</span>
                  <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </div>
                <div className="text-xl font-extrabold text-slate-900 mt-2">
                  {formatCurrency(kpiMetrics.totalInvestment || kpiMetrics.totalIncome)}
                </div>
                <p className="text-xs text-slate-400 mt-1">Investors capital & bill revenue</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Operational Expenses</span>
                  <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
                    <ArrowDownRight className="w-4 h-4" />
                  </span>
                </div>
                <div className="text-xl font-extrabold text-rose-600 mt-2">
                  {formatCurrency(kpiMetrics.actualExpense || kpiMetrics.grossExpense)}
                </div>
                <p className="text-xs text-slate-400 mt-1">Purchases, site costs & salaries</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Available Capital Pool</span>
                  <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <Wallet className="w-4 h-4" />
                  </span>
                </div>
                <div className="text-xl font-extrabold text-emerald-600 mt-2">
                  {formatCurrency(kpiMetrics.investmentBalance || 0)}
                </div>
                <p className="text-xs text-slate-400 mt-1">Net project liquidity remaining</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Payables</span>
                  <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <AlertTriangle className="w-4 h-4" />
                  </span>
                </div>
                <div className="text-xl font-extrabold text-amber-600 mt-2">
                  {formatCurrency((kpiMetrics.totalMaterialPurchaseOutstanding || 0) + (kpiMetrics.labourMetrics?.totalBalance || 0))}
                </div>
                <p className="text-xs text-slate-400 mt-1">Outstanding vendor & labour balances</p>
              </div>
            </div>
          )}

          {/* Visual Analytics Charts */}
          {data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Inflow vs Outflow */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 mb-1">Monthly Inflow vs Outflow</h2>
                <p className="text-xs text-slate-500 mb-4">Capital receipts compared to project expenditures</p>
                <div className="h-72">
                  {data.monthly.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No monthly activity recorded yet.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                        <Bar dataKey="Income" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Inflow" />
                        <Bar dataKey="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} name="Outflow" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Expense Breakdown by Category */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 mb-1">Expenses by Category</h2>
                <p className="text-xs text-slate-500 mb-4">Proportional cost distribution across operational segments</p>
                <div className="h-72">
                  {data.categories.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No categorized expenses recorded yet.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.categories}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={95}
                          paddingAngle={4}
                          dataKey="value"
                          nameKey="name"
                        >
                          {data.categories.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Site Supply vs Supervisor Cost Audit & Reconciliation Table */}
      {activeTab === "RECONCILIATION" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                Site Supply vs Operational Reconciliation
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cross-audit comparing materials supplied to site vs supervisor reported costs and team distribution.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400">
              {filteredReconciliation.length} Location Audit Records
            </span>
          </div>

          {/* Mobile Reconciliation Cards (< 640px) */}
          <div className="block sm:hidden divide-y divide-slate-100">
            {filteredReconciliation.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No reconciliation records found for this location filter.
              </div>
            ) : (
              filteredReconciliation.map((r, idx) => {
                const status = r.reconciliationStatus || "MATCHED";
                const statusColors = {
                  MATCHED: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
                  SURPLUS: "bg-blue-50 text-blue-700 border-blue-200/60",
                  DEFICIT: "bg-rose-50 text-rose-700 border-rose-200/60",
                }[status] || "bg-slate-50 text-slate-700 border-slate-200";

                return (
                  <div key={r.locationId || idx} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{r.locationName || `Location #${r.locationId}`}</h4>
                        {r.teams && r.teams.length > 0 && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Teams: {r.teams.map((t: any) => t.teamName).join(", ")}
                          </p>
                        )}
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${statusColors}`}>
                        {status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-xl text-center">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Site Supply</span>
                        <span className="text-xs font-bold text-slate-800">{formatCurrency(r.totalSiteSupply || 0)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Supervisor</span>
                        <span className="text-xs font-bold text-slate-800">{formatCurrency(r.totalSupervisorCost || 0)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Variance</span>
                        <span className={`text-xs font-bold ${(r.variance || 0) < 0 ? "text-rose-600" : (r.variance || 0) > 0 ? "text-blue-600" : "text-slate-700"}`}>
                          {formatCurrency(r.variance || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop / Tablet Reconciliation Table (>= 640px) */}
          <div className="hidden sm:block overflow-x-auto">
            {filteredReconciliation.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400">
                No reconciliation records found for this location filter.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold">
                  <tr>
                    <th className="px-6 py-3.5">Location</th>
                    <th className="px-6 py-3.5 text-right">Site Supply (Cat 5)</th>
                    <th className="px-6 py-3.5 text-right">Supervisor Cost</th>
                    <th className="px-6 py-3.5 text-right">Variance</th>
                    <th className="px-6 py-3.5 text-center">Audit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReconciliation.map((r, idx) => {
                    const status = r.reconciliationStatus || "MATCHED";
                    const statusColors = {
                      MATCHED: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
                      SURPLUS: "bg-blue-50 text-blue-700 border-blue-200/60",
                      DEFICIT: "bg-rose-50 text-rose-700 border-rose-200/60",
                    }[status] || "bg-slate-50 text-slate-700 border-slate-200";

                    return (
                      <tr key={r.locationId || idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900">
                          {r.locationName || `Location #${r.locationId}`}
                          {r.teams && r.teams.length > 0 && (
                            <div className="text-[11px] text-slate-400 font-normal mt-1">
                              Teams: {r.teams.map((t: any) => `${t.teamName} (${formatCurrency(t.totalSiteSupply)})`).join(", ")}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-800">
                          {formatCurrency(r.totalSiteSupply || 0)}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-800">
                          {formatCurrency(r.totalSupervisorCost || 0)}
                        </td>
                        <td className="px-6 py-4 text-right font-bold">
                          <span className={(r.variance || 0) < 0 ? "text-rose-600" : (r.variance || 0) > 0 ? "text-blue-600" : "text-slate-700"}>
                            {formatCurrency(r.variance || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusColors}`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
