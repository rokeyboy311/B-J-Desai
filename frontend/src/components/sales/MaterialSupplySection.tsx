import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { 
  Plus, Truck, Trash2, IndianRupee, Pencil, 
  Search, Filter, CheckCircle2, Clock, AlertCircle, X, Building2
} from "lucide-react";

const PRESET_UNITS = [
  "Nos", "Bags", "Ton", "Kg", "Brass", "CFT", "Cum", "Sq.ft", "Sq.m", "Trip", "Load", "Ltr", "Mtr", "Custom"
];

interface MaterialSupplySectionProps {
  locationId?: number | "all";
}

export default function MaterialSupplySection({ locationId = "all" }: MaterialSupplySectionProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [unitMode, setUnitMode] = useState<string>("Bags");
  const [customUnit, setCustomUnit] = useState<string>("");

  const [formData, setFormData] = useState({
    locationId: 0,
    date: new Date().toISOString().split("T")[0],
    partyName: "",
    materialName: "",
    quantity: "",
    rate: "",
    transportCost: "",
    discount: "",
    taxPercentage: "18",
    paymentStatus: "UNPAID",
    paymentMethod: "BANK",
    referenceNumber: "",
    description: ""
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const locParam = locationId && locationId !== "all" ? `?locationId=${locationId}` : "";
      const [res, locRes] = await Promise.all([
        apiFetch(`/materials/supply${locParam}`),
        apiFetch("/locations").catch(() => [])
      ]);
      setRecords(res || []);
      const locList = Array.isArray(locRes) ? locRes : [];
      setLocations(locList);
      if (locList.length > 0 && !formData.locationId) {
        setFormData(prev => ({ ...prev, locationId: locList[0].id }));
      }
    } catch (err) {
      console.error("Failed to load material supplies:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [locationId]);

  const effectiveUnit = unitMode === "Custom" ? customUnit.trim() || "Units" : unitMode;

  const calculations = useMemo(() => {
    const qty = parseFloat(formData.quantity) || 0;
    const rate = parseFloat(formData.rate) || 0;
    const transport = parseFloat(formData.transportCost) || 0;
    const discount = parseFloat(formData.discount) || 0;
    const taxPerc = parseFloat(formData.taxPercentage) || 0;

    const subtotal = Math.round(qty * rate * 100) / 100;
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = Math.round(taxableAmount * (taxPerc / 100) * 100) / 100;
    const total = Math.round((taxableAmount + tax + transport) * 100) / 100;
    const effectiveUnitRate = qty > 0 ? (total / qty).toFixed(2) : "0.00";

    return { qty, rate, transport, discount, tax, subtotal, total, effectiveUnitRate };
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/materials/supply/${editingId}` : "/materials/supply";
      const method = editingId ? "PUT" : "POST";
      const targetLocId = formData.locationId || (locations[0]?.id || 1);

      await apiFetch(url, {
        method, 
        body: JSON.stringify({
          ...formData,
          unit: effectiveUnit,
          locationId: targetLocId,
          quantity: Number(formData.quantity) || 0,
          rate: Number(formData.rate) || 0,
          transportCost: Number(formData.transportCost) || 0,
          discount: Number(formData.discount) || 0,
          taxPercentage: Number(formData.taxPercentage) || 0
        }),
      });
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error("Failed to save supply:", err);
    }
  };

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    let unitM = "Custom";
    let custU = record.unit || "";
    if (PRESET_UNITS.includes(record.unit)) {
      unitM = record.unit;
      custU = "";
    }
    setUnitMode(unitM);
    setCustomUnit(custU);

    setFormData({
      locationId: record.locationId,
      date: record.date || new Date().toISOString().split("T")[0],
      partyName: record.partyName || "",
      materialName: record.materialName || "",
      quantity: record.quantity || "",
      rate: record.rate || "",
      transportCost: record.transportCost || "",
      discount: record.discount || "",
      taxPercentage: record.taxPercentage || "18",
      paymentStatus: record.paymentStatus || "UNPAID",
      paymentMethod: record.paymentMethod || "BANK",
      referenceNumber: record.referenceNumber || "",
      description: record.description || ""
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this material supply order?")) return;
    try {
      await apiFetch(`/materials/supply/${id}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      console.error("Failed to delete supply:", err);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      locationId: locations[0]?.id || 1,
      date: new Date().toISOString().split("T")[0],
      partyName: "",
      materialName: "",
      quantity: "",
      rate: "",
      transportCost: "",
      discount: "",
      taxPercentage: "18",
      paymentStatus: "UNPAID",
      paymentMethod: "BANK",
      referenceNumber: "",
      description: ""
    });
    setUnitMode("Bags");
    setCustomUnit("");
  };

  const filteredRecords = records.filter(r => {
    const matchSearch = 
      (r.partyName && r.partyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.materialName && r.materialName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchStatus = statusFilter === "ALL" || r.paymentStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  // Aggregates
  const totalRevenue = filteredRecords.reduce((acc, r) => acc + (parseFloat(r.totalAmount) || 0), 0);
  const totalTransport = filteredRecords.reduce((acc, r) => acc + (parseFloat(r.transportCost) || 0), 0);
  const totalTax = filteredRecords.reduce((acc, r) => acc + (parseFloat(r.taxAmount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Supply Revenue</span>
            <div className="text-xl font-bold text-slate-900 mt-1">₹{totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-0.5">{filteredRecords.length} orders fulfilled</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Freight & Transport</span>
            <div className="text-xl font-bold text-indigo-600 mt-1">₹{totalTransport.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-0.5">Delivery recovery</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">GST Tax Billed</span>
            <div className="text-xl font-bold text-slate-900 mt-1">₹{totalTax.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-0.5">GST included in orders</p>
          </div>
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search client or material..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            {["ALL", "PAID", "UNPAID"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  statusFilter === s ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl transition shadow-sm ml-auto"
          >
            <Plus size={15} />
            New Supply Order
          </button>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Customer / Client</th>
                <th className="p-3.5">Material & Quantity</th>
                <th className="p-3.5 text-right">Unit Rate</th>
                <th className="p-3.5 text-right">Freight</th>
                <th className="p-3.5 text-right">Tax (GST)</th>
                <th className="p-3.5 text-right">Total (₹)</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">Loading supply records...</td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    <Truck size={32} className="mx-auto mb-2 text-slate-300" />
                    <p>No material supply records found.</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-medium text-slate-900 whitespace-nowrap">{r.date}</td>
                    <td className="p-3.5 font-semibold text-slate-900">{r.partyName}</td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="font-semibold text-slate-800">{r.materialName}</span>
                      <div className="text-[11px] text-slate-500">{r.quantity} {r.unit}</div>
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">₹{r.rate}</td>
                    <td className="p-3.5 text-right text-indigo-600 whitespace-nowrap">
                      {Number(r.transportCost) > 0 ? `+₹${r.transportCost}` : "-"}
                    </td>
                    <td className="p-3.5 text-right text-slate-500 whitespace-nowrap">₹{r.taxAmount || 0}</td>
                    <td className="p-3.5 text-right font-bold text-slate-900 whitespace-nowrap">₹{r.totalAmount}</td>
                    <td className="p-3.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        r.paymentStatus === "PAID" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {r.paymentStatus}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleEdit(r)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        >
                          <Trash2 size={14} />
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

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? "Edit Material Supply Order" : "Record Material Supply"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Branch / Location *</label>
              <select
                value={formData.locationId}
                onChange={(e) => setFormData(prev => ({ ...prev, locationId: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              >
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supply Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Client / Party Name *</label>
              <input
                type="text"
                placeholder="e.g. Skyline Constructions"
                value={formData.partyName}
                onChange={(e) => setFormData(prev => ({ ...prev, partyName: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Material Name *</label>
              <input
                type="text"
                placeholder="e.g. UltraTech PPC Cement"
                value={formData.materialName}
                onChange={(e) => setFormData(prev => ({ ...prev, materialName: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity *</label>
              <input
                type="number"
                step="0.01"
                placeholder="0"
                value={formData.quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
              <select
                value={unitMode}
                onChange={(e) => setUnitMode(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
              >
                {PRESET_UNITS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Rate (₹) *</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.rate}
                onChange={(e) => setFormData(prev => ({ ...prev, rate: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Transport Cost (₹)</label>
              <input
                type="number"
                placeholder="0"
                value={formData.transportCost}
                onChange={(e) => setFormData(prev => ({ ...prev, transportCost: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Discount (₹)</label>
              <input
                type="number"
                placeholder="0"
                value={formData.discount}
                onChange={(e) => setFormData(prev => ({ ...prev, discount: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">GST Tax (%)</label>
              <select
                value={formData.taxPercentage}
                onChange={(e) => setFormData(prev => ({ ...prev, taxPercentage: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>
          </div>

          {/* Computed Summary */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">Subtotal:</span>
              <span className="font-semibold text-slate-800">₹{calculations.subtotal}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">GST Tax:</span>
              <span className="font-semibold text-slate-800">₹{calculations.tax}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Freight:</span>
              <span className="font-semibold text-indigo-600">+₹{calculations.transport}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Grand Total:</span>
              <span className="font-bold text-emerald-600 text-sm">₹{calculations.total}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Status</label>
              <select
                value={formData.paymentStatus}
                onChange={(e) => setFormData(prev => ({ ...prev, paymentStatus: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="UNPAID">Unpaid</option>
                <option value="PAID">Paid</option>
                <option value="PARTIAL">Partial</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="BANK">Bank</option>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm"
            >
              {editingId ? "Update Supply Order" : "Save Supply Order"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
