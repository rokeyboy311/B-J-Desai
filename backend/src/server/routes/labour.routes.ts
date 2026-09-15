import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { labourSalaries, auditLogs, locations } from '../../db/schema.ts';
import { eq, and, desc, sql, ilike } from 'drizzle-orm';
import { z } from 'zod';
import { AccountingEngine } from '../../shared/accountingEngine.ts';

const labourRouter = Router();
labourRouter.use(requireAuth);

const salarySchema = z.object({
  locationId: z.number().int().positive(),
  businessId: z.number().int().positive().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  siteLocationName: z.string().optional().nullable(),
  labourId: z.string().optional().nullable(),
  labourName: z.string().min(1, 'Worker name is required'),
  labourTeam: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  periodFrom: z.string().optional().nullable(),
  periodTo: z.string().optional().nullable(),
  workType: z.enum(['DAY_WORK', 'TC_WORK']).default('DAY_WORK'),
  attendanceType: z.string().optional().nullable().default('Full-day'),
  tcNumber: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  days: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  dailyRate: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  tcQuantity: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  tcRate: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  dailyRateSnapshot: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  otherEarnings: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  deduction: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  upad: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  paymentAmount: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  paymentMethod: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET all labour wage records
labourRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const locationId = req.query.locationId ? parseInt(String(req.query.locationId), 10) : undefined;
    const businessId = req.query.businessId ? parseInt(String(req.query.businessId), 10) : undefined;
    const labourName = req.query.labourName ? String(req.query.labourName).trim() : undefined;
    const team = req.query.team ? String(req.query.team).trim() : undefined;
    const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

    const conditions = [
      eq(labourSalaries.userId, req.dbUser!.id),
      eq(labourSalaries.isDeleted, 0)
    ];

    if (locationId && !isNaN(locationId)) {
      conditions.push(eq(labourSalaries.locationId, locationId));
    }
    if (businessId && !isNaN(businessId)) {
      conditions.push(eq(labourSalaries.businessId, businessId));
    }
    if (labourName) {
      conditions.push(ilike(labourSalaries.labourName, `%${labourName}%`));
    }
    if (team) {
      conditions.push(eq(labourSalaries.labourTeam, team));
    }
    if (startDate) {
      conditions.push(sql`${labourSalaries.date} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${labourSalaries.date} <= ${endDate}`);
    }

    const records = await db.select().from(labourSalaries).where(
      and(...conditions)
    ).orderBy(desc(labourSalaries.date), desc(labourSalaries.id));
    
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch labour records' });
  }
});

