import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import {
  ArrowLeft, CalendarCheck, Download, Landmark, TrendingDown,
  ChevronDown, Truck, Wrench, HardHat, Wallet, TrendingUp, User, Users, ShoppingCart, Lock, Trash2, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Modal } from "../components/ui/Modal";

import InvestorTab from "../components/categories/InvestorTab";
import InvestmentTab from "../components/categories/InvestmentTab";
import MaterialPurchaseTab from "../components/categories/MaterialPurchaseTab";
import MaterialSupplyTab from "../components/categories/MaterialSupplyTab";
import SiteSupplyTab from "../components/categories/SiteSupplyTab";
import LabourAttendanceTab from "../components/categories/LabourAttendanceTab";
import LabourRecordsTab from "../components/categories/LabourRecordsTab";
import SupervisorCostTab from "../components/categories/SupervisorCostTab";
import CategoryPinGate from "../components/ui/CategoryPinGate";
import { useLiveSync } from "../hooks/useLiveSync";

export default function LocationDetailsPage() {
  const { id: locationId } = useParams();
  const navigate = useNavigate();

  const [activeCategory, setActiveCategory] = useState<"investors" | "investments" | "material_purchase" | "material_supply" | "site_supply" | "labour_attendance" | "labour_records" | "supervisor">("investors");
  
  const [locationName, setLocationName] = useState("Loading...");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    try {
      setDeleting(true);
      await apiFetch(`/locations/${locationId}`, { method: "DELETE" });
      setIsDeleteModalOpen(false);
      navigate("/locations");
    } catch (err) {
      console.error("Failed to delete location", err);
      alert("Failed to delete location. Please try again.");
    } finally {
      setDeleting(false);
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
            <p className="text-sm text-slate-500 font-medium">Manage investments, supplies, and supervisor costs</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsDeleteModalOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-xs w-fit"
          title="Delete this location"
        >
          <Trash2 className="w-4 h-4 text-rose-600" />
          Delete Location
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-72 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 hide-scrollbar shrink-0">
          
          <button type="button" onClick={() => setActiveCategory("investors")} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${activeCategory === "investors" ? "bg-emerald-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}`}>
            <div className={`p-2 rounded-lg ${activeCategory === "investors" ? "bg-white/20" : "bg-emerald-100 text-emerald-700"}`}><Users className="w-4 h-4" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm flex items-center justify-between gap-1">
                <span>1. Investor Category</span>
                <Lock className="w-3.5 h-3.5 opacity-70 shrink-0" />
              </div>
              <div className={`text-xs ${activeCategory === "investors" ? "text-emerald-100" : "text-slate-400"}`}>Investors & Upad</div>
            </div>
          </button>

          <button type="button" onClick={() => setActiveCategory("investments")} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${activeCategory === "investments" ? "bg-blue-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}`}>
            <div className={`p-2 rounded-lg ${activeCategory === "investments" ? "bg-white/20" : "bg-blue-100 text-blue-700"}`}><TrendingUp className="w-4 h-4" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm flex items-center justify-between gap-1">
                <span>2. Investment Category</span>
                <Lock className="w-3.5 h-3.5 opacity-70 shrink-0" />
              </div>
              <div className={`text-xs ${activeCategory === "investments" ? "text-blue-100" : "text-slate-400"}`}>From Investors & Bills</div>
            </div>
          </button>

          <button type="button" onClick={() => setActiveCategory("material_purchase")} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${activeCategory === "material_purchase" ? "bg-rose-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}`}>
            <div className={`p-2 rounded-lg ${activeCategory === "material_purchase" ? "bg-white/20" : "bg-rose-100 text-rose-700"}`}><ShoppingCart className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">3. Material Purchase</div>
              <div className={`text-xs ${activeCategory === "material_purchase" ? "text-rose-100" : "text-slate-400"}`}>Purchase & Stock</div>
            </div>
          </button>

          <button type="button" onClick={() => setActiveCategory("material_supply")} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${activeCategory === "material_supply" ? "bg-orange-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}`}>
            <div className={`p-2 rounded-lg ${activeCategory === "material_supply" ? "bg-white/20" : "bg-orange-100 text-orange-700"}`}><Truck className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">4. Material Supply</div>
              <div className={`text-xs ${activeCategory === "material_supply" ? "text-orange-100" : "text-slate-400"}`}>Customer Supply (GST)</div>
            </div>
          </button>

          <button type="button" onClick={() => setActiveCategory("site_supply")} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${activeCategory === "site_supply" ? "bg-teal-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}`}>
            <div className={`p-2 rounded-lg ${activeCategory === "site_supply" ? "bg-white/20" : "bg-teal-100 text-teal-700"}`}><Wrench className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">5. Site Supply</div>
              <div className={`text-xs ${activeCategory === "site_supply" ? "text-teal-100" : "text-slate-400"}`}>Supply to Site Labour</div>
            </div>
          </button>

          <button type="button" onClick={() => setActiveCategory("labour_attendance")} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${activeCategory === "labour_attendance" ? "bg-amber-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}`}>
            <div className={`p-2 rounded-lg ${activeCategory === "labour_attendance" ? "bg-white/20" : "bg-amber-100 text-amber-700"}`}><CalendarCheck className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">6. Labour Attendance</div>
              <div className={`text-xs ${activeCategory === "labour_attendance" ? "text-amber-100" : "text-slate-400"}`}>Day & Work Wise</div>
            </div>
          </button>

          
          <button type="button" onClick={() => setActiveCategory("labour_records")} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${activeCategory === "labour_records" ? "bg-cyan-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}`}>
            <div className={`p-2 rounded-lg ${activeCategory === "labour_records" ? "bg-white/20" : "bg-cyan-100 text-cyan-700"}`}><Wallet className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">7. Labour Records</div>
              <div className={`text-xs ${activeCategory === "labour_records" ? "text-cyan-100" : "text-slate-400"}`}>Salary & Payments</div>
            </div>
          </button>
          <button type="button" onClick={() => setActiveCategory("supervisor")} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${activeCategory === "supervisor" ? "bg-indigo-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}`}>
            <div className={`p-2 rounded-lg ${activeCategory === "supervisor" ? "bg-white/20" : "bg-indigo-100 text-indigo-700"}`}><HardHat className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">8. Supervisor Cost</div>
              <div className={`text-xs ${activeCategory === "supervisor" ? "text-indigo-100" : "text-slate-400"}`}>Site Supervisor Expenses</div>
            </div>
          </button>

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
              {activeCategory === "investors" && (
                <CategoryPinGate categoryName="Investor Category" categoryNumber={1}>
                  <InvestorTab locationId={Number(locationId)} />
                </CategoryPinGate>
              )}
              {activeCategory === "investments" && (
                <CategoryPinGate categoryName="Investment Category" categoryNumber={2}>
                  <InvestmentTab locationId={Number(locationId)} />
                </CategoryPinGate>
              )}
              {activeCategory === "material_purchase" && <MaterialPurchaseTab locationId={Number(locationId)} />}
              {activeCategory === "material_supply" && <MaterialSupplyTab locationId={Number(locationId)} />}
              {activeCategory === "site_supply" && <SiteSupplyTab locationId={Number(locationId)} />}
              {activeCategory === "labour_attendance" && <LabourAttendanceTab locationId={Number(locationId)} />}
              {activeCategory === "labour_records" && <LabourRecordsTab locationId={Number(locationId)} />}
              {activeCategory === "supervisor" && <SupervisorCostTab locationId={Number(locationId)} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Location"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
            <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
            <div className="text-xs">
              <p className="font-bold">Are you sure you want to delete this location?</p>
              <p className="text-rose-600 mt-0.5">Location: <span className="font-bold">{locationName}</span></p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            This will remove this location from your active sites list. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDeleteLocation}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              {deleting ? "Deleting..." : "Yes, Delete Location"}
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
