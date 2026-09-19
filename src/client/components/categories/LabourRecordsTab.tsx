import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Wallet, Users, History, FileText, ArrowRight, Plus, Trash2, Search, ArrowDownLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { Modal } from "../ui/Modal";
import { ManageLabourModal } from "../ui/ManageLabourModal";
import { useLiveSync, triggerSync } from "../../hooks/useLiveSync";
import { useToast } from "../../contexts/ToastContext";

export default function LabourRecordsTab({ locationId }: { locationId: number }) {
  const { showToast, confirmAction } = useToast();
  const [loading, setLoading] = useState(true);
  const [labourList, setLabourList] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
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
      
      // Merge master labour with any historical labour names in recordsRes
      const masterLabours = labourRes || [];
      const seenNames = new Set(masterLabours.map((l: any) => l.name?.trim().toLowerCase()));
      const virtualLabours: any[] = [];
      (recordsRes || []).forEach((r: any) => {
        const name = (r.labourName || "").trim();
        if (name && name.toLowerCase() !== "unknown" && !seenNames.has(name.toLowerCase())) {
          seenNames.add(name.toLowerCase());
          virtualLabours.push({
            id: r.labourMasterId || `hist-${r.id}`,
            name: name,
            teamId: null,
            teamName: r.labourTeam || "General",
            dailyRate: r.dailyRate || "0",
            locationId
          });
        }
      });
      const allLabourSources = [...masterLabours, ...virtualLabours];

      // Calculate derived stats for each labour based on records matching both labourMasterId and name
      const enrichedLabour = allLabourSources.map((l: any) => {
        const myRecords = (recordsRes || []).filter((r: any) => {
          if (r.labourMasterId && l.id && Number(r.labourMasterId) === Number(l.id)) return true;
          if (r.labourName && l.name && r.labourName.trim().toLowerCase() === l.name.trim().toLowerCase()) return true;
          return false;
        });
        
        let totalFullDays = 0;
        let totalHalfDays = 0;
        let totalWorkQty = 0;
        let totalGross = 0;
        let totalUpad = 0;
        let totalPayment = 0;
        
        myRecords.forEach((r: any) => {
          if (r.attendanceType === 'Full Day') totalFullDays += (parseFloat(r.days) || 1);
          else if (r.attendanceType === 'Half Day') totalHalfDays += 1;
          else if (r.attendanceType && (r.attendanceType.includes('Work') || r.attendanceType.toUpperCase() === 'TC')) {
            totalWorkQty += (parseFloat(r.quantity) || parseFloat(r.workQuantity) || parseFloat(r.tcQuantity) || 0);
          }
          
          totalGross += parseFloat(r.grossSalary || 0);
          totalUpad += parseFloat(r.upad || 0);
          totalPayment += parseFloat(r.paymentAmount || 0);
        });
        
        const balance = Math.round((totalGross - totalUpad - totalPayment) * 100) / 100;
        
        return {
          ...l,
          totalFullDays,
          totalHalfDays,
          totalWorkQty,
          totalGross: Math.round(totalGross * 100) / 100,
          totalUpad: Math.round(totalUpad * 100) / 100,
          totalPayment: Math.round(totalPayment * 100) / 100,
          balance,
          history: myRecords.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
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
          labourMasterId: selectedLabour.id,
          labourName: selectedLabour.name,
          labourTeam: selectedLabour.teamName || 'Independent',
          attendanceType: isUpad ? "UPAD" : "PAYMENT",
          days: 0,
          dailyRate: 0,
          grossSalary: 0,
          upad: isUpad ? amt : 0,
          paymentAmount: !isUpad ? amt : 0,
          balance: -amt,
          description: paymentForm.description || (isUpad ? 'Upad / Advance' : 'Salary Settlement')
        })
      });
      
      triggerSync("labour_records");
      setIsPaymentModalOpen(false);
      setPaymentForm({ date: new Date().toISOString().split("T")[0], amount: "", description: "", isUpad: false });
      showToast("Payment recorded successfully", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to process payment", "error");
    }
  };

  const handleDeleteRecord = async (recordId: number) => {
    const confirmed = await confirmAction({
      title: "Delete Labour Entry",
      message: "Are you sure you want to delete this labour attendance / payment entry?",
      confirmLabel: "Delete",
      isDanger: true
    });
    if (!confirmed) return;
    try {
      await apiFetch(`/labour/${recordId}`, { method: "DELETE" });
      triggerSync("labour_records");
      showToast("Record deleted", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete record", "error");
    }
  };

  // Overall totals across all labours
  const overallStats = useMemo(() => {
    let gross = 0;
    let upad = 0;
    let paid = 0;
    let due = 0;
    let advance = 0;
    labourList.forEach(l => {
      gross += Number(l.totalGross || 0);
      upad += Number(l.totalUpad || 0);
      paid += Number(l.totalPayment || 0);
      if (l.balance > 0) due += l.balance;
      else if (l.balance < 0) advance += Math.abs(l.balance);
    });
    return {
      gross: Math.round(gross * 100) / 100,
      upad: Math.round(upad * 100) / 100,
      paid: Math.round(paid * 100) / 100,
      due: Math.round(due * 100) / 100,
      advance: Math.round(advance * 100) / 100,
      netPayable: Math.round((gross - upad - paid) * 100) / 100
    };
  }, [labourList]);

  const filteredLabourList = useMemo(() => {
    if (!searchTerm.trim()) return labourList;
    const term = searchTerm.toLowerCase();
    return labourList.filter(l => 
      (l.name || "").toLowerCase().includes(term) ||
      (l.teamName || "").toLowerCase().includes(term) ||
      (l.phone || "").toLowerCase().includes(term)
    );
  }, [labourList, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-cyan-600/10 via-blue-600/5 to-cyan-600/10 border border-cyan-200/80 p-5 rounded-2xl flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-cyan-600 text-white rounded-xl shadow-md">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Labour Records & Master Accounts</h2>
            <p className="text-xs text-slate-600">
              સંપૂર્ણ મજૂરી હિસાબ: હાજરીથી મળેલ કમાણી, ઉપાડ, ચુકવણી અને બાકી લેણી રકમનું ઓડિટ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setIsManageLabourOpen(true)}
            className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Manage Labour
          </button>
        </div>
      </div>

      {/* Summary KPI Cards across all workers */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Total Earned (Gross)</span>
          <span className="text-base sm:text-lg font-black text-slate-900 mt-1 block">₹{overallStats.gross.toLocaleString()}</span>
          <span className="text-[10px] text-slate-400 font-medium">Day-wise & Work-wise</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-amber-600 tracking-wider block">Total Upad (Advance)</span>
          <span className="text-base sm:text-lg font-black text-amber-700 mt-1 block">₹{overallStats.upad.toLocaleString()}</span>
          <span className="text-[10px] text-slate-400 font-medium">Given as Upad</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider block">Total Paid (Salary)</span>
          <span className="text-base sm:text-lg font-black text-emerald-700 mt-1 block">₹{overallStats.paid.toLocaleString()}</span>
          <span className="text-[10px] text-slate-400 font-medium">Salary Settlements</span>
        </div>

        <div className="bg-white border border-rose-200 rounded-xl p-3.5 shadow-sm bg-rose-50/30">
          <span className="text-[10px] uppercase font-bold text-rose-600 tracking-wider block">Total Pending (Due)</span>
          <span className="text-base sm:text-lg font-black text-rose-700 mt-1 block">₹{overallStats.due.toLocaleString()}</span>
          <span className="text-[10px] text-rose-500 font-medium">To be paid to workers</span>
        </div>

        <div className="bg-white border border-blue-200 rounded-xl p-3.5 shadow-sm bg-blue-50/30 col-span-2 lg:col-span-1">
          <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider block">Active Workers</span>
          <span className="text-base sm:text-lg font-black text-blue-900 mt-1 block">{labourList.length}</span>
          <span className="text-[10px] text-slate-500 font-medium">{records.length} Total entries</span>
        </div>
      </div>
      
      {!selectedLabour ? (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search labour by name, team, phone..."
              className="w-full text-xs sm:text-sm bg-transparent outline-none text-slate-800"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="text-xs text-slate-400 hover:text-slate-600 font-bold px-2">
                Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLabourList.map(labour => (
              <div
                key={labour.id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-cyan-300"
                onClick={() => setSelectedLabour(labour)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{labour.name}</h3>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Users className="w-3 h-3" /> {labour.teamName || 'Independent'}
                    </div>
                  </div>
                  <div className={`text-sm font-black px-2.5 py-1 rounded-lg ${
                    labour.balance > 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                    labour.balance < 0 ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    ₹{Math.abs(labour.balance).toLocaleString()} {labour.balance > 0 ? 'બાકી (Due)' : labour.balance < 0 ? 'ઉપાડ વધુ (Adv)' : 'Clear'}
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

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    Earned: <strong className="text-slate-800 font-bold">₹{labour.totalGross.toLocaleString()}</strong>
                  </span>
                  <span className="text-cyan-700 font-bold flex items-center gap-0.5">
                    View Passbook <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}

            {filteredLabourList.length === 0 && !loading && (
              <div className="col-span-full p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                {searchTerm ? "No labour workers match your search query." : "No labour records found. Make sure to add labour in Master Data and mark attendance."}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedLabour(null)}
              className="text-sm font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"
            >
              &larr; Back to All Labour
            </button>
            <span className="text-xs text-slate-500 font-mono">Worker ID: #{selectedLabour.id}</span>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{selectedLabour.name}</h2>
                <p className="text-sm text-slate-600 flex items-center gap-2 mt-0.5">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>Team: {selectedLabour.teamName || 'Independent Worker'}</span>
                  {selectedLabour.phone && <span>• Phone: {selectedLabour.phone}</span>}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setPaymentForm({ date: new Date().toISOString().split("T")[0], amount: "", description: "", isUpad: true }); setIsPaymentModalOpen(true); }}
                  className="px-4 py-2 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg text-sm font-bold transition-colors shadow-sm cursor-pointer"
                >
                  + Give Upad (ઉપાડ)
                </button>
                <button
                  type="button"
                  onClick={() => { setPaymentForm({ date: new Date().toISOString().split("T")[0], amount: "", description: "", isUpad: false }); setIsPaymentModalOpen(true); }}
                  className="px-4 py-2 bg-cyan-600 text-white hover:bg-cyan-700 rounded-lg text-sm font-bold transition-colors shadow-sm cursor-pointer"
                >
                  + Record Salary Payment (ચુકવણી)
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 border-b border-slate-100">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Earnings (કમાણી)</div>
                <div className="text-lg font-black text-slate-900">₹{selectedLabour.totalGross.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Days: {selectedLabour.totalFullDays} Full, {selectedLabour.totalHalfDays} Half</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                <div className="text-[10px] uppercase font-bold text-amber-600 mb-1">Total Upad (લીધેલ ઉપાડ)</div>
                <div className="text-lg font-black text-amber-700">₹{selectedLabour.totalUpad.toLocaleString()}</div>
                <div className="text-[10px] text-amber-600 mt-0.5">Direct advance given</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                <div className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Total Paid (ચુકવેલ પગાર)</div>
                <div className="text-lg font-black text-emerald-700">₹{selectedLabour.totalPayment.toLocaleString()}</div>
                <div className="text-[10px] text-emerald-600 mt-0.5">Final/Interim settlements</div>
              </div>
              <div className={`rounded-lg p-3 border ${selectedLabour.balance > 0 ? 'bg-rose-50 border-rose-100' : 'bg-blue-50 border-blue-100'}`}>
                <div className={`text-[10px] uppercase font-bold mb-1 ${selectedLabour.balance > 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                  Net Balance (બાકી હિસાબ)
                </div>
                <div className={`text-lg font-black ${selectedLabour.balance > 0 ? 'text-rose-700' : 'text-blue-700'}`}>
                  ₹{Math.abs(selectedLabour.balance).toLocaleString()} {selectedLabour.balance > 0 ? 'ચૂકવવા બાકી (Due)' : selectedLabour.balance < 0 ? 'ઉપાડ વધુ (Adv)' : 'હિસાબ બરાબર'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Formula: Earnings - Upad - Paid
                </div>
              </div>
            </div>
            
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-bold text-slate-600 text-xs">Date</th>
                    <th className="p-4 font-bold text-slate-600 text-xs">Type / Event</th>
                    <th className="p-4 font-bold text-slate-600 text-xs">Details / Work Description</th>
                    <th className="p-4 font-bold text-right text-slate-600 text-xs">Earned (+)</th>
                    <th className="p-4 font-bold text-right text-slate-600 text-xs">Paid / Upad (-)</th>
                    <th className="p-4 font-bold text-center text-slate-600 text-xs">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedLabour.history.map((record: any) => (
                    <tr key={record.id} className="hover:bg-slate-50/50">
                      <td className="p-4 text-slate-600 font-mono text-xs whitespace-nowrap">{record.date}</td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                          record.attendanceType === 'PAYMENT' ? 'bg-emerald-100 text-emerald-800' :
                          record.attendanceType === 'UPAD' ? 'bg-amber-100 text-amber-800' :
                          record.attendanceType?.includes('Work') ? 'bg-purple-100 text-purple-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {record.attendanceType === 'PAYMENT' ? 'Salary Payment' :
                           record.attendanceType === 'UPAD' ? 'Upad (Advance)' :
                           record.attendanceType}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 text-xs">
                        <div className="font-medium text-slate-800">
                          {record.notes || record.description || record.workType || '-'}
                        </div>
                        {(((record.quantity && parseFloat(record.quantity) > 0) || (record.tcQuantity && parseFloat(record.tcQuantity) > 0))) && (
                          <div className="text-[11px] text-slate-500">
                            Qty: {record.quantity || record.tcQuantity} {record.unitOfMeasurement || 'Nos'} @ ₹{record.rate || record.tcRate || record.dailyRate}
                          </div>
                        )}
                        {record.days && parseFloat(record.days) > 0 && (
                          <div className="text-[11px] text-slate-500">
                            Days: {record.days} @ ₹{record.dailyRate}/day
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right font-bold text-slate-900 whitespace-nowrap">
                        {parseFloat(record.grossSalary) > 0 ? `₹${Number(record.grossSalary).toLocaleString()}` : '-'}
                      </td>
                      <td className="p-4 text-right font-bold whitespace-nowrap">
                        {parseFloat(record.paymentAmount) > 0 ? (
                          <span className="text-emerald-700">₹{Number(record.paymentAmount).toLocaleString()} (Paid)</span>
                        ) : parseFloat(record.upad) > 0 ? (
                          <span className="text-amber-700">₹{Number(record.upad).toLocaleString()} (Upad)</span>
                        ) : '-'}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(record.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!selectedLabour.history || selectedLabour.history.length === 0) && (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-500">No history available for this worker</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={paymentForm.isUpad ? `Give Upad (ઉપાડ) to ${selectedLabour?.name}` : `Record Payment (પગાર ચુકવણી) for ${selectedLabour?.name}`}
      >
        <form onSubmit={handlePaymentSubmit} className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
            <span className="text-slate-500 font-bold block">Current Worker Balance:</span>
            <div className="text-base font-black text-slate-800">
              ₹{Math.abs(selectedLabour?.balance || 0).toLocaleString()} {selectedLabour?.balance > 0 ? 'બાકી લેણી રકમ (Due to worker)' : 'એડવાન્સ/ઉપાડ'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                required
                value={paymentForm.date}
                onChange={e => setPaymentForm({...paymentForm, date: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={paymentForm.amount}
                onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 font-bold text-slate-900"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Description / Notes (Optional)</label>
            <input
              type="text"
              value={paymentForm.description}
              onChange={e => setPaymentForm({...paymentForm, description: e.target.value})}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500"
              placeholder={paymentForm.isUpad ? "e.g. Festival advance / emergency upad" : "e.g. Full settlement / weekly salary"}
            />
          </div>
          <button
            type="submit"
            className={`w-full text-white font-bold py-2.5 rounded-lg transition-colors cursor-pointer shadow-md ${
              paymentForm.isUpad ? 'bg-amber-600 hover:bg-amber-700' : 'bg-cyan-600 hover:bg-cyan-700'
            }`}
          >
            {paymentForm.isUpad ? 'Save Upad Record' : 'Save Payment Record'}
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