// GET worker-level running ledger
labourRouter.get('/ledger/:labourName', async (req: AuthRequest, res: Response) => {
  try {
    const labourName = decodeURIComponent(String(req.params.labourName)).trim();
    if (!labourName) {
      return res.status(400).json({ error: 'Worker name is required' });
    }

    const records = await db.select().from(labourSalaries).where(
      and(
        eq(labourSalaries.userId, req.dbUser!.id),
        ilike(labourSalaries.labourName, labourName),
        eq(labourSalaries.isDeleted, 0)
      )
    ).orderBy(labourSalaries.date, labourSalaries.id);

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let totalUpad = 0;
    let totalPaid = 0;
    let runningBalance = 0;

    const statement = records.map((entry) => {
      const gross = parseFloat(entry.grossSalary || '0');
      const ded = parseFloat(entry.deduction || '0');
      const net = parseFloat(entry.netSalary || '0');
      const upad = parseFloat(entry.upad || '0');
      const paid = parseFloat(entry.paymentAmount || '0');
      const isVoid = entry.isVoid === 1;

      if (!isVoid) {
        totalGross += gross;
        totalDeductions += ded;
        totalNet += net;
        totalUpad += upad;
        totalPaid += paid;
        runningBalance += (net - upad - paid);
      }

      return {
        ...entry,
        runningBalance: Math.round(runningBalance * 100) / 100,
      };
    });

    res.json({
      labourName,
      totalRecords: records.length,
      summary: {
        totalGross: Math.round(totalGross * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
        totalUpad: Math.round(totalUpad * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        netOutstandingPayable: Math.round(runningBalance * 100) / 100,
      },
      transactions: statement,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate worker ledger' });
  }
});

// GET distinct worker teams & names
labourRouter.get('/meta/workers', async (req: AuthRequest, res: Response) => {
  try {
    const workerNames = await db
      .selectDistinct({ name: labourSalaries.labourName })
      .from(labourSalaries)
      .where(and(eq(labourSalaries.userId, req.dbUser!.id), eq(labourSalaries.isDeleted, 0)));

    const teams = await db
      .selectDistinct({ team: labourSalaries.labourTeam })
      .from(labourSalaries)
      .where(and(
        eq(labourSalaries.userId, req.dbUser!.id),
        eq(labourSalaries.isDeleted, 0),
        sql`${labourSalaries.labourTeam} IS NOT NULL AND ${labourSalaries.labourTeam} != ''`
      ));

    res.json({
      workers: workerNames.map(w => w.name).filter(Boolean),
      teams: teams.map(t => t.team).filter(Boolean),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch worker metadata' });
  }
});

// POST create labour salary record
labourRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = salarySchema.parse(req.body);

    // Resolve businessId if missing
    let resolvedBusinessId = data.businessId;
    if (!resolvedBusinessId) {
      const [loc] = await db
        .select({ businessId: locations.businessId })
        .from(locations)
        .where(eq(locations.id, data.locationId));
      if (loc?.businessId) {
        resolvedBusinessId = loc.businessId;
      }
    }

    // Deterministic calculation using AccountingEngine
    const calc = AccountingEngine.calculateLabourSalary({
      workType: data.workType,
      attendanceType: data.attendanceType || undefined,
      days: data.days,
      dailyRate: data.dailyRate,
      tcQuantity: data.tcQuantity,
      tcRate: data.tcRate,
      otherEarnings: data.otherEarnings,
      deduction: data.deduction,
      upad: data.upad,
      paymentAmount: data.paymentAmount,
    });

    const [newRecord] = await db.insert(labourSalaries).values({
      userId: req.dbUser!.id,
      locationId: data.locationId,
      businessId: resolvedBusinessId,
      date: data.date,
      siteLocationName: data.siteLocationName,
      labourId: data.labourId,
      labourName: data.labourName.trim(),
      labourTeam: data.labourTeam,
      address: data.address,
      periodFrom: data.periodFrom,
      periodTo: data.periodTo,
      workType: data.workType,
      attendanceType: data.attendanceType || 'Full-day',
      tcNumber: data.tcNumber,
      description: data.description,
      days: data.days.toString(),
      dailyRate: data.dailyRate.toString(),
      tcQuantity: data.tcQuantity.toString(),
      tcRate: data.tcRate.toString(),
      dailyRateSnapshot: (data.dailyRateSnapshot || data.dailyRate).toString(),
      otherEarnings: data.otherEarnings.toString(),
      grossSalary: calc.grossSalary.toString(),
      deduction: data.deduction.toString(),
      netSalary: calc.netSalary.toString(),
      upad: data.upad.toString(),
      paymentAmount: data.paymentAmount.toString(),
      balance: calc.balance.toString(),
      outstandingAmount: calc.balance.toString(),
      paymentMethod: data.paymentMethod,
      referenceNumber: data.referenceNumber,
      notes: data.notes,
    }).returning();

    // Audit log
    await db.insert(auditLogs).values({
      userId: req.dbUser!.id,
      businessId: resolvedBusinessId,
      locationId: data.locationId,
      action: 'CREATE',
      entityType: 'LABOUR',
      entityId: newRecord.id,
      afterState: JSON.stringify(newRecord),
    });

    res.status(201).json(newRecord);
  } catch (error: any) {
    if (error?.errors) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: error.message || 'Failed to create labour record' });
  }
});

// PUT update labour salary record
labourRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Valid id required' });
    const data = salarySchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(labourSalaries)
      .where(and(eq(labourSalaries.id, id), eq(labourSalaries.userId, req.dbUser!.id)));

    if (!existing) return res.status(404).json({ error: 'Labour record not found' });
    if (existing.isVoid === 1) {
      return res.status(400).json({ error: 'Cannot modify a voided labour record' });
    }

    const calc = AccountingEngine.calculateLabourSalary({
      workType: data.workType,
      attendanceType: data.attendanceType || undefined,
      days: data.days,
      dailyRate: data.dailyRate,
      tcQuantity: data.tcQuantity,
      tcRate: data.tcRate,
      otherEarnings: data.otherEarnings,
      deduction: data.deduction,
      upad: data.upad,
      paymentAmount: data.paymentAmount,
    });

    const [updated] = await db.update(labourSalaries).set({
      locationId: data.locationId,
      businessId: data.businessId || existing.businessId,
      date: data.date,
      siteLocationName: data.siteLocationName,
      labourId: data.labourId,
      labourName: data.labourName.trim(),
      labourTeam: data.labourTeam,
      address: data.address,
      periodFrom: data.periodFrom,
      periodTo: data.periodTo,
      workType: data.workType,
      attendanceType: data.attendanceType || 'Full-day',
      tcNumber: data.tcNumber,
      description: data.description,
      days: data.days.toString(),
      dailyRate: data.dailyRate.toString(),
      tcQuantity: data.tcQuantity.toString(),
      tcRate: data.tcRate.toString(),
      dailyRateSnapshot: (data.dailyRateSnapshot || data.dailyRate).toString(),
      otherEarnings: data.otherEarnings.toString(),
      grossSalary: calc.grossSalary.toString(),
      deduction: data.deduction.toString(),
      netSalary: calc.netSalary.toString(),
      upad: data.upad.toString(),
      paymentAmount: data.paymentAmount.toString(),
      balance: calc.balance.toString(),
      outstandingAmount: calc.balance.toString(),
      paymentMethod: data.paymentMethod,
      referenceNumber: data.referenceNumber,
      notes: data.notes,
    }).where(and(eq(labourSalaries.id, id), eq(labourSalaries.userId, req.dbUser!.id))).returning();

    // Audit log
    await db.insert(auditLogs).values({
      userId: req.dbUser!.id,
      businessId: updated.businessId,
      locationId: updated.locationId,
      action: 'UPDATE',
      entityType: 'LABOUR',
      entityId: id,
      beforeState: JSON.stringify(existing),
      afterState: JSON.stringify(updated),
    });

    res.json(updated);
  } catch (error: any) {
    if (error?.errors) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: error.message || 'Failed to update record' });
  }
});

