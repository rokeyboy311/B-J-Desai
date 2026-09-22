import React, { useState, useEffect, useMemo } from "react";
import { 
  Package, ShoppingCart, Truck, Wrench, Search, Plus, 
  ArrowDownLeft, ArrowUpRight, AlertTriangle, CheckCircle2, 
  Layers, Filter, RefreshCw, FileSpreadsheet, Building2, Wallet, Trash2
} from "lucide-react";
import { motion } from "motion/react";
import { apiFetch } from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { useLiveSync, triggerGlobalSync } from "../hooks/useLiveSync";
import { Modal } from "../components/ui/Modal";

interface CentralStockItem {
  id: number;
  name: string;
  category: string;
  unit: string;
  rate: number;
  minStock: number;
  totalInward: number;
  totalOutward: number;
  currentBalance: number;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
}

export default function MaterialPurchasePage() {
  const { showToast, confirmAction } = useToast();
  const [activeTab, setActiveTab] = useState<"stock" | "purchases" | "customer_supplies" | "site_supplies">("stock");
  const [stockItems, setStockItems] = useState<CentralStockItem[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [customerSupplies, setCustomerSupplies] = useState<any[]>([]);
  const [siteSupplies, setSiteSupplies] = useState<any[]>([]);
  const [adminCapital, setAdminCapital] = useState<{ availableAdminCapital: number } | null>(null);
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [purchaseLocationFilter, setPurchaseLocationFilter] = useState<string>("ALL");
  const [purchaseMaterialFilter, setPurchaseMaterialFilter] = useState<string>("ALL");
  const [customerLocationFilter, setCustomerLocationFilter] = useState<string>("ALL");
  const [customerMaterialFilter, setCustomerMaterialFilter] = useState<string>("ALL");
  const [siteLocationFilter, setSiteLocationFilter] = useState<string>("ALL");
  const [siteMaterialFilter, setSiteMaterialFilter] = useState<string>("ALL");

  // Purchase Modal
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    date: new Date().toISOString().split("T")[0],
    partyName: "",
    materialName: "",
    materialId: "",
    quantity: "",
    unit: "Unit",
    rate: "",
    taxPercentage: "18",
    transportCost: "0",
    discount: "0",
    locationId: "",
    paymentStatus: "PAID",
    paidAmount: "",
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    notes: ""
  });

  const loadData = async (isBackground = false) => {
    try {
      if (!isBackground && stockItems.length === 0) setLoading(true);
      const [stockRes, adminRes, purchRes, custRes, siteRes, locRes] = await Promise.all([
        apiFetch("/materials/central-stock").catch(() => []),
        apiFetch("/investments/admin-capital-summary").catch(() => null),
        apiFetch("/materials/purchase?locationId=ALL").catch(() => []),
        apiFetch("/materials/customer-supplies-history").catch(() => []),
        apiFetch("/materials/site-supplies-history").catch(() => []),
        apiFetch("/locations").catch(() => [])
      ]);

      if (Array.isArray(stockRes)) setStockItems(stockRes);
      if (adminRes) setAdminCapital(adminRes);
      if (Array.isArray(purchRes)) setPurchases(purchRes);
      if (Array.isArray(custRes)) setCustomerSupplies(custRes);
      if (Array.isArray(siteRes)) setSiteSupplies(siteRes);
      if (Array.isArray(locRes)) setLocations(locRes);
    } catch (err) {
      console.error("Failed to load material data", err);
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

  // Real-time calculation for purchase modal
  const purchaseCalculations = useMemo(() => {
    const qty = parseFloat(purchaseForm.quantity) || 0;
    const rate = parseFloat(purchaseForm.rate) || 0;
    const disc = parseFloat(purchaseForm.discount) || 0;
    const taxPct = parseFloat(purchaseForm.taxPercentage) || 0;
    const transport = parseFloat(purchaseForm.transportCost) || 0;

    const subtotal = Math.round(qty * rate * 100) / 100;
    const taxable = Math.max(0, subtotal - disc);
    const taxAmount = Math.round(taxable * (taxPct / 100) * 100) / 100;
    const total = Math.round((taxable + taxAmount + transport) * 100) / 100;

    return { subtotal, taxable, taxAmount, total };
  }, [purchaseForm.quantity, purchaseForm.rate, purchaseForm.discount, purchaseForm.taxPercentage, purchaseForm.transportCost]);

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(purchaseForm.quantity);
    const rate = parseFloat(purchaseForm.rate);
    if (!qty || qty <= 0 || !rate || rate <= 0) {
      showToast("Please enter a valid quantity and rate", "error");
      return;
    }

    if (!purchaseForm.materialName.trim()) {
      showToast("Please enter or select a material name", "error");
      return;
    }

    if (!purchaseForm.locationId) {
      showToast("Please select a Purchase Location (ખરીદી સ્થળ)", "error");
      return;
    }

    const totalAmount = purchaseCalculations.total;
    const availableCap = adminCapital?.availableAdminCapital || 0;

    if (totalAmount > availableCap) {
      showToast(`Purchase total ₹${totalAmount.toLocaleString("en-IN")} exceeds Available Admin Capital (₹${availableCap.toLocaleString("en-IN")})!`, "error");
      return;
    }

    try {
      const locId = parseInt(purchaseForm.locationId, 10);
      
      await apiFetch("/materials/purchase", {
        method: "POST",
        body: JSON.stringify({
          locationId: locId,
          date: purchaseForm.date,
          partyName: purchaseForm.partyName.trim() || "CENTRAL SUPPLIER",
          materialName: purchaseForm.materialName.trim().toUpperCase(),
          materialId: purchaseForm.materialId ? parseInt(purchaseForm.materialId, 10) : null,
          quantity: qty,
          unit: purchaseForm.unit,
          rate: rate,
          discount: parseFloat(purchaseForm.discount) || 0,
          taxPercentage: parseFloat(purchaseForm.taxPercentage) || 0,
          transportCost: parseFloat(purchaseForm.transportCost) || 0,
          totalAmount: totalAmount,
          paymentStatus: purchaseForm.paymentStatus,
          paidAmount: purchaseForm.paymentStatus === "PAID" ? totalAmount : (parseFloat(purchaseForm.paidAmount) || 0),
          paymentMethod: purchaseForm.paymentMethod,
          referenceNumber: purchaseForm.referenceNumber,
          notes: purchaseForm.notes
        })
      });

      showToast(`Material Purchase of ${qty} ${purchaseForm.unit} recorded! Funded by Admin Capital.`, "success");
      setIsPurchaseModalOpen(false);
      setPurchaseForm({
        date: new Date().toISOString().split("T")[0],
        partyName: "",
        materialName: "",
        materialId: "",
        quantity: "",
        unit: "Unit",
        rate: "",
        taxPercentage: "18",
        transportCost: "0",
        discount: "0",
        locationId: "",
        paymentStatus: "PAID",
        paidAmount: "",
        paymentMethod: "Bank Transfer",
        referenceNumber: "",
        notes: ""
      });
      triggerGlobalSync();
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to record purchase", "error");
    }
  };

  const handleDeleteStockMaterial = async (id: number, name: string) => {
    const confirmed = await confirmAction({
      title: "Delete Material from Stock",
      message: `Are you sure you want to delete material "${name}" from the Central Stock Ledger?`,
      confirmLabel: "Delete Material",
      isDanger: true
    });
    if (!confirmed) return;

    try {
      await apiFetch(`/materials/stock/${id}`, { method: "DELETE" });
      showToast(`Material "${name}" deleted successfully`, "success");
      triggerGlobalSync();
      loadData(false);
    } catch (err: any) {
      showToast(err.message || "Failed to delete material", "error");
    }
  };

  const handleDeletePurchase = async (id: number, partyName: string, materialName: string) => {
    const confirmed = await confirmAction({
      title: "Delete Material Purchase",
      message: `Are you sure you want to delete purchase of "${materialName}" from "${partyName || 'Supplier'}"? Central stock will be updated.`,
      confirmLabel: "Delete Purchase",
      isDanger: true
    });
    if (!confirmed) return;

    try {
      await apiFetch(`/materials/purchase/${id}`, { method: "DELETE" });
      showToast(`Purchase record deleted successfully`, "success");
      triggerGlobalSync();
      loadData(false);
    } catch (err: any) {
      showToast(err.message || "Failed to delete purchase record", "error");
    }
  };

  const handleDeleteCustomerSupply = async (id: number, customerName: string, materialName: string) => {
    const confirmed = await confirmAction({
      title: "Delete Customer Supply (Sales OUT)",
      message: `Are you sure you want to delete supply record of "${materialName}" to "${customerName}"? Stock balance will be restored automatically.`,
      confirmLabel: "Delete Supply",
      isDanger: true
    });
    if (!confirmed) return;

    try {
      await apiFetch(`/materials/supply/${id}`, { method: "DELETE" });
      showToast(`Customer supply record deleted and stock restored`, "success");
      triggerGlobalSync();
      loadData(false);
    } catch (err: any) {
      showToast(err.message || "Failed to delete supply record", "error");
    }
  };

  const handleDeleteSiteSupply = async (id: number, teamName: string, materialName: string) => {
    const confirmed = await confirmAction({
      title: "Delete Site Supply (Labour Team OUT)",
      message: `Are you sure you want to delete site supply record of "${materialName}" to "${teamName || 'Site Team'}"? Stock balance will be restored automatically.`,
      confirmLabel: "Delete Site Supply",
      isDanger: true
    });
    if (!confirmed) return;

    try {
      await apiFetch(`/materials/site-supply/${id}`, { method: "DELETE" });
      showToast(`Site supply record deleted and stock restored`, "success");
      triggerGlobalSync();
      loadData(false);
    } catch (err: any) {
      showToast(err.message || "Failed to delete site supply record", "error");
    }
  };

  // Filtered stock
  const filteredStock = useMemo(() => {
    return stockItems.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [stockItems, searchTerm, statusFilter]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-8 pb-20"
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-tr from-amber-600 to-orange-500 text-white rounded-2xl shadow-lg shadow-orange-500/20">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                Central Inventory
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Material Purchase & Central Stock
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Admin Capital Funded Purchasing, Stock Inward & Location Supply Ledger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 flex items-center gap-2.5">
            <Wallet className="w-4 h-4 text-emerald-600" />
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Available Admin Capital</span>
              <span className="text-sm font-black text-emerald-800">
                ₹{adminCapital ? adminCapital.availableAdminCapital.toLocaleString("en-IN") : "0"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!purchaseForm.locationId && locations.length > 0) {
                setPurchaseForm(prev => ({ ...prev, locationId: locations[0].id.toString() }));
              }
              setIsPurchaseModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Material Purchase</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("stock")}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "stock"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Central Stock Ledger ({stockItems.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("purchases")}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "purchases"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Purchase History (Stock IN)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("customer_supplies")}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "customer_supplies"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Customer Supplies (Sales OUT)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("site_supplies")}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "site_supplies"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Site Supplies (Labour Teams OUT)
        </button>
      </div>

      {/* TAB 1: Central Stock Ledger */}
      {activeTab === "stock" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search materials by name or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              >
                <option value="ALL">All Stock Statuses</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="LOW_STOCK">Low Stock</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="py-3 px-4">Material Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Inward (IN)</th>
                    <th className="py-3 px-4 text-right">Outward (OUT)</th>
                    <th className="py-3 px-4 text-right">Current Balance</th>
                    <th className="py-3 px-4 text-right">Default Rate</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStock.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400 text-sm">
                        No materials found. Record your first material purchase above.
                      </td>
                    </tr>
                  ) : (
                    filteredStock.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">{m.name}</td>
                        <td className="py-3 px-4 text-slate-600">{m.category}</td>
                        <td className="py-3 px-4 text-right font-medium text-emerald-600">
                          +{m.totalInward} {m.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-rose-600">
                          -{m.totalOutward} {m.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900">
                          {m.currentBalance} {m.unit}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700">
                          ₹{m.rate.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {m.status === "IN_STOCK" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> In Stock
                            </span>
                          )}
                          {m.status === "LOW_STOCK" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3" /> Low Stock
                            </span>
                          )}
                          {m.status === "OUT_OF_STOCK" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Out of Stock
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteStockMaterial(m.id, m.name)}
                            title={`Delete ${m.name}`}
                            className="inline-flex items-center justify-center p-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-200 shadow-2xs"
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
        </div>
      )}

      {/* TAB 2: Purchase History */}
      {activeTab === "purchases" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={purchaseLocationFilter}
                onChange={(e) => setPurchaseLocationFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Purchase Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id.toString()}>{loc.name}</option>
                ))}
              </select>

              <select
                value={purchaseMaterialFilter}
                onChange={(e) => setPurchaseMaterialFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Materials</option>
                {Array.from(new Set(purchases.map(p => p.materialName).filter(Boolean))).map((mat) => (
                  <option key={mat} value={mat}>{mat}</option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 font-semibold">
              Showing {purchases.filter(p => (purchaseLocationFilter === "ALL" || String(p.locationId) === purchaseLocationFilter) && (purchaseMaterialFilter === "ALL" || p.materialName?.toUpperCase() === purchaseMaterialFilter.toUpperCase())).length} of {purchases.length} purchases
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Supplier / Party</th>
                    <th className="py-3 px-4">Purchase Location</th>
                    <th className="py-3 px-4">Material</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4 text-right">Rate</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                    <th className="py-3 px-4 text-center">Funding Source</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchases.filter(p => (purchaseLocationFilter === "ALL" || String(p.locationId) === purchaseLocationFilter) && (purchaseMaterialFilter === "ALL" || p.materialName?.toUpperCase() === purchaseMaterialFilter.toUpperCase())).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-slate-400">
                        No material purchases found matching selected criteria.
                      </td>
                    </tr>
                  ) : (
                    purchases
                      .filter(p => (purchaseLocationFilter === "ALL" || String(p.locationId) === purchaseLocationFilter) && (purchaseMaterialFilter === "ALL" || p.materialName?.toUpperCase() === purchaseMaterialFilter.toUpperCase()))
                      .map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{p.date}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{p.partyName || "Central Supplier"}</td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              {p.locationName || "Central / Site"}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-indigo-700">{p.materialName}</td>
                          <td className="py-3 px-4 text-right font-medium whitespace-nowrap">{p.quantity} {p.unit}</td>
                          <td className="py-3 px-4 text-right text-slate-700 whitespace-nowrap">₹{parseFloat(p.rate || 0).toLocaleString("en-IN")}</td>
                          <td className="py-3 px-4 text-right font-black text-slate-900 whitespace-nowrap">₹{parseFloat(p.totalAmount || 0).toLocaleString("en-IN")}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                              Admin Capital
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeletePurchase(p.id, p.partyName, p.materialName)}
                              title={`Delete Purchase of ${p.materialName}`}
                              className="inline-flex items-center justify-center p-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-200 shadow-2xs"
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
        </div>
      )}

      {/* TAB 3: Customer Supplies History */}
      {activeTab === "customer_supplies" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={customerLocationFilter}
                onChange={(e) => setCustomerLocationFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Project Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id.toString()}>{loc.name}</option>
                ))}
              </select>

              <select
                value={customerMaterialFilter}
                onChange={(e) => setCustomerMaterialFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Materials</option>
                {Array.from(new Set(customerSupplies.map(s => s.materialName))).filter(Boolean).map((mName) => (
                  <option key={mName} value={mName}>{mName}</option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing {customerSupplies.filter(s => (customerLocationFilter === "ALL" || String(s.locationId) === customerLocationFilter) && (customerMaterialFilter === "ALL" || s.materialName?.toUpperCase() === customerMaterialFilter.toUpperCase())).length} records &bull; Total Value: ₹{customerSupplies
                .filter(s => (customerLocationFilter === "ALL" || String(s.locationId) === customerLocationFilter) && (customerMaterialFilter === "ALL" || s.materialName?.toUpperCase() === customerMaterialFilter.toUpperCase()))
                .reduce((acc, s) => acc + (parseFloat(s.totalAmount || 0) || 0), 0)
                .toLocaleString("en-IN")}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Material</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4 text-right">Total (GST)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customerSupplies.filter(s => (customerLocationFilter === "ALL" || String(s.locationId) === customerLocationFilter) && (customerMaterialFilter === "ALL" || s.materialName?.toUpperCase() === customerMaterialFilter.toUpperCase())).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400">
                        No customer material supplies matching the selected filter.
                      </td>
                    </tr>
                  ) : (
                    customerSupplies
                      .filter(s => (customerLocationFilter === "ALL" || String(s.locationId) === customerLocationFilter) && (customerMaterialFilter === "ALL" || s.materialName?.toUpperCase() === customerMaterialFilter.toUpperCase()))
                      .map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 text-slate-600">{s.date}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{s.customerName}</td>
                          <td className="py-3 px-4 text-slate-600">{s.locationName || "-"}</td>
                          <td className="py-3 px-4 font-semibold text-orange-700">{s.materialName}</td>
                          <td className="py-3 px-4 text-right font-medium">{s.quantity} {s.unit}</td>
                          <td className="py-3 px-4 text-right font-black text-slate-900">₹{parseFloat(s.totalAmount || 0).toLocaleString("en-IN")}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              s.paymentStatus === "PAID" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}>
                              {s.paymentStatus}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomerSupply(s.id, s.customerName, s.materialName)}
                              title={`Delete Supply to ${s.customerName}`}
                              className="inline-flex items-center justify-center p-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-200 shadow-2xs"
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
        </div>
      )}

      {/* TAB 4: Site Supplies History */}
      {activeTab === "site_supplies" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={siteLocationFilter}
                onChange={(e) => setSiteLocationFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Project Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id.toString()}>{loc.name}</option>
                ))}
              </select>

              <select
                value={siteMaterialFilter}
                onChange={(e) => setSiteMaterialFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Materials</option>
                {Array.from(new Set(siteSupplies.map(ss => ss.materialName))).filter(Boolean).map((mName) => (
                  <option key={mName} value={mName}>{mName}</option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing {siteSupplies.filter(ss => (siteLocationFilter === "ALL" || String(ss.locationId) === siteLocationFilter) && (siteMaterialFilter === "ALL" || ss.materialName?.toUpperCase() === siteMaterialFilter.toUpperCase())).length} records &bull; Total Value: ₹{siteSupplies
                .filter(ss => (siteLocationFilter === "ALL" || String(ss.locationId) === siteLocationFilter) && (siteMaterialFilter === "ALL" || ss.materialName?.toUpperCase() === siteMaterialFilter.toUpperCase()))
                .reduce((acc, ss) => acc + (parseFloat(ss.amount || 0) || 0), 0)
                .toLocaleString("en-IN")}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Labour Team / Supervisor</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Material</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {siteSupplies.filter(ss => (siteLocationFilter === "ALL" || String(ss.locationId) === siteLocationFilter) && (siteMaterialFilter === "ALL" || ss.materialName?.toUpperCase() === siteMaterialFilter.toUpperCase())).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        No site supplies matching the selected filter.
                      </td>
                    </tr>
                  ) : (
                    siteSupplies
                      .filter(ss => (siteLocationFilter === "ALL" || String(ss.locationId) === siteLocationFilter) && (siteMaterialFilter === "ALL" || ss.materialName?.toUpperCase() === siteMaterialFilter.toUpperCase()))
                      .map((ss) => (
                        <tr key={ss.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 text-slate-600">{ss.date}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {ss.teamName || ss.responsiblePerson || "Site Team"}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{ss.locationName || "-"}</td>
                          <td className="py-3 px-4 font-semibold text-teal-700">{ss.materialName}</td>
                          <td className="py-3 px-4 text-right font-medium">{ss.quantity} {ss.unit}</td>
                          <td className="py-3 px-4 text-right font-black text-slate-900">₹{parseFloat(ss.amount || 0).toLocaleString("en-IN")}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteSiteSupply(ss.id, ss.teamName || ss.responsiblePerson, ss.materialName)}
                              title={`Delete Site Supply of ${ss.materialName}`}
                              className="inline-flex items-center justify-center p-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-200 shadow-2xs"
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
        </div>
      )}

      {/* MODAL: Record Material Purchase */}
      <Modal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        title="Record New Material Purchase (Funded by Admin Capital)"
      >
        <form onSubmit={handleCreatePurchase} className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-900">Available Admin Capital:</span>
            <span className="text-sm font-black text-indigo-700">
              ₹{adminCapital ? adminCapital.availableAdminCapital.toLocaleString("en-IN") : "0"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
              <input
                type="date"
                required
                value={purchaseForm.date}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Supplier / Vendor Name</label>
              <input
                type="text"
                placeholder="e.g. UltraTech Cement Agency"
                value={purchaseForm.partyName}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, partyName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Material Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. CEMENT, STEEL"
                value={purchaseForm.materialName}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, materialName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Unit</label>
              <select
                value={purchaseForm.unit}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, unit: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Bags">Bags</option>
                <option value="Kg">Kg</option>
                <option value="Ton">Ton</option>
                <option value="Brass">Brass</option>
                <option value="Nos">Nos</option>
                <option value="Sq.Ft">Sq.Ft</option>
                <option value="R.Ft">R.Ft</option>
                <option value="Unit">Unit</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Quantity *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="100"
                value={purchaseForm.quantity}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Rate (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="350"
                value={purchaseForm.rate}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, rate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">GST %</label>
              <select
                value={purchaseForm.taxPercentage}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, taxPercentage: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Transport Cost (₹)</label>
              <input
                type="number"
                step="0.01"
                value={purchaseForm.transportCost}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, transportCost: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Purchase Location (ખરીદી સ્થળ) *
              </label>
              <select
                required
                value={purchaseForm.locationId}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, locationId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="">Select Purchase Location</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">Record of where the material was purchased/delivered.</p>
            </div>
          </div>

          {/* Real-time total card */}
          <div className="bg-slate-100 rounded-xl p-3.5 space-y-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold">₹{purchaseCalculations.subtotal.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>GST ({purchaseForm.taxPercentage}%):</span>
              <span className="font-semibold">₹{purchaseCalculations.taxAmount.toLocaleString("en-IN")}</span>
            </div>
            {parseFloat(purchaseForm.transportCost) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Transport:</span>
                <span className="font-semibold">₹{parseFloat(purchaseForm.transportCost).toLocaleString("en-IN")}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
              <span>Total Purchase Amount:</span>
              <span className="text-indigo-700">₹{purchaseCalculations.total.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsPurchaseModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer"
            >
              Confirm Purchase (Stock IN)
            </button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
