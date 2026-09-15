import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { 
  Plus, Trash2, Landmark, TrendingUp, TrendingDown, 
  Users, Search, Filter, Calendar, CreditCard, 
  FileText, ArrowDownLeft, ArrowUpRight, Eye, RefreshCw, X
} from "lucide-react";

export type InvestmentSubCategory = "INVESTMENT" | "UPAD" | "PARTIES";

interface InvestmentParty {
  id: number;
  locationId: number;
  partyName: string;
  totalInvestment: number;
  totalPayment: number;
  totalUpad: number;
  balance: number;
  createdAt: string;
}

interface InvestmentTransaction {
  id: number;
  partyId: number;
  userId: number;
  type: "INVESTMENT" | "UPAD" | "PAYMENT";
  amount: string;
  date: string;
  description: string | null;
  paymentMethod: string | null;
  referenceNumber: string | null;
  createdAt: string;
  partyName: string;
  locationId: number;
}

interface InvestmentTabProps {
  locationId: number;
  activeSubCategory?: InvestmentSubCategory;
  onSubCategoryChange?: (subCategory: InvestmentSubCategory) => void;
}

export default function InvestmentTab({ 
  locationId, 
  activeSubCategory: controlledSubCategory, 
  onSubCategoryChange 
}: InvestmentTabProps) {
  // Sub-category state: 1st is INVESTMENT, 2nd is UPAD, 3rd is PARTIES (Overview)
  const [internalSubCategory, setInternalSubCategory] = useState<InvestmentSubCategory>("INVESTMENT");
  const subCategory = controlledSubCategory || internalSubCategory;

  const handleSetSubCategory = (cat: InvestmentSubCategory) => {
    if (onSubCategoryChange) {
      onSubCategoryChange(cat);
    }
    setInternalSubCategory(cat);
  };

  const [parties, setParties] = useState<InvestmentParty[]>([]);
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPartyFilter, setSelectedPartyFilter] = useState<string>("ALL");

  // Modals
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [statementParty, setStatementParty] = useState<InvestmentParty | null>(null);

  // Form states
  const [newPartyName, setNewPartyName] = useState("");
  const [txData, setTxData] = useState({
    partyId: "",
    type: "INVESTMENT" as "INVESTMENT" | "UPAD",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Cash",
    referenceNumber: "",
    description: "",
  });
  const [isInlinePartyMode, setIsInlinePartyMode] = useState(false);
  const [inlinePartyName, setInlinePartyName] = useState("");

  useEffect(() => {
    loadAllData();
  }, [locationId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [partiesRes, txsRes] = await Promise.all([
        apiFetch(`/investments/parties?locationId=${locationId}`),
        apiFetch(`/investments/transactions?locationId=${locationId}`)
      ]);
      setParties(partiesRes || []);
      setTransactions(txsRes || []);
    } catch (error) {
      console.error("Failed to load investment data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    let totalInvestment = 0;
    let totalUpad = 0;
    let totalInvEntries = 0;
    let totalUpadEntries = 0;

    transactions.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === "INVESTMENT") {
        totalInvestment += amt;
        totalInvEntries += 1;
      } else if (t.type === "UPAD") {
        totalUpad += amt;
        totalUpadEntries += 1;
      }
    });

    return {
      totalInvestment,
      totalUpad,
      netBalance: totalInvestment - totalUpad,
      totalInvEntries,
      totalUpadEntries,
      totalParties: parties.length
    };
  }, [transactions, parties]);

  // Filtered transactions according to active sub category and search/filters
  const currentCategoryTransactions = useMemo(() => {
    if (subCategory === "PARTIES") return [];

    return transactions.filter(t => {
      // Must match sub-category type (INVESTMENT or UPAD)
      if (t.type !== subCategory) return false;

      // Party filter
      if (selectedPartyFilter !== "ALL" && t.partyId.toString() !== selectedPartyFilter) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const partyMatch = t.partyName?.toLowerCase().includes(query);
        const descMatch = t.description?.toLowerCase().includes(query);
        const refMatch = t.referenceNumber?.toLowerCase().includes(query);
        const methodMatch = t.paymentMethod?.toLowerCase().includes(query);
        const amountMatch = t.amount?.toString().includes(query);
        return partyMatch || descMatch || refMatch || methodMatch || amountMatch;
      }

      return true;
    });
  }, [transactions, subCategory, selectedPartyFilter, searchTerm]);

  // Filtered parties for Parties Overview
  const filteredParties = useMemo(() => {
    if (!searchTerm.trim()) return parties;
    const query = searchTerm.toLowerCase();
    return parties.filter(p => p.partyName.toLowerCase().includes(query));
  }, [parties, searchTerm]);

  // Actions
  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartyName.trim()) return;
    try {
      await apiFetch("/investments/parties", {
        method: "POST",
        body: JSON.stringify({ locationId, partyName: newPartyName.trim() }),
      });
      setIsPartyModalOpen(false);
      setNewPartyName("");
      await loadAllData();
    } catch (error: any) {
      alert(error.message || "Failed to add party");
    }
  };

  const handleOpenAddTx = (type: "INVESTMENT" | "UPAD", partyId?: number) => {
    setTxData({
      partyId: partyId ? partyId.toString() : (parties[0]?.id ? parties[0].id.toString() : ""),
      type,
      amount: "",
      date: new Date().toISOString().split("T")[0],
      paymentMethod: "Cash",
      referenceNumber: "",
      description: "",
    });
    setIsInlinePartyMode(false);
    setInlinePartyName("");
    setIsTxModalOpen(true);
  };

  const handleCreateTx = async (e: React.FormEvent) => {
    e.preventDefault();

    let targetPartyId = parseInt(txData.partyId, 10);

    // If user typed a new party name inline
    if (isInlinePartyMode) {
      if (!inlinePartyName.trim()) {
        alert("Please enter a party name");
        return;
      }
      try {
        const newParty = await apiFetch("/investments/parties", {
          method: "POST",
          body: JSON.stringify({ locationId, partyName: inlinePartyName.trim() }),
        });
        targetPartyId = newParty.id;
      } catch (error: any) {
        alert(error.message || "Failed to create party");
        return;
      }
    }

    if (!targetPartyId || isNaN(targetPartyId)) {
      alert("Please select or create a party first");
      return;
    }

    if (!txData.amount || parseFloat(txData.amount) <= 0) {
      alert("Please enter a valid positive amount");
      return;
    }

    try {
      await apiFetch("/investments/transactions", {
        method: "POST",
        body: JSON.stringify({
          partyId: targetPartyId,
          type: txData.type,
          amount: parseFloat(txData.amount),
          date: txData.date,
          paymentMethod: txData.paymentMethod || null,
          referenceNumber: txData.referenceNumber || null,
          description: txData.description || null,
        }),
      });

      setIsTxModalOpen(false);
      await loadAllData();
    } catch (error: any) {
      alert(error.message || "Failed to save transaction");
    }
  };

  const handleDeleteTx = async (id: number) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    try {
      await apiFetch(`/investments/transactions/${id}`, { method: "DELETE" });
      await loadAllData();
    } catch (error: any) {
      alert(error.message || "Failed to delete transaction");
    }
  };

  const handleDeleteParty = async (partyId: number, partyName: string) => {
    if (!confirm(`Are you sure you want to delete party "${partyName}"? This will also remove all their associated investment and upad records.`)) {
      return;
    }
    try {
      await apiFetch(`/investments/parties/${partyId}`, { method: "DELETE" });
      await loadAllData();
    } catch (error: any) {
      alert(error.message || "Failed to delete party");
    }
  };

  const handleOpenStatement = (party: InvestmentParty) => {
    setStatementParty(party);
    setIsStatementModalOpen(true);
  };

  const partyStatementTxs = useMemo(() => {
    if (!statementParty) return [];
    return transactions.filter(t => t.partyId === statementParty.id);
  }, [statementParty, transactions]);

  return (
    <div className="space-y-6" id="investment-category-container">
      {/* Sub-Category Navigation Bar: 1st is Investment, 2nd is Upad */}
      <div className="bg-slate-50/80 p-1.5 rounded-2xl border border-gray-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-1.5 overflow-x-auto p-0.5 no-scrollbar">
          {/* 1st Sub-Category: Investment */}
          <button type="button"
            id="subcat-btn-investment"
            onClick={() => handleSetSubCategory("INVESTMENT")}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
              subCategory === "INVESTMENT"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20 scale-[1.01]"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
            }`}
          >
            <div className={`p-1 rounded-lg ${subCategory === "INVESTMENT" ? "bg-white/20" : "bg-emerald-100/70 text-emerald-700"}`}>
              <TrendingUp className="w-4 h-4" />
            </div>
            <span>1. Investment</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              subCategory === "INVESTMENT" ? "bg-emerald-700/80 text-white" : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
            }`}>
              ₹{metrics.totalInvestment.toLocaleString()}
            </span>
          </button>

          {/* 2nd Sub-Category: Upad */}
          <button type="button"
            id="subcat-btn-upad"
            onClick={() => handleSetSubCategory("UPAD")}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
              subCategory === "UPAD"
                ? "bg-amber-600 text-white shadow-md shadow-amber-500/20 scale-[1.01]"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
            }`}
          >
            <div className={`p-1 rounded-lg ${subCategory === "UPAD" ? "bg-white/20" : "bg-amber-100/70 text-amber-700"}`}>
              <TrendingDown className="w-4 h-4" />
            </div>
            <span>2. Upad</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              subCategory === "UPAD" ? "bg-amber-700/80 text-white" : "bg-amber-50 text-amber-700 border border-amber-200/60"
            }`}>
              ₹{metrics.totalUpad.toLocaleString()}
            </span>
          </button>

          {/* 3rd Sub-View: Party Ledger Summary */}
          <button type="button"
            id="subcat-btn-parties"
            onClick={() => handleSetSubCategory("PARTIES")}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
              subCategory === "PARTIES"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-[1.01]"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
            }`}
          >
            <div className={`p-1 rounded-lg ${subCategory === "PARTIES" ? "bg-white/20" : "bg-blue-100/70 text-blue-700"}`}>
              <Users className="w-4 h-4" />
            </div>
            <span>Party Ledger</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              subCategory === "PARTIES" ? "bg-blue-700/80 text-white" : "bg-slate-200 text-slate-700"
            }`}>
              {metrics.totalParties} Parties
            </span>
          </button>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {subCategory === "INVESTMENT" && (
            <button type="button"
              id="add-investment-btn"
              onClick={() => handleOpenAddTx("INVESTMENT")}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all shadow-emerald-600/10 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Investment</span>
            </button>
          )}

          {subCategory === "UPAD" && (
            <button type="button"
              id="add-upad-btn"
              onClick={() => handleOpenAddTx("UPAD")}
              className="flex items-center gap-2 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all shadow-amber-600/10 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Upad</span>
            </button>
          )}

          {subCategory === "PARTIES" && (
            <button type="button"
              id="add-party-btn"
              onClick={() => setIsPartyModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all shadow-blue-600/10 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Party</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards for Active Sub-Category */}
      {subCategory === "INVESTMENT" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-emerald-50/70 border border-emerald-100/90 p-4 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Total Investment</span>
              <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-900">₹{metrics.totalInvestment.toLocaleString()}</div>
            <p className="mt-1 text-xs text-emerald-600">Capital infused into this project</p>
          </div>

          <div className="bg-slate-50 border border-gray-100 p-4 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Investment Entries</span>
              <div className="p-1.5 bg-slate-200 text-slate-700 rounded-lg">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{metrics.totalInvEntries}</div>
            <p className="mt-1 text-xs text-slate-500">Recorded investment transactions</p>
          </div>

          <div className="bg-slate-50 border border-gray-100 p-4 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Balance</span>
              <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                <Landmark className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">₹{metrics.netBalance.toLocaleString()}</div>
            <p className="mt-1 text-xs text-slate-500">Total Investment minus Total Upad</p>
          </div>
        </div>
      )}

      {subCategory === "UPAD" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-amber-50/70 border border-amber-100/90 p-4 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Total Upad (Drawings)</span>
              <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-900">₹{metrics.totalUpad.toLocaleString()}</div>
            <p className="mt-1 text-xs text-amber-600">Personal withdrawal / drawings by partners</p>
          </div>

          <div className="bg-slate-50 border border-gray-100 p-4 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Upad Entries</span>
              <div className="p-1.5 bg-slate-200 text-slate-700 rounded-lg">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{metrics.totalUpadEntries}</div>
            <p className="mt-1 text-xs text-slate-500">Recorded upad withdrawals</p>
          </div>

          <div className="bg-slate-50 border border-gray-100 p-4 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Balance</span>
              <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                <Landmark className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">₹{metrics.netBalance.toLocaleString()}</div>
            <p className="mt-1 text-xs text-slate-500">Total Investment minus Total Upad</p>
          </div>
        </div>
      )}

      {subCategory === "PARTIES" && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-blue-50/70 border border-blue-100 p-4 rounded-2xl">
            <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Total Parties</div>
            <div className="mt-2 text-2xl font-bold text-blue-900">{metrics.totalParties}</div>
            <p className="mt-1 text-xs text-blue-600">Registered investors</p>
          </div>
          <div className="bg-emerald-50/70 border border-emerald-100 p-4 rounded-2xl">
            <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">1. Total Investment</div>
            <div className="mt-2 text-2xl font-bold text-emerald-900">₹{metrics.totalInvestment.toLocaleString()}</div>
            <p className="mt-1 text-xs text-emerald-600">Total invested</p>
          </div>
          <div className="bg-amber-50/70 border border-amber-100 p-4 rounded-2xl">
            <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider">2. Total Upad</div>
            <div className="mt-2 text-2xl font-bold text-amber-900">₹{metrics.totalUpad.toLocaleString()}</div>
            <p className="mt-1 text-xs text-amber-600">Total withdrawn</p>
          </div>
          <div className="bg-slate-50 border border-gray-100 p-4 rounded-2xl">
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Net Balance</div>
            <div className={`mt-2 text-2xl font-bold ${metrics.netBalance >= 0 ? "text-slate-900" : "text-rose-600"}`}>
              ₹{metrics.netBalance.toLocaleString()}
            </div>
            <p className="mt-1 text-xs text-slate-500">Outstanding capital</p>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={subCategory === "PARTIES" ? "Search party name..." : `Search ${subCategory.toLowerCase()} by party, description, or amount...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50/70 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          {searchTerm && (
            <button type="button" 
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {subCategory !== "PARTIES" && parties.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 hidden sm:inline" />
            <select
              value={selectedPartyFilter}
              onChange={(e) => setSelectedPartyFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50/70 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">All Parties</option>
              {parties.map(p => (
                <option key={p.id} value={p.id.toString()}>{p.partyName}</option>
              ))}
            </select>
          </div>
        )}

        <button type="button"
          onClick={loadAllData}
          title="Refresh Data"
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors self-end sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Main Content Tables */}
      {subCategory === "INVESTMENT" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-emerald-50/30">
            <div>
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                1st Sub-Category: Investment Records
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">List of all incoming capital contributions by partners/investors</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full">
              {currentCategoryTransactions.length} {currentCategoryTransactions.length === 1 ? "Record" : "Records"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-600 font-medium text-xs uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Party Name</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Payment Method</th>
                  <th className="p-4">Description / Reference</th>
                  <th className="p-4 text-right">Amount (₹)</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentCategoryTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <TrendingUp className="w-8 h-8 text-gray-300" />
                        <p className="text-sm">No investment entries found.</p>
                        <button type="button"
                          onClick={() => handleOpenAddTx("INVESTMENT")}
                          className="mt-2 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200"
                        >
                          + Add First Investment
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentCategoryTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-emerald-50/20 transition-colors">
                      <td className="p-4 whitespace-nowrap text-slate-600 font-medium">
                        {new Date(tx.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="p-4 font-semibold text-slate-900">
                        {tx.partyName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700 font-medium">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <ArrowDownLeft className="w-3 h-3" />
                          Investment
                        </span>
                      </td>
                      <td className="p-4 text-slate-600">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                          {tx.paymentMethod || "Cash"}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 max-w-xs truncate">
                        <div>{tx.description || "-"}</div>
                        {tx.referenceNumber && (
                          <div className="text-xs text-slate-400">Ref: {tx.referenceNumber}</div>
                        )}
                      </td>
                      <td className="p-4 text-right font-bold text-emerald-700 text-base">
                        ₹{parseFloat(tx.amount).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center font-medium">
                        <button type="button"
                          onClick={() => handleDeleteTx(tx.id)}
                          title="Delete Transaction"
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg hover:text-rose-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {subCategory === "UPAD" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-amber-50/30">
            <div>
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                2nd Sub-Category: Upad Records
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">List of all withdrawals/drawings taken by partners/investors</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full">
              {currentCategoryTransactions.length} {currentCategoryTransactions.length === 1 ? "Record" : "Records"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-600 font-medium text-xs uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Party Name</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Payment Method</th>
                  <th className="p-4">Description / Reference</th>
                  <th className="p-4 text-right">Amount (₹)</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentCategoryTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <TrendingDown className="w-8 h-8 text-gray-300" />
                        <p className="text-sm">No upad entries found.</p>
                        <button type="button"
                          onClick={() => handleOpenAddTx("UPAD")}
                          className="mt-2 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200"
                        >
                          + Add First Upad
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentCategoryTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-amber-50/20 transition-colors">
                      <td className="p-4 whitespace-nowrap text-slate-600 font-medium">
                        {new Date(tx.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="p-4 font-semibold text-slate-900">
                        {tx.partyName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700 font-medium">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          <ArrowUpRight className="w-3 h-3" />
                          Upad
                        </span>
                      </td>
                      <td className="p-4 text-slate-600">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                          {tx.paymentMethod || "Cash"}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 max-w-xs truncate">
                        <div>{tx.description || "-"}</div>
                        {tx.referenceNumber && (
                          <div className="text-xs text-slate-400">Ref: {tx.referenceNumber}</div>
                        )}
                      </td>
                      <td className="p-4 text-right font-bold text-amber-700 text-base">
                        ₹{parseFloat(tx.amount).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center font-medium">
                        <button type="button"
                          onClick={() => handleDeleteTx(tx.id)}
                          title="Delete Transaction"
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg hover:text-rose-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {subCategory === "PARTIES" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-blue-50/30">
            <div>
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Party-wise Investment & Upad Ledger Summary
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Overview of Total Investment, Total Upad, and Net Balance per party</p>
            </div>
            <button type="button"
              onClick={() => setIsPartyModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Party</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-600 font-medium text-xs uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="p-4">Party / Investor Name</th>
                  <th className="p-4 text-right">1. Total Investment</th>
                  <th className="p-4 text-right">2. Total Upad</th>
                  <th className="p-4 text-right">Net Balance</th>
                  <th className="p-4 text-center">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredParties.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm">No investment parties registered yet.</p>
                      <button type="button"
                        onClick={() => setIsPartyModalOpen(true)}
                        className="mt-2 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
                      >
                        + Add Investment Party
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredParties.map((p) => {
                    const balance = p.totalInvestment - p.totalUpad;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors/80 transition-colors">
                        <td className="p-4 font-semibold text-slate-900">
                          {p.partyName}
                        </td>
                        <td className="p-4 text-right font-bold text-emerald-600">
                          ₹{p.totalInvestment.toLocaleString()}
                        </td>
                        <td className="p-4 text-right font-bold text-amber-600">
                          ₹{p.totalUpad.toLocaleString()}
                        </td>
                        <td className={`p-4 text-right font-bold text-base ${balance >= 0 ? "text-slate-900" : "text-rose-600"}`}>
                          ₹{balance.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-700 font-medium">
                          <div className="flex items-center justify-center gap-1.5">
                            <button type="button"
                              onClick={() => handleOpenAddTx("INVESTMENT", p.id)}
                              className="px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200/60"
                              title="Add Investment for this party"
                            >
                              + Inv
                            </button>
                            <button type="button"
                              onClick={() => handleOpenAddTx("UPAD", p.id)}
                              className="px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg border border-amber-200/60"
                              title="Add Upad for this party"
                            >
                              + Upad
                            </button>
                            <button type="button"
                              onClick={() => handleOpenStatement(p)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View Statement / History"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button type="button"
                              onClick={() => handleDeleteParty(p.id, p.partyName)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg hover:text-rose-700 transition-colors"
                              title="Delete Party"
                            >
                              <Trash2 className="w-4 h-4" />
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
      )}

      {/* Modal 1: Add Transaction (Investment / Upad) */}
      <Modal 
        isOpen={isTxModalOpen} 
        onClose={() => setIsTxModalOpen(false)} 
        title={txData.type === "INVESTMENT" ? "Add Investment Record" : "Add Upad Record"}
      >
        <form onSubmit={handleCreateTx} className="space-y-4">
          {/* Sub-Category Investment Type Selector: 1st is Investment, 2nd is Upad */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Investment Sub-Category (Type)
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                id="modal-type-investment"
                onClick={() => setTxData({ ...txData, type: "INVESTMENT" })}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                  txData.type === "INVESTMENT"
                    ? "bg-white text-emerald-700 shadow-sm border border-emerald-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>1. Investment</span>
              </button>

              <button
                type="button"
                id="modal-type-upad"
                onClick={() => setTxData({ ...txData, type: "UPAD" })}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                  txData.type === "UPAD"
                    ? "bg-white text-amber-700 shadow-sm border border-amber-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <TrendingDown className="w-4 h-4 text-amber-600" />
                <span>2. Upad</span>
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {txData.type === "INVESTMENT" 
                ? "Funds invested into project (+) increases balance" 
                : "Personal drawings / withdrawal (-) reduces balance"}
            </p>
          </div>

          {/* Party Selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">
                Party / Investor Name <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsInlinePartyMode(!isInlinePartyMode)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {isInlinePartyMode ? "Select Existing Party" : "+ Add New Party Name"}
              </button>
            </div>

            {isInlinePartyMode ? (
              <input
                type="text"
                placeholder="Enter new party name..."
                value={inlinePartyName}
                onChange={(e) => setInlinePartyName(e.target.value)}
                className="w-full p-2.5 border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                required
              />
            ) : (
              <select
                value={txData.partyId}
                onChange={(e) => setTxData({ ...txData, partyId: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                required
              >
                {parties.length === 0 ? (
                  <option value="">No parties available - switch to Add New Party</option>
                ) : (
                  parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.partyName} (Bal: ₹{(p.totalInvestment - p.totalUpad).toLocaleString()})
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Amount (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                <input
                  type="number" inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={txData.amount}
                  onChange={(e) => setTxData({ ...txData, amount: e.target.value })}
                  className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={txData.date}
                onChange={(e) => setTxData({ ...txData, date: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                required
              />
            </div>
          </div>

          {/* Payment Method & Reference Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Payment Method
              </label>
              <select
                value={txData.paymentMethod}
                onChange={(e) => setTxData({ ...txData, paymentMethod: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer / UPI</option>
                <option value="Cheque">Cheque</option>
                <option value="RTGS / NEFT">RTGS / NEFT</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reference / Cheque No.
              </label>
              <input
                type="text"
                placeholder="e.g. CHQ-92831, UPI-Ref"
                value={txData.referenceNumber}
                onChange={(e) => setTxData({ ...txData, referenceNumber: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description / Remarks
            </label>
            <input
              type="text"
              placeholder="e.g. Initial capital contribution or personal drawings"
              value={txData.description}
              onChange={(e) => setTxData({ ...txData, description: e.target.value })}
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsTxModalOpen(false)}
              className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-5 py-2.5 text-white text-sm font-semibold rounded-xl shadow-md transition-all ${
                txData.type === "INVESTMENT"
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                  : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
              }`}
            >
              Save {txData.type === "INVESTMENT" ? "Investment" : "Upad"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Add Investment Party */}
      <Modal
        isOpen={isPartyModalOpen}
        onClose={() => setIsPartyModalOpen(false)}
        title="Add Investment Party / Partner"
      >
        <form onSubmit={handleCreateParty} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Party / Partner Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Ramesh Bhai, Bina Construction Co."
              value={newPartyName}
              onChange={(e) => setNewPartyName(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
              autoFocus
            />
            <p className="mt-1 text-xs text-slate-500">
              Once added, you can record both 1st: Investment and 2nd: Upad against this party.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsPartyModalOpen(false)}
              className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
            >
              Save Party
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 3: Party Statement / Ledger */}
      <Modal
        isOpen={isStatementModalOpen}
        onClose={() => setIsStatementModalOpen(false)}
        title={statementParty ? `Ledger Statement: ${statementParty.partyName}` : "Party Statement"}
      >
        {statementParty && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Party Summary Header */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl text-center">
              <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                <span className="text-xs text-emerald-800 font-medium">1. Total Investment</span>
                <div className="text-base font-bold text-emerald-700">₹{statementParty.totalInvestment.toLocaleString()}</div>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
                <span className="text-xs text-amber-800 font-medium">2. Total Upad</span>
                <div className="text-base font-bold text-amber-700">₹{statementParty.totalUpad.toLocaleString()}</div>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-xs text-blue-800 font-medium">Net Balance</span>
                <div className="text-base font-bold text-blue-900">
                  ₹{(statementParty.totalInvestment - statementParty.totalUpad).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Quick Action buttons */}
            <div className="flex justify-end gap-2">
              <button type="button"
                onClick={() => {
                  setIsStatementModalOpen(false);
                  handleOpenAddTx("INVESTMENT", statementParty.id);
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
              >
                + Add Investment
              </button>
              <button type="button"
                onClick={() => {
                  setIsStatementModalOpen(false);
                  handleOpenAddTx("UPAD", statementParty.id);
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
              >
                + Add Upad
              </button>
            </div>

            {/* Transactions List */}
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-slate-500">Date</th>
                    <th className="px-6 py-4 font-semibold text-slate-500">Type</th>
                    <th className="px-6 py-4 font-semibold text-slate-500">Method / Ref</th>
                    <th className="px-6 py-4 font-semibold text-slate-500">Description</th>
                    <th className="px-6 py-4 font-semibold text-slate-500 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partyStatementTxs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">
                        No transactions recorded for this party yet.
                      </td>
                    </tr>
                  ) : (
                    partyStatementTxs.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 whitespace-nowrap text-slate-600 font-medium">
                          {new Date(tx.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-700 font-medium">
                          {tx.type === "INVESTMENT" ? (
                            <span className="px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800">
                              Investment
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800">
                              Upad
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600">
                          {tx.paymentMethod || "Cash"}
                          {tx.referenceNumber && <span className="text-slate-400"> ({tx.referenceNumber})</span>}
                        </td>
                        <td className="p-3 text-slate-500">{tx.description || "-"}</td>
                        <td className={`p-3 text-right font-bold ${tx.type === "INVESTMENT" ? "text-emerald-700" : "text-amber-700"}`}>
                          {tx.type === "INVESTMENT" ? "+" : "-"}₹{parseFloat(tx.amount).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
