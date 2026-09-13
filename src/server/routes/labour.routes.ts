import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { labourSalaries, auditLogs } from '../../db/schema.ts';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const labourRouter = Router();
labourRouter.use(requireAuth);

const salarySchema = z.object({
  locationId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  siteLocationName: z.string().optional().nullable(),
  labourName: z.string().min(1),
  labourTeam: z.string().optional().nullable(),
  attendanceType: z.string().optional().nullable(),
  tcNumber: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  days: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  dailyRate: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  otherEarnings: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  deduction: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  upad: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  paymentAmount: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  paymentMethod: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

labourRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const locationId = parseInt(req.query.locationId as string, 10);
    if (isNaN(locationId)) return res.status(400).json({ error: 'locationId required' });

    const records = await db.select().from(labourSalaries).where(
      and(
        eq(labourSalaries.userId, req.dbUser!.id),
        eq(labourSalaries.locationId, locationId),
        eq(labourSalaries.isDeleted, 0)
      )
    ).orderBy(desc(labourSalaries.date), desc(labourSalaries.id));
    
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch labour records' });
  }
});

labourRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = salarySchema.parse(req.body);
    
    // Calculate logic
    const grossSalary = Math.round(((data.days * data.dailyRate) + data.otherEarnings) * 100) / 100;
    const netSalary = Math.round((grossSalary - data.deduction) * 100) / 100;
    const balance = Math.round((netSalary - data.upad - data.paymentAmount) * 100) / 100;
    
    const result = await db.insert(labourSalaries).values({
      userId: req.dbUser!.id,
      ...data,
      days: data.days.toString(),
      dailyRate: data.dailyRate.toString(),
      otherEarnings: data.otherEarnings.toString(),
      grossSalary: grossSalary.toString(),
      deduction: data.deduction.toString(),
      netSalary: netSalary.toString(),
      upad: data.upad.toString(),
      paymentAmount: data.paymentAmount.toString(),
      balance: balance.toString(),
    }).returning();
    
    res.json(result[0]);
  } catch (error) {
    res.status(400).json({ error: 'Validation failed' });
  }
});

labourRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Valid id required' });
    const data = salarySchema.parse(req.body);
    
    const grossSalary = Math.round(((data.days * data.dailyRate) + data.otherEarnings) * 100) / 100;
    const netSalary = Math.round((grossSalary - data.deduction) * 100) / 100;
    const balance = Math.round((netSalary - data.upad - data.paymentAmount) * 100) / 100;
    
    const result = await db.update(labourSalaries).set({
      ...data,
      days: data.days.toString(),
      dailyRate: data.dailyRate.toString(),
      otherEarnings: data.otherEarnings.toString(),
      grossSalary: grossSalary.toString(),
      deduction: data.deduction.toString(),
      netSalary: netSalary.toString(),
      upad: data.upad.toString(),
      paymentAmount: data.paymentAmount.toString(),
      balance: balance.toString(),
    }).where(and(eq(labourSalaries.id, id), eq(labourSalaries.userId, req.dbUser!.id))).returning();
    
    if (!result.length) return res.status(404).json({ error: 'Record not found' });
    res.json(result[0]);
  } catch (error) {
    res.status(400).json({ error: 'Validation failed' });
  }
});

labourRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Valid id required' });
    
    await db.update(labourSalaries).set({ isDeleted: 1 })
      .where(and(eq(labourSalaries.id, id), eq(labourSalaries.userId, req.dbUser!.id)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

export default labourRouter;
