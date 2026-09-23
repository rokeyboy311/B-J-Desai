import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, Plus, ArrowRight, Building2, CheckCircle2, Wallet
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { useLiveSync, triggerGlobalSync } from "../hooks/useLiveSync";
import CategoryPinGate from "../components/ui/CategoryPinGate";
import { Modal } from "../components/ui/Modal";

interface AdminCapitalSummary {
  totalContributed: number;
  totalWithdrawn: number;
  totalAllocated: number;
  totalPurchases: number;
  availableAdminCapital: number;
}

export default function AdminPage() {
  const { showToast } = useToast();
  const [adminSummary, setAdminSummary] = useState<AdminCapitalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [investors, setInvestors] = useState<any[]>([]);

  // Modal State
  const [isAddInvestorOpen, setIsAddInvestorOpen] = useState(false);
  const [isAllocationOpen, setIsAllocationOpen] = useState(false);

  // Forms
  const [newInvestorName, setNewInvestorName] = useState("");
  const [initialCapital, setInitialCapital] = useState("");

  const [allocationForm, setAllocationForm] = useState({
    investorId: "",
    locationId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    notes: ""
  });

  const loadData = async (isBackground = false) => {
    try {
      if (!isBackground && !adminSummary) setLoading(true);
      const [summaryRes, locRes, invRes] = await Promise.all([
        apiFetch("/investments/admin-capital-summary").catch(() => null),
        apiFetch("/locations").catch(() => []),
        apiFetch("/investments/global-investors").catch(() => [])
      ]);

      if (summaryRes) setAdminSummary(summaryRes);
      if (Array.isArray(locRes)) setLocations(locRes);
      if (Array.isArray(invRes)) setInvestors(invRes);
    } catch (err) {
      console.error("Failed to load admin data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  useLiveSync(() => {
    loadData(true);
  }, 3500);

  const handleAddInvestor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvestorName.trim()) {
      showToast("Please enter investor name", "error");
      return;
    }

    try {
      const inv = await apiFetch("/investments/global-investors", {
        method: "POST",
        body: JSON.stringify({ name: newInvestorName.trim() })
      });

      if (initialCapital && parseFloat(initialCapital) > 0) {
        await apiFetch("/investments/global-transactions", {
          method: "POST",
          body: JSON.stringify({
            investorId: inv.id,
            type: "CONTRIBUTION",
            amount: initialCapital,
            date: new Date().toISOString().split("T")[0],
            paymentMethod: "Bank Transfer",
            notes: "Initial Capital Contribution"
          })
        });
      }

      showToast(`Investor "${newInvestorName}" added successfully!`, "success");
      setIsAddInvestorOpen(false);
      setNewInvestorName("");
      setInitialCapital("");
      triggerGlobalSync();
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to add investor", "error");
    }
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(allocationForm.amount);
    if (!amount || amount <= 0) {
      showToast("Please enter valid allocation amount", "error");
      return;
    }
    if (!allocationForm.investorId || !allocationForm.locationId) {
      showToast("Please select investor and location", "error");
      return;
    }

    try {
      await apiFetch("/investments/location-allocations", {
        method: "POST",
        body: JSON.stringify({
          investorId: parseInt(allocationForm.investorId, 10),
          locationId: parseInt(allocationForm.locationId, 10),
          amount: amount.toString(),
          date: allocationForm.date,
          paymentMethod: "Bank Transfer",
          notes: allocationForm.notes
        })
      });

      showToast(`₹${amount.toLocaleString("en-IN")} allocated to location successfully!`, "success");
      setIsAllocationOpen(false);
      setAllocationForm({
        investorId: "",
        locationId: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        notes: ""
      });
      triggerGlobalSync();
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to allocate capital", "error");
    }
  };

  // Metrics calculation
  const totalAdminCap = adminSummary?.totalContributed || 0;
  const totalAllocated = adminSummary?.totalAllocated || 0;
  const remainingAdminCap = adminSummary?.availableAdminCapital || (totalAdminCap - totalAllocated);

  return (
    <CategoryPinGate categoryName="Admin Control & Capital" categoryNumber={1}>
      <div className="space-y-6 pb-20">
        
        {/* Page Header matching 02_admin.svg */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Admin</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Manage investors and central capital allocation</p>
          </div>

          <button
            type="button"
            onClick={() => setIsAddInvestorOpen(true)}
            className="px-4 py-2.5 bg-[#1E88E5] hover:bg-blue-600 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Investor</span>
          </button>
        </div>

        {/* Top 3 KPI Cards matching 02_admin.svg */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-[#0B1D3A] text-white rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Total Admin Capital</span>
              <span className="text-xl font-black text-slate-900 tabular-nums">
                ₹{totalAdminCap.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-[#10B981] text-white rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Allocated</span>
              <span className="text-xl font-black text-slate-900 tabular-nums">
                ₹{totalAllocated.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-[#F59E0B] text-white rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Remaining</span>
              <span className="text-xl font-black text-slate-900 tabular-nums">
                ₹{remainingAdminCap.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

        </div>

        {/* Investors Table matching 02_admin.svg */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Investors</h2>
              <p className="text-[11px] text-slate-500">Central investor master and capital pool</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">{investors.length} Investors</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="p-3.5">Investor</th>
                  <th className="p-3.5 text-right">Total Capital</th>
                  <th className="p-3.5 text-right">Allocated</th>
                  <th className="p-3.5 text-right">Remaining</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {investors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">No investors registered yet.</td>
                  </tr>
                ) : (
                  investors.map((inv) => {
                    const total = Number(inv.totalContributed || 0);
                    const allocated = Number(inv.totalAllocated || 0);
                    const remaining = Math.max(0, total - allocated);

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900">{inv.name}</td>
                        <td className="p-3.5 text-right font-bold text-slate-800 tabular-nums">
                          ₹{total.toLocaleString("en-IN")}
                        </td>
                        <td className="p-3.5 text-right font-semibold text-blue-700 tabular-nums">
                          ₹{allocated.toLocaleString("en-IN")}
                        </td>
                        <td className="p-3.5 text-right font-black text-emerald-700 tabular-nums">
                          ₹{remaining.toLocaleString("en-IN")}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold uppercase">
                            Active
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setAllocationForm(prev => ({ ...prev, investorId: inv.id.toString() }));
                              setIsAllocationOpen(true);
                            }}
                            className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                          >
                            Allocate Capital
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Capital Allocation Flow Section matching 02_admin.svg */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Capital Allocation</h2>
            <p className="text-[11px] text-slate-500">Transfer from Admin Capital to location-wise Investor Capital</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Admin Capital</span>
              <span className="text-base font-black text-slate-900 mt-1 block tabular-nums">
                ₹{totalAdminCap.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Investor Capital</span>
              <span className="text-base font-black text-blue-700 mt-1 block tabular-nums">
                ₹{totalAllocated.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Location</span>
              <span className="text-base font-extrabold text-slate-800 mt-1 block truncate">
                {locations[0]?.name || "Select Site"}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Allocated Amount</span>
                <span className="text-base font-black text-emerald-700 mt-1 block tabular-nums">
                  ₹{remainingAdminCap.toLocaleString("en-IN")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAllocationOpen(true)}
                className="mt-2 text-xs font-bold text-blue-600 hover:underline text-left cursor-pointer"
              >
                + New Transfer
              </button>
            </div>

          </div>
        </div>

        {/* Modal: Add Investor */}
        <Modal
          isOpen={isAddInvestorOpen}
          onClose={() => setIsAddInvestorOpen(false)}
          title="+ Add New Investor"
        >
          <form onSubmit={handleAddInvestor} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Investor Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Patel"
                value={newInvestorName}
                onChange={(e) => setNewInvestorName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Initial Capital Contribution (₹)</label>
              <input
                type="number"
                step="0.01"
                placeholder="500000"
                value={initialCapital}
                onChange={(e) => setInitialCapital(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddInvestorOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#1E88E5] text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Save Investor
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Transfer Capital to Location */}
        <Modal
          isOpen={isAllocationOpen}
          onClose={() => setIsAllocationOpen(false)}
          title="Transfer Capital to Location"
        >
          <form onSubmit={handleAllocate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Investor *</label>
              <select
                required
                value={allocationForm.investorId}
                onChange={(e) => setAllocationForm({ ...allocationForm, investorId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Choose Investor --</option>
                {investors.map((inv) => (
                  <option key={inv.id} value={inv.id}>{inv.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Location *</label>
              <select
                required
                value={allocationForm.locationId}
                onChange={(e) => setAllocationForm({ ...allocationForm, locationId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Choose Location --</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="200000"
                value={allocationForm.amount}
                onChange={(e) => setAllocationForm({ ...allocationForm, amount: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAllocationOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#1E88E5] text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Confirm Transfer
              </button>
            </div>
          </form>
        </Modal>

      </div>
    </CategoryPinGate>
  );
}
