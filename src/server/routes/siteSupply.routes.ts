import express from 'express';
import { Response } from 'express';
import { db } from '../../db/index.js';
import { siteSupplies, siteSupplyItems, materials, auditLogs } from '../../db/schema.js';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { StockManager, calculateSiteSupplyTotals } from '../lib/accounting.js';
import { assertLocationAccess } from '../lib/locationAuth.js';

const siteSupplyRouter = express.Router();
siteSupplyRouter.use(requireAuth);

siteSupplyRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
    if (!locationId) return res.status(400).json({ error: 'Location ID required' });

    await assertLocationAccess(userId, locationId);

    const records = await db.select().from(siteSupplies)
      .where(and(eq(siteSupplies.locationId, locationId), eq(siteSupplies.isDeleted, 0)))
      .orderBy(desc(siteSupplies.date), desc(siteSupplies.id));
    
    const recordIds = records.map(r => r.id);
    let items: any[] = [];
    if (recordIds.length > 0) {
      items = await db.select().from(siteSupplyItems).where(and(inArray(siteSupplyItems.siteSupplyId, recordIds), eq(siteSupplyItems.isDeleted, 0)));
    }
    
    const combined = records.map(r => {
      let meta: any = {};
      if (r.notes && r.notes.startsWith('{') && r.notes.endsWith('}')) {
        try {
          meta = JSON.parse(r.notes);
        } catch {
          meta = {};
        }
      }
      return {
        ...r,
        displayNotes: meta.userNotes !== undefined ? meta.userNotes : r.notes,
        gstBreakdown: meta.gstBreakdown || null,
        subtotal: meta.subtotal || r.totalAmount,
        taxAmount: meta.taxAmount || '0',
        items: items.filter(i => i.siteSupplyId === r.id).map(it => {
          let itemMeta: any = {};
          if (meta.itemsDetail && meta.itemsDetail[it.id]) {
            itemMeta = meta.itemsDetail[it.id];
          }
          return {
            ...it,
            unit: itemMeta.unit || 'Nos',
            taxPercentage: itemMeta.taxPercentage || 0,
            taxAmount: itemMeta.taxAmount || 0,
            subtotal: itemMeta.subtotal || it.amount,
            totalWithGst: it.amount
          };
        })
      };
    });
    
    res.json(combined);
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to fetch site supplies' });
  }
});

siteSupplyRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const { locationId, date, teamId, responsiblePerson, workDescription, referenceNumber, notes, investorId, items } = req.body;
    
    if (!locationId || !date || !items || !items.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const locId = parseInt(String(locationId), 10);
    await assertLocationAccess(userId, locId);

    // Normalize and resolve material items to UPPERCASE
    const resolvedItems: any[] = [];
    for (const rawItem of (items || [])) {
      const q = parseFloat(String(rawItem.quantity || 0));
      if (q <= 0) continue;
      
      let matId = rawItem.materialId ? parseInt(String(rawItem.materialId), 10) : null;
      let matName = (rawItem.materialName || '').trim().toUpperCase();
      let unit = rawItem.unit || 'Unit';
      let rate = parseFloat(String(rawItem.rate || 0));

      if ((!matId || isNaN(matId)) && matName) {
        const existing = await db.select().from(materials).where(
          and(
            eq(materials.locationId, locId),
            sql`UPPER(TRIM(${materials.name})) = ${matName}`,
            eq(materials.isDeleted, 0)
          )
        ).limit(1);

        if (existing.length > 0) {
          matId = existing[0].id;
          unit = existing[0].defaultUnit || unit;
        } else {
          const created = await db.insert(materials).values({
            userId,
            locationId: locId,
            name: matName,
            defaultUnit: unit,
            defaultRate: rate.toString(),
            minStock: '0.00',
            isActive: 1,
            isDeleted: 0
          }).returning();
          matId = created[0].id;
        }
      }

      if (matId && !isNaN(matId)) {
        resolvedItems.push({
          ...rawItem,
          materialId: matId,
          quantity: q,
          rate,
          unit
        });
      }
    }

    if (!resolvedItems.length) {
      return res.status(400).json({ error: 'At least one valid material item with quantity is required' });
    }

    const calculated = calculateSiteSupplyTotals(resolvedItems);

    const result = await db.transaction(async (tx) => {
      // Create metadata holding granular GST values
      const supplyMeta = {
        userNotes: notes || '',
        subtotal: calculated.subtotal.toString(),
        taxAmount: calculated.taxAmount.toString(),
        totalAmount: calculated.totalAmount.toString(),
        gstBreakdown: {
          subtotal: calculated.subtotal,
          totalTax: calculated.taxAmount,
          grandTotal: calculated.totalAmount
        },
        itemsDetail: {} as Record<number, any>
      };

      const supply = await tx.insert(siteSupplies).values({
        userId,
        locationId: locId,
        date,
        teamId: teamId || null,
        responsiblePerson,
        workDescription,
        referenceNumber,
        notes: JSON.stringify(supplyMeta),
        investorId: investorId || null,
        totalAmount: calculated.totalAmount.toString()
      }).returning();
      
      const supplyId = supply[0].id;
      
      for (const itemCalc of calculated.items) {
        const itemRow = await tx.insert(siteSupplyItems).values({
          siteSupplyId: supplyId,
          materialId: itemCalc.materialId,
          quantity: itemCalc.quantity.toString(),
          rate: itemCalc.rate.toString(),
          amount: itemCalc.totalAmount.toString()
        }).returning();

        supplyMeta.itemsDetail[itemRow[0].id] = {
          unit: itemCalc.unit,
          taxPercentage: itemCalc.taxPercentage,
          taxAmount: itemCalc.taxAmount,
          subtotal: itemCalc.subtotal,
          totalAmount: itemCalc.totalAmount
        };
        
        await StockManager.addStockMovement(tx, userId, locId, itemCalc.materialId, 'OUT', itemCalc.quantity, supplyId, 'SITE_SUPPLY', notes);
      }

      // Update notes with item details
      await tx.update(siteSupplies).set({ notes: JSON.stringify(supplyMeta) }).where(eq(siteSupplies.id, supplyId));
      
      await tx.insert(auditLogs).values({
        userId, action: 'CREATE_SITE_SUPPLY', entityType: 'SITE_SUPPLY', entityId: supplyId
      });
      return supply[0];
    });

    res.json(result);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to create site supply:', error);
    res.status(500).json({ error: 'Failed to create site supply' });
  }
});

siteSupplyRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const id = parseInt(req.params.id as string, 10);
    const { locationId, date, teamId, responsiblePerson, workDescription, referenceNumber, notes, investorId, items } = req.body;
    
    if (!locationId || !date || !items || !items.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const locId = parseInt(String(locationId), 10);
    await assertLocationAccess(userId, locId);

    // Normalize and resolve material items to UPPERCASE
    const resolvedItems: any[] = [];
    for (const rawItem of (items || [])) {
      const q = parseFloat(String(rawItem.quantity || 0));
      if (q <= 0) continue;
      
      let matId = rawItem.materialId ? parseInt(String(rawItem.materialId), 10) : null;
      let matName = (rawItem.materialName || '').trim().toUpperCase();
      let unit = rawItem.unit || 'Unit';
      let rate = parseFloat(String(rawItem.rate || 0));

      if ((!matId || isNaN(matId)) && matName) {
        const existing = await db.select().from(materials).where(
          and(
            eq(materials.locationId, locId),
            sql`UPPER(TRIM(${materials.name})) = ${matName}`,
            eq(materials.isDeleted, 0)
          )
        ).limit(1);

        if (existing.length > 0) {
          matId = existing[0].id;
          unit = existing[0].defaultUnit || unit;
        } else {
          const created = await db.insert(materials).values({
            userId,
            locationId: locId,
            name: matName,
            defaultUnit: unit,
            defaultRate: rate.toString(),
            minStock: '0.00',
            isActive: 1,
            isDeleted: 0
          }).returning();
          matId = created[0].id;
        }
      }

      if (matId && !isNaN(matId)) {
        resolvedItems.push({
          ...rawItem,
          materialId: matId,
          quantity: q,
          rate,
          unit
        });
      }
    }

    if (!resolvedItems.length) {
      return res.status(400).json({ error: 'At least one valid material item with quantity is required' });
    }

    const calculated = calculateSiteSupplyTotals(resolvedItems);

    const result = await db.transaction(async (tx) => {
      // Revert old stock
      const oldItems = await tx.select().from(siteSupplyItems).where(eq(siteSupplyItems.siteSupplyId, id));
      for (const item of oldItems) {
         await StockManager.addStockMovement(tx, userId, locId, item.materialId, 'IN', parseFloat(item.quantity as any), id, 'SITE_SUPPLY_UPDATE_REVERT', 'Reversed for update');
      }
      
      await tx.delete(siteSupplyItems).where(eq(siteSupplyItems.siteSupplyId, id));

      const supplyMeta = {
        userNotes: notes || '',
        subtotal: calculated.subtotal.toString(),
        taxAmount: calculated.taxAmount.toString(),
        totalAmount: calculated.totalAmount.toString(),
        gstBreakdown: {
          subtotal: calculated.subtotal,
          totalTax: calculated.taxAmount,
          grandTotal: calculated.totalAmount
        },
        itemsDetail: {} as Record<number, any>
      };

      const supply = await tx.update(siteSupplies).set({
        locationId: locId,
        date,
        teamId: teamId || null,
        responsiblePerson,
        workDescription,
        referenceNumber,
        notes: JSON.stringify(supplyMeta),
        investorId: investorId || null,
        totalAmount: calculated.totalAmount.toString()
      }).where(and(eq(siteSupplies.id, id), eq(siteSupplies.isDeleted, 0))).returning();
      
      for (const itemCalc of calculated.items) {
        const itemRow = await tx.insert(siteSupplyItems).values({
          siteSupplyId: id,
          materialId: itemCalc.materialId,
          quantity: itemCalc.quantity.toString(),
          rate: itemCalc.rate.toString(),
          amount: itemCalc.totalAmount.toString()
        }).returning();

        supplyMeta.itemsDetail[itemRow[0].id] = {
          unit: itemCalc.unit,
          taxPercentage: itemCalc.taxPercentage,
          taxAmount: itemCalc.taxAmount,
          subtotal: itemCalc.subtotal,
          totalAmount: itemCalc.totalAmount
        };
        
        await StockManager.addStockMovement(tx, userId, locId, itemCalc.materialId, 'OUT', itemCalc.quantity, id, 'SITE_SUPPLY', notes);
      }

      await tx.update(siteSupplies).set({ notes: JSON.stringify(supplyMeta) }).where(eq(siteSupplies.id, id));
      
      await tx.insert(auditLogs).values({
        userId, action: 'UPDATE_SITE_SUPPLY', entityType: 'SITE_SUPPLY', entityId: id
      });

      return supply[0];
    });

    res.json(result);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Failed to update record' });
  }
});

siteSupplyRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const id = parseInt(req.params.id as string, 10);
    
    await db.transaction(async (tx) => {
      const record = await tx.select().from(siteSupplies).where(eq(siteSupplies.id, id));
      if (!record.length) return;
      const locId = record[0].locationId;
      await assertLocationAccess(userId, locId);

      await tx.update(siteSupplies).set({ isDeleted: 1 }).where(eq(siteSupplies.id, id));
      // Delete child items
      const items = await tx.select().from(siteSupplyItems).where(eq(siteSupplyItems.siteSupplyId, id));
      await tx.update(siteSupplyItems).set({ isDeleted: 1 }).where(eq(siteSupplyItems.siteSupplyId, id));
      
      // Reverse stock ledger
      for (const item of items) {
         await StockManager.addStockMovement(tx, userId, locId, item.materialId, 'IN', parseFloat(item.quantity as any), id, 'SITE_SUPPLY_DELETE', 'Reversed from delete');
      }
      
      await tx.insert(auditLogs).values({ userId, action: 'DELETE_SITE_SUPPLY', entityType: 'SITE_SUPPLY', entityId: id });
    });
    
    res.json({ success: true });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

export default siteSupplyRouter;
