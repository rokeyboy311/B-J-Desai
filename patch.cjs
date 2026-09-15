const fs = require('fs');
const file = 'src/server/routes/report.routes.ts';
let code = fs.readFileSync(file, 'utf8');

const target = `    // 9. Connected Expenses (Part 2 - all expenses connected to Part 1 investment)
    const netCapitalPool = Math.round((totalInvestment - totalInvestmentUpad) * 100) / 100;
    const materialPurchaseExpense = totalMaterialPurchase;
    const siteSupplyExpense = totalMaterialLabourSupply;
    const labourSalaryExpense = Math.round((labourMetrics.totalPayment + labourMetrics.totalUpad) * 100) / 100;
    const generalExpense = actualExpense;
    const totalExpensesCut = Math.round((materialPurchaseExpense + siteSupplyExpense + labourSalaryExpense + generalExpense) * 100) / 100;
    const remainingCapital = Math.round((netCapitalPool - totalExpensesCut) * 100) / 100;

    const utilizationRate = netCapitalPool > 0 
      ? Math.min(100, Math.round((totalExpensesCut / netCapitalPool) * 100)) 
      : (totalExpensesCut > 0 ? 100 : 0);

    const connectedExpenses = {
      totalInvested: totalInvestment,
      totalUpad: totalInvestmentUpad,
      netCapitalPool,
      materialPurchaseExpense,
      siteSupplyExpense,
      labourSalaryExpense,
      generalExpense,
      totalExpensesCut,
      remainingCapital,
      utilizationRate
    };`;

const replacement = `    // 9. Connected Expenses (Part 1 and Part 2 Combined)
    const netCapitalPool = Math.round((totalInvestment - totalInvestmentUpad + totalIncome) * 100) / 100;
    const materialPurchaseExpense = totalMaterialPurchase;
    const siteSupplyExpense = totalMaterialLabourSupply;
    const labourSalaryExpense = Math.round((labourMetrics.totalPayment + labourMetrics.totalUpad) * 100) / 100;
    const generalExpense = actualExpense;
    const totalExpensesCut = Math.round((materialPurchaseExpense + siteSupplyExpense + labourSalaryExpense + generalExpense) * 100) / 100;
    const remainingCapital = Math.round((netCapitalPool - totalExpensesCut) * 100) / 100;

    const utilizationRate = netCapitalPool > 0 
      ? Math.min(100, Math.round((totalExpensesCut / netCapitalPool) * 100)) 
      : (totalExpensesCut > 0 ? 100 : 0);

    const connectedExpenses = {
      totalInvested: totalInvestment,
      totalIncome: totalIncome,
      totalUpad: totalInvestmentUpad,
      netCapitalPool,
      materialPurchaseExpense,
      siteSupplyExpense,
      labourSalaryExpense,
      generalExpense,
      totalExpensesCut,
      remainingCapital,
      utilizationRate
    };`;

code = code.replace(target, replacement);
fs.writeFileSync(file, code);
