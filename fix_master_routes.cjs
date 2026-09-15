const fs = require('fs');
let content = fs.readFileSync('src/server/routes/master.routes.ts', 'utf8');

if (!content.includes('import { materials, labourMaster }')) {
  content = content.replace(
    "import { parties, labourTeams } from '../../db/schema.js';",
    "import { parties, labourTeams, materials, labourMaster } from '../../db/schema.js';"
  );
}

if (!content.includes('/materials')) {
  content += `
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
`;
}

// Ensure the export default masterRouter is at the end
content = content.replace('export default masterRouter;', '');
content += '\nexport default masterRouter;\n';

fs.writeFileSync('src/server/routes/master.routes.ts', content);
console.log('Fixed master routes');
