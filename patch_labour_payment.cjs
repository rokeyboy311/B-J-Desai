const fs = require('fs');
let code = fs.readFileSync('src/client/components/categories/LabourSalaryTab.tsx', 'utf8');

// Update typeCategory options
code = code.replace(
  '<option value="Day">Day</option>\n                    <option value="TC">TC</option>',
  '<option value="Day">Day</option>\n                    <option value="TC">TC</option>\n                    <option value="Payment">Payment</option>'
);

// Update auto-reset for Payment
code = code.replace(
  /if \(value === "Day"\) \{\n        newAtt\[index\]\.attendanceType = "Full-day";\n      \} else \{\n        newAtt\[index\]\.attendanceType = "TC";\n      \}/,
  `if (value === "Day") {
        newAtt[index].attendanceType = "Full-day";
      } else if (value === "TC") {
        newAtt[index].attendanceType = "TC";
      } else {
        newAtt[index].attendanceType = "Payment";
        newAtt[index].tcQuantity = "0";
        newAtt[index].dailyRate = "0";
        newAtt[index].upad = "0";
      }`
);

// Update conditional rendering for Payment type
code = code.replace(
  /\{att\.typeCategory === "Day" \? \(/,
  `{att.typeCategory === "Day" ? (`
);

code = code.replace(
  /\} \: \(\n                  <div className="w-\[100px\]">\n                    <label className="block text-\[10px\] uppercase text-slate-500 font-semibold mb-1">No. of TCs<\/label>/,
  `} : att.typeCategory === "TC" ? (
                  <div className="w-[100px]">
                    <label className="block text-[10px] uppercase text-slate-500 font-semibold mb-1">No. of TCs</label>`
);

code = code.replace(
  /className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500 border-emerald-200 bg-emerald-50"\n                      required\n                    \/>\n                  <\/div>\n                \)}/,
  `className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500 border-emerald-200 bg-emerald-50"
                      required
                    />
                  </div>
                ) : (
                  <div className="w-[100px] flex items-center justify-center bg-green-50 rounded-lg border border-green-200 text-xs font-bold text-green-700">
                    Payment Only
                  </div>
                )}`
);

// Hide Rate and Upad for Payment
code = code.replace(
  /<div className="w-\[100px\]">\n                  <label className="block text-\[10px\] uppercase text-slate-500 font-semibold mb-1">Rate<\/label>/,
  `{att.typeCategory !== "Payment" && <div className="w-[100px]">
                  <label className="block text-[10px] uppercase text-slate-500 font-semibold mb-1">Rate</label>`
);

code = code.replace(
  /className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"\n                    required\n                  \/>\n                <\/div>/,
  `className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>}`
);

code = code.replace(
  /<div className="w-\[100px\]">\n                  <label className="block text-\[10px\] uppercase text-amber-600 font-semibold mb-1">Upad<\/label>/,
  `{att.typeCategory !== "Payment" && <div className="w-[100px]">
                  <label className="block text-[10px] uppercase text-amber-600 font-semibold mb-1">Upad</label>`
);

code = code.replace(
  /className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500 border-amber-200 bg-amber-50"\n                  \/>\n                <\/div>/,
  `className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500 border-amber-200 bg-amber-50"
                  />
                </div>}`
);


fs.writeFileSync('src/client/components/categories/LabourSalaryTab.tsx', code);
