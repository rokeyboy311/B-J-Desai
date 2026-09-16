const fs = require('fs');
let code = fs.readFileSync('src/server/routes/report.routes.ts', 'utf8');

code = code.replace(
  /const totalExpensesCut = Math.round\(\(materialPurchaseExpense \+ siteSupplyExpense \+ labourSalaryExpense \+ generalExpense\) \* 100\) \/ 100;/,
  'const totalExpensesCut = Math.round((materialPurchaseExpense + labourSalaryExpense + generalExpense) * 100) / 100;'
);

fs.writeFileSync('src/server/routes/report.routes.ts', code);
