const fs = require('fs');
let code = fs.readFileSync('src/server/routes/report.routes.ts', 'utf8');

// For total investment, we need to extract bill investment from records query.
// The records query is:
// SELECT type, SUM(amount) as amt, SUM(refundable_amount) as ref_amt, SUM(refunded_amount) as refd_amt
// FROM records
// We can add category to the group by, or just use SUM(CASE WHEN category = 'BILL_INVESTMENT' THEN amount ELSE 0 END).
// Wait, the query is:
/*
    const ieQuery = await db.execute(sql`
      SELECT type, SUM(amount) as amt, SUM(refundable_amount) as ref_amt, SUM(refunded_amount) as refd_amt
      FROM records
      WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY type
    `);
*/

// Let's replace the query completely.
code = code.replace(
  /const ieQuery = await db\.execute\(sql\`[\s\S]*?GROUP BY type[\s\S]*?\`\);/,
  `const ieQuery = await db.execute(sql\`
      SELECT 
        type, 
        category,
        SUM(amount) as amt, 
        SUM(refundable_amount) as ref_amt, 
        SUM(refunded_amount) as refd_amt
      FROM records
      WHERE user_id = \${userId} AND is_deleted = 0 AND location_id IN (\${sql.raw(idList)})
      GROUP BY type, category
    \`);`
);

// Update loop logic:
// let totalIncome = 0, actualExpense = 0, totalRefundable = 0, totalRefunded = 0;
// let totalBillInvestment = 0;
code = code.replace(
  /let totalIncome = 0, actualExpense = 0, totalRefundable = 0, totalRefunded = 0;/,
  'let totalIncome = 0, actualExpense = 0, totalRefundable = 0, totalRefunded = 0, totalBillInvestment = 0;'
);

code = code.replace(
  /for \(const r of ieQuery\.rows\) \{[\s\S]*?if \(r\.type === 'INCOME'\) totalIncome \+= parseFloat\(r\.amt as string \|\| '0'\);[\s\S]*?if \(r\.type === 'EXPENSE'\) \{[\s\S]*?\}[\s\S]*?\}/,
  `for (const r of ieQuery.rows) {
      const amt = parseFloat(r.amt as string || '0');
      if (r.type === 'INCOME') {
        totalIncome += amt;
        if (r.category === 'BILL_INVESTMENT') {
          totalBillInvestment += amt;
        }
      }
      if (r.type === 'EXPENSE') {
        actualExpense += amt;
        totalRefundable += parseFloat(r.ref_amt as string || '0');
        totalRefunded += parseFloat(r.refd_amt as string || '0');
      }
    }`
);

// We need to add totalBillInvestment to totalInvestment where investmentBalance is defined
code = code.replace(
  'const investmentBalance = totalInvestment - totalInvestmentPayment - totalInvestmentUpad;',
  'const investmentBalance = totalInvestment - totalInvestmentPayment - totalInvestmentUpad;\n    totalInvestment += totalBillInvestment;'
);

fs.writeFileSync('src/server/routes/report.routes.ts', code);
