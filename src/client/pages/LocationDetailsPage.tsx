import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import {
  ArrowLeft, CalendarCheck, Download, HardHat, TrendingUp, Lock, Trash2, Database,
  Package, Wrench, Truck, Landmark, Coffee, Layers
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import InvestorCapitalTab from "../components/categories/InvestorCapitalTab";
import InvestmentTab from "../components/categories/InvestmentTab";
import MaterialSupplyTab from "../components/categories/MaterialSupplyTab";
import SiteSupplyTab from "../components/categories/SiteSupplyTab";
import LabourAttendanceTab from "../components/categories/LabourAttendanceTab";
import OtherKharchTab from "../components/categories/OtherKharchTab";
import ContractorCostTab from "../components/categories/ContractorCostTab";
import LocationMaterialHubTab from "../components/categories/LocationMaterialHubTab";
import MasterDataTab from "../components/categories/MasterDataTab";
import CategoryPinGate from "../components/ui/CategoryPinGate";
import { useLiveSync } from "../hooks/useLiveSync";
import { useToast } from "../contexts/ToastContext";
import { downloadExcelReport } from "../lib/excelExport";

export default function LocationDetailsPage() {
  const { showToast, confirmAction } = useToast();
  const { id: locationId } = useParams();
  const navigate = useNavigate();

  const [activeCategory, setActiveCategory] = useState<
    "investor_capital" | "investment_capital" | "customer_supply" | "site_supply" | "labour_attendance" | "other_kharch" | "contractor_cost" | "material_hub" | "master_data"
  >("investor_capital");
  
  const [locationName, setLocationName] = useState("Loading...");

  const loadLocationDetails = async () => {
    try {
      const res = await apiFetch(`/locations/${locationId}`);
      if (res && res.name) {
        setLocationName(res.name);
      } else {
        setLocationName("Location Details");
      }
    } catch (err) {
      console.error("Failed to load location", err);
      setLocationName("Location Details");
    }
  };

  const handleDeleteLocation = async () => {
    const confirmed = await confirmAction({
      title: "Delete Location",
      message: `Are you sure you want to delete ${locationName}? This will remove all associated records permanently.`,
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
      console.error("Failed to delete location", err);
      showToast(err.message || "Failed to delete location. Please try again.", "error");
    }
  };

  useEffect(() => {
    loadLocationDetails();
  }, [locationId]);

  useLiveSync(() => {
    loadLocationDetails();
  }, 3500);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-6 pb-20"
    >
      {/* Location Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={() => navigate("/locations")}
            className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-500 hover:text-slate-800 cursor-pointer border border-slate-200"
            title="Back to Locations"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{locationName}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active Project
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Location Operations &bull; 7 Categories Sequence &bull; Capital, Supplies, Attendance, Kharch & Contractor Costs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => downloadExcelReport(`/reports/export-location/${locationId}?tab=all`, `${locationName.replace(/\s+/g, '_')}_Complete_Report.xlsx`)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Download complete location report in Excel"
          >
            <Download className="w-4 h-4" />
            <span>Export Report (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handleDeleteLocation}
            className="inline-flex items-center gap-2 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Delete this location"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Exact 7-Category Sequence Sidebar Navigation */}
        <div className="w-full lg:w-72 flex lg:flex-col gap-2.5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 hide-scrollbar shrink-0">
          
          {/* 1. Investor Capital */}
          <button 
            type="button" 
            onClick={() => setActiveCategory("investor_capital")} 
            className={`flex items-center gap-3 p-3.5 rounded-xl transition-all text-left cursor-pointer ${
              activeCategory === "investor_capital" 
                ? "bg-emerald-600 text-white shadow-md" 
                : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"
            }`}
          >
            <div className={`p-2 rounded-lg ${activeCategory === "investor_capital" ? "bg-white/20" : "bg-emerald-100 text-emerald-700"}`}>
              <Landmark className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm flex items-center justify-between gap-1">
                <span>1. Investor Capital</span>
                <Lock className="w-3.5 h-3.5 opacity-70 shrink-0" />
              </div>
              <div className={`text-xs ${activeCategory === "investor_capital" ? "text-emerald-100" : "text-slate-400"}`}>
                ઇન્વેસ્ટર મૂડી પૂલ (Master Pool)
              </div>
            </div>
          </button>

          {/* 2. Investment Capital */}
          <button 
            type="button" 
            onClick={() => setActiveCategory("investment_capital")} 
            className={`flex items-center gap-3 p-3.5 rounded-xl transition-all text-left cursor-pointer ${
              activeCategory === "investment_capital" 
                ? "bg-blue-600 text-white shadow-md" 
                : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"
            }`}
          >
            <div className={`p-2 rounded-lg ${activeCategory === "investment_capital" ? "bg-white/20" : "bg-blue-100 text-blue-700"}`}>
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm flex items-center justify-between gap-1">
                <span>2. Investment Capital</span>
                <Lock className="w-3.5 h-3.5 opacity-70 shrink-0" />
              </div>
              <div className={`text-xs ${activeCategory === "investment_capital" ? "text-blue-100" : "text-slate-400"}`}>
                પ્રોજેક્ટ મૂડી & કપાત (Net Capital)
              </div>
            </div>
          </button>

          {/* 3. Customer Supply (Renamed from Material Supply) */}
          <button 
            type="button" 
            onClick={() => setActiveCategory("customer_supply")} 
            className={`flex items-center gap-3 p-3.5 rounded-xl transition-all text-left cursor-pointer ${
              activeCategory === "customer_supply" 
                ? "bg-orange-600 text-white shadow-md" 
                : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"
            }`}
          >
            <div className={`p-2 rounded-lg ${activeCategory === "customer_supply" ? "bg-white/20" : "bg-orange-100 text-orange-700"}`}>
              <Truck className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">3. Customer Supply</div>
              <div className={`text-xs ${activeCategory === "customer_supply" ? "text-orange-100" : "text-slate-400"}`}>
                ગ્રાહક સપ્લાય & ઇન્વોઇસ
              </div>
            </div>
          </button>

          {/* 4. Site Supply */}
          <button 
            type="button" 
            onClick={() => setActiveCategory("site_supply")} 
            className={`flex items-center gap-3 p-3.5 rounded-xl transition-all text-left cursor-pointer ${
              activeCategory === "site_supply" 
                ? "bg-teal-600 text-white shadow-md" 
                : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"
            }`}
          >
            <div className={`p-2 rounded-lg ${activeCategory === "site_supply" ? "bg-white/20" : "bg-teal-100 text-teal-700"}`}>
              <Wrench className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">4. Site Supply</div>
              <div className={`text-xs ${activeCategory === "site_supply" ? "text-teal-100" : "text-slate-400"}`}>
                લેબર સાઇટ સામગ્રી સપ્લાય
              </div>
            </div>
          </button>

          {/* 5. Labour Attendance */}
          <button 
            type="button" 
            onClick={() => setActiveCategory("labour_attendance")} 
            className={`flex items-center gap-3 p-3.5 rounded-xl transition-all text-left cursor-pointer ${
              activeCategory === "labour_attendance" 
                ? "bg-amber-600 text-white shadow-md" 
                : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"
            }`}
          >
            <div className={`p-2 rounded-lg ${activeCategory === "labour_attendance" ? "bg-white/20" : "bg-amber-100 text-amber-700"}`}>
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">5. Labour Attendance</div>
              <div className={`text-xs ${activeCategory === "labour_attendance" ? "text-amber-100" : "text-slate-400"}`}>
                લેબર હાજરી & ટીમ ઉપાડ
              </div>
            </div>
          </button>

          {/* 6. Other Kharch */}
          <button 
            type="button" 
            onClick={() => setActiveCategory("other_kharch")} 
            className={`flex items-center gap-3 p-3.5 rounded-xl transition-all text-left cursor-pointer ${
              activeCategory === "other_kharch" 
                ? "bg-rose-600 text-white shadow-md" 
                : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"
            }`}
          >
            <div className={`p-2 rounded-lg ${activeCategory === "other_kharch" ? "bg-white/20" : "bg-rose-100 text-rose-700"}`}>
              <Coffee className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">6. Other Kharch</div>
              <div className={`text-xs ${activeCategory === "other_kharch" ? "text-rose-100" : "text-slate-400"}`}>
                સાઇટ અન્ય ખર્ચ & પરચૂરણ
              </div>
            </div>
          </button>

          {/* 7. Contractor Cost */}
          <button 
            type="button" 
            onClick={() => setActiveCategory("contractor_cost")} 
            className={`flex items-center gap-3 p-3.5 rounded-xl transition-all text-left cursor-pointer ${
              activeCategory === "contractor_cost" 
                ? "bg-purple-600 text-white shadow-md" 
                : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"
            }`}
          >
            <div className={`p-2 rounded-lg ${activeCategory === "contractor_cost" ? "bg-white/20" : "bg-purple-100 text-purple-700"}`}>
              <HardHat className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">7. Contractor Cost</div>
              <div className={`text-xs ${activeCategory === "contractor_cost" ? "text-purple-100" : "text-slate-400"}`}>
                રિકોન્સિલેશન (Supply + Labour)
              </div>
            </div>
          </button>

          <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
            {/* Master Registry */}
            <button 
              type="button" 
              onClick={() => setActiveCategory("master_data")} 
              className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left cursor-pointer ${
                activeCategory === "master_data" 
                  ? "bg-slate-800 text-white shadow-md" 
                  : "bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700"
              }`}
            >
              <div className={`p-1.5 rounded-lg ${activeCategory === "master_data" ? "bg-white/20" : "bg-slate-200 text-slate-700"}`}>
                <Database className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs">Master Registry</div>
                <div className={`text-[10px] ${activeCategory === "master_data" ? "text-slate-300" : "text-slate-400"}`}>
                  મટીરીયલ, પાર્ટી & ટીમ્સ
                </div>
              </div>
            </button>

            {/* Combined Supply Hub */}
            <button 
              type="button" 
              onClick={() => setActiveCategory("material_hub")} 
              className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left cursor-pointer ${
                activeCategory === "material_hub" 
                  ? "bg-indigo-600 text-white shadow-md" 
                  : "bg-indigo-50/70 border border-indigo-200 hover:bg-indigo-100 text-indigo-800"
              }`}
            >
              <div className={`p-1.5 rounded-lg ${activeCategory === "material_hub" ? "bg-white/20" : "bg-indigo-100 text-indigo-700"}`}>
                <Package className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs">Combined Supply Hub</div>
                <div className={`text-[10px] ${activeCategory === "material_hub" ? "text-indigo-100" : "text-indigo-500"}`}>
                  મટીરીયલ મેટ્રિક્સ & સમરી
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4 sm:p-6 lg:p-8 min-h-[600px] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
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
              {activeCategory === "customer_supply" && (
                <MaterialSupplyTab locationId={Number(locationId)} />
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
              {activeCategory === "material_hub" && (
                <LocationMaterialHubTab locationId={Number(locationId)} />
              )}
              {activeCategory === "master_data" && (
                <MasterDataTab locationId={Number(locationId)} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
