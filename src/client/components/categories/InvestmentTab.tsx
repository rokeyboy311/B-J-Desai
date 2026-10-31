import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import {
  TrendingUp, Pencil, Edit3, Plus, Trash2, ArrowUpRight, ArrowDownLeft, FileText, Banknote,
  Building2, Calculator, CheckCircle2, Clock, AlertCircle, Package, User,
  Wallet, Layers, Search, Tag, Filter, Check, BarChart3, PieChart, ArrowRight,
  ShoppingCart, Truck, Wrench, Users, HardHat, RefreshCw, AlertTriangle, Receipt,
  Download, FileSpreadsheet, Scale, Landmark, ShieldCheck
} from "lucide-react";
import { useLiveSync, triggerSync } from "../../hooks/useLiveSync";
import { ManageMaterialsModal } from "../ui/ManageMaterialsModal";
import { useToast } from "../../contexts/ToastContext";
import { downloadExcelReport } from "../../lib/excelExport";
import { formatINR, formatDate } from "../../lib/formatters";
import { DateInput } from "../ui/DateInput";

const PRESET_UNITS = [
  "Nos", "Bags", "Ton", "Kg", "Brass", "CFT", "Cum", "Sq.ft", "Sq.m",
  "Trip", "Load", "Ltr", "Mtr", "Custom"
];

const GST_PRESETS = ["0", "5", "12", "18", "28"];

