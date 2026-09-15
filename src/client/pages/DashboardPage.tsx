import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, Users, Landmark, Truck, Package, Activity, Plus, ShieldAlert,
  CalendarCheck, Wrench, Briefcase, TrendingUp, TrendingDown, ArrowUpRight, 
  ArrowDownRight, CheckCircle2, HardHat, FileText, ChevronRight, PieChart, Coins
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/reports/dashboard?locationId=ALL`);
      setMetrics(res || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getMetric = (val: any) => Number(val || 0).toLocaleString();

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading Dashboard...</div>;
  }

  // Derived metrics for UI
  const invFromInvestors = metrics?.connectedExpenses?.totalInvested || 0;
  const invFromBills = metrics?.connectedExpenses?.totalIncome || metrics?.totalIncome || 0;
  const invUpad = metrics?.connectedExpenses?.totalUpad || 0;
  
  const totalInvestment = invFromInvestors + invFromBills;
  const totalInvestorAvailable = invFromInvestors - invUpad;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-sm">
          <LayoutDashboard className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Master Dashboard</h1>
          <p className="text-sm text-slate-500 font-medium">Financial Overview & Operational Metrics</p>
        </div>
      </div>

      {/* Main Financial Overview Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 1. Total Investment */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Coins className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <h3 className="text-slate-300 font-medium mb-1 uppercase tracking-wider text-xs">1. Total Capital / Investment</h3>
            <p className="text-4xl font-black mb-6">₹{getMetric(totalInvestment)}</p>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-2">
                <span className="text-slate-400">From Investors</span>
                <span className="font-bold text-emerald-400">+ ₹{getMetric(invFromInvestors)}</span>
              </div>
              <div className="flex justify-between items-center text-sm pb-2">
                <span className="text-slate-400">From Bills (Income)</span>
                <span className="font-bold text-blue-400">+ ₹{getMetric(invFromBills)}</span>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-700/50">
               <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-300">Combined Total Capital Source</span>
                  <span className="font-bold">₹{getMetric(totalInvestment)}</span>
               </div>
            </div>
          </div>
        </div>

        {/* 2. Investor Funds */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-5">
            <Users className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <h3 className="text-slate-500 font-medium uppercase tracking-wider text-xs">2. Investor Funds (Part 1 Only)</h3>
            </div>
            <p className="text-3xl font-black text-slate-900 mb-6">₹{getMetric(totalInvestorAvailable)} <span className="text-sm font-medium text-slate-500">Net Available</span></p>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                <span className="text-slate-600">Total Amount Received</span>
                <span className="font-bold text-emerald-600">₹{getMetric(invFromInvestors)}</span>
              </div>
              <div className="flex justify-between items-center text-sm pb-2">
                <span className="text-slate-600">Total Upad (Used/Withdrawn)</span>
                <span className="font-bold text-rose-500">- ₹{getMetric(invUpad)}</span>
              </div>
            </div>
          </div>
        </div>
        
      </div>

      <h2 className="text-lg font-bold text-slate-800 mt-8 mb-4 flex items-center gap-2">
        <PieChart className="w-5 h-5 text-indigo-500" /> Department Wise Operations
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* 3. Material Purchase */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-rose-300 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl"><Package className="w-5 h-5" /></div>
            <div>
              <h3 className="font-bold text-slate-900">3. Material Purchase</h3>
              <p className="text-[11px] text-slate-500">Vendor Purchases & Inventory</p>
            </div>
          </div>
          <div className="space-y-3 pt-4 border-t border-slate-100">
             <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Total Purchase Value</span>
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

        {/* 4. Material Supply */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-orange-300 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-orange-100 text-orange-700 rounded-xl"><Truck className="w-5 h-5" /></div>
            <div>
              <h3 className="font-bold text-slate-900">4. Material Supply</h3>
              <p className="text-[11px] text-slate-500">Customer Billed (Sales)</p>
            </div>
          </div>
          <div className="space-y-3 pt-4 border-t border-slate-100">
             <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Total Supply Value</span>
              <span className="font-bold text-slate-800">₹{getMetric(metrics?.totalMaterialSupply)}</span>
            </div>
             <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Paid Amount</span>
              <span className="font-bold text-emerald-600">₹{getMetric(metrics?.totalMaterialSupplyPaid)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Pending Value</span>
              <span className="font-bold text-orange-600">₹{getMetric(metrics?.totalMaterialSupplyOutstanding)}</span>
            </div>
          </div>
        </div>

        {/* 5. Site Supply */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-teal-300 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-teal-100 text-teal-700 rounded-xl"><Wrench className="w-5 h-5" /></div>
            <div>
              <h3 className="font-bold text-slate-900">5. Site Supply</h3>
              <p className="text-[11px] text-slate-500">Internal Issued Materials</p>
            </div>
          </div>
          <div className="space-y-3 pt-4 border-t border-slate-100">
             <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Total Site Supply Value</span>
              <span className="font-bold text-slate-800">₹{getMetric(metrics?.totalMaterialLabourSupply)}</span>
            </div>
             <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Total Materials Issued</span>
              <span className="font-bold text-teal-600">{getMetric(metrics?.stockSummary?.siteSupplyQty || 0)} Units</span>
            </div>
          </div>
        </div>

        {/* 6. Labour Cost */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-amber-300 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl"><CalendarCheck className="w-5 h-5" /></div>
            <div>
              <h3 className="font-bold text-slate-900">6. Labour Cost</h3>
              <p className="text-[11px] text-slate-500">Day Wise & TC Wise</p>
            </div>
          </div>
          <div className="space-y-3 pt-4 border-t border-slate-100">
             <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Total Labour Cost</span>
              <span className="font-bold text-slate-800">₹{getMetric(metrics?.labourMetrics?.totalNetSalary)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Paid Amount</span>
              <span className="font-bold text-emerald-600">₹{getMetric(metrics?.labourMetrics?.totalPayment)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Unpaid Balance</span>
              <span className="font-bold text-rose-600">₹{getMetric(metrics?.labourMetrics?.totalBalance)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* 7. Supervisor Cost */}
      <div className="bg-white rounded-2xl border border-indigo-200 shadow-md p-6 relative overflow-hidden mt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl"><HardHat className="w-6 h-6" /></div>
          <div>
            <h3 className="font-black text-slate-900 text-lg">7. Supervisor Cost <span className="ml-2 text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-500 rounded-md">Separated from Total Capital</span></h3>
            <p className="text-xs text-slate-500 mt-1">This cost is not deducted from Investment. It is used for Site Supply matching & audit.</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
           <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
              <p className="text-xs text-indigo-600/70 font-semibold mb-1 uppercase tracking-wider">Total Declared Cost</p>
              <p className="text-2xl font-black text-indigo-900">₹{getMetric(metrics?.supervisorAudit?.totalSupervisorCost || metrics?.totalSupervisorCost)}</p>
           </div>
           
           <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider">Site Supply Value</p>
              <p className="text-2xl font-black text-slate-800">₹{getMetric(metrics?.supervisorAudit?.totalSiteSupply || metrics?.totalMaterialLabourSupply)}</p>
           </div>
           
           {(() => {
              const sv = Number(metrics?.supervisorAudit?.totalSupervisorCost || metrics?.totalSupervisorCost || 0);
              const ss = Number(metrics?.supervisorAudit?.totalSiteSupply || metrics?.totalMaterialLabourSupply || 0);
              const variance = Math.abs(sv - ss);
              const isMatch = variance === 0 && sv > 0;
              const isMissing = sv === 0 && ss === 0;

              return (
                <div className={`p-4 rounded-xl border md:col-span-2 flex items-center justify-between ${isMissing ? 'bg-slate-50 border-slate-200' : isMatch ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                  <div>
                    <p className={`text-xs font-semibold mb-1 uppercase tracking-wider ${isMissing ? 'text-slate-500' : isMatch ? 'text-emerald-600' : 'text-rose-600'}`}>Audit Match Status (Variance)</p>
                    <p className={`text-2xl font-black ${isMissing ? 'text-slate-800' : isMatch ? 'text-emerald-700' : 'text-rose-700'}`}>₹{variance.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    {isMissing ? (
                       <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">NO RECORDS</span>
                    ) : isMatch ? (
                       <div className="flex flex-col items-end">
                         <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-1" />
                         <span className="text-xs font-bold text-emerald-600">MATCHED</span>
                       </div>
                    ) : (
                       <div className="flex flex-col items-end">
                         <ShieldAlert className="w-8 h-8 text-rose-500 mb-1" />
                         <span className="text-xs font-bold text-rose-600">NOT MATCHED</span>
                       </div>
                    )}
                  </div>
                </div>
              )
           })()}
        </div>
      </div>
      
      {/* Stock Summary */}
      <h2 className="text-lg font-bold text-slate-800 mt-8 mb-4 flex items-center gap-2">
        <Package className="w-5 h-5 text-blue-500" /> Current Stock & Inventory
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-xs text-slate-500 font-medium">Total Material Types</span>
          <span className="text-2xl font-black text-slate-800">{getMetric(metrics?.stockSummary?.totalDistinctMaterials)}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-xs text-slate-500 font-medium">Total Available Units</span>
          <span className="text-2xl font-black text-slate-800">{getMetric(metrics?.stockSummary?.totalStockUnits)}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-xs text-slate-500 font-medium">Total Stock Valuation</span>
          <span className="text-2xl font-black text-emerald-600">₹{getMetric(metrics?.stockSummary?.totalStockValuation)}</span>
        </div>
        <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 flex flex-col justify-center">
          <span className="text-xs text-rose-600 font-medium">Low Stock Items</span>
          <span className="text-2xl font-black text-rose-700">{getMetric(metrics?.stockSummary?.lowStockCount)}</span>
        </div>
      </div>

    </div>
  );
}
