import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { 
  contractorCosts, 
  siteSupplies, 
  siteSupplyItems, 
  labourSalaries, 
  auditLogs 
} from '../../db/schema.ts';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { assertLocationAccess } from '../lib/locationAuth.ts';
import { round2 } from '../lib/accounting.ts';

const contractorRouter = Router();
contractorRouter.use(requireAuth);

const contractorCostSchema = z.object({
  locationId: z.number().int().positive(),
  contractorName: z.string().min(1, "Contractor / Worker Name is required"),
  teamId: z.union([z.number(), z.string(), z.null()]).transform(v => (v ? parseInt(String(v), 10) : null)).optional().nullable(),
  teamName: z.string().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Valid YYYY-MM-DD date required"),
  amount: z.union([z.number().positive(), z.string()]).transform(v => parseFloat(String(v))),
  workDescription: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * GET /api/contractor-costs?locationId=X
 * List contractor cost entries for a location
 */
contractorRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const locationId = parseInt(req.query.locationId as string, 10);
    if (isNaN(locationId)) return res.status(400).json({ error: 'locationId is required' });

    await assertLocationAccess(userId, locationId);

    const costs = await db.select().from(contractorCosts)
      .where(and(
        eq(contractorCosts.locationId, locationId),
        eq(contractorCosts.isDeleted, 0)
      ))
      .orderBy(desc(contractorCosts.date), desc(contractorCosts.id));

    res.json(costs);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('[Contractor Cost GET Error]', error);
    res.status(500).json({ error: 'Failed to fetch contractor costs' });
  }
});

/**
 * GET /api/contractor-costs/reconciliation?locationId=X
 * Category 7 Reconciliation Engine:
 * Compares Site Supply Items + Labour Attendance Expenses against Recorded Contractor Costs.
 */
contractorRouter.get('/reconciliation', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const locationId = parseInt(req.query.locationId as string, 10);
    if (isNaN(locationId)) return res.status(400).json({ error: 'locationId is required' });

    await assertLocationAccess(userId, locationId);

    const teamIdQuery = req.query.teamId ? parseInt(req.query.teamId as string, 10) : null;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    // 1. Site Supplies aggregation for this location
    const siteSuppliesData = await db.select({
      id: siteSupplies.id,
      teamId: siteSupplies.teamId,
      date: siteSupplies.date,
      totalAmount: siteSupplies.totalAmount,
    }).from(siteSupplies).where(
      and(
        eq(siteSupplies.locationId, locationId),
        eq(siteSupplies.isDeleted, 0),
        startDate ? sql`${siteSupplies.date} >= ${startDate}` : sql`1=1`,
        endDate ? sql`${siteSupplies.date} <= ${endDate}` : sql`1=1`,
        teamIdQuery ? eq(siteSupplies.teamId, teamIdQuery) : sql`1=1`
      )
    );

    const totalSiteSupplyAmount = round2(
      siteSuppliesData.reduce((acc, row) => acc + (parseFloat(String(row.totalAmount || 0)) || 0), 0)
    );

    // 2. Labour Attendance aggregation (Work-wise + Day-wise gross/net salaries + Upad + Kharch)
    const labourData = await db.select({
      id: labourSalaries.id,
      labourTeam: labourSalaries.labourTeam,
      date: labourSalaries.date,
      grossSalary: labourSalaries.grossSalary,
      netSalary: labourSalaries.netSalary,
      paymentAmount: labourSalaries.paymentAmount,
      upad: labourSalaries.upad,
      deduction: labourSalaries.deduction,
    }).from(labourSalaries).where(
      and(
        eq(labourSalaries.locationId, locationId),
        eq(labourSalaries.isDeleted, 0),
        startDate ? sql`${labourSalaries.date} >= ${startDate}` : sql`1=1`,
        endDate ? sql`${labourSalaries.date} <= ${endDate}` : sql`1=1`
      )
    );

    const totalLabourAttendance = round2(
      labourData.reduce((acc, row) => acc + (parseFloat(String(row.netSalary || row.grossSalary || 0)) || 0), 0)
    );
    const totalLabourUpadPaid = round2(
      labourData.reduce((acc, row) => acc + (parseFloat(String(row.upad || 0)) || 0), 0)
    );

    // Expected contractor cost (Site Supply + Labour Attendance)
    const expectedContractorCost = round2(totalSiteSupplyAmount + totalLabourAttendance);

    // 3. Recorded Contractor Costs from contractor_costs table
    const recordedCosts = await db.select().from(contractorCosts).where(
      and(
        eq(contractorCosts.locationId, locationId),
        eq(contractorCosts.isDeleted, 0),
        startDate ? sql`${contractorCosts.date} >= ${startDate}` : sql`1=1`,
        endDate ? sql`${contractorCosts.date} <= ${endDate}` : sql`1=1`,
        teamIdQuery ? eq(contractorCosts.teamId, teamIdQuery) : sql`1=1`
      )
    );

    const recordedContractorCost = round2(
      recordedCosts.reduce((acc, row) => acc + (parseFloat(String(row.amount || 0)) || 0), 0)
    );

    const difference = round2(recordedContractorCost - expectedContractorCost);
    let status: 'MATCH' | 'SURPLUS' | 'DEFICIT' = 'MATCH';
    if (difference > 0.01) {
      status = 'SURPLUS';
    } else if (difference < -0.01) {
      status = 'DEFICIT';
    }

    res.json({
      locationId,
      teamId: teamIdQuery,
      totalSiteSupplyAmount,
      totalLabourAttendance,
      totalLabourUpadPaid,
      expectedContractorCost,
      recordedContractorCost,
      difference,
      status,
      siteSuppliesCount: siteSuppliesData.length,
      labourRecordsCount: labourData.length,
      recordedCostsCount: recordedCosts.length
    });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('[Contractor Reconciliation GET Error]', error);
    res.status(500).json({ error: 'Failed to calculate contractor cost reconciliation' });
  }
});

