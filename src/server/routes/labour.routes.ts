import { Router, Response } from 'express';
import { db } from '../../db/index.js';
import { labourSalaries, auditLogs } from '../../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const labourRouter = Router();
labourRouter.use(requireAuth);

labourRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const locationId = req.query.locationId;
    const conditions = [eq(labourSalaries.isDeleted, 0)];
    if (locationId) {
      conditions.push(eq(labourSalaries.locationId, parseInt(String(locationId), 10)));
    }
    const records = await db.select().from(labourSalaries)
      .where(and(...conditions))
      .orderBy(desc(labourSalaries.date), desc(labourSalaries.id));
    res.json(records);
  } catch (error) {
    console.error('Fetch labour records error:', error);
    res.status(500).json({ error: 'Failed to fetch labour records' });
  }
});

labourRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = req.body;
    const userId = req.dbUser?.id || 1;
    const locationId = parseInt(String(data.locationId), 10);
    const date = String(data.date || new Date().toISOString().split('T')[0]);
    const labourMasterId = data.labourMasterId ? parseInt(String(data.labourMasterId), 10) : null;
    const labourName = String(data.labourName || 'Unknown');
    const labourTeam = data.labourTeam ? String(data.labourTeam) : (data.teamName ? String(data.teamName) : null);
    const siteLocationName = data.siteLocationName ? String(data.siteLocationName) : '';

    const attendanceType = String(data.attendanceType || 'Full Day');
    const days = data.days !== undefined ? String(data.days) : (attendanceType === 'Half Day' ? '0.5' : '1');
    const dailyRate = String(data.dailyRate || data.rate || '0');

    // Work-wise fields
    const isWorkWise = attendanceType.includes('Work');
    const workName = data.workName ? String(data.workName) : (data.notes || '');
    const unitOfMeasurement = data.unitOfMeasurement ? String(data.unitOfMeasurement) : (isWorkWise ? 'Nos' : null);
    const quantity = data.quantity ? String(data.quantity) : (data.tcQuantity ? String(data.tcQuantity) : '0');
    const rate = data.rate ? String(data.rate) : (data.tcRate ? String(data.tcRate) : dailyRate);

    let grossSalary = 0;
    if (isWorkWise) {
      grossSalary = Math.round(parseFloat(quantity) * parseFloat(rate) * 100) / 100;
    } else {
      grossSalary = Math.round(parseFloat(days) * parseFloat(dailyRate) * 100) / 100;
    }

    const upad = String(data.upad || '0');
    const paymentAmount = String(data.paymentAmount || '0');
    const deduction = String(data.deduction || '0');
    const netSalary = (grossSalary - parseFloat(deduction)).toFixed(2);
    const balance = (parseFloat(netSalary) - parseFloat(upad) - parseFloat(paymentAmount)).toFixed(2);

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
      grossSalary: grossSalary.toString(),
      upad,
      deduction,
      paymentAmount,
      netSalary,
      balance,
      notes: isWorkWise ? `${workName} (${quantity} ${unitOfMeasurement || 'Nos'})` : (data.notes || null),
    }).returning();

    await db.insert(auditLogs).values({
      userId,
      action: 'CREATE_LABOUR_ATTENDANCE',
      entityType: 'LABOUR_ATTENDANCE',
      entityId: result[0].id,
      metadata: JSON.stringify({ labourName, attendanceType, grossSalary, siteLocationName })
    });

    res.json(result[0]);
  } catch (error) {
    console.error('Create labour attendance error:', error);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

labourRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = parseInt(Array.isArray(rawId) ? rawId[0] : rawId, 10);
    const data = req.body;
    const attendanceType = String(data.attendanceType || 'Full Day');
    const isWorkWise = attendanceType.includes('Work');
    const workName = data.workName ? String(data.workName) : (data.notes || '');
    const unitOfMeasurement = data.unitOfMeasurement ? String(data.unitOfMeasurement) : (isWorkWise ? 'Nos' : null);
    const quantity = data.quantity ? String(data.quantity) : (data.tcQuantity ? String(data.tcQuantity) : '0');
    const rate = data.rate ? String(data.rate) : (data.tcRate ? String(data.tcRate) : (data.dailyRate || '0'));
    const days = data.days !== undefined ? String(data.days) : (attendanceType === 'Half Day' ? '0.5' : '1');
    const dailyRate = String(data.dailyRate || '0');

    let grossSalary = 0;
    if (isWorkWise) {
      grossSalary = Math.round(parseFloat(quantity) * parseFloat(rate) * 100) / 100;
    } else {
      grossSalary = Math.round(parseFloat(days) * parseFloat(dailyRate) * 100) / 100;
    }

    const upad = String(data.upad || '0');
    const paymentAmount = String(data.paymentAmount || '0');
    const deduction = String(data.deduction || '0');
    const netSalary = (grossSalary - parseFloat(deduction)).toFixed(2);
    const balance = (parseFloat(netSalary) - parseFloat(upad) - parseFloat(paymentAmount)).toFixed(2);

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
      grossSalary: grossSalary.toString(),
      upad,
      deduction,
      paymentAmount,
      netSalary,
      balance,
      notes: isWorkWise ? `${workName} (${quantity} ${unitOfMeasurement || 'Nos'})` : (data.notes || null),
    };

    if (data.labourName) updatePayload.labourName = data.labourName;
    if (data.labourTeam || data.teamName) updatePayload.labourTeam = data.labourTeam || data.teamName;
    if (data.labourMasterId) updatePayload.labourMasterId = parseInt(String(data.labourMasterId), 10);

    const result = await db.update(labourSalaries)
      .set(updatePayload)
      .where(and(eq(labourSalaries.id, id), eq(labourSalaries.isDeleted, 0)))
      .returning();

    res.json(result[0]);
  } catch (error) {
    console.error('Update labour record error:', error);
    res.status(500).json({ error: 'Failed to update attendance' });
  }
});

labourRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = parseInt(Array.isArray(rawId) ? rawId[0] : rawId, 10);
    await db.update(labourSalaries)
      .set({ isDeleted: 1 })
      .where(eq(labourSalaries.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error('Delete labour record error:', error);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

export default labourRouter;
