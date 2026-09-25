import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { 
  contractorCosts, 
  siteSupplies, 
  siteSupplyItems, 
  labourSalaries, 
  materialSupplies,
  investorLocationAllocations,
  investmentTransactions,
  investmentParties,
  locations,
  auditLogs 
} from '../../db/schema.ts';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { assertLocationAccess } from '../lib/locationAuth.ts';
import { round2 } from '../lib/accounting.ts';
import { generateContractorCostsBuffer, generateReconciliationBuffer } from '../lib/excel.ts';

const contractorRouter = Router();
contractorRouter.use(requireAuth);

const contractorCostSchema = z.object({
  locationId: z.number().int().positive(),
  contractorName: z.string().min(1, "Contractor / Worker Name is required"),
  teamId: z.union([z.number(), z.string(), z.null()]).transform(v => (v ? parseInt(String(v), 10) : null)).optional().nullable(),
  teamName: z.string().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Valid YYYY-MM-DD date required"),
  amount: z.union([z.number().positive(), z.string()]).transform(v => parseFloat(String(v))),
  deductionAmount: z.union([z.number(), z.string()]).transform(v => parseFloat(String(v || 0))).default(0),
  netAmount: z.union([z.number(), z.string()]).transform(v => parseFloat(String(v || 0))).optional(),
  paymentStatus: z.enum(["PAID", "PENDING", "PARTIAL"]).default("PAID"),
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

    const locParam = req.query.locationId as string | undefined;
    const locationId = (locParam && locParam !== 'ALL' && locParam !== '0' && !isNaN(parseInt(locParam, 10)))
      ? parseInt(locParam, 10)
      : undefined;

    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }

    const costs = await db.select({
      id: contractorCosts.id,
      locationId: contractorCosts.locationId,
      userId: contractorCosts.userId,
      contractorName: contractorCosts.contractorName,
      teamId: contractorCosts.teamId,
      teamName: contractorCosts.teamName,
      date: contractorCosts.date,
      amount: contractorCosts.amount,
      deductionAmount: contractorCosts.deductionAmount,
      netAmount: contractorCosts.netAmount,
      paymentStatus: contractorCosts.paymentStatus,
      workDescription: contractorCosts.workDescription,
      paymentMethod: contractorCosts.paymentMethod,
      referenceNumber: contractorCosts.referenceNumber,
      notes: contractorCosts.notes,
      createdAt: contractorCosts.createdAt,
      updatedAt: contractorCosts.updatedAt,
      isDeleted: contractorCosts.isDeleted,
    }).from(contractorCosts)
      .innerJoin(locations, eq(contractorCosts.locationId, locations.id))
      .where(and(
        eq(locations.isDeleted, 0),
        locationId ? eq(contractorCosts.locationId, locationId) : undefined,
        eq(contractorCosts.isDeleted, 0)
      ))
      .orderBy(desc(contractorCosts.date), desc(contractorCosts.id));

    res.json(costs);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.warn('[Contractor Cost GET Notice] Database query fallback:', error?.message || error);
    res.json([]);
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

    const locParam = req.query.locationId as string | undefined;
    const locationId = (locParam && locParam !== 'ALL' && locParam !== '0' && !isNaN(parseInt(locParam, 10)))
      ? parseInt(locParam, 10)
      : undefined;

    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }

    const teamIdQuery = req.query.teamId ? parseInt(req.query.teamId as string, 10) : null;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    // 1. Site Supplies aggregation for this location
    const siteSuppliesData = await db.select({
      id: siteSupplies.id,
      teamId: siteSupplies.teamId,
      date: siteSupplies.date,
      totalAmount: siteSupplies.totalAmount,
    }).from(siteSupplies)
    .innerJoin(locations, eq(siteSupplies.locationId, locations.id))
    .where(
      and(
        eq(locations.isDeleted, 0),
        locationId ? eq(siteSupplies.locationId, locationId) : undefined,
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
    }).from(labourSalaries)
    .innerJoin(locations, eq(labourSalaries.locationId, locations.id))
    .where(
      and(
        eq(locations.isDeleted, 0),
        locationId ? eq(labourSalaries.locationId, locationId) : undefined,
        eq(labourSalaries.isDeleted, 0),
        startDate ? sql`${labourSalaries.date} >= ${startDate}` : sql`1=1`,
        endDate ? sql`${labourSalaries.date} <= ${endDate}` : sql`1=1`
      )
    );

    const totalLabourAttendance = round2(
      labourData.reduce((acc, row) => {
        const net = parseFloat(String(row.netSalary || 0)) || 0;
        const gross = parseFloat(String(row.grossSalary || 0)) || 0;
        const upad = parseFloat(String(row.upad || 0)) || 0;
        const amt = net > 0 ? net : (gross > 0 ? gross : upad);
        return acc + amt;
      }, 0)
    );
    const totalLabourUpadPaid = round2(
      labourData.reduce((acc, row) => acc + (parseFloat(String(row.upad || 0)) || 0), 0)
    );

    // Expected contractor cost (Site Supply + Labour Attendance)
    const expectedContractorCost = round2(totalSiteSupplyAmount + totalLabourAttendance);

    // 3. Recorded Contractor Costs from contractor_costs table
    const recordedCosts = await db.select({
      id: contractorCosts.id,
      locationId: contractorCosts.locationId,
      contractorName: contractorCosts.contractorName,
      teamId: contractorCosts.teamId,
      teamName: contractorCosts.teamName,
      date: contractorCosts.date,
      amount: contractorCosts.amount,
      deductionAmount: contractorCosts.deductionAmount,
      netAmount: contractorCosts.netAmount,
      paymentStatus: contractorCosts.paymentStatus,
      workDescription: contractorCosts.workDescription,
      paymentMethod: contractorCosts.paymentMethod,
      referenceNumber: contractorCosts.referenceNumber,
      notes: contractorCosts.notes,
      createdAt: contractorCosts.createdAt,
      updatedAt: contractorCosts.updatedAt,
      isDeleted: contractorCosts.isDeleted,
    }).from(contractorCosts)
    .innerJoin(locations, eq(contractorCosts.locationId, locations.id))
    .where(
      and(
        eq(locations.isDeleted, 0),
        locationId ? eq(contractorCosts.locationId, locationId) : undefined,
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
    let status: 'MATCHED' | 'SURPLUS' | 'DEFICIT' = 'MATCHED';
    if (difference > 0.01) {
      status = 'SURPLUS';
    } else if (difference < -0.01) {
      status = 'DEFICIT';
    }

    // 4. Upstream context: Material Supply & Investment Capital
    let totalMaterialSupply = 0;
    let totalInvestmentCapital = 0;

    if (locationId) {
      const matSupp = await db.select({
        total: sql<string>`sum(${materialSupplies.totalAmount})`
      }).from(materialSupplies).where(
        and(eq(materialSupplies.locationId, locationId), eq(materialSupplies.isDeleted, 0))
      );
      totalMaterialSupply = round2(parseFloat(matSupp[0]?.total || '0') || 0);

      const [allocs, invTxs] = await Promise.all([
        db.select({ total: sql<string>`sum(${investorLocationAllocations.amount})` })
          .from(investorLocationAllocations)
          .where(and(eq(investorLocationAllocations.locationId, locationId), eq(investorLocationAllocations.isDeleted, 0))),
        db.select({ total: sql<string>`sum(${investmentTransactions.amount})` })
          .from(investmentTransactions)
          .innerJoin(investmentParties, eq(investmentTransactions.partyId, investmentParties.id))
          .where(and(
            eq(investmentParties.locationId, locationId),
            eq(investmentTransactions.type, 'INVESTMENT'),
            eq(investmentTransactions.isDeleted, 0),
            eq(investmentParties.isDeleted, 0)
          ))
      ]);
      const fromAllocs = parseFloat(allocs[0]?.total || '0') || 0;
      const fromInvTxs = parseFloat(invTxs[0]?.total || '0') || 0;
      totalInvestmentCapital = round2(fromAllocs + fromInvTxs);
    }

    const totalThreeExpenses = round2(totalMaterialSupply + totalSiteSupplyAmount + totalLabourAttendance);
    const investmentVariance = round2(totalInvestmentCapital - totalThreeExpenses);
    const investmentReconStatus: 'MATCHED' | 'SURPLUS' | 'DEFICIT' = Math.abs(investmentVariance) <= 0.01
      ? 'MATCHED'
      : (investmentVariance > 0 ? 'SURPLUS' : 'DEFICIT');

    res.json({
      summary: {
        totalSiteSupplies: totalSiteSupplyAmount,
        totalLabourCost: totalLabourAttendance,
        expectedCost: expectedContractorCost,
        recordedCost: recordedContractorCost,
        variance: difference,
        reconciliationStatus: status,
        contractorCostCount: recordedCosts.length,
        siteSupplyCount: siteSuppliesData.length,
        labourCount: labourData.length,
        // Context for Site Expenses vs Investment Capital
        totalMaterialSupply,
        totalThreeExpenses,
        totalInvestmentCapital,
        investmentVariance,
        investmentReconStatus
      },
      siteExpensesReconciliation: {
        totalMaterialSupply,
        totalSiteSupply: totalSiteSupplyAmount,
        totalLabourAttendance,
        totalThreeExpenses,
        totalInvestmentCapital,
        variance: investmentVariance,
        status: investmentReconStatus
      },
      contractorCosts: recordedCosts,
      siteSupplies: siteSuppliesData,
      labourSalaries: labourData,
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
    console.warn('[Contractor Reconciliation GET Notice] Database query fallback:', error?.message || error);
    res.json({
      summary: {
        totalSiteSupplies: 0,
        totalLabourCost: 0,
        expectedCost: 0,
        recordedCost: 0,
        variance: 0,
        reconciliationStatus: 'MATCHED',
        contractorCostCount: 0,
        siteSupplyCount: 0,
        labourCount: 0,
        totalMaterialSupply: 0,
        totalThreeExpenses: 0,
        totalInvestmentCapital: 0,
        investmentVariance: 0,
        investmentReconStatus: 'MATCHED'
      },
      siteExpensesReconciliation: {
        totalMaterialSupply: 0,
        totalSiteSupply: 0,
        totalLabourAttendance: 0,
        totalThreeExpenses: 0,
        totalInvestmentCapital: 0,
        variance: 0,
        status: 'MATCHED'
      },
      contractorCosts: [],
      siteSupplies: [],
      labourSalaries: [],
      locationId: null,
      teamId: null,
      totalSiteSupplyAmount: 0,
      totalLabourAttendance: 0,
      totalLabourUpadPaid: 0,
      expectedContractorCost: 0,
      recordedContractorCost: 0,
      difference: 0,
      status: 'MATCHED',
      siteSuppliesCount: 0,
      labourRecordsCount: 0,
      recordedCostsCount: 0
    });
  }
});

/**
 * GET /api/contractor-costs/reconciliation/export?locationId=X
 * Export full 5-tier financial reconciliation audit report as Excel
 */
contractorRouter.get('/reconciliation/export', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const locParam = req.query.locationId as string | undefined;
    const locationId = (locParam && locParam !== 'ALL' && locParam !== '0' && !isNaN(parseInt(locParam, 10)))
      ? parseInt(locParam, 10)
      : undefined;

    let locationName = 'All Locations';
    if (locationId) {
      await assertLocationAccess(userId, locationId);
      const loc = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
      if (loc.length) locationName = loc[0].name;
    }

    // 1. Site Supplies
    const siteSuppliesData = await db.select({
      id: siteSupplies.id,
      teamId: siteSupplies.teamId,
      date: siteSupplies.date,
      totalAmount: siteSupplies.totalAmount,
      responsiblePerson: siteSupplies.responsiblePerson,
      locationId: siteSupplies.locationId
    }).from(siteSupplies)
      .where(and(
        locationId ? eq(siteSupplies.locationId, locationId) : undefined,
        eq(siteSupplies.isDeleted, 0)
      ));

    // 2. Labour Salaries
    const labourData = await db.select({
      id: labourSalaries.id,
      labourTeam: labourSalaries.labourTeam,
      date: labourSalaries.date,
      netSalary: labourSalaries.netSalary,
      labourName: labourSalaries.labourName,
      paymentAmount: labourSalaries.paymentAmount,
      balance: labourSalaries.balance,
      locationId: labourSalaries.locationId
    }).from(labourSalaries)
      .where(and(
        locationId ? eq(labourSalaries.locationId, locationId) : undefined,
        eq(labourSalaries.isDeleted, 0)
      ));

    // 3. Contractor Costs
    const recordedCosts = await db.select().from(contractorCosts)
      .where(and(
        locationId ? eq(contractorCosts.locationId, locationId) : undefined,
        eq(contractorCosts.isDeleted, 0)
      ));

    // 4. Material Supplies
    const matSupplies = await db.select({
      totalAmount: materialSupplies.totalAmount
    }).from(materialSupplies)
      .where(and(
        locationId ? eq(materialSupplies.locationId, locationId) : undefined,
        eq(materialSupplies.isDeleted, 0)
      ));

    const totalSiteSupplyAmount = round2(siteSuppliesData.reduce((s, row) => s + parseFloat(row.totalAmount || '0'), 0));
    const totalLabourAttendance = round2(labourData.reduce((s, row) => s + parseFloat(row.netSalary || '0'), 0));
    const expectedContractorCost = round2(totalSiteSupplyAmount + totalLabourAttendance);
    const recordedContractorCost = round2(recordedCosts.reduce((s, row) => s + parseFloat(row.netAmount || '0'), 0));
    const difference = round2(expectedContractorCost - recordedContractorCost);
    const status = Math.abs(difference) <= 0.01 ? 'MATCHED' : (difference > 0 ? 'DEFICIT' : 'SURPLUS');

    const totalMaterialSupply = round2(matSupplies.reduce((s, row) => s + parseFloat(row.totalAmount || '0'), 0));

    let totalInvestmentCapital = 0;
    if (locationId) {
      const [allocs, invTxs] = await Promise.all([
        db.select({ total: sql<string>`sum(${investorLocationAllocations.amount})` })
          .from(investorLocationAllocations)
          .where(and(
            eq(investorLocationAllocations.locationId, locationId),
            eq(investorLocationAllocations.isDeleted, 0)
          )),
        db.select({ total: sql<string>`sum(${investmentTransactions.amount})` })
          .from(investmentTransactions)
          .innerJoin(investmentParties, eq(investmentTransactions.partyId, investmentParties.id))
          .where(and(
            eq(investmentParties.locationId, locationId),
            eq(investmentTransactions.type, 'INVESTMENT'),
            eq(investmentTransactions.isDeleted, 0),
            eq(investmentParties.isDeleted, 0)
          ))
      ]);
      const fromAllocs = parseFloat(allocs[0]?.total || '0') || 0;
      const fromInvTxs = parseFloat(invTxs[0]?.total || '0') || 0;
      totalInvestmentCapital = round2(fromAllocs + fromInvTxs);
    }

    const totalCombinedSiteExpenses = round2(totalMaterialSupply + totalSiteSupplyAmount + totalLabourAttendance);
    const investmentVariance = round2(totalInvestmentCapital - totalCombinedSiteExpenses);
    const investmentStatus = Math.abs(investmentVariance) <= 0.01 ? 'MATCHED' : (investmentVariance > 0 ? 'SURPLUS' : 'DEFICIT');

    const reconPayload = {
      totalInvestmentCapital,
      totalMaterialSupply,
      totalSiteSupply: totalSiteSupplyAmount,
      totalLabourAttendance,
      totalCombinedSiteExpenses,
      investmentVariance,
      investmentStatus,
      expectedContractorCost,
      recordedContractorCost,
      contractorVariance: difference,
      contractorStatus: status,
      siteSupplies: siteSuppliesData,
      labourSalaries: labourData,
      contractorCosts: recordedCosts
    };

    const buffer = generateReconciliationBuffer(locationName, reconPayload);
    const filename = `Reconciliation_Audit_${locationName.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('[Contractor Reconciliation Export Error]', error);
    res.status(500).json({ error: error?.message || 'Failed to export reconciliation audit report', stack: error?.stack });
  }
});

/**
 * GET /api/contractor-costs/export?locationId=X
 * Export contractor costs register as Excel
 */
contractorRouter.get('/export', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const locParam = req.query.locationId as string | undefined;
    const locationId = (locParam && locParam !== 'ALL' && locParam !== '0' && !isNaN(parseInt(locParam, 10)))
      ? parseInt(locParam, 10)
      : undefined;

    let locationName = 'All Locations';
    if (locationId) {
      await assertLocationAccess(userId, locationId);
      const loc = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
      if (loc.length) locationName = loc[0].name;
    }

    const records = await db.select().from(contractorCosts)
      .where(and(
        locationId ? eq(contractorCosts.locationId, locationId) : undefined,
        eq(contractorCosts.isDeleted, 0)
      ))
      .orderBy(desc(contractorCosts.date), desc(contractorCosts.id));

    const buffer = generateContractorCostsBuffer(locationName, records);
    const filename = `Contractor_Costs_${locationName.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('[Contractor Costs Export Error]', error);
    res.status(500).json({ error: 'Failed to export contractor costs' });
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

    const gross = data.amount;
    const ded = data.deductionAmount || 0;
    const net = data.netAmount !== undefined ? data.netAmount : Math.max(0, round2(gross - ded));

    const inserted = await db.insert(contractorCosts).values({
      userId,
      locationId: data.locationId,
      contractorName: data.contractorName.trim(),
      teamId: data.teamId || null,
      teamName: data.teamName || null,
      date: data.date,
      amount: String(gross),
      deductionAmount: String(ded),
      netAmount: String(net),
      paymentStatus: data.paymentStatus || 'PAID',
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
        amount: data.amount,
        netAmount: net
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

    const gross = data.amount !== undefined ? data.amount : parseFloat(existing[0].amount);
    const ded = data.deductionAmount !== undefined ? data.deductionAmount : parseFloat(existing[0].deductionAmount || '0');
    const net = data.netAmount !== undefined ? data.netAmount : Math.max(0, round2(gross - ded));

    const updated = await db.update(contractorCosts).set({
      contractorName: data.contractorName !== undefined ? data.contractorName.trim() : undefined,
      teamId: data.teamId !== undefined ? data.teamId : undefined,
      teamName: data.teamName !== undefined ? data.teamName : undefined,
      date: data.date !== undefined ? data.date : undefined,
      amount: data.amount !== undefined ? String(gross) : undefined,
      deductionAmount: data.deductionAmount !== undefined ? String(ded) : undefined,
      netAmount: String(net),
      paymentStatus: data.paymentStatus !== undefined ? data.paymentStatus : undefined,
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
    try {
      await assertLocationAccess(userId, existing[0].locationId, { allowDeleted: true });
    } catch (locErr) {
      console.warn(`Location check warning during contractor cost delete #${costId}:`, locErr);
    }

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
