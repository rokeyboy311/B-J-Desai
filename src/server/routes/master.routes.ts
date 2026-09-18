import express from 'express';
import { db } from '../../db/index.js';
import { parties, labourTeams, materials, labourMaster } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { auditLogs } from '../../db/schema.js';
import { realtimeSync } from '../lib/realtimeSync.js';

const masterRouter = express.Router();
masterRouter.use(requireAuth);

// Parties
masterRouter.get('/parties', async (req: AuthRequest, res) => {
  try {
    const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
    if (!locationId) return res.status(400).json({ error: "Location ID required" });
    const records = await db.select().from(parties).where(and(eq(parties.locationId, locationId), eq(parties.isDeleted, 0)));
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch parties" });
  }
});

masterRouter.post('/parties', async (req: AuthRequest, res) => {
  try {
    const { name, locationId } = req.body;
    if (!name || !locationId) return res.status(400).json({ error: "Name and Location ID required" });
    const userId = req.dbUser?.id || 1;
    const inserted = await db.insert(parties).values({ name, locationId, userId }).returning();
    await db.insert(auditLogs).values({ userId, action: 'CREATE_PARTY', entityType: 'PARTY', entityId: inserted[0].id, metadata: JSON.stringify({ name, locationId }) });
    res.status(201).json(inserted[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create party" });
  }
});

masterRouter.delete('/parties/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });
    await db.update(parties)
      .set({ isDeleted: 1 })
      .where(eq(parties.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete party" });
  }
});

// Teams
masterRouter.get('/teams', async (req: AuthRequest, res) => {
  try {
    const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
    if (!locationId) return res.status(400).json({ error: "Location ID required" });
    const records = await db.select().from(labourTeams).where(and(eq(labourTeams.locationId, locationId), eq(labourTeams.isDeleted, 0)));
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});

masterRouter.post('/teams', async (req: AuthRequest, res) => {
  try {
    const { name, locationId } = req.body;
    if (!name || !locationId) return res.status(400).json({ error: "Name and Location ID required" });
    const userId = req.dbUser?.id || 1;
    const inserted = await db.insert(labourTeams).values({ name, locationId, userId }).returning();
    await db.insert(auditLogs).values({ userId, action: 'CREATE_TEAM', entityType: 'TEAM', entityId: inserted[0].id, metadata: JSON.stringify({ name, locationId }) });
    res.status(201).json(inserted[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create team" });
  }
});

masterRouter.put('/teams/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });
    const { name } = req.body;
    const userId = req.dbUser?.id || 1;
    const updated = await db.update(labourTeams).set({
      ...(name !== undefined && { name })
    }).where(eq(labourTeams.id, id)).returning();
    if (!updated.length) return res.status(404).json({ error: "Team not found" });
    await db.insert(auditLogs).values({ userId, action: 'UPDATE_TEAM', entityType: 'TEAM', entityId: id, metadata: JSON.stringify(req.body) });
    realtimeSync.notifyMutation('UPDATE_TEAM', `/master/teams`, updated[0]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update team" });
  }
});

masterRouter.delete('/teams/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });
    await db.update(labourTeams)
      .set({ isDeleted: 1 })
      .where(eq(labourTeams.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete team" });
  }
});

// Materials
masterRouter.get('/materials', async (req: AuthRequest, res) => {
  try {
    const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
    if (!locationId) return res.status(400).json({ error: "Location ID required" });
    const records = await db.select().from(materials).where(and(eq(materials.locationId, locationId), eq(materials.isDeleted, 0)));
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch materials" });
  }
});

masterRouter.post('/materials', async (req: AuthRequest, res) => {
  try {
    const { name, locationId, category, defaultUnit, defaultRate, minStock, notes } = req.body;
    if (!name || !locationId) return res.status(400).json({ error: "Name and Location ID required" });
    const userId = req.dbUser?.id || 1;
    const inserted = await db.insert(materials).values({
      name, locationId, userId,
      category, defaultUnit, defaultRate, minStock, notes
    }).returning();
    await db.insert(auditLogs).values({ userId, action: 'CREATE_MATERIAL', entityType: 'MATERIAL', entityId: inserted[0].id, metadata: JSON.stringify({ name, locationId }) });
    realtimeSync.notifyMutation('CREATE_MATERIAL', `/master/materials?locationId=${locationId}`, inserted[0]);
    res.status(201).json(inserted[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create material" });
  }
});

masterRouter.put('/materials/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });
    const { name, category, defaultUnit, defaultRate, minStock, notes } = req.body;
    const userId = req.dbUser?.id || 1;
    const updated = await db.update(materials).set({
      ...(name !== undefined && { name }),
      ...(category !== undefined && { category }),
      ...(defaultUnit !== undefined && { defaultUnit }),
      ...(defaultRate !== undefined && { defaultRate }),
      ...(minStock !== undefined && { minStock }),
      ...(notes !== undefined && { notes })
    }).where(eq(materials.id, id)).returning();
    if (!updated.length) return res.status(404).json({ error: "Material not found" });
    await db.insert(auditLogs).values({ userId, action: 'UPDATE_MATERIAL', entityType: 'MATERIAL', entityId: id, metadata: JSON.stringify(req.body) });
    realtimeSync.notifyMutation('UPDATE_MATERIAL', `/master/materials`, updated[0]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update material" });
  }
});

masterRouter.delete('/materials/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });
    await db.update(materials).set({ isDeleted: 1 }).where(eq(materials.id, id));
    realtimeSync.notifyMutation('DELETE_MATERIAL', `/master/materials`, { id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete material" });
  }
});

// Labour Master
masterRouter.get('/labour', async (req: AuthRequest, res) => {
  try {
    const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
    if (!locationId) return res.status(400).json({ error: "Location ID required" });
    const records = await db.select().from(labourMaster).where(and(eq(labourMaster.locationId, locationId), eq(labourMaster.isDeleted, 0)));
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch labour" });
  }
});

masterRouter.post('/labour', async (req: AuthRequest, res) => {
  try {
    const { name, locationId, mobile, address, teamId, workType, dailyRate, tcRate } = req.body;
    if (!name || !locationId) return res.status(400).json({ error: "Name and Location ID required" });
    const userId = req.dbUser?.id || 1;
    const inserted = await db.insert(labourMaster).values({
      name, locationId, userId,
      mobile, address, teamId: teamId || null, workType, dailyRate, tcRate
    }).returning();
    await db.insert(auditLogs).values({ userId, action: 'CREATE_LABOUR', entityType: 'LABOUR', entityId: inserted[0].id, metadata: JSON.stringify({ name, locationId }) });
    realtimeSync.notifyMutation('CREATE_LABOUR', `/master/labour?locationId=${locationId}`, inserted[0]);
    res.status(201).json(inserted[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create labour" });
  }
});

masterRouter.put('/labour/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });
    const { name, mobile, address, teamId, workType, dailyRate, tcRate } = req.body;
    const userId = req.dbUser?.id || 1;
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
  } catch (err) {
    res.status(500).json({ error: "Failed to update labour" });
  }
});

masterRouter.delete('/labour/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });
    await db.update(labourMaster).set({ isDeleted: 1 }).where(eq(labourMaster.id, id));
    realtimeSync.notifyMutation('DELETE_LABOUR', `/master/labour`, { id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete labour" });
  }
});

export default masterRouter;
