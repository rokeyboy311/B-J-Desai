import React, { useState, useEffect } from "react";
import { FileSpreadsheet, Download, RefreshCw, BarChart2, PieChart, Table } from "lucide-react";
import { downloadExcelReport } from "../lib/excelExport";
import { apiFetch } from "../lib/api";
import { formatINR, formatDate } from "../lib/formatters";

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<"capital" | "material" | "location" | "gst">("gst");
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async (type: "capital" | "material" | "location" | "gst") => {
    setSelectedReport(type);
    setLoading(true);
    try {
      const endpoint = type === "capital" 
        ? "/reports/dashboard?locationId=ALL"
        : type === "material"
        ? "/materials/central-stock"
        : type === "location"
        ? "/reports/locations-breakdown"
        : "/reports/gst";

      const res = await apiFetch(endpoint).catch(() => null);
      setReportData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport("gst");
  }, []);

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header matching 12_reports.svg */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Reports</h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">Business reporting, GST records and traceability</p>
      </div>

      {/* Top 4 Report Cards matching 12_reports.svg */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Capital Report */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Capital Report</h2>
            <p className="text-[11px] text-slate-400">Admin &rarr; Investor &rarr; Investment</p>
          </div>
          <button
            type="button"
            onClick={() => fetchReport("capital")}
            className="w-full py-2 px-3 bg-[#1E88E5] hover:bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
          >
            Open Report
          </button>
        </div>

        {/* Material Report */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Material Report</h2>
            <p className="text-[11px] text-slate-400">Purchase &rarr; Stock &rarr; Supply</p>
          </div>
          <button
            type="button"
            onClick={() => fetchReport("material")}
            className="w-full py-2 px-3 bg-[#10B981] hover:bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
          >
            Open Report
          </button>
        </div>

        {/* Location Report */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Location Report</h2>
            <p className="text-[11px] text-slate-400">Location-wise analytics</p>
          </div>
          <button
            type="button"
            onClick={() => fetchReport("location")}
            className="w-full py-2 px-3 bg-[#8B5CF6] hover:bg-purple-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
          >
            Open Report
          </button>
        </div>

        {/* GST Report */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">GST Report</h2>
            <p className="text-[11px] text-slate-400">Taxable + GST + Grand Total</p>
          </div>
          <button
            type="button"
            onClick={() => fetchReport("gst")}
            className="w-full py-2 px-3 bg-[#F59E0B] hover:bg-amber-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
          >
            Open Report
          </button>
        </div>

      </div>

      {/* Report Builder Box matching 12_reports.svg */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">Report Builder</h2>
          <button
            type="button"
            onClick={() => downloadExcelReport(`/reports/export-all`, `Complete_ERP_Report.xlsx`)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Complete Master Excel</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Select Module</label>
            <select
              value={selectedReport}
              onChange={(e) => fetchReport(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
            >
              <option value="gst">GST Tax Audit Report (All Modules)</option>
              <option value="capital">Capital Flow Report</option>
              <option value="material">Material Stock Report</option>
              <option value="location">Location Analytics Report</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Date Range</label>
            <input
              type="text"
              readOnly
              value="All Time Ledger Records"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => fetchReport(selectedReport)}
              className="w-full py-2 px-4 bg-[#0B1D3A] text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Generate Preview
            </button>
          </div>
        </div>
      </div>

      {/* Report Preview Box matching 12_reports.svg */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-6 min-h-[300px]">
        <h2 className="text-sm font-bold text-slate-900 mb-4">
          {selectedReport === "gst" ? "Complete GST Records (Purchase, Customer Supply, Site Supply & Bill Investment)" : "Report Preview"}
        </h2>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">Generating report data...</div>
        ) : !reportData ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Select a report above and click <b>Open Report</b> or <b>Generate Preview</b>.
          </div>
        ) : selectedReport === "gst" && reportData.records ? (
          <div className="space-y-5">
            {/* GST Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Taxable Subtotal</div>
                <div className="text-sm font-black text-slate-900 mt-1 break-all">₹{formatINR(reportData.summary?.totalTaxableSubtotal || 0)}</div>
              </div>
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                <div className="text-[10px] font-bold text-amber-700 uppercase">Total GST Amount</div>
                <div className="text-sm font-black text-amber-800 mt-1 break-all">₹{formatINR(reportData.summary?.totalGstAmount || 0)}</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                <div className="text-[10px] font-bold text-blue-700 uppercase">Purchase GST</div>
                <div className="text-sm font-black text-blue-800 mt-1 break-all">₹{formatINR(reportData.summary?.purchaseGst || 0)}</div>
              </div>
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                <div className="text-[10px] font-bold text-emerald-700 uppercase">Customer Supply GST</div>
                <div className="text-sm font-black text-emerald-800 mt-1 break-all">₹{formatINR(reportData.summary?.customerSupplyGst || 0)}</div>
              </div>
              <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200">
                <div className="text-[10px] font-bold text-indigo-700 uppercase">Site Supply GST</div>
                <div className="text-sm font-black text-indigo-800 mt-1 break-all">₹{formatINR(reportData.summary?.siteSupplyGst || 0)}</div>
              </div>
              <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
                <div className="text-[10px] font-bold text-rose-700 uppercase">Bill Investment GST</div>
                <div className="text-sm font-black text-rose-800 mt-1 break-all">₹{formatINR(reportData.summary?.billInvestmentGst || 0)}</div>
              </div>
            </div>

            {/* GST Records Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                    <th className="py-3 px-3 whitespace-nowrap">Date</th>
                    <th className="py-3 px-3">Module</th>
                    <th className="py-3 px-3">Party / Team</th>
                    <th className="py-3 px-3">Material / Particulars</th>
                    <th className="py-3 px-3 text-right">Qty &amp; Rate</th>
                    <th className="py-3 px-3 text-right">Taxable Subtotal</th>
                    <th className="py-3 px-3 text-right">GST (% &amp; ₹)</th>
                    <th className="py-3 px-3 text-right">Grand Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.records.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">No GST records found.</td>
                    </tr>
                  ) : (
                    reportData.records.map((rec: any) => (
                      <tr key={rec.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-medium text-slate-600 whitespace-nowrap">{formatDate(rec.date)}</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10px] border border-slate-200">
                            {rec.module}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{rec.party}</td>
                        <td className="py-2.5 px-3 text-slate-700">{rec.materialName}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums whitespace-nowrap">
                          {rec.quantity} × ₹{formatINR(rec.rate)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                          ₹{formatINR(rec.subtotal)}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="font-bold text-amber-600 tabular-nums">₹{formatINR(rec.taxAmount)}</div>
                          <span className="inline-block px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px]">
                            {rec.taxPercentage}% GST
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900 tabular-nums whitespace-nowrap">
                          ₹{formatINR(rec.totalAmount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <pre className="p-4 bg-slate-50 rounded-xl border border-slate-200 font-mono text-slate-800 overflow-auto max-h-[400px]">
              {JSON.stringify(reportData, null, 2)}
            </pre>
          </div>
        )}
      </div>

    </div>
  );
}
