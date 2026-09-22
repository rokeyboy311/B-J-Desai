import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Users, ArrowLeft, Building2, Plus, ArrowUpRight, TrendingUp, ArrowDownLeft } from "lucide-react";
import { motion } from "motion/react";
import InvestorTab from "../components/categories/InvestorTab";
import CategoryPinGate from "../components/ui/CategoryPinGate";
import { apiFetch } from "../lib/api";

export default function CentralInvestorPoolPage() {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const [locationName, setLocationName] = useState<string>("Loading...");

  useEffect(() => {
    const fetchLocation = async () => {
      if (!locationId) return;
      try {
        const res = await apiFetch(`/locations/${locationId}`);
        if (res && res.name) {
          setLocationName(res.name);
        } else {
          setLocationName(`Location #${locationId}`);
        }
      } catch (err) {
        console.error("Failed to load location details", err);
        setLocationName(`Location #${locationId}`);
      }
    };
    fetchLocation();
  }, [locationId]);

  const parsedLocId = locationId ? parseInt(locationId, 10) : undefined;

  return (
    <CategoryPinGate categoryName="Central Investor Pool" categoryNumber={1}>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto space-y-6 pb-20"
      >
        {/* Top Header Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-4">
            <button 
              type="button"
              onClick={() => navigate(`/locations/${locationId}`)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 cursor-pointer"
              title="Back to Location Details"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  {locationName}
                </span>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Users className="w-6 h-6 text-emerald-600" />
                  Central Investor Pool (સેન્ટ્રલ ઇન્વેસ્ટર પૂલ)
                </h1>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Central Capital allocations from Main Investors, site-specific investor accounts & passbook ledger
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/locations/${locationId}`)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              ← Back to Project Dashboard
            </button>
          </div>
        </div>

        {/* Embedded Location-Specific Investor Tab */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4 sm:p-6 lg:p-8 min-h-[600px]">
          {parsedLocId ? (
            <InvestorTab locationId={parsedLocId} />
          ) : (
            <div className="text-center py-10 text-slate-400 font-bold">Invalid Location Selected</div>
          )}
        </div>
      </motion.div>
    </CategoryPinGate>
  );
}
