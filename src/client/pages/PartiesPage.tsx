import React, { useState, useEffect } from "react";
import { 
  Users, Plus, Search, Phone, Mail, MapPin, 
  FileSpreadsheet, Edit, Trash2, ArrowUpRight, ArrowDownLeft,
  X, Printer, CheckCircle2, AlertCircle, Building
} from "lucide-react";
import { apiFetch } from "../lib/api";

export default function PartiesPage() {
  const [parties, setParties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals
  const [partyModalOpen, setPartyModalOpen] = useState(false);
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<any | null>(null);
  const [selectedLedgerData, setSelectedLedgerData] = useState<any | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Party Form State
  const [formData, setFormData] = useState({
    name: "",
    partyType: "CUSTOMER",
    phone: "",
    email: "",
    pan: "",
    gst: "",
    state: "Gujarat",
    stateCode: "24",
    address: "",
    openingBalance: 0,
    openingBalanceType: "TO_RECEIVE",
    notes: ""
  });

  const fetchParties = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/master/parties");
      setParties(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to load parties");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParties();
  }, []);

  const openCreateModal = () => {
    setEditingParty(null);
    setFormData({
      name: "",
      partyType: "CUSTOMER",
      phone: "",
      email: "",
      pan: "",
      gst: "",
      state: "Gujarat",
      stateCode: "24",
      address: "",
      openingBalance: 0,
      openingBalanceType: "TO_RECEIVE",
      notes: ""
    });
    setPartyModalOpen(true);
  };

  const openEditModal = (party: any) => {
    setEditingParty(party);
    setFormData({
      name: party.name,
      partyType: party.partyType,
      phone: party.phone || "",
      email: party.email || "",
      pan: party.pan || "",
      gst: party.gst || "",
      state: party.state || "Gujarat",
      stateCode: party.stateCode || "24",
      address: party.address || "",
      openingBalance: parseFloat(party.openingBalance || "0"),
      openingBalanceType: party.openingBalanceType || "TO_RECEIVE",
      notes: party.notes || ""
    });
    setPartyModalOpen(true);
  };

  const handleSaveParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setActionError("Please enter party name");
      return;
    }

    try {
      const url = editingParty ? `/master/parties/${editingParty.id}` : "/master/parties";
      const method = editingParty ? "PUT" : "POST";

      await apiFetch(url, {
        method,
        body: JSON.stringify(formData)
      });

      setPartyModalOpen(false);
      setActionSuccess(editingParty ? "Party profile updated" : "Party added successfully");
      setTimeout(() => setActionSuccess(null), 4000);
      fetchParties();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to save party");
      setTimeout(() => setActionError(null), 5000);
    }
  };

  const openLedgerModal = async (party: any) => {
    setLedgerLoading(true);
    setLedgerModalOpen(true);
    try {
      const data = await apiFetch(`/master/parties/${party.id}/ledger`);
      setSelectedLedgerData(data);
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to load party statement");
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleDeleteParty = async (id: number) => {
    try {
      await apiFetch(`/master/parties/${id}`, { method: "DELETE" });
      setActionSuccess("Party record archived");
      setTimeout(() => setActionSuccess(null), 4000);
      fetchParties();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to delete party");
      setTimeout(() => setActionError(null), 5000);
    }
  };

  // KPIs
  const customerCount = parties.filter(p => p.partyType === "CUSTOMER").length;
  const supplierCount = parties.filter(p => p.partyType === "SUPPLIER").length;
  const totalReceivables = parties
    .filter(p => p.currentBalanceType === "TO_RECEIVE")
    .reduce((acc, p) => acc + parseFloat(p.currentBalance || "0"), 0);
  const totalPayables = parties
    .filter(p => p.currentBalanceType === "TO_PAY")
    .reduce((acc, p) => acc + parseFloat(p.currentBalance || "0"), 0);

  // Filtered
  const filteredParties = parties.filter(party => {
    const matchesSearch = 
      party.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (party.phone && party.phone.includes(searchQuery)) ||
      (party.gst && party.gst.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = typeFilter === "ALL" || party.partyType === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="text-indigo-600" size={26} /> Parties & Statements of Account
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage customers, suppliers, GST compliance, and real-time ledger statements
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-all shadow-md shadow-indigo-600/20 active:scale-95"
          >
            <Plus size={18} /> Add New Party
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
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Customers</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{customerCount}</p>
            <span className="text-xs text-slate-500 mt-1 block">Clients & Buyers</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Suppliers</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{supplierCount}</p>
            <span className="text-xs text-slate-500 mt-1 block">Vendors & Contractors</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-600">Total Receivables</span>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              ₹{totalReceivables.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-xs text-slate-500 mt-1 block">To Collect from Debtors</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs uppercase font-bold tracking-wider text-rose-600">Total Payables</span>
            <p className="text-2xl font-bold text-rose-600 mt-1">
              ₹{totalPayables.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-xs text-slate-500 mt-1 block">To Pay to Creditors</span>
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
              placeholder="Search party name, phone, GSTIN..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {["ALL", "CUSTOMER", "SUPPLIER"].map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  typeFilter === t
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Parties List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              Loading parties...
            </div>
          ) : filteredParties.length === 0 ? (
            <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              <Users size={36} className="mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-slate-700">No Parties Found</p>
              <p className="text-xs text-slate-400 mt-1">Click "Add New Party" to create your customer/supplier directory.</p>
            </div>
          ) : (
            filteredParties.map(party => {
              const curBal = parseFloat(party.currentBalance || "0");
              const isToReceive = party.currentBalanceType === "TO_RECEIVE";

              return (
                <div key={party.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          party.partyType === "CUSTOMER" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                        }`}>
                          {party.partyType}
                        </span>
                        <h3 className="font-bold text-slate-900 text-base mt-1.5">{party.name}</h3>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 block font-medium">Outstanding</span>
                        <p className={`font-mono font-bold text-sm ${
                          curBal === 0
                            ? "text-slate-500"
                            : isToReceive
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}>
                          ₹{curBal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          {curBal > 0 && (
                            <span className="text-[10px] block uppercase font-sans font-semibold">
                              {isToReceive ? "(To Receive)" : "(To Pay)"}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-slate-600">
                      {party.phone && (
                        <p className="flex items-center gap-1.5">
                          <Phone size={13} className="text-slate-400" /> {party.phone}
                        </p>
                      )}
                      {party.gst && (
                        <p className="font-mono text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700">GST:</span> {party.gst}
                        </p>
                      )}
                      {party.address && (
                        <p className="flex items-center gap-1.5 text-slate-500 truncate">
                          <MapPin size={13} className="text-slate-400 shrink-0" /> {party.address}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => openLedgerModal(party)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <FileSpreadsheet size={14} /> Statement of Account
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(party)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteParty(party.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CREATE / EDIT PARTY MODAL */}
      {partyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">
                  {editingParty ? "Edit Party Profile" : "Add New Business Party"}
                </h3>
                <p className="text-xs text-slate-500">Customer or Supplier master profile with GST information</p>
              </div>
              <button onClick={() => setPartyModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveParty} className="p-5 space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Party Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Company or Individual name"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Party Type</label>
                  <select
                    value={formData.partyType}
                    onChange={e => setFormData({ ...formData, partyType: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="CUSTOMER">Customer (Receivables)</option>
                    <option value="SUPPLIER">Supplier (Payables)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN Number</label>
                  <input
                    type="text"
                    value={formData.gst}
                    onChange={e => setFormData({ ...formData, gst: e.target.value.toUpperCase() })}
                    placeholder="24ABCDE1234F1Z5"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">PAN Number</label>
                  <input
                    type="text"
                    value={formData.pan}
                    onChange={e => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    placeholder="ABCDE1234F"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="info@party.com"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                    placeholder="Gujarat"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">State Code (GST)</label>
                  <input
                    type="text"
                    value={formData.stateCode}
                    onChange={e => setFormData({ ...formData, stateCode: e.target.value })}
                    placeholder="24"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <textarea
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  placeholder="Street, City, PIN..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.openingBalance}
                    onChange={e => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Balance Type</label>
                  <select
                    value={formData.openingBalanceType}
                    onChange={e => setFormData({ ...formData, openingBalanceType: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="TO_RECEIVE">To Receive (Debit)</option>
                    <option value="TO_PAY">To Pay (Credit)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPartyModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md shadow-indigo-600/20"
                >
                  {editingParty ? "Update Party" : "Save Party"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PARTY LEDGER / STATEMENT OF ACCOUNT MODAL */}
      {ledgerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Statement of Account (Party Ledger)
                </h2>
                {selectedLedgerData && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedLedgerData.party.name} ({selectedLedgerData.party.partyType})
                    {selectedLedgerData.party.gst && ` | GSTIN: ${selectedLedgerData.party.gst}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  <Printer size={14} /> Print
                </button>
                <button
                  onClick={() => setLedgerModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs sm:text-sm">
              {ledgerLoading ? (
                <div className="p-12 text-center text-slate-400">Loading ledger entries...</div>
              ) : !selectedLedgerData ? (
                <div className="p-12 text-center text-slate-400">No ledger data available</div>
              ) : (
                <>
                  {/* Ledger Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-400 uppercase font-semibold">Opening Balance</span>
                      <p className="font-mono font-bold text-slate-800 text-sm mt-0.5">
                        ₹{parseFloat(selectedLedgerData.summary.openingBalance || "0").toFixed(2)}
                      </p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Debits (+)</span>
                      <p className="font-mono font-bold text-indigo-700 text-sm mt-0.5">
                        ₹{selectedLedgerData.summary.totalDebits.toFixed(2)}
                      </p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Credits (-)</span>
                      <p className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
                        ₹{selectedLedgerData.summary.totalCredits.toFixed(2)}
                      </p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-400 uppercase font-semibold">Closing Outstanding</span>
                      <p className={`font-mono font-bold text-sm mt-0.5 ${
                        selectedLedgerData.summary.closingBalanceType === "TO_RECEIVE" ? "text-emerald-700" : "text-rose-600"
                      }`}>
                        ₹{selectedLedgerData.summary.closingBalance.toFixed(2)}
                        <span className="text-[10px] block font-sans">
                          {selectedLedgerData.summary.closingBalanceType === "TO_RECEIVE" ? "To Receive" : "To Pay"}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Ledger Transactions Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 text-xs font-semibold border-b border-slate-200">
                          <th className="p-3">Date</th>
                          <th className="p-3">Doc / Type</th>
                          <th className="p-3">Reference / Details</th>
                          <th className="p-3 text-right">Debit (₹)</th>
                          <th className="p-3 text-right">Credit (₹)</th>
                          <th className="p-3 text-right">Running Bal (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {selectedLedgerData.ledger.map((entry: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="p-3 font-medium text-slate-700 whitespace-nowrap">{entry.date}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold uppercase tracking-wider text-slate-800">
                                {entry.type}
                              </span>
                            </td>
                            <td className="p-3">
                              <p className="font-medium text-slate-900">{entry.description}</p>
                              {entry.referenceNumber && (
                                <span className="text-[11px] font-mono text-slate-400">Ref: {entry.referenceNumber}</span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono text-indigo-700 font-medium">
                              {entry.debit > 0 ? entry.debit.toFixed(2) : "-"}
                            </td>
                            <td className="p-3 text-right font-mono text-emerald-700 font-medium">
                              {entry.credit > 0 ? entry.credit.toFixed(2) : "-"}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900">
                              {entry.balance.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
