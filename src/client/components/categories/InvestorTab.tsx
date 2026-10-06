import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import {
  Users, Plus, Trash2, Banknote, Search, Calendar, FileText,
  ArrowDownLeft, ArrowUpRight, Pencil, Wallet, TrendingUp,
  CreditCard, CheckCircle2, ChevronRight, Filter, Building2,
  Download, FileSpreadsheet
} from "lucide-react";
import { useLiveSync, triggerSync } from "../../hooks/useLiveSync";
import { useToast } from "../../contexts/ToastContext";
import { downloadExcelReport } from "../../lib/excelExport";

interface InvestmentParty {
  id: number;
  locationId: number;
  locationName?: string;
  partyName: string;
  totalInvestment: number;
  totalPayment: number;
  totalUpad: number;
  totalContribution: number;
  balance: number;
  createdAt: string;
}

interface InvestmentTransaction {
  id: number;
  partyId: number;
  type: "UPAD" | "CONTRIBUTION" | "INVESTMENT";
  amount: string;
  date: string;
  description: string | null;
  paymentMethod: string | null;
  referenceNumber: string | null;
  createdAt: string;
  partyName: string;
  locationId?: number;
  locationName?: string;
}

interface LocationAllocation {
  id: number;
  investorId: number;
  investorName?: string;
  locationId: number;
  locationName?: string;
  amount: string;
  date: string;
  paymentMethod: string | null;
  referenceNumber: string | null;
  notes: string | null;
  createdAt: string;
}

