import express from 'express';
import { db } from '../../db/index.ts';
import { parties, labourTeams, materials, labourMaster } from '../../db/schema.ts';
import { eq, and, or, sql } from 'drizzle-orm';
import { requireAuth, type AuthRequest } from '../middleware/auth.ts';
import { auditLogs } from '../../db/schema.ts';
import { realtimeSync } from '../lib/realtimeSync.ts';
import { assertLocationAccess } from '../lib/locationAuth.ts';

const masterRouter = express.Router();
masterRouter.use(requireAuth);

// Parties
masterRouter.get('/parties', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const locParam = req.query.locationId as string | undefined;
    const locationId = (locParam && locParam !== 'ALL' && locParam !== '0' && !isNaN(parseInt(locParam, 10)))
      ? parseInt(locParam, 10)
      : undefined;

    if (locationId) {
      await assertLocationAccess(userId, locationId);
      const records = await db.select().from(parties).where(and(eq(parties.locationId, locationId), eq(parties.isDeleted, 0)));
      return res.json(records);
    }

    const records = await db.select().from(parties).where(eq(parties.isDeleted, 0));
    res.json(records);
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to fetch parties" });
  }
});

masterRouter.post('/parties', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const { name, locationId, address, gst, notes } = req.body;
    if (!name || !locationId) return res.status(400).json({ error: "Name and Location ID required" });
    const locId = parseInt(String(locationId), 10);
    await assertLocationAccess(userId, locId);

    const inserted = await db.insert(parties).values({ 
      name: String(name).trim(), 
      locationId: locId, 
      userId,
      address: address ? String(address).trim() : null,
      gst: gst ? String(gst).trim() : null,
      notes: notes ? String(notes).trim() : null
    }).returning();
    await db.insert(auditLogs).values({ userId, action: 'CREATE_PARTY', entityType: 'PARTY', entityId: inserted[0].id, metadata: JSON.stringify({ name, locationId: locId }) });
    realtimeSync.notifyMutation('CREATE_PARTY', `/master/parties?locationId=${locId}`, inserted[0]);
    res.status(201).json(inserted[0]);
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to create party" });
  }
});

masterRouter.put('/parties/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });

    const existing = await db.select().from(parties).where(eq(parties.id, id)).limit(1);
    if (!existing.length) return res.status(404).json({ error: "Party not found" });
    await assertLocationAccess(userId, existing[0].locationId);

    const { name, address, gst, notes } = req.body;
    const updated = await db.update(parties).set({
      ...(name !== undefined && { name: String(name).trim() }),
      ...(address !== undefined && { address: address ? String(address).trim() : null }),
      ...(gst !== undefined && { gst: gst ? String(gst).trim() : null }),
      ...(notes !== undefined && { notes: notes ? String(notes).trim() : null })
    }).where(eq(parties.id, id)).returning();

    if (!updated.length) return res.status(404).json({ error: "Party not found" });
    await db.insert(auditLogs).values({ userId, action: 'UPDATE_PARTY', entityType: 'PARTY', entityId: id, metadata: JSON.stringify(req.body) });
    realtimeSync.notifyMutation('UPDATE_PARTY', `/master/parties`, updated[0]);
    res.json(updated[0]);
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to update party" });
  }
});

masterRouter.delete('/parties/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });

    const existing = await db.select().from(parties).where(eq(parties.id, id)).limit(1);
    if (existing.length) {
      try {
        await assertLocationAccess(userId, existing[0].locationId, { allowDeleted: true });
      } catch (locErr) {
        console.warn(`Location check warning during party delete #${id}:`, locErr);
      }
    }

    await db.update(parties)
      .set({ isDeleted: 1 })
      .where(eq(parties.id, id));
    realtimeSync.notifyMutation('DELETE_PARTY', `/master/parties`, { id });
    res.json({ success: true });
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to delete party" });
  }
});

// Teams
masterRouter.get('/teams', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const locParam = req.query.locationId as string | undefined;
    const locationId = (locParam && locParam !== 'ALL' && locParam !== '0' && !isNaN(parseInt(locParam, 10)))
      ? parseInt(locParam, 10)
      : undefined;

    if (locationId) {
      await assertLocationAccess(userId, locationId);
      const records = await db.select().from(labourTeams).where(and(eq(labourTeams.locationId, locationId), eq(labourTeams.isDeleted, 0)));
      return res.json(records);
    }

    const records = await db.select().from(labourTeams).where(eq(labourTeams.isDeleted, 0));
    res.json(records);
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});

