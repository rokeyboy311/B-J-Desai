import express from 'express';
import { db } from '../../db/index.js';
import { parties, labourTeams, materials, labourMaster } from '../../db/schema.js';
import { eq, and, or, sql } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { auditLogs } from '../../db/schema.js';
import { realtimeSync } from '../lib/realtimeSync.js';
import { assertLocationAccess } from '../lib/locationAuth.js';

const masterRouter = express.Router();
masterRouter.use(requireAuth);

// Parties
masterRouter.get('/parties', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
    if (!locationId) return res.status(400).json({ error: "Location ID required" });
    await assertLocationAccess(userId, locationId);

    const records = await db.select().from(parties).where(and(eq(parties.locationId, locationId), eq(parties.isDeleted, 0)));
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

    const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
    if (!locationId) return res.status(400).json({ error: "Location ID required" });
    await assertLocationAccess(userId, locationId);

    const records = await db.select().from(labourTeams).where(and(eq(labourTeams.locationId, locationId), eq(labourTeams.isDeleted, 0)));
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

    const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
    if (!locationId) return res.status(400).json({ error: "Location ID required" });
    await assertLocationAccess(userId, locationId);

    const records = await db.select().from(materials).where(and(eq(materials.locationId, locationId), eq(materials.isDeleted, 0)));
    res.json(records);
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
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
      defaultUnit: defaultUnit || 'Unit', 
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
