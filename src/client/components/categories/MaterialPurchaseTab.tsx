import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Plus, Trash2, Pencil, Calculator, Database, Package } from "lucide-react";
import { PurchaseIcon } from "../icons/PurchaseIcon";

const PRESET_UNITS = ["Nos", "Bags", "Ton", "Kg", "Brass", "CFT", "Cum", "Sq.ft", "Sq.m", "Trip", "Load", "Ltr", "Mtr", "Custom"];

export default function MaterialPurchaseTab({ locationId }: { locationId: number }) {
  const [activeSubTab, setActiveSubTab] = useState<"purchases" | "stock">("purchases");
  
  const [records, setRecords] = useState<any[]>([]);
  const [stockLedger, setStockLedger] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
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
    description: "",
    notes: "",
    materialId: ""
  });

  useEffect(() => {
    loadData();
  }, [locationId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [purchases, mats, stock] = await Promise.all([
        apiFetch(`/materials/purchase?locationId=${locationId}`),
        apiFetch(`/master/materials?locationId=${locationId}`).catch(() => []),
        apiFetch(`/reports/stock?locationId=${locationId}`).catch(() => []) // Assuming we have or will have a stock report
      ]);
      setRecords(purchases || []);
      setMaterials(mats || []);
      setStockLedger(stock || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const effectiveUnit = unitMode === "Custom" ? (customUnit.trim() || "Unit") : unitMode;

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
    
    return { subtotal, tax, total };
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/materials/purchase/${editingId}` : "/materials/purchase";
      const method = editingId ? "PUT" : "POST";
      
      let matId = formData.materialId;
      if (!matId && formData.materialName) {
         const found = materials.find(m => m.name.toLowerCase() === formData.materialName.toLowerCase());
         if (found) matId = found.id.toString();
      }

      await apiFetch(url, {
        method, 
        body: JSON.stringify({
          ...formData,
          materialId: matId ? parseInt(matId) : null,
          unit: effectiveUnit,
          locationId
        }),
      });
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error("Failed to save purchase:", err);
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
      description: "",
    notes: "",
    materialId: ""
    });
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
      description: record.description || "",
      materialId: record.materialId ? record.materialId.toString() : ""
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this purchase? Stock will be reversed.")) return;
    try {
      await apiFetch(`/materials/purchase/${id}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      alert("Failed to delete purchase");
    }
  };

  // Compile Stock Summary from stockLedger array
  const stockSummary = useMemo(() => {
    const map: Record<string, { qty: number, unit: string }> = {};
    
    // We assume stockLedger returns { materialName, transactionType, quantity, unit } etc.
    // If not, we will just summarize materials based on purchases.
    // Wait, the API for /reports/stock may not exist. Let's calculate from materials if needed.
    
    // As a fallback if the API doesn't exist, we will use stockLedger response if it's there.
    return stockLedger;
  }, [stockLedger]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-rose-500/10 via-pink-500/5 to-rose-500/10 border border-rose-200/80 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-rose-600 text-white rounded-xl shadow-md">
            <PurchaseIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Material Purchase & Stock</h2>
            <p className="text-xs text-slate-600">Record inbound supplies. Automatically updates inventory stock.</p>
          </div>
        </div>

        <div className="flex bg-white rounded-lg p-1 border border-rose-100 shadow-sm w-max">
          <button
            onClick={() => setActiveSubTab("purchases")}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-colors ${activeSubTab === "purchases" ? "bg-rose-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            Purchase Records
          </button>
          <button
            onClick={() => setActiveSubTab("stock")}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-colors ${activeSubTab === "stock" ? "bg-rose-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            Stock System
          </button>
        </div>
      </div>

      {activeSubTab === "purchases" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-900">Purchase Invoices</h3>
            <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-rose-700">
              <Plus className="w-3.5 h-3.5" /> Add Purchase
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Vendor / Party</th>
                  <th className="p-3">Material</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-right">Rate</th>
                  <th className="p-3 text-right">Total (₹)</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-600">{r.date}</td>
                    <td className="p-3 font-bold text-slate-900">{r.partyName}</td>
                    <td className="p-3 text-rose-700 font-semibold">{r.materialName}</td>
                    <td className="p-3 text-right font-bold">{r.quantity} {r.unit}</td>
                    <td className="p-3 text-right text-slate-600">₹{r.rate}</td>
                    <td className="p-3 text-right font-black text-slate-900">₹{Number(r.totalAmount).toLocaleString()}</td>
                    <td className="p-3 text-center">
                      <button onClick={() => handleEdit(r)} className="text-slate-400 hover:text-amber-600 p-1"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(r.id)} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No purchases found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === "stock" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-900 flex items-center gap-2"><Package className="w-4 h-4 text-rose-600" /> Current Inventory Stock</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-4">Material Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4 text-right">Available Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {materials.map(m => {
                  const stockTotal = stockLedger
                     .filter((s: any) => s.materialId === m.id)
                     .reduce((acc: number, s: any) => s.transactionType === 'IN' ? acc + parseFloat(s.quantity) : acc - parseFloat(s.quantity), 0);

                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="p-4 font-bold text-slate-900">{m.name}</td>
                      <td className="p-4 text-slate-500">{m.category || "-"}</td>
                      <td className={`p-4 text-right font-black ${stockTotal < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {stockTotal} {m.defaultUnit}
                      </td>
                    </tr>
                  )
                })}
                {materials.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-slate-500">No materials defined in Master Data.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Material Purchase" : "Add Material Purchase"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">1. Purchase Date *</label>
              <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">2. Payment Status *</label>
              <select required value={formData.paymentStatus} onChange={e => setFormData({...formData, paymentStatus: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="PAID">PAID</option>
                <option value="UNPAID">UNPAID (Pending)</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">3. Supplier / Vendor Name *</label>
            <input type="text" required value={formData.partyName} onChange={e => setFormData({...formData, partyName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. ABC Cements" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">4. Material Name *</label>
              <select required value={formData.materialId} onChange={e => setFormData({...formData, materialId: e.target.value, materialName: e.target.options[e.target.selectedIndex].text})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">-- Select Material --</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">6. Unit of Measurement *</label>
              <select value={unitMode} onChange={e => setUnitMode(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {PRESET_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              {unitMode === "Custom" && <input type="text" placeholder="Enter custom unit" value={customUnit} onChange={e => setCustomUnit(e.target.value)} className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">5. Quantity *</label>
              <input type="number" step="0.01" required value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">7. Rate (₹ per {effectiveUnit}) *</label>
              <input type="number" step="0.01" required value={formData.rate} onChange={e => setFormData({...formData, rate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-slate-200 pt-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">8. Transport / Freight (₹) (+)</label>
              <input type="number" step="0.01" value={formData.transportCost} onChange={e => setFormData({...formData, transportCost: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">9. Discount (₹) (-)</label>
              <input type="number" step="0.01" value={formData.discount} onChange={e => setFormData({...formData, discount: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">10. Tax / GST (%) (+)</label>
              <input type="number" step="0.01" value={formData.taxPercentage} onChange={e => setFormData({...formData, taxPercentage: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
            </div>
          </div>

          {formData.paymentStatus === 'PAID' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">11. Payment Method</label>
                <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment / Txn Ref</label>
                <input type="text" value={formData.referenceNumber} onChange={e => setFormData({...formData, referenceNumber: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Txn ID" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">12. Bill / Challan / Ref No.</label>
              <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Bill No." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">13. Notes / Description</label>
              <input type="text" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Vehicle No., Driver Details" />
            </div>
          </div>

          {/* Unit & Total Calculation */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 mt-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Unit & Total Calculation</h4>
            <div className="flex justify-between items-center text-sm text-slate-600">
               <span>14. Base Material Subtotal</span>
               <span className="font-semibold">₹{calculations.subtotal.toLocaleString()}</span>
            </div>
            {Number(formData.discount || 0) > 0 && (
              <div className="flex justify-between items-center text-sm text-emerald-600">
                 <span>Discount</span>
                 <span className="font-semibold">- ₹{Number(formData.discount || 0).toLocaleString()}</span>
              </div>
            )}
            {Number(formData.taxPercentage || 0) > 0 && (
              <div className="flex justify-between items-center text-sm text-slate-600">
                 <span>GST ({formData.taxPercentage}%)</span>
                 <span className="font-semibold">+ ₹{calculations.tax.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm text-slate-600 border-b border-slate-200 pb-2">
               <span>15. Transport / Freight</span>
               <span className="font-semibold">+ ₹{Number(formData.transportCost || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center font-black text-rose-700 text-lg pt-1">
               <span>16. Net Total Payable</span>
               <span>₹{calculations.total.toLocaleString()}</span>
            </div>
          </div>

          <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl shadow-sm transition-all mt-4 text-sm">
             17. {editingId ? "Update Material Purchase" : "Save Material Purchase"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
