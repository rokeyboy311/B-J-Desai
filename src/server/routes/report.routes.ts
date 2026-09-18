import express, { Response } from 'express';
import { db } from '../../db/index.js';
import { 
  locations, records, investmentParties, investmentTransactions,
  materialPurchases, materialSupplies,
  labourSalaries, supervisorCosts
} from '../../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { generateExcelBuffer } from '../lib/excel.js';

const reportRouter = express.Router();
reportRouter.use(requireAuth);

reportRouter.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const locationIdParam = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
    
    // Base location condition
    const locCondition = locationIdParam 
      ? sql`${locations.id} = ${locationIdParam}`
      : sql`1=1`;

    const locIds = await db.select({ id: locations.id }).from(locations)
      .where(and(eq(locations.isDeleted, 0), locCondition));
    const validLocIds = locIds.map(l => l.id);
    if (validLocIds.length === 0) {
      return res.json({
        totalIncome: 0, totalBillInvestment: 0, actualExpense: 0, totalRefundable: 0, totalRefunded: 0, pendingRefundable: 0, netIncome: 0,
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
      SELECT 
        type, 
        category,
        SUM(amount) as amt, 
        SUM(refundable_amount) as ref_amt, 
        SUM(refunded_amount) as refd_amt
      FROM records
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY type, category
    `);
    
    let totalIncome = 0, actualExpense = 0, totalRefundable = 0, totalRefunded = 0, totalBillInvestment = 0;
    for (const r of ieQuery.rows) {
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
    }
    const pendingRefundable = totalRefundable - totalRefunded;
    const netIncome = totalIncome - actualExpense;

    // 2. Investment
    const invQuery = await db.execute(sql`
      SELECT t.type, SUM(t.amount) as amt
      FROM investment_transactions t
      JOIN investment_parties p ON t.party_id = p.id
      WHERE t.is_deleted = 0 AND p.location_id IN (${sql.raw(idList)})
      GROUP BY t.type
    `);
    
    let totalInvestment = 0, totalInvestmentPayment = 0, totalInvestmentUpad = 0;
    for (const r of invQuery.rows) {
      const a = parseFloat(r.amt as string || '0');
      if (r.type === 'INVESTMENT' || r.type === 'CONTRIBUTION') totalInvestment += a;
      if (r.type === 'PAYMENT') totalInvestmentPayment += a;
      if (r.type === 'UPAD') totalInvestmentUpad += a;
    }
    const investmentBalance = totalInvestment - totalInvestmentPayment - totalInvestmentUpad;
    totalInvestment += totalBillInvestment;

    // 3. Material Purchase
    const mpQuery = await db.execute(sql`
      SELECT SUM(total_amount) as tot, SUM(paid_amount) as pd, SUM(outstanding_amount) as out
      FROM material_purchases
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
    `);
    const totalMaterialPurchase = parseFloat(mpQuery.rows[0]?.tot as string || '0');
    const totalMaterialPurchasePaid = parseFloat(mpQuery.rows[0]?.pd as string || '0');
    const totalMaterialPurchaseOutstanding = parseFloat(mpQuery.rows[0]?.out as string || '0');

    // 4. Material Supply
    const msQuery = await db.execute(sql`
      SELECT SUM(total_amount) as tot, SUM(paid_amount) as pd, SUM(outstanding_amount) as out
      FROM material_supplies
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
    `);
    const totalMaterialSupply = parseFloat(msQuery.rows[0]?.tot as string || '0');
    const totalMaterialSupplyPaid = parseFloat(msQuery.rows[0]?.pd as string || '0');
    const totalMaterialSupplyOutstanding = parseFloat(msQuery.rows[0]?.out as string || '0');

    // 5. Material Labour Supply
    const mlsQuery = await db.execute(sql`
      SELECT SUM(total_amount) as tot, 0 as pd, 0 as out
      FROM site_supplies
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
    `);
    const totalMaterialLabourSupply = parseFloat(mlsQuery.rows[0]?.tot as string || '0');
    const totalMaterialLabourSupplyPaid = parseFloat(mlsQuery.rows[0]?.pd as string || '0');
    const totalMaterialLabourSupplyOutstanding = parseFloat(mlsQuery.rows[0]?.out as string || '0');

    // 6. Labour Salary
    const lsQuery = await db.execute(sql`
      SELECT SUM(net_salary) as net, SUM(upad) as upad, SUM(payment_amount) as pd, SUM(balance) as bal
      FROM labour_salaries
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
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
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY month ORDER BY month
    `);

    // 7. Supervisor Costs
    const supQuery = await db.execute(sql`
      SELECT SUM(amount) as tot
      FROM supervisor_costs
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
    `);
    const totalSupervisorCost = parseFloat(supQuery.rows[0]?.tot as string || '0');

    // 8. Investor Parties Breakdown (Part 1)
    const invPartiesQuery = await db.execute(sql`
      SELECT 
        p.id, 
        p.party_name as "partyName",
        COALESCE(SUM(CASE WHEN t.type = 'INVESTMENT' OR t.type = 'CONTRIBUTION' THEN t.amount ELSE 0 END), 0) as "totalInvestment",
        COALESCE(SUM(CASE WHEN t.type = 'UPAD' THEN t.amount ELSE 0 END), 0) as "totalUpad",
        COALESCE(SUM(CASE WHEN t.type = 'PAYMENT' THEN t.amount ELSE 0 END), 0) as "totalPayment"
      FROM investment_parties p
      LEFT JOIN investment_transactions t ON t.party_id = p.id AND t.is_deleted = 0
      WHERE p.is_deleted = 0 AND p.location_id IN (${sql.raw(idList)})
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
    const netCapitalPool = Math.round((totalInvestment - totalInvestmentUpad + totalMaterialSupplyPaid) * 100) / 100;
    const materialPurchaseExpense = totalMaterialPurchase;
    const siteSupplyExpense = totalMaterialLabourSupply;
    const labourSalaryExpense = Math.round((labourMetrics.totalPayment + labourMetrics.totalUpad) * 100) / 100;
    const generalExpense = actualExpense;
    const totalExpensesCut = Math.round((materialPurchaseExpense + labourSalaryExpense + generalExpense) * 100) / 100;
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

    // 10. Live Stock Inventory Summary (From Canonical Stock Ledger)
    const stockQuery = await db.execute(sql`
      SELECT 
        m.id as "materialId",
        m.name as "materialName", 
        m.default_unit as "unit", 
        SUM(CASE WHEN l.transaction_type = 'IN' THEN CAST(ABS(l.quantity) AS DECIMAL) ELSE 0 END) as "purchasedQty",
        SUM(CASE WHEN l.transaction_type = 'OUT' AND l.reference_type = 'MATERIAL_SUPPLY' THEN CAST(ABS(l.quantity) AS DECIMAL) ELSE 0 END) as "otherSupplyQty",
        SUM(CASE WHEN l.transaction_type = 'OUT' AND l.reference_type = 'SITE_SUPPLY' THEN CAST(ABS(l.quantity) AS DECIMAL) ELSE 0 END) as "siteSupplyQty",
        SUM(CASE WHEN l.transaction_type = 'OUT' AND l.reference_type NOT IN ('MATERIAL_SUPPLY', 'SITE_SUPPLY') THEN CAST(ABS(l.quantity) AS DECIMAL) ELSE 0 END) as "miscOutQty",
        (SELECT SUM(total_amount) FROM material_purchases mp WHERE mp.material_id = m.id AND mp.is_deleted = 0 AND mp.location_id IN (${sql.raw(idList)})) as "totalValue"
      FROM stock_ledger l
      JOIN materials m ON l.material_id = m.id
      WHERE l.location_id IN (${sql.raw(idList)}) AND (l.is_deleted = 0 OR l.is_deleted IS NULL)
      GROUP BY m.id, m.name, m.default_unit
    `);
    
    const stockItems = stockQuery.rows.map((row: any) => {
      const purchasedQty = parseFloat(row.purchasedQty || '0');
      const otherSupplyQty = parseFloat(row.otherSupplyQty || '0');
      const siteSupplyQty = parseFloat(row.siteSupplyQty || '0');
      const miscOutQty = parseFloat(row.miscOutQty || '0');
      const totalSupplied = otherSupplyQty + siteSupplyQty + miscOutQty;
      const currentStock = Math.round((purchasedQty - totalSupplied) * 100) / 100;
      
      const totalValue = parseFloat(row.totalValue || '0');
      const avgRate = purchasedQty > 0 ? (totalValue / purchasedQty) : 0;
      const valuation = Math.max(0, Math.round(currentStock * avgRate * 100) / 100);
      
      let status = 'IN_STOCK';
      if (currentStock <= 0) status = 'OUT_OF_STOCK';
      else if (currentStock <= 15) status = 'LOW_STOCK';
      
      return {
        materialName: row.materialName,
        unit: row.unit || 'Unit',
        purchasedQty,
        otherSupplyQty,
        siteSupplyQty,
        currentStock,
        valuation,
        status
      };
    });

    const totalDistinctMaterials = stockItems.length;
    const totalStockUnits = stockItems.reduce((acc: number, s: any) => acc + (s.currentStock > 0 ? s.currentStock : 0), 0);
    const totalStockValuation = stockItems.reduce((acc: number, s: any) => acc + s.valuation, 0);
    const lowStockCount = stockItems.filter((s: any) => s.status === 'LOW_STOCK' || s.status === 'OUT_OF_STOCK').length;
    const stockSummary = {
      items: stockItems,
      totalDistinctMaterials,
      totalStockUnits,
      totalStockValuation,
      lowStockCount
    };

    const variance = Math.round((totalSupervisorCost - siteSupplyExpense) * 100) / 100;
    const supervisorAudit = {
      totalSupervisorCost,
      totalSiteSupply: siteSupplyExpense,
      variance,
      reconciliationStatus: Math.abs(variance) < 0.01 ? 'MATCHED' : (variance > 0 ? 'SURPLUS' : 'DEFICIT')
    };

    res.json({
      totalIncome, totalBillInvestment, actualExpense, totalRefundable, totalRefunded, pendingRefundable, netIncome,
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

reportRouter.get('/stock', async (req: AuthRequest, res: Response) => {
  try {
    const locationId = req.query.locationId ? parseInt(req.query.locationId as string, 10) : undefined;
    const locCondition = locationId ? sql`s.location_id = ${locationId}` : sql`1=1`;

    const stockEntries = await db.execute(sql`
      SELECT 
        s.id,
        s.location_id as "locationId",
        s.material_id as "materialId",
        COALESCE(m.name, s.notes, 'Material') as "materialName",
        COALESCE(m.default_unit, 'Unit') as "unit",
        s.transaction_type as "transactionType",
        s.quantity,
        s.reference_type as "referenceType",
        s.reference_id as "referenceId",
        s.notes,
        s.created_at as "createdAt"
      FROM stock_ledger s
      LEFT JOIN materials m ON s.material_id = m.id
      WHERE ${locCondition} AND (s.is_deleted = 0 OR s.is_deleted IS NULL)
      ORDER BY s.created_at DESC, s.id DESC
    `);

    res.json(stockEntries.rows);
  } catch (error) {
    console.error('Failed to fetch stock records:', error);
    res.status(500).json({ error: 'Failed to fetch stock records' });
  }
});

reportRouter.get('/reconciliation', async (req: AuthRequest, res: Response) => {
  try {
    const siteSupplyQuery = await db.execute(sql`
      SELECT s.location_id as "locationId", l.name as "locationName", s.team_id as "teamId", t.name as "teamName", SUM(s.total_amount) as "totalSiteSupply"
      FROM site_supplies s
      LEFT JOIN locations l ON s.location_id = l.id
      LEFT JOIN labour_teams t ON s.team_id = t.id
      WHERE s.is_deleted = 0
      GROUP BY s.location_id, l.name, s.team_id, t.name
    `);
    
    const supQuery = await db.execute(sql`
      SELECT c.location_id as "locationId", l.name as "locationName", SUM(c.amount) as "totalSupervisorCost"
      FROM supervisor_costs c
      LEFT JOIN locations l ON c.location_id = l.id
      WHERE c.is_deleted = 0
      GROUP BY c.location_id, l.name
    `);
    
    const locationsMap = new Map();
    
    supQuery.rows.forEach((r: any) => {
      const locId = Number(r.locationId);
      if (!locationsMap.has(locId)) {
        locationsMap.set(locId, {
          locationId: locId,
          locationName: r.locationName || 'Unknown Location',
          totalSupervisorCost: 0,
          totalSiteSupply: 0,
          teams: []
        });
      }
      locationsMap.get(locId).totalSupervisorCost += parseFloat(r.totalSupervisorCost as string || '0');
    });
    
    siteSupplyQuery.rows.forEach((r: any) => {
      const locId = Number(r.locationId);
      if (!locationsMap.has(locId)) {
        locationsMap.set(locId, {
          locationId: locId,
          locationName: r.locationName || 'Unknown Location',
          totalSupervisorCost: 0,
          totalSiteSupply: 0,
          teams: []
        });
      }
      const loc = locationsMap.get(locId);
      const supplyAmt = parseFloat(r.totalSiteSupply as string || '0');
      loc.totalSiteSupply += supplyAmt;
      
      loc.teams.push({
        teamId: Number(r.teamId),
        teamName: r.teamName || 'Unassigned / Independent',
        siteSupplyValue: supplyAmt
      });
    });
    
    const results = Array.from(locationsMap.values()).map(loc => {
      const variance = loc.totalSupervisorCost - loc.totalSiteSupply;
      let status = 'MATCHED';
      if (Math.abs(variance) > 1) {
        status = variance > 0 ? 'SUPERVISOR_SURPLUS' : 'SITE_EXCESS';
      }
      return {
        ...loc,
        variance,
        reconciliationStatus: status
      };
    });
    
    res.json(results);
  } catch (error) {
    console.error('Reconciliation report error:', error);
    res.status(500).json({ error: 'Failed to generate reconciliation report' });
  }
});

reportRouter.get('/analytics', async (req: AuthRequest, res: Response) => {
  try {
    const locationIdParam = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
    const locCondition = locationIdParam 
      ? sql`${locations.id} = ${locationIdParam}`
      : sql`1=1`;

    const locIds = await db.select({ id: locations.id }).from(locations)
      .where(and(eq(locations.isDeleted, 0), locCondition));
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
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
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
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
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
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY m
    `);
    for (const r of mpRows.rows) {
      if (!r.m) continue;
      const entry = getOrInitMonth(r.m as string);
      entry.Expense += parseFloat(r.amt as string || '0');
    }

    // Site Supplies (Expense)
    const mlsRows = await db.execute(sql`
      SELECT substring(date from 1 for 7) as m, SUM(total_amount) as amt
      FROM site_supplies
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
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
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
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
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
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
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
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

    const mpTot = await sumQuery(sql`SELECT SUM(total_amount) as tot FROM material_purchases WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})`);
    addCat('Material Purchase', mpTot);

    const msTot = await sumQuery(sql`SELECT SUM(total_amount) as tot FROM material_supplies WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})`);
    addCat('Material Supply', msTot);

    const mlsTot = await sumQuery(sql`SELECT SUM(total_amount) as tot FROM site_supplies WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})`);
    addCat('Site Supply', mlsTot);

    const lsTot = await sumQuery(sql`SELECT SUM(net_salary) as tot FROM labour_salaries WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})`);
    addCat('Labour Salary', lsTot);

    const scTot = await sumQuery(sql`SELECT SUM(amount) as tot FROM supervisor_costs WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})`);
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
    const tab = req.query.tab as string || 'all';

    const locResult = await db.select().from(locations).where(and(eq(locations.id, locationId), eq(locations.isDeleted, 0)));
    if (!locResult.length) return res.status(404).json({ error: 'Location not found' });
    const locationName = locResult[0].name;

    const exportData: any = {};
    if (tab === 'all' || tab === 'expense' || tab === 'income-expense') {
      exportData.incomeExpense = await db.select().from(records).where(and(eq(records.locationId, locationId), eq(records.isDeleted, 0)));
    }
    if (tab === 'all' || tab === 'investment') {
      exportData.investments = await db.select({
        date: investmentTransactions.date, type: investmentTransactions.type, amount: investmentTransactions.amount,
        description: investmentTransactions.description, paymentMethod: investmentTransactions.paymentMethod,
        referenceNumber: investmentTransactions.referenceNumber, partyName: investmentParties.partyName
      }).from(investmentTransactions).innerJoin(investmentParties, eq(investmentTransactions.partyId, investmentParties.id))
      .where(and(eq(investmentParties.locationId, locationId), eq(investmentTransactions.isDeleted, 0)));
    }
    if (tab === 'all' || tab === 'material-purchase') {
      exportData.purchases = await db.select().from(materialPurchases).where(and(eq(materialPurchases.locationId, locationId), eq(materialPurchases.isDeleted, 0)));
    }
    if (tab === 'all' || tab === 'material-supply') {
      exportData.supplies = await db.select().from(materialSupplies).where(and(eq(materialSupplies.locationId, locationId), eq(materialSupplies.isDeleted, 0)));
    }
    if (tab === 'all' || tab === 'material-labour-supply') {
      exportData.siteSupplies = await db.execute(sql`SELECT s.*, i.material_id, i.quantity, i.rate, i.amount as item_amount FROM site_supplies s LEFT JOIN site_supply_items i ON s.id = i.site_supply_id WHERE s.location_id = ${locationId} AND s.is_deleted = 0`).then(res => res.rows);
    }
    if (tab === 'all' || tab === 'labour-salary') {
      exportData.salaries = await db.select().from(labourSalaries).where(and(eq(labourSalaries.locationId, locationId), eq(labourSalaries.isDeleted, 0)));
    }
    if (tab === 'all' || tab === 'supervisor-cost') {
      exportData.supervisorCosts = await db.select().from(supervisorCosts).where(and(eq(supervisorCosts.locationId, locationId), eq(supervisorCosts.isDeleted, 0)));
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
    const exportData: any = {};
    
    exportData.incomeExpense = await db.select().from(records).where(eq(records.isDeleted, 0));
    exportData.investments = await db.select({
      date: investmentTransactions.date, type: investmentTransactions.type, amount: investmentTransactions.amount,
      description: investmentTransactions.description, paymentMethod: investmentTransactions.paymentMethod,
      referenceNumber: investmentTransactions.referenceNumber, partyName: investmentParties.partyName
    }).from(investmentTransactions).innerJoin(investmentParties, eq(investmentTransactions.partyId, investmentParties.id))
    .where(eq(investmentTransactions.isDeleted, 0));
    
    exportData.purchases = await db.select().from(materialPurchases).where(eq(materialPurchases.isDeleted, 0));
    exportData.supplies = await db.select().from(materialSupplies).where(eq(materialSupplies.isDeleted, 0));
    exportData.siteSupplies = await db.execute(sql`SELECT s.*, i.material_id, i.quantity, i.rate, i.amount as item_amount FROM site_supplies s LEFT JOIN site_supply_items i ON s.id = i.site_supply_id WHERE s.is_deleted = 0`).then(res => res.rows);
    exportData.salaries = await db.select().from(labourSalaries).where(eq(labourSalaries.isDeleted, 0));
    exportData.supervisorCosts = await db.select().from(supervisorCosts).where(eq(supervisorCosts.isDeleted, 0));

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
