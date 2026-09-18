import { eq, and, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { locations, records, auditLogs } from './schema.ts';

export async function getLocationsWithRecordCount(_userId?: number) {
  return await db
    .select({
      id: locations.id,
      name: locations.name,
      address: locations.address,
      createdAt: locations.createdAt,
      updatedAt: locations.updatedAt,
      recordCount: sql<number>`count(${records.id})::int`,
    })
    .from(locations)
    .leftJoin(
      records,
      and(
        eq(records.locationId, locations.id),
        eq(records.isDeleted, 0)
      )
    )
    .where(eq(locations.isDeleted, 0))
    .groupBy(locations.id)
    .orderBy(locations.name);
}

export async function createLocation(userId: number, name: string, address?: string | null) {
  const result = await db.insert(locations).values({
    userId,
    name,
    address: address || null,
  }).returning();
  
  await db.insert(auditLogs).values({
    userId,
    action: 'CREATE_LOCATION',
    entityType: 'LOCATION',
    entityId: result[0].id,
  });

  return result[0];
}

export async function updateLocation(userId: number, locationId: number, name: string, address?: string | null) {
  const result = await db.update(locations)
    .set({ name, address: address || null, updatedAt: new Date() })
    .where(and(eq(locations.id, locationId), eq(locations.isDeleted, 0)))
    .returning();
    
  if (result.length) {
    await db.insert(auditLogs).values({
      userId,
      action: 'UPDATE_LOCATION',
      entityType: 'LOCATION',
      entityId: locationId,
    });
  }

  return result[0];
}

export async function deleteLocation(userId: number, locationId: number) {
  const result = await db.update(locations)
    .set({ isDeleted: 1, updatedAt: new Date() })
    .where(and(eq(locations.id, locationId), eq(locations.isDeleted, 0)))
    .returning();

  if (result.length) {
    // Also soft-delete all associated records to maintain data integrity
    await db.update(records)
      .set({ isDeleted: 1, updatedAt: new Date() })
      .where(eq(records.locationId, locationId));

    await db.insert(auditLogs).values({
      userId,
      action: 'DELETE_LOCATION',
      entityType: 'LOCATION',
      entityId: locationId,
    });
  }

  return result[0];
}
