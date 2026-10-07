import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import {
  Landmark, Plus, Trash2, Search, ArrowRight,
  CheckCircle2, AlertCircle, RefreshCw,
  TrendingUp, Download, Eye, ExternalLink,
  FileSpreadsheet, User, ArrowUpRight, ArrowDownLeft, Pencil
} from "lucide-react";
import { useLiveSync, triggerSync } from "../../hooks/useLiveSync";
import { useToast } from "../../contexts/ToastContext";
import { downloadExcelReport } from "../../lib/excelExport";
import { useNavigate } from "react-router-dom";

interface AllocationRecord {
  id: number;
  investorId: number;
  investorName: string;
  investorMobile?: string;
  locationId: number;
  amount: string | number;
  date: string;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
  createdAt?: string;
}

interface AdminInvestor {
  id: number;
  name: string;
  mobile?: string;
  totalContributed: number;
  totalWithdrawn: number;
  totalAllocated: number;
  availableCapital: number;
}

interface AdminCapitalSummary {
  totalContributed: number;
  totalWithdrawn: number;
  totalAllocated: number;
  totalPurchases: number;
  availableAdminCapital: number;
  investors: AdminInvestor[];
}

interface InvestorCapitalTabProps {
  locationId: number;
  locationName?: string;
}

export default function InvestorCapitalTab({ locationId, locationName = "This Location" }: InvestorCapitalTabProps) {
  const { showToast, confirmAction } = useToast();
  const navigate = useNavigate();

  // State
  const [allocations, setAllocations] = useState<AllocationRecord[]>([]);
  const [locationParties, setLocationParties] = useState<any[]>([]);
  const [locationTxs, setLocationTxs] = useState<any[]>([]);
  const [adminSummary, setAdminSummary] = useState<AdminCapitalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvestorFilter, setSelectedInvestorFilter] = useState<string>("ALL");

  // Tab View Mode: "notebook" (Passbook Ledger), "cards" (Investor Summary), "allocations" (Allocations Register)
  const [activeTabMode, setActiveTabMode] = useState<"notebook" | "cards" | "allocations">("notebook");
  const [notebookFilter, setNotebookFilter] = useState<"ALL" | "ADDED" | "REMOVED">("ALL");
  const [notebookSearch, setNotebookSearch] = useState("");

  // Add/Edit Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAllocationId, setEditingAllocationId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    investorId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    notes: ""
  });

  // Load Data
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [allocRes, adminRes, partiesRes, txsRes] = await Promise.all([
        apiFetch(`/investments/location-allocations?locationId=${locationId}`).catch(() => []),
        apiFetch("/investments/admin-capital-summary").catch(() => null),
        apiFetch(`/investments/parties?locationId=${locationId}`).catch(() => []),
        apiFetch(`/investments/transactions?locationId=${locationId}`).catch(() => [])
      ]);

      if (Array.isArray(allocRes)) {
        setAllocations(allocRes);
      }
      if (adminRes && typeof adminRes.availableAdminCapital === "number") {
        setAdminSummary(adminRes);
      }
      if (Array.isArray(partiesRes)) {
        setLocationParties(partiesRes);
      }
      if (Array.isArray(txsRes)) {
        setLocationTxs(txsRes);
      }
    } catch (err: any) {
      console.error("Failed to load Investor Capital data", err);
      if (!silent) {
        showToast(err.message || "Failed to load investor capital details", "error");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [locationId]);

  useLiveSync(() => {
    loadData(true);
  }, 4000);

  // Selected Investor from form
  const selectedInvestorObj = useMemo(() => {
    if (!formData.investorId || !adminSummary?.investors) return null;
    return adminSummary.investors.find(i => String(i.id) === formData.investorId) || null;
  }, [formData.investorId, adminSummary]);

  // Max allocatable for selected investor
  const maxAllocatable = useMemo(() => {
    if (!selectedInvestorObj || !adminSummary) return 0;
    return Math.max(0, Math.min(selectedInvestorObj.availableCapital, adminSummary.availableAdminCapital));
  }, [selectedInvestorObj, adminSummary]);

  // Calculate Aggregates
  const totalAllocatedAmount = useMemo(() => {
    return (Array.isArray(allocations) ? allocations : []).reduce((sum, a) => sum + (parseFloat(String(a?.amount)) || 0), 0);
  }, [allocations]);

  const totalDeployedAmount = useMemo(() => {
    return (Array.isArray(locationParties) ? locationParties : []).reduce((sum, p) => sum + Number(p?.cat7Deployed ?? p?.totalInvestment ?? 0), 0);
  }, [locationParties]);

  const totalAvailableAmount = useMemo(() => {
    return Math.max(0, (totalAllocatedAmount || 0) - (totalDeployedAmount || 0));
  }, [totalAllocatedAmount, totalDeployedAmount]);

  // --- Location Investor Capital Passbook Ledger ---
  const locationInvestorNotebook = useMemo(() => {
    const items: any[] = [];

    // 1. Inflows: Allocations from Admin Capital to this Location (Inflows)
    (Array.isArray(allocations) ? allocations : []).forEach(a => {
      const amt = parseFloat(String(a.amount || 0));
      items.push({
        id: `alloc-${a.id}`,
        rawId: a.id,
        kind: 'ALLOCATION',
        date: a.date,
        investorId: a.investorId,
        investorName: a.investorName,
        type: 'ADDED',
        typeLabel: 'Capital Allocation (+ INFLOW)',
        category: 'ADMIN_ALLOCATION',
        particulars: a.notes ? `Allocated from Admin Capital: ${a.notes}` : 'Allocated from Admin Capital Pool',
        paymentMethod: a.paymentMethod || 'Bank Transfer',
        referenceNumber: a.referenceNumber || '-',
        jama: amt,
        udhar: 0,
        amount: amt
      });
    });

    // 2. Outflows: Deployed into Category 1 Investment Capital (Outflows)
    (Array.isArray(locationTxs) ? locationTxs : [])
      .filter(t => t.type === 'INVESTMENT')
      .forEach(t => {
        const amt = parseFloat(String(t.amount || 0));
        items.push({
          id: `tx-${t.id}`,
          rawId: t.id,
          kind: 'TRANSACTION',
          date: t.date,
          investorId: t.partyId,
          investorName: t.partyName || 'Investor',
          type: 'REMOVED',
          typeLabel: 'Investment Deployed (- DEPLOYED)',
          category: 'INVESTMENT_DEPLOYMENT',
          particulars: t.description ? `Deployed to Cat 1 Investment: ${t.description}` : 'Transferred to Project Investment Capital (Cat 1)',
          paymentMethod: t.paymentMethod || 'Bank Transfer',
          referenceNumber: t.referenceNumber || '-',
          jama: 0,
          udhar: amt,
          amount: amt
        });
      });

    // Chronological sort
    items.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.rawId || 0) - (b.rawId || 0);
    });

    let running = 0;
    const withBal = items.map(entry => {
      running = running + entry.jama - entry.udhar;
      return {
        ...entry,
        runningBalance: Math.round(running * 100) / 100
      };
    });

    return withBal.reverse();
  }, [allocations, locationTxs]);

  // Filtered Location Notebook Entries
  const filteredLocationNotebook = useMemo(() => {
    return locationInvestorNotebook.filter(e => {
      const matchType = notebookFilter === "ALL" || e.type === notebookFilter;
      const q = notebookSearch.toLowerCase().trim();
      const matchSearch = !q ||
        (e.investorName && e.investorName.toLowerCase().includes(q)) ||
        (e.particulars && e.particulars.toLowerCase().includes(q)) ||
        (e.referenceNumber && e.referenceNumber.toLowerCase().includes(q)) ||
        (e.paymentMethod && e.paymentMethod.toLowerCase().includes(q));
      return matchType && matchSearch;
    });
  }, [locationInvestorNotebook, notebookFilter, notebookSearch]);

  // Investor-wise Breakdown at this Location
  const investorBreakdown = useMemo(() => {
    const map = new Map<number, { 
      id: number; 
      name: string; 
      mobile?: string; 
      totalAmount: number; 
      deployedAmount: number;
      availableAmount: number;
      count: number; 
      lastDate: string 
    }>();

    (Array.isArray(allocations) ? allocations : []).forEach(a => {
      if (!a) return;
      const amt = parseFloat(String(a.amount)) || 0;
      const invId = a.investorId || 0;
      const existing = map.get(invId);
      if (existing) {
        existing.totalAmount += amt;
        existing.count += 1;
        if (a.date && a.date > existing.lastDate) existing.lastDate = a.date;
      } else {
        map.set(invId, {
          id: invId,
          name: a.investorName || `Investor #${invId}`,
          mobile: a.investorMobile,
          totalAmount: amt,
          deployedAmount: 0,
          availableAmount: amt,
          count: 1,
          lastDate: a.date || ""
        });
      }
    });

    // Populate deployed and available from locationParties
    const safeParties = Array.isArray(locationParties) ? locationParties : [];
    map.forEach(item => {
      const party = safeParties.find(p => (p?.partyName || "").trim().toUpperCase() === (item.name || "").trim().toUpperCase());
      const deployed = party ? Number(party.cat7Deployed ?? party.totalInvestment ?? 0) : 0;
      item.deployedAmount = isNaN(deployed) ? 0 : deployed;
      item.availableAmount = Math.max(0, (item.totalAmount || 0) - item.deployedAmount);
    });

    return Array.from(map.values()).sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0));
  }, [allocations, locationParties]);

  // Filtered Allocations
  const filteredAllocations = useMemo(() => {
    return allocations.filter(a => {
      const matchesSearch = 
        !searchQuery ||
        (a.investorName && a.investorName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.referenceNumber && a.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.notes && a.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesInvestor = 
        selectedInvestorFilter === "ALL" || 
        String(a.investorId) === selectedInvestorFilter;

      return matchesSearch && matchesInvestor;
    });
  }, [allocations, searchQuery, selectedInvestorFilter]);

  // Handle Form Submission (Add/Edit Investor Capital from Admin Capital)
  const handleAddAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(formData.amount);

    if (!formData.investorId) {
      showToast("Please select an investor", "error");
      return;
    }

    if (!amt || isNaN(amt) || amt <= 0) {
      showToast("Please enter a valid allocation amount", "error");
      return;
    }

    if (!editingAllocationId) {
      if (adminSummary && amt > Number(adminSummary.availableAdminCapital || 0)) {
        showToast(`Amount exceeds Total Available Admin Capital (₹${Number(adminSummary.availableAdminCapital || 0).toLocaleString("en-IN")})`, "error");
        return;
      }

      if (selectedInvestorObj && amt > Number(selectedInvestorObj.availableCapital || 0)) {
        showToast(`Selected investor has only ₹${Number(selectedInvestorObj.availableCapital || 0).toLocaleString("en-IN")} available in Admin Capital`, "error");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (editingAllocationId) {
        await apiFetch(`/investments/location-allocations/${editingAllocationId}`, {
          method: "PUT",
          body: JSON.stringify({
            amount: amt.toString(),
            date: formData.date,
            paymentMethod: formData.paymentMethod,
            referenceNumber: formData.referenceNumber || null,
            notes: formData.notes || null
          })
        });
        showToast(`Allocation updated successfully!`, "success");
      } else {
        await apiFetch("/investments/location-allocations", {
          method: "POST",
          body: JSON.stringify({
            investorId: parseInt(formData.investorId, 10),
            locationId,
            amount: amt.toString(),
            date: formData.date,
            paymentMethod: formData.paymentMethod,
            referenceNumber: formData.referenceNumber || null,
            notes: formData.notes || null
          })
        });
        showToast(`₹${amt.toLocaleString("en-IN")} Investor Capital successfully allocated from Admin Capital!`, "success");
      }

      triggerSync("investments");
      triggerSync("reports");
      setIsAddModalOpen(false);
      setEditingAllocationId(null);
      setFormData({
        investorId: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        referenceNumber: "",
        notes: ""
      });
      loadData(true);
    } catch (err: any) {
      console.error("Allocation failed", err);
      showToast(err.message || "Failed to save investor capital allocation", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit Allocation
  const handleEditAllocation = (item: any) => {
    setEditingAllocationId(item.id || item.rawId);
    setFormData({
      investorId: String(item.investorId || (allocations.find(a => a.id === (item.id || item.rawId))?.investorId || "")),
      amount: String(item.amount || item.jama || ""),
      date: item.date || new Date().toISOString().split("T")[0],
      paymentMethod: item.paymentMethod || "Bank Transfer",
      referenceNumber: item.referenceNumber && item.referenceNumber !== "—" && item.referenceNumber !== "-" ? item.referenceNumber : "",
      notes: item.notes && item.notes !== "—" ? item.notes : ""
    });
    setIsAddModalOpen(true);
  };

  // Handle Delete Allocation
  const handleDeleteAllocation = async (record: AllocationRecord) => {
    const confirmed = await confirmAction({
      title: "Delete Investor Allocation",
      message: `Are you sure you want to delete allocation of ₹${parseFloat(String(record.amount)).toLocaleString("en-IN")} for ${record.investorName}? This amount will be returned to Admin Capital.`,
      confirmLabel: "Delete & Revert",
      isDanger: true,
      requirePassword: false
    });

    if (!confirmed) return;

    try {
      await apiFetch(`/investments/location-allocations/${record.id}`, {
        method: "DELETE"
      });

      triggerSync("investments");
      triggerSync("reports");
      showToast("Allocation record deleted and returned to Admin Capital", "success");
      loadData(true);
    } catch (err: any) {
      console.error("Failed to delete allocation", err);
      showToast(err.message || "Failed to delete allocation", "error");
    }
  };

  const handleDeleteTx = async (txId: number) => {
    const confirmed = await confirmAction({
      title: "Delete Investment Deployment",
      message: "Are you sure you want to revert this investment deployment? The amount will return to available Investor Capital.",
      confirmLabel: "Revert & Delete",
      isDanger: true
    });
    if (!confirmed) return;
    try {
      await apiFetch(`/investments/transactions/${txId}?locationId=${locationId}`, { method: "DELETE" });
      triggerSync("investments");
      triggerSync("reports");
      showToast("Transaction reverted successfully", "success");
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to revert transaction", "error");
    }
  };

  const handleOpenAddForInvestor = (invId: number) => {
    setFormData({
      investorId: String(invId),
      amount: "",
      date: new Date().toISOString().split("T")[0],
      paymentMethod: "Bank Transfer",
      referenceNumber: "",
      notes: ""
    });
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Category Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-emerald-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-2">
            <Landmark className="w-3.5 h-3.5" />
            <span>Location Investor Capital</span>
          </div>
          <h2 className="text-2xl font-black text-white">Investor Capital</h2>
          <p className="text-xs text-slate-300 mt-1">
            <strong>Admin Capital (Tier 1) &rarr; Location Investor Capital (Tier 2)</strong> &bull; Allocated project capital management
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Main Action: Add Investor Capital from Admin Capital */}
          <button
            type="button"
            onClick={() => {
              setFormData({
                investorId: "",
                amount: "",
                date: new Date().toISOString().split("T")[0],
                paymentMethod: "Bank Transfer",
                referenceNumber: "",
                notes: ""
              });
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Investor Capital from Admin Capital</span>
          </button>

          <button
            type="button"
            onClick={() => downloadExcelReport(`/reports/export-location/${locationId}?tab=investor_capital`, `${locationName.replace(/\s+/g, '_')}_Investor_Capital.xlsx`)}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/15 cursor-pointer"
            title="Download Excel Report"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => loadData(false)}
            disabled={loading}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/15 cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Allocated at Location */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Allocated (Cat 7)</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            ₹{Number(totalAllocatedAmount || 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Total allocated capital ({allocations.length} allocations)
          </div>
        </div>

        {/* Card 2: Deployed to Category 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Deployed to Cat 1</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-900 tracking-tight">
            ₹{Number(totalDeployedAmount || 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Transferred to project investment capital
          </div>
        </div>

        {/* Card 3: Available Investor Capital (Cat 7) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Available in Cat 7</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 tracking-tight">
            ₹{Number(totalAvailableAmount || 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Available for Cat 1 project deployment
          </div>
        </div>

        {/* Card 4: Central Available Admin Capital */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Available Admin Capital</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-900 tracking-tight">
            ₹{adminSummary ? Number(adminSummary.availableAdminCapital || 0).toLocaleString("en-IN") : "0"}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Tier 1 central available balance
          </div>
        </div>
      </div>

      {/* View Mode Navigation Tabs */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTabMode("notebook")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTabMode === "notebook"
              ? "bg-[#0B1D3A] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-amber-400" />
          <span>Capital Passbook Ledger</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-200">
            {locationInvestorNotebook.length} Entries
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTabMode("cards")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTabMode === "cards"
              ? "bg-[#0B1D3A] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <User className="w-4 h-4" />
          <span>Investor Summary Cards</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-200">
            {investorBreakdown.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTabMode("allocations")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTabMode === "allocations"
              ? "bg-[#0B1D3A] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>Admin Allocations</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-200">
            {allocations.length}
          </span>
        </button>
      </div>

      {/* VIEW MODE 1: Note Book Hisab (Passbook Ledger) */}
      {activeTabMode === "notebook" && (
        <div className="space-y-4">
          {/* Notebook Header */}
          <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 p-6 rounded-3xl text-white shadow-xl border border-amber-800/40">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                  <span>Location Investor Passbook</span>
                </div>
                <h3 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>Capital Passbook Ledger</span>
                </h3>
                <p className="text-xs text-amber-200/80 mt-1 max-w-2xl font-medium">
                  Ledger of Admin Capital allocations (inflows) and project investment deployments (outflows) for {locationName}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setFormData({
                    investorId: "",
                    amount: "",
                    date: new Date().toISOString().split("T")[0],
                    paymentMethod: "Bank Transfer",
                    referenceNumber: "",
                    notes: ""
                  });
                  setIsAddModalOpen(true);
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add More from Admin Capital</span>
              </button>
            </div>

            {/* Quick Metrics in Notebook */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-white/10">
              <div className="bg-white/10 p-3.5 rounded-2xl border border-white/15">
                <span className="text-[10px] uppercase font-bold text-emerald-300 block">Total Inflows (Allocations)</span>
                <span className="text-xl font-black text-emerald-400 tabular-nums">
                  +₹{totalAllocatedAmount.toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-white/60 block mt-0.5">Received from central Admin Capital</span>
              </div>

              <div className="bg-white/10 p-3.5 rounded-2xl border border-white/15">
                <span className="text-[10px] uppercase font-bold text-purple-300 block">Total Deployed (Outflows)</span>
                <span className="text-xl font-black text-purple-300 tabular-nums">
                  -₹{totalDeployedAmount.toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-white/60 block mt-0.5">Transferred to Cat 1 investment</span>
              </div>

              <div className="bg-white/10 p-3.5 rounded-2xl border border-white/15">
                <span className="text-[10px] uppercase font-bold text-cyan-300 block">Available Capital</span>
                <span className="text-xl font-black text-white tabular-nums">
                  ₹{totalAvailableAmount.toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-white/60 block mt-0.5">Remaining available for project deployment</span>
              </div>
            </div>
          </div>

          {/* Notebook Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              <button
                type="button"
                onClick={() => setNotebookFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  notebookFilter === "ALL"
                    ? "bg-[#0B1D3A] text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Entries ({locationInvestorNotebook.length})
              </button>

              <button
                type="button"
                onClick={() => setNotebookFilter("ADDED")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  notebookFilter === "ADDED"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                }`}
              >
                <span>Allocations (+ INFLOW)</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                  {locationInvestorNotebook.filter(e => e.type === "ADDED").length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setNotebookFilter("REMOVED")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  notebookFilter === "REMOVED"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200"
                }`}
              >
                <span>Deployed (- OUTFLOW)</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                  {locationInvestorNotebook.filter(e => e.type === "REMOVED").length}
                </span>
              </button>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search notebook by investor, particulars, ref..."
                value={notebookSearch}
                onChange={(e) => setNotebookSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
          </div>

          {/* Traditional Notebook Table */}
          <div className="bg-amber-50/20 rounded-2xl border-2 border-amber-200/90 shadow-sm overflow-hidden">
            <div className="p-3 bg-amber-100/70 border-b border-amber-200/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="font-black text-amber-950 uppercase tracking-wider">Location Investor Capital Ledger</span>
              </div>
              <span className="text-amber-900 font-bold">{filteredLocationNotebook.length} Records</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-amber-50 text-amber-900 font-bold border-b border-amber-200">
                  <tr>
                    <th className="p-3.5 whitespace-nowrap">Date</th>
                    <th className="p-3.5">Investor</th>
                    <th className="p-3.5">Entry Type</th>
                    <th className="p-3.5">Particulars / Destination</th>
                    <th className="p-3.5 text-center">Payment & Ref</th>
                    <th className="p-3.5 text-right font-black text-emerald-800">Inflow (+ ALLOCATION)</th>
                    <th className="p-3.5 text-right font-black text-purple-800">Outflow (- DEPLOYED)</th>
                    <th className="p-3.5 text-right font-black text-slate-900">Balance Capital</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 bg-white">
                  {filteredLocationNotebook.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-10 text-center text-slate-400">
                        {notebookSearch ? "No matching entries found." : "No investor capital entries found."}
                      </td>
                    </tr>
                  ) : (
                    filteredLocationNotebook.map((entry) => (
                      <tr key={entry.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="p-3.5 font-medium text-slate-600 whitespace-nowrap">
                          {entry.date}
                        </td>
                        <td className="p-3.5 font-bold text-slate-900">
                          {entry.investorName}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase inline-flex items-center gap-1 ${
                            entry.type === 'ADDED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-purple-100 text-purple-800 border border-purple-300'
                          }`}>
                            {entry.typeLabel}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-700 max-w-xs">
                          <div className="font-semibold">{entry.particulars}</div>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium border border-slate-200">
                            {entry.paymentMethod}
                          </span>
                          {entry.referenceNumber && entry.referenceNumber !== '-' && (
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              #{entry.referenceNumber}
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 text-right font-black text-emerald-700 tabular-nums text-sm">
                          {entry.jama > 0 ? `+₹${entry.jama.toLocaleString("en-IN")}` : <span className="text-slate-300 font-normal">—</span>}
                        </td>
                        <td className="p-3.5 text-right font-black text-purple-700 tabular-nums text-sm">
                          {entry.udhar > 0 ? `-₹${entry.udhar.toLocaleString("en-IN")}` : <span className="text-slate-300 font-normal">—</span>}
                        </td>
                        <td className="p-3.5 text-right font-black text-slate-900 tabular-nums text-sm bg-amber-50/30">
                          ₹{entry.runningBalance.toLocaleString("en-IN")}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {entry.kind === 'ALLOCATION' && (
                              <button
                                type="button"
                                onClick={() => handleEditAllocation(entry)}
                                className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded transition-colors cursor-pointer"
                                title="Edit Allocation"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {entry.kind === 'ALLOCATION' ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteAllocation({ id: entry.rawId, investorName: entry.investorName, amount: entry.amount } as any)}
                                className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                title="Delete Allocation and return to Admin Capital"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDeleteTx(entry.rawId)}
                                className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                title="Revert deployment back to Investor Capital"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: Investor-wise Breakdown Cards */}
      {activeTabMode === "cards" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-600" />
              <span>Investor-wise Capital at this Location</span>
            </h3>
            <span className="text-xs font-semibold text-slate-500">
              {investorBreakdown.length} Investors
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {investorBreakdown.map((inv) => {
              const share = totalAllocatedAmount > 0 
                ? ((inv.totalAmount / totalAllocatedAmount) * 100).toFixed(1)
                : "0";

              return (
                <div 
                  key={inv.id} 
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{inv.name}</h4>
                        {inv.mobile && (
                          <p className="text-xs text-slate-500 font-medium">{inv.mobile}</p>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                        {share}% Share
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-1.5 p-2 bg-white rounded-lg border border-slate-200/80 text-center">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Allocated</span>
                        <span className="text-xs font-bold text-slate-800">₹{Number(inv.totalAmount || 0).toLocaleString("en-IN")}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-purple-500 block uppercase">Deployed (Cat 1)</span>
                        <span className="text-xs font-bold text-purple-700">₹{Number(inv.deployedAmount || 0).toLocaleString("en-IN")}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-emerald-600 block uppercase">Available</span>
                        <span className="text-xs font-black text-emerald-700">₹{Number(inv.availableAmount || 0).toLocaleString("en-IN")}</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 mt-2">
                      {inv.count} Allocation{inv.count > 1 ? "s" : ""} &bull; Last: {inv.lastDate}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenAddForInvestor(inv.id)}
                    className="w-full py-1.5 px-3 bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add More from Admin Capital</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 3: Allocation History Ledger Table */}
      {activeTabMode === "allocations" && (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4">
        {/* Table Filter Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search investor, notes, reference..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select
              value={selectedInvestorFilter}
              onChange={(e) => setSelectedInvestorFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Investors ({allocations.length})</option>
              {investorBreakdown.map((inv) => (
                <option key={inv.id} value={String(inv.id)}>
                  {inv.name} (₹{inv.totalAmount.toLocaleString("en-IN")})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Investor Name</th>
                <th className="py-3 px-4 text-right">Allocated Amount</th>
                <th className="py-3 px-4 text-center">Payment Method</th>
                <th className="py-3 px-4">Reference / Cheque</th>
                <th className="py-3 px-4">Notes / Purpose</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAllocations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <Landmark className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold">No investor capital allocations found for this location.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Click "+ Add Investor Capital from Admin Capital" to allocate funds.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAllocations.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {item.date}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {item.investorName}
                      {item.investorMobile && (
                        <span className="block text-[11px] text-slate-400 font-normal">
                          {item.investorMobile}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-700 text-sm">
                      ₹{parseFloat(String(item.amount)).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {item.paymentMethod || "Bank Transfer"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 font-mono">
                      {item.referenceNumber || "—"}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                      {item.notes || "—"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditAllocation(item)}
                          className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Edit this allocation"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAllocation(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete this allocation and return funds to Admin Capital"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* MODAL: Add/Edit Investor Capital from Admin Capital */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingAllocationId(null);
        }}
        title={editingAllocationId ? "Edit Investor Capital Allocation" : "Add Investor Capital from Admin Capital"}
      >
        <form onSubmit={handleAddAllocation} className="space-y-4">
          {/* Header Info Box */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
              <span className="flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-emerald-700" />
                <span>Tier 1 &rarr; Tier 2 Allocation</span>
              </span>
              <span>Available Admin Capital: ₹{adminSummary ? Number(adminSummary.availableAdminCapital || 0).toLocaleString("en-IN") : "0"}</span>
            </div>
            <p className="text-[11px] text-emerald-700">
              Target Location: <strong>{locationName}</strong> &bull; Selected amount will be moved from central Admin Capital into this location's investor pool.
            </p>
          </div>

          {/* Select Investor */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Select Investor *
            </label>
            <select
              required
              value={formData.investorId}
              onChange={(e) => setFormData({ ...formData, investorId: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">-- Choose Investor from Admin Capital --</option>
              {adminSummary?.investors && adminSummary.investors.length > 0 ? (
                adminSummary.investors.map((inv) => (
                  <option key={inv.id} value={String(inv.id)}>
                    {inv.name} &bull; Available in Admin: ₹{Number(inv.availableCapital || 0).toLocaleString("en-IN")}
                  </option>
                ))
              ) : (
                <option value="" disabled>No investors found in Admin Capital</option>
              )}
            </select>
          </div>

          {/* Selected Investor Status Notice */}
          {selectedInvestorObj && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div className="flex justify-between font-bold text-slate-800">
                <span>{selectedInvestorObj.name}</span>
                <span className="text-emerald-700">
                  Available: ₹{Number(selectedInvestorObj.availableCapital || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex justify-between">
                <span>Total Contributed: ₹{Number(selectedInvestorObj.totalContributed || 0).toLocaleString("en-IN")}</span>
                <span>Already Allocated: ₹{Number(selectedInvestorObj.totalAllocated || 0).toLocaleString("en-IN")}</span>
              </div>
            </div>
          )}

          {/* Amount Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Allocation Amount (₹) *
              </label>
              {maxAllocatable > 0 && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, amount: maxAllocatable.toString() })}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                >
                  Use Max (₹{Number(maxAllocatable || 0).toLocaleString("en-IN")})
                </button>
              )}
            </div>
            <input
              type="number"
              step="any"
              required
              placeholder="e.g. 250000"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            {selectedInvestorObj && parseFloat(formData.amount) > maxAllocatable && (
              <p className="text-[11px] text-rose-600 mt-1 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Amount exceeds available capital (Max: ₹{Number(maxAllocatable || 0).toLocaleString("en-IN")})
              </p>
            )}
          </div>

          {/* Date & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Payment Method
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                <option value="Cheque">Cheque</option>
                <option value="UPI">UPI / Net Banking</option>
                <option value="Cash">Cash</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Reference Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Reference / Cheque / UTR Number
            </label>
            <input
              type="text"
              placeholder="e.g. UTR-9821829 or CHQ-00291"
              value={formData.referenceNumber}
              onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Notes / Purpose */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Notes / Allocation Purpose
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Allocated for excavation & foundation work"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || (selectedInvestorObj ? parseFloat(formData.amount) > maxAllocatable : false)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? "Allocating Funds..." : "Confirm & Add Investor Capital to Location"}</span>
          </button>
        </form>
      </Modal>
    </div>
  );
}
