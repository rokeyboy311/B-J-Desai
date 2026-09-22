import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, Users, Landmark, Truck, Package, Activity,
  CalendarCheck, Wrench, ArrowRight, CheckCircle2, Coins,
  Calculator, ArrowDownRight, ArrowUpRight, ChevronDown, ChevronUp, Layers, HelpCircle,
  Receipt, FileSpreadsheet, Eye, MapPin, Building2, ExternalLink, PlusCircle, Coffee, HardHat
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useLiveSync } from "../hooks/useLiveSync";
import { AllRefundablesModal } from "../components/ui/AllRefundablesModal";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [adminSummary, setAdminSummary] = useState<any>(null);
  const [centralStock, setCentralStock] = useState<any[]>([]);
  const [contractorReconciliation, setContractorReconciliation] = useState<any>(null);
  const [locationsBreakdown, setLocationsBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRefundablesModal, setShowRefundablesModal] = useState(false);
  const navigate = useNavigate();

  const loadDashboard = async (isBackground = false) => {
    try {
      if (!isBackground && !metrics) setLoading(true);
      const [res, adminRes, stockRes, reconRes, locBreakdownRes] = await Promise.all([
        apiFetch(`/reports/dashboard?locationId=ALL`).catch(() => null),
        apiFetch(`/investments/admin-capital-summary`).catch(() => null),
        apiFetch(`/materials/central-stock`).catch(() => []),
        apiFetch(`/contractor-costs/reconciliation?locationId=ALL`).catch(() => null),
        apiFetch(`/reports/locations-breakdown`).catch(() => [])
      ]);
      setMetrics(res || null);
      if (adminRes) setAdminSummary(adminRes);
      if (Array.isArray(stockRes)) setCentralStock(stockRes);
      if (reconRes) setContractorReconciliation(reconRes);
      if (Array.isArray(locBreakdownRes)) setLocationsBreakdown(locBreakdownRes);
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

  const getMetric = (val: any) => Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-sm">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Master Financial Dashboard</h1>
            <p className="text-xs text-slate-500 font-medium">B J Desai &bull; Live Project Locations Analytics & Reconciled Operations</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Admin Capital &rarr;
          </button>
          <button
            type="button"
            onClick={() => navigate('/material-purchase')}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Central Stock &rarr;
          </button>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Live Synced
          </span>
        </div>
      </div>

      {/* Contractor Cost Reconciliation Summary & Central Stock Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contractor Cost Reconciliation Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Contractor Cost Reconciliation</h3>
                  <p className="text-[11px] text-slate-500">Live comparison: Site Supply + Labour vs Contractor Cost</p>
                </div>
              </div>
              {contractorReconciliation?.summary && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                  contractorReconciliation.summary.reconciliationStatus === "MATCHED"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : contractorReconciliation.summary.reconciliationStatus === "SURPLUS"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                }`}>
                  {contractorReconciliation.summary.reconciliationStatus}
                </span>
              )}
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Total Site Supply (Materials Issued):</span>
                <span className="font-bold text-slate-800">
                  ₹{contractorReconciliation?.summary?.totalSiteSupplies?.toLocaleString("en-IN") || "0"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Total Labour Attendance (Earned Wages):</span>
                <span className="font-bold text-slate-800">
                  ₹{contractorReconciliation?.summary?.totalLabourCost?.toLocaleString("en-IN") || "0"}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 font-bold text-indigo-700">
                <span>Expected Contractor Cost (Site Supply + Labour):</span>
                <span>₹{contractorReconciliation?.summary?.expectedCost?.toLocaleString("en-IN") || "0"}</span>
              </div>
              <div className="flex justify-between items-center font-bold text-slate-900">
                <span>Recorded Contractor Cost:</span>
                <span>₹{contractorReconciliation?.summary?.recordedCost?.toLocaleString("en-IN") || "0"}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 font-bold">
                <span>Difference / Variance:</span>
                <span className={contractorReconciliation?.summary?.variance >= 0 ? "text-blue-600" : "text-rose-600"}>
                  {contractorReconciliation?.summary?.variance >= 0 ? "+" : ""}
                  ₹{contractorReconciliation?.summary?.variance?.toLocaleString("en-IN") || "0"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => navigate("/locations")}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              View Location Details & Reconciliation &rarr;
            </button>
          </div>
        </div>

        {/* Central Stock Summary Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Central Inventory Stock</h3>
                  <p className="text-[11px] text-slate-500">Stock IN via Purchases & OUT via Supplies</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {centralStock.length} Materials
              </span>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Total Materials in Catalog:</span>
                <span className="font-bold text-slate-800">{centralStock.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">In Stock:</span>
                <span className="font-bold text-emerald-600">
                  {centralStock.filter((s) => s.status === "IN_STOCK").length} items
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Low Stock Alert:</span>
                <span className="font-bold text-amber-600">
                  {centralStock.filter((s) => s.status === "LOW_STOCK").length} items
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Out of Stock:</span>
                <span className="font-bold text-rose-600">
                  {centralStock.filter((s) => s.status === "OUT_OF_STOCK").length} items
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => navigate("/material-purchase")}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              Open Central Stock Ledger &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Active Locations Operations & Financial Reconciliation (સ્થળ મુજબ વિગતવાર એનાલિટિક્સ) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-600" />
              Active Project Locations Analytics ({locationsBreakdown.length})
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Dynamic real-time operational metrics across 7 categories for each active project site
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/locations')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors self-start sm:self-auto border border-indigo-200/60 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Manage All Locations &rarr;
          </button>
        </div>

        {locationsBreakdown.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
            <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-800">No Active Locations Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Create a new project location to automatically generate live financial & operational analytics dashboards here.
            </p>
            <button
              type="button"
              onClick={() => navigate('/locations')}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Create New Location
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {locationsBreakdown.map((loc) => {
              // Category 1: Investor Capital
              const cat1Inv = loc.cat1InvestorCapital || loc.cat7InvestorCapital || {
                totalContribution: loc.investorCapital || 0,
                allocatedCapital: loc.investorCapital || 0,
                investorUpad: (loc.investorUpad || 0) + (loc.investorPayment || 0),
                availableBalance: 0
              };

              // Category 2: Investment Capital
              const cat2Cap = loc.cat2InvestmentCapital || loc.cat1InvestmentCapital || {
                fullCapital: (loc.investorCapital || 0) + (loc.billInvestment || 0),
                operationalDeductions: 0,
                remainingCapital: (loc.investorCapital || 0) + (loc.billInvestment || 0)
              };

              // Category 3: Customer Supply (Renamed from Material Supply)
              const cat3Cust = loc.cat3CustomerSupply || loc.cat2MaterialSupply || {
                totalSupply: loc.materialSupplies || 0,
                received: loc.materialSuppliesPaid || 0,
                pending: (loc.materialSupplies || 0) - (loc.materialSuppliesPaid || 0)
              };

              // Category 4: Site Supply
              const cat4Site = loc.cat4SiteSupply || loc.cat3SiteSupply || {
                totalSiteSupply: loc.siteSupplies || 0
              };

              // Category 5: Labour Attendance (Attendance Wages - Upad, WITHOUT other kharch)
              const cat5Lab = loc.cat5LabourAttendance || loc.cat4LabourAttendance || loc.labourMetrics || {
                attendanceWages: 0,
                upad: 0,
                netBalance: 0,
                days: 0
              };
              const attendanceWages = Number(cat5Lab.attendanceWages || cat5Lab.grossSalary || 0);
              const upadPaid = Number(cat5Lab.upad || 0);
              const netLabourBalance = cat5Lab.netBalance !== undefined ? Number(cat5Lab.netBalance) : (attendanceWages - upadPaid);

              // Category 6: Other Kharch
              const cat6Kharch = loc.cat6OtherKharch || {
                totalOtherKharch: loc.otherKharchTotal || 0
              };

              // Category 7: Contractor Cost
              const cat7Cont = loc.cat7ContractorCost || loc.cat5ContractorCost || loc.contractorCosts || {
                recorded: 0,
                expected: 0,
                variance: 0,
                status: 'MATCHED'
              };

              return (
                <div 
                  key={loc.id} 
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden"
                >
                  {/* Location Header */}
                  <div className="p-5 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 border-b border-slate-100 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl mt-0.5 shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-slate-900 text-base">{loc.name}</h3>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {loc.recordCount} Records
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            7 Categories Active
                          </span>
                        </div>
                        {loc.address && (
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-sm">{loc.address}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/locations/${loc.id}`)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 transition-colors shrink-0 shadow-2xs cursor-pointer"
                    >
                      <span>Open Location</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 7-Category Analytics Grid in exact sequence */}
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50/50">
                    
                    {/* 1. Investor Capital */}
                    <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-tight">1. Investor Capital</span>
                        <span className="p-1 bg-emerald-50 text-emerald-600 rounded"><Landmark className="w-3 h-3" /></span>
                      </div>
                      <div className="my-1.5">
                        <p className="text-[11px] text-slate-500 font-medium">Allocated Capital:</p>
                        <p className="text-lg font-black text-emerald-700">₹{getMetric(cat1Inv.allocatedCapital)}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-600 flex justify-between font-mono">
                        <span>Upad: ₹{getMetric(cat1Inv.investorUpad)}</span>
                        <span className="text-emerald-700 font-bold">Bal: ₹{getMetric(cat1Inv.availableBalance)}</span>
                      </div>
                    </div>

                    {/* 2. Investment Capital */}
                    <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-blue-800 uppercase tracking-tight">2. Investment Capital</span>
                        <span className="p-1 bg-blue-50 text-blue-600 rounded"><Coins className="w-3 h-3" /></span>
                      </div>
                      <div className="my-1.5">
                        <p className="text-[11px] text-slate-500 font-medium">Remaining Net Capital:</p>
                        <p className="text-lg font-black text-blue-700">₹{getMetric(cat2Cap.remainingCapital)}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-600 flex justify-between font-mono">
                        <span>Pool: ₹{getMetric(cat2Cap.fullCapital)}</span>
                        <span className="text-rose-600">Ded: ₹{getMetric(cat2Cap.operationalDeductions)}</span>
                      </div>
                    </div>

                    {/* 3. Customer Supply (Renamed from Material Supply) */}
                    <div className="bg-white p-3.5 rounded-xl border border-orange-200 shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-orange-800 uppercase tracking-tight">3. Customer Supply</span>
                        <span className="p-1 bg-orange-50 text-orange-600 rounded"><Truck className="w-3 h-3" /></span>
                      </div>
                      <div className="my-1.5">
                        <p className="text-[11px] text-slate-500 font-medium">Customer Billed:</p>
                        <p className="text-lg font-black text-orange-600">₹{getMetric(cat3Cust.totalSupply)}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-600 flex justify-between font-mono">
                        <span className="text-emerald-600 font-bold">Rec: ₹{getMetric(cat3Cust.received)}</span>
                        <span className="text-rose-600 font-bold">Due: ₹{getMetric(cat3Cust.pending)}</span>
                      </div>
                    </div>

                    {/* 4. Site Supply */}
                    <div className="bg-white p-3.5 rounded-xl border border-teal-200 shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-teal-800 uppercase tracking-tight">4. Site Supply</span>
                        <span className="p-1 bg-teal-50 text-teal-600 rounded"><Wrench className="w-3 h-3" /></span>
                      </div>
                      <div className="my-1.5">
                        <p className="text-[11px] text-slate-500 font-medium">Materials Dispatched:</p>
                        <p className="text-lg font-black text-teal-700">₹{getMetric(cat4Site.totalSiteSupply)}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-600 font-mono">
                        <span>Issued directly to site teams</span>
                      </div>
                    </div>

                    {/* 5. Labour Wages (Attendance - Upad = Total, other kharch excluded) */}
                    <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-800 uppercase tracking-tight">5. Labour Wages</span>
                        <span className="p-1 bg-amber-50 text-amber-600 rounded"><CalendarCheck className="w-3 h-3" /></span>
                      </div>
                      <div className="my-1.5">
                        <p className="text-[11px] text-slate-500 font-medium">Net Wages Balance:</p>
                        <p className="text-lg font-black text-amber-700">₹{getMetric(netLabourBalance)}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-600 flex justify-between font-mono">
                        <span>Earned: ₹{getMetric(attendanceWages)}</span>
                        <span className="text-indigo-700">Upad: ₹{getMetric(upadPaid)}</span>
                      </div>
                    </div>

                    {/* 6. Other Kharch */}
                    <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-rose-800 uppercase tracking-tight">6. Other Kharch</span>
                        <span className="p-1 bg-rose-50 text-rose-600 rounded"><Coffee className="w-3 h-3" /></span>
                      </div>
                      <div className="my-1.5">
                        <p className="text-[11px] text-slate-500 font-medium">Site Sundry & Expenses:</p>
                        <p className="text-lg font-black text-rose-700">₹{getMetric(cat6Kharch.totalOtherKharch)}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 font-mono">
                        <span>Deducted from Cat 2 Capital</span>
                      </div>
                    </div>

                    {/* 7. Contractor Cost & Reconciliation */}
                    <div className="bg-white p-3.5 rounded-xl border border-purple-200 shadow-2xs flex flex-col justify-between sm:col-span-2 md:col-span-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-purple-900 uppercase tracking-tight">7. Contractor Cost (Reconciliation)</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            cat7Cont.status === 'MATCHED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : cat7Cont.status === 'SURPLUS'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {cat7Cont.status}
                          </span>
                        </div>
                        <span className="p-1 bg-purple-50 text-purple-700 rounded"><HardHat className="w-3 h-3" /></span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-slate-500">Recorded:</span>
                          <p className="font-bold text-slate-900">₹{getMetric(cat7Cont.recorded)}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500">Expected (Site + Labour):</span>
                          <p className="font-bold text-indigo-700">₹{getMetric(cat7Cont.expected)}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500">Variance:</span>
                          <p className={`font-bold ${cat7Cont.variance >= 0 ? "text-blue-600" : "text-rose-600"}`}>
                            {cat7Cont.variance >= 0 ? "+" : ""}₹{getMetric(cat7Cont.variance)}
                          </p>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Footer Action */}
                  <div className="px-5 py-2.5 bg-white border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Location Synced & Reconciled
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/locations/${loc.id}`)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>View All 7 Categories Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
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

      <AllRefundablesModal 
        isOpen={showRefundablesModal} 
        onClose={() => setShowRefundablesModal(false)} 
        initialLocationId="ALL"
      />
    </div>
  );
}
