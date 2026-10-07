import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Building2, MapPin, ExternalLink } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { useLiveSync, triggerGlobalSync } from "../hooks/useLiveSync";
import { Modal } from "../components/ui/Modal";

export default function LocationsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [locations, setLocations] = useState<any[]>(() => {
    try {
      const saved = sessionStorage.getItem('bd_erp_locations_breakdown_cache');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const saved = sessionStorage.getItem('bd_erp_locations_breakdown_cache');
      return !(saved && JSON.parse(saved).length > 0);
    } catch {
      return true;
    }
  });

  // Add Location Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationAddress, setNewLocationAddress] = useState("");

  const loadLocations = async (isBackground = false) => {
    try {
      if (!isBackground && locations.length === 0) setLoading(true);
      const res = await apiFetch("/reports/locations-breakdown").catch(() => []);
      if (Array.isArray(res)) {
        setLocations(res);
        try {
          sessionStorage.setItem('bd_erp_locations_breakdown_cache', JSON.stringify(res));
        } catch {}
      }
    } catch (err) {
      console.error("Failed to load locations", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations(false);
  }, []);

  useLiveSync(() => {
    loadLocations(true);
  }, 3500);

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName.trim()) {
      showToast("Please enter location name", "error");
      return;
    }

    try {
      await apiFetch("/locations", {
        method: "POST",
        body: JSON.stringify({
          name: newLocationName.trim(),
          address: newLocationAddress.trim() || null
        })
      });

      showToast(`Location "${newLocationName}" created successfully!`, "success");
      setIsAddOpen(false);
      setNewLocationName("");
      setNewLocationAddress("");
      triggerGlobalSync();
      loadLocations(true);
    } catch (err: any) {
      showToast(err.message || "Failed to create location", "error");
    }
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Page Header matching 03_locations.svg */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Locations</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Manage all project locations</p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-2.5 bg-[#1E88E5] hover:bg-blue-600 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Location</span>
        </button>
      </div>

      {/* Grid of Location Cards matching 03_locations.svg */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {locations.length === 0 ? (
          <div className="col-span-2 bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-400 text-xs">
            No locations created yet. Click <b>+ Add Location</b> above to create a location.
          </div>
        ) : (
          locations.map((loc) => {
            const invCap = loc.investorCapital || 0;
            const remainingInvCap = loc.remainingInvestmentCapital ?? loc.cat2InvestmentCapital?.remainingCapital ?? loc.billInvestment ?? 0;
            const stockVal = loc.stockValuation || 0;
            const siteSupply = loc.siteSupplies || 0;
            const labour = loc.labourMetrics?.grossSalary || loc.labourTotal || 0;
            const contractor = loc.contractorCosts?.recorded || loc.contractorTotal || 0;

            return (
              <div 
                key={loc.id}
                onClick={() => navigate(`/locations/${loc.id}`)}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-blue-300 hover:shadow-md transition-all duration-200 p-6 space-y-4 cursor-pointer"
              >
                {/* Location Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">{loc.name}</h2>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      Active location &bull; live capital and operating summary
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400 hover:text-blue-600 transition-colors" />
                </div>

                {/* 6 Key Metrics Grid matching SVG */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Investor Capital</span>
                    <span className="text-sm font-bold text-slate-800 tabular-nums">
                      ₹{invCap.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Remaining Investment Capital</span>
                    <span className={`text-sm font-bold tabular-nums ${remainingInvCap < 0 ? "text-rose-600" : "text-slate-800"}`}>
                      ₹{remainingInvCap.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Stock</span>
                    <span className="text-sm font-bold text-slate-800 tabular-nums">
                      ₹{stockVal.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Site Supply</span>
                    <span className="text-sm font-bold text-slate-800 tabular-nums">
                      ₹{siteSupply.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Labour</span>
                    <span className="text-sm font-bold text-slate-800 tabular-nums">
                      ₹{labour.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Contractor</span>
                    <span className="text-sm font-bold text-slate-800 tabular-nums">
                      ₹{contractor.toLocaleString("en-IN")}
                    </span>
                  </div>

                </div>

              </div>
            );
          })
        )}
      </div>

      {/* Modal: Add Location */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="+ Add New Project Location"
      >
        <form onSubmit={handleAddLocation} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Location Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Ahmedabad, Surat, Rajkot"
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Site Address / Description</label>
            <input
              type="text"
              placeholder="e.g. Near Science City, Ahmedabad"
              value={newLocationAddress}
              onChange={(e) => setNewLocationAddress(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#1E88E5] text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Create Location
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