/**
 * POST /api/contractor-costs
 * Record a new contractor cost
 */
contractorRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const data = contractorCostSchema.parse(req.body);
    await assertLocationAccess(userId, data.locationId);

    const inserted = await db.insert(contractorCosts).values({
      userId,
      locationId: data.locationId,
      contractorName: data.contractorName.trim(),
      teamId: data.teamId || null,
      teamName: data.teamName || null,
      date: data.date,
      amount: String(data.amount),
      workDescription: data.workDescription || null,
      paymentMethod: data.paymentMethod || 'Cash',
      referenceNumber: data.referenceNumber || null,
      notes: data.notes || null,
      isDeleted: 0
    }).returning();

    await db.insert(auditLogs).values({
      userId,
      action: 'CREATE_CONTRACTOR_COST',
      entityType: 'CONTRACTOR_COST',
      entityId: inserted[0].id,
      metadata: JSON.stringify({ 
        locationId: data.locationId, 
        contractorName: data.contractorName, 
        amount: data.amount 
      })
    });

    res.status(201).json(inserted[0]);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('[Contractor Cost POST Error]', error);
    res.status(400).json({ error: error?.message || 'Failed to create contractor cost' });
  }
});

/**
 * PUT /api/contractor-costs/:id
 * Update an existing contractor cost
 */
contractorRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const costId = parseInt(String(req.params.id), 10);
    if (isNaN(costId)) return res.status(400).json({ error: 'Valid ID is required' });

    const existing = await db.select().from(contractorCosts)
      .where(and(eq(contractorCosts.id, costId), eq(contractorCosts.isDeleted, 0)))
      .limit(1);

    if (!existing.length) return res.status(404).json({ error: 'Contractor cost record not found' });
    await assertLocationAccess(userId, existing[0].locationId);

    const data = contractorCostSchema.partial().parse(req.body);

    const updated = await db.update(contractorCosts).set({
      contractorName: data.contractorName !== undefined ? data.contractorName.trim() : undefined,
      teamId: data.teamId !== undefined ? data.teamId : undefined,
      teamName: data.teamName !== undefined ? data.teamName : undefined,
      date: data.date !== undefined ? data.date : undefined,
      amount: data.amount !== undefined ? String(data.amount) : undefined,
      workDescription: data.workDescription !== undefined ? data.workDescription : undefined,
      paymentMethod: data.paymentMethod !== undefined ? data.paymentMethod : undefined,
      referenceNumber: data.referenceNumber !== undefined ? data.referenceNumber : undefined,
      notes: data.notes !== undefined ? data.notes : undefined,
      updatedAt: new Date()
    }).where(eq(contractorCosts.id, costId)).returning();

    await db.insert(auditLogs).values({
      userId,
      action: 'UPDATE_CONTRACTOR_COST',
      entityType: 'CONTRACTOR_COST',
      entityId: costId,
      metadata: JSON.stringify({ costId, updates: data })
    });

    res.json(updated[0]);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('[Contractor Cost PUT Error]', error);
    res.status(400).json({ error: error?.message || 'Failed to update contractor cost' });
  }
});

/**
 * DELETE /api/contractor-costs/:id
 * Protected by universal password middleware
 */
contractorRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const costId = parseInt(String(req.params.id), 10);
    if (isNaN(costId)) return res.status(400).json({ error: 'Valid ID is required' });

    const existing = await db.select().from(contractorCosts)
      .where(and(eq(contractorCosts.id, costId), eq(contractorCosts.isDeleted, 0)))
      .limit(1);

    if (!existing.length) return res.status(404).json({ error: 'Contractor cost record not found' });
    await assertLocationAccess(userId, existing[0].locationId);

    await db.update(contractorCosts).set({
      isDeleted: 1,
      updatedAt: new Date()
    }).where(eq(contractorCosts.id, costId));

    await db.insert(auditLogs).values({
      userId,
      action: 'DELETE_CONTRACTOR_COST',
      entityType: 'CONTRACTOR_COST',
      entityId: costId,
      metadata: JSON.stringify({ costId, contractorName: existing[0].contractorName })
    });

    res.json({ success: true, message: 'Contractor cost record deleted successfully' });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('[Contractor Cost DELETE Error]', error);
    res.status(500).json({ error: 'Failed to delete contractor cost' });
  }
});

export default contractorRouter;
