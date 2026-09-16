const fs = require('fs');
let code = fs.readFileSync('src/client/pages/DashboardPage.tsx', 'utf8');

code = code.replace(
  /const invFromInvestors = metrics\?\.connectedExpenses\?\.totalInvested \|\| 0;\n\s*const invFromBills = metrics\?\.connectedExpenses\?\.totalIncome \|\| metrics\?\.totalIncome \|\| 0;\n\s*const invUpad = metrics\?\.connectedExpenses\?\.totalUpad \|\| 0;\n\s*const totalInvestment = invFromInvestors \+ invFromBills;/,
  `const totalInvestment = metrics?.totalInvestment || 0;
  const invFromBills = metrics?.totalBillInvestment || 0;
  const invFromInvestors = totalInvestment - invFromBills;
  const invUpad = metrics?.totalInvestmentUpad || 0;`
);

fs.writeFileSync('src/client/pages/DashboardPage.tsx', code);