masterRouter.post('/teams', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const { name, locationId } = req.body;
    if (!name || !locationId) return res.status(400).json({ error: "Name and Location ID required" });
    const locId = parseInt(String(locationId), 10);
    await assertLocationAccess(userId, locId);

    const inserted = await db.insert(labourTeams).values({ name, locationId: locId, userId }).returning();
    await db.insert(auditLogs).values({ userId, action: 'CREATE_TEAM', entityType: 'TEAM', entityId: inserted[0].id, metadata: JSON.stringify({ name, locationId: locId }) });
    res.status(201).json(inserted[0]);
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to create team" });
  }
});

masterRouter.put('/teams/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });

    const existing = await db.select().from(labourTeams).where(eq(labourTeams.id, id)).limit(1);
    if (!existing.length) return res.status(404).json({ error: "Team not found" });
    await assertLocationAccess(userId, existing[0].locationId);

    const { name } = req.body;
    const updated = await db.update(labourTeams).set({
      ...(name !== undefined && { name })
    }).where(eq(labourTeams.id, id)).returning();
    if (!updated.length) return res.status(404).json({ error: "Team not found" });
    await db.insert(auditLogs).values({ userId, action: 'UPDATE_TEAM', entityType: 'TEAM', entityId: id, metadata: JSON.stringify(req.body) });
    realtimeSync.notifyMutation('UPDATE_TEAM', `/master/teams`, updated[0]);
    res.json(updated[0]);
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to update team" });
  }
});

masterRouter.delete('/teams/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });

    const existing = await db.select().from(labourTeams).where(eq(labourTeams.id, id)).limit(1);
    if (existing.length) {
      try {
        await assertLocationAccess(userId, existing[0].locationId, { allowDeleted: true });
      } catch (locErr) {
        console.warn(`Location check warning during team delete #${id}:`, locErr);
      }
    }

    await db.update(labourTeams)
      .set({ isDeleted: 1 })
      .where(eq(labourTeams.id, id));
    res.json({ success: true });
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to delete team" });
  }
});

