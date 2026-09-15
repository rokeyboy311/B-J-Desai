const fs = require('fs');
let s = fs.readFileSync('src/client/pages/LocationDetailsPage.tsx', 'utf8');

if (!s.includes('MasterDataTab')) {
  s = s.replace(
    'import SupervisorCostTab from "../components/categories/SupervisorCostTab";',
    'import SupervisorCostTab from "../components/categories/SupervisorCostTab";\nimport MasterDataTab from "../components/categories/MasterDataTab";'
  );
  s = s.replace(
    '{/* 3rd Category: SUPERVISOR COST */}',
    `{/* 4th Category: MASTER DATA */}
    <div className="flex flex-col gap-1.5 bg-white p-2 rounded-2xl border border-slate-200/60 shadow-sm min-w-[240px] lg:min-w-0">
      <button type="button"
        id="main-cat-master"
        onClick={() => setActiveCategory("master")}
        className={\`flex items-center justify-between p-3 rounded-xl transition-all duration-200 text-left \${
          activeCategory === "master"
            ? "bg-slate-800 text-white shadow-md shadow-slate-900/20"
            : "hover:bg-slate-50 text-slate-700"
        }\`}
      >
        <div className="flex items-center gap-3">
          <div className={\`p-2 rounded-lg \${activeCategory === "master" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}\`}>
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-sm">4. Master Data</div>
            <div className={\`text-xs \${activeCategory === "master" ? "text-slate-300" : "text-slate-400"}\`}>
              Materials & Labour Config
            </div>
          </div>
        </div>
      </button>
    </div>

    {/* 3rd Category: SUPERVISOR COST */}`
  );
  
  s = s.replace(
    'import { ArrowLeft, MapPin, Loader2, TrendingUp, TrendingDown, HardHat, Wallet, Wrench, Truck, CreditCard, Clock, CheckCircle2, ChevronRight, FileText } from "lucide-react";',
    'import { ArrowLeft, MapPin, Loader2, TrendingUp, TrendingDown, HardHat, Wallet, Wrench, Truck, CreditCard, Clock, CheckCircle2, ChevronRight, FileText, Database } from "lucide-react";'
  );
  
  s = s.replace(
    '</motion.div>\n          </AnimatePresence>',
    `  {activeCategory === "master" && (
      <MasterDataTab locationId={Number(id)} />
    )}
  </motion.div>\n          </AnimatePresence>`
  );
  fs.writeFileSync('src/client/pages/LocationDetailsPage.tsx', s);
  console.log('Fixed LocationDetailsPage');
}
