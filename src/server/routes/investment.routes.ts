import { Router, Response } from 'express';
import { requireAuth, requireCategoryAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { 
  investmentParties, investmentTransactions, auditLogs,
  materialPurchases, materialSupplies, siteSupplies,
  labourSalaries, supervisorCosts, records
} from '../../db/schema.ts';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { assertLocationAccess } from '../lib/locationAuth.ts';

const investmentRouter = Router();
investmentRouter.use(requireAuth);
investmentRouter.use(requireCategoryAuth);

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
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const locationId = parseInt(req.query.locationId as string, 10);
    if (isNaN(locationId)) return res.status(400).json({ error: 'locationId is required' });

    await assertLocationAccess(userId, locationId);

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
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch investment parties' });
  }
});

investmentRouter.post('/parties', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const data = partySchema.parse(req.body);
    await assertLocationAccess(userId, data.locationId);

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
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    res.status(400).json({ error: error?.message || 'Validation failed' });
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
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const data = txSchema.parse(req.body);
    
    // Validate party belongs to active location
    const party = await db.select().from(investmentParties).where(and(eq(investmentParties.id, data.partyId), eq(investmentParties.isDeleted, 0))).limit(1);
    if (!party.length) return res.status(404).json({ error: 'Investor party not found' });
    await assertLocationAccess(userId, party[0].locationId);

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
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    res.status(400).json({ error: error?.message || 'Validation failed' });
  }
});

investmentRouter.put('/transactions/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const data = txSchema.parse(req.body);

    const party = await db.select().from(investmentParties).where(and(eq(investmentParties.id, data.partyId), eq(investmentParties.isDeleted, 0))).limit(1);
    if (!party.length) return res.status(404).json({ error: 'Investor party not found' });
    await assertLocationAccess(userId, party[0].locationId);

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
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    res.status(400).json({ error: error?.message || 'Validation failed' });
  }
});

investmentRouter.delete('/transactions/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const tx = await db.select().from(investmentTransactions).where(eq(investmentTransactions.id, id)).limit(1);
    if (tx.length) {
      const party = await db.select().from(investmentParties).where(eq(investmentParties.id, tx[0].partyId)).limit(1);
      if (party.length) {
        await assertLocationAccess(userId, party[0].locationId);
      }
    }

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
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

investmentRouter.delete('/parties/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const party = await db.select().from(investmentParties).where(eq(investmentParties.id, id)).limit(1);
    if (party.length) {
      await assertLocationAccess(userId, party[0].locationId);
    }

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
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: 'Failed to delete party' });
  }
});

// Category 2: Refundable Record Endpoints
investmentRouter.get('/refundable-records', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const locationId = parseInt(req.query.locationId as string, 10);
    if (isNaN(locationId)) return res.status(400).json({ error: 'locationId is required' });

    await assertLocationAccess(userId, locationId);

    const refRecords = await db.select({
      id: records.id,
      locationId: records.locationId,
      date: records.date,
      partyName: records.partyName,
      category: records.category,
      description: records.description,
      amount: records.amount,
      refundableAmount: records.refundableAmount,
      refundedAmount: records.refundedAmount,
      refundStatus: records.refundStatus,
      paymentMethod: records.paymentMethod,
      referenceNumber: records.referenceNumber,
      notes: records.notes,
      createdAt: records.createdAt
    })
    .from(records)
    .where(and(
      eq(records.locationId, locationId),
      eq(records.isDeleted, 0),
      sql`(${records.refundableAmount} > 0 OR ${records.category} = 'REFUNDABLE_RECORD' OR ${records.category} = 'REFUNDABLE')`
    ))
    .orderBy(desc(records.date), desc(records.id));

    let totalRefundable = 0;
    let totalRefunded = 0;

    refRecords.forEach(r => {
      totalRefundable += parseFloat(r.refundableAmount || r.amount || '0') || 0;
      totalRefunded += parseFloat(r.refundedAmount || '0') || 0;
    });

    const pendingRefundable = Math.max(0, Math.round((totalRefundable - totalRefunded) * 100) / 100);

    res.json({
      records: refRecords,
      summary: {
        totalRefundable: Math.round(totalRefundable * 100) / 100,
        totalRefunded: Math.round(totalRefunded * 100) / 100,
        pendingRefundable,
        count: refRecords.length
      }
    });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to fetch refundable records:', error);
    res.status(500).json({ error: 'Failed to fetch refundable records' });
  }
});

