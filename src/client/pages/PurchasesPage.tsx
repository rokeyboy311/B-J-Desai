import React, { useState, useEffect } from "react";
import { 
  ShoppingBag, Plus, Search, Filter, Trash2, 
  DollarSign, CheckCircle2, AlertCircle, X, Building2, Eye
} from "lucide-react";
import { apiFetch } from "../lib/api";

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);

  // Form
  const [selectedLocationId, setSelectedLocationId] = useState<number | "">("");
  const [partyName, setPartyName] = useState("");
  const [supplierGst, setSupplierGst] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState("Nos");
  const [rate, setRate] = useState<number>(0);
  const [transportCost, setTransportCost] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(18);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  // Payment form
  const [payAmt, setPayAmt] = useState<number>(0);
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payMode, setPayMode] = useState("BANK_TRANSFER");
  const [payRef, setPayRef] = useState("");

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const [purData, partyData, locData, itemData] = await Promise.all([
        apiFetch("/materials/purchases").catch(() => []),
        apiFetch("/master/parties").catch(() => []),
        apiFetch("/locations").catch(() => []),
        apiFetch("/items").catch(() => ({ items: [] }))
      ]);

      setPurchases(Array.isArray(purData) ? purData : []);
      setParties(Array.isArray(partyData) ? partyData : []);
      const locs = Array.isArray(locData) ? locData : [];
      setLocations(locs);
      if (locs.length > 0 && !selectedLocationId) {
        setSelectedLocationId(locs[0].id);
      }
      setItems(Array.isArray(itemData) ? itemData : itemData.items || []);
    } catch (err) {
      console.error("Failed to load purchase data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const handlePartySelect = (name: string) => {
    setPartyName(name);
    const found = parties.find(p => p.name === name);
    if (found && found.gst) setSupplierGst(found.gst);
  };

  const handleItemSelect = (name: string) => {
    setMaterialName(name);
    const found = items.find(i => i.name === name);
    if (found) {
      setUnit(found.unit || "Nos");
      setRate(parseFloat(found.purchasePrice || "0"));
      setTaxRate(parseFloat(found.taxRate || "18"));
    }
  };

  // Calculations
  const subtotal = quantity * rate;
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = (taxable * taxRate) / 100;
  const totalAmount = Math.round((taxable + taxAmount + transportCost) * 100) / 100;

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocationId) {
      setActionError("Please select a location");
      return;
    }
    if (!partyName.trim()) {
      setActionError("Please enter supplier name");
      return;
    }
    if (!materialName.trim()) {
      setActionError("Please enter material/item name");
      return;
    }

    try {
      await apiFetch("/materials/purchases", {
        method: "POST",
        body: JSON.stringify({
          locationId: Number(selectedLocationId),
          partyName,
          gst: supplierGst.trim() || undefined,
          materialName,
          quantity,
          unit,
          rate,
          subtotal,
          transportCost,
          discount,
          taxPercentage: taxRate,
          paidAmount,
          date: purchaseDate,
          invoiceNumber: supplierInvoiceNo.trim() || undefined,
          paymentMethod: paidAmount > 0 ? paymentMethod : undefined,
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined
        })
      });

      setCreateModalOpen(false);
      setActionSuccess("Purchase recorded and stock/ledger updated");
      setTimeout(() => setActionSuccess(null), 4000);
      setPartyName("");
      setSupplierGst("");
      setMaterialName("");
      setQuantity(1);
      setRate(0);
      setPaidAmount(0);
      setNotes("");
      fetchPurchases();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to record purchase");
      setTimeout(() => setActionError(null), 5000);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurchase || payAmt <= 0) {
      setActionError("Please enter a valid payment amount");
      return;
    }

    try {
      await apiFetch(`/materials/purchases/${selectedPurchase.id}/payment`, {
        method: "POST",
        body: JSON.stringify({
          amount: payAmt,
          paymentMode: payMode,
          paymentDate: payDate,
          referenceNumber: payRef || undefined,
          notes: `Supplier payment for ${selectedPurchase.materialName}`
        })
      });

      setPaymentModalOpen(false);
      setSelectedPurchase(null);
      setPayAmt(0);
      setPayRef("");
      setActionSuccess("Payment to supplier recorded");
      setTimeout(() => setActionSuccess(null), 4000);
      fetchPurchases();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Payment recording failed");
      setTimeout(() => setActionError(null), 5000);
    }
  };

  const handleDeletePurchase = async (id: number) => {
    try {
      await apiFetch(`/materials/purchases/${id}`, { method: "DELETE" });
      setActionSuccess("Purchase deleted");
      setTimeout(() => setActionSuccess(null), 4000);
      fetchPurchases();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to delete purchase");
      setTimeout(() => setActionError(null), 5000);
    }
  };

  // KPIs
  const totalPurchases = purchases.reduce((acc, p) => acc + parseFloat(p.totalAmount || "0"), 0);
  const totalPaid = purchases.reduce((acc, p) => acc + parseFloat(p.paidAmount || "0"), 0);
  const totalOutstanding = purchases.reduce((acc, p) => acc + parseFloat(p.outstandingAmount || "0"), 0);
  const totalItc = purchases.reduce((acc, p) => acc + parseFloat(p.tax || "0"), 0);

  // Filtered
  const filteredPurchases = purchases.filter(p => {
    const matchesSearch = 
      p.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.materialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.supplierInvoiceNo && p.supplierInvoiceNo.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || p.paymentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ShoppingBag className="text-indigo-600" size={26} /> Purchases & Supplier Bills
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Record raw material procurement bills, track supplier payables and input tax credits (ITC)
            </p>
          </div>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-all shadow-md shadow-indigo-600/20 active:scale-95"
          >
            <Plus size={18} /> Add Purchase Bill
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
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Total Purchases</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              ₹{totalPurchases.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-xs text-slate-500 mt-1 block">{purchases.length} Purchase Bills</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-600">Paid to Vendors</span>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              ₹{totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-xs text-slate-500 mt-1 block">Disbursed to Suppliers</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-rose-600">Payables (Outstanding)</span>
            <p className="text-2xl font-bold text-rose-600 mt-1">
              ₹{totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-xs text-slate-500 mt-1 block">Pending Vendor Payments</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-indigo-600">Input Tax Credit (ITC)</span>
            <p className="text-2xl font-bold text-indigo-700 mt-1">
              ₹{totalItc.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-xs text-slate-500 mt-1 block">GST Input Credit on Purchases</span>
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
              placeholder="Search supplier, item, bill #..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            {["ALL", "UNPAID", "PARTIAL", "PAID"].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  statusFilter === status
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Purchases Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="p-4">Date</th>
                  <th className="p-4">Supplier</th>
                  <th className="p-4">Material / Item</th>
                  <th className="p-4 text-right">Qty</th>
                  <th className="p-4 text-right">Rate (₹)</th>
                  <th className="p-4 text-right">Total Bill (₹)</th>
                  <th className="p-4 text-right">Outstanding (₹)</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">Loading purchase records...</td>
                  </tr>
                ) : filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-400">
                      <ShoppingBag size={36} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-700">No Purchases Found</p>
                      <p className="text-xs text-slate-400 mt-1">Record purchases to track inventory costs and supplier balances.</p>
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map(p => {
                    const totalAmt = parseFloat(p.totalAmount || "0");
                    const outAmt = parseFloat(p.outstandingAmount || "0");

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="p-4 text-slate-600 text-xs font-medium whitespace-nowrap">{p.date}</td>
                        <td className="p-4">
                          <p className="font-semibold text-slate-900">{p.partyName}</p>
                          {p.supplierInvoiceNo && (
                            <span className="text-[11px] font-mono text-slate-400 block">Bill #{p.supplierInvoiceNo}</span>
                          )}
                        </td>
                        <td className="p-4 font-medium text-slate-800">{p.materialName}</td>
                        <td className="p-4 text-right font-medium">
                          {p.quantity} <span className="text-xs text-slate-500">{p.unit}</span>
                        </td>
                        <td className="p-4 text-right font-mono text-slate-600">
                          ₹{parseFloat(p.rate || "0").toFixed(2)}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-slate-900">
                          ₹{totalAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-right font-mono font-semibold text-rose-600">
                          ₹{outAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                            p.paymentStatus === "PAID"
                              ? "bg-emerald-100 text-emerald-800"
                              : p.paymentStatus === "PARTIAL"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}>
                            {p.paymentStatus}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {outAmt > 0 && (
                              <button
                                onClick={() => {
                                  setSelectedPurchase(p);
                                  setPayAmt(outAmt);
                                  setPaymentModalOpen(true);
                                }}
                                title="Pay Supplier"
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              >
                                <DollarSign size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeletePurchase(p.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
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

      {/* ADD PURCHASE MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Record Purchase Bill</h3>
                <p className="text-xs text-slate-500">Add supplier invoice, material quantities, GST and initial payment</p>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePurchase} className="p-5 space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Location / Site *</label>
                  <select
                    value={selectedLocationId}
                    onChange={e => setSelectedLocationId(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    required
                  >
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Date *</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Bill / Invoice #</label>
                  <input
                    type="text"
                    value={supplierInvoiceNo}
                    onChange={e => setSupplierInvoiceNo(e.target.value)}
                    placeholder="e.g. INV-8891"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Party Name *</label>
                  <input
                    type="text"
                    value={partyName}
                    onChange={e => handlePartySelect(e.target.value)}
                    placeholder="Supplier name"
                    list="supplier-parties"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    required
                  />
                  <datalist id="supplier-parties">
                    {parties.map(p => (
                      <option key={p.id} value={p.name}>{p.name} ({p.partyType})</option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier GSTIN</label>
                  <input
                    type="text"
                    value={supplierGst}
                    onChange={e => setSupplierGst(e.target.value.toUpperCase())}
                    placeholder="e.g. 24ABCDE1234F1Z5"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Material / Item *</label>
                  <input
                    type="text"
                    value={materialName}
                    onChange={e => handleItemSelect(e.target.value)}
                    placeholder="Material name"
                    list="catalog-items"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    required
                  />
                  <datalist id="catalog-items">
                    {items.map(i => (
                      <option key={i.id} value={i.name}>{i.name} - ₹{i.purchasePrice}</option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    value={quantity}
                    onChange={e => setQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
                  <select
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="Nos">Nos</option>
                    <option value="Bags">Bags</option>
                    <option value="Ton">Ton</option>
                    <option value="Kg">Kg</option>
                    <option value="Trips">Trips</option>
                    <option value="Mtr">Mtr</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rate (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={rate}
                    onChange={e => setRate(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GST %</label>
                  <select
                    value={taxRate}
                    onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={discount}
                    onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Transport (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={transportCost}
                    onChange={e => setTransportCost(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-500">Taxable: ₹{taxable.toFixed(2)} | GST Tax (ITC): ₹{taxAmount.toFixed(2)}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[11px]">Total Bill Amount:</span>
                  <span className="font-mono font-bold text-base text-slate-900">₹{totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-emerald-700 mb-1">Paid Now (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={totalAmount}
                    value={paidAmount}
                    onChange={e => setPaidAmount(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-emerald-700"
                  />
                </div>

                {paidAmount > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    >
                      <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                      <option value="UPI">UPI</option>
                      <option value="CASH">Cash</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md shadow-indigo-600/20"
                >
                  Save Purchase Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {paymentModalOpen && selectedPurchase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Pay Supplier</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedPurchase.partyName}</p>
              </div>
              <button onClick={() => setPaymentModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-5 space-y-4 text-xs sm:text-sm">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <span className="text-slate-500">Balance Pending:</span>
                <span className="font-mono font-bold text-rose-600 text-sm">
                  ₹{parseFloat(selectedPurchase.outstandingAmount || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount to Pay (₹) *</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  max={parseFloat(selectedPurchase.outstandingAmount || "0")}
                  value={payAmt}
                  onChange={e => setPayAmt(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
