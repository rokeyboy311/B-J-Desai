import React, { useState, useEffect } from "react";
import { apiFetch } from "../../lib/api";
import { Wallet, Users, History, FileText, ArrowRight, Plus } from "lucide-react";
import { Modal } from "../ui/Modal";
import { ManageLabourModal } from "../ui/ManageLabourModal";
import { useLiveSync, triggerSync } from "../../hooks/useLiveSync";

export default function LabourRecordsTab({ locationId }: { locationId: number }) {
  const [loading, setLoading] = useState(true);
  const [labourList, setLabourList] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  
  const [selectedLabour, setSelectedLabour] = useState<any | null>(null);
  const [isManageLabourOpen, setIsManageLabourOpen] = useState(false);


  const loadData = async (isBackground = false) => {
    if (!isBackground && labourList.length === 0) setLoading(true);
    try {
      const [labourRes, recordsRes, teamsRes] = await Promise.all([
        apiFetch(`/master/labour?locationId=${locationId}`).catch(() => []),
        apiFetch(`/labour?locationId=${locationId}`).catch(() => []),
        apiFetch(`/master/teams?locationId=${locationId}`).catch(() => [])
      ]);
      
      setTeams(teamsRes || []);
      setRecords(recordsRes || []);
      
      // Calculate derived stats for each labour based on records
      const enrichedLabour = (labourRes || []).map((l: any) => {
        const myRecords = (recordsRes || []).filter((r: any) => r.labourName === l.name);
        
        let totalFullDays = 0;
        let totalHalfDays = 0;
        let totalWorkQty = 0;
        let totalGross = 0;
        let totalUpad = 0;
        let totalPayment = 0;
        
        myRecords.forEach((r: any) => {
          if (r.attendanceType === 'Full Day') totalFullDays += 1;
          if (r.attendanceType === 'Half Day') totalHalfDays += 1;
          if (r.attendanceType && r.attendanceType.includes('Work')) totalWorkQty += (parseFloat(r.notes) || r.days || 0);
          
          totalGross += parseFloat(r.grossSalary || 0);
          totalUpad += parseFloat(r.upad || 0);
          totalPayment += parseFloat(r.paymentAmount || 0);
        });
        
        return {
          ...l,
          totalFullDays,
          totalHalfDays,
          totalWorkQty,
          totalGross,
          totalUpad,
          totalPayment,
          balance: totalGross - totalUpad - totalPayment,
          history: myRecords
        };
      });
      
      setLabourList(enrichedLabour);
      
      if (selectedLabour) {
        const found = enrichedLabour.find((l: any) => l.id === selectedLabour.id);
        if (found) setSelectedLabour(found);
      }
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
  
  const [paymentForm, setPaymentForm] = useState({
    date: new Date().toISOString().split("T")[0],
    amount: "",
    description: "",
    isUpad: false
  });
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLabour || !paymentForm.amount) return;
    
    try {
      const amt = parseFloat(paymentForm.amount);
      const isUpad = paymentForm.isUpad;
      
      await apiFetch("/labour", {
        method: "POST",
        body: JSON.stringify({
          locationId,
          date: paymentForm.date,
          labourName: selectedLabour.name,
          labourTeam: selectedLabour.teamName || 'Independent',
          attendanceType: isUpad ? "UPAD" : "PAYMENT",
          days: 0,
          dailyRate: 0,
          grossSalary: 0,
          upad: isUpad ? amt : 0,
          paymentAmount: !isUpad ? amt : 0,
          balance: -amt, // Negative balance impact
          description: paymentForm.description || (isUpad ? 'Upad / Advance' : 'Salary Payment')
        })
      });
      
      triggerSync("labour_records");
      setIsPaymentModalOpen(false);
      setPaymentForm({...paymentForm, amount: "", description: ""});
      loadData();
      setSelectedLabour(null); // Close detail view to refresh cleanly
    } catch (err) {
      alert("Failed to process payment");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-cyan-600/10 via-blue-600/5 to-cyan-600/10 border border-cyan-200/80 p-5 rounded-2xl flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-cyan-600 text-white rounded-xl shadow-md">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Labour Records</h2>
            <p className="text-xs text-slate-600">Track total attendance, earnings, upads, and balances.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsManageLabourOpen(true)}
          className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Manage Labour
        </button>
      </div>
      
      {!selectedLabour ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {labourList.map(labour => (
            <div key={labour.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedLabour(labour)}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-slate-900">{labour.name}</h3>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Users className="w-3 h-3" /> {labour.teamName || 'Independent'}</div>
                </div>
                <div className={`text-sm font-black ${labour.balance > 0 ? 'text-rose-600' : labour.balance < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                  ₹{Math.abs(labour.balance).toLocaleString()} {labour.balance > 0 ? 'Due' : labour.balance < 0 ? 'Advance' : ''}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100">
                 <div className="text-center">
                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Full Days</div>
                    <div className="text-sm font-semibold text-slate-700">{labour.totalFullDays}</div>
                 </div>
                 <div className="text-center border-l border-r border-slate-100">
                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Half Days</div>
                    <div className="text-sm font-semibold text-slate-700">{labour.totalHalfDays}</div>
                 </div>
                 <div className="text-center">
                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Work Qty</div>
                    <div className="text-sm font-semibold text-slate-700">{labour.totalWorkQty}</div>
                 </div>
              </div>
            </div>
          ))}
          {labourList.length === 0 && !loading && (
            <div className="col-span-full p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
              No labour records found. Make sure to add labour in Master Data and mark attendance.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <button onClick={() => setSelectedLabour(null)} className="text-sm font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1">
             &larr; Back to All Labour
          </button>
          
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div>
                 <h2 className="text-2xl font-black text-slate-900">{selectedLabour.name}</h2>
                 <p className="text-sm text-slate-600">{selectedLabour.teamName || 'Independent Worker'}</p>
               </div>
               <div className="flex gap-2">
                 <button onClick={() => { setPaymentForm({...paymentForm, isUpad: true}); setIsPaymentModalOpen(true); }} className="px-4 py-2 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg text-sm font-bold transition-colors">
                   Give Upad
                 </button>
                 <button onClick={() => { setPaymentForm({...paymentForm, isUpad: false}); setIsPaymentModalOpen(true); }} className="px-4 py-2 bg-cyan-600 text-white hover:bg-cyan-700 rounded-lg text-sm font-bold transition-colors shadow-sm">
                   Record Payment
                 </button>
               </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 border-b border-slate-100">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Earnings</div>
                <div className="text-lg font-black text-slate-900">₹{selectedLabour.totalGross.toLocaleString()}</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                <div className="text-[10px] uppercase font-bold text-amber-600 mb-1">Total Upad</div>
                <div className="text-lg font-black text-amber-700">₹{selectedLabour.totalUpad.toLocaleString()}</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                <div className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Total Paid</div>
                <div className="text-lg font-black text-emerald-700">₹{selectedLabour.totalPayment.toLocaleString()}</div>
              </div>
              <div className={`rounded-lg p-3 border ${selectedLabour.balance > 0 ? 'bg-rose-50 border-rose-100' : 'bg-blue-50 border-blue-100'}`}>
                <div className={`text-[10px] uppercase font-bold mb-1 ${selectedLabour.balance > 0 ? 'text-rose-600' : 'text-blue-600'}`}>Current Balance</div>
                <div className={`text-lg font-black ${selectedLabour.balance > 0 ? 'text-rose-700' : 'text-blue-700'}`}>
                  ₹{Math.abs(selectedLabour.balance).toLocaleString()} {selectedLabour.balance > 0 ? 'Due' : selectedLabour.balance < 0 ? 'Advance' : ''}
                </div>
              </div>
            </div>
            
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-bold text-slate-600">Date</th>
                    <th className="p-4 font-bold text-slate-600">Type</th>
                    <th className="p-4 font-bold text-slate-600">Details</th>
                    <th className="p-4 font-bold text-right text-slate-600">Earned (₹)</th>
                    <th className="p-4 font-bold text-right text-slate-600">Paid/Upad (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedLabour.history.map((record: any) => (
                    <tr key={record.id} className="hover:bg-slate-50/50">
                      <td className="p-4 text-slate-600">{record.date}</td>
                      <td className="p-4">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                          record.attendanceType === 'PAYMENT' ? 'bg-emerald-100 text-emerald-700' :
                          record.attendanceType === 'UPAD' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {record.attendanceType}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600">{record.description || '-'}</td>
                      <td className="p-4 text-right font-bold text-slate-900">{parseFloat(record.grossSalary) > 0 ? `₹${Number(record.grossSalary).toLocaleString()}` : '-'}</td>
                      <td className="p-4 text-right font-bold text-emerald-600">
                        {parseFloat(record.paymentAmount) > 0 ? `₹${Number(record.paymentAmount).toLocaleString()}` : 
                         parseFloat(record.upad) > 0 ? `₹${Number(record.upad).toLocaleString()} (Upad)` : '-'}
                      </td>
                    </tr>
                  ))}
                  {(!selectedLabour.history || selectedLabour.history.length === 0) && (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-500">No history available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title={paymentForm.isUpad ? `Issue Upad to ${selectedLabour?.name}` : `Record Payment for ${selectedLabour?.name}`}>
        <form onSubmit={handlePaymentSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
              <input type="date" required value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
              <input type="number" step="0.01" min="1" required value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" placeholder="0.00" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Description (Optional)</label>
            <input type="text" value={paymentForm.description} onChange={e => setPaymentForm({...paymentForm, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" placeholder={paymentForm.isUpad ? "e.g. Weekly advance" : "e.g. Salary settlement"} />
          </div>
          <button type="submit" className={`w-full text-white font-bold py-2.5 rounded-lg ${paymentForm.isUpad ? 'bg-amber-600 hover:bg-amber-700' : 'bg-cyan-600 hover:bg-cyan-700'}`}>
            {paymentForm.isUpad ? 'Save Upad' : 'Save Payment'}
          </button>
        </form>
      </Modal>

      {/* Quick Manage Labour Modal */}
      <ManageLabourModal
        isOpen={isManageLabourOpen}
        onClose={() => setIsManageLabourOpen(false)}
        locationId={locationId}
        onSelectLabour={() => {
          loadData(true);
        }}
      />
    </div>
  );
}
