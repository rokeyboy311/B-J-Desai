import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, Calculator, UserCheck, Users, Calendar, ArrowUpRight, ArrowDownRight, IndianRupee, 
  Search, HardHat, Factory, Landmark, Truck, Wrench, Wallet, TrendingDown, Box
} from "lucide-react";
import { PurchaseIcon } from "../components/icons/PurchaseIcon";
import { apiFetch } from "../lib/api";
import { useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [editingStockValue, setEditingStockValue] = useState<string>("");

  const [labourAttSearch, setLabourAttSearch] = useState("");
  
  const parsedLabourAtt = React.useMemo(() => {
    if (!metrics?.rawLabourAtt) return [];
    
    const grouped: Record<string, Record<string, Record<string, { days: number, tcs: number }>>> = {};
    
    metrics.rawLabourAtt.forEach((r: any) => {
      const month = r.month || "Unknown";
      const team = r.team || "No Team";
      const name = r.name || "Unknown";
      const isTC = r.attendanceType === "TC" || r.attendanceType === "TC-wise";
      const amount = Number(r.days || 0);
      
      if (!grouped[month]) grouped[month] = {};
      if (!grouped[month][team]) grouped[month][team] = {};
      if (!grouped[month][team][name]) grouped[month][team][name] = { days: 0, tcs: 0 };
      
      if (isTC) {
        grouped[month][team][name].tcs += amount;
      } else {
        grouped[month][team][name].days += amount;
      }
    });

    const result: any[] = [];
    Object.keys(grouped).sort((a, b) => b.localeCompare(a)).forEach(month => {
       const monthData = grouped[month];
       Object.keys(monthData).sort().forEach(team => {
         const teamData = monthData[team];
         Object.keys(teamData).sort().forEach(name => {
           result.push({
             month,
             team,
             name,
             days: teamData[name].days,
             tcs: teamData[name].tcs
           });
         });
       });
    });
    return result;
  }, [metrics]);

  const filteredLabourAtt = React.useMemo(() => {
    if (!labourAttSearch.trim()) return parsedLabourAtt;
    const q = labourAttSearch.toLowerCase();
    return parsedLabourAtt.filter(r => 
      r.month.toLowerCase().includes(q) || 
      r.team.toLowerCase().includes(q) || 
      r.name.toLowerCase().includes(q)
    );
  }, [parsedLabourAtt, labourAttSearch]);


  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const res = await apiFetch("/reports/dashboard");
      setMetrics(res);
    } catch (error) {
      console.error("Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustStock = async (materialName: string, currentStock: number) => {
    const newVal = parseFloat(editingStockValue);
    if (isNaN(newVal)) return;

    const adjustment = newVal - currentStock;
    if (adjustment === 0) {
      setEditingStock(null);
      return;
    }

    try {
      await apiFetch("/reports/adjust-stock", {
        method: "POST",
        body: JSON.stringify({ materialName, adjustment })
      });
      setEditingStock(null);
      fetchMetrics();
    } catch (error) {
      console.error("Failed to adjust stock");
    }
  };

  const filteredMaterialStock = metrics?.materialStock?.filter((stock: any) => 
    stock.originalName.toLowerCase().includes(stockSearchQuery.toLowerCase())
  ) || [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/records?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  if (loading) return <div className="flex justify-center items-center h-full">Loading...</div>;

  const totalExpenseSum = 
    (metrics?.totalMaterialPurchase || 0) +
    (metrics?.totalMaterialSupply || 0) +
    (metrics?.totalMaterialLabourSupply || 0) +
    (metrics?.labourMetrics?.totalPayment || 0) +
    (metrics?.totalExpense || 0);

  const netInvestmentBalance = (metrics?.totalInvestment || 0) - (metrics?.totalInvestmentUpad || 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-blue-600" />
            Dashboard
          </h1>
          
        </div>
        <form onSubmit={handleSearch} className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search across all records..." 
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>

      {/* Top Level Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Locations</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">{metrics?.totalLocations || 0}</h3>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Factory className="w-5 h-5" /></div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Net Investment Balance</p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">₹{netInvestmentBalance.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Landmark className="w-5 h-5" /></div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Expenses Logged</p>
            <h3 className="text-2xl font-bold text-rose-600 mt-1">₹{totalExpenseSum.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><TrendingDown className="w-5 h-5" /></div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Net Business Profit</p>
            <h3 className={`text-2xl font-bold mt-1 ${metrics?.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
              ₹{metrics?.netIncome?.toLocaleString() || 0}
            </h3>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><IndianRupee className="w-5 h-5" /></div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
             
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-emerald-600" /> Investment & Upad
            </h2>
          </div>
          
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100">
            <div className="text-xs font-medium text-emerald-800 uppercase tracking-wider">1. Total Investment</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">₹{metrics?.totalInvestment?.toLocaleString() || 0}</div>
            <p className="text-xs text-emerald-600/80 mt-0.5">Capital introduced by investors</p>
          </div>

          <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-100">
            <div className="text-xs font-medium text-amber-800 uppercase tracking-wider">2. Total Upad (Drawings)</div>
            <div className="text-2xl font-bold text-amber-700 mt-1">₹{metrics?.totalInvestmentUpad?.toLocaleString() || 0}</div>
            <p className="text-xs text-amber-600/80 mt-0.5">Withdrawals by partners</p>
          </div>

          <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100">
            <div className="text-xs font-medium text-blue-800 uppercase tracking-wider">Net Investor Balance</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">₹{netInvestmentBalance.toLocaleString()}</div>
            <p className="text-xs text-blue-600/80 mt-0.5">Investment minus Upad</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-rose-100 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
             
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-rose-600" /> Expense (Materials, Labour & Supplies)
            </h2>
          </div>
          
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mb-1">
              <PurchaseIcon className="w-3.5 h-3.5 text-blue-600" />
              1. Material Purchase
            </div>
            <div className="font-bold text-gray-900 text-lg">₹{metrics?.totalMaterialPurchase?.toLocaleString() || 0}</div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mb-1">
              <Truck className="w-3.5 h-3.5 text-emerald-600" />
              2. Material Supply
            </div>
            <div className="font-bold text-gray-900 text-lg">₹{metrics?.totalMaterialSupply?.toLocaleString() || 0}</div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mb-1">
              <Wrench className="w-3.5 h-3.5 text-indigo-600" />
              3. Site Supply
            </div>
            <div className="font-bold text-gray-900 text-lg">₹{metrics?.totalMaterialLabourSupply?.toLocaleString() || 0}</div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mb-1">
              <HardHat className="w-3.5 h-3.5 text-amber-600" />
              4. Labour Salary
            </div>
            <div className="font-bold text-gray-900 text-lg">₹{(metrics?.labourMetrics?.totalPayment || 0).toLocaleString()}</div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mb-1">
              <Wallet className="w-3.5 h-3.5 text-purple-600" />
              5. Site Expenses
            </div>
            <div className="font-bold text-gray-900 text-lg">₹{(metrics?.totalExpense || 0).toLocaleString()}</div>
          </div>
        </div>

        {/* Labour Salary Detail Breakdown */}
        <div className="mt-3 pt-3 border-t">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Labour Wage & Upad Details</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50/70 p-3 rounded-lg">
              <div className="text-xs text-gray-500">Gross Salaries Earned</div>
              <div className="font-semibold text-gray-900">₹{metrics?.labourMetrics?.totalNetSalary?.toLocaleString() || 0}</div>
            </div>
            <div className="bg-gray-50/70 p-3 rounded-lg">
              <div className="text-xs text-gray-500">Labour Upad (Advance)</div>
              <div className="font-semibold text-orange-600">₹{metrics?.labourMetrics?.totalUpad?.toLocaleString() || 0}</div>
            </div>
            <div className="bg-gray-50/70 p-3 rounded-lg">
              <div className="text-xs text-gray-500">Actual Wages Paid</div>
              <div className="font-semibold text-green-600">₹{metrics?.labourMetrics?.totalPayment?.toLocaleString() || 0}</div>
            </div>
            <div className="bg-gray-50/70 p-3 rounded-lg">
              <div className="text-xs text-gray-500">Pending Labour Balance</div>
              <div className="font-semibold text-red-600">₹{metrics?.labourMetrics?.totalBalance?.toLocaleString() || 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
             
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <HardHat className="w-5 h-5 text-indigo-600" /> Site Supervisor Cost
            </h2>
          </div>
          <div className="bg-indigo-50 px-4 py-2 rounded-xl flex flex-col items-end">
          </div>
        </div>
      </div>

      
      {/* Labour Attendance Analytics (Month-wise) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-600" /> Labour Attendance Analytics
            </h2>
            <p className="text-sm text-gray-500 mt-1">Month-wise total days and TCs per labour</p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search month, team, name..."
              value={labourAttSearch}
              onChange={e => setLabourAttSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 w-full sm:w-64 bg-gray-50"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">Month</th>
                <th className="px-4 py-3 font-medium text-gray-600">Team</th>
                <th className="px-4 py-3 font-medium text-gray-600">Labour Name</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Total Days</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Total TCs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLabourAtt.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    No attendance records found.
                  </td>
                </tr>
              ) : filteredLabourAtt.map((row: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-gray-400"/> {row.month}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <div className="flex items-center gap-1.5"><Users className="w-4 h-4 text-blue-400"/> {row.team}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                     <div className="flex items-center gap-1.5"><UserCheck className="w-4 h-4 text-emerald-400"/> {row.name}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-bold">
                      {row.days} Days
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold">
                      {row.tcs} TCs
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Material Stock Analytics */}

      {metrics?.materialStock && metrics.materialStock.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Box className="w-5 h-5 text-blue-600" /> Material Stock Inventory
              </h2>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search materials..."
                value={stockSearchQuery}
                onChange={e => setStockSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-600">Material Name</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Total Purchased</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Total Supplied/Used</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Current Stock</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMaterialStock.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
                      No materials found matching your search.
                    </td>
                  </tr>
                ) : filteredMaterialStock.map((stock: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 uppercase">
                      {stock.originalName}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                      +{stock.purchased} {stock.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-rose-600 font-medium">
                      -{stock.supplied} {stock.unit}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingStock === stock.originalName ? (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            value={editingStockValue}
                            onChange={(e) => setEditingStockValue(e.target.value)}
                            className="w-24 px-2 py-1 text-sm border rounded"
                            autoFocus
                          />
                          <span className="text-gray-500 text-xs">{stock.unit}</span>
                        </div>
                      ) : (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          stock.currentStock > 0 ? 'bg-blue-50 text-blue-700' :
                          stock.currentStock < 0 ? 'bg-red-50 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {stock.currentStock} {stock.unit}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editingStock === stock.originalName ? (
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => handleAdjustStock(stock.originalName, stock.currentStock)}
                            className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => setEditingStock(null)}
                            className="text-xs font-medium text-gray-600 hover:text-gray-900 px-2 py-1"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => {
                            setEditingStock(stock.originalName);
                            setEditingStockValue(stock.currentStock.toString());
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
