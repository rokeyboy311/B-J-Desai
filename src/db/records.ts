import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from './index.ts';
import { records, auditLogs, locations } from './schema.ts';

export async function getAllRecords(userId: number, filters?: { startDate?: string, endDate?: string, type?: 'INCOME' | 'EXPENSE' }) {
  const conditions = [
    eq(records.userId, userId),
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
    category: records.category,
    description: records.description,
    locationId: records.locationId,
    locationName: locations.name,
    createdAt: records.createdAt
  })
  .from(records)
  .leftJoin(locations, eq(records.locationId, locations.id))
  .where(and(...conditions))
  .orderBy(desc(records.date), desc(records.id));
}

export async function getRecords(userId: number, locationId: number, filters?: { startDate?: string, endDate?: string, type?: 'INCOME' | 'EXPENSE' }) {
  const conditions = [
    eq(records.userId, userId),
    eq(records.locationId, locationId),
    eq(records.isDeleted, 0)
  ];

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

export async function getRecordMetrics(userId: number, locationId: number) {
  const result = await db.select({
    type: records.type,
    total: sql<string>`sum(${records.amount})`
  })
  .from(records)
  .where(and(
    eq(records.userId, userId),
    eq(records.locationId, locationId),
    eq(records.isDeleted, 0)
  ))
  .groupBy(records.type);

  let totalIncome = 0;
  let totalExpense = 0;

  result.forEach(row => {
    if (row.type === 'INCOME') totalIncome += parseFloat(row.total || '0');
    if (row.type === 'EXPENSE') totalExpense += parseFloat(row.total || '0');
  });

  return {
    totalIncome,
    totalExpense,
    netBalance: totalIncome - totalExpense
  };
}

export async function createRecord(userId: number, data: any) {
  const result = await db.insert(records).values({
    userId,
    ...data,
    amount: data.amount.toString(),
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
      updatedAt: new Date()
    })
    .where(and(eq(records.id, recordId), eq(records.userId, userId)))
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
    .where(and(eq(records.id, recordId), eq(records.userId, userId)))
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
