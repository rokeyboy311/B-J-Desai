import express from 'express';
import { db } from '../../db/index.js';
import { parties, labourTeams } from '../../db/schema.js';
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

export default masterRouter;
