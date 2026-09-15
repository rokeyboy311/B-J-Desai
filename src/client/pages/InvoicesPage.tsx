import React, { useState, useEffect } from "react";
import { 
  FileText, Plus, Search, Filter, Printer, DollarSign, 
  Trash2, CheckCircle2, Clock, AlertCircle, ArrowUpRight, 
  Eye, RefreshCw, X, ChevronDown, Building2, Truck, PackageOpen
} from "lucide-react";
import { apiFetch } from "../lib/api";
import InvoicePrintView from "../components/invoices/InvoicePrintView";
import MaterialSupplySection from "../components/sales/MaterialSupplySection";
import MaterialLabourSupplySection from "../components/sales/MaterialLabourSupplySection";

interface InvoiceItemForm {
  itemId?: number;
  description: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  rate: number;
  discount: number;
  taxRate: number;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activeSalesTab, setActiveSalesTab] = useState<"tax_invoices" | "material_supply" | "labour_supply">("tax_invoices");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  
  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [printInvoice, setPrintInvoice] = useState<any | null>(null);

  // New Invoice Form State
  const [invoiceType, setInvoiceType] = useState<"TAX_INVOICE" | "BILL_OF_SUPPLY" | "PROFORMA">("TAX_INVOICE");
  const [selectedLocationId, setSelectedLocationId] = useState<number | "">("");
  const [partyName, setPartyName] = useState("");
  const [partyGst, setPartyGst] = useState("");
  const [partyPhone, setPartyPhone] = useState("");
  const [partyAddress, setPartyAddress] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("Gujarat (24)");
  const [isInterState, setIsInterState] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [initialPaidAmount, setInitialPaidAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState("BANK_TRANSFER");

  const [lineItems, setLineItems] = useState<InvoiceItemForm[]>([
    { description: "", hsnCode: "", quantity: 1, unit: "Nos", rate: 0, discount: 0, taxRate: 18 }
  ]);

  // Payment record form
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payMode, setPayMode] = useState("BANK_TRANSFER");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invData, partyData, itemData, locData] = await Promise.all([
        apiFetch("/invoices").catch(() => []),
        apiFetch("/master/parties").catch(() => []),
        apiFetch("/items").catch(() => ({ items: [] })),
        apiFetch("/locations").catch(() => [])
      ]);

      setInvoices(Array.isArray(invData) ? invData : []);
      setParties(Array.isArray(partyData) ? partyData : []);
      setItems(Array.isArray(itemData) ? itemData : itemData.items || []);
      const locs = Array.isArray(locData) ? locData : [];
      setLocations(locs);
      if (locs.length > 0 && !selectedLocationId) {
        setSelectedLocationId(locs[0].id);
      }
    } catch (err) {
      console.error("Failed to load invoice data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle party selection
  const handlePartySelect = (name: string) => {
    setPartyName(name);
    const found = parties.find(p => p.name === name);
    if (found) {
      setPartyGst(found.gst || "");
      setPartyPhone(found.phone || "");
      setPartyAddress(found.address || "");
      if (found.state) {
        setPlaceOfSupply(`${found.state} (${found.stateCode || "24"})`);
        setIsInterState(found.stateCode && found.stateCode !== "24");
      }
    }
  };

  // Handle item pick in line
  const handleItemSelect = (index: number, itemId: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const newLines = [...lineItems];
    newLines[index] = {
      ...newLines[index],
      itemId: item.id,
      description: item.name,
      hsnCode: item.hsnCode || "",
      unit: item.unit || "Nos",
      rate: parseFloat(item.salePrice || "0"),
      taxRate: parseFloat(item.taxRate || "18")
    };
    setLineItems(newLines);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { description: "", hsnCode: "", quantity: 1, unit: "Nos", rate: 0, discount: 0, taxRate: 18 }
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof InvoiceItemForm, value: any) => {
    const newLines = [...lineItems];
    newLines[index] = { ...newLines[index], [field]: value };
    setLineItems(newLines);
  };

  // Calculations for active form
  const computedLines = lineItems.map(item => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const disc = Number(item.discount) || 0;
    const gross = qty * rate;
    const taxable = Math.max(0, gross - disc);
    const taxRate = Number(item.taxRate) || 0;

    let cgst = 0, sgst = 0, igst = 0;
    if (isInterState) {
      igst = (taxable * taxRate) / 100;
    } else {
      cgst = (taxable * (taxRate / 2)) / 100;
      sgst = (taxable * (taxRate / 2)) / 100;
    }
    const total = taxable + cgst + sgst + igst;

    return { ...item, gross, taxable, cgst, sgst, igst, total };
  });

  const formTaxableAmount = computedLines.reduce((acc, l) => acc + l.taxable, 0);
  const formCgst = computedLines.reduce((acc, l) => acc + l.cgst, 0);
  const formSgst = computedLines.reduce((acc, l) => acc + l.sgst, 0);
  const formIgst = computedLines.reduce((acc, l) => acc + l.igst, 0);
  const formTotalTax = formCgst + formSgst + formIgst;
  const formGrandTotal = Math.round((formTaxableAmount + formTotalTax) * 100) / 100;
  const formRoundOff = Math.round((formGrandTotal - (formTaxableAmount + formTotalTax)) * 100) / 100;

  // Submit create invoice
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyName.trim()) {
      alert("Please enter customer name");
      return;
    }
    if (lineItems.length === 0 || !lineItems[0].description.trim()) {
      alert("Please add at least one line item with a description");
      return;
    }

    try {
      const payload = {
        locationId: selectedLocationId ? Number(selectedLocationId) : undefined,
        partyName,
        partyGst: partyGst.trim() || undefined,
        partyPhone: partyPhone.trim() || undefined,
        partyAddress: partyAddress.trim() || undefined,
        placeOfSupply,
        invoiceType,
        invoiceDate,
        dueDate: dueDate || undefined,
        paidAmount: initialPaidAmount,
        paymentMode: initialPaidAmount > 0 ? paymentMode : undefined,
        notes: notes.trim() || undefined,
        items: computedLines.map(l => ({
          itemId: l.itemId,
          description: l.description,
          hsnCode: l.hsnCode || undefined,
          quantity: l.quantity,
          unit: l.unit,
          rate: l.rate,
          discount: l.discount,
          taxRate: l.taxRate
        }))
      };

      await apiFetch("/invoices", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setCreateModalOpen(false);
      setActionSuccess("GST Invoice generated successfully");
      setTimeout(() => setActionSuccess(null), 4000);
      // Reset
      setPartyName("");
      setPartyGst("");
      setPartyPhone("");
      setPartyAddress("");
      setInitialPaidAmount(0);
      setLineItems([{ description: "", hsnCode: "", quantity: 1, unit: "Nos", rate: 0, discount: 0, taxRate: 18 }]);
      fetchData();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to submit invoice");
      setTimeout(() => setActionError(null), 5000);
    }
  };

  // Submit payment record
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    if (payAmount <= 0) {
      setActionError("Please enter a valid payment amount");
      return;
    }

    try {
      await apiFetch(`/invoices/${selectedInvoice.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: payAmount,
          date: payDate,
          paymentMode: payMode,
          referenceNumber: payRef || undefined,
          notes: payNotes || undefined
        })
      });

      setPaymentModalOpen(false);
      setSelectedInvoice(null);
      setPayAmount(0);
      setPayRef("");
      setPayNotes("");
      setActionSuccess("Payment recorded and ledger updated");
      setTimeout(() => setActionSuccess(null), 4000);
      fetchData();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Payment recording failed");
      setTimeout(() => setActionError(null), 5000);
    }
  };

  const handleDeleteInvoice = async (id: number) => {
    try {
      await apiFetch(`/invoices/${id}`, { method: "DELETE" });
      setActionSuccess("Invoice deleted and stock restored");
      setTimeout(() => setActionSuccess(null), 4000);
      fetchData();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to delete invoice");
      setTimeout(() => setActionError(null), 5000);
    }
  };

  const openPrintModal = async (invoiceId: number) => {
    try {
      const data = await apiFetch(`/invoices/${invoiceId}`);
      setPrintInvoice(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered list
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (inv.partyName && inv.partyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (inv.partyGst && inv.partyGst.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || inv.paymentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // KPIs
  const totalInvoiced = invoices.reduce((acc, i) => acc + parseFloat(i.totalAmount || "0"), 0);
  const totalPaid = invoices.reduce((acc, i) => acc + parseFloat(i.paidAmount || "0"), 0);
  const totalBalance = invoices.reduce((acc, i) => acc + parseFloat(i.balanceAmount || "0"), 0);
  const totalOutputGst = invoices.reduce((acc, i) => acc + parseFloat(i.totalTax || "0"), 0);

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="text-indigo-600" size={26} /> GST Tax Invoices & Billing
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Create GST invoices, manage line items, track client receivables & print tax invoices
            </p>
          </div>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-all shadow-md shadow-indigo-600/20 active:scale-95"
          >
            <Plus size={18} /> New GST Invoice
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

        {/* Sales Module Sub-Navigation */}
        <div className="flex items-center gap-1.5 bg-slate-200/60 p-1.5 rounded-2xl w-fit">
          <button
            onClick={() => setActiveSalesTab("tax_invoices")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeSalesTab === "tax_invoices"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText size={15} />
            GST Tax Invoices & Billing
          </button>
          <button
            onClick={() => setActiveSalesTab("material_supply")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeSalesTab === "material_supply"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Truck size={15} />
            Material Supply Orders
          </button>
          <button
            onClick={() => setActiveSalesTab("labour_supply")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeSalesTab === "labour_supply"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <PackageOpen size={15} />
            Material + Labour Contracts
          </button>
        </div>

        {activeSalesTab === "material_supply" && <MaterialSupplySection />}
        {activeSalesTab === "labour_supply" && <MaterialLabourSupplySection />}

        {activeSalesTab === "tax_invoices" && (
          <>
            {/* Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Total Invoiced</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              ₹{totalInvoiced.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-xs text-slate-500 mt-1 block">{invoices.length} Invoices Issued</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-600">Total Collected</span>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              ₹{totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-xs text-slate-500 mt-1 block">Received from Clients</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-rose-600">Receivables (Outstanding)</span>
            <p className="text-2xl font-bold text-rose-600 mt-1">
              ₹{totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-xs text-slate-500 mt-1 block">Pending Collection</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-indigo-600">Output GST Tax</span>
            <p className="text-2xl font-bold text-indigo-700 mt-1">
              ₹{totalOutputGst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-xs text-slate-500 mt-1 block">CGST + SGST + IGST</span>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search invoice #, customer, GSTIN..."
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

        {/* Invoices Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="p-4">Invoice #</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4 text-right">Taxable</th>
                  <th className="p-4 text-right">GST Tax</th>
                  <th className="p-4 text-right">Total (₹)</th>
                  <th className="p-4 text-right">Balance Due</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      Loading invoices...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-400">
                      <FileText size={36} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-700">No GST Invoices Found</p>
                      <p className="text-xs text-slate-400 mt-1">Click "New GST Invoice" above to generate your first invoice.</p>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map(inv => {
                    const totalAmt = parseFloat(inv.totalAmount || "0");
                    const balAmt = parseFloat(inv.balanceAmount || "0");
                    const taxAmt = parseFloat(inv.totalTax || "0");
                    const taxableAmt = parseFloat(inv.taxableAmount || "0");

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="p-4">
                          <span className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</span>
                          <span className="block text-[11px] text-slate-400 uppercase">{inv.invoiceType?.replace('_', ' ')}</span>
                        </td>
                        <td className="p-4 text-slate-600 text-xs font-medium">
                          {inv.invoiceDate}
                        </td>
                        <td className="p-4">
                          <p className="font-semibold text-slate-900">{inv.partyName}</p>
                          {inv.partyGst && (
                            <span className="text-[11px] font-mono text-slate-400 block">GST: {inv.partyGst}</span>
                          )}
                        </td>
                        <td className="p-4 text-right font-mono text-slate-600">
                          ₹{taxableAmt.toFixed(2)}
                        </td>
                        <td className="p-4 text-right font-mono text-indigo-700">
                          ₹{taxAmt.toFixed(2)}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-slate-900">
                          ₹{totalAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-right font-mono font-semibold text-rose-600">
                          ₹{balAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                            inv.paymentStatus === "PAID"
                              ? "bg-emerald-100 text-emerald-800"
                              : inv.paymentStatus === "PARTIAL"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}>
                            {inv.paymentStatus}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openPrintModal(inv.id)}
                              title="Print / View Invoice"
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                              <Printer size={16} />
                            </button>
                            {balAmt > 0 && (
                              <button
                                onClick={() => {
                                  setSelectedInvoice(inv);
                                  setPayAmount(balAmt);
                                  setPaymentModalOpen(true);
                                }}
                                title="Collect Payment"
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              >
                                <DollarSign size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteInvoice(inv.id)}
                              title="Delete Invoice"
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
        </>
        )}
      </div>

      {/* CREATE GST INVOICE MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Generate New GST Tax Invoice</h2>
                <p className="text-xs text-slate-500">Add client info, HSN line items, GST rate and auto-compute taxes</p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleCreateInvoice} className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
              
              {/* Row 1: Location, Invoice Type, Date */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Business Site / Location</label>
                  <select
                    value={selectedLocationId}
                    onChange={e => setSelectedLocationId(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Type</label>
                  <select
                    value={invoiceType}
                    onChange={e => setInvoiceType(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="TAX_INVOICE">Tax Invoice (Standard GST)</option>
                    <option value="BILL_OF_SUPPLY">Bill of Supply (Exempt/Composite)</option>
                    <option value="PROFORMA">Proforma Invoice</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date (Optional)</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Row 2: Customer / Party Details */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">Customer / Buyer Details</span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-indigo-700">
                    <input
                      type="checkbox"
                      checked={isInterState}
                      onChange={e => setIsInterState(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    Inter-State Supply (Apply IGST instead of CGST+SGST)
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Party Name *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={partyName}
                        onChange={e => handlePartySelect(e.target.value)}
                        placeholder="Search or enter customer..."
                        list="parties-list"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                      <datalist id="parties-list">
                        {parties.map(p => (
                          <option key={p.id} value={p.name}>{p.name} ({p.partyType})</option>
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Customer GSTIN</label>
                    <input
                      type="text"
                      value={partyGst}
                      onChange={e => setPartyGst(e.target.value.toUpperCase())}
                      placeholder="e.g. 24ABCDE1234F1Z5"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Place of Supply</label>
                    <input
                      type="text"
                      value={placeOfSupply}
                      onChange={e => setPlaceOfSupply(e.target.value)}
                      placeholder="e.g. Gujarat (24)"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={partyPhone}
                      onChange={e => setPartyPhone(e.target.value)}
                      placeholder="+91..."
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Billing Address</label>
                    <input
                      type="text"
                      value={partyAddress}
                      onChange={e => setPartyAddress(e.target.value)}
                      placeholder="Street, City, State, PIN"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Dynamic Line Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">Invoice Items (Goods / Services)</span>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs transition-colors"
                  >
                    <Plus size={14} /> Add Row
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 text-xs font-semibold border-b border-slate-200">
                        <th className="p-2.5 w-60">Item / Description</th>
                        <th className="p-2.5 w-24 text-center">HSN/SAC</th>
                        <th className="p-2.5 w-20 text-right">Qty</th>
                        <th className="p-2.5 w-20 text-center">Unit</th>
                        <th className="p-2.5 w-24 text-right">Rate (₹)</th>
                        <th className="p-2.5 w-24 text-center">GST %</th>
                        <th className="p-2.5 w-28 text-right">Total (₹)</th>
                        <th className="p-2.5 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lineItems.map((line, idx) => {
                        const calculated = computedLines[idx];
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2">
                              <input
                                type="text"
                                value={line.description}
                                onChange={e => updateLineItem(idx, "description", e.target.value)}
                                placeholder="Item description"
                                list={`items-list-${idx}`}
                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                                required
                              />
                              <datalist id={`items-list-${idx}`}>
                                {items.map(item => (
                                  <option key={item.id} value={item.name}>{item.name} - ₹{item.salePrice}</option>
                                ))}
                              </datalist>
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={line.hsnCode}
                                onChange={e => updateLineItem(idx, "hsnCode", e.target.value)}
                                placeholder="HSN"
                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-center font-mono"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="any"
                                min="0.001"
                                value={line.quantity}
                                onChange={e => updateLineItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-right font-medium"
                                required
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={line.unit}
                                onChange={e => updateLineItem(idx, "unit", e.target.value)}
                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-center"
                              >
                                <option value="Nos">Nos</option>
                                <option value="Kg">Kg</option>
                                <option value="Mtr">Mtr</option>
                                <option value="Sq.Ft">Sq.Ft</option>
                                <option value="Ton">Ton</option>
                                <option value="Bags">Bags</option>
                                <option value="Hours">Hours</option>
                                <option value="Trips">Trips</option>
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={line.rate}
                                onChange={e => updateLineItem(idx, "rate", parseFloat(e.target.value) || 0)}
                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-right font-mono"
                                required
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={line.taxRate}
                                onChange={e => updateLineItem(idx, "taxRate", parseFloat(e.target.value) || 0)}
                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-center font-semibold"
                              >
                                <option value="0">0% (Nil)</option>
                                <option value="5">5%</option>
                                <option value="12">12%</option>
                                <option value="18">18% (Std)</option>
                                <option value="28">28%</option>
                              </select>
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-slate-800">
                              ₹{calculated ? calculated.total.toFixed(2) : "0.00"}
                            </td>
                            <td className="p-2 text-center">
                              {lineItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeLineItem(idx)}
                                  className="p-1 text-slate-400 hover:text-rose-500 rounded"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Row 4: Totals Breakdown & Initial Payment */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="sm:col-span-7 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Notes / Terms</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Payment terms, bank account notes, etc."
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-emerald-700 mb-1">Amount Received Now (₹)</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max={formGrandTotal}
                        value={initialPaidAmount}
                        onChange={e => setInitialPaidAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-emerald-700"
                      />
                    </div>
                    {initialPaidAmount > 0 && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                        <select
                          value={paymentMode}
                          onChange={e => setPaymentMode(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                        >
                          <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                          <option value="UPI">UPI / QR</option>
                          <option value="CASH">Cash</option>
                          <option value="CHEQUE">Cheque</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-5 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Amount:</span>
                    <span className="font-mono font-semibold">₹{formTaxableAmount.toFixed(2)}</span>
                  </div>
                  {!isInterState ? (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>Central GST (CGST):</span>
                        <span className="font-mono font-semibold">₹{formCgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>State GST (SGST):</span>
                        <span className="font-mono font-semibold">₹{formSgst.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-slate-600">
                      <span>Integrated GST (IGST):</span>
                      <span className="font-mono font-semibold">₹{formIgst.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Total Tax:</span>
                    <span className="font-mono font-semibold text-indigo-700">₹{formTotalTax.toFixed(2)}</span>
                  </div>
                  {formRoundOff !== 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>Round Off:</span>
                      <span className="font-mono">₹{formRoundOff.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-300 pt-2 flex justify-between font-bold text-sm text-slate-900">
                    <span>Invoice Grand Total:</span>
                    <span className="font-mono text-base text-indigo-700">₹{formGrandTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Paid Now:</span>
                    <span className="font-mono font-bold">₹{initialPaidAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-rose-700 font-bold border-t border-slate-200 pt-1">
                    <span>Balance Outstanding:</span>
                    <span className="font-mono">₹{Math.max(0, formGrandTotal - initialPaidAmount).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  Save & Generate Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {paymentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Record Client Payment</h3>
                <p className="text-xs text-slate-500 mt-0.5">Invoice: {selectedInvoice.invoiceNumber}</p>
              </div>
              <button onClick={() => setPaymentModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-5 space-y-4 text-xs sm:text-sm">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <span className="text-slate-500">Balance Pending:</span>
                <span className="font-mono font-bold text-rose-600 text-sm">
                  ₹{parseFloat(selectedInvoice.balanceAmount || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount Received (₹) *</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  max={parseFloat(selectedInvoice.balanceAmount || "0")}
                  value={payAmount}
                  onChange={e => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={payMode}
                    onChange={e => setPayMode(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="UPI">UPI / QR</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / UTR #</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  placeholder="Bank UTR or Cheque no."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="Optional remark"
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20"
                >
                  Confirm Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT VIEW MODAL */}
      {printInvoice && (
        <InvoicePrintView
          invoice={printInvoice}
          onClose={() => setPrintInvoice(null)}
        />
      )}
    </div>
  );
}
