import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import {
  ArrowLeft, CalendarCheck, Download, Landmark, TrendingDown,
  ChevronDown, Truck, Wrench, HardHat, Wallet, TrendingUp, User, Users, ShoppingCart, Lock, Trash2, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import InvestorTab from "../components/categories/InvestorTab";
import InvestmentTab from "../components/categories/InvestmentTab";
import MaterialPurchaseTab from "../components/categories/MaterialPurchaseTab";
import MaterialSupplyTab from "../components/categories/MaterialSupplyTab";
import SiteSupplyTab from "../components/categories/SiteSupplyTab";
import LabourAttendanceTab from "../components/categories/LabourAttendanceTab";
import MasterDataTab from "../components/categories/MasterDataTab";
import ContractorCostTab from "../components/categories/ContractorCostTab";
import CategoryPinGate from "../components/ui/CategoryPinGate";
import { useLiveSync } from "../hooks/useLiveSync";
import { useToast } from "../contexts/ToastContext";
import { Database, Scale } from "lucide-react";

export default function LocationDetailsPage() {
  const { showToast, confirmAction } = useToast();
  const { id: locationId } = useParams();
  const navigate = useNavigate();

  const [activeCategory, setActiveCategory] = useState<"investments" | "investor_pool" | "material_purchase" | "material_supply" | "site_supply" | "labour_attendance" | "master_data" | "contractor_cost">("investments");
  
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={() => navigate("/")}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{locationName}</h1>
            <p className="text-sm text-slate-500 font-medium">Manage investments, supplies, labour, and contractor costs</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDeleteLocation}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-xs w-fit cursor-pointer"
          title="Delete this location"
        >
          <Trash2 className="w-4 h-4 text-rose-600" />
          Delete Location
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-72 flex lg:flex-col gap-2.5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 hide-scrollbar shrink-0">
          
          <button type="button" onClick={() => setActiveCategory("investments")} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${activeCategory === "investments" ? "bg-blue-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}`}>
            <div className={`p-2 rounded-lg ${activeCategory === "investments" ? "bg-white/20" : "bg-blue-100 text-blue-700"}`}><TrendingUp className="w-4 h-4" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm flex items-center justify-between gap-1">
                <span>1. Investment Category</span>
                <Lock className="w-3.5 h-3.5 opacity-70 shrink-0" />
              </div>
              <div className={`text-xs ${activeCategory === "investments" ? "text-blue-100" : "text-slate-400"}`}>Capital, Bills & Passbook</div>
            </div>
          </button>

          <button type="button" onClick={() => setActiveCategory("material_purchase")} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${activeCategory === "material_purchase" ? "bg-rose-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}`}>
            <div className={`p-2 rounded-lg ${activeCategory === "material_purchase" ? "bg-white/20" : "bg-rose-100 text-rose-700"}`}><ShoppingCart className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">2. Material Purchase</div>
              <div className={`text-xs ${activeCategory === "material_purchase" ? "text-rose-100" : "text-slate-400"}`}>Purchase & Stock (UPPERCASE)</div>
            </div>
          </button>

          <button type="button" onClick={() => setActiveCategory("material_supply")} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${activeCategory === "material_supply" ? "bg-orange-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}`}>
            <div className={`p-2 rounded-lg ${activeCategory === "material_supply" ? "bg-white/20" : "bg-orange-100 text-orange-700"}`}><Truck className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">3. Material Supply</div>
              <div className={`text-xs ${activeCategory === "material_supply" ? "text-orange-100" : "text-slate-400"}`}>Customer Supply (GST)</div>
            </div>
          </button>

          <button type="button" onClick={() => setActiveCategory("site_supply")} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${activeCategory === "site_supply" ? "bg-teal-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}`}>
            <div className={`p-2 rounded-lg ${activeCategory === "site_supply" ? "bg-white/20" : "bg-teal-100 text-teal-700"}`}><Wrench className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">4. Site Supply</div>
              <div className={`text-xs ${activeCategory === "site_supply" ? "text-teal-100" : "text-slate-400"}`}>Supply to Site Labour</div>
            </div>
          </button>

          <button type="button" onClick={() => setActiveCategory("labour_attendance")} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${activeCategory === "labour_attendance" ? "bg-amber-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}`}>
            <div className={`p-2 rounded-lg ${activeCategory === "labour_attendance" ? "bg-white/20" : "bg-amber-100 text-amber-700"}`}><CalendarCheck className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">5. Labour Attendance</div>
              <div className={`text-xs ${activeCategory === "labour_attendance" ? "text-amber-100" : "text-slate-400"}`}>Attendance, Upad & Kharch</div>
            </div>
          </button>

          <button type="button" onClick={() => setActiveCategory("master_data")} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${activeCategory === "master_data" ? "bg-indigo-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}`}>
            <div className={`p-2 rounded-lg ${activeCategory === "master_data" ? "bg-white/20" : "bg-indigo-100 text-indigo-700"}`}><Database className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">6. Master Registry</div>
              <div className={`text-xs ${activeCategory === "master_data" ? "text-indigo-100" : "text-slate-400"}`}>Materials, Parties & Teams</div>
            </div>
          </button>

          <button type="button" onClick={() => setActiveCategory("contractor_cost")} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${activeCategory === "contractor_cost" ? "bg-purple-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}`}>
            <div className={`p-2 rounded-lg ${activeCategory === "contractor_cost" ? "bg-white/20" : "bg-purple-100 text-purple-700"}`}><HardHat className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">7. Contractor Cost</div>
              <div className={`text-xs ${activeCategory === "contractor_cost" ? "text-purple-100" : "text-slate-400"}`}>Cost & Reconciliation</div>
            </div>
          </button>

          <div className="pt-2 border-t border-slate-200">
            <button type="button" onClick={() => setActiveCategory("investor_pool")} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${activeCategory === "investor_pool" ? "bg-emerald-600 text-white shadow-md" : "bg-emerald-50/50 border border-emerald-200/60 hover:bg-emerald-100/60 text-emerald-900"}`}>
              <div className={`p-2 rounded-lg ${activeCategory === "investor_pool" ? "bg-white/20" : "bg-emerald-100 text-emerald-700"}`}><Users className="w-4 h-4" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs flex items-center justify-between gap-1">
                  <span>Investor Pool & Accounts</span>
                  <Lock className="w-3 h-3 opacity-70 shrink-0" />
                </div>
                <div className={`text-[11px] ${activeCategory === "investor_pool" ? "text-emerald-100" : "text-emerald-700 font-medium"}`}>Capital, Upad & Statements</div>
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
              {activeCategory === "investments" && (
                <CategoryPinGate categoryName="Investment Category" categoryNumber={1}>
                  <InvestmentTab locationId={Number(locationId)} />
                </CategoryPinGate>
              )}
              {activeCategory === "material_purchase" && <MaterialPurchaseTab locationId={Number(locationId)} />}
              {activeCategory === "material_supply" && <MaterialSupplyTab locationId={Number(locationId)} />}
              {activeCategory === "site_supply" && <SiteSupplyTab locationId={Number(locationId)} />}
              {activeCategory === "labour_attendance" && <LabourAttendanceTab locationId={Number(locationId)} />}
              {activeCategory === "master_data" && <MasterDataTab locationId={Number(locationId)} />}
              {activeCategory === "contractor_cost" && <ContractorCostTab locationId={Number(locationId)} />}
              {activeCategory === "investor_pool" && (
                <CategoryPinGate categoryName="Investor Category" categoryNumber={1}>
                  <InvestorTab locationId={Number(locationId)} />
                </CategoryPinGate>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
