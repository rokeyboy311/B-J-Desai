import express, { Response } from 'express';
import { db } from '../../db/index.js';
import { 
  locations, records, investmentParties, investmentTransactions,
  materialPurchases, materialSupplies, materialLabourSupplies,
  labourSalaries, invoices, invoiceItems, payments, items,
  creditDebitNotes, refunds, parties, stockMovements, openingBalances, auditLogs
} from '../../db/schema.js';
import { eq, and, sql, desc, or } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { generateExcelBuffer } from '../lib/excel.js';
import { AccountingEngine, DecimalMath } from '../../shared/accountingEngine.js';

const reportRouter = express.Router();
reportRouter.use(requireAuth);

// Helper to assemble location & business filter
function buildScopeFilters(userId: number, businessId?: number, locationId?: number) {
  const conditions = [
    eq(records.userId, userId),
    eq(records.isDeleted, 0),
    eq(records.isVoid, 0),
  ];
  if (businessId) {
    conditions.push(or(eq(records.businessId, businessId), sql`${records.businessId} IS NULL`)!);
  }
  if (locationId && !isNaN(locationId)) {
    conditions.push(eq(records.locationId, locationId));
  }
  return conditions;
}

// GET /api/reports/dashboard
reportRouter.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const businessId = req.query.businessId ? parseInt(String(req.query.businessId), 10) : req.businessId;
    const locationId = req.query.locationId ? parseInt(String(req.query.locationId), 10) : undefined;

    // 1. Direct Income & Site Expenses
    const recList = await db.select().from(records).where(
      and(
        eq(records.userId, userId),
        eq(records.isDeleted, 0),
        eq(records.isVoid, 0),
        businessId ? or(eq(records.businessId, businessId), sql`${records.businessId} IS NULL`) : sql`1=1`,
        locationId ? eq(records.locationId, locationId) : sql`1=1`
      )
    );

    let totalDirectIncome = 0;
    let actualDirectExpense = 0;
    let totalRefundable = 0;
    let totalRefunded = 0;

    for (const r of recList) {
      const amt = parseFloat(r.amount || '0');
      if (r.type === 'INCOME') {
        totalDirectIncome = DecimalMath.add(totalDirectIncome, amt);
      } else if (r.type === 'EXPENSE') {
        const refAmt = parseFloat(r.refundableAmount || '0');
        const refd = parseFloat(r.refundedAmount || '0');
        totalRefundable = DecimalMath.add(totalRefundable, refAmt);
        totalRefunded = DecimalMath.add(totalRefunded, refd);
        // Deduct unrefunded refundable deposits from active operational expense
        const netExp = DecimalMath.sub(amt, refAmt);
        actualDirectExpense = DecimalMath.add(actualDirectExpense, DecimalMath.max(0, netExp));
      }
    }
    const pendingRefundable = DecimalMath.max(0, DecimalMath.sub(totalRefundable, totalRefunded));

    // 2. GST Invoices (Sales / Billing)
    const invList = await db.select().from(invoices).where(
      and(
        eq(invoices.userId, userId),
        eq(invoices.isDeleted, 0),
        eq(invoices.isVoid, 0),
        businessId ? or(eq(invoices.businessId, businessId), sql`${invoices.businessId} IS NULL`) : sql`1=1`,
        locationId ? eq(invoices.locationId, locationId) : sql`1=1`
      )
    );

    let invoiceTotal = 0;
    let invoicePaid = 0;
    let invoiceBalance = 0;
    let invoiceTaxable = 0;
    let invoiceCgst = 0;
    let invoiceSgst = 0;
    let invoiceIgst = 0;
    let invoiceTotalTax = 0;

    for (const inv of invList) {
      invoiceTotal = DecimalMath.add(invoiceTotal, parseFloat(inv.totalAmount || '0'));
      invoicePaid = DecimalMath.add(invoicePaid, parseFloat(inv.paidAmount || '0'));
      invoiceBalance = DecimalMath.add(invoiceBalance, parseFloat(inv.balanceAmount || '0'));
      invoiceTaxable = DecimalMath.add(invoiceTaxable, parseFloat(inv.taxableAmount || '0'));
      invoiceCgst = DecimalMath.add(invoiceCgst, parseFloat(inv.cgst || '0'));
      invoiceSgst = DecimalMath.add(invoiceSgst, parseFloat(inv.sgst || '0'));
      invoiceIgst = DecimalMath.add(invoiceIgst, parseFloat(inv.igst || '0'));
      invoiceTotalTax = DecimalMath.add(invoiceTotalTax, parseFloat(inv.totalTax || '0'));
    }

    // 3. Material Purchases (Procurement Bills)
    const purList = await db.select().from(materialPurchases).where(
      and(
        eq(materialPurchases.userId, userId),
        eq(materialPurchases.isDeleted, 0),
        eq(materialPurchases.isVoid, 0),
        businessId ? or(eq(materialPurchases.businessId, businessId), sql`${materialPurchases.businessId} IS NULL`) : sql`1=1`,
        locationId ? eq(materialPurchases.locationId, locationId) : sql`1=1`
      )
    );

    let totalMaterialPurchase = 0;
    let totalMaterialPurchasePaid = 0;
    let totalMaterialPurchaseOutstanding = 0;
    let totalMaterialPurchaseTax = 0;

    for (const p of purList) {
      totalMaterialPurchase = DecimalMath.add(totalMaterialPurchase, parseFloat(p.totalAmount || '0'));
      totalMaterialPurchasePaid = DecimalMath.add(totalMaterialPurchasePaid, parseFloat(p.paidAmount || '0'));
      totalMaterialPurchaseOutstanding = DecimalMath.add(totalMaterialPurchaseOutstanding, parseFloat(p.outstandingAmount || '0'));
      totalMaterialPurchaseTax = DecimalMath.add(totalMaterialPurchaseTax, parseFloat(p.tax || '0'));
    }

    // 4. Material Supplies (Goods Dispatches)
    const supList = await db.select().from(materialSupplies).where(
      and(
        eq(materialSupplies.userId, userId),
        eq(materialSupplies.isDeleted, 0),
        eq(materialSupplies.isVoid, 0),
        businessId ? or(eq(materialSupplies.businessId, businessId), sql`${materialSupplies.businessId} IS NULL`) : sql`1=1`,
        locationId ? eq(materialSupplies.locationId, locationId) : sql`1=1`
      )
    );

    let totalMaterialSupply = 0;
    let totalMaterialSupplyPaid = 0;
    let totalMaterialSupplyOutstanding = 0;
    let totalMaterialSupplyTax = 0;

    for (const s of supList) {
      totalMaterialSupply = DecimalMath.add(totalMaterialSupply, parseFloat(s.totalAmount || '0'));
      totalMaterialSupplyPaid = DecimalMath.add(totalMaterialSupplyPaid, parseFloat(s.paidAmount || '0'));
      totalMaterialSupplyOutstanding = DecimalMath.add(totalMaterialSupplyOutstanding, parseFloat(s.outstandingAmount || '0'));
      totalMaterialSupplyTax = DecimalMath.add(totalMaterialSupplyTax, parseFloat(s.tax || '0'));
    }

    // 5. Site & Contract Supplies
    const mlsList = await db.select().from(materialLabourSupplies).where(
      and(
        eq(materialLabourSupplies.userId, userId),
        eq(materialLabourSupplies.isDeleted, 0),
        eq(materialLabourSupplies.isVoid, 0),
        businessId ? or(eq(materialLabourSupplies.businessId, businessId), sql`${materialLabourSupplies.businessId} IS NULL`) : sql`1=1`,
        locationId ? eq(materialLabourSupplies.locationId, locationId) : sql`1=1`
      )
    );

    let totalMaterialLabourSupply = 0;
    let totalMaterialLabourSupplyPaid = 0;
    let totalMaterialLabourSupplyOutstanding = 0;
    let totalMaterialLabourSupplyTax = 0;

    for (const mls of mlsList) {
      totalMaterialLabourSupply = DecimalMath.add(totalMaterialLabourSupply, parseFloat(mls.totalAmount || '0'));
      totalMaterialLabourSupplyPaid = DecimalMath.add(totalMaterialLabourSupplyPaid, parseFloat(mls.paidAmount || '0'));
      totalMaterialLabourSupplyOutstanding = DecimalMath.add(totalMaterialLabourSupplyOutstanding, parseFloat(mls.outstandingAmount || '0'));
      totalMaterialLabourSupplyTax = DecimalMath.add(totalMaterialLabourSupplyTax, parseFloat(mls.tax || '0'));
    }

    // 6. Labour Salaries
    const lsList = await db.select().from(labourSalaries).where(
      and(
        eq(labourSalaries.userId, userId),
        eq(labourSalaries.isDeleted, 0),
        eq(labourSalaries.isVoid, 0),
        businessId ? or(eq(labourSalaries.businessId, businessId), sql`${labourSalaries.businessId} IS NULL`) : sql`1=1`,
        locationId ? eq(labourSalaries.locationId, locationId) : sql`1=1`
      )
    );

    let totalLabourGross = 0;
    let totalLabourNet = 0;
    let totalLabourUpad = 0;
    let totalLabourPayment = 0;
    let totalLabourBalance = 0;

    for (const ls of lsList) {
      totalLabourGross = DecimalMath.add(totalLabourGross, parseFloat(ls.grossSalary || '0'));
      totalLabourNet = DecimalMath.add(totalLabourNet, parseFloat(ls.netSalary || '0'));
      totalLabourUpad = DecimalMath.add(totalLabourUpad, parseFloat(ls.upad || '0'));
      totalLabourPayment = DecimalMath.add(totalLabourPayment, parseFloat(ls.paymentAmount || '0'));
      totalLabourBalance = DecimalMath.add(totalLabourBalance, parseFloat(ls.balance || '0'));
    }

    // 7. Inventory Valuation
    const itemList = await db.select().from(items).where(
      and(
        eq(items.userId, userId),
        eq(items.isDeleted, 0),
        businessId ? or(eq(items.businessId, businessId), sql`${items.businessId} IS NULL`) : sql`1=1`
      )
    );

    let stockValuation = 0;
    for (const it of itemList) {
      const q = parseFloat(it.currentStock || '0');
      const p = parseFloat(it.purchasePrice || '0');
      stockValuation = DecimalMath.add(stockValuation, DecimalMath.mul(q, p));
    }

    // 8. Core ERP Unified Calculations (No Double Counting)
    // Revenue = GST Invoices + Material Supplies + Direct Income
    const totalRevenue = DecimalMath.add(invoiceTotal, totalMaterialSupply, totalDirectIncome);

    // Direct Purchases = Material Purchases
    const totalPurchases = totalMaterialPurchase;

    // Operating Costs = Labour Salaries Net + Direct Operating Expenses + Material Labour Supply Cost
    const totalOperatingCosts = DecimalMath.add(totalLabourNet, actualDirectExpense, totalMaterialLabourSupply);

    // COGS = Purchases (Simplified perpetual model)
    const cogs = totalPurchases;

    // Gross Profit = Revenue - COGS
    const grossProfit = DecimalMath.sub(totalRevenue, cogs);

    // Net Profit = Gross Profit - Operating Costs
    const netProfit = DecimalMath.sub(grossProfit, totalOperatingCosts);

    // Receivables (Debtors) = Invoices Balance + Supplies Balance + Pending Refundables
    const totalReceivables = DecimalMath.add(invoiceBalance, totalMaterialSupplyOutstanding, pendingRefundable);

    // Payables (Creditors) = Purchases Outstanding + MLS Outstanding + Labour Balance Due
    const totalPayables = DecimalMath.add(totalMaterialPurchaseOutstanding, totalMaterialLabourSupplyOutstanding, totalLabourBalance);

    // GST Netting
    const outputGst = DecimalMath.add(invoiceTotalTax, totalMaterialSupplyTax);
    const inputGst = DecimalMath.add(totalMaterialPurchaseTax, totalMaterialLabourSupplyTax);
    const netGstPayable = DecimalMath.max(0, DecimalMath.sub(outputGst, inputGst));
    const itcCreditBalance = DecimalMath.max(0, DecimalMath.sub(inputGst, outputGst));

    res.json({
      totalRevenue,
      totalPurchases,
      cogs,
      totalOperatingCosts,
      grossProfit,
      netProfit,
      totalReceivables,
      totalPayables,

      gst: {
        outputGst,
        inputGst,
        netGstPayable,
        itcCreditBalance,
        invoiceCgst,
        invoiceSgst,
        invoiceIgst,
      },

      stockValuation,
      totalItemsCount: itemList.length,

      invoices: {
        totalAmount: invoiceTotal,
        paidAmount: invoicePaid,
        balanceAmount: invoiceBalance,
        taxableAmount: invoiceTaxable,
        totalTax: invoiceTotalTax,
      },

      incomeExpense: {
        totalIncome: totalDirectIncome,
        actualExpense: actualDirectExpense,
        totalRefundable,
        totalRefunded,
        pendingRefundable,
      },

      purchases: {
        totalAmount: totalMaterialPurchase,
        paidAmount: totalMaterialPurchasePaid,
        outstandingAmount: totalMaterialPurchaseOutstanding,
        taxAmount: totalMaterialPurchaseTax,
      },

      supplies: {
        totalAmount: totalMaterialSupply,
        paidAmount: totalMaterialSupplyPaid,
        outstandingAmount: totalMaterialSupplyOutstanding,
        taxAmount: totalMaterialSupplyTax,
      },

      labourSupplies: {
        totalAmount: totalMaterialLabourSupply,
        paidAmount: totalMaterialLabourSupplyPaid,
        outstandingAmount: totalMaterialLabourSupplyOutstanding,
      },

      labour: {
        totalGross: totalLabourGross,
        totalNet: totalLabourNet,
        totalUpad: totalLabourUpad,
        totalPayment: totalLabourPayment,
        totalBalance: totalLabourBalance,
      },
    });
  } catch (error: any) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch dashboard metrics' });
  }
});

