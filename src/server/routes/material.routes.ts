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
  address: z.string().optional().nullable(),
  gst: z.string().optional().nullable(),
  materialCategory: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  paidAmount: z.union([z.number(), z.string()]).transform(Number).optional(),
  outstandingAmount: z.union([z.number(), z.string()]).transform(Number).optional(),
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
  address: z.string().optional().nullable(),
  gst: z.string().optional().nullable(),
  materialUnit: z.string().optional().nullable(),
  labourType: z.string().optional().nullable(),
  labourQuantity: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  labourUnit: z.string().optional().nullable(),
  materialRate: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  labourRate: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  invoiceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  paidAmount: z.union([z.number(), z.string()]).transform(Number).optional(),
  outstandingAmount: z.union([z.number(), z.string()]).transform(Number).optional(),
});

materialRouter.get('/stock/summary', async (req: AuthRequest, res: Response) => {
  try {
    const locationId = req.query.locationId ? parseInt(req.query.locationId as string, 10) : undefined;
    const userId = req.dbUser!.id;

    // Conditions
    const purchaseCond = and(
      eq(materialPurchases.userId, userId),
      eq(materialPurchases.isDeleted, 0),
      locationId ? eq(materialPurchases.locationId, locationId) : undefined
    );
    const supplyCond = and(
      eq(materialSupplies.userId, userId),
      eq(materialSupplies.isDeleted, 0),
      locationId ? eq(materialSupplies.locationId, locationId) : undefined
    );
    const siteSupplyCond = and(
      eq(materialLabourSupplies.userId, userId),
      eq(materialLabourSupplies.isDeleted, 0),
      locationId ? eq(materialLabourSupplies.locationId, locationId) : undefined
    );

    const [purchases, supplies, siteSupplies] = await Promise.all([
      db.select({
        materialName: materialPurchases.materialName,
        unit: materialPurchases.unit,
        quantity: materialPurchases.quantity,
        rate: materialPurchases.rate,
        totalAmount: materialPurchases.totalAmount,
      }).from(materialPurchases).where(purchaseCond),

      db.select({
        materialName: materialSupplies.materialName,
        unit: materialSupplies.unit,
        quantity: materialSupplies.quantity,
        rate: materialSupplies.rate,
        totalAmount: materialSupplies.totalAmount,
      }).from(materialSupplies).where(supplyCond),

      db.select({
        materialName: materialLabourSupplies.materialName,
        unit: materialLabourSupplies.materialUnit,
        quantity: materialLabourSupplies.materialQuantity,
        rate: materialLabourSupplies.materialRate,
        totalAmount: materialLabourSupplies.materialAmount,
      }).from(materialLabourSupplies).where(siteSupplyCond)
    ]);

    const stockMap: Record<string, {
      materialName: string;
      unit: string;
      purchasedQty: number;
      otherSupplyQty: number;
      siteSupplyQty: number;
      totalPurchaseValue: number;
    }> = {};

    for (const p of purchases) {
      if (!p.materialName) continue;
      const key = `${p.materialName.trim().toLowerCase()}_${(p.unit || 'unit').trim().toLowerCase()}`;
      if (!stockMap[key]) {
        stockMap[key] = {
          materialName: p.materialName.trim(),
          unit: p.unit || 'Unit',
          purchasedQty: 0,
          otherSupplyQty: 0,
          siteSupplyQty: 0,
          totalPurchaseValue: 0,
        };
      }
      const qty = parseFloat(p.quantity as string) || 0;
      stockMap[key].purchasedQty += qty;
      stockMap[key].totalPurchaseValue += parseFloat(p.totalAmount as string) || 0;
    }

    for (const s of supplies) {
      if (!s.materialName) continue;
      const key = `${s.materialName.trim().toLowerCase()}_${(s.unit || 'unit').trim().toLowerCase()}`;
      if (!stockMap[key]) {
        stockMap[key] = {
          materialName: s.materialName.trim(),
          unit: s.unit || 'Unit',
          purchasedQty: 0,
          otherSupplyQty: 0,
          siteSupplyQty: 0,
          totalPurchaseValue: 0,
        };
      }
      stockMap[key].otherSupplyQty += parseFloat(s.quantity as string) || 0;
    }

    for (const mls of siteSupplies) {
      if (!mls.materialName) continue;
      const key = `${mls.materialName.trim().toLowerCase()}_${(mls.unit || 'unit').trim().toLowerCase()}`;
      if (!stockMap[key]) {
        stockMap[key] = {
          materialName: mls.materialName.trim(),
          unit: mls.unit || 'Unit',
          purchasedQty: 0,
          otherSupplyQty: 0,
          siteSupplyQty: 0,
          totalPurchaseValue: 0,
        };
      }
      stockMap[key].siteSupplyQty += parseFloat(mls.quantity as string) || 0;
    }

    const items = Object.values(stockMap).map(item => {
      const totalSupplied = Math.round((item.otherSupplyQty + item.siteSupplyQty) * 100) / 100;
      const currentStock = Math.round((item.purchasedQty - totalSupplied) * 100) / 100;
      const avgRate = item.purchasedQty > 0 ? (item.totalPurchaseValue / item.purchasedQty) : 0;
      const valuation = Math.max(0, Math.round(currentStock * avgRate * 100) / 100);
      
      let status = 'IN_STOCK';
      if (currentStock <= 0) status = 'OUT_OF_STOCK';
      else if (currentStock <= 15) status = 'LOW_STOCK';

      return {
        materialName: item.materialName,
        unit: item.unit,
        purchasedQty: Math.round(item.purchasedQty * 100) / 100,
        otherSupplyQty: Math.round(item.otherSupplyQty * 100) / 100,
        siteSupplyQty: Math.round(item.siteSupplyQty * 100) / 100,
        totalSuppliedQty: totalSupplied,
        currentStock,
        avgRate: Math.round(avgRate * 100) / 100,
        stockValuation: valuation,
        status
      };
    }).sort((a, b) => b.stockValuation - a.stockValuation);

    const totalStockUnits = items.reduce((acc, i) => acc + i.currentStock, 0);
    const totalValuation = items.reduce((acc, i) => acc + i.stockValuation, 0);
    const lowStockCount = items.filter(i => i.status !== 'IN_STOCK').length;

    res.json({
      items,
      totalDistinctMaterials: items.length,
      totalStockUnits: Math.round(totalStockUnits * 100) / 100,
      totalStockValuation: Math.round(totalValuation * 100) / 100,
      lowStockCount
    });
  } catch (error) {
    console.error('Failed to compute stock summary:', error);
    res.status(500).json({ error: 'Failed to compute stock inventory' });
  }
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
      const paid = data.paidAmount !== undefined ? data.paidAmount : (data.paymentStatus === 'PAID' ? totalAmount : 0);
      const outstanding = data.outstandingAmount !== undefined ? data.outstandingAmount : Math.max(0, totalAmount - paid);
      
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
        paidAmount: paid.toString(),
        outstandingAmount: outstanding.toString(),
      }).returning();
      return res.json(result[0]);
    } else if (type === 'labour-supply') {
      const data = labourSupplySchema.parse(req.body);
      const subtotal = Math.round((data.materialAmount + data.labourAmount) * 100) / 100;
      const taxAmount = Math.round(subtotal * (data.taxPercentage / 100) * 100) / 100;
      const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
      const paid = data.paidAmount !== undefined ? data.paidAmount : (data.paymentStatus === 'PAID' ? totalAmount : 0);
      const outstanding = data.outstandingAmount !== undefined ? data.outstandingAmount : Math.max(0, totalAmount - paid);
      
      const result = await db.insert(materialLabourSupplies).values({
        userId: req.dbUser!.id,
        ...data,
        labourQuantity: data.labourQuantity !== undefined ? data.labourQuantity.toString() : '0',
        materialRate: data.materialRate !== undefined ? data.materialRate.toString() : '0',
        labourRate: data.labourRate !== undefined ? data.labourRate.toString() : '0',
        materialQuantity: data.materialQuantity.toString(),
        materialAmount: data.materialAmount.toString(),
        labourAmount: data.labourAmount.toString(),
        subtotal: subtotal.toString(),
        taxPercentage: data.taxPercentage.toString(),
        tax: taxAmount.toString(),
        totalAmount: totalAmount.toString(),
        paidAmount: paid.toString(),
        outstandingAmount: outstanding.toString(),
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
      const paid = data.paidAmount !== undefined ? data.paidAmount : (data.paymentStatus === 'PAID' ? totalAmount : 0);
      const outstanding = data.outstandingAmount !== undefined ? data.outstandingAmount : Math.max(0, totalAmount - paid);
      
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
        paidAmount: paid.toString(),
        outstandingAmount: outstanding.toString(),
      }).where(and(eq(table.id, numId), eq(table.userId, req.dbUser!.id))).returning();
      
      if (!result.length) return res.status(404).json({ error: 'Record not found' });
      return res.json(result[0]);
    } else if (type === 'labour-supply') {
      const data = labourSupplySchema.parse(req.body);
      const subtotal = Math.round((data.materialAmount + data.labourAmount) * 100) / 100;
      const taxAmount = Math.round(subtotal * (data.taxPercentage / 100) * 100) / 100;
      const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
      const paid = data.paidAmount !== undefined ? data.paidAmount : (data.paymentStatus === 'PAID' ? totalAmount : 0);
      const outstanding = data.outstandingAmount !== undefined ? data.outstandingAmount : Math.max(0, totalAmount - paid);
      
      const result = await db.update(materialLabourSupplies).set({
        ...data,
        labourQuantity: data.labourQuantity !== undefined ? data.labourQuantity.toString() : '0',
        materialRate: data.materialRate !== undefined ? data.materialRate.toString() : '0',
        labourRate: data.labourRate !== undefined ? data.labourRate.toString() : '0',
        materialQuantity: data.materialQuantity.toString(),
        materialAmount: data.materialAmount.toString(),
        labourAmount: data.labourAmount.toString(),
        subtotal: subtotal.toString(),
        taxPercentage: data.taxPercentage.toString(),
        tax: taxAmount.toString(),
        totalAmount: totalAmount.toString(),
        paidAmount: paid.toString(),
        outstandingAmount: outstanding.toString(),
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
