const fs = require('fs');
let code = fs.readFileSync('src/client/pages/DashboardPage.tsx', 'utf8');

const newSection = `
      {/* Capital & Expenses Utilization (Added) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-indigo-50 rounded-2xl border border-indigo-100 shadow-sm p-6 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-indigo-800 font-bold mb-4 uppercase tracking-wider text-xs">Capital Utilization (Net)</h3>
            <div className="flex items-end gap-2 mb-2">
              <p className="text-4xl font-black text-indigo-900">₹{getMetric(metrics?.connectedExpenses?.remainingCapital)}</p>
              <p className="text-sm font-medium text-indigo-600 mb-1">Remaining</p>
            </div>
            
            <div className="w-full bg-indigo-200 rounded-full h-2 mb-6">
              <div className="bg-indigo-600 h-2 rounded-full" style={{ width: \`\${Math.min(100, Math.max(0, metrics?.connectedExpenses?.utilizationRate || 0))}%\` }}></div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm border-b border-indigo-200/50 pb-2">
                <span className="text-indigo-800 font-medium">Net Capital Pool (Investment - Upad)</span>
                <span className="font-bold text-indigo-900">₹{getMetric(metrics?.connectedExpenses?.netCapitalPool)}</span>
              </div>
              <div className="flex justify-between items-center text-sm pb-2">
                <span className="text-indigo-800 font-medium">Total Deducted Expenses</span>
                <span className="font-bold text-rose-600">- ₹{getMetric(metrics?.connectedExpenses?.totalExpensesCut)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-slate-500 font-bold mb-4 uppercase tracking-wider text-xs">Expense Breakdown</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">1. Material Purchase (Asset)</span>
                <span className="font-bold text-slate-900">₹{getMetric(metrics?.connectedExpenses?.materialPurchaseExpense)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">2. Labour Salaries (Cost)</span>
                <span className="font-bold text-slate-900">₹{getMetric(metrics?.connectedExpenses?.labourSalaryExpense)}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-4">
                <span className="text-slate-600">3. General Expenses (Cost)</span>
                <span className="font-bold text-slate-900">₹{getMetric(metrics?.connectedExpenses?.generalExpense)}</span>
              </div>
              <div className="flex justify-between items-center text-sm pt-2">
                <span className="text-slate-900 font-bold">Total Expenses Cut</span>
                <span className="font-black text-rose-600">₹{getMetric(metrics?.connectedExpenses?.totalExpensesCut)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
`;

code = code.replace(
  '</div>\n      <h2 className="text-lg font-bold text-slate-800 mt-8 mb-4 flex items-center gap-2">\n        <PieChart className="w-5 h-5 text-indigo-500" /> Department Wise Operations\n      </h2>',
  '</div>\n' + newSection + '\n      <h2 className="text-lg font-bold text-slate-800 mt-8 mb-4 flex items-center gap-2">\n        <PieChart className="w-5 h-5 text-indigo-500" /> Department Wise Operations\n      </h2>'
);

fs.writeFileSync('src/client/pages/DashboardPage.tsx', code);