// GET /api/reports/analytics - Monthly trend time-series
reportRouter.get('/analytics', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const businessId = req.query.businessId ? parseInt(String(req.query.businessId), 10) : req.businessId;
    const locationId = req.query.locationId ? parseInt(String(req.query.locationId), 10) : undefined;

    const monthlyQuery = await db.execute(sql`
      WITH sales AS (
        SELECT substring(invoice_date from 1 for 7) as m, COALESCE(SUM(CAST(total_amount AS NUMERIC)), 0) as rev
        FROM invoices 
        WHERE user_id = ${userId} AND is_deleted = 0 AND is_void = 0
          ${businessId ? sql`AND (business_id = ${businessId} OR business_id IS NULL)` : sql``}
          ${locationId ? sql`AND location_id = ${locationId}` : sql``}
        GROUP BY m
        UNION ALL
        SELECT substring(date from 1 for 7) as m, COALESCE(SUM(CAST(total_amount AS NUMERIC)), 0) as rev
        FROM material_supplies 
        WHERE user_id = ${userId} AND is_deleted = 0 AND is_void = 0
          ${businessId ? sql`AND (business_id = ${businessId} OR business_id IS NULL)` : sql``}
          ${locationId ? sql`AND location_id = ${locationId}` : sql``}
        GROUP BY m
        UNION ALL
        SELECT substring(date from 1 for 7) as m, COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as rev
        FROM records 
        WHERE user_id = ${userId} AND is_deleted = 0 AND is_void = 0 AND type = 'INCOME'
          ${businessId ? sql`AND (business_id = ${businessId} OR business_id IS NULL)` : sql``}
          ${locationId ? sql`AND location_id = ${locationId}` : sql``}
        GROUP BY m
      ),
      costs AS (
        SELECT substring(date from 1 for 7) as m, COALESCE(SUM(CAST(total_amount AS NUMERIC)), 0) as cost
        FROM material_purchases 
        WHERE user_id = ${userId} AND is_deleted = 0 AND is_void = 0
          ${businessId ? sql`AND (business_id = ${businessId} OR business_id IS NULL)` : sql``}
          ${locationId ? sql`AND location_id = ${locationId}` : sql``}
        GROUP BY m
        UNION ALL
        SELECT substring(date from 1 for 7) as m, COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as cost
        FROM records 
        WHERE user_id = ${userId} AND is_deleted = 0 AND is_void = 0 AND type = 'EXPENSE'
          ${businessId ? sql`AND (business_id = ${businessId} OR business_id IS NULL)` : sql``}
          ${locationId ? sql`AND location_id = ${locationId}` : sql``}
        GROUP BY m
        UNION ALL
        SELECT substring(date from 1 for 7) as m, COALESCE(SUM(CAST(net_salary AS NUMERIC)), 0) as cost
        FROM labour_salaries 
        WHERE user_id = ${userId} AND is_deleted = 0 AND is_void = 0
          ${businessId ? sql`AND (business_id = ${businessId} OR business_id IS NULL)` : sql``}
          ${locationId ? sql`AND location_id = ${locationId}` : sql``}
        GROUP BY m
      )
      SELECT 
        COALESCE(s.m, c.m) as month,
        COALESCE(SUM(s.rev), 0) as revenue,
        COALESCE(SUM(c.cost), 0) as expense
      FROM sales s
      FULL OUTER JOIN costs c ON s.m = c.m
      WHERE COALESCE(s.m, c.m) IS NOT NULL AND COALESCE(s.m, c.m) != ''
      GROUP BY month
      ORDER BY month ASC
      LIMIT 12
    `);

    const categoriesQuery = await db.execute(sql`
      SELECT category, COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as total
      FROM records
      WHERE user_id = ${userId} AND is_deleted = 0 AND is_void = 0 AND type = 'EXPENSE'
        ${businessId ? sql`AND (business_id = ${businessId} OR business_id IS NULL)` : sql``}
        ${locationId ? sql`AND location_id = ${locationId}` : sql``}
      GROUP BY category
      ORDER BY total DESC
    `);

    res.json({
      monthly: monthlyQuery.rows.map((r: any) => {
        const rev = parseFloat(r.revenue || '0');
        const exp = parseFloat(r.expense || '0');
        return {
          month: r.month,
          revenue: Math.round(rev * 100) / 100,
          expense: Math.round(exp * 100) / 100,
          profit: Math.round((rev - exp) * 100) / 100,
        };
      }),
      categories: categoriesQuery.rows.map((r: any) => ({
        category: r.category || 'General Expense',
        total: Math.round(parseFloat(r.total || '0') * 100) / 100,
      })),
    });
  } catch (error: any) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch analytics' });
  }
});

