import express, { type Response } from 'express';
import { db } from '../../db/index.ts';
import { siteSupplies, siteSupplyItems, materials, locations, labourTeams, auditLogs } from '../../db/schema.ts';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { requireAuth, type AuthRequest } from '../middleware/auth.ts';
import { StockManager, calculateSiteSupplyTotals } from '../lib/accounting.ts';
import { assertLocationAccess } from '../lib/locationAuth.ts';

const siteSupplyRouter = express.Router();
siteSupplyRouter.use(requireAuth);

siteSupplyRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const locParam = req.query.locationId as string | undefined;
    const locationId = (locParam && locParam !== 'ALL' && locParam !== '0' && !isNaN(parseInt(locParam, 10)))
      ? parseInt(locParam, 10)
      : undefined;

    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }

    const records = await db.select({
      id: siteSupplies.id,
      userId: siteSupplies.userId,
      locationId: siteSupplies.locationId,
      date: siteSupplies.date,
      teamId: siteSupplies.teamId,
      responsiblePerson: siteSupplies.responsiblePerson,
      workDescription: siteSupplies.workDescription,
      referenceNumber: siteSupplies.referenceNumber,
      notes: siteSupplies.notes,
      totalAmount: siteSupplies.totalAmount,
      investorId: siteSupplies.investorId,
      createdAt: siteSupplies.createdAt,
      isDeleted: siteSupplies.isDeleted,
      locationName: locations.name,
      teamName: labourTeams.name
    })
    .from(siteSupplies)
    .innerJoin(locations, eq(siteSupplies.locationId, locations.id))
    .leftJoin(labourTeams, eq(siteSupplies.teamId, labourTeams.id))
    .where(and(
      eq(locations.isDeleted, 0),
      locationId ? eq(siteSupplies.locationId, locationId) : undefined,
      eq(siteSupplies.isDeleted, 0)
    ))
    .orderBy(desc(siteSupplies.date), desc(siteSupplies.id));
    
    const recordIds = records.map(r => r.id);
    let items: any[] = [];
    if (recordIds.length > 0) {
      items = await db.select({
        id: siteSupplyItems.id,
        siteSupplyId: siteSupplyItems.siteSupplyId,
        materialId: siteSupplyItems.materialId,
        quantity: siteSupplyItems.quantity,
        rate: siteSupplyItems.rate,
        amount: siteSupplyItems.amount,
        isDeleted: siteSupplyItems.isDeleted,
        materialName: materials.name,
        defaultUnit: materials.defaultUnit
      })
      .from(siteSupplyItems)
      .leftJoin(materials, eq(siteSupplyItems.materialId, materials.id))
      .where(and(inArray(siteSupplyItems.siteSupplyId, recordIds), eq(siteSupplyItems.isDeleted, 0)));
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
        locationName: r.locationName || `Location #${r.locationId}`,
        teamName: r.teamName || r.responsiblePerson || 'Direct Site',
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
            materialName: it.materialName || `Material #${it.materialId}`,
            unit: itemMeta.unit || it.defaultUnit || 'Nos',
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
    console.warn('[Site Supplies GET Notice] Database fallback:', err?.message || err);
    res.json([]);
  }
});

siteSupplyRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const { locationId, date, teamId, responsiblePerson, workDescription, referenceNumber, notes, investorId } = req.body;
    let items = req.body.items;
    
    // Fallback if submitted with single item fields
    if ((!items || !items.length) && (req.body.materialName || req.body.materialId)) {
      items = [{
        materialId: req.body.materialId,
        materialName: req.body.materialName,
        quantity: req.body.materialQuantity || req.body.quantity,
        unit: req.body.materialUnit || req.body.unit || 'Nos',
        rate: req.body.materialRate || req.body.rate || '0',
        taxPercentage: req.body.taxPercentage || '18'
      }];
    }

    const rawLoc = locationId || req.body.siteLocationId;
    const locId = rawLoc ? parseInt(String(rawLoc), 10) : NaN;
    if (isNaN(locId) || locId <= 0) {
      return res.status(400).json({ error: 'મહેરબાની કરીને પ્રોજેક્ટ લોકેશન સિલેક્ટ કરો / Please select a project location' });
    }
    if (!date || !items || !items.length) {
      return res.status(400).json({ error: 'Missing required fields (Date, Items)' });
    }
    await assertLocationAccess(userId, locId);

    // Resolve or create labour team if teamName was given instead of teamId
    let finalTeamId: number | null = teamId ? parseInt(String(teamId), 10) : null;
    const rawTeamName = (req.body.teamName || '').trim();
    if ((!finalTeamId || isNaN(finalTeamId)) && rawTeamName) {
      const existingTeam = await db.select().from(labourTeams).where(
        and(
          eq(labourTeams.locationId, locId),
          sql`UPPER(TRIM(${labourTeams.name})) = ${rawTeamName.toUpperCase()}`,
          eq(labourTeams.isDeleted, 0)
        )
      ).limit(1);
      if (existingTeam.length > 0) {
        finalTeamId = existingTeam[0].id;
      } else {
        const createdTeam = await db.insert(labourTeams).values({
          userId,
          locationId: locId,
          name: rawTeamName
        }).returning();
        finalTeamId = createdTeam[0].id;
      }
    }

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
            sql`UPPER(TRIM(${materials.name})) = ${matName}`,
            eq(materials.isDeleted, 0)
          )
        ).limit(1);

        if (existing.length > 0) {
          matId = existing[0].id;
          unit = existing[0].defaultUnit || unit;
          if (rate <= 0 && existing[0].defaultRate && parseFloat(existing[0].defaultRate) > 0) {
            rate = parseFloat(existing[0].defaultRate);
          }
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
        const matRecord = await db.select().from(materials).where(eq(materials.id, matId)).limit(1);
        if (matRecord.length > 0) {
          if (matRecord[0].defaultUnit) unit = matRecord[0].defaultUnit;
          if (rate <= 0 && matRecord[0].defaultRate && parseFloat(matRecord[0].defaultRate) > 0) {
            rate = parseFloat(matRecord[0].defaultRate);
          }
        }
        // If rate is still 0, check latest purchase
        if (rate <= 0) {
          const lp = await db.execute(sql`
            SELECT rate FROM material_purchases 
            WHERE (material_id = ${matId} OR UPPER(TRIM(material_name)) = UPPER(TRIM(${matName})))
              AND is_deleted = 0 AND rate IS NOT NULL AND CAST(rate AS numeric) > 0
            ORDER BY date DESC, id DESC LIMIT 1
          `);
          if (lp.rows[0]?.rate) {
            rate = parseFloat(String(lp.rows[0].rate));
          }
        }
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

    const cleanInvestorId = (investorId && !isNaN(parseInt(String(investorId), 10)))
      ? parseInt(String(investorId), 10)
      : null;

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
        teamId: finalTeamId || null,
        responsiblePerson: responsiblePerson || rawTeamName || 'Direct Site Team',
        workDescription: workDescription || '',
        referenceNumber: referenceNumber || null,
        notes: JSON.stringify(supplyMeta),
        investorId: cleanInvestorId,
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
    const { locationId, date, teamId, responsiblePerson, workDescription, referenceNumber, notes, investorId } = req.body;
    let items = req.body.items;

    // Fallback if submitted with single item fields
    if ((!items || !items.length) && (req.body.materialName || req.body.materialId)) {
      items = [{
        materialId: req.body.materialId,
        materialName: req.body.materialName,
        quantity: req.body.materialQuantity || req.body.quantity,
        unit: req.body.materialUnit || req.body.unit || 'Nos',
        rate: req.body.materialRate || req.body.rate || '0',
        taxPercentage: req.body.taxPercentage || '18'
      }];
    }
    
    const rawLoc = locationId || req.body.siteLocationId;
    if (!rawLoc || !date || !items || !items.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const locId = parseInt(String(rawLoc), 10);
    await assertLocationAccess(userId, locId);

    // Resolve or create labour team if teamName was given instead of teamId
    let finalTeamId: number | null = teamId ? parseInt(String(teamId), 10) : null;
    const rawTeamName = (req.body.teamName || '').trim();
    if ((!finalTeamId || isNaN(finalTeamId)) && rawTeamName) {
      const existingTeam = await db.select().from(labourTeams).where(
        and(
          eq(labourTeams.locationId, locId),
          sql`UPPER(TRIM(${labourTeams.name})) = ${rawTeamName.toUpperCase()}`,
          eq(labourTeams.isDeleted, 0)
        )
      ).limit(1);
      if (existingTeam.length > 0) {
        finalTeamId = existingTeam[0].id;
      } else {
        const createdTeam = await db.insert(labourTeams).values({
          userId,
          locationId: locId,
          name: rawTeamName
        }).returning();
        finalTeamId = createdTeam[0].id;
      }
    }

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
            sql`UPPER(TRIM(${materials.name})) = ${matName}`,
            eq(materials.isDeleted, 0)
          )
        ).limit(1);

        if (existing.length > 0) {
          matId = existing[0].id;
          unit = existing[0].defaultUnit || unit;
          if (rate <= 0 && existing[0].defaultRate && parseFloat(existing[0].defaultRate) > 0) {
            rate = parseFloat(existing[0].defaultRate);
          }
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
        const matRecord = await db.select().from(materials).where(eq(materials.id, matId)).limit(1);
        if (matRecord.length > 0) {
          if (matRecord[0].defaultUnit) unit = matRecord[0].defaultUnit;
          if (rate <= 0 && matRecord[0].defaultRate && parseFloat(matRecord[0].defaultRate) > 0) {
            rate = parseFloat(matRecord[0].defaultRate);
          }
        }
        if (rate <= 0) {
          const lp = await db.execute(sql`
            SELECT rate FROM material_purchases 
            WHERE (material_id = ${matId} OR UPPER(TRIM(material_name)) = UPPER(TRIM(${matName})))
              AND is_deleted = 0 AND rate IS NOT NULL AND CAST(rate AS numeric) > 0
            ORDER BY date DESC, id DESC LIMIT 1
          `);
          if (lp.rows[0]?.rate) {
            rate = parseFloat(String(lp.rows[0].rate));
          }
        }
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
        teamId: finalTeamId || null,
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
      try {
        await assertLocationAccess(userId, locId, { allowDeleted: true });
      } catch (locErr) {
        console.warn(`Location check warning during site supply delete #${id}:`, locErr);
      }

      await tx.update(siteSupplies).set({ isDeleted: 1 }).where(eq(siteSupplies.id, id));
      // Delete child items
      const items = await tx.select().from(siteSupplyItems).where(eq(siteSupplyItems.siteSupplyId, id));
      await tx.update(siteSupplyItems).set({ isDeleted: 1 }).where(eq(siteSupplyItems.siteSupplyId, id));
      
      // Reverse stock ledger
      for (const item of items) {
        try {
          await StockManager.addStockMovement(tx, userId, locId, item.materialId, 'IN', parseFloat(item.quantity as any), id, 'SITE_SUPPLY_DELETE', 'Reversed from delete');
        } catch (stockErr) {
          console.warn(`Stock reversal warning for site supply #${id}:`, stockErr);
        }
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
