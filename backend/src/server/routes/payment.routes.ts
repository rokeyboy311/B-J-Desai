import { Router, Response } from 'express';
import { requireAuth, AuthRequest, verifyBusinessOwnership } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { payments, invoices, materialPurchases, labourSalaries, records, auditLogs } from '../../db/schema.ts';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { DecimalMath } from '../../shared/accountingEngine.ts';

const paymentRouter = Router();
paymentRouter.use(requireAuth);

const paymentInputSchema = z.object({
  businessId: z.number().int().optional(),
  locationId: z.number().int().optional().nullable(),
  partyId: z.number().int().optional().nullable(),
  partyName: z.string().min(1),
  invoiceId: z.number().int().optional().nullable(),
  purchaseId: z.number().int().optional().nullable(),
  labourSalaryId: z.number().int().optional().nullable(),
  recordId: z.number().int().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.union([z.number().positive(), z.string()]).transform(Number),
  paymentType: z.enum(['PAYMENT_IN', 'PAYMENT_OUT']),
  paymentMode: z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'NEFT']).default('BANK_TRANSFER'),
  referenceNumber: z.string().optional().nullable().default(''),
  notes: z.string().optional().nullable().default(''),
  idempotencyKey: z.string().optional(),
});

// GET /api/payments - List payments with business and party filtering
paymentRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const businessId = req.businessId;
    const { paymentType, partyId, locationId, startDate, endDate, search } = req.query;

    const conditions = [
      eq(payments.userId, userId),
      eq(payments.isDeleted, 0),
    ];

    if (businessId) conditions.push(eq(payments.businessId, businessId));
    if (paymentType) conditions.push(eq(payments.paymentType, String(paymentType)));
    if (partyId) conditions.push(eq(payments.partyId, Number(partyId)));
    if (locationId) conditions.push(eq(payments.locationId, Number(locationId)));
    if (startDate) conditions.push(sql`${payments.date} >= ${String(startDate)}`);
    if (endDate) conditions.push(sql`${payments.date} <= ${String(endDate)}`);
    if (search) conditions.push(sql`LOWER(${payments.partyName}) LIKE LOWER(${'%' + search + '%'})`);

    const paymentList = await db.select().from(payments).where(and(...conditions)).orderBy(desc(payments.date), desc(payments.id));

    let totalIn = 0;
    let totalOut = 0;
    paymentList.forEach(p => {
      if (p.isReversed === 1) return;
      const amt = Number(p.amount || 0);
      if (p.paymentType === 'PAYMENT_IN') totalIn = DecimalMath.add(totalIn, amt);
      if (p.paymentType === 'PAYMENT_OUT') totalOut = DecimalMath.add(totalOut, amt);
    });

    res.json({
      payments: paymentList,
      totalIn,
      totalOut,
      netBalance: DecimalMath.sub(totalIn, totalOut),
    });
  } catch (error) {
    console.error('Failed to fetch payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// POST /api/payments - Record new payment & atomically update linked transaction
paymentRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const businessId = req.body.businessId || req.businessId;
    const data = paymentInputSchema.parse(req.body);

    if (data.idempotencyKey) {
      const existing = await db.select().from(payments).where(
        and(eq(payments.idempotencyKey, data.idempotencyKey), eq(payments.userId, userId))
      ).limit(1);
      if (existing.length > 0) {
        return res.json(existing[0]);
      }
    }

    const inserted = await db.insert(payments).values({
      userId,
      businessId,
      locationId: data.locationId || null,
      partyId: data.partyId || null,
      partyName: data.partyName,
      invoiceId: data.invoiceId || null,
      purchaseId: data.purchaseId || null,
      labourSalaryId: data.labourSalaryId || null,
      recordId: data.recordId || null,
      date: data.date,
      amount: data.amount.toFixed(2),
      paymentType: data.paymentType,
      paymentMode: data.paymentMode,
      referenceNumber: data.referenceNumber || null,
      notes: data.notes || null,
      idempotencyKey: data.idempotencyKey || null,
    }).returning();

    const payment = inserted[0];

    // 1. Linked Invoice update
    if (data.invoiceId) {
      const inv = await db.select().from(invoices).where(eq(invoices.id, data.invoiceId)).limit(1);
      if (inv.length > 0) {
        const currentInv = inv[0];
        const curPaid = Number(currentInv.paidAmount || 0);
        const tot = Number(currentInv.totalAmount || 0);
        const updatedPaid = DecimalMath.min(tot, DecimalMath.add(curPaid, data.amount));
        const updatedBal = DecimalMath.max(0, DecimalMath.sub(tot, updatedPaid));
        await db.update(invoices).set({
          paidAmount: updatedPaid.toFixed(2),
          balanceAmount: updatedBal.toFixed(2),
          paymentStatus: updatedPaid >= tot ? 'PAID' : 'PARTIAL',
          updatedAt: new Date(),
        }).where(eq(invoices.id, data.invoiceId));
      }
    }

    // 2. Linked Purchase update
    if (data.purchaseId) {
      const pur = await db.select().from(materialPurchases).where(eq(materialPurchases.id, data.purchaseId)).limit(1);
      if (pur.length > 0) {
        const curPur = pur[0];
        const curPaid = Number(curPur.paidAmount || 0);
        const tot = Number(curPur.totalAmount || 0);
        const updatedPaid = DecimalMath.min(tot, DecimalMath.add(curPaid, data.amount));
        const updatedOut = DecimalMath.max(0, DecimalMath.sub(tot, updatedPaid));
        await db.update(materialPurchases).set({
          paidAmount: updatedPaid.toFixed(2),
          outstandingAmount: updatedOut.toFixed(2),
          paymentStatus: updatedPaid >= tot ? 'PAID' : 'PARTIAL',
        }).where(eq(materialPurchases.id, data.purchaseId));
      }
    }

    // 3. Linked Labour update
    if (data.labourSalaryId) {
      const sal = await db.select().from(labourSalaries).where(eq(labourSalaries.id, data.labourSalaryId)).limit(1);
      if (sal.length > 0) {
        const curSal = sal[0];
        const curPaid = Number(curSal.paymentAmount || 0);
        const netSal = Number(curSal.netSalary || 0);
        const upad = Number(curSal.upad || 0);
        const updatedPaid = DecimalMath.add(curPaid, data.amount);
        const updatedBal = DecimalMath.sub(netSal, DecimalMath.add(upad, updatedPaid));
        await db.update(labourSalaries).set({
          paymentAmount: updatedPaid.toFixed(2),
          balance: updatedBal.toFixed(2),
        }).where(eq(labourSalaries.id, data.labourSalaryId));
      }
    }

    await db.insert(auditLogs).values({
      userId,
      businessId,
      locationId: data.locationId || null,
      action: 'RECORD_PAYMENT',
      entityType: 'PAYMENT',
      entityId: payment.id,
      afterState: JSON.stringify({ type: data.paymentType, amount: data.amount, party: data.partyName }),
    });

    res.status(201).json(payment);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0]?.message || 'Validation failed' });
    }
    console.error('Payment creation error:', error);
    res.status(500).json({ error: error.message || 'Failed to record payment' });
  }
});

