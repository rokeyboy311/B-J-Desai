import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { supervisorCosts } from '../../db/schema.ts';
import { eq, and, desc } from 'drizzle-orm';

const supervisorRouter = Router();
supervisorRouter.use(requireAuth);

supervisorRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const { locationId } = req.query;
    
    let query = db.select().from(supervisorCosts)
      .where(and(
        eq(supervisorCosts.userId, userId),
        eq(supervisorCosts.isDeleted, 0),
        locationId ? eq(supervisorCosts.locationId, Number(locationId)) : undefined
      ))
      .orderBy(desc(supervisorCosts.createdAt));
      
    const records = await query;
    res.json(records);
  } catch (error) {
    console.error("Failed to fetch supervisor costs:", error);
    res.status(500).json({ error: "Failed to fetch supervisor costs" });
  }
});

supervisorRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const { 
      locationId, date, supervisorName, amount, 
      description, paymentMethod, referenceNumber 
    } = req.body;
    
    const [newRecord] = await db.insert(supervisorCosts).values({
      locationId: Number(locationId),
      userId,
      date,
      supervisorName,
      amount: String(amount),
      description,
      paymentMethod,
      referenceNumber
    }).returning();
    
    res.json(newRecord);
  } catch (error) {
    console.error("Failed to create supervisor cost:", error);
    res.status(500).json({ error: "Failed to create supervisor cost" });
  }
});

supervisorRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const { id } = req.params;
    
    await db.update(supervisorCosts)
      .set({ isDeleted: 1 })
      .where(and(
        eq(supervisorCosts.id, Number(id)),
        eq(supervisorCosts.userId, userId)
      ));
      
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete supervisor cost:", error);
    res.status(500).json({ error: "Failed to delete supervisor cost" });
  }
});

export default supervisorRouter;
