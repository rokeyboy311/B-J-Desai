import express from 'express';
import { Response } from 'express';
import { db } from '../../db/index.js';
import { siteSupplies, siteSupplyItems, auditLogs } from '../../db/schema.js';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { StockManager } from '../lib/accounting.js';

const siteSupplyRouter = express.Router();
siteSupplyRouter.use(requireAuth);

siteSupplyRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
    if (!locationId) return res.status(400).json({ error: 'Location ID required' });
    const records = await db.select().from(siteSupplies)
      .where(and(eq(siteSupplies.locationId, locationId), eq(siteSupplies.isDeleted, 0)))
      .orderBy(desc(siteSupplies.date), desc(siteSupplies.id));
    
    const recordIds = records.map(r => r.id);
    let items: any[] = [];
    if (recordIds.length > 0) {
      items = await db.select().from(siteSupplyItems).where(and(inArray(siteSupplyItems.siteSupplyId, recordIds), eq(siteSupplyItems.isDeleted, 0)));
    }
    
    const combined = records.map(r => ({
      ...r,
      items: items.filter(i => i.siteSupplyId === r.id)
    }));
    
    res.json(combined);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch site supplies' });
  }
});

siteSupplyRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { locationId, date, teamId, responsiblePerson, workDescription, referenceNumber, notes, investorId, items } = req.body;
    const userId = req.dbUser?.id || 1;
    
    if (!locationId || !date || !items || !items.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const totalAmount = items.reduce((sum: number, item: any) => sum + (parseFloat(item.quantity) * parseFloat(item.rate)), 0);

    const result = await db.transaction(async (tx) => {
      const supply = await tx.insert(siteSupplies).values({
        userId,
        locationId, date, teamId: teamId || null, responsiblePerson, workDescription, referenceNumber, notes,
        investorId: investorId || null, totalAmount: totalAmount.toString()
      }).returning();
      
      const supplyId = supply[0].id;
      
      for (const item of items) {
        if (item.materialId && parseFloat(item.quantity) > 0) {
          const amount = parseFloat(item.quantity) * parseFloat(item.rate);
          await tx.insert(siteSupplyItems).values({
            siteSupplyId: supplyId,
            materialId: item.materialId,
            quantity: item.quantity.toString(),
            rate: item.rate.toString(),
            amount: amount.toString()
          });
          
          await StockManager.addStockMovement(tx, userId, locationId, item.materialId, 'OUT', parseFloat(item.quantity), supplyId, 'SITE_SUPPLY', notes);
        }
      }
      
      await tx.insert(auditLogs).values({
        userId, action: 'CREATE_SITE_SUPPLY', entityType: 'SITE_SUPPLY', entityId: supplyId
      });
      return supply[0];
    });

    res.json(result);
  } catch (error) {
    console.error('Failed to create site supply:', error);
    res.status(500).json({ error: 'Failed to create site supply' });
  }
});

siteSupplyRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { locationId, date, teamId, responsiblePerson, workDescription, referenceNumber, notes, investorId, items } = req.body;
    const userId = req.dbUser?.id || 1;
    
    if (!locationId || !date || !items || !items.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const totalAmount = items.reduce((sum: number, item: any) => sum + (parseFloat(item.quantity) * parseFloat(item.rate)), 0);

    const result = await db.transaction(async (tx) => {
      // Revert old stock
      const oldItems = await tx.select().from(siteSupplyItems).where(eq(siteSupplyItems.siteSupplyId, id));
      for (const item of oldItems) {
         await StockManager.addStockMovement(tx, userId, locationId, item.materialId, 'IN', parseFloat(item.quantity as any), id, 'SITE_SUPPLY_UPDATE_REVERT', 'Reversed for update');
      }
      
      await tx.delete(siteSupplyItems).where(eq(siteSupplyItems.siteSupplyId, id));

      const supply = await tx.update(siteSupplies).set({
        locationId, date, teamId: teamId || null, responsiblePerson, workDescription, referenceNumber, notes,
        investorId: investorId || null, totalAmount: totalAmount.toString()
      }).where(and(eq(siteSupplies.id, id), eq(siteSupplies.isDeleted, 0))).returning();
      
      for (const item of items) {
        if (item.materialId && parseFloat(item.quantity) > 0) {
          const amount = parseFloat(item.quantity) * parseFloat(item.rate);
          await tx.insert(siteSupplyItems).values({
            siteSupplyId: id,
            materialId: item.materialId,
            quantity: item.quantity.toString(),
            rate: item.rate.toString(),
            amount: amount.toString()
          });
          
          await StockManager.addStockMovement(tx, userId, locationId, item.materialId, 'OUT', parseFloat(item.quantity), id, 'SITE_SUPPLY', notes);
        }
      }
      
      await tx.insert(auditLogs).values({
        userId, action: 'UPDATE_SITE_SUPPLY', entityType: 'SITE_SUPPLY', entityId: id
      });

      return supply[0];
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update record' });
  }
});

siteSupplyRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const userId = req.dbUser?.id || 1;
    
    await db.transaction(async (tx) => {
      await tx.update(siteSupplies).set({ isDeleted: 1 }).where(eq(siteSupplies.id, id));
      // Delete child items
      const record = await tx.select().from(siteSupplies).where(eq(siteSupplies.id, id));
      const locId = record.length > 0 ? record[0].locationId : 0;
      const items = await tx.select().from(siteSupplyItems).where(eq(siteSupplyItems.siteSupplyId, id));
      await tx.update(siteSupplyItems).set({ isDeleted: 1 }).where(eq(siteSupplyItems.siteSupplyId, id));
      
      // Reverse stock ledger
      for (const item of items) {
         await StockManager.addStockMovement(tx, userId, locId, item.materialId, 'IN', parseFloat(item.quantity as any), id, 'SITE_SUPPLY_DELETE', 'Reversed from delete');
      }
      
      await tx.insert(auditLogs).values({
        userId, action: 'DELETE_SITE_SUPPLY', entityType: 'SITE_SUPPLY', entityId: id
      });
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

export default siteSupplyRouter;
