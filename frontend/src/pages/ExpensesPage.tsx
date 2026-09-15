import React, { useState, useEffect, useMemo } from "react";
import { 
  Wallet, Plus, Search, Filter, Trash2, ArrowDownRight, 
  ArrowUpRight, IndianRupee, ShieldAlert, CheckCircle2, 
  AlertCircle, X, Building2, UserCheck, Landmark, Download
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { Modal } from "../components/ui/Modal";

interface RecordItem {
  id: number;
  type: "INCOME" | "EXPENSE";
  amount: string | number;
  date: string;
  partyName: string;
  teamName?: string | null;
  category?: string | null;
  description?: string | null;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
  locationId?: number;
  locationName?: string | null;
}

interface SupervisorCostItem {
  id: number;
  locationId: number;
  date: string;
  supervisorName: string;
  amount: string | number;
  description?: string | null;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
}

interface InvestmentParty {
  id: number;
  locationId: number;
  partyName: string;
  totalInvestment?: number;
  totalPayment?: number;
  totalUpad?: number;
  balance?: number;
}

interface InvestmentTransaction {
  id: number;
  partyId: number;
  partyName?: string;
  type: "INVESTMENT" | "PAYMENT" | "UPAD";
  amount: string | number;
  date: string;
  description?: string | null;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
}

export default function ExpensesPage() {
  const [activeTab, setActiveTab] = useState<"expenses" | "supervisor" | "income" | "investments">("expenses");
  
  // Data states
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [supervisorCosts, setSupervisorCosts] = useState<SupervisorCostItem[]>([]);
  const [investmentParties, setInvestmentParties] = useState<InvestmentParty[]>([]);
  const [investmentTxs, setInvestmentTxs] = useState<InvestmentTransaction[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // Notifications
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSupervisorModalOpen, setIsSupervisorModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isInvestmentModalOpen, setIsInvestmentModalOpen] = useState(false);

  // Forms
  const [expenseForm, setExpenseForm] = useState({
    locationId: 0,
    date: new Date().toISOString().split("T")[0],
    amount: "",
    partyName: "",
    category: "Site Expenses",
    description: "",
    paymentMethod: "CASH",
    referenceNumber: ""
  });

  const [supervisorForm, setSupervisorForm] = useState({
    locationId: 0,
    date: new Date().toISOString().split("T")[0],
    supervisorName: "",
    amount: "",
    description: "",
    paymentMethod: "CASH",
    referenceNumber: ""
  });

  const [incomeForm, setIncomeForm] = useState({
    locationId: 0,
    date: new Date().toISOString().split("T")[0],
    amount: "",
    partyName: "",
    category: "Service Income",
    description: "",
    paymentMethod: "BANK",
    referenceNumber: ""
  });

  const [investmentForm, setInvestmentForm] = useState({
    locationId: 0,
    partyId: 0,
    newPartyName: "",
    type: "INVESTMENT" as "INVESTMENT" | "PAYMENT" | "UPAD",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
    paymentMethod: "BANK",
    referenceNumber: ""
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recData, supData, locData, invPartiesData, invTxData] = await Promise.all([
        apiFetch("/records/all").catch(() => []),
        apiFetch("/supervisor-costs").catch(() => []),
        apiFetch("/locations").catch(() => []),
        apiFetch("/investments/parties").catch(() => []),
        apiFetch("/investments/transactions").catch(() => [])
      ]);

      const locs = Array.isArray(locData) ? locData : [];
      setLocations(locs);
      setRecords(Array.isArray(recData) ? recData : []);
      setSupervisorCosts(Array.isArray(supData) ? supData : []);
      setInvestmentParties(Array.isArray(invPartiesData) ? invPartiesData : []);
      setInvestmentTxs(Array.isArray(invTxData) ? invTxData : []);

      if (locs.length > 0) {
        if (!expenseForm.locationId) setExpenseForm(prev => ({ ...prev, locationId: locs[0].id }));
        if (!supervisorForm.locationId) setSupervisorForm(prev => ({ ...prev, locationId: locs[0].id }));
        if (!incomeForm.locationId) setIncomeForm(prev => ({ ...prev, locationId: locs[0].id }));
        if (!investmentForm.locationId) setInvestmentForm(prev => ({ ...prev, locationId: locs[0].id }));
      }
    } catch (err) {
      console.error("Failed to load expense and income data:", err);
      setActionError("Failed to load financial records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (val: string | number) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(num);
  };

  // Metrics
  const expenseRecords = useMemo(() => records.filter(r => r.type === "EXPENSE"), [records]);
  const incomeRecords = useMemo(() => records.filter(r => r.type === "INCOME"), [records]);

  const metrics = useMemo(() => {
    const totalOpsExpense = expenseRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalSupervisorCost = supervisorCosts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalIncome = incomeRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalInvestments = investmentTxs
      .filter(t => t.type === "INVESTMENT")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const totalAllExpenses = totalOpsExpense + totalSupervisorCost;
    const netCashFlow = totalIncome - totalAllExpenses;

    return {
      totalOpsExpense,
      totalSupervisorCost,
      totalAllExpenses,
      totalIncome,
      totalInvestments,
      netCashFlow
    };
  }, [expenseRecords, supervisorCosts, incomeRecords, investmentTxs]);

  // Categories list
  const categoriesList = useMemo(() => {
    const cats = new Set(expenseRecords.map(r => r.category).filter(Boolean) as string[]);
    return Array.from(cats);
  }, [expenseRecords]);

  // Handle Submissions
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) {
      setActionError("Valid amount is required");
      return;
    }
    try {
      await apiFetch("/records", {
        method: "POST",
        body: JSON.stringify({
          ...expenseForm,
          type: "EXPENSE",
          amount: Number(expenseForm.amount),
          locationId: expenseForm.locationId || locations[0]?.id
        })
      });
      setActionSuccess("Expense record saved successfully");
      setIsExpenseModalOpen(false);
      setExpenseForm(prev => ({ ...prev, amount: "", partyName: "", description: "" }));
      fetchData();
    } catch (err: any) {
      setActionError(err.message || "Failed to record expense");
    }
  };

  const handleSupervisorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorForm.supervisorName.trim() || !supervisorForm.amount) {
      setActionError("Supervisor name and amount are required");
      return;
    }
    try {
      await apiFetch("/supervisor-costs", {
        method: "POST",
        body: JSON.stringify({
          ...supervisorForm,
          amount: Number(supervisorForm.amount),
          locationId: supervisorForm.locationId || locations[0]?.id
        })
      });
      setActionSuccess("Supervisor cost entry saved successfully");
      setIsSupervisorModalOpen(false);
      setSupervisorForm(prev => ({ ...prev, supervisorName: "", amount: "", description: "" }));
      fetchData();
    } catch (err: any) {
      setActionError(err.message || "Failed to save supervisor cost");
    }
  };

  const handleIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomeForm.amount || Number(incomeForm.amount) <= 0) {
      setActionError("Valid amount is required");
      return;
    }
    try {
      await apiFetch("/records", {
        method: "POST",
        body: JSON.stringify({
          ...incomeForm,
          type: "INCOME",
          amount: Number(incomeForm.amount),
          locationId: incomeForm.locationId || locations[0]?.id
        })
      });
      setActionSuccess("Income record saved successfully");
      setIsIncomeModalOpen(false);
      setIncomeForm(prev => ({ ...prev, amount: "", partyName: "", description: "" }));
      fetchData();
    } catch (err: any) {
      setActionError(err.message || "Failed to record income");
    }
  };

  const handleInvestmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!investmentForm.amount || Number(investmentForm.amount) <= 0) {
      setActionError("Valid investment amount is required");
      return;
    }

    try {
      let targetPartyId = investmentForm.partyId;
      // If new party is typed
      if (!targetPartyId && investmentForm.newPartyName.trim()) {
        const newParty = await apiFetch("/investments/parties", {
          method: "POST",
          body: JSON.stringify({
            locationId: investmentForm.locationId || locations[0]?.id,
            partyName: investmentForm.newPartyName.trim()
          })
        });
        targetPartyId = newParty.id;
      }

      if (!targetPartyId) {
        setActionError("Please select or specify an investor/partner");
        return;
      }

      await apiFetch("/investments/transactions", {
        method: "POST",
        body: JSON.stringify({
          partyId: targetPartyId,
          type: investmentForm.type,
          amount: Number(investmentForm.amount),
          date: investmentForm.date,
          description: investmentForm.description,
          paymentMethod: investmentForm.paymentMethod,
          referenceNumber: investmentForm.referenceNumber
        })
      });

      setActionSuccess("Investment transaction saved");
      setIsInvestmentModalOpen(false);
      setInvestmentForm(prev => ({ ...prev, amount: "", description: "", newPartyName: "" }));
      fetchData();
    } catch (err: any) {
      setActionError(err.message || "Failed to save investment transaction");
    }
  };

  const handleDeleteRecord = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      await apiFetch(`/records/${id}`, { method: "DELETE" });
      setActionSuccess("Record removed");
      fetchData();
    } catch (err: any) {
      setActionError(err.message || "Failed to delete record");
    }
  };

  const handleDeleteSupervisor = async (id: number) => {
    if (!window.confirm("Delete supervisor cost record?")) return;
    try {
      await apiFetch(`/supervisor-costs/${id}`, { method: "DELETE" });
      setActionSuccess("Supervisor cost removed");
      fetchData();
    } catch (err: any) {
      setActionError(err.message || "Failed to delete supervisor cost");
    }
  };

  // Filtered views
  const filteredExpenses = useMemo(() => {
    return expenseRecords.filter(r => {
      const matchSearch = 
        r.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.category && r.category.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchLoc = selectedLocationId === "ALL" || r.locationId === Number(selectedLocationId);
      const matchCat = selectedCategory === "ALL" || r.category === selectedCategory;
      return matchSearch && matchLoc && matchCat;
    });
  }, [expenseRecords, searchQuery, selectedLocationId, selectedCategory]);

  const filteredSupervisors = useMemo(() => {
    return supervisorCosts.filter(s => {
      const matchSearch = 
        s.supervisorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchLoc = selectedLocationId === "ALL" || s.locationId === Number(selectedLocationId);
      return matchSearch && matchLoc;
    });
  }, [supervisorCosts, searchQuery, selectedLocationId]);

  const filteredIncome = useMemo(() => {
    return incomeRecords.filter(r => {
      const matchSearch = 
        r.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchLoc = selectedLocationId === "ALL" || r.locationId === Number(selectedLocationId);
      return matchSearch && matchLoc;
    });
  }, [incomeRecords, searchQuery, selectedLocationId]);

  const filteredInvestments = useMemo(() => {
    return investmentTxs.filter(t => {
      const party = investmentParties.find(p => p.id === t.partyId);
      const partyName = party ? party.partyName : "";
      const matchSearch = 
        partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchSearch;
    });
  }, [investmentTxs, investmentParties, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center justify-between text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-rose-500 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-rose-600">
            <X size={16} />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center justify-between text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-emerald-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Wallet className="w-7 h-7 text-indigo-600" />
            Income & Expenses
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Site operational expenses, supervisor costs, operating revenues, and capital investment accounts
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {activeTab === "expenses" && (
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-xl transition shadow-sm"
            >
              <Plus size={16} />
              Record Expense
            </button>
          )}

          {activeTab === "supervisor" && (
            <button
              onClick={() => setIsSupervisorModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition shadow-sm"
            >
              <Plus size={16} />
              Record Supervisor Cost
            </button>
          )}

          {activeTab === "income" && (
            <button
              onClick={() => setIsIncomeModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl transition shadow-sm"
            >
              <Plus size={16} />
              Record Income
            </button>
          )}

          {activeTab === "investments" && (
            <button
              onClick={() => setIsInvestmentModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition shadow-sm"
            >
              <Plus size={16} />
              Record Capital Entry
            </button>
          )}
        </div>
      </div>

      {/* Executive Financial Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Expenses</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <ArrowDownRight size={15} />
            </div>
          </div>
          <div className="text-xl font-bold text-rose-600">{formatCurrency(metrics.totalAllExpenses)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Direct + Supervisor Overhead</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Supervisor Overhead</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <UserCheck size={15} />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-600">{formatCurrency(metrics.totalSupervisorCost)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{supervisorCosts.length} supervisor payments</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Business Income</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ArrowUpRight size={15} />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-600">{formatCurrency(metrics.totalIncome)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Operating & misc revenue</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Partner Capital</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Landmark size={15} />
            </div>
          </div>
          <div className="text-xl font-bold text-indigo-600">{formatCurrency(metrics.totalInvestments)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{investmentParties.length} partners / investors</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Net Operating Pos.</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${metrics.netCashFlow >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
              <IndianRupee size={15} />
            </div>
          </div>
          <div className={`text-xl font-bold ${metrics.netCashFlow >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {formatCurrency(metrics.netCashFlow)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Income vs Operational Outflows</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {/* Module Sub-tabs */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab("expenses")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                activeTab === "expenses" ? "bg-white text-rose-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Operating Expenses ({expenseRecords.length})
            </button>
            <button
              onClick={() => setActiveTab("supervisor")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                activeTab === "supervisor" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Supervisor Costs ({supervisorCosts.length})
            </button>
            <button
              onClick={() => setActiveTab("income")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                activeTab === "income" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Business Incomes ({incomeRecords.length})
            </button>
            <button
              onClick={() => setActiveTab("investments")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                activeTab === "investments" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Capital & Investments ({investmentParties.length})
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            {/* Search */}
            <div className="relative flex-1 sm:w-56">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search descriptions, parties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Location selector */}
            <div className="flex items-center gap-1 text-xs">
              <Building2 size={14} className="text-slate-400" />
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Branches</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            {/* Category filter if expenses */}
            {activeTab === "expenses" && categoriesList.length > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <Filter size={14} className="text-slate-400" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All Categories</option>
                  {categoriesList.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Tab 1: Operating Expenses */}
        {activeTab === "expenses" && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-12 text-slate-400">Loading expense vouchers...</div>
            ) : filteredExpenses.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Wallet size={32} className="mx-auto mb-2 text-slate-300" />
                <p>No operational expenses recorded.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Paid To / Party</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Branch</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredExpenses.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 font-medium text-slate-900 whitespace-nowrap">{r.date}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{r.partyName}</td>
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                          {r.category || "General"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 max-w-xs truncate">{r.description || "-"}</td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{r.locationName || "-"}</td>
                      <td className="py-3 px-3 text-right font-bold text-rose-600 whitespace-nowrap">
                        {formatCurrency(r.amount)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleDeleteRecord(r.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="Delete Record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Site Supervisor Costs */}
        {activeTab === "supervisor" && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-12 text-slate-400">Loading supervisor entries...</div>
            ) : filteredSupervisors.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <UserCheck size={32} className="mx-auto mb-2 text-slate-300" />
                <p>No supervisor cost entries recorded.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Supervisor Name</th>
                    <th className="py-2.5 px-3">Description / Task</th>
                    <th className="py-2.5 px-3">Payment Mode</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredSupervisors.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 font-medium text-slate-900 whitespace-nowrap">{s.date}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{s.supervisorName}</td>
                      <td className="py-3 px-3 text-slate-500">{s.description || "Site supervision"}</td>
                      <td className="py-3 px-3 text-slate-600 font-medium">{s.paymentMethod || "CASH"}</td>
                      <td className="py-3 px-3 text-right font-bold text-amber-600 whitespace-nowrap">
                        {formatCurrency(s.amount)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleDeleteSupervisor(s.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="Delete Supervisor Cost"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 3: Business Incomes */}
        {activeTab === "income" && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-12 text-slate-400">Loading income entries...</div>
            ) : filteredIncome.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ArrowUpRight size={32} className="mx-auto mb-2 text-slate-300" />
                <p>No operational income recorded.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Received From / Client</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Branch</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredIncome.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 font-medium text-slate-900 whitespace-nowrap">{r.date}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{r.partyName}</td>
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700">
                          {r.category || "Service"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 max-w-xs truncate">{r.description || "-"}</td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{r.locationName || "-"}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                        {formatCurrency(r.amount)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleDeleteRecord(r.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="Delete Record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 4: Capital & Investments */}
        {activeTab === "investments" && (
          <div className="space-y-6">
            {/* Investor Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {investmentParties.map(p => (
                <div key={p.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-sm">{p.partyName}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                      Partner / Investor
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/60">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Total Invested:</span>
                      <span className="font-semibold text-slate-800">{formatCurrency(p.totalInvestment || 0)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Repayments / Drawings:</span>
                      <span className="font-semibold text-amber-600">
                        {formatCurrency((p.totalPayment || 0) + (p.totalUpad || 0))}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Net Capital Balance:</span>
                    <span className="font-bold text-indigo-600">{formatCurrency(p.balance || 0)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Investment Transactions Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Partner / Investor</th>
                    <th className="py-2.5 px-3">Entry Type</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Payment Mode</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredInvestments.map(t => {
                    const party = investmentParties.find(p => p.id === t.partyId);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 font-medium text-slate-900 whitespace-nowrap">{t.date}</td>
                        <td className="py-3 px-3 font-semibold text-slate-900">{party?.partyName || "Partner"}</td>
                        <td className="py-3 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            t.type === "INVESTMENT" ? "bg-indigo-50 text-indigo-700" :
                            t.type === "PAYMENT" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                          }`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-500">{t.description || "-"}</td>
                        <td className="py-3 px-3 text-slate-600 font-medium">{t.paymentMethod || "BANK"}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                          {formatCurrency(t.amount)}
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

      {/* Record Expense Modal */}
      <Modal 
        isOpen={isExpenseModalOpen} 
        onClose={() => setIsExpenseModalOpen(false)}
        title="Record Operational Expense"
      >
        <form onSubmit={handleExpenseSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Branch / Location *</label>
              <select
                value={expenseForm.locationId}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, locationId: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              >
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                value={expenseForm.date}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹) *</label>
              <input
                type="number"
                placeholder="0.00"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none font-bold text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Paid To / Vendor *</label>
              <input
                type="text"
                placeholder="e.g. Shell Petrol Pump / Hardware Shop"
                value={expenseForm.partyName}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, partyName: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="Site Expenses">Site Expenses</option>
                <option value="Fuel & Diesel">Fuel & Diesel</option>
                <option value="Equipment Rental">Equipment Rental</option>
                <option value="Tools & Hardware">Tools & Hardware</option>
                <option value="Transportation">Transportation</option>
                <option value="Office & Utilities">Office & Utilities</option>
                <option value="Food & Refreshment">Food & Refreshment</option>
                <option value="Miscellaneous">Miscellaneous</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={expenseForm.paymentMethod}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="CASH">Cash</option>
                <option value="BANK">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Bill Notes</label>
            <input
              type="text"
              placeholder="e.g. Generator diesel 50L for slab casting"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsExpenseModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition shadow-sm"
            >
              Save Expense Voucher
            </button>
          </div>
        </form>
      </Modal>

      {/* Supervisor Cost Modal */}
      <Modal
        isOpen={isSupervisorModalOpen}
        onClose={() => setIsSupervisorModalOpen(false)}
        title="Record Site Supervisor Cost"
      >
        <form onSubmit={handleSupervisorSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Branch / Location *</label>
              <select
                value={supervisorForm.locationId}
                onChange={(e) => setSupervisorForm(prev => ({ ...prev, locationId: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              >
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                value={supervisorForm.date}
                onChange={(e) => setSupervisorForm(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supervisor Name *</label>
              <input
                type="text"
                placeholder="e.g. Rajesh Patil"
                value={supervisorForm.supervisorName}
                onChange={(e) => setSupervisorForm(prev => ({ ...prev, supervisorName: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹) *</label>
              <input
                type="number"
                placeholder="0.00"
                value={supervisorForm.amount}
                onChange={(e) => setSupervisorForm(prev => ({ ...prev, amount: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none font-bold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Mode</label>
              <select
                value={supervisorForm.paymentMethod}
                onChange={(e) => setSupervisorForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="CASH">Cash</option>
                <option value="BANK">Bank Transfer</option>
                <option value="UPI">UPI</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Month</label>
              <input
                type="text"
                placeholder="e.g. Monthly site management fee"
                value={supervisorForm.description}
                onChange={(e) => setSupervisorForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsSupervisorModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm"
            >
              Save Supervisor Entry
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Business Income Modal */}
      <Modal
        isOpen={isIncomeModalOpen}
        onClose={() => setIsIncomeModalOpen(false)}
        title="Record Operating Income"
      >
        <form onSubmit={handleIncomeSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Branch / Location *</label>
              <select
                value={incomeForm.locationId}
                onChange={(e) => setIncomeForm(prev => ({ ...prev, locationId: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              >
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                value={incomeForm.date}
                onChange={(e) => setIncomeForm(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹) *</label>
              <input
                type="number"
                placeholder="0.00"
                value={incomeForm.amount}
                onChange={(e) => setIncomeForm(prev => ({ ...prev, amount: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none font-bold text-emerald-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Received From *</label>
              <input
                type="text"
                placeholder="e.g. Apex Infra / Scrap Buyer"
                value={incomeForm.partyName}
                onChange={(e) => setIncomeForm(prev => ({ ...prev, partyName: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={incomeForm.category}
                onChange={(e) => setIncomeForm(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="Service Income">Service Income</option>
                <option value="Scrap Sale">Scrap Sale</option>
                <option value="Machinery Rent Out">Machinery Rent Out</option>
                <option value="Commission">Commission</option>
                <option value="Miscellaneous">Miscellaneous</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Mode</label>
              <select
                value={incomeForm.paymentMethod}
                onChange={(e) => setIncomeForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="BANK">Bank Transfer</option>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <input
              type="text"
              placeholder="e.g. Steel scrap disposal"
              value={incomeForm.description}
              onChange={(e) => setIncomeForm(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsIncomeModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-sm"
            >
              Save Income Record
            </button>
          </div>
        </form>
      </Modal>

      {/* Capital & Investment Entry Modal */}
      <Modal
        isOpen={isInvestmentModalOpen}
        onClose={() => setIsInvestmentModalOpen(false)}
        title="Record Capital & Investment Entry"
      >
        <form onSubmit={handleInvestmentSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Partner / Investor</label>
              <select
                value={investmentForm.partyId}
                onChange={(e) => setInvestmentForm(prev => ({ ...prev, partyId: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value={0}>-- Or type new below --</option>
                {investmentParties.map(p => (
                  <option key={p.id} value={p.id}>{p.partyName}</option>
                ))}
              </select>
            </div>

            {!investmentForm.partyId && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Partner Name</label>
                <input
                  type="text"
                  placeholder="e.g. Anand Patel (Partner)"
                  value={investmentForm.newPartyName}
                  onChange={(e) => setInvestmentForm(prev => ({ ...prev, newPartyName: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Entry Type *</label>
              <select
                value={investmentForm.type}
                onChange={(e) => setInvestmentForm(prev => ({ ...prev, type: e.target.value as any }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none font-semibold"
              >
                <option value="INVESTMENT">Investment (Capital In)</option>
                <option value="PAYMENT">Payment (Capital Return)</option>
                <option value="UPAD">Upad (Personal Drawing)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹) *</label>
              <input
                type="number"
                placeholder="0.00"
                value={investmentForm.amount}
                onChange={(e) => setInvestmentForm(prev => ({ ...prev, amount: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                value={investmentForm.date}
                onChange={(e) => setInvestmentForm(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Description</label>
            <input
              type="text"
              placeholder="e.g. Partner equity contribution for machinery"
              value={investmentForm.description}
              onChange={(e) => setInvestmentForm(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsInvestmentModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm"
            >
              Save Capital Record
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
