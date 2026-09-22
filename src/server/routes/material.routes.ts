import express, { Response } from 'express';
import { db } from '../../db/index.js';
import { 
  materialPurchases, 
  materialSupplies, 
  materialLabourSupplies, 
  auditLogs, 
  materials, 
  stockLedger,
  locations,
  siteSupplies,
  siteSupplyItems,
  labourTeams
} from '../../db/schema.js';
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
      return { id: existing[0].id, name: (existing[0].name || '').trim().toUpperCase(), unit: existing[0].defaultUnit || unitInput || 'Unit' };
    }
  }

  const rawName = (materialNameInput || '').trim().toUpperCase();
  if (rawName) {
    const existingByName = await tx.select().from(materials).where(
      and(
        eq(materials.locationId, locId),
        sql`UPPER(TRIM(${materials.name})) = ${rawName}`,
        eq(materials.isDeleted, 0)
      )
    );
    if (existingByName.length > 0) {
      return { id: existingByName[0].id, name: existingByName[0].name.trim().toUpperCase(), unit: existingByName[0].defaultUnit || unitInput || 'Unit' };
    }

    // Automatically create master material in UPPERCASE so stock records stay consistent and deduplicated!
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

    return { id: created[0].id, name: created[0].name.trim().toUpperCase(), unit: created[0].defaultUnit || unitInput || 'Unit' };
  }

  return null;
}

