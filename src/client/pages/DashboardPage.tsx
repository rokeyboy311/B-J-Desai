import React, { useState, useEffect } from "react";
import { LayoutDashboard, ArrowUpRight, ArrowDownRight, IndianRupee } from "lucide-react";
import { apiFetch } from "../lib/api";

interface DashboardMetrics {
  totalLocations: number;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await apiFetch("/reports/dashboard");
        setMetrics(data);
      } catch (error) {
        console.error("Failed to load dashboard metrics");
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  if (loading || !metrics) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back. Here is your global summary across all locations.</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 text-indigo-600 mb-4">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <LayoutDashboard size={20} />
            </div>
            <h3 className="font-semibold text-gray-900">Locations</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{metrics.totalLocations}</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 text-emerald-600 mb-4">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <ArrowUpRight size={20} />
            </div>
            <h3 className="font-semibold text-gray-900">Total Income</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(metrics.totalIncome)}</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 text-rose-600 mb-4">
            <div className="p-2 bg-rose-50 rounded-lg">
              <ArrowDownRight size={20} />
            </div>
            <h3 className="font-semibold text-gray-900">Total Expense</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(metrics.totalExpense)}</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 text-gray-600 mb-4">
            <div className="p-2 bg-gray-100 rounded-lg">
              <IndianRupee size={20} />
            </div>
            <h3 className="font-semibold text-gray-900">Net Balance</h3>
          </div>
          <p className={`text-3xl font-bold ${metrics.netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatCurrency(metrics.netBalance)}
          </p>
        </div>
      </div>
    </div>
  );
}
