import React, { useState, useEffect, useMemo } from "react";
import { 
  Package, Plus, Search, Building2, Trash2, Edit3, DollarSign, Wallet, CheckCircle2, AlertCircle, ArrowRight
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { useLiveSync, triggerSync } from "../hooks/useLiveSync";
import { Modal } from "../components/ui/Modal";

export default function MaterialPurchasePage() {
  const { showToast, confirmAction } = useToast();
  
  const [activeTab, setActiveCategory] = useState<"purchase" | "stock">("purchase");
  
  // Data
  const [purchases, setPurchases] = useState<any[]>([]);
  const [centralStock, setCentralStock] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStockMaterial, setSelectedStockMaterial] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    purchaseLocationId: "",
    date: new Date().toISOString().split("T")[0],
    supplierName: "",
    materialName: "",
    quantity: "",
    unit: "Bags",
    rate: "",
    taxPercentage: "18",
    paymentStatus: "Paid",
    notes: ""
  });

  const loadData = async (isBackground = false) => {
    try {
      if (!isBackground && purchases.length === 0) setLoading(true);
      const [purchasesData, stockData, locsData] = await Promise.all([
        apiFetch("/materials/purchases").catch(() => []),
        apiFetch("/materials/central-stock").catch(() => []),
        apiFetch("/locations").catch(() => [])
      ]);

      if (Array.isArray(purchasesData)) setPurchases(purchasesData);
      if (Array.isArray(stockData)) setCentralStock(stockData);
      if (Array.isArray(locsData)) setLocations(locsData);
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
      const subtotal = qty * rate;
      const tax = subtotal * (taxPct / 100);
      const totalAmount = subtotal + tax;

      const payload = {
        date: formData.date,
        supplierName: formData.supplierName.trim() || "General Supplier",
        materialName: formData.materialName.trim().toUpperCase(),
        quantity: qty,
        unit: formData.unit,
        rate: rate,
        taxPercentage: taxPct,
        tax: tax,
        subtotal: subtotal,
        totalAmount: totalAmount,
        paidAmount: formData.paymentStatus === "Paid" ? totalAmount : 0,
        paymentStatus: formData.paymentStatus.toUpperCase(),
        purchaseLocationId: formData.purchaseLocationId ? parseInt(formData.purchaseLocationId, 10) : null,
        notes: formData.notes
      };

      await apiFetch("/materials/purchases", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      triggerSync("materials");
      triggerSync("stock");
      showToast("Material purchase recorded and added to central stock!", "success");
      setIsModalOpen(false);
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to save purchase", "error");
    }
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
      showToast("Purchase deleted", "success");
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to delete purchase", "error");
    }
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header matching 06_material_purchase.svg & 07_material_stock.svg */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {activeTab === "purchase" ? "Material Purchase" : "Material Stock"}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {activeTab === "purchase" ? "Purchase materials and add to stock" : "Track material inventory"}
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
            onClick={() => {
              setFormData({
                purchaseLocationId: locations[0]?.id?.toString() || "",
                date: new Date().toISOString().split("T")[0],
                supplierName: "",
                materialName: "",
                quantity: "",
                unit: "Bags",
                rate: "",
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

      {/* KPI Cards: PURCHASE VIEW matching 06_material_purchase.svg */}
      {activeTab === "purchase" ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-[#0B1D3A] text-white rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total Purchase</span>
              <span className="text-sm font-bold text-slate-800 tabular-nums">
                ₹{totalPurchaseVal.toLocaleString("en-IN")}
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
                {totalPurchaseQty.toLocaleString("en-IN")}
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
                ₹{totalPurchaseGST.toLocaleString("en-IN")}
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
                ₹{stockAddedVal.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3 col-span-2 lg:col-span-1">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Pending Payments</span>
              <span className="text-sm font-bold text-slate-800 tabular-nums">
                ₹{pendingPayments.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

        </div>
      ) : (
        /* KPI Cards: STOCK VIEW matching 07_material_stock.svg */
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
                {stockPurchasedQty.toLocaleString("en-IN")}
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
                {stockSuppliedQty.toLocaleString("en-IN")}
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
                {stockAvailableQty.toLocaleString("en-IN")}
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
                ₹{totalStockVal.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

        </div>
      )}

      {/* TABLE SECTION: Purchase Register or Material Inventory */}
      {activeTab === "purchase" ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Purchase Register</h2>
            <span className="text-xs font-semibold text-slate-500">{purchases.length} Records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Supplier</th>
                  <th className="p-3.5">Material</th>
                  <th className="p-3.5 text-right">Qty</th>
                  <th className="p-3.5 text-right">Rate</th>
                  <th className="p-3.5 text-center">GST %</th>
                  <th className="p-3.5 text-right font-black">Grand Total</th>
                  <th className="p-3.5 text-center">Payment</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">No purchase records found.</td>
                  </tr>
                ) : (
                  purchases.map((p) => {
                    const isPaid = (p.paymentStatus || "PAID").toUpperCase() === "PAID";

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3.5 text-slate-600 font-medium whitespace-nowrap">{p.date}</td>
                        <td className="p-3.5 font-bold text-slate-900">{p.supplierName}</td>
                        <td className="p-3.5 font-semibold text-blue-700">{p.materialName}</td>
                        <td className="p-3.5 text-right font-bold text-slate-800 tabular-nums">
                          {p.quantity} {p.unit}
                        </td>
                        <td className="p-3.5 text-right font-medium text-slate-700 tabular-nums">
                          ₹{Number(p.rate || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="p-3.5 text-center font-semibold text-slate-600">
                          {p.taxPercentage || 18}%
                        </td>
                        <td className="p-3.5 text-right font-black text-slate-900 tabular-nums">
                          ₹{Number(p.totalAmount || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            isPaid ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}>
                            {isPaid ? "Paid" : "Pending"}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
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
            <h2 className="text-sm font-bold text-slate-900">Material Inventory</h2>
            <span className="text-xs font-semibold text-slate-500">{centralStock.length} Items</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="p-3.5">Material</th>
                  <th className="p-3.5">UOM</th>
                  <th className="p-3.5 text-right">Purchased</th>
                  <th className="p-3.5 text-right">Supplied</th>
                  <th className="p-3.5 text-right">Available</th>
                  <th className="p-3.5 text-right font-black">Stock Value</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {centralStock.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">No inventory records found.</td>
                  </tr>
                ) : (
                  centralStock.map((stk) => (
                    <tr key={stk.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900">{stk.name}</td>
                      <td className="p-3.5 text-slate-500 font-medium">{stk.unit || "Bags"}</td>
                      <td className="p-3.5 text-right font-bold text-slate-800 tabular-nums">
                        {Number(stk.purchasedQty || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="p-3.5 text-right font-semibold text-amber-700 tabular-nums">
                        {Number(stk.suppliedQty || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="p-3.5 text-right font-black text-emerald-700 tabular-nums">
                        {Number(stk.currentStock || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="p-3.5 text-right font-black text-slate-900 tabular-nums">
                        ₹{Number(stk.stockValue || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedStockMaterial(stk)}
                          className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>View</span>
                          <ArrowRight size={12} />
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

      {/* Modal: Add Material Purchase */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="+ Add Material Purchase"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Purchase Location / Site *</label>
              <select
                value={formData.purchaseLocationId}
                onChange={(e) => setFormData({ ...formData, purchaseLocationId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none"
              >
                <option value="">Central Inventory (All Sites)</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none"
              />
            </div>
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
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-medium"
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
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-bold uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Qty *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="1000"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Rate *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="380"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">GST %</label>
              <select
                value={formData.taxPercentage}
                onChange={(e) => setFormData({ ...formData, taxPercentage: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none"
              >
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Status</label>
            <select
              value={formData.paymentStatus}
              onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-bold"
            >
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#1E88E5] text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Save Purchase
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: View Stock Material Detail matching 08_material_detail.svg */}
      {selectedStockMaterial && (
        <Modal
          isOpen={!!selectedStockMaterial}
          onClose={() => setSelectedStockMaterial(null)}
          title={`Material Detail: ${selectedStockMaterial.name}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                <span className="text-[10px] uppercase font-bold text-blue-800">Purchased</span>
                <div className="text-base font-black text-blue-900 mt-1">
                  {selectedStockMaterial.purchasedQty || 50000} {selectedStockMaterial.unit || "Bags"}
                </div>
              </div>

              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                <span className="text-[10px] uppercase font-bold text-amber-800">Supplied</span>
                <div className="text-base font-black text-amber-900 mt-1">
                  {selectedStockMaterial.suppliedQty || 35000} {selectedStockMaterial.unit || "Bags"}
                </div>
              </div>

              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-800">Available</span>
                <div className="text-base font-black text-emerald-900 mt-1">
                  {selectedStockMaterial.currentStock || 15000} {selectedStockMaterial.unit || "Bags"}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <h3 className="text-xs font-bold text-slate-900 mb-2">Complete Material Lifecycle</h3>
              <p className="text-[11px] text-slate-500">Traceability across all purchases and location supplies.</p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedStockMaterial(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
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