// Materials
masterRouter.get('/materials', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const locParam = req.query.locationId as string | undefined;
    const locationId = (locParam && locParam !== 'ALL' && locParam !== '0' && !isNaN(parseInt(locParam, 10)))
      ? parseInt(locParam, 10)
      : undefined;

    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }

    const records = await db.select().from(materials).where(eq(materials.isDeleted, 0)).orderBy(materials.name);

    // Calculate live available stock from stock_ledger for all materials
    const stockMapRes = await db.execute(sql`
      SELECT 
        sl.material_id,
        UPPER(TRIM(m.name)) as clean_name,
        COALESCE(SUM(CASE WHEN sl.transaction_type = 'IN' THEN CAST(sl.quantity AS numeric) ELSE 0 END), 0) as total_in,
        COALESCE(SUM(CASE WHEN sl.transaction_type = 'OUT' THEN ABS(CAST(sl.quantity AS numeric)) ELSE 0 END), 0) as total_out
      FROM stock_ledger sl
      JOIN materials m ON sl.material_id = m.id
      WHERE sl.is_deleted = 0
      GROUP BY sl.material_id, UPPER(TRIM(m.name))
    `);

    // Fetch latest purchases grouped by clean name
    const latestPurchasesRes = await db.execute(sql`
      SELECT DISTINCT ON (UPPER(TRIM(material_name)))
        UPPER(TRIM(material_name)) as clean_name,
        unit,
        rate
      FROM material_purchases
      WHERE is_deleted = 0
      ORDER BY UPPER(TRIM(material_name)), date DESC, id DESC
    `);

    // Fetch latest supplies grouped by clean name
    const latestSuppliesRes = await db.execute(sql`
      SELECT DISTINCT ON (UPPER(TRIM(material_name)))
        UPPER(TRIM(material_name)) as clean_name,
        unit,
        rate
      FROM material_supplies
      WHERE is_deleted = 0
      ORDER BY UPPER(TRIM(material_name)), date DESC, id DESC
    `);

    const stockMap = new Map<string, { totalIn: number; totalOut: number }>();
    const stockByIdMap = new Map<number, { totalIn: number; totalOut: number }>();
    for (const row of stockMapRes.rows) {
      const cleanName = String(row.clean_name || '').trim().toUpperCase();
      const inVal = parseFloat(row.total_in as string || '0');
      const outVal = parseFloat(row.total_out as string || '0');
      const matId = row.material_id ? parseInt(String(row.material_id), 10) : null;

      if (cleanName) {
        const existing = stockMap.get(cleanName) || { totalIn: 0, totalOut: 0 };
        stockMap.set(cleanName, {
          totalIn: existing.totalIn + inVal,
          totalOut: existing.totalOut + outVal
        });
      }
      if (matId && !isNaN(matId)) {
        const existing = stockByIdMap.get(matId) || { totalIn: 0, totalOut: 0 };
        stockByIdMap.set(matId, {
          totalIn: existing.totalIn + inVal,
          totalOut: existing.totalOut + outVal
        });
      }
    }

    const purchaseMap = new Map<string, { unit: string; rate: number }>();
    for (const row of latestPurchasesRes.rows) {
      const cleanName = String(row.clean_name || '').trim().toUpperCase();
      purchaseMap.set(cleanName, {
        unit: String(row.unit || ''),
        rate: parseFloat(row.rate as string || '0')
      });
    }

    const supplyMap = new Map<string, { unit: string; rate: number }>();
    for (const row of latestSuppliesRes.rows) {
      const cleanName = String(row.clean_name || '').trim().toUpperCase();
      supplyMap.set(cleanName, {
        unit: String(row.unit || ''),
        rate: parseFloat(row.rate as string || '0')
      });
    }

    const enriched = [];
    for (const m of records) {
      const cleanName = (m.name || '').trim().toUpperCase();
      
      const stockInfo = stockByIdMap.get(m.id) || stockMap.get(cleanName) || { totalIn: 0, totalOut: 0 };
      const currentStock = Math.round((stockInfo.totalIn - stockInfo.totalOut) * 100) / 100;
      const minStock = parseFloat(m.minStock || '0');

      let status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
      if (currentStock <= 0) {
        status = 'OUT_OF_STOCK';
      } else if (currentStock <= minStock) {
        status = 'LOW_STOCK';
      }

      let resolvedUnit = '';
      const purch = purchaseMap.get(cleanName);
      const suppl = supplyMap.get(cleanName);

      if (purch?.unit && purch.unit.trim().toLowerCase() !== 'unit') {
        resolvedUnit = purch.unit.trim();
      } else if (m.defaultUnit && m.defaultUnit.trim() && m.defaultUnit.trim().toLowerCase() !== 'unit') {
        resolvedUnit = m.defaultUnit.trim();
      } else if (suppl?.unit && suppl.unit.trim().toLowerCase() !== 'unit') {
        resolvedUnit = suppl.unit.trim();
      }
      if (!resolvedUnit) resolvedUnit = 'Nos';

      let resolvedRate = 0;
      if (purch?.rate && purch.rate > 0) {
        resolvedRate = purch.rate;
      } else if (m.defaultRate && parseFloat(m.defaultRate) > 0) {
        resolvedRate = parseFloat(m.defaultRate);
      } else if (suppl?.rate && suppl.rate > 0) {
        resolvedRate = suppl.rate;
      }

      // Sync defaultUnit and defaultRate in database asynchronously
      const shouldUpdateUnit = m.defaultUnit !== resolvedUnit;
      const shouldUpdateRate = resolvedRate > 0 && (!m.defaultRate || parseFloat(m.defaultRate) === 0 || m.defaultRate !== resolvedRate.toString());
      if (shouldUpdateUnit || shouldUpdateRate) {
        db.update(materials).set({ 
          defaultUnit: resolvedUnit,
          ...(resolvedRate > 0 ? { defaultRate: resolvedRate.toString() } : {})
        }).where(eq(materials.id, m.id)).catch(() => {});
      }

      enriched.push({
        ...m,
        defaultUnit: resolvedUnit,
        unit: resolvedUnit,
        defaultRate: resolvedRate > 0 ? resolvedRate.toString() : m.defaultRate,
        rate: resolvedRate > 0 ? resolvedRate.toString() : m.defaultRate,
        totalInward: stockInfo.totalIn,
        totalOutward: stockInfo.totalOut,
        currentStock,
        availableStock: currentStock,
        status
      });
    }

    res.json(enriched);
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    console.error('Failed to fetch materials:', err);
    res.status(500).json({ error: "Failed to fetch materials" });
  }
});

