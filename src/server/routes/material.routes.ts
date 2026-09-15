import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { materialPurchases, materialSupplies, materialLabourSupplies, items, payments, auditLogs } from '../../db/schema.ts';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

const materialRouter = Router();
materialRouter.use(requireAuth);

const purchaseSupplySchema = z.object({
  locationId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partyName: z.string().min(1),
  materialName: z.string().min(1),
  materialCategory: z.string().optional().nullable().default(''),
  quantity: z.union([z.number(), z.string()]).transform(Number),
  unit: z.string().min(1),
  rate: z.union([z.number(), z.string()]).transform(Number),
  transportCost: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  discount: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  taxPercentage: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  taxRate: z.union([z.number(), z.string()]).transform(Number).optional(),
  paymentStatus: z.string().optional().default('UNPAID'),
  paymentMethod: z.string().optional().nullable().default('BANK'),
  referenceNumber: z.string().optional().nullable().default(''),
  invoiceNumber: z.string().optional().nullable().default(''),
  supplierInvoiceNo: z.string().optional().nullable(),
  gst: z.string().optional().nullable().default(''),
  supplierGst: z.string().optional().nullable(),
  address: z.string().optional().nullable().default(''),
  notes: z.string().optional().nullable().default(''),
  description: z.string().optional().nullable().default(''),
  paidAmount: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
}).transform(data => ({
  ...data,
  taxPercentage: data.taxPercentage || data.taxRate || 0,
  invoiceNumber: data.invoiceNumber || data.supplierInvoiceNo || '',
  gst: data.gst || data.supplierGst || '',
}));

const labourSupplySchema = z.object({
  locationId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  siteLocationName: z.string().optional().nullable().default(''),
  teamName: z.string().optional().nullable().default(''),
  materialName: z.string().optional().nullable().default(''),
  materialQuantity: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  partyName: z.string().optional().default('N/A'),
  workDescription: z.string().optional().default('N/A'),
  materialAmount: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  labourAmount: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  taxPercentage: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  taxRate: z.union([z.number(), z.string()]).transform(Number).optional(),
  paymentStatus: z.string().optional().default('UNPAID'),
  paymentMethod: z.string().optional().nullable().default('BANK'),
  referenceNumber: z.string().optional().nullable().default(''),
  invoiceNumber: z.string().optional().nullable().default(''),
  gst: z.string().optional().nullable().default(''),
  address: z.string().optional().nullable().default(''),
  notes: z.string().optional().nullable().default(''),
  paidAmount: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
}).transform(data => ({
  ...data,
  taxPercentage: data.taxPercentage || data.taxRate || 0,
}));

function normalizeMaterialType(raw: string | string[] | undefined): 'purchase' | 'supply' | 'labour-supply' | null {
  const str = Array.isArray(raw) ? raw[0] : raw;
  if (!str) return null;
  const lower = str.toLowerCase();
  if (lower === 'purchase' || lower === 'purchases') return 'purchase';
  if (lower === 'supply' || lower === 'supplies') return 'supply';
  if (lower === 'labour-supply' || lower === 'labour-supplies') return 'labour-supply';
  return null;
}

materialRouter.get('/:type', async (req: AuthRequest, res: Response) => {
  try {
    const normType = normalizeMaterialType(req.params.type);
    if (!normType) return res.status(400).json({ error: 'Invalid type' });

    const locationIdParam = req.query.locationId as string;
    const locationId = locationIdParam && locationIdParam !== 'all' ? parseInt(locationIdParam, 10) : undefined;

    let data;
    if (normType === 'purchase') {
      data = await db.select().from(materialPurchases).where(
        and(
          eq(materialPurchases.userId, req.dbUser!.id),
          locationId ? eq(materialPurchases.locationId, locationId) : sql`1=1`,
          eq(materialPurchases.isDeleted, 0)
        )
      ).orderBy(desc(materialPurchases.date), desc(materialPurchases.id));
    } else if (normType === 'supply') {
      data = await db.select().from(materialSupplies).where(
        and(
          eq(materialSupplies.userId, req.dbUser!.id),
          locationId ? eq(materialSupplies.locationId, locationId) : sql`1=1`,
          eq(materialSupplies.isDeleted, 0)
        )
      ).orderBy(desc(materialSupplies.date), desc(materialSupplies.id));
    } else if (normType === 'labour-supply') {
      data = await db.select().from(materialLabourSupplies).where(
        and(
          eq(materialLabourSupplies.userId, req.dbUser!.id),
          locationId ? eq(materialLabourSupplies.locationId, locationId) : sql`1=1`,
          eq(materialLabourSupplies.isDeleted, 0)
        )
      ).orderBy(desc(materialLabourSupplies.date), desc(materialLabourSupplies.id));
    }
    res.json(data);
  } catch (error) {
    console.error('Failed to fetch material records:', error);
    res.status(500).json({ error: 'Failed to fetch material records' });
  }
});

