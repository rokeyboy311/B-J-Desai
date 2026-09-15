import React, { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from "recharts";
import { 
  FileSpreadsheet, Download, Calendar, DollarSign, 
  Receipt, ShieldCheck, ArrowDownLeft, ArrowUpRight, Filter, Building2
} from "lucide-react";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "gst">("overview");
  const [data, setData] = useState<{
    monthly: any[];
    categories: any[];
  } | null>(null);
  const [gstData, setGstData] = useState<any | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Date filters for GST
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
        const [analyticsRes, gstRes, locRes] = await Promise.all([
          apiFetch("/reports/analytics").catch(() => ({ monthly: [], categories: [] })),
          apiFetch(`/reports/gst-returns?startDate=${startDate}&endDate=${endDate}`).catch(() => null),
          apiFetch("/locations").catch(() => [])
        ]);

        setData(analyticsRes);
        setGstData(gstRes);
        setLocations(Array.isArray(locRes) ? locRes : []);
      } catch (error) {
        console.error("Failed to load reports data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate]);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const query = selectedLocationId !== "all" ? `?locationId=${selectedLocationId}` : "";
      const res = await fetch(`/api/reports/export-all${query}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Bina_Enterprise_Consolidated_Report_${new Date().toISOString().split("T")[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
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
  const totalAnnualCost = (data.monthly || []).reduce((sum, m) => sum + (m.expense || 0), 0);
  const netAnnualProfit = totalAnnualRevenue - totalAnnualCost;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="text-indigo-600" size={26} /> Financial Reports & GST Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Audited financial health, GST compliance return summaries (GSTR-1 & 3B), and consolidated exports
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition-all shadow-md shadow-emerald-600/20 active:scale-95"
          >
            <Download size={16} />
            {exporting ? "Generating..." : "Export Consolidated Excel"}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "overview"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Financial Overview & Monthly Run-Rate
        </button>
        <button
          onClick={() => setActiveTab("gst")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "gst"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          GST Returns (GSTR-1 & GSTR-3B)
        </button>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Executive KPI Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-600">Total Business Inflows</span>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(totalAnnualRevenue)}</p>
              <span className="text-xs text-slate-500 mt-1 block">Sales Invoices & Material Supplies</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs uppercase font-bold tracking-wider text-rose-600">Total Operating Outflows</span>
              <p className="text-2xl font-bold text-rose-600 mt-1">{formatCurrency(totalAnnualCost)}</p>
              <span className="text-xs text-slate-500 mt-1 block">Material Purchases & Site Expenses</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs uppercase font-bold tracking-wider text-indigo-600">Net Operating Position</span>
              <p className={`text-2xl font-bold mt-1 ${netAnnualProfit >= 0 ? "text-indigo-700" : "text-amber-600"}`}>
                {formatCurrency(netAnnualProfit)}
              </p>
              <span className="text-xs text-slate-500 mt-1 block">Net Operational Surplus / (Deficit)</span>
            </div>
          </div>

          {/* Monthly Run-Rate Bar Chart */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">Monthly Revenue vs Outflow</h3>
                <p className="text-xs text-slate-500">12-month consolidated financial movement across all sites</p>
              </div>
            </div>

            <div className="h-80 w-full">
              {data.monthly.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  No monthly activity recorded yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                    <YAxis 
                      tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: "#64748b", fontSize: 12 }} 
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      cursor={{ fill: "#f8fafc" }}
                      contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
                    />
                    <Legend wrapperStyle={{ paddingTop: "12px" }} />
                    <Bar dataKey="revenue" name="Revenue / Billing (₹)" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={45} />
                    <Bar dataKey="expense" name="Costs & Outflows (₹)" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={45} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-1">Expense Distribution by Category</h3>
            <p className="text-xs text-slate-500 mb-6">Categorized allocation of site expenses and operational overheads</p>

            <div className="h-80 w-full flex items-center justify-center">
              {mappedCategories.length === 0 ? (
                <p className="text-slate-400 text-sm">No categorized expenses found.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mappedCategories}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={105}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="name"
                    >
                      {mappedCategories.map((entry, index) => (
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

      {activeTab === "gst" && (
        <div className="space-y-6">
          {/* Date Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Calendar size={18} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">GST Filing Period:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-800"
              />
              <span className="text-slate-400 text-sm">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-800"
              />
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Applicable for Monthly / Quarterly Return Computation
            </div>
          </div>

          {/* GSTR-3B Tax Liability & Offset Matrix */}
          {gstData?.gstr3b && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Outward Taxable Value</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(gstData.gstr3b.outwardTaxable || 0)}</p>
                <span className="text-xs text-slate-500 mt-1 block">Gross B2B / B2C Supplies</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs uppercase font-bold tracking-wider text-rose-600">Total Output GST (Liability)</span>
                <p className="text-2xl font-bold text-rose-700 mt-1">{formatCurrency(gstData.gstr3b.outwardTax || 0)}</p>
                <span className="text-xs text-slate-500 mt-1 block">CGST + SGST + IGST on Invoices</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs uppercase font-bold tracking-wider text-emerald-600">Eligible ITC (Input Credit)</span>
                <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(gstData.gstr3b.eligibleItc || 0)}</p>
                <span className="text-xs text-slate-500 mt-1 block">GST paid on Material Purchases</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
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

          {/* GSTR-1 Tax Component Breakdown Table */}
          {gstData?.gstr1 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