// GET /api/reports/gst-returns - GSTR-1 and GSTR-3B details
reportRouter.get('/gst-returns', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const businessId = req.query.businessId ? parseInt(String(req.query.businessId), 10) : req.businessId;
    const locationId = req.query.locationId ? parseInt(String(req.query.locationId), 10) : undefined;
    const { startDate, endDate } = req.query;

    const invoiceList = await db.select().from(invoices).where(
      and(
        eq(invoices.userId, userId),
        eq(invoices.isDeleted, 0),
        eq(invoices.isVoid, 0),
        businessId ? or(eq(invoices.businessId, businessId), sql`${invoices.businessId} IS NULL`) : sql`1=1`,
        locationId ? eq(invoices.locationId, locationId) : sql`1=1`,
        startDate ? sql`${invoices.invoiceDate} >= ${String(startDate)}` : sql`1=1`,
        endDate ? sql`${invoices.invoiceDate} <= ${String(endDate)}` : sql`1=1`
      )
    ).orderBy(desc(invoices.invoiceDate));

    const purchaseList = await db.select().from(materialPurchases).where(
      and(
        eq(materialPurchases.userId, userId),
        eq(materialPurchases.isDeleted, 0),
        eq(materialPurchases.isVoid, 0),
        businessId ? or(eq(materialPurchases.businessId, businessId), sql`${materialPurchases.businessId} IS NULL`) : sql`1=1`,
        locationId ? eq(materialPurchases.locationId, locationId) : sql`1=1`,
        startDate ? sql`${materialPurchases.date} >= ${String(startDate)}` : sql`1=1`,
        endDate ? sql`${materialPurchases.date} <= ${String(endDate)}` : sql`1=1`
      )
    ).orderBy(desc(materialPurchases.date));

    let gstr1Taxable = 0, gstr1Cgst = 0, gstr1Sgst = 0, gstr1Igst = 0, gstr1Cess = 0, gstr1TotalTax = 0, gstr1TotalValue = 0;
    let b2bCount = 0, b2cCount = 0;

    invoiceList.forEach(inv => {
      gstr1Taxable = DecimalMath.add(gstr1Taxable, parseFloat(inv.taxableAmount || '0'));
      gstr1Cgst = DecimalMath.add(gstr1Cgst, parseFloat(inv.cgst || '0'));
      gstr1Sgst = DecimalMath.add(gstr1Sgst, parseFloat(inv.sgst || '0'));
      gstr1Igst = DecimalMath.add(gstr1Igst, parseFloat(inv.igst || '0'));
      gstr1Cess = DecimalMath.add(gstr1Cess, parseFloat(inv.cessAmount || '0'));
      gstr1TotalTax = DecimalMath.add(gstr1TotalTax, parseFloat(inv.totalTax || '0'));
      gstr1TotalValue = DecimalMath.add(gstr1TotalValue, parseFloat(inv.totalAmount || '0'));
      if (inv.partyGst && inv.partyGst.trim().length >= 15) {
        b2bCount++;
      } else {
        b2cCount++;
      }
    });

    let itcTaxable = 0, itcTotalTax = 0;
    purchaseList.forEach(pur => {
      itcTaxable = DecimalMath.add(itcTaxable, parseFloat(pur.subtotal || '0'));
      itcTotalTax = DecimalMath.add(itcTotalTax, parseFloat(pur.tax || '0'));
    });

    res.json({
      gstr1: {
        totalInvoices: invoiceList.length,
        b2bInvoices: b2bCount,
        b2cInvoices: b2cCount,
        taxableValue: gstr1Taxable,
        cgst: gstr1Cgst,
        sgst: gstr1Sgst,
        igst: gstr1Igst,
        cess: gstr1Cess,
        totalTax: gstr1TotalTax,
        totalValue: gstr1TotalValue,
      },
      gstr3b: {
        outwardTaxable: gstr1Taxable,
        outwardTax: gstr1TotalTax,
        eligibleItc: itcTotalTax,
        netTaxPayable: DecimalMath.max(0, DecimalMath.sub(gstr1TotalTax, itcTotalTax)),
        closingItcBalance: DecimalMath.max(0, DecimalMath.sub(itcTotalTax, gstr1TotalTax)),
      },
      invoices: invoiceList,
      purchases: purchaseList
    });
  } catch (error: any) {
    console.error('GST return report error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch GST return report' });
  }
});

