import express, { Response } from 'express';
import { db } from '../../db/index.js';
import { 
  locations, records, investmentParties, investmentTransactions,
  materialPurchases, materialSupplies, materialLabourSupplies,
  labourSalaries, invoices, payments, items
} from '../../db/schema.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { generateExcelBuffer } from '../lib/excel.js';

const reportRouter = express.Router();
reportRouter.use(requireAuth);

reportRouter.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const locationIdParam = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
    
    // Base location condition
    const locCondition = locationIdParam 
      ? sql`${locations.id} = ${locationIdParam}`
      : sql`1=1`;

    const locIds = await db.select({ id: locations.id }).from(locations)
      .where(and(eq(locations.userId, userId), eq(locations.isDeleted, 0), locCondition));
    const validLocIds = locIds.map(l => l.id);
    
    const idList = validLocIds.length > 0 ? validLocIds.join(',') : '0';

    // 1. Direct Income & Site Expenses
    const ieQuery = await db.execute(sql`
      SELECT category, type, SUM(amount) as amt, SUM(refundable_amount) as ref_amt, SUM(refunded_amount) as refd_amt
      FROM records
      WHERE user_id = ${userId} AND is_deleted = 0 
        ${validLocIds.length > 0 ? sql`AND location_id IN (${sql.raw(idList)})` : sql``}
      GROUP BY category, type
    `);
    
    let totalIncome = 0, actualExpense = 0, totalRefundable = 0, totalRefunded = 0;
    for (const r of ieQuery.rows) {
      const type = (r.type as string) || (r.category as string);
      const amt = parseFloat(r.amt as string || '0');
      if (type === 'INCOME') totalIncome += amt;
      if (type === 'EXPENSE') {
        actualExpense += amt;
        totalRefundable += parseFloat(r.ref_amt as string || '0');
        totalRefunded += parseFloat(r.refd_amt as string || '0');
      }
    }
    const pendingRefundable = Math.max(0, totalRefundable - totalRefunded);

    // 2. GST Invoices (Sales / Billing)
    const invQuery = await db.execute(sql`
      SELECT 
        SUM(total_amount) as tot, 
        SUM(paid_amount) as pd, 
        SUM(balance_amount) as bal,
        SUM(taxable_amount) as taxable,
        SUM(cgst) as cgst,
        SUM(sgst) as sgst,
        SUM(igst) as igst,
        SUM(total_tax) as tax
      FROM invoices
      WHERE user_id = ${userId} AND is_deleted = 0
        ${locationIdParam ? sql`AND location_id = ${locationIdParam}` : sql``}
    `);
    const invoiceMetrics = {
      totalAmount: parseFloat(invQuery.rows[0]?.tot as string || '0'),
      paidAmount: parseFloat(invQuery.rows[0]?.pd as string || '0'),
      balanceAmount: parseFloat(invQuery.rows[0]?.bal as string || '0'),
      taxableAmount: parseFloat(invQuery.rows[0]?.taxable as string || '0'),
      cgst: parseFloat(invQuery.rows[0]?.cgst as string || '0'),
      sgst: parseFloat(invQuery.rows[0]?.sgst as string || '0'),
      igst: parseFloat(invQuery.rows[0]?.igst as string || '0'),
      totalTax: parseFloat(invQuery.rows[0]?.tax as string || '0'),
    };

    // 3. Investment (1st Category)
    const invTxQuery = await db.execute(sql`
      SELECT t.type, SUM(t.amount) as amt
      FROM investment_transactions t
      JOIN investment_parties p ON t.party_id = p.id
      WHERE t.user_id = ${userId} AND t.is_deleted = 0 
        ${validLocIds.length > 0 ? sql`AND p.location_id IN (${sql.raw(idList)})` : sql``}
      GROUP BY t.type
    `);
    let totalInvestment = 0, totalInvestmentPayment = 0, totalInvestmentUpad = 0;
    for (const r of invTxQuery.rows) {
      const a = parseFloat(r.amt as string || '0');
      if (r.type === 'INVESTMENT') totalInvestment += a;
      if (r.type === 'PAYMENT') totalInvestmentPayment += a;
      if (r.type === 'UPAD') totalInvestmentUpad += a;
    }
    const investmentBalance = totalInvestment - totalInvestmentPayment - totalInvestmentUpad;

    // 4. Material Purchases (Procurement Bills)
    const mpQuery = await db.execute(sql`
      SELECT SUM(total_amount) as tot, SUM(paid_amount) as pd, SUM(outstanding_amount) as out, SUM(tax) as tax
      FROM material_purchases
      WHERE user_id = ${userId} AND is_deleted = 0 
        ${validLocIds.length > 0 ? sql`AND location_id IN (${sql.raw(idList)})` : sql``}
    `);
    const totalMaterialPurchase = parseFloat(mpQuery.rows[0]?.tot as string || '0');
    const totalMaterialPurchasePaid = parseFloat(mpQuery.rows[0]?.pd as string || '0');
    const totalMaterialPurchaseOutstanding = parseFloat(mpQuery.rows[0]?.out as string || '0');
    const totalMaterialPurchaseTax = parseFloat(mpQuery.rows[0]?.tax as string || '0');

    // 5. Material Supplies (Goods Dispatches / Sales)
    const msQuery = await db.execute(sql`
      SELECT SUM(total_amount) as tot, SUM(paid_amount) as pd, SUM(outstanding_amount) as out, SUM(tax) as tax
      FROM material_supplies
      WHERE user_id = ${userId} AND is_deleted = 0 
        ${validLocIds.length > 0 ? sql`AND location_id IN (${sql.raw(idList)})` : sql``}
    `);
    const totalMaterialSupply = parseFloat(msQuery.rows[0]?.tot as string || '0');
    const totalMaterialSupplyPaid = parseFloat(msQuery.rows[0]?.pd as string || '0');
    const totalMaterialSupplyOutstanding = parseFloat(msQuery.rows[0]?.out as string || '0');
    const totalMaterialSupplyTax = parseFloat(msQuery.rows[0]?.tax as string || '0');

    // 6. Site / Contract Supplies
    const mlsQuery = await db.execute(sql`
      SELECT SUM(total_amount) as tot, SUM(paid_amount) as pd, SUM(outstanding_amount) as out, SUM(tax) as tax
      FROM material_labour_supplies
      WHERE user_id = ${userId} AND is_deleted = 0 
        ${validLocIds.length > 0 ? sql`AND location_id IN (${sql.raw(idList)})` : sql``}
    `);
    const totalMaterialLabourSupply = parseFloat(mlsQuery.rows[0]?.tot as string || '0');
    const totalMaterialLabourSupplyPaid = parseFloat(mlsQuery.rows[0]?.pd as string || '0');
    const totalMaterialLabourSupplyOutstanding = parseFloat(mlsQuery.rows[0]?.out as string || '0');
    const totalMaterialLabourSupplyTax = parseFloat(mlsQuery.rows[0]?.tax as string || '0');

    // 7. Labour Salaries
    const lsQuery = await db.execute(sql`
      SELECT SUM(net_salary) as net, SUM(upad) as upad, SUM(payment_amount) as pd, SUM(balance) as bal
      FROM labour_salaries
      WHERE user_id = ${userId} AND is_deleted = 0 
        ${validLocIds.length > 0 ? sql`AND location_id IN (${sql.raw(idList)})` : sql``}
    `);
    const labourMetrics = {
      totalNetSalary: parseFloat(lsQuery.rows[0]?.net as string || '0'),
      totalUpad: parseFloat(lsQuery.rows[0]?.upad as string || '0'),
      totalPayment: parseFloat(lsQuery.rows[0]?.pd as string || '0'),
      totalBalance: parseFloat(lsQuery.rows[0]?.bal as string || '0')
    };

    // 8. Stock Valuation
    const itemQuery = await db.execute(sql`
      SELECT SUM(current_stock * purchase_price) as stock_val, count(*) as item_count
      FROM items
      WHERE user_id = ${userId} AND is_deleted = 0
    `);
    const stockValuation = parseFloat(itemQuery.rows[0]?.stock_val as string || '0');
    const totalItemsCount = parseInt(itemQuery.rows[0]?.item_count as string || '0', 10);

    // Clean Accounting Calculations - NO DOUBLE COUNTING
    // Total Revenue / Turnover = GST Invoices + Material Supplies + Direct Income
    const totalRevenue = invoiceMetrics.totalAmount + totalMaterialSupply + totalIncome;
    
    // Purchases = Material Purchases
    const totalPurchases = totalMaterialPurchase;
    
    // Operating & Direct Costs = Labour Salaries + Site Expenses + Material Labour Supply
    const totalOperatingCosts = labourMetrics.totalNetSalary + actualExpense + totalMaterialLabourSupply;
    
    // Profit Margins
    const grossProfit = totalRevenue - totalPurchases;
    const netProfit = grossProfit - totalOperatingCosts;

    // Receivables (Sundry Debtors - What others owe us)
    const totalReceivables = invoiceMetrics.balanceAmount + totalMaterialSupplyOutstanding + pendingRefundable;

    // Payables (Sundry Creditors - What we owe suppliers, contractors & labour)
    const totalPayables = totalMaterialPurchaseOutstanding + totalMaterialLabourSupplyOutstanding + labourMetrics.totalBalance;

    // GST Breakdown
    const outputGst = invoiceMetrics.totalTax + totalMaterialSupplyTax;
    const inputGst = totalMaterialPurchaseTax + totalMaterialLabourSupplyTax;
    const netGstPayable = Math.max(0, outputGst - inputGst);
    const itcCreditBalance = Math.max(0, inputGst - outputGst);

    res.json({
      // Core ERP Executive Metrics
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalPurchases: Math.round(totalPurchases * 100) / 100,
      totalOperatingCosts: Math.round(totalOperatingCosts * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      totalReceivables: Math.round(totalReceivables * 100) / 100,
      totalPayables: Math.round(totalPayables * 100) / 100,

      // GST Summary
      gst: {
        outputGst: Math.round(outputGst * 100) / 100,
        inputGst: Math.round(inputGst * 100) / 100,
        netGstPayable: Math.round(netGstPayable * 100) / 100,
        itcCreditBalance: Math.round(itcCreditBalance * 100) / 100,
        invoiceCgst: invoiceMetrics.cgst,
        invoiceSgst: invoiceMetrics.sgst,
        invoiceIgst: invoiceMetrics.igst,
      },

      // Inventory
      stockValuation: Math.round(stockValuation * 100) / 100,
      totalItemsCount,

      // Invoices
      invoiceMetrics,

      // Direct Income & Expenses
      totalIncome, 
      actualExpense, 
      totalRefundable, 
      totalRefunded, 
      pendingRefundable, 
      netIncome: totalIncome - actualExpense,

      // Investments
      totalInvestment, 
      totalInvestmentPayment, 
      totalInvestmentUpad, 
      investmentBalance,

      // Material Purchase
      totalMaterialPurchase, 
      totalMaterialPurchasePaid, 
      totalMaterialPurchaseOutstanding,

      // Material Supply
      totalMaterialSupply, 
      totalMaterialSupplyPaid, 
      totalMaterialSupplyOutstanding,

      // Material Labour Supply
      totalMaterialLabourSupply, 
      totalMaterialLabourSupplyPaid, 
      totalMaterialLabourSupplyOutstanding,

      // Labour
      labourMetrics,
    });
  } catch (error) {
    console.error('Failed to fetch dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

// GET /api/reports/analytics - Monthly trends & Category distributions
reportRouter.get('/analytics', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;

    // Monthly breakdown of Sales (Invoices + Supplies) and Costs (Purchases + Expenses)
    const monthlyQuery = await db.execute(sql`
      WITH sales AS (
        SELECT substring(invoice_date from 1 for 7) as m, SUM(total_amount) as rev
        FROM invoices WHERE user_id = ${userId} AND is_deleted = 0
        GROUP BY m
        UNION ALL
        SELECT substring(date from 1 for 7) as m, SUM(total_amount) as rev
        FROM material_supplies WHERE user_id = ${userId} AND is_deleted = 0
        GROUP BY m
      ),
      costs AS (
        SELECT substring(date from 1 for 7) as m, SUM(total_amount) as cost
        FROM material_purchases WHERE user_id = ${userId} AND is_deleted = 0
        GROUP BY m
        UNION ALL
        SELECT substring(date from 1 for 7) as m, SUM(amount) as cost
        FROM records WHERE user_id = ${userId} AND is_deleted = 0 AND type = 'EXPENSE'
        GROUP BY m
      )
      SELECT 
        COALESCE(s.m, c.m) as month,
        COALESCE(SUM(s.rev), 0) as revenue,
        COALESCE(SUM(c.cost), 0) as expense
      FROM sales s
      FULL OUTER JOIN costs c ON s.m = c.m
      WHERE COALESCE(s.m, c.m) IS NOT NULL
      GROUP BY month
      ORDER BY month ASC
      LIMIT 12
    `);

    // Category distribution
    const categoriesQuery = await db.execute(sql`
      SELECT category, SUM(amount) as total
      FROM records
      WHERE user_id = ${userId} AND is_deleted = 0 AND type = 'EXPENSE'
      GROUP BY category
      ORDER BY total DESC
    `);

    res.json({
      monthly: monthlyQuery.rows.map(r => ({
        month: r.month,
        revenue: parseFloat(r.revenue as string || '0'),
        expense: parseFloat(r.expense as string || '0'),
        profit: parseFloat(r.revenue as string || '0') - parseFloat(r.expense as string || '0'),
      })),
      categories: categoriesQuery.rows.map(r => ({
        category: r.category || 'General',
        total: parseFloat(r.total as string || '0')
      }))
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/reports/gst-returns - Detailed GSTR-1 and GSTR-3B Tax Summary
reportRouter.get('/gst-returns', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const { startDate, endDate } = req.query;

    const invoiceList = await db.select().from(invoices).where(
      and(
        eq(invoices.userId, userId),
        eq(invoices.isDeleted, 0),
        startDate ? sql`${invoices.invoiceDate} >= ${String(startDate)}` : sql`1=1`,
        endDate ? sql`${invoices.invoiceDate} <= ${String(endDate)}` : sql`1=1`
      )
    );

    const purchaseList = await db.select().from(materialPurchases).where(
      and(
        eq(materialPurchases.userId, userId),
        eq(materialPurchases.isDeleted, 0),
        startDate ? sql`${materialPurchases.date} >= ${String(startDate)}` : sql`1=1`,
        endDate ? sql`${materialPurchases.date} <= ${String(endDate)}` : sql`1=1`
      )
    );

    let gstr1Taxable = 0, gstr1Cgst = 0, gstr1Sgst = 0, gstr1Igst = 0, gstr1TotalTax = 0, gstr1TotalValue = 0;
    invoiceList.forEach(inv => {
      gstr1Taxable += parseFloat(inv.taxableAmount || '0');
      gstr1Cgst += parseFloat(inv.cgst || '0');
      gstr1Sgst += parseFloat(inv.sgst || '0');
      gstr1Igst += parseFloat(inv.igst || '0');
      gstr1TotalTax += parseFloat(inv.totalTax || '0');
      gstr1TotalValue += parseFloat(inv.totalAmount || '0');
    });

    let itcTaxable = 0, itcTotalTax = 0;
    purchaseList.forEach(pur => {
      itcTaxable += parseFloat(pur.subtotal || '0') - parseFloat(pur.discount || '0');
      itcTotalTax += parseFloat(pur.tax || '0');
    });

    res.json({
      gstr1: {
        totalInvoices: invoiceList.length,
        taxableValue: Math.round(gstr1Taxable * 100) / 100,
        cgst: Math.round(gstr1Cgst * 100) / 100,
        sgst: Math.round(gstr1Sgst * 100) / 100,
        igst: Math.round(gstr1Igst * 100) / 100,
        totalTax: Math.round(gstr1TotalTax * 100) / 100,
        totalValue: Math.round(gstr1TotalValue * 100) / 100,
      },
      gstr3b: {
        outwardTaxable: Math.round(gstr1Taxable * 100) / 100,
        outwardTax: Math.round(gstr1TotalTax * 100) / 100,
        eligibleItc: Math.round(itcTotalTax * 100) / 100,
        netTaxPayable: Math.max(0, Math.round((gstr1TotalTax - itcTotalTax) * 100) / 100),
        closingItcBalance: Math.max(0, Math.round((itcTotalTax - gstr1TotalTax) * 100) / 100),
      },
      invoices: invoiceList,
      purchases: purchaseList
    });
  } catch (error) {
    console.error('GST return report error:', error);
    res.status(500).json({ error: 'Failed to fetch GST return report' });
  }
});

// Excel Export
reportRouter.get('/export/excel', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const locationIdParam = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
    if (!locationIdParam) return res.status(400).json({ error: 'Location ID required' });

    const [location] = await db.select().from(locations).where(
      and(eq(locations.id, locationIdParam), eq(locations.userId, userId), eq(locations.isDeleted, 0))
    );
    if (!location) return res.status(404).json({ error: 'Location not found' });

    const [purchases, supplies, labourSupplies, salaries, directRecords, invParties, invoicesList, paymentsList] = await Promise.all([
      db.select().from(materialPurchases).where(and(eq(materialPurchases.locationId, locationIdParam), eq(materialPurchases.userId, userId), eq(materialPurchases.isDeleted, 0))),
      db.select().from(materialSupplies).where(and(eq(materialSupplies.locationId, locationIdParam), eq(materialSupplies.userId, userId), eq(materialSupplies.isDeleted, 0))),
      db.select().from(materialLabourSupplies).where(and(eq(materialLabourSupplies.locationId, locationIdParam), eq(materialLabourSupplies.userId, userId), eq(materialLabourSupplies.isDeleted, 0))),
      db.select().from(labourSalaries).where(and(eq(labourSalaries.locationId, locationIdParam), eq(labourSalaries.userId, userId), eq(labourSalaries.isDeleted, 0))),
      db.select().from(records).where(and(eq(records.locationId, locationIdParam), eq(records.userId, userId), eq(records.isDeleted, 0))),
      db.select().from(investmentParties).where(and(eq(investmentParties.locationId, locationIdParam), eq(investmentParties.userId, userId), eq(investmentParties.isDeleted, 0))),
      db.select().from(invoices).where(and(eq(invoices.locationId, locationIdParam), eq(invoices.userId, userId), eq(invoices.isDeleted, 0))),
      db.select().from(payments).where(and(eq(payments.locationId, locationIdParam), eq(payments.userId, userId), eq(payments.isDeleted, 0))),
    ]);

    const buffer = await generateExcelBuffer(location.name, {
      incomeExpense: directRecords,
      investments: invParties,
      purchases,
      supplies,
      labourSupplies,
      salaries,
      invoices: invoicesList,
      payments: paymentsList,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(location.name)}_Report.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Excel Export Error:', error);
    res.status(500).json({ error: 'Failed to generate Excel report' });
  }
});

// GET /api/reports/export-all - Export all records across all or selected locations
reportRouter.get('/export-all', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const locationIdParam = req.query.locationId && req.query.locationId !== 'all' ? parseInt(req.query.locationId as string) : undefined;
    const locFilter = locationIdParam ? eq(locations.id, locationIdParam) : sql`1=1`;

    let reportTitle = 'All Locations Consolidated';
    if (locationIdParam) {
      const [loc] = await db.select().from(locations).where(and(eq(locations.id, locationIdParam), eq(locations.userId, userId)));
      if (loc) reportTitle = loc.name;
    }

    const [purchases, supplies, labourSupplies, salaries, directRecords, invParties, invoicesList, paymentsList] = await Promise.all([
      db.select().from(materialPurchases).where(and(eq(materialPurchases.userId, userId), eq(materialPurchases.isDeleted, 0), locationIdParam ? eq(materialPurchases.locationId, locationIdParam) : sql`1=1`)),
      db.select().from(materialSupplies).where(and(eq(materialSupplies.userId, userId), eq(materialSupplies.isDeleted, 0), locationIdParam ? eq(materialSupplies.locationId, locationIdParam) : sql`1=1`)),
      db.select().from(materialLabourSupplies).where(and(eq(materialLabourSupplies.userId, userId), eq(materialLabourSupplies.isDeleted, 0), locationIdParam ? eq(materialLabourSupplies.locationId, locationIdParam) : sql`1=1`)),
      db.select().from(labourSalaries).where(and(eq(labourSalaries.userId, userId), eq(labourSalaries.isDeleted, 0), locationIdParam ? eq(labourSalaries.locationId, locationIdParam) : sql`1=1`)),
      db.select().from(records).where(and(eq(records.userId, userId), eq(records.isDeleted, 0), locationIdParam ? eq(records.locationId, locationIdParam) : sql`1=1`)),
      db.select().from(investmentParties).where(and(eq(investmentParties.userId, userId), eq(investmentParties.isDeleted, 0), locationIdParam ? eq(investmentParties.locationId, locationIdParam) : sql`1=1`)),
      db.select().from(invoices).where(and(eq(invoices.userId, userId), eq(invoices.isDeleted, 0), locationIdParam ? eq(invoices.locationId, locationIdParam) : sql`1=1`)),
      db.select().from(payments).where(and(eq(payments.userId, userId), eq(payments.isDeleted, 0), locationIdParam ? eq(payments.locationId, locationIdParam) : sql`1=1`)),
    ]);

    const buffer = await generateExcelBuffer(reportTitle, {
      incomeExpense: directRecords,
      investments: invParties,
      purchases,
      supplies,
      labourSupplies,
      salaries,
      invoices: invoicesList,
      payments: paymentsList,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(reportTitle)}_Consolidated_Report.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Export all error:', error);
    res.status(500).json({ error: 'Failed to export records' });
  }
});

export default reportRouter;
