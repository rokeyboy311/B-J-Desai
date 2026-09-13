import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { materialPurchases, materialSupplies, materialLabourSupplies, auditLogs } from '../../db/schema.ts';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const materialRouter = Router();
materialRouter.use(requireAuth);

const purchaseSupplySchema = z.object({
  locationId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partyName: z.string().min(1),
  materialName: z.string().min(1),
  quantity: z.union([z.number(), z.string()]).transform(Number),
  unit: z.string().min(1),
  rate: z.union([z.number(), z.string()]).transform(Number),
  transportCost: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  discount: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  taxPercentage: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  paymentStatus: z.string().optional().default('UNPAID'),
  paymentMethod: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

const labourSupplySchema = z.object({
  locationId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  siteLocationName: z.string().optional().nullable(),
  teamName: z.string().optional().nullable(),
  materialName: z.string().optional().nullable(),
  materialQuantity: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  partyName: z.string().optional().default('N/A'),
  workDescription: z.string().optional().default('N/A'),
  materialAmount: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  labourAmount: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  taxPercentage: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  paymentStatus: z.string().optional().default('UNPAID'),
  paymentMethod: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
});

materialRouter.get('/:type', async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.params; // purchase, supply, labour-supply
    const locationId = parseInt(req.query.locationId as string, 10);
    if (isNaN(locationId)) return res.status(400).json({ error: 'locationId required' });

    let data;
    const baseWhere = and(eq(materialPurchases.userId, req.dbUser!.id), eq(materialPurchases.locationId, locationId), eq(materialPurchases.isDeleted, 0));

    if (type === 'purchase') {
      data = await db.select().from(materialPurchases).where(and(eq(materialPurchases.userId, req.dbUser!.id), eq(materialPurchases.locationId, locationId), eq(materialPurchases.isDeleted, 0))).orderBy(desc(materialPurchases.date), desc(materialPurchases.id));
    } else if (type === 'supply') {
      data = await db.select().from(materialSupplies).where(and(eq(materialSupplies.userId, req.dbUser!.id), eq(materialSupplies.locationId, locationId), eq(materialSupplies.isDeleted, 0))).orderBy(desc(materialSupplies.date), desc(materialSupplies.id));
    } else if (type === 'labour-supply') {
      data = await db.select().from(materialLabourSupplies).where(and(eq(materialLabourSupplies.userId, req.dbUser!.id), eq(materialLabourSupplies.locationId, locationId), eq(materialLabourSupplies.isDeleted, 0))).orderBy(desc(materialLabourSupplies.date), desc(materialLabourSupplies.id));
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch material records' });
  }
});

materialRouter.post('/:type', async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.params;
    
    if (type === 'purchase' || type === 'supply') {
      const data = purchaseSupplySchema.parse(req.body);
      const subtotal = Math.round(data.quantity * data.rate * 100) / 100;
      const taxableAmount = subtotal - data.discount;
      const taxAmount = Math.round(taxableAmount * (data.taxPercentage / 100) * 100) / 100;
      const totalAmount = Math.round((taxableAmount + taxAmount + data.transportCost) * 100) / 100;
      
      const table = type === 'purchase' ? materialPurchases : materialSupplies;
      const result = await db.insert(table).values({
        userId: req.dbUser!.id,
        ...data,
        quantity: data.quantity.toString(),
        rate: data.rate.toString(),
        subtotal: subtotal.toString(),
        transportCost: data.transportCost.toString(),
        discount: data.discount.toString(),
        taxPercentage: data.taxPercentage.toString(),
        tax: taxAmount.toString(),
        totalAmount: totalAmount.toString(),
      }).returning();
      return res.json(result[0]);
    } else if (type === 'labour-supply') {
      const data = labourSupplySchema.parse(req.body);
      const subtotal = Math.round((data.materialAmount + data.labourAmount) * 100) / 100;
      const taxAmount = Math.round(subtotal * (data.taxPercentage / 100) * 100) / 100;
      const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
      
      const result = await db.insert(materialLabourSupplies).values({
        userId: req.dbUser!.id,
        ...data,
        materialQuantity: data.materialQuantity.toString(),
        materialAmount: data.materialAmount.toString(),
        labourAmount: data.labourAmount.toString(),
        subtotal: subtotal.toString(),
        taxPercentage: data.taxPercentage.toString(),
        tax: taxAmount.toString(),
        totalAmount: totalAmount.toString(),
      }).returning();
      return res.json(result[0]);
    }
    res.status(400).json({ error: 'Invalid type' });
  } catch (error) {
    console.error('Material route validation error:', error);
    res.status(400).json({ error: 'Validation failed' });
  }
});

materialRouter.put('/:type/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { type, id } = req.params;
    const numId = parseInt(id as string, 10);
    if (isNaN(numId)) return res.status(400).json({ error: 'Valid id required' });

    if (type === 'purchase' || type === 'supply') {
      const data = purchaseSupplySchema.parse(req.body);
      const subtotal = Math.round(data.quantity * data.rate * 100) / 100;
      const taxableAmount = subtotal - data.discount;
      const taxAmount = Math.round(taxableAmount * (data.taxPercentage / 100) * 100) / 100;
      const totalAmount = Math.round((taxableAmount + taxAmount + data.transportCost) * 100) / 100;
      
      const table = type === 'purchase' ? materialPurchases : materialSupplies;
      const result = await db.update(table).set({
        ...data,
        quantity: data.quantity.toString(),
        rate: data.rate.toString(),
        subtotal: subtotal.toString(),
        transportCost: data.transportCost.toString(),
        discount: data.discount.toString(),
        taxPercentage: data.taxPercentage.toString(),
        tax: taxAmount.toString(),
        totalAmount: totalAmount.toString(),
      }).where(and(eq(table.id, numId), eq(table.userId, req.dbUser!.id))).returning();
      
      if (!result.length) return res.status(404).json({ error: 'Record not found' });
      return res.json(result[0]);
    } else if (type === 'labour-supply') {
      const data = labourSupplySchema.parse(req.body);
      const subtotal = Math.round((data.materialAmount + data.labourAmount) * 100) / 100;
      const taxAmount = Math.round(subtotal * (data.taxPercentage / 100) * 100) / 100;
      const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
      
      const result = await db.update(materialLabourSupplies).set({
        ...data,
        materialQuantity: data.materialQuantity.toString(),
        materialAmount: data.materialAmount.toString(),
        labourAmount: data.labourAmount.toString(),
        subtotal: subtotal.toString(),
        taxPercentage: data.taxPercentage.toString(),
        tax: taxAmount.toString(),
        totalAmount: totalAmount.toString(),
      }).where(and(eq(materialLabourSupplies.id, numId), eq(materialLabourSupplies.userId, req.dbUser!.id))).returning();
      
      if (!result.length) return res.status(404).json({ error: 'Record not found' });
      return res.json(result[0]);
    }
    res.status(400).json({ error: 'Invalid type' });
  } catch (error) {
    console.error('Material route validation error:', error);
    res.status(400).json({ error: 'Validation failed' });
  }
});

materialRouter.delete('/:type/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { type, id } = req.params;
    const numId = parseInt(id as string, 10);
    if (isNaN(numId)) return res.status(400).json({ error: 'Valid id required' });

    let table: any;
    if (type === 'purchase') table = materialPurchases;
    else if (type === 'supply') table = materialSupplies;
    else if (type === 'labour-supply') table = materialLabourSupplies;
    else return res.status(400).json({ error: 'Invalid type' });

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
