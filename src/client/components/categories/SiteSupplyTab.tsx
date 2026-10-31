import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { Pencil, Plus, Trash2, HardHat, ArrowRightCircle, RefreshCw, FileText, CheckCircle2, Receipt, Download } from "lucide-react";
import { useLiveSync, triggerSync } from "../../hooks/useLiveSync";
import { ManageMaterialsModal } from "../ui/ManageMaterialsModal";
import { ManageTeamsModal } from "../ui/ManageTeamsModal";
import { useToast } from "../../contexts/ToastContext";
import { downloadExcelReport } from "../../lib/excelExport";
import { formatINR, formatDate } from "../../lib/formatters";
import { DateInput } from "../ui/DateInput";

export default function SiteSupplyTab({ locationId }: { locationId: number }) {
  const { showToast, confirmAction } = useToast();
  const [records, setRecords] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManageMaterialOpen, setIsManageMaterialOpen] = useState(false);
  const [isManageTeamOpen, setIsManageTeamOpen] = useState(false);
  const [targetItemIndex, setTargetItemIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    siteLocationId: locationId.toString(),
    teamId: "",
    notes: "",
    items: [{ materialId: "", quantity: "", unit: "", rate: "0", taxPercentage: "18" }]
  });

  const loadData = async (isBackground = false) => {
    if (!isBackground && records.length === 0) setLoading(true);
    try {
      const [supplies, mats, labTeams, locs] = await Promise.all([
        apiFetch(`/site-supplies?locationId=${locationId}`).catch(() => []),
        apiFetch(`/master/materials`).catch(() => []),
        apiFetch(`/master/teams?locationId=${locationId}`).catch(() => []),
        apiFetch(`/locations`).catch(() => [])
      ]);
      setRecords(supplies || []);
      setMaterials(mats || []);
      setTeams(labTeams || []);
      setLocations(locs || []);
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

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { materialId: "", quantity: "", unit: "", rate: "0", taxPercentage: "18" }]
    });
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-update unit and rate if material changes
    if (field === "materialId") {
      const mat = materials.find(m => m.id.toString() === value);
      if (mat) {
        newItems[index].unit = mat.defaultUnit || mat.unit || 'Nos';
        const activeRate = (mat.defaultRate && parseFloat(mat.defaultRate) > 0)
          ? String(mat.defaultRate)
          : (mat.rate && parseFloat(mat.rate) > 0 ? String(mat.rate) : "0");
        newItems[index].rate = activeRate;
      } else {
        newItems[index].unit = "";
        newItems[index].rate = "0";
      }
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index: number) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  // Live calculation of current modal form
  const modalCalculations = useMemo(() => {
    let totalTaxable = 0;
    let totalTax = 0;
    let totalQty = 0;

    const computedItems = formData.items.map(item => {
      const qty = Math.max(0, parseFloat(item.quantity) || 0);
      const rate = Math.max(0, parseFloat(item.rate) || 0);
      const taxRate = Math.max(0, parseFloat(item.taxPercentage) || 0);
      const subtotal = Math.round(qty * rate * 100) / 100;
      const itemTax = Math.round(subtotal * (taxRate / 100) * 100) / 100;
      const itemTotal = Math.round((subtotal + itemTax) * 100) / 100;

      totalQty += qty;
      totalTaxable += subtotal;
      totalTax += itemTax;

      return {
        ...item,
        qty,
        rate,
        subtotal,
        taxRate,
        itemTax,
        itemTotal
      };
    });

    const grandTotal = Math.round((totalTaxable + totalTax) * 100) / 100;

    return {
      computedItems,
      totalQty,
      totalTaxable: Math.round(totalTaxable * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      grandTotal
    };
  }, [formData.items]);

  // Overall Statistics for Tab
  const stats = useMemo(() => {
    let totalEntries = records.length;
    let totalDispatchedQty = 0;
    let totalSubtotal = 0;
    let totalTax = 0;
    let grandSupplyValue = 0;

    records.forEach(r => {
      grandSupplyValue += parseFloat(r.totalAmount || 0) || 0;
      if (r.subtotal) totalSubtotal += parseFloat(r.subtotal) || 0;
      else totalSubtotal += parseFloat(r.totalAmount || 0) || 0;
      if (r.taxAmount) totalTax += parseFloat(r.taxAmount) || 0;

      if (r.items && Array.isArray(r.items)) {
        r.items.forEach((it: any) => {
          totalDispatchedQty += parseFloat(it.quantity || 0) || 0;
        });
      }
    });

    return {
      totalEntries,
      totalDispatchedQty: Math.round(totalDispatchedQty * 100) / 100,
      totalSubtotal: Math.round(totalSubtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      grandSupplyValue: Math.round(grandSupplyValue * 100) / 100
    };
  }, [records]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validate items
      const validItems = formData.items.filter(i => i.materialId && i.quantity && parseFloat(i.quantity) > 0);
      if (validItems.length === 0) {
        showToast("Please add at least one material with a valid quantity", "error");
        return;
      }
      
      const url = editingId ? `/site-supplies/${editingId}` : "/site-supplies";
      const method = editingId ? "PUT" : "POST";
      
      await apiFetch(url, {
        method, 
        body: JSON.stringify({
          locationId: parseInt(formData.siteLocationId) || locationId,
          date: formData.date,
          teamId: formData.teamId ? parseInt(formData.teamId) : null,
          notes: formData.notes,
          items: validItems.map(i => {
            const mat = materials.find(m => m.id.toString() === i.materialId);
            return {
              materialId: parseInt(i.materialId),
              quantity: parseFloat(i.quantity),
              unit: i.unit || mat?.defaultUnit || mat?.unit || 'Nos',
              rate: parseFloat(i.rate) || 0,
              taxPercentage: parseFloat(i.taxPercentage) || 0
            };
          })
        }),
      });
      triggerSync("site_supplies");
      triggerSync("stock");
      triggerSync("materials");
      triggerSync("reports");
      setIsModalOpen(false);
      resetForm();
      showToast(editingId ? "Site supply updated successfully" : "Site supply recorded successfully", "success");
      await loadData();
    } catch (err: any) {
      console.error("Failed to save supply:", err);
      showToast(err.message || "Failed to save site supply", "error");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      siteLocationId: locationId.toString(),
      teamId: "",
      notes: "",
      items: [{ materialId: "", quantity: "", unit: "", rate: "0", taxPercentage: "18" }]
    });
  };

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    
    const items = (record.items && record.items.length > 0) ? record.items.map((i: any) => {
      const qty = parseFloat(i.quantity) || 0;
      let rateVal = parseFloat(i.rate) || 0;
      const itemSub = parseFloat(i.subtotal || i.amount) || 0;
      if (rateVal <= 0 && qty > 0 && itemSub > 0) {
        rateVal = Math.round((itemSub / qty) * 100) / 100;
      }
      return {
        materialId: i.materialId?.toString() || "",
        quantity: i.quantity?.toString() || "",
        unit: i.unit || "Nos",
        rate: rateVal > 0 ? String(rateVal) : (i.rate?.toString() || "0"),
        taxPercentage: i.taxPercentage !== undefined && i.taxPercentage !== null ? String(i.taxPercentage) : "18"
      };
    }) : [{ materialId: "", quantity: "", unit: "Nos", rate: "0", taxPercentage: "18" }];
    
    setFormData({
      date: record.date || new Date().toISOString().split("T")[0],
      siteLocationId: record.locationId?.toString() || locationId.toString(),
      teamId: record.teamId?.toString() || "",
      notes: record.displayNotes || record.notes || "",
      items
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirmAction({
      title: "Delete Site Supply",
      message: "Are you sure you want to delete this site supply record? Stock will be automatically restored.",
      confirmLabel: "Delete",
      isDanger: true
    });
    if (!confirmed) return;
    try {
      await apiFetch(`/site-supplies/${id}`, { method: "DELETE" });
      triggerSync("site_supplies");
      triggerSync("stock");
      triggerSync("materials");
      triggerSync("reports");
      showToast("Site supply deleted and stock restored", "success");
      await loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete supply", "error");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0 max-w-full">
      {/* Top Header & Actions */}
      <div className="bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-teal-500/10 border border-teal-200/80 p-3.5 sm:p-5 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3.5 sm:gap-4 min-w-0">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="p-2.5 sm:p-3 bg-teal-600 text-white rounded-xl shadow-md shrink-0">
            <Receipt className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-black text-slate-900 break-words">Category 5: Site Material Supply with GST</h2>
            <p className="text-xs text-slate-600 break-words mt-0.5">Issue materials to internal teams &amp; site with itemized GST computation and automatic capital deduction.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <button
            onClick={() => downloadExcelReport(`/reports/export-site-supplies?locationId=${locationId}`, `Site_Supplies_Location_${locationId}.xlsx`)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-teal-300 text-teal-950 hover:bg-teal-50 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Export Site Supplies & GST Details to Excel"
          >
            <Download className="w-4 h-4 text-teal-600 shrink-0" /> <span>Export (.xlsx)</span>
          </button>
          <button
            onClick={() => loadData(false)}
            disabled={loading}
            className="p-2.5 border border-slate-200 bg-white rounded-xl hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shrink-0"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:bg-teal-700 transition-colors shrink-0 cursor-pointer">
            <Plus className="w-4 h-4 shrink-0" /> <span>Add Site Supply</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm min-w-0">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider break-words">Total Supplies</div>
          <div className="text-lg sm:text-xl font-black text-slate-800 mt-1 break-words">{stats.totalEntries} Records</div>
          <div className="text-[11px] text-teal-600 font-medium mt-0.5 break-words">{formatINR(stats.totalDispatchedQty)} Total Units Dispatched</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm min-w-0">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider break-words">Base Subtotal</div>
          <div className="text-lg sm:text-xl font-black text-slate-700 mt-1 tabular-nums break-all sm:break-words">₹{formatINR(stats.totalSubtotal)}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5 break-words">Taxable Base Amount</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm min-w-0">
          <div className="text-[11px] font-bold text-teal-700 uppercase tracking-wider break-words">GST Tax Amount</div>
          <div className="text-lg sm:text-xl font-black text-teal-700 mt-1 tabular-nums break-all sm:break-words">₹{formatINR(stats.totalTax)}</div>
          <div className="text-[11px] text-teal-600 font-medium mt-0.5 break-words">Total GST (CGST/SGST)</div>
        </div>
        <div className="bg-teal-50/60 p-3.5 rounded-xl border border-teal-200 shadow-sm min-w-0">
          <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider break-words">Grand Total with GST</div>
          <div className="text-lg sm:text-xl font-black text-teal-900 mt-1 tabular-nums break-all sm:break-words">₹{formatINR(stats.grandSupplyValue)}</div>
          <div className="text-[11px] text-teal-700 font-medium mt-0.5 break-words">Deducted from Cat 2 Capital</div>
        </div>
      </div>

      {/* Main Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-w-0">
        <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-2">
          <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="break-words">Site Supply Dispatches &amp; GST Details</span>
          </h3>
          <span className="text-xs text-slate-500 font-semibold shrink-0">{records.length} records</span>
        </div>
        
        {/* Mobile Cards View */}
        <div className="block md:hidden divide-y divide-slate-100">
          {records.map(r => {
            const subtotalVal = parseFloat(r.subtotal || r.totalAmount || 0);
            const taxVal = parseFloat(r.taxAmount || 0);
            const totalVal = parseFloat(r.totalAmount || 0);
            const locName = locations.find(l => l.id === r.locationId)?.name || `Location ${r.locationId}`;
            const teamName = teams.find(t => t.id === r.teamId)?.name;

            return (
              <div key={`ss-mob-${r.id}`} className="p-3.5 sm:p-4 space-y-3 bg-white hover:bg-slate-50/60 transition-colors min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-2 py-0.5 bg-teal-50 border border-teal-100 text-teal-900 rounded text-[11px] font-bold flex items-center gap-1 break-words min-w-0">
                    {locName}
                  </span>
                  <span className="text-slate-500 text-xs font-medium shrink-0">{formatDate(r.date)}</span>
                </div>

                <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm min-w-0">
                  <HardHat className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="break-words min-w-0">{teamName || "Direct Site"}</span>
                </div>

                {r.items && r.items.length > 0 && (
                  <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 min-w-0">
                    {r.items.map((item: any, i: number) => {
                      const matName = materials.find(m => m.id === item.materialId)?.name || 'Material #' + item.materialId;
                      const itemQty = parseFloat(item.quantity) || 0;
                      const itemRate = parseFloat(item.rate) || 0;
                      const itemTotalAmt = parseFloat(item.totalWithGst || item.amount) || (itemQty * itemRate);

                      return (
                        <div key={i} className="text-xs flex flex-wrap items-center justify-between gap-1 py-1 border-b border-slate-200/60 last:border-none min-w-0">
                          <div className="min-w-0">
                            <span className="font-bold text-teal-900 break-words">{matName}</span>
                            <span className="text-slate-600 text-[11px] ml-1.5 font-semibold">({formatINR(itemQty)} {item.unit || 'Nos'})</span>
                          </div>
                          <div className="font-extrabold text-slate-800 tabular-nums">
                            ₹{formatINR(itemTotalAmt)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {r.displayNotes && (
                  <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 break-words">
                    {r.displayNotes}
                  </div>
                )}

                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-2 bg-teal-50/50 p-2.5 rounded-xl border border-teal-100 text-xs min-w-0">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase font-bold text-teal-800">Taxable + GST</div>
                    <div className="font-semibold text-slate-700 break-words tabular-nums">₹{formatINR(subtotalVal)} + ₹{formatINR(taxVal)}</div>
                  </div>
                  <div className="xs:text-right sm:text-right min-w-0">
                    <div className="text-[10px] uppercase font-bold text-teal-800">Grand Total</div>
                    <div className="font-black text-teal-950 text-sm break-all sm:break-words tabular-nums">₹{formatINR(totalVal)}</div>
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
                    <Trash2 className="w-4 h-4 text-rose-600" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
          {records.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-xs">
              No site supply records found. Click &quot;+ Add Site Supply&quot; above to record a dispatch.
            </div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Site Location</th>
                <th className="p-3">Labour Team</th>
                <th className="p-3">Dispatched Materials (with GST)</th>
                <th className="p-3 text-right">Taxable Subtotal</th>
                <th className="p-3 text-right">GST Tax</th>
                <th className="p-3 text-right">Grand Total</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map(r => {
                const subtotalVal = parseFloat(r.subtotal || r.totalAmount || 0);
                const taxVal = parseFloat(r.taxAmount || 0);
                const totalVal = parseFloat(r.totalAmount || 0);

                return (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 text-slate-700 font-medium">{formatDate(r.date)}</td>
                    <td className="p-3 font-bold text-slate-800">
                       {locations.find(l => l.id === r.locationId)?.name || `Location ${r.locationId}`}
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <HardHat className="w-3.5 h-3.5 text-teal-600" />
                        {teams.find(t => t.id === r.teamId)?.name || <span className="text-slate-400 font-normal">Direct Site</span>}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="space-y-1 max-w-md">
                        {r.items && r.items.map((item: any, i: number) => {
                           const matName = materials.find(m => m.id === item.materialId)?.name || 'Material #' + item.materialId;
                           const itemQty = parseFloat(item.quantity) || 0;
                           const itemRate = parseFloat(item.rate) || 0;
                           const itemGstPct = parseFloat(item.taxPercentage) || 0;
                           const itemGstAmt = parseFloat(item.taxAmount) || 0;
                           const itemTotalAmt = parseFloat(item.totalWithGst || item.amount) || (itemQty * itemRate);

                           return (
                             <div key={i} className="flex flex-wrap gap-1.5 items-center text-[11px] bg-slate-50/90 border border-slate-200/80 rounded px-2 py-1">
                               <span className="font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">{matName}</span>
                               <span className="text-slate-700 font-semibold">{formatINR(itemQty)} {item.unit || 'Nos'}</span>
                               {itemRate > 0 && <span className="text-slate-500 font-medium">@ ₹{formatINR(itemRate)}</span>}
                               {itemGstPct > 0 && (
                                 <span className="text-amber-700 font-semibold bg-amber-50 px-1 rounded border border-amber-100">
                                   +{itemGstPct}% GST (₹{formatINR(itemGstAmt)})
                                 </span>
                               )}
                               <span className="font-bold text-slate-900 ml-auto">= ₹{formatINR(itemTotalAmt)}</span>
                             </div>
                           )
                        })}
                        {r.displayNotes && (
                          <div className="text-[10px] text-slate-500 italic mt-0.5">
                            Note: {r.displayNotes}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right font-medium text-slate-600">
                      ₹{formatINR(subtotalVal)}
                    </td>
                    <td className="p-3 text-right font-bold text-teal-700">
                      {taxVal > 0 ? `₹${formatINR(taxVal)}` : <span className="text-slate-400 font-normal">₹0</span>}
                    </td>
                    <td className="p-3 text-right font-black text-slate-900">
                      <span className="bg-teal-50 text-teal-900 px-2 py-0.5 rounded-md border border-teal-200">
                        ₹{formatINR(totalVal)}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleEdit(r)} className="text-slate-400 hover:text-teal-600 p-1.5 rounded-lg hover:bg-teal-50 transition-colors cursor-pointer" title="Edit"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(r.id)} className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {records.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">No site supply records found. Click "+ Add Site Supply" above to record a dispatch.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal with Full GST Calculation */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Site Supply" : "Add Site Supply with GST"} maxWidth="3xl">
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[82vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date (DD-MM-YYYY) *</label>
              <DateInput required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 font-medium" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Site Location *</label>
              <select required value={formData.siteLocationId} onChange={e => setFormData({...formData, siteLocationId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 font-medium">
                <option value="">-- Select Site --</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">Labour Team / Recipient</label>
              <button
                type="button"
                onClick={() => setIsManageTeamOpen(true)}
                className="text-[11px] font-bold text-teal-700 hover:text-teal-900 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Manage Team
              </button>
            </div>
            <select value={formData.teamId} onChange={e => setFormData({...formData, teamId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 font-medium">
              <option value="">-- Select Team (Optional) --</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          
          {/* Material List with GST Box */}
          <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
            <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">MATERIAL LIST WITH GST</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTargetItemIndex(null);
                  setIsManageMaterialOpen(true);
                }}
                className="text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Manage Material
              </button>
            </div>
            <div className="p-3 space-y-3 bg-white">
               {formData.items.map((item, index) => {
                 const computed = modalCalculations.computedItems[index] || { subtotal: 0, itemTax: 0, itemTotal: 0 };
                 const selMat = materials.find(m => m.id.toString() === item.materialId);
                 const detectedUnit = (selMat ? (selMat.defaultUnit || selMat.unit) : '') || item.unit || (item.materialId ? 'Nos' : '');

                 return (
                   <div key={index} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                     <div className="flex items-center justify-between">
                       <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                         <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 text-[11px] font-bold flex items-center justify-center">
                           {index + 1}
                         </span>
                         Material Item
                       </span>
                       {formData.items.length > 1 && (
                         <button
                           type="button"
                           onClick={() => removeItem(index)}
                           className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
                         >
                           <Trash2 className="w-3.5 h-3.5" /> Remove
                         </button>
                       )}
                     </div>
                     
                     <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                       <div className="sm:col-span-5">
                         <label className="block text-[11px] font-bold text-slate-600 mb-1">Material *</label>
                         <select 
                           required 
                           value={item.materialId} 
                           onChange={e => updateItem(index, 'materialId', e.target.value)} 
                           className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500"
                         >
                           <option value="">- Select Material -</option>
                           {materials.map(m => {
                             const r = parseFloat(m.defaultRate || m.rate || '0');
                             return (
                               <option key={m.id} value={m.id}>
                                 {m.name} (Stock: {m.currentStock ?? 0} {m.defaultUnit || m.unit || 'Nos'}{r > 0 ? ` • ₹${r}/${m.defaultUnit || m.unit || 'Nos'}` : ''})
                               </option>
                             );
                           })}
                         </select>
                         {item.materialId && (
                           <div className="mt-1 flex items-center justify-between text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                             <span>📦 Stock: {selMat?.currentStock ?? 0} {detectedUnit || 'Nos'}</span>
                             <span>🏷️ Rate: ₹{parseFloat(selMat?.defaultRate || selMat?.rate || '0')} / {detectedUnit || 'Nos'}</span>
                           </div>
                         )}
                       </div>
                       <div className="grid grid-cols-2 sm:grid-cols-4 sm:col-span-7 gap-2">
                         <div>
                           <label className="block text-[11px] font-bold text-slate-600 mb-1">Qty *</label>
                           <input type="number" step="any" inputMode="decimal" required placeholder="0.00" value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-teal-800" />
                         </div>
                         <div>
                           <div className="flex items-center justify-between mb-1">
                             <label className="block text-[11px] font-bold text-slate-600">Unit</label>
                             <span className="text-[9px] font-semibold text-teal-700 bg-teal-50 px-1 py-0.2 rounded border border-teal-200">
                               Auto
                             </span>
                           </div>
                           <input 
                             type="text" 
                             readOnly
                             tabIndex={-1}
                             placeholder="Auto" 
                             value={detectedUnit} 
                             className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-700 cursor-not-allowed select-none focus:outline-none" 
                             title="Stock measurement parthi automatic detect thay che (Auto-detected from stock)" 
                           />
                         </div>
                         <div>
                           <div className="flex items-center justify-between mb-1">
                             <label className="block text-[11px] font-bold text-slate-600">Rate (₹)</label>
                             <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                               Auto
                             </span>
                           </div>
                           <input type="number" step="any" inputMode="decimal" placeholder="0.00" value={item.rate} onChange={e => updateItem(index, 'rate', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-teal-500" />
                         </div>
                         <div>
                           <label className="block text-[11px] font-bold text-slate-600 mb-1">GST %</label>
                           <select value={item.taxPercentage} onChange={e => updateItem(index, 'taxPercentage', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold text-amber-700">
                             <option value="0">0% (Nil)</option>
                             <option value="5">5% GST</option>
                             <option value="12">12% GST</option>
                             <option value="18">18% GST</option>
                             <option value="28">28% GST</option>
                           </select>
                         </div>
                       </div>
                     </div>

                     {/* Live Item Total Strip */}
                     <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 flex flex-wrap justify-between items-center text-[11px]">
                       <div className="flex gap-3 text-slate-600">
                         <span>Taxable Subtotal: <strong className="text-slate-800">₹{formatINR(computed.subtotal)}</strong></span>
                         <span>GST Tax: <strong className="text-amber-700">₹{formatINR(computed.itemTax)} ({item.taxPercentage}%)</strong></span>
                       </div>
                       <div className="font-bold text-teal-800">
                         Total with GST: <strong>₹{formatINR(computed.itemTotal)}</strong>
                       </div>
                     </div>
                   </div>
                 );
               })}
               <button type="button" onClick={addItem} className="w-full py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-teal-200/60">
                 <Plus className="w-3.5 h-3.5" /> Add another material
               </button>
            </div>

            {/* Live Form Summary Banner */}
            <div className="bg-teal-900 text-white p-3.5 border-t border-teal-800">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] uppercase font-bold text-teal-300">Base Subtotal</div>
                  <div className="text-sm font-bold mt-0.5 font-mono tabular-nums">₹{formatINR(modalCalculations.totalTaxable)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-amber-300">Total GST Tax</div>
                  <div className="text-sm font-bold text-amber-300 mt-0.5 font-mono tabular-nums">₹{formatINR(modalCalculations.totalTax)}</div>
                </div>
                <div className="bg-teal-800/80 rounded-lg p-1.5">
                  <div className="text-[10px] uppercase font-black text-white">Grand Total with GST</div>
                  <div className="text-base font-black text-white mt-0.5 font-mono tabular-nums">₹{formatINR(modalCalculations.grandTotal)}</div>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Remarks</label>
            <input type="text" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Optional remarks or delivery details" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500" />
          </div>

          <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm cursor-pointer flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {editingId ? "Update Site Supply" : "Save Site Supply with GST"}
          </button>
        </form>
      </Modal>

      {/* Quick Manage Material Modal */}
      <ManageMaterialsModal
        isOpen={isManageMaterialOpen}
        onClose={() => {
          setIsManageMaterialOpen(false);
          setTargetItemIndex(null);
        }}
        locationId={locationId}
        onSelectMaterial={(selectedMat) => {
          if (targetItemIndex !== null && formData.items[targetItemIndex]) {
            updateItem(targetItemIndex, 'materialId', String(selectedMat.id));
          } else {
            const lastIdx = formData.items.length - 1;
            if (lastIdx >= 0 && !formData.items[lastIdx].materialId) {
              updateItem(lastIdx, 'materialId', String(selectedMat.id));
            } else {
              setFormData(prev => ({
                ...prev,
                items: [
                  ...prev.items,
                  {
                    materialId: String(selectedMat.id),
                    quantity: "",
                    unit: selectedMat.defaultUnit || "Nos",
                    rate: selectedMat.defaultRate ? String(selectedMat.defaultRate) : "0",
                    taxPercentage: "18"
                  }
                ]
              }));
            }
          }
          loadData(true);
        }}
      />

      {/* Quick Manage Team Modal */}
      <ManageTeamsModal
        isOpen={isManageTeamOpen}
        onClose={() => setIsManageTeamOpen(false)}
        locationId={locationId}
        currentSelectedId={formData.teamId}
        onSelectTeam={(selectedTeam) => {
          setFormData(prev => ({
            ...prev,
            teamId: String(selectedTeam.id)
          }));
          loadData(true);
        }}
      />
    </div>
  );
}
