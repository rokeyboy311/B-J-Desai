import React, { useState, useEffect, useMemo } from "react";
import { 
  ShieldCheck, Plus, ArrowRight, Building2, Wallet,
  Search, ArrowDownLeft, ArrowUpRight, Trash2, Edit2,
  BookOpen, User, FileSpreadsheet, ChevronDown, ChevronUp,
  MapPin, DollarSign, ArrowLeftRight
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
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [allAllocations, setAllAllocations] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Unified Workflow Views
  const [workflowView, setWorkflowView] = useState<"investors_view" | "master_ledger">("investors_view");
  const [expandedInvestorId, setExpandedInvestorId] = useState<number | null>(null);
  const [investorDetailTab, setInvestorDetailTab] = useState<Record<number, "all" | "deposits" | "withdrawals" | "allocations">>({});

  // Master ledger filters
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<"ALL" | "DEPOSIT" | "WITHDRAWAL" | "ALLOCATION">("ALL");
  const [ledgerInvestorFilter, setLedgerInvestorFilter] = useState<string>("ALL");
  const [ledgerSearch, setLedgerSearch] = useState("");

  // Modal States
  const [isAddInvestorOpen, setIsAddInvestorOpen] = useState(false);
  const [isEditInvestorOpen, setIsEditInvestorOpen] = useState(false);
  const [editingInvestorId, setEditingInvestorId] = useState<number | null>(null);
  const [isAllocationOpen, setIsAllocationOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false);

  // Form States
  const [editInvestorForm, setEditInvestorForm] = useState({
    name: "",
    mobile: "",
    email: "",
    address: "",
    notes: ""
  });

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
    notes: "Capital Deposit"
  });

  const [withdrawalForm, setWithdrawalForm] = useState({
    investorId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    notes: "Capital Withdrawal"
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
      const [summaryRes, locRes, invRes, txsRes, allocsRes] = await Promise.all([
        apiFetch("/investments/admin-capital-summary").catch(() => null),
        apiFetch("/locations").catch(() => []),
        apiFetch("/investments/global-investors").catch(() => []),
        apiFetch("/investments/global-transactions").catch(() => []),
        apiFetch("/investments/location-allocations").catch(() => [])
      ]);

      if (summaryRes) setAdminSummary(summaryRes);
      if (Array.isArray(locRes)) setLocations(locRes);
      if (Array.isArray(invRes)) setInvestors(invRes);
      if (Array.isArray(txsRes)) setAllTransactions(txsRes);
      if (Array.isArray(allocsRes)) setAllAllocations(allocsRes);
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

  // Form Handlers
  const handleAddInvestor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvestorForm.name.trim()) {
      showToast("Please enter investor name", "error");
      return;
    }

    const initAmt = parseFloat(newInvestorForm.initialCapital);

    try {
      const created = await apiFetch("/investments/global-investors", {
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

      showToast(`Investor "${newInvestorForm.name.trim()}" created successfully`, "success");
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
      if (created?.id) {
        setExpandedInvestorId(created.id);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to add investor", "error");
    }
  };

  const handleDepositCapital = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(depositForm.amount);
    if (!depositForm.investorId || isNaN(amount) || amount <= 0) {
      showToast("Please enter a valid amount and select an investor", "error");
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
          description: depositForm.notes || "Capital Deposit"
        })
      });

      showToast(`₹${amount.toLocaleString("en-IN")} deposited successfully`, "success");
      setIsDepositOpen(false);
      setDepositForm({
        investorId: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        referenceNumber: "",
        notes: "Capital Deposit"
      });
      triggerGlobalSync();
      triggerSync("global_investors");
      await loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to record deposit", "error");
    }
  };

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(withdrawalForm.amount);
    if (!withdrawalForm.investorId || isNaN(amount) || amount <= 0) {
      showToast("Please enter a valid amount and select an investor", "error");
      return;
    }

    try {
      await apiFetch("/investments/global-transactions", {
        method: "POST",
        body: JSON.stringify({
          investorId: parseInt(withdrawalForm.investorId, 10),
          type: "UPAD",
          amount: amount,
          date: withdrawalForm.date,
          paymentMethod: withdrawalForm.paymentMethod,
          referenceNumber: withdrawalForm.referenceNumber || null,
          description: withdrawalForm.notes || "Capital Withdrawal"
        })
      });

      showToast(`₹${amount.toLocaleString("en-IN")} withdrawal recorded successfully`, "success");
      setIsWithdrawalOpen(false);
      setWithdrawalForm({
        investorId: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        referenceNumber: "",
        notes: "Capital Withdrawal"
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
      showToast("Please enter a valid allocation amount", "error");
      return;
    }
    if (!allocationForm.investorId || !allocationForm.locationId) {
      showToast("Please select both an investor and target location", "error");
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

      showToast(`₹${amount.toLocaleString("en-IN")} allocated to location successfully`, "success");
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

  const handleDeleteInvestor = async (invId: number, name: string) => {
    const confirmed = await confirmAction({
      title: "Delete Investor",
      message: `Are you sure you want to delete investor "${name}"? All associated transaction and allocation records will also be removed.`,
      confirmLabel: "Delete",
      isDanger: true
    });
    if (!confirmed) return;
    try {
      await apiFetch(`/investments/global-investors/${invId}`, { method: "DELETE" });
      showToast(`Investor "${name}" deleted successfully`, "success");
      if (expandedInvestorId === invId) setExpandedInvestorId(null);
      triggerGlobalSync();
      triggerSync("global_investors");
      await loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to delete investor", "error");
    }
  };

  const handleOpenEditInvestor = (inv: any) => {
    setEditingInvestorId(inv.id);
    setEditInvestorForm({
      name: inv.name || "",
      mobile: inv.mobile || "",
      email: inv.email || "",
      address: inv.address || "",
      notes: inv.notes || ""
    });
    setIsEditInvestorOpen(true);
  };

  const handleUpdateInvestor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInvestorForm.name.trim()) {
      showToast("Investor name is required", "error");
      return;
    }
    try {
      await apiFetch(`/investments/global-investors/${editingInvestorId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editInvestorForm.name.trim(),
          mobile: editInvestorForm.mobile.trim() || null,
          email: editInvestorForm.email.trim() || null,
          address: editInvestorForm.address.trim() || null,
          notes: editInvestorForm.notes.trim() || null
        })
      });
      showToast("Investor profile updated successfully", "success");
      setIsEditInvestorOpen(false);
      setEditingInvestorId(null);
      triggerGlobalSync();
      triggerSync("global_investors");
      await loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to update investor", "error");
    }
  };

  const handleDeleteTransaction = async (txId: number) => {
    const confirmed = await confirmAction({
      title: "Delete Transaction",
      message: "Are you sure you want to delete this transaction record?",
      confirmLabel: "Delete",
      isDanger: true
    });
    if (!confirmed) return;
    try {
      await apiFetch(`/investments/global-transactions/${txId}`, { method: "DELETE" });
      showToast("Transaction deleted successfully", "success");
      triggerGlobalSync();
      triggerSync("global_investors");
      await loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to delete transaction", "error");
    }
  };

  const handleDeleteAllocation = async (allocId: number) => {
    const confirmed = await confirmAction({
      title: "Delete Project Allocation",
      message: "Are you sure you want to delete this project allocation record?",
      confirmLabel: "Delete",
      isDanger: true
    });
    if (!confirmed) return;
    try {
      await apiFetch(`/investments/location-allocations/${allocId}`, { method: "DELETE" });
      showToast("Allocation deleted successfully", "success");
      triggerGlobalSync();
      triggerSync("global_investors");
      triggerSync("location_allocations");
      await loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to delete allocation", "error");
    }
  };

  // Top Metric Calculations
  const totalContributed = adminSummary?.totalContributed || 0;
  const totalWithdrawn = adminSummary?.totalWithdrawn || 0;
  const totalAllocated = adminSummary?.totalAllocated || 0;
  const totalPurchasesCost = adminSummary?.totalPurchases || 0;
  const availableCapital = adminSummary?.availableAdminCapital ?? (totalContributed - totalWithdrawn - totalAllocated - totalPurchasesCost);

  // Helper to compile statement per investor
  const getInvestorStatement = (inv: any) => {
    if (!inv) {
      return {
        allEntries: [],
        depositsList: [],
        withdrawalsList: [],
        allocationsList: [],
        locationBreakdown: {},
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalAllocated: 0,
        totalDeductions: 0,
        netBalance: 0
      };
    }

    const allEntries: any[] = [];
    const depositsList: any[] = [];
    const withdrawalsList: any[] = [];
    const allocationsList: any[] = [];
    const locationBreakdown: Record<string, { locationName: string; totalAmount: number; count: number }> = {};

    const txs: any[] = inv.transactions || [];
    const allocs: any[] = inv.allocations || [];

    txs.forEach((t: any) => {
      const isContrib = t.type === "CONTRIBUTION" || t.type === "CAPITAL" || t.type === "INVESTMENT";
      const amt = parseFloat(String(t.amount || 0));
      const entry = {
        id: `tx-${t.id}`,
        rawId: t.id,
        kind: "TRANSACTION",
        date: t.date,
        type: isContrib ? "DEPOSIT" : "WITHDRAWAL",
        typeLabel: isContrib ? "Deposit (+)" : "Withdrawal (-)",
        particulars: t.description || t.notes || (isContrib ? "Capital Deposit" : "Capital Withdrawal"),
        destination: isContrib ? "Central Pool" : "Investor Account",
        paymentMethod: t.paymentMethod || "Bank Transfer",
        referenceNumber: t.referenceNumber || "-",
        credit: isContrib ? amt : 0,
        debit: isContrib ? 0 : amt,
        amount: amt
      };
      allEntries.push(entry);
      if (isContrib) {
        depositsList.push(entry);
      } else {
        withdrawalsList.push(entry);
      }
    });

    allocs.forEach((a: any) => {
      const amt = parseFloat(String(a.amount || 0));
      const locName = a.locationName || (locations.find(l => l.id === a.locationId)?.name) || `Location #${a.locationId}`;
      const entry = {
        id: `alloc-${a.id}`,
        rawId: a.id,
        kind: "ALLOCATION",
        date: a.date,
        locationId: a.locationId,
        locationName: locName,
        type: "ALLOCATION",
        typeLabel: `Allocation (- ${locName})`,
        particulars: a.notes ? `Allocated: ${locName} (${a.notes})` : `Allocated: ${locName}`,
        destination: locName,
        paymentMethod: a.paymentMethod || "Bank Transfer",
        referenceNumber: a.referenceNumber || "-",
        credit: 0,
        debit: amt,
        amount: amt
      };
      allEntries.push(entry);
      allocationsList.push(entry);

      if (!locationBreakdown[locName]) {
        locationBreakdown[locName] = {
          locationName: locName,
          totalAmount: 0,
          count: 0
        };
      }
      locationBreakdown[locName].totalAmount += amt;
      locationBreakdown[locName].count += 1;
    });

    // Chronological order for calculation
    allEntries.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.rawId || 0) - (b.rawId || 0);
    });

    let running = 0;
    const withRunningBalance = allEntries.map(entry => {
      running = running + entry.credit - entry.debit;
      return {
        ...entry,
        runningBalance: Math.round(running * 100) / 100
      };
    });

    const totalDeposits = allEntries.reduce((s, i) => s + i.credit, 0);
    const totalWithdrawals = allEntries.filter(i => i.type === "WITHDRAWAL").reduce((s, i) => s + i.debit, 0);
    const totalAlloc = allEntries.filter(i => i.type === "ALLOCATION").reduce((s, i) => s + i.debit, 0);
    const totalDeductions = totalWithdrawals + totalAlloc;
    const netBalance = Math.round((totalDeposits - totalDeductions) * 100) / 100;

    return {
      allEntries: withRunningBalance.reverse(),
      depositsList: depositsList.sort((a, b) => b.date.localeCompare(a.date)),
      withdrawalsList: withdrawalsList.sort((a, b) => b.date.localeCompare(a.date)),
      allocationsList: allocationsList.sort((a, b) => b.date.localeCompare(a.date)),
      locationBreakdown,
      totalDeposits,
      totalWithdrawals,
      totalAllocated: totalAlloc,
      totalDeductions,
      netBalance
    };
  };

  // Master Combined Ledger Entries
  const masterLedgerEntries = useMemo(() => {
    const items: any[] = [];

    allTransactions.forEach(t => {
      const isContrib = t.type === "CONTRIBUTION" || t.type === "CAPITAL" || t.type === "INVESTMENT";
      const amt = parseFloat(String(t.amount || 0));
      const invName = t.investorName || (investors.find(i => i.id === t.investorId)?.name) || "Investor";
      items.push({
        id: `tx-${t.id}`,
        rawId: t.id,
        kind: "TRANSACTION",
        date: t.date,
        investorId: t.investorId,
        investorName: invName,
        type: isContrib ? "DEPOSIT" : "WITHDRAWAL",
        typeLabel: isContrib ? "Deposit (+)" : "Withdrawal (-)",
        particulars: t.description || (isContrib ? "Capital Deposit" : "Capital Withdrawal"),
        destination: isContrib ? "Central Pool" : "Investor Account",
        paymentMethod: t.paymentMethod || "Bank Transfer",
        referenceNumber: t.referenceNumber || "-",
        credit: isContrib ? amt : 0,
        debit: isContrib ? 0 : amt,
        amount: amt
      });
    });

    allAllocations.forEach(a => {
      const amt = parseFloat(String(a.amount || 0));
      const invName = a.investorName || (investors.find(i => i.id === a.investorId)?.name) || "Investor";
      const locName = a.locationName || (locations.find(l => l.id === a.locationId)?.name) || `Location #${a.locationId}`;
      items.push({
        id: `alloc-${a.id}`,
        rawId: a.id,
        kind: "ALLOCATION",
        date: a.date,
        investorId: a.investorId,
        investorName: invName,
        type: "ALLOCATION",
        typeLabel: `Allocation (${locName})`,
        particulars: a.notes ? `Allocated: ${locName} (${a.notes})` : `Allocated: ${locName}`,
        destination: locName,
        paymentMethod: a.paymentMethod || "Bank Transfer",
        referenceNumber: a.referenceNumber || "-",
        credit: 0,
        debit: amt,
        amount: amt
      });
    });

    items.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.rawId || 0) - (b.rawId || 0);
    });

    let running = 0;
    const withRunningBalance = items.map(entry => {
      running = running + entry.credit - entry.debit;
      return {
        ...entry,
        runningBalance: Math.round(running * 100) / 100
      };
    });

    return withRunningBalance.reverse();
  }, [allTransactions, allAllocations, investors, locations]);

  // Filtered Master Ledger
  const filteredMasterLedger = useMemo(() => {
    return masterLedgerEntries.filter(e => {
      const matchType = ledgerTypeFilter === "ALL" || e.type === ledgerTypeFilter;
      const matchInvestor = ledgerInvestorFilter === "ALL" || String(e.investorId) === String(ledgerInvestorFilter);
      const q = ledgerSearch.toLowerCase().trim();
      const matchSearch = !q ||
        (e.investorName && e.investorName.toLowerCase().includes(q)) ||
        (e.particulars && e.particulars.toLowerCase().includes(q)) ||
        (e.destination && e.destination.toLowerCase().includes(q)) ||
        (e.referenceNumber && e.referenceNumber.toLowerCase().includes(q)) ||
        (e.paymentMethod && e.paymentMethod.toLowerCase().includes(q));
      return matchType && matchInvestor && matchSearch;
    });
  }, [masterLedgerEntries, ledgerTypeFilter, ledgerInvestorFilter, ledgerSearch]);

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

  return (
    <CategoryPinGate categoryName="Admin Control & Capital" categoryNumber={1}>
      <div className="space-y-6 pb-20 max-w-7xl mx-auto px-2 sm:px-4">
        
        {/* Authoritative Clean Header */}
        <div className="bg-gradient-to-r from-[#0B1D3A] via-slate-900 to-[#0B1D3A] p-5 sm:p-7 rounded-3xl text-white shadow-xl border border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 mb-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Admin & Capital Management</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Investor Accounts & Capital Ledger
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl font-medium">
                Unified workspace to manage investor profiles, capital deposits, withdrawals, and site allocations.
              </p>
            </div>

            {/* Main Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsAddInvestorOpen(true)}
                className="px-4 py-2.5 bg-[#1E88E5] hover:bg-blue-600 active:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Investor</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDepositForm(prev => ({ ...prev, investorId: investors[0]?.id?.toString() || "" }));
                  setIsDepositOpen(true);
                }}
                disabled={investors.length === 0}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>Deposit Capital</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setWithdrawalForm(prev => ({ ...prev, investorId: investors[0]?.id?.toString() || "" }));
                  setIsWithdrawalOpen(true);
                }}
                disabled={investors.length === 0}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Withdraw Capital</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAllocationForm(prev => ({
                    ...prev,
                    investorId: investors[0]?.id?.toString() || "",
                    locationId: locations[0]?.id?.toString() || ""
                  }));
                  setIsAllocationOpen(true);
                }}
                disabled={investors.length === 0 || locations.length === 0}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Transfer to Location</span>
              </button>
            </div>
          </div>

          {/* 5 Core Top Summary Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-5 border-t border-slate-700/80">
            <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl border border-white/15">
              <span className="text-[11px] uppercase font-bold text-slate-300 block">Total Capital Added</span>
              <span className="text-lg sm:text-xl font-black text-emerald-400 block tabular-nums mt-0.5">
                +₹{totalContributed.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-400">Total Investor Deposits</span>
            </div>

            <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl border border-white/15">
              <span className="text-[11px] uppercase font-bold text-slate-300 block">Total Withdrawn</span>
              <span className="text-lg sm:text-xl font-black text-amber-400 block tabular-nums mt-0.5">
                -₹{totalWithdrawn.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-400">Total Capital Returned</span>
            </div>

            <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl border border-white/15">
              <span className="text-[11px] uppercase font-bold text-slate-300 block">Project Allocations</span>
              <span className="text-lg sm:text-xl font-black text-blue-400 block tabular-nums mt-0.5">
                -₹{totalAllocated.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-400">Transferred to Sites</span>
            </div>

            <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl border border-white/15">
              <span className="text-[11px] uppercase font-bold text-slate-300 block">Material Purchases</span>
              <span className="text-lg sm:text-xl font-black text-purple-400 block tabular-nums mt-0.5">
                -₹{totalPurchasesCost.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-400">Central Supply Cost</span>
            </div>

            <div className="bg-emerald-950/70 p-3.5 rounded-2xl border border-emerald-500/40 col-span-2 sm:col-span-1">
              <span className="text-[11px] uppercase font-bold text-emerald-300 block">Available Capital</span>
              <span className="text-lg sm:text-xl font-black text-emerald-200 block tabular-nums mt-0.5">
                ₹{availableCapital.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-emerald-300/70">Central Admin Balance</span>
            </div>
          </div>
        </div>

        {/* View Switcher & Search Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWorkflowView("investors_view")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                workflowView === "investors_view"
                  ? "bg-[#0B1D3A] text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <User className="w-4 h-4 text-blue-400" />
              <span>Investor Accounts &amp; Statements</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-300">
                {investors.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setWorkflowView("master_ledger")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                workflowView === "master_ledger"
                  ? "bg-[#0B1D3A] text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-400" />
              <span>Master Capital Ledger</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300">
                {masterLedgerEntries.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {workflowView === "investors_view" ? (
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search investor by name, phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ) : (
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search ledger by name, notes, ref..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* WORKFLOW VIEW 1: INVESTOR ACCOUNTS & STATEMENTS */}
        {workflowView === "investors_view" && (
          <div className="space-y-4">
            {filteredInvestors.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center shadow-xs">
                <User className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h3 className="text-base font-bold text-slate-800">
                  {searchTerm ? "No matching investors found" : "No investors registered yet"}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Click the "Add Investor" button above to register your first investor and track capital.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddInvestorOpen(true)}
                  className="mt-4 px-4 py-2 bg-[#1E88E5] text-white rounded-xl font-bold text-xs shadow-sm hover:bg-blue-600 transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Investor</span>
                </button>
              </div>
            ) : (
              filteredInvestors.map((inv) => {
                const statement = getInvestorStatement(inv);
                const isExpanded = expandedInvestorId === inv.id;
                const activeTab = investorDetailTab[inv.id] || "all";

                return (
                  <div 
                    key={inv.id}
                    className={`bg-white rounded-3xl border transition-all shadow-xs overflow-hidden ${
                      isExpanded ? "border-amber-400 ring-2 ring-amber-400/20" : "border-slate-200/90 hover:border-slate-300"
                    }`}
                  >
                    {/* Investor Header Row */}
                    <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50/90 via-white to-slate-50/50 border-b border-slate-100">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Investor Identity */}
                        <div className="flex items-start gap-3.5">
                          <button
                            type="button"
                            onClick={() => setExpandedInvestorId(isExpanded ? null : inv.id)}
                            className={`p-2.5 rounded-2xl transition-all cursor-pointer shrink-0 mt-0.5 ${
                              isExpanded ? "bg-amber-500 text-white shadow-sm" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            }`}
                            title={isExpanded ? "Collapse statement" : "View full statement"}
                          >
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                                {inv.name}
                              </h3>
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {statement.allEntries.length} Transactions
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap font-medium">
                              {inv.mobile && (
                                <span className="flex items-center gap-1 font-mono">
                                  Phone: {inv.mobile}
                                </span>
                              )}
                              {inv.email && (
                                <span>&bull; {inv.email}</span>
                              )}
                              {inv.address && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  {inv.address}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 4 Financial Metrics */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 shrink-0">
                          <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200/80">
                            <span className="text-[10px] uppercase font-bold text-emerald-800 block">Total Deposits</span>
                            <span className="text-sm font-black text-emerald-950 block tabular-nums">
                              +₹{statement.totalDeposits.toLocaleString("en-IN")}
                            </span>
                            <span className="text-[9px] text-emerald-700 font-semibold">{statement.depositsList.length} entries</span>
                          </div>

                          <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200/80">
                            <span className="text-[10px] uppercase font-bold text-amber-800 block">Total Withdrawals</span>
                            <span className="text-sm font-black text-amber-950 block tabular-nums">
                              -₹{statement.totalWithdrawals.toLocaleString("en-IN")}
                            </span>
                            <span className="text-[9px] text-amber-700 font-semibold">{statement.withdrawalsList.length} entries</span>
                          </div>

                          <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-200/80">
                            <span className="text-[10px] uppercase font-bold text-blue-800 block">Allocations</span>
                            <span className="text-sm font-black text-blue-950 block tabular-nums">
                              -₹{statement.totalAllocated.toLocaleString("en-IN")}
                            </span>
                            <span className="text-[9px] text-blue-700 font-semibold">{statement.allocationsList.length} sites</span>
                          </div>

                          <div className="bg-slate-900 text-white p-2.5 rounded-xl border border-slate-800">
                            <span className="text-[10px] uppercase font-bold text-amber-300 block">Available Balance</span>
                            <span className="text-sm font-black block tabular-nums text-white">
                              ₹{statement.netBalance.toLocaleString("en-IN")}
                            </span>
                            <span className="text-[9px] text-slate-300 font-medium">Net Balance</span>
                          </div>
                        </div>

                        {/* Direct Action Buttons */}
                        <div className="flex items-center gap-1.5 flex-wrap self-end lg:self-center">
                          <button
                            type="button"
                            onClick={() => {
                              setDepositForm({
                                investorId: inv.id.toString(),
                                amount: "",
                                date: new Date().toISOString().split("T")[0],
                                paymentMethod: "Bank Transfer",
                                referenceNumber: "",
                                notes: "Capital Deposit"
                              });
                              setIsDepositOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                            title="Add Capital Deposit"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Deposit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setWithdrawalForm({
                                investorId: inv.id.toString(),
                                amount: "",
                                date: new Date().toISOString().split("T")[0],
                                paymentMethod: "Bank Transfer",
                                referenceNumber: "",
                                notes: "Capital Withdrawal"
                              });
                              setIsWithdrawalOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                            title="Record Capital Withdrawal"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>Withdraw</span>
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
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                            title="Transfer Capital to Location"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>Transfer</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setExpandedInvestorId(isExpanded ? null : inv.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                              isExpanded
                                ? "bg-amber-100 text-amber-900 border-amber-300"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200"
                            }`}
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{isExpanded ? "Close Statement" : "Statement"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditInvestor(inv)}
                            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors cursor-pointer"
                            title="Edit Investor"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteInvestor(inv.id, inv.name)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors cursor-pointer"
                            title="Delete Investor"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Location Allocation Badges */}
                      {Object.keys(statement.locationBreakdown).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                            Project Allocations:
                          </span>
                          {Object.entries(statement.locationBreakdown).map(([locName, data]) => (
                            <span 
                              key={locName}
                              className="px-2.5 py-1 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                            >
                              <span>{locName}:</span>
                              <span className="text-indigo-700 font-black tabular-nums">₹{data.totalAmount.toLocaleString("en-IN")}</span>
                              <span className="text-[10px] text-indigo-500">({data.count} transfers)</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* EXPANDED STATEMENT SECTION */}
                    {isExpanded && (
                      <div className="p-4 sm:p-6 bg-gradient-to-b from-amber-50/30 via-white to-amber-50/10 space-y-4">
                        {/* Statement Sub-tabs */}
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-100/60 p-2 rounded-2xl border border-amber-200">
                          <div className="flex items-center gap-1.5 overflow-x-auto">
                            <button
                              type="button"
                              onClick={() => setInvestorDetailTab(prev => ({ ...prev, [inv.id]: "all" }))}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                activeTab === "all"
                                  ? "bg-amber-600 text-white shadow-xs"
                                  : "text-amber-950 hover:bg-amber-200/60"
                              }`}
                            >
                              All Transactions ({statement.allEntries.length})
                            </button>

                            <button
                              type="button"
                              onClick={() => setInvestorDetailTab(prev => ({ ...prev, [inv.id]: "deposits" }))}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                activeTab === "deposits"
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "text-emerald-900 hover:bg-emerald-100/80"
                              }`}
                            >
                              <span>Deposits ({statement.depositsList.length})</span>
                              <span className="font-mono text-[11px] font-black">+₹{statement.totalDeposits.toLocaleString("en-IN")}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setInvestorDetailTab(prev => ({ ...prev, [inv.id]: "withdrawals" }))}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                activeTab === "withdrawals"
                                  ? "bg-amber-700 text-white shadow-xs"
                                  : "text-amber-950 hover:bg-amber-200/80"
                              }`}
                            >
                              <span>Withdrawals ({statement.withdrawalsList.length})</span>
                              <span className="font-mono text-[11px] font-black">-₹{statement.totalWithdrawals.toLocaleString("en-IN")}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setInvestorDetailTab(prev => ({ ...prev, [inv.id]: "allocations" }))}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                activeTab === "allocations"
                                  ? "bg-indigo-600 text-white shadow-xs"
                                  : "text-indigo-950 hover:bg-indigo-100/80"
                              }`}
                            >
                              <span>Project Allocations ({statement.allocationsList.length})</span>
                              <span className="font-mono text-[11px] font-black">-₹{statement.totalAllocated.toLocaleString("en-IN")}</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDepositForm({
                                  investorId: inv.id.toString(),
                                  amount: "",
                                  date: new Date().toISOString().split("T")[0],
                                  paymentMethod: "Bank Transfer",
                                  referenceNumber: "",
                                  notes: "Capital Deposit"
                                });
                                setIsDepositOpen(true);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                            >
                              + Add Deposit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setWithdrawalForm({
                                  investorId: inv.id.toString(),
                                  amount: "",
                                  date: new Date().toISOString().split("T")[0],
                                  paymentMethod: "Bank Transfer",
                                  referenceNumber: "",
                                  notes: "Capital Withdrawal"
                                });
                                setIsWithdrawalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                            >
                              - Record Withdrawal
                            </button>
                          </div>
                        </div>

                        {/* SUB-VIEW 1: ALL ENTRIES LEDGER WITH RUNNING BALANCE */}
                        {activeTab === "all" && (
                          <div className="bg-white rounded-2xl border border-amber-300 shadow-xs overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-amber-50/80 text-amber-950 font-bold border-b border-amber-200">
                                  <tr>
                                    <th className="py-2.5 px-3">#</th>
                                    <th className="py-2.5 px-3">Date</th>
                                    <th className="py-2.5 px-3">Type</th>
                                    <th className="py-2.5 px-3">Particulars / Destination</th>
                                    <th className="py-2.5 px-3">Payment &amp; Ref</th>
                                    <th className="py-2.5 px-3 text-right text-emerald-800 bg-emerald-50/50">Deposit (+)</th>
                                    <th className="py-2.5 px-3 text-right text-rose-800 bg-rose-50/50">Deduction (-)</th>
                                    <th className="py-2.5 px-3 text-right text-slate-900 bg-amber-100/50">Balance</th>
                                    <th className="py-2.5 px-3 text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {statement.allEntries.length === 0 ? (
                                    <tr>
                                      <td colSpan={9} className="py-8 text-center text-slate-400">
                                        No transaction records found.
                                      </td>
                                    </tr>
                                  ) : (
                                    statement.allEntries.map((entry: any, idx: number) => {
                                      const isDeposit = entry.credit > 0;
                                      return (
                                        <tr key={entry.id} className="hover:bg-amber-50/30 transition-colors">
                                          <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                                            {statement.allEntries.length - idx}
                                          </td>
                                          <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                                            {entry.date}
                                          </td>
                                          <td className="py-2.5 px-3 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                              isDeposit
                                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                                : entry.type === "WITHDRAWAL"
                                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                                : "bg-blue-100 text-blue-800 border border-blue-200"
                                            }`}>
                                              {isDeposit ? <ArrowDownLeft className="w-3 h-3 text-emerald-700" /> : <ArrowUpRight className="w-3 h-3 text-rose-700" />}
                                              {entry.type === "DEPOSIT" ? "Deposit" : entry.type === "WITHDRAWAL" ? "Withdrawal" : "Allocation"}
                                            </span>
                                          </td>
                                          <td className="py-2.5 px-3 max-w-xs">
                                            <div className="font-bold text-slate-900 truncate">{entry.particulars}</div>
                                            {entry.destination && (
                                              <div className="text-[10px] text-slate-400">
                                                Destination: <span className="font-medium text-slate-600">{entry.destination}</span>
                                              </div>
                                            )}
                                          </td>
                                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                            <div className="font-medium text-[11px]">{entry.paymentMethod}</div>
                                            {entry.referenceNumber && entry.referenceNumber !== "-" && (
                                              <div className="text-[10px] text-slate-400 font-mono">Ref: #{entry.referenceNumber}</div>
                                            )}
                                          </td>
                                          <td className="py-2.5 px-3 text-right font-black text-emerald-700 bg-emerald-50/20 font-mono tabular-nums">
                                            {entry.credit > 0 ? `+₹${entry.credit.toLocaleString("en-IN")}` : "—"}
                                          </td>
                                          <td className="py-2.5 px-3 text-right font-black text-rose-700 bg-rose-50/20 font-mono tabular-nums">
                                            {entry.debit > 0 ? `-₹${entry.debit.toLocaleString("en-IN")}` : "—"}
                                          </td>
                                          <td className="py-2.5 px-3 text-right font-black font-mono bg-amber-50/30 text-slate-900 tabular-nums">
                                            ₹{entry.runningBalance.toLocaleString("en-IN")}
                                          </td>
                                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                            {entry.kind === "TRANSACTION" ? (
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteTransaction(entry.rawId)}
                                                className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                                title="Delete Transaction"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteAllocation(entry.rawId)}
                                                className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                                title="Delete Allocation"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                                {statement.allEntries.length > 0 && (
                                  <tfoot>
                                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                                      <td colSpan={5} className="py-2.5 px-3 text-right uppercase tracking-wider text-[11px]">
                                        Statement Totals:
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-emerald-800 bg-emerald-100/60 font-mono text-sm">
                                        +₹{statement.totalDeposits.toLocaleString("en-IN")}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-rose-800 bg-rose-100/60 font-mono text-sm">
                                        -₹{statement.totalDeductions.toLocaleString("en-IN")}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono text-sm bg-amber-100/60 text-slate-900">
                                        ₹{statement.netBalance.toLocaleString("en-IN")}
                                      </td>
                                      <td className="py-2.5 px-3" />
                                    </tr>
                                  </tfoot>
                                )}
                              </table>
                            </div>
                          </div>
                        )}

                        {/* SUB-VIEW 2: DEPOSITS LIST */}
                        {activeTab === "deposits" && (
                          <div className="bg-white rounded-2xl border border-emerald-300 shadow-xs overflow-hidden">
                            <div className="p-3 bg-emerald-50 border-b border-emerald-200 flex justify-between items-center text-xs font-bold text-emerald-950">
                              <span>Deposits History</span>
                              <span>Total Deposited: +₹{statement.totalDeposits.toLocaleString("en-IN")}</span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="py-2.5 px-3">Date</th>
                                    <th className="py-2.5 px-3 text-right font-black text-emerald-800">Deposit Amount</th>
                                    <th className="py-2.5 px-3">Payment Method</th>
                                    <th className="py-2.5 px-3">Ref / Cheque #</th>
                                    <th className="py-2.5 px-3">Notes</th>
                                    <th className="py-2.5 px-3 text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {statement.depositsList.length === 0 ? (
                                    <tr>
                                      <td colSpan={6} className="p-6 text-center text-slate-400">
                                        No deposit records found.
                                      </td>
                                    </tr>
                                  ) : (
                                    statement.depositsList.map((d: any) => (
                                      <tr key={d.id} className="hover:bg-emerald-50/30">
                                        <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">{d.date}</td>
                                        <td className="py-2.5 px-3 text-right font-black text-emerald-700 font-mono text-sm tabular-nums">
                                          +₹{d.credit.toLocaleString("en-IN")}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-700">{d.paymentMethod}</td>
                                        <td className="py-2.5 px-3 font-mono text-slate-500">{d.referenceNumber}</td>
                                        <td className="py-2.5 px-3 text-slate-600">{d.particulars}</td>
                                        <td className="py-2.5 px-3 text-center">
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteTransaction(d.rawId)}
                                            className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                            title="Delete Deposit"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* SUB-VIEW 3: WITHDRAWALS LIST */}
                        {activeTab === "withdrawals" && (
                          <div className="bg-white rounded-2xl border border-amber-300 shadow-xs overflow-hidden">
                            <div className="p-3 bg-amber-50 border-b border-amber-200 flex justify-between items-center text-xs font-bold text-amber-950">
                              <span>Withdrawals History</span>
                              <span>Total Withdrawn: -₹{statement.totalWithdrawals.toLocaleString("en-IN")}</span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="py-2.5 px-3">Date</th>
                                    <th className="py-2.5 px-3 text-right font-black text-amber-800">Withdrawal Amount</th>
                                    <th className="py-2.5 px-3">Payment Method</th>
                                    <th className="py-2.5 px-3">Ref / Cheque #</th>
                                    <th className="py-2.5 px-3">Notes</th>
                                    <th className="py-2.5 px-3 text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {statement.withdrawalsList.length === 0 ? (
                                    <tr>
                                      <td colSpan={6} className="p-6 text-center text-slate-400">
                                        No withdrawal records found.
                                      </td>
                                    </tr>
                                  ) : (
                                    statement.withdrawalsList.map((w: any) => (
                                      <tr key={w.id} className="hover:bg-amber-50/30">
                                        <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">{w.date}</td>
                                        <td className="py-2.5 px-3 text-right font-black text-amber-700 font-mono text-sm tabular-nums">
                                          -₹{w.debit.toLocaleString("en-IN")}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-700">{w.paymentMethod}</td>
                                        <td className="py-2.5 px-3 font-mono text-slate-500">{w.referenceNumber}</td>
                                        <td className="py-2.5 px-3 text-slate-600">{w.particulars}</td>
                                        <td className="py-2.5 px-3 text-center">
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteTransaction(w.rawId)}
                                            className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                            title="Delete Withdrawal"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* SUB-VIEW 4: LOCATION ALLOCATION LIST */}
                        {activeTab === "allocations" && (
                          <div className="bg-white rounded-2xl border border-indigo-300 shadow-xs overflow-hidden">
                            <div className="p-3 bg-indigo-50 border-b border-indigo-200 flex justify-between items-center text-xs font-bold text-indigo-950">
                              <span>Project &amp; Location Allocations</span>
                              <span>Total Allocated: -₹{statement.totalAllocated.toLocaleString("en-IN")}</span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="py-2.5 px-3">Date</th>
                                    <th className="py-2.5 px-3">Project Site</th>
                                    <th className="py-2.5 px-3 text-right font-black text-indigo-800">Allocated Amount</th>
                                    <th className="py-2.5 px-3">Payment Method</th>
                                    <th className="py-2.5 px-3">Notes</th>
                                    <th className="py-2.5 px-3 text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {statement.allocationsList.length === 0 ? (
                                    <tr>
                                      <td colSpan={6} className="p-6 text-center text-slate-400">
                                        No location allocations recorded.
                                      </td>
                                    </tr>
                                  ) : (
                                    statement.allocationsList.map((a: any) => (
                                      <tr key={a.id} className="hover:bg-indigo-50/30">
                                        <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">{a.date}</td>
                                        <td className="py-2.5 px-3 font-bold text-indigo-950 flex items-center gap-1.5">
                                          <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                                          <span>{a.locationName}</span>
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-black text-indigo-700 font-mono text-sm tabular-nums">
                                          -₹{a.debit.toLocaleString("en-IN")}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-700">{a.paymentMethod}</td>
                                        <td className="py-2.5 px-3 text-slate-600">{a.particulars}</td>
                                        <td className="py-2.5 px-3 text-center">
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteAllocation(a.rawId)}
                                            className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                            title="Delete Allocation"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* WORKFLOW VIEW 2: MASTER COMBINED CAPITAL LEDGER */}
        {workflowView === "master_ledger" && (
          <div className="space-y-4">
            {/* Filter Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setLedgerTypeFilter("ALL")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      ledgerTypeFilter === "ALL"
                        ? "bg-[#0B1D3A] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    All ({masterLedgerEntries.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerTypeFilter("DEPOSIT")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      ledgerTypeFilter === "DEPOSIT"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-emerald-800 hover:bg-emerald-50"
                    }`}
                  >
                    Deposits
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerTypeFilter("WITHDRAWAL")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      ledgerTypeFilter === "WITHDRAWAL"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "text-amber-800 hover:bg-amber-50"
                    }`}
                  >
                    Withdrawals
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerTypeFilter("ALLOCATION")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      ledgerTypeFilter === "ALLOCATION"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-blue-800 hover:bg-blue-50"
                    }`}
                  >
                    Project Allocations
                  </button>
                </div>

                {/* Investor Filter Dropdown */}
                <select
                  value={ledgerInvestorFilter}
                  onChange={(e) => setLedgerInvestorFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="ALL">All Investors</option>
                  {investors.map((inv) => (
                    <option key={inv.id} value={inv.id}>{inv.name}</option>
                  ))}
                </select>
              </div>

              <div className="text-xs font-bold text-slate-500">
                {filteredMasterLedger.length} Records Found
              </div>
            </div>

            {/* Master Ledger Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="font-bold text-slate-900 uppercase tracking-wider">Central Capital Ledger</span>
                </div>
                <span className="text-slate-600 font-bold">{filteredMasterLedger.length} Records</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5 whitespace-nowrap">Date</th>
                      <th className="p-3.5">Investor</th>
                      <th className="p-3.5">Type</th>
                      <th className="p-3.5">Particulars / Destination</th>
                      <th className="p-3.5 text-center">Payment &amp; Ref</th>
                      <th className="p-3.5 text-right font-black text-emerald-800 bg-emerald-50/40">Deposit (+)</th>
                      <th className="p-3.5 text-right font-black text-rose-800 bg-rose-50/40">Deduction (-)</th>
                      <th className="p-3.5 text-right font-black text-slate-900 bg-amber-50/40">Running Balance</th>
                      <th className="p-3.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredMasterLedger.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-10 text-center text-slate-400">
                          {ledgerSearch ? "No matching ledger records found." : "No capital transactions recorded yet."}
                        </td>
                      </tr>
                    ) : (
                      filteredMasterLedger.map((entry) => {
                        const isDeposit = entry.credit > 0;
                        return (
                          <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3.5 font-medium text-slate-600 whitespace-nowrap">{entry.date}</td>
                            <td className="p-3.5 font-bold text-slate-900">{entry.investorName}</td>
                            <td className="p-3.5 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                                isDeposit
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : entry.type === "WITHDRAWAL"
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : "bg-blue-100 text-blue-800 border border-blue-300"
                              }`}>
                                {entry.type === "DEPOSIT" ? "Deposit" : entry.type === "WITHDRAWAL" ? "Withdrawal" : "Allocation"}
                              </span>
                            </td>
                            <td className="p-3.5 text-slate-700 max-w-xs">
                              <div className="font-semibold">{entry.particulars}</div>
                              {entry.destination && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Destination: <span className="font-medium text-slate-600">{entry.destination}</span>
                                </div>
                              )}
                            </td>
                            <td className="p-3.5 text-center">
                              <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium border border-slate-200">
                                {entry.paymentMethod}
                              </span>
                              {entry.referenceNumber && entry.referenceNumber !== "-" && (
                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                  #{entry.referenceNumber}
                                </div>
                              )}
                            </td>
                            <td className="p-3.5 text-right font-black text-emerald-700 tabular-nums text-sm bg-emerald-50/20">
                              {entry.credit > 0 ? `+₹${entry.credit.toLocaleString("en-IN")}` : <span className="text-slate-300 font-normal">—</span>}
                            </td>
                            <td className="p-3.5 text-right font-black text-rose-700 tabular-nums text-sm bg-rose-50/20">
                              {entry.debit > 0 ? `-₹${entry.debit.toLocaleString("en-IN")}` : <span className="text-slate-300 font-normal">—</span>}
                            </td>
                            <td className="p-3.5 text-right font-black text-slate-900 tabular-nums text-sm bg-amber-50/20">
                              ₹{entry.runningBalance.toLocaleString("en-IN")}
                            </td>
                            <td className="p-3.5 text-center">
                              {entry.kind === "TRANSACTION" ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTransaction(entry.rawId)}
                                  className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                  title="Delete Transaction"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAllocation(entry.rawId)}
                                  className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                  title="Delete Allocation"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 1: ADD INVESTOR */}
        <Modal
          isOpen={isAddInvestorOpen}
          onClose={() => setIsAddInvestorOpen(false)}
          title="Add New Investor"
        >
          <form onSubmit={handleAddInvestor} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Investor Name *</label>
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
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mobile Number</label>
                <input
                  type="text"
                  placeholder="9876543210"
                  value={newInvestorForm.mobile}
                  onChange={(e) => setNewInvestorForm({ ...newInvestorForm, mobile: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email Address</label>
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
              <span className="text-xs font-bold text-blue-900 block">Initial Capital Deposit (Optional)</span>
              
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
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-200"
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

        {/* MODAL 2: EDIT INVESTOR */}
        <Modal
          isOpen={isEditInvestorOpen}
          onClose={() => {
            setIsEditInvestorOpen(false);
            setEditingInvestorId(null);
          }}
          title="Edit Investor Profile"
        >
          <form onSubmit={handleUpdateInvestor} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Investor Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Patel"
                value={editInvestorForm.name}
                onChange={(e) => setEditInvestorForm({ ...editInvestorForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mobile Number</label>
                <input
                  type="text"
                  placeholder="9876543210"
                  value={editInvestorForm.mobile}
                  onChange={(e) => setEditInvestorForm({ ...editInvestorForm, mobile: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="investor@example.com"
                  value={editInvestorForm.email}
                  onChange={(e) => setEditInvestorForm({ ...editInvestorForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Address / City</label>
              <input
                type="text"
                placeholder="City, State"
                value={editInvestorForm.address}
                onChange={(e) => setEditInvestorForm({ ...editInvestorForm, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes</label>
              <textarea
                rows={2}
                placeholder="Additional investor remarks..."
                value={editInvestorForm.notes}
                onChange={(e) => setEditInvestorForm({ ...editInvestorForm, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsEditInvestorOpen(false);
                  setEditingInvestorId(null);
                }}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
              >
                Update Profile
              </button>
            </div>
          </form>
        </Modal>

        {/* MODAL 3: ADD CAPITAL DEPOSIT */}
        <Modal
          isOpen={isDepositOpen}
          onClose={() => setIsDepositOpen(false)}
          title="Add Capital Deposit"
        >
          <form onSubmit={handleDepositCapital} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Investor *</label>
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
                placeholder="e.g. Additional capital round"
                value={depositForm.notes}
                onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDepositOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-200"
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

        {/* MODAL 4: RECORD CAPITAL WITHDRAWAL */}
        <Modal
          isOpen={isWithdrawalOpen}
          onClose={() => setIsWithdrawalOpen(false)}
          title="Record Capital Withdrawal"
        >
          <form onSubmit={handleWithdrawal} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Investor *</label>
              <select
                required
                value={withdrawalForm.investorId}
                onChange={(e) => setWithdrawalForm({ ...withdrawalForm, investorId: e.target.value })}
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
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Withdrawal Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="50000"
                  value={withdrawalForm.amount}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={withdrawalForm.date}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Method</label>
                <select
                  value={withdrawalForm.paymentMethod}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, paymentMethod: e.target.value })}
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
                  value={withdrawalForm.referenceNumber}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, referenceNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes</label>
              <input
                type="text"
                placeholder="e.g. Capital return to investor"
                value={withdrawalForm.notes}
                onChange={(e) => setWithdrawalForm({ ...withdrawalForm, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsWithdrawalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
              >
                Record Withdrawal
              </button>
            </div>
          </form>
        </Modal>

        {/* MODAL 5: TRANSFER TO PROJECT LOCATION */}
        <Modal
          isOpen={isAllocationOpen}
          onClose={() => setIsAllocationOpen(false)}
          title="Transfer Capital to Location"
        >
          <form onSubmit={handleAllocate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Investor *</label>
              <select
                required
                value={allocationForm.investorId}
                onChange={(e) => setAllocationForm({ ...allocationForm, investorId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              >
                <option value="">-- Choose Investor --</option>
                {investors.map((inv) => {
                  const avail = Number(inv.availableBalance ?? inv.availableCapital ?? 0);
                  return (
                    <option key={inv.id} value={inv.id}>
                      {inv.name} (Available: ₹{avail.toLocaleString("en-IN")})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Project / Location *</label>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Transfer Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="200000"
                  value={allocationForm.amount}
                  onChange={(e) => setAllocationForm({ ...allocationForm, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={allocationForm.date}
                  onChange={(e) => setAllocationForm({ ...allocationForm, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Method</label>
                <select
                  value={allocationForm.paymentMethod}
                  onChange={(e) => setAllocationForm({ ...allocationForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Bank Transfer">Bank Transfer / NEFT / RTGS</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI / GPay</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Reference / Notes</label>
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={allocationForm.notes}
                  onChange={(e) => setAllocationForm({ ...allocationForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAllocationOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
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
