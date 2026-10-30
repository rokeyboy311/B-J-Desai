import React, { useState, useEffect, useMemo } from "react";
import { 
  Package, Plus, Search, Building2, Trash2, Edit3, DollarSign, Wallet, CheckCircle2, AlertCircle, 
  ArrowRight, BarChart2, Eye, MapPin, Users, ShoppingBag, Layers, ArrowUpRight, ArrowDownRight,
  TrendingUp, Calendar, Info, X, Truck
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { useLiveSync, triggerSync } from "../hooks/useLiveSync";
import { Modal } from "../components/ui/Modal";
import { useGoogleSync } from "../contexts/GoogleSyncContext";
import { FileSpreadsheet } from "lucide-react";
import { formatINR, formatDate } from "../lib/formatters";

export default function MaterialPurchasePage() {
  const { showToast, confirmAction } = useToast();
  const { isConnected, setIsModalOpen: setGoogleModalOpen, centralSpreadsheetUrl } = useGoogleSync();
  
  const [activeTab, setActiveCategory] = useState<"purchase" | "stock">("purchase");
  
  // Data
  const [purchases, setPurchases] = useState<any[]>([]);
  const [centralStock, setCentralStock] = useState<any[]>([]);
  const [customerSupplies, setCustomerSupplies] = useState<any[]>([]);
  const [siteSupplies, setSiteSupplies] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<number | null>(null);
  const [selectedMaterialDetail, setSelectedMaterialDetail] = useState<{ name: string; id?: number | null } | null>(null);
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
      showToast(editingPurchaseId ? "Material purchase updated!" : "Material purchase recorded in Central Inventory for all sites!", "success");
      setIsModalOpen(false);
      setEditingPurchaseId(null);
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
    setEditingPurchaseId(p.id);
    setFormData({
      date: p.date || new Date().toISOString().split("T")[0],
      supplierName: p.supplierName || p.partyName || "",
      materialName: p.materialName || "",
      quantity: p.quantity ? String(p.quantity) : "",
      unit: p.unit || "Nos",
      rate: p.rate ? String(p.rate) : "",
      transportationFee: p.transportCost ? String(p.transportCost) : (p.transportationFee ? String(p.transportationFee) : ""),
      taxPercentage: p.taxPercentage ? String(p.taxPercentage) : "18",
      paymentStatus: (p.paymentStatus || "PAID").toUpperCase() === "PAID" ? "Paid" : "Pending",
      notes: p.notes || p.description || ""
    });
    setIsModalOpen(true);
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

  // Filtered lists
  const filteredPurchases = useMemo(() => {
    if (!searchQuery.trim()) return purchases;
    const q = searchQuery.toLowerCase().trim();
    return purchases.filter(p => 
      (p.materialName && p.materialName.toLowerCase().includes(q)) ||
      (p.supplierName && p.supplierName.toLowerCase().includes(q)) ||
      (p.partyName && p.partyName.toLowerCase().includes(q)) ||
      (p.date && p.date.includes(q))
    );
  }, [purchases, searchQuery]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {activeTab === "purchase" ? "Material Purchase" : "Material Stock"}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {activeTab === "purchase" ? "Purchase materials and add to central stock" : "Track central material inventory for all sites"}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Sub-tab toggle */}
          <div className="bg-slate-200/80 p-1 rounded-xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveCategory("purchase")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "purchase" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
              }`}
            >
              Purchases
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory("stock")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "stock" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
              }`}
            >
              Stock Inventory
            </button>
          </div>

          <button
            type="button"
            onClick={() => setGoogleModalOpen(true)}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Manage Google Sheets Live Sync"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">{isConnected ? "Sheets Live" : "Sheets Sync"}</span>
            {isConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingPurchaseId(null);
              setFormData({
                date: new Date().toISOString().split("T")[0],
                supplierName: "",
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
            }}
            className="px-4 py-2.5 bg-[#1E88E5] hover:bg-blue-600 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Material Purchase</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: PURCHASE VIEW */}
      {activeTab === "purchase" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-[#0B1D3A] text-white rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total Purchase</span>
              <span className="text-sm font-bold text-slate-800 tabular-nums">
                ₹{formatINR(totalPurchaseVal)}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Purchase Qty</span>
              <span className="text-sm font-bold text-slate-800 tabular-nums">
                {formatINR(totalPurchaseQty)}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">GST</span>
              <span className="text-sm font-bold text-slate-800 tabular-nums">
                ₹{formatINR(totalPurchaseGST)}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Transport Fee</span>
              <span className="text-sm font-bold text-indigo-700 tabular-nums">
                ₹{formatINR(totalTransportFee)}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Stock Added</span>
              <span className="text-sm font-bold text-slate-800 tabular-nums">
                ₹{formatINR(stockAddedVal)}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3 col-span-2 sm:col-span-1">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Pending Payments</span>
              <span className="text-sm font-bold text-slate-800 tabular-nums">
                ₹{formatINR(pendingPayments)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* KPI Cards: STOCK VIEW */
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Materials</span>
              <span className="text-sm font-bold text-slate-800 tabular-nums">
                {stockCount}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-[#0B1D3A] text-white rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Purchased Qty</span>
              <span className="text-sm font-bold text-slate-800 tabular-nums">
                {formatINR(stockPurchasedQty)}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Supplied Qty</span>
              <span className="text-sm font-bold text-slate-800 tabular-nums">
                {formatINR(stockSuppliedQty)}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Available Qty</span>
              <span className="text-sm font-bold text-slate-800 tabular-nums">
                {formatINR(stockAvailableQty)}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3 col-span-2 lg:col-span-1">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Stock Value</span>
              <span className="text-sm font-bold text-slate-800 tabular-nums">
                ₹{formatINR(totalStockVal)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input 
          type="text"
          placeholder={activeTab === "purchase" ? "Search purchases by material, supplier, date..." : "Search inventory materials by name, category..."}
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

      {/* TABLE SECTION: Purchase Register or Material Inventory */}
      {activeTab === "purchase" ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">Purchase Register</h2>
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
                Central Inventory
              </span>
            </div>
            <span className="text-xs font-semibold text-slate-500">{filteredPurchases.length} Records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Supplier</th>
                  <th className="p-3.5">Material (Click for Supply History)</th>
                  <th className="p-3.5 text-right">Qty</th>
                  <th className="p-3.5 text-right">Rate</th>
                  <th className="p-3.5 text-center">GST %</th>
                  <th className="p-3.5 text-right">Transport Fee</th>
                  <th className="p-3.5 text-right font-black">Grand Total</th>
                  <th className="p-3.5 text-center">Payment</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      {searchQuery ? "No matching purchase records found." : "No purchase records found."}
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((p) => {
                    const isPaid = (p.paymentStatus || "PAID").toUpperCase() === "PAID";
                    const transportAmt = Number(p.transportCost || 0);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3.5 text-slate-600 font-medium whitespace-nowrap">{formatDate(p.date)}</td>
                        <td className="p-3.5 font-bold text-slate-900">{p.supplierName || p.partyName}</td>
                        
                        {/* Interactive Clickable Material Name Div */}
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

                        <td className="p-3.5 text-right font-bold text-slate-800 tabular-nums">
                          {formatINR(p.quantity)} {p.unit}
                        </td>
                        <td className="p-3.5 text-right font-medium text-slate-700 tabular-nums">
                          ₹{formatINR(p.rate)}
                        </td>
                        <td className="p-3.5 text-center font-semibold text-slate-600">
                          {p.taxPercentage || 18}%
                        </td>
                        <td className="p-3.5 text-right font-bold tabular-nums">
                          {transportAmt > 0 ? (
                            <span className="text-indigo-700 font-bold">₹{formatINR(transportAmt)}</span>
                          ) : (
                            <span className="text-slate-400 font-normal">₹0</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right font-black text-slate-900 tabular-nums">
                          <div>₹{formatINR(p.totalAmount)}</div>
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
                        
                        {/* Actions: Stock View, Edit & Delete Button */}
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Stock View Button */}
                            <button
                              type="button"
                              onClick={() => openMaterialDetail(p.materialName, p.materialId)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-[11px] border border-slate-200 hover:border-blue-300 transition-all cursor-pointer shadow-2xs"
                              title="View Central Stock & Location Supply Details"
                            >
                              <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
                              <span>Stock View</span>
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
            </table>
          </div>
        </div>
      ) : (
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

      {/* Modal: Add/Edit Material Purchase */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPurchaseId(null);
        }}
        title={editingPurchaseId ? "Edit Material Purchase" : "+ Add Material Purchase"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Central Inventory Banner */}
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
                This purchase is automatically saved to the enterprise central stock for all construction sites.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Purchase Date *</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-semibold text-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Supplier / Vendor Name *</label>
              <input
                type="text"
                required
                placeholder="Shree Cement / Patel Traders"
                value={formData.supplierName}
                onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Material Name *</label>
              <input
                type="text"
                required
                placeholder="Cement / Steel / Sand"
                value={formData.materialName}
                onChange={(e) => setFormData({ ...formData, materialName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-bold uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
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

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Subtotal (Qty &times; Rate):</span>
              <span className="font-semibold tabular-nums">
                ₹{formatINR((parseFloat(formData.quantity) || 0) * (parseFloat(formData.rate) || 0))}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>GST ({formData.taxPercentage}%):</span>
              <span className="font-semibold tabular-nums">
                ₹{formatINR(((parseFloat(formData.quantity) || 0) * (parseFloat(formData.rate) || 0)) * ((parseFloat(formData.taxPercentage) || 0) / 100))}
              </span>
            </div>
            {(parseFloat(formData.transportationFee) || 0) > 0 && (
              <div className="flex items-center justify-between text-xs text-blue-700">
                <span>Transportation Fee:</span>
                <span className="font-bold tabular-nums">
                  + ₹{formatINR(parseFloat(formData.transportationFee) || 0)}
                </span>
              </div>
            )}
            <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase">Grand Total:</span>
              <span className="text-base font-black text-slate-900 tabular-nums">
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
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-[#1E88E5] hover:bg-blue-600 rounded-xl transition-all cursor-pointer shadow-sm"
            >
              Save Purchase
            </button>
          </div>
        </form>
      </Modal>

      {/* COMPREHENSIVE MODAL: Material Supply Details & Location-wise Distribution */}
      {selectedMaterialDetail && activeMaterialData && (
        <Modal
          isOpen={!!selectedMaterialDetail}
          onClose={() => setSelectedMaterialDetail(null)}
          title={`Material Supply & Stock Details: ${activeMaterialData.materialName}`}
          maxWidth="4xl"
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
            <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2">
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
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Location / Site</th>
                            <th className="p-2.5">Team / Recipient</th>
                            <th className="p-2.5">Work Description</th>
                            <th className="p-2.5 text-right">Qty</th>
                            <th className="p-2.5 text-right">Rate</th>
                            <th className="p-2.5 text-right font-black">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeMaterialData.matSiteSupplies.map((s, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2.5 text-slate-600 font-medium whitespace-nowrap">{formatDate(s.date)}</td>
                              <td className="p-2.5 font-bold text-slate-900">{s.locationName || `Site #${s.locationId}`}</td>
                              <td className="p-2.5 font-semibold text-blue-700">{s.teamName || s.responsiblePerson || "Site Team"}</td>
                              <td className="p-2.5 text-slate-600 max-w-xs truncate">{s.workDescription || "-"}</td>
                              <td className="p-2.5 text-right font-bold text-slate-800 tabular-nums">{formatINR(s.quantity)} {activeMaterialData.unit}</td>
                              <td className="p-2.5 text-right text-slate-600 tabular-nums">₹{formatINR(s.rate)}</td>
                              <td className="p-2.5 text-right font-black text-slate-900 tabular-nums">₹{formatINR(s.amount)}</td>
                            </tr>
                          ))}
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
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Customer Name</th>
                            <th className="p-2.5">Project Location</th>
                            <th className="p-2.5 text-right">Qty</th>
                            <th className="p-2.5 text-right">Rate</th>
                            <th className="p-2.5 text-right font-black">Amount</th>
                            <th className="p-2.5 text-center">Payment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeMaterialData.matCustSupplies.map((c, idx) => {
                            const isPaid = (c.paymentStatus || "").toUpperCase() === "PAID";
                            return (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2.5 text-slate-600 font-medium whitespace-nowrap">{formatDate(c.date)}</td>
                                <td className="p-2.5 font-bold text-slate-900">{c.customerName || "Customer"}</td>
                                <td className="p-2.5 text-slate-600">{c.locationName || "Central"}</td>
                                <td className="p-2.5 text-right font-bold text-purple-800 tabular-nums">{formatINR(c.quantity)} {c.unit || activeMaterialData.unit}</td>
                                <td className="p-2.5 text-right text-slate-600 tabular-nums">₹{formatINR(c.rate)}</td>
                                <td className="p-2.5 text-right font-black text-slate-900 tabular-nums">₹{formatINR(c.totalAmount)}</td>
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
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Supplier / Vendor</th>
                            <th className="p-2.5 text-right">Qty</th>
                            <th className="p-2.5 text-right">Rate</th>
                            <th className="p-2.5 text-center">GST</th>
                            <th className="p-2.5 text-right font-black">Total</th>
                            <th className="p-2.5 text-center">Payment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeMaterialData.matPurchases.map((p, idx) => {
                            const isPaid = (p.paymentStatus || "PAID").toUpperCase() === "PAID";
                            return (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2.5 text-slate-600 font-medium whitespace-nowrap">{formatDate(p.date)}</td>
                                <td className="p-2.5 font-bold text-slate-900">{p.supplierName || p.partyName}</td>
                                <td className="p-2.5 text-right font-bold text-slate-800 tabular-nums">{formatINR(p.quantity)} {p.unit}</td>
                                <td className="p-2.5 text-right text-slate-600 tabular-nums">₹{formatINR(p.rate)}</td>
                                <td className="p-2.5 text-center text-slate-600">{p.taxPercentage || 18}%</td>
                                <td className="p-2.5 text-right font-black text-slate-900 tabular-nums">
                                  <div>₹{formatINR(p.totalAmount)}</div>
                                  {Number(p.transportCost || 0) > 0 && (
                                    <div className="text-[9px] text-indigo-600 font-normal">+₹{formatINR(p.transportCost)} transport</div>
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

    </div>
  );
}
