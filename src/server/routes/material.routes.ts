import express, { Response } from 'express';
import { db } from '../../db/index.js';
import { materialPurchases, materialSupplies, materialLabourSupplies, auditLogs, materials, stockLedger } from '../../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { StockManager } from '../lib/accounting.js';
import { assertLocationAccess } from '../lib/locationAuth.js';

const materialRouter = express.Router();
materialRouter.use(requireAuth);

async function resolveMaterialInfo(
  tx: any,
  userId: number,
  locationId: number,
  materialIdInput: any,
  materialNameInput: any,
  unitInput?: string,
  rateInput?: number
): Promise<{ id: number; name: string; unit: string } | null> {
  const locId = parseInt(String(locationId), 10);
  let matId = materialIdInput ? parseInt(String(materialIdInput), 10) : null;

  if (matId && !isNaN(matId)) {
    const existing = await tx.select().from(materials).where(and(eq(materials.id, matId), eq(materials.isDeleted, 0)));
    if (existing.length > 0) {
      return { id: existing[0].id, name: existing[0].name, unit: existing[0].defaultUnit || unitInput || 'Unit' };
    }
  }

  const rawName = (materialNameInput || '').trim();
  if (rawName) {
    const existingByName = await tx.select().from(materials).where(
      and(
        eq(materials.locationId, locId),
        sql`LOWER(${materials.name}) = LOWER(${rawName})`,
        eq(materials.isDeleted, 0)
      )
    );
    if (existingByName.length > 0) {
      return { id: existingByName[0].id, name: existingByName[0].name, unit: existingByName[0].defaultUnit || unitInput || 'Unit' };
    }

    // Automatically create master material so stock records stay consistent!
    const created = await tx.insert(materials).values({
      userId,
      locationId: locId,
      name: rawName,
      defaultUnit: unitInput || 'Unit',
      defaultRate: rateInput ? rateInput.toString() : '0.00',
      minStock: '0.00',
      isActive: 1,
      isDeleted: 0
    }).returning();

    return { id: created[0].id, name: created[0].name, unit: created[0].defaultUnit || unitInput || 'Unit' };
  }

  return null;
}

materialRouter.get('/:type', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const { type } = req.params;
    const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
    if (!locationId) return res.status(400).json({ error: 'Location ID is required' });

    await assertLocationAccess(userId, locationId);

    let data;
    if (type === 'purchase') {
      data = await db.select().from(materialPurchases).where(and(eq(materialPurchases.locationId, locationId), eq(materialPurchases.isDeleted, 0))).orderBy(desc(materialPurchases.date), desc(materialPurchases.id));
    } else if (type === 'supply') {
      data = await db.select().from(materialSupplies).where(and(eq(materialSupplies.locationId, locationId), eq(materialSupplies.isDeleted, 0))).orderBy(desc(materialSupplies.date), desc(materialSupplies.id));
    } else if (type === 'labour-supply') {
      data = await db.select().from(materialLabourSupplies).where(and(eq(materialLabourSupplies.locationId, locationId), eq(materialLabourSupplies.isDeleted, 0))).orderBy(desc(materialLabourSupplies.date), desc(materialLabourSupplies.id));
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }
    res.json(data);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Failed to fetch material records' });
  }
});

