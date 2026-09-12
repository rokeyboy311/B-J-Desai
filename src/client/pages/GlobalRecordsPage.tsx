import React, { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { Receipt, Search, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface GlobalRecord {
  id: number;
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  date: string;
  partyName: string;
  category: string | null;
  description: string | null;
  locationId: number;
  locationName: string | null;
}

export default function GlobalRecordsPage() {
  const [records, setRecords] = useState<GlobalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const data = await apiFetch("/records/all");
        setRecords(data);
      } catch (error) {
        console.error("Failed to load records");
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  const filteredRecords = records.filter(r => 
    r.partyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.category?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.locationName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">All Records</h1>
        <p className="text-sm text-gray-500 mt-1">View the complete ledger across all your locations.</p>
      </header>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200">
        <div className="relative flex-1 sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search party, category, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Party Name</th>
                <th className="px-6 py-4 font-medium">Location</th>
                <th className="px-6 py-4 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <Receipt className="mx-auto mb-3 text-gray-400" size={32} />
                    <p>No records found across any location.</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr 
                    key={record.id} 
                    onClick={() => navigate(`/locations/${record.locationId}`)}
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">{record.date}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{record.partyName}</div>
                      {record.category && <div className="text-xs text-gray-500 mt-1">{record.category}</div>}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {record.locationName || 'Unknown Location'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`font-medium ${record.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {record.type === 'INCOME' ? '+' : '-'}{formatCurrency(Number(record.amount))}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
