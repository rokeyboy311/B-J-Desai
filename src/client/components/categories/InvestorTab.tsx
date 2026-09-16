import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Users, Plus, Trash2, Banknote, Search, Calendar, FileText, ArrowDownLeft, ArrowUpRight } from "lucide-react";

interface InvestmentParty {
  id: number;
  locationId: number;
  partyName: string;
  totalInvestment: number;
  totalPayment: number;
  totalUpad: number;
  totalContribution: number;
  balance: number;
  createdAt: string;
}

interface InvestmentTransaction {
  id: number;
  partyId: number;
  type: "UPAD" | "CONTRIBUTION";
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
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  
  const [newPartyName, setNewPartyName] = useState("");
  const [txData, setTxData] = useState({
    partyId: "",
    type: "CONTRIBUTION" as "CONTRIBUTION" | "UPAD",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Bank Transfer",
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
      setTransactions((txsRes || []).filter((tx: any) => tx.type === "UPAD" || tx.type === "CONTRIBUTION"));
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

  const handleCreateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txData.partyId || !txData.amount) return;
    try {
      await apiFetch("/investments/transactions", {
        method: "POST",
        body: JSON.stringify({
          locationId,
          partyId: parseInt(txData.partyId),
          type: txData.type,
          amount: parseFloat(txData.amount),
          date: txData.date,
          paymentMethod: txData.paymentMethod,
          referenceNumber: txData.referenceNumber,
          description: txData.description
        })
      });
      setTxData({
        partyId: "",
        type: "CONTRIBUTION",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        referenceNumber: "",
        description: "",
      });
      setIsTxModalOpen(false);
      loadData();
    } catch (err) {
      alert("Failed to record transaction.");
    }
  };

  const handleDeleteParty = async (id: number) => {
    if (!confirm("Delete this investor? This removes all associated data.")) return;
    try {
      await apiFetch(`/investments/parties/${id}?locationId=${locationId}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      alert("Failed to delete investor.");
    }
  };

  const handleDeleteTx = async (id: number) => {
    if (!confirm("Delete this transaction?")) return;
    try {
      await apiFetch(`/investments/transactions/${id}?locationId=${locationId}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      alert("Failed to delete transaction.");
    }
  };

  const filteredParties = useMemo(() => {
    if (!searchTerm) return parties;
    const lower = searchTerm.toLowerCase();
    return parties.filter(p => p.partyName.toLowerCase().includes(lower));
  }, [parties, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            Investors
          </h2>
          <p className="text-xs text-slate-500 mt-1">Manage investors, contributions, and withdrawals.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsPartyModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-100 transition-colors">
            <Plus className="w-4 h-4" /> New Investor
          </button>
          <button onClick={() => { setTxData({...txData, type: "CONTRIBUTION"}); setIsTxModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-emerald-700 transition-colors">
            <ArrowUpRight className="w-4 h-4" /> Add Contribution
          </button>
          <button onClick={() => { setTxData({...txData, type: "UPAD"}); setIsTxModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-rose-700 transition-colors">
            <ArrowDownLeft className="w-4 h-4" /> Add Withdrawal
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Investors List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Investors Overview</h3>
            <div className="relative w-48">
              <Search className="w-3 h-3 absolute left-2.5 top-2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="p-4 flex-1 overflow-auto max-h-[500px]">
            {loading ? <div className="text-center p-4 text-slate-500">Loading...</div> : (
              <div className="space-y-3">
                {filteredParties.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white hover:border-indigo-200 shadow-sm transition-all">
                    <div className="flex-1">
                      <div className="font-bold text-slate-900 text-sm mb-2">{p.partyName}</div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-emerald-50 p-2 rounded-md">
                          <div className="text-[10px] text-emerald-600 font-semibold">Contributions</div>
                          <div className="text-xs font-bold text-emerald-700">₹{Number(p.totalContribution || 0).toLocaleString()}</div>
                        </div>
                        <div className="bg-rose-50 p-2 rounded-md">
                          <div className="text-[10px] text-rose-600 font-semibold">Withdrawals</div>
                          <div className="text-xs font-bold text-rose-700">₹{Number(p.totalUpad || 0).toLocaleString()}</div>
                        </div>
                        <div className="bg-indigo-50 p-2 rounded-md">
                          <div className="text-[10px] text-indigo-600 font-semibold">Balance</div>
                          <div className="text-xs font-bold text-indigo-700">₹{Number(p.balance || 0).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                    <div className="pl-4 border-l border-slate-100 ml-4 flex items-center">
                      <button onClick={() => handleDeleteParty(p.id)} className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredParties.length === 0 && <div className="text-center text-slate-500 text-sm p-4">No investors found.</div>}
              </div>
            )}
          </div>
        </div>

        {/* Transactions Records */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-900">Investor Transactions</h3>
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
                    <td className={`p-3 text-right font-bold ${tx.type === 'CONTRIBUTION' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.type === 'CONTRIBUTION' ? '+' : '-'}₹{Number(tx.amount).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${tx.type === 'CONTRIBUTION' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {tx.type === 'CONTRIBUTION' ? 'CONTRIBUTION' : 'WITHDRAWAL'}
                          </span>
                          {tx.paymentMethod && <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 rounded">{tx.paymentMethod}</span>}
                        </div>
                        {tx.description && <span className="text-slate-500 truncate max-w-[120px]">{tx.description}</span>}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => handleDeleteTx(tx.id)} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-500">No transactions recorded.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal isOpen={isPartyModalOpen} onClose={() => setIsPartyModalOpen(false)} title="Create New Investor">
        <form onSubmit={handleCreateParty} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Investor Name</label>
            <input type="text" required value={newPartyName} onChange={e => setNewPartyName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Rahul Patel" />
          </div>
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg">Create Investor</button>
        </form>
      </Modal>

      <Modal isOpen={isTxModalOpen} onClose={() => setIsTxModalOpen(false)} title={txData.type === 'CONTRIBUTION' ? 'Add Contribution' : 'Add Withdrawal (Upad)'}>
        <form onSubmit={handleCreateTx} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Investor</label>
            <select required value={txData.partyId} onChange={e => setTxData({...txData, partyId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">-- Select --</option>
              {parties.map(p => <option key={p.id} value={p.id}>{p.partyName}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
              <input type="number" required min="1" step="0.01" value={txData.amount} onChange={e => setTxData({...txData, amount: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
              <input type="date" required value={txData.date} onChange={e => setTxData({...txData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
              <select value={txData.paymentMethod} onChange={e => setTxData({...txData, paymentMethod: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="UPI">UPI</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reference No (Optional)</label>
              <input type="text" value={txData.referenceNumber} onChange={e => setTxData({...txData, referenceNumber: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
            <textarea value={txData.description} onChange={e => setTxData({...txData, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" rows={2} />
          </div>
          <button type="submit" className={`w-full text-white font-bold py-2.5 rounded-lg ${txData.type === 'CONTRIBUTION' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
            Save {txData.type === 'CONTRIBUTION' ? 'Contribution' : 'Withdrawal'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
