import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { payments, invoices, auditLogs } from '../../db/schema.ts';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

const paymentRouter = Router();
paymentRouter.use(requireAuth);

const paymentInputSchema = z.object({
  locationId: z.number().int().optional().nullable(),
  partyId: z.number().int().optional().nullable(),
  partyName: z.string().min(1),
  invoiceId: z.number().int().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.union([z.number().positive(), z.string()]).transform(Number),
  paymentType: z.enum(['PAYMENT_IN', 'PAYMENT_OUT']),
  paymentMode: z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'NEFT']).default('BANK_TRANSFER'),
  referenceNumber: z.string().optional().nullable().default(''),
  notes: z.string().optional().nullable().default(''),
});

// GET /api/payments - List payments
paymentRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const { paymentType, partyId, locationId, startDate, endDate, search } = req.query;

    const paymentList = await db.select().from(payments).where(
      and(
        eq(payments.userId, userId),
        eq(payments.isDeleted, 0),
        paymentType ? eq(payments.paymentType, String(paymentType)) : sql`1=1`,
        partyId ? eq(payments.partyId, Number(partyId)) : sql`1=1`,
        locationId ? eq(payments.locationId, Number(locationId)) : sql`1=1`,
        startDate ? sql`${payments.date} >= ${String(startDate)}` : sql`1=1`,
        endDate ? sql`${payments.date} <= ${String(endDate)}` : sql`1=1`,
        search ? sql`LOWER(${payments.partyName}) LIKE LOWER(${'%' + search + '%'})` : sql`1=1`
      )
    ).orderBy(desc(payments.date), desc(payments.id));

    let totalIn = 0;
    let totalOut = 0;
    paymentList.forEach(p => {
      const amt = parseFloat(p.amount || '0');
      if (p.paymentType === 'PAYMENT_IN') totalIn += amt;
      if (p.paymentType === 'PAYMENT_OUT') totalOut += amt;
    });

    res.json({
      payments: paymentList,
      totalIn: Math.round(totalIn * 100) / 100,
      totalOut: Math.round(totalOut * 100) / 100,
      netBalance: Math.round((totalIn - totalOut) * 100) / 100,
    });
  } catch (error) {
    console.error('Failed to fetch payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// POST /api/payments - Record new payment
paymentRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const data = paymentInputSchema.parse(req.body);

    const inserted = await db.insert(payments).values({
      userId,
      locationId: data.locationId || null,
      partyId: data.partyId || null,
      partyName: data.partyName,
      invoiceId: data.invoiceId || null,
      date: data.date,
      amount: data.amount.toFixed(2),
      paymentType: data.paymentType,
      paymentMode: data.paymentMode,
      referenceNumber: data.referenceNumber || null,
      notes: data.notes || null,
    }).returning();

    // If linked to invoice, update invoice paid amount
    if (data.invoiceId) {
      const inv = await db.select().from(invoices).where(
        and(eq(invoices.id, data.invoiceId), eq(invoices.userId, userId))
      );
      if (inv.length > 0) {
        const currentInv = inv[0];
        const curPaid = parseFloat(currentInv.paidAmount || '0');
        const tot = parseFloat(currentInv.totalAmount || '0');
        const updatedPaid = Math.min(tot, curPaid + data.amount);
        const updatedBal = Math.max(0, tot - updatedPaid);
        await db.update(invoices).set({
          paidAmount: updatedPaid.toFixed(2),
          balanceAmount: updatedBal.toFixed(2),
          paymentStatus: updatedPaid >= tot ? 'PAID' : 'PARTIAL',
          updatedAt: new Date()
        }).where(eq(invoices.id, data.invoiceId));
      }
    }

    await db.insert(auditLogs).values({
      userId,
      action: 'RECORD_PAYMENT',
      entityType: 'PAYMENT',
      entityId: inserted[0].id,
      metadata: JSON.stringify({ type: data.paymentType, amount: data.amount, party: data.partyName })
    });

    res.status(201).json(inserted[0]);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to record payment' });
  }
});

// DELETE /api/payments/:id - Soft delete payment
paymentRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const existing = await db.select().from(payments).where(
      and(eq(payments.id, id), eq(payments.userId, userId), eq(payments.isDeleted, 0))
    ).limit(1);

    if (!existing.length) return res.status(404).json({ error: 'Payment not found' });
    const payment = existing[0];

    await db.update(payments)
      .set({ isDeleted: 1 })
      .where(and(eq(payments.id, id), eq(payments.userId, userId)));

    if (payment.invoiceId) {
      const remainingPayments = await db.select().from(payments).where(
        and(eq(payments.invoiceId, payment.invoiceId), eq(payments.isDeleted, 0))
      );
      const newPaid = remainingPayments.reduce((acc, p) => acc + parseFloat(p.amount || '0'), 0);
      const inv = await db.select().from(invoices).where(eq(invoices.id, payment.invoiceId)).limit(1);
      if (inv.length > 0) {
        const total = parseFloat(inv[0].totalAmount || '0');
        const bal = Math.max(0, total - newPaid);
        await db.update(invoices).set({
          paidAmount: newPaid.toFixed(2),
          balanceAmount: bal.toFixed(2),
          paymentStatus: newPaid >= total ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'UNPAID',
          updatedAt: new Date()
        }).where(eq(invoices.id, payment.invoiceId));
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

export default paymentRouter;