masterRouter.post('/materials', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const { name, locationId, category, defaultUnit, defaultRate, minStock, notes } = req.body;
    if (!name || !locationId) return res.status(400).json({ error: "Name and Location ID required" });
    const locId = parseInt(String(locationId), 10);
    await assertLocationAccess(userId, locId);

    const cleanName = String(name).trim().toUpperCase();

    // Prevent duplicate master material under the same location
    const existing = await db.select().from(materials).where(
      and(
        eq(materials.locationId, locId),
        sql`UPPER(TRIM(${materials.name})) = ${cleanName}`,
        eq(materials.isDeleted, 0)
      )
    );
    if (existing.length > 0) {
      return res.status(200).json(existing[0]);
    }

    const inserted = await db.insert(materials).values({
      name: cleanName, 
      locationId: locId, 
      userId,
      category: category || null, 
      defaultUnit: (defaultUnit && String(defaultUnit).trim().toLowerCase() !== 'unit') ? String(defaultUnit).trim() : 'Nos', 
      defaultRate: defaultRate ? String(defaultRate) : '0.00', 
      minStock: minStock ? String(minStock) : '0.00', 
      notes: notes || null
    }).returning();
    await db.insert(auditLogs).values({ userId, action: 'CREATE_MATERIAL', entityType: 'MATERIAL', entityId: inserted[0].id, metadata: JSON.stringify({ name: cleanName, locationId: locId }) });
    realtimeSync.notifyMutation('CREATE_MATERIAL', `/master/materials?locationId=${locId}`, inserted[0]);
    res.status(201).json(inserted[0]);
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to create material" });
  }
});

masterRouter.put('/materials/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });

    const existing = await db.select().from(materials).where(eq(materials.id, id)).limit(1);
    if (!existing.length) return res.status(404).json({ error: "Material not found" });
    await assertLocationAccess(userId, existing[0].locationId);

    const { name, category, defaultUnit, defaultRate, minStock, notes } = req.body;
    const cleanName = name !== undefined ? String(name).trim().toUpperCase() : undefined;

    const updated = await db.update(materials).set({
      ...(cleanName !== undefined && { name: cleanName }),
      ...(category !== undefined && { category }),
      ...(defaultUnit !== undefined && { defaultUnit }),
      ...(defaultRate !== undefined && { defaultRate: String(defaultRate) }),
      ...(minStock !== undefined && { minStock: String(minStock) }),
      ...(notes !== undefined && { notes })
    }).where(eq(materials.id, id)).returning();
    if (!updated.length) return res.status(404).json({ error: "Material not found" });
    await db.insert(auditLogs).values({ userId, action: 'UPDATE_MATERIAL', entityType: 'MATERIAL', entityId: id, metadata: JSON.stringify(req.body) });
    realtimeSync.notifyMutation('UPDATE_MATERIAL', `/master/materials`, updated[0]);
    res.json(updated[0]);
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to update material" });
  }
});

masterRouter.delete('/materials/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });

    const existing = await db.select().from(materials).where(eq(materials.id, id)).limit(1);
    if (existing.length) {
      try {
        await assertLocationAccess(userId, existing[0].locationId, { allowDeleted: true });
      } catch (locErr) {
        console.warn(`Location check warning during material delete #${id}:`, locErr);
      }
    }

    await db.update(materials).set({ isDeleted: 1 }).where(eq(materials.id, id));
    realtimeSync.notifyMutation('DELETE_MATERIAL', `/master/materials`, { id });
    res.json({ success: true });
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to delete material" });
  }
});

