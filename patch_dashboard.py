import re

def update():
    filepath = "src/client/pages/DashboardPage.tsx"
    with open(filepath, "r") as f:
        content = f.read()

    import_calc = "import { Calculator } from 'lucide-react';"
    if "Calculator" not in content:
        content = content.replace('import { \n  LayoutDashboard', 'import { \n  LayoutDashboard, Calculator, UserCheck, Users, Calendar,')
    
    # Add state for search
    state_code = """
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

"""
    
    content = content.replace("const [editingStockValue, setEditingStockValue] = useState<string>(\"\");\n", "const [editingStockValue, setEditingStockValue] = useState<string>(\"\");\n" + state_code)

    ui_code = """
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
"""
    content = content.replace("{/* Material Stock Analytics */}", ui_code)

    with open(filepath, "w") as f:
        f.write(content)

update()
