import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Plus, Trash2, Pencil, Package, ArrowDownRight, ArrowUpRight, Search, RefreshCw, Layers, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { PurchaseIcon } from "../icons/PurchaseIcon";
import { useLiveSync, triggerSync } from "../../hooks/useLiveSync";
import { ManageMaterialsModal } from "../ui/ManageMaterialsModal";
import { useToast } from "../../contexts/ToastContext";
import { downloadExcelReport } from "../../lib/excelExport";

const PRESET_UNITS = ["Nos", "Bags", "Ton", "Kg", "Brass", "CFT", "Cum", "Sq.ft", "Sq.m", "Trip", "Load", "Ltr", "Mtr", "Custom"];

export default function MaterialPurchaseTab({ locationId }: { locationId: number }) {
  const { showToast, confirmAction } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<"purchases" | "stock">("purchases");
  
  const [records, setRecords] = useState<any[]>([]);
  const [stockLedger, setStockLedger] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockSearch, setStockSearch] = useState("");
  const [showLedgerLogs, setShowLedgerLogs] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManageMaterialOpen, setIsManageMaterialOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [unitMode, setUnitMode] = useState<string>("Nos");
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

  const loadData = async (isBackground = false) => {
    if (!isBackground && records.length === 0) setLoading(true);
    try {
      const [purchases, mats, stock] = await Promise.all([
        apiFetch(`/materials/purchase?locationId=${locationId}`),
        apiFetch(`/master/materials`).catch(() => []),
        apiFetch(`/reports/stock?locationId=${locationId}`).catch(() => [])
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

  useEffect(() => {
    loadData(false);
  }, [locationId]);

  useLiveSync(() => {
    loadData(true);
  }, 3500);

  const effectiveUnit = unitMode === "Custom" ? (customUnit.trim() || "Unit") : unitMode;

  const calculations = useMemo(() => {
    const qty = parseFloat(formData.quantity) || 0;
    const rate = parseFloat(formData.rate) || 0;
    const transport = parseFloat(formData.transportCost) || 0;
    const discount = parseFloat(formData.discount) || 0;
    const taxPercentage = parseFloat(formData.taxPercentage) || 0;

    const subtotal = Math.round(qty * rate * 100) / 100;
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = Math.round(taxableAmount * (taxPercentage / 100) * 100) / 100;
    const total = Math.round((taxableAmount + tax + transport) * 100) / 100;
    
    return { subtotal, tax, total };
  }, [formData]);

  const purchaseAggregates = useMemo(() => {
    let totalQty = 0;
    let totalSubtotal = 0;
    let totalTax = 0;
    let totalTransport = 0;
    let totalDiscount = 0;
    let totalAmount = 0;

    records.forEach(r => {
      const q = parseFloat(r.quantity) || 0;
      const rate = parseFloat(r.rate) || 0;
      const sub = parseFloat(r.subtotal) || Math.round(q * rate * 100) / 100;
      const disc = parseFloat(r.discount) || 0;
      const trans = parseFloat(r.transportCost) || 0;
      const taxRate = parseFloat(r.taxPercentage) || 0;
      const taxable = Math.max(0, sub - disc);
      const tax = parseFloat(r.tax) || Math.round(taxable * (taxRate / 100) * 100) / 100;
      const fullCalculated = Math.round((taxable + tax + trans) * 100) / 100;
      const rowTot = (parseFloat(r.totalAmount) > 0 && Math.abs(parseFloat(r.totalAmount) - (taxable + tax + trans)) < 1)
        ? parseFloat(r.totalAmount)
        : fullCalculated;

      totalQty += q;
      totalSubtotal += sub;
      totalTax += tax;
      totalTransport += trans;
      totalDiscount += disc;
      totalAmount += rowTot;
    });

    return {
      totalQty,
      totalSubtotal,
      totalTax,
      totalTransport,
      totalDiscount,
      totalAmount: Math.round(totalAmount * 100) / 100
    };
  }, [records]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/materials/purchase/${editingId}` : "/materials/purchase";
      const method = editingId ? "PUT" : "POST";
      
      let matId = formData.materialId;
      let matName = formData.materialName;
      if (!matId && formData.materialName) {
         const found = materials.find(m => m.name.toLowerCase().trim() === formData.materialName.toLowerCase().trim());
         if (found) matId = found.id.toString();
      }
      if (matId && !matName) {
         const found = materials.find(m => String(m.id) === String(matId));
         if (found) matName = found.name;
      }

      await apiFetch(url, {
        method, 
        body: JSON.stringify({
          ...formData,
          materialId: matId ? parseInt(matId) : null,
          materialName: matName,
          unit: effectiveUnit,
          locationId,
          subtotal: calculations.subtotal,
          tax: calculations.tax,
          totalAmount: calculations.total,
          paidAmount: formData.paymentStatus === 'PAID' ? calculations.total : 0,
          outstandingAmount: formData.paymentStatus === 'PAID' ? 0 : calculations.total
        }),
      });
      triggerSync("materials");
      triggerSync("stock");
      triggerSync("reports");
      setIsModalOpen(false);
      resetForm();
      showToast(editingId ? "Purchase updated successfully" : "Purchase recorded successfully", "success");
      await loadData();
    } catch (err: any) {
      console.error("Failed to save purchase:", err);
      showToast(err.message || "Failed to save purchase", "error");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setUnitMode("Nos");
    setCustomUnit("");
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
      notes: record.notes || "",
      materialId: record.materialId ? record.materialId.toString() : ""
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirmAction({
      title: "Delete Material Purchase",
      message: "Are you sure you want to delete this purchase? Stock will be reversed automatically.",
      confirmLabel: "Delete",
      isDanger: true
    });
    if (!confirmed) return;
    try {
      await apiFetch(`/materials/purchase/${id}`, { method: "DELETE" });
      triggerSync("materials");
      triggerSync("stock");
      triggerSync("reports");
      showToast("Purchase deleted and stock reversed", "success");
      await loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete purchase", "error");
    }
  };

  // Compile Comprehensive Stock Summary from stockLedger array and materials master
  const stockSummary = useMemo(() => {
    const summaryMap = new Map<string, {
      materialId?: number;
      materialName: string;
      unit: string;
      category: string;
      purchasedQty: number;
      suppliedQty: number;
      currentStock: number;
      lastMovement?: string;
    }>();

    // 1. Seed with materials from master data, deduplicating by UPPERCASE name
    materials.forEach(m => {
      const cleanName = (m.name || '').trim().toUpperCase();
      if (!cleanName) return;
      if (!summaryMap.has(cleanName)) {
        summaryMap.set(cleanName, {
          materialId: m.id,
          materialName: cleanName,
          unit: m.defaultUnit || m.unit || "Nos",
          category: m.category || "-",
          purchasedQty: 0,
          suppliedQty: 0,
          currentStock: 0
        });
      }
    });

    const idToName = new Map<number, string>();
    materials.forEach(m => {
      idToName.set(m.id, (m.name || '').trim().toUpperCase());
    });

    // 2. Process stock ledger entries (canonical single-source-of-truth)
    stockLedger.forEach((s: any) => {
      let cleanName = '';
      if (s.materialId && idToName.has(Number(s.materialId))) {
        cleanName = idToName.get(Number(s.materialId))!;
      } else if (s.materialName) {
        cleanName = String(s.materialName).trim().toUpperCase();
      }

      if (!cleanName) return;

      let item = summaryMap.get(cleanName);
      if (!item) {
        item = {
          materialId: s.materialId || undefined,
          materialName: cleanName,
          unit: s.unit || "Nos",
          category: "-",
          purchasedQty: 0,
          suppliedQty: 0,
          currentStock: 0
        };
        summaryMap.set(cleanName, item);
      }

      if (s.unit && s.unit.toLowerCase() !== 'unit' && (!item.unit || item.unit.toLowerCase() === 'unit')) {
        item.unit = s.unit;
      }

      const qty = Math.abs(parseFloat(s.quantity) || 0);
      if (s.transactionType === "IN") {
        item.purchasedQty += qty;
        item.currentStock += qty;
      } else if (s.transactionType === "OUT") {
        item.suppliedQty += qty;
        item.currentStock -= qty;
      }

      if (s.createdAt && (!item.lastMovement || new Date(s.createdAt) > new Date(item.lastMovement))) {
        item.lastMovement = s.createdAt;
      }
    });

    return Array.from(summaryMap.values()).map(item => ({
      ...item,
      purchasedQty: Math.round(item.purchasedQty * 100) / 100,
      suppliedQty: Math.round(item.suppliedQty * 100) / 100,
      currentStock: Math.round(item.currentStock * 100) / 100
    }));
  }, [materials, stockLedger]);

  // Quick lookup map for available stock by material ID or Name
  const stockByMaterial = useMemo(() => {
    const map = new Map<string, { currentStock: number; unit: string }>();
    stockSummary.forEach(item => {
      if (item.materialId) {
        map.set(String(item.materialId), { currentStock: item.currentStock, unit: item.unit });
      }
      map.set(item.materialName.toLowerCase().trim(), { currentStock: item.currentStock, unit: item.unit });
      map.set(item.materialName.toUpperCase().trim(), { currentStock: item.currentStock, unit: item.unit });
    });
    return map;
  }, [stockSummary]);

  // Filtered stock list for search
  const filteredStock = useMemo(() => {
    if (!stockSearch.trim()) return stockSummary;
    const term = stockSearch.toLowerCase().trim();
    return stockSummary.filter(s => 
      s.materialName.toLowerCase().includes(term) ||
      s.category.toLowerCase().includes(term) ||
      s.unit.toLowerCase().includes(term)
    );
  }, [stockSummary, stockSearch]);

  // Stock KPI totals
  const stockKpis = useMemo(() => {
    let totalPurchased = 0;
    let totalSupplied = 0;
    let inStockCount = 0;
    let lowStockCount = 0;

    stockSummary.forEach(s => {
      totalPurchased += s.purchasedQty;
      totalSupplied += s.suppliedQty;
      if (s.currentStock > 0) {
        inStockCount++;
      } else {
        lowStockCount++;
      }
    });

    return {
      totalItems: stockSummary.length,
      totalPurchased: Math.round(totalPurchased * 100) / 100,
      totalSupplied: Math.round(totalSupplied * 100) / 100,
      inStockCount,
      lowStockCount
    };
  }, [stockSummary]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-rose-500/10 via-pink-500/5 to-rose-500/10 border border-rose-200/80 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-rose-600 text-white rounded-xl shadow-md">
            <PurchaseIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Material Purchase & Stock</h2>
            <p className="text-xs text-slate-600">Record inbound supplies. Real-time inventory ledger updates automatically upon every purchase.</p>
          </div>
        </div>

        <div className="flex bg-white rounded-lg p-1 border border-rose-100 shadow-sm w-max">
          <button
            onClick={() => setActiveSubTab("purchases")}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-colors ${activeSubTab === "purchases" ? "bg-rose-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            Purchase Records ({records.length})
          </button>
          <button
            onClick={() => setActiveSubTab("stock")}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 ${activeSubTab === "stock" ? "bg-rose-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            <Package className="w-3.5 h-3.5" /> Stock System ({stockSummary.length})
          </button>
        </div>
      </div>

      {activeSubTab === "purchases" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-900">Purchase Invoices</h3>
              <p className="text-[11px] text-slate-500">Every recorded purchase instantly increases the available inventory stock balance.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadData()}
                title="Refresh purchases and stock"
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => downloadExcelReport(`/reports/export-vendor-purchases?locationId=${locationId}`, `Vendor_Purchases_Location_${locationId}.xlsx`)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                title="Export Material Purchases & Vendor Bills to Excel"
              >
                <Download className="w-3.5 h-3.5" /> Export Purchases (.xlsx)
              </button>
              <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-rose-700 transition-colors cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Add Purchase
              </button>
            </div>
          </div>
          
          {/* Mobile Cards View */}
          <div className="block md:hidden divide-y divide-slate-100">
            {records.map(r => {
              const stockInfo = stockByMaterial.get(r.materialId ? String(r.materialId) : r.materialName?.toLowerCase()?.trim());
              const currentStockVal = stockInfo ? stockInfo.currentStock : null;

              const qty = parseFloat(r.quantity) || 0;
              const rate = parseFloat(r.rate) || 0;
              const subtotal = parseFloat(r.subtotal) || Math.round(qty * rate * 100) / 100;
              const discount = parseFloat(r.discount) || 0;
              const transport = parseFloat(r.transportCost) || 0;
              const taxRate = parseFloat(r.taxPercentage) || 0;
              const taxable = Math.max(0, subtotal - discount);
              const tax = parseFloat(r.tax) || Math.round(taxable * (taxRate / 100) * 100) / 100;
              const calculatedTotal = Math.round((taxable + tax + transport) * 100) / 100;
              const rowTotal = (parseFloat(r.totalAmount) > 0 && Math.abs(parseFloat(r.totalAmount) - (taxable + tax + transport)) < 1)
                ? parseFloat(r.totalAmount)
                : calculatedTotal;

              return (
                <div key={`mp-mob-${r.id}`} className="p-4 space-y-3 bg-white hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 text-xs font-medium">{r.date}</span>
                    <div className="flex items-center gap-2">
                      {currentStockVal !== null && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${currentStockVal > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                          {currentStockVal} {r.unit} stock
                        </span>
                      )}
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${r.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {r.paymentStatus}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-extrabold text-slate-900">{r.partyName}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-bold text-rose-700">{r.materialName}</span>
                      <span className="text-xs font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                        {r.quantity} {r.unit}
                      </span>
                    </div>
                    {r.description && <div className="text-[11px] text-slate-500 mt-1">{r.description}</div>}
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Rate</div>
                      <div className="font-semibold text-slate-700">₹{Number(r.rate).toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Subtotal</div>
                      <div className="font-semibold text-slate-700">₹{subtotal.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">GST / Tax</div>
                      <div className="font-semibold text-blue-700">{taxRate > 0 ? `${taxRate}% (+₹${tax.toLocaleString()})` : "0%"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-rose-600">Total Bill</div>
                      <div className="font-black text-rose-700 text-sm">₹{rowTotal.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleEdit(r)}
                      className="flex-1 min-h-[42px] px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-600" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      className="flex-1 min-h-[42px] px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-rose-200 transition-colors cursor-pointer active:scale-95"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" /> Delete (ડિલીટ)
                    </button>
                  </div>
                </div>
              );
            })}
            {records.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-xs">
                No purchases found. Click &quot;Add Purchase&quot; above to record material purchases and update inventory.
              </div>
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Vendor / Party</th>
                  <th className="p-3">Material</th>
                  <th className="p-3 text-right">Purchased Qty</th>
                  <th className="p-3 text-center">Live Stock</th>
                  <th className="p-3 text-right">Rate</th>
                  <th className="p-3 text-right">Subtotal (₹)</th>
                  <th className="p-3 text-right">Transport / Disc</th>
                  <th className="p-3 text-right">GST / Tax</th>
                  <th className="p-3 text-right font-black text-rose-700">Total (₹)</th>
                  <th className="p-3 text-center">Payment</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map(r => {
                  const stockInfo = stockByMaterial.get(r.materialId ? String(r.materialId) : r.materialName?.toLowerCase()?.trim());
                  const currentStockVal = stockInfo ? stockInfo.currentStock : null;

                  const qty = parseFloat(r.quantity) || 0;
                  const rate = parseFloat(r.rate) || 0;
                  const subtotal = parseFloat(r.subtotal) || Math.round(qty * rate * 100) / 100;
                  const discount = parseFloat(r.discount) || 0;
                  const transport = parseFloat(r.transportCost) || 0;
                  const taxRate = parseFloat(r.taxPercentage) || 0;
                  const taxable = Math.max(0, subtotal - discount);
                  const tax = parseFloat(r.tax) || Math.round(taxable * (taxRate / 100) * 100) / 100;
                  const calculatedTotal = Math.round((taxable + tax + transport) * 100) / 100;
                  const rowTotal = (parseFloat(r.totalAmount) > 0 && Math.abs(parseFloat(r.totalAmount) - (taxable + tax + transport)) < 1)
                    ? parseFloat(r.totalAmount)
                    : calculatedTotal;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-600">{r.date}</td>
                      <td className="p-3 font-bold text-slate-900">{r.partyName}</td>
                      <td className="p-3">
                        <div className="font-semibold text-rose-700">{r.materialName}</div>
                        {r.description && <div className="text-[10px] text-slate-400">{r.description}</div>}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900">
                        {r.quantity} {r.unit}
                      </td>
                      <td className="p-3 text-center">
                        {currentStockVal !== null ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${currentStockVal > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                            {currentStockVal} {r.unit} in stock
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right text-slate-600">₹{Number(r.rate).toLocaleString()}</td>
                      <td className="p-3 text-right font-medium text-slate-700">
                        ₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right text-[11px]">
                        {transport > 0 ? (
                          <span className="text-amber-800 font-semibold">+₹{transport.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                        {discount > 0 && (
                          <span className="text-emerald-700 block text-[10px]">-₹{discount.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="p-3 text-right text-[11px] text-slate-600">
                        {taxRate > 0 ? (
                          <span className="font-medium text-blue-700">{taxRate}% (+₹{tax.toLocaleString()})</span>
                        ) : tax > 0 ? (
                          <span className="font-medium text-blue-700">+₹{tax.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-400">0%</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-black text-rose-700 text-sm">
                        ₹{rowTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${r.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {r.paymentStatus}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleEdit(r)} className="text-slate-400 hover:text-amber-600 p-2 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer" title="Edit Purchase"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(r.id)} className="text-slate-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Delete Purchase (Reverts Stock)"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {records.length === 0 && <tr><td colSpan={12} className="p-8 text-center text-slate-500">No purchases found. Click "Add Purchase" above to record material purchases and update inventory.</td></tr>}
              </tbody>
              {records.length > 0 && (
                <tfoot className="bg-rose-50/70 border-t-2 border-rose-200 font-bold text-slate-800 text-xs">
                  <tr>
                    <td colSpan={3} className="p-3 text-slate-900 font-black uppercase tracking-wider">
                      Total ({records.length} records)
                    </td>
                    <td className="p-3 text-right font-black text-slate-900">
                      {purchaseAggregates.totalQty.toLocaleString()}
                    </td>
                    <td className="p-3 text-center text-slate-400">-</td>
                    <td className="p-3 text-right text-slate-400">-</td>
                    <td className="p-3 text-right font-black text-slate-900">
                      ₹{purchaseAggregates.totalSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-semibold text-slate-700">
                      +₹{purchaseAggregates.totalTransport.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {purchaseAggregates.totalDiscount > 0 && (
                        <span className="text-emerald-700 block text-[10px]">-₹{purchaseAggregates.totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-semibold text-blue-700">
                      +₹{purchaseAggregates.totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-black text-rose-700 text-sm">
                      ₹{purchaseAggregates.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {records.length > 0 && (
            <div className="p-4 bg-rose-50/50 border-t border-rose-200 flex flex-wrap justify-between items-center text-xs gap-3">
              <div className="flex flex-wrap items-center gap-4 text-slate-700 font-medium">
                <span>Total Records: <strong className="text-slate-900 font-bold">{records.length}</strong></span>
                <span>Base Subtotal: <strong className="text-slate-900 font-bold">₹{purchaseAggregates.totalSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                {purchaseAggregates.totalDiscount > 0 && (
                  <span>Discount: <strong className="text-emerald-700 font-bold">-₹{purchaseAggregates.totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                )}
                <span>GST / Tax: <strong className="text-blue-700 font-bold">+₹{purchaseAggregates.totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                <span>Transportation: <strong className="text-amber-800 font-bold">+₹{purchaseAggregates.totalTransport.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
              </div>
              <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-lg border border-rose-200 shadow-xs">
                <span className="font-bold text-rose-950 uppercase tracking-wider text-xs">Net Total (With GST & Transport):</span>
                <span className="text-base font-black text-rose-700">₹{purchaseAggregates.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSubTab === "stock" && (
        <div className="space-y-4">
          {/* Stock KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Materials Tracked</span>
                <Layers className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">{stockKpis.totalItems}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Active inventory items</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm bg-emerald-50/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700">Total Inward Qty</span>
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-emerald-700 mt-1">{stockKpis.totalPurchased.toLocaleString()}</div>
              <div className="text-[10px] text-emerald-600 mt-0.5">Total purchased in ledger</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm bg-amber-50/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-700">Total Outward Qty</span>
                <ArrowDownRight className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl font-black text-amber-700 mt-1">{stockKpis.totalSupplied.toLocaleString()}</div>
              <div className="text-[10px] text-amber-600 mt-0.5">Supplied to customers / sites</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Stock Health</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">{stockKpis.inStockCount} <span className="text-xs font-normal text-slate-500">In Stock</span></div>
              <div className="text-[10px] text-rose-500 mt-0.5">{stockKpis.lowStockCount} empty / zero balance</div>
            </div>
          </div>

          {/* Current Inventory Stock Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-rose-600" />
                <div>
                  <h3 className="font-bold text-slate-900">Current Inventory Stock</h3>
                  <p className="text-[11px] text-slate-500">Live stock balance automatically calculated from all purchases, customer supplies, and site disbursements.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={stockSearch}
                    onChange={e => setStockSearch(e.target.value)}
                    placeholder="Search material or unit..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-rose-400 w-44"
                  />
                </div>
                <button
                  onClick={() => setIsManageMaterialOpen(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Manage Materials
                </button>
                <button
                  onClick={() => downloadExcelReport(`/reports/export-location/${locationId}?tab=stock`, `Material_Stock_Location_${locationId}.xlsx`)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Export Current Stock Inventory to Excel"
                >
                  <Download className="w-3.5 h-3.5" /> Export Stock (.xlsx)
                </button>
                <button
                  onClick={() => setShowLedgerLogs(!showLedgerLogs)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${showLedgerLogs ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  {showLedgerLogs ? "Hide Movement Logs" : "View Movement Logs"}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Material Name</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5 text-right text-emerald-700">Total Inward (Purchased)</th>
                    <th className="p-3.5 text-right text-amber-700">Total Outward (Supplied)</th>
                    <th className="p-3.5 text-right font-black">Available Stock</th>
                    <th className="p-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStock.map((m, idx) => {
                    const isPositive = m.currentStock > 0;
                    const isZero = m.currentStock === 0;

                    return (
                      <tr key={m.materialId ? `mat_${m.materialId}` : `idx_${idx}`} className="hover:bg-slate-50">
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900 text-sm">{m.materialName}</div>
                          <div className="text-[10px] text-slate-400">Unit: {m.unit}</div>
                        </td>
                        <td className="p-3.5 text-slate-500">{m.category || "-"}</td>
                        <td className="p-3.5 text-right font-semibold text-emerald-700">
                          +{m.purchasedQty} {m.unit}
                        </td>
                        <td className="p-3.5 text-right font-semibold text-amber-700">
                          -{m.suppliedQty} {m.unit}
                        </td>
                        <td className="p-3.5 text-right">
                          <span className={`text-base font-black ${isPositive ? 'text-emerald-700' : isZero ? 'text-slate-400' : 'text-rose-600'}`}>
                            {m.currentStock.toLocaleString()} {m.unit}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          {isPositive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" /> In Stock
                            </span>
                          ) : isZero ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                              Depleted (0)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                              <AlertTriangle className="w-3 h-3" /> Negative Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredStock.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        {stockSearch ? "No materials matched your search." : "No inventory stock movements recorded yet. Add your first purchase above to populate inventory stock."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Real-Time Stock Movement Audit Trail */}
          {showLedgerLogs && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900 text-xs">Live Stock Movement Ledger (Audit Trail)</h3>
                  <p className="text-[10px] text-slate-500">Chronological transaction movements recorded by the server stock engine.</p>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">{stockLedger.length} Total Movements</span>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-left text-[11px] whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2.5">Date / Time</th>
                      <th className="p-2.5">Material</th>
                      <th className="p-2.5 text-center">Type</th>
                      <th className="p-2.5 text-right">Quantity</th>
                      <th className="p-2.5">Reference Type</th>
                      <th className="p-2.5">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stockLedger.map((entry: any) => {
                      const isIncoming = entry.transactionType === "IN";
                      const dateStr = entry.createdAt ? new Date(entry.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

                      return (
                        <tr key={entry.id} className="hover:bg-slate-50">
                          <td className="p-2.5 text-slate-500">{dateStr}</td>
                          <td className="p-2.5 font-bold text-slate-800">{entry.materialName}</td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black ${isIncoming ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {entry.transactionType}
                            </span>
                          </td>
                          <td className={`p-2.5 text-right font-black ${isIncoming ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {isIncoming ? `+${Math.abs(parseFloat(entry.quantity))}` : `-${Math.abs(parseFloat(entry.quantity))}`} {entry.unit}
                          </td>
                          <td className="p-2.5 text-slate-600 font-mono text-[10px]">{entry.referenceType} #{entry.referenceId}</td>
                          <td className="p-2.5 text-slate-400 truncate max-w-xs">{entry.notes || "-"}</td>
                        </tr>
                      );
                    })}
                    {stockLedger.length === 0 && (
                      <tr><td colSpan={6} className="p-6 text-center text-slate-400">No stock ledger entries recorded.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Material Purchase" : "Add Material Purchase"} maxWidth="2xl">
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">4. Material Name *</label>
                <button
                  type="button"
                  onClick={() => setIsManageMaterialOpen(true)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Manage Material
                </button>
              </div>
              <select
                required
                value={formData.materialId}
                onChange={e => {
                  const selected = materials.find(m => String(m.id) === e.target.value);
                  const matName = e.target.options[e.target.selectedIndex]?.text || "";
                  setFormData(prev => ({
                    ...prev,
                    materialId: e.target.value,
                    materialName: matName,
                    rate: selected?.defaultRate ? String(selected.defaultRate) : prev.rate
                  }));
                  if (selected && selected.defaultUnit) {
                    if (PRESET_UNITS.includes(selected.defaultUnit)) {
                      setUnitMode(selected.defaultUnit);
                      setCustomUnit("");
                    } else {
                      setUnitMode("Custom");
                      setCustomUnit(selected.defaultUnit);
                    }
                  }
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">-- Select Material --</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              {formData.materialId && (
                <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                  <span>Current stock:</span>
                  <span className="font-bold text-emerald-700">
                    {stockByMaterial.get(formData.materialId)?.currentStock ?? 0} {effectiveUnit}
                  </span>
                </div>
              )}
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
              <label className="block text-xs font-bold text-slate-700 mb-1">8. Transport Fee (₹) (+)</label>
              <input type="number" step="0.01" value={formData.transportCost} onChange={e => setFormData({...formData, transportCost: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
              <span className="text-[10px] text-slate-500">Excluded from GST (added separately)</span>
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
               <span>15. Transport Fee (No GST, added separately)</span>
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

      {/* Quick Manage Material Modal */}
      <ManageMaterialsModal
        isOpen={isManageMaterialOpen}
        onClose={() => setIsManageMaterialOpen(false)}
        locationId={locationId}
        currentSelectedId={formData.materialId}
        onSelectMaterial={(selectedMat) => {
          setFormData(prev => ({
            ...prev,
            materialId: String(selectedMat.id),
            materialName: selectedMat.name,
            rate: selectedMat.defaultRate ? String(selectedMat.defaultRate) : prev.rate
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
