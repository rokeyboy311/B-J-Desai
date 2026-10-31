import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import {
  ArrowLeft, Download, Trash2, Landmark, Coins, Package, Wrench, CalendarCheck, HardHat, FileSpreadsheet, ExternalLink, RefreshCw, Pencil
} from "lucide-react";
import InvestorCapitalTab from "../components/categories/InvestorCapitalTab";
import SiteSupplyTab from "../components/categories/SiteSupplyTab";
import LabourAttendanceTab from "../components/categories/LabourAttendanceTab";
import OtherKharchTab from "../components/categories/OtherKharchTab";
import ContractorCostTab from "../components/categories/ContractorCostTab";
import CategoryPinGate from "../components/ui/CategoryPinGate";
import { Modal } from "../components/ui/Modal";
import { useLiveSync, triggerGlobalSync } from "../hooks/useLiveSync";
import { useToast } from "../contexts/ToastContext";
import { useGoogleSync } from "../contexts/GoogleSyncContext";
import { downloadExcelReport } from "../lib/excelExport";
import { formatINR } from "../lib/formatters";

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
    "investor_capital" | "site_supply" | "labour_attendance" | "other_kharch" | "contractor_cost"
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
  const [locationAddress, setLocationAddress] = useState("");
  const [isEditLocationOpen, setIsEditLocationOpen] = useState(false);
  const [editLocationForm, setEditLocationForm] = useState({ name: "", address: "" });

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
        setLocationAddress(locRes.address || "");
      }
      if (Array.isArray(breakdownRes)) {
        const found = breakdownRes.find((b: any) => b.id.toString() === locationId);
        if (found) {
          setLocMetrics(found);
          if (!locRes?.address && found.address) setLocationAddress(found.address);
        }
      }
      if (utilRes) {
        setProjectUtilization(utilRes);
      }
    } catch (err) {
      console.error("Failed to load location", err);
    }
  };

  const handleOpenEditLocation = () => {
    setEditLocationForm({
      name: locationName === "Loading..." ? "" : locationName,
      address: locationAddress || ""
    });
    setIsEditLocationOpen(true);
  };

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLocationForm.name.trim()) {
      showToast("Location name is required", "error");
      return;
    }
    try {
      await apiFetch(`/locations/${locationId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editLocationForm.name.trim(),
          address: editLocationForm.address.trim() || null
        })
      });
      setLocationName(editLocationForm.name.trim());
      setLocationAddress(editLocationForm.address.trim());
      setIsEditLocationOpen(false);
      showToast("Location updated successfully", "success");
      triggerGlobalSync();
      await loadLocationDetails();
    } catch (err: any) {
      showToast(err.message || "Failed to update location", "error");
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
  const invCap = projectUtilization?.investmentCapital?.fullCapital !== undefined
    ? Number(projectUtilization.investmentCapital.fullCapital)
    : (locMetrics?.investorCapital ?? locMetrics?.cat2InvestmentCapital?.investorCapital ?? 0);
  const remainingInvCap = projectUtilization?.budgetBalance?.remainingInvestmentCapital !== undefined
    ? Number(projectUtilization.budgetBalance.remainingInvestmentCapital)
    : (locMetrics?.remainingInvestmentCapital ?? locMetrics?.cat2InvestmentCapital?.remainingCapital ?? 0);
  const stockVal = locMetrics?.stockValuation || 0;
  const siteSupply = locMetrics?.siteSupplies || 0;
  const labour = locMetrics?.labourMetrics?.grossSalary || locMetrics?.labourTotal || 0;

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 min-w-0 max-w-full overflow-x-hidden">
      
      {/* Header with Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 min-w-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
            <button 
              type="button" 
              onClick={() => navigate('/locations')}
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              Location
            </button>
            <span>&rsaquo;</span>
            <span className="text-slate-800 font-bold break-words min-w-0">{locationName}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight break-words min-w-0">{locationName}</h1>
            <button
              type="button"
              onClick={handleOpenEditLocation}
              className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
              title="Edit Location Name & Address"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Name</span>
            </button>
          </div>
          {locationAddress && (
            <p className="text-xs text-slate-500 mt-0.5 break-words">{locationAddress}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap min-w-0">
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
                  className="px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
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
                    className="px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                    <span>Open Site Sheet</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => syncLocationSheet(locNum)}
                    disabled={isSyncing}
                    className="px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
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
            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={handleDeleteLocation}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Delete Location"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
          </button>
        </div>
      </div>

      {/* Top 5 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
        
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3 min-w-0 overflow-hidden">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <Landmark className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block leading-tight break-words">Investor Investment Capital</span>
            <span className="text-sm font-bold text-slate-800 tabular-nums break-all sm:break-normal block mt-0.5">
              ₹{formatINR(invCap)}
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3 min-w-0 overflow-hidden">
          <div className={`p-2.5 rounded-xl shrink-0 ${Number(remainingInvCap) < 0 ? "bg-rose-50 text-rose-600" : "bg-purple-50 text-purple-600"}`}>
            <Coins className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block leading-tight break-words">Remaining Investor Investment Capital</span>
            <span className={`text-sm font-bold tabular-nums break-all sm:break-normal block mt-0.5 ${Number(remainingInvCap) < 0 ? "text-rose-600" : "text-slate-800"}`}>
              ₹{formatINR(remainingInvCap)}
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3 min-w-0 overflow-hidden">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block leading-tight break-words">Material Stock</span>
            <span className="text-sm font-bold text-slate-800 tabular-nums break-all sm:break-normal block mt-0.5">
              ₹{formatINR(stockVal)}
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3 min-w-0 overflow-hidden">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0">
            <Wrench className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block leading-tight break-words">Site Supply</span>
            <span className="text-sm font-bold text-slate-800 tabular-nums break-all sm:break-normal block mt-0.5">
              ₹{formatINR(siteSupply)}
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3 sm:col-span-2 lg:col-span-1 min-w-0 overflow-hidden">
          <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl shrink-0">
            <CalendarCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block leading-tight break-words">Labour</span>
            <span className="text-sm font-bold text-slate-800 tabular-nums break-all sm:break-normal block mt-0.5">
              ₹{formatINR(labour)}
            </span>
          </div>
        </div>

      </div>

      {/* Responsive Wrapping Pill Tab Bar (Investment Capital removed; Investor Capital -> Investor Investment Capital) */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/70">
        <button
          type="button"
          onClick={() => setActiveCategory("investor_capital")}
          className={`col-span-2 sm:col-span-1 sm:flex-1 min-w-0 py-2.5 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center leading-tight break-words ${
            activeCategory === "investor_capital"
              ? "bg-[#0B1D3A] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Investor Investment Capital
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("site_supply")}
          className={`sm:flex-1 min-w-0 py-2.5 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center leading-tight break-words ${
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
          className={`sm:flex-1 min-w-0 py-2.5 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center leading-tight break-words ${
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
          className={`sm:flex-1 min-w-0 py-2.5 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center leading-tight break-words ${
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
          className={` sm:flex-1 min-w-0 py-2.5 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center leading-tight break-words ${
            activeCategory === "contractor_cost"
              ? "bg-[#0B1D3A] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Contractor Cost
        </button>
      </div>

      {/* Tab Panel Content */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-2.5 sm:p-5 md:p-6 min-h-[500px] min-w-0 max-w-full overflow-x-hidden">
        {activeCategory === "investor_capital" && (
          <CategoryPinGate categoryName="Investor Investment Capital" categoryNumber={1}>
            <InvestorCapitalTab locationId={Number(locationId)} locationName={locationName} />
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

      {/* Modal: Edit Location Name & Address */}
      <Modal
        isOpen={isEditLocationOpen}
        onClose={() => setIsEditLocationOpen(false)}
        title="Edit Location Name & Details"
        maxWidth="lg"
      >
        <form onSubmit={handleUpdateLocation} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Location Name *</label>
            <input
              type="text"
              required
              placeholder="Enter location name"
              value={editLocationForm.name}
              onChange={(e) => setEditLocationForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Site Address / Description</label>
            <input
              type="text"
              placeholder="Enter site address or description"
              value={editLocationForm.address}
              onChange={(e) => setEditLocationForm(prev => ({ ...prev, address: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditLocationOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
