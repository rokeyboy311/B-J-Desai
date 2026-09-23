import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Building2, MapPin, Calculator, Users, Package, Truck, Wrench, PlusCircle, ArrowRight
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useLiveSync } from "../hooks/useLiveSync";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<any>(null);
  const [adminSummary, setAdminSummary] = useState<any>(null);
  const [contractorReconciliation, setContractorReconciliation] = useState<any>(null);
  const [locationsBreakdown, setLocationsBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async (isBackground = false) => {
    try {
      if (!isBackground && !metrics) setLoading(true);
      const [res, adminRes, reconRes, locBreakdownRes] = await Promise.all([
        apiFetch(`/reports/dashboard?locationId=ALL`).catch(() => null),
        apiFetch(`/investments/admin-capital-summary`).catch(() => null),
        apiFetch(`/contractor-costs/reconciliation?locationId=ALL`).catch(() => null),
        apiFetch(`/reports/locations-breakdown`).catch(() => [])
      ]);
      setMetrics(res || null);
      if (adminRes) setAdminSummary(adminRes);
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

  const formatLakhOrCr = (val: number) => {
    if (!val) return "₹0";
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Cr`;
    } else if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)} L`;
    }
    return `₹${val.toLocaleString("en-IN")}`;
  };

  // Calculate top KPI totals
  const totalAdminCap = adminSummary?.totalContributed || 0;
  const totalInvestorCap = locationsBreakdown.reduce((sum, loc) => sum + (loc.investorCapital || 0), 0);
  const totalInvestmentCap = locationsBreakdown.reduce((sum, loc) => sum + (loc.billInvestment || 0), 0);
  const totalStockVal = metrics?.stockSummary?.totalStockValuation || 0;

  // Find max location value for progress bar scaling
  const maxLocVal = Math.max(...locationsBreakdown.map(l => l.investorCapital || 0), 100000);

  return (
    <div className="space-y-6 pb-20">
      
      {/* Page Title Header matching SVG */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">Location analytics at a glance</p>
      </div>

      {/* Top 4 KPI Cards matching SVG wireframe 15_responsive_mobile.svg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Admin Capital */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="text-xs font-semibold text-slate-500">Admin Capital</div>
          <div className="text-2xl font-black text-slate-900 mt-2 tabular-nums">
            {formatLakhOrCr(totalAdminCap)}
          </div>
          <div className="w-12 h-1 bg-blue-600 rounded-full mt-3" />
        </div>

        {/* Investor Capital */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="text-xs font-semibold text-slate-500">Investor Capital</div>
          <div className="text-2xl font-black text-slate-900 mt-2 tabular-nums">
            {formatLakhOrCr(totalInvestorCap)}
          </div>
          <div className="w-12 h-1 bg-blue-500 rounded-full mt-3" />
        </div>

        {/* Investment Capital */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="text-xs font-semibold text-slate-500">Investment Capital</div>
          <div className="text-2xl font-black text-slate-900 mt-2 tabular-nums">
            {formatLakhOrCr(totalInvestmentCap)}
          </div>
          <div className="w-12 h-1 bg-purple-600 rounded-full mt-3" />
        </div>

        {/* Stock Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="text-xs font-semibold text-slate-500">Stock Value</div>
          <div className="text-2xl font-black text-slate-900 mt-2 tabular-nums">
            {formatLakhOrCr(totalStockVal)}
          </div>
          <div className="w-12 h-1 bg-emerald-600 rounded-full mt-3" />
        </div>

      </div>

      {/* Location Analytics Progress Bars Section matching SVG wireframe */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Location Analytics</h2>
          <button 
            type="button" 
            onClick={() => navigate('/locations')}
            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View All Sites</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="space-y-4 pt-2">
          {locationsBreakdown.length === 0 ? (
            <div className="text-slate-400 text-xs py-4 text-center">No locations created yet.</div>
          ) : (
            locationsBreakdown.map((loc) => {
              const cap = loc.investorCapital || 0;
              const pct = Math.min(100, Math.max(15, Math.round((cap / maxLocVal) * 100)));

              return (
                <div 
                  key={loc.id} 
                  onClick={() => navigate(`/locations/${loc.id}`)}
                  className="flex items-center gap-4 cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition-colors"
                >
                  <div className="w-28 text-xs font-bold text-slate-800 truncate">{loc.name}</div>
                  <div className="flex-1 bg-slate-100 h-6 rounded-full overflow-hidden p-0.5">
                    <div 
                      className="bg-blue-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-20 text-right text-xs font-black text-slate-900 tabular-nums">
                    {formatLakhOrCr(cap)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Quick Actions matching SVG wireframe 15_responsive_mobile.svg */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900">Quick Actions</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => navigate('/customer-supply')}
            className="py-3.5 px-4 bg-[#1E88E5] hover:bg-blue-600 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Truck className="w-4 h-4" />
            <span>Customer Supply</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/material-purchase')}
            className="py-3.5 px-4 bg-[#0B1D3A] hover:bg-slate-900 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Package className="w-4 h-4" />
            <span>Material Purchase</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/material-purchase')}
            className="py-3.5 px-4 bg-[#10B981] hover:bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Building2 className="w-4 h-4" />
            <span>Material Stock</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/locations')}
            className="py-3.5 px-4 bg-[#8B5CF6] hover:bg-purple-600 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Wrench className="w-4 h-4" />
            <span>Site Supply</span>
          </button>
        </div>
      </div>

      {/* Contractor Cost Reconciliation Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Contractor Cost Reconciliation</h2>
          </div>
          {contractorReconciliation?.summary && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {contractorReconciliation.summary.reconciliationStatus || "MATCHED"}
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500">
          Expected Contractor Cost = Site Supply Expense + Labour Attendance Expense
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase">Expected Cost</span>
            <span className="text-lg font-black text-blue-700 tabular-nums">
              ₹{(contractorReconciliation?.summary?.expectedCost || 0).toLocaleString("en-IN")}
            </span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase">Actual Recorded Cost</span>
            <span className="text-lg font-black text-slate-900 tabular-nums">
              ₹{(contractorReconciliation?.summary?.recordedCost || 0).toLocaleString("en-IN")}
            </span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase">Difference / Variance</span>
            <span className={`text-lg font-black tabular-nums ${(contractorReconciliation?.summary?.variance || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              ₹{(contractorReconciliation?.summary?.variance || 0).toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
