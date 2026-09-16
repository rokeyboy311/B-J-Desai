const fs = require('fs');
let code = fs.readFileSync('src/client/components/categories/InvestmentTab.tsx', 'utf8');

code = code.replace(
  'setBillIncomes((recordsRes || []).filter((r: any) => r.type === "INCOME"));',
  'setBillIncomes((recordsRes || []).filter((r: any) => r.type === "INCOME" && r.category === "BILL_INVESTMENT"));'
);

fs.writeFileSync('src/client/components/categories/InvestmentTab.tsx', code);