// GET /api/reports/pnl - Formal Profit & Loss Statement
reportRouter.get('/pnl', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const businessId = req.query.businessId ? parseInt(String(req.query.businessId), 10) : req.businessId;
    const locationId = req.query.locationId ? parseInt(String(req.query.locationId), 10) : undefined;
    const { startDate, endDate } = req.query;

    const [invoicesAgg, suppliesAgg, directIncomeAgg, purchasesAgg, expensesAgg, labourAgg] = await Promise.all([
      db.execute(sql`
        SELECT COALESCE(SUM(CAST(taxable_amount AS NUMERIC)), 0) as taxable, COALESCE(SUM(CAST(total_amount AS NUMERIC)), 0) as total
        FROM invoices WHERE user_id = ${userId} AND is_deleted = 0 AND is_void = 0
          ${businessId ? sql`AND (business_id = ${businessId} OR business_id IS NULL)` : sql``}
          ${locationId ? sql`AND location_id = ${locationId}` : sql``}
          ${startDate ? sql`AND invoice_date >= ${String(startDate)}` : sql``}
          ${endDate ? sql`AND invoice_date <= ${String(endDate)}` : sql``}
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(CAST(total_amount AS NUMERIC)), 0) as total
        FROM material_supplies WHERE user_id = ${userId} AND is_deleted = 0 AND is_void = 0
          ${businessId ? sql`AND (business_id = ${businessId} OR business_id IS NULL)` : sql``}
          ${locationId ? sql`AND location_id = ${locationId}` : sql``}
          ${startDate ? sql`AND date >= ${String(startDate)}` : sql``}
          ${endDate ? sql`AND date <= ${String(endDate)}` : sql``}
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as total
        FROM records WHERE user_id = ${userId} AND is_deleted = 0 AND is_void = 0 AND type = 'INCOME'
          ${businessId ? sql`AND (business_id = ${businessId} OR business_id IS NULL)` : sql``}
          ${locationId ? sql`AND location_id = ${locationId}` : sql``}
          ${startDate ? sql`AND date >= ${String(startDate)}` : sql``}
          ${endDate ? sql`AND date <= ${String(endDate)}` : sql``}
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(CAST(total_amount AS NUMERIC)), 0) as total
        FROM material_purchases WHERE user_id = ${userId} AND is_deleted = 0 AND is_void = 0
          ${businessId ? sql`AND (business_id = ${businessId} OR business_id IS NULL)` : sql``}
          ${locationId ? sql`AND location_id = ${locationId}` : sql``}
          ${startDate ? sql`AND date >= ${String(startDate)}` : sql``}
          ${endDate ? sql`AND date <= ${String(endDate)}` : sql``}
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as total, COALESCE(SUM(CAST(refundable_amount AS NUMERIC)), 0) as ref
        FROM records WHERE user_id = ${userId} AND is_deleted = 0 AND is_void = 0 AND type = 'EXPENSE'
          ${businessId ? sql`AND (business_id = ${businessId} OR business_id IS NULL)` : sql``}
          ${locationId ? sql`AND location_id = ${locationId}` : sql``}
          ${startDate ? sql`AND date >= ${String(startDate)}` : sql``}
          ${endDate ? sql`AND date <= ${String(endDate)}` : sql``}
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(CAST(net_salary AS NUMERIC)), 0) as total
        FROM labour_salaries WHERE user_id = ${userId} AND is_deleted = 0 AND is_void = 0
          ${businessId ? sql`AND (business_id = ${businessId} OR business_id IS NULL)` : sql``}
          ${locationId ? sql`AND location_id = ${locationId}` : sql``}
          ${startDate ? sql`AND date >= ${String(startDate)}` : sql``}
          ${endDate ? sql`AND date <= ${String(endDate)}` : sql``}
      `),
    ]);

    const salesInvoices = parseFloat(invoicesAgg.rows[0]?.total as string || '0');
    const suppliesTotal = parseFloat(suppliesAgg.rows[0]?.total as string || '0');
    const directIncome = parseFloat(directIncomeAgg.rows[0]?.total as string || '0');
    const grossRevenue = DecimalMath.add(salesInvoices, suppliesTotal, directIncome);

    const purchasesTotal = parseFloat(purchasesAgg.rows[0]?.total as string || '0');
    const cogs = purchasesTotal;
    const grossProfit = DecimalMath.sub(grossRevenue, cogs);

    const expTotal = parseFloat(expensesAgg.rows[0]?.total as string || '0');
    const expRef = parseFloat(expensesAgg.rows[0]?.ref as string || '0');
    const operatingExpenses = DecimalMath.max(0, DecimalMath.sub(expTotal, expRef));
    const labourWages = parseFloat(labourAgg.rows[0]?.total as string || '0');
    const totalOverheads = DecimalMath.add(operatingExpenses, labourWages);

    const netProfit = DecimalMath.sub(grossProfit, totalOverheads);

    res.json({
      revenue: {
        salesInvoices,
        suppliesTotal,
        directIncome,
        grossRevenue,
      },
      directCosts: {
        purchases: purchasesTotal,
        cogs,
        grossProfit,
      },
      operatingExpenses: {
        generalExpenses: operatingExpenses,
        labourWages,
        totalOverheads,
      },
      netProfit,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate PnL' });
  }
});

