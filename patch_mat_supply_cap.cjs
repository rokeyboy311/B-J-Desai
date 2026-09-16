const fs = require('fs');
let code = fs.readFileSync('src/server/routes/report.routes.ts', 'utf8');

code = code.replace(
  'const netCapitalPool = Math.round((totalInvestment - totalInvestmentUpad) * 100) / 100;',
  'const netCapitalPool = Math.round((totalInvestment - totalInvestmentUpad + totalMaterialSupplyPaid) * 100) / 100;'
);

fs.writeFileSync('src/server/routes/report.routes.ts', code);