export default function InvestmentTab({ locationId }: { locationId: number }) {
  const { showToast, confirmAction } = useToast();
  // 9 Distinct Sub-Tabs:
  // 1. "notebook_hisab" - Unified Passbook Ledger (Inflows vs Site Expenses Outflows)
  // 2. "analytics" - Executive Category 3-6 Deductions & Capital Analytics Dashboard
  // 3. "reconciliation" - Capital Flow & Expense Matching Reconciliation Matrix
  // 4. "investor_capital" - Direct Investment from Investors (Investment Karya from Cat 1)
  // 5. "bill_investments" - Bill / Asset / Material Invoiced Investments
  // 6. "refundable_records" - Refundable Record (Security Deposit & Advances)
  // 7. "deductions_ledger" - Live Itemized Operational Deductions Passbook (Cat 3 to 6 & Refundables)
  // 8. "investor_payments" - Returns / Upad paid to Investors
  // 9. "combined" - Consolidated Investment Ledger & Balance Sheet
  const [activeSubTab, setActiveSubTab] = useState<"notebook_hisab" | "analytics" | "reconciliation" | "investor_capital" | "bill_investments" | "refundable_records" | "deductions_ledger" | "investor_payments" | "combined">("notebook_hisab");
  const [loading, setLoading] = useState(true);

  // Data
  const [parties, setParties] = useState<any[]>([]);
  const [mainInvestors, setMainInvestors] = useState<any[]>([]);
  const [masterParties, setMasterParties] = useState<any[]>([]);
  const [masterMaterials, setMasterMaterials] = useState<any[]>([]);
  const [investorTxs, setInvestorTxs] = useState<any[]>([]);
  const [billIncomes, setBillIncomes] = useState<any[]>([]);
  const [refundableRecords, setRefundableRecords] = useState<any[]>([]);
  const [projectUtilization, setProjectUtilization] = useState<any>(null);

  // Modals
  const [isCapitalModalOpen, setIsCapitalModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isRefundableModalOpen, setIsRefundableModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isManageMaterialOpen, setIsManageMaterialOpen] = useState(false);

  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [editingBillId, setEditingBillId] = useState<number | null>(null);
  const [editingRefundableId, setEditingRefundableId] = useState<number | null>(null);
  const [activeRefundRecord, setActiveRefundRecord] = useState<any | null>(null);

  // Filters & Search
  const [deductionCategoryFilter, setDeductionCategoryFilter] = useState<string>("ALL");
  const [deductionSearch, setDeductionSearch] = useState("");
  const [refundableFilter, setRefundableFilter] = useState<string>("ALL");
  const [refundableSearch, setRefundableSearch] = useState("");

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
    quantity: "1",
    unit: "N/A",
    rate: "",
    transportCost: "0",
    discount: "0",
    tdsPercentage: "0",
    taxPercentage: "18",
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    notes: "",
  });

  const [refundableFormData, setRefundableFormData] = useState({
    partyName: "",
    amount: "",
    depositType: "Security Deposit",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    notes: "",
  });

  const [refundActionData, setRefundActionData] = useState({
    refundedAmount: "",
    refundDate: new Date().toISOString().split("T")[0],
    refundNotes: "",
  });

  const [unitMode, setUnitMode] = useState("Nos");
  const [customUnit, setCustomUnit] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const effectiveUnit = unitMode === "Custom" ? (customUnit.trim() || "Unit") : unitMode;

  const loadData = async (isBackground = false) => {
    if (!isBackground && investorTxs.length === 0 && billIncomes.length === 0 && !projectUtilization) setLoading(true);
    try {
      const [partiesRes, mainPartiesRes, masterPartiesRes, masterMaterialsRes, txsRes, billsRes, utilRes, refundablesRes] = await Promise.all([
        apiFetch(`/investments/parties?locationId=${locationId}`).catch(() => []),
        apiFetch(`/investments/parties`).catch(() => []),
        apiFetch(`/master/parties?locationId=${locationId}`).catch(() => []),
        apiFetch(`/master/materials?locationId=${locationId}`).catch(() => []),
        apiFetch(`/investments/transactions?locationId=${locationId}`).catch(() => []),
        apiFetch(`/incomes?locationId=${locationId}`).catch(() => []),
        apiFetch(`/investments/project-utilization?locationId=${locationId}`).catch(() => null),
        apiFetch(`/investments/refundable-records?locationId=${locationId}`).catch(() => []),
      ]);
      setParties(Array.isArray(partiesRes) ? partiesRes : (partiesRes?.parties || []));
      setMainInvestors(Array.isArray(mainPartiesRes) ? mainPartiesRes : (mainPartiesRes?.parties || []));
      setMasterParties(Array.isArray(masterPartiesRes) ? masterPartiesRes : (masterPartiesRes?.parties || []));
      setMasterMaterials(Array.isArray(masterMaterialsRes) ? masterMaterialsRes : (masterMaterialsRes?.materials || []));
      setInvestorTxs(Array.isArray(txsRes) ? txsRes : (txsRes?.transactions || []));
      const refItems = Array.isArray(refundablesRes) ? refundablesRes : (refundablesRes?.records || []);
      setRefundableRecords(refItems);
      // Filter incomes to show only Bill / Material Incomes
      const billItems = Array.isArray(billsRes) ? billsRes : (billsRes?.incomes || []);
      setBillIncomes(billItems.filter((i: any) => i.isBillIncome || i.materialName || i.type === "BILL_INCOME"));
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

  // Categorized Transactions - Strictly INVESTMENT (Investment Karya from Category 1)
  const capitalInflowTxs = useMemo(() => {
    const list = Array.isArray(investorTxs) ? investorTxs : [];
    return list.filter(t => t.type === "INVESTMENT");
  }, [investorTxs]);

  const investorPaymentTxs = useMemo(() => {
    const list = Array.isArray(investorTxs) ? investorTxs : [];
    return list.filter(t => t.type === "UPAD" || t.type === "PAYMENT");
  }, [investorTxs]);

  // Aggregate Capital Totals: Category 2 Capital - Investment from Investors Capital is strictly Investment Karya total + Direct Allocations
  const investmentFromInvestorsCapital = useMemo(() => {
    if (projectUtilization?.budgetBalance?.investmentFromInvestorsCapital !== undefined) {
      return Number(projectUtilization.budgetBalance.investmentFromInvestorsCapital || 0);
    }
    if (projectUtilization?.investmentCapital?.investmentFromInvestorsCapital !== undefined) {
      return Number(projectUtilization.investmentCapital.investmentFromInvestorsCapital || 0);
    }
    return capitalInflowTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [projectUtilization, capitalInflowTxs]);

  // Backward compatibility alias
  const totalInvestorCapital = investmentFromInvestorsCapital;

  // Available Category 7 Investor Capital at this Location
  const availableInvestorCapitalBalance = useMemo(() => {
    const list = Array.isArray(parties) ? parties : [];
    return list.reduce((sum, p) => sum + Number(p?.cat7Available ?? p?.balance ?? 0), 0);
  }, [parties]);

  const totalInvestorPayments = useMemo(() => {
    if (projectUtilization?.budgetBalance?.returnsToInvestors !== undefined) {
      return Number(projectUtilization.budgetBalance.returnsToInvestors || 0);
    }
    return investorPaymentTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [projectUtilization, investorPaymentTxs]);

  const totalBillInvestments = useMemo(() => {
    if (projectUtilization?.budgetBalance?.billInvestment !== undefined) {
      return Number(projectUtilization.budgetBalance.billInvestment || 0);
    }
    if (projectUtilization?.investmentCapital?.billInvestment !== undefined) {
      return Number(projectUtilization.investmentCapital.billInvestment || 0);
    }
    const list = Array.isArray(billIncomes) ? billIncomes : [];
    return list.reduce((sum, b) => sum + Number(b.totalAmount || b.amount || 0), 0);
  }, [projectUtilization, billIncomes]);

  const totalBillGst = useMemo(() => {
    const list = Array.isArray(billIncomes) ? billIncomes : [];
    return list.reduce((sum, b) => {
      const tax = Number(b.taxAmount);
      if (!isNaN(tax) && tax > 0) return sum + tax;
      const sub = Number(b.subtotal || (Number(b.quantity || 0) * Number(b.rate || 0)));
      const pct = Number(b.taxPercentage || 0);
      return sum + (sub * pct / 100);
    }, 0);
  }, [billIncomes]);

  const totalBillTds = useMemo(() => {
    const list = Array.isArray(billIncomes) ? billIncomes : [];
    return list.reduce((sum, b) => {
      const tds = Number(b.tdsAmount);
      if (!isNaN(tds) && tds > 0) return sum + tds;
      const sub = Number(b.subtotal || (Number(b.quantity || 0) * Number(b.rate || 0)));
      const taxPct = Number(b.taxPercentage || 0);
      const taxAmt = Number(b.taxAmount) || (sub * taxPct / 100);
      const tdsBase = Math.max(0, sub - taxAmt);
      const tdsPct = Number(b.tdsPercentage || 0);
      return sum + (tdsBase * tdsPct / 100);
    }, 0);
  }, [billIncomes]);

  // Full Capital in Location = Investment from Investors Capital ONLY (Bill Investments are in Admin)
  const fullCapital = useMemo(() => {
    return investmentFromInvestorsCapital;
  }, [investmentFromInvestorsCapital]);

  // Category 2 Capital Pool
  const totalGrossInvestment = fullCapital;

  const safeRefundableRecords = useMemo(() => {
    return Array.isArray(refundableRecords) ? refundableRecords : [];
  }, [refundableRecords]);

  const refundableSummary = useMemo(() => {
    return {
      totalRefundable: 0,
      totalRefunded: 0,
      pendingRefundable: 0,
      count: 0,
    };
  }, []);

  // Operational Deductions from Categories 5 and 6 (Refundables are in Admin)
  const cat3Data = projectUtilization?.linkedExpenditures?.category3MaterialPurchases || { total: 0, paid: 0, outstanding: 0, count: 0 };
  const cat4Data = projectUtilization?.linkedExpenditures?.category4MaterialSupplies || { total: 0, paid: 0, outstanding: 0, count: 0 };
  const cat5Data = projectUtilization?.linkedExpenditures?.category5SiteSupplies || { total: 0, count: 0 };
  const cat6Data = projectUtilization?.linkedExpenditures?.category6Labour || projectUtilization?.linkedExpenditures?.category67Labour || { totalNetSalary: 0, totalPaid: 0, totalUpad: 0, outstandingBalance: 0, count: 0 };

  const totalDeductions = useMemo(() => {
    if (projectUtilization?.budgetBalance?.totalProjectExpenditure !== undefined) {
      return Number(projectUtilization.budgetBalance.totalProjectExpenditure || 0);
    }
    const cat5Total = Number(cat5Data.total || 0);
    const cat6Total = Number(cat6Data.totalDeduction ?? (Number(cat6Data.totalNetSalary || 0) + Number(cat6Data.totalUpad || 0)));
    return cat5Total + cat6Total;
  }, [projectUtilization, cat5Data, cat6Data]);

  // Category 2 formula: Remaining Capital = Full Capital (Investment from Investors) - Deductions (Cat 5-6) - Investor Upad / Return
  const netRemainingCapital = useMemo(() => {
    if (projectUtilization?.budgetBalance?.remainingInvestmentCapital !== undefined) {
      return Number(projectUtilization.budgetBalance.remainingInvestmentCapital || 0);
    }
    return fullCapital - totalDeductions - totalInvestorPayments;
  }, [projectUtilization, fullCapital, totalDeductions, totalInvestorPayments]);

  const capitalUtilizationRate = useMemo(() => {
    if (fullCapital <= 0) return 0;
    return Math.min(100, Math.round((totalDeductions / fullCapital) * 1000) / 10);
  }, [totalDeductions, fullCapital]);

  // 3-Expense Breakdown explicitly requested: Material Supply (Cat 2), Site Supply (Cat 3), Labour Attendance (Cat 4)
  // Reconciled against Investment Capital (Cat 1) & Contractor Cost (Cat 5)
  const threeExpensesBreakdown = useMemo(() => {
    const materialSupply = Number(projectUtilization?.siteOperationsExpenditure?.totalMaterialSupply ?? (cat4Data.total || 0));
    const siteSupply = Number(projectUtilization?.siteOperationsExpenditure?.totalSiteSupply ?? (cat5Data.total || 0));
    const labourAttendance = Number(projectUtilization?.siteOperationsExpenditure?.totalLabourAttendance ?? (cat6Data.totalDeduction ?? (Number(cat6Data.totalNetSalary || 0) + Number(cat6Data.totalUpad || 0))));
    const totalSiteExpenses = Math.round((materialSupply + siteSupply + labourAttendance) * 100) / 100;

    // Rule 1: Investment Capital vs (Material Supply + Site Supply + Labour Attendance)
    const investmentVariance = Math.round((investmentFromInvestorsCapital - totalSiteExpenses) * 100) / 100;
    const isInvestmentMatched = Math.abs(investmentVariance) < 0.01;
    const investmentStatus: "MATCHED" | "SURPLUS" | "DEFICIT" = isInvestmentMatched 
      ? "MATCHED" 
      : (investmentVariance > 0 ? "SURPLUS" : "DEFICIT");

    // Rule 2: (Site Supply + Labour Attendance) vs Contractor Cost
    const expectedContractorCost = Math.round((siteSupply + labourAttendance) * 100) / 100;
    const recordedContractorCost = Number(projectUtilization?.contractorCostReconciliation?.recordedContractorCost ?? 0);
    const contractorVariance = Math.round((recordedContractorCost - expectedContractorCost) * 100) / 100;
    const isContractorMatched = Math.abs(contractorVariance) < 0.01;
    const contractorStatus: "MATCHED" | "SURPLUS" | "DEFICIT" = isContractorMatched 
      ? "MATCHED" 
      : (contractorVariance > 0 ? "SURPLUS" : "DEFICIT");

    return {
      materialSupply,
      siteSupply,
      labourAttendance,
      totalSiteExpenses,
      investmentCapital: investmentFromInvestorsCapital,
      investmentVariance,
      investmentStatus,
      expectedContractorCost,
      recordedContractorCost,
      contractorVariance,
      contractorStatus,
      contractorCount: projectUtilization?.contractorCostReconciliation?.contractorCostCount || 0
    };
  }, [projectUtilization, cat4Data, cat5Data, cat6Data, investmentFromInvestorsCapital]);

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

  const filteredRefundables = useMemo(() => {
    return safeRefundableRecords.filter(r => {
      const matchFilter = refundableFilter === "ALL" || r.refundStatus === refundableFilter;
      const matchSearch = !refundableSearch.trim() ||
        (r.partyName || "").toLowerCase().includes(refundableSearch.toLowerCase()) ||
        (r.depositType || "").toLowerCase().includes(refundableSearch.toLowerCase()) ||
        (r.referenceNumber || "").toLowerCase().includes(refundableSearch.toLowerCase()) ||
        (r.notes || "").toLowerCase().includes(refundableSearch.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [safeRefundableRecords, refundableFilter, refundableSearch]);

  // --- Location Investment Capital Passbook Ledger ---
  const [notebookFilter, setNotebookFilter] = useState<"ALL" | "ADDED" | "REMOVED">("ALL");
  const [notebookCategoryFilter, setNotebookCategoryFilter] = useState<string>("ALL");
  const [notebookSearch, setNotebookSearch] = useState<string>("");

  const investmentNotebookEntries = useMemo(() => {
    const items: any[] = [];

    // 1. Capital Inflows from Investors (+ INFLOWS)
    (Array.isArray(capitalInflowTxs) ? capitalInflowTxs : []).forEach(tx => {
      const amt = parseFloat(String(tx.amount || 0));
      items.push({
        id: `tx-${tx.id}`,
        rawId: tx.id,
        kind: 'INVESTOR_CAPITAL',
        date: tx.date,
        partyName: tx.partyName || 'Investor',
        categoryKey: 'INVESTOR_CAPITAL',
        categoryLabel: 'Investor Capital (+ INFLOW)',
        type: 'ADDED',
        particulars: tx.description ? `Investor Capital: ${tx.description}` : 'Direct Investment from Investor Capital',
        paymentMethod: tx.paymentMethod || 'Bank Transfer',
        referenceNumber: tx.referenceNumber || '-',
        jama: amt,
        udhar: 0,
        amount: amt
      });
    });

    // 2. Operational Site Deductions (- DEDUCTIONS)
    const rawDeductions: any[] = projectUtilization?.itemizedDeductions || [];
    rawDeductions.forEach(d => {
      const amt = parseFloat(String(d.amount || d.paidAmount || 0));
      const catKey = d.categoryKey || 'OPERATIONAL';
      items.push({
        id: `ded-${d.id}-${d.categoryKey}`,
        rawId: d.id,
        kind: 'DEDUCTION',
        date: d.date,
        partyName: d.partyName || 'Site Expense',
        categoryKey: catKey,
        categoryLabel: d.categoryName || 'Site Expense (- EXPENSE)',
        type: 'REMOVED',
        particulars: d.description || d.particulars || 'Site operational expense',
        paymentMethod: d.paymentMethod || 'Site Account',
        referenceNumber: d.referenceNumber || '-',
        jama: 0,
        udhar: amt,
        amount: amt
      });
    });

    // 4. Investor Upad / Returns (- UPAD)
    (Array.isArray(investorPaymentTxs) ? investorPaymentTxs : []).forEach(tx => {
      const amt = parseFloat(String(tx.amount || 0));
      items.push({
        id: `upad-${tx.id}`,
        rawId: tx.id,
        kind: 'UPAD',
        date: tx.date,
        partyName: tx.partyName || 'Investor',
        categoryKey: 'INVESTOR_UPAD',
        categoryLabel: 'Investor Upad (- UPAD)',
        type: 'REMOVED',
        particulars: tx.description ? `Upad / Return: ${tx.description}` : 'Capital return to investor',
        paymentMethod: tx.paymentMethod || 'Bank Transfer',
        referenceNumber: tx.referenceNumber || '-',
        jama: 0,
        udhar: amt,
        amount: amt
      });
    });

    // Chronological sorting
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
  }, [capitalInflowTxs, billIncomes, projectUtilization, investorPaymentTxs]);

  const filteredInvestmentNotebook = useMemo(() => {
    return investmentNotebookEntries.filter(e => {
      const matchType = notebookFilter === "ALL" || e.type === notebookFilter;
      const matchCat = notebookCategoryFilter === "ALL" || e.categoryKey === notebookCategoryFilter;
      const q = notebookSearch.toLowerCase().trim();
      const matchSearch = !q ||
        (e.partyName && e.partyName.toLowerCase().includes(q)) ||
        (e.particulars && e.particulars.toLowerCase().includes(q)) ||
        (e.categoryLabel && e.categoryLabel.toLowerCase().includes(q)) ||
        (e.referenceNumber && e.referenceNumber.toLowerCase().includes(q)) ||
        (e.paymentMethod && e.paymentMethod.toLowerCase().includes(q));
      return matchType && matchCat && matchSearch;
    });
  }, [investmentNotebookEntries, notebookFilter, notebookCategoryFilter, notebookSearch]);

  // Handle Save / Update Refundable Record
  const handleSaveRefundable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundableFormData.partyName || !refundableFormData.amount) {
      showToast("Please provide Party Name and Amount", "error");
      return;
    }
    try {
      const url = editingRefundableId
        ? `/investments/refundable-records/${editingRefundableId}`
        : "/investments/refundable-records";
      const method = editingRefundableId ? "PUT" : "POST";

      await apiFetch(url, {
        method,
        body: JSON.stringify({
          locationId,
          partyName: refundableFormData.partyName.trim(),
          amount: parseFloat(refundableFormData.amount),
          depositType: refundableFormData.depositType,
          date: refundableFormData.date,
          paymentMethod: refundableFormData.paymentMethod,
          referenceNumber: refundableFormData.referenceNumber,
          notes: refundableFormData.notes,
        }),
      });

      triggerSync("investments");
      setRefundableFormData({
        partyName: "",
        amount: "",
        depositType: "Security Deposit",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        referenceNumber: "",
        notes: "",
      });
      setEditingRefundableId(null);
      setIsRefundableModalOpen(false);
      showToast(
        editingRefundableId
          ? "Refundable record updated"
          : "Refundable record added and deducted from Project Capital",
        "success"
      );
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to save refundable record.", "error");
    }
  };

  const openEditRefundable = (rec: any) => {
    setEditingRefundableId(rec.id);
    setRefundableFormData({
      partyName: rec.partyName || "",
      amount: String(rec.amount || ""),
      depositType: rec.depositType || rec.description || "Security Deposit",
      date: rec.date || new Date().toISOString().split("T")[0],
      paymentMethod: rec.paymentMethod || "Bank Transfer",
      referenceNumber: rec.referenceNumber || "",
      notes: rec.notes || "",
    });
    setIsRefundableModalOpen(true);
  };

  // Handle Process Refund
  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRefundRecord || !refundActionData.refundedAmount) return;
    try {
      await apiFetch(`/investments/refundable-records/${activeRefundRecord.id}/refund`, {
        method: "PUT",
        body: JSON.stringify({
          refundedAmount: parseFloat(refundActionData.refundedAmount),
          refundDate: refundActionData.refundDate,
          refundNotes: refundActionData.refundNotes,
        }),
      });

      triggerSync("investments");
      setIsRefundModalOpen(false);
      setActiveRefundRecord(null);
      showToast("Refund recorded successfully", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to record refund.", "error");
    }
  };

  // Handle Delete Refundable
  const handleDeleteRefundable = async (id: number) => {
    const confirmed = await confirmAction({
      title: "Delete Refundable Record",
      message: "Are you sure you want to delete this refundable record?",
      confirmLabel: "Delete",
      isDanger: true,
    });
    if (!confirmed) return;
    try {
      await apiFetch(`/investments/refundable-records/${id}?locationId=${locationId}`, { method: "DELETE" });
      triggerSync("investments");
      showToast("Refundable record deleted", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete refundable record.", "error");
    }
  };

  // Live Bill Calculation Breakdown:
  // Bill Subtotal - GST = Base Amount of TDS - TDS (+ Transport Fee separately)
  const billCalc = useMemo(() => {
    const rate = parseFloat(billData.rate) || 0;
    const subtotal = rate;
    const transport = parseFloat(billData.transportCost) || 0;
    const taxPct = parseFloat(billData.taxPercentage) || 0;
    const tdsPct = parseFloat(billData.tdsPercentage) || 0;

    // 1. GST is calculated on Bill Subtotal and deducted (-)
    const taxAmount = (subtotal * taxPct) / 100;
    // 2. Bill Subtotal - GST = Base Amount of TDS
    const tdsBaseAmount = Math.max(0, subtotal - taxAmount);
    // 3. TDS is calculated on Base Amount of TDS and deducted (-)
    const tdsAmount = (tdsBaseAmount * tdsPct) / 100;
    const afterTdsAmount = Math.max(0, tdsBaseAmount - tdsAmount);
    // 4. Transport is added separately to the final total
    const netTotal = afterTdsAmount + transport;

    return {
      subtotal,
      transport,
      taxPct,
      taxAmount,
      tdsPct,
      tdsBaseAmount,
      tdsAmount,
      afterTdsAmount,
      discount: tdsAmount,
      baseAmount: tdsBaseAmount,
      netTotal,
    };
  }, [billData]);

  // Save Capital Contribution (Add Investment Capital from Investor Capital)
  const handleSaveCapital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capitalFormData.partyId || !capitalFormData.amount) return;

    const selectedParty = parties.find(p => p.id.toString() === capitalFormData.partyId);
    const rawAvailableBalance = selectedParty ? Number(selectedParty.cat7Available ?? selectedParty.balance ?? 0) : 0;
    const editingOrigTx = editingTxId ? investorTxs.find(t => t.id === editingTxId) : null;
    const oldTxAmount =
      editingOrigTx &&
      editingOrigTx.type === "INVESTMENT" &&
      String(editingOrigTx.partyId) === String(capitalFormData.partyId)
        ? Number(editingOrigTx.amount || 0) || 0
        : 0;
    const availableBalance = Math.round((rawAvailableBalance + oldTxAmount) * 100) / 100;
    const enteredAmount = parseFloat(capitalFormData.amount);

    if (isNaN(enteredAmount) || enteredAmount <= 0) {
      showToast("Please enter a valid positive amount", "error");
      return;
    }

    if (capitalFormData.type === "INVESTMENT" && enteredAmount > availableBalance) {
      showToast(
        `Selected investor ${selectedParty?.partyName || ''} has only ₹${availableBalance.toLocaleString('en-IN')} available in Category 7. Cannot deduct ₹${enteredAmount.toLocaleString('en-IN')}.`,
        "error"
      );
      return;
    }

    try {
      const url = editingTxId ? `/investments/transactions/${editingTxId}` : "/investments/transactions";
      const method = editingTxId ? "PUT" : "POST";

      await apiFetch(url, {
        method,
        body: JSON.stringify({
          locationId,
          partyId: parseInt(capitalFormData.partyId),
          type: capitalFormData.type || "INVESTMENT",
          amount: enteredAmount,
          date: capitalFormData.date,
          paymentMethod: capitalFormData.paymentMethod,
          referenceNumber: capitalFormData.referenceNumber,
          description: capitalFormData.description,
        }),
      });

      triggerSync("investments");
      triggerSync("investor_capital");
      triggerSync("reports");
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
      showToast(
        editingTxId 
          ? "Investment record updated" 
          : "Amount deducted from Category 7 and added to Investment Capital", 
        "success"
      );
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to save capital investment.", "error");
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
      showToast(editingTxId ? "Payment updated" : "Investor payment recorded", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to record investor payment.", "error");
    }
  };

  // Save Bill Investment
  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billData.partyName || !billData.rate) {
      showToast("Please fill in Party/Customer/Company Name and Bill Amount.", "error");
      return;
    }

    try {
      const payload = {
        locationId,
        date: billData.date,
        partyName: billData.partyName.trim(),
        materialName: billData.materialName ? billData.materialName.trim() : "General Bill",
        quantity: 1,
        unit: "N/A",
        rate: parseFloat(billData.rate) || 0,
        subtotal: billCalc.subtotal,
        transportCost: billCalc.transport,
        discount: billCalc.tdsAmount,
        tdsPercentage: parseFloat(billData.tdsPercentage) || 0,
        tdsAmount: billCalc.tdsAmount,
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
        title: `Bill: ${billData.partyName.trim()}`,
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
      showToast(editingBillId ? "Bill investment updated" : "Bill investment recorded", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to save bill investment.", "error");
    }
  };

  const resetBillForm = () => {
    setEditingBillId(null);
    setBillData({
      date: new Date().toISOString().split("T")[0],
      paymentStatus: "PAID",
      partyName: "",
      materialName: "",
      quantity: "1",
      unit: "N/A",
      rate: "",
      transportCost: "0",
      discount: "0",
      tdsPercentage: "0",
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
    setBillData({
      date: bill.date || new Date().toISOString().split("T")[0],
      paymentStatus: bill.paymentStatus || "PAID",
      partyName: bill.partyName || "",
      materialName: bill.materialName || "",
      quantity: "1",
      unit: "N/A",
      rate: String(bill.rate || bill.subtotal || bill.amount || ""),
      transportCost: String(bill.transportCost || "0"),
      discount: String(bill.discount || "0"),
      tdsPercentage: String(bill.tdsPercentage !== undefined ? bill.tdsPercentage : "0"),
      taxPercentage: String(bill.taxPercentage || "0"),
      paymentMethod: bill.paymentMethod || "Bank Transfer",
      referenceNumber: bill.referenceNumber || "",
      notes: bill.notes || "",
    });
    setIsBillModalOpen(true);
  };

  const handleDeleteBill = async (id: number) => {
    const confirmed = await confirmAction({
      title: "Delete Bill Investment",
      message: "Are you sure you want to delete this bill investment?",
      confirmLabel: "Delete",
      isDanger: true
    });
    if (!confirmed) return;
    try {
      await apiFetch(`/incomes/${id}?locationId=${locationId}`, { method: "DELETE" });
      triggerSync("incomes");
      showToast("Bill investment deleted", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete bill investment.", "error");
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
      await apiFetch(`/investments/transactions/${id}?locationId=${locationId}`, { method: "DELETE" });
      triggerSync("investments");
      showToast("Transaction deleted", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete transaction.", "error");
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
            Capital from investors, deductions (Cat 3 to 6 & Refundables), investor returns, and net remaining capital.
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
            <ArrowUpRight className="w-3.5 h-3.5" /> + Add Investment Capital from Investor Capital
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

          <button
            onClick={() => downloadExcelReport(`/reports/export-location/${locationId}?tab=all`, `Investment_Report_Location_${locationId}.xlsx`)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
            title="Download complete Category 2 & Operational Deductions Excel file"
          >
            <Download className="w-3.5 h-3.5" /> Export Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* 4 Executive Summary Stat Cards - Category 2 Full Capital & Deductions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Investment from Investors Capital */}
        <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs font-bold uppercase tracking-wider">1. Investment from Investor Capital</span>
            <div className="p-1.5 bg-emerald-100 rounded-lg"><ArrowUpRight className="w-4 h-4 text-emerald-700" /></div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black text-emerald-900">₹{investmentFromInvestorsCapital.toLocaleString()}</div>
            <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
              Allocated from Cat 7 Investor Capital
            </p>
          </div>
        </div>

        {/* 2. Full Capital */}
        <div className="bg-blue-50/90 border border-blue-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-800">
            <span className="text-xs font-bold uppercase tracking-wider">2. Full Capital</span>
            <div className="p-1.5 bg-blue-100 rounded-lg"><Building2 className="w-4 h-4 text-blue-700" /></div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black text-blue-900">₹{fullCapital.toLocaleString()}</div>
            <p className="text-[11px] text-blue-700 mt-0.5 font-medium">
              Total Location Investment Capital
            </p>
          </div>
        </div>

        {/* 3. Deductions & Upad */}
        <div className="bg-rose-50/90 border border-rose-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-800">
            <span className="text-xs font-bold uppercase tracking-wider">3. Deductions & Upad</span>
            <div className="p-1.5 bg-rose-100 rounded-lg"><TrendingUp className="w-4 h-4 text-rose-700" /></div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black text-rose-900">-₹{(totalDeductions + totalInvestorPayments).toLocaleString()}</div>
            <p className="text-[11px] text-rose-700 mt-0.5 font-medium">
              Site Expenses: ₹{totalDeductions.toLocaleString()} + Upad: ₹{totalInvestorPayments.toLocaleString()}
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
              Remaining Balance ({capitalUtilizationRate}% Utilized)
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex bg-slate-100 p-1.5 rounded-xl gap-1.5 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab("notebook_hisab")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
            activeSubTab === "notebook_hisab"
              ? "bg-[#0B1D3A] text-white shadow-sm ring-2 ring-amber-400/50"
              : "text-slate-600 hover:text-slate-900 bg-amber-50/60 border border-amber-200"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-amber-500" />
          <span>Passbook Ledger</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-900">
            {investmentNotebookEntries.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab("analytics")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
            activeSubTab === "analytics"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Analytics & Deductions
        </button>

        <button
          onClick={() => setActiveSubTab("reconciliation")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
            activeSubTab === "reconciliation"
              ? "bg-purple-700 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Scale className="w-4 h-4" />
          Reconciliation Matrix
          {threeExpensesBreakdown.investmentStatus === "MATCHED" && (
            <span className="ml-1 px-1.5 py-0.5 bg-emerald-400 text-slate-900 rounded-full text-[10px] font-black">
              ✓
            </span>
          )}
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
          Investment from Investor Capital ({capitalInflowTxs.length})
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
          {/* Quick Dual Reconciliation Highlights Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Box 1: Site Expenses vs Investment Capital Matching */}
            <div className={`p-4 rounded-2xl border transition-all ${
              threeExpensesBreakdown.investmentStatus === "MATCHED"
                ? "bg-emerald-50/70 border-emerald-200"
                : threeExpensesBreakdown.investmentStatus === "SURPLUS"
                ? "bg-blue-50/70 border-blue-200"
                : "bg-rose-50/70 border-rose-200"
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-purple-700" />
                  <span className="text-xs font-black text-slate-900">
                    Rule 1: Investment Capital vs Site Expenses
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  threeExpensesBreakdown.investmentStatus === "MATCHED"
                    ? "bg-emerald-200 text-emerald-900"
                    : threeExpensesBreakdown.investmentStatus === "SURPLUS"
                    ? "bg-blue-200 text-blue-900"
                    : "bg-rose-200 text-rose-900"
                }`}>
                  {threeExpensesBreakdown.investmentStatus === "MATCHED"
                    ? "✓ 100% MATCHED"
                    : threeExpensesBreakdown.investmentStatus === "SURPLUS"
                    ? "SURPLUS (UNSPENT)"
                    : "DEFICIT (SHORTFALL)"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px] block">Investment Capital:</span>
                  <span className="font-black text-slate-900 text-sm">
                    ₹{threeExpensesBreakdown.investmentCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Material + Site + Labour:</span>
                  <span className="font-black text-slate-900 text-sm">
                    ₹{threeExpensesBreakdown.totalSiteExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex justify-between items-center text-xs">
                <span className="text-slate-600 font-medium">Variance:</span>
                <span className={`font-black ${
                  threeExpensesBreakdown.investmentStatus === "MATCHED"
                    ? "text-emerald-700"
                    : threeExpensesBreakdown.investmentStatus === "SURPLUS"
                    ? "text-blue-700"
                    : "text-rose-700"
                }`}>
                  {threeExpensesBreakdown.investmentVariance >= 0 ? "+" : ""}
                  ₹{threeExpensesBreakdown.investmentVariance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Box 2: Site Supply + Labour vs Contractor Cost Matching */}
            <div className={`p-4 rounded-2xl border transition-all ${
              threeExpensesBreakdown.contractorStatus === "MATCHED"
                ? "bg-emerald-50/70 border-emerald-200"
                : threeExpensesBreakdown.contractorStatus === "SURPLUS"
                ? "bg-blue-50/70 border-blue-200"
                : "bg-amber-50/70 border-amber-200"
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <div className="flex items-center gap-2">
                  <HardHat className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-black text-slate-900">
                    Rule 2: (Site Supply + Labour) vs Contractor Cost
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  threeExpensesBreakdown.contractorStatus === "MATCHED"
                    ? "bg-emerald-200 text-emerald-900"
                    : threeExpensesBreakdown.contractorStatus === "SURPLUS"
                    ? "bg-blue-200 text-blue-900"
                    : "bg-amber-200 text-amber-900"
                }`}>
                  {threeExpensesBreakdown.contractorStatus === "MATCHED"
                    ? "✓ 100% MATCHED"
                    : threeExpensesBreakdown.contractorStatus === "SURPLUS"
                    ? "SURPLUS"
                    : "PENDING ENTRY"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px] block">Expected (Supply+Labour):</span>
                  <span className="font-black text-slate-900 text-sm">
                    ₹{threeExpensesBreakdown.expectedContractorCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Recorded Contractor Cost:</span>
                  <span className="font-black text-slate-900 text-sm">
                    ₹{threeExpensesBreakdown.recordedContractorCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex justify-between items-center text-xs">
                <span className="text-slate-600 font-medium">Difference:</span>
                <span className={`font-black ${
                  threeExpensesBreakdown.contractorStatus === "MATCHED"
                    ? "text-emerald-700"
                    : threeExpensesBreakdown.contractorStatus === "SURPLUS"
                    ? "text-blue-700"
                    : "text-amber-700"
                }`}>
                  {threeExpensesBreakdown.contractorVariance >= 0 ? "+" : ""}
                  ₹{threeExpensesBreakdown.contractorVariance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
          {/* Capital Allocation & Deduction Waterfall Matrix */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-indigo-600" />
                  Investment Capital & Operational Deductions Flow
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time synchronization showing how project site supplies, labour wages, and refundable security deposits cut into Investment Capital.
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
                      style={{ width: `${Math.min(100, (Number(cat5Data.total || 0) / totalGrossInvestment) * 100)}%` }}
                      className="bg-teal-500 h-full transition-all"
                      title={`Cat 5 Site Supplies: ₹${Number(cat5Data.total || 0).toLocaleString()}`}
                    />
                    <div
                      style={{ width: `${Math.min(100, (Number(cat6Data.totalDeduction ?? (Number(cat6Data.totalNetSalary || 0) + Number(cat6Data.totalUpad || 0))) / totalGrossInvestment) * 100)}%` }}
                      className="bg-rose-500 h-full transition-all"
                      title={`Cat 6 Labour Wages & Kharch: ₹${Number(cat6Data.totalDeduction ?? (Number(cat6Data.totalNetSalary || 0) + Number(cat6Data.totalUpad || 0))).toLocaleString()}`}
                    />
                    {refundableSummary.pendingRefundable > 0 && (
                      <div
                        style={{ width: `${Math.min(100, (refundableSummary.pendingRefundable / totalGrossInvestment) * 100)}%` }}
                        className="bg-purple-600 h-full transition-all"
                        title={`Refundable Security Deposits: ₹${refundableSummary.pendingRefundable.toLocaleString()}`}
                      />
                    )}
                    <div
                      style={{ width: `${Math.min(100, (Number(totalInvestorPayments || 0) / totalGrossInvestment) * 100)}%` }}
                      className="bg-amber-600 h-full transition-all"
                      title={`Investor Upad: ₹${Number(totalInvestorPayments || 0).toLocaleString()}`}
                    />
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 pt-1">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-teal-500 inline-block" /> Cat 5 Site Supplies</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" /> Cat 6 Labour & Kharch</span>
                {refundableSummary.pendingRefundable > 0 && (
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-purple-600 inline-block" /> Refundables / Deposits</span>
                )}
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-600 inline-block" /> Investor Upad</span>
                <span className="flex items-center gap-1.5 ml-auto font-bold text-slate-800">Remaining Capital: ₹{netRemainingCapital.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* The Connected Category Operational Deductions Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-600" />
                Category-Wise Operational Deductions & Security Deposits (Cut from Investment Capital)
              </h4>
              <button
                onClick={() => setActiveSubTab("deductions_ledger")}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                View Itemized Passbook &rarr;
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category 5: Site Supplies */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-teal-300 transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
                      Category 5
                    </span>
                    <Wrench className="w-4 h-4 text-teal-600" />
                  </div>
                  <h5 className="font-black text-slate-900 text-sm mt-2">Site Supplies & Materials</h5>
                  <p className="text-xs text-slate-500 mt-0.5">{cat5Data.count} site supply issues</p>
                  
                  <div className="mt-3 py-2 border-y border-slate-100 flex items-baseline justify-between">
                    <span className="text-xs font-bold text-slate-600">Total Deducted:</span>
                    <span className="text-base font-black text-teal-700">-₹{Number(cat5Data.total || 0).toLocaleString()}</span>
                  </div>
                  
                  <div className="mt-2 text-xs space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className="font-semibold text-emerald-600">100% Direct Incurred</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Entries:</span>
                      <span className="font-semibold text-slate-800">{cat5Data.count} items recorded</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-500">
                  <span>Share of Capital:</span>
                  <span className="font-bold text-teal-800">
                    {totalGrossInvestment > 0 ? ((Number(cat5Data.total || 0) / totalGrossInvestment) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>

              {/* Category 6: Labour Attendance, Upad & Other Kharch */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-rose-300 transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      Category 6
                    </span>
                    <Users className="w-4 h-4 text-rose-600" />
                  </div>
                  <h5 className="font-black text-slate-900 text-sm mt-2">Labour Attendance & Expenses</h5>
                  <p className="text-xs text-slate-500 mt-0.5">Attendance, Team Upad & Other Kharch</p>
                  
                  <div className="mt-3 py-2 border-y border-slate-100 flex items-baseline justify-between">
                    <span className="text-xs font-bold text-slate-600">Total Deducted:</span>
                    <span className="text-base font-black text-rose-700">-₹{Number(cat6Data.totalDeduction ?? (Number(cat6Data.totalNetSalary || 0) + Number(cat6Data.totalUpad || 0))).toLocaleString()}</span>
                  </div>
                  
                  <div className="mt-2 text-xs space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>Attendance / Paid:</span>
                      <span className="font-semibold text-slate-800">₹{Number(cat6Data.totalPaid || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Team Upad / Advances:</span>
                      <span className="font-semibold text-amber-600">₹{Number(cat6Data.totalUpad || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Unpaid Balance:</span>
                      <span className="font-semibold text-rose-600">₹{Number(cat6Data.outstandingBalance || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-500">
                  <span>Share of Capital:</span>
                  <span className="font-bold text-rose-800">
                    {totalGrossInvestment > 0 ? (((Number(cat6Data.totalDeduction ?? (Number(cat6Data.totalNetSalary || 0) + Number(cat6Data.totalUpad || 0)))) / totalGrossInvestment) * 100).toFixed(1) : 0}%
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
                Latest Deductions Recorded (Site Supply, Labour & Security Deposits)
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
                      item.categoryKey === "CAT5_SITE" ? "bg-teal-100 text-teal-800" :
                      item.categoryKey === "CAT6_LABOUR" ? "bg-rose-100 text-rose-800" :
                      "bg-purple-100 text-purple-800"
                    }`}>
                      {item.categoryName}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900">{item.partyName}</div>
                      <div className="text-[11px] text-slate-500">
                        {formatDate(item.date)} &bull; {item.description || "Operational expense"}
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
                <div className="py-6 text-center text-slate-400 text-xs">No expenditure deductions recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: CAPITAL FLOW & EXPENSES RECONCILIATION MATRIX */}
      {activeSubTab === "reconciliation" && (
        <div className="space-y-6">
          {/* Header Description Card */}
          <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-500/20 border border-purple-400/30 rounded-2xl">
                    <Scale className="w-6 h-6 text-purple-300" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                      Comprehensive Capital Flow and Site Expense Reconciliation
                    </h3>
                    <p className="text-xs text-purple-200/80 mt-0.5">
                      Full Financial Flow: Admin Capital &rarr; Investor Capital &rarr; Investment Capital &rarr; (Material Supply + Site Supply + Labour Attendance) &rarr; Contractor Cost
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
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
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" /> + Add Investment from Investor Capital
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        await downloadExcelReport(`/contractors/reconciliation/export?locationId=${locationId}`, `Reconciliation_Report_Location_${locationId}.xlsx`);
                        showToast("Reconciliation report exported successfully", "success");
                      } catch (err: any) {
                        showToast(err.message || "Failed to export report", "error");
                      }
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition-all cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Export Excel
                  </button>
                </div>
              </div>

              {/* 5-Stage Visual Workflow Chain */}
              <div className="mt-5 grid grid-cols-1 md:grid-cols-5 gap-3">
                {/* Stage 1 */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
                  <div className="text-[10px] font-bold text-purple-300 uppercase tracking-wider mb-1">Stage 1: Central Pool</div>
                  <div className="text-sm font-black text-white flex items-center justify-center gap-1">
                    <Landmark className="w-4 h-4 text-purple-400" /> Admin Capital
                  </div>
                  <div className="text-[11px] text-purple-200/70 mt-1">Master Enterprise Fund</div>
                </div>

                {/* Stage 2 */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
                  <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider mb-1">Stage 2: Category 7</div>
                  <div className="text-sm font-black text-white flex items-center justify-center gap-1">
                    <Users className="w-4 h-4 text-emerald-400" /> Investor Capital
                  </div>
                  <div className="text-[11px] text-emerald-200/70 mt-1">
                    Avail: ₹{(availableInvestorCapitalBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>

                {/* Stage 3 */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
                  <div className="text-[10px] font-bold text-blue-300 uppercase tracking-wider mb-1">Stage 3: Category 1</div>
                  <div className="text-sm font-black text-white flex items-center justify-center gap-1">
                    <Building2 className="w-4 h-4 text-blue-400" /> Investment Capital
                  </div>
                  <div className="text-[11px] text-blue-200/70 mt-1 font-bold">
                    ₹{threeExpensesBreakdown.investmentCapital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>

                {/* Stage 4 */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
                  <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider mb-1">Stage 4: Site Spend</div>
                  <div className="text-sm font-black text-white flex items-center justify-center gap-1">
                    <Truck className="w-4 h-4 text-amber-400" /> 3 Expenses Total
                  </div>
                  <div className="text-[11px] text-amber-200/70 mt-1 font-bold">
                    ₹{threeExpensesBreakdown.totalSiteExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>

                {/* Stage 5 */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
                  <div className="text-[10px] font-bold text-rose-300 uppercase tracking-wider mb-1">Stage 5: Category 5</div>
                  <div className="text-sm font-black text-white flex items-center justify-center gap-1">
                    <HardHat className="w-4 h-4 text-rose-400" /> Contractor Cost
                  </div>
                  <div className="text-[11px] text-rose-200/70 mt-1 font-bold">
                    ₹{threeExpensesBreakdown.recordedContractorCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DUAL MATCHING RECONCILIATION MATRICES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* MATRIX 1: INVESTMENT CAPITAL vs (MATERIAL SUPPLY + SITE SUPPLY + LABOUR ATTENDANCE) */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md">
                    Matching Rule 1
                  </span>
                  <h4 className="text-base font-black text-slate-900 mt-2 flex items-center gap-2">
                    <Scale className="w-5 h-5 text-purple-600" />
                    Reconcile Capital vs Total Site Expenditure
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Investment Capital MUST match (Material Supply + Site Supply + Labour Attendance)
                  </p>
                </div>

                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-xs font-black inline-flex items-center gap-1 ${
                    threeExpensesBreakdown.investmentStatus === "MATCHED"
                      ? "bg-emerald-100 text-emerald-800"
                      : threeExpensesBreakdown.investmentStatus === "SURPLUS"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-rose-100 text-rose-800"
                  }`}>
                    {threeExpensesBreakdown.investmentStatus === "MATCHED" ? (
                      <>✓ Balanced & Matched</>
                    ) : threeExpensesBreakdown.investmentStatus === "SURPLUS" ? (
                      <>+ Surplus Capital</>
                    ) : (
                      <>⚠ Capital Deficit</>
                    )}
                  </span>
                </div>
              </div>

              {/* Formula Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-600">Investment Capital:</span>
                  <span className="font-black text-indigo-900 text-sm">
                    ₹{threeExpensesBreakdown.investmentCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="pl-3 border-l-2 border-purple-300 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <ShoppingCart className="w-3.5 h-3.5 text-blue-500" />
                      1. Material Supply (Cat 2):
                    </span>
                    <span className="font-bold text-slate-800">
                      ₹{threeExpensesBreakdown.materialSupply.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-teal-500" />
                      2. Site Supply to Labour (Cat 3):
                    </span>
                    <span className="font-bold text-slate-800">
                      ₹{threeExpensesBreakdown.siteSupply.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-rose-500" />
                      3. Labour Attendance / Wages (Cat 4):
                    </span>
                    <span className="font-bold text-slate-800">
                      ₹{threeExpensesBreakdown.labourAttendance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-200 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">Total Site Expenditure:</span>
                  <span className="font-black text-slate-900 text-sm">
                    ₹{threeExpensesBreakdown.totalSiteExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Variance Indicator */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                threeExpensesBreakdown.investmentStatus === "MATCHED"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : threeExpensesBreakdown.investmentStatus === "SURPLUS"
                  ? "bg-blue-50 border-blue-200 text-blue-900"
                  : "bg-rose-50 border-rose-200 text-rose-900"
              }`}>
                <div>
                  <span className="text-xs font-bold block">
                    {threeExpensesBreakdown.investmentStatus === "MATCHED"
                      ? "Exact Balanced Match"
                      : threeExpensesBreakdown.investmentStatus === "SURPLUS"
                      ? "Unspent Available Capital"
                      : "Capital Shortfall / Deficit"}
                  </span>
                  <span className="text-[11px] opacity-80">
                    {threeExpensesBreakdown.investmentStatus === "MATCHED"
                      ? "Investment Capital and site expenditure are 100% balanced (Difference: ₹0)"
                      : threeExpensesBreakdown.investmentStatus === "SURPLUS"
                      ? `₹${threeExpensesBreakdown.investmentVariance.toLocaleString('en-IN')} unspent capital available beyond site expenses`
                      : `₹${Math.abs(threeExpensesBreakdown.investmentVariance).toLocaleString('en-IN')} additional capital needed for site expenses`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black block">
                    {threeExpensesBreakdown.investmentVariance >= 0 ? "+" : ""}
                    ₹{threeExpensesBreakdown.investmentVariance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* MATRIX 2: (SITE SUPPLY + LABOUR ATTENDANCE) vs CONTRACTOR COST */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md">
                    Matching Rule 2
                  </span>
                  <h4 className="text-base font-black text-slate-900 mt-2 flex items-center gap-2">
                    <HardHat className="w-5 h-5 text-amber-600" />
                    Reconcile (Site Supply + Labour) vs Contractor Cost
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    (Site Supply + Labour Attendance) Combined Total MUST match Contractor Cost Total
                  </p>
                </div>

                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-xs font-black inline-flex items-center gap-1 ${
                    threeExpensesBreakdown.contractorStatus === "MATCHED"
                      ? "bg-emerald-100 text-emerald-800"
                      : threeExpensesBreakdown.contractorStatus === "SURPLUS"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {threeExpensesBreakdown.contractorStatus === "MATCHED" ? (
                      <>✓ Balanced & Matched</>
                    ) : threeExpensesBreakdown.contractorStatus === "SURPLUS" ? (
                      <>+ Surplus Recorded</>
                    ) : (
                      <>⚠ Entry Pending</>
                    )}
                  </span>
                </div>
              </div>

              {/* Formula Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Truck className="w-3.5 h-3.5 text-teal-600" />
                      Site Supply (Cat 3):
                    </span>
                    <span className="font-bold text-slate-800">
                      ₹{threeExpensesBreakdown.siteSupply.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-600">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Users className="w-3.5 h-3.5 text-rose-600" />
                      Labour Attendance & Salary (Cat 4):
                    </span>
                    <span className="font-bold text-slate-800">
                      ₹{threeExpensesBreakdown.labourAttendance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-200 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">Expected Contractor Cost:</span>
                  <span className="font-black text-amber-900 text-sm">
                    ₹{threeExpensesBreakdown.expectedContractorCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="pt-2.5 border-t border-slate-200 flex justify-between items-center text-xs">
                  <span className="font-bold text-purple-900">Recorded Contractor Cost (Cat 5):</span>
                  <span className="font-black text-purple-900 text-sm">
                    ₹{threeExpensesBreakdown.recordedContractorCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Variance Indicator */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                threeExpensesBreakdown.contractorStatus === "MATCHED"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : threeExpensesBreakdown.contractorStatus === "SURPLUS"
                  ? "bg-blue-50 border-blue-200 text-blue-900"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}>
                <div>
                  <span className="text-xs font-bold block">
                    {threeExpensesBreakdown.contractorStatus === "MATCHED"
                      ? "100% Reconciled"
                      : threeExpensesBreakdown.contractorStatus === "SURPLUS"
                      ? "Surplus Recorded"
                      : "Pending Contractor Cost"}
                  </span>
                  <span className="text-[11px] opacity-80">
                    {threeExpensesBreakdown.contractorStatus === "MATCHED"
                      ? "Site supply + labour attendance matches recorded contractor cost (Difference: ₹0)"
                      : threeExpensesBreakdown.contractorStatus === "SURPLUS"
                      ? `₹${threeExpensesBreakdown.contractorVariance.toLocaleString('en-IN')} recorded above expected cost`
                      : `₹${Math.abs(threeExpensesBreakdown.contractorVariance).toLocaleString('en-IN')} pending entry in Cat 5 to reconcile`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black block">
                    {threeExpensesBreakdown.contractorVariance >= 0 ? "+" : ""}
                    ₹{threeExpensesBreakdown.contractorVariance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {threeExpensesBreakdown.contractorCount} records in Cat 5
                  </div>
                </div>
              </div>
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
                Live Operational Deductions Passbook (Site Supply, Labour & Security Deposits)
              </h3>
              <p className="text-xs text-rose-700">
                All transactions across Site Supplies, Labour Wages/Upad, and Refundable Deposits that reduce this project's Investment Capital.
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
                { key: "CAT5_SITE", label: "Cat 5 Site Supplies" },
                { key: "CAT6_LABOUR", label: "Cat 6 Labour & Kharch" },
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
                    <th className="p-3.5">Party / Team / Vendor</th>
                    <th className="p-3.5">Item Particulars / Notes</th>
                    <th className="p-3.5">Ref / Invoice No.</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right font-bold text-rose-700">Deduction (-₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itemizedDeductionsList.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3.5 text-slate-600 font-medium">{formatDate(item.date)}</td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                          item.categoryKey === "CAT3_PURCHASE" ? "bg-purple-100 text-purple-800 border border-purple-200" :
                          item.categoryKey === "CAT4_SUPPLY" ? "bg-blue-100 text-blue-800 border border-blue-200" :
                          item.categoryKey === "CAT5_SITE" ? "bg-teal-100 text-teal-800 border border-teal-200" :
                          "bg-rose-100 text-rose-800 border border-rose-200"
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
                        <div className="text-[10px] text-slate-400">{formatDate(tx.date)} &bull; {tx.paymentMethod}</div>
                      </div>
                      <span className="font-black text-emerald-600">+₹{formatINR(tx.amount)}</span>
                    </div>
                  ))}
                  {capitalInflowTxs.length === 0 && (
                    <div className="py-6 text-center text-slate-400 text-xs">No capital investments recorded yet.</div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-bold text-emerald-800">
                <span>Total Investor Capital:</span>
                <span>₹{formatINR(totalInvestorCapital)}</span>
              </div>
            </div>

            {/* Investor Payments / Upad Preview */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <ArrowDownLeft className="w-4 h-4 text-amber-600" />
                    Recent Investor Upad / Returns
                  </h3>
                  <button
                    onClick={() => setActiveSubTab("investor_payments")}
                    className="text-xs text-amber-600 font-bold hover:underline"
                  >
                    View All &rarr;
                  </button>
                </div>

                <div className="divide-y divide-slate-100 mt-2">
                  {investorPaymentTxs.slice(0, 5).map(tx => (
                    <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{tx.partyName}</span>
                        <div className="text-[10px] text-slate-400">{formatDate(tx.date)} &bull; {tx.paymentMethod}</div>
                      </div>
                      <span className="font-black text-amber-600">-₹{formatINR(tx.amount)}</span>
                    </div>
                  ))}
                  {investorPaymentTxs.length === 0 && (
                    <div className="py-6 text-center text-slate-400 text-xs">No investor payments recorded yet.</div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-bold text-amber-800">
                <span>Total Investor Upad:</span>
                <span>₹{totalInvestorPayments.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 1: PASSBOOK LEDGER */}
      {activeSubTab === "notebook_hisab" && (
        <div className="space-y-4">
          {/* Notebook Header */}
          <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 p-6 rounded-3xl text-white shadow-xl border border-amber-800/40">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                  <span>Investment Capital & Site Expenses Passbook</span>
                </div>
                <h3 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>Investment Capital & Site Expenses Ledger</span>
                </h3>
                <p className="text-xs text-amber-200/80 mt-1 max-w-2xl font-medium">
                  Complete record of capital inflows (+ Investor Capital) and site expenditure outflows (- Site Supplies, Labour, Other Expenses, and Upad).
                </p>
              </div>

              {/* Action Buttons in Notebook */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
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
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add Investor Capital</span>
                </button>

                <button
                  type="button"
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
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>- Record Upad Payment</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics in Notebook */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-white/10">
              <div className="bg-white/10 p-3.5 rounded-2xl border border-white/15">
                <span className="text-[10px] uppercase font-bold text-emerald-300 block">Total Capital Inflows</span>
                <span className="text-xl font-black text-emerald-400 tabular-nums">
                  +₹{fullCapital.toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-white/60 block mt-0.5">Investor Capital Allocated</span>
              </div>

              <div className="bg-white/10 p-3.5 rounded-2xl border border-white/15">
                <span className="text-[10px] uppercase font-bold text-rose-300 block">Total Site Outflows</span>
                <span className="text-xl font-black text-rose-300 tabular-nums">
                  -₹{(totalDeductions + totalInvestorPayments).toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-white/60 block mt-0.5">Supplies, Labour, Other Expenses & Upad</span>
              </div>

              <div className="bg-white/10 p-3.5 rounded-2xl border border-white/15">
                <span className="text-[10px] uppercase font-bold text-cyan-300 block">Net Balance</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xl font-black tabular-nums ${netRemainingCapital < 0 ? "text-rose-400" : "text-white"}`}>
                    ₹{netRemainingCapital.toLocaleString("en-IN")}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    netRemainingCapital >= 0 ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/30 text-rose-200 border border-rose-500/50"
                  }`}>
                    {netRemainingCapital >= 0 ? "Surplus" : "Deficit"}
                  </span>
                </div>
                <span className="text-[10px] text-white/60 block mt-0.5">Available capital after all expenses</span>
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
                All Entries ({investmentNotebookEntries.length})
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
                <span>Capital Inflows (+ INFLOWS)</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                  {investmentNotebookEntries.filter(e => e.type === "ADDED").length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setNotebookFilter("REMOVED")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  notebookFilter === "REMOVED"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200"
                }`}
              >
                <span>Site Expenses (- EXPENSES)</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                  {investmentNotebookEntries.filter(e => e.type === "REMOVED").length}
                </span>
              </button>

              {/* Category Filter */}
              <select
                value={notebookCategoryFilter}
                onChange={(e) => setNotebookCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                <option value="INVESTOR_CAPITAL">Investor Capital</option>
                <option value="CAT5_SUPPLY">Site Supplies</option>
                <option value="CAT6_LABOUR">Labour & Other Expenses</option>
                <option value="INVESTOR_UPAD">Investor Upad</option>
              </select>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by party, expense, other kharch, ref..."
                value={notebookSearch}
                onChange={(e) => setNotebookSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
          </div>

          {/* Traditional Notebook Paper Table */}
          <div className="bg-amber-50/20 rounded-2xl border-2 border-amber-200/90 shadow-sm overflow-hidden">
            <div className="p-3 bg-amber-100/70 border-b border-amber-200/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="font-black text-amber-950 uppercase tracking-wider">Investment Capital & Site Operations Ledger</span>
              </div>
              <span className="text-amber-900 font-bold">{filteredInvestmentNotebook.length} Records</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-amber-50 text-amber-900 font-bold border-b border-amber-200">
                  <tr>
                    <th className="p-3.5 whitespace-nowrap">Date</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Party / Team / Particulars</th>
                    <th className="p-3.5 text-center">Payment & Ref</th>
                    <th className="p-3.5 text-right font-black text-emerald-800">Capital Inflow (+ JAMA)</th>
                    <th className="p-3.5 text-right font-black text-rose-800">Site Expense (- UDHAR)</th>
                    <th className="p-3.5 text-right font-black text-slate-900">Remaining Balance</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 bg-white">
                  {filteredInvestmentNotebook.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-400">
                        {notebookSearch ? "No matching entries found." : "No investment entries found."}
                      </td>
                    </tr>
                  ) : (
                    filteredInvestmentNotebook.map((entry) => {
                      const isOtherKharch = (entry.categoryLabel || "").toLowerCase().includes("other kharch") || (entry.particulars || "").toLowerCase().includes("kharch");

                      return (
                        <tr key={entry.id} className="hover:bg-amber-50/40 transition-colors">
                          <td className="p-3.5 font-medium text-slate-600 whitespace-nowrap">
                            {formatDate(entry.date)}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase inline-flex items-center gap-1 ${
                              entry.kind === 'INVESTOR_CAPITAL'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : entry.kind === 'BILL_INVESTMENT'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : entry.kind === 'UPAD'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : isOtherKharch
                                ? 'bg-rose-100 text-rose-900 border border-rose-300 font-extrabold'
                                : 'bg-slate-100 text-slate-700 border border-slate-300'
                            }`}>
                              {isOtherKharch && <span>☕</span>}
                              {entry.categoryLabel}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-800 max-w-sm">
                            <div className="font-bold text-slate-900">{entry.partyName}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{entry.particulars}</div>
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
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
                          <td className="p-3.5 text-right font-black text-rose-700 tabular-nums text-sm">
                            {entry.udhar > 0 ? `-₹${entry.udhar.toLocaleString("en-IN")}` : <span className="text-slate-300 font-normal">—</span>}
                          </td>
                          <td className={`p-3.5 text-right font-black tabular-nums text-sm bg-amber-50/30 ${
                            entry.runningBalance < 0 ? "text-rose-700" : "text-slate-900"
                          }`}>
                            ₹{entry.runningBalance.toLocaleString("en-IN")}
                          </td>
                          <td className="p-3.5 text-center">
                            {entry.kind === 'INVESTOR_CAPITAL' ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const origTx = investorTxs.find(t => t.id === entry.rawId);
                                    if (!origTx) return;
                                    setEditingTxId(origTx.id);
                                    setCapitalFormData({
                                      partyId: String(origTx.partyId || ""),
                                      amount: String(origTx.amount || entry.amount || ""),
                                      type: origTx.type === "CONTRIBUTION" ? "CONTRIBUTION" : "INVESTMENT",
                                      date: origTx.date || new Date().toISOString().split("T")[0],
                                      paymentMethod: origTx.paymentMethod || "Bank Transfer",
                                      referenceNumber: origTx.referenceNumber || "",
                                      description: origTx.description || "",
                                    });
                                    setIsCapitalModalOpen(true);
                                  }}
                                  className="p-1 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded transition-colors cursor-pointer"
                                  title="Edit Investment Transaction"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTx(entry.rawId)}
                                  className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                  title="Delete Investment Transaction"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : entry.kind === 'BILL_INVESTMENT' ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const origBill = billIncomes.find(b => b.id === entry.rawId);
                                    if (origBill) openEditBill(origBill);
                                  }}
                                  className="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded transition-colors cursor-pointer"
                                  title="Edit Bill Investment"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBill(entry.rawId)}
                                  className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                  title="Delete Bill Investment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : entry.kind === 'UPAD' ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const origTx = investorTxs.find(t => t.id === entry.rawId);
                                    if (!origTx) return;
                                    setEditingTxId(origTx.id);
                                    setPaymentFormData({
                                      partyId: String(origTx.partyId || ""),
                                      amount: String(origTx.amount || entry.amount || ""),
                                      date: origTx.date || new Date().toISOString().split("T")[0],
                                      paymentMethod: origTx.paymentMethod || "Bank Transfer",
                                      referenceNumber: origTx.referenceNumber || "",
                                      description: origTx.description || "",
                                    });
                                    setIsPaymentModalOpen(true);
                                  }}
                                  className="p-1 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded transition-colors cursor-pointer"
                                  title="Edit Upad / Return"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTx(entry.rawId)}
                                  className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                  title="Delete Upad / Return"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-300 text-[10px]">—</span>
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

      {/* SUBTAB 2: INVESTOR CAPITAL INFLOW */}
      {activeSubTab === "investor_capital" && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h3 className="font-black text-emerald-900 text-sm flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-700" />
                Investment Capital from Investor Capital Register
              </h3>
              <p className="text-xs text-emerald-700">
                Capital allocated from Category 7 (Investor Capital) directly to this project site.
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
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> + Add Investment Capital from Investor Capital
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Investor Name</th>
                    <th className="p-3.5">Project / Location</th>
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
                      <td className="p-3.5 text-slate-600 font-medium">{formatDate(tx.date)}</td>
                      <td className="p-3.5 font-bold text-slate-900">{tx.partyName}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded text-[10px] font-bold flex items-center gap-1 w-fit">
                          <Building2 className="w-2.5 h-2.5 text-emerald-600" />
                          {tx.locationName || "Project Site"}
                        </span>
                      </td>
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
                Bill Investment & Invoices
              </h3>
              <p className="text-xs text-blue-700">Detailed bill investments with GST, transport, and discounts.</p>
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
                    <th className="p-3.5">Party / Customer / Company</th>
                    <th className="p-3.5">Bill Details / Notes</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Subtotal</th>
                    <th className="p-3.5 text-right">GST (-)</th>
                    <th className="p-3.5 text-right">TDS (-) / Transport (+)</th>
                    <th className="p-3.5 text-right font-bold text-blue-700">Net Total (₹)</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {billIncomes.map(bill => {
                    const sub = Number(bill.subtotal || (Number(bill.quantity || 0) * Number(bill.rate || 0)));
                    const taxAmt = Number(bill.taxAmount || 0);
                    const tdsBase = Number(bill.tdsBaseAmount !== undefined ? bill.tdsBaseAmount : Math.max(0, sub - taxAmt));
                    const tdsPct = Number(bill.tdsPercentage || 0);
                    const tdsAmt = Number(bill.tdsAmount !== undefined ? bill.tdsAmount : (tdsBase * tdsPct / 100));
                    return (
                    <tr key={bill.id} className="hover:bg-slate-50">
                      <td className="p-3.5 text-slate-600 font-medium">{formatDate(bill.date)}</td>
                      <td className="p-3.5 font-bold text-slate-900">{bill.partyName || "-"}</td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-800">
                          Bill Amount: ₹{formatINR(bill.rate || bill.subtotal || bill.amount || 0)}
                        </div>
                        {bill.notes && <div className="text-[10px] text-slate-500 truncate max-w-[180px]">{bill.notes}</div>}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          bill.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {bill.paymentStatus || 'PAID'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right text-slate-700 font-medium">₹{sub.toLocaleString()}</td>
                      <td className="p-3.5 text-right text-rose-600 font-semibold text-[11px]">
                        -{bill.taxPercentage || 0}% (-₹{taxAmt.toLocaleString()})
                      </td>
                      <td className="p-3.5 text-right text-slate-600 text-[11px]">
                        <span className="text-rose-600 font-semibold">-{tdsPct}% (-₹{tdsAmt.toLocaleString()})</span>
                        {Number(bill.transportCost || 0) > 0 && (
                          <span className="text-emerald-700 ml-1">/ +₹{Number(bill.transportCost || 0).toLocaleString()}</span>
                        )}
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
                  );
                  })}
                  {billIncomes.length === 0 && (
                    <tr><td colSpan={9} className="p-8 text-center text-slate-500">No bill investments recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {billIncomes.length > 0 && (
              <div className="p-4 bg-blue-50/50 border-t border-blue-100 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
                <span className="font-bold text-blue-900">Total Bill Investments ({billIncomes.length} records):</span>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-slate-700 font-bold bg-blue-100/80 px-2.5 py-1 rounded-md border border-blue-200">
                    Total GST (-): <strong className="text-rose-700 font-black">₹{totalBillGst.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong>
                  </span>
                  <span className="text-slate-700 font-bold bg-blue-100/80 px-2.5 py-1 rounded-md border border-blue-200">
                    Total TDS (-): <strong className="text-rose-700 font-black">₹{totalBillTds.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong>
                  </span>
                  <span className="text-base font-black text-blue-800">Total Amount: ₹{totalBillInvestments.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 4: REFUNDABLE RECORDS */}
      {activeSubTab === "refundable_records" && (
        <div className="space-y-4">
          {/* Header Action Bar */}
          <div className="bg-purple-50 border border-purple-200 p-5 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h3 className="font-black text-purple-950 text-base flex items-center gap-2">
                <Receipt className="w-5 h-5 text-purple-700" />
                Refundable Records & Security Deposits
              </h3>
              <p className="text-xs text-purple-800 mt-0.5">
                Security deposits, advances, and refundable items. These are temporarily deducted from Project Capital (Category 2 Investment) and added back when refunded.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadExcelReport(`/reports/export-refundable-records?locationId=${locationId}`, `Refundable_Records_Location_${locationId}.xlsx`)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-purple-300 text-purple-900 hover:bg-purple-100 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                title="Download Refundable Records Excel"
              >
                <Download className="w-4 h-4 text-purple-700" /> Export Excel (.xlsx)
              </button>

              <button
                onClick={() => {
                  setEditingRefundableId(null);
                  setRefundableFormData({
                    partyName: "",
                    amount: "",
                    depositType: "Security Deposit",
                    date: new Date().toISOString().split("T")[0],
                    paymentMethod: "Bank Transfer",
                    referenceNumber: "",
                    notes: "",
                  });
                  setIsRefundableModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" /> + Add Refundable Record
              </button>
            </div>
          </div>

          {/* 3 Metrics Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-white border border-purple-200 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] uppercase tracking-wider font-bold text-purple-700 block">Total Refundable Paid</span>
              <div className="text-2xl font-black text-purple-950 mt-1">₹{refundableSummary.totalRefundable.toLocaleString()}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">{refundableRecords.length} records deposited</p>
            </div>

            <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-700 block">Total Refund Received</span>
              <div className="text-2xl font-black text-emerald-700 mt-1">₹{refundableSummary.totalRefunded.toLocaleString()}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Returned back to project</p>
            </div>

            <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] uppercase tracking-wider font-bold text-amber-100 block">Pending Refund</span>
              <div className="text-2xl font-black text-white mt-1">₹{refundableSummary.pendingRefundable.toLocaleString()}</div>
              <p className="text-[11px] text-amber-100 mt-0.5">Currently deducted from Category 2 Capital</p>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search party, deposit type, notes..."
                value={refundableSearch}
                onChange={e => setRefundableSearch(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={refundableFilter}
                onChange={e => setRefundableFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="ALL">All Statuses ({safeRefundableRecords.length})</option>
                <option value="PENDING">Pending</option>
                <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
                <option value="REFUNDED">Fully Refunded</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Party / Beneficiary</th>
                    <th className="p-3.5">Deposit Type</th>
                    <th className="p-3.5">Payment Method / Ref</th>
                    <th className="p-3.5 text-right font-bold text-slate-900">Total Amount (₹)</th>
                    <th className="p-3.5 text-right font-bold text-emerald-700">Refunded (₹)</th>
                    <th className="p-3.5 text-right font-black text-amber-700">Pending Balance (₹)</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRefundables.map(rec => {
                    const totalAmt = Number(rec.amount || 0);
                    const refAmt = Number(rec.refundedAmount || 0);
                    const pendAmt = Math.max(0, totalAmt - refAmt);

                    return (
                      <tr key={rec.id} className="hover:bg-purple-50/30 transition-colors">
                        <td className="p-3.5 text-slate-600 font-medium">{formatDate(rec.date)}</td>
                        <td className="p-3.5 font-bold text-slate-900">
                          <div>{rec.partyName}</div>
                          {rec.notes && <div className="text-[10px] text-slate-400 font-normal truncate max-w-xs">{rec.notes}</div>}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-semibold text-[11px]">
                            {rec.depositType || "Deposit"}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-600">
                          <div>{rec.paymentMethod || "Bank Transfer"}</div>
                          {rec.referenceNumber && <div className="text-[10px] font-mono text-slate-400">{rec.referenceNumber}</div>}
                        </td>
                        <td className="p-3.5 text-right font-bold text-slate-900 text-sm">
                          ₹{totalAmt.toLocaleString()}
                        </td>
                        <td className="p-3.5 text-right font-bold text-emerald-700 text-sm">
                          ₹{refAmt.toLocaleString()}
                        </td>
                        <td className="p-3.5 text-right font-black text-amber-700 text-sm">
                          ₹{pendAmt.toLocaleString()}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            rec.refundStatus === "REFUNDED"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : rec.refundStatus === "PARTIALLY_REFUNDED"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : "bg-amber-100 text-amber-900 border border-amber-200"
                          }`}>
                            {rec.refundStatus === "REFUNDED" ? "Refunded" : rec.refundStatus === "PARTIALLY_REFUNDED" ? "Partial" : "Pending"}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {rec.refundStatus !== "REFUNDED" && (
                              <button
                                onClick={() => {
                                  setActiveRefundRecord(rec);
                                  setRefundActionData({
                                    refundedAmount: String(pendAmt),
                                    refundDate: new Date().toISOString().split("T")[0],
                                    refundNotes: "",
                                  });
                                  setIsRefundModalOpen(true);
                                }}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-xs cursor-pointer"
                                title="Record Refund Received"
                              >
                                Record Refund
                              </button>
                            )}
                            <button
                              onClick={() => openEditRefundable(rec)}
                              className="text-slate-400 hover:text-purple-600 p-1 cursor-pointer"
                              title="Edit Record"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRefundable(rec.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRefundables.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        No refundable records found. Click "+ Add Refundable Record" to register security deposits or advances.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {safeRefundableRecords.length > 0 && (
              <div className="p-4 bg-purple-50/50 border-t border-purple-100 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs gap-2">
                <span className="font-bold text-purple-900">
                  Total Records: {safeRefundableRecords.length} &bull; Total Deposited: ₹{refundableSummary.totalRefundable.toLocaleString()}
                </span>
                <span className="text-sm font-black text-amber-800">
                  Total Pending to Receive: ₹{refundableSummary.pendingRefundable.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 5: INVESTOR PAYMENTS / UPAD */}
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
                      <td className="p-3.5 text-slate-600 font-medium">{formatDate(tx.date)}</td>
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

      {/* MODAL: Record Investment Capital from Investor Capital */}
      <Modal
        isOpen={isCapitalModalOpen}
        onClose={() => setIsCapitalModalOpen(false)}
        maxWidth="xl"
        title={
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg"><Building2 className="w-5 h-5" /></div>
            <div>
              <span className="font-black text-slate-900 text-base">
                {editingTxId ? "Edit Investment Record" : "Add Investment Capital from Investor Capital"}
              </span>
              <p className="text-xs text-slate-500 font-normal">
                This amount will be deducted from Investor Capital (Cat 7) and credited to Location Investment Capital (Cat 1)
              </p>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSaveCapital} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Investor *</label>
            <select
              required
              value={capitalFormData.partyId}
              onChange={e => setCapitalFormData({ ...capitalFormData, partyId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Choose Investor --</option>
              {(Array.isArray(parties) ? parties : []).map(p => {
                const rawCat7Bal = Number(p?.cat7Available ?? p?.balance ?? 0);
                const editingOrigTx = editingTxId ? investorTxs.find(t => t.id === editingTxId) : null;
                const oldTxAmt =
                  editingOrigTx &&
                  editingOrigTx.type === "INVESTMENT" &&
                  String(editingOrigTx.partyId) === String(p?.id)
                    ? Number(editingOrigTx.amount || 0) || 0
                    : 0;
                const cat7Bal = Math.round((rawCat7Bal + oldTxAmt) * 100) / 100;
                return (
                  <option key={p?.id || Math.random()} value={p?.id ? String(p.id) : ""}>
                    {p?.partyName || "Investor"} (Category 7 Investor Capital: ₹{cat7Bal.toLocaleString("en-IN")})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Live Deduction & Addition Preview */}
          {(() => {
            const partyList = Array.isArray(parties) ? parties : [];
            const selectedParty = partyList.find(p => p && String(p.id) === capitalFormData.partyId);
            const rawCurrentBal = selectedParty ? Number(selectedParty.cat7Available ?? selectedParty.balance ?? 0) : 0;
            const editingOrigTx = editingTxId ? investorTxs.find(t => t.id === editingTxId) : null;
            const oldTxAmt =
              editingOrigTx &&
              editingOrigTx.type === "INVESTMENT" &&
              String(editingOrigTx.partyId) === String(capitalFormData.partyId)
                ? Number(editingOrigTx.amount || 0) || 0
                : 0;
            const currentBal = Math.round((rawCurrentBal + oldTxAmt) * 100) / 100;
            const enteredAmt = parseFloat(capitalFormData.amount) || 0;
            const newBal = Math.round((currentBal - enteredAmt) * 100) / 100;
            const isExceeded = enteredAmt > currentBal;

            return (
              <div className={`p-3.5 border rounded-xl space-y-2.5 transition-colors ${
                isExceeded ? "bg-rose-50/90 border-rose-300" : "bg-emerald-50/90 border-emerald-200"
              }`}>
                <div className="font-bold flex items-center justify-between text-xs">
                  <span className={`flex items-center gap-1.5 ${isExceeded ? "text-rose-900" : "text-emerald-900"}`}>
                    <Building2 className={`w-3.5 h-3.5 ${isExceeded ? "text-rose-600" : "text-emerald-600"}`} />
                    Investor Capital ➔ Investment Capital Flow Rule
                  </span>
                  <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded ${
                    isExceeded ? "bg-rose-200 text-rose-900" : "bg-emerald-200/80 text-emerald-900"
                  }`}>
                    Cat 7 (Investor Capital) &rarr; Cat 1 (Investment Capital)
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-xs">
                  <div className="bg-white/95 p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Category 7 Investor Capital
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-slate-700 font-bold">₹{currentBal.toLocaleString("en-IN")}</span>
                      {enteredAmt > 0 && (
                        <>
                          <span className="text-rose-600 font-black text-[11px]">- ₹{enteredAmt.toLocaleString("en-IN")}</span>
                          <span className={`font-black ml-auto ${isExceeded ? "text-rose-600" : "text-slate-900"}`}>
                            = ₹{newBal.toLocaleString("en-IN")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="bg-white/95 p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Category 1 Investment Capital
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-emerald-700 font-bold">+ ₹{enteredAmt.toLocaleString("en-IN")}</span>
                      <span className="text-[10px] text-slate-500 ml-auto">Added to Project</span>
                    </div>
                  </div>
                </div>

                {isExceeded ? (
                  <div className="p-2 bg-rose-100/80 border border-rose-300 rounded-lg text-rose-800 text-[11px] font-semibold flex items-center justify-between">
                    <span>
                      ⚠️ Entered amount exceeds Category 7 Investor Capital! (Max available: ₹{currentBal.toLocaleString("en-IN")})
                    </span>
                    {currentBal > 0 && (
                      <button
                        type="button"
                        onClick={() => setCapitalFormData({ ...capitalFormData, amount: currentBal.toString() })}
                        className="px-2 py-0.5 bg-rose-700 text-white rounded text-[10px] font-bold hover:bg-rose-800 shrink-0 ml-2 cursor-pointer"
                      >
                        Use Max (₹{currentBal.toLocaleString("en-IN")})
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-emerald-900 font-medium">
                    <span>This amount will be deducted from Category 7 Investor Capital and credited to Category 1 Investment Capital.</span>
                    {currentBal > 0 && enteredAmt !== currentBal && (
                      <button
                        type="button"
                        onClick={() => setCapitalFormData({ ...capitalFormData, amount: currentBal.toString() })}
                        className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold hover:bg-emerald-700 shrink-0 ml-2 cursor-pointer"
                      >
                        Use Max (₹{currentBal.toLocaleString("en-IN")})
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Investment Date *</label>
              <DateInput
                required
                value={capitalFormData.date}
                onChange={e => setCapitalFormData({ ...capitalFormData, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Investment Amount (₹) *</label>
                {(() => {
                  const selectedParty = parties.find(p => p.id.toString() === capitalFormData.partyId);
                  const rawBal = selectedParty ? Number(selectedParty.cat7Available ?? selectedParty.balance ?? 0) : 0;
                  const editingOrigTx = editingTxId ? investorTxs.find(t => t.id === editingTxId) : null;
                  const oldTxAmt =
                    editingOrigTx &&
                    editingOrigTx.type === "INVESTMENT" &&
                    String(editingOrigTx.partyId) === String(capitalFormData.partyId)
                      ? Number(editingOrigTx.amount || 0) || 0
                      : 0;
                  const bal = Math.round((rawBal + oldTxAmt) * 100) / 100;
                  return bal > 0 ? (
                    <button
                      type="button"
                      onClick={() => setCapitalFormData({ ...capitalFormData, amount: bal.toString() })}
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 cursor-pointer"
                    >
                      Max: ₹{bal.toLocaleString("en-IN")}
                    </button>
                  ) : null;
                })()}
              </div>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={capitalFormData.amount}
                onChange={e => setCapitalFormData({ ...capitalFormData, amount: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-emerald-900"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
              placeholder="e.g. Investment for site foundation & materials (from Investor Capital)..."
            />
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg shadow-md transition-colors text-sm cursor-pointer"
          >
            {editingTxId ? "Update Investment Record" : "Save & Deduct from Investor Capital"}
          </button>
        </form>
      </Modal>

      {/* MODAL: Record Investor Payment / Upad (OUT) */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        maxWidth="xl"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Date *</label>
              <DateInput
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
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-amber-800 font-mono"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

      {/* MODAL: Add / Edit Bill Investment */}
      <Modal
        isOpen={isBillModalOpen}
        onClose={() => setIsBillModalOpen(false)}
        maxWidth="2xl"
        title={
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-800 rounded-lg"><FileText className="w-5 h-5" /></div>
            <div>
              <span className="font-black text-slate-900 text-base">{editingBillId ? "Edit Bill Investment" : "Add Bill Investment"}</span>
              <p className="text-xs text-slate-500 font-normal">Party / Company invoice and billing based investment record</p>
            </div>
          </div>
        }
      >
        <form onSubmit={handleCreateBill} className="space-y-4">
          {/* 1. Date & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">1. Bill Date *</label>
              <DateInput
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
            <label className="block text-xs font-bold text-slate-700 mb-1">3. Party / Customer / Company Name *</label>
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
                placeholder="Enter party / customer / company name"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium"
              />
            </div>
          </div>

          {/* 3. Bill Amount */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">4. Bill Amount (₹) *</label>
            <input
              type="number"
              step="any"
              required
              value={billData.rate}
              onChange={e => setBillData({ ...billData, rate: e.target.value })}
              placeholder="0.00"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900"
            />
          </div>

          {/* 4. Transport, GST & TDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">5. Transport Fee (₹) (+)</label>
              <input
                type="number"
                step="any"
                value={billData.transportCost}
                onChange={e => setBillData({ ...billData, transportCost: e.target.value })}
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
              <span className="text-[10px] text-slate-500">Added separately to total</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">6. Tax / GST (%) (-)</label>
              <select
                value={billData.taxPercentage}
                onChange={e => setBillData({ ...billData, taxPercentage: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                {GST_PRESETS.map(g => (
                  <option key={g} value={g}>{g}% GST</option>
                ))}
              </select>
              <span className="text-[10px] text-slate-500">Deducted from Bill Subtotal</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">7. TDS (%) (-)</label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  value={billData.tdsPercentage}
                  onChange={e => setBillData({ ...billData, tdsPercentage: e.target.value })}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm font-semibold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
              </div>
              <span className="text-[10px] text-slate-500">Applied on (Subtotal - GST)</span>
            </div>
          </div>

          {/* Live Calculation Preview Box */}
          <div className="bg-slate-900 text-white rounded-xl p-3.5 sm:p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3 min-w-0 text-slate-300">
              <span className="shrink">Bill Subtotal:</span>
              <span className="shrink-0 font-mono font-bold tabular-nums">₹{formatINR(billCalc.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 min-w-0 text-rose-400">
              <span className="shrink">GST ({billData.taxPercentage || 0}% on Bill Subtotal) (-):</span>
              <span className="shrink-0 font-mono font-bold tabular-nums">-₹{formatINR(billCalc.taxAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 min-w-0 text-slate-200 font-semibold border-t border-slate-800 pt-1.5">
              <span className="shrink">Base Amount of TDS (Bill Subtotal - GST):</span>
              <span className="shrink-0 font-mono font-bold tabular-nums">₹{formatINR(billCalc.tdsBaseAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 min-w-0 text-rose-400">
              <span className="shrink">TDS ({billData.tdsPercentage || 0}% on Base Amount of TDS) (-):</span>
              <span className="shrink-0 font-mono font-bold tabular-nums">-₹{formatINR(billCalc.tdsAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 min-w-0 text-slate-300 border-t border-slate-800 pt-1.5">
              <span className="shrink">Amount After TDS (Base Amount of TDS - TDS):</span>
              <span className="shrink-0 font-mono font-bold tabular-nums">₹{formatINR(billCalc.afterTdsAmount)}</span>
            </div>
            {billCalc.transport > 0 && (
              <div className="flex items-center justify-between gap-3 min-w-0 text-amber-300">
                <span className="shrink">Transport Fee (Added separately) (+):</span>
                <span className="shrink-0 font-mono font-bold tabular-nums">+₹{formatINR(billCalc.transport)}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 min-w-0 text-base font-black text-emerald-400 pt-2 border-t border-slate-800">
              <span className="shrink">Net Total Amount:</span>
              <span className="shrink-0 font-mono font-bold tabular-nums text-lg">₹{formatINR(billCalc.netTotal)}</span>
            </div>
          </div>

          {/* Payment Method & Ref */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">8. Payment Method</label>
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
              <label className="block text-xs font-bold text-slate-700 mb-1">9. Ref / Cheque No.</label>
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
            <label className="block text-xs font-bold text-slate-700 mb-1">10. Notes / Remarks</label>
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

      {/* MODAL: Add / Edit Refundable Record (Security Deposit & Advances) */}
      <Modal
        isOpen={isRefundableModalOpen}
        onClose={() => {
          setIsRefundableModalOpen(false);
          setEditingRefundableId(null);
        }}
        maxWidth="2xl"
        title={
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 text-purple-800 rounded-lg"><Receipt className="w-5 h-5" /></div>
            <div>
              <span className="font-black text-slate-900 text-base">
                {editingRefundableId ? "Edit Refundable Record" : "Add Refundable Record"}
              </span>
              <p className="text-xs text-slate-500 font-normal">
                This amount is deducted from Project Capital and will be credited back when refunded.
              </p>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSaveRefundable} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Party / Company / Beneficiary Name *</label>
            <input
              type="text"
              required
              value={refundableFormData.partyName}
              onChange={e => setRefundableFormData({ ...refundableFormData, partyName: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
              placeholder="e.g. Torrent Power, MGVCL, Cylinder Security, Landlord Advance"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Deposit Type</label>
              <select
                value={refundableFormData.depositType}
                onChange={e => setRefundableFormData({ ...refundableFormData, depositType: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
              >
                <option value="Security Deposit">Security Deposit</option>
                <option value="Electricity / Meter Deposit">Electricity / Meter Deposit</option>
                <option value="Gas / Cylinder Deposit">Gas / Cylinder Deposit</option>
                <option value="Rent Advance Deposit">Rent Advance Deposit</option>
                <option value="Tender / EMD Deposit">Tender / EMD Deposit</option>
                <option value="Material Security Advance">Material Security Advance</option>
                <option value="Other Refundable">Other Refundable</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Date *</label>
              <DateInput
                required
                value={refundableFormData.date}
                onChange={e => setRefundableFormData({ ...refundableFormData, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Deposit Amount (₹) *</label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={refundableFormData.amount}
                onChange={e => setRefundableFormData({ ...refundableFormData, amount: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-purple-900"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={refundableFormData.paymentMethod}
                onChange={e => setRefundableFormData({ ...refundableFormData, paymentMethod: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
                <option value="UPI / NEFT">UPI / NEFT</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Receipt / Reference / Cheque No.</label>
            <input
              type="text"
              value={refundableFormData.referenceNumber}
              onChange={e => setRefundableFormData({ ...refundableFormData, referenceNumber: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
              placeholder="e.g. REC-9921 / UTR..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Refund Terms</label>
            <textarea
              value={refundableFormData.notes}
              onChange={e => setRefundableFormData({ ...refundableFormData, notes: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              rows={2}
              placeholder="Refundable upon meter removal / completion of project..."
            />
          </div>

          <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-xs text-purple-900 font-medium">
            💡 <strong>Note:</strong> After saving, ₹{formatINR(refundableFormData.amount)} will be temporarily deducted from Category 2 Investment Capital and tracked under Pending Refunds.
          </div>

          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-lg shadow-md transition-colors text-sm cursor-pointer"
          >
            {editingRefundableId ? "Update Refundable Record" : "Save Refundable Record & Deduct from Capital"}
          </button>
        </form>
      </Modal>

      {/* MODAL: Record Refund Received */}
      <Modal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        maxWidth="lg"
        title={
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg"><Receipt className="w-5 h-5" /></div>
            <div>
              <span className="font-black text-slate-900 text-base">Record Refund Received</span>
              <p className="text-xs text-slate-500 font-normal">
                {activeRefundRecord?.partyName} ({activeRefundRecord?.depositType})
              </p>
            </div>
          </div>
        }
      >
        <form onSubmit={handleProcessRefund} className="space-y-4">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3 min-w-0">
              <span className="text-slate-500 shrink">Total Deposited Amount:</span>
              <span className="font-bold text-slate-800 shrink-0 font-mono tabular-nums">₹{formatINR(activeRefundRecord?.amount || 0)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 min-w-0">
              <span className="text-slate-500 shrink">Previously Refunded:</span>
              <span className="font-bold text-emerald-700 shrink-0 font-mono tabular-nums">₹{formatINR(activeRefundRecord?.refundedAmount || 0)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 min-w-0 border-t border-slate-200 pt-1.5">
              <span className="font-bold text-slate-700 shrink">Remaining Pending:</span>
              <span className="font-black text-amber-800 shrink-0 font-mono tabular-nums">
                ₹{formatINR(Math.max(0, Number(activeRefundRecord?.amount || 0) - Number(activeRefundRecord?.refundedAmount || 0)))}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Refund Received Date *</label>
              <DateInput
                required
                value={refundActionData.refundDate}
                onChange={e => setRefundActionData({ ...refundActionData, refundDate: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount Received (₹) *</label>
              <input
                type="number"
                step="any"
                min="0.01"
                max={Math.max(0, Number(activeRefundRecord?.amount || 0) - Number(activeRefundRecord?.refundedAmount || 0))}
                required
                value={refundActionData.refundedAmount}
                onChange={e => setRefundActionData({ ...refundActionData, refundedAmount: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-emerald-700 font-mono"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Refund Notes / Receipt Ref</label>
            <input
              type="text"
              value={refundActionData.refundNotes}
              onChange={e => setRefundActionData({ ...refundActionData, refundNotes: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. Deposit refunded to project bank account"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg shadow-md transition-colors text-sm cursor-pointer"
          >
            Confirm &amp; Record Refund
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
