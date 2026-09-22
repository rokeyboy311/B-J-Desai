import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ShieldCheck, Users, Banknote, ArrowDownLeft, ArrowUpRight, 
  Building2, Plus, Wallet, RefreshCw, AlertCircle, CheckCircle2,
  TrendingUp, ArrowRight, FileSpreadsheet, Lock
} from "lucide-react";
import { motion } from "motion/react";
import { apiFetch } from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { useLiveSync, triggerGlobalSync } from "../hooks/useLiveSync";
import InvestorTab from "../components/categories/InvestorTab";
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
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [adminSummary, setAdminSummary] = useState<AdminCapitalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [investors, setInvestors] = useState<any[]>([]);

  // Modals
  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);

  // Forms
  const [contributionForm, setContributionForm] = useState({
    investorId: "",
    newInvestorName: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    notes: ""
  });

  const [withdrawalForm, setWithdrawalForm] = useState({
    investorId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    notes: ""
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

  const handleAddContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(contributionForm.amount);
    if (!amount || amount <= 0) {
      showToast("Please enter a valid contribution amount", "error");
      return;
    }

    try {
      let invId = contributionForm.investorId;
      if (!invId && contributionForm.newInvestorName.trim()) {
        const newInv = await apiFetch("/investments/global-investors", {
          method: "POST",
          body: JSON.stringify({ name: contributionForm.newInvestorName.trim() })
        });
        invId = newInv.id;
      }

      if (!invId) {
        showToast("Please select or enter an investor name", "error");
        return;
      }

      await apiFetch("/investments/global-transactions", {
        method: "POST",
        body: JSON.stringify({
          investorId: parseInt(invId, 10),
          type: "CONTRIBUTION",
          amount: amount.toString(),
          date: contributionForm.date,
          paymentMethod: contributionForm.paymentMethod,
          referenceNumber: contributionForm.referenceNumber,
          notes: contributionForm.notes
        })
      });

      showToast(`Admin Capital Contribution of ₹${amount.toLocaleString("en-IN")} recorded successfully!`, "success");
      setIsContributionModalOpen(false);
      setContributionForm({
        investorId: "",
        newInvestorName: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        referenceNumber: "",
        notes: ""
      });
      triggerGlobalSync();
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to record contribution", "error");
    }
  };

  const handleAddWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(withdrawalForm.amount);
    if (!amount || amount <= 0) {
      showToast("Please enter a valid withdrawal amount", "error");
      return;
    }

    if (!withdrawalForm.investorId) {
      showToast("Please select an investor", "error");
      return;
    }

    if (adminSummary && amount > adminSummary.availableAdminCapital) {
      showToast(`Withdrawal amount exceeds Available Admin Capital (₹${adminSummary.availableAdminCapital.toLocaleString("en-IN")})`, "error");
      return;
    }

    try {
      await apiFetch("/investments/global-transactions", {
        method: "POST",
        body: JSON.stringify({
          investorId: parseInt(withdrawalForm.investorId, 10),
          type: "UPAD",
          amount: amount.toString(),
          date: withdrawalForm.date,
          paymentMethod: withdrawalForm.paymentMethod,
          referenceNumber: withdrawalForm.referenceNumber,
          notes: withdrawalForm.notes
        })
      });

      showToast(`Admin Capital Withdrawal of ₹${amount.toLocaleString("en-IN")} recorded successfully!`, "success");
      setIsWithdrawalModalOpen(false);
      setWithdrawalForm({
        investorId: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        referenceNumber: "",
        notes: ""
      });
      triggerGlobalSync();
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to record withdrawal", "error");
    }
  };

  const handleAddAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(allocationForm.amount);
    if (!amount || amount <= 0) {
      showToast("Please enter a valid allocation amount", "error");
      return;
    }

    if (!allocationForm.investorId) {
      showToast("Please select an investor", "error");
      return;
    }

    if (!allocationForm.locationId) {
      showToast("Please select a target location", "error");
      return;
    }

    if (adminSummary && amount > adminSummary.availableAdminCapital) {
      showToast(`Allocation amount exceeds Available Admin Capital (₹${adminSummary.availableAdminCapital.toLocaleString("en-IN")})`, "error");
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
          paymentMethod: allocationForm.paymentMethod,
          referenceNumber: allocationForm.referenceNumber,
          notes: allocationForm.notes
        })
      });

      showToast(`₹${amount.toLocaleString("en-IN")} allocated to location successfully!`, "success");
      setIsAllocationModalOpen(false);
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
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to allocate capital", "error");
    }
  };

  return (
    <CategoryPinGate categoryName="Admin Control & Capital" categoryNumber={1}>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto space-y-8 pb-20"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-tr from-indigo-700 to-blue-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Tier 1 Governance
                </span>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Admin & Capital Management
                </h1>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Central Enterprise Capital Flow, Global Investor Directory & Location Allocations
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsContributionModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Admin Inflow (ફાળો)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsWithdrawalModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Admin Upad (ઉપાડ)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAllocationModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <Building2 className="w-4 h-4" />
              <span>Allocate to Location</span>
            </button>
          </div>
        </div>

        {/* 3-Tier Capital Visual Architecture */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-900/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-3">
                <Wallet className="w-3.5 h-3.5" />
                <span>3-Tier Enterprise Capital Architecture</span>
              </div>
              <h2 className="text-3xl font-black tracking-tight text-white">
                Admin Capital Pool (Tier 1)
              </h2>
              <p className="text-sm text-slate-300 mt-1 max-w-xl">
                Source of enterprise truth: Capital contributed here directly funds enterprise Material Purchases and Tier 2 Location Allocations.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 min-w-[280px]">
              <span className="text-xs uppercase tracking-wider text-indigo-200 font-bold">
                Available Admin Capital (નેટ બેલેન્સ)
              </span>
              <div className="text-3xl font-black text-emerald-400 mt-1">
                ₹{adminSummary ? adminSummary.availableAdminCapital.toLocaleString("en-IN") : "0"}
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                Contributed - Withdrawn - Allocated - Purchases
              </p>
            </div>
          </div>

          {/* Metrics breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10 relative z-10">
            <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
              <span className="text-[11px] text-emerald-300 font-semibold uppercase">Total Contributed</span>
              <div className="text-lg font-black text-white mt-0.5">
                ₹{adminSummary ? adminSummary.totalContributed.toLocaleString("en-IN") : "0"}
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
              <span className="text-[11px] text-rose-300 font-semibold uppercase">Total Withdrawn</span>
              <div className="text-lg font-black text-white mt-0.5">
                ₹{adminSummary ? adminSummary.totalWithdrawn.toLocaleString("en-IN") : "0"}
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
              <span className="text-[11px] text-blue-300 font-semibold uppercase">Allocated to Locations</span>
              <div className="text-lg font-black text-white mt-0.5">
                ₹{adminSummary ? adminSummary.totalAllocated.toLocaleString("en-IN") : "0"}
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
              <span className="text-[11px] text-amber-300 font-semibold uppercase">Material Purchases Funded</span>
              <div className="text-lg font-black text-white mt-0.5">
                ₹{adminSummary ? adminSummary.totalPurchases.toLocaleString("en-IN") : "0"}
              </div>
            </div>
          </div>
        </div>

        {/* Global Investor Directory & Passbooks */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Global Investor Directory & Passbooks
              </h2>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {investors.length} Investors Registered
            </span>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-4 sm:p-6 lg:p-8">
            <InvestorTab />
          </div>
        </div>

        {/* MODAL: Record Admin Contribution */}
        <Modal
          isOpen={isContributionModalOpen}
          onClose={() => setIsContributionModalOpen(false)}
          title="Record Admin Capital Inflow / Contribution"
        >
          <form onSubmit={handleAddContribution} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Existing Investor</label>
              <select
                value={contributionForm.investorId}
                onChange={(e) => setContributionForm({ ...contributionForm, investorId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Choose Investor or Add New Below --</option>
                {investors.map((inv) => (
                  <option key={inv.id} value={inv.id}>{inv.name}</option>
                ))}
              </select>
            </div>

            {!contributionForm.investorId && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Or New Investor Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Patel"
                  value={contributionForm.newInvestorName}
                  onChange={(e) => setContributionForm({ ...contributionForm, newInvestorName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Contribution Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="500000"
                value={contributionForm.amount}
                onChange={(e) => setContributionForm({ ...contributionForm, amount: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={contributionForm.date}
                  onChange={(e) => setContributionForm({ ...contributionForm, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Method</label>
                <select
                  value={contributionForm.paymentMethod}
                  onChange={(e) => setContributionForm({ ...contributionForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Reference / Cheque No.</label>
              <input
                type="text"
                placeholder="UTR / Cheque number"
                value={contributionForm.referenceNumber}
                onChange={(e) => setContributionForm({ ...contributionForm, referenceNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes / Description</label>
              <input
                type="text"
                placeholder="Optional notes"
                value={contributionForm.notes}
                onChange={(e) => setContributionForm({ ...contributionForm, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsContributionModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer"
              >
                Record Contribution
              </button>
            </div>
          </form>
        </Modal>

        {/* MODAL: Record Admin Withdrawal */}
        <Modal
          isOpen={isWithdrawalModalOpen}
          onClose={() => setIsWithdrawalModalOpen(false)}
          title="Record Admin Capital Withdrawal (ઉપાડ)"
        >
          <form onSubmit={handleAddWithdrawal} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Investor *</label>
              <select
                required
                value={withdrawalForm.investorId}
                onChange={(e) => setWithdrawalForm({ ...withdrawalForm, investorId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Choose Investor --</option>
                {investors.map((inv) => (
                  <option key={inv.id} value={inv.id}>{inv.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Withdrawal Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="100000"
                value={withdrawalForm.amount}
                onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
              {adminSummary && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Max available: ₹{adminSummary.availableAdminCapital.toLocaleString("en-IN")}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={withdrawalForm.date}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Method</label>
                <select
                  value={withdrawalForm.paymentMethod}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Reference / Cheque No.</label>
              <input
                type="text"
                placeholder="UTR / Cheque number"
                value={withdrawalForm.referenceNumber}
                onChange={(e) => setWithdrawalForm({ ...withdrawalForm, referenceNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes / Description</label>
              <input
                type="text"
                placeholder="Optional notes"
                value={withdrawalForm.notes}
                onChange={(e) => setWithdrawalForm({ ...withdrawalForm, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsWithdrawalModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer"
              >
                Record Withdrawal
              </button>
            </div>
          </form>
        </Modal>

        {/* MODAL: Allocate Capital to Location */}
        <Modal
          isOpen={isAllocationModalOpen}
          onClose={() => setIsAllocationModalOpen(false)}
          title="Allocate Admin Capital to Location (Tier 1 -> Tier 2)"
        >
          <form onSubmit={handleAddAllocation} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Investor (Source) *</label>
              <select
                required
                value={allocationForm.investorId}
                onChange={(e) => setAllocationForm({ ...allocationForm, investorId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Choose Investor --</option>
                {investors.map((inv) => (
                  <option key={inv.id} value={inv.id}>{inv.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Target Location *</label>
              <select
                required
                value={allocationForm.locationId}
                onChange={(e) => setAllocationForm({ ...allocationForm, locationId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Choose Location --</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Allocation Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="200000"
                value={allocationForm.amount}
                onChange={(e) => setAllocationForm({ ...allocationForm, amount: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
              {adminSummary && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Max available: ₹{adminSummary.availableAdminCapital.toLocaleString("en-IN")}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={allocationForm.date}
                  onChange={(e) => setAllocationForm({ ...allocationForm, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Method</label>
                <select
                  value={allocationForm.paymentMethod}
                  onChange={(e) => setAllocationForm({ ...allocationForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="Internal Transfer">Internal Allocation</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Reference No.</label>
              <input
                type="text"
                placeholder="Transfer reference"
                value={allocationForm.referenceNumber}
                onChange={(e) => setAllocationForm({ ...allocationForm, referenceNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes / Description</label>
              <input
                type="text"
                placeholder="Allocation purpose"
                value={allocationForm.notes}
                onChange={(e) => setAllocationForm({ ...allocationForm, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsAllocationModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer"
              >
                Confirm Allocation
              </button>
            </div>
          </form>
        </Modal>
      </motion.div>
    </CategoryPinGate>
  );
}