export default function InvestorTab({ locationId }: { locationId?: number }) {
  const { showToast, confirmAction } = useToast();
  const [parties, setParties] = useState<InvestmentParty[]>([]);
  const [mainInvestors, setMainInvestors] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [allocations, setAllocations] = useState<LocationAllocation[]>([]);
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Active top-level subtab: 'accounts' | 'allocations' | 'investments' | 'payments' | 'contributions'
  const [activeSubTab, setActiveSubTab] = useState<"accounts" | "allocations" | "investments" | "payments" | "contributions">("accounts");
  const [selectedInvestor, setSelectedInvestor] = useState<InvestmentParty | null>(null);

  // Modals
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [isInvestmentModalOpen, setIsInvestmentModalOpen] = useState(false);
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);
  
  const [editingPartyId, setEditingPartyId] = useState<number | null>(null);
  const [editingTxId, setEditingTxId] = useState<number | null>(null);

  const [partyForm, setPartyForm] = useState({
    partyName: "",
    locationId: locationId || 0,
    initialAmount: "",
    initialDate: new Date().toISOString().split('T')[0]
  });

  // Allocation Form State (Main Capital -> Location Central Capital)
  const [allocationForm, setAllocationForm] = useState({
    investorId: "",
    locationId: locationId ? String(locationId) : "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    notes: ""
  });

  // Separate Form states for Payments, Contributions, and Project Investments (Investment Karya)
  const [paymentForm, setPaymentForm] = useState({
    partyId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    description: "",
  });

  const [contributionForm, setContributionForm] = useState({
    partyId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    description: "",
  });

  const [investmentForm, setInvestmentForm] = useState({
    partyId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    description: "Investment into Project (Investment Karya)",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [filterPartyId, setFilterPartyId] = useState<string>("ALL");

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await apiFetch("/locations");
        if (Array.isArray(res)) {
          setLocations(res);
          if (!locationId && res.length > 0) {
            setPartyForm(prev => ({ ...prev, locationId: res[0].id }));
            setAllocationForm(prev => ({ ...prev, locationId: prev.locationId || String(res[0].id) }));
          }
        }
      } catch (err) {
        console.error("Failed to load locations", err);
      }
    };
    fetchLocations();
  }, [locationId]);

  const loadData = async (isBackground = false) => {
    if (!isBackground && parties.length === 0) setLoading(true);
    try {
      // Always fetch Main Investors from Company Capital Pool
      const globalRes = await apiFetch('/investments/global-investors').catch(() => []);
      const invList = Array.isArray(globalRes) ? globalRes : (globalRes?.investors || []);
      setMainInvestors(invList);

      if (!locationId) {
        // Main Investor Pool Mode (Company-wide Global Investors)
        const allocsRes = await apiFetch('/investments/location-allocations').catch(() => []);

        const formattedParties: InvestmentParty[] = (globalRes || []).map((inv: any) => ({
          id: inv.id,
          locationId: 0,
          partyName: inv.name || inv.partyName || "",
          mobile: inv.mobile || "",
          email: inv.email || "",
          address: inv.address || "",
          notes: inv.notes || "",
          totalContribution: inv.totalCapital || 0,
          totalInvestment: 0,
          totalPayment: inv.totalUpad || 0,
          totalUpad: inv.totalUpad || 0,
          totalAllocated: inv.totalAllocated || 0,
          balance: inv.availableBalance !== undefined ? inv.availableBalance : (inv.totalCapital - inv.totalUpad - inv.totalAllocated)
        }));

        const allGlobalTxs: InvestmentTransaction[] = [];
        (globalRes || []).forEach((inv: any) => {
          if (Array.isArray(inv.transactions)) {
            inv.transactions.forEach((tx: any) => {
              allGlobalTxs.push({
                id: tx.id,
                locationId: 0,
                partyId: inv.id,
                partyName: inv.name || inv.partyName || "",
                type: tx.type === 'CAPITAL' ? 'CONTRIBUTION' : (tx.type === 'WITHDRAWAL' ? 'UPAD' : tx.type),
                amount: String(tx.amount || 0),
                date: tx.date || "",
                paymentMethod: tx.paymentMethod || "Bank Transfer",
                referenceNumber: tx.referenceNumber || "",
                description: tx.description || "",
                createdAt: tx.createdAt || tx.date
              });
            });
          }
        });

        setParties(formattedParties);
        setTransactions(allGlobalTxs);
        setAllocations(allocsRes || []);

        if (selectedInvestor) {
          const updated = formattedParties.find((p: any) => p.id === selectedInvestor.id);
          if (updated) setSelectedInvestor(updated);
        }
      } else {
        // Location Central Investor Pool Mode
        const locQuery = `?locationId=${locationId}`;
        const [partiesRes, txsRes, allocsRes] = await Promise.all([
          apiFetch(`/investments/parties${locQuery}`).catch(() => []),
          apiFetch(`/investments/transactions${locQuery}`).catch(() => []),
          apiFetch(`/investments/location-allocations${locQuery}`).catch(() => [])
        ]);
        setParties(partiesRes || []);
        setTransactions(txsRes || []);
        setAllocations(allocsRes || []);

        if (selectedInvestor) {
          const updated = (partiesRes || []).find((p: any) => p.id === selectedInvestor.id);
          if (updated) setSelectedInvestor(updated);
        }
      }
    } catch (err) {
      console.error("Failed to load investor data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, [locationId]);

  useLiveSync(() => {
    loadData(true);
  }, 3500);

  // Totals calculations
  const totalContributed = useMemo(() => {
    return transactions
      .filter(t => t.type === "CONTRIBUTION")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [transactions]);

  const totalAllocatedToLocations = useMemo(() => {
    return allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  }, [allocations]);

  const totalInvestedKarya = useMemo(() => {
    return transactions
      .filter(t => t.type === "INVESTMENT")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [transactions]);

  const totalPaidOut = useMemo(() => {
    return transactions
      .filter(t => t.type === "UPAD")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [transactions]);

  // Main Available Balance = Total Contributed Capital - Location Allocations - Upad
  const netBalance = useMemo(() => {
    return Math.round((totalContributed - totalAllocatedToLocations - totalPaidOut) * 100) / 100;
  }, [totalContributed, totalAllocatedToLocations, totalPaidOut]);

  // Save Central Location Capital Allocation (Cut from Main Pool -> Add to Location)
  const handleSaveAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocationForm.investorId || !allocationForm.locationId || !allocationForm.amount) {
      showToast("Please select an investor, location, and valid amount.", "error");
      return;
    }
    const amt = parseFloat(allocationForm.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast("Valid allocation amount required.", "error");
      return;
    }

    try {
      await apiFetch("/investments/location-allocations", {
        method: "POST",
        body: JSON.stringify({
          investorId: parseInt(allocationForm.investorId, 10),
          locationId: parseInt(allocationForm.locationId, 10),
          amount: amt,
          date: allocationForm.date,
          paymentMethod: allocationForm.paymentMethod,
          referenceNumber: allocationForm.referenceNumber,
          notes: allocationForm.notes
        })
      });

      triggerSync("location_allocations");
      triggerSync("global_investors");
      setIsAllocationModalOpen(false);
      setAllocationForm({
        investorId: "",
        locationId: locationId ? String(locationId) : (locations[0]?.id ? String(locations[0].id) : ""),
        amount: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        referenceNumber: "",
        notes: ""
      });
      showToast("Capital successfully allocated from Main Investor Capital to location!", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to allocate capital.", "error");
    }
  };

  const handleDeleteAllocation = async (id: number) => {
    if (!confirmAction("Are you sure you want to revert this capital transfer? The amount will return to the Main Investor balance.")) return;
    try {
      await apiFetch(`/investments/location-allocations/${id}`, { method: "DELETE" });
      triggerSync("location_allocations");
      triggerSync("global_investors");
      showToast("Transfer reverted. Amount credited back to Main Investor.", "info");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete allocation.", "error");
    }
  };

  const handleOpenAllocationModal = async (customInvestorId?: string) => {
    let currentMainInvs = mainInvestors;
    if (!currentMainInvs || currentMainInvs.length === 0) {
      try {
        const res = await apiFetch('/investments/global-investors');
        const list = Array.isArray(res) ? res : (res?.investors || []);
        if (list.length > 0) {
          currentMainInvs = list;
          setMainInvestors(list);
        }
      } catch (e) {
        console.error("Failed to fetch main investors on open:", e);
      }
    }

    const targetInvId = customInvestorId || (selectedInvestor ? selectedInvestor.id.toString() : (currentMainInvs[0]?.id ? String(currentMainInvs[0].id) : ""));
    setAllocationForm({
      investorId: targetInvId,
      locationId: locationId ? String(locationId) : (locations[0]?.id ? String(locations[0].id) : ""),
      amount: "",
      date: new Date().toISOString().split("T")[0],
      paymentMethod: "Bank Transfer",
      referenceNumber: "",
      notes: ""
    });
    setIsAllocationModalOpen(true);
  };

  // Save Investor
  const handleSaveParty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const upperName = partyForm.partyName.trim().toUpperCase();

      if (!locationId) {
        // Main Investors Pool Mode (Global Investor - No Location Attachment)
        const url = editingPartyId ? `/investments/global-investors/${editingPartyId}` : "/investments/global-investors";
        const method = editingPartyId ? "PUT" : "POST";
        const res = await apiFetch(url, {
          method,
          body: JSON.stringify({
            name: upperName,
            initialContribution: parseFloat(partyForm.initialAmount) || 0,
            initialDate: partyForm.initialDate
          })
        });
        triggerSync("global_investors");
        setPartyForm({ partyName: "", locationId: 0, initialAmount: "", initialDate: new Date().toISOString().split('T')[0] });
        setEditingPartyId(null);
        setIsPartyModalOpen(false);

        if (res?.isExisting) {
          showToast(`Investor "${upperName}" already exists! Amount was credited to their account.`, "info");
        } else {
          showToast(editingPartyId ? "Main Investor updated" : "Main Investor added to Company Capital Pool", "success");
        }
      } else {
        // Location Central Investor Pool Mode
        const url = editingPartyId ? `/investments/parties/${editingPartyId}` : "/investments/parties";
        const method = editingPartyId ? "PUT" : "POST";
        const res = await apiFetch(url, {
          method,
          body: JSON.stringify({
            locationId: locationId,
            partyName: upperName,
            initialAmount: parseFloat(partyForm.initialAmount) || 0,
            initialDate: partyForm.initialDate
          })
        });
        triggerSync("investor_parties");
        setPartyForm({ partyName: "", locationId: locationId, initialAmount: "", initialDate: new Date().toISOString().split('T')[0] });
        setEditingPartyId(null);
        setIsPartyModalOpen(false);

        if (res?.isExisting) {
          showToast(`Location investor "${upperName}" already exists!`, "info");
        } else {
          showToast(editingPartyId ? "Location Investor updated" : "Location Investor created for Central Pool", "success");
        }
      }
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to save investor.", "error");
    }
  };

  // Save Payment / Upad to Investor
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.partyId || !paymentForm.amount) return;
    try {
      const partyId = parseInt(paymentForm.partyId, 10);
      const amt = parseFloat(paymentForm.amount);

      if (!locationId) {
        // Main Investor Global Upad
        await apiFetch(`/investments/global-investors/${partyId}/transactions`, {
          method: "POST",
          body: JSON.stringify({
            type: "UPAD",
            amount: amt,
            date: paymentForm.date,
            paymentMethod: paymentForm.paymentMethod,
            referenceNumber: paymentForm.referenceNumber,
            description: paymentForm.description
          })
        });
        triggerSync("global_investors");
      } else {
        // Location Investor Upad
        const url = editingTxId ? `/investments/transactions/${editingTxId}` : "/investments/transactions";
        const method = editingTxId ? "PUT" : "POST";
        await apiFetch(url, {
          method,
          body: JSON.stringify({
            locationId: locationId,
            partyId: partyId,
            type: "UPAD",
            amount: amt,
            date: paymentForm.date,
            paymentMethod: paymentForm.paymentMethod,
            referenceNumber: paymentForm.referenceNumber,
            description: paymentForm.description
          })
        });
        triggerSync("investor_txs");
      }

      setPaymentForm({
        partyId: selectedInvestor ? selectedInvestor.id.toString() : "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        referenceNumber: "",
        description: "",
      });
      setEditingTxId(null);
      setIsPaymentModalOpen(false);
      showToast(editingTxId ? "Payment updated" : "Investor payment recorded", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to record investor payment.", "error");
    }
  };

  // Save Capital Contribution from Investor
  const handleSaveContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributionForm.partyId || !contributionForm.amount) return;
    try {
      const partyId = parseInt(contributionForm.partyId, 10);
      const amt = parseFloat(contributionForm.amount);

      if (!locationId) {
        // Main Investor Global Contribution
        await apiFetch(`/investments/global-investors/${partyId}/transactions`, {
          method: "POST",
          body: JSON.stringify({
            type: "CONTRIBUTION",
            amount: amt,
            date: contributionForm.date,
            paymentMethod: contributionForm.paymentMethod,
            referenceNumber: contributionForm.referenceNumber,
            description: contributionForm.description
          })
        });
        triggerSync("global_investors");
      } else {
        // Location Investor Contribution
        const url = editingTxId ? `/investments/transactions/${editingTxId}` : "/investments/transactions";
        const method = editingTxId ? "PUT" : "POST";
        await apiFetch(url, {
          method,
          body: JSON.stringify({
            locationId: locationId,
            partyId: partyId,
            type: "CONTRIBUTION",
            amount: amt,
            date: contributionForm.date,
            paymentMethod: contributionForm.paymentMethod,
            referenceNumber: contributionForm.referenceNumber,
            description: contributionForm.description
          })
        });
        triggerSync("investor_txs");
      }

      setContributionForm({
        partyId: selectedInvestor ? selectedInvestor.id.toString() : "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        referenceNumber: "",
        description: "",
      });
      setEditingTxId(null);
      setIsContributionModalOpen(false);
      showToast(editingTxId ? "Contribution updated" : "Capital contribution recorded", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to record capital contribution.", "error");
    }
  };

  // Save Investment Deployed / Investment Karya (which cuts from this investor's balance)
  const handleSaveInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!investmentForm.partyId || !investmentForm.amount) return;
    try {
      const partyId = parseInt(investmentForm.partyId, 10);
      const amt = parseFloat(investmentForm.amount);

      if (!locationId) {
        await apiFetch(`/investments/global-investors/${partyId}/transactions`, {
          method: "POST",
          body: JSON.stringify({
            type: "INVESTMENT",
            amount: amt,
            date: investmentForm.date,
            paymentMethod: investmentForm.paymentMethod,
            referenceNumber: investmentForm.referenceNumber,
            description: investmentForm.description || "Investment into Project (Investment Karya)"
          })
        });
        triggerSync("global_investors");
      } else {
        const url = editingTxId ? `/investments/transactions/${editingTxId}` : "/investments/transactions";
        const method = editingTxId ? "PUT" : "POST";
        await apiFetch(url, {
          method,
          body: JSON.stringify({
            locationId: locationId,
            partyId: partyId,
            type: "INVESTMENT",
            amount: amt,
            date: investmentForm.date,
            paymentMethod: investmentForm.paymentMethod,
            referenceNumber: investmentForm.referenceNumber,
            description: investmentForm.description || "Investment into Project (Investment Karya)"
          })
        });
        triggerSync("investor_txs");
        triggerSync("investments");
      }

      setInvestmentForm({
        partyId: selectedInvestor ? selectedInvestor.id.toString() : "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        referenceNumber: "",
        description: "Investment into Project (Investment Karya)",
      });
      setEditingTxId(null);
      setIsInvestmentModalOpen(false);
      showToast(editingTxId ? "Investment updated" : "Investment recorded successfully", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to record investment deployment.", "error");
    }
  };

  const handleDeleteParty = async (id: number) => {
    const confirmed = await confirmAction({
      title: "Delete Investor",
      message: "Are you sure you want to delete this investor? All associated transaction history will be removed.",
      confirmLabel: "Delete Investor",
      isDanger: true
    });
    if (!confirmed) return;
    try {
      if (!locationId) {
        await apiFetch(`/investments/global-investors/${id}`, { method: "DELETE" });
        triggerSync("global_investors");
      } else {
        await apiFetch(`/investments/parties/${id}?locationId=${locationId}`, { method: "DELETE" });
        triggerSync("investor_parties");
      }
      if (selectedInvestor?.id === id) setSelectedInvestor(null);
      showToast("Investor deleted", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete investor.", "error");
    }
  };

  const handleDeleteTx = async (id: number) => {
    const confirmed = await confirmAction({
      title: "Delete Transaction",
      message: "Are you sure you want to delete this transaction?",
      confirmLabel: "Delete",
      isDanger: true
    });
    if (!confirmed) return;
    try {
      if (!locationId) {
        await apiFetch(`/investments/global-investors/transactions/${id}`, { method: "DELETE" });
        triggerSync("global_investors");
      } else {
        await apiFetch(`/investments/transactions/${id}?locationId=${locationId}`, { method: "DELETE" });
        triggerSync("investor_txs");
      }
      showToast("Transaction deleted", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete transaction.", "error");
    }
  };
  
  const openEditParty = (party: InvestmentParty, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPartyId(party.id);
    setPartyForm({
      partyName: party.partyName,
      locationId: party.locationId || locationId || 0,
      initialAmount: "0",
      initialDate: new Date().toISOString().split('T')[0]
    });
    setIsPartyModalOpen(true);
  };
  
  const openEditTx = (tx: InvestmentTransaction) => {
    setEditingTxId(tx.id);
    if (tx.type === "UPAD") {
      setPaymentForm({
        partyId: tx.partyId.toString(),
        amount: tx.amount,
        date: tx.date || new Date().toISOString().split("T")[0],
        paymentMethod: tx.paymentMethod || "Bank Transfer",
        referenceNumber: tx.referenceNumber || "",
        description: tx.description || "",
      });
      setIsPaymentModalOpen(true);
    } else if (tx.type === "INVESTMENT") {
      setInvestmentForm({
        partyId: tx.partyId.toString(),
        amount: tx.amount,
        date: tx.date || new Date().toISOString().split("T")[0],
        paymentMethod: tx.paymentMethod || "Bank Transfer",
        referenceNumber: tx.referenceNumber || "",
        description: tx.description || "",
      });
      setIsInvestmentModalOpen(true);
    } else {
      setContributionForm({
        partyId: tx.partyId.toString(),
        amount: tx.amount,
        date: tx.date || new Date().toISOString().split("T")[0],
        paymentMethod: tx.paymentMethod || "Bank Transfer",
        referenceNumber: tx.referenceNumber || "",
        description: tx.description || "",
      });
      setIsContributionModalOpen(true);
    }
  };

  const filteredParties = useMemo(() => {
    if (!searchTerm) return parties;
    return parties.filter(p => p.partyName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [parties, searchTerm]);

  const paymentTransactions = useMemo(() => {
    return transactions.filter(t => {
      const isUpad = t.type === "UPAD";
      if (!isUpad) return false;
      if (filterPartyId !== "ALL" && String(t.partyId) !== filterPartyId) return false;
      return true;
    });
  }, [transactions, filterPartyId]);

  const contributionTransactions = useMemo(() => {
    return transactions.filter(t => {
      const isContribution = t.type === "CONTRIBUTION";
      if (!isContribution) return false;
      if (filterPartyId !== "ALL" && String(t.partyId) !== filterPartyId) return false;
      return true;
    });
  }, [transactions, filterPartyId]);

  const investmentTransactions = useMemo(() => {
    return transactions.filter(t => {
      const isInvestment = t.type === "INVESTMENT";
      if (!isInvestment) return false;
      if (filterPartyId !== "ALL" && String(t.partyId) !== filterPartyId) return false;
      return true;
    });
  }, [transactions, filterPartyId]);

  return (
    <div className="space-y-6">
      {/* Top Banner with Clear Separation */}
      <div className="bg-gradient-to-r from-emerald-600/10 via-teal-600/5 to-emerald-600/10 border border-emerald-200/80 p-5 rounded-2xl flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Main Investor Capital & Central Location Allocations</h2>
            <p className="text-xs text-slate-600">
              Direct Main Investor Capital store & Multi-Step Central Capital allocation flow to locations.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {locationId ? (
            <button
              onClick={() => handleOpenAllocationModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer border border-emerald-400/30"
              title="Add Fund from Main Investor Capital to this Central Location Pool"
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-100" /> + Add Fund from Main Investor Capital
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setEditingPartyId(null);
                  setPartyForm({ partyName: "", locationId: locationId || 0, initialAmount: "", initialDate: new Date().toISOString().split('T')[0] });
                  setIsPartyModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold shadow hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Investor
              </button>

              <button
                onClick={() => {
                  setEditingTxId(null);
                  setContributionForm({
                    partyId: selectedInvestor ? selectedInvestor.id.toString() : (parties[0]?.id?.toString() || ""),
                    amount: "",
                    date: new Date().toISOString().split("T")[0],
                    paymentMethod: "Bank Transfer",
                    referenceNumber: "",
                    description: "",
                  });
                  setIsContributionModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                <ArrowUpRight className="w-3.5 h-3.5" /> + Record Main Capital (IN)
              </button>
            </>
          )}

          {locationId ? (
            <button
              onClick={() => {
                setEditingTxId(null);
                setInvestmentForm({
                  partyId: selectedInvestor ? selectedInvestor.id.toString() : (parties[0]?.id?.toString() || ""),
                  amount: "",
                  date: new Date().toISOString().split("T")[0],
                  paymentMethod: "Bank Transfer",
                  referenceNumber: "",
                  description: "Investment into Project (Investment Karya)",
                });
                setIsInvestmentModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md hover:bg-teal-800 transition-colors cursor-pointer"
            >
              <TrendingUp className="w-3.5 h-3.5" /> + Investment Karya (Project)
            </button>
          ) : null}

          <button
            onClick={() => {
              setEditingTxId(null);
              setPaymentForm({
                partyId: selectedInvestor ? selectedInvestor.id.toString() : (parties[0]?.id?.toString() || ""),
                amount: "",
                date: new Date().toISOString().split("T")[0],
                paymentMethod: "Bank Transfer",
                referenceNumber: "",
                description: "",
              });
              setIsPaymentModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-amber-700 transition-colors cursor-pointer"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" /> + Record Upad / Payment (OUT)
          </button>
        </div>
      </div>

      {/* Summary KPI Cards - Multi-Step Main & Central Investor Flow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Main Investors Total Capital */}
        <div className="bg-emerald-50 border border-emerald-200/70 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">1. Main Investor Total Capital</span>
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-800">₹{totalContributed.toLocaleString()}</div>
            <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">Total Main Capital Deposited</p>
          </div>
        </div>

        {/* 2. Transferred to Central Location Capital (Cut from Main Pool) */}
        <div className="bg-indigo-50 border border-indigo-200/70 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">2. Transferred to Locations</span>
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <Building2 className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-indigo-800">-₹{totalAllocatedToLocations.toLocaleString()}</div>
            <p className="text-[11px] text-indigo-600 mt-0.5 font-medium">Allocated to Project Locations</p>
          </div>
        </div>

        {/* 3. Upad */}
        <div className="bg-amber-50 border border-amber-200/70 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">3. Investor Upad Total</span>
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-800">-₹{totalPaidOut.toLocaleString()}</div>
            <p className="text-[11px] text-amber-600 mt-0.5 font-medium">Total Personal Withdrawals</p>
          </div>
        </div>

        {/* 4. Available Main Investor Balance */}
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">4. Available Main Balance</span>
            <div className="p-2 bg-white/10 text-indigo-200 rounded-lg">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">₹{netBalance.toLocaleString()}</div>
            <p className="text-[11px] text-indigo-300 mt-0.5 font-medium">Main Investor Available Balance</p>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex bg-slate-100 p-1.5 rounded-xl gap-2 overflow-x-auto">
        <button
          onClick={() => { setActiveSubTab("accounts"); setSelectedInvestor(null); }}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeSubTab === "accounts"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Users className="w-4 h-4 text-slate-500" />
          1. Investor Accounts ({parties.length})
        </button>

        <button
          onClick={() => setActiveSubTab("allocations")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeSubTab === "allocations"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Building2 className="w-4 h-4" />
          2. Central Location Allocations ({allocations.length})
        </button>

        <button
          onClick={() => setActiveSubTab("investments")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeSubTab === "investments"
              ? "bg-teal-700 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          3. Investment Karya Deployed ({investmentTransactions.length})
        </button>

        <button
          onClick={() => setActiveSubTab("contributions")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeSubTab === "contributions"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          4. Capital Contributions ({contributionTransactions.length})
        </button>

        <button
          onClick={() => setActiveSubTab("payments")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeSubTab === "payments"
              ? "bg-amber-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          5. Upad & Payments ({paymentTransactions.length})
        </button>
      </div>

      {/* SUBTAB 1: INVESTOR ACCOUNTS & BALANCES */}
      {activeSubTab === "accounts" && (
        <>
          {!selectedInvestor ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative flex-1 w-full max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search investors by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  onClick={() => downloadExcelReport(`/reports/export-location/${locationId}?tab=investors`, `All_Investors_Location_${locationId}.xlsx`)}
                  className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                  title="Export complete investors list and balances to Excel"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export All Investors (.xlsx)
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredParties.map(party => {
                  const partyContributed = Number(party.totalContribution || 0);
                  const partyInvested = transactions
                    .filter(t => t.partyId === party.id && t.type === "INVESTMENT")
                    .reduce((s, t) => s + Number(t.amount || 0), 0);
                  const partyUpad = Number(party.totalUpad || 0);
                  const partyNet = Math.round((partyContributed - partyInvested - partyUpad) * 100) / 100;

                  return (
                    <div
                      key={party.id}
                      onClick={() => setSelectedInvestor(party)}
                      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer relative group"
                    >
                      <div className="absolute top-4 right-4 flex gap-1.5 items-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadExcelReport(`/reports/export-investor/${party.id}`, `Investor_${party.partyName.replace(/\s+/g, '_')}_Passbook.xlsx`);
                          }}
                          className="p-1.5 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg shadow-xs border border-emerald-200 transition-colors cursor-pointer"
                          title="Download Investor Excel Passbook"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        </button>
                        <button
                          onClick={(e) => openEditParty(party, e)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg shadow-xs border border-slate-200 transition-colors cursor-pointer"
                          title="Edit Investor Name"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteParty(party.id); }}
                          className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg shadow-xs border border-rose-200 transition-colors cursor-pointer"
                          title="Delete Investor Account"
                        >
                          <Trash2 className="w-4 h-4 text-rose-600" />
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm">
                          {party.partyName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 text-base">{party.partyName}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-medium">Investor Account</span>
                            {party.locationName && (
                              <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded text-[10px] font-bold flex items-center gap-1">
                                <Building2 className="w-2.5 h-2.5 text-emerald-600" />
                                {party.locationName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium">Total Capital Contributed:</span>
                          <span className="font-bold text-emerald-600">₹{partyContributed.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium">Investment Karya (Deployed):</span>
                          <span className="font-bold text-indigo-600">₹{partyInvested.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium">Total Payments / Upad:</span>
                          <span className="font-bold text-amber-600">₹{partyUpad.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-100 border-dashed">
                          <span className="text-slate-800 font-black">Net Outstanding Balance:</span>
                          <span className="font-black text-slate-900 text-sm">₹{partyNet.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-emerald-600 font-bold group-hover:text-emerald-700">
                        <span>View Detailed Ledger</span>
                        <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  );
                })}

                {filteredParties.length === 0 && !loading && (
                  <div className="col-span-full p-10 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
                    <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="font-semibold text-sm text-slate-700">No investors found.</p>
                    <p className="text-xs text-slate-400 mt-1">Click "+ Add Investor" to create your first investor account.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Selected Investor Individual Ledger */
            <div className="space-y-4">
              <button
                onClick={() => setSelectedInvestor(null)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm cursor-pointer"
              >
                &larr; Back to All Investors
              </button>
              
              {(() => {
                const selContributed = Number(selectedInvestor.totalContribution || 0);
                const selInvested = transactions
                  .filter(t => t.partyId === selectedInvestor.id && t.type === "INVESTMENT")
                  .reduce((s, t) => s + Number(t.amount || 0), 0);
                const selUpad = Number(selectedInvestor.totalUpad || 0);
                const selNet = Math.round((selContributed - selInvested - selUpad) * 100) / 100;

                return (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                          {selectedInvestor.partyName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-2xl font-black text-slate-900">{selectedInvestor.partyName}</h2>
                            <button
                              onClick={() => downloadExcelReport(`/reports/export-investor/${selectedInvestor.id}`, `Investor_${selectedInvestor.partyName.replace(/\s+/g, '_')}_Passbook.xlsx`)}
                              className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title="Export this investor's personal ledger to Excel"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Export (.xlsx)
                            </button>
                            <button
                              onClick={(e) => openEditParty(selectedInvestor, e)}
                              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title="Edit Investor Name"
                            >
                              <Pencil className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteParty(selectedInvestor.id)}
                              className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title="Delete Investor Account"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              Delete Account
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 font-medium">Complete Individual Ledger & Balance Sheet</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Total Capital IN</div>
                          <div className="text-base sm:text-lg font-black text-emerald-600">₹{selContributed.toLocaleString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-indigo-400 uppercase">Investment Karya (OUT)</div>
                          <div className="text-base sm:text-lg font-black text-indigo-600">₹{selInvested.toLocaleString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-amber-400 uppercase">Total Upad (OUT)</div>
                          <div className="text-base sm:text-lg font-black text-amber-600">₹{selUpad.toLocaleString()}</div>
                        </div>
                        <div className="text-right pl-2 sm:pl-4 border-l border-slate-200">
                          <div className="text-[10px] font-bold text-slate-500 uppercase">Available Net</div>
                          <div className="text-lg sm:text-2xl font-black text-slate-900">₹{selNet.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="p-3.5">Date</th>
                            <th className="p-3.5">Location / Project</th>
                            <th className="p-3.5">Transaction Type</th>
                            <th className="p-3.5">Method & Reference</th>
                            <th className="p-3.5">Notes / Purpose</th>
                            <th className="p-3.5 text-right text-emerald-700">Capital (IN)</th>
                            <th className="p-3.5 text-right text-indigo-700">Investment Karya (OUT)</th>
                            <th className="p-3.5 text-right text-amber-700">Payment / Upad (OUT)</th>
                            <th className="p-3.5 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {transactions
                            .filter(t => t.partyId === selectedInvestor.id)
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map(tx => (
                              <tr key={tx.id} className="hover:bg-slate-50">
                                <td className="p-3.5 text-slate-600 font-medium">{tx.date}</td>
                                <td className="p-3.5">
                                  <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded text-[10px] font-bold flex items-center gap-1 w-fit">
                                    <Building2 className="w-2.5 h-2.5 text-emerald-600" />
                                    {tx.locationName || selectedInvestor.locationName || "Site"}
                                  </span>
                                </td>
                                <td className="p-3.5">
                                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                                    tx.type === 'CONTRIBUTION'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : tx.type === 'INVESTMENT'
                                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                                  }`}>
                                    {tx.type === 'CONTRIBUTION' ? 'CAPITAL INFLOW (+)' : tx.type === 'INVESTMENT' ? 'INVESTMENT KARYA (-)' : 'UPAD / PAYOUT (-)'}
                                  </span>
                                </td>
                                <td className="p-3.5 text-slate-700">
                                  <div className="font-semibold">{tx.paymentMethod || "Bank Transfer"}</div>
                                  {tx.referenceNumber && <div className="text-[10px] text-slate-400 font-mono">Ref: {tx.referenceNumber}</div>}
                                </td>
                                <td className="p-3.5 text-slate-600 max-w-[220px] truncate">
                                  {tx.description || '-'}
                                </td>
                                <td className="p-3.5 text-right font-black text-emerald-600">
                                  {tx.type === 'CONTRIBUTION' ? `+₹${Number(tx.amount).toLocaleString()}` : '-'}
                                </td>
                                <td className="p-3.5 text-right font-black text-indigo-600">
                                  {tx.type === 'INVESTMENT' ? `-₹${Number(tx.amount).toLocaleString()}` : '-'}
                                </td>
                                <td className="p-3.5 text-right font-black text-amber-600">
                                  {tx.type === 'UPAD' ? `-₹${Number(tx.amount).toLocaleString()}` : '-'}
                                </td>
                                <td className="p-3.5 text-center">
                                  <button onClick={() => openEditTx(tx)} className="text-slate-400 hover:text-emerald-600 p-1 mr-1 cursor-pointer" title="Edit">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleDeleteTx(tx.id)} className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer" title="Delete">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          {transactions.filter(t => t.partyId === selectedInvestor.id).length === 0 && (
                            <tr><td colSpan={8} className="p-8 text-center text-slate-500">No transactions recorded for this investor yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}

      {/* SUBTAB 2: CENTRAL LOCATION CAPITAL ALLOCATIONS REGISTER */}
      {activeSubTab === "allocations" && (
        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h3 className="font-black text-indigo-900 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-700" />
                Central Location Capital Allocations Register
              </h3>
              <p className="text-xs text-indigo-700">
                Capital transferred from Main Investor Pool to specific project locations. Deducted from Main Available Balance and credited to the Location's Central Capital & Category 1 Investment.
              </p>
            </div>

            <button
              onClick={() => handleOpenAllocationModal(selectedInvestor ? selectedInvestor.id.toString() : undefined)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow hover:bg-indigo-700 transition-colors shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> + Transfer to Location
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Transfer Date</th>
                    <th className="p-3.5">Investor Name</th>
                    <th className="p-3.5">Target Location</th>
                    <th className="p-3.5">Payment Method</th>
                    <th className="p-3.5">Reference / Transaction No.</th>
                    <th className="p-3.5">Purpose / Notes</th>
                    <th className="p-3.5 text-right font-bold text-indigo-700">Allocated Amount (₹)</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allocations
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(alloc => (
                      <tr key={alloc.id} className="hover:bg-slate-50">
                        <td className="p-3.5 text-slate-600 font-medium">{alloc.date}</td>
                        <td className="p-3.5 font-bold text-slate-900">{alloc.investorName || "Investor"}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded text-[11px] font-bold flex items-center gap-1 w-fit">
                            <Building2 className="w-3 h-3 text-indigo-600" />
                            {alloc.locationName || "Project Location"}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-semibold">
                            {alloc.paymentMethod || "Bank Transfer"}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-600">{alloc.referenceNumber || "-"}</td>
                        <td className="p-3.5 text-slate-600 max-w-[200px] truncate">{alloc.notes || "-"}</td>
                        <td className="p-3.5 text-right font-black text-indigo-700 text-sm">
                          ₹{Number(alloc.amount).toLocaleString()}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => handleDeleteAllocation(alloc.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                            title="Delete allocation (Return funds to Main Pool)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  {allocations.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No location allocations recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {allocations.length > 0 && (
              <div className="p-4 bg-indigo-50/50 border-t border-indigo-100 flex justify-between items-center text-xs">
                <span className="font-bold text-indigo-900">Total Transferred to Locations ({allocations.length} records):</span>
                <span className="text-base font-black text-indigo-800">
                  ₹{allocations.reduce((s, a) => s + Number(a.amount || 0), 0).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: INVESTMENTS DEPLOYED / INVESTMENT KARYA REGISTER */}
      {activeSubTab === "investments" && (
        <div className="space-y-4">
          <div className="bg-indigo-500/10 border border-indigo-200 p-4 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h3 className="font-black text-indigo-900 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-700" />
                Investments Deployed / Investment Karya Register (Linked with Cat 2)
              </h3>
              <p className="text-xs text-indigo-700">Records where investor capital was drawn and deployed as project investment. Automatically deducted from investor balance.</p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={filterPartyId}
                onChange={e => setFilterPartyId(e.target.value)}
                className="bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="ALL">All Investors</option>
                {parties.map(p => (
                  <option key={p.id} value={p.id.toString()}>{p.partyName}</option>
                ))}
              </select>

              <button
                onClick={() => {
                  setEditingTxId(null);
                  setInvestmentForm({
                    partyId: filterPartyId !== "ALL" ? filterPartyId : (parties[0]?.id?.toString() || ""),
                    amount: "",
                    date: new Date().toISOString().split("T")[0],
                    paymentMethod: "Bank Transfer",
                    referenceNumber: "",
                    description: "Investment into Project (Investment Karya)",
                  });
                  setIsInvestmentModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow hover:bg-indigo-700 transition-colors shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Record Investment Karya
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Deployment Date</th>
                    <th className="p-3.5">Investor Name</th>
                    <th className="p-3.5">Project / Location</th>
                    <th className="p-3.5">Payment Method</th>
                    <th className="p-3.5">Reference / Cheque No.</th>
                    <th className="p-3.5">Purpose / Notes</th>
                    <th className="p-3.5 text-right font-bold text-indigo-700">Amount Deployed (₹)</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {investmentTransactions
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="p-3.5 text-slate-600 font-medium">{tx.date}</td>
                        <td className="p-3.5 font-bold text-slate-900">{tx.partyName}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-900 rounded text-[11px] font-bold flex items-center gap-1 w-fit">
                            <Building2 className="w-3 h-3 text-indigo-600" />
                            {tx.locationName || "Project Site"}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-semibold">
                            {tx.paymentMethod || "Bank Transfer"}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-600">{tx.referenceNumber || "-"}</td>
                        <td className="p-3.5 text-slate-600 max-w-[200px] truncate">{tx.description || "-"}</td>
                        <td className="p-3.5 text-right font-black text-indigo-700 text-sm">
                          ₹{Number(tx.amount).toLocaleString()}
                        </td>
                        <td className="p-3.5 text-center">
                          <button onClick={() => openEditTx(tx)} className="text-slate-400 hover:text-indigo-600 p-1 mr-1 cursor-pointer" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteTx(tx.id)} className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  {investmentTransactions.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-slate-500">No investment deployments recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {investmentTransactions.length > 0 && (
              <div className="p-4 bg-indigo-50/50 border-t border-indigo-100 flex justify-between items-center text-xs">
                <span className="font-bold text-indigo-900">Total Investment Karya Deployed ({investmentTransactions.length} records):</span>
                <span className="text-base font-black text-indigo-800">₹{investmentTransactions.reduce((s, t) => s + Number(t.amount || 0), 0).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: INVESTOR PAYMENTS & UPAD REGISTER */}
      {activeSubTab === "payments" && (
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-200 p-4 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h3 className="font-black text-amber-900 text-sm flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-amber-700" />
                Investor Payment & Upad Register (All Payouts / Returns)
              </h3>
              <p className="text-xs text-amber-700">Dedicated register for all repayments, withdrawals, and payouts made to investors.</p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={filterPartyId}
                onChange={e => setFilterPartyId(e.target.value)}
                className="bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="ALL">All Investors</option>
                {parties.map(p => (
                  <option key={p.id} value={p.id.toString()}>{p.partyName}</option>
                ))}
              </select>

              <button
                onClick={() => {
                  setEditingTxId(null);
                  setPaymentForm({
                    partyId: filterPartyId !== "ALL" ? filterPartyId : (parties[0]?.id?.toString() || ""),
                    amount: "",
                    date: new Date().toISOString().split("T")[0],
                    paymentMethod: "Bank Transfer",
                    referenceNumber: "",
                    description: "",
                  });
                  setIsPaymentModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold shadow hover:bg-amber-700 transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Record Payment / Upad
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Payment Date</th>
                    <th className="p-3.5">Investor Name</th>
                    <th className="p-3.5">Project / Location</th>
                    <th className="p-3.5">Payment Method</th>
                    <th className="p-3.5">Reference / Cheque No.</th>
                    <th className="p-3.5">Purpose / Notes</th>
                    <th className="p-3.5 text-right font-bold text-amber-700">Amount Paid (₹)</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentTransactions
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="p-3.5 text-slate-600 font-medium">{tx.date}</td>
                        <td className="p-3.5 font-bold text-slate-900">{tx.partyName}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-900 rounded text-[11px] font-bold flex items-center gap-1 w-fit">
                            <Building2 className="w-3 h-3 text-amber-600" />
                            {tx.locationName || "Project Site"}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-semibold">
                            {tx.paymentMethod || "Bank Transfer"}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-600">{tx.referenceNumber || "-"}</td>
                        <td className="p-3.5 text-slate-600 max-w-[200px] truncate">{tx.description || "-"}</td>
                        <td className="p-3.5 text-right font-black text-amber-700 text-sm">
                          ₹{Number(tx.amount).toLocaleString()}
                        </td>
                        <td className="p-3.5 text-center">
                          <button onClick={() => openEditTx(tx)} className="text-slate-400 hover:text-amber-600 p-1 mr-1" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteTx(tx.id)} className="text-slate-400 hover:text-rose-600 p-1" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  {paymentTransactions.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-slate-500">No investor payments / upads recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {paymentTransactions.length > 0 && (
              <div className="p-4 bg-amber-50/50 border-t border-amber-100 flex justify-between items-center text-xs">
                <span className="font-bold text-amber-900">Total Investor Payouts ({paymentTransactions.length} records):</span>
                <span className="text-base font-black text-amber-800">₹{paymentTransactions.reduce((s, t) => s + Number(t.amount || 0), 0).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: INVESTOR CAPITAL CONTRIBUTIONS */}
      {activeSubTab === "contributions" && (
        <div className="space-y-4">
          <div className="bg-emerald-500/10 border border-emerald-200 p-4 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h3 className="font-black text-emerald-900 text-sm flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-700" />
                Investor Capital Contribution Register (Capital Inflows)
              </h3>
              <p className="text-xs text-emerald-700">Direct cash and bank capital brought into the business by partners / investors.</p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={filterPartyId}
                onChange={e => setFilterPartyId(e.target.value)}
                className="bg-white border border-emerald-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="ALL">All Investors</option>
                {parties.map(p => (
                  <option key={p.id} value={p.id.toString()}>{p.partyName}</option>
                ))}
              </select>

              <button
                onClick={() => {
                  setEditingTxId(null);
                  setContributionForm({
                    partyId: filterPartyId !== "ALL" ? filterPartyId : (parties[0]?.id?.toString() || ""),
                    amount: "",
                    date: new Date().toISOString().split("T")[0],
                    paymentMethod: "Bank Transfer",
                    referenceNumber: "",
                    description: "",
                  });
                  setIsContributionModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow hover:bg-emerald-700 transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Record Capital Contribution
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Investor Name</th>
                    <th className="p-3.5">Project / Location</th>
                    <th className="p-3.5">Payment Method</th>
                    <th className="p-3.5">Reference No.</th>
                    <th className="p-3.5">Description / Purpose</th>
                    <th className="p-3.5 text-right font-bold text-emerald-700">Capital Invested (₹)</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contributionTransactions
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="p-3.5 text-slate-600 font-medium">{tx.date}</td>
                        <td className="p-3.5 font-bold text-slate-900">{tx.partyName}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-900 rounded text-[11px] font-bold flex items-center gap-1 w-fit">
                            <Building2 className="w-3 h-3 text-emerald-600" />
                            {tx.locationName || "Project Site"}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-semibold">
                            {tx.paymentMethod || "Bank Transfer"}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-600">{tx.referenceNumber || "-"}</td>
                        <td className="p-3.5 text-slate-600 max-w-[200px] truncate">{tx.description || "-"}</td>
                        <td className="p-3.5 text-right font-black text-emerald-700 text-sm">
                          ₹{Number(tx.amount).toLocaleString()}
                        </td>
                        <td className="p-3.5 text-center">
                          <button onClick={() => openEditTx(tx)} className="text-slate-400 hover:text-emerald-600 p-1 mr-1" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteTx(tx.id)} className="text-slate-400 hover:text-rose-600 p-1" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  {contributionTransactions.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-slate-500">No investor capital contributions recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {contributionTransactions.length > 0 && (
              <div className="p-4 bg-emerald-50/50 border-t border-emerald-100 flex justify-between items-center text-xs">
                <span className="font-bold text-emerald-900">Total Capital Contributed ({contributionTransactions.length} records):</span>
                <span className="text-base font-black text-emerald-800">₹{contributionTransactions.reduce((s, t) => s + Number(t.amount || 0), 0).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Add / Edit Investor Account */}
      <Modal
        isOpen={isPartyModalOpen}
        onClose={() => setIsPartyModalOpen(false)}
        maxWidth="md"
        title={editingPartyId ? "Edit Investor Account" : "Add New Investor Account"}
      >
        <form onSubmit={handleSaveParty} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Investor / Partner Full Name (UPPERCASE) *</label>
            <input
              type="text"
              required
              value={partyForm.partyName}
              onChange={e => setPartyForm({ ...partyForm, partyName: e.target.value.toUpperCase() })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 font-bold uppercase tracking-wide"
              placeholder="e.g. RAJESH PATEL, SHRI HARI DEVELOPERS"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Note: If an investor already exists, the contribution will be credited directly to their existing account balance.
            </p>
          </div>

          {!editingPartyId && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Initial Capital (Optional)</label>
                <input
                  type="number"
                  step="any"
                  value={partyForm.initialAmount}
                  onChange={e => setPartyForm({ ...partyForm, initialAmount: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={partyForm.initialDate}
                  onChange={e => setPartyForm({ ...partyForm, initialDate: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg transition-colors text-sm shadow-md"
          >
            {editingPartyId ? "Save Changes" : "Create Investor Account"}
          </button>
        </form>
      </Modal>

      {/* MODAL 2: Record Investor Payment / Upad (OUT) */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        maxWidth="lg"
        title={
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-slate-900 text-base">{editingTxId ? "Edit Investor Payment / Upad" : "Record Investor Payment / Upad (OUT)"}</span>
              <p className="text-xs text-slate-500 font-normal">Money returned or withdrawn by investor</p>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSavePayment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Investor *</label>
            <select
              required
              value={paymentForm.partyId}
              onChange={e => setPaymentForm({ ...paymentForm, partyId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-amber-500 font-semibold"
            >
              <option value="">-- Choose Investor --</option>
              {parties.map(p => (
                <option key={p.id} value={p.id.toString()}>{p.partyName} {p.locationName ? `[${p.locationName}]` : ''} (Bal: ₹{Number((p.totalContribution || 0) - (p.totalUpad || 0)).toLocaleString()})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Date *</label>
              <input
                type="date"
                required
                value={paymentForm.date}
                onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount Paid (₹) *</label>
              <input
                type="number"
                step="any"
                required
                value={paymentForm.amount}
                onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-amber-500 font-bold text-amber-800"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentForm.paymentMethod}
                onChange={e => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-amber-500"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
                <option value="UPI / NEFT">UPI / NEFT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cheque / Reference No.</label>
              <input
                type="text"
                value={paymentForm.referenceNumber}
                onChange={e => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-amber-500 font-mono"
                placeholder="e.g. CHQ-992101"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Purpose / Notes</label>
            <input
              type="text"
              value={paymentForm.description}
              onChange={e => setPaymentForm({ ...paymentForm, description: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-amber-500"
              placeholder="e.g. Upad against profit share / Capital withdrawal"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-lg transition-colors text-sm shadow-md"
          >
            {editingTxId ? "Update Payment Record" : "Save Investor Payment / Upad"}
          </button>
        </form>
      </Modal>

      {/* MODAL 3: Record Capital Contribution (IN) */}
      <Modal
        isOpen={isContributionModalOpen}
        onClose={() => setIsContributionModalOpen(false)}
        maxWidth="lg"
        title={
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-slate-900 text-base">{editingTxId ? "Edit Capital Contribution" : "Record Capital Contribution (IN)"}</span>
              <p className="text-xs text-slate-500 font-normal">Capital brought into business by investor</p>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSaveContribution} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Investor *</label>
            <select
              required
              value={contributionForm.partyId}
              onChange={e => setContributionForm({ ...contributionForm, partyId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 font-semibold"
            >
              <option value="">-- Choose Investor --</option>
              {parties.map(p => (
                <option key={p.id} value={p.id.toString()}>{p.partyName} {p.locationName ? `[${p.locationName}]` : ''}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                required
                value={contributionForm.date}
                onChange={e => setContributionForm({ ...contributionForm, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount Invested (₹) *</label>
              <input
                type="number"
                step="any"
                required
                value={contributionForm.amount}
                onChange={e => setContributionForm({ ...contributionForm, amount: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-800"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={contributionForm.paymentMethod}
                onChange={e => setContributionForm({ ...contributionForm, paymentMethod: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
                <option value="UPI / RTGS">UPI / RTGS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reference No.</label>
              <input
                type="text"
                value={contributionForm.referenceNumber}
                onChange={e => setContributionForm({ ...contributionForm, referenceNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 font-mono"
                placeholder="e.g. UTR-12891823"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Description / Notes</label>
            <input
              type="text"
              value={contributionForm.description}
              onChange={e => setContributionForm({ ...contributionForm, description: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. 2nd Installment towards project capital"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg transition-colors text-sm shadow-md cursor-pointer"
          >
            {editingTxId ? "Update Capital Record" : "Save Capital Contribution"}
          </button>
        </form>
      </Modal>

      {/* MODAL 4: Record Investment Deployed / Investment Karya (OUT to Project) */}
      <Modal
        isOpen={isInvestmentModalOpen}
        onClose={() => setIsInvestmentModalOpen(false)}
        maxWidth="lg"
        title={
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-800 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-slate-900 text-base">{editingTxId ? "Edit Investment Karya Deployment" : "Record Investment Karya (Deploy into Project)"}</span>
              <p className="text-xs text-slate-500 font-normal">Capital deployed into Category 2 project. Deducted with date from investor's balance.</p>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSaveInvestment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Investor (Category 1) *</label>
            <select
              required
              value={investmentForm.partyId}
              onChange={e => setInvestmentForm({ ...investmentForm, partyId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 font-semibold"
            >
              <option value="">-- Choose Investor --</option>
              {parties.map(p => {
                const pCont = Number(p.totalContribution || 0);
                const pInv = transactions.filter(t => t.partyId === p.id && t.type === "INVESTMENT").reduce((s, t) => s + Number(t.amount || 0), 0);
                const pUpad = Number(p.totalUpad || 0);
                const pNet = Math.round((pCont - pInv - pUpad) * 100) / 100;
                return (
                  <option key={p.id} value={p.id.toString()}>{p.partyName} {p.locationName ? `[${p.locationName}]` : ''} (Available Balance: ₹{pNet.toLocaleString()})</option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Deployment Date *</label>
              <input
                type="date"
                required
                value={investmentForm.date}
                onChange={e => setInvestmentForm({ ...investmentForm, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount Deployed (₹) *</label>
              <input
                type="number"
                step="any"
                required
                value={investmentForm.amount}
                onChange={e => setInvestmentForm({ ...investmentForm, amount: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-800"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={investmentForm.paymentMethod}
                onChange={e => setInvestmentForm({ ...investmentForm, paymentMethod: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
                <option value="UPI / RTGS">UPI / RTGS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reference / Cheque No.</label>
              <input
                type="text"
                value={investmentForm.referenceNumber}
                onChange={e => setInvestmentForm({ ...investmentForm, referenceNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                placeholder="e.g. TXN-581920"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Project Purpose / Notes</label>
            <input
              type="text"
              value={investmentForm.description}
              onChange={e => setInvestmentForm({ ...investmentForm, description: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Investment into Site Phase 1 (Investment Karya)"
            />
          </div>

          <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100 text-[11px] text-indigo-800 font-medium">
            ℹ️ This records an investment deployment into the project (Category 2) and will automatically cut/deduct this amount with date from the investor's balance in Category 1.
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg transition-colors text-sm shadow-md cursor-pointer"
          >
            {editingTxId ? "Update Investment Karya" : "Save Investment Karya"}
          </button>
        </form>
      </Modal>

      {/* MODAL 5: Transfer / Allocate Capital to Location */}
      <Modal
        isOpen={isAllocationModalOpen}
        onClose={() => setIsAllocationModalOpen(false)}
        maxWidth="lg"
        title={
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-800 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-slate-900 text-base">Transfer Capital to Location</span>
              <p className="text-xs text-slate-500 font-normal">Deducts from Main Investor Pool and credits to Location Central Capital</p>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSaveAllocation} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Investor (From Main Investor Capital Pool) *</label>
            <select
              required
              value={allocationForm.investorId}
              onChange={e => setAllocationForm({ ...allocationForm, investorId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 font-semibold"
            >
              <option value="">-- Choose Investor from Main Capital Pool --</option>
              {mainInvestors.map(inv => (
                <option key={inv.id} value={inv.id.toString()}>
                  {inv.name || inv.partyName} (Avail Balance: ₹{Number(inv.availableBalance !== undefined ? inv.availableBalance : ((inv.totalCapital || 0) - (inv.totalUpad || 0) - (inv.totalAllocated || 0))).toLocaleString()})
                </option>
              ))}
            </select>
            {mainInvestors.length === 0 && (
              <p className="text-[11px] text-amber-600 font-semibold mt-1">
                No main investors found. Please add an investor profile first.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Target Project Location *</label>
            <select
              required
              value={allocationForm.locationId}
              onChange={e => setAllocationForm({ ...allocationForm, locationId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
            >
              <option value="">-- Choose Project Location --</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id.toString()}>
                  📍 {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Transfer Date *</label>
              <input
                type="date"
                required
                value={allocationForm.date}
                onChange={e => setAllocationForm({ ...allocationForm, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Allocation Amount (₹) *</label>
              <input
                type="number"
                step="any"
                required
                value={allocationForm.amount}
                onChange={e => setAllocationForm({ ...allocationForm, amount: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-800"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment / Transfer Method</label>
              <select
                value={allocationForm.paymentMethod}
                onChange={e => setAllocationForm({ ...allocationForm, paymentMethod: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Bank Transfer">Bank Transfer / RTGS</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
                <option value="UPI / NEFT">UPI / NEFT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reference / UTR / Cheque No.</label>
              <input
                type="text"
                value={allocationForm.referenceNumber}
                onChange={e => setAllocationForm({ ...allocationForm, referenceNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                placeholder="e.g. UTR-99210291"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Allocation Purpose / Notes</label>
            <input
              type="text"
              value={allocationForm.notes}
              onChange={e => setAllocationForm({ ...allocationForm, notes: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Allocated to Surat Location Phase 1 Central Capital Pool"
            />
          </div>

          <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-[11px] text-indigo-900 font-medium space-y-1">
            <p className="font-bold flex items-center gap-1 text-indigo-800">
              Capital Transfer Workflow:
            </p>
            <p className="text-slate-700">
              1. Amount is deducted from Main Investor Capital balance.
            </p>
            <p className="text-slate-700">
              2. Amount is credited to the selected project location capital pool.
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg transition-colors text-sm shadow-md cursor-pointer"
          >
            Transfer Capital to Location
          </button>
        </form>
      </Modal>
    </div>
  );
}
