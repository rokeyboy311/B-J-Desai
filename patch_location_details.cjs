const fs = require('fs');
let code = fs.readFileSync('src/client/pages/LocationDetailsPage.tsx', 'utf8');

// Add import
code = code.replace(
  'import LabourAttendanceTab from "../components/categories/LabourAttendanceTab";',
  'import LabourAttendanceTab from "../components/categories/LabourAttendanceTab";\nimport LabourSalaryTab from "../components/categories/LabourSalaryTab";'
);

// Update type
code = code.replace(
  'const [activeCategory, setActiveCategory] = useState<"investors" | "investments" | "material_purchase" | "material_supply" | "site_supply" | "labour_attendance" | "supervisor">("investors");',
  'const [activeCategory, setActiveCategory] = useState<"investors" | "investments" | "material_purchase" | "material_supply" | "site_supply" | "labour_attendance" | "labour_records" | "supervisor">("investors");'
);

// Add button
const newButton = `
          <button type="button" onClick={() => setActiveCategory("labour_records")} className={\`flex items-center gap-3 p-3 rounded-xl transition-all text-left \${activeCategory === "labour_records" ? "bg-cyan-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}\`}>
            <div className={\`p-2 rounded-lg \${activeCategory === "labour_records" ? "bg-white/20" : "bg-cyan-100 text-cyan-700"}\`}><Wallet className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">7. Labour Records</div>
              <div className={\`text-xs \${activeCategory === "labour_records" ? "text-cyan-100" : "text-slate-400"}\`}>Salary & Payments</div>
            </div>
          </button>
`;

code = code.replace(
  /<button type="button" onClick=\{\(\) => setActiveCategory\("supervisor"\)\}/,
  newButton + '          <button type="button" onClick={() => setActiveCategory("supervisor")}'
);

// Fix numbers in names
code = code.replace('<div className="font-bold text-sm">7. Supervisor Cost</div>', '<div className="font-bold text-sm">8. Supervisor Cost</div>');

// Add rendering logic
code = code.replace(
  '{activeCategory === "labour_attendance" && <LabourAttendanceTab locationId={Number(locationId)} />}',
  '{activeCategory === "labour_attendance" && <LabourAttendanceTab locationId={Number(locationId)} />}\n              {activeCategory === "labour_records" && <LabourSalaryTab locationId={Number(locationId)} />}'
);

fs.writeFileSync('src/client/pages/LocationDetailsPage.tsx', code);
