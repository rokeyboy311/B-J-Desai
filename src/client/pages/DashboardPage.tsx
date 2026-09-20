import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, Users, Landmark, Truck, Package, Activity,
  CalendarCheck, Wrench, ArrowRight, CheckCircle2, PieChart, Coins,
  Calculator, ArrowDownRight, ArrowUpRight, ChevronDown, ChevronUp, Layers, HelpCircle,
  Receipt
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useLiveSync } from "../hooks/useLiveSync";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCat2Breakdown, setShowCat2Breakdown] = useState(true);
  const navigate = useNavigate();

  const loadDashboard = async (isBackground = false) => {
    try {
      if (!isBackground && !metrics) setLoading(true);
      const res = await apiFetch(`/reports/dashboard?locationId=ALL`);
      setMetrics(res || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard(false);
  }, []);

  useLiveSync(() => {
    loadDashboard(true);
  }, 3500);

  const getMetric = (val: any) => Number(val || 0).toLocaleString();

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Derived metrics for UI: Category 1 vs Category 2
  const cat1 = metrics?.category1InvestorSummary || {
    investorTotalCapital: (metrics?.totalInvestment || 0) - (metrics?.totalBillInvestment || 0),
    investmentKaryaTotal: 0,
    investorUpadTotal: metrics?.totalInvestmentUpad || 0,
    availableInvestorsBalance: 0
  };

  const cat2 = metrics?.category2InvestmentSummary || {
    investmentFromInvestorsCapital: metrics?.connectedExpenses?.investmentFromInvestorsCapital || 0,
    billInvestment: metrics?.connectedExpenses?.billInvestment ?? metrics?.totalBillInvestment ?? 0,
    fullCapital: metrics?.connectedExpenses?.fullCapital || 0,
    totalDeductions: metrics?.connectedExpenses?.totalExpensesCut || 0,
    investorUpadReturn: metrics?.totalInvestmentPayment || 0,
    remainingCapital: metrics?.connectedExpenses?.remainingCapital || 0
  };

  const connected = metrics?.connectedExpenses || {};
  const catDetails = connected?.categoryDetails || {};
  const utilizationRate = connected?.utilizationRate || 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-sm">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Master Financial Dashboard</h1>
            <p className="text-sm text-slate-500 font-medium">Clear Category 1 to 6 Accounting, Capital Inflow & Expense Audit</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Live Reconciled
          </span>
        </div>
      </div>

      {/* Visual Flow Guide: Cat 1 -> Cat 2 -> Cat 3-6 */}
      <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-indigo-900">
        <div className="flex items-center gap-2 font-bold shrink-0">
          <Calculator className="w-4 h-4 text-indigo-600" />
          <span>Accounting Flow Model:</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-center">
          <span className="px-2.5 py-1 bg-white rounded-lg font-semibold border border-indigo-200 shadow-2xs">
            1. Investor Pool (Cat 1)
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg font-bold shadow-2xs">
            2. Project Investment (Cat 2)
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="px-2.5 py-1 bg-white rounded-lg font-semibold border border-indigo-200 shadow-2xs">
            3-6. Project Expenses (Cat 3, 4, 5, 6)
          </span>
        </div>
        <span className="text-[11px] text-indigo-700/80 italic shrink-0">
          Strict Zero-Discrepancy Audit
        </span>
      </div>

      {/* Main Financial Overview Row: Segregated Category 1 & Category 2 Capital Pools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Category 1: Investor Capital Pool (Alag Capital) */}
        <div className="bg-white rounded-2xl border border-emerald-200/90 shadow-sm p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-6 opacity-5">
            <Users className="w-32 h-32 text-emerald-950" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h3 className="text-emerald-800 font-bold uppercase tracking-wider text-xs">
                  Category 1: Investors Ledger (ઇન્વેસ્ટર મૂડી પૂલ)
                </h3>
              </div>
              <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Alag Investor Capital
              </span>
            </div>
            
            <div className="mb-5">
              <span className="text-xs text-slate-500 font-medium">Available Investors Balance (ઇન્વેસ્ટર પાસે બચેલી મૂડી)</span>
              <p className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
                ₹{getMetric(cat1.availableInvestorsBalance)}
              </p>
            </div>

            <div className="space-y-2.5 pt-4 border-t border-slate-100 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">1. Investors Total Capital (કુલ જમા કરેલ રકમ)</span>
                <span className="font-bold text-emerald-700">+ ₹{getMetric(cat1.investorTotalCapital)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">2. Investment Karya Total (પ્રોજેક્ટમાં રોકેલ રકમ - Cat 2 Transfer)</span>
                <span className="font-bold text-indigo-600">- ₹{getMetric(cat1.investmentKaryaTotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">3. Investor Upad Total (ઇન્વેસ્ટર ઉપાડ / પેમેન્ટ)</span>
                <span className="font-bold text-amber-600">- ₹{getMetric(cat1.investorUpadTotal)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 relative z-10">
            <span className="font-medium">હિસાબ સૂત્ર: Total Capital - Investment Karya - Upad</span>
            <span className="font-black text-emerald-700 text-sm">₹{getMetric(cat1.availableInvestorsBalance)}</span>
          </div>
        </div>

        {/* Category 2: Project Investment & Deductions Pool (Alag Capital) */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Coins className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                <h3 className="text-indigo-300 font-bold uppercase tracking-wider text-xs">
                  Category 2: Project Investment & Deductions (પ્રોજેક્ટ મૂડી)
                </h3>
              </div>
              <span className="text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                Alag Project Capital
              </span>
            </div>

            <div className="mb-4">
              <span className="text-xs text-slate-400 font-medium">Remaining Project Capital (બાકી રહેલ મૂડી - Full Capital માંથી)</span>
              <p className="text-3xl font-black text-white tracking-tight mt-0.5">
                ₹{getMetric(cat2.remainingCapital)}
              </p>
            </div>

            {/* Inflow Breakdown: Investment from Investors + Bill Investment = Full Capital */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-3 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Investment from Investors (ઇન્વેસ્ટમેન્ટ કર્યા)
                </span>
                <span className="font-bold text-emerald-400">₹{getMetric(cat2.investmentFromInvestorsCapital)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  Bill Investment (બિલ ઇન્વેસ્ટમેન્ટ)
                </span>
                <span className="font-bold text-cyan-400">+ ₹{getMetric(cat2.billInvestment ?? metrics?.totalBillInvestment ?? 0)}</span>
              </div>
              <div className="pt-2 border-t border-white/10 flex justify-between items-center font-bold text-xs text-indigo-200">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                  = Full Capital (કુલ પ્રોજેક્ટ મૂડી)
                </span>
                <span className="text-white font-black text-sm">
                  ₹{getMetric(cat2.fullCapital || (Number(cat2.investmentFromInvestorsCapital || 0) + Number(cat2.billInvestment || metrics?.totalBillInvestment || 0)))}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">1. Full Capital (કુલ મૂડી)</span>
                <span className="font-bold text-white">
                  ₹{getMetric(cat2.fullCapital || (Number(cat2.investmentFromInvestorsCapital || 0) + Number(cat2.billInvestment || metrics?.totalBillInvestment || 0)))}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">2. Operational Deductions (Cat 3 થી 6 & રિફંડેબલ)</span>
                <span className="font-bold text-rose-400">- ₹{getMetric(cat2.totalDeductions)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">3. Investor Upad / Return (મૂડી પરત)</span>
                <span className="font-bold text-amber-400">- ₹{getMetric(cat2.investorUpadReturn)}</span>
              </div>
            </div>

            {/* Utilization Rate Bar */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-slate-400 font-medium">પ્રોજેક્ટ મૂડી વપરાશ (Capital Burn Rate)</span>
                <span className="font-bold text-indigo-300">{utilizationRate}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${
                    utilizationRate > 90 ? 'bg-rose-500' : utilizationRate > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} 
                  style={{ width: `${Math.min(100, utilizationRate)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 relative z-10">
            <span className="font-medium">હિસાબ સૂત્ર: Full Capital (ઇન્વેસ્ટમેન્ટ કર્યા + બિલ) - Deductions - Upad = બાકી મૂડી</span>
            <span className="font-black text-white text-sm">₹{getMetric(cat2.remainingCapital)}</span>
          </div>
        </div>
        
      </div>

      {/* Refundable Records Highlight Banner */}
      <div className="bg-gradient-to-r from-purple-900/90 via-indigo-900 to-slate-900 rounded-2xl border border-purple-500/30 p-5 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-purple-500/20 border border-purple-400/30 rounded-xl text-purple-300 shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-white">Refundable Record (રિફંડેબલ ડિપોઝિટ / એડવાન્સ રકમ)</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/30 text-purple-200 border border-purple-400/30">
                Cat 2 Deduction
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              સિક્યોરિટી ડિપોઝિટ, ટેન્ડર EMD, મીટર ડિપોઝિટ તથા અન્ય રિફંડેબલ રકમો જે મૂડીમાંથી બાદ થાય છે અને પરત મળવાપાત્ર છે.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 shrink-0 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Refundable</span>
            <p className="text-base font-black text-purple-200">₹{getMetric(metrics?.totalRefundable || metrics?.refundableSummary?.totalRefundable || 0)}</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Received / Refunded</span>
            <p className="text-base font-black text-emerald-400">₹{getMetric(metrics?.totalRefunded || metrics?.refundableSummary?.totalRefunded || 0)}</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div>
            <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">લેવાના બાકી (Pending)</span>
            <p className="text-lg font-black text-amber-300">₹{getMetric(metrics?.pendingRefundable || metrics?.refundableSummary?.pendingRefundable || 0)}</p>
          </div>
        </div>
      </div>

      {/* Category 2 Deductions Transparency Accordion (Cat 3 to 6 + Refundable Reconciliation) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div 
          onClick={() => setShowCat2Breakdown(!showCat2Breakdown)}
          className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                Category 2 to 6 Reconciliation: How Project Capital is Deducted
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Total Deductions: ₹{getMetric(cat2.totalDeductions)}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Detailed audit showing every rupee spent from Category 2 Project Capital across Categories 3, 5, 6 & Refundables
              </p>
            </div>
          </div>
          <button type="button" className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
            {showCat2Breakdown ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        <AnimatePresence>
          {showCat2Breakdown && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-slate-100 p-5 bg-slate-50/40"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Cat 3 Material Purchase */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Cat 3. Material Purchase</span>
                    <span className="p-1.5 bg-rose-50 text-rose-600 rounded-md"><Package className="w-3.5 h-3.5" /></span>
                  </div>
                  <p className="text-xl font-black text-rose-600">₹{getMetric(catDetails.cat3MaterialPurchases || metrics?.totalMaterialPurchase)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Vendor invoices & material purchases</p>
                </div>

                {/* Cat 5 Site Supply */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Cat 5. Site Supply</span>
                    <span className="p-1.5 bg-teal-50 text-teal-600 rounded-md"><Wrench className="w-3.5 h-3.5" /></span>
                  </div>
                  <p className="text-xl font-black text-teal-600">₹{getMetric(catDetails.cat5SiteSupplies || metrics?.totalMaterialLabourSupply)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Direct internal materials dispatched to site</p>
                </div>

                {/* Cat 6 Labour Attendance, Team Upad & Other Kharch */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Cat 6. Labour & Kharch</span>
                    <span className="p-1.5 bg-amber-50 text-amber-600 rounded-md"><CalendarCheck className="w-3.5 h-3.5" /></span>
                  </div>
                  <p className="text-xl font-black text-amber-600">₹{getMetric(catDetails.cat6Labour || catDetails.cat67Labour || (Number(metrics?.labourMetrics?.totalPayment || 0) + Number(metrics?.labourMetrics?.totalUpad || 0)))}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Attendance wages, Team Upad & Other Kharch</p>
                </div>

                {/* Refundable Outflows */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-purple-600 uppercase">Refundable Deposits</span>
                    <span className="p-1.5 bg-purple-50 text-purple-600 rounded-md"><Receipt className="w-3.5 h-3.5" /></span>
                  </div>
                  <p className="text-xl font-black text-purple-600">₹{getMetric(metrics?.pendingRefundable || metrics?.refundableSummary?.pendingRefundable || catDetails.refundableRecords || 0)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Pending refundable security deposits (લેવાના બાકી)</p>
                </div>

              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
                <span className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Category 2 project deductions precisely balance against Categories 3, 5, 6 & Refundables.
                </span>
                <span className="font-mono font-bold text-slate-800">
                  ₹{getMetric(catDetails.cat3MaterialPurchases || metrics?.totalMaterialPurchase)} + ₹{getMetric(catDetails.cat5SiteSupplies || metrics?.totalMaterialLabourSupply)} + ₹{getMetric(catDetails.cat6Labour || catDetails.cat67Labour || (Number(metrics?.labourMetrics?.totalPayment || 0) + Number(metrics?.labourMetrics?.totalUpad || 0)))} + ₹{getMetric(metrics?.pendingRefundable || 0)} = ₹{getMetric(cat2.totalDeductions)}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Department Wise Operations Cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <PieChart className="w-5 h-5 text-indigo-500" /> Department Wise Operational Status (Categories 3 to 6)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* 3. Material Purchase */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-rose-300 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl"><Package className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">3. Material Purchase</h3>
                  <p className="text-[11px] text-slate-500">Vendor Purchases & Inventory</p>
                </div>
              </div>
              <div className="space-y-2.5 pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Total Purchase</span>
                  <span className="font-bold text-slate-800">₹{getMetric(metrics?.totalMaterialPurchase)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Paid Amount</span>
                  <span className="font-bold text-emerald-600">₹{getMetric(metrics?.totalMaterialPurchasePaid)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Unpaid / Pending</span>
                  <span className="font-bold text-rose-600">₹{getMetric(metrics?.totalMaterialPurchaseOutstanding)}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-slate-100 text-right">
              <button 
                type="button" 
                onClick={() => navigate('/material-purchases')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                View Purchases &rarr;
              </button>
            </div>
          </div>

          {/* 4. Material Supply */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-orange-300 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-orange-100 text-orange-700 rounded-xl"><Truck className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">4. Material Supply</h3>
                  <p className="text-[11px] text-slate-500">Customer Sales & Billed</p>
                </div>
              </div>
              <div className="space-y-2.5 pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Total Supply</span>
                  <span className="font-bold text-slate-800">₹{getMetric(metrics?.totalMaterialSupply)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Received Amount</span>
                  <span className="font-bold text-emerald-600">₹{getMetric(metrics?.totalMaterialSupplyPaid)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Pending From Clients</span>
                  <span className="font-bold text-orange-600">₹{getMetric(metrics?.totalMaterialSupplyOutstanding)}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-slate-100 text-right">
              <button 
                type="button" 
                onClick={() => navigate('/material-supplies')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                View Sales &rarr;
              </button>
            </div>
          </div>

          {/* 5. Site Supply */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-teal-300 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-teal-100 text-teal-700 rounded-xl"><Wrench className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">5. Site Supply</h3>
                  <p className="text-[11px] text-slate-500">Direct Internal Materials</p>
                </div>
              </div>
              <div className="space-y-2.5 pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Site Supply Value</span>
                  <span className="font-bold text-slate-800">₹{getMetric(metrics?.totalMaterialLabourSupply)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Materials Issued</span>
                  <span className="font-bold text-teal-600">{getMetric(metrics?.stockSummary?.siteSupplyQty || 0)} Units</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Cost Absorption</span>
                  <span className="font-bold text-slate-600">Deducted from Cat 2</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-slate-100 text-right">
              <button 
                type="button" 
                onClick={() => navigate('/site-supplies')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                View Site Supplies &rarr;
              </button>
            </div>
          </div>

          {/* 6. Labour Attendance, Upad & Other Kharch */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-amber-300 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl"><CalendarCheck className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">6. Labour Attendance</h3>
                  <p className="text-[11px] text-slate-500">Attendance, Team Upad & Kharch</p>
                </div>
              </div>
              <div className="space-y-2.5 pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Attendance Earned</span>
                  <span className="font-bold text-slate-800">₹{getMetric(metrics?.labourMetrics?.totalNetSalary)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Team Upad Advances</span>
                  <span className="font-bold text-indigo-600">₹{getMetric(metrics?.labourMetrics?.totalUpad)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Unpaid Wages Balance</span>
                  <span className="font-bold text-rose-600">₹{getMetric(metrics?.labourMetrics?.totalBalance)}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-slate-100 text-right">
              <button 
                type="button" 
                onClick={() => navigate('/labour-attendance')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                View Labour &rarr;
              </button>
            </div>
          </div>

        </div>
      </div>
      
      {/* Current Stock & Inventory Summary */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-500" /> Current Stock & Inventory Summary
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-center">
            <span className="text-xs text-slate-500 font-medium">Total Material Types</span>
            <span className="text-2xl font-black text-slate-800">{getMetric(metrics?.stockSummary?.totalDistinctMaterials)}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-center">
            <span className="text-xs text-slate-500 font-medium">Total Available Units</span>
            <span className="text-2xl font-black text-slate-800">{getMetric(metrics?.stockSummary?.totalStockUnits)}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-center">
            <span className="text-xs text-slate-500 font-medium">Total Stock Valuation</span>
            <span className="text-2xl font-black text-emerald-600">₹{getMetric(metrics?.stockSummary?.totalStockValuation)}</span>
          </div>
          <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 flex flex-col justify-center">
            <span className="text-xs text-rose-600 font-medium">Low Stock Items</span>
            <span className="text-2xl font-black text-rose-700">{getMetric(metrics?.stockSummary?.lowStockCount)}</span>
          </div>
        </div>
      </div>

    </div>
  );
}
