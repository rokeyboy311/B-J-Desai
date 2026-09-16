const fs = require('fs');
let code = fs.readFileSync('src/client/components/categories/InvestmentTab.tsx', 'utf8');

code = code.replace(
  'type: "INCOME",\n          amount: parseFloat(billData.amount),\n          date: billData.date,\n          description: billData.description || "Bill Income"',
  'type: "INCOME",\n          amount: parseFloat(billData.amount),\n          date: billData.date,\n          partyName: "Bill Payment",\n          category: "BILL_INVESTMENT",\n          description: billData.description || "Bill Income"'
);

fs.writeFileSync('src/client/components/categories/InvestmentTab.tsx', code);
