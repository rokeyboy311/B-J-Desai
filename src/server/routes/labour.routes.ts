import { Router, Response } from 'express';
import { db } from '../../db/index.js';
import { labourSalaries, auditLogs } from '../../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { assertLocationAccess } from '../lib/locationAuth.js';
import { calculateLabourSalaryTotals } from '../lib/accounting.js';

const labourRouter = Router();
labourRouter.use(requireAuth);

function transformLabourRecord(r: any) {
  if (!r) return r;
  const isWork = String(r.attendanceType || '').toUpperCase().includes('WORK') || String(r.attendanceType || '').toUpperCase() === 'TC';
  return {
    ...r,
    quantity: r.tcQuantity,
    workQuantity: r.tcQuantity,
    rate: r.tcRate,
    workRate: r.tcRate,
    workName: r.workType || r.tcNumber,
    isWorkWise: isWork
  };
}

labourRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const locationId = req.query.locationId;
    const conditions = [eq(labourSalaries.isDeleted, 0)];
    if (locationId) {
      const locId = parseInt(String(locationId), 10);
      await assertLocationAccess(userId, locId);
      conditions.push(eq(labourSalaries.locationId, locId));
    }
    const records = await db.select().from(labourSalaries)
      .where(and(...conditions))
      .orderBy(desc(labourSalaries.date), desc(labourSalaries.id));
    res.json(records.map(transformLabourRecord));
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Fetch labour records error:', error);
    res.status(500).json({ error: 'Failed to fetch labour records' });
  }
});

labourRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const data = req.body;
    const locationId = parseInt(String(data.locationId), 10);
    if (!locationId || isNaN(locationId)) return res.status(400).json({ error: 'locationId is required' });
    await assertLocationAccess(userId, locationId);

    const date = String(data.date || new Date().toISOString().split('T')[0]);
    const labourMasterId = data.labourMasterId ? parseInt(String(data.labourMasterId), 10) : null;
    const labourName = String(data.labourName || 'Unknown');
    const labourTeam = data.labourTeam ? String(data.labourTeam) : (data.teamName ? String(data.teamName) : null);
    const siteLocationName = data.siteLocationName ? String(data.siteLocationName) : '';

    const attendanceType = String(data.attendanceType || 'Full Day');
    const days = data.days !== undefined ? String(data.days) : (attendanceType === 'Half Day' ? '0.5' : '1');
    const dailyRate = String(data.dailyRate || data.rate || '0');

    // Work-wise fields
    const isWorkWise = attendanceType.includes('Work') || attendanceType.toUpperCase() === 'TC';
    const workName = data.workName ? String(data.workName) : (data.notes || '');
    const unitOfMeasurement = data.unitOfMeasurement ? String(data.unitOfMeasurement) : (isWorkWise ? 'Nos' : null);
    const quantity = data.quantity ? String(data.quantity) : (data.tcQuantity ? String(data.tcQuantity) : '0');
    const rate = data.rate ? String(data.rate) : (data.tcRate ? String(data.tcRate) : dailyRate);

    const calc = calculateLabourSalaryTotals({
      attendanceType,
      days: isWorkWise ? '0' : days,
      dailyRate: isWorkWise ? '0' : dailyRate,
      quantity,
      rate,
      tcQuantity: quantity,
      tcRate: rate,
      deduction: data.deduction,
      upad: data.upad,
      paymentAmount: data.paymentAmount
    });

    const result = await db.insert(labourSalaries).values({
      userId,
      locationId,
      labourMasterId,
      labourName,
      labourTeam,
      siteLocationName,
      date,
      attendanceType,
      workType: isWorkWise ? workName : null,
      unitOfMeasurement,
      days: isWorkWise ? '0' : days,
      dailyRate: isWorkWise ? '0' : dailyRate,
      tcQuantity: isWorkWise ? quantity : '0',
      tcRate: isWorkWise ? rate : '0',
      tcNumber: workName,
      grossSalary: calc.grossSalary.toString(),
      upad: calc.upad.toString(),
      deduction: calc.deduction.toString(),
      paymentAmount: calc.paymentAmount.toString(),
      netSalary: calc.netSalary.toString(),
      balance: calc.balance.toString(),
      notes: isWorkWise ? `${workName} (${quantity} ${unitOfMeasurement || 'Nos'})` : (data.notes || null),
    }).returning();

    await db.insert(auditLogs).values({
      userId,
      action: 'CREATE_LABOUR_ATTENDANCE',
      entityType: 'LABOUR_ATTENDANCE',
      entityId: result[0].id,
      metadata: JSON.stringify({ labourName, attendanceType, grossSalary: calc.grossSalary, siteLocationName })
    });

    res.json(transformLabourRecord(result[0]));
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Create labour attendance error:', error);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

labourRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const rawId = req.params.id;
    const id = parseInt(Array.isArray(rawId) ? rawId[0] : rawId, 10);
    const existing = await db.select().from(labourSalaries).where(and(eq(labourSalaries.id, id), eq(labourSalaries.isDeleted, 0))).limit(1);
    if (!existing.length) return res.status(404).json({ error: 'Labour record not found' });
    await assertLocationAccess(userId, existing[0].locationId);

    const data = req.body;
    const attendanceType = String(data.attendanceType || 'Full Day');
    const isWorkWise = attendanceType.includes('Work') || attendanceType.toUpperCase() === 'TC';
    const workName = data.workName ? String(data.workName) : (data.notes || '');
    const unitOfMeasurement = data.unitOfMeasurement ? String(data.unitOfMeasurement) : (isWorkWise ? 'Nos' : null);
    const quantity = data.quantity ? String(data.quantity) : (data.tcQuantity ? String(data.tcQuantity) : '0');
    const rate = data.rate ? String(data.rate) : (data.tcRate ? String(data.tcRate) : (data.dailyRate || '0'));
    const days = data.days !== undefined ? String(data.days) : (attendanceType === 'Half Day' ? '0.5' : '1');
    const dailyRate = String(data.dailyRate || '0');

    const calc = calculateLabourSalaryTotals({
      attendanceType,
      days: isWorkWise ? '0' : days,
      dailyRate: isWorkWise ? '0' : dailyRate,
      quantity,
      rate,
      tcQuantity: quantity,
      tcRate: rate,
      deduction: data.deduction,
      upad: data.upad,
      paymentAmount: data.paymentAmount
    });

    const updatePayload: any = {
      date: data.date,
      attendanceType,
      siteLocationName: data.siteLocationName ? String(data.siteLocationName) : '',
      workType: isWorkWise ? workName : null,
      unitOfMeasurement,
      days: isWorkWise ? '0' : days,
      dailyRate: isWorkWise ? '0' : dailyRate,
      tcQuantity: isWorkWise ? quantity : '0',
      tcRate: isWorkWise ? rate : '0',
      tcNumber: workName,
      grossSalary: calc.grossSalary.toString(),
      upad: calc.upad.toString(),
      deduction: calc.deduction.toString(),
      paymentAmount: calc.paymentAmount.toString(),
      netSalary: calc.netSalary.toString(),
      balance: calc.balance.toString(),
      notes: isWorkWise ? `${workName} (${quantity} ${unitOfMeasurement || 'Nos'})` : (data.notes || null),
    };

    if (data.labourName) updatePayload.labourName = data.labourName;
    if (data.labourTeam || data.teamName) updatePayload.labourTeam = data.labourTeam || data.teamName;
    if (data.labourMasterId) updatePayload.labourMasterId = parseInt(String(data.labourMasterId), 10);

    const result = await db.update(labourSalaries)
      .set(updatePayload)
      .where(and(eq(labourSalaries.id, id), eq(labourSalaries.isDeleted, 0)))
      .returning();

    res.json(transformLabourRecord(result[0]));
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Update labour record error:', error);
    res.status(500).json({ error: 'Failed to update attendance' });
  }
});

labourRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const rawId = req.params.id;
    const id = parseInt(Array.isArray(rawId) ? rawId[0] : rawId, 10);

    const existing = await db.select().from(labourSalaries).where(eq(labourSalaries.id, id)).limit(1);
    if (existing.length) {
      await assertLocationAccess(userId, existing[0].locationId);
    }

    await db.update(labourSalaries)
      .set({ isDeleted: 1 })
      .where(eq(labourSalaries.id, id));
    res.json({ success: true });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Delete labour record error:', error);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

export default labourRouter;
