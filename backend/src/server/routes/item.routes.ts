import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { items, stockMovements, auditLogs } from '../../db/schema.ts';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { DecimalMath } from '../../shared/accountingEngine.ts';

const itemRouter = Router();
itemRouter.use(requireAuth);

const itemSchema = z.object({
  businessId: z.number().int().optional(),
  name: z.string().min(1),
  sku: z.string().optional().nullable().default(''),
  type: z.enum(['PRODUCT', 'SERVICE']).default('PRODUCT'),
  category: z.string().optional().nullable().default('General'),
  hsnCode: z.string().optional().nullable().default(''),
  unit: z.string().default('Nos'),
  salePrice: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 0)),
  purchasePrice: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 0)),
  taxRate: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 18)),
  cessRate: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 0)).optional().default(0),
  openingStock: z.union([z.number(), z.string()]).transform(v => Number(v) || 0).optional().default(0),
  minStockAlert: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 0)).optional().default(0),
  description: z.string().optional().nullable().default(''),
});

// GET /api/items - List all items with business context
itemRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const businessId = req.businessId;
    const { search, type, lowStock } = req.query;

    const conditions = [
      eq(items.userId, userId),
      eq(items.isDeleted, 0),
    ];

    if (businessId) conditions.push(eq(items.businessId, businessId));
    if (type) conditions.push(eq(items.type, String(type)));
    if (search) conditions.push(sql`LOWER(${items.name}) LIKE LOWER(${'%' + search + '%'})`);
    if (lowStock === 'true') conditions.push(sql`${items.currentStock} <= ${items.minStockAlert}`);

    const itemList = await db.select().from(items).where(and(...conditions)).orderBy(desc(items.createdAt));

    // Perpetual stock valuation using DecimalMath
    const stockValuation = itemList.reduce((sum, item) => {
      const stock = Number(item.currentStock || 0);
      const cost = Number(item.purchasePrice || item.salePrice || 0);
      return DecimalMath.add(sum, stock > 0 ? DecimalMath.mul(stock, cost) : 0);
    }, 0);

    res.json({
      items: itemList,
      totalCount: itemList.length,
      stockValuation,
    });
  } catch (error) {
    console.error('Failed to fetch items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// GET /api/items/movements - Stock movement audit ledger
itemRouter.get('/movements/all', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const businessId = req.businessId;
    const { itemId, locationId } = req.query;

    const conditions = [eq(stockMovements.userId, userId)];
    if (businessId) conditions.push(eq(stockMovements.businessId, businessId));
    if (itemId) conditions.push(eq(stockMovements.itemId, Number(itemId)));
    if (locationId) conditions.push(eq(stockMovements.locationId, Number(locationId)));

    const movements = await db.select({
      id: stockMovements.id,
      itemId: stockMovements.itemId,
      movementType: stockMovements.movementType,
      quantity: stockMovements.quantity,
      unit: stockMovements.unit,
      unitCost: stockMovements.unitCost,
      totalCost: stockMovements.totalCost,
      sourceDocumentType: stockMovements.sourceDocumentType,
      sourceDocumentId: stockMovements.sourceDocumentId,
      notes: stockMovements.notes,
      createdAt: stockMovements.createdAt,
      itemName: items.name,
    })
    .from(stockMovements)
    .leftJoin(items, eq(stockMovements.itemId, items.id))
    .where(and(...conditions))
    .orderBy(desc(stockMovements.createdAt))
    .limit(100);

    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
});

// POST /api/items - Create item
itemRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const businessId = req.body.businessId || req.businessId;
    const data = itemSchema.parse(req.body);

    const inserted = await db.insert(items).values({
      userId,
      businessId,
      name: data.name,
      sku: data.sku || null,
      type: data.type,
      category: data.category || 'General',
      hsnCode: data.hsnCode || null,
      unit: data.unit,
      salePrice: data.salePrice.toString(),
      purchasePrice: data.purchasePrice.toString(),
      taxRate: data.taxRate.toString(),
      cessRate: data.cessRate.toString(),
      openingStock: data.openingStock.toString(),
      currentStock: data.openingStock.toString(),
      minStockAlert: data.minStockAlert.toString(),
      description: data.description || null,
    }).returning();

    // If opening stock > 0, log opening stock movement
    if (data.openingStock > 0) {
      await db.insert(stockMovements).values({
        userId,
        businessId,
        itemId: inserted[0].id,
        movementType: 'ADJUSTMENT_IN',
        quantity: data.openingStock.toString(),
        unit: data.unit,
        unitCost: data.purchasePrice.toString(),
        totalCost: DecimalMath.mul(data.openingStock, data.purchasePrice).toString(),
        sourceDocumentType: 'MANUAL_ADJUSTMENT',
        sourceDocumentId: inserted[0].id,
        notes: 'Initial Opening Stock',
      });
    }

    await db.insert(auditLogs).values({
      userId,
      businessId,
      action: 'CREATE',
      entityType: 'ITEM',
      entityId: inserted[0].id,
      afterState: JSON.stringify({ name: data.name, currentStock: data.openingStock })
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
      sku: data.sku || null,
      type: data.type,
      category: data.category || 'General',
      hsnCode: data.hsnCode || null,
      unit: data.unit,
      salePrice: data.salePrice.toString(),
      purchasePrice: data.purchasePrice.toString(),
      taxRate: data.taxRate.toString(),
      cessRate: data.cessRate.toString(),
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

// POST /api/items/:id/adjust-stock - Stock adjustment with audit and movement record
itemRouter.post('/:id/adjust-stock', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const businessId = req.businessId;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid item ID' });

    const { adjustmentQuantity, adjustmentType, reason, locationId } = req.body;
    const qty = parseFloat(adjustmentQuantity);
    if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Valid positive quantity required' });

    const isSubtract = adjustmentType === 'SUBTRACT';
    const delta = isSubtract ? -qty : qty;
    const movementType = isSubtract ? 'ADJUSTMENT_OUT' : 'ADJUSTMENT_IN';

    const itemRec = await db.select().from(items).where(and(eq(items.id, id), eq(items.userId, userId))).limit(1);
    if (itemRec.length === 0) return res.status(404).json({ error: 'Item not found' });
    const item = itemRec[0];

    const currentQty = Number(item.currentStock || 0);
    if (isSubtract && currentQty < qty) {
      return res.status(400).json({ error: `Cannot subtract ${qty} ${item.unit}. Current stock is only ${currentQty}.` });
    }

    const updated = await db.update(items).set({
      currentStock: sql`${items.currentStock} + ${delta}`,
      updatedAt: new Date()
    }).where(eq(items.id, id)).returning();

    const unitCost = Number(item.purchasePrice || item.salePrice || 0);

    // Create stock movement record
    await db.insert(stockMovements).values({
      userId,
      businessId: businessId || item.businessId,
      locationId: locationId ? Number(locationId) : null,
      itemId: id,
      movementType,
      quantity: qty.toString(),
      unit: item.unit,
      unitCost: unitCost.toString(),
      totalCost: DecimalMath.mul(qty, unitCost).toString(),
      sourceDocumentType: 'MANUAL_ADJUSTMENT',
      sourceDocumentId: id,
      notes: reason || 'Manual stock adjustment',
    });

    await db.insert(auditLogs).values({
      userId,
      businessId: item.businessId,
      locationId: locationId ? Number(locationId) : null,
      action: 'STOCK_ADJUSTMENT',
      entityType: 'ITEM',
      entityId: id,
      afterState: JSON.stringify({ delta, reason, currentStock: updated[0].currentStock })
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
