import { Router, Response } from 'express';
import { requireAuth, requireCategoryAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { records, auditLogs } from '../../db/schema.ts';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { assertLocationAccess } from '../lib/locationAuth.ts';

const incomeRouter = Router();
incomeRouter.use(requireAuth);
incomeRouter.use(requireCategoryAuth);

const incomeBillSchema = z.object({
  locationId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partyName: z.string().min(1).max(100),
  materialName: z.string().min(1).max(100).optional().default('General'),
  quantity: z.union([z.number(), z.string()]).transform(Number).optional().default(1),
  unit: z.string().max(50).optional().default('Nos'),
  rate: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  subtotal: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  transportCost: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  discount: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  taxPercentage: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  taxAmount: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  totalAmount: z.union([z.number(), z.string()]).transform(Number),
  paymentStatus: z.string().optional().default('PAID'),
  paymentMethod: z.string().optional().default('Bank Transfer'),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
});

function parseRecordToBill(r: any) {
  let extra: any = {};
  if (r.notes) {
    try {
      extra = JSON.parse(r.notes);
    } catch {
      extra = { rawNotes: r.notes };
    }
  }

  return {
    id: r.id,
    locationId: r.locationId,
    date: r.date,
    partyName: r.partyName,
    materialName: extra.materialName || r.description?.replace(/^Bill:\s*/, '')?.split(' - ')[0] || 'Material',
    quantity: extra.quantity !== undefined ? Number(extra.quantity) : 1,
    unit: extra.unit || 'Nos',
    rate: extra.rate !== undefined ? Number(extra.rate) : Number(r.amount),
    subtotal: extra.subtotal !== undefined ? Number(extra.subtotal) : Number(r.amount),
    transportCost: extra.transportCost !== undefined ? Number(extra.transportCost) : 0,
    discount: extra.discount !== undefined ? Number(extra.discount) : 0,
    taxPercentage: extra.taxPercentage !== undefined ? Number(extra.taxPercentage) : 0,
    taxAmount: extra.taxAmount !== undefined ? Number(extra.taxAmount) : 0,
    totalAmount: Number(r.amount),
    amount: Number(r.amount),
    paymentStatus: extra.paymentStatus || 'PAID',
    paymentMethod: r.paymentMethod || 'Bank Transfer',
    referenceNumber: r.referenceNumber,
    notes: extra.customNotes || (typeof extra.rawNotes === 'string' ? extra.rawNotes : ''),
    isBillIncome: true,
    type: 'BILL_INCOME',
    createdAt: r.createdAt,
  };
}

incomeRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const locationId = req.query.locationId ? parseInt(req.query.locationId as string, 10) : undefined;
    const conditions = [
      eq(records.isDeleted, 0),
      eq(records.type, 'INCOME'),
      eq(records.category, 'BILL_INVESTMENT'),
    ];

    if (locationId && !isNaN(locationId)) {
      await assertLocationAccess(userId, locationId);
      conditions.push(eq(records.locationId, locationId));
    }

    const rows = await db.select()
      .from(records)
      .where(and(...conditions))
      .orderBy(desc(records.date), desc(records.id));

    const result = rows.map(parseRecordToBill);
    res.json(result);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to fetch incomes:', error);
    res.status(500).json({ error: 'Failed to fetch incomes' });
  }
});

incomeRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const data = incomeBillSchema.parse(req.body);
    await assertLocationAccess(userId, data.locationId);

    // Ensure transport cost is strictly kept separate from taxable base amount & GST
    const subtotal = Math.round(data.quantity * data.rate * 100) / 100;
    const taxableAmount = Math.max(0, subtotal - (data.discount || 0));
    const taxAmount = Math.round(taxableAmount * ((data.taxPercentage || 0) / 100) * 100) / 100;
    const totalAmount = Math.round((taxableAmount + taxAmount + (data.transportCost || 0)) * 100) / 100;

    const notesMeta = JSON.stringify({
      materialName: data.materialName,
      quantity: data.quantity,
      unit: data.unit,
      rate: data.rate,
      subtotal,
      transportCost: data.transportCost || 0,
      discount: data.discount || 0,
      taxPercentage: data.taxPercentage || 0,
      taxAmount,
      totalAmount,
      paymentStatus: data.paymentStatus,
      customNotes: data.notes || '',
      isBillIncome: true,
    });

    const inserted = await db.insert(records).values({
      userId,
      locationId: data.locationId,
      type: 'INCOME',
      category: 'BILL_INVESTMENT',
      partyName: data.partyName,
      amount: totalAmount.toString(),
      date: data.date,
      paymentMethod: data.paymentMethod,
      referenceNumber: data.referenceNumber,
      description: data.title || `Bill: ${data.materialName} - ${data.partyName}`,
      notes: notesMeta,
    }).returning();

    await db.insert(auditLogs).values({
      userId,
      action: 'CREATE_BILL_INCOME',
      entityType: 'INCOME',
      entityId: inserted[0].id,
      metadata: JSON.stringify({
        partyName: data.partyName,
        materialName: data.materialName,
        totalAmount,
        transportCost: data.transportCost,
      }),
    });

    res.status(201).json(parseRecordToBill(inserted[0]));
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to create income:', error);
    res.status(500).json({ error: error.message || 'Failed to create income' });
  }
});

incomeRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const id = parseInt(req.params.id as string, 10);
    const existing = await db.select().from(records).where(and(eq(records.id, id), eq(records.isDeleted, 0)));
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Income record not found' });
    }
    await assertLocationAccess(userId, existing[0].locationId);

    const data = incomeBillSchema.partial().parse(req.body);

    const prevBill = parseRecordToBill(existing[0]);
    const finalQuantity = data.quantity !== undefined ? data.quantity : prevBill.quantity;
    const finalRate = data.rate !== undefined ? data.rate : prevBill.rate;
    const finalDiscount = data.discount !== undefined ? data.discount : prevBill.discount;
    const finalTaxPct = data.taxPercentage !== undefined ? data.taxPercentage : prevBill.taxPercentage;
    const finalTransport = data.transportCost !== undefined ? data.transportCost : prevBill.transportCost;

    const subtotal = Math.round(finalQuantity * finalRate * 100) / 100;
    const taxableAmount = Math.max(0, subtotal - finalDiscount);
    const taxAmount = Math.round(taxableAmount * (finalTaxPct / 100) * 100) / 100;
    const totalAmount = Math.round((taxableAmount + taxAmount + finalTransport) * 100) / 100;

    const notesMeta = JSON.stringify({
      materialName: data.materialName || prevBill.materialName,
      quantity: finalQuantity,
      unit: data.unit || prevBill.unit,
      rate: finalRate,
      subtotal,
      transportCost: finalTransport,
      discount: finalDiscount,
      taxPercentage: finalTaxPct,
      taxAmount,
      totalAmount,
      paymentStatus: data.paymentStatus || prevBill.paymentStatus,
      customNotes: data.notes !== undefined ? (data.notes || '') : prevBill.notes,
      isBillIncome: true,
    });

    const updated = await db.update(records).set({
      partyName: data.partyName || existing[0].partyName,
      amount: totalAmount.toString(),
      date: data.date || existing[0].date,
      paymentMethod: data.paymentMethod || existing[0].paymentMethod,
      referenceNumber: data.referenceNumber !== undefined ? data.referenceNumber : existing[0].referenceNumber,
      description: data.title || (data.materialName || data.partyName ? `Bill: ${data.materialName || prevBill.materialName} - ${data.partyName || existing[0].partyName}` : existing[0].description),
      notes: notesMeta,
      updatedAt: new Date(),
    }).where(eq(records.id, id)).returning();

    await db.insert(auditLogs).values({
      userId,
      action: 'UPDATE_BILL_INCOME',
      entityType: 'INCOME',
      entityId: id,
    });

    res.json(parseRecordToBill(updated[0]));
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to update income:', error);
    res.status(500).json({ error: error.message || 'Failed to update income' });
  }
});

incomeRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const id = parseInt(req.params.id as string, 10);
    const existing = await db.select().from(records).where(and(eq(records.id, id), eq(records.isDeleted, 0)));
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Income record not found' });
    }
    try {
      await assertLocationAccess(userId, existing[0].locationId, { allowDeleted: true });
    } catch (locErr) {
      console.warn(`Location check warning during income delete #${id}:`, locErr);
    }

    const updated = await db.update(records).set({
      isDeleted: 1,
      updatedAt: new Date(),
    }).where(and(eq(records.id, id), eq(records.isDeleted, 0))).returning();

    await db.insert(auditLogs).values({
      userId,
      action: 'DELETE_BILL_INCOME',
      entityType: 'INCOME',
      entityId: id,
    });

    res.json({ success: true, message: 'Income deleted successfully' });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to delete income:', error);
    res.status(500).json({ error: error.message || 'Failed to delete income' });
  }
});

export default incomeRouter;