// POST /api/payments/:id/reverse - Safe Payment Reversal
paymentRouter.post('/:id/reverse', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const id = parseInt(String(req.params.id), 10);
    const { reason } = req.body;

    const existing = await db.select().from(payments).where(
      and(eq(payments.id, id), eq(payments.userId, userId), eq(payments.isDeleted, 0))
    ).limit(1);

    if (!existing.length) return res.status(404).json({ error: 'Payment not found' });
    const payment = existing[0];

    if (payment.isReversed === 1) {
      return res.status(400).json({ error: 'Payment has already been reversed' });
    }

    await db.update(payments).set({
      isReversed: 1,
      reversalReason: reason || 'Payment reversed by user',
      reversedAt: new Date(),
    }).where(eq(payments.id, id));

    const revAmount = Number(payment.amount || 0);

    // Revert invoice
    if (payment.invoiceId) {
      const inv = await db.select().from(invoices).where(eq(invoices.id, payment.invoiceId)).limit(1);
      if (inv.length > 0) {
        const curInv = inv[0];
        const newPaid = DecimalMath.max(0, DecimalMath.sub(Number(curInv.paidAmount || 0), revAmount));
        const tot = Number(curInv.totalAmount || 0);
        const newBal = DecimalMath.max(0, DecimalMath.sub(tot, newPaid));
        await db.update(invoices).set({
          paidAmount: newPaid.toFixed(2),
          balanceAmount: newBal.toFixed(2),
          paymentStatus: newPaid >= tot ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'UNPAID',
          updatedAt: new Date(),
        }).where(eq(invoices.id, payment.invoiceId));
      }
    }

    // Revert purchase
    if (payment.purchaseId) {
      const pur = await db.select().from(materialPurchases).where(eq(materialPurchases.id, payment.purchaseId)).limit(1);
      if (pur.length > 0) {
        const curPur = pur[0];
        const newPaid = DecimalMath.max(0, DecimalMath.sub(Number(curPur.paidAmount || 0), revAmount));
        const tot = Number(curPur.totalAmount || 0);
        const newOut = DecimalMath.max(0, DecimalMath.sub(tot, newPaid));
        await db.update(materialPurchases).set({
          paidAmount: newPaid.toFixed(2),
          outstandingAmount: newOut.toFixed(2),
          paymentStatus: newPaid >= tot ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'UNPAID',
        }).where(eq(materialPurchases.id, payment.purchaseId));
      }
    }

    await db.insert(auditLogs).values({
      userId,
      businessId: payment.businessId,
      locationId: payment.locationId,
      action: 'REVERSE',
      entityType: 'PAYMENT',
      entityId: id,
      metadata: JSON.stringify({ reason }),
    });

    res.json({ success: true, message: 'Payment reversed and linked balance restored' });
  } catch (error) {
    console.error('Failed to reverse payment:', error);
    res.status(500).json({ error: 'Failed to reverse payment' });
  }
});

// DELETE /api/payments/:id - Soft delete
paymentRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    await db.update(payments).set({ isDeleted: 1 }).where(and(eq(payments.id, id), eq(payments.userId, userId)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

export default paymentRouter;
