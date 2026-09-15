import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { 
  Plus, Truck, Trash2, Eye, IndianRupee, Pencil, 
  Calculator, CheckCircle2, Clock
} from "lucide-react";

const PRESET_UNITS = [
  "Nos",
  "Bags",
  "Ton",
  "Kg",
  "Brass",
  "CFT",
  "Cum",
  "Sq.ft",
  "Sq.m",
  "Trip",
  "Load",
  "Ltr",
  "Mtr",
  "Custom"
];

export default function MaterialSupplyTab({ locationId }: { locationId: number }) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [unitMode, setUnitMode] = useState<string>("Bags");
  const [customUnit, setCustomUnit] = useState<string>("");

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    partyName: "",
    materialName: "",
    quantity: "",
    rate: "",
    transportCost: "",
    discount: "",
    taxPercentage: "",
    paymentStatus: "UNPAID",
    paymentMethod: "BANK",
    referenceNumber: "",
    description: ""
  });

  useEffect(() => {
    loadData();
  }, [locationId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, mats, parts] = await Promise.all([apiFetch(`/materials/supply?locationId=${locationId}`),
      apiFetch(`/master/materials?locationId=${locationId}`).catch(() => []),
      apiFetch(`/master/parties?locationId=${locationId}`).catch(() => [])]);
      setRecords(res || []);
    } catch (err) {
      console.error("Failed to load supplies:", err);
    } finally {
      setLoading(false);
    }
  };

  const effectiveUnit = unitMode === "Custom" ? (customUnit.trim() || "Unit") : unitMode;

  // Real-time calculations
  const calculations = useMemo(() => {
    const qty = parseFloat(formData.quantity) || 0;
    const rate = parseFloat(formData.rate) || 0;
    const transport = parseFloat(formData.transportCost) || 0;
    const discount = parseFloat(formData.discount) || 0;
    const taxPercentage = parseFloat(formData.taxPercentage) || 0;

    const subtotal = Math.round(qty * rate * 100) / 100;
    const taxableAmount = subtotal - discount;
    const tax = Math.round(taxableAmount * (taxPercentage / 100) * 100) / 100;
    const total = Math.round((taxableAmount + tax + transport) * 100) / 100;
    const effectiveUnitRate = qty > 0 ? (total / qty).toFixed(2) : "0.00";

    return {
      qty,
      rate,
      transport,
      discount,
      tax,
      subtotal,
      total,
      effectiveUnitRate
    };
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/materials/supply/${editingId}` : "/materials/supply";
      const method = editingId ? "PUT" : "POST";
      await apiFetch(url, {
        method, 
        body: JSON.stringify({
          ...formData,
          unit: effectiveUnit,
          locationId
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
      date: record.date || new Date().toISOString().split("T")[0],
      partyName: record.partyName || "",
      materialName: record.materialName || "",
      quantity: record.quantity || "",
      rate: record.rate || "",
      transportCost: record.transportCost || "",
      discount: record.discount || "",
      taxPercentage: record.taxPercentage || "",
      paymentStatus: record.paymentStatus || "UNPAID",
      paymentMethod: record.paymentMethod || "BANK",
      referenceNumber: record.referenceNumber || "",
      description: record.description || ""
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this supply record?")) return;
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
      date: new Date().toISOString().split("T")[0],
      partyName: "",
      materialName: "",
      quantity: "",
      rate: "",
      transportCost: "",
      discount: "",
      taxPercentage: "",
      paymentStatus: "UNPAID",
      paymentMethod: "BANK",
      referenceNumber: "",
      description: ""
    });
    setUnitMode("Bags");
    setCustomUnit("");
  };

  // Aggregates
  const totalAmountSum = records.reduce((acc, r) => acc + (parseFloat(r.totalAmount) || 0), 0);
  const totalTransportSum = records.reduce((acc, r) => acc + (parseFloat(r.transportCost) || 0), 0);
  const totalSubtotalSum = records.reduce((acc, r) => acc + (parseFloat(r.subtotal) || 0), 0);

  return (
    <div className="space-y-6">
      {/* KPI Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Supply Revenue</span>
            <div className="text-xl font-bold text-slate-900 mt-1">₹{totalAmountSum.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-0.5">{records.length} recorded supplies</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Transport Charged</span>
            <div className="text-xl font-bold text-indigo-600 mt-1">₹{totalTransportSum.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-0.5">Delivery & freight revenue</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Base Material Subtotal</span>
            <div className="text-xl font-bold text-slate-700 mt-1">₹{totalSubtotalSum.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-0.5">Raw material billing</p>
          </div>
          <div className="p-3 bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider rounded-xl">
            <Calculator className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h3 className="font-bold text-slate-900">Material Supply Log</h3>
          <p className="text-xs text-slate-500">Track client deliveries with unit calculations and transport billing</p>
        </div>
        <button type="button"
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-sm transition-colors text-sm"
        >
          <Plus className="w-4 h-4" /> Add Material Supply
        </button>
      </div>

      {/* Supplies Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-slate-600 border-b border-gray-100">
              <tr>
                <th className="p-3.5 font-semibold text-xs uppercase tracking-wider">Date</th>
                <th className="p-3.5 font-semibold text-xs uppercase tracking-wider">Client / Material</th>
                <th className="p-3.5 font-semibold text-xs uppercase tracking-wider text-right">Quantity</th>
                <th className="p-3.5 font-semibold text-xs uppercase tracking-wider text-right">Unit Rate</th>
                <th className="p-3.5 font-semibold text-xs uppercase tracking-wider text-right">Subtotal</th>
                <th className="p-3.5 font-semibold text-xs uppercase tracking-wider text-right">Transport</th>
                <th className="p-3.5 font-semibold text-xs uppercase tracking-wider text-right">Total Amount</th>
                <th className="p-3.5 font-semibold text-xs uppercase tracking-wider text-center">Status</th>
                <th className="p-3.5 font-semibold text-xs uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">Loading supply records...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    No material supplies logged yet. Click &quot;Add Material Supply&quot; above to record a delivery.
                  </td>
                </tr>
              ) : (
                records.map(r => {
                  const qty = parseFloat(r.quantity) || 0;
                  const rate = parseFloat(r.rate) || 0;
                  const subtotal = parseFloat(r.subtotal) || (qty * rate);
                  const transport = parseFloat(r.transportCost) || 0;
                  const total = parseFloat(r.totalAmount) || 0;

                  return (
                    <tr key={r.id} className="hover:bg-emerald-50/20 transition-colors">
                      <td className="p-3.5 text-slate-700 whitespace-nowrap">
                        {new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900">{r.partyName}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <span className="font-medium text-emerald-600">{r.materialName}</span>
                          {r.referenceNumber && (
                            <span className="text-slate-400">· Challan: #{r.referenceNumber}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-right font-medium text-slate-900 whitespace-nowrap">
                        {qty.toLocaleString()} <span className="text-xs text-slate-500 font-normal">{r.unit}</span>
                      </td>
                      <td className="p-3.5 text-right text-slate-700 whitespace-nowrap">
                        ₹{rate.toLocaleString()} <span className="text-xs text-slate-400">/{r.unit}</span>
                      </td>
                      <td className="p-3.5 text-right text-slate-600 whitespace-nowrap">
                        ₹{subtotal.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        {transport > 0 ? (
                          <span className="inline-flex items-center gap-1 font-medium text-indigo-600">
                            <Truck className="w-3 h-3" /> ₹{transport.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <span className="font-bold text-slate-900">₹{total.toLocaleString()}</span>
                        {qty > 0 && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            eff: ₹{(total / qty).toFixed(2)}/{r.unit}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          r.paymentStatus === "PAID" 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {r.paymentStatus === "PAID" ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {r.paymentStatus}
                        </span>
                      </td>
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button"
                            onClick={() => { setSelectedRecord(r); setIsDetailsOpen(true); }}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="View Full Breakdown"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button type="button"
                            onClick={() => handleDelete(r.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg hover:text-rose-700 transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Add Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Material Supply" : "Add Material Supply"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Supply Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Payment Status *</label>
              <select
                value={formData.paymentStatus}
                onChange={e => setFormData({ ...formData, paymentStatus: e.target.value })}
                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="UNPAID">UNPAID (Payment Pending)</option>
                <option value="PAID">PAID (Received)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Client / Contractor / Site Name *</label>
              <input
                type="text"
                list="parties-list"
                value={formData.partyName}
                onChange={e => setFormData({ ...formData, partyName: e.target.value })}
                placeholder="e.g. Apex Builders, Site B Project"
                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Material Supplied *</label>
              <input
                type="text"
                list="materials-list"
                value={formData.materialName}
                onChange={e => setFormData({ ...formData, materialName: e.target.value })}
                placeholder="e.g. River Sand, Blue Metal 20mm, Bricks"
                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            {/* Unit & Calculation Controls */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Quantity *</label>
              <input
                type="number" inputMode="decimal"
                step="0.01"
                min="0.01"
                value={formData.quantity}
                onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="e.g. 50"
                className="w-full p-2 text-sm border rounded-lg font-medium focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Unit of Measurement *</label>
              <select
                value={unitMode}
                onChange={e => setUnitMode(e.target.value)}
                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                {PRESET_UNITS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {unitMode === "Custom" && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Specify Custom Unit *</label>
                <input
                  type="text"
                  value={customUnit}
                  onChange={e => setCustomUnit(e.target.value)}
                  placeholder="e.g. Pack, Drum, Bundle"
                  className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Rate (₹ per {effectiveUnit}) *
              </label>
              <div className="relative">
                <IndianRupee className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number" inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={formData.rate}
                  onChange={e => setFormData({ ...formData, rate: e.target.value })}
                  placeholder="0.00"
                  className="w-full pl-8 pr-2 py-2 text-sm border rounded-lg font-medium focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-indigo-800 mb-1 flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-indigo-600" />
                Transport / Delivery Cost (₹) (+)
              </label>
              <div className="relative">
                <IndianRupee className="w-3.5 h-3.5 text-indigo-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number" inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={formData.transportCost}
                  onChange={e => setFormData({ ...formData, transportCost: e.target.value })}
                  placeholder="0.00"
                  className="w-full pl-8 pr-2 py-2 text-sm border border-indigo-200 bg-indigo-50/20 rounded-lg font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Discount (₹) (-)</label>
              <input
                type="number" inputMode="decimal"
                step="0.01"
                min="0"
                value={formData.discount}
                onChange={e => setFormData({ ...formData, discount: e.target.value })}
                placeholder="0.00"
                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tax / GST (%) (+)</label>
              <input
                type="number" inputMode="decimal"
                step="0.01"
                min="0"
                value={formData.taxPercentage}
                onChange={e => setFormData({ ...formData, taxPercentage: e.target.value })}
                placeholder="0.00"
                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method</label>
              <select
                value={formData.paymentMethod}
                onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="BANK">Bank Transfer / NEFT / RTGS</option>
                <option value="UPI">UPI / GPay / PhonePe</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Challan / LR / Invoice No.</label>
              <input
                type="text"
                value={formData.referenceNumber}
                onChange={e => setFormData({ ...formData, referenceNumber: e.target.value })}
                placeholder="e.g. CH-2024-105"
                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Delivery Site / Notes</label>
              <input
                type="text"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Delivery address, truck number, receiving in-charge..."
                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Unit Calculation & Live Breakdown Card */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                Unit & Supply Calculation
              </span>
              <span className="text-slate-500">Live Breakdown</span>
            </div>

            <div className="grid grid-cols-2 gap-y-1.5 text-xs text-slate-600 pt-1 border-t border-slate-200">
              <div>Base Material Subtotal:</div>
              <div className="text-right font-medium text-slate-900">
                {calculations.qty} {effectiveUnit} × ₹{calculations.rate} = ₹{calculations.subtotal.toLocaleString()}
              </div>

              <div>Transport / Delivery:</div>
              <div className="text-right font-medium text-indigo-700">
                + ₹{calculations.transport.toLocaleString()}
              </div>

              {calculations.discount > 0 && (
                <>
                  <div>Discount:</div>
                  <div className="text-right font-medium text-amber-700">
                    - ₹{calculations.discount.toLocaleString()}
                  </div>
                </>
              )}

              {calculations.tax > 0 && (
                <>
                  <div>Tax / GST ({parseFloat(formData.taxPercentage || "0")}%):</div>
                  <div className="text-right font-medium text-slate-900">
                    + ₹{calculations.tax.toLocaleString()}
                  </div>
                </>
              )}

              <div className="pt-2 border-t border-slate-200 font-bold text-sm text-slate-900">
                Total Supply Bill:
              </div>
              <div className="pt-2 border-t border-slate-200 text-right font-bold text-base text-emerald-600">
                ₹{calculations.total.toLocaleString()}
              </div>

              {calculations.qty > 0 && (
                <>
                  <div className="text-[11px] text-slate-500 italic">Effective Billing Rate:</div>
                  <div className="text-right text-[11px] font-semibold text-blue-700">
                    ₹{calculations.effectiveUnitRate} per {effectiveUnit}
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow transition-colors text-sm"
          >
            Save Material Supply
          </button>
          <datalist id="materials-list">
    {materials.map(m => <option key={m.id} value={m.name} />)}
  </datalist>
  <datalist id="parties-list">
    {parties.map(p => <option key={p.id} value={p.name} />)}
  </datalist>
</form>
      </Modal>

      {/* Details Modal */}
      {selectedRecord && (
        <Modal isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} title="Supply Breakdown">
          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center pb-2 border-b">
              <div>
                <h4 className="font-bold text-slate-900 text-base">{selectedRecord.partyName}</h4>
                <p className="text-xs text-emerald-600 font-medium">{selectedRecord.materialName}</p>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                selectedRecord.paymentStatus === "PAID" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}>
                {selectedRecord.paymentStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg">
                <span className="text-slate-500 block">Date:</span>
                <span className="font-semibold text-slate-900">{selectedRecord.date}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg">
                <span className="text-slate-500 block">Payment Method:</span>
                <span className="font-semibold text-slate-900">{selectedRecord.paymentMethod || "N/A"}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg">
                <span className="text-slate-500 block">Challan / Ref #:</span>
                <span className="font-semibold text-slate-900">{selectedRecord.referenceNumber || "N/A"}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg">
                <span className="text-slate-500 block">Unit:</span>
                <span className="font-semibold text-slate-900">{selectedRecord.unit}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Quantity × Rate:</span>
                <span className="font-medium text-slate-900">
                  {selectedRecord.quantity} {selectedRecord.unit} × ₹{Number(selectedRecord.rate).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Base Subtotal:</span>
                <span className="font-semibold text-slate-900">₹{Number(selectedRecord.subtotal).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-indigo-700">
                <span className="flex items-center gap-1 font-medium"><Truck className="w-3.5 h-3.5" /> Transport / Freight:</span>
                <span className="font-semibold">₹{Number(selectedRecord.transportCost || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>Discount:</span>
                <span className="font-semibold">- ₹{Number(selectedRecord.discount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Tax / GST ({Number(selectedRecord.taxPercentage || 0)}%):</span>
                <span className="font-semibold">+ ₹{Number(selectedRecord.tax || 0).toLocaleString()}</span>
              </div>
              <div className="pt-2 border-t flex justify-between font-bold text-sm text-slate-900">
                <span>Total Amount:</span>
                <span className="text-emerald-600">₹{Number(selectedRecord.totalAmount).toLocaleString()}</span>
              </div>
              {parseFloat(selectedRecord.quantity) > 0 && (
                <div className="flex justify-between text-[11px] text-blue-700 font-semibold pt-1">
                  <span>Effective Selling Rate:</span>
                  <span>₹{(Number(selectedRecord.totalAmount) / Number(selectedRecord.quantity)).toFixed(2)} / {selectedRecord.unit}</span>
                </div>
              )}
            </div>

            {selectedRecord.description && (
              <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                <span className="font-medium text-slate-700 block mb-0.5">Notes / Delivery Site:</span>
                {selectedRecord.description}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