materialRouter.post('/:type', async (req: AuthRequest, res: Response) => {
  try {
    const normType = normalizeMaterialType(req.params.type);
    if (!normType) return res.status(400).json({ error: 'Invalid type' });
    const userId = req.dbUser!.id;
    
    if (normType === 'purchase' || normType === 'supply') {
      const data = purchaseSupplySchema.parse(req.body);
      const subtotal = Math.round(data.quantity * data.rate * 100) / 100;
      const taxableAmount = Math.max(0, subtotal - data.discount);
      const taxAmount = Math.round(taxableAmount * (data.taxPercentage / 100) * 100) / 100;
      const totalAmount = Math.round((taxableAmount + taxAmount + data.transportCost) * 100) / 100;
      const paidAmount = Math.min(totalAmount, Math.max(0, data.paidAmount));
      const outstandingAmount = Math.max(0, totalAmount - paidAmount);
      const paymentStatus = paidAmount >= totalAmount ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID';
      
      const table = normType === 'purchase' ? materialPurchases : materialSupplies;
      const result = await db.insert(table).values({
        userId,
        locationId: data.locationId,
        date: data.date,
        partyName: data.partyName,
        materialName: data.materialName,
        materialCategory: data.materialCategory || null,
        quantity: data.quantity.toString(),
        unit: data.unit,
        rate: data.rate.toString(),
        subtotal: subtotal.toString(),
        transportCost: data.transportCost.toString(),
        discount: data.discount.toString(),
        taxPercentage: data.taxPercentage.toString(),
        tax: taxAmount.toString(),
        totalAmount: totalAmount.toString(),
        paidAmount: paidAmount.toString(),
        outstandingAmount: outstandingAmount.toString(),
        paymentStatus,
        paymentMethod: data.paymentMethod || 'BANK',
        referenceNumber: data.referenceNumber || null,
        invoiceNumber: data.invoiceNumber || null,
        gst: data.gst || null,
        address: data.address || null,
        notes: data.notes || null,
        description: data.description || null,
      }).returning();

      // Sync inventory stock if matching item found in catalog
      const matchedItem = await db.select().from(items).where(
        and(
          eq(items.userId, userId),
          sql`LOWER(${items.name}) = LOWER(${data.materialName})`,
          eq(items.isDeleted, 0)
        )
      ).limit(1);

      if (matchedItem.length > 0) {
        const delta = normType === 'purchase' ? data.quantity : -data.quantity;
        await db.update(items)
          .set({
            currentStock: sql`${items.currentStock} + ${delta}`,
            updatedAt: new Date()
          })
          .where(eq(items.id, matchedItem[0].id));
      }

      // Record payment ledger entry if paid
      if (paidAmount > 0) {
        await db.insert(payments).values({
          userId,
          locationId: data.locationId,
          partyName: data.partyName,
          date: data.date,
          amount: paidAmount.toFixed(2),
          paymentType: normType === 'purchase' ? 'PAYMENT_OUT' : 'PAYMENT_IN',
          paymentMode: (data.paymentMethod as any) || 'BANK_TRANSFER',
          referenceNumber: data.referenceNumber || data.invoiceNumber || null,
          notes: `${normType === 'purchase' ? 'Payment for' : 'Receipt for'} ${data.materialName} (${data.quantity} ${data.unit})`,
        });
      }

      return res.json(result[0]);
    } else if (normType === 'labour-supply') {
      const data = labourSupplySchema.parse(req.body);
      const subtotal = Math.round((data.materialAmount + data.labourAmount) * 100) / 100;
      const taxAmount = Math.round(subtotal * (data.taxPercentage / 100) * 100) / 100;
      const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
      const paidAmount = Math.min(totalAmount, Math.max(0, data.paidAmount));
      const outstandingAmount = Math.max(0, totalAmount - paidAmount);
      const paymentStatus = paidAmount >= totalAmount ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID';
      
      const result = await db.insert(materialLabourSupplies).values({
        userId,
        locationId: data.locationId,
        date: data.date,
        siteLocationName: data.siteLocationName || null,
        teamName: data.teamName || null,
        materialName: data.materialName || null,
        materialQuantity: data.materialQuantity.toString(),
        partyName: data.partyName,
        workDescription: data.workDescription,
        materialAmount: data.materialAmount.toString(),
        labourAmount: data.labourAmount.toString(),
        subtotal: subtotal.toString(),
        taxPercentage: data.taxPercentage.toString(),
        tax: taxAmount.toString(),
        totalAmount: totalAmount.toString(),
        paidAmount: paidAmount.toString(),
        outstandingAmount: outstandingAmount.toString(),
        paymentStatus,
        paymentMethod: data.paymentMethod || 'BANK',
        referenceNumber: data.referenceNumber || null,
        invoiceNumber: data.invoiceNumber || null,
        gst: data.gst || null,
        address: data.address || null,
        notes: data.notes || null,
      }).returning();
      return res.json(result[0]);
    }
    res.status(400).json({ error: 'Invalid type' });
  } catch (error) {
    console.error('Material route error:', error);
    res.status(400).json({ error: 'Validation failed' });
  }
});

