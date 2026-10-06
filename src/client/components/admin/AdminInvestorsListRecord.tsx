import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import {
  Users, Plus, Trash2, Banknote, Search, Calendar, FileText,
  ArrowDownLeft, ArrowUpRight, Pencil, Wallet, TrendingUp,
  CreditCard, CheckCircle2, ChevronRight, Filter, Building2,
  Download, FileSpreadsheet, Eye, RefreshCw, X, ArrowRight
} from "lucide-react";
import { useLiveSync, triggerGlobalSync } from "../../hooks/useLiveSync";
import { useToast } from "../../contexts/ToastContext";
import { downloadExcelReport } from "../../lib/excelExport";

interface AdminInvestor {
  id: number;
  name: string;
  mobile?: string;
  email?: string;
  address?: string;
  notes?: string;
  totalCapital: number;
  totalUpad: number;
  totalAllocated: number;
  availableBalance: number;
  transactions?: any[];
  allocations?: any[];
  createdAt: string;
}

export default function AdminInvestorsListRecord({
  onRefreshParent
}: {
  onRefreshParent?: () => void;
}) {
  const { showToast, confirmAction } = useToast();
  const [investors, setInvestors] = useState<AdminInvestor[]>([]);
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<"ALL" | "POSITIVE" | "ZERO">("ALL");

  // Selected investor for Passbook / Statement Modal
  const [selectedInvestor, setSelectedInvestor] = useState<AdminInvestor | null>(null);

  // Modals
  const [isAddInvestorModalOpen, setIsAddInvestorModalOpen] = useState(false);
  const [isEditInvestorModalOpen, setIsEditInvestorModalOpen] = useState(false);
  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);

  // Active sub-view: "list" (Investors List Record) | "transactions" (All Admin Ledger Transactions)
  const [activeView, setActiveView] = useState<"list" | "transactions">("list");

  // Forms
  const [investorForm, setInvestorForm] = useState({
    id: 0,
    name: "",
    mobile: "",
    email: "",
    address: "",
    notes: "",
    initialContribution: "",
    initialDate: new Date().toISOString().split("T")[0],
    paymentMethod: "Bank Transfer",
    referenceNumber: ""
  });

  const [txForm, setTxForm] = useState({
    investorId: 0,
    investorName: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    notes: "",
    locationId: ""
  });

  const loadData = async (isBackground = false) => {
    try {
      if (!isBackground && investors.length === 0) setLoading(true);
      const [invRes, locRes] = await Promise.all([
        apiFetch("/investments/global-investors").catch(() => []),
        apiFetch("/locations").catch(() => [])
      ]);

      if (Array.isArray(invRes)) {
        setInvestors(invRes);
        // If an investor is currently viewed in modal, refresh their details
        if (selectedInvestor) {
          const updated = invRes.find((i: any) => i.id === selectedInvestor.id);
          if (updated) setSelectedInvestor(updated);
        }
      }
      if (Array.isArray(locRes)) setLocations(locRes);
    } catch (err) {
      console.error("Failed to load admin investors record", err);
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

  // Summary Aggregates
  const summaries = useMemo(() => {
    const totalInvestors = investors.length;
    const totalContributed = investors.reduce((sum, i) => sum + (Number(i.totalCapital) || 0), 0);
    const totalUpad = investors.reduce((sum, i) => sum + (Number(i.totalUpad) || 0), 0);
    const totalAllocated = investors.reduce((sum, i) => sum + (Number(i.totalAllocated) || 0), 0);
    const totalAvailable = investors.reduce((sum, i) => sum + (Number(i.availableBalance) || 0), 0);

    return {
      totalInvestors,
      totalContributed,
      totalUpad,
      totalAllocated,
      totalAvailable
    };
  }, [investors]);

  // Filtered Investors
  const filteredInvestors = useMemo(() => {
    return investors.filter((inv) => {
      const matchesSearch = 
        inv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.mobile && inv.mobile.includes(searchTerm)) ||
        (inv.address && inv.address.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (balanceFilter === "POSITIVE") return Number(inv.availableBalance) > 0;
      if (balanceFilter === "ZERO") return Number(inv.availableBalance) <= 0;
      return true;
    });
  }, [investors, searchTerm, balanceFilter]);

  // All flattened transactions for All Transactions View
  const allTransactions = useMemo(() => {
    const list: any[] = [];
    investors.forEach((inv) => {
      if (Array.isArray(inv.transactions)) {
        inv.transactions.forEach((tx) => {
          list.push({
            ...tx,
            investorId: inv.id,
            investorName: inv.name,
            kind: tx.type === "CONTRIBUTION" || tx.type === "CAPITAL" ? "INFLOW" : "UPAD"
          });
        });
      }
      if (Array.isArray(inv.allocations)) {
        inv.allocations.forEach((al) => {
          list.push({
            ...al,
            investorId: inv.id,
            investorName: inv.name,
            kind: "ALLOCATION",
            type: "ALLOCATION"
          });
        });
      }
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [investors]);

  // Save new Investor
  const handleCreateInvestor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!investorForm.name.trim()) {
      showToast("Please enter investor name", "error");
      return;
    }

    try {
      await apiFetch("/investments/global-investors", {
        method: "POST",
        body: JSON.stringify({
          name: investorForm.name.trim(),
          mobile: investorForm.mobile.trim() || undefined,
          email: investorForm.email.trim() || undefined,
          address: investorForm.address.trim() || undefined,
          notes: investorForm.notes.trim() || undefined,
          initialContribution: investorForm.initialContribution || undefined,
          initialDate: investorForm.initialDate,
          paymentMethod: investorForm.paymentMethod,
          referenceNumber: investorForm.referenceNumber
        })
      });

      showToast(`Investor "${investorForm.name.trim()}" registered successfully!`, "success");
      setIsAddInvestorModalOpen(false);
      setInvestorForm({
        id: 0,
        name: "",
        mobile: "",
        email: "",
        address: "",
        notes: "",
        initialContribution: "",
        initialDate: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        referenceNumber: ""
      });
      triggerGlobalSync();
      loadData(true);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      showToast(err.message || "Failed to register investor", "error");
    }
  };

  // Update existing investor profile
  const handleUpdateInvestor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!investorForm.id || !investorForm.name.trim()) return;

    try {
      await apiFetch(`/investments/global-investors/${investorForm.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: investorForm.name.trim(),
          mobile: investorForm.mobile.trim() || undefined,
          email: investorForm.email.trim() || undefined,
          address: investorForm.address.trim() || undefined,
          notes: investorForm.notes.trim() || undefined
        })
      });

      showToast("Investor details updated successfully!", "success");
      setIsEditInvestorModalOpen(false);
      triggerGlobalSync();
      loadData(true);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      showToast(err.message || "Failed to update investor", "error");
    }
  };

  // Delete investor
  const handleDeleteInvestor = async (inv: AdminInvestor) => {
    const confirmed = await confirmAction({
      title: "Delete Admin Investor",
      message: `Are you sure you want to delete "${inv.name}"? All associated transaction histories will be removed.`,
      confirmLabel: "Delete Record",
      isDanger: true,
      requirePassword: true
    });

    if (!confirmed) return;

    try {
      await apiFetch(`/investments/global-investors/${inv.id}`, {
        method: "DELETE"
      });

      showToast(`Investor "${inv.name}" deleted successfully`, "success");
      if (selectedInvestor?.id === inv.id) setSelectedInvestor(null);
      triggerGlobalSync();
      loadData(true);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      showToast(err.message || "Failed to delete investor", "error");
    }
  };

  // Record Contribution / Inflow
  const handleRecordContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(txForm.amount);
    if (!amount || amount <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }

    try {
      await apiFetch("/investments/global-transactions", {
        method: "POST",
        body: JSON.stringify({
          investorId: txForm.investorId,
          type: "CONTRIBUTION",
          amount: amount.toString(),
          date: txForm.date,
          paymentMethod: txForm.paymentMethod,
          referenceNumber: txForm.referenceNumber,
          notes: txForm.notes
        })
      });

      showToast(`Inflow of ₹${amount.toLocaleString("en-IN")} recorded for ${txForm.investorName}!`, "success");
      setIsContributionModalOpen(false);
      triggerGlobalSync();
      loadData(true);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      showToast(err.message || "Failed to record contribution", "error");
    }
  };

  // Record Upad / Withdrawal
  const handleRecordWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(txForm.amount);
    if (!amount || amount <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }

    try {
      await apiFetch("/investments/global-transactions", {
        method: "POST",
        body: JSON.stringify({
          investorId: txForm.investorId,
          type: "UPAD",
          amount: amount.toString(),
          date: txForm.date,
          paymentMethod: txForm.paymentMethod,
          referenceNumber: txForm.referenceNumber,
          notes: txForm.notes
        })
      });

      showToast(`Upad of ₹${amount.toLocaleString("en-IN")} recorded for ${txForm.investorName}!`, "success");
      setIsWithdrawalModalOpen(false);
      triggerGlobalSync();
      loadData(true);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      showToast(err.message || "Failed to record withdrawal", "error");
    }
  };

  // Record Allocation
  const handleRecordAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(txForm.amount);
    if (!amount || amount <= 0) {
      showToast("Please enter a valid allocation amount", "error");
      return;
    }
    if (!txForm.locationId) {
      showToast("Please select a target project location", "error");
      return;
    }

    try {
      await apiFetch("/investments/location-allocations", {
        method: "POST",
        body: JSON.stringify({
          investorId: txForm.investorId,
          locationId: parseInt(txForm.locationId, 10),
          amount: amount.toString(),
          date: txForm.date,
          paymentMethod: txForm.paymentMethod,
          referenceNumber: txForm.referenceNumber,
          notes: txForm.notes
        })
      });

      showToast(`₹${amount.toLocaleString("en-IN")} allocated to project location!`, "success");
      setIsAllocationModalOpen(false);
      triggerGlobalSync();
      loadData(true);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      showToast(err.message || "Failed to allocate capital", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wider">
                Admin Registry
              </span>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Admin Investors List Record
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Comprehensive ledger of all company investors, capital inflows, withdrawals, and project site allocations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setInvestorForm({
                id: 0,
                name: "",
                mobile: "",
                email: "",
                address: "",
                notes: "",
                initialContribution: "",
                initialDate: new Date().toISOString().split("T")[0],
                paymentMethod: "Bank Transfer",
                referenceNumber: ""
              });
              setIsAddInvestorModalOpen(true);
            }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add New Admin Investor</span>
          </button>
        </div>
      </div>

      {/* 5-Metric Quick Balance Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Investors */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Investors</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{summaries.totalInvestors}</p>
          <span className="text-[10px] text-slate-400">Company Partners</span>
        </div>

        {/* Total Contributed */}
        <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">1. Total Inflows</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700">₹{summaries.totalContributed.toLocaleString("en-IN")}</p>
          <span className="text-[10px] text-slate-500">Gross Inward Capital</span>
        </div>

        {/* Total Upad */}
        <div className="bg-white border border-rose-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">2. Total Withdrawals</span>
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-700">₹{summaries.totalUpad.toLocaleString("en-IN")}</p>
          <span className="text-[10px] text-slate-500">Withdrawn / Returned</span>
        </div>

        {/* Total Allocated */}
        <div className="bg-white border border-blue-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">3. Allocated to Sites</span>
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-700">₹{summaries.totalAllocated.toLocaleString("en-IN")}</p>
          <span className="text-[10px] text-slate-500">Funded into Projects</span>
        </div>

        {/* Available Admin Capital */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm col-span-2 sm:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-amber-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Available Balance</span>
              <Wallet className="w-4 h-4" />
            </div>
            <p className="text-2xl font-black text-emerald-400">₹{summaries.totalAvailable.toLocaleString("en-IN")}</p>
          </div>
          <p className="text-[10px] text-slate-300 pt-1 border-t border-slate-800">
            Inflow - Upad - Allocated
          </p>
        </div>
      </div>

      {/* Switch Views: Investors List Record vs All Transactions */}
      <div className="flex items-center justify-between gap-3 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveView("list")}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeView === "list"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span>Admin Investors List Record ({filteredInvestors.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("transactions")}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeView === "transactions"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-600" />
            <span>All Admin Capital Ledger ({allTransactions.length})</span>
          </button>
        </div>

        {activeView === "list" && (
          <div className="hidden sm:flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadExcelReport('/investments/export-admin-investors', 'Admin_Investors_List_Record.xlsx')}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>
          </div>
        )}
      </div>

      {activeView === "list" ? (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by investor name, mobile..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setBalanceFilter("ALL")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    balanceFilter === "ALL" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All ({investors.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceFilter("POSITIVE")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    balanceFilter === "POSITIVE" ? "bg-white text-emerald-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Active Balance
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceFilter("ZERO")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    balanceFilter === "ZERO" ? "bg-white text-slate-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Zero Balance
                </button>
              </div>
            </div>
          </div>

          {/* Admin Investors Table */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="text-xs text-slate-500 font-medium mt-3">Loading admin investors list record...</p>
            </div>
          ) : filteredInvestors.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
              <Users className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">No Admin Investors Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchTerm ? "No investors match your search term." : "Register company investors to manage capital inflow, withdrawals, and project allocations."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setInvestorForm({
                    id: 0,
                    name: "",
                    mobile: "",
                    email: "",
                    address: "",
                    notes: "",
                    initialContribution: "",
                    initialDate: new Date().toISOString().split("T")[0],
                    paymentMethod: "Bank Transfer",
                    referenceNumber: ""
                  });
                  setIsAddInvestorModalOpen(true);
                }}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add First Investor</span>
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-3.5 pl-5">Investor Name & Contact</th>
                      <th className="p-3.5 text-right text-emerald-800">Total Inflows</th>
                      <th className="p-3.5 text-right text-rose-800">Total Withdrawals</th>
                      <th className="p-3.5 text-right text-blue-800">Allocated to Sites</th>
                      <th className="p-3.5 text-right">Available Balance</th>
                      <th className="p-3.5 text-center">Actions & Ledger</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInvestors.map((inv) => {
                      const hasPositive = Number(inv.availableBalance) > 0;
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Name & Contact */}
                          <td className="p-3.5 pl-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                                {inv.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 text-sm block">{inv.name}</span>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                  {inv.mobile && <span>📞 {inv.mobile}</span>}
                                  {inv.address && <span>📍 {inv.address}</span>}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Total Inflow */}
                          <td className="p-3.5 text-right font-black text-emerald-700 font-mono text-sm">
                            ₹{Number(inv.totalCapital || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>

                          {/* Total Upad */}
                          <td className="p-3.5 text-right font-bold text-rose-600 font-mono text-sm">
                            ₹{Number(inv.totalUpad || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>

                          {/* Allocated to Sites */}
                          <td className="p-3.5 text-right font-bold text-blue-600 font-mono text-sm">
                            ₹{Number(inv.totalAllocated || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            <div className="text-[10px] text-slate-400 font-sans">
                              {inv.allocations?.length || 0} locations
                            </div>
                          </td>

                          {/* Available Balance */}
                          <td className="p-3.5 text-right">
                            <div className={`font-black font-mono text-sm ${hasPositive ? "text-slate-900" : "text-slate-400"}`}>
                              ₹{Number(inv.availableBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.2 rounded-full text-[10px] font-bold ${
                              hasPositive
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-600"
                            }`}>
                              {hasPositive ? "Active Balance" : "Zero Balance"}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="p-3.5">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* View Passbook */}
                              <button
                                type="button"
                                onClick={() => setSelectedInvestor(inv)}
                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-indigo-200"
                                title="View Investor Passbook Statement"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Passbook</span>
                              </button>

                              {/* Quick Contribution */}
                              <button
                                type="button"
                                onClick={() => {
                                  setTxForm({
                                    investorId: inv.id,
                                    investorName: inv.name,
                                    amount: "",
                                    date: new Date().toISOString().split("T")[0],
                                    paymentMethod: "Bank Transfer",
                                    referenceNumber: "",
                                    notes: "",
                                    locationId: ""
                                  });
                                  setIsContributionModalOpen(true);
                                }}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-all border border-emerald-200 cursor-pointer"
                                title="+ Add Capital Inflow"
                              >
                                <Plus className="w-3.5 h-3.5 text-emerald-700" />
                              </button>

                              {/* Quick Upad */}
                              <button
                                type="button"
                                onClick={() => {
                                  setTxForm({
                                    investorId: inv.id,
                                    investorName: inv.name,
                                    amount: "",
                                    date: new Date().toISOString().split("T")[0],
                                    paymentMethod: "Bank Transfer",
                                    referenceNumber: "",
                                    notes: "",
                                    locationId: ""
                                  });
                                  setIsWithdrawalModalOpen(true);
                                }}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-all border border-rose-200 cursor-pointer"
                                title="- Add Capital Withdrawal"
                              >
                                <ArrowUpRight className="w-3.5 h-3.5 text-rose-700" />
                              </button>

                              {/* Quick Allocate */}
                              <button
                                type="button"
                                onClick={() => {
                                  setTxForm({
                                    investorId: inv.id,
                                    investorName: inv.name,
                                    amount: "",
                                    date: new Date().toISOString().split("T")[0],
                                    paymentMethod: "Bank Transfer",
                                    referenceNumber: "",
                                    notes: "",
                                    locationId: locations.length > 0 ? String(locations[0].id) : ""
                                  });
                                  setIsAllocationModalOpen(true);
                                }}
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-all border border-blue-200 cursor-pointer"
                                title="Allocate to Location"
                              >
                                <Building2 className="w-3.5 h-3.5 text-blue-700" />
                              </button>

                              {/* Edit Profile */}
                              <button
                                type="button"
                                onClick={() => {
                                  setInvestorForm({
                                    id: inv.id,
                                    name: inv.name,
                                    mobile: inv.mobile || "",
                                    email: inv.email || "",
                                    address: inv.address || "",
                                    notes: inv.notes || "",
                                    initialContribution: "",
                                    initialDate: "",
                                    paymentMethod: "Bank Transfer",
                                    referenceNumber: ""
                                  });
                                  setIsEditInvestorModalOpen(true);
                                }}
                                className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-all cursor-pointer"
                                title="Edit Profile"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => handleDeleteInvestor(inv)}
                                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* All Admin Transactions Ledger */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">All Admin Capital Ledger Entries</h3>
              <p className="text-[11px] text-slate-500">Live stream of every contribution, withdrawal, and project allocation</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {allTransactions.length} Transactions
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3 pl-5">Date</th>
                  <th className="p-3">Investor Name</th>
                  <th className="p-3">Type / Category</th>
                  <th className="p-3">Target / Mode</th>
                  <th className="p-3">Reference / Notes</th>
                  <th className="p-3 pr-5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No admin capital transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  allTransactions.map((tx: any, idx: number) => {
                    const isInflow = tx.kind === "INFLOW";
                    const isUpad = tx.kind === "UPAD";
                    const isAlloc = tx.kind === "ALLOCATION";

                    return (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 pl-5 font-mono text-slate-600">
                          {tx.date || new Date().toISOString().split("T")[0]}
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          {tx.investorName}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isInflow
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : isUpad
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}>
                            {isInflow && <ArrowDownLeft className="w-3 h-3" />}
                            {isUpad && <ArrowUpRight className="w-3 h-3" />}
                            {isAlloc && <Building2 className="w-3 h-3" />}
                            {isInflow ? "Capital Inflow" : isUpad ? "Capital Upad" : "Site Allocation"}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">
                          {isAlloc ? (
                            <span className="font-semibold text-blue-700">📍 {tx.locationName || "Project Location"}</span>
                          ) : (
                            <span>{tx.paymentMethod || "Bank Transfer"}</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-500 font-mono text-[11px]">
                          {tx.referenceNumber || tx.notes || tx.description || "-"}
                        </td>
                        <td className={`p-3 pr-5 text-right font-black font-mono text-sm ${
                          isInflow ? "text-emerald-700" : isUpad ? "text-rose-600" : "text-blue-600"
                        }`}>
                          {isInflow ? "+" : isUpad ? "-" : ""}
                          ₹{Number(tx.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Investor Passbook Statement */}
      <Modal
        isOpen={!!selectedInvestor}
        onClose={() => setSelectedInvestor(null)}
        title={selectedInvestor ? `${selectedInvestor.name} - Passbook Ledger` : "Investor Passbook"}
      >
        {selectedInvestor && (
          <div className="space-y-6">
            {/* Investor Balance Overview Card */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-black text-white">{selectedInvestor.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    {selectedInvestor.mobile && <span>📞 {selectedInvestor.mobile}</span>}
                    {selectedInvestor.email && <span>✉️ {selectedInvestor.email}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-amber-400">Available Net Balance</span>
                  <p className="text-2xl font-black text-emerald-400">
                    ₹{Number(selectedInvestor.availableBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase">1. Contributed:</span>
                  <p className="font-bold text-emerald-300">
                    ₹{Number(selectedInvestor.totalCapital || 0).toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase">2. Upad / Withdrawn:</span>
                  <p className="font-bold text-rose-300">
                    ₹{Number(selectedInvestor.totalUpad || 0).toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase">3. Allocated:</span>
                  <p className="font-bold text-blue-300">
                    ₹{Number(selectedInvestor.totalAllocated || 0).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </div>

            {/* Inflows & Upads Table */}
            <div>
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                1. Capital Inflows & Upads
              </h4>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                    <tr>
                      <th className="p-2.5 pl-3">Date</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Mode / Ref</th>
                      <th className="p-2.5 pr-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!selectedInvestor.transactions || selectedInvestor.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400">No transactions recorded</td>
                      </tr>
                    ) : (
                      selectedInvestor.transactions.map((tx: any, idx: number) => {
                        const isInflow = tx.type === "CONTRIBUTION" || tx.type === "CAPITAL";
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 pl-3 font-mono text-slate-600">{tx.date}</td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isInflow ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                              }`}>
                                {isInflow ? "Inflow" : "Upad"}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-600 text-[11px]">
                              {tx.paymentMethod} {tx.referenceNumber ? `(${tx.referenceNumber})` : ""}
                            </td>
                            <td className={`p-2.5 pr-3 text-right font-black font-mono ${
                              isInflow ? "text-emerald-700" : "text-rose-600"
                            }`}>
                              {isInflow ? "+" : "-"}₹{Number(tx.amount || 0).toLocaleString("en-IN")}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Location Allocations Table */}
            <div>
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                2. Project Site Allocations
              </h4>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                    <tr>
                      <th className="p-2.5 pl-3">Date</th>
                      <th className="p-2.5">Project Location</th>
                      <th className="p-2.5">Ref / Notes</th>
                      <th className="p-2.5 pr-3 text-right">Allocated Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!selectedInvestor.allocations || selectedInvestor.allocations.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400">No location allocations yet</td>
                      </tr>
                    ) : (
                      selectedInvestor.allocations.map((al: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 pl-3 font-mono text-slate-600">{al.date}</td>
                          <td className="p-2.5 font-bold text-blue-700">📍 {al.locationName}</td>
                          <td className="p-2.5 text-slate-500 text-[11px]">{al.referenceNumber || al.notes || "-"}</td>
                          <td className="p-2.5 pr-3 text-right font-black font-mono text-blue-600">
                            ₹{Number(al.amount || 0).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedInvestor(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close Statement
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: Register New Investor */}
      <Modal
        isOpen={isAddInvestorModalOpen}
        onClose={() => setIsAddInvestorModalOpen(false)}
        title="Register New Admin Investor"
      >
        <form onSubmit={handleCreateInvestor} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Investor Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. B J DESAI / RAMESH PATEL"
              value={investorForm.name}
              onChange={(e) => setInvestorForm({ ...investorForm, name: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mobile Number</label>
              <input
                type="text"
                placeholder="9876543210"
                value={investorForm.mobile}
                onChange={(e) => setInvestorForm({ ...investorForm, mobile: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email (Optional)</label>
              <input
                type="email"
                placeholder="investor@example.com"
                value={investorForm.email}
                onChange={(e) => setInvestorForm({ ...investorForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">City / Address</label>
            <input
              type="text"
              placeholder="e.g. Ahmedabad, Gujarat"
              value={investorForm.address}
              onChange={(e) => setInvestorForm({ ...investorForm, address: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
            <span className="text-xs font-bold text-emerald-900 uppercase block">Optional Initial Inflow</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Initial Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={investorForm.initialContribution}
                  onChange={(e) => setInvestorForm({ ...investorForm, initialContribution: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-emerald-700"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date</label>
                <input
                  type="date"
                  value={investorForm.initialDate}
                  onChange={(e) => setInvestorForm({ ...investorForm, initialDate: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddInvestorModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              Register Investor
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Edit Investor Profile */}
      <Modal
        isOpen={isEditInvestorModalOpen}
        onClose={() => setIsEditInvestorModalOpen(false)}
        title="Edit Admin Investor Profile"
      >
        <form onSubmit={handleUpdateInvestor} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Investor Name *</label>
            <input
              type="text"
              required
              value={investorForm.name}
              onChange={(e) => setInvestorForm({ ...investorForm, name: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mobile Number</label>
              <input
                type="text"
                value={investorForm.mobile}
                onChange={(e) => setInvestorForm({ ...investorForm, mobile: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email</label>
              <input
                type="email"
                value={investorForm.email}
                onChange={(e) => setInvestorForm({ ...investorForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Address</label>
            <input
              type="text"
              value={investorForm.address}
              onChange={(e) => setInvestorForm({ ...investorForm, address: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes</label>
            <textarea
              rows={2}
              value={investorForm.notes}
              onChange={(e) => setInvestorForm({ ...investorForm, notes: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsEditInvestorModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              Update Profile
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Record Inflow for specific investor */}
      <Modal
        isOpen={isContributionModalOpen}
        onClose={() => setIsContributionModalOpen(false)}
        title={`Record Inflow for ${txForm.investorName}`}
      >
        <form onSubmit={handleRecordContribution} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Contribution Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="500000"
              value={txForm.amount}
              onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
              <input
                type="date"
                required
                value={txForm.date}
                onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Method</label>
              <select
                value={txForm.paymentMethod}
                onChange={(e) => setTxForm({ ...txForm, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
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
              value={txForm.referenceNumber}
              onChange={(e) => setTxForm({ ...txForm, referenceNumber: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes</label>
            <input
              type="text"
              placeholder="Description"
              value={txForm.notes}
              onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsContributionModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              Record Inflow
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Record Upad for specific investor */}
      <Modal
        isOpen={isWithdrawalModalOpen}
        onClose={() => setIsWithdrawalModalOpen(false)}
        title={`Record Upad / Return for ${txForm.investorName}`}
      >
        <form onSubmit={handleRecordWithdrawal} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Upad Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="100000"
              value={txForm.amount}
              onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
              <input
                type="date"
                required
                value={txForm.date}
                onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Method</label>
              <select
                value={txForm.paymentMethod}
                onChange={(e) => setTxForm({ ...txForm, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
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
              placeholder="Cheque / UTR number"
              value={txForm.referenceNumber}
              onChange={(e) => setTxForm({ ...txForm, referenceNumber: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes</label>
            <input
              type="text"
              placeholder="Description"
              value={txForm.notes}
              onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsWithdrawalModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              Record Upad
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Record Location Allocation */}
      <Modal
        isOpen={isAllocationModalOpen}
        onClose={() => setIsAllocationModalOpen(false)}
        title={`Allocate Capital from ${txForm.investorName} to Location`}
      >
        <form onSubmit={handleRecordAllocation} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Project Location *</label>
            <select
              required
              value={txForm.locationId}
              onChange={(e) => setTxForm({ ...txForm, locationId: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
            >
              <option value="">-- Choose Project Location --</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>📍 {loc.name}</option>
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
              value={txForm.amount}
              onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
              <input
                type="date"
                required
                value={txForm.date}
                onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Method</label>
              <select
                value={txForm.paymentMethod}
                onChange={(e) => setTxForm({ ...txForm, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              >
                <option value="Bank Transfer">Bank Transfer / NEFT</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
                <option value="Internal Transfer">Internal Transfer</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Reference / Note</label>
            <input
              type="text"
              placeholder="Transfer reference"
              value={txForm.referenceNumber}
              onChange={(e) => setTxForm({ ...txForm, referenceNumber: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAllocationModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              Allocate Capital
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
