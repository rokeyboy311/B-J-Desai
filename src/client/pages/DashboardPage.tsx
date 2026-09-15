import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, Download, ArrowUpRight, ArrowDownRight, 
  Search, HardHat, Landmark, Box, Activity, FileText, ShoppingBag, 
  CreditCard, Users, Plus, ShieldCheck, TrendingUp, DollarSign, Package,
  Wallet, FileSpreadsheet, MapPin, UserCheck
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [metricsRes, analyticsRes] = await Promise.all([
        apiFetch("/reports/dashboard"),
        apiFetch("/reports/analytics").catch(() => null)
      ]);
      setMetrics(metricsRes);
      setAnalytics(analyticsRes);
    } catch (error) {
      console.error("Failed to load dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/records?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  if (loading) return (
    <div className="flex justify-center items-center h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  const totalRevenue = metrics?.totalRevenue || 0;
  const totalPurchases = metrics?.totalPurchases || 0;
  const totalOperatingCosts = metrics?.totalOperatingCosts || 0;
  const netProfit = metrics?.netProfit || 0;
  const totalReceivables = metrics?.totalReceivables || 0;
  const totalPayables = metrics?.totalPayables || 0;
  const gst = metrics?.gst || {};

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8"
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-indigo-600" />
            Executive Financial & ERP Overview
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Unified GST billing, receivables, payables, stock valuation, and operating profits
          </p>
        </div>

        <div className="flex items-center gap-3">
          <form onSubmit={handleSearch} className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search records, bills..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none w-full sm:w-60 transition-all"
            />
          </form>

          <button 
            onClick={() => navigate("/invoices")}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-sm transition-all text-sm shrink-0"
          >
            <Plus size={16} /> New Invoice
          </button>
        </div>
      </div>

      {/* Quick ERP Shortcuts Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        <button
          onClick={() => navigate("/sales")}
          className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2 text-xs font-semibold text-slate-800 transition shadow-sm"
        >
          <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <FileText size={14} />
          </div>
          <span className="truncate">GST Sales</span>
        </button>

        <button
          onClick={() => navigate("/purchases")}
          className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2 text-xs font-semibold text-slate-800 transition shadow-sm"
        >
          <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <ShoppingBag size={14} />
          </div>
          <span className="truncate">Purchases</span>
        </button>

        <button
          onClick={() => navigate("/expenses")}
          className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2 text-xs font-semibold text-slate-800 transition shadow-sm"
        >
          <div className="w-6 h-6 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
            <Wallet size={14} />
          </div>
          <span className="truncate">Expenses</span>
        </button>

        <button
          onClick={() => navigate("/inventory")}
          className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2 text-xs font-semibold text-slate-800 transition shadow-sm"
        >
          <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Package size={14} />
          </div>
          <span className="truncate">Inventory</span>
        </button>

        <button
          onClick={() => navigate("/parties")}
          className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2 text-xs font-semibold text-slate-800 transition shadow-sm"
        >
          <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users size={14} />
          </div>
          <span className="truncate">Parties</span>
        </button>

        <button
          onClick={() => navigate("/payments")}
          className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2 text-xs font-semibold text-slate-800 transition shadow-sm"
        >
          <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <CreditCard size={14} />
          </div>
          <span className="truncate">Payments</span>
        </button>

        <button
          onClick={() => navigate("/labour")}
          className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2 text-xs font-semibold text-slate-800 transition shadow-sm"
        >
          <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <UserCheck size={14} />
          </div>
          <span className="truncate">Labour</span>
        </button>

        <button
          onClick={() => navigate("/locations")}
          className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2 text-xs font-semibold text-slate-800 transition shadow-sm"
        >
          <div className="w-6 h-6 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
            <MapPin size={14} />
          </div>
          <span className="truncate">Locations</span>
        </button>
      </div>

      {/* Row 1: Core Financial Position KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Net Profit */}
        <motion.div variants={item} className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Net Business Profit</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <h3 className={`text-3xl font-bold mt-2 tracking-tight ${netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            ₹{netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p className="text-xs text-slate-400 mt-3 font-medium">
            Turnover (₹{totalRevenue.toLocaleString()}) - Direct & Operating Costs
          </p>
        </motion.div>

        {/* Receivables (Sundry Debtors) */}
        <motion.div variants={item} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-emerald-600">
            <span>Total Receivables (Debtors)</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <h3 className="text-3xl font-bold text-emerald-700 mt-2 tracking-tight">
            ₹{totalReceivables.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p className="text-xs text-slate-500 mt-3">
            Money to be collected from clients & refundable security
          </p>
        </motion.div>

        {/* Payables (Sundry Creditors) */}
        <motion.div variants={item} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-rose-600">
            <span>Total Payables (Creditors)</span>
            <ArrowDownRight className="w-4 h-4 text-rose-500" />
          </div>
          <h3 className="text-3xl font-bold text-rose-600 mt-2 tracking-tight">
            ₹{totalPayables.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p className="text-xs text-slate-500 mt-3">
            Due to suppliers, sub-contractors, and labour wages
          </p>
        </motion.div>

        {/* Net GST Position */}
        <motion.div variants={item} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-indigo-600">
            <span>Net GST Liability</span>
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
          </div>
          <h3 className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">
            ₹{parseFloat(gst.netGstPayable || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </h3>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Output: ₹{parseFloat(gst.outputGst || "0").toFixed(0)}</span>
            <span>ITC: ₹{parseFloat(gst.inputGst || "0").toFixed(0)}</span>
          </div>
        </motion.div>

      </div>

      {/* Row 2: Deep Module Financial Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Billing & Sales Position */}
        <motion.div variants={item} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <FileText size={18} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Invoicing & Sales</h4>
                <p className="text-xs text-slate-400">Total Billed vs Collected</p>
              </div>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between items-center text-slate-600">
                <span>Total Invoices Generated:</span>
                <span className="font-semibold text-slate-900 font-mono">
                  ₹{parseFloat(metrics?.invoiceMetrics?.totalAmount || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Client Payments Received:</span>
                <span className="font-semibold text-emerald-600 font-mono">
                  ₹{parseFloat(metrics?.invoiceMetrics?.paidAmount || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Material Supplies Out:</span>
                <span className="font-semibold text-slate-900 font-mono">
                  ₹{parseFloat(metrics?.totalMaterialSupply || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 mt-4 flex justify-between items-center">
            <span className="text-xs font-medium text-slate-500">Invoice Pending:</span>
            <span className="font-mono font-bold text-rose-600 text-sm">
              ₹{parseFloat(metrics?.invoiceMetrics?.balanceAmount || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </motion.div>

        {/* Procurement & Stock Valuation */}
        <motion.div variants={item} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Box size={18} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Procurement & Inventory</h4>
                <p className="text-xs text-slate-400">Raw materials & current stock</p>
              </div>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between items-center text-slate-600">
                <span>Material Purchases:</span>
                <span className="font-semibold text-slate-900 font-mono">
                  ₹{parseFloat(metrics?.totalMaterialPurchase || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Supplier Bills Paid:</span>
                <span className="font-semibold text-emerald-600 font-mono">
                  ₹{parseFloat(metrics?.totalMaterialPurchasePaid || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Current Stock Valuation:</span>
                <span className="font-semibold text-indigo-600 font-mono">
                  ₹{parseFloat(metrics?.stockValuation || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 mt-4 flex justify-between items-center">
            <span className="text-xs font-medium text-slate-500">Supplier Dues:</span>
            <span className="font-mono font-bold text-rose-600 text-sm">
              ₹{parseFloat(metrics?.totalMaterialPurchaseOutstanding || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </motion.div>

        {/* Labour & Site Costs */}
        <motion.div variants={item} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <HardHat size={18} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Labour & Site Operations</h4>
                <p className="text-xs text-slate-400">Salaries, site labour & expenses</p>
              </div>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between items-center text-slate-600">
                <span>Net Labour Salaries:</span>
                <span className="font-semibold text-slate-900 font-mono">
                  ₹{parseFloat(metrics?.labourMetrics?.totalNetSalary || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Wages Paid (Net):</span>
                <span className="font-semibold text-emerald-600 font-mono">
                  ₹{parseFloat(metrics?.labourMetrics?.totalPayment || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Site Labour & Machinery:</span>
                <span className="font-semibold text-slate-900 font-mono">
                  ₹{parseFloat(metrics?.totalMaterialLabourSupply || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 mt-4 flex justify-between items-center">
            <span className="text-xs font-medium text-slate-500">Unpaid Labour Wages:</span>
            <span className="font-mono font-bold text-rose-600 text-sm">
              ₹{parseFloat(metrics?.labourMetrics?.totalBalance || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </motion.div>

      </div>

      {/* Row 3: Monthly Performance & Activity */}
      {analytics?.monthly && analytics.monthly.length > 0 && (
        <motion.div variants={item} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <TrendingUp size={18} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Monthly Revenue vs Expenses</h4>
                <p className="text-xs text-slate-400">Trading volume and net operating results</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 font-semibold">Month</th>
                  <th className="p-3 font-semibold text-right">Revenue (₹)</th>
                  <th className="p-3 font-semibold text-right">Costs / Purchases (₹)</th>
                  <th className="p-3 font-semibold text-right">Operating Profit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {analytics.monthly.map((m: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-3 font-sans font-medium text-slate-900">{m.month}</td>
                    <td className="p-3 text-right font-semibold text-slate-900">₹{m.revenue.toLocaleString()}</td>
                    <td className="p-3 text-right text-rose-600">₹{m.expense.toLocaleString()}</td>
                    <td className={`p-3 text-right font-bold ${m.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      ₹{m.profit.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