materialRouter.get('/:type', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const { type } = req.params;
    const locParam = req.query.locationId as string | undefined;
    const locationId = (locParam && locParam !== 'ALL' && locParam !== '0' && !isNaN(parseInt(locParam, 10)))
      ? parseInt(locParam, 10)
      : undefined;

    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }

    let data;
    if (type === 'purchase') {
      data = await db.select({
        id: materialPurchases.id,
        userId: materialPurchases.userId,
        locationId: materialPurchases.locationId,
        date: materialPurchases.date,
        partyName: materialPurchases.partyName,
        materialName: materialPurchases.materialName,
        materialId: materialPurchases.materialId,
        quantity: materialPurchases.quantity,
        unit: materialPurchases.unit,
        rate: materialPurchases.rate,
        subtotal: materialPurchases.subtotal,
        transportCost: materialPurchases.transportCost,
        discount: materialPurchases.discount,
        taxPercentage: materialPurchases.taxPercentage,
        tax: materialPurchases.tax,
        totalAmount: materialPurchases.totalAmount,
        paidAmount: materialPurchases.paidAmount,
        outstandingAmount: materialPurchases.outstandingAmount,
        paymentStatus: materialPurchases.paymentStatus,
        paymentMethod: materialPurchases.paymentMethod,
        referenceNumber: materialPurchases.referenceNumber,
        description: materialPurchases.description,
        createdAt: materialPurchases.createdAt,
        isDeleted: materialPurchases.isDeleted,
        locationName: locations.name
      })
      .from(materialPurchases)
      .leftJoin(locations, eq(materialPurchases.locationId, locations.id))
      .where(and(
        locationId ? eq(materialPurchases.locationId, locationId) : undefined,
        eq(materialPurchases.isDeleted, 0)
      ))
      .orderBy(desc(materialPurchases.date), desc(materialPurchases.id));
    } else if (type === 'supply') {
      data = await db.select({
        id: materialSupplies.id,
        userId: materialSupplies.userId,
        locationId: materialSupplies.locationId,
        date: materialSupplies.date,
        partyName: materialSupplies.partyName,
        partyId: materialSupplies.partyId,
        materialName: materialSupplies.materialName,
        materialId: materialSupplies.materialId,
        quantity: materialSupplies.quantity,
        unit: materialSupplies.unit,
        rate: materialSupplies.rate,
        subtotal: materialSupplies.subtotal,
        transportCost: materialSupplies.transportCost,
        discount: materialSupplies.discount,
        taxPercentage: materialSupplies.taxPercentage,
        tax: materialSupplies.tax,
        totalAmount: materialSupplies.totalAmount,
        paidAmount: materialSupplies.paidAmount,
        outstandingAmount: materialSupplies.outstandingAmount,
        paymentStatus: materialSupplies.paymentStatus,
        paymentMethod: materialSupplies.paymentMethod,
        referenceNumber: materialSupplies.referenceNumber,
        notes: materialSupplies.notes,
        description: materialSupplies.description,
        createdAt: materialSupplies.createdAt,
        isDeleted: materialSupplies.isDeleted,
        locationName: locations.name
      })
      .from(materialSupplies)
      .leftJoin(locations, eq(materialSupplies.locationId, locations.id))
      .where(and(
        locationId ? eq(materialSupplies.locationId, locationId) : undefined,
        eq(materialSupplies.isDeleted, 0)
      ))
      .orderBy(desc(materialSupplies.date), desc(materialSupplies.id));
    } else if (type === 'labour-supply') {
      // 1. Fetch from siteSupplies + siteSupplyItems (Team Wise Material Supply = Site Supply)
      const siteRecords = await db.select({
        id: siteSupplyItems.id,
        siteSupplyId: siteSupplies.id,
        userId: siteSupplies.userId,
        locationId: siteSupplies.locationId,
        date: siteSupplies.date,
        siteLocationName: locations.name,
        teamName: sql<string>`COALESCE(${labourTeams.name}, ${siteSupplies.responsiblePerson}, 'Direct Site Team')`,
        partyName: sql<string>`COALESCE(${labourTeams.name}, ${siteSupplies.responsiblePerson}, 'Direct Site Team')`,
        workDescription: siteSupplies.workDescription,
        materialId: siteSupplyItems.materialId,
        materialName: sql<string>`COALESCE(${materials.name}, 'MATERIAL')`,
        materialQuantity: siteSupplyItems.quantity,
        materialUnit: sql<string>`COALESCE(${materials.defaultUnit}, 'Nos')`,
        materialRate: siteSupplyItems.rate,
        materialAmount: siteSupplyItems.amount,
        labourType: sql<string>`'SITE_SUPPLY'`,
        labourQuantity: sql<string>`'0'`,
        labourUnit: sql<string>`''`,
        labourRate: sql<string>`'0'`,
        labourAmount: sql<string>`'0'`,
        subtotal: siteSupplyItems.amount,
        taxPercentage: sql<string>`'0'`,
        tax: sql<string>`'0'`,
        totalAmount: siteSupplyItems.amount,
        paidAmount: siteSupplyItems.amount,
        outstandingAmount: sql<string>`'0.00'`,
        paymentStatus: sql<string>`'PAID'`,
        paymentMethod: sql<string>`'SITE_TRANSFER'`,
        referenceNumber: siteSupplies.referenceNumber,
        notes: siteSupplies.notes,
        createdAt: siteSupplies.createdAt,
        isDeleted: siteSupplyItems.isDeleted,
        locationName: locations.name,
        sourceType: sql<string>`'SITE_SUPPLY'`
      })
      .from(siteSupplyItems)
      .innerJoin(siteSupplies, eq(siteSupplyItems.siteSupplyId, siteSupplies.id))
      .leftJoin(locations, eq(siteSupplies.locationId, locations.id))
      .leftJoin(materials, eq(siteSupplyItems.materialId, materials.id))
      .leftJoin(labourTeams, eq(siteSupplies.teamId, labourTeams.id))
      .where(and(
        locationId ? eq(siteSupplies.locationId, locationId) : undefined,
        eq(siteSupplies.isDeleted, 0),
        eq(siteSupplyItems.isDeleted, 0)
      ))
      .orderBy(desc(siteSupplies.date), desc(siteSupplyItems.id));

      // 2. Fetch legacy materialLabourSupplies if any exist
      const legacyData = await db.select({
        id: materialLabourSupplies.id,
        siteSupplyId: sql<number | null>`null`,
        userId: materialLabourSupplies.userId,
        locationId: materialLabourSupplies.locationId,
        date: materialLabourSupplies.date,
        siteLocationName: materialLabourSupplies.siteLocationName,
        teamName: materialLabourSupplies.teamName,
        partyName: materialLabourSupplies.partyName,
        workDescription: materialLabourSupplies.workDescription,
        materialId: sql<number | null>`null`,
        materialName: materialLabourSupplies.materialName,
        materialQuantity: materialLabourSupplies.materialQuantity,
        materialUnit: materialLabourSupplies.materialUnit,
        materialRate: materialLabourSupplies.materialRate,
        materialAmount: materialLabourSupplies.materialAmount,
        labourType: materialLabourSupplies.labourType,
        labourQuantity: materialLabourSupplies.labourQuantity,
        labourUnit: materialLabourSupplies.labourUnit,
        labourRate: materialLabourSupplies.labourRate,
        labourAmount: materialLabourSupplies.labourAmount,
        subtotal: materialLabourSupplies.subtotal,
        taxPercentage: materialLabourSupplies.taxPercentage,
        tax: materialLabourSupplies.tax,
        totalAmount: materialLabourSupplies.totalAmount,
        paidAmount: materialLabourSupplies.paidAmount,
        outstandingAmount: materialLabourSupplies.outstandingAmount,
        paymentStatus: materialLabourSupplies.paymentStatus,
        paymentMethod: materialLabourSupplies.paymentMethod,
        referenceNumber: materialLabourSupplies.referenceNumber,
        notes: materialLabourSupplies.notes,
        createdAt: materialLabourSupplies.createdAt,
        isDeleted: materialLabourSupplies.isDeleted,
        locationName: locations.name,
        sourceType: sql<string>`'LEGACY_LABOUR_SUPPLY'`
      })
      .from(materialLabourSupplies)
      .leftJoin(locations, eq(materialLabourSupplies.locationId, locations.id))
      .where(and(
        locationId ? eq(materialLabourSupplies.locationId, locationId) : undefined,
        eq(materialLabourSupplies.isDeleted, 0)
      ))
      .orderBy(desc(materialLabourSupplies.date), desc(materialLabourSupplies.id));

      data = [...siteRecords, ...legacyData];
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }
    res.json(data);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to fetch material records:', error);
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

      const qty = parseFloat(String(data.materialQuantity || 0)) || 0;
      const rate = parseFloat(String(data.materialRate || 0)) || 0;
      const amount = parseFloat(String(data.materialAmount || 0)) || Math.round(qty * rate * 100) / 100;

      const result = await db.transaction(async (tx) => {
        let resolvedMat = await resolveMaterialInfo(tx, userId, locId, data.materialId, data.materialName, data.materialUnit, rate);
        if (!resolvedMat && data.materialName) {
          resolvedMat = { id: 1, name: String(data.materialName).trim().toUpperCase(), unit: data.materialUnit || 'Nos' };
        }

        let teamId: number | null = null;
        if (data.teamId) {
          teamId = parseInt(String(data.teamId), 10) || null;
        } else if (data.teamName) {
          const matchedTeam = await tx.select().from(labourTeams).where(and(
            eq(labourTeams.locationId, locId),
            sql`LOWER(${labourTeams.name}) = LOWER(${String(data.teamName).trim()})`,
            eq(labourTeams.isDeleted, 0)
          ));
          if (matchedTeam.length > 0) {
            teamId = matchedTeam[0].id;
          }
        }

        const createdSupply = await tx.insert(siteSupplies).values({
          userId,
          locationId: locId,
          date: data.date || new Date().toISOString().split('T')[0],
          teamId,
          responsiblePerson: data.teamName || data.partyName || 'Direct Site Team',
          workDescription: data.workDescription || '',
          referenceNumber: data.referenceNumber || null,
          totalAmount: amount.toString(),
          notes: typeof data.notes === 'string' ? data.notes : JSON.stringify(data.notes || {})
        }).returning();

        const siteSupplyId = createdSupply[0].id;

        const createdItem = await tx.insert(siteSupplyItems).values({
          siteSupplyId,
          materialId: resolvedMat?.id || 1,
          quantity: qty.toString(),
          rate: rate.toString(),
          amount: amount.toString()
        }).returning();

        if (resolvedMat?.id && qty > 0) {
          await StockManager.addStockMovement(tx, userId, locId, resolvedMat.id, 'OUT', qty, siteSupplyId, 'SITE_SUPPLY', `Issued to ${data.teamName || 'Site Team'}`);
        }

        await tx.insert(auditLogs).values({ userId, action: 'CREATE_SITE_SUPPLY', entityType: 'SITE_SUPPLY', entityId: siteSupplyId });

        return {
          ...createdItem[0],
          siteSupplyId,
          locationId: locId,
          date: createdSupply[0].date,
          teamName: data.teamName,
          partyName: data.teamName,
          materialName: resolvedMat?.name || data.materialName,
          materialQuantity: qty,
          materialRate: rate,
          materialAmount: amount
        };
      });
      return res.json(result);
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
      await assertLocationAccess(userId, locationId, { allowDeleted: true });

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
          const locId = rec[0].locationId;
          try {
            await assertLocationAccess(userId, locId, { allowDeleted: true });
          } catch (locErr) {
            console.warn(`Location check warning during purchase delete #${numId}:`, locErr);
          }
          if (rec[0].materialId && locId) {
            try {
              await StockManager.addStockMovement(tx, userId, locId, rec[0].materialId, 'OUT', parseFloat(rec[0].quantity), numId, 'PURCHASE_DELETE', 'Reversed from delete');
            } catch (stockErr) {
              console.warn(`Stock reversal warning during purchase delete #${numId}:`, stockErr);
            }
          }
        }
      } else if (type === 'supply') {
        table = materialSupplies;
        const rec = await tx.select().from(table).where(and(eq(table.id, numId), eq(table.isDeleted, 0)));
        if (rec.length) {
          const locId = rec[0].locationId;
          try {
            await assertLocationAccess(userId, locId, { allowDeleted: true });
          } catch (locErr) {
            console.warn(`Location check warning during supply delete #${numId}:`, locErr);
          }
          if (rec[0].materialId && locId) {
            try {
              await StockManager.addStockMovement(tx, userId, locId, rec[0].materialId, 'IN', parseFloat(rec[0].quantity), numId, 'MATERIAL_SUPPLY_DELETE', 'Reversed from delete');
            } catch (stockErr) {
              console.warn(`Stock reversal warning during supply delete #${numId}:`, stockErr);
            }
          }
        }
      } else if (type === 'labour-supply') {
        const siteItem = await tx.select().from(siteSupplyItems).where(and(eq(siteSupplyItems.id, numId), eq(siteSupplyItems.isDeleted, 0)));
        if (siteItem.length) {
          const parentSupply = await tx.select().from(siteSupplies).where(eq(siteSupplies.id, siteItem[0].siteSupplyId));
          const locId = parentSupply[0]?.locationId;
          if (locId) {
            try {
              await assertLocationAccess(userId, locId, { allowDeleted: true });
            } catch (locErr) {
              console.warn(`Location check warning during site supply item delete #${numId}:`, locErr);
            }
          }
          if (siteItem[0].materialId && locId) {
            try {
              await StockManager.addStockMovement(tx, userId, locId, siteItem[0].materialId, 'IN', parseFloat(siteItem[0].quantity), numId, 'SITE_SUPPLY_DELETE', 'Reversed from site supply item delete');
            } catch (stockErr) {
              console.warn(`Stock reversal warning during site supply item delete #${numId}:`, stockErr);
            }
          }
          await tx.update(siteSupplyItems).set({ isDeleted: 1 }).where(eq(siteSupplyItems.id, numId));
          const remaining = await tx.select().from(siteSupplyItems).where(and(eq(siteSupplyItems.siteSupplyId, siteItem[0].siteSupplyId), eq(siteSupplyItems.isDeleted, 0)));
          if (remaining.length === 0) {
            await tx.update(siteSupplies).set({ isDeleted: 1 }).where(eq(siteSupplies.id, siteItem[0].siteSupplyId));
          }
          await tx.insert(auditLogs).values({ userId, action: 'DELETE_SITE_SUPPLY_ITEM', entityType: 'SITE_SUPPLY', entityId: numId });
          return;
        } else {
          table = materialLabourSupplies;
          const rec = await tx.select().from(table).where(and(eq(table.id, numId), eq(table.isDeleted, 0)));
          if (rec.length) {
            try {
              await assertLocationAccess(userId, rec[0].locationId, { allowDeleted: true });
            } catch (locErr) {
              console.warn(`Location check warning during labour supply delete #${numId}:`, locErr);
            }
          }
        }
      }
      
      if (!table) return res.status(400).json({ error: 'Invalid material record type' });
      await tx.update(table).set({ isDeleted: 1 }).where(eq(table.id, numId));
      await tx.insert(auditLogs).values({ userId, action: `DELETE_${String(type).toUpperCase()}`, entityType: 'MATERIAL_TRANSACTION', entityId: numId });
    });
    res.json({ success: true });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to delete material record:', error);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

export default materialRouter;
