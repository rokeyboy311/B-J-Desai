const fs = require('fs');
let code = fs.readFileSync('src/server/routes/report.routes.ts', 'utf8');

code = code.replace(
  'totalIncome, actualExpense,',
  'totalIncome, totalBillInvestment, actualExpense,'
);

code = code.replace(
  /const netCapitalPool = Math\.round\(\(totalInvestment \- totalInvestmentUpad\) \* 100\) \/ 100;/,
  `const netCapitalPool = Math.round((totalInvestment - totalInvestmentUpad + totalBillInvestment) * 100) / 100;`
);

code = code.replace(
  /totalInvested: totalInvestment,/,
  'totalInvested: totalInvestment,'
);

fs.writeFileSync('src/server/routes/report.routes.ts', code);
