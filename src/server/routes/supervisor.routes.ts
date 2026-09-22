import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { supervisorCosts } from '../../db/schema.ts';
import { eq, and, desc } from 'drizzle-orm';
import { assertLocationAccess } from '../lib/locationAuth.ts';

const supervisorRouter = Router();
supervisorRouter.use(requireAuth);

supervisorRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const locParam = req.query.locationId as string | undefined;
    const locationId = (locParam && locParam !== 'ALL' && locParam !== '0' && !isNaN(Number(locParam)))
      ? Number(locParam)
      : undefined;

    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }
    
    const records = await db.select().from(supervisorCosts)
      .where(and(
        eq(supervisorCosts.isDeleted, 0),
        locationId ? eq(supervisorCosts.locationId, locationId) : undefined
      ))
      .orderBy(desc(supervisorCosts.createdAt));
      
    res.json(records);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to fetch supervisor costs:", error);
    res.status(500).json({ error: "Failed to fetch supervisor costs" });
  }
});

supervisorRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const { 
      locationId, date, supervisorName, amount, 
      description, paymentMethod, referenceNumber 
    } = req.body;
    
    const locId = Number(locationId);
    if (!locId || isNaN(locId)) {
      return res.status(400).json({ error: 'મહેરબાની કરીને પ્રોજેક્ટ લોકેશન સિલેક્ટ કરો / Please select a project location' });
    }
    await assertLocationAccess(userId, locId);

    const [newRecord] = await db.insert(supervisorCosts).values({
      locationId: locId,
      userId,
      date,
      supervisorName,
      amount: String(amount),
      description,
      paymentMethod,
      referenceNumber
    }).returning();
    
    res.json(newRecord);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to create supervisor cost:", error);
    res.status(500).json({ error: "Failed to create supervisor cost" });
  }
});

supervisorRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const { id } = req.params;
    const existing = await db.select().from(supervisorCosts).where(and(eq(supervisorCosts.id, Number(id)), eq(supervisorCosts.isDeleted, 0))).limit(1);
    if (!existing.length) return res.status(404).json({ error: "Record not found" });
    await assertLocationAccess(userId, existing[0].locationId);

    const { 
      date, supervisorName, amount, 
      description, paymentMethod, referenceNumber 
    } = req.body;
    
    const [updatedRecord] = await db.update(supervisorCosts)
      .set({
        date,
        supervisorName,
        amount: String(amount),
        description,
        paymentMethod,
        referenceNumber
      })
      .where(and(
        eq(supervisorCosts.id, Number(id)),
        eq(supervisorCosts.isDeleted, 0)
      ))
      .returning();
      
    if (!updatedRecord) return res.status(404).json({ error: "Record not found" });
    res.json(updatedRecord);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to update supervisor cost:", error);
    res.status(500).json({ error: "Failed to update supervisor cost" });
  }
});

supervisorRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const { id } = req.params;
    const existing = await db.select().from(supervisorCosts).where(eq(supervisorCosts.id, Number(id))).limit(1);
    if (existing.length) {
      await assertLocationAccess(userId, existing[0].locationId);
    }
    
    await db.update(supervisorCosts)
      .set({ isDeleted: 1 })
      .where(eq(supervisorCosts.id, Number(id)));
      
    res.json({ success: true });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to delete supervisor cost:", error);
    res.status(500).json({ error: "Failed to delete supervisor cost" });
  }
});

export default supervisorRouter;
