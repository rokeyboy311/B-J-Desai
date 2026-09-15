import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from './index.ts';
import { records, auditLogs, locations, refunds } from './schema.ts';
import { AccountingEngine, DecimalMath } from '../shared/accountingEngine.ts';

export async function getAllRecords(userId: number, filters?: { 
  businessId?: number; 
  locationId?: number; 
  startDate?: string; 
  endDate?: string; 
  type?: 'INCOME' | 'EXPENSE' 
}) {
  const conditions = [
    eq(records.userId, userId),
    eq(records.isDeleted, 0),
    eq(records.isVoid, 0),
  ];

  if (filters?.businessId) conditions.push(eq(records.businessId, filters.businessId));
  if (filters?.locationId) conditions.push(eq(records.locationId, filters.locationId));
  if (filters?.startDate) conditions.push(gte(records.date, filters.startDate));
  if (filters?.endDate) conditions.push(lte(records.date, filters.endDate));
  if (filters?.type) conditions.push(eq(records.type, filters.type));

  return await db.select({
    id: records.id,
    businessId: records.businessId,
    locationId: records.locationId,
    locationName: locations.name,
    type: records.type,
    amount: records.amount,
    date: records.date,
    time: records.time,
    partyName: records.partyName,
    teamName: records.teamName,
    category: records.category,
    description: records.description,
    paymentMethod: records.paymentMethod,
    referenceNumber: records.referenceNumber,
    notes: records.notes,
    taxableAmount: records.taxableAmount,
    gstRate: records.gstRate,
    gstAmount: records.gstAmount,
    refundableAmount: records.refundableAmount,
    refundedAmount: records.refundedAmount,
    refundStatus: records.refundStatus,
    isVoid: records.isVoid,
    createdAt: records.createdAt,
  })
  .from(records)
  .leftJoin(locations, eq(records.locationId, locations.id))
  .where(and(...conditions))
  .orderBy(desc(records.date), desc(records.id));
}

export async function getRecords(userId: number, locationId: number, filters?: { 
  businessId?: number; 
  startDate?: string; 
  endDate?: string; 
  type?: 'INCOME' | 'EXPENSE' 
}) {
  return getAllRecords(userId, { ...filters, locationId });
}

export async function getRecordMetrics(userId: number, locationId?: number, businessId?: number) {
  const conditions = [
    eq(records.userId, userId),
    eq(records.isDeleted, 0),
    eq(records.isVoid, 0),
  ];

  if (locationId) conditions.push(eq(records.locationId, locationId));
  if (businessId) conditions.push(eq(records.businessId, businessId));

  const result = await db.select({
    type: records.type,
    total: sql<string>`COALESCE(sum(${records.amount}), 0)`,
    totalRefundable: sql<string>`COALESCE(sum(${records.refundableAmount}), 0)`,
    totalRefunded: sql<string>`COALESCE(sum(${records.refundedAmount}), 0)`,
  })
  .from(records)
  .where(and(...conditions))
  .groupBy(records.type);

  let totalIncome = 0;
  let grossExpense = 0;
  let totalRefundable = 0;
  let totalRefunded = 0;

  result.forEach(row => {
    if (row.type === 'INCOME') {
      totalIncome = DecimalMath.add(totalIncome, Number(row.total || 0));
    }
    if (row.type === 'EXPENSE') {
      grossExpense = DecimalMath.add(grossExpense, Number(row.total || 0));
      totalRefundable = DecimalMath.add(totalRefundable, Number(row.totalRefundable || 0));
      totalRefunded = DecimalMath.add(totalRefunded, Number(row.totalRefunded || 0));
    }
  });

  const refCalc = AccountingEngine.calculateRefundable(grossExpense, totalRefundable, totalRefunded);

  return {
    totalIncome,
    grossExpense,
    totalExpense: refCalc.actualExpense,
    totalRefundable: refCalc.totalRefundable,
    totalRefunded: refCalc.totalRefunded,
    pendingRefundable: refCalc.pendingRefundable,
    netBalance: DecimalMath.sub(totalIncome, refCalc.actualExpense),
  };
}

