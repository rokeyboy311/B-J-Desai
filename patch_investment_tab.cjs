const fs = require('fs');
let code = fs.readFileSync('investment_tab_content.txt', 'utf8');

code = code.replace(
  'const [activeSubTab, setActiveSubTab] = useState<"investors" | "bills">("investors");',
  'const [activeSubTab, setActiveSubTab] = useState<"investors" | "bills" | "combined">("combined");'
);

code = code.replace(
  /<div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-max mb-6">[\s\S]*?<\/div>/,
  `<div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-max mb-6">
        <button onClick={() => setActiveSubTab("combined")} className={\`px-4 py-2 rounded-md text-sm font-bold transition-all \${activeSubTab === "combined" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}\`}>
          Combined Records
        </button>
        <button onClick={() => setActiveSubTab("investors")} className={\`px-4 py-2 rounded-md text-sm font-bold transition-all \${activeSubTab === "investors" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}\`}>
          From Investors
        </button>
        <button onClick={() => setActiveSubTab("bills")} className={\`px-4 py-2 rounded-md text-sm font-bold transition-all \${activeSubTab === "bills" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}\`}>
          From Bills
        </button>
      </div>`
);

// We need to insert the 'combined' view.
const combinedView = `
      {activeSubTab === "combined" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex flex-col justify-center">
              <span className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">Investor Investment</span>
              <span className="text-3xl font-black text-blue-700">₹{investorTxs.reduce((s, tx) => s + Number(tx.amount), 0).toLocaleString()}</span>
            </div>
            <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100 flex flex-col justify-center">
              <span className="text-xs text-emerald-600 font-bold uppercase tracking-wider mb-1">Bill Investment</span>
              <span className="text-3xl font-black text-emerald-700">₹{billIncomes.reduce((s, b) => s + Number(b.amount), 0).toLocaleString()}</span>
            </div>
            <div className="bg-indigo-600 p-6 rounded-xl border border-indigo-700 flex flex-col justify-center text-white shadow-md">
              <span className="text-xs text-indigo-200 font-bold uppercase tracking-wider mb-1">Total Investment</span>
              <span className="text-3xl font-black">₹{(investorTxs.reduce((s, tx) => s + Number(tx.amount), 0) + billIncomes.reduce((s, b) => s + Number(b.amount), 0)).toLocaleString()}</span>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900">Combined Transaction Records</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Source / Details</th>
                    <th className="p-3 text-right">Amount (₹)</th>
                    <th className="p-3">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...investorTxs.map(tx => ({...tx, source: 'Investor: ' + tx.partyName})), ...billIncomes.map(b => ({...b, source: 'Bill: ' + (b.description || 'Bill Income')}))]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-600">{item.date}</td>
                      <td className="p-3 font-semibold text-slate-800">{item.source}</td>
                      <td className="p-3 text-right font-bold text-slate-900">₹{Number(item.amount).toLocaleString()}</td>
                      <td className="p-3">
                        <span className={\`text-[10px] px-2 py-0.5 rounded font-bold \${item.partyName ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}\`}>
                          {item.partyName ? 'INVESTOR' : 'BILL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(investorTxs.length === 0 && billIncomes.length === 0) && <tr><td colSpan={4} className="p-8 text-center text-slate-500">No investments recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
`;

code = code.replace(
  /\{activeSubTab === "investors" && \(/,
  combinedView + '\n      {activeSubTab === "investors" && ('
);

fs.writeFileSync('src/client/components/categories/InvestmentTab.tsx', code);
