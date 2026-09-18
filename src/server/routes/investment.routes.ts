import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { 
  investmentParties, investmentTransactions, auditLogs,
  materialPurchases, materialSupplies, siteSupplies,
  labourSalaries, supervisorCosts, records
} from '../../db/schema.ts';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

const investmentRouter = Router();
investmentRouter.use(requireAuth);

const partySchema = z.object({
  locationId: z.number().int().positive(),
  partyName: z.string().min(1).max(100),
  initialAmount: z.union([z.number(), z.string()]).transform(Number).optional(),
  initialDate: z.string().optional()
});

const txSchema = z.object({
  partyId: z.number().int().positive(),
  type: z.enum(['INVESTMENT', 'UPAD', 'PAYMENT', 'CONTRIBUTION']),
  amount: z.union([z.number().positive(), z.string().regex(/^\d+(\.\d{1,2})?$/)]).transform(Number),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
});

investmentRouter.get('/parties', async (req: AuthRequest, res: Response) => {
  try {
    const locationId = parseInt(req.query.locationId as string, 10);
    if (isNaN(locationId)) return res.status(400).json({ error: 'locationId is required' });

    const parties = await db.select().from(investmentParties).where(
      and(
        eq(investmentParties.locationId, locationId),
        eq(investmentParties.isDeleted, 0)
      )
    ).orderBy(desc(investmentParties.createdAt));

    // Get metrics for each party
    const partyIds = parties.map(p => p.id);
    let metrics: any[] = [];
    if (partyIds.length > 0) {
      metrics = await db.select({
        partyId: investmentTransactions.partyId,
        type: investmentTransactions.type,
        total: sql<string>`sum(${investmentTransactions.amount})`
      })
      .from(investmentTransactions)
      .where(and(
        sql`${investmentTransactions.partyId} IN (${sql.join(partyIds, sql`, `)})`,
        eq(investmentTransactions.isDeleted, 0)
      ))
      .groupBy(investmentTransactions.partyId, investmentTransactions.type);
    }

    const result = parties.map(p => {
      let totalInvestment = 0;
      let totalPayment = 0;
      let totalUpad = 0;
      let totalContribution = 0;
      
      metrics.filter(m => m.partyId === p.id).forEach(m => {
        if (m.type === 'CONTRIBUTION') totalContribution += parseFloat(m.total || '0');
        if (m.type === 'INVESTMENT') totalInvestment += parseFloat(m.total || '0');
        if (m.type === 'PAYMENT') totalPayment += parseFloat(m.total || '0');
        if (m.type === 'UPAD') totalUpad += parseFloat(m.total || '0');
      });

      return {
        ...p,
        totalInvestment,
        totalPayment,
        totalUpad,
        totalContribution,
        // Category 1 rule: An investor's balance cuts when money is invested into projects ("investment karya") or taken as upad
        balance: Math.round((totalContribution - totalInvestment - totalPayment - totalUpad) * 100) / 100
      };
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch investment parties' });
  }
});

investmentRouter.post('/parties', async (req: AuthRequest, res: Response) => {
  try {
    const data = partySchema.parse(req.body);
    const userId = req.dbUser?.id || 1;
    const result = await db.insert(investmentParties).values({
      userId,
      locationId: data.locationId,
      partyName: data.partyName
    }).returning();
    
    await db.insert(auditLogs).values({
      userId,
      action: 'CREATE_INVESTMENT_PARTY',
      entityType: 'INVESTMENT',
      entityId: result[0].id,
      metadata: JSON.stringify({ partyName: data.partyName })
    });

    if (data.initialAmount && data.initialAmount > 0) {
      const txResult = await db.insert(investmentTransactions).values({
        userId,
        partyId: result[0].id,
        type: 'CONTRIBUTION',
        amount: data.initialAmount.toString(),
        date: data.initialDate || new Date().toISOString().split('T')[0],
        description: 'Initial Contribution',
        paymentMethod: 'Cash'
      }).returning();
      
      await db.insert(auditLogs).values({
        userId,
        action: 'CREATE_CONTRIBUTION',
        entityType: 'INVESTMENT',
        entityId: txResult[0].id,
        metadata: JSON.stringify({ partyId: result[0].id, amount: data.initialAmount, type: 'CONTRIBUTION' })
      });
    }
    
    res.json(result[0]);
  } catch (error) {
    res.status(400).json({ error: 'Validation failed' });
  }
});

investmentRouter.put('/parties/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const { partyName } = req.body;
    if (!partyName || typeof partyName !== 'string') return res.status(400).json({ error: 'Party name required' });

    const [updated] = await db.update(investmentParties)
      .set({ partyName: partyName.trim(), updatedAt: new Date() })
      .where(and(eq(investmentParties.id, id), eq(investmentParties.isDeleted, 0)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Party not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update party' });
  }
});

investmentRouter.get('/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const partyId = req.query.partyId ? parseInt(req.query.partyId as string, 10) : undefined;
    const locationId = req.query.locationId ? parseInt(req.query.locationId as string, 10) : undefined;
    const type = req.query.type as string | undefined;

    const conditions = [
      eq(investmentTransactions.isDeleted, 0)
    ];

    if (partyId && !isNaN(partyId)) {
      conditions.push(eq(investmentTransactions.partyId, partyId));
    }
    if (type && (type === 'INVESTMENT' || type === 'UPAD' || type === 'PAYMENT' || type === 'CONTRIBUTION')) {
      conditions.push(eq(investmentTransactions.type, type as any));
    }
    if (locationId && !isNaN(locationId)) {
      conditions.push(eq(investmentParties.locationId, locationId));
    }

    const txs = await db.select({
      id: investmentTransactions.id,
      partyId: investmentTransactions.partyId,
      userId: investmentTransactions.userId,
      type: investmentTransactions.type,
      amount: investmentTransactions.amount,
      date: investmentTransactions.date,
      description: investmentTransactions.description,
      paymentMethod: investmentTransactions.paymentMethod,
      referenceNumber: investmentTransactions.referenceNumber,
      createdAt: investmentTransactions.createdAt,
      partyName: investmentParties.partyName,
      locationId: investmentParties.locationId
    })
    .from(investmentTransactions)
    .innerJoin(investmentParties, eq(investmentTransactions.partyId, investmentParties.id))
    .where(and(...conditions))
    .orderBy(desc(investmentTransactions.date), desc(investmentTransactions.id));
    
    res.json(txs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

investmentRouter.post('/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const data = txSchema.parse(req.body);
    const userId = req.dbUser?.id || 1;
    const result = await db.insert(investmentTransactions).values({
      userId,
      partyId: data.partyId,
      type: data.type,
      amount: data.amount.toString(),
      date: data.date,
      description: data.description,
      paymentMethod: data.paymentMethod,
      referenceNumber: data.referenceNumber
    }).returning();

    await db.insert(auditLogs).values({
      userId,
      action: `CREATE_${data.type}`,
      entityType: 'INVESTMENT',
      entityId: result[0].id,
      metadata: JSON.stringify({ partyId: data.partyId, amount: data.amount, type: data.type })
    });
    
    res.json(result[0]);
  } catch (error) {
    res.status(400).json({ error: 'Validation failed' });
  }
});

investmentRouter.put('/transactions/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const data = txSchema.parse(req.body);
    const userId = req.dbUser?.id || 1;

    const [updated] = await db.update(investmentTransactions)
      .set({
        partyId: data.partyId,
        type: data.type,
        amount: data.amount.toString(),
        date: data.date,
        description: data.description,
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber,
      })
      .where(and(
        eq(investmentTransactions.id, id),
        eq(investmentTransactions.isDeleted, 0)
      ))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Transaction not found' });

    await db.insert(auditLogs).values({
      userId,
      action: `UPDATE_${data.type}`,
      entityType: 'INVESTMENT',
      entityId: id,
      metadata: JSON.stringify({ partyId: data.partyId, amount: data.amount, type: data.type })
    });

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: 'Validation failed' });
  }
});

