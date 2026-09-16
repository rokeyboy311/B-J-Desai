const fs = require('fs');
let code = fs.readFileSync('src/server/routes/investment.routes.ts', 'utf8');

if (!code.includes("'CONTRIBUTION'")) {
  code = code.replace(
    "['INVESTMENT', 'UPAD', 'PAYMENT']",
    "['INVESTMENT', 'UPAD', 'PAYMENT', 'CONTRIBUTION']"
  );
  
  // Also we should fix the metrics calculation
  code = code.replace(
    /let totalInvestment = 0;\s*let totalPayment = 0;\s*let totalUpad = 0;/,
    `let totalInvestment = 0;
      let totalPayment = 0;
      let totalUpad = 0;
      let totalContribution = 0;`
  );
  
  code = code.replace(
    /if \(m\.type === 'INVESTMENT'\) totalInvestment = parseFloat\(m\.total\);/g,
    `if (m.type === 'INVESTMENT') totalInvestment = parseFloat(m.total);
        if (m.type === 'CONTRIBUTION') totalContribution = parseFloat(m.total);`
  );

  code = code.replace(
    /return \{ \.\.\.p, totalInvestment, totalPayment, totalUpad \};/g,
    `return { ...p, totalInvestment, totalPayment, totalUpad, totalContribution, balance: totalContribution - totalUpad };`
  );

  fs.writeFileSync('src/server/routes/investment.routes.ts', code);
  console.log("Patched investment.routes.ts");
}
