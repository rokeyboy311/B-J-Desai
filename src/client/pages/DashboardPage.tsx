import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, Download, Calculator, UserCheck, Users, Calendar, ArrowUpRight, ArrowDownRight, IndianRupee, 
  Search, HardHat, Factory, Landmark, Truck, Wrench, Wallet, TrendingDown, Box, Activity
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const res = await apiFetch("/reports/dashboard");
      setMetrics(res);
    } catch (error) {
      console.error("Failed to load dashboard metrics");
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
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8 max-w-7xl mx-auto"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-indigo-500" />
            Financial Overview
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Real-time accounting metrics and business performance</p>
        </div>
        <div className="flex items-center gap-3">
          <form onSubmit={handleSearch} className="relative">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input 
               type="text" 
               placeholder="Search records..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none w-full sm:w-64 transition-all"
             />
          </form>
          <a href="/export-all" className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium shadow-sm shadow-slate-900/10 transition-all text-sm shrink-0">
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Export</span>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Primary Metric */}
        <motion.div variants={item} className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-700 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-indigo-500/30 transition-all"></div>
          <p className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" /> Net Business Profit
          </p>
          <h3 className={`text-3xl font-bold mt-2 tracking-tight ${metrics?.netIncome >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            ₹{metrics?.netIncome?.toLocaleString() || 0}
          </h3>
          <p className="text-xs text-slate-400 mt-4 font-medium uppercase tracking-wider">Total operating margin</p>
        </motion.div>

        <motion.div variants={item} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-shadow">
          <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
             <ArrowUpRight className="w-4 h-4 text-emerald-500" /> Total Income
          </p>
          <h3 className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">₹{metrics?.totalIncome?.toLocaleString() || 0}</h3>
          <p className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-md inline-block mt-4">Gross Revenue</p>
        </motion.div>

        <motion.div variants={item} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-shadow">
          <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
            <ArrowDownRight className="w-4 h-4 text-rose-500" /> Actual Expense
          </p>
          <h3 className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">₹{metrics?.actualExpense?.toLocaleString() || 0}</h3>
          <p className="text-xs text-rose-600 font-medium bg-rose-50 px-2 py-1 rounded-md inline-block mt-4">Operating Costs</p>
        </motion.div>

        <motion.div variants={item} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-shadow">
          <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-500" /> Pending Refundable
          </p>
          <h3 className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">₹{metrics?.pendingRefundable?.toLocaleString() || 0}</h3>
          <p className="text-xs text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded-md inline-block mt-4">Awaiting Return</p>
        </motion.div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <motion.div variants={item} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Landmark size={20} />
            </div>
            <h4 className="font-bold text-slate-900 text-lg tracking-tight">Investment</h4>
          </div>
          <div className="space-y-4 flex-1">
            <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Total Investment</span><span className="font-semibold text-slate-900">₹{metrics?.totalInvestment?.toLocaleString() || 0}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Payments Made</span><span className="font-semibold text-slate-900">₹{metrics?.totalInvestmentPayment?.toLocaleString() || 0}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Upad Returns</span><span className="font-semibold text-orange-600">₹{metrics?.totalInvestmentUpad?.toLocaleString() || 0}</span></div>
          </div>
          <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-6">
            <span className="text-slate-700 font-semibold">Net Balance</span>
            <span className="font-bold text-indigo-600 text-xl">₹{metrics?.investmentBalance?.toLocaleString() || 0}</span>
          </div>
        </motion.div>

        <motion.div variants={item} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Box size={20} />
            </div>
            <h4 className="font-bold text-slate-900 text-lg tracking-tight">Material Activity</h4>
          </div>
          <div className="space-y-4 flex-1">
            <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Purchases</span><span className="font-semibold text-rose-600">₹{metrics?.totalMaterialPurchase?.toLocaleString() || 0}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Supply Out</span><span className="font-semibold text-emerald-600">₹{metrics?.totalMaterialSupply?.toLocaleString() || 0}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Labour & Supply</span><span className="font-semibold text-indigo-600">₹{metrics?.totalMaterialLabourSupply?.toLocaleString() || 0}</span></div>
          </div>
          <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-6">
            <span className="text-slate-700 font-semibold">Total Outflow</span>
            <span className="font-bold text-slate-900 text-xl">₹{((metrics?.totalMaterialPurchase || 0) + (metrics?.totalMaterialLabourSupply || 0)).toLocaleString()}</span>
          </div>
        </motion.div>

        <motion.div variants={item} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
              <HardHat size={20} />
            </div>
            <h4 className="font-bold text-slate-900 text-lg tracking-tight">Labour Metrics</h4>
          </div>
          <div className="space-y-4 flex-1">
            <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Total Net Salary</span><span className="font-semibold text-slate-900">₹{metrics?.labourMetrics?.totalNetSalary?.toLocaleString() || 0}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Upad / Advance</span><span className="font-semibold text-orange-600">₹{metrics?.labourMetrics?.totalUpad?.toLocaleString() || 0}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Payments Made</span><span className="font-semibold text-emerald-600">₹{metrics?.labourMetrics?.totalPayment?.toLocaleString() || 0}</span></div>
          </div>
          <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-6">
            <span className="text-slate-700 font-semibold">Outstanding Balance</span>
            <span className="font-bold text-rose-600 text-xl">₹{metrics?.labourMetrics?.totalBalance?.toLocaleString() || 0}</span>
          </div>
        </motion.div>

      </div>
      
      {/* Analytics Section */}
      <motion.div variants={item} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
        <div className="flex items-center gap-3 mb-6">
           <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
             <Calendar size={20} />
           </div>
           <h4 className="font-bold text-slate-900 text-lg tracking-tight">Labour Attendance Overview</h4>
        </div>
        
        {metrics?.rawLabourAtt && metrics.rawLabourAtt.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Month</th>
                  <th className="px-6 py-4 font-semibold text-right">Total Days Worked</th>
                  <th className="px-6 py-4 font-semibold text-right">Total Piece Rate (TC)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {metrics.rawLabourAtt.map((att: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{att.month}</td>
                    <td className="px-6 py-4 text-right text-blue-600 font-semibold">{parseFloat(att.days).toFixed(1)} Days</td>
                    <td className="px-6 py-4 text-right text-emerald-600 font-semibold">{parseFloat(att.tcs).toFixed(2)} TC</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
              <Users className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">No attendance data logged yet.</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
