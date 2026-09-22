import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from './index.ts';
import { records, auditLogs, locations } from './schema.ts';

export async function getAllRecords(_userId?: number, filters?: { startDate?: string, endDate?: string, type?: 'INCOME' | 'EXPENSE' }) {
  const conditions = [
    eq(records.isDeleted, 0)
  ];

  if (filters?.startDate) conditions.push(gte(records.date, filters.startDate));
  if (filters?.endDate) conditions.push(lte(records.date, filters.endDate));
  if (filters?.type) conditions.push(eq(records.type, filters.type));

  return await db.select({
    id: records.id,
    type: records.type,
    amount: records.amount,
    date: records.date,
    partyName: records.partyName,
    teamName: records.teamName,
    category: records.category,
    description: records.description,
    locationId: records.locationId,
    locationName: locations.name,
    refundableAmount: records.refundableAmount,
    refundedAmount: records.refundedAmount,
    refundStatus: records.refundStatus,
    createdAt: records.createdAt
  })
  .from(records)
  .leftJoin(locations, eq(records.locationId, locations.id))
  .where(and(...conditions))
  .orderBy(desc(records.date), desc(records.id));
}

export async function getRecords(_userId: number, locationId?: number, filters?: { startDate?: string, endDate?: string, type?: 'INCOME' | 'EXPENSE' }) {
  const conditions = [
    eq(records.isDeleted, 0)
  ];

  if (locationId) {
    conditions.push(eq(records.locationId, locationId));
  }

  if (filters?.startDate) {
    conditions.push(gte(records.date, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(records.date, filters.endDate));
  }
  if (filters?.type) {
    conditions.push(eq(records.type, filters.type));
  }

  return await db.select()
    .from(records)
    .where(and(...conditions))
    .orderBy(desc(records.date), desc(records.id));
}

export async function getRecordMetrics(_userId: number, locationId?: number) {
  const conditions = [
    eq(records.isDeleted, 0)
  ];

  if (locationId) {
    conditions.push(eq(records.locationId, locationId));
  }

  const result = await db.select({
    type: records.type,
    total: sql<string>`sum(${records.amount})`,
    totalRefundable: sql<string>`sum(${records.refundableAmount})`,
    totalRefunded: sql<string>`sum(${records.refundedAmount})`,
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
      totalIncome += parseFloat(row.total || '0');
    }
    if (row.type === 'EXPENSE') {
      grossExpense += parseFloat(row.total || '0');
      totalRefundable += parseFloat(row.totalRefundable || '0');
      totalRefunded += parseFloat(row.totalRefunded || '0');
    }
  });

  const actualExpense = grossExpense - totalRefundable;

  return {
    totalIncome,
    totalExpense: actualExpense, // Returning the actual non-refundable expense
    totalRefundable,
    totalRefunded,
    netBalance: totalIncome - actualExpense
  };
}

export async function createRecord(userId: number, data: any) {
  const result = await db.insert(records).values({
    userId,
    ...data,
    amount: data.amount.toString(),
    refundableAmount: data.refundableAmount ? data.refundableAmount.toString() : '0',
    refundedAmount: data.refundedAmount ? data.refundedAmount.toString() : '0',
  }).returning();

  await db.insert(auditLogs).values({
    userId,
    action: 'CREATE_RECORD',
    entityType: 'RECORD',
    entityId: result[0].id,
    metadata: JSON.stringify({ amount: data.amount, type: data.type })
  });

  return result[0];
}

export async function updateRecord(userId: number, recordId: number, data: any) {
  const result = await db.update(records)
    .set({
      ...data,
      amount: data.amount.toString(),
      refundableAmount: data.refundableAmount ? data.refundableAmount.toString() : undefined,
      refundedAmount: data.refundedAmount ? data.refundedAmount.toString() : undefined,
      updatedAt: new Date()
    })
    .where(and(eq(records.id, recordId), eq(records.isDeleted, 0)))
    .returning();

  if (result.length) {
    await db.insert(auditLogs).values({
      userId,
      action: 'UPDATE_RECORD',
      entityType: 'RECORD',
      entityId: recordId,
    });
  }

  return result[0];
}

export async function deleteRecord(userId: number, recordId: number) {
  const result = await db.update(records)
    .set({ isDeleted: 1, updatedAt: new Date() })
    .where(and(eq(records.id, recordId), eq(records.isDeleted, 0)))
    .returning();

  if (result.length) {
    await db.insert(auditLogs).values({
      userId,
      action: 'DELETE_RECORD',
      entityType: 'RECORD',
      entityId: recordId,
    });
  }

  return result[0];
}
