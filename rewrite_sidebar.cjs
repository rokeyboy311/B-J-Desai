const fs = require('fs');

let s = fs.readFileSync('src/client/pages/LocationDetailsPage.tsx', 'utf8');

// We will replace the entire sidebar and state logic.
// First, update the types and state.
s = s.replace(
  /const \[activeCategory, setActiveCategory\] = useState<.*>\(.*?\);/,
  `const [activeCategory, setActiveCategory] = useState<"investors" | "investments" | "material_purchase" | "material_supply" | "site_supply" | "labour_attendance" | "supervisor">("investors");`
);

const beforeReturn = s.substring(0, s.indexOf('return ('));
let afterReturn = s.substring(s.indexOf('return ('));

const newSidebar = `return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-6 pb-20"
    >
      <div className="flex items-center gap-4">
        <button 
          type="button"
          onClick={() => setLocation("/")}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Location Ledger</h1>
          <p className="text-sm text-slate-500 font-medium">Manage investments, supplies, and supervisor costs</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-72 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 hide-scrollbar shrink-0">
          
          <button type="button" onClick={() => setActiveCategory("investors")} className={\`flex items-center gap-3 p-3 rounded-xl transition-all text-left \${activeCategory === "investors" ? "bg-emerald-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}\`}>
            <div className={\`p-2 rounded-lg \${activeCategory === "investors" ? "bg-white/20" : "bg-emerald-100 text-emerald-700"}\`}><Users className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">1. Investor Category</div>
              <div className={\`text-xs \${activeCategory === "investors" ? "text-emerald-100" : "text-slate-400"}\`}>Investors & Upad</div>
            </div>
          </button>

          <button type="button" onClick={() => setActiveCategory("investments")} className={\`flex items-center gap-3 p-3 rounded-xl transition-all text-left \${activeCategory === "investments" ? "bg-blue-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}\`}>
            <div className={\`p-2 rounded-lg \${activeCategory === "investments" ? "bg-white/20" : "bg-blue-100 text-blue-700"}\`}><TrendingUp className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">2. Investment Category</div>
              <div className={\`text-xs \${activeCategory === "investments" ? "text-blue-100" : "text-slate-400"}\`}>From Investors & Bills</div>
            </div>
          </button>

          <button type="button" onClick={() => setActiveCategory("material_purchase")} className={\`flex items-center gap-3 p-3 rounded-xl transition-all text-left \${activeCategory === "material_purchase" ? "bg-rose-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}\`}>
            <div className={\`p-2 rounded-lg \${activeCategory === "material_purchase" ? "bg-white/20" : "bg-rose-100 text-rose-700"}\`}><ShoppingCart className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">3. Material Purchase</div>
              <div className={\`text-xs \${activeCategory === "material_purchase" ? "text-rose-100" : "text-slate-400"}\`}>Purchase & Stock</div>
            </div>
          </button>

          <button type="button" onClick={() => setActiveCategory("material_supply")} className={\`flex items-center gap-3 p-3 rounded-xl transition-all text-left \${activeCategory === "material_supply" ? "bg-orange-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}\`}>
            <div className={\`p-2 rounded-lg \${activeCategory === "material_supply" ? "bg-white/20" : "bg-orange-100 text-orange-700"}\`}><Truck className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">4. Material Supply</div>
              <div className={\`text-xs \${activeCategory === "material_supply" ? "text-orange-100" : "text-slate-400"}\`}>Customer Supply (GST)</div>
            </div>
          </button>

          <button type="button" onClick={() => setActiveCategory("site_supply")} className={\`flex items-center gap-3 p-3 rounded-xl transition-all text-left \${activeCategory === "site_supply" ? "bg-teal-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}\`}>
            <div className={\`p-2 rounded-lg \${activeCategory === "site_supply" ? "bg-white/20" : "bg-teal-100 text-teal-700"}\`}><Wrench className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">5. Site Supply</div>
              <div className={\`text-xs \${activeCategory === "site_supply" ? "text-teal-100" : "text-slate-400"}\`}>Supply to Site Labour</div>
            </div>
          </button>

          <button type="button" onClick={() => setActiveCategory("labour_attendance")} className={\`flex items-center gap-3 p-3 rounded-xl transition-all text-left \${activeCategory === "labour_attendance" ? "bg-amber-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}\`}>
            <div className={\`p-2 rounded-lg \${activeCategory === "labour_attendance" ? "bg-white/20" : "bg-amber-100 text-amber-700"}\`}><CalendarCheck className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">6. Labour Attendance</div>
              <div className={\`text-xs \${activeCategory === "labour_attendance" ? "text-amber-100" : "text-slate-400"}\`}>Day & TC Wise</div>
            </div>
          </button>

          <button type="button" onClick={() => setActiveCategory("supervisor")} className={\`flex items-center gap-3 p-3 rounded-xl transition-all text-left \${activeCategory === "supervisor" ? "bg-indigo-600 text-white shadow-md" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"}\`}>
            <div className={\`p-2 rounded-lg \${activeCategory === "supervisor" ? "bg-white/20" : "bg-indigo-100 text-indigo-700"}\`}><HardHat className="w-4 h-4" /></div>
            <div>
              <div className="font-bold text-sm">7. Supervisor Cost</div>
              <div className={\`text-xs \${activeCategory === "supervisor" ? "text-indigo-100" : "text-slate-400"}\`}>Site Supervisor Expenses</div>
            </div>
          </button>

        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4 sm:p-6 lg:p-8 min-h-[600px] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {activeCategory === "investors" && <InvestorTab locationId={Number(locationId)} />}
              {activeCategory === "investments" && <InvestmentTab locationId={Number(locationId)} />}
              {activeCategory === "material_purchase" && <MaterialPurchaseTab locationId={Number(locationId)} />}
              {activeCategory === "material_supply" && <MaterialSupplyTab locationId={Number(locationId)} />}
              {activeCategory === "site_supply" && <SiteSupplyTab locationId={Number(locationId)} />}
              {activeCategory === "labour_attendance" && <LabourAttendanceTab locationId={Number(locationId)} />}
              {activeCategory === "supervisor" && <SupervisorCostTab locationId={Number(locationId)} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}`;

let finalCode = beforeReturn + newSidebar;

// Add missing imports
const importsToAdd = ["Users", "TrendingUp", "ShoppingCart", "Truck", "Wrench", "CalendarCheck", "HardHat"];
importsToAdd.forEach(imp => {
  if (!finalCode.includes(imp + ",")) {
     finalCode = finalCode.replace("import {", 'import { ' + imp + ',');
  }
});

finalCode = finalCode.replace(
  'import ExpenseTab from "../components/categories/ExpenseTab";',
  'import InvestorTab from "../components/categories/InvestorTab";\nimport MaterialPurchaseTab from "../components/categories/MaterialPurchaseTab";\nimport MaterialSupplyTab from "../components/categories/MaterialSupplyTab";\nimport SiteSupplyTab from "../components/categories/SiteSupplyTab";'
);

// We should remove state variables that are no longer used
finalCode = finalCode.replace(/const \[investmentSubCategory, setInvestmentSubCategory\].*;\n/, "");
finalCode = finalCode.replace(/const \[expenseSubCategory, setExpenseSubCategory\].*;\n/, "");

fs.writeFileSync('src/client/pages/LocationDetailsPage.tsx', finalCode);
console.log('LocationDetailsPage updated with new categories!');
