const fs = require('fs');
let s = fs.readFileSync('src/client/pages/LocationDetailsPage.tsx', 'utf8');

// Replace import
s = s.replace(
  'import MasterDataTab from "../components/categories/MasterDataTab";',
  'import LabourAttendanceTab from "../components/categories/LabourAttendanceTab";'
);

// Add CalendarCheck import
if (!s.includes('CalendarCheck')) {
  s = s.replace(
    'ArrowLeft,',
    'ArrowLeft, CalendarCheck,'
  );
}

// Update state type
s = s.replace(
  'useState<"investment" | "expense" | "supervisor">("investment")',
  'useState<"investment" | "expense" | "supervisor" | "attendance">("investment")'
);

// Replace Sidebar category block
const oldCatBlock = `{/* 4th Category: MASTER DATA */}    <div className="flex flex-col gap-1.5 bg-white p-2 rounded-2xl border border-slate-200/60 shadow-sm min-w-[240px] lg:min-w-0">      <button type="button"        id="main-cat-master"        onClick={() => setActiveCategory("master")}        className={\`flex items-center justify-between p-3 rounded-xl transition-all duration-200 text-left \${          activeCategory === "master"            ? "bg-slate-800 text-white shadow-md shadow-slate-900/20"            : "hover:bg-slate-50 text-slate-700"        }\`}      >        <div className="flex items-center gap-3">          <div className={\`p-2 rounded-lg \${activeCategory === "master" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}\`}>            <Database className="w-4 h-4" />          </div>          <div>            <div className="font-bold text-sm">4. Master Data</div>            <div className={\`text-xs \${activeCategory === "master" ? "text-slate-300" : "text-slate-400"}\`}>              Materials & Labour Config            </div>          </div>        </div>      </button>    </div>`;

const newCatBlock = `{/* 4th Category: LABOUR ATTENDANCE */}
          <div className="flex flex-col gap-1.5 bg-white p-2 rounded-2xl border border-slate-200/60 shadow-sm min-w-[240px] lg:min-w-0">
            <button type="button"
              id="main-cat-attendance"
              onClick={() => setActiveCategory("attendance")}
              className={\`flex items-center justify-between p-3 rounded-xl transition-all duration-200 text-left \${
                activeCategory === "attendance"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                  : "hover:bg-slate-50 text-slate-700"
              }\`}
            >
              <div className="flex items-center gap-3">
                <div className={\`p-2 rounded-lg \${activeCategory === "attendance" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}\`}>
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-sm">4. Labour Attendance</div>
                  <div className={\`text-xs \${activeCategory === "attendance" ? "text-amber-100" : "text-slate-400"}\`}>
                    Daily Register & Wages
                  </div>
                </div>
              </div>
              <span className={\`text-xs px-2 py-0.5 rounded-full font-bold \${
                activeCategory === "attendance" ? "bg-amber-700 text-white" : "bg-amber-50 text-amber-700"
              }\`}>
                4th Cat
              </span>
            </button>
          </div>`;

if (s.includes('id="main-cat-master"')) {
  s = s.replace(oldCatBlock, newCatBlock);
}

// Replace content block
s = s.replace(
  '{activeCategory === "master" && (\n      <MasterDataTab locationId={Number(locationId)} />\n    )}',
  `{/* Category 4: Labour Attendance */}
              {activeCategory === "attendance" && (
                <LabourAttendanceTab locationId={Number(locationId)} />
              )}`
);

fs.writeFileSync('src/client/pages/LocationDetailsPage.tsx', s);
console.log('LocationDetailsPage updated successfully!');