investmentRouter.post('/refundable-records', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const {
      locationId,
      date,
      partyName,
      amount,
      description,
      paymentMethod,
      referenceNumber,
      notes
    } = req.body;

    if (!locationId || isNaN(parseInt(locationId, 10))) {
      return res.status(400).json({ error: 'locationId is required' });
    }
    const locId = parseInt(locationId, 10);
    await assertLocationAccess(userId, locId);

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: 'A valid amount is required' });
    }

    const newRecord = await db.insert(records).values({
      locationId: locId,
      userId,
      type: 'EXPENSE',
      category: 'REFUNDABLE_RECORD',
      partyName: partyName?.trim() || 'Refundable Party',
      amount: amt.toFixed(2),
      refundableAmount: amt.toFixed(2),
      refundedAmount: '0.00',
      refundStatus: 'PENDING',
      date: date || new Date().toISOString().split('T')[0],
      description: description?.trim() || 'Refundable Deposit / Security',
      paymentMethod: paymentMethod || 'Bank Transfer',
      referenceNumber: referenceNumber?.trim() || null,
      notes: notes?.trim() || null
    }).returning();

    await db.insert(auditLogs).values({
      userId,
      action: 'CREATE_REFUNDABLE_RECORD',
      entityType: 'INVESTMENT',
      entityId: newRecord[0].id,
      metadata: JSON.stringify({ amount: amt, partyName })
    });

    res.status(201).json(newRecord[0]);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to create refundable record:', error);
    res.status(500).json({ error: 'Failed to create refundable record' });
  }
});

investmentRouter.put('/refundable-records/:id/refund', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const { refundAmount, notes } = req.body;
    const addedRefund = parseFloat(refundAmount);
    if (isNaN(addedRefund) || addedRefund <= 0) {
      return res.status(400).json({ error: 'A valid refund received amount is required' });
    }

    const existing = await db.select().from(records).where(eq(records.id, id)).limit(1);
    if (!existing.length) {
      return res.status(404).json({ error: 'Refundable record not found' });
    }

    await assertLocationAccess(userId, existing[0].locationId);

    const totalRef = parseFloat(existing[0].refundableAmount || existing[0].amount || '0');
    const currRefunded = parseFloat(existing[0].refundedAmount || '0');
    const newRefunded = Math.min(totalRef, Math.round((currRefunded + addedRefund) * 100) / 100);
    const newStatus = newRefunded >= totalRef ? 'FULL' : (newRefunded > 0 ? 'PARTIAL' : 'PENDING');

    const updated = await db.update(records)
      .set({
        refundedAmount: newRefunded.toFixed(2),
        refundStatus: newStatus,
        notes: notes ? `${existing[0].notes ? existing[0].notes + ' | ' : ''}Refund received ₹${addedRefund}: ${notes}` : existing[0].notes,
        updatedAt: new Date()
      })
      .where(eq(records.id, id))
      .returning();

    await db.insert(auditLogs).values({
      userId,
      action: 'UPDATE_REFUNDABLE_RECORD_REFUND',
      entityType: 'INVESTMENT',
      entityId: id,
      metadata: JSON.stringify({ addedRefund, newRefunded, newStatus })
    });

    res.json(updated[0]);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to update refund on record:', error);
    res.status(500).json({ error: 'Failed to update refund' });
  }
});

investmentRouter.delete('/refundable-records/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const existing = await db.select().from(records).where(eq(records.id, id)).limit(1);
    if (!existing.length) {
      return res.status(404).json({ error: 'Record not found' });
    }

    await assertLocationAccess(userId, existing[0].locationId);

    await db.update(records)
      .set({ isDeleted: 1, updatedAt: new Date() })
      .where(eq(records.id, id));

    await db.insert(auditLogs).values({
      userId,
      action: 'DELETE_REFUNDABLE_RECORD',
      entityType: 'INVESTMENT',
      entityId: id,
      metadata: JSON.stringify({ recordId: id })
    });

    res.json({ success: true });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to delete refundable record:', error);
    res.status(500).json({ error: 'Failed to delete refundable record' });
  }
});

