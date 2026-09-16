import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { investmentParties, investmentTransactions, auditLogs } from '../../db/schema.ts';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

const investmentRouter = Router();
investmentRouter.use(requireAuth);

const partySchema = z.object({
  locationId: z.number().int().positive(),
  partyName: z.string().min(1).max(100)
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
        eq(investmentParties.userId, req.dbUser!.id),
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
        if (m.type === 'INVESTMENT') totalInvestment += parseFloat(m.total || '0');
        if (m.type === 'PAYMENT') totalPayment += parseFloat(m.total || '0');
        if (m.type === 'UPAD') totalUpad += parseFloat(m.total || '0');
      });

      return {
        ...p,
        totalInvestment,
        totalPayment,
        totalUpad,
        balance: totalInvestment - totalPayment - totalUpad
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
    const result = await db.insert(investmentParties).values({
      userId: req.dbUser!.id,
      locationId: data.locationId,
      partyName: data.partyName
    }).returning();
    
    await db.insert(auditLogs).values({
      userId: req.dbUser!.id,
      action: 'CREATE_INVESTMENT_PARTY',
      entityType: 'INVESTMENT',
      entityId: result[0].id,
      metadata: JSON.stringify({ partyName: data.partyName })
    });
    
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
      .where(and(eq(investmentParties.id, id), eq(investmentParties.userId, req.dbUser!.id)))
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
      eq(investmentTransactions.userId, req.dbUser!.id),
      eq(investmentTransactions.isDeleted, 0)
    ];

    if (partyId && !isNaN(partyId)) {
      conditions.push(eq(investmentTransactions.partyId, partyId));
    }
    if (type && (type === 'INVESTMENT' || type === 'UPAD' || type === 'PAYMENT')) {
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
    const result = await db.insert(investmentTransactions).values({
      userId: req.dbUser!.id,
      partyId: data.partyId,
      type: data.type,
      amount: data.amount.toString(),
      date: data.date,
      description: data.description,
      paymentMethod: data.paymentMethod,
      referenceNumber: data.referenceNumber
    }).returning();

    await db.insert(auditLogs).values({
      userId: req.dbUser!.id,
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
        eq(investmentTransactions.userId, req.dbUser!.id)
      ))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Transaction not found' });

    await db.insert(auditLogs).values({
      userId: req.dbUser!.id,
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

    await db.update(investmentTransactions)
      .set({ isDeleted: 1 })
      .where(and(
        eq(investmentTransactions.id, id),
        eq(investmentTransactions.userId, req.dbUser!.id)
      ));

    await db.insert(auditLogs).values({
      userId: req.dbUser!.id,
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

    await db.update(investmentParties)
      .set({ isDeleted: 1 })
      .where(and(
        eq(investmentParties.id, id),
        eq(investmentParties.userId, req.dbUser!.id)
      ));

    await db.update(investmentTransactions)
      .set({ isDeleted: 1 })
      .where(and(
        eq(investmentTransactions.partyId, id),
        eq(investmentTransactions.userId, req.dbUser!.id)
      ));

    await db.insert(auditLogs).values({
      userId: req.dbUser!.id,
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

export default investmentRouter;
