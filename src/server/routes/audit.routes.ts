import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { auditLogs } from '../../db/schema.ts';
import { eq, desc } from 'drizzle-orm';

const auditRouter = Router();

auditRouter.use(requireAuth);

auditRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const logs = await db.select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, req.dbUser!.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);
      
    res.json(logs);
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default auditRouter;
