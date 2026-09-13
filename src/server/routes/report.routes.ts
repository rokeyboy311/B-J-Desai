import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { getRecords, getRecordMetrics, getAllRecords } from '../../db/records.ts';
import { db } from '../../db/index.ts';
import { 
  locations, records, investmentTransactions, investmentParties,
  materialPurchases, materialSupplies, materialLabourSupplies, labourSalaries, supervisorCosts, materialStockAdjustments
} from '../../db/schema.ts';
import { eq, and, sql } from 'drizzle-orm';
import { generateExcelBuffer } from '../lib/excel.ts';

const reportRouter = Router();
reportRouter.use(requireAuth);

reportRouter.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const locResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(locations)
      .where(and(eq(locations.userId, userId), eq(locations.isDeleted, 0)));
    const totalLocations = locResult[0].count;

    // 1. Income & Expense
    const ieMetrics = await db.select({
      type: records.type,
      total: sql<string>`sum(${records.amount})`,
      totalRefundable: sql<string>`sum(${records.refundableAmount})`,
      totalRefunded: sql<string>`sum(${records.refundedAmount})`,
    })
    .from(records)
    .where(and(eq(records.userId, userId), eq(records.isDeleted, 0)))
    .groupBy(records.type);

    let totalIncome = 0;
    let grossExpense = 0;
    let totalRefundable = 0;
    let totalRefunded = 0;

    ieMetrics.forEach(row => {
      if (row.type === 'INCOME') totalIncome += parseFloat(row.total || '0');
      if (row.type === 'EXPENSE') {
        grossExpense += parseFloat(row.total || '0');
        totalRefundable += parseFloat(row.totalRefundable || '0');
        totalRefunded += parseFloat(row.totalRefunded || '0');
      }
    });
    const totalExpense = grossExpense - totalRefundable;
    const netIncome = totalIncome - totalExpense;
    const pendingRefundable = totalRefundable - totalRefunded;

    // 2. Investment
    const invMetrics = await db.select({
      type: investmentTransactions.type,
      total: sql<string>`sum(${investmentTransactions.amount})`
    })
    .from(investmentTransactions)
    .where(and(eq(investmentTransactions.userId, userId), eq(investmentTransactions.isDeleted, 0)))
    .groupBy(investmentTransactions.type);
    
    let totalInvestment = 0, totalInvestmentPayment = 0, totalInvestmentUpad = 0;
    invMetrics.forEach(row => {
      if (row.type === 'INVESTMENT') totalInvestment += parseFloat(row.total || '0');
      if (row.type === 'PAYMENT') totalInvestmentPayment += parseFloat(row.total || '0');
      if (row.type === 'UPAD') totalInvestmentUpad += parseFloat(row.total || '0');
    });

    // 3. Materials
    const matPurResult = await db.select({ total: sql<string>`sum(${materialPurchases.totalAmount})` }).from(materialPurchases).where(and(eq(materialPurchases.userId, userId), eq(materialPurchases.isDeleted, 0)));
    const totalMaterialPurchase = parseFloat(matPurResult[0].total || '0');
    
    const matSupResult = await db.select({ total: sql<string>`sum(${materialSupplies.totalAmount})` }).from(materialSupplies).where(and(eq(materialSupplies.userId, userId), eq(materialSupplies.isDeleted, 0)));
    const totalMaterialSupply = parseFloat(matSupResult[0].total || '0');

    const matLabResult = await db.select({ total: sql<string>`sum(${materialLabourSupplies.totalAmount})` }).from(materialLabourSupplies).where(and(eq(materialLabourSupplies.userId, userId), eq(materialLabourSupplies.isDeleted, 0)));
    const totalMaterialLabourSupply = parseFloat(matLabResult[0].total || '0');

    // 4. Labour Salaries
    const labResult = await db.select({
      totalNetSalary: sql<string>`sum(${labourSalaries.netSalary})`,
      totalUpad: sql<string>`sum(${labourSalaries.upad})`,
      totalPayment: sql<string>`sum(${labourSalaries.paymentAmount})`,
      totalBalance: sql<string>`sum(${labourSalaries.balance})`
    }).from(labourSalaries).where(and(eq(labourSalaries.userId, userId), eq(labourSalaries.isDeleted, 0)));
    
    
    // Labour Attendance Analytics
    const rawLabourAtt = await db.select({
      month: sql<string>`substring(${labourSalaries.date}, 1, 7)`,
      team: labourSalaries.labourTeam,
      name: labourSalaries.labourName,
      attendanceType: labourSalaries.attendanceType,
      days: sql<string>`sum(${labourSalaries.days})`,
    }).from(labourSalaries)
    .where(and(eq(labourSalaries.userId, userId), eq(labourSalaries.isDeleted, 0)))
    .groupBy(
      sql`substring(${labourSalaries.date}, 1, 7)`,
      labourSalaries.labourTeam,
      labourSalaries.labourName,
      labourSalaries.attendanceType
    );

    const labourMetrics = {
      totalNetSalary: parseFloat(labResult[0].totalNetSalary || '0'),
      totalUpad: parseFloat(labResult[0].totalUpad || '0'),
      totalPayment: parseFloat(labResult[0].totalPayment || '0'),
      totalBalance: parseFloat(labResult[0].totalBalance || '0'),
    };

    // 5. Supervisor Costs
    const supervisorResult = await db.select({ total: sql<string>`sum(${supervisorCosts.amount})` })
      .from(supervisorCosts).where(and(eq(supervisorCosts.userId, userId), eq(supervisorCosts.isDeleted, 0)));
    const totalSupervisorCost = parseFloat(supervisorResult[0].total || '0');

    // 6. Material Stock
    const purQuantities = await db.select({
      materialName: materialPurchases.materialName,
      unit: materialPurchases.unit,
      totalQuantity: sql<string>`sum(${materialPurchases.quantity})`
    }).from(materialPurchases).where(and(eq(materialPurchases.userId, userId), eq(materialPurchases.isDeleted, 0)))
      .groupBy(materialPurchases.materialName, materialPurchases.unit);

    const supQuantities = await db.select({
      materialName: materialSupplies.materialName,
      unit: materialSupplies.unit,
      totalQuantity: sql<string>`sum(${materialSupplies.quantity})`
    }).from(materialSupplies).where(and(eq(materialSupplies.userId, userId), eq(materialSupplies.isDeleted, 0)))
      .groupBy(materialSupplies.materialName, materialSupplies.unit);

    const adjustments = await db.select({
      materialName: materialStockAdjustments.materialName,
      totalAdjustment: sql<string>`sum(${materialStockAdjustments.adjustment})`
    }).from(materialStockAdjustments).where(eq(materialStockAdjustments.userId, userId))
      .groupBy(materialStockAdjustments.materialName);
      
    const stockMap = new Map();
    purQuantities.forEach(row => {
      const name = (row.materialName || '').trim();
      const lowerName = name.toLowerCase();
      if (!stockMap.has(lowerName)) stockMap.set(lowerName, { originalName: name, unit: row.unit || '', purchased: 0, supplied: 0, adjusted: 0, currentStock: 0 });
      stockMap.get(lowerName).purchased += parseFloat(row.totalQuantity || '0');
      stockMap.get(lowerName).currentStock += parseFloat(row.totalQuantity || '0');
    });

    supQuantities.forEach(row => {
      const name = (row.materialName || '').trim();
      const lowerName = name.toLowerCase();
      if (!stockMap.has(lowerName)) stockMap.set(lowerName, { originalName: name, unit: row.unit || '', purchased: 0, supplied: 0, adjusted: 0, currentStock: 0 });
      stockMap.get(lowerName).supplied += parseFloat(row.totalQuantity || '0');
      stockMap.get(lowerName).currentStock -= parseFloat(row.totalQuantity || '0');
    });

    adjustments.forEach(row => {
      const name = (row.materialName || '').trim();
      const lowerName = name.toLowerCase();
      if (!stockMap.has(lowerName)) stockMap.set(lowerName, { originalName: name, unit: '', purchased: 0, supplied: 0, adjusted: 0, currentStock: 0 });
      const adj = parseFloat(row.totalAdjustment || '0');
      stockMap.get(lowerName).adjusted += adj;
      stockMap.get(lowerName).currentStock += adj;
    });

    const materialStock = Array.from(stockMap.values());

    res.json({
      totalLocations,
      totalIncome,
      totalExpense,
      totalRefundable,
      totalRefunded,
      pendingRefundable,
      netIncome,
      totalInvestment,
      totalInvestmentPayment,
      totalInvestmentUpad,
      totalMaterialPurchase,
      totalMaterialSupply,
      totalMaterialLabourSupply,
      labourMetrics,
      rawLabourAtt,
      totalSupervisorCost,
      materialStock
    });
  } catch (error) {
    console.error('Failed to fetch dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

reportRouter.post('/adjust-stock', async (req: AuthRequest, res: Response) => {
  try {
    const { materialName, adjustment } = req.body;
    
    if (!materialName || adjustment === undefined) {
      return res.status(400).json({ error: 'materialName and adjustment are required' });
    }

    await db.insert(materialStockAdjustments).values({
      userId: req.dbUser!.id,
      materialName: materialName.trim(),
      adjustment: adjustment.toString()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to adjust stock:', error);
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
});

reportRouter.get('/analytics', async (req: AuthRequest, res: Response) => {
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
      const recs = await db.select().from(records).where(and(eq(records.locationId, locationId), eq(records.userId, userId), eq(records.isDeleted, 0)));
      exportData.incomeExpense = recs;
    }

    if (tab === 'all' || tab === 'investment') {
      const invs = await db.select({
        date: investmentTransactions.date,
        type: investmentTransactions.type,
        amount: investmentTransactions.amount,
        description: investmentTransactions.description,
        paymentMethod: investmentTransactions.paymentMethod,
        referenceNumber: investmentTransactions.referenceNumber,
        partyName: investmentParties.partyName
      })
      .from(investmentTransactions)
      .innerJoin(investmentParties, eq(investmentTransactions.partyId, investmentParties.id))
      .where(and(eq(investmentParties.locationId, locationId), eq(investmentTransactions.userId, userId), eq(investmentTransactions.isDeleted, 0)));
      exportData.investments = invs;
    }

    if (tab === 'all' || tab === 'expense' || tab === 'material-purchase') {
      const purs = await db.select().from(materialPurchases).where(and(eq(materialPurchases.locationId, locationId), eq(materialPurchases.userId, userId), eq(materialPurchases.isDeleted, 0)));
      exportData.purchases = purs;
    }

    if (tab === 'all' || tab === 'expense' || tab === 'material-supply') {
      const sups = await db.select().from(materialSupplies).where(and(eq(materialSupplies.locationId, locationId), eq(materialSupplies.userId, userId), eq(materialSupplies.isDeleted, 0)));
      exportData.supplies = sups;
    }

    if (tab === 'all' || tab === 'expense' || tab === 'material-labour-supply') {
      const mlabs = await db.select().from(materialLabourSupplies).where(and(eq(materialLabourSupplies.locationId, locationId), eq(materialLabourSupplies.userId, userId), eq(materialLabourSupplies.isDeleted, 0)));
      exportData.labourSupplies = mlabs;
    }

    if (tab === 'all' || tab === 'expense' || tab === 'labour-salary') {
      const sals = await db.select().from(labourSalaries).where(and(eq(labourSalaries.locationId, locationId), eq(labourSalaries.userId, userId), eq(labourSalaries.isDeleted, 0)));
      exportData.salaries = sals;
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
  res.status(500).json({ error: 'Not implemented yet' });
});

export default reportRouter;
