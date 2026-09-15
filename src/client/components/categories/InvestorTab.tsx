import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Users, Plus, Trash2, Banknote, Search, Calendar, FileText, ArrowDownLeft } from "lucide-react";

interface InvestmentParty {
  id: number;
  locationId: number;
  partyName: string;
  totalInvestment: number;
  totalPayment: number;
  totalUpad: number;
  balance: number;
  createdAt: string;
}

interface InvestmentTransaction {
  id: number;
  partyId: number;
  type: "UPAD";
  amount: string;
  date: string;
  description: string | null;
  paymentMethod: string | null;
  referenceNumber: string | null;
  createdAt: string;
  partyName: string;
}

export default function InvestorTab({ locationId }: { locationId: number }) {
  const [parties, setParties] = useState<InvestmentParty[]>([]);
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [isUpadModalOpen, setIsUpadModalOpen] = useState(false);
  
  const [newPartyName, setNewPartyName] = useState("");
  const [upadData, setUpadData] = useState({
    partyId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Cash",
    referenceNumber: "",
    description: "",
  });

  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, [locationId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [partiesRes, txsRes] = await Promise.all([
        apiFetch(`/investments/parties?locationId=${locationId}`),
        apiFetch(`/investments/transactions?locationId=${locationId}`)
      ]);
      setParties(partiesRes || []);
      // Only keep UPAD transactions for this tab
      setTransactions((txsRes || []).filter((tx: any) => tx.type === "UPAD"));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/investments/parties", {
        method: "POST",
        body: JSON.stringify({ locationId, partyName: newPartyName })
      });
      setNewPartyName("");
      setIsPartyModalOpen(false);
      loadData();
    } catch (err) {
      alert("Failed to create investor.");
    }
  };

  const handleCreateUpad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upadData.partyId || !upadData.amount) return;
    try {
      await apiFetch("/investments/transactions", {
        method: "POST",
        body: JSON.stringify({
          locationId,
          partyId: parseInt(upadData.partyId),
          type: "UPAD",
          amount: parseFloat(upadData.amount),
          date: upadData.date,
          paymentMethod: upadData.paymentMethod,
          referenceNumber: upadData.referenceNumber,
          description: upadData.description
        })
      });
      setUpadData({
        partyId: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Cash",
        referenceNumber: "",
        description: "",
      });
      setIsUpadModalOpen(false);
      loadData();
    } catch (err) {
      alert("Failed to record Upad.");
    }
  };

  const handleDeleteParty = async (id: number) => {
    if (!confirm("Delete this investor? This removes all associated data.")) return;
    try {
      await apiFetch(`/investments/parties/${id}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      alert("Failed to delete.");
    }
  };

  const handleDeleteTx = async (id: number) => {
    if (!confirm("Delete this Upad record?")) return;
    try {
      await apiFetch(`/investments/transactions/${id}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      alert("Failed to delete.");
    }
  };

  const filteredParties = useMemo(() => {
    return parties.filter(p => p.partyName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [parties, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-emerald-500/10 border border-emerald-200/80 p-5 rounded-2xl flex justify-between items-center">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Investor Category</h2>
            <p className="text-xs text-slate-600">Create investors and manage their Upad (withdrawals).</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsPartyModalOpen(true)} className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold shadow-md hover:bg-slate-800 transition-colors">
            <Plus className="w-4 h-4" /> Add Investor
          </button>
          <button onClick={() => setIsUpadModalOpen(true)} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-emerald-700 transition-colors">
            <ArrowDownLeft className="w-4 h-4" /> Give Upad
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Investors List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Investors List</h3>
            <div className="relative w-48">
              <Search className="w-3 h-3 absolute left-2.5 top-2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="p-4 flex-1 overflow-auto max-h-[500px]">
            {loading ? <div className="text-center p-4 text-slate-500">Loading...</div> : (
              <div className="space-y-3">
                {filteredParties.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-emerald-50 transition-colors">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{p.partyName}</div>
                      <div className="text-xs font-semibold text-rose-600 mt-1">Total Upad: ₹{Number(p.totalUpad || 0).toLocaleString()}</div>
                    </div>
                    <button onClick={() => handleDeleteParty(p.id)} className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {filteredParties.length === 0 && <div className="text-center text-slate-500 text-sm p-4">No investors found.</div>}
              </div>
            )}
          </div>
        </div>

        {/* Upad Records */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-900">Upad Records</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Investor</th>
                  <th className="p-3 text-right">Amount (₹)</th>
                  <th className="p-3">Details</th>
                  <th className="p-3 text-center">Act</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-600">{tx.date}</td>
                    <td className="p-3 font-bold text-slate-900">{tx.partyName}</td>
                    <td className="p-3 text-right font-bold text-rose-600">₹{Number(tx.amount).toLocaleString()}</td>
                    <td className="p-3">
                      <div className="flex flex-col gap-0.5">
                        {tx.paymentMethod && <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 rounded w-max">{tx.paymentMethod}</span>}
                        {tx.description && <span className="text-slate-500 truncate max-w-[120px]">{tx.description}</span>}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => handleDeleteTx(tx.id)} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-500">No Upad records.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal isOpen={isPartyModalOpen} onClose={() => setIsPartyModalOpen(false)} title="Create New Investor">
        <form onSubmit={handleCreateParty} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Investor Name</label>
            <input type="text" required value={newPartyName} onChange={e => setNewPartyName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" placeholder="e.g. Rahul Patel" />
          </div>
          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg">Create Investor</button>
        </form>
      </Modal>

      <Modal isOpen={isUpadModalOpen} onClose={() => setIsUpadModalOpen(false)} title="Give Upad (Withdrawal)">
        <form onSubmit={handleCreateUpad} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Investor</label>
            <select required value={upadData.partyId} onChange={e => setUpadData({...upadData, partyId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">-- Select --</option>
              {parties.map(p => <option key={p.id} value={p.id}>{p.partyName}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
              <input type="number" required value={upadData.amount} onChange={e => setUpadData({...upadData, amount: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
              <input type="date" required value={upadData.date} onChange={e => setUpadData({...upadData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
              <select value={upadData.paymentMethod} onChange={e => setUpadData({...upadData, paymentMethod: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="UPI">UPI</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reference No (Optional)</label>
              <input type="text" value={upadData.referenceNumber} onChange={e => setUpadData({...upadData, referenceNumber: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
            <textarea value={upadData.description} onChange={e => setUpadData({...upadData, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" rows={2} />
          </div>
          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg">Save Upad</button>
        </form>
      </Modal>
    </div>
  );
}
