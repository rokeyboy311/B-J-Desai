import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import {
  ArrowLeft, Download, Trash2, Landmark, Coins, Package, Wrench, CalendarCheck, HardHat, FileSpreadsheet, ExternalLink, RefreshCw
} from "lucide-react";
import InvestorCapitalTab from "../components/categories/InvestorCapitalTab";
import InvestmentTab from "../components/categories/InvestmentTab";
import SiteSupplyTab from "../components/categories/SiteSupplyTab";
import LabourAttendanceTab from "../components/categories/LabourAttendanceTab";
import OtherKharchTab from "../components/categories/OtherKharchTab";
import ContractorCostTab from "../components/categories/ContractorCostTab";
import CategoryPinGate from "../components/ui/CategoryPinGate";
import { useLiveSync } from "../hooks/useLiveSync";
import { useToast } from "../contexts/ToastContext";
import { useGoogleSync } from "../contexts/GoogleSyncContext";
import { downloadExcelReport } from "../lib/excelExport";

export default function LocationDetailsPage() {
  const { showToast, confirmAction } = useToast();
  const { id: locationId } = useParams();
  const navigate = useNavigate();

  const {
    isConnected,
    isSyncing,
    activeSyncTarget,
    getLocationSpreadsheetUrl,
    syncLocationSheet,
    setIsModalOpen
  } = useGoogleSync();

  const [activeCategory, setActiveCategory] = useState<
    "investor_capital" | "investment_capital" | "site_supply" | "labour_attendance" | "other_kharch" | "contractor_cost"
  >("investor_capital");
  
  const [locationName, setLocationName] = useState(() => {
    try {
      const saved = sessionStorage.getItem('bd_erp_locations_breakdown_cache');
      if (saved) {
        const list = JSON.parse(saved);
        const found = list.find((b: any) => b.id.toString() === locationId);
        if (found?.name) return found.name;
      }
    } catch {}
    return "Loading...";
  });
  const [locMetrics, setLocMetrics] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem('bd_erp_locations_breakdown_cache');
      if (saved) {
        const list = JSON.parse(saved);
        const found = list.find((b: any) => b.id.toString() === locationId);
        if (found) return found;
      }
    } catch {}
    return null;
  });
  const [projectUtilization, setProjectUtilization] = useState<any>(null);

  const loadLocationDetails = async () => {
    try {
      const [locRes, breakdownRes, utilRes] = await Promise.all([
        apiFetch(`/locations/${locationId}`).catch(() => null),
        apiFetch(`/reports/locations-breakdown`).catch(() => []),
        apiFetch(`/investments/project-utilization?locationId=${locationId}`).catch(() => null)
      ]);

      if (locRes && locRes.name) {
        setLocationName(locRes.name);
      }
      if (Array.isArray(breakdownRes)) {
        const found = breakdownRes.find((b: any) => b.id.toString() === locationId);
        if (found) setLocMetrics(found);
      }
      if (utilRes) {
        setProjectUtilization(utilRes);
      }
    } catch (err) {
      console.error("Failed to load location", err);
    }
  };

  const handleDeleteLocation = async () => {
    const confirmed = await confirmAction({
      title: "Delete Location",
      message: `Are you sure you want to delete ${locationName}? All records will be removed.`,
      confirmLabel: "Verify & Delete",
      isDanger: true,
      requirePassword: true
    });

    if (!confirmed) return;

    try {
      await apiFetch(`/locations/${locationId}`, { method: "DELETE" });
      showToast("Location deleted successfully", "success");
      navigate("/locations");
    } catch (err: any) {
      showToast(err.message || "Failed to delete location", "error");
    }
  };

  useEffect(() => {
    loadLocationDetails();
  }, [locationId]);

  useLiveSync(() => {
    loadLocationDetails();
  }, 3500);

  // Top KPI Values
  const invCap = locMetrics?.investorCapital || 0;
  const remainingInvCap = projectUtilization?.budgetBalance?.remainingInvestmentCapital !== undefined
    ? Number(projectUtilization.budgetBalance.remainingInvestmentCapital)
    : (locMetrics?.remainingInvestmentCapital ?? locMetrics?.cat2InvestmentCapital?.remainingCapital ?? 0);
  const stockVal = locMetrics?.stockValuation || 0;
  const siteSupply = locMetrics?.siteSupplies || 0;
  const labour = locMetrics?.labourMetrics?.grossSalary || locMetrics?.labourTotal || 0;

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header with Breadcrumb matching 04_location_details.svg */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
            <button 
              type="button" 
              onClick={() => navigate('/locations')}
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              Location
            </button>
            <span>&rsaquo;</span>
            <span className="text-slate-800 font-bold">{locationName}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Location Details</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Site Google Sheet Live Action */}
          {(() => {
            const locNum = Number(locationId);
            const sheetUrl = getLocationSpreadsheetUrl(locNum);
            const isThisLocSyncing = isSyncing && activeSyncTarget?.includes(`#${locationId}`);

            if (!isConnected) {
              return (
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Connect Google Sheets</span>
                </button>
              );
            }

            return (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/80 p-1 rounded-xl">
                {sheetUrl ? (
                  <a
                    href={sheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Open Site Sheet</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => syncLocationSheet(locNum)}
                    disabled={isSyncing}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Create Site Sheet</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => syncLocationSheet(locNum)}
                  disabled={isSyncing}
                  title="Re-sync all tabs (Investors, Supplies, and Teams) for this site"
                  className="p-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isThisLocSyncing ? 'animate-spin text-emerald-600' : ''}`} />
                </button>
              </div>
            );
          })()}

          <button
            type="button"
            onClick={() => downloadExcelReport(`/reports/export-location/${locationId}?tab=all`, `${locationName}_Report.xlsx`)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={handleDeleteLocation}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
          </button>
        </div>
      </div>

      {/* Top 5 KPI Cards matching 04_location_details.svg */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Landmark className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Investor Capital</span>
            <span className="text-sm font-bold text-slate-800 tabular-nums">
              ₹{invCap.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${remainingInvCap < 0 ? "bg-rose-50 text-rose-600" : "bg-purple-50 text-purple-600"}`}>
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Remaining Investment Capital</span>
            <span className={`text-sm font-bold tabular-nums ${remainingInvCap < 0 ? "text-rose-600" : "text-slate-800"}`}>
              ₹{remainingInvCap.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Material Stock</span>
            <span className="text-sm font-bold text-slate-800 tabular-nums">
              ₹{stockVal.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Site Supply</span>
            <span className="text-sm font-bold text-slate-800 tabular-nums">
              ₹{siteSupply.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3 col-span-2 lg:col-span-1">
          <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl">
            <CalendarCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Labour</span>
            <span className="text-sm font-bold text-slate-800 tabular-nums">
              ₹{labour.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

      </div>

      {/* Horizontal Pill Tab Bar matching 04_location_details.svg */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar bg-slate-100 p-1.5 rounded-2xl border border-slate-200/70">
        <button
          type="button"
          onClick={() => setActiveCategory("investor_capital")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeCategory === "investor_capital"
              ? "bg-[#0B1D3A] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Investor Capital
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("investment_capital")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeCategory === "investment_capital"
              ? "bg-[#0B1D3A] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Investment Capital
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("site_supply")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeCategory === "site_supply"
              ? "bg-[#0B1D3A] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Site Supply
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("labour_attendance")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeCategory === "labour_attendance"
              ? "bg-[#0B1D3A] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Labour Attendance
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("other_kharch")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeCategory === "other_kharch"
              ? "bg-[#0B1D3A] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Other Expenses
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("contractor_cost")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeCategory === "contractor_cost"
              ? "bg-[#0B1D3A] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Contractor Cost
        </button>
      </div>

      {/* Tab Panel Content */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6 min-h-[500px]">
        {activeCategory === "investor_capital" && (
          <CategoryPinGate categoryName="Investor Capital" categoryNumber={1}>
            <InvestorCapitalTab locationId={Number(locationId)} locationName={locationName} />
          </CategoryPinGate>
        )}
        {activeCategory === "investment_capital" && (
          <CategoryPinGate categoryName="Investment Capital" categoryNumber={2}>
            <InvestmentTab locationId={Number(locationId)} />
          </CategoryPinGate>
        )}
        {activeCategory === "site_supply" && (
          <SiteSupplyTab locationId={Number(locationId)} />
        )}
        {activeCategory === "labour_attendance" && (
          <LabourAttendanceTab locationId={Number(locationId)} />
        )}
        {activeCategory === "other_kharch" && (
          <OtherKharchTab locationId={Number(locationId)} />
        )}
        {activeCategory === "contractor_cost" && (
          <ContractorCostTab locationId={Number(locationId)} />
        )}
      </div>

    </div>
  );
}
