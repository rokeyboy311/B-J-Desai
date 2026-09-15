import React, { useState, useEffect } from "react";
import { 
  CreditCard, Plus, Search, ArrowDownLeft, ArrowUpRight, 
  Trash2, DollarSign, Calendar, Filter, X, Building2, CheckCircle2, AlertCircle
} from "lucide-react";
import { apiFetch } from "../lib/api";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [modeFilter, setModeFilter] = useState("ALL");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<"PAYMENT_IN" | "PAYMENT_OUT">("PAYMENT_IN");
  const [partyName, setPartyName] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState("BANK_TRANSFER");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const [payData, partyData, locData] = await Promise.all([
        apiFetch("/payments").catch(() => []),
        apiFetch("/master/parties").catch(() => []),
        apiFetch("/locations").catch(() => [])
      ]);

      setPayments(Array.isArray(payData) ? payData : []);
      setParties(Array.isArray(partyData) ? partyData : []);
      setLocations(Array.isArray(locData) ? locData : []);
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to load payment records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyName.trim()) {
      setActionError("Please enter party name");
      return;
    }
    if (amount <= 0) {
      setActionError("Please enter a valid amount");
      return;
    }

    try {
      await apiFetch("/payments", {
        method: "POST",
        body: JSON.stringify({
          partyName,
          paymentType,
          amount,
          date: paymentDate,
          paymentMode,
          referenceNumber: referenceNumber.trim() || undefined,
          locationId: selectedLocationId ? Number(selectedLocationId) : undefined,
          notes: notes.trim() || undefined
        })
      });

      setPaymentModalOpen(false);
      setActionSuccess(paymentType === "PAYMENT_IN" ? "Payment In (Receipt) recorded" : "Payment Out (Payout) recorded");
      setTimeout(() => setActionSuccess(null), 4000);
      setPartyName("");
      setAmount(0);
      setReferenceNumber("");
      setNotes("");
      fetchPayments();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Error saving payment");
      setTimeout(() => setActionError(null), 5000);
    }
  };

  const handleDeletePayment = async (id: number) => {
    try {
      await apiFetch(`/payments/${id}`, { method: "DELETE" });
      setActionSuccess("Payment record removed and associated balances adjusted");
      setTimeout(() => setActionSuccess(null), 4000);
      fetchPayments();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to delete payment");
      setTimeout(() => setActionError(null), 5000);
    }
  };

  // KPIs
  const totalIn = payments
    .filter(p => p.paymentType === "PAYMENT_IN")
    .reduce((acc, p) => acc + parseFloat(p.amount || "0"), 0);

  const totalOut = payments
    .filter(p => p.paymentType === "PAYMENT_OUT")
    .reduce((acc, p) => acc + parseFloat(p.amount || "0"), 0);

  const netCashFlow = totalIn - totalOut;

  // Filtered
  const filteredPayments = payments.filter(p => {
    const matchesSearch = 
      p.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.referenceNumber && p.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = typeFilter === "ALL" || p.paymentType === typeFilter;
    const matchesMode = modeFilter === "ALL" || p.paymentMode === modeFilter;

    return matchesSearch && matchesType && matchesMode;
  });

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <CreditCard className="text-indigo-600" size={26} /> Payments & Cash/Bank Ledger
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Record customer receipts (Inflows) and vendor payments (Outflows) with full audit trails
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPaymentType("PAYMENT_IN");
                setPaymentModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition-all shadow-md shadow-emerald-600/20 active:scale-95"
            >
              <ArrowDownLeft size={18} /> + Payment In (Receipt)
            </button>
            <button
              onClick={() => {
                setPaymentType("PAYMENT_OUT");
                setPaymentModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium text-sm transition-all shadow-md shadow-rose-600/20 active:scale-95"
            >
              <ArrowUpRight size={18} /> - Payment Out (Payout)
            </button>
          </div>
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
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-600">Total Money Received (In)</span>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              ₹{totalIn.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-xs text-slate-500 mt-1 block">Customer Receipts & Inflows</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-rose-600">Total Money Paid (Out)</span>
            <p className="text-2xl font-bold text-rose-600 mt-1">
              ₹{totalOut.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-xs text-slate-500 mt-1 block">Suppliers, Labour & Expense Disbursements</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-indigo-600">Net Flow</span>
            <p className={`text-2xl font-bold mt-1 ${netCashFlow >= 0 ? "text-indigo-700" : "text-amber-600"}`}>
              ₹{netCashFlow.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-xs text-slate-500 mt-1 block">Surplus / (Deficit)</span>
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
              placeholder="Search party or UTR / reference #..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            {["ALL", "PAYMENT_IN", "PAYMENT_OUT"].map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  typeFilter === t
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t === "PAYMENT_IN" ? "Payment In" : t === "PAYMENT_OUT" ? "Payment Out" : "All Types"}
              </button>
            ))}

            <select
              value={modeFilter}
              onChange={e => setModeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 border-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Modes</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="CASH">Cash</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="p-4">Date</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Party Name</th>
                  <th className="p-4">Mode</th>
                  <th className="p-4">Ref / UTR #</th>
                  <th className="p-4 text-right">Inflow (₹)</th>
                  <th className="p-4 text-right">Outflow (₹)</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      Loading payments...
                    </td>
                  </tr>
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      <CreditCard size={36} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-700">No Payment Records</p>
                      <p className="text-xs text-slate-400 mt-1">Record a payment in or out using the buttons above.</p>
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map(p => {
                    const isIn = p.paymentType === "PAYMENT_IN";
                    const amt = parseFloat(p.amount || "0");

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="p-4 text-slate-600 text-xs font-medium whitespace-nowrap">
                          {p.date}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                            isIn ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          }`}>
                            {isIn ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                            {isIn ? "Payment In" : "Payment Out"}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-slate-900">
                          {p.partyName}
                          {p.notes && <span className="text-xs text-slate-400 font-normal block">{p.notes}</span>}
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium text-slate-700">
                            {p.paymentMode?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-xs text-slate-500">
                          {p.referenceNumber || "-"}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-emerald-600">
                          {isIn ? `₹${amt.toFixed(2)}` : "-"}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-rose-600">
                          {!isIn ? `₹${amt.toFixed(2)}` : "-"}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDeletePayment(p.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
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
      </div>

      {/* RECORD PAYMENT MODAL */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">
                  {paymentType === "PAYMENT_IN" ? "Record Payment In (Receipt)" : "Record Payment Out (Disbursement)"}
                </h3>
                <p className="text-xs text-slate-500">
                  {paymentType === "PAYMENT_IN" ? "Money received from customer" : "Money paid to supplier or vendor"}
                </p>
              </div>
              <button onClick={() => setPaymentModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="p-5 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Party Name *</label>
                <input
                  type="text"
                  value={partyName}
                  onChange={e => setPartyName(e.target.value)}
                  placeholder="Customer or Supplier name"
                  list="payment-parties"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <datalist id="payment-parties">
                  {parties.map(p => (
                    <option key={p.id} value={p.name}>{p.name} ({p.partyType})</option>
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={amount}
                    onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI / QR</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / UTR #</label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={e => setReferenceNumber(e.target.value)}
                    placeholder="Bank UTR or Cheque no."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Location / Site Tag (Optional)</label>
                <select
                  value={selectedLocationId}
                  onChange={e => setSelectedLocationId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  <option value="">General / Head Office</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Description</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Optional remarks"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
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
                  className={`px-5 py-2 text-white rounded-xl text-xs font-semibold shadow-md ${
                    paymentType === "PAYMENT_IN" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
