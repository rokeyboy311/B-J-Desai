import express, { Response } from 'express';
import { db } from '../../db/index.js';
import { 
  locations, records, investmentParties, investmentTransactions,
  materialPurchases, materialSupplies, materialLabourSupplies,
  labourSalaries, supervisorCosts
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
        totalSupervisorCost: 0,
        labourMetrics: { totalNetSalary: 0, totalUpad: 0, totalPayment: 0, totalBalance: 0 },
        rawLabourAtt: [],
        investorParties: [],
        connectedExpenses: {
          totalInvested: 0, totalUpad: 0, netCapitalPool: 0,
          materialPurchaseExpense: 0, siteSupplyExpense: 0, labourSalaryExpense: 0, generalExpense: 0,
          totalExpensesCut: 0, remainingCapital: 0, utilizationRate: 0
        },
        stockSummary: { items: [], totalDistinctMaterials: 0, totalStockUnits: 0, totalStockValuation: 0, lowStockCount: 0 },
        supervisorAudit: { totalSupervisorCost: 0, totalSiteSupply: 0, variance: 0, reconciliationStatus: 'MATCHED' }
      });
    }
    
    const idList = validLocIds.join(',');

    // 1. Income & Expenses
    const ieQuery = await db.execute(sql`
      SELECT type, SUM(amount) as amt, SUM(refundable_amount) as ref_amt, SUM(refunded_amount) as refd_amt
      FROM records
      WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY type
    `);
    
    let totalIncome = 0, actualExpense = 0, totalRefundable = 0, totalRefunded = 0;
    for (const r of ieQuery.rows) {
      if (r.type === 'INCOME') totalIncome += parseFloat(r.amt as string || '0');
      if (r.type === 'EXPENSE') {
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

    // 7. Supervisor Costs
    const supQuery = await db.execute(sql`
      SELECT SUM(amount) as tot
      FROM supervisor_costs
      WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})
    `);
    const totalSupervisorCost = parseFloat(supQuery.rows[0]?.tot as string || '0');

    // 8. Investor Parties Breakdown (Part 1)
    const invPartiesQuery = await db.execute(sql`
      SELECT 
        p.id, 
        p.party_name as "partyName",
        COALESCE(SUM(CASE WHEN t.type = 'INVESTMENT' THEN t.amount ELSE 0 END), 0) as "totalInvestment",
        COALESCE(SUM(CASE WHEN t.type = 'UPAD' THEN t.amount ELSE 0 END), 0) as "totalUpad",
        COALESCE(SUM(CASE WHEN t.type = 'PAYMENT' THEN t.amount ELSE 0 END), 0) as "totalPayment"
      FROM investment_parties p
      LEFT JOIN investment_transactions t ON t.party_id = p.id AND t.is_deleted = 0
      WHERE p.user_id = ${userId} AND p.is_deleted = 0 AND p.location_id IN (${sql.raw(idList)})
      GROUP BY p.id, p.party_name
      ORDER BY "totalInvestment" DESC, p.party_name ASC
    `);

    const investorParties = invPartiesQuery.rows.map((r: any) => {
      const inv = parseFloat(r.totalInvestment || '0');
      const upd = parseFloat(r.totalUpad || '0');
      const pay = parseFloat(r.totalPayment || '0');
      return {
        id: Number(r.id),
        partyName: r.partyName as string,
        totalInvestment: inv,
        totalUpad: upd,
        totalPayment: pay,
        balance: Math.round((inv - upd - pay) * 100) / 100
      };
    });

    // 9. Connected Expenses (Part 2 - all expenses connected to Part 1 investment)
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
    };

    // 10. Live Stock Inventory Summary
    const [purchasesForStock, suppliesForStock, siteSuppliesForStock] = await Promise.all([
      db.select({
        materialName: materialPurchases.materialName,
        unit: materialPurchases.unit,
        quantity: materialPurchases.quantity,
        totalAmount: materialPurchases.totalAmount,
      }).from(materialPurchases).where(and(eq(materialPurchases.userId, userId), eq(materialPurchases.isDeleted, 0), sql`location_id IN (${sql.raw(idList)})`)),
      db.select({
        materialName: materialSupplies.materialName,
        unit: materialSupplies.unit,
        quantity: materialSupplies.quantity,
      }).from(materialSupplies).where(and(eq(materialSupplies.userId, userId), eq(materialSupplies.isDeleted, 0), sql`location_id IN (${sql.raw(idList)})`)),
      db.select({
        materialName: materialLabourSupplies.materialName,
        unit: materialLabourSupplies.materialUnit,
        quantity: materialLabourSupplies.materialQuantity,
      }).from(materialLabourSupplies).where(and(eq(materialLabourSupplies.userId, userId), eq(materialLabourSupplies.isDeleted, 0), sql`location_id IN (${sql.raw(idList)})`))
    ]);

    const stockMap: Record<string, { materialName: string; unit: string; purchasedQty: number; otherSupplyQty: number; siteSupplyQty: number; totalValue: number }> = {};
    for (const p of purchasesForStock) {
      if (!p.materialName) continue;
      const key = `${p.materialName.trim().toLowerCase()}_${(p.unit || 'unit').trim().toLowerCase()}`;
      if (!stockMap[key]) stockMap[key] = { materialName: p.materialName.trim(), unit: p.unit || 'Unit', purchasedQty: 0, otherSupplyQty: 0, siteSupplyQty: 0, totalValue: 0 };
      stockMap[key].purchasedQty += parseFloat(p.quantity as string) || 0;
      stockMap[key].totalValue += parseFloat(p.totalAmount as string) || 0;
    }
    for (const s of suppliesForStock) {
      if (!s.materialName) continue;
      const key = `${s.materialName.trim().toLowerCase()}_${(s.unit || 'unit').trim().toLowerCase()}`;
      if (!stockMap[key]) stockMap[key] = { materialName: s.materialName.trim(), unit: s.unit || 'Unit', purchasedQty: 0, otherSupplyQty: 0, siteSupplyQty: 0, totalValue: 0 };
      stockMap[key].otherSupplyQty += parseFloat(s.quantity as string) || 0;
    }
    for (const ms of siteSuppliesForStock) {
      if (!ms.materialName) continue;
      const key = `${ms.materialName.trim().toLowerCase()}_${(ms.unit || 'unit').trim().toLowerCase()}`;
      if (!stockMap[key]) stockMap[key] = { materialName: ms.materialName.trim(), unit: ms.unit || 'Unit', purchasedQty: 0, otherSupplyQty: 0, siteSupplyQty: 0, totalValue: 0 };
      stockMap[key].siteSupplyQty += parseFloat(ms.quantity as string) || 0;
    }

    const stockItems = Object.values(stockMap).map(item => {
      const totalSupplied = Math.round((item.otherSupplyQty + item.siteSupplyQty) * 100) / 100;
      const currentStock = Math.round((item.purchasedQty - totalSupplied) * 100) / 100;
      const avgRate = item.purchasedQty > 0 ? (item.totalValue / item.purchasedQty) : 0;
      const valuation = Math.max(0, Math.round(currentStock * avgRate * 100) / 100);
      let status = 'IN_STOCK';
      if (currentStock <= 0) status = 'OUT_OF_STOCK';
      else if (currentStock <= 15) status = 'LOW_STOCK';
      return {
        materialName: item.materialName,
        unit: item.unit,
        purchasedQty: Math.round(item.purchasedQty * 100) / 100,
        otherSupplyQty: Math.round(item.otherSupplyQty * 100) / 100,
        siteSupplyQty: Math.round(item.siteSupplyQty * 100) / 100,
        totalSuppliedQty: totalSupplied,
        currentStock,
        valuation,
        stockValuation: valuation,
        status
      };
    }).sort((a, b) => b.valuation - a.valuation);

    const totalStockUnits = Math.round(stockItems.reduce((acc, i) => acc + i.currentStock, 0) * 100) / 100;
    const totalStockValuation = Math.round(stockItems.reduce((acc, i) => acc + i.valuation, 0) * 100) / 100;
    const lowStockCount = stockItems.filter(i => i.status !== 'IN_STOCK').length;

    const stockSummary = {
      items: stockItems,
      totalDistinctMaterials: stockItems.length,
      totalStockUnits,
      totalStockValuation,
      lowStockCount
    };

    // 11. Supervisor Costs Audit & Cross-Check against Site Supplies
    // Separate from total investment! Used to verify whether supervisor cash matches site supply expenses
    const supervisorAuditVariance = Math.round((totalSupervisorCost - totalMaterialLabourSupply) * 100) / 100;
    let reconciliationStatus = 'MATCHED';
    if (Math.abs(supervisorAuditVariance) > 1) {
      reconciliationStatus = supervisorAuditVariance > 0 ? 'SUPERVISOR_SURPLUS' : 'SITE_EXCESS';
    }

    const supervisorAudit = {
      totalSupervisorCost,
      totalSiteSupply: totalMaterialLabourSupply,
      variance: supervisorAuditVariance,
      reconciliationStatus
    };

    res.json({
      totalIncome, actualExpense, totalRefundable, totalRefunded, pendingRefundable, netIncome,
      totalInvestment, totalInvestmentPayment, totalInvestmentUpad, investmentBalance,
      totalMaterialPurchase, totalMaterialPurchasePaid, totalMaterialPurchaseOutstanding,
      totalMaterialSupply, totalMaterialSupplyPaid, totalMaterialSupplyOutstanding,
      totalMaterialLabourSupply, totalMaterialLabourSupplyPaid, totalMaterialLabourSupplyOutstanding,
      totalSupervisorCost,
      labourMetrics,
      rawLabourAtt: rawLabourAtt.rows,
      investorParties,
      connectedExpenses,
      stockSummary,
      supervisorAudit
    });
  } catch (error) {
    console.error('Failed to fetch dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

reportRouter.get('/analytics', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const locationIdParam = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
    const locCondition = locationIdParam 
      ? sql`${locations.id} = ${locationIdParam}`
      : sql`1=1`;

    const locIds = await db.select({ id: locations.id }).from(locations)
      .where(and(eq(locations.userId, userId), eq(locations.isDeleted, 0), locCondition));
    const validLocIds = locIds.map(l => l.id);
    if (validLocIds.length === 0) {
      return res.json({ monthly: [], categories: [] });
    }
    const idList = validLocIds.join(',');

    const monthlyMap: Record<string, { month: string; Income: number; Expense: number }> = {};
    const getOrInitMonth = (m: string) => {
      if (!monthlyMap[m]) {
        monthlyMap[m] = { month: m, Income: 0, Expense: 0 };
      }
      return monthlyMap[m];
    };

    // Records
    const recordsRows = await db.execute(sql`
      SELECT substring(date from 1 for 7) as m, type, SUM(amount) as amt
      FROM records
      WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY m, type
    `);
    for (const r of recordsRows.rows) {
      if (!r.m) continue;
      const entry = getOrInitMonth(r.m as string);
      const amt = parseFloat(r.amt as string || '0');
      if (r.type === 'INCOME') entry.Income += amt;
      else if (r.type === 'EXPENSE') entry.Expense += amt;
    }

    // Material Supplies (Income)
    const msRows = await db.execute(sql`
      SELECT substring(date from 1 for 7) as m, SUM(total_amount) as amt
      FROM material_supplies
      WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY m
    `);
    for (const r of msRows.rows) {
      if (!r.m) continue;
      const entry = getOrInitMonth(r.m as string);
      entry.Income += parseFloat(r.amt as string || '0');
    }

    // Material Purchases (Expense)
    const mpRows = await db.execute(sql`
      SELECT substring(date from 1 for 7) as m, SUM(total_amount) as amt
      FROM material_purchases
      WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY m
    `);
    for (const r of mpRows.rows) {
      if (!r.m) continue;
      const entry = getOrInitMonth(r.m as string);
      entry.Expense += parseFloat(r.amt as string || '0');
    }

    // Material Labour Supplies (Expense)
    const mlsRows = await db.execute(sql`
      SELECT substring(date from 1 for 7) as m, SUM(total_amount) as amt
      FROM material_labour_supplies
      WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY m
    `);
    for (const r of mlsRows.rows) {
      if (!r.m) continue;
      const entry = getOrInitMonth(r.m as string);
      entry.Expense += parseFloat(r.amt as string || '0');
    }

    // Labour Salaries (Expense)
    const lsRows = await db.execute(sql`
      SELECT substring(date from 1 for 7) as m, SUM(net_salary) as amt
      FROM labour_salaries
      WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY m
    `);
    for (const r of lsRows.rows) {
      if (!r.m) continue;
      const entry = getOrInitMonth(r.m as string);
      entry.Expense += parseFloat(r.amt as string || '0');
    }

    // Supervisor Costs (Expense)
    const scRows = await db.execute(sql`
      SELECT substring(date from 1 for 7) as m, SUM(amount) as amt
      FROM supervisor_costs
      WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY m
    `);
    for (const r of scRows.rows) {
      if (!r.m) continue;
      const entry = getOrInitMonth(r.m as string);
      entry.Expense += parseFloat(r.amt as string || '0');
    }

    const monthly = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));

    // Categories Breakdown
    const catMap: Record<string, number> = {};
    const addCat = (name: string, amt: number) => {
      if (amt > 0) catMap[name] = (catMap[name] || 0) + amt;
    };

    const catRecords = await db.execute(sql`
      SELECT category, SUM(amount) as amt
      FROM records
      WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY category
    `);
    for (const r of catRecords.rows) {
      const name = (r.category as string) || 'General';
      addCat(name, parseFloat(r.amt as string || '0'));
    }

    const sumQuery = async (query: any) => {
      const res = await db.execute(query);
      return parseFloat(res.rows[0]?.tot as string || '0');
    };

    const mpTot = await sumQuery(sql`SELECT SUM(total_amount) as tot FROM material_purchases WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})`);
    addCat('Material Purchase', mpTot);

    const msTot = await sumQuery(sql`SELECT SUM(total_amount) as tot FROM material_supplies WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})`);
    addCat('Material Supply', msTot);

    const mlsTot = await sumQuery(sql`SELECT SUM(total_amount) as tot FROM material_labour_supplies WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})`);
    addCat('Site Supply', mlsTot);

    const lsTot = await sumQuery(sql`SELECT SUM(net_salary) as tot FROM labour_salaries WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})`);
    addCat('Labour Salary', lsTot);

    const scTot = await sumQuery(sql`SELECT SUM(amount) as tot FROM supervisor_costs WHERE user_id = ${userId} AND is_deleted = 0 AND location_id IN (${sql.raw(idList)})`);
    addCat('Supervisor Cost', scTot);

    const categories = Object.entries(catMap).map(([name, value]) => ({ name, value: Math.round(value) }));

    res.json({ monthly, categories });
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
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
    if (tab === 'all' || tab === 'supervisor-cost') {
      exportData.supervisorCosts = await db.select().from(supervisorCosts).where(and(eq(supervisorCosts.locationId, locationId), eq(supervisorCosts.userId, userId), eq(supervisorCosts.isDeleted, 0)));
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
    exportData.supervisorCosts = await db.select().from(supervisorCosts).where(and(eq(supervisorCosts.userId, userId), eq(supervisorCosts.isDeleted, 0)));

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