export async function createRecord(userId: number, data: any) {
  const amount = Number(data.amount || 0);
  const refundable = Number(data.refundableAmount || 0);
  const refundStatus = refundable > 0 ? 'PENDING' : 'N/A';

  const result = await db.insert(records).values({
    userId,
    businessId: data.businessId || null,
    locationId: data.locationId,
    type: data.type,
    amount: amount.toFixed(2),
    date: data.date,
    time: data.time || null,
    partyName: data.partyName,
    teamName: data.teamName || null,
    category: data.category || 'General',
    description: data.description || null,
    paymentMethod: data.paymentMethod || 'CASH',
    referenceNumber: data.referenceNumber || null,
    notes: data.notes || null,
    taxableAmount: (data.taxableAmount || amount).toFixed(2),
    gstRate: (data.gstRate || 0).toFixed(2),
    gstAmount: (data.gstAmount || 0).toFixed(2),
    refundableAmount: refundable.toFixed(2),
    refundedAmount: '0.00',
    refundStatus,
  }).returning();

  await db.insert(auditLogs).values({
    userId,
    businessId: data.businessId || null,
    locationId: data.locationId,
    action: 'CREATE',
    entityType: 'RECORD',
    entityId: result[0].id,
    afterState: JSON.stringify(result[0]),
  });

  return result[0];
}

export async function recordRefund(userId: number, recordId: number, data: {
  amount: number;
  refundDate: string;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
}) {
  const recList = await db.select().from(records).where(
    and(eq(records.id, recordId), eq(records.userId, userId), eq(records.isDeleted, 0))
  ).limit(1);

  if (recList.length === 0) throw new Error('Record not found');
  const record = recList[0];

  const totalRefundable = Number(record.refundableAmount || 0);
  const currentRefunded = Number(record.refundedAmount || 0);
  const refundAmount = Number(data.amount || 0);

  if (refundAmount <= 0) throw new Error('Valid refund amount is required');
  const newRefunded = DecimalMath.add(currentRefunded, refundAmount);

  if (newRefunded > totalRefundable) {
    throw new Error(`Refund amount exceeds refundable balance. Maximum refundable: ${DecimalMath.sub(totalRefundable, currentRefunded)}`);
  }

  const newStatus = newRefunded >= totalRefundable ? 'FULL' : 'PARTIAL';

  // 1. Insert into refunds ledger
  const refResult = await db.insert(refunds).values({
    userId,
    businessId: record.businessId,
    locationId: record.locationId,
    recordId,
    refundDate: data.refundDate,
    amount: refundAmount.toFixed(2),
    paymentMethod: data.paymentMethod || 'CASH',
    referenceNumber: data.referenceNumber || null,
    notes: data.notes || null,
  }).returning();

  // 2. Update record
  await db.update(records).set({
    refundedAmount: newRefunded.toFixed(2),
    refundStatus: newStatus,
    updatedAt: new Date(),
  }).where(eq(records.id, recordId));

  // 3. Audit log
  await db.insert(auditLogs).values({
    userId,
    businessId: record.businessId,
    locationId: record.locationId,
    action: 'RECORD_REFUND',
    entityType: 'REFUND',
    entityId: refResult[0].id,
    metadata: JSON.stringify({ recordId, refundAmount, newStatus }),
  });

  return refResult[0];
}

export async function updateRecord(userId: number, id: number, data: any) {
  const result = await db.update(records)
    .set({
      ...data,
      amount: data.amount !== undefined ? Number(data.amount).toFixed(2) : undefined,
      updatedAt: new Date()
    })
    .where(and(eq(records.id, id), eq(records.userId, userId)))
    .returning();

  if (result.length) {
    await db.insert(auditLogs).values({
      userId,
      businessId: result[0].businessId,
      locationId: result[0].locationId,
      action: 'UPDATE',
      entityType: 'RECORD',
      entityId: id,
      afterState: JSON.stringify(result[0]),
    });
  }

  return result[0];
}

export async function deleteRecord(userId: number, id: number) {
  const result = await db.update(records)
    .set({ isDeleted: 1, updatedAt: new Date() })
    .where(and(eq(records.id, id), eq(records.userId, userId)))
    .returning();

  if (result.length) {
    await db.insert(auditLogs).values({
      userId,
      businessId: result[0].businessId,
      locationId: result[0].locationId,
      action: 'DELETE',
      entityType: 'RECORD',
      entityId: id,
    });
  }

  return result[0];
}
