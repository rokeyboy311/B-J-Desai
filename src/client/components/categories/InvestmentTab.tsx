import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import {
  TrendingUp, Pencil, Plus, Trash2, ArrowUpRight, ArrowDownLeft, FileText, Banknote,
  Building2, Calculator, CheckCircle2, Clock, AlertCircle, Package, User,
  Wallet, Layers, Search, Tag, Filter, Check, BarChart3, PieChart, ArrowRight,
  ShoppingCart, Truck, Wrench, Users, HardHat, RefreshCw, AlertTriangle
} from "lucide-react";
import { useLiveSync, triggerSync } from "../../hooks/useLiveSync";
import { ManageMaterialsModal } from "../ui/ManageMaterialsModal";

const PRESET_UNITS = [
  "Nos", "Bags", "Ton", "Kg", "Brass", "CFT", "Cum", "Sq.ft", "Sq.m",
  "Trip", "Load", "Ltr", "Mtr", "Custom"
];

const GST_PRESETS = ["0", "5", "12", "18", "28"];

export default function InvestmentTab({ locationId }: { locationId: number }) {
  // 6 Distinct Sub-Tabs:
  // 1. "analytics" - Executive Category 3-7 Deductions & Capital Analytics Dashboard
  // 2. "investor_capital" - Direct Investment from Investors (Investment Karya from Cat 1)
  // 3. "bill_investments" - Bill / Asset / Material Invoiced Investments
  // 4. "deductions_ledger" - Live Itemized Operational Deductions Passbook (Cat 3 to 7)
  // 5. "investor_payments" - Returns / Upad paid to Investors
  // 6. "combined" - Consolidated Investment Ledger & Balance Sheet
  const [activeSubTab, setActiveSubTab] = useState<"analytics" | "investor_capital" | "bill_investments" | "deductions_ledger" | "investor_payments" | "combined">("analytics");
  const [loading, setLoading] = useState(true);

  // Data
  const [parties, setParties] = useState<any[]>([]);
  const [masterParties, setMasterParties] = useState<any[]>([]);
  const [masterMaterials, setMasterMaterials] = useState<any[]>([]);
  const [investorTxs, setInvestorTxs] = useState<any[]>([]);
  const [billIncomes, setBillIncomes] = useState<any[]>([]);
  const [projectUtilization, setProjectUtilization] = useState<any>(null);

  // Modals
  const [isCapitalModalOpen, setIsCapitalModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isManageMaterialOpen, setIsManageMaterialOpen] = useState(false);

  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [editingBillId, setEditingBillId] = useState<number | null>(null);

  // Filters & Search
  const [deductionCategoryFilter, setDeductionCategoryFilter] = useState<string>("ALL");
  const [deductionSearch, setDeductionSearch] = useState("");

  // Forms
  const [capitalFormData, setCapitalFormData] = useState({
    partyId: "",
    amount: "",
    type: "INVESTMENT" as "INVESTMENT" | "CONTRIBUTION",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    description: "",
  });

  const [paymentFormData, setPaymentFormData] = useState({
    partyId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    description: "",
  });

  const [billData, setBillData] = useState({
    date: new Date().toISOString().split("T")[0],
    paymentStatus: "PAID",
    partyName: "",
    materialName: "",
    quantity: "",
    unit: "Nos",
    rate: "",
    transportCost: "0",
    discount: "0",
    taxPercentage: "18",
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    notes: "",
  });

  const [unitMode, setUnitMode] = useState("Nos");
  const [customUnit, setCustomUnit] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const effectiveUnit = unitMode === "Custom" ? (customUnit.trim() || "Unit") : unitMode;

  const loadData = async (isBackground = false) => {
    if (!isBackground && investorTxs.length === 0 && billIncomes.length === 0 && !projectUtilization) setLoading(true);
    try {
      const [partiesRes, masterPartiesRes, masterMaterialsRes, txsRes, billsRes, utilRes] = await Promise.all([
        apiFetch(`/investments/parties?locationId=${locationId}`).catch(() => []),
        apiFetch(`/master/parties?locationId=${locationId}`).catch(() => []),
        apiFetch(`/master/materials?locationId=${locationId}`).catch(() => []),
        apiFetch(`/investments/transactions?locationId=${locationId}`).catch(() => []),
        apiFetch(`/incomes?locationId=${locationId}`).catch(() => []),
        apiFetch(`/investments/project-utilization?locationId=${locationId}`).catch(() => null),
      ]);
      setParties(partiesRes || []);
      setMasterParties(masterPartiesRes || []);
      setMasterMaterials(masterMaterialsRes || []);
      setInvestorTxs(txsRes || []);
      // Filter incomes to show only Bill / Material Incomes
      setBillIncomes((billsRes || []).filter((i: any) => i.isBillIncome || i.materialName || i.type === "BILL_INCOME"));
      if (utilRes) {
        setProjectUtilization(utilRes);
      }
    } catch (err) {
      console.error("Failed to load investment data", err);
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

  // Categorized Transactions - Includes both INVESTMENT (Investment Karya from Cat 1) and CONTRIBUTION
  const capitalInflowTxs = useMemo(() => {
    return investorTxs.filter(t => t.type === "INVESTMENT" || t.type === "CONTRIBUTION");
  }, [investorTxs]);

  const investorPaymentTxs = useMemo(() => {
    return investorTxs.filter(t => t.type === "UPAD" || t.type === "PAYMENT");
  }, [investorTxs]);

  // Aggregate Capital Totals: Category 2 Capital is strictly Investment from Investors Capital
  // (Transferred/cut from Category 1 investors to fund this project's operational deductions)
  const investmentFromInvestorsCapital = useMemo(() => {
    return capitalInflowTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [capitalInflowTxs]);

  // Backward compatibility alias
  const totalInvestorCapital = investmentFromInvestorsCapital;

  const totalInvestorPayments = useMemo(() => {
    return investorPaymentTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [investorPaymentTxs]);

  const totalBillInvestments = useMemo(() => {
    return billIncomes.reduce((sum, b) => sum + Number(b.totalAmount || b.amount || 0), 0);
  }, [billIncomes]);

  // Category 2 Capital is strictly Investment from Investors Capital
  const totalGrossInvestment = investmentFromInvestorsCapital;

  // Operational Deductions from Categories 3 to 7
  const cat3Data = projectUtilization?.linkedExpenditures?.category3MaterialPurchases || { total: 0, paid: 0, outstanding: 0, count: 0 };
  const cat4Data = projectUtilization?.linkedExpenditures?.category4MaterialSupplies || { total: 0, paid: 0, outstanding: 0, count: 0 };
  const cat5Data = projectUtilization?.linkedExpenditures?.category5SiteSupplies || { total: 0, count: 0 };
  const cat67Data = projectUtilization?.linkedExpenditures?.category67Labour || { totalNetSalary: 0, totalPaid: 0, totalUpad: 0, outstandingBalance: 0, count: 0 };
  const cat8Data = projectUtilization?.linkedExpenditures?.category8Supervisor || { total: 0, count: 0 };

  const totalDeductions = useMemo(() => {
    if (projectUtilization?.budgetBalance?.totalProjectExpenditure !== undefined) {
      return Number(projectUtilization.budgetBalance.totalProjectExpenditure || 0);
    }
    return (Number(cat3Data.total || 0) + Number(cat4Data.total || 0) + Number(cat5Data.total || 0) + Number(cat67Data.totalNetSalary || 0) + Number(cat8Data.total || 0));
  }, [projectUtilization, cat3Data, cat4Data, cat5Data, cat67Data, cat8Data]);

  // Category 2 formula: Remaining Capital = Investment from Investors Capital - Deductions (Cat 3-7) - Investor Upad / Return
  const netRemainingCapital = useMemo(() => {
    if (projectUtilization?.budgetBalance?.remainingInvestmentCapital !== undefined) {
      return Number(projectUtilization.budgetBalance.remainingInvestmentCapital || 0);
    }
    return investmentFromInvestorsCapital - totalDeductions - totalInvestorPayments;
  }, [projectUtilization, investmentFromInvestorsCapital, totalDeductions, totalInvestorPayments]);

  const capitalUtilizationRate = useMemo(() => {
    if (investmentFromInvestorsCapital <= 0) return 0;
    return Math.min(100, Math.round((totalDeductions / investmentFromInvestorsCapital) * 1000) / 10);
  }, [totalDeductions, investmentFromInvestorsCapital]);

  const itemizedDeductionsList = useMemo(() => {
    const list: any[] = projectUtilization?.itemizedDeductions || [];
    return list.filter(item => {
      const matchCat = deductionCategoryFilter === "ALL" || item.categoryKey === deductionCategoryFilter;
      const matchSearch = !deductionSearch.trim() ||
        (item.partyName || "").toLowerCase().includes(deductionSearch.toLowerCase()) ||
        (item.description || "").toLowerCase().includes(deductionSearch.toLowerCase()) ||
        (item.categoryName || "").toLowerCase().includes(deductionSearch.toLowerCase()) ||
        (item.referenceNumber || "").toLowerCase().includes(deductionSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [projectUtilization, deductionCategoryFilter, deductionSearch]);

  const netActiveInvestment = useMemo(() => {
    return totalGrossInvestment - totalInvestorPayments;
  }, [totalGrossInvestment, totalInvestorPayments]);

  // Live Bill Calculation Breakdown
  const billCalc = useMemo(() => {
    const qty = parseFloat(billData.quantity) || 0;
    const rate = parseFloat(billData.rate) || 0;
    const subtotal = qty * rate;
    const transport = parseFloat(billData.transportCost) || 0;
    const discount = parseFloat(billData.discount) || 0;
    const taxPct = parseFloat(billData.taxPercentage) || 0;

    // Transport fee is NOT included in GST; GST applies strictly to taxable amount (subtotal - discount)
    const baseAmount = Math.max(0, subtotal - discount);
    const taxAmount = (baseAmount * taxPct) / 100;
    // Transport is counted/added separately to the total
    const netTotal = baseAmount + taxAmount + transport;

    return {
      subtotal,
      transport,
      discount,
      baseAmount,
      taxAmount,
      netTotal,
    };
  }, [billData]);

  // Save Capital Contribution
  const handleSaveCapital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capitalFormData.partyId || !capitalFormData.amount) return;
    try {
      const url = editingTxId ? `/investments/transactions/${editingTxId}` : "/investments/transactions";
      const method = editingTxId ? "PUT" : "POST";

      await apiFetch(url, {
        method,
        body: JSON.stringify({
          locationId,
          partyId: parseInt(capitalFormData.partyId),
          type: capitalFormData.type || "INVESTMENT",
          amount: parseFloat(capitalFormData.amount),
          date: capitalFormData.date,
          paymentMethod: capitalFormData.paymentMethod,
          referenceNumber: capitalFormData.referenceNumber,
          description: capitalFormData.description,
        }),
      });

      triggerSync("investments");
      setCapitalFormData({
        partyId: "",
        amount: "",
        type: "INVESTMENT",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        referenceNumber: "",
        description: "",
      });
      setEditingTxId(null);
      setIsCapitalModalOpen(false);
      loadData();
    } catch (err) {
      alert("Failed to save capital investment.");
    }
  };

  // Save Investor Payment / Upad
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentFormData.partyId || !paymentFormData.amount) return;
    try {
      const url = editingTxId ? `/investments/transactions/${editingTxId}` : "/investments/transactions";
      const method = editingTxId ? "PUT" : "POST";

      await apiFetch(url, {
        method,
        body: JSON.stringify({
          locationId,
          partyId: parseInt(paymentFormData.partyId),
          type: "UPAD",
          amount: parseFloat(paymentFormData.amount),
          date: paymentFormData.date,
          paymentMethod: paymentFormData.paymentMethod,
          referenceNumber: paymentFormData.referenceNumber,
          description: paymentFormData.description,
        }),
      });

      triggerSync("investments");
      setPaymentFormData({
        partyId: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        referenceNumber: "",
        description: "",
      });
      setEditingTxId(null);
      setIsPaymentModalOpen(false);
      loadData();
    } catch (err) {
      alert("Failed to record investor payment.");
    }
  };

  // Save Bill Investment
  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billData.partyName || !billData.materialName || !billData.quantity || !billData.rate) {
      alert("Please fill in Party, Material, Quantity and Rate.");
      return;
    }

    try {
      const payload = {
        locationId,
        date: billData.date,
        partyName: billData.partyName.trim(),
        materialName: billData.materialName.trim(),
        quantity: parseFloat(billData.quantity) || 0,
        unit: effectiveUnit,
        rate: parseFloat(billData.rate) || 0,
        subtotal: billCalc.subtotal,
        transportCost: billCalc.transport,
        discount: billCalc.discount,
        taxPercentage: parseFloat(billData.taxPercentage) || 0,
        taxAmount: billCalc.taxAmount,
        totalAmount: billCalc.netTotal,
        amount: billCalc.netTotal,
        paymentStatus: billData.paymentStatus,
        paymentMethod: billData.paymentMethod,
        referenceNumber: billData.referenceNumber,
        notes: billData.notes,
        isBillIncome: true,
        type: "BILL_INCOME",
        title: `Bill: ${billData.materialName} - ${billData.partyName}`,
      };

      if (editingBillId) {
        await apiFetch(`/incomes/${editingBillId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/incomes", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      triggerSync("incomes");
      resetBillForm();
      setIsBillModalOpen(false);
      loadData();
    } catch (err) {
      alert("Failed to save bill investment.");
    }
  };

  const resetBillForm = () => {
    setEditingBillId(null);
    setBillData({
      date: new Date().toISOString().split("T")[0],
      paymentStatus: "PAID",
      partyName: "",
      materialName: "",
      quantity: "",
      unit: "Nos",
      rate: "",
      transportCost: "0",
      discount: "0",
      taxPercentage: "18",
      paymentMethod: "Bank Transfer",
      referenceNumber: "",
      notes: "",
    });
    setUnitMode("Nos");
    setCustomUnit("");
  };

  const openEditBill = (bill: any) => {
    setEditingBillId(bill.id);
    const isPreset = PRESET_UNITS.includes(bill.unit);
    setUnitMode(isPreset ? bill.unit : "Custom");
    setCustomUnit(isPreset ? "" : (bill.unit || ""));

    setBillData({
      date: bill.date || new Date().toISOString().split("T")[0],
      paymentStatus: bill.paymentStatus || "PAID",
      partyName: bill.partyName || "",
      materialName: bill.materialName || "",
      quantity: String(bill.quantity || ""),
      unit: bill.unit || "Nos",
      rate: String(bill.rate || ""),
      transportCost: String(bill.transportCost || "0"),
      discount: String(bill.discount || "0"),
      taxPercentage: String(bill.taxPercentage || "0"),
      paymentMethod: bill.paymentMethod || "Bank Transfer",
      referenceNumber: bill.referenceNumber || "",
      notes: bill.notes || "",
    });
    setIsBillModalOpen(true);
  };

  const handleDeleteBill = async (id: number) => {
    if (!confirm("Are you sure you want to delete this bill investment?")) return;
    try {
      await apiFetch(`/incomes/${id}?locationId=${locationId}`, { method: "DELETE" });
      triggerSync("incomes");
      loadData();
    } catch (err) {
      alert("Failed to delete bill investment.");
    }
  };

  const handleDeleteTx = async (id: number) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    try {
      await apiFetch(`/investments/transactions/${id}?locationId=${locationId}`, { method: "DELETE" });
      triggerSync("investments");
      loadData();
    } catch (err) {
      alert("Failed to delete transaction.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Action Buttons */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-800 p-6 rounded-3xl text-white shadow-lg flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4" /> Category 2 &bull; Investment Capital & Deductions
          </div>
          <h2 className="text-2xl font-black text-white">2. Investment Capital & Category Deductions</h2>
          <p className="text-xs text-blue-100/90 mt-0.5">
            ઇન્વેસ્ટર્સ પાસેથી આવેલ મૂડી, કપાત (Cat 3 થી 7), ઇન્વેસ્ટર ઉપાડ / રિટર્ન અને બાકી રહેલ મૂડી (Remaining Capital).
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setEditingTxId(null);
              setCapitalFormData({
                partyId: parties[0]?.id?.toString() || "",
                amount: "",
                type: "INVESTMENT",
                date: new Date().toISOString().split("T")[0],
                paymentMethod: "Bank Transfer",
                referenceNumber: "",
                description: "",
              });
              setIsCapitalModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <ArrowUpRight className="w-3.5 h-3.5" /> + Add Investment from Investors
          </button>

          <button
            onClick={() => {
              resetBillForm();
              setIsBillModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" /> + Add Bill Investment
          </button>

          <button
            onClick={() => {
              setEditingTxId(null);
              setPaymentFormData({
                partyId: parties[0]?.id?.toString() || "",
                amount: "",
                date: new Date().toISOString().split("T")[0],
                paymentMethod: "Bank Transfer",
                referenceNumber: "",
                description: "",
              });
              setIsPaymentModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" /> + Record Investor Payment (Upad)
          </button>
        </div>
      </div>

      {/* 4 Executive Summary Stat Cards - Strictly Category 2 Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Investment from Investors Capital */}
        <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs font-bold uppercase tracking-wider">1. Investment from Investors Capital</span>
            <div className="p-1.5 bg-emerald-100 rounded-lg"><ArrowUpRight className="w-4 h-4 text-emerald-700" /></div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black text-emerald-900">₹{investmentFromInvestorsCapital.toLocaleString()}</div>
            <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
              ઇન્વેસ્ટર્સ પાસેથી આવેલ મૂડી (Cut from Cat 1 into Cat 2)
            </p>
          </div>
        </div>

        {/* 2. Deductions (Cat 3 to 7) */}
        <div className="bg-rose-50/90 border border-rose-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-800">
            <span className="text-xs font-bold uppercase tracking-wider">2. Deductions (Cat 3–7)</span>
            <div className="p-1.5 bg-rose-100 rounded-lg"><TrendingUp className="w-4 h-4 text-rose-700" /></div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black text-rose-900">-₹{totalDeductions.toLocaleString()}</div>
            <p className="text-[11px] text-rose-700 mt-0.5 font-medium">
              કપાત / ખર્ચ (Materials, Supplies, Labour & Sites)
            </p>
          </div>
        </div>

        {/* 3. Investor Upad / Returns */}
        <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-xs font-bold uppercase tracking-wider">3. Investor Upad / Return</span>
            <div className="p-1.5 bg-amber-100 rounded-lg"><ArrowDownLeft className="w-4 h-4 text-amber-700" /></div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black text-amber-900">-₹{totalInvestorPayments.toLocaleString()}</div>
            <p className="text-[11px] text-amber-700 mt-0.5 font-medium">
              ઇન્વેસ્ટર ઉપાડ / રિટર્ન ({investorPaymentTxs.length} payouts & drawings)
            </p>
          </div>
        </div>

        {/* 4. Remaining Capital */}
        <div className={`rounded-2xl p-4 shadow-md flex flex-col justify-between text-white ${
          netRemainingCapital >= 0 ? "bg-gradient-to-br from-slate-900 to-indigo-950" : "bg-gradient-to-br from-rose-900 to-slate-900"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">4. Remaining Capital</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
              netRemainingCapital >= 0 ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/30 text-rose-200 border border-rose-500/50"
            }`}>
              {netRemainingCapital >= 0 ? "Surplus" : "Deficit"}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black text-white">₹{netRemainingCapital.toLocaleString()}</div>
            <p className="text-[11px] text-indigo-200 mt-0.5 font-medium">
              બાકી મૂડી ({capitalUtilizationRate}% Utilized • Capital - Deductions - Upad)
            </p>
          </div>
        </div>
      </div>

      {/* 6 Distinct Sub-Tabs Navigation */}
      <div className="flex bg-slate-100 p-1.5 rounded-xl gap-1.5 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab("analytics")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
            activeSubTab === "analytics"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Analytics & Cat 3–7 Deductions
        </button>

        <button
          onClick={() => setActiveSubTab("investor_capital")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
            activeSubTab === "investor_capital"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          Investment from Investors ({capitalInflowTxs.length})
        </button>

        <button
          onClick={() => setActiveSubTab("bill_investments")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
            activeSubTab === "bill_investments"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FileText className="w-4 h-4" />
          Bill Investments ({billIncomes.length})
        </button>

        <button
          onClick={() => setActiveSubTab("deductions_ledger")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
            activeSubTab === "deductions_ledger"
              ? "bg-rose-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Tag className="w-4 h-4" />
          Itemized Deductions Passbook ({itemizedDeductionsList.length})
        </button>

        <button
          onClick={() => setActiveSubTab("investor_payments")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
            activeSubTab === "investor_payments"
              ? "bg-amber-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          Investor Upad ({investorPaymentTxs.length})
        </button>

        <button
          onClick={() => setActiveSubTab("combined")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
            activeSubTab === "combined"
              ? "bg-slate-800 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Layers className="w-4 h-4" />
          Consolidated Ledger
        </button>
      </div>

      {/* SUBTAB 0: ANALYTICS & DEDUCTIONS DASHBOARD */}
      {activeSubTab === "analytics" && (
        <div className="space-y-5">
          {/* Capital Allocation & Deduction Waterfall Matrix */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-indigo-600" />
                  Investment Capital & Categories 3–7 Deductions Flow
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time synchronization showing how project operational expenses in Categories 3–7 cut into Investment Capital.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-black ${
                  netRemainingCapital >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                }`}>
                  {netRemainingCapital >= 0 ? "✓ Capital Surplus" : "⚠ Capital Deficit"}
                </span>
              </div>
            </div>

            {/* Visual Allocation Stack Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Investment Capital Utilization Matrix</span>
                <span>{capitalUtilizationRate}% Deducted / Used</span>
              </div>
              <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                {totalGrossInvestment > 0 && (
                  <>
                    <div
                      style={{ width: `${Math.min(100, (Number(cat3Data.total || 0) / totalGrossInvestment) * 100)}%` }}
                      className="bg-purple-500 h-full transition-all"
                      title={`Cat 3 Purchases: ₹${Number(cat3Data.total || 0).toLocaleString()}`}
                    />
                    <div
                      style={{ width: `${Math.min(100, (Number(cat4Data.total || 0) / totalGrossInvestment) * 100)}%` }}
                      className="bg-blue-500 h-full transition-all"
                      title={`Cat 4 Material Supplies: ₹${Number(cat4Data.total || 0).toLocaleString()}`}
                    />
                    <div
                      style={{ width: `${Math.min(100, (Number(cat5Data.total || 0) / totalGrossInvestment) * 100)}%` }}
                      className="bg-amber-500 h-full transition-all"
                      title={`Cat 5 Site Supplies: ₹${Number(cat5Data.total || 0).toLocaleString()}`}
                    />
                    <div
                      style={{ width: `${Math.min(100, (Number(cat67Data.totalNetSalary || 0) / totalGrossInvestment) * 100)}%` }}
                      className="bg-rose-500 h-full transition-all"
                      title={`Cat 6/7 Labour Wages: ₹${Number(cat67Data.totalNetSalary || 0).toLocaleString()}`}
                    />
                    <div
                      style={{ width: `${Math.min(100, (Number(cat8Data.total || 0) / totalGrossInvestment) * 100)}%` }}
                      className="bg-cyan-500 h-full transition-all"
                      title={`Cat 8 Supervisor Costs: ₹${Number(cat8Data.total || 0).toLocaleString()}`}
                    />
                    <div
                      style={{ width: `${Math.min(100, (Number(totalInvestorPayments || 0) / totalGrossInvestment) * 100)}%` }}
                      className="bg-amber-600 h-full transition-all"
                      title={`Investor Upad: ₹${Number(totalInvestorPayments || 0).toLocaleString()}`}
                    />
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 pt-1">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block" /> Cat 3 Material Purchases</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" /> Cat 4 Material Supplies</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> Cat 5 Site Supplies</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" /> Cat 6/7 Labour Wages</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 inline-block" /> Cat 8 Supervisor</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-600 inline-block" /> Investor Upad</span>
                <span className="flex items-center gap-1.5 ml-auto font-bold text-slate-800">Remaining Capital: ₹{netRemainingCapital.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* The 5 Connected Category Operational Deductions Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-600" />
                Category-Wise Operational Deductions (Cut from Investment Capital)
              </h4>
              <button
                onClick={() => setActiveSubTab("deductions_ledger")}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                View Itemized Passbook &rarr;
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Category 3: Material Purchases */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-purple-300 transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      Category 3
                    </span>
                    <ShoppingCart className="w-4 h-4 text-purple-600" />
                  </div>
                  <h5 className="font-black text-slate-900 text-sm mt-2">Material Purchases (વસ્તુ ખરીદી)</h5>
                  <p className="text-xs text-slate-500 mt-0.5">{cat3Data.count} purchase invoice records</p>
                  
                  <div className="mt-3 py-2 border-y border-slate-100 flex items-baseline justify-between">
                    <span className="text-xs font-bold text-slate-600">Total Deducted:</span>
                    <span className="text-base font-black text-purple-700">-₹{Number(cat3Data.total || 0).toLocaleString()}</span>
                  </div>
                  
                  <div className="mt-2 text-xs space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>Paid Cash Outflow:</span>
                      <span className="font-semibold text-slate-800">₹{Number(cat3Data.paid || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Outstanding Credit:</span>
                      <span className="font-semibold text-rose-600">₹{Number(cat3Data.outstanding || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-500">
                  <span>Share of Capital:</span>
                  <span className="font-bold text-purple-800">
                    {totalGrossInvestment > 0 ? ((Number(cat3Data.total || 0) / totalGrossInvestment) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>

              {/* Category 4: Material Supplies */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-blue-300 transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Category 4
                    </span>
                    <Truck className="w-4 h-4 text-blue-600" />
                  </div>
                  <h5 className="font-black text-slate-900 text-sm mt-2">Material Supplies (સપ્લાય)</h5>
                  <p className="text-xs text-slate-500 mt-0.5">{cat4Data.count} vendor supply transactions</p>
                  
                  <div className="mt-3 py-2 border-y border-slate-100 flex items-baseline justify-between">
                    <span className="text-xs font-bold text-slate-600">Total Deducted:</span>
                    <span className="text-base font-black text-blue-700">-₹{Number(cat4Data.total || 0).toLocaleString()}</span>
                  </div>
                  
                  <div className="mt-2 text-xs space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>Paid Amount:</span>
                      <span className="font-semibold text-slate-800">₹{Number(cat4Data.paid || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pending Balance:</span>
                      <span className="font-semibold text-rose-600">₹{Number(cat4Data.outstanding || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-500">
                  <span>Share of Capital:</span>
                  <span className="font-bold text-blue-800">
                    {totalGrossInvestment > 0 ? ((Number(cat4Data.total || 0) / totalGrossInvestment) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>

              {/* Category 5: Site Supplies */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-amber-300 transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Category 5
                    </span>
                    <Wrench className="w-4 h-4 text-amber-600" />
                  </div>
                  <h5 className="font-black text-slate-900 text-sm mt-2">Site Supplies & Consumables</h5>
                  <p className="text-xs text-slate-500 mt-0.5">{cat5Data.count} site tools & safety issues</p>
                  
                  <div className="mt-3 py-2 border-y border-slate-100 flex items-baseline justify-between">
                    <span className="text-xs font-bold text-slate-600">Total Deducted:</span>
                    <span className="text-base font-black text-amber-700">-₹{Number(cat5Data.total || 0).toLocaleString()}</span>
                  </div>
                  
                  <div className="mt-2 text-xs space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className="font-semibold text-emerald-600">100% Incurred & Settled</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Entries:</span>
                      <span className="font-semibold text-slate-800">{cat5Data.count} items recorded</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-500">
                  <span>Share of Capital:</span>
                  <span className="font-bold text-amber-800">
                    {totalGrossInvestment > 0 ? ((Number(cat5Data.total || 0) / totalGrossInvestment) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>

              {/* Category 6 & 7: Labour Salaries & Wages */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-rose-300 transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      Category 6 & 7
                    </span>
                    <Users className="w-4 h-4 text-rose-600" />
                  </div>
                  <h5 className="font-black text-slate-900 text-sm mt-2">Labour Salaries & Wages (મજૂરી)</h5>
                  <p className="text-xs text-slate-500 mt-0.5">{cat67Data.count} workers enrolled</p>
                  
                  <div className="mt-3 py-2 border-y border-slate-100 flex items-baseline justify-between">
                    <span className="text-xs font-bold text-slate-600">Total Net Wages:</span>
                    <span className="text-base font-black text-rose-700">-₹{Number(cat67Data.totalNetSalary || 0).toLocaleString()}</span>
                  </div>
                  
                  <div className="mt-2 text-xs space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>Direct Paid Wages:</span>
                      <span className="font-semibold text-slate-800">₹{Number(cat67Data.totalPaid || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Worker Upad / Advances:</span>
                      <span className="font-semibold text-amber-600">₹{Number(cat67Data.totalUpad || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Unpaid Balance:</span>
                      <span className="font-semibold text-rose-600">₹{Number(cat67Data.outstandingBalance || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-500">
                  <span>Share of Capital:</span>
                  <span className="font-bold text-rose-800">
                    {totalGrossInvestment > 0 ? ((Number(cat67Data.totalNetSalary || 0) / totalGrossInvestment) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>

              {/* Category 8: Supervisor Costs */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-cyan-300 transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                      Category 8
                    </span>
                    <HardHat className="w-4 h-4 text-cyan-600" />
                  </div>
                  <h5 className="font-black text-slate-900 text-sm mt-2">Supervisor & Site Overhead</h5>
                  <p className="text-xs text-slate-500 mt-0.5">{cat8Data.count} expense entries</p>
                  
                  <div className="mt-3 py-2 border-y border-slate-100 flex items-baseline justify-between">
                    <span className="text-xs font-bold text-slate-600">Total Deducted:</span>
                    <span className="text-base font-black text-cyan-700">-₹{Number(cat8Data.total || 0).toLocaleString()}</span>
                  </div>
                  
                  <div className="mt-2 text-xs space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className="font-semibold text-emerald-600">Fully Incurred</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cost Centers:</span>
                      <span className="font-semibold text-slate-800">Site Management & Supervision</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-500">
                  <span>Share of Capital:</span>
                  <span className="font-bold text-cyan-800">
                    {totalGrossInvestment > 0 ? ((Number(cat8Data.total || 0) / totalGrossInvestment) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>

              {/* Summary Balance Card */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-indigo-300">
                    <span className="text-xs font-bold uppercase tracking-wider">Net Financial Equation</span>
                    <Calculator className="w-4 h-4" />
                  </div>
                  <h5 className="font-black text-white text-sm mt-2">Investment Capital Balance</h5>
                  <p className="text-xs text-slate-400 mt-0.5">Automated balance after all operational deductions</p>
                  
                  <div className="mt-3 text-xs space-y-1.5">
                    <div className="flex justify-between text-emerald-400">
                      <span>(+) Gross Investment:</span>
                      <span className="font-bold">+₹{totalGrossInvestment.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-rose-400">
                      <span>(-) Cat 3–7 Deductions:</span>
                      <span className="font-bold">-₹{totalDeductions.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-amber-400">
                      <span>(-) Investor Upad:</span>
                      <span className="font-bold">-₹{totalInvestorPayments.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-300">Net Remaining:</span>
                  <span className={`text-lg font-black ${netRemainingCapital >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    ₹{netRemainingCapital.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Preview of Recent Deductions */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600" />
                Latest Deductions Recorded Across Categories 3 to 7
              </h4>
              <button
                onClick={() => setActiveSubTab("deductions_ledger")}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                Open Full Passbook ({projectUtilization?.itemizedDeductions?.length || 0}) &rarr;
              </button>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {(projectUtilization?.itemizedDeductions || []).slice(0, 5).map((item: any, idx: number) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${
                      item.categoryKey === "CAT3_PURCHASE" ? "bg-purple-100 text-purple-800" :
                      item.categoryKey === "CAT4_SUPPLY" ? "bg-blue-100 text-blue-800" :
                      item.categoryKey === "CAT5_SITE" ? "bg-amber-100 text-amber-800" :
                      item.categoryKey === "CAT67_LABOUR" ? "bg-rose-100 text-rose-800" : "bg-cyan-100 text-cyan-800"
                    }`}>
                      {item.categoryName}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900">{item.partyName}</div>
                      <div className="text-[11px] text-slate-500">
                        {item.date} &bull; {item.description || "Operational expense"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-rose-600 text-sm">-₹{Number(item.amount).toLocaleString()}</span>
                    <div className="text-[10px] text-slate-400 font-medium">{item.status || "DEDUCTED"}</div>
                  </div>
                </div>
              ))}
              {(!projectUtilization?.itemizedDeductions || projectUtilization.itemizedDeductions.length === 0) && (
                <div className="py-6 text-center text-slate-400 text-xs">No expenditure deductions recorded yet in Categories 3–7.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: ITEMIZED DEDUCTIONS PASSBOOK */}
      {activeSubTab === "deductions_ledger" && (
        <div className="space-y-4">
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h3 className="font-black text-rose-900 text-sm flex items-center gap-2">
                <Tag className="w-4 h-4 text-rose-700" />
                Live Operational Deductions Passbook (Categories 3 to 7)
              </h3>
              <p className="text-xs text-rose-700">
                All transactions across Categories 3, 4, 5, 6, 7 & 8 that reduce and consume this project's Investment Capital.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-rose-900">Total Deductions:</span>
              <span className="text-base font-black text-rose-800 bg-white/80 px-3 py-1 rounded-xl border border-rose-200">
                -₹{totalDeductions.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              {[
                { key: "ALL", label: "All Deductions" },
                { key: "CAT3_PURCHASE", label: "Cat 3 Purchases" },
                { key: "CAT4_SUPPLY", label: "Cat 4 Supplies" },
                { key: "CAT5_SITE", label: "Cat 5 Site Supplies" },
                { key: "CAT67_LABOUR", label: "Cat 6/7 Labour" },
                { key: "CAT8_SUPERVISOR", label: "Cat 8 Supervisor" },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setDeductionCategoryFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    deductionCategoryFilter === f.key
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={deductionSearch}
                onChange={e => setDeductionSearch(e.target.value)}
                placeholder="Search party, description..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs"
              />
            </div>
          </div>

          {/* Deductions Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Category Source</th>
                    <th className="p-3.5">Party / Worker / Vendor</th>
                    <th className="p-3.5">Item Particulars / Notes</th>
                    <th className="p-3.5">Ref / Invoice No.</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right font-bold text-rose-700">Deduction (-₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itemizedDeductionsList.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3.5 text-slate-600 font-medium">{item.date}</td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                          item.categoryKey === "CAT3_PURCHASE" ? "bg-purple-100 text-purple-800 border border-purple-200" :
                          item.categoryKey === "CAT4_SUPPLY" ? "bg-blue-100 text-blue-800 border border-blue-200" :
                          item.categoryKey === "CAT5_SITE" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                          item.categoryKey === "CAT67_LABOUR" ? "bg-rose-100 text-rose-800 border border-rose-200" :
                          "bg-cyan-100 text-cyan-800 border border-cyan-200"
                        }`}>
                          {item.categoryName}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-slate-900">{item.partyName}</td>
                      <td className="p-3.5 text-slate-600 max-w-[220px] truncate">{item.description || "-"}</td>
                      <td className="p-3.5 font-mono text-slate-500">{item.referenceNumber || "-"}</td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === "PAID" ? "bg-emerald-100 text-emerald-800" :
                          item.status === "PARTIAL" ? "bg-amber-100 text-amber-800" :
                          item.status === "UNPAID" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"
                        }`}>
                          {item.status || "RECORDED"}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-black text-rose-700 text-sm">
                        -₹{Number(item.amount).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {itemizedDeductionsList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No operational deductions found matching the filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {itemizedDeductionsList.length > 0 && (
              <div className="p-4 bg-rose-50/50 border-t border-rose-100 flex justify-between items-center text-xs">
                <span className="font-bold text-rose-900">
                  Total Filtered Deductions ({itemizedDeductionsList.length} records):
                </span>
                <span className="text-base font-black text-rose-800">
                  -₹{itemizedDeductionsList.reduce((sum, item) => sum + Number(item.amount || 0), 0).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 1: CONSOLIDATED LEDGER */}
      {activeSubTab === "combined" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Investor Capital List Preview */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                    Recent Investor Capital Inflows
                  </h3>
                  <button
                    onClick={() => setActiveSubTab("investor_capital")}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    View All &rarr;
                  </button>
                </div>

                <div className="divide-y divide-slate-100 mt-2">
                  {capitalInflowTxs.slice(0, 5).map(tx => (
                    <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{tx.partyName}</span>
                        <div className="text-[10px] text-slate-400">{tx.date} &bull; {tx.paymentMethod}</div>
                      </div>
                      <span className="font-black text-emerald-600">+₹{Number(tx.amount).toLocaleString()}</span>
                    </div>
                  ))}
                  {capitalInflowTxs.length === 0 && (
                    <div className="py-6 text-center text-slate-400 text-xs">No capital investments recorded yet.</div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-bold text-emerald-800">
                <span>Total Investor Capital:</span>
                <span>₹{totalInvestorCapital.toLocaleString()}</span>
              </div>
            </div>

            {/* Bill Investments List Preview */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Recent Bill Investments
                  </h3>
                  <button
                    onClick={() => setActiveSubTab("bill_investments")}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    View All &rarr;
                  </button>
                </div>

                <div className="divide-y divide-slate-100 mt-2">
                  {billIncomes.slice(0, 5).map(bill => (
                    <div key={bill.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-800">{bill.partyName}</div>
                        <div className="text-[10px] text-slate-500">
                          {bill.materialName} &bull; {bill.quantity} {bill.unit} @ ₹{bill.rate}
                        </div>
                      </div>
                      <span className="font-black text-blue-600">+₹{Number(bill.totalAmount || bill.amount).toLocaleString()}</span>
                    </div>
                  ))}
                  {billIncomes.length === 0 && (
                    <div className="py-6 text-center text-slate-400 text-xs">No bill investments recorded yet.</div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-bold text-blue-800">
                <span>Total Bill Investments:</span>
                <span>₹{totalBillInvestments.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: INVESTOR CAPITAL INFLOW */}
      {activeSubTab === "investor_capital" && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h3 className="font-black text-emerald-900 text-sm flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-700" />
                Investment from Investors Register (Linked with Category 1)
              </h3>
              <p className="text-xs text-emerald-700">
                Deployments ("Investment Karya") from Category 1 investors and direct capital contributions credited to this project.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingTxId(null);
                setCapitalFormData({
                  partyId: parties[0]?.id?.toString() || "",
                  amount: "",
                  type: "INVESTMENT",
                  date: new Date().toISOString().split("T")[0],
                  paymentMethod: "Bank Transfer",
                  referenceNumber: "",
                  description: "",
                });
                setIsCapitalModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> + Add Investment from Investors
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Investor Name</th>
                    <th className="p-3.5">Flow Type / Origin</th>
                    <th className="p-3.5">Payment Method</th>
                    <th className="p-3.5">Reference No.</th>
                    <th className="p-3.5">Notes</th>
                    <th className="p-3.5 text-right font-bold text-emerald-700">Capital Amount (₹)</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {capitalInflowTxs.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="p-3.5 text-slate-600 font-medium">{tx.date}</td>
                      <td className="p-3.5 font-bold text-slate-900">{tx.partyName}</td>
                      <td className="p-3.5">
                        {tx.type === "INVESTMENT" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                            Cat 1 Investment Karya
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            Direct Capital Contribution
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-600">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-semibold">
                          {tx.paymentMethod || "Bank Transfer"}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-600">{tx.referenceNumber || "-"}</td>
                      <td className="p-3.5 text-slate-600 max-w-[200px] truncate">{tx.description || "-"}</td>
                      <td className="p-3.5 text-right font-black text-emerald-700 text-sm">
                        +₹{Number(tx.amount).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => {
                            setEditingTxId(tx.id);
                            setCapitalFormData({
                              partyId: tx.partyId.toString(),
                              amount: tx.amount,
                              type: tx.type === "CONTRIBUTION" ? "CONTRIBUTION" : "INVESTMENT",
                              date: tx.date || new Date().toISOString().split("T")[0],
                              paymentMethod: tx.paymentMethod || "Bank Transfer",
                              referenceNumber: tx.referenceNumber || "",
                              description: tx.description || "",
                            });
                            setIsCapitalModalOpen(true);
                          }}
                          className="text-slate-400 hover:text-emerald-600 p-1 mr-1"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteTx(tx.id)} className="text-slate-400 hover:text-rose-600 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {capitalInflowTxs.length === 0 && (
                    <tr><td colSpan={8} className="p-8 text-center text-slate-500">No investment capital records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {capitalInflowTxs.length > 0 && (
              <div className="p-4 bg-emerald-50/50 border-t border-emerald-100 flex justify-between items-center text-xs">
                <span className="font-bold text-emerald-900">Total Capital Inflow ({capitalInflowTxs.length} records):</span>
                <span className="text-base font-black text-emerald-800">₹{totalInvestorCapital.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: BILL INVESTMENTS */}
      {activeSubTab === "bill_investments" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h3 className="font-black text-blue-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-700" />
                Bill Investment & Material Invoices
              </h3>
              <p className="text-xs text-blue-700">Detailed bill investments with material, rate, GST, transport, and discounts.</p>
            </div>

            <button
              onClick={() => {
                resetBillForm();
                setIsBillModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> + Add Bill Investment
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Bill Date</th>
                    <th className="p-3.5">Party / Customer</th>
                    <th className="p-3.5">Material Details</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Subtotal</th>
                    <th className="p-3.5 text-right">Transport / Disc</th>
                    <th className="p-3.5 text-right">GST</th>
                    <th className="p-3.5 text-right font-bold text-blue-700">Net Total (₹)</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {billIncomes.map(bill => (
                    <tr key={bill.id} className="hover:bg-slate-50">
                      <td className="p-3.5 text-slate-600 font-medium">{bill.date}</td>
                      <td className="p-3.5 font-bold text-slate-900">{bill.partyName || "-"}</td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-800">{bill.materialName || "-"}</div>
                        <div className="text-[10px] text-slate-500">
                          {bill.quantity} {bill.unit} &bull; Rate: ₹{bill.rate}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          bill.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {bill.paymentStatus || 'PAID'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right text-slate-700 font-medium">₹{Number(bill.subtotal || (Number(bill.quantity || 0) * Number(bill.rate || 0))).toLocaleString()}</td>
                      <td className="p-3.5 text-right text-slate-500 text-[11px]">
                        +{Number(bill.transportCost || 0)} / -{Number(bill.discount || 0)}
                      </td>
                      <td className="p-3.5 text-right text-slate-500 text-[11px]">
                        {bill.taxPercentage}% (₹{Number(bill.taxAmount || 0).toLocaleString()})
                      </td>
                      <td className="p-3.5 text-right font-black text-blue-700 text-sm">
                        ₹{Number(bill.totalAmount || bill.amount).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-center">
                        <button onClick={() => openEditBill(bill)} className="text-slate-400 hover:text-blue-600 p-1 mr-1">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteBill(bill.id)} className="text-slate-400 hover:text-rose-600 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {billIncomes.length === 0 && (
                    <tr><td colSpan={9} className="p-8 text-center text-slate-500">No bill investments recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {billIncomes.length > 0 && (
              <div className="p-4 bg-blue-50/50 border-t border-blue-100 flex justify-between items-center text-xs">
                <span className="font-bold text-blue-900">Total Bill Investments ({billIncomes.length} records):</span>
                <span className="text-base font-black text-blue-800">₹{totalBillInvestments.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 4: INVESTOR PAYMENTS / UPAD */}
      {activeSubTab === "investor_payments" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h3 className="font-black text-amber-900 text-sm flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-amber-700" />
                Investor Payment & Upad Register
              </h3>
              <p className="text-xs text-amber-700">Dedicated register for returns, withdrawals, and payouts given to investors.</p>
            </div>

            <button
              onClick={() => {
                setEditingTxId(null);
                setPaymentFormData({
                  partyId: parties[0]?.id?.toString() || "",
                  amount: "",
                  date: new Date().toISOString().split("T")[0],
                  paymentMethod: "Bank Transfer",
                  referenceNumber: "",
                  description: "",
                });
                setIsPaymentModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold shadow hover:bg-amber-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> + Record Investor Payment (Upad)
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Payment Date</th>
                    <th className="p-3.5">Investor Name</th>
                    <th className="p-3.5">Payment Method</th>
                    <th className="p-3.5">Reference No.</th>
                    <th className="p-3.5">Purpose / Notes</th>
                    <th className="p-3.5 text-right font-bold text-amber-700">Amount Paid (₹)</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {investorPaymentTxs.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="p-3.5 text-slate-600 font-medium">{tx.date}</td>
                      <td className="p-3.5 font-bold text-slate-900">{tx.partyName}</td>
                      <td className="p-3.5 text-slate-600">
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
                        <button
                          onClick={() => {
                            setEditingTxId(tx.id);
                            setPaymentFormData({
                              partyId: tx.partyId.toString(),
                              amount: tx.amount,
                              date: tx.date || new Date().toISOString().split("T")[0],
                              paymentMethod: tx.paymentMethod || "Bank Transfer",
                              referenceNumber: tx.referenceNumber || "",
                              description: tx.description || "",
                            });
                            setIsPaymentModalOpen(true);
                          }}
                          className="text-slate-400 hover:text-amber-600 p-1 mr-1"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteTx(tx.id)} className="text-slate-400 hover:text-rose-600 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {investorPaymentTxs.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-slate-500">No investor payments / upads recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {investorPaymentTxs.length > 0 && (
              <div className="p-4 bg-amber-50/50 border-t border-amber-100 flex justify-between items-center text-xs">
                <span className="font-bold text-amber-900">Total Investor Payments ({investorPaymentTxs.length} records):</span>
                <span className="text-base font-black text-amber-800">₹{totalInvestorPayments.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Record Investment from Investors / Capital Inflow (IN) */}
      <Modal
        isOpen={isCapitalModalOpen}
        onClose={() => setIsCapitalModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg"><ArrowUpRight className="w-5 h-5" /></div>
            <div>
              <span className="font-black text-slate-900 text-base">
                {editingTxId ? "Edit Investment Record" : "Add Investment from Investors (Investment Karya)"}
              </span>
              <p className="text-xs text-slate-500 font-normal">
                Category 1 linked capital deployment or direct investor capital contribution
              </p>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSaveCapital} className="space-y-4">
          {/* Transaction Type Choice */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Flow Type / Linkage Mode *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCapitalFormData({ ...capitalFormData, type: "INVESTMENT" })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  capitalFormData.type === "INVESTMENT"
                    ? "border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-blue-900">Investment from Investor</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">Cat 1 Linked</span>
                </div>
                <p className="text-[11px] text-blue-700 leading-tight">
                  Adds to Project Investment Capital & deducts from Investor's active balance in Cat 1.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCapitalFormData({ ...capitalFormData, type: "CONTRIBUTION" })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  capitalFormData.type === "CONTRIBUTION"
                    ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-emerald-900">Direct Capital Contribution</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Direct Inflow</span>
                </div>
                <p className="text-[11px] text-emerald-700 leading-tight">
                  Direct partner contribution or bank funding credited straight to project capital.
                </p>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Investor *</label>
            <select
              required
              value={capitalFormData.partyId}
              onChange={e => setCapitalFormData({ ...capitalFormData, partyId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
            >
              <option value="">-- Choose Investor --</option>
              {parties.map(p => (
                <option key={p.id} value={p.id.toString()}>
                  {p.partyName} (Current Cat 1 Balance: ₹{Number(p.balance || 0).toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-blue-800">
              <Building2 className="w-3.5 h-3.5" /> Investment from Investors Rule:
            </div>
            <p className="text-[11px] text-blue-800 leading-relaxed font-medium">
              આ રકમ પસંદ કરેલ ઇન્વેસ્ટરના Category 1 મૂડી બેલેન્સમાંથી કટ (Deduct) થશે અને Category 2 ના Investment Capital માં ઉમેરાશે. આ કેપિટલમાંથી Category 3 થી 7 ની કપાત (ખર્ચ) બાદ થશે.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Investment Date *</label>
              <input
                type="date"
                required
                value={capitalFormData.date}
                onChange={e => setCapitalFormData({ ...capitalFormData, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Investment Amount (₹) *</label>
              <input
                type="number"
                step="any"
                required
                value={capitalFormData.amount}
                onChange={e => setCapitalFormData({ ...capitalFormData, amount: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-emerald-800"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={capitalFormData.paymentMethod}
                onChange={e => setCapitalFormData({ ...capitalFormData, paymentMethod: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
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
                value={capitalFormData.referenceNumber}
                onChange={e => setCapitalFormData({ ...capitalFormData, referenceNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="UTR / Cheque No."
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Description / Project Notes</label>
            <textarea
              value={capitalFormData.description}
              onChange={e => setCapitalFormData({ ...capitalFormData, description: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              rows={2}
              placeholder="e.g. Investment for site foundation & materials..."
            />
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg shadow-md transition-colors text-sm"
          >
            {editingTxId ? "Update Investment Record" : "Save Investment & Synchronize Capital"}
          </button>
        </form>
      </Modal>

      {/* MODAL: Record Investor Payment / Upad (OUT) */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-lg"><ArrowDownLeft className="w-5 h-5" /></div>
            <div>
              <span className="font-black text-slate-900 text-base">{editingTxId ? "Edit Investor Payment" : "Record Investor Payment / Upad (OUT)"}</span>
              <p className="text-xs text-slate-500 font-normal">Money returned or paid out to investor</p>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSavePayment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Investor *</label>
            <select
              required
              value={paymentFormData.partyId}
              onChange={e => setPaymentFormData({ ...paymentFormData, partyId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
            >
              <option value="">-- Choose Investor --</option>
              {parties.map(p => (
                <option key={p.id} value={p.id.toString()}>{p.partyName}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Date *</label>
              <input
                type="date"
                required
                value={paymentFormData.date}
                onChange={e => setPaymentFormData({ ...paymentFormData, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount Paid (₹) *</label>
              <input
                type="number"
                step="any"
                required
                value={paymentFormData.amount}
                onChange={e => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-amber-800"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentFormData.paymentMethod}
                onChange={e => setPaymentFormData({ ...paymentFormData, paymentMethod: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
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
                value={paymentFormData.referenceNumber}
                onChange={e => setPaymentFormData({ ...paymentFormData, referenceNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="CHQ / UTR No."
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Purpose / Notes</label>
            <input
              type="text"
              value={paymentFormData.description}
              onChange={e => setPaymentFormData({ ...paymentFormData, description: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. Return of capital / profit share"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-lg shadow-md transition-colors"
          >
            {editingTxId ? "Update Payment Record" : "Save Investor Payment"}
          </button>
        </form>
      </Modal>

      {/* MODAL: Add / Edit Bill Investment with MANAGE MATERIAL BUTTON */}
      <Modal
        isOpen={isBillModalOpen}
        onClose={() => setIsBillModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-800 rounded-lg"><FileText className="w-5 h-5" /></div>
            <div>
              <span className="font-black text-slate-900 text-base">{editingBillId ? "Edit Bill Investment" : "Add Bill Investment"}</span>
              <p className="text-xs text-slate-500 font-normal">Material and vendor bill based investment record</p>
            </div>
          </div>
        }
      >
        <form onSubmit={handleCreateBill} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          {/* 1. Date & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">1. Bill Date *</label>
              <input
                type="date"
                required
                value={billData.date}
                onChange={e => setBillData({ ...billData, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">2. Payment Status *</label>
              <select
                required
                value={billData.paymentStatus}
                onChange={e => setBillData({ ...billData, paymentStatus: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
              >
                <option value="PAID">PAID</option>
                <option value="UNPAID">UNPAID (Pending)</option>
                <option value="PARTIAL">PARTIAL</option>
              </select>
            </div>
          </div>

          {/* 2. Party Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">3. Party / Customer / Vendor Name *</label>
            <div className="space-y-1.5">
              {masterParties.length > 0 && (
                <select
                  value={billData.partyName}
                  onChange={e => setBillData({ ...billData, partyName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">-- Select from Master Parties or Type Below --</option>
                  {masterParties.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              )}
              <input
                type="text"
                required
                value={billData.partyName}
                onChange={e => setBillData({ ...billData, partyName: e.target.value })}
                placeholder="Enter party / customer name"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* 3. Material with Manage Materials Button */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">4. Material *</label>
                <button
                  type="button"
                  onClick={() => setIsManageMaterialOpen(true)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Manage Material
                </button>
              </div>
              <div className="space-y-1.5">
                {masterMaterials.length > 0 && (
                  <select
                    value={billData.materialName}
                    onChange={e => {
                      const selected = masterMaterials.find(m => m.name === e.target.value);
                      if (selected && selected.defaultUnit) {
                        if (PRESET_UNITS.includes(selected.defaultUnit)) {
                          setUnitMode(selected.defaultUnit);
                          setCustomUnit("");
                        } else {
                          setUnitMode("Custom");
                          setCustomUnit(selected.defaultUnit);
                        }
                      }
                      if (selected && selected.defaultRate) {
                        setBillData({
                          ...billData,
                          materialName: e.target.value,
                          rate: String(selected.defaultRate),
                        });
                      } else {
                        setBillData({
                          ...billData,
                          materialName: e.target.value,
                        });
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">-- Select Material or Type Below --</option>
                    {masterMaterials.map(m => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  required
                  value={billData.materialName}
                  onChange={e => setBillData({ ...billData, materialName: e.target.value })}
                  placeholder="e.g. UltraTech Cement, Steel 12mm"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">5. Unit of Measurement *</label>
              <div className="space-y-1.5">
                <select
                  value={unitMode}
                  onChange={e => setUnitMode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  {PRESET_UNITS.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                {unitMode === "Custom" && (
                  <input
                    type="text"
                    required
                    value={customUnit}
                    onChange={e => setCustomUnit(e.target.value)}
                    placeholder="Enter custom unit (e.g. Box, Bundle)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                )}
              </div>
            </div>
          </div>

          {/* 4. Quantity & Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">6. Quantity *</label>
              <input
                type="number"
                step="any"
                required
                value={billData.quantity}
                onChange={e => setBillData({ ...billData, quantity: e.target.value })}
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">7. Rate per {effectiveUnit} (₹) *</label>
              <input
                type="number"
                step="any"
                required
                value={billData.rate}
                onChange={e => setBillData({ ...billData, rate: e.target.value })}
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
              />
            </div>
          </div>

          {/* 5. Transport, Discount & GST */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">8. Transport Fee (₹) (+)</label>
              <input
                type="number"
                step="any"
                value={billData.transportCost}
                onChange={e => setBillData({ ...billData, transportCost: e.target.value })}
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
              <span className="text-[10px] text-slate-500">Excluded from GST (added separately)</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">9. Discount (₹) (-)</label>
              <input
                type="number"
                step="any"
                value={billData.discount}
                onChange={e => setBillData({ ...billData, discount: e.target.value })}
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">10. Tax / GST (%) (+)</label>
              <select
                value={billData.taxPercentage}
                onChange={e => setBillData({ ...billData, taxPercentage: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                {GST_PRESETS.map(g => (
                  <option key={g} value={g}>{g}% GST</option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Calculation Preview Box */}
          <div className="bg-slate-900 text-white rounded-xl p-4 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Material Subtotal ({billData.quantity || 0} &times; ₹{billData.rate || 0}):</span>
              <span>₹{billCalc.subtotal.toFixed(2)}</span>
            </div>
            {billCalc.discount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discount (-):</span>
                <span>-₹{billCalc.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-300">
              <span>Taxable Base Amount (for GST):</span>
              <span>₹{billCalc.baseAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>GST ({billData.taxPercentage}% on base amount):</span>
              <span>+₹{billCalc.taxAmount.toFixed(2)}</span>
            </div>
            {billCalc.transport > 0 && (
              <div className="flex justify-between text-amber-300">
                <span>Transport Fee (Added separately, No GST):</span>
                <span>+₹{billCalc.transport.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-emerald-400 pt-2 border-t border-slate-800">
              <span>11. Net Total Amount:</span>
              <span>₹{billCalc.netTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Payment Method & Ref */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">12. Payment Method</label>
              <select
                value={billData.paymentMethod}
                onChange={e => setBillData({ ...billData, paymentMethod: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
                <option value="UPI / NEFT">UPI / NEFT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">13. Ref / Cheque No.</label>
              <input
                type="text"
                value={billData.referenceNumber}
                onChange={e => setBillData({ ...billData, referenceNumber: e.target.value })}
                placeholder="e.g. INV-10492 / CHQ-1002"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">14. Notes / Remarks</label>
            <input
              type="text"
              value={billData.notes}
              onChange={e => setBillData({ ...billData, notes: e.target.value })}
              placeholder="Additional specifications or invoice notes"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg shadow-md transition-colors text-sm"
          >
            {editingBillId ? "Update Bill Investment" : "Save Bill Investment"}
          </button>
        </form>
      </Modal>

      {/* MANAGE MATERIAL MODAL */}
      <ManageMaterialsModal
        isOpen={isManageMaterialOpen}
        onClose={() => setIsManageMaterialOpen(false)}
        locationId={locationId}
        onSelectMaterial={(selectedMat) => {
          setBillData(prev => ({
            ...prev,
            materialName: selectedMat.name,
            rate: selectedMat.defaultRate ? String(selectedMat.defaultRate) : prev.rate,
          }));
          if (selectedMat.defaultUnit) {
            if (PRESET_UNITS.includes(selectedMat.defaultUnit)) {
              setUnitMode(selectedMat.defaultUnit);
              setCustomUnit("");
            } else {
              setUnitMode("Custom");
              setCustomUnit(selectedMat.defaultUnit);
            }
          }
          loadData(true);
        }}
      />
    </div>
  );
}
