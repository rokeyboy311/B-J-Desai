import React, { useState, useEffect, useMemo } from "react";
import { 
  Package, Plus, Search, Building2, Trash2, Edit3, DollarSign, Wallet, CheckCircle2, AlertCircle, 
  ArrowRight, BarChart2, Eye, MapPin, Users, ShoppingBag, Layers, ArrowUpRight, ArrowDownRight,
  TrendingUp, Calendar, Info, X, Truck, FileSpreadsheet, Download, Filter, ChevronRight, Receipt
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { useLiveSync, triggerSync } from "../hooks/useLiveSync";
import { Modal } from "../components/ui/Modal";
import { useGoogleSync } from "../contexts/GoogleSyncContext";
import { formatINR, formatDate } from "../lib/formatters";
import { DateInput } from "../components/ui/DateInput";
import { downloadExcelReport } from "../lib/excelExport";

export default function MaterialPurchasePage() {
  const { showToast, confirmAction } = useToast();
  const { isConnected, setIsModalOpen: setGoogleModalOpen, centralSpreadsheetUrl } = useGoogleSync();
  
  const [activeTab, setActiveCategory] = useState<"purchase" | "stock" | "supplier">("purchase");
  
  // Data
  const [purchases, setPurchases] = useState<any[]>([]);
  const [centralStock, setCentralStock] = useState<any[]>([]);
  const [customerSupplies, setCustomerSupplies] = useState<any[]>([]);
  const [siteSupplies, setSiteSupplies] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>("ALL");
  const [supplierSearchQuery, setSupplierSearchQuery] = useState<string>("");
  const [supplierModalSearch, setSupplierModalSearch] = useState<string>("");
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<number | null>(null);
  const [preselectedVendor, setPreselectedVendor] = useState<string | null>(null);
  const [isCustomVendorInput, setIsCustomVendorInput] = useState(false);
  const [selectedMaterialDetail, setSelectedMaterialDetail] = useState<{ name: string; id?: number | null } | null>(null);
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState<string | null>(null);
  const [detailModalTab, setDetailModalTab] = useState<"all" | "sites" | "customers" | "purchases">("all");

  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    supplierName: "",
    materialName: "",
    quantity: "",
    unit: "Nos",
    rate: "",
    transportationFee: "",
    taxPercentage: "18",
    paymentStatus: "Paid",
    notes: ""
  });

  const openAddPurchaseModal = (vendorName?: string) => {
    const cleanVendor = vendorName ? vendorName.trim() : (selectedSupplierFilter !== "ALL" ? selectedSupplierFilter : "");
    setEditingPurchaseId(null);
    setPreselectedVendor(cleanVendor || null);
    setIsCustomVendorInput(!cleanVendor && supplierSummaries.length === 0);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      supplierName: cleanVendor,
      materialName: "",
      quantity: "",
      unit: "Nos",
      rate: "",
      transportationFee: "0",
      taxPercentage: "18",
      paymentStatus: "Paid",
      notes: ""
    });
    setIsModalOpen(true);
  };

  const loadData = async (isBackground = false) => {
    try {
      if (!isBackground && purchases.length === 0) setLoading(true);
      const [purchasesData, stockData, locsData, custData, siteData] = await Promise.all([
        apiFetch("/materials/purchases").catch(() => []),
        apiFetch("/materials/central-stock").catch(() => []),
        apiFetch("/locations").catch(() => []),
        apiFetch("/materials/customer-supplies-history").catch(() => []),
        apiFetch("/materials/site-supplies-history").catch(() => [])
      ]);

      if (Array.isArray(purchasesData)) setPurchases(purchasesData);
      if (Array.isArray(stockData)) setCentralStock(stockData);
      if (Array.isArray(locsData)) setLocations(locsData);
      if (Array.isArray(custData)) setCustomerSupplies(custData);
      if (Array.isArray(siteData)) setSiteSupplies(siteData);
    } catch (err) {
      console.error("Failed to load material purchase data:", err);
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

  // Purchase Metrics matching 06_material_purchase.svg
  const totalPurchaseVal = purchases.reduce((acc, p) => acc + Number(p.totalAmount || 0), 0);
  const totalPurchaseQty = purchases.reduce((acc, p) => acc + Number(p.quantity || 0), 0);
  const totalPurchaseGST = purchases.reduce((acc, p) => acc + Number(p.tax || 0), 0);
  const totalTransportFee = purchases.reduce((acc, p) => acc + Number(p.transportCost || 0), 0);
  const stockAddedVal = centralStock.reduce((acc, s) => acc + Number(s.stockValue || 0), 0);
  const pendingPayments = purchases.filter(p => (p.paymentStatus || "").toUpperCase() !== "PAID").reduce((acc, p) => acc + Number(p.totalAmount || 0), 0);

  // Stock Metrics matching 07_material_stock.svg
  const stockCount = centralStock.length;
  const stockPurchasedQty = centralStock.reduce((acc, s) => acc + Number(s.purchasedQty || 0), 0);
  const stockSuppliedQty = centralStock.reduce((acc, s) => acc + Number(s.suppliedQty || 0), 0);
  const stockAvailableQty = centralStock.reduce((acc, s) => acc + Number(s.currentStock || 0), 0);
  const totalStockVal = centralStock.reduce((acc, s) => acc + Number(s.stockValue || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const qty = parseFloat(formData.quantity) || 0;
      const rate = parseFloat(formData.rate) || 0;
      const taxPct = parseFloat(formData.taxPercentage) || 0;
      const transportFee = parseFloat(formData.transportationFee) || 0;
      const subtotal = qty * rate;
      const tax = subtotal * (taxPct / 100);
      const totalAmount = subtotal + tax + transportFee;

      const payload = {
        date: formData.date,
        supplierName: formData.supplierName.trim() || "General Supplier",
        partyName: formData.supplierName.trim() || "General Supplier",
        materialName: formData.materialName.trim().toUpperCase(),
        quantity: qty,
        unit: formData.unit,
        rate: rate,
        transportCost: transportFee,
        transportationFee: transportFee,
        taxPercentage: taxPct,
        tax: tax,
        subtotal: subtotal,
        totalAmount: totalAmount,
        paidAmount: formData.paymentStatus === "Paid" ? totalAmount : 0,
        paymentStatus: formData.paymentStatus.toUpperCase(),
        notes: formData.notes
      };

      const url = editingPurchaseId ? `/materials/purchases/${editingPurchaseId}` : "/materials/purchases";
      const method = editingPurchaseId ? "PUT" : "POST";

      await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });

      triggerSync("materials");
      triggerSync("stock");
      showToast(
        editingPurchaseId
          ? "Material purchase updated!"
          : `Purchase entry added in ${payload.supplierName}!`,
        "success"
      );
      setIsModalOpen(false);
      setEditingPurchaseId(null);
      setPreselectedVendor(null);
      setFormData({
        date: new Date().toISOString().split("T")[0],
        supplierName: "",
        materialName: "",
        quantity: "",
        unit: "Nos",
        rate: "",
        transportationFee: "",
        taxPercentage: "18",
        paymentStatus: "Paid",
        notes: ""
      });
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to save purchase", "error");
    }
  };

  const handleEditPurchase = (p: any) => {
    const supName = p.supplierName || p.partyName || "";
    setEditingPurchaseId(p.id);
    setPreselectedVendor(supName || null);
    setIsCustomVendorInput(false);
    const resolvedTaxPct =
      p.taxPercentage !== undefined && p.taxPercentage !== null && String(p.taxPercentage) !== ""
        ? String(p.taxPercentage)
        : "18";
    setFormData({
      date: p.date || new Date().toISOString().split("T")[0],
      supplierName: supName,
      materialName: p.materialName || "",
      quantity: p.quantity ? String(p.quantity) : "",
      unit: p.unit || "Nos",
      rate: p.rate ? String(p.rate) : "",
      transportationFee: p.transportCost ? String(p.transportCost) : (p.transportationFee ? String(p.transportationFee) : ""),
      taxPercentage: resolvedTaxPct,
      paymentStatus: (p.paymentStatus || "PAID").toUpperCase() === "PAID" ? "Paid" : "Pending",
      notes: p.notes || p.description || ""
    });
    setIsModalOpen(true);
  };

  const getPurchaseBreakdown = (p: any) => {
    const qty = Number(p.quantity || 0);
    const rate = Number(p.rate || 0);
    const rawSub = Number(p.subtotal || 0);
    const subtotal = rawSub > 0 ? rawSub : Math.round(qty * rate * 100) / 100;
    const gstPct =
      p.taxPercentage !== undefined && p.taxPercentage !== null && String(p.taxPercentage) !== ""
        ? Number(p.taxPercentage)
        : 18;
    const rawTax = Number(p.tax || 0);
    const gstAmt =
      p.tax !== undefined && p.tax !== null && !isNaN(rawTax) && (rawTax > 0 || gstPct === 0)
        ? rawTax
        : Math.round(subtotal * (gstPct / 100) * 100) / 100;
    const transportCost = Number(p.transportCost || 0);
    const totalAmt =
      Number(p.totalAmount || 0) ||
      Math.round((subtotal + gstAmt + transportCost) * 100) / 100;
    return { qty, rate, subtotal, gstPct, gstAmt, transportCost, totalAmt };
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirmAction({
      title: "Delete Purchase",
      message: "Are you sure you want to delete this purchase?",
      confirmLabel: "Delete",
      isDanger: true
    });
    if (!confirmed) return;

    try {
      await apiFetch(`/materials/purchases/${id}`, { method: "DELETE" });
      triggerSync("materials");
      triggerSync("stock");
      showToast("Purchase deleted", "success");
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to delete purchase", "error");
    }
  };

  const handleDeleteStock = async (stockItem: any) => {
    const confirmed = await confirmAction({
      title: "Delete Material from Stock",
      message: `Are you sure you want to delete "${stockItem.name}" from stock inventory?`,
      confirmLabel: "Delete",
      isDanger: true
    });
    if (!confirmed) return;

    try {
      await apiFetch(`/materials/material/${stockItem.id}`, { method: "DELETE" });
      triggerSync("materials");
      triggerSync("stock");
      showToast(`Material "${stockItem.name}" deleted from stock!`, "success");
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to delete material from stock", "error");
    }
  };

  // Supplier Summaries Aggregation
  const supplierSummaries = useMemo(() => {
    const map: { [name: string]: {
      name: string;
      totalAmount: number;
      totalQty: number;
      totalTax: number;
      totalTransport: number;
      paidAmount: number;
      pendingAmount: number;
      invoicesCount: number;
      lastDate: string;
      materials: { [matName: string]: { name: string; qty: number; unit: string; amount: number; count: number } };
      purchases: any[];
    } } = {};

    purchases.forEach(p => {
      const sName = (p.supplierName || p.partyName || "General Supplier").trim();
      if (!map[sName]) {
        map[sName] = {
          name: sName,
          totalAmount: 0,
          totalQty: 0,
          totalTax: 0,
          totalTransport: 0,
          paidAmount: 0,
          pendingAmount: 0,
          invoicesCount: 0,
          lastDate: "",
          materials: {},
          purchases: []
        };
      }
      const sup = map[sName];
      const bd = getPurchaseBreakdown(p);
      const amt = bd.totalAmt;
      const qty = bd.qty;
      const tax = bd.gstAmt;
      const trans = bd.transportCost;
      const isPaid = (p.paymentStatus || "PAID").toUpperCase() === "PAID";

      sup.totalAmount += amt;
      sup.totalQty += qty;
      sup.totalTax += tax;
      sup.totalTransport += trans;
      if (isPaid) sup.paidAmount += amt;
      else sup.pendingAmount += amt;
      sup.invoicesCount += 1;
      sup.purchases.push(p);

      if (p.date && (!sup.lastDate || p.date > sup.lastDate)) {
        sup.lastDate = p.date;
      }

      const mat = (p.materialName || "Material").trim();
      if (!sup.materials[mat]) {
        sup.materials[mat] = { name: mat, qty: 0, unit: p.unit || "Nos", amount: 0, count: 0 };
      }
      sup.materials[mat].qty += qty;
      sup.materials[mat].amount += amt;
      sup.materials[mat].count += 1;
    });

    return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [purchases]);

  const filteredSupplierSummaries = useMemo(() => {
    if (!supplierSearchQuery.trim()) return supplierSummaries;
    const q = supplierSearchQuery.toLowerCase().trim();
    return supplierSummaries.filter(s => 
      s.name.toLowerCase().includes(q) ||
      Object.keys(s.materials).some(m => m.toLowerCase().includes(q))
    );
  }, [supplierSummaries, supplierSearchQuery]);

  const activeSupplierData = useMemo(() => {
    if (!selectedSupplierDetail) return null;
    const cleanTarget = selectedSupplierDetail.trim().toLowerCase();
    return supplierSummaries.find(s => s.name.trim().toLowerCase() === cleanTarget) || null;
  }, [selectedSupplierDetail, supplierSummaries]);

  const handleExportSupplierExcel = async (supplierName: string) => {
    try {
      showToast(`Exporting Excel statement for ${supplierName}...`, "info");
      await downloadExcelReport(
        `/reports/export-vendor-purchases?partyName=${encodeURIComponent(supplierName)}`,
        `Purchases_${supplierName.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`
      );
      showToast("Excel downloaded successfully", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to download Excel file", "error");
    }
  };

  // Filtered lists
  const filteredPurchases = useMemo(() => {
    let result = purchases;
    if (selectedSupplierFilter !== "ALL") {
      result = result.filter(p => {
        const sName = (p.supplierName || p.partyName || "General Supplier").trim();
        return sName.toLowerCase() === selectedSupplierFilter.toLowerCase();
      });
    }
    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase().trim();
    return result.filter(p => 
      (p.materialName && p.materialName.toLowerCase().includes(q)) ||
      (p.supplierName && p.supplierName.toLowerCase().includes(q)) ||
      (p.partyName && p.partyName.toLowerCase().includes(q)) ||
      (p.date && p.date.includes(q))
    );
  }, [purchases, searchQuery, selectedSupplierFilter]);

  const filteredCentralStock = useMemo(() => {
    if (!searchQuery.trim()) return centralStock;
    const q = searchQuery.toLowerCase().trim();
    return centralStock.filter(s => 
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.category && s.category.toLowerCase().includes(q))
    );
  }, [centralStock, searchQuery]);

  // Material Detail Modal Computation
  const activeMaterialData = useMemo(() => {
    if (!selectedMaterialDetail) return null;
    const cleanTarget = selectedMaterialDetail.name.trim().toUpperCase();
    const targetId = selectedMaterialDetail.id;

    const matchedStock = centralStock.find(s => 
      (s.name && s.name.trim().toUpperCase() === cleanTarget) ||
      (targetId && s.id === targetId)
    ) || {
      name: selectedMaterialDetail.name,
      unit: "Nos",
      rate: 0,
      currentStock: 0,
      purchasedQty: 0,
      suppliedQty: 0,
      stockValue: 0
    };

    const matPurchases = purchases.filter(p => 
      (p.materialName && p.materialName.trim().toUpperCase() === cleanTarget) ||
      (targetId && p.materialId === targetId)
    );

    const matSiteSupplies = siteSupplies.filter(s => 
      (s.materialName && s.materialName.trim().toUpperCase() === cleanTarget) ||
      (targetId && s.materialId === targetId)
    );

    const matCustSupplies = customerSupplies.filter(c => 
      (c.materialName && c.materialName.trim().toUpperCase() === cleanTarget) ||
      (targetId && c.materialId === targetId)
    );

    // Group site supplies by Location/Site Name
    const siteBreakdownMap: { [key: string]: { locationName: string; totalQty: number; totalAmount: number; recordsCount: number } } = {};
    matSiteSupplies.forEach(s => {
      const locName = s.locationName || `Site #${s.locationId || "General"}`;
      if (!siteBreakdownMap[locName]) {
        siteBreakdownMap[locName] = { locationName: locName, totalQty: 0, totalAmount: 0, recordsCount: 0 };
      }
      siteBreakdownMap[locName].totalQty += parseFloat(String(s.quantity || 0));
      siteBreakdownMap[locName].totalAmount += parseFloat(String(s.amount || 0));
      siteBreakdownMap[locName].recordsCount += 1;
    });
    const siteBreakdownList = Object.values(siteBreakdownMap).sort((a, b) => b.totalQty - a.totalQty);

    // Group customer supplies by Customer Name
    const custBreakdownMap: { [key: string]: { customerName: string; locationName: string; totalQty: number; totalAmount: number; recordsCount: number } } = {};
    matCustSupplies.forEach(c => {
      const custName = c.customerName || "Direct Customer";
      if (!custBreakdownMap[custName]) {
        custBreakdownMap[custName] = { customerName: custName, locationName: c.locationName || "All Sites", totalQty: 0, totalAmount: 0, recordsCount: 0 };
      }
      custBreakdownMap[custName].totalQty += parseFloat(String(c.quantity || 0));
      custBreakdownMap[custName].totalAmount += parseFloat(String(c.totalAmount || 0));
      custBreakdownMap[custName].recordsCount += 1;
    });
    const custBreakdownList = Object.values(custBreakdownMap).sort((a, b) => b.totalQty - a.totalQty);

    const totalInwardQty = matPurchases.reduce((sum, p) => sum + parseFloat(String(p.quantity || 0)), 0);
    const totalInwardVal = matPurchases.reduce((sum, p) => sum + parseFloat(String(p.totalAmount || 0)), 0);

    const totalSiteSupplyQty = matSiteSupplies.reduce((sum, s) => sum + parseFloat(String(s.quantity || 0)), 0);
    const totalSiteSupplyVal = matSiteSupplies.reduce((sum, s) => sum + parseFloat(String(s.amount || 0)), 0);

    const totalCustSupplyQty = matCustSupplies.reduce((sum, c) => sum + parseFloat(String(c.quantity || 0)), 0);
    const totalCustSupplyVal = matCustSupplies.reduce((sum, c) => sum + parseFloat(String(c.totalAmount || 0)), 0);

    const totalOutwardQty = totalSiteSupplyQty + totalCustSupplyQty;
    const currentBalanceQty = Math.max(0, totalInwardQty - totalOutwardQty);
    const calculatedStockVal = currentBalanceQty * (parseFloat(String(matchedStock.rate || 0)) || (totalInwardQty > 0 ? totalInwardVal / totalInwardQty : 0));

    return {
      materialName: selectedMaterialDetail.name,
      unit: matchedStock.unit || "Nos",
      rate: matchedStock.rate || (totalInwardQty > 0 ? (totalInwardVal / totalInwardQty).toFixed(2) : 0),
      totalInwardQty: totalInwardQty || matchedStock.purchasedQty || 0,
      totalInwardVal,
      totalSiteSupplyQty,
      totalSiteSupplyVal,
      totalCustSupplyQty,
      totalCustSupplyVal,
      totalOutwardQty,
      currentBalanceQty: matchedStock.currentStock !== undefined ? matchedStock.currentStock : currentBalanceQty,
      stockValue: matchedStock.stockValue !== undefined ? matchedStock.stockValue : calculatedStockVal,
      siteBreakdownList,
      custBreakdownList,
      matSiteSupplies,
      matCustSupplies,
      matPurchases
    };
  }, [selectedMaterialDetail, centralStock, purchases, siteSupplies, customerSupplies]);

  const openMaterialDetail = (name: string, id?: number | null) => {
    setSelectedMaterialDetail({ name, id });
    setDetailModalTab("all");
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {activeTab === "purchase" 
              ? "Material Purchase (Purchase Register)" 
              : activeTab === "supplier"
              ? "Supplier-wise Purchase Register"
              : "Material Stock Inventory"}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {activeTab === "purchase" 
              ? "Purchase materials and add to central stock" 
              : activeTab === "supplier"
              ? "Supplier-wise inward volume, bills, and purchase statements"
              : "Track central material inventory for all sites"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          {/* Sub-tab toggle */}
          <div className="bg-slate-200/80 p-1 rounded-xl grid grid-cols-3 sm:inline-flex items-center gap-1 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveCategory("purchase")}
              className={`px-2.5 sm:px-3.5 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center ${
                activeTab === "purchase" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Purchases
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory("supplier")}
              className={`px-2 sm:px-3.5 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1 ${
                activeTab === "supplier" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 hidden xs:inline-block sm:inline-block" />
              <span>Supplier Wise</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-black shrink-0">
                {supplierSummaries.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory("stock")}
              className={`px-2 sm:px-3.5 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center ${
                activeTab === "stock" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Stock Inventory
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setGoogleModalOpen(true)}
              className="px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
              title="Manage Google Sheets Live Sync"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{isConnected ? "Sheets Live" : "Sheets Sync"}</span>
              {isConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
            </button>

            <button
              type="button"
              onClick={() => openAddPurchaseModal()}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-[#1E88E5] hover:bg-blue-600 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>
                {selectedSupplierFilter !== "ALL"
                  ? `+ Add Entry (${selectedSupplierFilter})`
                  : "+ Add Material Purchase"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards: PURCHASE VIEW (6 equal cards: 2x3 on mobile, 3x2 on tablet, 6x1 on desktop) */}
      {activeTab === "purchase" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3 items-stretch">
          <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-[#0B1D3A] text-white rounded-xl shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Total Purchase</span>
              <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums whitespace-nowrap block mt-0.5">
                ₹{formatINR(totalPurchaseVal)}
              </span>
            </div>
          </div>

          <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Purchase Qty</span>
              <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums whitespace-nowrap block mt-0.5">
                {formatINR(totalPurchaseQty)}
              </span>
            </div>
          </div>

          <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">GST</span>
              <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums whitespace-nowrap block mt-0.5">
                ₹{formatINR(totalPurchaseGST)}
              </span>
            </div>
          </div>

          <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Transport Fee</span>
              <span className="text-xs sm:text-sm font-black text-indigo-700 tabular-nums whitespace-nowrap block mt-0.5">
                ₹{formatINR(totalTransportFee)}
              </span>
            </div>
          </div>

          <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Stock Added</span>
              <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums whitespace-nowrap block mt-0.5">
                ₹{formatINR(stockAddedVal)}
              </span>
            </div>
          </div>

          <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-rose-50 text-rose-600 rounded-xl shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Pending Payments</span>
              <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums whitespace-nowrap block mt-0.5">
                ₹{formatINR(pendingPayments)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards: SUPPLIER VIEW (6 equal cards) */}
      {activeTab === "supplier" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3 items-stretch">
          <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-emerald-600 text-white rounded-xl shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Total Suppliers</span>
              <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums whitespace-nowrap block mt-0.5">
                {supplierSummaries.length}
              </span>
            </div>
          </div>

          <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-[#0B1D3A] text-white rounded-xl shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Total Purchases</span>
              <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums whitespace-nowrap block mt-0.5">
                ₹{formatINR(totalPurchaseVal)}
              </span>
            </div>
          </div>

          <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Top Supplier</span>
              <span className="text-xs font-black text-slate-800 truncate block mt-0.5" title={supplierSummaries[0]?.name}>
                {supplierSummaries[0]?.name || "-"}
              </span>
            </div>
          </div>

          <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Total Bills Inward</span>
              <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums whitespace-nowrap block mt-0.5">
                {purchases.length}
              </span>
            </div>
          </div>

          <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Paid Amount</span>
              <span className="text-xs sm:text-sm font-black text-emerald-700 tabular-nums whitespace-nowrap block mt-0.5">
                ₹{formatINR(totalPurchaseVal - pendingPayments)}
              </span>
            </div>
          </div>

          <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-rose-50 text-rose-600 rounded-xl shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Pending Balance</span>
              <span className="text-xs sm:text-sm font-black text-rose-700 tabular-nums whitespace-nowrap block mt-0.5">
                ₹{formatINR(pendingPayments)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards: STOCK VIEW */}
      {activeTab === "stock" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 items-stretch">
          <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Materials</span>
              <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums whitespace-nowrap block mt-0.5">
                {stockCount}
              </span>
            </div>
          </div>

          <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-[#0B1D3A] text-white rounded-xl shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Purchased Qty</span>
              <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums whitespace-nowrap block mt-0.5">
                {formatINR(stockPurchasedQty)}
              </span>
            </div>
          </div>

          <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Supplied Qty</span>
              <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums whitespace-nowrap block mt-0.5">
                {formatINR(stockSuppliedQty)}
              </span>
            </div>
          </div>

          <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Available Qty</span>
              <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums whitespace-nowrap block mt-0.5">
                {formatINR(stockAvailableQty)}
              </span>
            </div>
          </div>

          <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3 col-span-2 sm:col-span-1">
            <div className="p-2 sm:p-2.5 bg-purple-50 text-purple-600 rounded-xl shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Stock Value</span>
              <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums whitespace-nowrap block mt-0.5">
                ₹{formatINR(totalStockVal)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Bar for Purchase Register */}
      {activeTab === "purchase" && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input 
                type="text"
                placeholder="Search purchases by material, supplier, date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="text-slate-400 hover:text-slate-600 p-1 text-xs cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Supplier Filter Dropdown + Quick Vendor Entry Button */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border border-slate-200/80 shadow-2xs flex-1 sm:w-auto sm:min-w-[230px] max-w-full">
                <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <select
                  value={selectedSupplierFilter}
                  onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Select Vendor / All Suppliers ({supplierSummaries.length})</option>
                  {supplierSummaries.map((s, idx) => (
                    <option key={idx} value={s.name}>
                      {s.name} (₹{formatINR(s.totalAmount)} - {s.invoicesCount} bills)
                    </option>
                  ))}
                </select>
              </div>

              {selectedSupplierFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => openAddPurchaseModal(selectedSupplierFilter)}
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap shrink-0 w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>+ Add Entry in {selectedSupplierFilter}</span>
                </button>
              )}
            </div>
          </div>

          {/* Supplier Filter Active Banner */}
          {selectedSupplierFilter !== "ALL" && (
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded-md">
                      Selected Vendor
                    </span>
                    <span className="text-xs text-slate-500 font-medium">Vendor-Specific Purchase View</span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 mt-0.5">{selectedSupplierFilter}</h3>
                </div>
              </div>

              {(() => {
                const sup = supplierSummaries.find(s => s.name.toLowerCase() === selectedSupplierFilter.toLowerCase());
                if (!sup) return null;
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="bg-white/90 px-3 py-1.5 rounded-xl border border-emerald-200/80 text-xs">
                      <span className="text-slate-500 block text-[9px] uppercase font-bold">Total Purchases</span>
                      <span className="text-sm font-black text-emerald-700 tabular-nums whitespace-nowrap">₹{formatINR(sup.totalAmount)}</span>
                    </div>
                    <div className="bg-white/90 px-3 py-1.5 rounded-xl border border-amber-200/80 text-xs">
                      <span className="text-amber-700 block text-[9px] uppercase font-bold">Total GST</span>
                      <span className="text-sm font-black text-amber-800 tabular-nums whitespace-nowrap">₹{formatINR(sup.totalTax)}</span>
                    </div>
                    <div className="bg-white/90 px-3 py-1.5 rounded-xl border border-emerald-200/80 text-xs">
                      <span className="text-slate-500 block text-[9px] uppercase font-bold">Bills</span>
                      <span className="text-sm font-black text-slate-800 tabular-nums whitespace-nowrap">{sup.invoicesCount}</span>
                    </div>
                    <div className="bg-white/90 px-3 py-1.5 rounded-xl border border-emerald-200/80 text-xs">
                      <span className="text-slate-500 block text-[9px] uppercase font-bold">Total Qty</span>
                      <span className="text-sm font-black text-slate-800 tabular-nums whitespace-nowrap">{formatINR(sup.totalQty)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAddPurchaseModal(selectedSupplierFilter)}
                      className="px-3.5 py-2 bg-[#1E88E5] hover:bg-blue-600 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" />
                      <span>+ Add Purchase Entry</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSupplierDetail(selectedSupplierFilter)}
                      className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                      <span>Open Statement</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSupplierFilter("ALL")}
                      className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition-all cursor-pointer whitespace-nowrap"
                    >
                      Clear Filter
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Search Bar for Stock Inventory */}
      {activeTab === "stock" && (
        <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input 
            type="text"
            placeholder="Search inventory materials by name, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="text-slate-400 hover:text-slate-600 p-1 text-xs cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* TAB 1: PURCHASE REGISTER TABLE */}
      {activeTab === "purchase" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">Purchase Register</h2>
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
                Central Inventory
              </span>
              {selectedSupplierFilter !== "ALL" && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Supplier: {selectedSupplierFilter}
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-slate-500">{filteredPurchases.length} Records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Supplier / Vendor (Click to Open)</th>
                  <th className="p-3.5">Material (Click for Supply History)</th>
                  <th className="p-3.5 text-right">Qty</th>
                  <th className="p-3.5 text-right">Rate</th>
                  <th className="p-3.5 text-right">Taxable Subtotal</th>
                  <th className="p-3.5 text-right text-amber-700">GST (% &amp; ₹)</th>
                  <th className="p-3.5 text-right">Transport Fee</th>
                  <th className="p-3.5 text-right font-black">Grand Total</th>
                  <th className="p-3.5 text-center">Payment</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400">
                      {searchQuery || selectedSupplierFilter !== "ALL" 
                        ? "No matching purchase records found." 
                        : "No purchase records found."}
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((p) => {
                    const isPaid = (p.paymentStatus || "PAID").toUpperCase() === "PAID";
                    const bd = getPurchaseBreakdown(p);
                    const transportAmt = bd.transportCost;
                    const supName = p.supplierName || p.partyName || "General Supplier";

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3.5 text-slate-600 font-medium whitespace-nowrap">{formatDate(p.date)}</td>
                        
                        {/* Interactive Clickable Supplier Name Button */}
                        <td className="p-3.5">
                          <button
                            type="button"
                            onClick={() => setSelectedSupplierDetail(supName)}
                            className="group text-left inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100/90 text-emerald-900 font-bold transition-all border border-emerald-200/80 shadow-2xs hover:shadow-xs cursor-pointer"
                            title={`Click to view total purchases and inward ledger for ${supName}`}
                          >
                            <Building2 className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
                            <span className="group-hover:underline underline-offset-2">{supName}</span>
                          </button>
                        </td>
                        
                        {/* Interactive Clickable Material Name Button */}
                        <td className="p-3.5">
                          <button
                            type="button"
                            onClick={() => openMaterialDetail(p.materialName, p.materialId)}
                            className="group text-left inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 font-bold transition-all border border-blue-200/80 shadow-2xs hover:shadow-xs cursor-pointer"
                            title="Click to view site-wise and customer-wise supply details"
                          >
                            <Package className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform shrink-0" />
                            <span className="group-hover:underline underline-offset-2">{p.materialName}</span>
                          </button>
                        </td>

                        <td className="p-3.5 text-right font-bold text-slate-800 tabular-nums whitespace-nowrap">
                          {formatINR(bd.qty)} {p.unit}
                        </td>
                        <td className="p-3.5 text-right font-medium text-slate-700 tabular-nums whitespace-nowrap">
                          ₹{formatINR(bd.rate)}
                        </td>
                        <td className="p-3.5 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                          ₹{formatINR(bd.subtotal)}
                        </td>
                        <td className="p-3.5 text-right tabular-nums whitespace-nowrap">
                          <div className="font-bold text-amber-700">+₹{formatINR(bd.gstAmt)}</div>
                          <span className="inline-block px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                            {bd.gstPct}% GST
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-bold tabular-nums whitespace-nowrap">
                          {transportAmt > 0 ? (
                            <span className="text-indigo-700 font-bold">₹{formatINR(transportAmt)}</span>
                          ) : (
                            <span className="text-slate-400 font-normal">₹0</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right font-black text-slate-900 tabular-nums whitespace-nowrap">
                          <div>₹{formatINR(bd.totalAmt)}</div>
                          {transportAmt > 0 && (
                            <div className="text-[10px] text-indigo-600 font-normal">incl. ₹{formatINR(transportAmt)} transport</div>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            isPaid ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}>
                            {isPaid ? "Paid" : "Pending"}
                          </span>
                        </td>
                        
                        {/* Actions */}
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Quick Add Entry for this Vendor */}
                            <button
                              type="button"
                              onClick={() => openAddPurchaseModal(supName)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                              title={`Add new purchase entry in ${supName}`}
                            >
                              <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="hidden xl:inline">Add Entry</span>
                            </button>

                            {/* Supplier Statement Button */}
                            <button
                              type="button"
                              onClick={() => setSelectedSupplierDetail(supName)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-200 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                              title={`Open ${supName} Total Purchase Statement`}
                            >
                              <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="hidden xl:inline">Supplier</span>
                            </button>

                            {/* Stock View Button */}
                            <button
                              type="button"
                              onClick={() => openMaterialDetail(p.materialName, p.materialId)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-[11px] border border-slate-200 hover:border-blue-300 transition-all cursor-pointer shadow-2xs"
                              title="View Central Stock & Location Supply Details"
                            >
                              <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
                              <span className="hidden xl:inline">Stock</span>
                            </button>

                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => handleEditPurchase(p)}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors border border-transparent hover:border-indigo-200 cursor-pointer"
                              title="Edit Purchase Record"
                            >
                              <Edit3 size={15} />
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDelete(p.id)}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-200 cursor-pointer"
                              title="Delete Purchase Record"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredPurchases.length > 0 && (() => {
                const totQty = filteredPurchases.reduce((s, p) => s + getPurchaseBreakdown(p).qty, 0);
                const totSub = filteredPurchases.reduce((s, p) => s + getPurchaseBreakdown(p).subtotal, 0);
                const totGst = filteredPurchases.reduce((s, p) => s + getPurchaseBreakdown(p).gstAmt, 0);
                const totTrans = filteredPurchases.reduce((s, p) => s + getPurchaseBreakdown(p).transportCost, 0);
                const totGrand = filteredPurchases.reduce((s, p) => s + getPurchaseBreakdown(p).totalAmt, 0);
                return (
                  <tfoot className="bg-slate-50/90 border-t-2 border-slate-200 font-black text-slate-900">
                    <tr>
                      <td colSpan={3} className="p-3.5 uppercase tracking-wider text-slate-600">
                        Total ({filteredPurchases.length} Records)
                      </td>
                      <td className="p-3.5 text-right text-slate-800 tabular-nums whitespace-nowrap">
                        {formatINR(totQty)}
                      </td>
                      <td className="p-3.5 text-right text-slate-400">—</td>
                      <td className="p-3.5 text-right text-slate-800 tabular-nums whitespace-nowrap">
                        ₹{formatINR(totSub)}
                      </td>
                      <td className="p-3.5 text-right text-amber-700 tabular-nums whitespace-nowrap">
                        +₹{formatINR(totGst)}
                      </td>
                      <td className="p-3.5 text-right text-indigo-700 tabular-nums whitespace-nowrap">
                        ₹{formatINR(totTrans)}
                      </td>
                      <td className="p-3.5 text-right text-slate-900 tabular-nums whitespace-nowrap">
                        ₹{formatINR(totGrand)}
                      </td>
                      <td colSpan={2} className="p-3.5"></td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SUPPLIER-WISE PURCHASE REGISTER DIRECTORY */}
      {activeTab === "supplier" && (
        <div className="space-y-4">
          {/* Top Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900">Supplier Directory & Purchase Register</h2>
                <p className="text-[11px] text-slate-500 font-medium">Click on any supplier (e.g. Gurukrupa Traders) to view all purchases and total volume</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search supplier (e.g. Gurukrupa Traders)..."
                  value={supplierSearchQuery}
                  onChange={(e) => setSupplierSearchQuery(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-800 placeholder:text-slate-400 bg-transparent focus:outline-none"
                />
                {supplierSearchQuery && (
                  <button
                    onClick={() => setSupplierSearchQuery("")}
                    className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Supplier Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSupplierSummaries.length === 0 ? (
              <div className="col-span-full bg-white p-10 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                No matching suppliers found.
              </div>
            ) : (
              filteredSupplierSummaries.map((sup, idx) => {
                const materialsList = Object.values(sup.materials);
                return (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div className="space-y-3">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200/60 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-slate-900 group-hover:text-emerald-700 transition-colors leading-tight">
                              {sup.name}
                            </h3>
                            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                              {sup.lastDate ? `Last Bill: ${formatDate(sup.lastDate)}` : "No bills recorded"}
                            </span>
                          </div>
                        </div>

                        <span className="text-[11px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 shrink-0">
                          {sup.invoicesCount} {sup.invoicesCount === 1 ? "Bill" : "Bills"}
                        </span>
                      </div>

                      {/* Total Purchase Amount Highlight */}
                      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                            Total Purchase Amount
                          </span>
                          <span className="text-lg font-black text-slate-900 tabular-nums">
                            ₹{formatINR(sup.totalAmount)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                            Total Quantity
                          </span>
                          <span className="text-xs font-black text-slate-700 tabular-nums">
                            {formatINR(sup.totalQty)} Units
                          </span>
                        </div>
                      </div>

                      {/* Payment & Tax Stats */}
                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div className="bg-amber-50/70 p-2 rounded-lg border border-amber-100">
                          <span className="text-[10px] font-semibold text-amber-700 block">Total GST</span>
                          <span className="font-bold text-amber-900 tabular-nums">₹{formatINR(sup.totalTax)}</span>
                        </div>
                        <div className="bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                          <span className="text-[10px] font-semibold text-emerald-700 block">Paid</span>
                          <span className="font-bold text-emerald-900 tabular-nums">₹{formatINR(sup.paidAmount)}</span>
                        </div>
                        <div className={`p-2 rounded-lg border ${sup.pendingAmount > 0 ? "bg-rose-50/60 border-rose-100" : "bg-slate-50 border-slate-100"}`}>
                          <span className={`text-[10px] font-semibold block ${sup.pendingAmount > 0 ? "text-rose-700" : "text-slate-500"}`}>
                            Pending
                          </span>
                          <span className={`font-bold tabular-nums ${sup.pendingAmount > 0 ? "text-rose-900" : "text-slate-600"}`}>
                            ₹{formatINR(sup.pendingAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Materials Supplied Badges */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">
                          Materials Supplied ({materialsList.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                          {materialsList.map((m, mIdx) => (
                            <span
                              key={mIdx}
                              className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 px-2 py-0.5 rounded-md"
                            >
                              {m.name}: {formatINR(m.qty)} {m.unit}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-3 mt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openAddPurchaseModal(sup.name)}
                        className="flex-1 py-2.5 px-3 bg-[#1E88E5] hover:bg-blue-600 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs cursor-pointer whitespace-nowrap"
                        title={`Add new material purchase entry in ${sup.name}`}
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>+ Add Entry</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSupplierDetail(sup.name)}
                        className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs cursor-pointer whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                        <span>View Purchases</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSupplierFilter(sup.name);
                          setActiveCategory("purchase");
                        }}
                        className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                        title="View in Purchase Register"
                      >
                        Register
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Supplier Master Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden mt-6">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">All Suppliers Summary</h3>
                <span className="text-xs text-slate-500 font-semibold">({supplierSummaries.length} Suppliers Total)</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="p-3.5">Supplier Name</th>
                    <th className="p-3.5 text-center">Invoices</th>
                    <th className="p-3.5">Materials Supplied</th>
                    <th className="p-3.5 text-right">Total Qty</th>
                    <th className="p-3.5 text-right text-amber-700">Total GST (₹)</th>
                    <th className="p-3.5 text-right font-black">Total Purchases (₹)</th>
                    <th className="p-3.5 text-right">Paid (₹)</th>
                    <th className="p-3.5 text-right">Pending (₹)</th>
                    <th className="p-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supplierSummaries.map((sup, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900">
                        <button
                          type="button"
                          onClick={() => setSelectedSupplierDetail(sup.name)}
                          className="text-left font-black text-emerald-800 hover:text-emerald-900 hover:underline flex items-center gap-1.5 cursor-pointer"
                        >
                          <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{sup.name}</span>
                        </button>
                      </td>
                      <td className="p-3.5 text-center font-bold text-slate-700">
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md">{sup.invoicesCount}</span>
                      </td>
                      <td className="p-3.5 text-slate-600 max-w-xs truncate">
                        {Object.keys(sup.materials).join(", ") || "-"}
                      </td>
                      <td className="p-3.5 text-right font-bold text-slate-800 tabular-nums whitespace-nowrap">
                        {formatINR(sup.totalQty)}
                      </td>
                      <td className="p-3.5 text-right font-bold text-amber-700 tabular-nums whitespace-nowrap">
                        +₹{formatINR(sup.totalTax)}
                      </td>
                      <td className="p-3.5 text-right font-black text-slate-900 tabular-nums text-sm whitespace-nowrap">
                        ₹{formatINR(sup.totalAmount)}
                      </td>
                      <td className="p-3.5 text-right font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                        ₹{formatINR(sup.paidAmount)}
                      </td>
                      <td className="p-3.5 text-right font-bold text-rose-700 tabular-nums whitespace-nowrap">
                        ₹{formatINR(sup.pendingAmount)}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openAddPurchaseModal(sup.name)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1 whitespace-nowrap"
                            title={`Add new purchase entry in ${sup.name}`}
                          >
                            <Plus className="w-3.5 h-3.5 shrink-0" />
                            <span>+ Add Entry</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedSupplierDetail(sup.name)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                          >
                            Open Statement
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CENTRAL STOCK INVENTORY TABLE */}
      {activeTab === "stock" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Central Material Inventory (All Sites)</h2>
            <span className="text-xs font-semibold text-slate-500">{filteredCentralStock.length} Items</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="p-3.5">Material</th>
                  <th className="p-3.5">UOM</th>
                  <th className="p-3.5 text-right">Purchased (IN)</th>
                  <th className="p-3.5 text-right">Supplied (OUT)</th>
                  <th className="p-3.5 text-right">Available Stock</th>
                  <th className="p-3.5 text-right font-black">Stock Value</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCentralStock.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      {searchQuery ? "No matching inventory items found." : "No inventory records found."}
                    </td>
                  </tr>
                ) : (
                  filteredCentralStock.map((stk) => (
                    <tr key={stk.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Interactive Material Name Div */}
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => openMaterialDetail(stk.name, stk.id)}
                          className="group text-left inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/90 hover:bg-blue-50 text-slate-900 hover:text-blue-700 font-bold transition-all border border-slate-200/80 hover:border-blue-200 cursor-pointer"
                        >
                          <Package className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-600 shrink-0" />
                          <span className="group-hover:underline underline-offset-2">{stk.name}</span>
                        </button>
                      </td>

                      <td className="p-3.5 text-slate-500 font-medium">{stk.unit || "Nos"}</td>
                      <td className="p-3.5 text-right font-bold text-slate-800 tabular-nums">
                        {formatINR(stk.purchasedQty || stk.totalInward || 0)}
                      </td>
                      <td className="p-3.5 text-right font-semibold text-amber-700 tabular-nums">
                        {formatINR(stk.suppliedQty || stk.totalOutward || 0)}
                      </td>
                      <td className="p-3.5 text-right font-black text-emerald-700 tabular-nums">
                        {formatINR(stk.currentStock || stk.currentBalance || 0)}
                      </td>
                      <td className="p-3.5 text-right font-black text-slate-900 tabular-nums">
                        ₹{formatINR(stk.stockValue || 0)}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openMaterialDetail(stk.name, stk.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 transition-all cursor-pointer shadow-2xs"
                            title="View supply details across all sites & customers"
                          >
                            <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>Supply Details</span>
                            <ArrowRight size={12} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteStock(stk)}
                            className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-200 cursor-pointer"
                            title="Delete Material from Stock Inventory"
                          >
                            <Trash2 size={15} />
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

      {/* COMPREHENSIVE MODAL: Material Supply Details & Location-wise Distribution */}
      {selectedMaterialDetail && activeMaterialData && (
        <Modal
          isOpen={!!selectedMaterialDetail}
          onClose={() => setSelectedMaterialDetail(null)}
          title={`Material Supply & Stock Details: ${activeMaterialData.materialName}`}
          maxWidth="5xl"
        >
          <div className="space-y-5">
            {/* Header KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-blue-50/90 p-3.5 rounded-2xl border border-blue-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-blue-800">
                  <span className="text-[10px] uppercase font-black tracking-wider">Total Inward</span>
                  <ArrowDownRight className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-lg font-black text-blue-950 mt-1 tabular-nums">
                  {formatINR(activeMaterialData.totalInwardQty)} <span className="text-xs font-bold text-blue-700">{activeMaterialData.unit}</span>
                </div>
                <div className="text-[10px] font-semibold text-blue-700 mt-0.5">
                  Value: ₹{formatINR(activeMaterialData.totalInwardVal || 0)}
                </div>
              </div>

              <div className="bg-amber-50/90 p-3.5 rounded-2xl border border-amber-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-amber-800">
                  <span className="text-[10px] uppercase font-black tracking-wider">Site Supplies</span>
                  <MapPin className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-lg font-black text-amber-950 mt-1 tabular-nums">
                  {formatINR(activeMaterialData.totalSiteSupplyQty)} <span className="text-xs font-bold text-amber-700">{activeMaterialData.unit}</span>
                </div>
                <div className="text-[10px] font-semibold text-amber-700 mt-0.5">
                  Across {activeMaterialData.siteBreakdownList.length} Construction Sites
                </div>
              </div>

              <div className="bg-purple-50/90 p-3.5 rounded-2xl border border-purple-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-purple-800">
                  <span className="text-[10px] uppercase font-black tracking-wider">Customer Supplies</span>
                  <Users className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-lg font-black text-purple-950 mt-1 tabular-nums">
                  {formatINR(activeMaterialData.totalCustSupplyQty)} <span className="text-xs font-bold text-purple-700">{activeMaterialData.unit}</span>
                </div>
                <div className="text-[10px] font-semibold text-purple-700 mt-0.5">
                  Across {activeMaterialData.custBreakdownList.length} Customers
                </div>
              </div>

              <div className="bg-emerald-50/90 p-3.5 rounded-2xl border border-emerald-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-emerald-800">
                  <span className="text-[10px] uppercase font-black tracking-wider">Available Stock</span>
                  <Package className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-lg font-black text-emerald-950 mt-1 tabular-nums">
                  {formatINR(activeMaterialData.currentBalanceQty)} <span className="text-xs font-bold text-emerald-700">{activeMaterialData.unit}</span>
                </div>
                <div className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                  Stock Val: ₹{formatINR(activeMaterialData.stockValue || 0)}
                </div>
              </div>
            </div>

            {/* Sub-tab navigation in Modal */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setDetailModalTab("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  detailModalTab === "all" ? "bg-[#0B1D3A] text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Summary Overview
              </button>
              <button
                type="button"
                onClick={() => setDetailModalTab("sites")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  detailModalTab === "sites" ? "bg-amber-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <MapPin size={13} />
                <span>Site Locations ({activeMaterialData.matSiteSupplies.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailModalTab("customers")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  detailModalTab === "customers" ? "bg-purple-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Users size={13} />
                <span>Customer Supplies ({activeMaterialData.matCustSupplies.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailModalTab("purchases")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  detailModalTab === "purchases" ? "bg-blue-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <ShoppingBag size={13} />
                <span>Purchases ({activeMaterialData.matPurchases.length})</span>
              </button>
            </div>

            {/* TAB CONTENT: Overview or Site Locations */}
            {(detailModalTab === "all" || detailModalTab === "sites") && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-amber-600" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Location-wise Site Distribution
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                    Total: {activeMaterialData.totalSiteSupplyQty.toLocaleString("en-IN")} {activeMaterialData.unit}
                  </span>
                </div>

                {/* Site Cards Breakdown */}
                {activeMaterialData.siteBreakdownList.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {activeMaterialData.siteBreakdownList.map((site, idx) => {
                      const pct = activeMaterialData.totalInwardQty > 0 
                        ? Math.round((site.totalQty / activeMaterialData.totalInwardQty) * 100) 
                        : 0;
                      return (
                        <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900">{site.locationName}</span>
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded">
                              {pct}% of Inward
                            </span>
                          </div>
                          <div className="mt-1 flex items-baseline justify-between">
                            <span className="text-sm font-black text-slate-800 tabular-nums">
                              {formatINR(site.totalQty)} {activeMaterialData.unit}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                              ₹{formatINR(site.totalAmount)}
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(5, pct))}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                    No site location supplies recorded yet for {activeMaterialData.materialName}.
                  </div>
                )}

                {/* Detailed Site Supplies Table */}
                {detailModalTab === "sites" && activeMaterialData.matSiteSupplies.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden mt-3">
                    <div className="p-2.5 bg-slate-100/80 border-b border-slate-200 text-xs font-bold text-slate-800">
                      Detailed Site Supply Log
                    </div>
                    <div className="max-h-60 overflow-y-auto overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Location / Site</th>
                            <th className="p-2.5">Team / Recipient</th>
                            <th className="p-2.5">Work Description</th>
                            <th className="p-2.5 text-right">Qty</th>
                            <th className="p-2.5 text-right">Rate</th>
                            <th className="p-2.5 text-right">Subtotal</th>
                            <th className="p-2.5 text-right text-amber-700">GST</th>
                            <th className="p-2.5 text-right font-black">Total Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeMaterialData.matSiteSupplies.map((s, idx) => {
                            const sQty = Number(s.quantity || 0);
                            const sRate = Number(s.rate || 0);
                            const sSub = Number(s.subtotal || 0) || Math.round(sQty * sRate * 100) / 100;
                            const sTaxAmt = Number(s.taxAmount ?? s.tax ?? 0);
                            const sTaxPct = Number(s.taxPercentage || 0);
                            return (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2.5 text-slate-600 font-medium whitespace-nowrap">{formatDate(s.date)}</td>
                                <td className="p-2.5 font-bold text-slate-900">{s.locationName || `Site #${s.locationId}`}</td>
                                <td className="p-2.5 font-semibold text-blue-700">{s.teamName || s.responsiblePerson || "Site Team"}</td>
                                <td className="p-2.5 text-slate-600 max-w-xs truncate">{s.workDescription || "-"}</td>
                                <td className="p-2.5 text-right font-bold text-slate-800 tabular-nums whitespace-nowrap">{formatINR(sQty)} {activeMaterialData.unit}</td>
                                <td className="p-2.5 text-right text-slate-600 tabular-nums whitespace-nowrap">₹{formatINR(sRate)}</td>
                                <td className="p-2.5 text-right font-semibold text-slate-700 tabular-nums whitespace-nowrap">₹{formatINR(sSub)}</td>
                                <td className="p-2.5 text-right text-amber-700 font-bold tabular-nums whitespace-nowrap">
                                  +₹{formatINR(sTaxAmt)} <span className="text-[10px] text-slate-500">({sTaxPct}%)</span>
                                </td>
                                <td className="p-2.5 text-right font-black text-slate-900 tabular-nums whitespace-nowrap">₹{formatINR(s.amount)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Customer Supplies */}
            {(detailModalTab === "all" || detailModalTab === "customers") && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-purple-600" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Customer Supplies Breakdown
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                    Total: {activeMaterialData.totalCustSupplyQty.toLocaleString("en-IN")} {activeMaterialData.unit}
                  </span>
                </div>

                {activeMaterialData.matCustSupplies.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="max-h-60 overflow-y-auto overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Customer Name</th>
                            <th className="p-2.5">Project Location</th>
                            <th className="p-2.5 text-right">Qty</th>
                            <th className="p-2.5 text-right">Rate</th>
                            <th className="p-2.5 text-right">Subtotal</th>
                            <th className="p-2.5 text-right text-amber-700">GST</th>
                            <th className="p-2.5 text-right font-black">Amount</th>
                            <th className="p-2.5 text-center">Payment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeMaterialData.matCustSupplies.map((c, idx) => {
                            const isPaid = (c.paymentStatus || "").toUpperCase() === "PAID";
                            const cQty = Number(c.quantity || 0);
                            const cRate = Number(c.rate || 0);
                            const cSub = Number(c.subtotal || 0) || Math.round(cQty * cRate * 100) / 100;
                            const cGstPct = c.taxPercentage !== undefined && c.taxPercentage !== null ? Number(c.taxPercentage) : 18;
                            const cGstAmt = Number(c.tax || 0) || Math.round(cSub * (cGstPct / 100) * 100) / 100;
                            return (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2.5 text-slate-600 font-medium whitespace-nowrap">{formatDate(c.date)}</td>
                                <td className="p-2.5 font-bold text-slate-900">{c.customerName || "Customer"}</td>
                                <td className="p-2.5 text-slate-600">{c.locationName || "Central"}</td>
                                <td className="p-2.5 text-right font-bold text-purple-800 tabular-nums whitespace-nowrap">{formatINR(cQty)} {c.unit || activeMaterialData.unit}</td>
                                <td className="p-2.5 text-right text-slate-600 tabular-nums whitespace-nowrap">₹{formatINR(cRate)}</td>
                                <td className="p-2.5 text-right font-semibold text-slate-700 tabular-nums whitespace-nowrap">₹{formatINR(cSub)}</td>
                                <td className="p-2.5 text-right font-bold text-amber-700 tabular-nums whitespace-nowrap">
                                  +₹{formatINR(cGstAmt)} <span className="text-[10px] text-slate-500">({cGstPct}%)</span>
                                </td>
                                <td className="p-2.5 text-right font-black text-slate-900 tabular-nums whitespace-nowrap">₹{formatINR(c.totalAmount)}</td>
                                <td className="p-2.5 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    isPaid ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                                  }`}>
                                    {isPaid ? "Paid" : "Pending"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                    No customer supplies recorded yet for {activeMaterialData.materialName}.
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Purchase Register Inward */}
            {(detailModalTab === "all" || detailModalTab === "purchases") && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Purchase History
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                    {activeMaterialData.matPurchases.length} Purchase Invoices
                  </span>
                </div>

                {activeMaterialData.matPurchases.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="max-h-60 overflow-y-auto overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Supplier / Vendor</th>
                            <th className="p-2.5 text-right">Qty</th>
                            <th className="p-2.5 text-right">Rate</th>
                            <th className="p-2.5 text-right">Subtotal</th>
                            <th className="p-2.5 text-right text-amber-700">GST (% &amp; ₹)</th>
                            <th className="p-2.5 text-right font-black">Total</th>
                            <th className="p-2.5 text-center">Payment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeMaterialData.matPurchases.map((p, idx) => {
                            const isPaid = (p.paymentStatus || "PAID").toUpperCase() === "PAID";
                            const bd = getPurchaseBreakdown(p);
                            return (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2.5 text-slate-600 font-medium whitespace-nowrap">{formatDate(p.date)}</td>
                                <td className="p-2.5 font-bold text-slate-900">{p.supplierName || p.partyName}</td>
                                <td className="p-2.5 text-right font-bold text-slate-800 tabular-nums whitespace-nowrap">{formatINR(bd.qty)} {p.unit}</td>
                                <td className="p-2.5 text-right text-slate-600 tabular-nums whitespace-nowrap">₹{formatINR(bd.rate)}</td>
                                <td className="p-2.5 text-right font-semibold text-slate-700 tabular-nums whitespace-nowrap">₹{formatINR(bd.subtotal)}</td>
                                <td className="p-2.5 text-right font-bold text-amber-700 tabular-nums whitespace-nowrap">
                                  +₹{formatINR(bd.gstAmt)} <span className="text-[10px] text-slate-500">({bd.gstPct}%)</span>
                                </td>
                                <td className="p-2.5 text-right font-black text-slate-900 tabular-nums whitespace-nowrap">
                                  <div>₹{formatINR(bd.totalAmt)}</div>
                                  {bd.transportCost > 0 && (
                                    <div className="text-[9px] text-indigo-600 font-normal">+₹{formatINR(bd.transportCost)} transport</div>
                                  )}
                                </td>
                                <td className="p-2.5 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    isPaid ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                                  }`}>
                                    {isPaid ? "Paid" : "Pending"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                    No purchase history found for this material.
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedMaterialDetail(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Supplier Purchase Statement & Inward Ledger */}
      {selectedSupplierDetail && activeSupplierData && (
        <Modal
          isOpen={!!selectedSupplierDetail}
          onClose={() => {
            setSelectedSupplierDetail(null);
            setSupplierModalSearch("");
          }}
          maxWidth="5xl"
          title={
            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-3 pr-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                      Supplier Statement
                    </span>
                    <span className="text-xs text-slate-500 font-medium">Purchase Register Inward</span>
                  </div>
                  <h2 className="text-lg font-black text-slate-900 mt-0.5">
                    {activeSupplierData.name}
                  </h2>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => openAddPurchaseModal(activeSupplierData.name)}
                  className="px-3.5 py-1.5 bg-[#1E88E5] hover:bg-blue-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer whitespace-nowrap"
                  title={`Add new purchase entry in ${activeSupplierData.name}`}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>+ Add Purchase Entry</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportSupplierExcel(activeSupplierData.name)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer whitespace-nowrap"
                  title="Download full supplier Excel statement"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>Export Excel</span>
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-5">
            {/* 5 Summary Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-stretch">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 h-full flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Purchase Value
                </span>
                <span className="text-lg font-black text-slate-900 tabular-nums whitespace-nowrap">
                  ₹{formatINR(activeSupplierData.totalAmount)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Across all materials</span>
              </div>

              <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80 h-full flex flex-col justify-between">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                  Total GST Paid
                </span>
                <span className="text-lg font-black text-amber-800 tabular-nums whitespace-nowrap">
                  +₹{formatINR(activeSupplierData.totalTax)}
                </span>
                <span className="text-[10px] text-amber-700/80 block mt-0.5">GST across bills</span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 h-full flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Invoices / Bills
                </span>
                <span className="text-lg font-black text-slate-900 tabular-nums whitespace-nowrap">
                  {activeSupplierData.invoicesCount} {activeSupplierData.invoicesCount === 1 ? "Bill" : "Bills"}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Last: {activeSupplierData.lastDate ? formatDate(activeSupplierData.lastDate) : "-"}
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 h-full flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Quantity
                </span>
                <span className="text-lg font-black text-slate-900 tabular-nums whitespace-nowrap">
                  {formatINR(activeSupplierData.totalQty)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Transport: ₹{formatINR(activeSupplierData.totalTransport)}
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 h-full flex flex-col justify-between col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Payment Status
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-sm font-black text-emerald-700 tabular-nums whitespace-nowrap">₹{formatINR(activeSupplierData.paidAmount)}</span>
                  <span className="text-[10px] text-slate-400">Paid</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-xs font-bold tabular-nums whitespace-nowrap ${activeSupplierData.pendingAmount > 0 ? "text-rose-700 font-black" : "text-slate-400"}`}>
                    ₹{formatINR(activeSupplierData.pendingAmount)}
                  </span>
                  <span className="text-[10px] text-slate-400">Pending</span>
                </div>
              </div>
            </div>

            {/* Materials Breakdown Purchased from this Supplier */}
            <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <h3 className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>Materials Purchased from {activeSupplierData.name}</span>
                </h3>
                <span className="text-[11px] font-bold text-emerald-800">
                  {Object.keys(activeSupplierData.materials).length} Distinct Items
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {Object.values(activeSupplierData.materials).map((mat, mIdx) => {
                  const lastMatchingPurchase = activeSupplierData.purchases.find(
                    p => (p.materialName || "").trim().toUpperCase() === mat.name.trim().toUpperCase()
                  );
                  return (
                    <div key={mIdx} className="bg-white p-3 rounded-xl border border-emerald-200/70 shadow-2xs flex flex-col justify-between gap-2">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-slate-900 truncate">{mat.name}</span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 shrink-0">
                            {mat.count} {mat.count === 1 ? "Bill" : "Bills"}
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline justify-between gap-2">
                          <span className="text-sm font-black text-slate-800 tabular-nums whitespace-nowrap">
                            {formatINR(mat.qty)} {mat.unit}
                          </span>
                          <span className="text-xs font-bold text-slate-600 tabular-nums whitespace-nowrap">
                            ₹{formatINR(mat.amount)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPurchaseId(null);
                          setPreselectedVendor(activeSupplierData.name);
                          setIsCustomVendorInput(false);
                          const resolvedLastTax =
                            lastMatchingPurchase?.taxPercentage !== undefined &&
                            lastMatchingPurchase?.taxPercentage !== null &&
                            String(lastMatchingPurchase.taxPercentage) !== ""
                              ? String(lastMatchingPurchase.taxPercentage)
                              : "18";
                          setFormData({
                            date: new Date().toISOString().split("T")[0],
                            supplierName: activeSupplierData.name,
                            materialName: mat.name,
                            quantity: "",
                            unit: mat.unit || "Nos",
                            rate: lastMatchingPurchase?.rate ? String(lastMatchingPurchase.rate) : "",
                            transportationFee: "0",
                            taxPercentage: resolvedLastTax,
                            paymentStatus: "Paid",
                            notes: ""
                          });
                          setIsModalOpen(true);
                        }}
                        className="w-full py-1.5 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3 h-3 shrink-0" />
                        <span>+ Repeat {mat.name} Entry</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inward Purchases Table for this Supplier */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-slate-600" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Itemized Purchases Register
                  </h3>
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                    {activeSupplierData.purchases.length} Records
                  </span>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Filter by material, notes, date..."
                      value={supplierModalSearch}
                      onChange={(e) => setSupplierModalSearch(e.target.value)}
                      className="w-full text-xs font-medium text-slate-800 placeholder:text-slate-400 bg-transparent focus:outline-none"
                    />
                    {supplierModalSearch && (
                      <button
                        onClick={() => setSupplierModalSearch("")}
                        className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openAddPurchaseModal(activeSupplierData.name)}
                    className="px-3 py-1.5 bg-[#1E88E5] hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>+ New Entry</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              {(() => {
                const modalSearchQ = supplierModalSearch.toLowerCase().trim();
                const displayPurchases = activeSupplierData.purchases.filter(p => {
                  if (!modalSearchQ) return true;
                  return (
                    (p.materialName && p.materialName.toLowerCase().includes(modalSearchQ)) ||
                    (p.date && p.date.includes(modalSearchQ)) ||
                    (p.notes && p.notes.toLowerCase().includes(modalSearchQ)) ||
                    (p.paymentStatus && p.paymentStatus.toLowerCase().includes(modalSearchQ))
                  );
                });

                const modalTotQty = displayPurchases.reduce((s, p) => s + getPurchaseBreakdown(p).qty, 0);
                const modalTotSub = displayPurchases.reduce((s, p) => s + getPurchaseBreakdown(p).subtotal, 0);
                const modalTotTax = displayPurchases.reduce((s, p) => s + getPurchaseBreakdown(p).gstAmt, 0);
                const modalTotTrans = displayPurchases.reduce((s, p) => s + getPurchaseBreakdown(p).transportCost, 0);
                const modalTotVal = displayPurchases.reduce((s, p) => s + getPurchaseBreakdown(p).totalAmt, 0);

                return (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                    <div className="max-h-80 overflow-y-auto overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-10">
                          <tr>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Material</th>
                            <th className="p-2.5 text-right">Qty</th>
                            <th className="p-2.5 text-right">Rate</th>
                            <th className="p-2.5 text-right">Subtotal</th>
                            <th className="p-2.5 text-right text-amber-700">GST (% &amp; ₹)</th>
                            <th className="p-2.5 text-right">Transport</th>
                            <th className="p-2.5 text-right font-black">Total (₹)</th>
                            <th className="p-2.5 text-center">Payment</th>
                            <th className="p-2.5">Notes</th>
                            <th className="p-2.5 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {displayPurchases.length === 0 ? (
                            <tr>
                              <td colSpan={11} className="p-6 text-center text-slate-400">
                                No purchases matching search for this supplier.
                              </td>
                            </tr>
                          ) : (
                            displayPurchases.map((p, idx) => {
                              const isPaid = (p.paymentStatus || "PAID").toUpperCase() === "PAID";
                              const bd = getPurchaseBreakdown(p);
                              const transportAmt = bd.transportCost;

                              return (
                                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="p-2.5 text-slate-600 font-medium whitespace-nowrap">
                                    {formatDate(p.date)}
                                  </td>
                                  <td className="p-2.5 font-bold text-slate-900">
                                    {p.materialName}
                                  </td>
                                  <td className="p-2.5 text-right font-bold text-slate-800 tabular-nums whitespace-nowrap">
                                    {formatINR(bd.qty)} {p.unit}
                                  </td>
                                  <td className="p-2.5 text-right text-slate-600 tabular-nums whitespace-nowrap">
                                    ₹{formatINR(bd.rate)}
                                  </td>
                                  <td className="p-2.5 text-right font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                                    ₹{formatINR(bd.subtotal)}
                                  </td>
                                  <td className="p-2.5 text-right text-amber-700 font-bold tabular-nums whitespace-nowrap">
                                    +₹{formatINR(bd.gstAmt)} <span className="text-[10px] text-slate-500">({bd.gstPct}%)</span>
                                  </td>
                                  <td className="p-2.5 text-right font-medium tabular-nums whitespace-nowrap">
                                    {transportAmt > 0 ? (
                                      <span className="text-indigo-700">₹{formatINR(transportAmt)}</span>
                                    ) : (
                                      <span className="text-slate-400">₹0</span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-right font-black text-slate-900 tabular-nums whitespace-nowrap">
                                    ₹{formatINR(bd.totalAmt)}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                                      isPaid ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                                    }`}>
                                      {isPaid ? "Paid" : "Pending"}
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-slate-500 max-w-xs truncate text-[11px]">
                                    {p.notes || "-"}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleEditPurchase(p)}
                                        className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                                        title="Edit Purchase"
                                      >
                                        <Edit3 size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDelete(p.id)}
                                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                        title="Delete Purchase"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        {displayPurchases.length > 0 && (
                          <tfoot className="bg-slate-100/90 font-black text-slate-900 border-t border-slate-200 sticky bottom-0">
                            <tr>
                              <td colSpan={2} className="p-2.5 uppercase text-[10px]">
                                Summary Totals ({displayPurchases.length} Bills)
                              </td>
                              <td className="p-2.5 text-right tabular-nums whitespace-nowrap">{formatINR(modalTotQty)}</td>
                              <td className="p-2.5"></td>
                              <td className="p-2.5 text-right tabular-nums whitespace-nowrap">₹{formatINR(modalTotSub)}</td>
                              <td className="p-2.5 text-right text-amber-800 tabular-nums whitespace-nowrap">+₹{formatINR(modalTotTax)}</td>
                              <td className="p-2.5 text-right tabular-nums whitespace-nowrap">₹{formatINR(modalTotTrans)}</td>
                              <td className="p-2.5 text-right text-emerald-800 tabular-nums whitespace-nowrap">
                                ₹{formatINR(modalTotVal)}
                              </td>
                              <td colSpan={3}></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500">
                Supplier Total: <strong className="text-emerald-800 tabular-nums">₹{formatINR(activeSupplierData.totalAmount)}</strong> across {activeSupplierData.invoicesCount} purchase bills
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openAddPurchaseModal(activeSupplierData.name)}
                  className="px-4 py-2 bg-[#1E88E5] hover:bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>+ Add Purchase in {activeSupplierData.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSupplierDetail(null);
                    setSupplierModalSearch("");
                  }}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Add/Edit Material Purchase (Rendered last so it opens cleanly on top of Supplier Statement Modal) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPurchaseId(null);
          setPreselectedVendor(null);
        }}
        title={
          editingPurchaseId
            ? `Edit Material Purchase (${formData.supplierName || "Vendor"})`
            : preselectedVendor
            ? `+ Add Purchase Entry — ${preselectedVendor}`
            : "+ Add Material Purchase"
        }
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Selected Vendor Highlight Card OR Central Inventory Banner */}
          {(() => {
            const matchedVendor = supplierSummaries.find(
              s => s.name.trim().toLowerCase() === (formData.supplierName || "").trim().toLowerCase()
            );

            if (preselectedVendor && !isCustomVendorInput) {
              return (
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                        <span>Selected Vendor / Supplier</span>
                        {matchedVendor && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-black">
                            {matchedVendor.invoicesCount} Bills • ₹{formatINR(matchedVendor.totalAmount)}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-black text-slate-900 truncate mt-0.5">
                        {formData.supplierName}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPreselectedVendor(null);
                      setIsCustomVendorInput(false);
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto shrink-0"
                  >
                    Change Vendor
                  </button>
                </div>
              );
            }

            return (
              <div className="bg-blue-50/90 border border-blue-200/90 rounded-2xl p-3.5 flex items-center gap-3 text-blue-900 shadow-2xs">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                    <span>Central Inventory (All Sites)</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-200/70 text-blue-800 uppercase">Auto</span>
                  </div>
                  <p className="text-[11px] text-blue-700 font-medium mt-0.5 leading-snug">
                    Select an existing vendor or enter a new vendor name below to record a material purchase.
                  </p>
                </div>
              </div>
            );
          })()}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Purchase Date (DD-MM-YYYY) *</label>
            <DateInput
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-semibold text-slate-800"
            />
          </div>

          {/* Vendor / Supplier Selector & Input */}
          <div className="space-y-2 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/90">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Supplier / Vendor Name *
              </label>
              {supplierSummaries.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsCustomVendorInput(false)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      !isCustomVendorInput
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Select Existing Vendor ({supplierSummaries.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomVendorInput(true);
                      setPreselectedVendor(null);
                      setFormData({ ...formData, supplierName: "" });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      isCustomVendorInput
                        ? "bg-[#1E88E5] text-white shadow-2xs"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    + New Vendor
                  </button>
                </div>
              )}
            </div>

            {!isCustomVendorInput && supplierSummaries.length > 0 ? (
              <div className="space-y-2">
                <select
                  value={
                    supplierSummaries.some(
                      s => s.name.trim().toLowerCase() === (formData.supplierName || "").trim().toLowerCase()
                    )
                      ? supplierSummaries.find(
                          s => s.name.trim().toLowerCase() === (formData.supplierName || "").trim().toLowerCase()
                        )?.name || ""
                      : ""
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__NEW__") {
                      setIsCustomVendorInput(true);
                      setPreselectedVendor(null);
                      setFormData({ ...formData, supplierName: "" });
                    } else {
                      setFormData({ ...formData, supplierName: val });
                    }
                  }}
                  required={!formData.supplierName}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none font-bold text-slate-800 cursor-pointer"
                >
                  <option value="">-- Choose a Vendor / Supplier --</option>
                  {supplierSummaries.map((s, idx) => (
                    <option key={idx} value={s.name}>
                      {s.name} ({s.invoicesCount} {s.invoicesCount === 1 ? "Bill" : "Bills"} — ₹{formatINR(s.totalAmount)})
                    </option>
                  ))}
                  <option value="__NEW__">+ Add New Vendor / Supplier...</option>
                </select>

                {/* Quick Select Vendor Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Quick Pick:</span>
                  {supplierSummaries.slice(0, 8).map((s, idx) => {
                    const isSelected = (formData.supplierName || "").trim().toLowerCase() === s.name.trim().toLowerCase();
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFormData({ ...formData, supplierName: s.name })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "bg-white hover:bg-emerald-50 text-slate-700 border border-slate-200"
                        }`}
                      >
                        <Building2 className="w-3 h-3 shrink-0" />
                        <span>{s.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <input
                type="text"
                required
                placeholder="Enter Vendor / Supplier Name (e.g. Gurukrupa Traders)"
                value={formData.supplierName}
                onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none font-bold text-slate-900"
              />
            )}
          </div>

          {/* Material Name Input + Quick Material Selector from Selected Vendor */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Material Name *</label>
            <input
              type="text"
              required
              placeholder="Cement / Steel / Sand"
              value={formData.materialName}
              onChange={(e) => setFormData({ ...formData, materialName: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-bold uppercase"
            />

            {(() => {
              const matchedVendor = supplierSummaries.find(
                s => s.name.trim().toLowerCase() === (formData.supplierName || "").trim().toLowerCase()
              );
              const vendorMats = matchedVendor ? Object.values(matchedVendor.materials) : [];
              if (vendorMats.length === 0) return null;

              return (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase mr-1">
                    {matchedVendor?.name} Materials (Click to auto-fill):
                  </span>
                  {vendorMats.map((m, mIdx) => {
                    const isSelectedMat = (formData.materialName || "").trim().toUpperCase() === m.name.trim().toUpperCase();
                    const lastBill = matchedVendor?.purchases.find(
                      p => (p.materialName || "").trim().toUpperCase() === m.name.trim().toUpperCase()
                    );
                    return (
                      <button
                        key={mIdx}
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            materialName: m.name,
                            unit: m.unit || formData.unit,
                            rate: lastBill?.rate ? String(lastBill.rate) : formData.rate,
                            taxPercentage: lastBill?.taxPercentage ? String(lastBill.taxPercentage) : formData.taxPercentage
                          });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          isSelectedMat
                            ? "bg-blue-600 text-white shadow-2xs"
                            : "bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/80"
                        }`}
                      >
                        <Package className="w-3 h-3 shrink-0" />
                        <span>{m.name}</span>
                        {lastBill?.rate && (
                          <span className="opacity-80 text-[10px]">(@₹{formatINR(lastBill.rate)}/{m.unit})</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Quantity *</label>
              <input
                type="number"
                step="any"
                required
                min="0.01"
                placeholder="100"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Unit (UOM) *</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-medium"
              >
                <option value="Nos">Nos</option>
                <option value="Bags">Bags</option>
                <option value="Ton">Ton</option>
                <option value="Kg">Kg</option>
                <option value="Brass">Brass</option>
                <option value="CFT">CFT</option>
                <option value="Cum">Cum</option>
                <option value="Sq.ft">Sq.ft</option>
                <option value="Trip">Trip</option>
                <option value="Load">Load</option>
                <option value="Ltr">Ltr</option>
                <option value="Mtr">Mtr</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Rate (₹/Unit) *</label>
              <input
                type="number"
                step="any"
                required
                min="0.01"
                placeholder="350"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">GST Tax (%)</label>
              <select
                value={formData.taxPercentage}
                onChange={(e) => setFormData({ ...formData, taxPercentage: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-medium"
              >
                <option value="0">0% (None / Exempt)</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18% (Standard)</option>
                <option value="28">28%</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                <span>Transportation Fee (₹)</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={formData.transportationFee}
                onChange={(e) => setFormData({ ...formData, transportationFee: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Status</label>
              <select
                value={formData.paymentStatus}
                onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-semibold text-slate-800"
              >
                <option value="Paid">Paid</option>
                <option value="Pending">Pending / Unpaid</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes / Description (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Invoice #9821, Delivery by truck GJ01-1234"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-medium"
            />
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 gap-2 min-w-0">
              <span className="truncate">Subtotal (Qty &times; Rate):</span>
              <span className="font-semibold tabular-nums shrink-0 font-mono whitespace-nowrap">
                ₹{formatINR((parseFloat(formData.quantity) || 0) * (parseFloat(formData.rate) || 0))}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600 gap-2 min-w-0">
              <span className="truncate">GST ({formData.taxPercentage}%):</span>
              <span className="font-semibold tabular-nums shrink-0 font-mono whitespace-nowrap">
                ₹{formatINR(((parseFloat(formData.quantity) || 0) * (parseFloat(formData.rate) || 0)) * ((parseFloat(formData.taxPercentage) || 0) / 100))}
              </span>
            </div>
            {(parseFloat(formData.transportationFee) || 0) > 0 && (
              <div className="flex items-center justify-between text-xs text-blue-700 gap-2 min-w-0">
                <span className="truncate">Transportation Fee:</span>
                <span className="font-bold tabular-nums shrink-0 font-mono whitespace-nowrap">
                  + ₹{formatINR(parseFloat(formData.transportationFee) || 0)}
                </span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2 min-w-0">
              <span className="text-xs font-bold text-slate-900 uppercase truncate">Grand Total:</span>
              <span className="text-base font-black text-slate-900 tabular-nums shrink-0 font-mono whitespace-nowrap">
                ₹{formatINR(
                  ((parseFloat(formData.quantity) || 0) * (parseFloat(formData.rate) || 0)) * (1 + (parseFloat(formData.taxPercentage) || 0) / 100) +
                  (parseFloat(formData.transportationFee) || 0)
                )}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingPurchaseId(null);
                setPreselectedVendor(null);
              }}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-[#1E88E5] hover:bg-blue-600 rounded-xl transition-all cursor-pointer shadow-sm"
            >
              {editingPurchaseId
                ? "Update Purchase"
                : formData.supplierName
                ? `Save Entry in ${formData.supplierName}`
                : "Save Purchase"}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
