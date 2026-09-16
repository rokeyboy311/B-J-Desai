const fs = require('fs');
let code = fs.readFileSync('src/client/components/categories/LabourSalaryTab.tsx', 'utf8');

code = code.replace(
  /\} \: \(\n                  <div className="w-\[100px\]">\n                    <label className="block text-\[10px\] uppercase text-slate-500 font-semibold mb-1">No. of TCs<\/label>/,
  `} : att.typeCategory === "TC" ? (
                  <div className="w-[100px]">
                    <label className="block text-[10px] uppercase text-slate-500 font-semibold mb-1">No. of TCs</label>`
);

code = code.replace(
  /<\/select>\n                  <\/div>\n                \) : \(\n                  <div className="w-\[100px\]">\n                    <label className="block text-\[10px\] uppercase text-slate-500 font-semibold mb-1">No\. of TCs<\/label>/,
  `</select>
                  </div>
                ) : att.typeCategory === "TC" ? (
                  <div className="w-[100px]">
                    <label className="block text-[10px] uppercase text-slate-500 font-semibold mb-1">No. of TCs</label>`
);

fs.writeFileSync('src/client/components/categories/LabourSalaryTab.tsx', code);
