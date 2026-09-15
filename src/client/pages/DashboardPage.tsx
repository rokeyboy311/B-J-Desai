import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, Download, Users, Calendar, ArrowUpRight, ArrowDownRight, IndianRupee, 
  Search, HardHat, Landmark, Truck, Wrench, Box, Activity, Plus,
  ShieldAlert, CheckCircle2, AlertTriangle, ArrowRightLeft, MapPin,
  RefreshCw, TrendingUp, TrendingDown, Layers, FileText, ChevronRight, Eye
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { auth } from "../lib/firebase";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Modal } from "../components/ui/Modal";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  
  // Modals for quick action right from dashboard
  const [isSupervisorModalOpen, setIsSupervisorModalOpen] = useState(false);
  const [supervisorFormData, setSupervisorFormData] = useState({
    locationId: "",
    date: new Date().toISOString().split("T")[0],
    supervisorName: "",
    amount: "",
    description: "",
    paymentMethod: "CASH",
    referenceNumber: ""
  });

  const [isInvestorModalOpen, setIsInvestorModalOpen] = useState(false);
  const [investorFormData, setInvestorFormData] = useState({
    locationId: "",
    partyName: "",
    type: "INVESTMENT" as "INVESTMENT" | "UPAD",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Cash",
    referenceNumber: "",
    description: ""
  });

  const navigate = useNavigate();

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [selectedLocationId]);

  const loadLocations = async () => {
    try {
      const res = await apiFetch("/locations");
      setLocations(res || []);
      if (res && res.length > 0 && !supervisorFormData.locationId) {
        setSupervisorFormData(prev => ({ ...prev, locationId: String(res[0].id) }));
        setInvestorFormData(prev => ({ ...prev, locationId: String(res[0].id) }));
      }
    } catch (err) {
      console.error("Failed to load locations:", err);
    }
  };

  const fetchMetrics = async () => {
    try {
      setIsRefreshing(true);
      const url = selectedLocationId !== "ALL" 
        ? `/reports/dashboard?locationId=${selectedLocationId}` 
        : "/reports/dashboard";
      const res = await apiFetch(url);
      setMetrics(res);
    } catch (error) {
      console.error("Failed to load dashboard metrics", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleExportAll = async () => {
    try {
      setIsExporting(true);
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/reports/export-all", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to export");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Bina_Enterprise_Export_All_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("Export all failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/records?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleSaveSupervisorCost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const locId = supervisorFormData.locationId || (locations[0]?.id ? String(locations[0].id) : "1");
      await apiFetch("/supervisor-costs", {
        method: "POST",
        body: JSON.stringify({
          ...supervisorFormData,
          locationId: Number(locId),
          amount: Number(supervisorFormData.amount)
        })
      });
      setIsSupervisorModalOpen(false);
      setSupervisorFormData({
        locationId: locId,
        date: new Date().toISOString().split("T")[0],
        supervisorName: "",
        amount: "",
        description: "",
        paymentMethod: "CASH",
        referenceNumber: ""
      });
      fetchMetrics();
    } catch (err: any) {
      alert(err.message || "Failed to save supervisor cost");
    }
  };

  const handleSaveInvestmentTx = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const locId = Number(investorFormData.locationId || (locations[0]?.id ? locations[0].id : 1));
      // First create or get party
      const party = await apiFetch("/investments/parties", {
        method: "POST",
        body: JSON.stringify({
          locationId: locId,
          partyName: investorFormData.partyName.trim()
        })
      });

      await apiFetch("/investments/transactions", {
        method: "POST",
        body: JSON.stringify({
          partyId: party.id,
          type: investorFormData.type,
          amount: parseFloat(investorFormData.amount),
          date: investorFormData.date,
          paymentMethod: investorFormData.paymentMethod,
          referenceNumber: investorFormData.referenceNumber,
          description: investorFormData.description
        })
      });

      setIsInvestorModalOpen(false);
      setInvestorFormData({
        locationId: String(locId),
        partyName: "",
        type: "INVESTMENT",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Cash",
        referenceNumber: "",
        description: ""
      });
      fetchMetrics();
    } catch (err: any) {
      alert(err.message || "Failed to save investment record");
    }
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
        staggerChildren: 0.08
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
  };

  const rawConn = metrics?.connectedExpenses;
  const connectedExp = {
    totalInvested: Number(rawConn?.totalInvested ?? metrics?.totalInvestment ?? 0),
    totalUpad: Number(rawConn?.totalUpad ?? metrics?.totalInvestmentUpad ?? 0),
    netCapitalPool: Number(rawConn?.netCapitalPool ?? ((metrics?.totalInvestment || 0) - (metrics?.totalInvestmentUpad || 0))),
    materialPurchaseExpense: Number(rawConn?.materialPurchaseExpense ?? metrics?.totalMaterialPurchase ?? 0),
    siteSupplyExpense: Number(rawConn?.siteSupplyExpense ?? metrics?.totalMaterialLabourSupply ?? 0),
    labourSalaryExpense: Number(rawConn?.labourSalaryExpense ?? ((metrics?.labourMetrics?.totalPayment || 0) + (metrics?.labourMetrics?.totalUpad || 0))),
    generalExpense: Number(rawConn?.generalExpense ?? metrics?.actualExpense ?? 0),
    totalExpensesCut: Number(rawConn?.totalExpensesCut ?? ((metrics?.totalMaterialPurchase || 0) + (metrics?.totalMaterialLabourSupply || 0) + (metrics?.actualExpense || 0))),
    remainingCapital: Number(rawConn?.remainingCapital ?? 0),
    utilizationRate: Number(rawConn?.utilizationRate ?? 0)
  };

  const rawStock = metrics?.stockSummary;
  const stockSummary = {
    items: Array.isArray(rawStock?.items) ? rawStock.items : [],
    totalDistinctMaterials: Number(rawStock?.totalDistinctMaterials ?? 0),
    totalStockUnits: Number(rawStock?.totalStockUnits ?? 0),
    totalStockValuation: Number(rawStock?.totalStockValuation ?? 0),
    lowStockCount: Number(rawStock?.lowStockCount ?? 0)
  };

  const rawSup = metrics?.supervisorAudit;
  const supervisorAudit = {
    totalSupervisorCost: Number(rawSup?.totalSupervisorCost ?? metrics?.totalSupervisorCost ?? 0),
    totalSiteSupply: Number(rawSup?.totalSiteSupply ?? metrics?.totalMaterialLabourSupply ?? 0),
    variance: Number(rawSup?.variance ?? ((metrics?.totalSupervisorCost || 0) - (metrics?.totalMaterialLabourSupply || 0))),
    reconciliationStatus: rawSup?.reconciliationStatus || "MATCHED"
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8 max-w-7xl mx-auto pb-16"
    >
      {/* Top Header & Site Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <LayoutDashboard className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Enterprise Business Dashboard
            </h1>
          </div>
          <p className="text-slate-500 mt-1 text-xs">
            Complete executive ledger: Investment (Part 1 & 2), Materials, Stock, Site Supply, Labour & Supervisor Cross-Check
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Location Selector */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <MapPin className="w-4 h-4 text-indigo-600 ml-1.5" />
            <span className="text-xs font-semibold text-slate-600">Site:</span>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent border-0 outline-hidden pr-2 cursor-pointer"
            >
              <option value="ALL">All Sites / Global Ledger</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name} {loc.address ? `(${loc.address})` : ""}</option>
              ))}
            </select>
          </div>

          {/* Quick Refresh */}
          <button 
            type="button"
            onClick={fetchMetrics}
            disabled={isRefreshing}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`} />
          </button>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="relative">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input 
               type="text" 
               placeholder="Search entries..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden w-40 sm:w-48 transition-all"
             />
          </form>

          {/* Export All */}
          <button 
            type="button"
            onClick={handleExportAll} 
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-medium shadow-xs transition-all text-xs shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">{isExporting ? "Exporting..." : "Export Full Excel"}</span>
          </button>
        </div>
      </div>

      {/* Global Financial Metrics Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={item} className="bg-slate-900 text-white p-5 rounded-2xl shadow-md relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Remaining Capital Pool</span>
            <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold">
              Part 1 - Part 2
            </span>
          </div>
          <h3 className={`text-3xl font-bold mt-2 tracking-tight ${connectedExp.remainingCapital >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            ₹{connectedExp.remainingCapital.toLocaleString()}
          </h3>
          <p className="text-xs text-slate-400 mt-2">
            Net investment capital after all operational cuts
          </p>
        </motion.div>

        <motion.div variants={item} className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Investment Infused</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mt-2 tracking-tight">₹{metrics?.totalInvestment?.toLocaleString() || 0}</h3>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
            <span>Upad Withdrawn:</span>
            <span className="font-semibold text-amber-600">₹{metrics?.totalInvestmentUpad?.toLocaleString() || 0}</span>
          </div>
        </motion.div>

        <motion.div variants={item} className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Connected Expenses Cut</span>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-rose-600 mt-2 tracking-tight">₹{connectedExp.totalExpensesCut.toLocaleString()}</h3>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
            <span>Capital Utilization:</span>
            <span className="font-semibold text-slate-800">{connectedExp.utilizationRate}%</span>
          </div>
        </motion.div>

        <motion.div variants={item} className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Live Inventory Valuation</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Box className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-blue-600 mt-2 tracking-tight">₹{stockSummary.totalStockValuation.toLocaleString()}</h3>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
            <span>Distinct Items:</span>
            <span className="font-semibold text-slate-800">{stockSummary.totalDistinctMaterials} materials</span>
          </div>
        </motion.div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: INVESTMENT SECTION (PART 1 & PART 2) */}
      {/* ========================================================================= */}
      <motion.div variants={item} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Section Header */}
        <div className="p-5 border-b border-slate-100 bg-emerald-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">1. Investment Section</h2>
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-emerald-800">Part 1:</span> Investor Details & Upad Management | <span className="font-semibold text-emerald-800">Part 2:</span> Connected Site Expenses Deductions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsInvestorModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              <Plus size={14} /> Add Investment / Upad
            </button>
            {selectedLocationId !== "ALL" && (
              <button
                type="button"
                onClick={() => navigate(`/locations/${selectedLocationId}`)}
                className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-emerald-800 bg-emerald-100/70 hover:bg-emerald-200/70 rounded-xl transition-colors cursor-pointer"
              >
                Open Ledger <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Part 1: Investor Details & Parties Ledger */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs">Part 1</span>
                Investor Details & Drawings (Upad) Management
              </h3>
              <span className="text-xs text-slate-500">
                {metrics?.investorParties?.length || 0} Active Investor Parties
              </span>
            </div>

            {/* Investor Parties Summary Cards / Table */}
            {metrics?.investorParties && metrics.investorParties.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Investor Party Name</th>
                      <th className="px-4 py-3 text-right">Total Invested (₹)</th>
                      <th className="px-4 py-3 text-right">Upad / Drawings (₹)</th>
                      <th className="px-4 py-3 text-right">Payments (₹)</th>
                      <th className="px-4 py-3 text-right font-bold">Net Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {metrics.investorParties.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold">
                            {p.partyName?.charAt(0)?.toUpperCase() || "I"}
                          </div>
                          {p.partyName}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-700">₹{(Number(p.totalInvestment || 0)).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-semibold text-amber-700">₹{(Number(p.totalUpad || 0)).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-slate-600">₹{(Number(p.totalPayment || 0)).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">₹{(Number(p.balance || 0)).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                No investor party records added yet. Click &quot;Add Investment / Upad&quot; to register your first partner.
              </div>
            )}
          </div>

          {/* Part 2: Connected Expenses - Deductions from Part 1 Investment */}
          <div className="pt-2 border-t border-slate-200/80">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-xs">Part 2</span>
                Connected Expenses (Deducted Directly from Investment Capital Pool)
              </h3>
              <span className="text-xs font-semibold text-rose-700">
                Total Cut: ₹{connectedExp.totalExpensesCut.toLocaleString()}
              </span>
            </div>

            {/* Deduction Waterfall Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="p-3.5 bg-rose-50/70 border border-rose-100 rounded-xl">
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span className="font-semibold">Material Purchases</span>
                  <span className="text-[10px] bg-rose-200/60 text-rose-800 px-1.5 py-0.5 rounded-sm font-bold">Cut</span>
                </div>
                <div className="text-lg font-bold text-rose-700 mt-1">₹{connectedExp.materialPurchaseExpense.toLocaleString()}</div>
                <p className="text-[11px] text-slate-500 mt-0.5">Deducted for raw material stock</p>
              </div>

              <div className="p-3.5 bg-rose-50/70 border border-rose-100 rounded-xl">
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span className="font-semibold">Site Supplies Incurred</span>
                  <span className="text-[10px] bg-rose-200/60 text-rose-800 px-1.5 py-0.5 rounded-sm font-bold">Cut</span>
                </div>
                <div className="text-lg font-bold text-rose-700 mt-1">₹{connectedExp.siteSupplyExpense.toLocaleString()}</div>
                <p className="text-[11px] text-slate-500 mt-0.5">Deducted for site execution supply</p>
              </div>

              <div className="p-3.5 bg-rose-50/70 border border-rose-100 rounded-xl">
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span className="font-semibold">Labour Salaries & Upad</span>
                  <span className="text-[10px] bg-rose-200/60 text-rose-800 px-1.5 py-0.5 rounded-sm font-bold">Cut</span>
                </div>
                <div className="text-lg font-bold text-rose-700 mt-1">₹{connectedExp.labourSalaryExpense.toLocaleString()}</div>
                <p className="text-[11px] text-slate-500 mt-0.5">Deducted for worker wage payouts</p>
              </div>

              <div className="p-3.5 bg-rose-50/70 border border-rose-100 rounded-xl">
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span className="font-semibold">General Expenses</span>
                  <span className="text-[10px] bg-rose-200/60 text-rose-800 px-1.5 py-0.5 rounded-sm font-bold">Cut</span>
                </div>
                <div className="text-lg font-bold text-rose-700 mt-1">₹{connectedExp.generalExpense.toLocaleString()}</div>
                <p className="text-[11px] text-slate-500 mt-0.5">Deducted for site daily operations</p>
              </div>
            </div>

            {/* Reconciliation Balance Bar */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <span className="text-xs text-slate-500 font-semibold uppercase">Net Capital Pool Reconciliation Formula</span>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  ₹{connectedExp.totalInvested.toLocaleString()} (Invested) - ₹{connectedExp.totalUpad.toLocaleString()} (Upad) - ₹{connectedExp.totalExpensesCut.toLocaleString()} (Total Cut)
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 font-semibold uppercase">Net Available Capital</span>
                <div className={`text-xl font-bold ${connectedExp.remainingCapital >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  = ₹{connectedExp.remainingCapital.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ========================================================================= */}
      {/* SECTION 2 & SECTION 3: MATERIAL PURCHASE & LIVE STOCK INVENTORY SYSTEM */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Section 2: Material Purchase Section */}
        <motion.div variants={item} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-amber-50/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-600 text-white rounded-xl shadow-xs">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">2. Material Purchase</h2>
                <p className="text-[11px] text-slate-500">Directly adds inventory into stock system</p>
              </div>
            </div>
            {selectedLocationId !== "ALL" && (
              <button 
                type="button"
                onClick={() => navigate(`/locations/${selectedLocationId}`)}
                className="text-xs text-amber-700 hover:text-amber-800 font-bold"
              >
                Manage
              </button>
            )}
          </div>

          <div className="p-4 space-y-4 flex-1">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-xs font-semibold text-slate-600">Total Purchases Billed</span>
                <span className="text-sm font-bold text-slate-900">₹{metrics?.totalMaterialPurchase?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-emerald-50/60 rounded-xl">
                <span className="text-xs font-semibold text-emerald-800">Amount Paid to Suppliers</span>
                <span className="text-sm font-bold text-emerald-700">₹{metrics?.totalMaterialPurchasePaid?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-rose-50/60 rounded-xl">
                <span className="text-xs font-semibold text-rose-800">Outstanding Payable</span>
                <span className="text-sm font-bold text-rose-700">₹{metrics?.totalMaterialPurchaseOutstanding?.toLocaleString() || 0}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50/60 border border-amber-200/70 rounded-xl text-xs text-amber-900 leading-relaxed">
              <strong>Stock Integration:</strong> When you record a material purchase here, the purchased quantity is automatically deposited into the live Stock System on the right.
            </div>
          </div>
        </motion.div>

        {/* Section 3: Live Stock Inventory System */}
        <motion.div variants={item} className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-blue-50/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                <Box className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">3. Live Stock Inventory System</h2>
                <p className="text-[11px] text-slate-500">
                  Stock = Total Purchases - (Customer Supplies + Site Supplies)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                {stockSummary.totalStockUnits} Units In Hand
              </span>
            </div>
          </div>

          <div className="p-4 flex-1 flex flex-col">
            {stockSummary.items && stockSummary.items.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200 flex-1">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Material</th>
                      <th className="px-3 py-2.5 text-right">Purchased</th>
                      <th className="px-3 py-2.5 text-right">Supplied Out</th>
                      <th className="px-3 py-2.5 text-right font-bold text-indigo-700">Stock on Hand</th>
                      <th className="px-3 py-2.5 text-right">Valuation (₹)</th>
                      <th className="px-3 py-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stockSummary.items.slice(0, 5).map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-3 py-2.5 font-bold text-slate-900">
                          {item.materialName}
                          <span className="text-[10px] text-slate-400 font-normal ml-1">({item.unit})</span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{item.purchasedQty}</td>
                        <td className="px-3 py-2.5 text-right text-rose-600">{item.totalSuppliedQty}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-indigo-700">{item.currentStock} {item.unit}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-900">₹{(Number(item.valuation ?? item.stockValuation ?? 0)).toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.status === "IN_STOCK" 
                              ? "bg-emerald-100 text-emerald-800" 
                              : item.status === "LOW_STOCK" 
                                ? "bg-amber-100 text-amber-800" 
                                : "bg-rose-100 text-rose-800"
                          }`}>
                            {item.status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 my-auto">
                No stock items found. Record material purchases to begin tracking live inventory.
              </div>
            )}
            
            <div className="flex justify-between items-center pt-3 text-xs text-slate-500">
              <span>Auto-synchronized with supply dispatches</span>
              <span className="font-bold text-slate-900">Total Stock Value: ₹{stockSummary.totalStockValuation.toLocaleString()}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 4 & SECTION 5: MATERIAL SUPPLY & SITE SUPPLY */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 4: Material Supply (Customer Deliveries with GST) */}
        <motion.div variants={item} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-emerald-50/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">4. Material Supply Section</h2>
                <p className="text-[11px] text-slate-500">Customer dispatches with GST billing (Deducts stock)</p>
              </div>
            </div>
            {selectedLocationId !== "ALL" && (
              <button 
                type="button"
                onClick={() => navigate(`/locations/${selectedLocationId}`)}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold"
              >
                View
              </button>
            )}
          </div>

          <div className="p-5 space-y-3">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
              <span className="text-xs font-semibold text-slate-600">Total Supply Billed</span>
              <span className="text-sm font-bold text-slate-900">₹{metrics?.totalMaterialSupply?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-emerald-50/60 rounded-xl">
              <span className="text-xs font-semibold text-emerald-800">Amount Received from Clients</span>
              <span className="text-sm font-bold text-emerald-700">₹{metrics?.totalMaterialSupplyPaid?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-amber-50/60 rounded-xl">
              <span className="text-xs font-semibold text-amber-800">Pending Customer Receivables</span>
              <span className="text-sm font-bold text-amber-700">₹{metrics?.totalMaterialSupplyOutstanding?.toLocaleString() || 0}</span>
            </div>
          </div>
        </motion.div>

        {/* Section 5: Site Supply Section */}
        <motion.div variants={item} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-purple-50/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-purple-600 text-white rounded-xl shadow-xs">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">5. Site Supply Section</h2>
                <p className="text-[11px] text-slate-500">Site labour and internal material deliveries</p>
              </div>
            </div>
            {selectedLocationId !== "ALL" && (
              <button 
                type="button"
                onClick={() => navigate(`/locations/${selectedLocationId}`)}
                className="text-xs text-purple-700 hover:text-purple-800 font-bold"
              >
                View
              </button>
            )}
          </div>

          <div className="p-5 space-y-3">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
              <span className="text-xs font-semibold text-slate-600">Total Site Supply Incurred</span>
              <span className="text-sm font-bold text-slate-900">₹{metrics?.totalMaterialLabourSupply?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-emerald-50/60 rounded-xl">
              <span className="text-xs font-semibold text-emerald-800">Paid Disbursed</span>
              <span className="text-sm font-bold text-emerald-700">₹{metrics?.totalMaterialLabourSupplyPaid?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-rose-50/60 rounded-xl">
              <span className="text-xs font-semibold text-rose-800">Outstanding Site Balance</span>
              <span className="text-sm font-bold text-rose-700">₹{metrics?.totalMaterialLabourSupplyOutstanding?.toLocaleString() || 0}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 6: LABOUR ATTENDANCE & PAYROLL */}
      {/* ========================================================================= */}
      <motion.div variants={item} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-orange-50/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-600 text-white rounded-xl shadow-xs">
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">6. Labour Attendance & Payroll Section</h2>
              <p className="text-xs text-slate-500">Worker attendance tracking, piece rates (TC), advances & wages</p>
            </div>
          </div>
          {selectedLocationId !== "ALL" && (
            <button 
              type="button"
              onClick={() => navigate(`/locations/${selectedLocationId}`)}
              className="text-xs font-bold text-orange-700 hover:text-orange-800"
            >
              Open Labour Ledger
            </button>
          )}
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Net Salary Earned</span>
              <div className="text-xl font-bold text-slate-900 mt-1">₹{metrics?.labourMetrics?.totalNetSalary?.toLocaleString() || 0}</div>
            </div>
            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-100">
              <span className="text-xs font-semibold text-amber-800 uppercase">Upad / Advance Taken</span>
              <div className="text-xl font-bold text-amber-700 mt-1">₹{metrics?.labourMetrics?.totalUpad?.toLocaleString() || 0}</div>
            </div>
            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
              <span className="text-xs font-semibold text-emerald-800 uppercase">Paid Disbursed</span>
              <div className="text-xl font-bold text-emerald-700 mt-1">₹{metrics?.labourMetrics?.totalPayment?.toLocaleString() || 0}</div>
            </div>
            <div className="p-4 bg-rose-50/60 rounded-xl border border-rose-100">
              <span className="text-xs font-semibold text-rose-800 uppercase">Unpaid Wage Balance</span>
              <div className="text-xl font-bold text-rose-700 mt-1">₹{metrics?.labourMetrics?.totalBalance?.toLocaleString() || 0}</div>
            </div>
          </div>

          {/* Monthly Attendance Records Table */}
          {metrics?.rawLabourAtt && metrics.rawLabourAtt.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3 text-right">Total Days Worked</th>
                    <th className="px-4 py-3 text-right">Piece Rate (TC Count)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics.rawLabourAtt.map((att: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-900">{att.month}</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-700">{parseFloat(att.days).toFixed(1)} Days</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">{parseFloat(att.tcs).toFixed(2)} TC</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
              No labour attendance records logged for this period.
            </div>
          )}
        </div>
      </motion.div>

      {/* ========================================================================= */}
      {/* SECTION 7: SUPERVISOR COST SECTION (LAST SECTION) */}
      {/* ========================================================================= */}
      <motion.div variants={item} className="bg-white rounded-2xl border-2 border-indigo-200 shadow-sm overflow-hidden">
        {/* Section Header */}
        <div className="p-5 border-b border-indigo-100 bg-indigo-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">7. Supervisor Cost Section (Last Section)</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-900 uppercase tracking-wider">
                  Independent Audit
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                <span className="font-semibold text-indigo-900">Completely separate from total investment calculations.</span> Dedicated to create, edit, view and cross-check supervisor cash against actual site supply records.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSupervisorModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              <Plus size={14} /> Record Supervisor Cost
            </button>
            {selectedLocationId !== "ALL" && (
              <button
                type="button"
                onClick={() => navigate(`/locations/${selectedLocationId}`)}
                className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-indigo-900 bg-indigo-100 hover:bg-indigo-200 rounded-xl transition-colors cursor-pointer"
              >
                Open Tab <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Audit Reconciliation Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cash Disbursed to Supervisors</span>
              <div className="text-2xl font-bold text-indigo-700 mt-1">
                ₹{supervisorAudit.totalSupervisorCost.toLocaleString()}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Independent tracking ledger</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Site Supply Total Incurred</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                ₹{supervisorAudit.totalSiteSupply.toLocaleString()}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Actual site supply & labour executions</p>
            </div>

            <div className={`p-4 rounded-xl border ${
              supervisorAudit.reconciliationStatus === "MATCHED" 
                ? "bg-emerald-50 border-emerald-200" 
                : supervisorAudit.reconciliationStatus === "SUPERVISOR_SURPLUS" 
                  ? "bg-amber-50 border-amber-200" 
                  : "bg-rose-50 border-rose-200"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">Audit Match Check</span>
                {supervisorAudit.reconciliationStatus === "MATCHED" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className={`w-4 h-4 ${supervisorAudit.reconciliationStatus === "SUPERVISOR_SURPLUS" ? "text-amber-600" : "text-rose-600"}`} />
                )}
              </div>
              <div className={`text-2xl font-bold mt-1 ${
                supervisorAudit.reconciliationStatus === "MATCHED" 
                  ? "text-emerald-700" 
                  : supervisorAudit.reconciliationStatus === "SUPERVISOR_SURPLUS" 
                    ? "text-amber-800" 
                    : "text-rose-800"
              }`}>
                Variance: ₹{Math.abs(supervisorAudit.variance).toLocaleString()}
              </div>
              <p className="text-xs mt-0.5 font-medium text-slate-600">
                {supervisorAudit.reconciliationStatus === "MATCHED" 
                  ? "Exact Match: Site supply perfectly balances supervisor funds." 
                  : supervisorAudit.reconciliationStatus === "SUPERVISOR_SURPLUS" 
                    ? "Supervisor holds surplus advance cash not yet booked." 
                    : "Site supplies exceed supervisor cash given."}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ========================================================================= */}
      {/* QUICK RECORD MODALS */}
      {/* ========================================================================= */}
      {/* Supervisor Cost Modal */}
      <Modal 
        isOpen={isSupervisorModalOpen} 
        onClose={() => setIsSupervisorModalOpen(false)} 
        title="Record Cash Given to Site Supervisor"
        maxWidth="md"
      >
        <form onSubmit={handleSaveSupervisorCost} className="space-y-4">
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed">
            This supervisor cost is kept strictly separate from total investment calculations, and is used to verify match against site supply records.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Site / Location *</label>
            <select
              value={supervisorFormData.locationId}
              onChange={e => setSupervisorFormData({ ...supervisorFormData, locationId: e.target.value })}
              className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
              required
            >
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name} {l.address ? `(${l.address})` : ""}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                value={supervisorFormData.date}
                onChange={e => setSupervisorFormData({ ...supervisorFormData, date: e.target.value })}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supervisor Name *</label>
              <input
                type="text"
                value={supervisorFormData.supervisorName}
                onChange={e => setSupervisorFormData({ ...supervisorFormData, supervisorName: e.target.value })}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                required
                placeholder="Supervisor Name"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Amount Given (₹) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={supervisorFormData.amount}
              onChange={e => setSupervisorFormData({ ...supervisorFormData, amount: e.target.value })}
              className="w-full p-2.5 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
              required
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={supervisorFormData.paymentMethod}
                onChange={e => setSupervisorFormData({ ...supervisorFormData, paymentMethod: e.target.value })}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="UPI">UPI / GPay</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reference No.</label>
              <input
                type="text"
                value={supervisorFormData.referenceNumber}
                onChange={e => setSupervisorFormData({ ...supervisorFormData, referenceNumber: e.target.value })}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                placeholder="Voucher or Ref No."
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              value={supervisorFormData.description}
              onChange={e => setSupervisorFormData({ ...supervisorFormData, description: e.target.value })}
              className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
              rows={2}
              placeholder="Advance details..."
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setIsSupervisorModalOpen(false)}
              className="flex-1 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer"
            >
              Save Supervisor Cost
            </button>
          </div>
        </form>
      </Modal>

      {/* Investor Transaction Modal */}
      <Modal 
        isOpen={isInvestorModalOpen} 
        onClose={() => setIsInvestorModalOpen(false)} 
        title="Record Investment or Upad"
        maxWidth="md"
      >
        <form onSubmit={handleSaveInvestmentTx} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Site / Location *</label>
            <select
              value={investorFormData.locationId}
              onChange={e => setInvestorFormData({ ...investorFormData, locationId: e.target.value })}
              className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden"
              required
            >
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name} {l.address ? `(${l.address})` : ""}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Transaction Type *</label>
              <select
                value={investorFormData.type}
                onChange={e => setInvestorFormData({ ...investorFormData, type: e.target.value as any })}
                className="w-full p-2.5 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden"
              >
                <option value="INVESTMENT">1. Investment (Capital Add)</option>
                <option value="UPAD">2. Upad (Drawing / Withdrawal)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                value={investorFormData.date}
                onChange={e => setInvestorFormData({ ...investorFormData, date: e.target.value })}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Investor Party Name *</label>
            <input
              type="text"
              value={investorFormData.partyName}
              onChange={e => setInvestorFormData({ ...investorFormData, partyName: e.target.value })}
              className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden"
              required
              placeholder="e.g. Bina Enterprise Partner / Ramesh Patel"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={investorFormData.amount}
              onChange={e => setInvestorFormData({ ...investorFormData, amount: e.target.value })}
              className="w-full p-2.5 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden"
              required
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={investorFormData.paymentMethod}
                onChange={e => setInvestorFormData({ ...investorFormData, paymentMethod: e.target.value })}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden"
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI / GPay</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reference No.</label>
              <input
                type="text"
                value={investorFormData.referenceNumber}
                onChange={e => setInvestorFormData({ ...investorFormData, referenceNumber: e.target.value })}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden"
                placeholder="Cheque / UTR"
              />
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setIsInvestorModalOpen(false)}
              className="flex-1 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer"
            >
              Save Record
            </button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
