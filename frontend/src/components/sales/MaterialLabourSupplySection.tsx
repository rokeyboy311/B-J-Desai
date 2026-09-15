import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { 
  Plus, PackageOpen, Trash2, IndianRupee, Pencil, 
  Search, Filter, CheckCircle2, Clock, Users, Building2
} from "lucide-react";

interface MaterialLabourSupplySectionProps {
  locationId?: number | "all";
}

export default function MaterialLabourSupplySection({ locationId = "all" }: MaterialLabourSupplySectionProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    locationId: 0,
    date: new Date().toISOString().split("T")[0],
    partyName: "",
    teamName: "",
    materialName: "",
    materialQuantity: 1,
    materialUnit: "Nos",
    materialRate: 0,
    labourDays: 1,
    labourDailyRate: 500,
    transportCost: 0,
    discount: 0,
    taxPercentage: 18,
    paymentStatus: "UNPAID",
    paymentMethod: "BANK",
    referenceNumber: "",
    description: ""
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const locParam = locationId && locationId !== "all" ? `?locationId=${locationId}` : "";
      const [res, locRes, teamRes] = await Promise.all([
        apiFetch(`/materials/labour-supply${locParam}`),
        apiFetch("/locations").catch(() => []),
        apiFetch("/master/teams").catch(() => [])
      ]);

      setRecords(res || []);
      const locList = Array.isArray(locRes) ? locRes : [];
      setLocations(locList);
      const teamList = Array.isArray(teamRes) ? teamRes.map((t: any) => t.name) : [];
      setTeams(teamList);

      if (locList.length > 0 && !formData.locationId) {
        setFormData(prev => ({ ...prev, locationId: locList[0].id }));
      }
    } catch (err) {
      console.error("Failed to load turnkey supply contracts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [locationId]);

  // Real-time calculations
  const calc = useMemo(() => {
    const matQty = Number(formData.materialQuantity) || 0;
    const matRate = Number(formData.materialRate) || 0;
    const matAmount = Math.round(matQty * matRate * 100) / 100;

    const labDays = Number(formData.labourDays) || 0;
    const labRate = Number(formData.labourDailyRate) || 0;
    const labAmount = Math.round(labDays * labRate * 100) / 100;

    const subtotal = Math.round((matAmount + labAmount) * 100) / 100;
    const discount = Number(formData.discount) || 0;
    const taxable = Math.max(0, subtotal - discount);

    const taxPerc = Number(formData.taxPercentage) || 0;
    const taxAmount = Math.round(taxable * (taxPerc / 100) * 100) / 100;
    const transport = Number(formData.transportCost) || 0;

    const grandTotal = Math.round((taxable + taxAmount + transport) * 100) / 100;

    return { matAmount, labAmount, subtotal, taxable, taxAmount, grandTotal };
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/materials/labour-supply/${editingId}` : "/materials/labour-supply";
      const method = editingId ? "PUT" : "POST";
      const targetLocId = formData.locationId || (locations[0]?.id || 1);

      await apiFetch(url, {
        method,
        body: JSON.stringify({
          ...formData,
          locationId: targetLocId,
          materialQuantity: Number(formData.materialQuantity) || 0,
          materialRate: Number(formData.materialRate) || 0,
          labourDays: Number(formData.labourDays) || 0,
          labourDailyRate: Number(formData.labourDailyRate) || 0,
          transportCost: Number(formData.transportCost) || 0,
          discount: Number(formData.discount) || 0,
          taxPercentage: Number(formData.taxPercentage) || 0,
        })
      });

      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error("Failed to save turnkey contract:", err);
    }
  };

  const handleEdit = (r: any) => {
    setEditingId(r.id);
    setFormData({
      locationId: r.locationId,
      date: r.date || new Date().toISOString().split("T")[0],
      partyName: r.partyName || "",
      teamName: r.teamName || "",
      materialName: r.materialName || "",
      materialQuantity: r.materialQuantity || 1,
      materialUnit: r.materialUnit || "Nos",
      materialRate: r.materialRate || 0,
      labourDays: r.labourDays || 1,
      labourDailyRate: r.labourDailyRate || 500,
      transportCost: r.transportCost || 0,
      discount: r.discount || 0,
      taxPercentage: r.taxPercentage || 18,
      paymentStatus: r.paymentStatus || "UNPAID",
      paymentMethod: r.paymentMethod || "BANK",
      referenceNumber: r.referenceNumber || "",
      description: r.description || ""
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this contract record?")) return;
    try {
      await apiFetch(`/materials/labour-supply/${id}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      console.error("Failed to delete record:", err);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      locationId: locations[0]?.id || 1,
      date: new Date().toISOString().split("T")[0],
      partyName: "",
      teamName: teams[0] || "",
      materialName: "",
      materialQuantity: 1,
      materialUnit: "Nos",
      materialRate: 0,
      labourDays: 1,
      labourDailyRate: 500,
      transportCost: 0,
      discount: 0,
      taxPercentage: 18,
      paymentStatus: "UNPAID",
      paymentMethod: "BANK",
      referenceNumber: "",
      description: ""
    });
  };

  const filteredRecords = records.filter(r => {
    const matchSearch = 
      (r.partyName && r.partyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.materialName && r.materialName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.teamName && r.teamName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchStatus = statusFilter === "ALL" || r.paymentStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRevenue = filteredRecords.reduce((acc, r) => acc + (parseFloat(r.totalAmount) || 0), 0);
  const totalLabourValue = filteredRecords.reduce((acc, r) => acc + (parseFloat(r.labourAmount) || 0), 0);
  const totalMaterialValue = filteredRecords.reduce((acc, r) => acc + (parseFloat(r.materialAmount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Turnkey Contract Value</span>
            <div className="text-xl font-bold text-slate-900 mt-1">₹{totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-0.5">{filteredRecords.length} turnkey contracts</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <PackageOpen className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Labour Component</span>
            <div className="text-xl font-bold text-indigo-600 mt-1">₹{totalLabourValue.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-0.5">Execution & fitting work</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Material Component</span>
            <div className="text-xl font-bold text-slate-900 mt-1">₹{totalMaterialValue.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-0.5">Supplied materials value</p>
          </div>
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search party, material, or team..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            {["ALL", "PAID", "UNPAID"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  statusFilter === s ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl transition shadow-sm ml-auto"
          >
            <Plus size={15} />
            New Turnkey Contract
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Client & Team</th>
                <th className="p-3.5">Material Component</th>
                <th className="p-3.5">Labour Component</th>
                <th className="p-3.5 text-right">Subtotal</th>
                <th className="p-3.5 text-right">GST</th>
                <th className="p-3.5 text-right">Grand Total (₹)</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">Loading turnkey records...</td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    <PackageOpen size={32} className="mx-auto mb-2 text-slate-300" />
                    <p>No turnkey contracts recorded.</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-medium text-slate-900 whitespace-nowrap">{r.date}</td>
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{r.partyName}</div>
                      <div className="text-[11px] text-indigo-600 font-medium">{r.teamName || "Direct"}</div>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="font-medium text-slate-800">{r.materialName}</span>
                      <div className="text-[10px] text-slate-500">
                        {r.materialQuantity} {r.materialUnit} @ ₹{r.materialRate} = ₹{r.materialAmount}
                      </div>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="font-medium text-slate-800">{r.labourDays} Days</span>
                      <div className="text-[10px] text-slate-500">
                        @ ₹{r.labourDailyRate}/day = ₹{r.labourAmount}
                      </div>
                    </td>
                    <td className="p-3.5 text-right font-medium text-slate-800 whitespace-nowrap">₹{r.subtotal}</td>
                    <td className="p-3.5 text-right text-slate-500 whitespace-nowrap">₹{r.taxAmount || 0}</td>
                    <td className="p-3.5 text-right font-bold text-slate-900 whitespace-nowrap">₹{r.totalAmount}</td>
                    <td className="p-3.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        r.paymentStatus === "PAID" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {r.paymentStatus}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleEdit(r)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? "Edit Turnkey Contract" : "Record Turnkey Material + Labour Contract"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Branch / Location *</label>
              <select
                value={formData.locationId}
                onChange={(e) => setFormData(prev => ({ ...prev, locationId: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              >
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contract Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Client / Party Name *</label>
              <input
                type="text"
                placeholder="e.g. Skyline Towers"
                value={formData.partyName}
                onChange={(e) => setFormData(prev => ({ ...prev, partyName: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Team</label>
              <select
                value={formData.teamName}
                onChange={(e) => setFormData(prev => ({ ...prev, teamName: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="">Direct Assignment</option>
                {teams.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Material Portion */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-800 block">1. Material Supply Component</span>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-3 sm:col-span-1">
                <label className="block text-[10px] text-slate-500 mb-0.5">Material Name</label>
                <input
                  type="text"
                  placeholder="e.g. Copper wiring & switches"
                  value={formData.materialName}
                  onChange={(e) => setFormData(prev => ({ ...prev, materialName: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Quantity & Unit</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={formData.materialQuantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, materialQuantity: Number(e.target.value) }))}
                    className="w-2/3 px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                  />
                  <input
                    type="text"
                    value={formData.materialUnit}
                    onChange={(e) => setFormData(prev => ({ ...prev, materialUnit: e.target.value }))}
                    className="w-1/3 px-1 py-1.5 text-xs text-center bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Material Rate (₹)</label>
                <input
                  type="number"
                  value={formData.materialRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, materialRate: Number(e.target.value) }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div className="text-right text-xs font-semibold text-slate-700">
              Material Subtotal: ₹{calc.matAmount}
            </div>
          </div>

          {/* Labour Portion */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-800 block">2. Labour Execution Component</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Labour Days Worked</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.labourDays}
                  onChange={(e) => setFormData(prev => ({ ...prev, labourDays: Number(e.target.value) }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Daily Wage / Charge (₹)</label>
                <input
                  type="number"
                  value={formData.labourDailyRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, labourDailyRate: Number(e.target.value) }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div className="text-right text-xs font-semibold text-slate-700">
              Labour Subtotal: ₹{calc.labAmount}
            </div>
          </div>

          {/* Taxes & Total */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Freight (₹)</label>
              <input
                type="number"
                value={formData.transportCost}
                onChange={(e) => setFormData(prev => ({ ...prev, transportCost: Number(e.target.value) }))}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Discount (₹)</label>
              <input
                type="number"
                value={formData.discount}
                onChange={(e) => setFormData(prev => ({ ...prev, discount: Number(e.target.value) }))}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">GST Tax (%)</label>
              <select
                value={formData.taxPercentage}
                onChange={(e) => setFormData(prev => ({ ...prev, taxPercentage: Number(e.target.value) }))}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
              >
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">Taxable:</span>
              <span className="font-semibold text-slate-800">₹{calc.taxable}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Tax ({formData.taxPercentage}%):</span>
              <span className="font-semibold text-slate-800">₹{calc.taxAmount}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Total Contract Value:</span>
              <span className="font-bold text-indigo-700 text-sm">₹{calc.grandTotal}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm"
            >
              {editingId ? "Update Contract" : "Save Contract"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