// Labour Master
masterRouter.get('/labour', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
    let records;
    if (locationId) {
      await assertLocationAccess(userId, locationId);
      records = await db.select({
        id: labourMaster.id,
        userId: labourMaster.userId,
        locationId: labourMaster.locationId,
        name: labourMaster.name,
        mobile: labourMaster.mobile,
        address: labourMaster.address,
        teamId: labourMaster.teamId,
        teamName: labourTeams.name,
        workType: labourMaster.workType,
        dailyRate: labourMaster.dailyRate,
        tcRate: labourMaster.tcRate,
        isActive: labourMaster.isActive,
        createdAt: labourMaster.createdAt,
        isDeleted: labourMaster.isDeleted,
      })
      .from(labourMaster)
      .leftJoin(labourTeams, eq(labourMaster.teamId, labourTeams.id))
      .where(
        and(
          eq(labourMaster.isDeleted, 0),
          or(eq(labourMaster.locationId, locationId), eq(labourMaster.userId, userId))
        )
      );
    } else {
      records = await db.select({
        id: labourMaster.id,
        userId: labourMaster.userId,
        locationId: labourMaster.locationId,
        name: labourMaster.name,
        mobile: labourMaster.mobile,
        address: labourMaster.address,
        teamId: labourMaster.teamId,
        teamName: labourTeams.name,
        workType: labourMaster.workType,
        dailyRate: labourMaster.dailyRate,
        tcRate: labourMaster.tcRate,
        isActive: labourMaster.isActive,
        createdAt: labourMaster.createdAt,
        isDeleted: labourMaster.isDeleted,
      })
      .from(labourMaster)
      .leftJoin(labourTeams, eq(labourMaster.teamId, labourTeams.id))
      .where(
        and(eq(labourMaster.isDeleted, 0), eq(labourMaster.userId, userId))
      );
    }
    res.json(records);
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to fetch labour" });
  }
});

masterRouter.post('/labour', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const { name, locationId, mobile, address, teamId, workType, dailyRate, tcRate } = req.body;
    if (!name || !locationId) return res.status(400).json({ error: "Name and Location ID required" });
    const locId = parseInt(String(locationId), 10);
    await assertLocationAccess(userId, locId);

    const inserted = await db.insert(labourMaster).values({
      name, locationId: locId, userId,
      mobile, address, teamId: teamId || null, workType, dailyRate, tcRate
    }).returning();
    await db.insert(auditLogs).values({ userId, action: 'CREATE_LABOUR', entityType: 'LABOUR', entityId: inserted[0].id, metadata: JSON.stringify({ name, locationId: locId }) });
    realtimeSync.notifyMutation('CREATE_LABOUR', `/master/labour?locationId=${locId}`, inserted[0]);
    res.status(201).json(inserted[0]);
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to create labour" });
  }
});

masterRouter.put('/labour/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });

    const existing = await db.select().from(labourMaster).where(eq(labourMaster.id, id)).limit(1);
    if (!existing.length) return res.status(404).json({ error: "Labour not found" });
    await assertLocationAccess(userId, existing[0].locationId);

    const { name, mobile, address, teamId, workType, dailyRate, tcRate } = req.body;
    const updated = await db.update(labourMaster).set({
      ...(name !== undefined && { name }),
      ...(mobile !== undefined && { mobile }),
      ...(address !== undefined && { address }),
      ...(teamId !== undefined && { teamId }),
      ...(workType !== undefined && { workType }),
      ...(dailyRate !== undefined && { dailyRate }),
      ...(tcRate !== undefined && { tcRate })
    }).where(eq(labourMaster.id, id)).returning();
    if (!updated.length) return res.status(404).json({ error: "Labour not found" });
    await db.insert(auditLogs).values({ userId, action: 'UPDATE_LABOUR', entityType: 'LABOUR', entityId: id, metadata: JSON.stringify(req.body) });
    realtimeSync.notifyMutation('UPDATE_LABOUR', `/master/labour`, updated[0]);
    res.json(updated[0]);
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to update labour" });
  }
});

masterRouter.delete('/labour/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });

    const existing = await db.select().from(labourMaster).where(eq(labourMaster.id, id)).limit(1);
    if (existing.length) {
      try {
        await assertLocationAccess(userId, existing[0].locationId, { allowDeleted: true });
      } catch (locErr) {
        console.warn(`Location check warning during labour delete #${id}:`, locErr);
      }
    }

    await db.update(labourMaster).set({ isDeleted: 1 }).where(eq(labourMaster.id, id));
    realtimeSync.notifyMutation('DELETE_LABOUR', `/master/labour`, { id });
    res.json({ success: true });
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to delete labour" });
  }
});

export default masterRouter;
