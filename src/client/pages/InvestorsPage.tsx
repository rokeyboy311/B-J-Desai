import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Users, ArrowLeft, Building2, Shield, Plus, FileSpreadsheet } from "lucide-react";
import { motion } from "motion/react";
import InvestorTab from "../components/categories/InvestorTab";
import CategoryPinGate from "../components/ui/CategoryPinGate";
import { apiFetch } from "../lib/api";

export default function InvestorsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const initialLocParam = searchParams.get("locationId");
  const [selectedLocationId, setSelectedLocationId] = useState<string>(initialLocParam || "ALL");

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await apiFetch("/locations");
        if (Array.isArray(res)) {
          setLocations(res);
        }
      } catch (err) {
        console.error("Failed to fetch locations", err);
      }
    };
    fetchLocations();
  }, []);

  const handleLocationChange = (newLoc: string) => {
    setSelectedLocationId(newLoc);
    if (newLoc === "ALL") {
      searchParams.delete("locationId");
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ locationId: newLoc }, { replace: true });
    }
  };

  const activeLocationId = selectedLocationId === "ALL" ? undefined : parseInt(selectedLocationId, 10);

  return (
    <CategoryPinGate categoryName="Investor Pool & Accounts" categoryNumber={1}>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto space-y-6 pb-20"
      >
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-4">
            <button 
              type="button"
              onClick={() => navigate("/")}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 cursor-pointer"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Global Category 1
                </span>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Users className="w-6 h-6 text-emerald-600" />
                  Investor Pool & Accounts (ઇન્વેસ્ટર મૂડી પૂલ)
                </h1>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Centralized Investor Capital Management, Upad Withdrawals, Project Allocations & Live Passbooks
              </p>
            </div>
          </div>

          {/* Location Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 hidden sm:inline flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              Filter Location:
            </span>
            <select
              value={selectedLocationId}
              onChange={(e) => handleLocationChange(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="ALL">All Project Locations (Global Pool)</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Embedded Global Investor Tab */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4 sm:p-6 lg:p-8 min-h-[600px]">
          <InvestorTab locationId={activeLocationId} />
        </div>
      </motion.div>
    </CategoryPinGate>
  );
}
