import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { items, auditLogs } from '../../db/schema.ts';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

const itemRouter = Router();
itemRouter.use(requireAuth);

const itemSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['PRODUCT', 'SERVICE']).default('PRODUCT'),
  hsnCode: z.string().optional().nullable().default(''),
  unit: z.string().default('Nos'),
  salePrice: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 0)),
  purchasePrice: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 0)),
  taxRate: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 18)),
  openingStock: z.union([z.number(), z.string()]).transform(v => Number(v) || 0).optional().default(0),
  minStockAlert: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 0)).optional().default(0),
  description: z.string().optional().nullable().default(''),
});

// GET /api/items - List all items
itemRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const { search, type, lowStock } = req.query;

    const itemList = await db.select().from(items).where(
      and(
        eq(items.userId, userId),
        eq(items.isDeleted, 0),
        type ? eq(items.type, String(type)) : sql`1=1`,
        search ? sql`LOWER(${items.name}) LIKE LOWER(${'%' + search + '%'})` : sql`1=1`,
        lowStock === 'true' ? sql`${items.currentStock} <= ${items.minStockAlert}` : sql`1=1`
      )
    ).orderBy(desc(items.createdAt));

    // Calculate total stock valuation
    const stockValuation = itemList.reduce((sum, item) => {
      const stock = parseFloat(item.currentStock || '0');
      const cost = parseFloat(item.purchasePrice || item.salePrice || '0');
      return sum + (stock > 0 ? stock * cost : 0);
    }, 0);

    res.json({
      items: itemList,
      totalCount: itemList.length,
      stockValuation: Math.round(stockValuation * 100) / 100,
    });
  } catch (error) {
    console.error('Failed to fetch items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// POST /api/items - Create item
itemRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const data = itemSchema.parse(req.body);

    const inserted = await db.insert(items).values({
      userId,
      name: data.name,
      type: data.type,
      hsnCode: data.hsnCode || null,
      unit: data.unit,
      salePrice: data.salePrice.toString(),
      purchasePrice: data.purchasePrice.toString(),
      taxRate: data.taxRate.toString(),
      openingStock: data.openingStock.toString(),
      currentStock: data.openingStock.toString(),
      minStockAlert: data.minStockAlert.toString(),
      description: data.description || null,
    }).returning();

    await db.insert(auditLogs).values({
      userId,
      action: 'CREATE_ITEM',
      entityType: 'ITEM',
      entityId: inserted[0].id,
      metadata: JSON.stringify({ name: data.name, type: data.type })
    });

    res.status(201).json(inserted[0]);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to create item' });
  }
});

// PUT /api/items/:id - Update item
itemRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid item ID' });

    const data = itemSchema.parse(req.body);

    const updated = await db.update(items).set({
      name: data.name,
      type: data.type,
      hsnCode: data.hsnCode || null,
      unit: data.unit,
      salePrice: data.salePrice.toString(),
      purchasePrice: data.purchasePrice.toString(),
      taxRate: data.taxRate.toString(),
      minStockAlert: data.minStockAlert.toString(),
      description: data.description || null,
      updatedAt: new Date()
    }).where(and(eq(items.id, id), eq(items.userId, userId))).returning();

    if (updated.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(updated[0]);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to update item' });
  }
});

// POST /api/items/:id/adjust-stock - Stock adjustment
itemRouter.post('/:id/adjust-stock', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid item ID' });

    const { adjustmentQuantity, adjustmentType, reason } = req.body;
    const qty = parseFloat(adjustmentQuantity);
    if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Valid quantity required' });

    const delta = adjustmentType === 'SUBTRACT' ? -qty : qty;

    const updated = await db.update(items).set({
      currentStock: sql`${items.currentStock} + ${delta}`,
      updatedAt: new Date()
    }).where(and(eq(items.id, id), eq(items.userId, userId))).returning();

    if (updated.length === 0) return res.status(404).json({ error: 'Item not found' });

    await db.insert(auditLogs).values({
      userId,
      action: 'STOCK_ADJUSTMENT',
      entityType: 'ITEM',
      entityId: id,
      metadata: JSON.stringify({ delta, reason, currentStock: updated[0].currentStock })
    });

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
});

// DELETE /api/items/:id - Soft delete
itemRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid item ID' });

    await db.update(items)
      .set({ isDeleted: 1, updatedAt: new Date() })
      .where(and(eq(items.id, id), eq(items.userId, userId)));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

export default itemRouter;