investmentRouter.delete('/transactions/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const userId = req.dbUser?.id || 1;

    await db.update(investmentTransactions)
      .set({ isDeleted: 1 })
      .where(eq(investmentTransactions.id, id));

    await db.insert(auditLogs).values({
      userId,
      action: 'DELETE_INVESTMENT_TRANSACTION',
      entityType: 'INVESTMENT',
      entityId: id,
      metadata: JSON.stringify({ transactionId: id })
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

investmentRouter.delete('/parties/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const userId = req.dbUser?.id || 1;

    await db.update(investmentParties)
      .set({ isDeleted: 1 })
      .where(eq(investmentParties.id, id));

    await db.update(investmentTransactions)
      .set({ isDeleted: 1 })
      .where(eq(investmentTransactions.partyId, id));

    await db.insert(auditLogs).values({
      userId,
      action: 'DELETE_INVESTMENT_PARTY',
      entityType: 'INVESTMENT',
      entityId: id,
      metadata: JSON.stringify({ partyId: id })
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete party' });
  }
});

// Category 2 Linkage: Project Investment Capital & Categories 3, 4, 5, 6, 7 Linked Utilization
investmentRouter.get('/project-utilization', async (req: AuthRequest, res: Response) => {
  try {
    const locationId = parseInt(req.query.locationId as string, 10);
    if (isNaN(locationId)) return res.status(400).json({ error: 'locationId is required' });

    // 1. Investment Capital from Investors (INVESTMENT type) & Upad
    const invTxs = await db.select({
      type: investmentTransactions.type,
      total: sql<string>`sum(${investmentTransactions.amount})`,
      count: sql<number>`count(*)`
    })
    .from(investmentTransactions)
    .innerJoin(investmentParties, eq(investmentTransactions.partyId, investmentParties.id))
    .where(and(
      eq(investmentParties.locationId, locationId),
      eq(investmentTransactions.isDeleted, 0),
      eq(investmentParties.isDeleted, 0)
    ))
    .groupBy(investmentTransactions.type);

    let fromInvestmentKarya = 0;
    let fromContributions = 0;
    let returnsToInvestors = 0;
    invTxs.forEach(t => {
      const amt = parseFloat(t.total || '0');
      if (t.type === 'INVESTMENT') fromInvestmentKarya += amt;
      else if (t.type === 'CONTRIBUTION') fromContributions += amt;
      else if (t.type === 'UPAD' || t.type === 'PAYMENT') returnsToInvestors += amt;
    });
    const fromInvestors = Math.round((fromInvestmentKarya + fromContributions) * 100) / 100;

    // 2. Bill Investments (Material/Asset invoices recorded as Investment Inflows)
    const billRecords = await db.select({
      total: sql<string>`sum(${records.amount})`,
      count: sql<number>`count(*)`
    })
    .from(records)
    .where(and(
      eq(records.locationId, locationId),
      eq(records.isDeleted, 0),
      eq(records.type, 'INCOME'),
      eq(records.category, 'BILL_INVESTMENT')
    ));

    const fromBills = parseFloat(billRecords[0]?.total || '0');
    const billCount = Number(billRecords[0]?.count || 0);

    // 1st category capital is separate (investors' personal pool) and 2nd category capital is separate:
    // Category 2 Capital is strictly "Investment from Investors Capital" (amount cut from investors in Cat 1 to fund this project)
    const investmentFromInvestorsCapital = Math.round((fromInvestmentKarya + fromContributions) * 100) / 100;
    const netInvestmentCapital = Math.round((investmentFromInvestorsCapital - returnsToInvestors) * 100) / 100;

    // 3. Category 3: Material Purchases
    const matPurchases = await db.select({
      total: sql<string>`sum(${materialPurchases.totalAmount})`,
      paid: sql<string>`sum(${materialPurchases.paidAmount})`,
      outstanding: sql<string>`sum(${materialPurchases.outstandingAmount})`,
      count: sql<number>`count(*)`
    })
    .from(materialPurchases)
    .where(and(
      eq(materialPurchases.locationId, locationId),
      eq(materialPurchases.isDeleted, 0)
    ));

    const cat3Total = parseFloat(matPurchases[0]?.total || '0');
    const cat3Paid = parseFloat(matPurchases[0]?.paid || '0');
    const cat3Outstanding = parseFloat(matPurchases[0]?.outstanding || '0');
    const cat3Count = Number(matPurchases[0]?.count || 0);

    // 4. Category 4: Material Supplies
    const matSupplies = await db.select({
      total: sql<string>`sum(${materialSupplies.totalAmount})`,
      paid: sql<string>`sum(${materialSupplies.paidAmount})`,
      outstanding: sql<string>`sum(${materialSupplies.outstandingAmount})`,
      count: sql<number>`count(*)`
    })
    .from(materialSupplies)
    .where(and(
      eq(materialSupplies.locationId, locationId),
      eq(materialSupplies.isDeleted, 0)
    ));

    const cat4Total = parseFloat(matSupplies[0]?.total || '0');
    const cat4Paid = parseFloat(matSupplies[0]?.paid || '0');
    const cat4Outstanding = parseFloat(matSupplies[0]?.outstanding || '0');
    const cat4Count = Number(matSupplies[0]?.count || 0);

    // 5. Category 5: Site Supplies
    const siteSuppliesData = await db.select({
      total: sql<string>`sum(${siteSupplies.totalAmount})`,
      count: sql<number>`count(*)`
    })
    .from(siteSupplies)
    .where(and(
      eq(siteSupplies.locationId, locationId),
      eq(siteSupplies.isDeleted, 0)
    ));

    const cat5Total = parseFloat(siteSuppliesData[0]?.total || '0');
    const cat5Count = Number(siteSuppliesData[0]?.count || 0);

    // 6. Category 6 & 7: Labour Salaries & Attendance Wages
    const labourData = await db.select({
      netSalary: sql<string>`sum(${labourSalaries.netSalary})`,
      upad: sql<string>`sum(${labourSalaries.upad})`,
      paid: sql<string>`sum(${labourSalaries.paymentAmount})`,
      balance: sql<string>`sum(${labourSalaries.balance})`,
      count: sql<number>`count(*)`
    })
    .from(labourSalaries)
    .where(and(
      eq(labourSalaries.locationId, locationId),
      eq(labourSalaries.isDeleted, 0)
    ));

    const labourNetSalary = parseFloat(labourData[0]?.netSalary || '0');
    const labourUpad = parseFloat(labourData[0]?.upad || '0');
    const labourPaid = parseFloat(labourData[0]?.paid || '0');
    const labourBalance = parseFloat(labourData[0]?.balance || '0');
    const labourCount = Number(labourData[0]?.count || 0);
    const cat67Total = Math.round(labourNetSalary * 100) / 100;
    const cat67CashPaid = Math.round((labourPaid + labourUpad) * 100) / 100;

    // 7. Category 8: Supervisor Costs
    const supCosts = await db.select({
      total: sql<string>`sum(${supervisorCosts.amount})`,
      count: sql<number>`count(*)`
    })
    .from(supervisorCosts)
    .where(and(
      eq(supervisorCosts.locationId, locationId),
      eq(supervisorCosts.isDeleted, 0)
    ));

    const cat8Total = parseFloat(supCosts[0]?.total || '0');
    const cat8Count = Number(supCosts[0]?.count || 0);

    // Grand Project Deductions across Categories 3, 4, 5, 6, 7, 8 funded by Investment Capital
    const totalProjectExpenditure = Math.round((cat3Total + cat4Total + cat5Total + cat67Total + cat8Total) * 100) / 100;
    const totalCashPaidExpenditure = Math.round((cat3Paid + cat4Paid + cat5Total + cat67CashPaid + cat8Total) * 100) / 100;
    
    // Category 2 formula: Remaining Capital = Investment from Investors Capital - Deductions - Investor Upad / Return
    const remainingInvestmentCapital = Math.round((investmentFromInvestorsCapital - totalProjectExpenditure - returnsToInvestors) * 100) / 100;
    
    const utilizationRate = investmentFromInvestorsCapital > 0
      ? Math.round((totalProjectExpenditure / investmentFromInvestorsCapital) * 100)
      : (totalProjectExpenditure > 0 ? 100 : 0);

    let status = 'HEALTHY';
    if (remainingInvestmentCapital < 0) {
      status = 'DEFICIT';
    } else if (utilizationRate >= 85) {
      status = 'WARNING';
    }

    // Itemized recent deductions across Categories 3, 4, 5, 6, 7/8 for live passbook
    const [recentPurchases, recentSupplies, recentSiteSupplies, recentLabour, recentSupervisor, recentCapitalInflows] = await Promise.all([
      db.select({
        id: materialPurchases.id,
        date: materialPurchases.date,
        category: sql<string>`'CAT_3_PURCHASE'`,
        categoryName: sql<string>`'Cat 3: Material Purchase'`,
        partyName: materialPurchases.partyName,
        description: sql<string>`concat(${materialPurchases.materialName}, ' (', ${materialPurchases.quantity}, ' ', ${materialPurchases.unit}, ')')`,
        amount: materialPurchases.totalAmount,
        paidAmount: materialPurchases.paidAmount,
        referenceNumber: materialPurchases.invoiceNumber,
        paymentStatus: materialPurchases.paymentStatus
      })
      .from(materialPurchases)
      .where(and(eq(materialPurchases.locationId, locationId), eq(materialPurchases.isDeleted, 0)))
      .orderBy(desc(materialPurchases.date), desc(materialPurchases.id))
      .limit(30),

      db.select({
        id: materialSupplies.id,
        date: materialSupplies.date,
        category: sql<string>`'CAT_4_SUPPLY'`,
        categoryName: sql<string>`'Cat 4: Material Supply'`,
        partyName: materialSupplies.partyName,
        description: sql<string>`concat(${materialSupplies.materialName}, ' (', ${materialSupplies.quantity}, ' ', ${materialSupplies.unit}, ')')`,
        amount: materialSupplies.totalAmount,
        paidAmount: materialSupplies.paidAmount,
        referenceNumber: materialSupplies.invoiceNumber,
        paymentStatus: materialSupplies.paymentStatus
      })
      .from(materialSupplies)
      .where(and(eq(materialSupplies.locationId, locationId), eq(materialSupplies.isDeleted, 0)))
      .orderBy(desc(materialSupplies.date), desc(materialSupplies.id))
      .limit(30),

      db.select({
        id: siteSupplies.id,
        date: siteSupplies.date,
        category: sql<string>`'CAT_5_SITE_SUPPLY'`,
        categoryName: sql<string>`'Cat 5: Site Supply'`,
        partyName: sql<string>`coalesce(${siteSupplies.responsiblePerson}, 'Site Team')`,
        description: sql<string>`coalesce(${siteSupplies.workDescription}, 'Site Equipment / Tool Supply')`,
        amount: siteSupplies.totalAmount,
        paidAmount: siteSupplies.totalAmount,
        referenceNumber: sql<string>`''`,
        paymentStatus: sql<string>`'PAID'`
      })
      .from(siteSupplies)
      .where(and(eq(siteSupplies.locationId, locationId), eq(siteSupplies.isDeleted, 0)))
      .orderBy(desc(siteSupplies.date), desc(siteSupplies.id))
      .limit(30),

      db.select({
        id: labourSalaries.id,
        date: labourSalaries.date,
        category: sql<string>`'CAT_6_7_LABOUR'`,
        categoryName: sql<string>`'Cat 6/7: Labour Salary & Wages'`,
        partyName: labourSalaries.labourName,
        description: sql<string>`concat(coalesce(${labourSalaries.workType}, 'Labour Work'), ' (Days: ', coalesce(${labourSalaries.days}, '0'), ')')`,
        amount: labourSalaries.netSalary,
        paidAmount: labourSalaries.paymentAmount,
        referenceNumber: labourSalaries.tcNumber,
        paymentStatus: sql<string>`case when ${labourSalaries.balance} = '0' then 'PAID' else 'OUTSTANDING' end`
      })
      .from(labourSalaries)
      .where(and(eq(labourSalaries.locationId, locationId), eq(labourSalaries.isDeleted, 0)))
      .orderBy(desc(labourSalaries.date), desc(labourSalaries.id))
      .limit(30),

      db.select({
        id: supervisorCosts.id,
        date: supervisorCosts.date,
        category: sql<string>`'CAT_8_SUPERVISOR'`,
        categoryName: sql<string>`'Cat 8: Supervisor Cost'`,
        partyName: supervisorCosts.supervisorName,
        description: supervisorCosts.description,
        amount: supervisorCosts.amount,
        paidAmount: supervisorCosts.amount,
        referenceNumber: supervisorCosts.referenceNumber,
        paymentStatus: sql<string>`'PAID'`
      })
      .from(supervisorCosts)
      .where(and(eq(supervisorCosts.locationId, locationId), eq(supervisorCosts.isDeleted, 0)))
      .orderBy(desc(supervisorCosts.date), desc(supervisorCosts.id))
      .limit(30),

      db.select({
        id: investmentTransactions.id,
        date: investmentTransactions.date,
        partyId: investmentParties.id,
        partyName: investmentParties.partyName,
        type: investmentTransactions.type,
        amount: investmentTransactions.amount,
        description: investmentTransactions.description,
        paymentMethod: investmentTransactions.paymentMethod,
        referenceNumber: investmentTransactions.referenceNumber,
      })
      .from(investmentTransactions)
      .innerJoin(investmentParties, eq(investmentTransactions.partyId, investmentParties.id))
      .where(and(
        eq(investmentParties.locationId, locationId),
        eq(investmentTransactions.isDeleted, 0),
        eq(investmentParties.isDeleted, 0),
        sql`${investmentTransactions.type} IN ('INVESTMENT', 'CONTRIBUTION')`
      ))
      .orderBy(desc(investmentTransactions.date), desc(investmentTransactions.id))
      .limit(50)
    ]);

    // Merge and sort all deductions chronologically descending
    const itemizedDeductions = [
      ...recentPurchases,
      ...recentSupplies,
      ...recentSiteSupplies,
      ...recentLabour,
      ...recentSupervisor
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({
      investmentCapital: {
        investmentFromInvestorsCapital,
        fromInvestmentKarya,
        fromContributions,
        fromInvestors: investmentFromInvestorsCapital,
        fromBills,
        billCount,
        returnsToInvestors,
        grossInvestmentCapital: investmentFromInvestorsCapital,
        netInvestmentCapital
      },
      linkedExpenditures: {
        category3MaterialPurchases: {
          total: cat3Total,
          paid: cat3Paid,
          outstanding: cat3Outstanding,
          count: cat3Count
        },
        category4MaterialSupplies: {
          total: cat4Total,
          paid: cat4Paid,
          outstanding: cat4Outstanding,
          count: cat4Count
        },
        category5SiteSupplies: {
          total: cat5Total,
          count: cat5Count
        },
        category67Labour: {
          totalNetSalary: labourNetSalary,
          totalPaid: labourPaid,
          totalUpad: labourUpad,
          outstandingBalance: labourBalance,
          count: labourCount
        },
        category8Supervisor: {
          total: cat8Total,
          count: cat8Count
        },
        totalProjectExpenditure,
        totalCashPaidExpenditure
      },
      budgetBalance: {
        investmentFromInvestorsCapital,
        grossInvestmentCapital: investmentFromInvestorsCapital,
        netInvestmentCapital,
        totalProjectExpenditure,
        totalCashPaidExpenditure,
        returnsToInvestors,
        remainingInvestmentCapital,
        utilizationRate,
        status
      },
      itemizedDeductions,
      recentCapitalInflows
    });
  } catch (error) {
    console.error('Failed to fetch project utilization:', error);
    res.status(500).json({ error: 'Failed to fetch project utilization' });
  }
});

export default investmentRouter;
