
import express, { Response } from 'express';
import { db } from '../../db/index.js';
import { materialPurchases, materialSupplies, materialLabourSupplies, stockLedger, auditLogs } from '../../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { StockManager } from '../lib/accounting.js';

const materialRouter = express.Router();
materialRouter.use(requireAuth);

materialRouter.get('/:type', async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.params;
    const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
    if (!locationId) return res.status(400).json({ error: 'Location ID is required' });

    let data;
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
      const data = req.body;
      const subtotal = Math.round(data.quantity * data.rate * 100) / 100;
      const taxableAmount = subtotal - (data.discount || 0);
      const taxAmount = Math.round(taxableAmount * ((data.taxPercentage || 0) / 100) * 100) / 100;
      const totalAmount = Math.round((taxableAmount + taxAmount + (data.transportCost || data.transport || 0)) * 100) / 100;
      const paid = data.paidAmount !== undefined ? data.paidAmount : (data.paymentStatus === 'PAID' ? totalAmount : 0);
      const outstanding = data.outstandingAmount !== undefined ? data.outstandingAmount : Math.max(0, totalAmount - paid);
      
      const result = await db.transaction(async (tx) => {
        let insertedId = 0;
        let record: any;
        
        if (type === 'purchase') {
          const inserted = await tx.insert(materialPurchases).values({
            userId: req.dbUser!.id, locationId: data.locationId,
            date: data.date, partyName: data.partyName || '', materialName: data.materialName || '', materialId: data.materialId,
            quantity: data.quantity.toString(), unit: data.unit || '', rate: data.rate.toString(),
            subtotal: subtotal.toString(), transportCost: (data.transportCost || 0).toString(),
            discount: (data.discount || 0).toString(), taxPercentage: (data.taxPercentage || 0).toString(),
            tax: taxAmount.toString(), totalAmount: totalAmount.toString(),
            paidAmount: paid.toString(), outstandingAmount: outstanding.toString(),
            paymentStatus: data.paymentStatus || 'UNPAID',
            paymentMethod: data.paymentMethod, referenceNumber: data.referenceNumber, description: data.description || data.notes
          }).returning();
          insertedId = inserted[0].id;
          record = inserted[0];
          
          if (data.materialId && data.quantity > 0) {
            await StockManager.addStockMovement(tx, req.dbUser!.id, data.locationId, data.materialId, 'IN', data.quantity, insertedId, 'PURCHASE', data.description || data.notes);
          }
        } else {
          const inserted = await tx.insert(materialSupplies).values({
            userId: req.dbUser!.id, locationId: data.locationId,
            date: data.date, partyName: data.partyName || '', partyId: data.partyId,
            materialName: data.materialName || '', materialId: data.materialId,
            quantity: data.quantity.toString(), unit: data.unit || '', rate: data.rate.toString(),
            subtotal: subtotal.toString(), transportCost: (data.transportCost || 0).toString(),
            discount: (data.discount || 0).toString(), taxPercentage: (data.taxPercentage || 0).toString(),
            tax: taxAmount.toString(), totalAmount: totalAmount.toString(),
            paidAmount: paid.toString(), outstandingAmount: outstanding.toString(),
            paymentStatus: data.paymentStatus || 'UNPAID',
            paymentMethod: data.paymentMethod, referenceNumber: data.referenceNumber, notes: data.description || data.notes
          }).returning();
          insertedId = inserted[0].id;
          record = inserted[0];
          
          if (data.materialId && data.quantity > 0) {
            await StockManager.addStockMovement(tx, req.dbUser!.id, data.locationId, data.materialId, 'OUT', data.quantity, insertedId, 'MATERIAL_SUPPLY', data.description || data.notes);
          }
        }
        
        await tx.insert(auditLogs).values({ userId: req.dbUser!.id, action: `CREATE_${String(type).toUpperCase()}`, entityType: 'MATERIAL_TRANSACTION', entityId: insertedId });
        return record;
      });
      return res.json(result);
      
    } else if (type === 'labour-supply') {
       // Old labour-supply endpoint preserved ...
       // (Keeping it minimal for backward compatibility)
       const data = req.body;
       const subtotal = Math.round(((data.materialAmount||0) + (data.labourAmount||0)) * 100) / 100;
       const taxAmount = Math.round(subtotal * ((data.taxPercentage||0) / 100) * 100) / 100;
       const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
       const paid = data.paidAmount !== undefined ? data.paidAmount : (data.paymentStatus === 'PAID' ? totalAmount : 0);
       const outstanding = data.outstandingAmount !== undefined ? data.outstandingAmount : Math.max(0, totalAmount - paid);
       
       const result = await db.insert(materialLabourSupplies).values({
        userId: req.dbUser!.id, locationId: data.locationId, date: data.date, partyName: data.partyName || '', workDescription: data.workDescription || '',
        materialQuantity: (data.materialQuantity||0).toString(), materialAmount: (data.materialAmount||0).toString(),
        labourAmount: (data.labourAmount||0).toString(), subtotal: subtotal.toString(), taxPercentage: (data.taxPercentage||0).toString(),
        tax: taxAmount.toString(), totalAmount: totalAmount.toString(), paidAmount: paid.toString(), outstandingAmount: outstanding.toString()
       }).returning();
       return res.json(result[0]);
    }
    res.status(400).json({ error: 'Invalid type' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});