// POST void labour record (reversal)
labourRouter.post('/:id/void', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Valid id required' });
    const { reason } = req.body;

    const [existing] = await db
      .select()
      .from(labourSalaries)
      .where(and(eq(labourSalaries.id, id), eq(labourSalaries.userId, req.dbUser!.id)));

    if (!existing) return res.status(404).json({ error: 'Record not found' });
    if (existing.isVoid === 1) return res.status(400).json({ error: 'Record is already voided' });

    const [voided] = await db.update(labourSalaries).set({
      isVoid: 1,
      voidReason: reason || 'Voided by user',
    }).where(eq(labourSalaries.id, id)).returning();

    // Audit log
    await db.insert(auditLogs).values({
      userId: req.dbUser!.id,
      businessId: voided.businessId,
      locationId: voided.locationId,
      action: 'VOID',
      entityType: 'LABOUR',
      entityId: id,
      metadata: JSON.stringify({ reason: reason || 'Voided by user' }),
      beforeState: JSON.stringify(existing),
      afterState: JSON.stringify(voided),
    });

    res.json({ success: true, message: 'Labour record voided successfully', record: voided });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to void record' });
  }
});

// DELETE soft delete labour record
labourRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Valid id required' });
    
    const [existing] = await db
      .select()
      .from(labourSalaries)
      .where(and(eq(labourSalaries.id, id), eq(labourSalaries.userId, req.dbUser!.id)));

    if (!existing) return res.status(404).json({ error: 'Record not found' });

    await db.update(labourSalaries).set({ isDeleted: 1 })
      .where(and(eq(labourSalaries.id, id), eq(labourSalaries.userId, req.dbUser!.id)));

    // Audit log
    await db.insert(auditLogs).values({
      userId: req.dbUser!.id,
      businessId: existing.businessId,
      locationId: existing.locationId,
      action: 'DELETE',
      entityType: 'LABOUR',
      entityId: id,
      beforeState: JSON.stringify(existing),
    });

    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete record' });
  }
});

export default labourRouter;