materialRouter.put('/:type/:id', async (req: AuthRequest, res: Response) => {
  try {
    const normType = normalizeMaterialType(req.params.type);
    if (!normType) return res.status(400).json({ error: 'Invalid type' });
    const numId = parseInt(req.params.id as string, 10);
    if (isNaN(numId)) return res.status(400).json({ error: 'Valid id required' });

    if (normType === 'purchase' || normType === 'supply') {
      const data = purchaseSupplySchema.parse(req.body);
      const subtotal = Math.round(data.quantity * data.rate * 100) / 100;
      const taxableAmount = Math.max(0, subtotal - data.discount);
      const taxAmount = Math.round(taxableAmount * (data.taxPercentage / 100) * 100) / 100;
      const totalAmount = Math.round((taxableAmount + taxAmount + data.transportCost) * 100) / 100;
      const paidAmount = Math.min(totalAmount, Math.max(0, data.paidAmount));
      const outstandingAmount = Math.max(0, totalAmount - paidAmount);
      const paymentStatus = paidAmount >= totalAmount ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID';
      
      const table = normType === 'purchase' ? materialPurchases : materialSupplies;
      const result = await db.update(table).set({
        locationId: data.locationId,
        date: data.date,
        partyName: data.partyName,
        materialName: data.materialName,
        materialCategory: data.materialCategory || null,
        quantity: data.quantity.toString(),
        unit: data.unit,
        rate: data.rate.toString(),
        subtotal: subtotal.toString(),
        transportCost: data.transportCost.toString(),
        discount: data.discount.toString(),
        taxPercentage: data.taxPercentage.toString(),
        tax: taxAmount.toString(),
        totalAmount: totalAmount.toString(),
        paidAmount: paidAmount.toString(),
        outstandingAmount: outstandingAmount.toString(),
        paymentStatus,
        paymentMethod: data.paymentMethod || 'BANK',
        referenceNumber: data.referenceNumber || null,
        invoiceNumber: data.invoiceNumber || null,
        gst: data.gst || null,
        address: data.address || null,
        notes: data.notes || null,
        description: data.description || null,
      }).where(and(eq(table.id, numId), eq(table.userId, req.dbUser!.id))).returning();
      
      if (!result.length) return res.status(404).json({ error: 'Record not found' });
      return res.json(result[0]);
    } else if (normType === 'labour-supply') {
      const data = labourSupplySchema.parse(req.body);
      const subtotal = Math.round((data.materialAmount + data.labourAmount) * 100) / 100;
      const taxAmount = Math.round(subtotal * (data.taxPercentage / 100) * 100) / 100;
      const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
      const paidAmount = Math.min(totalAmount, Math.max(0, data.paidAmount));
      const outstandingAmount = Math.max(0, totalAmount - paidAmount);
      const paymentStatus = paidAmount >= totalAmount ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID';
      
      const result = await db.update(materialLabourSupplies).set({
        locationId: data.locationId,
        date: data.date,
        siteLocationName: data.siteLocationName || null,
        teamName: data.teamName || null,
        materialName: data.materialName || null,
        materialQuantity: data.materialQuantity.toString(),
        partyName: data.partyName,
        workDescription: data.workDescription,
        materialAmount: data.materialAmount.toString(),
        labourAmount: data.labourAmount.toString(),
        subtotal: subtotal.toString(),
        taxPercentage: data.taxPercentage.toString(),
        tax: taxAmount.toString(),
        totalAmount: totalAmount.toString(),
        paidAmount: paidAmount.toString(),
        outstandingAmount: outstandingAmount.toString(),
        paymentStatus,
        paymentMethod: data.paymentMethod || 'BANK',
        referenceNumber: data.referenceNumber || null,
        invoiceNumber: data.invoiceNumber || null,
        gst: data.gst || null,
        address: data.address || null,
        notes: data.notes || null,
      }).where(and(eq(materialLabourSupplies.id, numId), eq(materialLabourSupplies.userId, req.dbUser!.id))).returning();
      
      if (!result.length) return res.status(404).json({ error: 'Record not found' });
      return res.json(result[0]);
    }
    res.status(400).json({ error: 'Invalid type' });
  } catch (error) {
    console.error('Material route update error:', error);
    res.status(400).json({ error: 'Validation failed' });
  }
});