materialRouter.put('/:type/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { type, id } = req.params;
    const numId = parseInt(id as string, 10);
    
    if (type === 'purchase' || type === 'supply') {
      const data = req.body;
      const subtotal = Math.round(data.quantity * data.rate * 100) / 100;
      const taxableAmount = subtotal - (data.discount || 0);
      const taxAmount = Math.round(taxableAmount * ((data.taxPercentage || 0) / 100) * 100) / 100;
      const totalAmount = Math.round((taxableAmount + taxAmount + (data.transportCost || data.transport || 0)) * 100) / 100;
      const paid = data.paidAmount !== undefined ? data.paidAmount : (data.paymentStatus === 'PAID' ? totalAmount : 0);
      const outstanding = data.outstandingAmount !== undefined ? data.outstandingAmount : Math.max(0, totalAmount - paid);
      
      const result = await db.transaction(async (tx) => {
        let record: any;
        
        if (type === 'purchase') {
          // Revert old stock
          const oldRec = await tx.select().from(materialPurchases).where(and(eq(materialPurchases.id, numId), eq(materialPurchases.userId, req.dbUser!.id)));
          if (oldRec.length && oldRec[0].materialId) {
             await StockManager.addStockMovement(tx, req.dbUser!.id, oldRec[0].locationId, oldRec[0].materialId, 'OUT', parseFloat(oldRec[0].quantity), numId, 'PURCHASE_UPDATE_REVERT', 'Reversed for update');
          }

          const updated = await tx.update(materialPurchases).set({
            date: data.date, partyName: data.partyName || '', materialName: data.materialName || '', materialId: data.materialId,
            quantity: data.quantity.toString(), unit: data.unit || '', rate: data.rate.toString(),
            subtotal: subtotal.toString(), transportCost: (data.transportCost || 0).toString(),
            discount: (data.discount || 0).toString(), taxPercentage: (data.taxPercentage || 0).toString(),
            tax: taxAmount.toString(), totalAmount: totalAmount.toString(),
            paidAmount: paid.toString(), outstandingAmount: outstanding.toString(),
            paymentStatus: data.paymentStatus || 'UNPAID',
            paymentMethod: data.paymentMethod, referenceNumber: data.referenceNumber, description: data.description || data.notes
          }).where(and(eq(materialPurchases.id, numId), eq(materialPurchases.userId, req.dbUser!.id))).returning();
          record = updated[0];
          
          if (data.materialId && data.quantity > 0) {
            await StockManager.addStockMovement(tx, req.dbUser!.id, data.locationId, data.materialId, 'IN', data.quantity, numId, 'PURCHASE', data.description || data.notes);
          }
        } else {
          // Revert old stock
          const oldRec = await tx.select().from(materialSupplies).where(and(eq(materialSupplies.id, numId), eq(materialSupplies.userId, req.dbUser!.id)));
          if (oldRec.length && oldRec[0].materialId) {
             await StockManager.addStockMovement(tx, req.dbUser!.id, oldRec[0].locationId, oldRec[0].materialId, 'IN', parseFloat(oldRec[0].quantity), numId, 'MATERIAL_SUPPLY_UPDATE_REVERT', 'Reversed for update');
          }

          const updated = await tx.update(materialSupplies).set({
            date: data.date, partyName: data.partyName || '', partyId: data.partyId,
            materialName: data.materialName || '', materialId: data.materialId,
            quantity: data.quantity.toString(), unit: data.unit || '', rate: data.rate.toString(),
            subtotal: subtotal.toString(), transportCost: (data.transportCost || 0).toString(),
            discount: (data.discount || 0).toString(), taxPercentage: (data.taxPercentage || 0).toString(),
            tax: taxAmount.toString(), totalAmount: totalAmount.toString(),
            paidAmount: paid.toString(), outstandingAmount: outstanding.toString(),
            paymentStatus: data.paymentStatus || 'UNPAID',
            paymentMethod: data.paymentMethod, referenceNumber: data.referenceNumber, notes: data.description || data.notes
          }).where(and(eq(materialSupplies.id, numId), eq(materialSupplies.userId, req.dbUser!.id))).returning();
          record = updated[0];
          
          if (data.materialId && data.quantity > 0) {
            await StockManager.addStockMovement(tx, req.dbUser!.id, data.locationId, data.materialId, 'OUT', data.quantity, numId, 'MATERIAL_SUPPLY', data.description || data.notes);
          }
        }
        
        await tx.insert(auditLogs).values({ userId: req.dbUser!.id, action: `UPDATE_${String(type).toUpperCase()}`, entityType: 'MATERIAL_TRANSACTION', entityId: numId });
        return record;
      });
      return res.json(result);
    }
    res.status(400).json({ error: 'Invalid type' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

materialRouter.delete('/:type/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { type, id } = req.params;
    const numId = parseInt(id as string, 10);
    
    await db.transaction(async (tx) => {
      let table: any;
      if (type === 'purchase') {
        table = materialPurchases;
        const rec = await tx.select().from(table).where(and(eq(table.id, numId), eq(table.userId, req.dbUser!.id)));
        if (rec.length && rec[0].materialId) {
           await StockManager.addStockMovement(tx, req.dbUser!.id, rec[0].locationId, rec[0].materialId, 'OUT', parseFloat(rec[0].quantity), numId, 'PURCHASE_DELETE', 'Reversed from delete');
        }
      } else if (type === 'supply') {
        table = materialSupplies;
        const rec = await tx.select().from(table).where(and(eq(table.id, numId), eq(table.userId, req.dbUser!.id)));
        if (rec.length && rec[0].materialId) {
           await StockManager.addStockMovement(tx, req.dbUser!.id, rec[0].locationId, rec[0].materialId, 'IN', parseFloat(rec[0].quantity), numId, 'MATERIAL_SUPPLY_DELETE', 'Reversed from delete');
        }
      } else if (type === 'labour-supply') {
        table = materialLabourSupplies;
      }
      
      await tx.update(table).set({ isDeleted: 1 }).where(and(eq(table.id, numId), eq(table.userId, req.dbUser!.id)));
      await tx.insert(auditLogs).values({ userId: req.dbUser!.id, action: `DELETE_${String(type).toUpperCase()}`, entityType: 'MATERIAL_TRANSACTION', entityId: numId });
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

export default materialRouter;
