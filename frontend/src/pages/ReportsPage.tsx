import React, { useState, useEffect } from "react";
import { apiFetch, apiDownload } from "../lib/api";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from "recharts";
import { 
  FileSpreadsheet, Download, Calendar, DollarSign, 
  Receipt, ShieldCheck, ArrowDownLeft, ArrowUpRight, Filter, Building2,
  TrendingUp, TrendingDown, Layers
} from "lucide-react";
import { useBusiness } from "../contexts/BusinessContext";

export default function ReportsPage() {
  const { activeLocationId } = useBusiness();
  const [activeTab, setActiveTab] = useState<"overview" | "pnl" | "gst">("overview");
  const [data, setData] = useState<{
    monthly: any[];
    categories: any[];
  } | null>(null);
  const [gstData, setGstData] = useState<any | null>(null);
  const [pnlData, setPnlData] = useState<any | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Date filters for GST and PnL
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const locQuery = selectedLocationId !== "all" ? `&locationId=${selectedLocationId}` : "";
        const [analyticsRes, gstRes, pnlRes, locRes] = await Promise.all([
          apiFetch(`/reports/analytics?${locQuery}`).catch(() => ({ monthly: [], categories: [] })),
          apiFetch(`/reports/gst-returns?startDate=${startDate}&endDate=${endDate}${locQuery}`).catch(() => null),
          apiFetch(`/reports/pnl?startDate=${startDate}&endDate=${endDate}${locQuery}`).catch(() => null),
          apiFetch("/locations").catch(() => [])
        ]);

        setData(analyticsRes);
        setGstData(gstRes);
        setPnlData(pnlRes);
        setLocations(Array.isArray(locRes) ? locRes : []);
      } catch (error) {
        console.error("Failed to load reports data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate, selectedLocationId]);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const query = selectedLocationId !== "all" ? `?locationId=${selectedLocationId}` : "";
      await apiDownload(`/reports/export/excel${query}`, `B_D_Enterprise_18Sheet_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", { 
      style: "currency", 
      currency: "INR", 
      maximumFractionDigits: 0 
    }).format(value);
  };

  const COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const mappedCategories = (data.categories || []).map(c => ({
    name: c.category || "General",
    value: c.total || 0,
  }));

  const totalAnnualRevenue = (data.monthly || []).reduce((sum, m) => sum + (m.revenue || 0), 0);
  const totalAnnualExpense = (data.monthly || []).reduce((sum, m) => sum + (m.expense || 0), 0);
  const totalAnnualProfit = totalAnnualRevenue - totalAnnualExpense;

  return (
    <div className="space-y-6">
      {/* Top Header & Global Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Accounting, GST & Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Financial analytics, GSTR preparation statements, P&L reporting, and 18-sheet audit export
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Location Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700">
            <Building2 size={14} className="text-slate-400" />
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="bg-transparent border-none text-slate-800 font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          {/* 18-Sheet Consolidated Export Button */}
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
          >
            <FileSpreadsheet size={15} />
            <span>{exporting ? "Generating 18 Sheets..." : "Export 18-Sheet Excel"}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "overview"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Annual Performance & Trends
        </button>
        <button
          onClick={() => setActiveTab("pnl")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "pnl"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Profit & Loss Statement (P&L)
        </button>
        <button
          onClick={() => setActiveTab("gst")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "gst"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          GST Returns (GSTR-1 & GSTR-3B)
        </button>
      </div>

      {/* TAB 1: OVERVIEW & TRENDS */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Executive KPI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Trailing 12M Revenue</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalAnnualRevenue)}</p>
              <span className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
                <ArrowUpRight size={13} /> GST Invoices + Goods Dispatches
              </span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Trailing 12M Purchases & Costs</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalAnnualExpense)}</p>
              <span className="text-xs text-rose-500 font-medium mt-1 flex items-center gap-1">
                <ArrowDownLeft size={13} /> Material Purchases + Overheads
              </span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Net Operating Margin</span>
              <p className={`text-2xl font-bold mt-1 ${totalAnnualProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {formatCurrency(totalAnnualProfit)}
              </p>
              <span className="text-xs text-slate-500 mt-1 block">
                {totalAnnualRevenue > 0 ? `${Math.round((totalAnnualProfit / totalAnnualRevenue) * 100)}% net margin` : "0%"}
              </span>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 12-Month Bar Chart */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900 mb-4">Monthly Revenue vs. Expense Inflow</h2>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <Tooltip 
                      formatter={(v: any) => [formatCurrency(Number(v)), '']}
                      contentStyle={{ backgroundColor: "#0f172a", borderRadius: 8, color: "#fff", border: "none" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Bar dataKey="revenue" name="Revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Expenditure" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Operating Expense Breakdown Pie Chart */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900 mb-4">Operating Expense Distribution</h2>
              <div className="h-56 w-full">
                {mappedCategories.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mappedCategories}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {mappedCategories.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => [formatCurrency(Number(v)), '']} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No operating expense records
                  </div>
                )}
              </div>
              <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                {mappedCategories.slice(0, 5).map((cat, idx) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                    <span className="flex items-center gap-1.5 text-slate-600 truncate max-w-[140px]">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                      {cat.name}
                    </span>
                    <span className="font-semibold text-slate-900">{formatCurrency(cat.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROFIT & LOSS STATEMENT */}
      {activeTab === "pnl" && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">Period:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5"
            />
          </div>

          {pnlData ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Profit & Loss Account</h3>
                  <p className="text-xs text-slate-500">From {startDate} to {endDate}</p>
                </div>
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                  (pnlData.netProfit || 0) >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                }`}>
                  Net Profit: {formatCurrency(pnlData.netProfit || 0)}
                </span>
              </div>

              <div className="divide-y divide-slate-100 text-sm">
                {/* 1. Operating Revenue */}
                <div className="p-5 space-y-2 bg-slate-50/50">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">1. Gross Revenue / Turnover</span>
                  <div className="flex justify-between py-1 text-slate-700">
                    <span>Tax Invoices (Sales Billing)</span>
                    <span className="font-semibold">{formatCurrency(pnlData.revenue?.salesInvoices || 0)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-700">
                    <span>Material Supplies (Dispatches)</span>
                    <span className="font-semibold">{formatCurrency(pnlData.revenue?.suppliesTotal || 0)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-700">
                    <span>Direct Receipts / Income</span>
                    <span className="font-semibold">{formatCurrency(pnlData.revenue?.directIncome || 0)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 font-bold text-indigo-950 border-t border-slate-200">
                    <span>Total Gross Revenue (A)</span>
                    <span>{formatCurrency(pnlData.revenue?.grossRevenue || 0)}</span>
                  </div>
                </div>

                {/* 2. Direct Costs / COGS */}
                <div className="p-5 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">2. Direct Procurement / COGS</span>
                  <div className="flex justify-between py-1 text-slate-700">
                    <span>Material Purchases (Procurement Bills)</span>
                    <span className="font-semibold">{formatCurrency(pnlData.directCosts?.purchases || 0)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 font-bold text-slate-900 border-t border-slate-200">
                    <span>Total Cost of Goods Sold (B)</span>
                    <span>{formatCurrency(pnlData.directCosts?.cogs || 0)}</span>
                  </div>
                  <div className="flex justify-between py-2 font-bold text-emerald-700 bg-emerald-50/50 px-3 rounded-lg">
                    <span>Gross Profit (A - B)</span>
                    <span>{formatCurrency(pnlData.directCosts?.grossProfit || 0)}</span>
                  </div>
                </div>

                {/* 3. Operating Overheads */}
                <div className="p-5 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">3. Operating Overheads & Salaries</span>
                  <div className="flex justify-between py-1 text-slate-700">
                    <span>General & Site Operating Expenses</span>
                    <span className="font-semibold">{formatCurrency(pnlData.operatingExpenses?.generalExpenses || 0)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-700">
                    <span>Labour Wages & Employee Salaries</span>
                    <span className="font-semibold">{formatCurrency(pnlData.operatingExpenses?.labourWages || 0)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 font-bold text-slate-900 border-t border-slate-200">
                    <span>Total Operating Overheads (C)</span>
                    <span>{formatCurrency(pnlData.operatingExpenses?.totalOverheads || 0)}</span>
                  </div>
                </div>

                {/* 4. Net Operating Profit */}
                <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
                  <div>
                    <span className="text-xs uppercase font-bold text-slate-400">Net Operating Profit / (Loss)</span>
                    <p className="text-xs text-slate-300">Gross Profit minus Operating Overheads</p>
                  </div>
                  <span className="text-2xl font-black text-emerald-400">
                    {formatCurrency(pnlData.netProfit || 0)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-400">Loading Profit & Loss statement...</div>
          )}
        </div>
      )}

      {/* TAB 3: GST RETURNS */}
      {activeTab === "gst" && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">Filing Period:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5"
            />
          </div>

          {gstData?.gstr3b && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">GSTR-1 Outward Taxable</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(gstData.gstr1.taxableValue || 0)}</p>
                <span className="text-xs text-slate-500 mt-1 block">
                  {gstData.gstr1.totalInvoices || 0} Invoices ({gstData.gstr1.b2bInvoices || 0} B2B, {gstData.gstr1.b2cInvoices || 0} B2C)
                </span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Output GST Liability</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(gstData.gstr3b.outwardTax || 0)}</p>
                <span className="text-xs text-slate-500 mt-1 block">Tax collected on invoices</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs uppercase font-bold tracking-wider text-emerald-600">Eligible ITC (Purchases)</span>
                <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(gstData.gstr3b.eligibleItc || 0)}</p>
                <span className="text-xs text-slate-500 mt-1 block">Input Tax Credit from bills</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs uppercase font-bold tracking-wider text-indigo-600">Net Tax Payable (Cash)</span>
                <p className="text-2xl font-bold text-indigo-700 mt-1">{formatCurrency(gstData.gstr3b.netTaxPayable || 0)}</p>
                <span className="text-xs text-slate-500 mt-1 block">
                  {gstData.gstr3b.closingItcBalance > 0 
                    ? `Carry-forward ITC: ${formatCurrency(gstData.gstr3b.closingItcBalance)}`
                    : "Payable after ITC set-off"}
                </span>
              </div>
            </div>
          )}

          {/* GSTR-1 Outward Supplies Table */}
          {gstData?.gstr1 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200">
                <h3 className="text-base font-bold text-slate-900">GSTR-1 Outward Supplies Summary</h3>
                <p className="text-xs text-slate-500">Component-wise breakup of tax charged on sales invoices</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                    <tr>
                      <th className="px-5 py-3">Component</th>
                      <th className="px-5 py-3 text-right">Taxable Turnover (₹)</th>
                      <th className="px-5 py-3 text-right">Tax Collected (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    <tr>
                      <td className="px-5 py-3.5 font-medium">Central GST (CGST)</td>
                      <td className="px-5 py-3.5 text-right">{formatCurrency(gstData.gstr1.taxableValue || 0)}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-slate-900">{formatCurrency(gstData.gstr1.cgst || 0)}</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3.5 font-medium">State GST (SGST)</td>
                      <td className="px-5 py-3.5 text-right">{formatCurrency(gstData.gstr1.taxableValue || 0)}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-slate-900">{formatCurrency(gstData.gstr1.sgst || 0)}</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3.5 font-medium">Integrated GST (IGST)</td>
                      <td className="px-5 py-3.5 text-right">{formatCurrency(gstData.gstr1.taxableValue || 0)}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-slate-900">{formatCurrency(gstData.gstr1.igst || 0)}</td>
                    </tr>
                    <tr className="bg-slate-50 font-bold">
                      <td className="px-5 py-3.5 text-indigo-900">Total Outward Supplies</td>
                      <td className="px-5 py-3.5 text-right text-indigo-900">{formatCurrency(gstData.gstr1.taxableValue || 0)}</td>
                      <td className="px-5 py-3.5 text-right text-indigo-900">{formatCurrency(gstData.gstr1.totalTax || 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