// Record payment on purchase or supply
materialRouter.post('/:type/:id/payment', async (req: AuthRequest, res: Response) => {
  try {
    const normType = normalizeMaterialType(req.params.type);
    if (!normType || normType === 'labour-supply') return res.status(400).json({ error: 'Invalid type' });
    const numId = parseInt(req.params.id as string, 10);
    if (isNaN(numId)) return res.status(400).json({ error: 'Valid id required' });

    const schema = z.object({
      amount: z.number().positive(),
      paymentMode: z.string().default('BANK_TRANSFER'),
      paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(new Date().toISOString().split('T')[0]),
      referenceNumber: z.string().optional().default(''),
      notes: z.string().optional().default('')
    });
    const parsed = schema.parse(req.body);

    const table = normType === 'purchase' ? materialPurchases : materialSupplies;
    const existing = await db.select().from(table).where(
      and(eq(table.id, numId), eq(table.userId, req.dbUser!.id), eq(table.isDeleted, 0))
    ).limit(1);

    if (existing.length === 0) return res.status(404).json({ error: 'Record not found' });
    const rec = existing[0];

    const currentPaid = parseFloat(rec.paidAmount || '0');
    const total = parseFloat(rec.totalAmount || '0');
    const newPaid = Math.min(total, currentPaid + parsed.amount);
    const newBal = Math.max(0, total - newPaid);
    const newStatus = newPaid >= total ? 'PAID' : 'PARTIAL';

    await db.update(table).set({
      paidAmount: newPaid.toFixed(2),
      outstandingAmount: newBal.toFixed(2),
      paymentStatus: newStatus,
    }).where(eq(table.id, numId));

    const insertedPayment = await db.insert(payments).values({
      userId: req.dbUser!.id,
      locationId: rec.locationId,
      partyName: rec.partyName,
      date: parsed.paymentDate,
      amount: parsed.amount.toFixed(2),
      paymentType: normType === 'purchase' ? 'PAYMENT_OUT' : 'PAYMENT_IN',
      paymentMode: parsed.paymentMode as any,
      referenceNumber: parsed.referenceNumber || null,
      notes: parsed.notes || `Payment for ${rec.materialName} (${normType} #${rec.id})`,
    }).returning();

    res.status(201).json({ success: true, payment: insertedPayment[0], newStatus, newPaid, newBal });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to record payment' });
  }
});

materialRouter.delete('/:type/:id', async (req: AuthRequest, res: Response) => {
  try {
    const normType = normalizeMaterialType(req.params.type);
    if (!normType) return res.status(400).json({ error: 'Invalid type' });
    const numId = parseInt(req.params.id as string, 10);
    if (isNaN(numId)) return res.status(400).json({ error: 'Valid id required' });

    let table: any;
    if (normType === 'purchase') table = materialPurchases;
    else if (normType === 'supply') table = materialSupplies;
    else if (normType === 'labour-supply') table = materialLabourSupplies;

    await db.update(table)
      .set({ isDeleted: 1 })
      .where(and(eq(table.id, numId), eq(table.userId, req.dbUser!.id)));

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete material record:', error);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

export default materialRouter;
