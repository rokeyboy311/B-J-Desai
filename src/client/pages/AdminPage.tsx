import React, { useState, useEffect, useMemo } from "react";
import { 
  ShieldCheck, Plus, ArrowRight, Building2, CheckCircle2, Wallet, ShoppingCart,
  Search, Eye, ArrowDownLeft, ArrowUpRight, FileText, Trash2, Edit, Calendar, RefreshCw
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { useLiveSync, triggerGlobalSync, triggerSync } from "../hooks/useLiveSync";
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
  const { showToast, confirmAction } = useToast();
  const [adminSummary, setAdminSummary] = useState<AdminCapitalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [investors, setInvestors] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals State
  const [isAddInvestorOpen, setIsAddInvestorOpen] = useState(false);
  const [isAllocationOpen, setIsAllocationOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isUpadOpen, setIsUpadOpen] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState<any | null>(null);
  const [isPassbookOpen, setIsPassbookOpen] = useState(false);

  // Forms
  const [newInvestorForm, setNewInvestorForm] = useState({
    name: "",
    mobile: "",
    email: "",
    address: "",
    notes: "",
    initialCapital: "",
    initialDate: new Date().toISOString().split("T")[0],
    paymentMethod: "Bank Transfer",
    referenceNumber: ""
  });

  const [depositForm, setDepositForm] = useState({
    investorId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    notes: "Capital Contribution"
  });

  const [upadForm, setUpadForm] = useState({
    investorId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    notes: "Capital Withdrawal / Upad"
  });

  const [allocationForm, setAllocationForm] = useState({
    investorId: "",
    locationId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
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
      if (Array.isArray(invRes)) {
        setInvestors(invRes);
        // Refresh selected investor if passbook modal is open
        if (selectedInvestor) {
          const updated = invRes.find((i: any) => i.id === selectedInvestor.id);
          if (updated) setSelectedInvestor(updated);
        }
      }
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
    if (!newInvestorForm.name.trim()) {
      showToast("Please enter investor name", "error");
      return;
    }

    const initAmt = parseFloat(newInvestorForm.initialCapital);

    try {
      const inv = await apiFetch("/investments/global-investors", {
        method: "POST",
        body: JSON.stringify({ 
          name: newInvestorForm.name.trim(),
          mobile: newInvestorForm.mobile.trim() || undefined,
          email: newInvestorForm.email.trim() || undefined,
          address: newInvestorForm.address.trim() || undefined,
          notes: newInvestorForm.notes.trim() || undefined,
          initialContribution: !isNaN(initAmt) && initAmt > 0 ? initAmt : undefined,
          initialDate: newInvestorForm.initialDate,
          paymentMethod: newInvestorForm.paymentMethod,
          referenceNumber: newInvestorForm.referenceNumber.trim() || undefined
        })
      });

      showToast(`Investor "${newInvestorForm.name.trim()}" added successfully!`, "success");
      setIsAddInvestorOpen(false);
      setNewInvestorForm({
        name: "",
        mobile: "",
        email: "",
        address: "",
        notes: "",
        initialCapital: "",
        initialDate: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        referenceNumber: ""
      });
      triggerGlobalSync();
      triggerSync("global_investors");
      await loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to add investor", "error");
    }
  };

  const handleDepositCapital = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(depositForm.amount);
    if (!depositForm.investorId || isNaN(amount) || amount <= 0) {
      showToast("Please enter valid amount and select investor", "error");
      return;
    }

    try {
      await apiFetch("/investments/global-transactions", {
        method: "POST",
        body: JSON.stringify({
          investorId: parseInt(depositForm.investorId, 10),
          type: "CONTRIBUTION",
          amount: amount,
          date: depositForm.date,
          paymentMethod: depositForm.paymentMethod,
          referenceNumber: depositForm.referenceNumber || null,
          description: depositForm.notes || "Capital Contribution"
        })
      });

      showToast(`₹${amount.toLocaleString("en-IN")} deposited successfully!`, "success");
      setIsDepositOpen(false);
      setDepositForm({
        investorId: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        referenceNumber: "",
        notes: "Capital Contribution"
      });
      triggerGlobalSync();
      triggerSync("global_investors");
      await loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to record deposit", "error");
    }
  };

  const handleUpadWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(upadForm.amount);
    if (!upadForm.investorId || isNaN(amount) || amount <= 0) {
      showToast("Please enter valid amount and select investor", "error");
      return;
    }

    try {
      await apiFetch("/investments/global-transactions", {
        method: "POST",
        body: JSON.stringify({
          investorId: parseInt(upadForm.investorId, 10),
          type: "UPAD",
          amount: amount,
          date: upadForm.date,
          paymentMethod: upadForm.paymentMethod,
          referenceNumber: upadForm.referenceNumber || null,
          description: upadForm.notes || "Capital Withdrawal / Upad"
        })
      });

      showToast(`₹${amount.toLocaleString("en-IN")} withdrawal recorded successfully!`, "success");
      setIsUpadOpen(false);
      setUpadForm({
        investorId: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        referenceNumber: "",
        notes: "Capital Withdrawal / Upad"
      });
      triggerGlobalSync();
      triggerSync("global_investors");
      await loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to record withdrawal", "error");
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
          paymentMethod: allocationForm.paymentMethod || "Bank Transfer",
          referenceNumber: allocationForm.referenceNumber || null,
          notes: allocationForm.notes || null
        })
      });

      showToast(`₹${amount.toLocaleString("en-IN")} allocated to location successfully!`, "success");
      setIsAllocationOpen(false);
      setAllocationForm({
        investorId: "",
        locationId: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        referenceNumber: "",
        notes: ""
      });
      triggerGlobalSync();
      triggerSync("global_investors");
      triggerSync("location_allocations");
      await loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to allocate capital", "error");
    }
  };

  const handleDeleteInvestor = (invId: number, name: string) => {
    confirmAction(
      `Are you sure you want to delete investor "${name}"?`,
      async () => {
        try {
          await apiFetch(`/investments/global-investors/${invId}`, { method: "DELETE" });
          showToast(`Investor "${name}" deleted successfully`, "success");
          if (selectedInvestor?.id === invId) {
            setIsPassbookOpen(false);
            setSelectedInvestor(null);
          }
          triggerGlobalSync();
          triggerSync("global_investors");
          await loadData(true);
        } catch (err: any) {
          showToast(err.message || "Failed to delete investor", "error");
        }
      }
    );
  };

  // Filtered Investors list
  const filteredInvestors = useMemo(() => {
    return investors.filter(inv => {
      const q = searchTerm.toLowerCase().trim();
      if (!q) return true;
      return (
        (inv.name && inv.name.toLowerCase().includes(q)) ||
        (inv.mobile && inv.mobile.includes(q)) ||
        (inv.email && inv.email.toLowerCase().includes(q))
      );
    });
  }, [investors, searchTerm]);

  // Metrics calculation
  const totalAdminCap = adminSummary?.totalContributed || 0;
  const totalAllocated = adminSummary?.totalAllocated || 0;
  const totalPurchasesCost = adminSummary?.totalPurchases || 0;
  const remainingAdminCap = adminSummary?.availableAdminCapital ?? (totalAdminCap - totalAllocated - totalPurchasesCost);

  return (
    <CategoryPinGate categoryName="Admin Control & Capital" categoryNumber={1}>
      <div className="space-y-6 pb-20">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Admin</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Manage investors, central capital allocation and material purchase costs</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsAddInvestorOpen(true)}
              className="px-4 py-2.5 bg-[#1E88E5] hover:bg-blue-600 active:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Investor</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDepositForm(prev => ({ ...prev, investorId: investors[0]?.id?.toString() || "" }));
                setIsDepositOpen(true);
              }}
              disabled={investors.length === 0}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>+ Add Capital Deposit</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAllocationForm(prev => ({ ...prev, investorId: investors[0]?.id?.toString() || "", locationId: locations[0]?.id?.toString() || "" }));
                setIsAllocationOpen(true);
              }}
              disabled={investors.length === 0 || locations.length === 0}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <ArrowRight className="w-4 h-4" />
              <span>Transfer to Project</span>
            </button>
          </div>
        </div>

        {/* Top 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
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
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Allocated Capital</span>
              <span className="text-xl font-black text-slate-900 tabular-nums">
                ₹{totalAllocated.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-purple-600 text-white rounded-xl">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Material Purchase Cost</span>
              <span className="text-xl font-black text-purple-900 tabular-nums">
                ₹{totalPurchasesCost.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-[#F59E0B] text-white rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Remaining Capital</span>
              <span className="text-xl font-black text-slate-900 tabular-nums">
                ₹{remainingAdminCap.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

        </div>

        {/* Investors Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Investors & Capital Records</h2>
              <p className="text-[11px] text-slate-500">Central investor master, total contributions and location allocations</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search investor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-44 sm:w-56"
                />
              </div>
              <span className="text-xs font-semibold text-slate-500 shrink-0">{filteredInvestors.length} Investors</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="p-3.5">Investor</th>
                  <th className="p-3.5 text-right">Total Capital</th>
                  <th className="p-3.5 text-right">Allocated</th>
                  <th className="p-3.5 text-right">Upad / Returned</th>
                  <th className="p-3.5 text-right">Remaining Balance</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvestors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      {searchTerm ? "No investors matching search query." : "No investors registered yet. Click \"+ Add Investor\" above to register one."}
                    </td>
                  </tr>
                ) : (
                  filteredInvestors.map((inv) => {
                    const total = Number(inv.totalCapital ?? inv.totalContributed ?? 0);
                    const allocated = Number(inv.totalAllocated ?? 0);
                    const upad = Number(inv.totalUpad ?? inv.totalWithdrawn ?? 0);
                    const remaining = Number(inv.availableBalance ?? inv.availableCapital ?? (total - allocated - upad));

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvestor(inv);
                              setIsPassbookOpen(true);
                            }}
                            className="text-left group cursor-pointer"
                          >
                            <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                              <span>{inv.name}</span>
                              <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                            </div>
                            {inv.mobile && (
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">{inv.mobile}</div>
                            )}
                          </button>
                        </td>
                        <td className="p-3.5 text-right font-bold text-slate-800 tabular-nums">
                          ₹{total.toLocaleString("en-IN")}
                        </td>
                        <td className="p-3.5 text-right font-semibold text-blue-700 tabular-nums">
                          ₹{allocated.toLocaleString("en-IN")}
                        </td>
                        <td className="p-3.5 text-right font-semibold text-amber-700 tabular-nums">
                          ₹{upad.toLocaleString("en-IN")}
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
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedInvestor(inv);
                                setIsPassbookOpen(true);
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title="View Passbook & Records"
                            >
                              <FileText className="w-3 h-3 text-slate-600" />
                              <span>Records</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setDepositForm({
                                  investorId: inv.id.toString(),
                                  amount: "",
                                  date: new Date().toISOString().split("T")[0],
                                  paymentMethod: "Bank Transfer",
                                  referenceNumber: "",
                                  notes: "Capital Contribution"
                                });
                                setIsDepositOpen(true);
                              }}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title="Add Capital Contribution"
                            >
                              <Plus className="w-3 h-3 text-emerald-600" />
                              <span>Deposit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAllocationForm(prev => ({
                                  ...prev,
                                  investorId: inv.id.toString(),
                                  locationId: locations[0]?.id?.toString() || ""
                                }));
                                setIsAllocationOpen(true);
                              }}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title="Transfer Capital to Location"
                            >
                              <ArrowRight className="w-3 h-3 text-blue-600" />
                              <span>Transfer</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteInvestor(inv.id, inv.name)}
                              className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="Delete Investor"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Capital Allocation Flow Section */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Capital Allocation & Outflows</h2>
            <p className="text-[11px] text-slate-500">Summary of Admin Capital, Allocated Investor Capital, Material Purchase Costs, and Available Balance</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total Admin Capital</span>
              <span className="text-base font-black text-slate-900 mt-1 block tabular-nums">
                ₹{totalAdminCap.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Allocated to Locations</span>
              <span className="text-base font-black text-blue-700 mt-1 block tabular-nums">
                ₹{totalAllocated.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Material Purchase Cost</span>
              <span className="text-base font-black text-purple-700 mt-1 block tabular-nums">
                ₹{totalPurchasesCost.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Available Balance</span>
                <span className="text-base font-black text-emerald-700 mt-1 block tabular-nums">
                  ₹{remainingAdminCap.toLocaleString("en-IN")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAllocationForm(prev => ({ ...prev, investorId: investors[0]?.id?.toString() || "", locationId: locations[0]?.id?.toString() || "" }));
                  setIsAllocationOpen(true);
                }}
                disabled={investors.length === 0 || locations.length === 0}
                className="mt-2 text-xs font-bold text-blue-600 hover:underline text-left cursor-pointer disabled:opacity-50"
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
          title="+ Add New Investor (ઇન્વેસ્ટર ઉમેરો)"
        >
          <form onSubmit={handleAddInvestor} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Investor Name (ઇન્વેસ્ટરનું નામ) *</label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Patel"
                value={newInvestorForm.name}
                onChange={(e) => setNewInvestorForm({ ...newInvestorForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mobile No</label>
                <input
                  type="text"
                  placeholder="9876543210"
                  value={newInvestorForm.mobile}
                  onChange={(e) => setNewInvestorForm({ ...newInvestorForm, mobile: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email</label>
                <input
                  type="email"
                  placeholder="investor@example.com"
                  value={newInvestorForm.email}
                  onChange={(e) => setNewInvestorForm({ ...newInvestorForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl space-y-3">
              <span className="text-xs font-bold text-blue-900 block">Initial Capital Deposit (શરૂઆતની મૂડી જમા)</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Initial Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="500000"
                    value={newInvestorForm.initialCapital}
                    onChange={(e) => setNewInvestorForm({ ...newInvestorForm, initialCapital: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date</label>
                  <input
                    type="date"
                    value={newInvestorForm.initialDate}
                    onChange={(e) => setNewInvestorForm({ ...newInvestorForm, initialDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Method</label>
                  <select
                    value={newInvestorForm.paymentMethod}
                    onChange={(e) => setNewInvestorForm({ ...newInvestorForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Bank Transfer">Bank Transfer / NEFT / RTGS</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / GPay</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ref / Cheque No</label>
                  <input
                    type="text"
                    placeholder="Ref # (optional)"
                    value={newInvestorForm.referenceNumber}
                    onChange={(e) => setNewInvestorForm({ ...newInvestorForm, referenceNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
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
                className="px-4 py-2 bg-[#1E88E5] hover:bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
              >
                Save Investor
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Add Capital Deposit */}
        <Modal
          isOpen={isDepositOpen}
          onClose={() => setIsDepositOpen(false)}
          title="+ Add Capital Deposit (મૂડી જમા કરો)"
        >
          <form onSubmit={handleDepositCapital} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Investor *</label>
              <select
                required
                value={depositForm.investorId}
                onChange={(e) => setDepositForm({ ...depositForm, investorId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              >
                <option value="">-- Choose Investor --</option>
                {investors.map((inv) => (
                  <option key={inv.id} value={inv.id}>{inv.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Deposit Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="500000"
                  value={depositForm.amount}
                  onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={depositForm.date}
                  onChange={(e) => setDepositForm({ ...depositForm, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Method</label>
                <select
                  value={depositForm.paymentMethod}
                  onChange={(e) => setDepositForm({ ...depositForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Bank Transfer">Bank Transfer / NEFT / RTGS</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI / GPay</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Reference / Cheque No</label>
                <input
                  type="text"
                  placeholder="Ref #"
                  value={depositForm.referenceNumber}
                  onChange={(e) => setDepositForm({ ...depositForm, referenceNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes / Description</label>
              <input
                type="text"
                placeholder="e.g. Additional investment round"
                value={depositForm.notes}
                onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDepositOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
              >
                Save Deposit
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Record Upad / Withdrawal */}
        <Modal
          isOpen={isUpadOpen}
          onClose={() => setIsUpadOpen(false)}
          title="- Record Upad / Withdrawal (ઉપાડ / પરત નોંધો)"
        >
          <form onSubmit={handleUpadWithdrawal} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Investor *</label>
              <select
                required
                value={upadForm.investorId}
                onChange={(e) => setUpadForm({ ...upadForm, investorId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
              >
                <option value="">-- Choose Investor --</option>
                {investors.map((inv) => (
                  <option key={inv.id} value={inv.id}>{inv.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Upad Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="50000"
                  value={upadForm.amount}
                  onChange={(e) => setUpadForm({ ...upadForm, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={upadForm.date}
                  onChange={(e) => setUpadForm({ ...upadForm, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Method</label>
                <select
                  value={upadForm.paymentMethod}
                  onChange={(e) => setUpadForm({ ...upadForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Bank Transfer">Bank Transfer / NEFT / RTGS</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI / GPay</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Reference No</label>
                <input
                  type="text"
                  placeholder="Ref #"
                  value={upadForm.referenceNumber}
                  onChange={(e) => setUpadForm({ ...upadForm, referenceNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes</label>
              <input
                type="text"
                placeholder="e.g. Personal withdrawal"
                value={upadForm.notes}
                onChange={(e) => setUpadForm({ ...upadForm, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsUpadOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
              >
                Record Upad
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Transfer Capital to Location */}
        <Modal
          isOpen={isAllocationOpen}
          onClose={() => setIsAllocationOpen(false)}
          title="Transfer Capital to Location (પ્રોજેક્ટમાં મૂડી ટ્રાન્સફર કરો)"
        >
          <form onSubmit={handleAllocate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Investor *</label>
              <select
                required
                value={allocationForm.investorId}
                onChange={(e) => setAllocationForm({ ...allocationForm, investorId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              >
                <option value="">-- Choose Investor --</option>
                {investors.map((inv) => {
                  const avail = Number(inv.availableBalance ?? inv.availableCapital ?? 0);
                  return (
                    <option key={inv.id} value={inv.id}>
                      {inv.name} (Avail: ₹{avail.toLocaleString("en-IN")})
                    </option>
                  );
                })}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={allocationForm.date}
                  onChange={(e) => setAllocationForm({ ...allocationForm, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Method</label>
                <select
                  value={allocationForm.paymentMethod}
                  onChange={(e) => setAllocationForm({ ...allocationForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Bank Transfer">Bank Transfer / NEFT / RTGS</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI / GPay</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ref / Notes</label>
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={allocationForm.notes}
                  onChange={(e) => setAllocationForm({ ...allocationForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
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
                className="px-4 py-2 bg-[#1E88E5] hover:bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
              >
                Confirm Transfer
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Investor Passbook & Statement */}
        <Modal
          isOpen={isPassbookOpen && selectedInvestor !== null}
          onClose={() => {
            setIsPassbookOpen(false);
            setSelectedInvestor(null);
          }}
          title={`Investor Records & Passbook: ${selectedInvestor?.name || ""}`}
          maxWidth="max-w-4xl"
        >
          {selectedInvestor && (
            <div className="space-y-6">
              {/* Summary Header of this Investor */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Capital (જમા)</span>
                  <span className="text-base font-black text-slate-900 tabular-nums">
                    ₹{Number(selectedInvestor.totalCapital ?? selectedInvestor.totalContributed ?? 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Allocated (ટ્રાન્સફર)</span>
                  <span className="text-base font-black text-blue-700 tabular-nums">
                    ₹{Number(selectedInvestor.totalAllocated ?? 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Upad (ઉપાડ)</span>
                  <span className="text-base font-black text-amber-700 tabular-nums">
                    ₹{Number(selectedInvestor.totalUpad ?? selectedInvestor.totalWithdrawn ?? 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining (બાકી)</span>
                  <span className="text-base font-black text-emerald-700 tabular-nums">
                    ₹{Number(selectedInvestor.availableBalance ?? selectedInvestor.availableCapital ?? 0).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Quick Actions for this Investor */}
              <div className="flex items-center gap-2 flex-wrap justify-between border-b border-slate-200 pb-3">
                <span className="text-xs font-bold text-slate-700">Transaction History & Statements</span>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDepositForm({
                        investorId: selectedInvestor.id.toString(),
                        amount: "",
                        date: new Date().toISOString().split("T")[0],
                        paymentMethod: "Bank Transfer",
                        referenceNumber: "",
                        notes: "Capital Contribution"
                      });
                      setIsDepositOpen(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Deposit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUpadForm({
                        investorId: selectedInvestor.id.toString(),
                        amount: "",
                        date: new Date().toISOString().split("T")[0],
                        paymentMethod: "Bank Transfer",
                        referenceNumber: "",
                        notes: "Capital Withdrawal / Upad"
                      });
                      setIsUpadOpen(true);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>- Record Upad</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAllocationForm(prev => ({
                        ...prev,
                        investorId: selectedInvestor.id.toString(),
                        locationId: locations[0]?.id?.toString() || ""
                      }));
                      setIsAllocationOpen(true);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Transfer to Project</span>
                  </button>
                </div>
              </div>

              {/* Transactions Ledger */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Deposits & Upad Ledger (જમા / ઉપાડ વિગત)</h3>
                
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5 text-right">Amount</th>
                        <th className="p-2.5">Payment Method</th>
                        <th className="p-2.5">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(!selectedInvestor.transactions || selectedInvestor.transactions.length === 0) ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400">No deposits or withdrawals recorded yet.</td>
                        </tr>
                      ) : (
                        selectedInvestor.transactions.map((t: any) => {
                          const isContribution = t.type === 'CONTRIBUTION' || t.type === 'CAPITAL' || t.type === 'INVESTMENT';
                          return (
                            <tr key={t.id} className="hover:bg-slate-50/50">
                              <td className="p-2.5 font-medium text-slate-700">{t.date}</td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isContribution ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {isContribution ? '+ DEPOSIT' : '- UPAD'}
                                </span>
                              </td>
                              <td className={`p-2.5 text-right font-bold tabular-nums ${
                                isContribution ? 'text-emerald-700' : 'text-amber-700'
                              }`}>
                                ₹{parseFloat(t.amount || 0).toLocaleString("en-IN")}
                              </td>
                              <td className="p-2.5 text-slate-600">{t.paymentMethod || 'Bank Transfer'}</td>
                              <td className="p-2.5 text-slate-500">{t.description || t.notes || '-'}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pt-2">Project Site Allocations (સાઇટ ટ્રાન્સફર વિગત)</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Project Location</th>
                        <th className="p-2.5 text-right">Allocated Amount</th>
                        <th className="p-2.5">Payment Method</th>
                        <th className="p-2.5">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(!selectedInvestor.allocations || selectedInvestor.allocations.length === 0) ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400">No project allocations recorded yet.</td>
                        </tr>
                      ) : (
                        selectedInvestor.allocations.map((a: any) => (
                          <tr key={a.id} className="hover:bg-slate-50/50">
                            <td className="p-2.5 font-medium text-slate-700">{a.date}</td>
                            <td className="p-2.5 font-bold text-blue-900">{a.locationName || `Location #${a.locationId}`}</td>
                            <td className="p-2.5 text-right font-bold text-blue-700 tabular-nums">
                              ₹{parseFloat(a.amount || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="p-2.5 text-slate-600">{a.paymentMethod || 'Bank Transfer'}</td>
                            <td className="p-2.5 text-slate-500">{a.notes || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </Modal>

      </div>
    </CategoryPinGate>
  );
}