// Excel Export Handler (18-Sheet Consolidated Export)
const exportExcelHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const businessId = req.query.businessId ? parseInt(String(req.query.businessId), 10) : req.businessId;
    const locationIdParam = req.query.locationId && req.query.locationId !== 'all' ? parseInt(String(req.query.locationId), 10) : undefined;

    let targetTitle = 'Consolidated Enterprise';
    if (locationIdParam) {
      const [loc] = await db.select().from(locations).where(and(eq(locations.id, locationIdParam), eq(locations.userId, userId)));
      if (loc) targetTitle = loc.name;
    }

    // Fetch all 18 domains concurrently
    const [
      invList,
      invItemsList,
      cnDnList,
      purList,
      supList,
      mlsList,
      recList,
      refList,
      salList,
      payList,
      ptyList,
      itemList,
      smList,
      opList,
      audList
    ] = await Promise.all([
      db.select().from(invoices).where(and(eq(invoices.userId, userId), eq(invoices.isDeleted, 0), locationIdParam ? eq(invoices.locationId, locationIdParam) : sql`1=1`, businessId ? or(eq(invoices.businessId, businessId), sql`${invoices.businessId} IS NULL`) : sql`1=1`)),
      db.select().from(invoiceItems).innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id)).where(and(eq(invoices.userId, userId), eq(invoices.isDeleted, 0))),
      db.select().from(creditDebitNotes).where(and(eq(creditDebitNotes.userId, userId), locationIdParam ? eq(creditDebitNotes.locationId, locationIdParam) : sql`1=1`)),
      db.select().from(materialPurchases).where(and(eq(materialPurchases.userId, userId), eq(materialPurchases.isDeleted, 0), locationIdParam ? eq(materialPurchases.locationId, locationIdParam) : sql`1=1`)),
      db.select().from(materialSupplies).where(and(eq(materialSupplies.userId, userId), eq(materialSupplies.isDeleted, 0), locationIdParam ? eq(materialSupplies.locationId, locationIdParam) : sql`1=1`)),
      db.select().from(materialLabourSupplies).where(and(eq(materialLabourSupplies.userId, userId), eq(materialLabourSupplies.isDeleted, 0), locationIdParam ? eq(materialLabourSupplies.locationId, locationIdParam) : sql`1=1`)),
      db.select().from(records).where(and(eq(records.userId, userId), eq(records.isDeleted, 0), locationIdParam ? eq(records.locationId, locationIdParam) : sql`1=1`)),
      db.select().from(refunds).where(and(eq(refunds.userId, userId), locationIdParam ? eq(refunds.locationId, locationIdParam) : sql`1=1`)),
      db.select().from(labourSalaries).where(and(eq(labourSalaries.userId, userId), eq(labourSalaries.isDeleted, 0), locationIdParam ? eq(labourSalaries.locationId, locationIdParam) : sql`1=1`)),
      db.select().from(payments).where(and(eq(payments.userId, userId), eq(payments.isDeleted, 0), locationIdParam ? eq(payments.locationId, locationIdParam) : sql`1=1`)),
      db.select().from(parties).where(and(eq(parties.userId, userId), eq(parties.isDeleted, 0))),
      db.select().from(items).where(and(eq(items.userId, userId), eq(items.isDeleted, 0))),
      db.select().from(stockMovements).where(and(eq(stockMovements.userId, userId), locationIdParam ? eq(stockMovements.locationId, locationIdParam) : sql`1=1`)),
      db.select().from(openingBalances).where(and(eq(openingBalances.userId, userId), locationIdParam ? eq(openingBalances.locationId, locationIdParam) : sql`1=1`)),
      db.select().from(auditLogs).where(eq(auditLogs.userId, userId)).orderBy(desc(auditLogs.createdAt)).limit(1000),
    ]);

    // Build summary
    let totalRev = 0;
    invList.forEach(i => { if (i.isVoid === 0) totalRev = DecimalMath.add(totalRev, parseFloat(i.totalAmount || '0')); });
    supList.forEach(s => { if (s.isVoid === 0) totalRev = DecimalMath.add(totalRev, parseFloat(s.totalAmount || '0')); });
    recList.forEach(r => { if (r.isVoid === 0 && r.type === 'INCOME') totalRev = DecimalMath.add(totalRev, parseFloat(r.amount || '0')); });

    let totalPur = 0;
    purList.forEach(p => { if (p.isVoid === 0) totalPur = DecimalMath.add(totalPur, parseFloat(p.totalAmount || '0')); });

    let totalLabor = 0;
    salList.forEach(s => { if (s.isVoid === 0) totalLabor = DecimalMath.add(totalLabor, parseFloat(s.netSalary || '0')); });

    let totalExp = 0;
    recList.forEach(r => { if (r.isVoid === 0 && r.type === 'EXPENSE') totalExp = DecimalMath.add(totalExp, parseFloat(r.amount || '0')); });

    const totalOpCosts = DecimalMath.add(totalLabor, totalExp);
    const grossProfit = DecimalMath.sub(totalRev, totalPur);
    const netProfit = DecimalMath.sub(grossProfit, totalOpCosts);

    const buffer = generateExcelBuffer(targetTitle, {
      summary: {
        totalRevenue: totalRev,
        totalPurchases: totalPur,
        cogs: totalPur,
        grossProfit,
        totalOperatingCosts: totalOpCosts,
        netProfit,
        totalReceivables: 0,
        totalPayables: 0,
        stockValuation: 0,
      },
      invoices: invList,
      invoiceItems: invItemsList.map(j => j.invoice_items),
      creditDebitNotes: cnDnList,
      purchases: purList,
      supplies: supList,
      labourSupplies: mlsList,
      expenses: recList.filter(r => r.type === 'EXPENSE'),
      income: recList.filter(r => r.type === 'INCOME'),
      refunds: refList,
      salaries: salList,
      payments: payList,
      parties: ptyList,
      inventory: itemList,
      stockMovements: smList,
      openingBalances: opList,
      auditLogs: audList,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(targetTitle)}_Consolidated_18Sheet_Report.xlsx"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Excel Export Error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate Excel report' });
  }
};

reportRouter.get('/export/excel', exportExcelHandler);
reportRouter.get('/export-all', exportExcelHandler);

export default reportRouter;
