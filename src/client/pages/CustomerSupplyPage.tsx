import React, { useState, useEffect, useMemo } from "react";
import { 
  Users, Plus, Search, Building2, Download, Edit3, Trash2, ChevronDown, ChevronUp, RefreshCw, Wallet, Package, Coins, DollarSign
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { useLiveSync, triggerSync } from "../hooks/useLiveSync";
import { Modal } from "../components/ui/Modal";
import { downloadExcelReport } from "../lib/excelExport";
import { formatINR, formatDate } from "../lib/formatters";
import { DateInput } from "../components/ui/DateInput";

export default function CustomerSupplyPage() {
  const { showToast, confirmAction } = useToast();
  const [supplies, setSupplies] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedLocation, setSelectedLocation] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [materials, setMaterials] = useState<any[]>([]);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    locationId: "",
    date: new Date().toISOString().split("T")[0],
    partyName: "",
    materialId: "",
    materialName: "",
    quantity: "",
    unit: "Nos",
    rate: "",
    taxPercentage: "18",
    paymentStatus: "Paid",
    notes: ""
  });

  const loadData = async (isBackground = false) => {
    try {
      if (!isBackground && supplies.length === 0) setLoading(true);
      const [suppliesData, locsData, matsData] = await Promise.all([
        apiFetch(`/materials/supply`).catch(() => []),
        apiFetch("/locations").catch(() => []),
        apiFetch("/master/materials").catch(() => [])
      ]);

      if (Array.isArray(suppliesData)) setSupplies(suppliesData);
      if (Array.isArray(locsData)) setLocations(locsData);
      if (Array.isArray(matsData)) setMaterials(matsData);
    } catch (err) {
      console.error("Failed to load customer supplies:", err);
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

  // Filtered List
  const filteredSupplies = useMemo(() => {
    return supplies.filter((s) => {
      const matchLoc = selectedLocation === "ALL" || s.locationId?.toString() === selectedLocation;
      const matchSearch = (s.partyName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.materialName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.locationName || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === "ALL" || (s.paymentStatus || "").toUpperCase() === statusFilter.toUpperCase();
      return matchLoc && matchSearch && matchStatus;
    });
  }, [supplies, selectedLocation, searchQuery, statusFilter]);

  // Overall KPI Summaries
  const totalSupplyVal = filteredSupplies.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);
  const totalQty = filteredSupplies.reduce((acc, s) => acc + Number(s.quantity || 0), 0);
  const totalTaxable = Math.round(totalSupplyVal * 0.82);
  const totalGST = Math.round(totalSupplyVal * 0.18);
  const grandTotal = totalSupplyVal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.locationId) {
      showToast("Please select project location", "error");
      return;
    }

    try {
      const qty = parseFloat(formData.quantity) || 0;
      const rate = parseFloat(formData.rate) || 0;
      const taxPct = parseFloat(formData.taxPercentage) || 0;
      const subtotal = qty * rate;
      const tax = subtotal * (taxPct / 100);
      const totalAmount = subtotal + tax;

      const payload = {
        locationId: parseInt(formData.locationId, 10),
        date: formData.date,
        partyName: formData.partyName.trim(),
        materialId: formData.materialId ? parseInt(formData.materialId, 10) : null,
        materialName: formData.materialName.trim().toUpperCase(),
        quantity: qty,
        unit: formData.unit,
        rate: rate,
        taxPercentage: taxPct,
        tax: tax,
        subtotal: subtotal,
        totalAmount: totalAmount,
        paidAmount: formData.paymentStatus === "Paid" ? totalAmount : 0,
        outstandingAmount: formData.paymentStatus === "Paid" ? 0 : totalAmount,
        paymentStatus: formData.paymentStatus.toUpperCase(),
        description: formData.notes
      };

      const url = editingId ? `/materials/supply/${editingId}` : "/materials/supply";
      const method = editingId ? "PUT" : "POST";

      await apiFetch(url, { method, body: JSON.stringify(payload) });

      triggerSync("materials");
      showToast(editingId ? "Customer supply updated!" : "Customer supply saved and stock deducted!", "success");
      setIsModalOpen(false);
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to save customer supply", "error");
    }
  };

  const handleEdit = (s: any) => {
    setEditingId(s.id);
    setFormData({
      locationId: s.locationId ? s.locationId.toString() : (locations[0]?.id?.toString() || ""),
      date: s.date || new Date().toISOString().split("T")[0],
      partyName: s.partyName || "",
      materialId: s.materialId ? s.materialId.toString() : "",
      materialName: s.materialName || "",
      quantity: s.quantity ? s.quantity.toString() : "",
      unit: s.unit || "Nos",
      rate: s.rate ? s.rate.toString() : "",
      taxPercentage: s.taxPercentage ? s.taxPercentage.toString() : "18",
      paymentStatus: (s.paymentStatus || "PAID").toUpperCase() === "PAID" ? "Paid" : "Pending",
      notes: s.description || ""
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirmAction({
      title: "Delete Customer Supply",
      message: "Are you sure you want to delete this record?",
      confirmLabel: "Delete",
      isDanger: true
    });
    if (!confirmed) return;

    try {
      await apiFetch(`/materials/supply/${id}`, { method: "DELETE" });
      showToast("Record deleted", "success");
      loadData(true);
    } catch (err: any) {
      showToast(err.message || "Failed to delete record", "error");
    }
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header matching 05_customer_supply.svg */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Customer Supply</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Manage external material supply</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setFormData({
              locationId: locations[0]?.id?.toString() || "",
              date: new Date().toISOString().split("T")[0],
              partyName: "",
              materialId: "",
              materialName: "",
              quantity: "",
              unit: "Nos",
              rate: "",
              taxPercentage: "18",
              paymentStatus: "Paid",
              notes: ""
            });
            setIsModalOpen(true);
          }}
          className="px-4 py-2.5 bg-[#1E88E5] hover:bg-blue-600 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Customer Supply</span>
        </button>
      </div>

      {/* Top 5 KPI Cards matching 05_customer_supply.svg */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 items-stretch">
        
        <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
          <div className="p-2 sm:p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Total Supply</span>
            <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums whitespace-nowrap block mt-0.5">
              ₹{formatINR(totalSupplyVal)}
            </span>
          </div>
        </div>

        <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
          <div className="p-2 sm:p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Total Quantity</span>
            <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums whitespace-nowrap block mt-0.5">
              {formatINR(totalQty)}
            </span>
          </div>
        </div>

        <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
          <div className="p-2 sm:p-2.5 bg-purple-50 text-purple-600 rounded-xl shrink-0">
            <Coins className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Taxable Amount</span>
            <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums whitespace-nowrap block mt-0.5">
              ₹{formatINR(totalTaxable)}
            </span>
          </div>
        </div>

        <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3">
          <div className="p-2 sm:p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Total GST</span>
            <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums whitespace-nowrap block mt-0.5">
              ₹{formatINR(totalGST)}
            </span>
          </div>
        </div>

        <div className="bg-white h-full min-h-[76px] p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 sm:gap-3 col-span-2 sm:col-span-1">
          <div className="p-2 sm:p-2.5 bg-[#0B1D3A] text-white rounded-xl shrink-0">
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight block truncate">Grand Total</span>
            <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums whitespace-nowrap block mt-0.5">
              ₹{formatINR(grandTotal)}
            </span>
          </div>
        </div>

      </div>

      {/* Filters Section matching 05_customer_supply.svg */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="text-xs font-bold text-slate-800">Filters</div>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search customer or material..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-60 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none"
          />
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            <option value="ALL">All Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id.toString()}>{loc.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>
      </div>

      {/* Customer Supply Table matching 05_customer_supply.svg */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Customer Supply Records</h2>
          <span className="text-xs font-semibold text-slate-500">{filteredSupplies.length} Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Location</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Material</th>
                <th className="p-3.5 text-right">Qty</th>
                <th className="p-3.5 text-right">Rate</th>
                <th className="p-3.5 text-center">GST %</th>
                <th className="p-3.5 text-right font-black">Grand Total</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSupplies.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">No customer supply records found.</td>
                </tr>
              ) : (
                filteredSupplies.map((s) => {
                  const status = (s.paymentStatus || "PAID").toUpperCase();
                  const isPaid = status === "PAID";

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5 text-slate-600 font-medium whitespace-nowrap">{formatDate(s.date)}</td>
                      <td className="p-3.5 font-semibold text-slate-800">{s.locationName || "Project Site"}</td>
                      <td className="p-3.5 font-bold text-slate-900">{s.partyName}</td>
                      <td className="p-3.5 font-semibold text-blue-700">{s.materialName}</td>
                      <td className="p-3.5 text-right font-bold text-slate-800 tabular-nums">
                        {formatINR(s.quantity)} {s.unit}
                      </td>
                      <td className="p-3.5 text-right font-medium text-slate-700 tabular-nums">
                        ₹{formatINR(s.rate)}
                      </td>
                      <td className="p-3.5 text-center font-semibold text-slate-600">
                        {s.taxPercentage || 18}%
                      </td>
                      <td className="p-3.5 text-right font-black text-slate-900 tabular-nums">
                        ₹{formatINR(s.totalAmount)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          isPaid ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {isPaid ? "Paid" : "Pending"}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEdit(s)}
                            className="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Record"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Record"
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

      {/* Modal: Add/Edit Customer Supply */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? "Edit Customer Supply" : "+ Add Customer Supply"}
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Location *</label>
              <select
                required
                value={formData.locationId}
                onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none"
              >
                <option value="">-- Choose Location --</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date (DD-MM-YYYY) *</label>
              <DateInput
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Customer Name *</label>
              <input
                type="text"
                required
                placeholder="ABC Traders / Patel Infra"
                value={formData.partyName}
                onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Material *</label>
              <select
                required
                value={formData.materialId}
                onChange={(e) => {
                  const matId = e.target.value;
                  const sel = materials.find(m => m.id.toString() === matId);
                  if (sel) {
                    const activeRate = (sel.defaultRate && parseFloat(sel.defaultRate) > 0)
                      ? String(sel.defaultRate)
                      : (sel.rate && parseFloat(sel.rate) > 0 ? String(sel.rate) : "0");
                    setFormData(prev => ({
                      ...prev,
                      materialId: matId,
                      materialName: sel.name,
                      unit: sel.defaultUnit || sel.unit || "Nos",
                      rate: activeRate
                    }));
                  } else {
                    setFormData(prev => ({
                      ...prev,
                      materialId: "",
                      materialName: "",
                      unit: "Nos",
                      rate: ""
                    }));
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Material --</option>
                {materials.map((m) => {
                  const r = parseFloat(m.defaultRate || m.rate || '0');
                  return (
                    <option key={m.id} value={m.id}>
                      {m.name} (Stock: {m.currentStock ?? 0} {m.defaultUnit || m.unit || 'Nos'}{r > 0 ? ` • ₹${r}/${m.defaultUnit || m.unit || 'Nos'}` : ''})
                    </option>
                  );
                })}
              </select>
              {formData.materialId && (
                <div className="mt-1 flex items-center justify-between text-[11px] font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                  {(() => {
                    const sel = materials.find(m => m.id.toString() === formData.materialId);
                    const stock = sel?.currentStock ?? 0;
                    return (
                      <>
                        <span className={stock > 0 ? "text-emerald-700 font-extrabold" : "text-rose-600 font-extrabold"}>
                          📦 Stock: {stock} {formData.unit}
                        </span>
                        <span className="text-slate-600">
                          🏷️ Rate: ₹{parseFloat(sel?.defaultRate || sel?.rate || '0')} / {formData.unit}
                        </span>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Qty *</label>
              <input
                type="number"
                step="any"
                required
                placeholder="500"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-bold"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase">Unit</label>
                <span className="text-[9px] font-semibold text-blue-700 bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                  Auto
                </span>
              </div>
              <input
                type="text"
                readOnly
                tabIndex={-1}
                value={formData.unit}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-sm focus:outline-none font-bold text-slate-700 cursor-not-allowed select-none"
                title="Auto-detected from stock inventory"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase">Rate (₹) *</label>
                <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                  Auto
                </span>
              </div>
              <input
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
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

          {/* Live Calculation Preview */}
          {(() => {
            const q = parseFloat(formData.quantity) || 0;
            const r = parseFloat(formData.rate) || 0;
            const sub = q * r;
            const gstPct = parseFloat(formData.taxPercentage) || 0;
            const gst = (sub * gstPct) / 100;
            const tot = sub + gst;
            return (
              <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-1.5 shadow-inner">
                <div className="flex items-center justify-between text-xs text-slate-300 gap-2 min-w-0">
                  <span className="truncate">Subtotal ({q} × ₹{r}):</span>
                  <span className="shrink-0 font-mono font-medium tabular-nums">₹{formatINR(sub)}</span>
                </div>
                {gstPct > 0 && (
                  <div className="flex items-center justify-between text-xs text-blue-300 gap-2 min-w-0">
                    <span className="truncate">GST ({gstPct}%):</span>
                    <span className="shrink-0 font-mono font-medium tabular-nums">+₹{formatINR(gst)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm font-bold text-emerald-400 pt-1.5 border-t border-slate-800 gap-2 min-w-0">
                  <span className="truncate">Total Supply Amount:</span>
                  <span className="shrink-0 font-mono font-black tabular-nums text-base">₹{formatINR(tot)}</span>
                </div>
              </div>
            );
          })()}

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
              Save Record
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
