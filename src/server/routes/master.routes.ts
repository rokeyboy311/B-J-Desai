import express from 'express';
import { db } from '../../db/index.js';
import { parties, labourTeams, materials, labourMaster } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { auditLogs } from '../../db/schema.js';

const masterRouter = express.Router();
masterRouter.use(requireAuth);

// Parties
masterRouter.get('/parties', async (req: AuthRequest, res) => {
  try {
    const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
    if (!locationId) return res.status(400).json({ error: "Location ID required" });
    const records = await db.select().from(parties).where(and(eq(parties.userId, req.dbUser!.id), eq(parties.locationId, locationId), eq(parties.isDeleted, 0)));
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch parties" });
  }
});

masterRouter.post('/parties', async (req: AuthRequest, res) => {
  try {
    const { name, locationId } = req.body;
    if (!name || !locationId) return res.status(400).json({ error: "Name and Location ID required" });
    const inserted = await db.insert(parties).values({ name, locationId, userId: req.dbUser!.id }).returning();
    await db.insert(auditLogs).values({ userId: req.dbUser!.id, action: 'CREATE_PARTY', entityType: 'PARTY', entityId: inserted[0].id, metadata: JSON.stringify({ name, locationId }) });
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
      .where(and(eq(parties.id, id), eq(parties.userId, req.dbUser!.id)));
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
    const records = await db.select().from(labourTeams).where(and(eq(labourTeams.userId, req.dbUser!.id), eq(labourTeams.locationId, locationId), eq(labourTeams.isDeleted, 0)));
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});

masterRouter.post('/teams', async (req: AuthRequest, res) => {
  try {
    const { name, locationId } = req.body;
    if (!name || !locationId) return res.status(400).json({ error: "Name and Location ID required" });
    const inserted = await db.insert(labourTeams).values({ name, locationId, userId: req.dbUser!.id }).returning();
    await db.insert(auditLogs).values({ userId: req.dbUser!.id, action: 'CREATE_TEAM', entityType: 'TEAM', entityId: inserted[0].id, metadata: JSON.stringify({ name, locationId }) });
    res.status(201).json(inserted[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create team" });
  }
});

masterRouter.delete('/teams/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });
    await db.update(labourTeams)
      .set({ isDeleted: 1 })
      .where(and(eq(labourTeams.id, id), eq(labourTeams.userId, req.dbUser!.id)));
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
    const records = await db.select().from(materials).where(and(eq(materials.userId, req.dbUser!.id), eq(materials.locationId, locationId), eq(materials.isDeleted, 0)));
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch materials" });
  }
});

masterRouter.post('/materials', async (req: AuthRequest, res) => {
  try {
    const { name, locationId, category, defaultUnit, defaultRate, minStock, notes } = req.body;
    if (!name || !locationId) return res.status(400).json({ error: "Name and Location ID required" });
    const inserted = await db.insert(materials).values({
      name, locationId, userId: req.dbUser!.id,
      category, defaultUnit, defaultRate, minStock, notes
    }).returning();
    await db.insert(auditLogs).values({ userId: req.dbUser!.id, action: 'CREATE_MATERIAL', entityType: 'MATERIAL', entityId: inserted[0].id, metadata: JSON.stringify({ name, locationId }) });
    res.status(201).json(inserted[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create material" });
  }
});

masterRouter.delete('/materials/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });
    await db.update(materials).set({ isDeleted: 1 }).where(and(eq(materials.id, id), eq(materials.userId, req.dbUser!.id)));
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
    const records = await db.select().from(labourMaster).where(and(eq(labourMaster.userId, req.dbUser!.id), eq(labourMaster.locationId, locationId), eq(labourMaster.isDeleted, 0)));
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch labour" });
  }
});

masterRouter.post('/labour', async (req: AuthRequest, res) => {
  try {
    const { name, locationId, mobile, address, teamId, workType, dailyRate, tcRate } = req.body;
    if (!name || !locationId) return res.status(400).json({ error: "Name and Location ID required" });
    const inserted = await db.insert(labourMaster).values({
      name, locationId, userId: req.dbUser!.id,
      mobile, address, teamId: teamId || null, workType, dailyRate, tcRate
    }).returning();
    await db.insert(auditLogs).values({ userId: req.dbUser!.id, action: 'CREATE_LABOUR', entityType: 'LABOUR', entityId: inserted[0].id, metadata: JSON.stringify({ name, locationId }) });
    res.status(201).json(inserted[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create labour" });
  }
});

masterRouter.delete('/labour/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });
    await db.update(labourMaster).set({ isDeleted: 1 }).where(and(eq(labourMaster.id, id), eq(labourMaster.userId, req.dbUser!.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete labour" });
  }
});

export default masterRouter;
