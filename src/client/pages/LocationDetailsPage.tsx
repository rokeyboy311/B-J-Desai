import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { Modal } from "../components/ui/Modal";
import { ArrowLeft, Plus, ArrowUpRight, ArrowDownRight, Trash2, Edit2, Download, Search, Filter } from "lucide-react";

interface RecordMetrics {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
}

interface HisabRecord {
  id: number;
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  date: string;
  partyName: string;
  category: string | null;
  description: string | null;
}

export default function LocationDetailsPage() {
  const { id: locationId } = useParams();
  const navigate = useNavigate();
  
  const [metrics, setMetrics] = useState<RecordMetrics>({ totalIncome: 0, totalExpense: 0, netBalance: 0 });
  const [records, setRecords] = useState<HisabRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Quick Add Form state
  const [newRecordData, setNewRecordData] = useState({
    type: "INCOME" as "INCOME" | "EXPENSE",
    amount: "",
    date: new Date().toISOString().split('T')[0],
    partyName: "",
    category: "",
    description: "",
  });
  const [quickAddError, setQuickAddError] = useState("");

  // Edit Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<HisabRecord | null>(null);
  const [editFormError, setEditFormError] = useState("");
  
  const [editFormData, setEditFormData] = useState({
    type: "INCOME",
    amount: "",
    date: new Date().toISOString().split('T')[0],
    partyName: "",
    category: "",
    description: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [metricsData, recordsData] = await Promise.all([
        apiFetch(`/records/metrics?locationId=${locationId}`),
        apiFetch(`/records?locationId=${locationId}`)
      ]);
      setMetrics(metricsData);
      setRecords(recordsData);
    } catch (error) {
      console.error("Failed to load location data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (locationId) fetchData();
  }, [locationId]);

  const openEditModal = (record: HisabRecord) => {
    setSelectedRecord(record);
    setEditFormData({
      type: record.type,
      amount: record.amount,
      date: record.date,
      partyName: record.partyName,
      category: record.category || "",
      description: record.description || "",
    });
    setEditFormError("");
    setIsEditModalOpen(true);
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecordData.amount || isNaN(Number(newRecordData.amount)) || Number(newRecordData.amount) <= 0) {
      setQuickAddError("Please enter a valid positive amount");
      return;
    }
    if (!newRecordData.partyName.trim()) {
      setQuickAddError("Party name is required");
      return;
    }

    try {
      setQuickAddError("");
      const payload = { 
        ...newRecordData, 
        partyName: newRecordData.partyName.trim(),
        category: newRecordData.category.trim(),
        description: newRecordData.description.trim(),
        locationId: Number(locationId) 
      };
      
      await apiFetch(`/records`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      
      // Reset form on success
      setNewRecordData({
        type: "INCOME",
        amount: "",
        date: new Date().toISOString().split('T')[0],
        partyName: "",
        category: "",
        description: "",
      });
      
      fetchData();
    } catch (error: any) {
      setQuickAddError(error.message);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.amount || isNaN(Number(editFormData.amount)) || Number(editFormData.amount) <= 0) {
      setEditFormError("Please enter a valid positive amount");
      return;
    }
    if (!editFormData.partyName.trim()) {
      setEditFormError("Party name is required");
      return;
    }

    try {
      const payload = { 
        ...editFormData, 
        partyName: editFormData.partyName.trim(),
        category: editFormData.category.trim(),
        description: editFormData.description.trim(),
        locationId: Number(locationId) 
      };
      
      if (selectedRecord) {
        await apiFetch(`/records/${selectedRecord.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
      setIsEditModalOpen(false);
      fetchData();
    } catch (error: any) {
      setEditFormError(error.message);
    }
  };

  const handleDelete = async (recordId: number) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      await apiFetch(`/records/${recordId}`, { method: "DELETE" });
      fetchData();
    } catch (error) {
      console.error("Failed to delete record");
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/reports/export-location/${locationId}`, {
        headers: {
          'Authorization': `Bearer ${await (await import('../lib/firebase')).auth.currentUser?.getIdToken()}`
        }
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Get filename from header if possible, else fallback
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'Hisab-Kitab-Export.xlsx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to generate export file.');
    }
  };

  const [searchTerm, setSearchTerm] = useState("");
  
  const filteredRecords = records.filter(r => 
    r.partyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.category?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/locations')}
            className="p-2 -ml-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Hisab-Kitab</h1>
            <p className="text-sm text-gray-500 mt-1">Manage income and expenses</p>
          </div>
        </div>
      </header>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-sm font-medium text-gray-500 mb-2">Total Income</div>
          <div className="text-2xl font-bold text-emerald-600">{formatCurrency(metrics.totalIncome)}</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-sm font-medium text-gray-500 mb-2">Total Expense</div>
          <div className="text-2xl font-bold text-rose-600">{formatCurrency(metrics.totalExpense)}</div>
        </div>
        <div className={`bg-white p-6 rounded-xl border border-gray-200 shadow-sm`}>
          <div className="text-sm font-medium text-gray-500 mb-2">Net Balance</div>
          <div className={`text-2xl font-bold ${metrics.netBalance >= 0 ? 'text-gray-900' : 'text-rose-600'}`}>
            {formatCurrency(metrics.netBalance)}
          </div>
        </div>
      </div>

      {/* Quick Add Form */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Add Entry</h2>
        <form onSubmit={handleQuickAdd} className="space-y-4">
          {quickAddError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-lg border border-rose-100">
              {quickAddError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="quickType" className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select
                id="quickType"
                value={newRecordData.type}
                onChange={(e) => setNewRecordData({ ...newRecordData, type: e.target.value as 'INCOME' | 'EXPENSE' })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none bg-gray-50"
              >
                <option value="INCOME">Income (+)</option>
                <option value="EXPENSE">Expense (-)</option>
              </select>
            </div>
            <div>
              <label htmlFor="quickDate" className="block text-xs font-medium text-gray-700 mb-1">Date</label>
              <input
                id="quickDate"
                type="date"
                required
                value={newRecordData.date}
                onChange={(e) => setNewRecordData({ ...newRecordData, date: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>
            <div>
              <label htmlFor="quickAmount" className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
                <input
                  id="quickAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  value={newRecordData.amount}
                  onChange={(e) => setNewRecordData({ ...newRecordData, amount: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>
            </div>
            <div>
              <label htmlFor="quickParty" className="block text-xs font-medium text-gray-700 mb-1">Party Name</label>
              <input
                id="quickParty"
                type="text"
                required
                placeholder="Person or Business"
                value={newRecordData.partyName}
                onChange={(e) => setNewRecordData({ ...newRecordData, partyName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="quickCategory" className="block text-xs font-medium text-gray-700 mb-1">Category (Optional)</label>
              <input
                id="quickCategory"
                type="text"
                placeholder="e.g. Salary, Rent, Materials"
                value={newRecordData.category}
                onChange={(e) => setNewRecordData({ ...newRecordData, category: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="quickDesc" className="block text-xs font-medium text-gray-700 mb-1">Description (Optional)</label>
              <div className="flex gap-2">
                <input
                  id="quickDesc"
                  type="text"
                  placeholder="Additional details..."
                  value={newRecordData.description}
                  onChange={(e) => setNewRecordData({ ...newRecordData, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search party or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none"
            />
          </div>
          <button className="p-2 text-gray-500 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Filter size={18} />
          </button>
        </div>
        <button 
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
        >
          <Download size={16} />
          Export
        </button>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Party Name</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium text-right">Amount</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No records found.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">{record.date}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{record.partyName}</div>
                      {record.description && <div className="text-xs text-gray-500 mt-1">{record.description}</div>}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {record.category || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`font-medium ${record.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {record.type === 'INCOME' ? '+' : '-'}{formatCurrency(Number(record.amount))}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-400">
                      <button 
                        onClick={() => openEditModal(record)}
                        className="p-1 hover:text-indigo-600 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(record.id)}
                        className="p-1 hover:text-rose-600 transition-colors ml-2"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Record"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {editFormError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-lg border border-rose-100">
              {editFormError}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="editRecordType" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                id="editRecordType"
                name="recordType"
                value={editFormData.type}
                onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
              >
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
              </select>
            </div>
            <div>
              <label htmlFor="editRecordDate" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                id="editRecordDate"
                name="recordDate"
                type="date"
                value={editFormData.date}
                onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="editRecordAmount" className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
              <input
                id="editRecordAmount"
                name="recordAmount"
                type="number"
                step="0.01"
                min="0"
                value={editFormData.amount}
                onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="editRecordParty" className="block text-sm font-medium text-gray-700 mb-1">Party Name</label>
            <input
              id="editRecordParty"
              name="recordParty"
              type="text"
              value={editFormData.partyName}
              onChange={(e) => setEditFormData({ ...editFormData, partyName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
              placeholder="Who is this transaction with?"
              required
            />
          </div>

          <div>
            <label htmlFor="editRecordCategory" className="block text-sm font-medium text-gray-700 mb-1">Category (Optional)</label>
            <input
              id="editRecordCategory"
              name="recordCategory"
              type="text"
              value={editFormData.category}
              onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
              placeholder="e.g., Materials, Salary, Sales"
            />
          </div>

          <div>
            <label htmlFor="editRecordDescription" className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
            <textarea
              id="editRecordDescription"
              name="recordDescription"
              value={editFormData.description}
              onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none resize-none"
              placeholder="Additional details..."
              rows={2}
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