// Category 2 Linkage: Project Investment Capital & Categories 3, 4, 5, 6 Linked Utilization
investmentRouter.get('/project-utilization', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const locationId = parseInt(req.query.locationId as string, 10);
    if (isNaN(locationId)) return res.status(400).json({ error: 'locationId is required' });

    await assertLocationAccess(userId, locationId);

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
    // Category 2 Capital: Investment from Investors Capital is strictly Investment Karya total
    const investmentFromInvestorsCapital = Math.round(fromInvestmentKarya * 100) / 100;
    // Full Capital = Investment from Investors + Bill Investment
    const fullCapital = Math.round((investmentFromInvestorsCapital + fromBills) * 100) / 100;
    const netInvestmentCapital = Math.round((fullCapital - returnsToInvestors) * 100) / 100;

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

    // 6. Category 6: Labour Salaries, Team Upad & Other Kharch
    const labourData = await db.select({
      netSalary: sql<string>`sum(${labourSalaries.netSalary})`,
      upad: sql<string>`sum(${labourSalaries.upad})`,
      paid: sql<string>`sum(${labourSalaries.paymentAmount})`,
      grossSalary: sql<string>`sum(${labourSalaries.grossSalary})`,
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
    const labourGross = parseFloat(labourData[0]?.grossSalary || '0');
    const labourBalance = parseFloat(labourData[0]?.balance || '0');
    const labourCount = Number(labourData[0]?.count || 0);

    // In Cat 6, total deduction is calculated from gross wages + team upad + other kharch
    // For records: grossSalary holds attendance / other kharch, upad holds team upad
    // Note: netSalary + upad accurately represents all labour expenditure
    const cat6Total = Math.round((labourNetSalary + labourUpad) * 100) / 100;
    const cat6CashPaid = Math.round((labourPaid + labourUpad) * 100) / 100;

    // Refundable Records Outflows (Deposits / Advances to be refunded)
    const refData = await db.select({
      totalRefundable: sql<string>`sum(case when coalesce(${records.refundableAmount}, 0) > 0 then ${records.refundableAmount} else ${records.amount} end)`,
      totalRefunded: sql<string>`sum(coalesce(${records.refundedAmount}, 0))`,
      count: sql<number>`count(*)`
    })
    .from(records)
    .where(and(
      eq(records.locationId, locationId),
      eq(records.isDeleted, 0),
      sql`(${records.refundableAmount} > 0 OR ${records.category} = 'REFUNDABLE_RECORD' OR ${records.category} = 'REFUNDABLE')`
    ));

    const totalRefundable = parseFloat(refData[0]?.totalRefundable || '0') || 0;
    const totalRefunded = parseFloat(refData[0]?.totalRefunded || '0') || 0;
    const pendingRefundable = Math.max(0, Math.round((totalRefundable - totalRefunded) * 100) / 100);
    const refCount = Number(refData[0]?.count || 0);

    // Grand Project Deductions across Categories 3, 4, 5, 6 and Refundable Outflows funded by Investment Capital
    const totalProjectExpenditure = Math.round((cat3Total + cat4Total + cat5Total + cat6Total + pendingRefundable) * 100) / 100;
    const totalCashPaidExpenditure = Math.round((cat3Paid + cat4Paid + cat5Total + cat6CashPaid + pendingRefundable) * 100) / 100;
    
    // Category 2 formula: Remaining Capital = Full Capital (Investment from Investors + Bill Investment) - Deductions (Cat 3 to 6 + Refundable) - Investor Upad / Return
    const remainingInvestmentCapital = Math.round((fullCapital - totalProjectExpenditure - returnsToInvestors) * 100) / 100;
    
    const utilizationRate = fullCapital > 0
      ? Math.round((totalProjectExpenditure / fullCapital) * 100)
      : (totalProjectExpenditure > 0 ? 100 : 0);

    let status = 'HEALTHY';
    if (remainingInvestmentCapital < 0) {
      status = 'DEFICIT';
    } else if (utilizationRate >= 85) {
      status = 'WARNING';
    }

    // Itemized recent deductions across Categories 3, 4, 5, 6 and Refundables for live passbook
    const [recentPurchases, recentSupplies, recentSiteSupplies, recentLabour, recentRefundables, recentCapitalInflows] = await Promise.all([
      db.select({
        id: materialPurchases.id,
        date: materialPurchases.date,
        category: sql<string>`'CAT_3_PURCHASE'`,
        categoryKey: sql<string>`'CAT3_PURCHASE'`,
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
      .limit(40),

      db.select({
        id: materialSupplies.id,
        date: materialSupplies.date,
        category: sql<string>`'CAT_4_SUPPLY'`,
        categoryKey: sql<string>`'CAT4_SUPPLY'`,
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
      .limit(40),

      db.select({
        id: siteSupplies.id,
        date: siteSupplies.date,
        category: sql<string>`'CAT_5_SITE_SUPPLY'`,
        categoryKey: sql<string>`'CAT5_SITE'`,
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
      .limit(40),

      db.select({
        id: labourSalaries.id,
        date: labourSalaries.date,
        category: sql<string>`'CAT_6_LABOUR'`,
        categoryKey: sql<string>`'CAT6_LABOUR'`,
        categoryName: sql<string>`case 
          when upper(${labourSalaries.attendanceType}) like '%UPAD%' then 'Cat 6: Team Upad'
          when upper(${labourSalaries.attendanceType}) like '%KHARCH%' or upper(${labourSalaries.attendanceType}) like '%EXPENSE%' then 'Cat 6: Other Kharch'
          else 'Cat 6: Labour Attendance'
        end`,
        partyName: sql<string>`coalesce(${labourSalaries.labourTeam}, ${labourSalaries.labourName})`,
        description: sql<string>`case
          when upper(${labourSalaries.attendanceType}) like '%UPAD%' then concat('Team Advance: ', coalesce(${labourSalaries.notes}, 'Upad'))
          when upper(${labourSalaries.attendanceType}) like '%KHARCH%' then concat('Kharch: ', coalesce(${labourSalaries.workType}, ${labourSalaries.notes}, 'Expense'))
          when upper(${labourSalaries.attendanceType}) like '%WORK%' or upper(${labourSalaries.attendanceType}) like '%TC%' then concat('TC: ', coalesce(${labourSalaries.workType}, 'Work'), ' (', coalesce(${labourSalaries.tcQuantity}, '0'), ' ', coalesce(${labourSalaries.unitOfMeasurement}, 'Nos'), ')')
          else concat('Day Attendance (Days: ', coalesce(${labourSalaries.days}, '0'), ')')
        end`,
        amount: sql<string>`case
          when upper(${labourSalaries.attendanceType}) like '%UPAD%' then ${labourSalaries.upad}
          else ${labourSalaries.netSalary}
        end`,
        paidAmount: sql<string>`case
          when upper(${labourSalaries.attendanceType}) like '%UPAD%' then ${labourSalaries.upad}
          else ${labourSalaries.paymentAmount}
        end`,
        referenceNumber: sql<string>`coalesce(${labourSalaries.referenceNumber}, ${labourSalaries.tcNumber}, '')`,
        paymentStatus: sql<string>`case 
          when upper(${labourSalaries.attendanceType}) like '%UPAD%' or upper(${labourSalaries.attendanceType}) like '%KHARCH%' then 'PAID'
          when ${labourSalaries.balance} = '0' then 'PAID' 
          else 'OUTSTANDING' 
        end`
      })
      .from(labourSalaries)
      .where(and(eq(labourSalaries.locationId, locationId), eq(labourSalaries.isDeleted, 0)))
      .orderBy(desc(labourSalaries.date), desc(labourSalaries.id))
      .limit(60),

      db.select({
        id: records.id,
        date: records.date,
        category: sql<string>`'REFUNDABLE_RECORD'`,
        categoryKey: sql<string>`'CAT_REFUNDABLE'`,
        categoryName: sql<string>`'Refundable Record'`,
        partyName: records.partyName,
        description: sql<string>`concat('Refundable Deposit: ', coalesce(${records.description}, ${records.partyName}))`,
        amount: sql<string>`case when coalesce(${records.refundableAmount}, 0) > 0 then ${records.refundableAmount} else ${records.amount} end`,
        paidAmount: sql<string>`coalesce(${records.refundedAmount}, '0.00')`,
        referenceNumber: sql<string>`coalesce(${records.referenceNumber}, '')`,
        paymentStatus: records.refundStatus
      })
      .from(records)
      .where(and(
        eq(records.locationId, locationId),
        eq(records.isDeleted, 0),
        sql`(${records.refundableAmount} > 0 OR ${records.category} = 'REFUNDABLE_RECORD' OR ${records.category} = 'REFUNDABLE')`
      ))
      .orderBy(desc(records.date), desc(records.id))
      .limit(40),

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
      ...recentRefundables
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({
      investmentCapital: {
        investmentFromInvestorsCapital,
        fromInvestmentKarya,
        fromContributions,
        fromInvestors: investmentFromInvestorsCapital,
        fromBills,
        billInvestment: fromBills,
        fullCapital,
        billCount,
        returnsToInvestors,
        grossInvestmentCapital: fullCapital,
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
        category6Labour: {
          totalNetSalary: labourNetSalary,
          totalPaid: labourPaid,
          totalUpad: labourUpad,
          totalGross: labourGross,
          totalDeduction: cat6Total,
          outstandingBalance: labourBalance,
          count: labourCount
        },
        category67Labour: {
          totalNetSalary: labourNetSalary,
          totalPaid: labourPaid,
          totalUpad: labourUpad,
          totalGross: labourGross,
          totalDeduction: cat6Total,
          outstandingBalance: labourBalance,
          count: labourCount
        },
        refundableRecords: {
          totalRefundable,
          totalRefunded,
          pendingRefundable,
          count: refCount
        },
        totalProjectExpenditure,
        totalCashPaidExpenditure
      },
      budgetBalance: {
        investmentFromInvestorsCapital,
        billInvestment: fromBills,
        fullCapital,
        grossInvestmentCapital: fullCapital,
        netInvestmentCapital,
        totalProjectExpenditure,
        totalCashPaidExpenditure,
        pendingRefundable,
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