materialRouter.post('/:type', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const { type } = req.params;
    
    if (type === 'purchase' || type === 'supply') {
      const data = req.body;
      const locId = parseInt(String(data.locationId), 10);
      if (!locId || isNaN(locId)) return res.status(400).json({ error: 'locationId is required' });
      await assertLocationAccess(userId, locId);

      const qty = parseFloat(String(data.quantity)) || 0;
      const rate = parseFloat(String(data.rate)) || 0;
      const discount = parseFloat(String(data.discount || 0)) || 0;
      const taxPercentage = parseFloat(String(data.taxPercentage || 0)) || 0;
      const transportCost = parseFloat(String(data.transportCost || data.transport || 0)) || 0;

      const subtotal = Math.round(qty * rate * 100) / 100;
      const taxableAmount = Math.max(0, subtotal - discount);
      const taxAmount = (data.tax !== undefined && parseFloat(String(data.tax)) > 0)
        ? Math.round(parseFloat(String(data.tax)) * 100) / 100
        : Math.round(taxableAmount * (taxPercentage / 100) * 100) / 100;
      const calculatedTotal = Math.round((taxableAmount + taxAmount + transportCost) * 100) / 100;
      const totalAmount = (data.totalAmount !== undefined && parseFloat(String(data.totalAmount)) > 0 && Math.abs(parseFloat(String(data.totalAmount)) - calculatedTotal) < 1)
        ? parseFloat(String(data.totalAmount))
        : calculatedTotal;
      const paid = data.paidAmount !== undefined ? parseFloat(String(data.paidAmount)) : (data.paymentStatus === 'PAID' ? totalAmount : 0);
      const outstanding = data.outstandingAmount !== undefined ? parseFloat(String(data.outstandingAmount)) : Math.max(0, totalAmount - paid);
      
      const result = await db.transaction(async (tx) => {
        let insertedId = 0;
        let record: any;

        const matInfo = await resolveMaterialInfo(tx, userId, data.locationId, data.materialId, data.materialName, data.unit, rate);
        const finalMatId = matInfo ? matInfo.id : (data.materialId ? parseInt(String(data.materialId), 10) : null);
        const finalMatName = matInfo ? matInfo.name : (data.materialName || '');
        const finalUnit = data.unit || (matInfo ? matInfo.unit : '') || 'Unit';
        
        if (type === 'purchase') {
          const inserted = await tx.insert(materialPurchases).values({
            userId, locationId: data.locationId,
            date: data.date, partyName: data.partyName || '', materialName: finalMatName, materialId: finalMatId,
            quantity: qty.toString(), unit: finalUnit, rate: rate.toString(),
            subtotal: subtotal.toString(), transportCost: transportCost.toString(),
            discount: discount.toString(), taxPercentage: taxPercentage.toString(),
            tax: taxAmount.toString(), totalAmount: totalAmount.toString(),
            paidAmount: paid.toString(), outstandingAmount: outstanding.toString(),
            paymentStatus: data.paymentStatus || 'UNPAID',
            paymentMethod: data.paymentMethod, referenceNumber: data.referenceNumber, description: data.description || data.notes
          }).returning();
          insertedId = inserted[0].id;
          record = inserted[0];
          
          if (finalMatId && qty > 0) {
            await StockManager.addStockMovement(tx, userId, data.locationId, finalMatId, 'IN', qty, insertedId, 'PURCHASE', data.description || data.notes);
          }
        } else {
          const inserted = await tx.insert(materialSupplies).values({
            userId, locationId: data.locationId,
            date: data.date, partyName: data.partyName || '', partyId: data.partyId,
            materialName: finalMatName, materialId: finalMatId,
            quantity: qty.toString(), unit: finalUnit, rate: rate.toString(),
            subtotal: subtotal.toString(), transportCost: transportCost.toString(),
            discount: discount.toString(), taxPercentage: taxPercentage.toString(),
            tax: taxAmount.toString(), totalAmount: totalAmount.toString(),
            paidAmount: paid.toString(), outstandingAmount: outstanding.toString(),
            paymentStatus: data.paymentStatus || 'UNPAID',
            paymentMethod: data.paymentMethod, referenceNumber: data.referenceNumber, notes: data.description || data.notes
          }).returning();
          insertedId = inserted[0].id;
          record = inserted[0];
          
          if (finalMatId && qty > 0) {
            await StockManager.addStockMovement(tx, userId, data.locationId, finalMatId, 'OUT', qty, insertedId, 'MATERIAL_SUPPLY', data.description || data.notes);
          }
        }
        
        await tx.insert(auditLogs).values({ userId, action: `CREATE_${String(type).toUpperCase()}`, entityType: 'MATERIAL_TRANSACTION', entityId: insertedId });
        return record;
      });
      return res.json(result);
      
    } else if (type === 'labour-supply') {
       const data = req.body;
       const locId = parseInt(String(data.locationId), 10);
       if (!locId || isNaN(locId)) return res.status(400).json({ error: 'locationId is required' });
       await assertLocationAccess(userId, locId);

       const subtotal = Math.round(((data.materialAmount||0) + (data.labourAmount||0)) * 100) / 100;
       const taxAmount = Math.round(subtotal * ((data.taxPercentage||0) / 100) * 100) / 100;
       const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
       const paid = data.paidAmount !== undefined ? data.paidAmount : (data.paymentStatus === 'PAID' ? totalAmount : 0);
       const outstanding = data.outstandingAmount !== undefined ? data.outstandingAmount : Math.max(0, totalAmount - paid);
       
       const result = await db.insert(materialLabourSupplies).values({
        userId, locationId: locId, date: data.date, partyName: data.partyName || '', workDescription: data.workDescription || '',
        materialQuantity: (data.materialQuantity||0).toString(), materialAmount: (data.materialAmount||0).toString(),
        labourAmount: (data.labourAmount||0).toString(), subtotal: subtotal.toString(), taxPercentage: (data.taxPercentage||0).toString(),
        tax: taxAmount.toString(), totalAmount: totalAmount.toString(), paidAmount: paid.toString(), outstandingAmount: outstanding.toString()
       }).returning();
       return res.json(result[0]);
    }
    res.status(400).json({ error: 'Invalid type' });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Material route error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

materialRouter.put('/:type/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const { type, id } = req.params;
    const numId = parseInt(id as string, 10);
    if (isNaN(numId)) return res.status(400).json({ error: 'Invalid record ID' });
    
    if (type === 'purchase' || type === 'supply') {
      const data = req.body;
      const locationId = parseInt(String(data.locationId), 10);
      if (isNaN(locationId)) return res.status(400).json({ error: 'locationId is required' });
      await assertLocationAccess(userId, locationId);

      const qty = parseFloat(String(data.quantity)) || 0;
      const rate = parseFloat(String(data.rate)) || 0;
      const discount = parseFloat(String(data.discount || 0)) || 0;
      const taxPercentage = parseFloat(String(data.taxPercentage || 0)) || 0;
      const transportCost = parseFloat(String(data.transportCost || data.transport || 0)) || 0;

      const subtotal = Math.round(qty * rate * 100) / 100;
      const taxableAmount = Math.max(0, subtotal - discount);
      const taxAmount = (data.tax !== undefined && parseFloat(String(data.tax)) > 0)
        ? Math.round(parseFloat(String(data.tax)) * 100) / 100
        : Math.round(taxableAmount * (taxPercentage / 100) * 100) / 100;
      const calculatedTotal = Math.round((taxableAmount + taxAmount + transportCost) * 100) / 100;
      const totalAmount = (data.totalAmount !== undefined && parseFloat(String(data.totalAmount)) > 0 && Math.abs(parseFloat(String(data.totalAmount)) - calculatedTotal) < 1)
        ? parseFloat(String(data.totalAmount))
        : calculatedTotal;
      const paid = data.paidAmount !== undefined ? parseFloat(String(data.paidAmount)) : (data.paymentStatus === 'PAID' ? totalAmount : 0);
      const outstanding = data.outstandingAmount !== undefined ? parseFloat(String(data.outstandingAmount)) : Math.max(0, totalAmount - paid);
      
      const result = await db.transaction(async (tx) => {
        let record: any;

        const matInfo = await resolveMaterialInfo(tx, userId, data.locationId, data.materialId, data.materialName, data.unit, rate);
        const finalMatId = matInfo ? matInfo.id : (data.materialId ? parseInt(String(data.materialId), 10) : null);
        const finalMatName = matInfo ? matInfo.name : (data.materialName || '');
        const finalUnit = data.unit || (matInfo ? matInfo.unit : '') || 'Unit';
        
        if (type === 'purchase') {
          // Revert old stock
          const oldRec = await tx.select().from(materialPurchases).where(and(eq(materialPurchases.id, numId), eq(materialPurchases.isDeleted, 0)));
          if (oldRec.length && oldRec[0].materialId) {
             await StockManager.addStockMovement(tx, userId, oldRec[0].locationId, oldRec[0].materialId, 'OUT', parseFloat(oldRec[0].quantity), numId, 'PURCHASE_UPDATE_REVERT', 'Reversed for update');
          }

          const updated = await tx.update(materialPurchases).set({
            date: data.date, partyName: data.partyName || '', materialName: finalMatName, materialId: finalMatId,
            quantity: qty.toString(), unit: finalUnit, rate: rate.toString(),
            subtotal: subtotal.toString(), transportCost: transportCost.toString(),
            discount: discount.toString(), taxPercentage: taxPercentage.toString(),
            tax: taxAmount.toString(), totalAmount: totalAmount.toString(),
            paidAmount: paid.toString(), outstandingAmount: outstanding.toString(),
            paymentStatus: data.paymentStatus || 'UNPAID',
            paymentMethod: data.paymentMethod, referenceNumber: data.referenceNumber, description: data.description || data.notes
          }).where(and(eq(materialPurchases.id, numId), eq(materialPurchases.isDeleted, 0))).returning();
          record = updated[0];
          
          if (finalMatId && qty > 0) {
            await StockManager.addStockMovement(tx, userId, data.locationId, finalMatId, 'IN', qty, numId, 'PURCHASE', data.description || data.notes);
          }
        } else {
          // Revert old stock
          const oldRec = await tx.select().from(materialSupplies).where(and(eq(materialSupplies.id, numId), eq(materialSupplies.isDeleted, 0)));
          if (oldRec.length && oldRec[0].materialId) {
             await StockManager.addStockMovement(tx, userId, oldRec[0].locationId, oldRec[0].materialId, 'IN', parseFloat(oldRec[0].quantity), numId, 'MATERIAL_SUPPLY_UPDATE_REVERT', 'Reversed for update');
          }

          const updated = await tx.update(materialSupplies).set({
            date: data.date, partyName: data.partyName || '', partyId: data.partyId,
            materialName: finalMatName, materialId: finalMatId,
            quantity: qty.toString(), unit: finalUnit, rate: rate.toString(),
            subtotal: subtotal.toString(), transportCost: transportCost.toString(),
            discount: discount.toString(), taxPercentage: taxPercentage.toString(),
            tax: taxAmount.toString(), totalAmount: totalAmount.toString(),
            paidAmount: paid.toString(), outstandingAmount: outstanding.toString(),
            paymentStatus: data.paymentStatus || 'UNPAID',
            paymentMethod: data.paymentMethod, referenceNumber: data.referenceNumber, notes: data.description || data.notes
          }).where(and(eq(materialSupplies.id, numId), eq(materialSupplies.isDeleted, 0))).returning();
          record = updated[0];
          
          if (finalMatId && qty > 0) {
            await StockManager.addStockMovement(tx, userId, data.locationId, finalMatId, 'OUT', qty, numId, 'MATERIAL_SUPPLY', data.description || data.notes);
          }
        }
        
        await tx.insert(auditLogs).values({ userId, action: `UPDATE_${String(type).toUpperCase()}`, entityType: 'MATERIAL_TRANSACTION', entityId: numId });
        return record;
      });
      return res.json(result);
    }
    res.status(400).json({ error: 'Invalid type' });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

materialRouter.delete('/:type/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const { type, id } = req.params;
    const numId = parseInt(id as string, 10);
    if (isNaN(numId)) return res.status(400).json({ error: 'Invalid record ID' });
    
    await db.transaction(async (tx) => {
      let table: any;
      if (type === 'purchase') {
        table = materialPurchases;
        const rec = await tx.select().from(table).where(and(eq(table.id, numId), eq(table.isDeleted, 0)));
        if (rec.length) {
           await assertLocationAccess(userId, rec[0].locationId);
           if (rec[0].materialId) {
             await StockManager.addStockMovement(tx, userId, rec[0].locationId, rec[0].materialId, 'OUT', parseFloat(rec[0].quantity), numId, 'PURCHASE_DELETE', 'Reversed from delete');
           }
        }
      } else if (type === 'supply') {
        table = materialSupplies;
        const rec = await tx.select().from(table).where(and(eq(table.id, numId), eq(table.isDeleted, 0)));
        if (rec.length) {
           await assertLocationAccess(userId, rec[0].locationId);
           if (rec[0].materialId) {
             await StockManager.addStockMovement(tx, userId, rec[0].locationId, rec[0].materialId, 'IN', parseFloat(rec[0].quantity), numId, 'MATERIAL_SUPPLY_DELETE', 'Reversed from delete');
           }
        }
      } else if (type === 'labour-supply') {
        table = materialLabourSupplies;
        const rec = await tx.select().from(table).where(and(eq(table.id, numId), eq(table.isDeleted, 0)));
        if (rec.length) {
           await assertLocationAccess(userId, rec[0].locationId);
        }
      }
      
      await tx.update(table).set({ isDeleted: 1 }).where(eq(table.id, numId));
      await tx.insert(auditLogs).values({ userId, action: `DELETE_${String(type).toUpperCase()}`, entityType: 'MATERIAL_TRANSACTION', entityId: numId });
    });
    res.json({ success: true });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

export default materialRouter;
