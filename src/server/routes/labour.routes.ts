import { Router, type Response } from 'express';
import { db } from '../../db/index.ts';
import { labourSalaries, auditLogs, locations } from '../../db/schema.ts';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, type AuthRequest } from '../middleware/auth.ts';
import { assertLocationAccess } from '../lib/locationAuth.ts';
import { calculateLabourSalaryTotals } from '../lib/accounting.ts';

const labourRouter = Router();
labourRouter.use(requireAuth);

function transformLabourRecord(r: any) {
  if (!r) return r;
  const attUpper = String(r.attendanceType || '').toUpperCase();
  const isWork = attUpper.includes('WORK') || attUpper.includes('TC') || attUpper === 'TC_WISE';
  const isUpad = attUpper.includes('UPAD') || attUpper === 'TEAM_UPAD';
  const isKharch = attUpper.includes('KHARCH') || attUpper === 'OTHER_KHARCH' || attUpper === 'EXPENSE';

  const amount = isUpad
    ? (parseFloat(r.upad || '0') || parseFloat(r.paymentAmount || '0') || 0)
    : isKharch
    ? (parseFloat(r.paymentAmount || '0') || parseFloat(r.grossSalary || '0') || 0)
    : (parseFloat(r.grossSalary || '0') || parseFloat(r.netSalary || '0') || 0);

  return {
    ...r,
    amount: amount.toString(),
    quantity: r.tcQuantity,
    workQuantity: r.tcQuantity,
    rate: r.tcRate || r.dailyRate,
    workRate: r.tcRate,
    workName: r.workType || r.tcNumber,
    isWorkWise: isWork,
    isTeamUpad: isUpad,
    isOtherKharch: isKharch,
    teamName: r.labourTeam || r.labourName
  };
}

labourRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const locationId = req.query.locationId;
    const conditions = [eq(labourSalaries.isDeleted, 0), eq(locations.isDeleted, 0)];
    if (locationId && locationId !== 'ALL' && locationId !== '0') {
      const locId = parseInt(String(locationId), 10);
      if (!isNaN(locId)) {
        await assertLocationAccess(userId, locId);
        conditions.push(eq(labourSalaries.locationId, locId));
      }
    }
    const records = await db.select({
      id: labourSalaries.id,
      locationId: labourSalaries.locationId,
      userId: labourSalaries.userId,
      date: labourSalaries.date,
      siteLocationName: labourSalaries.siteLocationName,
      labourName: labourSalaries.labourName,
      labourTeam: labourSalaries.labourTeam,
      attendanceType: labourSalaries.attendanceType,
      tcNumber: labourSalaries.tcNumber,
      description: labourSalaries.description,
      days: labourSalaries.days,
      dailyRate: labourSalaries.dailyRate,
      otherEarnings: labourSalaries.otherEarnings,
      grossSalary: labourSalaries.grossSalary,
      deduction: labourSalaries.deduction,
      netSalary: labourSalaries.netSalary,
      upad: labourSalaries.upad,
      paymentAmount: labourSalaries.paymentAmount,
      balance: labourSalaries.balance,
      paymentMethod: labourSalaries.paymentMethod,
      referenceNumber: labourSalaries.referenceNumber,
      notes: labourSalaries.notes,
      createdAt: labourSalaries.createdAt,
      isDeleted: labourSalaries.isDeleted,
      tcQuantity: labourSalaries.tcQuantity,
      tcRate: labourSalaries.tcRate,
      workType: labourSalaries.workType,
      unitOfMeasurement: labourSalaries.unitOfMeasurement,
      address: labourSalaries.address,
      periodFrom: labourSalaries.periodFrom,
      periodTo: labourSalaries.periodTo,
    }).from(labourSalaries)
      .innerJoin(locations, eq(labourSalaries.locationId, locations.id))
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
    const labourTeam = data.teamName ? String(data.teamName).trim() : (data.labourTeam ? String(data.labourTeam).trim() : 'General Team');
    const labourName = String(data.labourName || labourTeam || 'Team');
    const siteLocationName = data.siteLocationName ? String(data.siteLocationName) : '';

    const rawAttType = String(data.attendanceType || 'Day Wise');
    const attUpper = rawAttType.toUpperCase();
    const isTeamUpad = attUpper.includes('UPAD') || attUpper === 'TEAM_UPAD';
    const isOtherKharch = attUpper.includes('KHARCH') || attUpper === 'OTHER_KHARCH' || attUpper === 'EXPENSE';
    const isWorkWise = attUpper.includes('WORK') || attUpper.includes('TC') || attUpper === 'TC_WISE';

    let attendanceType = rawAttType;
    if (isTeamUpad) attendanceType = 'TEAM_UPAD';
    else if (isOtherKharch) attendanceType = 'OTHER_KHARCH';
    else if (isWorkWise) attendanceType = 'TC_WISE';
    else attendanceType = 'DAY_WISE';

    const days = data.days !== undefined ? String(data.days) : (rawAttType === 'Half Day' ? '0.5' : '1');
    const dailyRate = String(data.dailyRate || data.rate || '0');
    const workName = data.workName || data.workType || data.expenseCategory || data.category || (isOtherKharch ? 'Site Expense' : data.notes || '');
    const unitOfMeasurement = data.unitOfMeasurement || (isWorkWise ? 'Nos' : null);
    const quantity = data.quantity ? String(data.quantity) : (data.tcQuantity ? String(data.tcQuantity) : '0');
    const rate = data.rate ? String(data.rate) : (data.tcRate ? String(data.tcRate) : dailyRate);
    const amount = data.amount || data.upad || data.paymentAmount || '0';

    const calc = calculateLabourSalaryTotals({
      attendanceType,
      days: isWorkWise ? '0' : days,
      dailyRate: isWorkWise ? '0' : dailyRate,
      quantity,
      rate,
      tcQuantity: quantity,
      tcRate: rate,
      amount,
      upad: isTeamUpad ? amount : data.upad,
      paymentAmount: isTeamUpad || isOtherKharch ? amount : data.paymentAmount,
      deduction: data.deduction
    });

    const result = await db.insert(labourSalaries).values({
      userId,
      locationId,
      labourMasterId: data.labourMasterId ? parseInt(String(data.labourMasterId), 10) : null,
      labourName,
      labourTeam,
      siteLocationName,
      date,
      attendanceType,
      workType: isWorkWise || isOtherKharch ? workName : null,
      unitOfMeasurement,
      days: (isWorkWise || isTeamUpad || isOtherKharch) ? '0' : days,
      dailyRate: (isWorkWise || isTeamUpad || isOtherKharch) ? '0' : dailyRate,
      tcQuantity: isWorkWise ? quantity : '0',
      tcRate: isWorkWise ? rate : '0',
      tcNumber: isWorkWise ? workName : (data.referenceNumber || null),
      grossSalary: calc.grossSalary.toString(),
      upad: calc.upad.toString(),
      deduction: calc.deduction.toString(),
      paymentAmount: calc.paymentAmount.toString(),
      netSalary: calc.netSalary.toString(),
      balance: calc.balance.toString(),
      paymentMethod: data.paymentMethod || (isTeamUpad || isOtherKharch ? 'Cash' : null),
      referenceNumber: data.referenceNumber || null,
      notes: data.notes || (isWorkWise ? `${workName} (${quantity} ${unitOfMeasurement || 'Nos'})` : null),
    }).returning();

    await db.insert(auditLogs).values({
      userId,
      action: isTeamUpad ? 'CREATE_TEAM_UPAD' : isOtherKharch ? 'CREATE_OTHER_KHARCH' : 'CREATE_LABOUR_ATTENDANCE',
      entityType: 'LABOUR_ATTENDANCE',
      entityId: result[0].id,
      metadata: JSON.stringify({ teamName: labourTeam, attendanceType, amount: calc.grossSalary || calc.upad, date })
    });

    res.json(transformLabourRecord(result[0]));
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Create labour attendance error:', error);
    res.status(500).json({ error: 'Failed to record entry' });
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
    const rawAttType = String(data.attendanceType || existing[0].attendanceType || 'Day Wise');
    const attUpper = rawAttType.toUpperCase();
    const isTeamUpad = attUpper.includes('UPAD') || attUpper === 'TEAM_UPAD';
    const isOtherKharch = attUpper.includes('KHARCH') || attUpper === 'OTHER_KHARCH' || attUpper === 'EXPENSE';
    const isWorkWise = attUpper.includes('WORK') || attUpper.includes('TC') || attUpper === 'TC_WISE';

    let attendanceType = rawAttType;
    if (isTeamUpad) attendanceType = 'TEAM_UPAD';
    else if (isOtherKharch) attendanceType = 'OTHER_KHARCH';
    else if (isWorkWise) attendanceType = 'TC_WISE';
    else attendanceType = 'DAY_WISE';

    const labourTeam = data.teamName ? String(data.teamName).trim() : (data.labourTeam ? String(data.labourTeam).trim() : existing[0].labourTeam);
    const labourName = String(data.labourName || labourTeam || existing[0].labourName || 'Team');
    const workName = data.workName || data.workType || data.expenseCategory || data.category || (isOtherKharch ? 'Site Expense' : data.notes || existing[0].workType || '');
    const unitOfMeasurement = data.unitOfMeasurement || (isWorkWise ? (existing[0].unitOfMeasurement || 'Nos') : null);
    const quantity = data.quantity ? String(data.quantity) : (data.tcQuantity ? String(data.tcQuantity) : (existing[0].tcQuantity || '0'));
    const rate = data.rate ? String(data.rate) : (data.tcRate ? String(data.tcRate) : (data.dailyRate || existing[0].dailyRate || '0'));
    const days = data.days !== undefined ? String(data.days) : (rawAttType === 'Half Day' ? '0.5' : (existing[0].days || '1'));
    const dailyRate = String(data.dailyRate || existing[0].dailyRate || '0');
    const amount = data.amount || data.upad || data.paymentAmount || existing[0].paymentAmount || '0';

    const calc = calculateLabourSalaryTotals({
      attendanceType,
      days: isWorkWise ? '0' : days,
      dailyRate: isWorkWise ? '0' : dailyRate,
      quantity,
      rate,
      tcQuantity: quantity,
      tcRate: rate,
      amount,
      upad: isTeamUpad ? amount : (data.upad ?? existing[0].upad),
      paymentAmount: isTeamUpad || isOtherKharch ? amount : (data.paymentAmount ?? existing[0].paymentAmount),
      deduction: data.deduction ?? existing[0].deduction
    });

    const updatePayload: any = {
      date: data.date || existing[0].date,
      attendanceType,
      siteLocationName: data.siteLocationName !== undefined ? String(data.siteLocationName) : existing[0].siteLocationName,
      labourName,
      labourTeam,
      workType: isWorkWise || isOtherKharch ? workName : null,
      unitOfMeasurement,
      days: (isWorkWise || isTeamUpad || isOtherKharch) ? '0' : days,
      dailyRate: (isWorkWise || isTeamUpad || isOtherKharch) ? '0' : dailyRate,
      tcQuantity: isWorkWise ? quantity : '0',
      tcRate: isWorkWise ? rate : '0',
      tcNumber: isWorkWise ? workName : (data.referenceNumber || existing[0].referenceNumber),
      grossSalary: calc.grossSalary.toString(),
      upad: calc.upad.toString(),
      deduction: calc.deduction.toString(),
      paymentAmount: calc.paymentAmount.toString(),
      netSalary: calc.netSalary.toString(),
      balance: calc.balance.toString(),
      paymentMethod: data.paymentMethod !== undefined ? data.paymentMethod : existing[0].paymentMethod,
      referenceNumber: data.referenceNumber !== undefined ? data.referenceNumber : existing[0].referenceNumber,
      notes: data.notes !== undefined ? data.notes : existing[0].notes,
    };

    const result = await db.update(labourSalaries)
      .set(updatePayload)
      .where(and(eq(labourSalaries.id, id), eq(labourSalaries.isDeleted, 0)))
      .returning();

    res.json(transformLabourRecord(result[0]));
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Update labour record error:', error);
    res.status(500).json({ error: 'Failed to update entry' });
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
      try {
        await assertLocationAccess(userId, existing[0].locationId, { allowDeleted: true });
      } catch (locErr) {
        console.warn(`Location check warning during labour salary delete #${id}:`, locErr);
      }
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
