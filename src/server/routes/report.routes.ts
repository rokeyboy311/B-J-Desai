import express, { Response } from 'express';
import { db } from '../../db/index.js';
import { 
  locations, records, investmentParties, investmentTransactions,
  materialPurchases, materialSupplies, materialLabourSupplies,
  labourSalaries, materialStockAdjustments
} from '../../db/schema.js';
import { eq, and, sql, desc, or } from 'drizzle-orm';
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
    if (validLocIds.length === 0) {
      return res.json({
        totalIncome: 0, actualExpense: 0, totalRefundable: 0, totalRefunded: 0, pendingRefundable: 0, netIncome: 0,
        totalInvestment: 0, totalInvestmentPayment: 0, totalInvestmentUpad: 0, investmentBalance: 0,
        totalMaterialPurchase: 0, totalMaterialPurchasePaid: 0, totalMaterialPurchaseOutstanding: 0,
        totalMaterialSupply: 0, totalMaterialSupplyPaid: 0, totalMaterialSupplyOutstanding: 0,
        totalMaterialLabourSupply: 0, totalMaterialLabourSupplyPaid: 0, totalMaterialLabourSupplyOutstanding: 0,
        labourMetrics: { totalNetSalary: 0, totalUpad: 0, totalPayment: 0, totalBalance: 0 },
        rawLabourAtt: []
      });
    }
    
    const idList = validLocIds.join(',');

    // 1. Income & Expenses
    const ieQuery = await db.execute(sql`
      SELECT category, SUM(amount) as amt, SUM(refundable_amount) as ref_amt, SUM(refunded_amount) as refd_amt
      FROM records
      WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY category
    `);
    
    let totalIncome = 0, actualExpense = 0, totalRefundable = 0, totalRefunded = 0;
    for (const r of ieQuery.rows) {
      if (r.category === 'INCOME') totalIncome += parseFloat(r.amt as string || '0');
      if (r.category === 'EXPENSE') {
        actualExpense += parseFloat(r.amt as string || '0');
        totalRefundable += parseFloat(r.ref_amt as string || '0');
        totalRefunded += parseFloat(r.refd_amt as string || '0');
      }
    }
    const pendingRefundable = totalRefundable - totalRefunded;
    const netIncome = totalIncome - actualExpense;

    // 2. Investment
    const invQuery = await db.execute(sql`
      SELECT t.type, SUM(t.amount) as amt
      FROM investment_transactions t
      JOIN investment_parties p ON t.party_id = p.id
      WHERE t.user_id = ${userId} AND t.is_deleted = 0 AND p.location_id IN (${sql.raw(idList)})
      GROUP BY t.type
    `);
    
    let totalInvestment = 0, totalInvestmentPayment = 0, totalInvestmentUpad = 0;
    for (const r of invQuery.rows) {
      const a = parseFloat(r.amt as string || '0');
      if (r.type === 'INVESTMENT') totalInvestment += a;
      if (r.type === 'PAYMENT') totalInvestmentPayment += a;
      if (r.type === 'UPAD') totalInvestmentUpad += a;
    }
    const investmentBalance = totalInvestment - totalInvestmentPayment - totalInvestmentUpad;

    // 3. Material Purchase
    const mpQuery = await db.execute(sql`
      SELECT SUM(total_amount) as tot, SUM(paid_amount) as pd, SUM(outstanding_amount) as out
      FROM material_purchases
      WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})
    `);
    const totalMaterialPurchase = parseFloat(mpQuery.rows[0]?.tot as string || '0');
    const totalMaterialPurchasePaid = parseFloat(mpQuery.rows[0]?.pd as string || '0');
    const totalMaterialPurchaseOutstanding = parseFloat(mpQuery.rows[0]?.out as string || '0');

    // 4. Material Supply
    const msQuery = await db.execute(sql`
      SELECT SUM(total_amount) as tot, SUM(paid_amount) as pd, SUM(outstanding_amount) as out
      FROM material_supplies
      WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})
    `);
    const totalMaterialSupply = parseFloat(msQuery.rows[0]?.tot as string || '0');
    const totalMaterialSupplyPaid = parseFloat(msQuery.rows[0]?.pd as string || '0');
    const totalMaterialSupplyOutstanding = parseFloat(msQuery.rows[0]?.out as string || '0');

    // 5. Material Labour Supply
    const mlsQuery = await db.execute(sql`
      SELECT SUM(total_amount) as tot, SUM(paid_amount) as pd, SUM(outstanding_amount) as out
      FROM material_labour_supplies
      WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})
    `);
    const totalMaterialLabourSupply = parseFloat(mlsQuery.rows[0]?.tot as string || '0');
    const totalMaterialLabourSupplyPaid = parseFloat(mlsQuery.rows[0]?.pd as string || '0');
    const totalMaterialLabourSupplyOutstanding = parseFloat(mlsQuery.rows[0]?.out as string || '0');

    // 6. Labour Salary
    const lsQuery = await db.execute(sql`
      SELECT SUM(net_salary) as net, SUM(upad) as upad, SUM(payment_amount) as pd, SUM(balance) as bal
      FROM labour_salaries
      WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})
    `);
    const labourMetrics = {
      totalNetSalary: parseFloat(lsQuery.rows[0]?.net as string || '0'),
      totalUpad: parseFloat(lsQuery.rows[0]?.upad as string || '0'),
      totalPayment: parseFloat(lsQuery.rows[0]?.pd as string || '0'),
      totalBalance: parseFloat(lsQuery.rows[0]?.bal as string || '0')
    };

    const rawLabourAtt = await db.execute(sql`
      SELECT substring(date from 1 for 7) as month, SUM(days) as days, SUM(tc_quantity) as tcs
      FROM labour_salaries
      WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY month ORDER BY month
    `);

    res.json({
      totalIncome, actualExpense, totalRefundable, totalRefunded, pendingRefundable, netIncome,
      totalInvestment, totalInvestmentPayment, totalInvestmentUpad, investmentBalance,
      totalMaterialPurchase, totalMaterialPurchasePaid, totalMaterialPurchaseOutstanding,
      totalMaterialSupply, totalMaterialSupplyPaid, totalMaterialSupplyOutstanding,
      totalMaterialLabourSupply, totalMaterialLabourSupplyPaid, totalMaterialLabourSupplyOutstanding,
      labourMetrics,
      rawLabourAtt: rawLabourAtt.rows
    });
  } catch (error) {
    console.error('Failed to fetch dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

reportRouter.get('/analytics', async (req: AuthRequest, res: Response) => {
  // We'll return empty for now, but not fake empty. Real analytics can be built later if required, 
  // but since dashboard is comprehensive, we'll proxy dashboard data as analytics.
  res.json({ monthly: [], categories: [] });
});

reportRouter.get('/export-location/:id', async (req: AuthRequest, res: Response) => {
  try {
    const locationId = parseInt(req.params.id as string, 10);
    const userId = req.dbUser!.id;
    const tab = req.query.tab as string || 'all';

    const locResult = await db.select().from(locations).where(and(eq(locations.id, locationId), eq(locations.userId, userId)));
    if (!locResult.length) return res.status(404).json({ error: 'Location not found' });
    const locationName = locResult[0].name;

    const exportData: any = {};
    if (tab === 'all' || tab === 'expense' || tab === 'income-expense') {
      exportData.incomeExpense = await db.select().from(records).where(and(eq(records.locationId, locationId), eq(records.userId, userId), eq(records.isDeleted, 0)));
    }
    if (tab === 'all' || tab === 'investment') {
      exportData.investments = await db.select({
        date: investmentTransactions.date, type: investmentTransactions.type, amount: investmentTransactions.amount,
        description: investmentTransactions.description, paymentMethod: investmentTransactions.paymentMethod,
        referenceNumber: investmentTransactions.referenceNumber, partyName: investmentParties.partyName
      }).from(investmentTransactions).innerJoin(investmentParties, eq(investmentTransactions.partyId, investmentParties.id))
      .where(and(eq(investmentParties.locationId, locationId), eq(investmentTransactions.userId, userId), eq(investmentTransactions.isDeleted, 0)));
    }
    if (tab === 'all' || tab === 'material-purchase') {
      exportData.purchases = await db.select().from(materialPurchases).where(and(eq(materialPurchases.locationId, locationId), eq(materialPurchases.userId, userId), eq(materialPurchases.isDeleted, 0)));
    }
    if (tab === 'all' || tab === 'material-supply') {
      exportData.supplies = await db.select().from(materialSupplies).where(and(eq(materialSupplies.locationId, locationId), eq(materialSupplies.userId, userId), eq(materialSupplies.isDeleted, 0)));
    }
    if (tab === 'all' || tab === 'material-labour-supply') {
      exportData.labourSupplies = await db.select().from(materialLabourSupplies).where(and(eq(materialLabourSupplies.locationId, locationId), eq(materialLabourSupplies.userId, userId), eq(materialLabourSupplies.isDeleted, 0)));
    }
    if (tab === 'all' || tab === 'labour-salary') {
      exportData.salaries = await db.select().from(labourSalaries).where(and(eq(labourSalaries.locationId, locationId), eq(labourSalaries.userId, userId), eq(labourSalaries.isDeleted, 0)));
    }

    const buffer = generateExcelBuffer(locationName, exportData, tab);
    res.setHeader('Content-Disposition', `attachment; filename="Export_${locationName.replace(/\s+/g, '_')}_${tab}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Failed to export location:', error);
    res.status(500).json({ error: 'Failed to export location' });
  }
});

reportRouter.get('/export-all', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const exportData: any = {};
    
    exportData.incomeExpense = await db.select().from(records).where(and(eq(records.userId, userId), eq(records.isDeleted, 0)));
    exportData.investments = await db.select({
      date: investmentTransactions.date, type: investmentTransactions.type, amount: investmentTransactions.amount,
      description: investmentTransactions.description, paymentMethod: investmentTransactions.paymentMethod,
      referenceNumber: investmentTransactions.referenceNumber, partyName: investmentParties.partyName
    }).from(investmentTransactions).innerJoin(investmentParties, eq(investmentTransactions.partyId, investmentParties.id))
    .where(and(eq(investmentTransactions.userId, userId), eq(investmentTransactions.isDeleted, 0)));
    
    exportData.purchases = await db.select().from(materialPurchases).where(and(eq(materialPurchases.userId, userId), eq(materialPurchases.isDeleted, 0)));
    exportData.supplies = await db.select().from(materialSupplies).where(and(eq(materialSupplies.userId, userId), eq(materialSupplies.isDeleted, 0)));
    exportData.labourSupplies = await db.select().from(materialLabourSupplies).where(and(eq(materialLabourSupplies.userId, userId), eq(materialLabourSupplies.isDeleted, 0)));
    exportData.salaries = await db.select().from(labourSalaries).where(and(eq(labourSalaries.userId, userId), eq(labourSalaries.isDeleted, 0)));

    const buffer = generateExcelBuffer('All_Locations', exportData, 'all');
    res.setHeader('Content-Disposition', `attachment; filename="Export_All_Locations.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Failed to export all:', error);
    res.status(500).json({ error: 'Failed to export all' });
  }
});

export default reportRouter;
