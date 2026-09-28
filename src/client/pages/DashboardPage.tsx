import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Building2, MapPin, Calculator, Users, Package, Truck, Wrench, PlusCircle, ArrowRight,
  HardHat, UserCheck, AlertTriangle, CheckCircle2, TrendingUp, DollarSign, RefreshCw
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useLiveSync } from "../hooks/useLiveSync";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<any>(null);
  const [contractorReconciliation, setContractorReconciliation] = useState<any>(null);
  const [locationsBreakdown, setLocationsBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async (isBackground = false) => {
    try {
      if (!isBackground && !metrics) setLoading(true);
      const [res, reconRes, locBreakdownRes] = await Promise.all([
        apiFetch(`/reports/dashboard?locationId=ALL`).catch(() => null),
        apiFetch(`/contractor-costs/reconciliation?locationId=ALL`).catch(() => null),
        apiFetch(`/reports/locations-breakdown`).catch(() => [])
      ]);
      setMetrics(res || null);
      if (reconRes) setContractorReconciliation(reconRes);
      if (Array.isArray(locBreakdownRes)) setLocationsBreakdown(locBreakdownRes);
    } catch (err) {
      console.error("Dashboard data load error:", err);
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
    return `₹${Math.round(val).toLocaleString("en-IN")}`;
  };

  // Section 8: Authoritative Location-wise Calculations
  const totalLocations = locationsBreakdown.length;

  // 1. Total Location Investment Capital (Tier 3 Deployed Project Capital)
  const totalLocationInvestmentCap = useMemo(() => {
    return locationsBreakdown.reduce((sum, loc) => {
      const cap = Number(
        loc.cat2InvestmentCapital?.fullCapital ??
        loc.fullProjectCapital ??
        (Number(loc.investorCapital || 0) + Number(loc.billInvestment || 0))
      );
      return sum + (isNaN(cap) ? 0 : cap);
    }, 0);
  }, [locationsBreakdown]);

  // 2. Operational Outflow Summaries
  const totalSiteSupplySummary = useMemo(() => {
    return locationsBreakdown.reduce((sum, loc) => sum + Number(loc.siteSupplies || loc.cat4SiteSupply?.totalSiteSupply || 0), 0);
  }, [locationsBreakdown]);

  const totalLabourSummary = useMemo(() => {
    return locationsBreakdown.reduce((sum, loc) => {
      const wages = Number(loc.labourMetrics?.attendanceWages || loc.cat5LabourAttendance?.attendanceWages || 0);
      const other = Number(loc.otherKharchTotal || loc.cat6OtherKharch?.totalOtherKharch || 0);
      return sum + wages + other;
    }, 0);
  }, [locationsBreakdown]);

  const totalContractorSummary = useMemo(() => {
    return locationsBreakdown.reduce((sum, loc) => {
      const cost = Number(loc.contractorCosts?.recorded || loc.cat7ContractorCost?.recorded || 0);
      return sum + cost;
    }, 0);
  }, [locationsBreakdown]);

  const totalSupervisorSummary = useMemo(() => {
    return locationsBreakdown.reduce((sum, loc) => sum + Number(loc.supervisorCost || 0), 0);
  }, [locationsBreakdown]);

  // 3. Total Utilized Investment Capital (Site supplies + Labour + Other kharch)
  const totalUtilizedInvestmentCap = useMemo(() => {
    return locationsBreakdown.reduce((sum, loc) => {
      const utilized = Number(
        loc.cat2InvestmentCapital?.operationalDeductions ??
        (Number(loc.siteSupplies || 0) + Number(loc.labourMetrics?.upad || 0) + Number(loc.otherKharchTotal || 0))
      );
      return sum + (isNaN(utilized) ? 0 : utilized);
    }, 0);
  }, [locationsBreakdown]);

  // 4. Total Remaining Investment Capital
  const totalRemainingInvestmentCap = useMemo(() => {
    return locationsBreakdown.reduce((sum, loc) => {
      const rem = Number(
        loc.remainingInvestmentCapital ??
        loc.cat2InvestmentCapital?.remainingCapital ??
        (Number(loc.investorCapital || 0) - Number(loc.siteSupplies || 0))
      );
      return sum + (isNaN(rem) ? 0 : rem);
    }, 0);
  }, [locationsBreakdown]);

  // 5. Locations in Deficit (Alerts)
  const deficitLocations = useMemo(() => {
    return locationsBreakdown.filter((loc) => {
      const rem = Number(
        loc.remainingInvestmentCapital ??
        loc.cat2InvestmentCapital?.remainingCapital ?? 0
      );
      return rem < 0;
    });
  }, [locationsBreakdown]);

  // Max location capital for relative progress bars
  const maxLocCap = Math.max(...locationsBreakdown.map(l => Number(l.cat2InvestmentCapital?.fullCapital || l.investorCapital || 0)), 50000);

  return (
    <div className="space-y-6 pb-20">
      
      {/* Page Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Location Dashboard</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Authoritative site operational analytics & project capital management</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/locations')}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Manage All Locations</span>
          </button>
        </div>
      </div>

      {/* Relevant Alerts if any location is in DEFICIT */}
      {deficitLocations.length > 0 && (
        <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-xs font-black text-rose-900">Capital Deficit Alert: {deficitLocations.length} Site(s) Over Budget</h3>
            <p className="text-[11px] text-rose-700 mt-0.5">
              The following site(s) have operational expenses exceeding allocated investment capital:
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {deficitLocations.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => navigate(`/locations/${d.id}`)}
                  className="px-2.5 py-1 bg-white border border-rose-300 rounded-lg text-xs font-bold text-rose-700 hover:bg-rose-100 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>{d.name}:</span>
                  <span className="tabular-nums">₹{Math.abs(d.remainingInvestmentCapital || 0).toLocaleString("en-IN")} Deficit</span>
                  <ArrowRight className="w-3 h-3 ml-0.5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top 4 Primary Location Capital KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Locations */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Sites</span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <MapPin className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2 tabular-nums">
              {totalLocations} <span className="text-sm font-semibold text-slate-400">Locations</span>
            </div>
          </div>
          <div className="w-12 h-1 bg-blue-600 rounded-full mt-4" />
        </div>

        {/* Location Investment Capital */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Investment Capital</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-indigo-900 mt-2 tabular-nums">
              {formatLakhOrCr(totalLocationInvestmentCap)}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">All Project Deployed Capital</span>
          </div>
          <div className="w-12 h-1 bg-indigo-600 rounded-full mt-4" />
        </div>

        {/* Utilized Investment Capital */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Utilized Capital</span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-amber-700 mt-2 tabular-nums">
              {formatLakhOrCr(totalUtilizedInvestmentCap)}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Site Supplies & Labour Outflows</span>
          </div>
          <div className="w-12 h-1 bg-amber-500 rounded-full mt-4" />
        </div>

        {/* Remaining Investment Capital */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Remaining Capital</span>
              <div className={`p-2 rounded-xl ${totalRemainingInvestmentCap < 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-2xl font-black mt-2 tabular-nums ${totalRemainingInvestmentCap < 0 ? "text-rose-600" : "text-emerald-700"}`}>
              {formatLakhOrCr(totalRemainingInvestmentCap)}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Net Available Project Pool</span>
          </div>
          <div className={`w-12 h-1 rounded-full mt-4 ${totalRemainingInvestmentCap < 0 ? "bg-rose-600" : "bg-emerald-600"}`} />
        </div>

      </div>

      {/* Operational Expenses Summary Row (Site Supply, Labour, Contractor, Supervisor) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Site Operations Outflow Summary</h2>
            <p className="text-[11px] text-slate-500">Authoritative aggregation across all operational site categories</p>
          </div>
          <span className="text-xs font-black text-slate-900 tabular-nums">
            Total: {formatLakhOrCr(totalSiteSupplySummary + totalLabourSummary + totalContractorSummary + totalSupervisorSummary)}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-lg shrink-0">
              <Wrench className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Site Supply</span>
              <span className="text-base font-black text-slate-900 tabular-nums block">
                ₹{totalSiteSupplySummary.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Materials to Sites</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center gap-3">
            <div className="p-2.5 bg-teal-100 text-teal-700 rounded-lg shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Labour Summary</span>
              <span className="text-base font-black text-slate-900 tabular-nums block">
                ₹{totalLabourSummary.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Attendance & Kharch</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg shrink-0">
              <HardHat className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Contractor Cost</span>
              <span className="text-base font-black text-slate-900 tabular-nums block">
                ₹{totalContractorSummary.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Recorded Invoices</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Supervisor Cost</span>
              <span className="text-base font-black text-slate-900 tabular-nums block">
                ₹{totalSupervisorSummary.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Site Supervision</span>
            </div>
          </div>

        </div>
      </div>

      {/* Location-wise Operational Analytics Cards & Progress */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Location-wise Operational Status</h2>
            <p className="text-xs text-slate-500">Live operational capital vs burn rate across all project sites</p>
          </div>
          <button 
            type="button" 
            onClick={() => navigate('/locations')}
            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View All Sites ({locationsBreakdown.length})</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="space-y-3 pt-2">
          {locationsBreakdown.length === 0 ? (
            <div className="text-slate-400 text-xs py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No locations created yet. Click "Manage All Locations" to add your first site.
            </div>
          ) : (
            locationsBreakdown.map((loc) => {
              const fullCap = Number(loc.cat2InvestmentCapital?.fullCapital ?? loc.fullProjectCapital ?? loc.investorCapital ?? 0);
              const remaining = Number(loc.remainingInvestmentCapital ?? loc.cat2InvestmentCapital?.remainingCapital ?? 0);
              const utilized = Number(loc.cat2InvestmentCapital?.operationalDeductions ?? (fullCap - remaining));
              const siteSupply = Number(loc.siteSupplies || 0);
              const labourCost = Number(loc.labourMetrics?.attendanceWages || 0);
              const contractor = Number(loc.contractorCosts?.recorded || 0);
              const supervisor = Number(loc.supervisorCost || 0);
              
              const pct = fullCap > 0 ? Math.min(100, Math.round((Math.max(0, utilized) / fullCap) * 100)) : 0;
              const isDeficit = remaining < 0;

              return (
                <div 
                  key={loc.id} 
                  onClick={() => navigate(`/locations/${loc.id}`)}
                  className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-xs bg-white hover:bg-slate-50/50 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="min-w-0 md:w-56">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 truncate">{loc.name}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isDeficit ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {isDeficit ? 'Deficit' : 'Operational'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{loc.address || "Main Site"}</div>
                  </div>

                  {/* Progress bar */}
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-slate-500 font-medium">Budget Utilized: {pct}%</span>
                      <span className={`font-bold tabular-nums ${isDeficit ? "text-rose-600" : "text-emerald-700"}`}>
                        ₹{remaining.toLocaleString("en-IN")} Remaining
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${isDeficit ? "bg-rose-500" : pct > 80 ? "bg-amber-500" : "bg-blue-600"}`}
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Metrics chips */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <div className="px-2.5 py-1 bg-slate-100 rounded-lg text-center">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Site Supply</span>
                      <span className="text-xs font-bold text-slate-800 tabular-nums">₹{formatLakhOrCr(siteSupply)}</span>
                    </div>

                    <div className="px-2.5 py-1 bg-slate-100 rounded-lg text-center">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Labour</span>
                      <span className="text-xs font-bold text-slate-800 tabular-nums">₹{formatLakhOrCr(labourCost)}</span>
                    </div>

                    <div className="px-2.5 py-1 bg-slate-100 rounded-lg text-center">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Contractor</span>
                      <span className="text-xs font-bold text-slate-800 tabular-nums">₹{formatLakhOrCr(contractor)}</span>
                    </div>

                    <div className="px-2.5 py-1 bg-slate-100 rounded-lg text-center">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Supervisor</span>
                      <span className="text-xs font-bold text-slate-800 tabular-nums">₹{formatLakhOrCr(supervisor)}</span>
                    </div>

                    <div className="p-1.5 text-slate-400 hover:text-blue-600">
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
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
          Expected Contractor Cost = Site Supply Expense + Labour Attendance Expense across all active locations
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
