import React, { useState, useEffect } from "react";
import { 
  Package, Plus, Search, AlertTriangle, ArrowUpDown, 
  Edit, Trash2, CheckCircle2, SlidersHorizontal, RefreshCw, X, Box, AlertCircle
} from "lucide-react";
import { apiFetch } from "../lib/api";

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [selectedItemForAdjust, setSelectedItemForAdjust] = useState<any | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    type: "PRODUCT",
    hsnCode: "",
    unit: "Nos",
    salePrice: 0,
    purchasePrice: 0,
    taxRate: 18,
    openingStock: 0,
    minStockAlert: 5,
    description: ""
  });

  // Adjust stock state
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustType, setAdjustType] = useState<"ADD" | "SUBTRACT">("ADD");
  const [adjustReason, setAdjustReason] = useState("Stock Adjustment");

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/items");
      const list = Array.isArray(data) ? data : data?.items || [];
      setItems(list);
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      type: "PRODUCT",
      hsnCode: "",
      unit: "Nos",
      salePrice: 0,
      purchasePrice: 0,
      taxRate: 18,
      openingStock: 0,
      minStockAlert: 5,
      description: ""
    });
    setItemModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      type: item.type,
      hsnCode: item.hsnCode || "",
      unit: item.unit,
      salePrice: parseFloat(item.salePrice || "0"),
      purchasePrice: parseFloat(item.purchasePrice || "0"),
      taxRate: parseFloat(item.taxRate || "18"),
      openingStock: parseFloat(item.openingStock || "0"),
      minStockAlert: parseFloat(item.minStockAlert || "5"),
      description: item.description || ""
    });
    setItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setActionError("Please enter item name");
      return;
    }

    try {
      const url = editingItem ? `/items/${editingItem.id}` : "/items";
      const method = editingItem ? "PUT" : "POST";

      await apiFetch(url, {
        method,
        body: JSON.stringify(formData)
      });

      setItemModalOpen(false);
      setActionSuccess(editingItem ? "Item updated successfully" : "Item created successfully");
      setTimeout(() => setActionSuccess(null), 4000);
      fetchItems();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Error saving item");
      setTimeout(() => setActionError(null), 5000);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAdjust || adjustQty <= 0) {
      setActionError("Please enter valid adjustment quantity");
      return;
    }

    try {
      await apiFetch(`/items/${selectedItemForAdjust.id}/adjust-stock`, {
        method: "POST",
        body: JSON.stringify({
          adjustmentQuantity: adjustQty,
          adjustmentType: adjustType,
          reason: adjustReason
        })
      });

      setAdjustModalOpen(false);
      setSelectedItemForAdjust(null);
      setAdjustQty(1);
      setActionSuccess("Stock level adjusted and recorded in audit log");
      setTimeout(() => setActionSuccess(null), 4000);
      fetchItems();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to adjust stock");
      setTimeout(() => setActionError(null), 5000);
    }
  };

  const handleDeleteItem = async (id: number) => {
    try {
      await apiFetch(`/items/${id}`, { method: "DELETE" });
      setActionSuccess("Item removed from catalog");
      setTimeout(() => setActionSuccess(null), 4000);
      fetchItems();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to delete item");
      setTimeout(() => setActionError(null), 5000);
    }
  };

  // KPIs
  const totalItemsCount = items.length;
  const lowStockItems = items.filter(i => i.type === "PRODUCT" && parseFloat(i.currentStock || "0") <= parseFloat(i.minStockAlert || "0"));
  const stockValuation = items.reduce((acc, i) => {
    if (i.type === "PRODUCT") {
      return acc + (parseFloat(i.currentStock || "0") * parseFloat(i.purchasePrice || "0"));
    }
    return acc;
  }, 0);

  // Filtered Items
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.hsnCode && item.hsnCode.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = typeFilter === "ALL" || item.type === typeFilter;
    const matchesLowStock = !lowStockOnly || (item.type === "PRODUCT" && parseFloat(item.currentStock || "0") <= parseFloat(item.minStockAlert || "0"));

    return matchesSearch && matchesType && matchesLowStock;
  });

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Package className="text-indigo-600" size={26} /> Inventory & Items Catalog
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage product catalog, services, HSN/SAC codes, stock levels and adjustments
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-all shadow-md shadow-indigo-600/20 active:scale-95"
          >
            <Plus size={18} /> Add New Item
          </button>
        </div>

        {actionSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800"><X size={14} /></button>
          </div>
        )}

        {actionError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-rose-600 hover:text-rose-800"><X size={14} /></button>
          </div>
        )}

        {/* Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Catalog Size</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalItemsCount}</p>
            <span className="text-xs text-slate-500 mt-1 block">Products & Services</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-amber-600">Low Stock Alerts</span>
            <p className="text-2xl font-bold text-amber-600 mt-1">{lowStockItems.length}</p>
            <span className="text-xs text-slate-500 mt-1 block">Items below safety threshold</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-600">Stock Valuation</span>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              ₹{stockValuation.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-xs text-slate-500 mt-1 block">Asset Value (at Purchase Cost)</span>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search product name, HSN..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1.5">
              {["ALL", "PRODUCT", "SERVICE"].map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    typeFilter === t
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                lowStockOnly
                  ? "bg-amber-500 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <AlertTriangle size={14} /> Low Stock
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="p-4">Item Name</th>
                  <th className="p-4 text-center">Type</th>
                  <th className="p-4 text-center">HSN/SAC</th>
                  <th className="p-4 text-right">Sale Price (₹)</th>
                  <th className="p-4 text-right">Purchase Price (₹)</th>
                  <th className="p-4 text-center">GST %</th>
                  <th className="p-4 text-right">Current Stock</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      Loading items...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      <Box size={36} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-700">No Items Found</p>
                      <p className="text-xs text-slate-400 mt-1">Click "Add New Item" to create your inventory catalog.</p>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => {
                    const currentStock = parseFloat(item.currentStock || "0");
                    const minStock = parseFloat(item.minStockAlert || "0");
                    const isLowStock = item.type === "PRODUCT" && currentStock <= minStock;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="p-4">
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          {item.description && (
                            <span className="text-xs text-slate-400 block truncate max-w-xs">{item.description}</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                            item.type === "PRODUCT" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="p-4 text-center font-mono text-xs text-slate-600">
                          {item.hsnCode || "-"}
                        </td>
                        <td className="p-4 text-right font-mono font-medium text-slate-900">
                          ₹{parseFloat(item.salePrice || "0").toFixed(2)}
                        </td>
                        <td className="p-4 text-right font-mono text-slate-600">
                          ₹{parseFloat(item.purchasePrice || "0").toFixed(2)}
                        </td>
                        <td className="p-4 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 rounded font-mono text-xs font-semibold text-slate-700">
                            {item.taxRate}%
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {item.type === "PRODUCT" ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className={`font-mono font-bold ${
                                isLowStock ? "text-amber-600" : "text-slate-900"
                              }`}>
                                {currentStock} {item.unit}
                              </span>
                              {isLowStock && (
                                <AlertTriangle size={14} className="text-amber-500" title="Low Stock" />
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">N/A (Service)</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.type === "PRODUCT" && (
                              <button
                                onClick={() => {
                                  setSelectedItemForAdjust(item);
                                  setAdjustQty(1);
                                  setAdjustModalOpen(true);
                                }}
                                title="Adjust Stock"
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              >
                                <ArrowUpDown size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => openEditModal(item)}
                              title="Edit Item"
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              title="Delete Item"
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
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
      </div>

      {/* CREATE / EDIT ITEM MODAL */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">
                  {editingItem ? "Edit Catalog Item" : "Create New Catalog Item"}
                </h3>
                <p className="text-xs text-slate-500">Define product details, prices, HSN and GST tax rate</p>
              </div>
              <button onClick={() => setItemModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Item Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. UltraTech Cement 50kg"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Item Classification</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="PRODUCT">Product / Material (Track Inventory)</option>
                    <option value="SERVICE">Service / Labour / Consultancy</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">HSN / SAC Code</label>
                  <input
                    type="text"
                    value={formData.hsnCode}
                    onChange={e => setFormData({ ...formData, hsnCode: e.target.value })}
                    placeholder="e.g. 2523"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Measurement Unit</label>
                  <select
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="Nos">Nos</option>
                    <option value="Bags">Bags</option>
                    <option value="Ton">Ton</option>
                    <option value="Kg">Kg</option>
                    <option value="Mtr">Mtr</option>
                    <option value="Sq.Ft">Sq.Ft</option>
                    <option value="Trips">Trips</option>
                    <option value="Hours">Hours</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GST Tax Rate</label>
                  <select
                    value={formData.taxRate}
                    onChange={e => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-indigo-700"
                  >
                    <option value="0">0% (Nil / Exempt)</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18% (Standard)</option>
                    <option value="28">28% (Luxury / Cement)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Selling / Invoicing Price (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.salePrice}
                    onChange={e => setFormData({ ...formData, salePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase / Cost Price (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.purchasePrice}
                    onChange={e => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              {formData.type === "PRODUCT" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {editingItem ? "Initial Opening Stock" : "Opening Stock"}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      disabled={!!editingItem}
                      value={formData.openingStock}
                      onChange={e => setFormData({ ...formData, openingStock: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono disabled:opacity-60"
                    />
                    {editingItem && (
                      <span className="text-[11px] text-slate-400 mt-0.5 block">Use Stock Adjustment to update ongoing stock</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Low Stock Alert Threshold</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formData.minStockAlert}
                      onChange={e => setFormData({ ...formData, minStockAlert: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  placeholder="Optional item notes or technical specifications..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md shadow-indigo-600/20"
                >
                  {editingItem ? "Update Item" : "Create Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUST STOCK MODAL */}
      {adjustModalOpen && selectedItemForAdjust && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Adjust Physical Stock</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedItemForAdjust.name}</p>
              </div>
              <button onClick={() => setAdjustModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdjustStock} className="p-5 space-y-4 text-xs sm:text-sm">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <span className="text-slate-500">Current On-Hand Stock:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {selectedItemForAdjust.currentStock} {selectedItemForAdjust.unit}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Adjustment Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType("ADD")}
                    className={`py-2 px-3 rounded-xl font-semibold text-xs transition-colors ${
                      adjustType === "ADD"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    + Add (Stock In / Surplus)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType("SUBTRACT")}
                    className={`py-2 px-3 rounded-xl font-semibold text-xs transition-colors ${
                      adjustType === "SUBTRACT"
                        ? "bg-rose-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    - Deduct (Damaged / Lost)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity ({selectedItemForAdjust.unit}) *</label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  value={adjustQty}
                  onChange={e => setAdjustQty(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Reference</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder="e.g. Physical inventory reconciliation"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20"
                >
                  Save Stock Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
