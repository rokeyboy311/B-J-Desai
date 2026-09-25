import { eq, and, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { 
  locations, records, auditLogs,
  labourSalaries, labourTeams, labourMaster,
  siteSupplies, siteSupplyItems,
  materialSupplies, materialPurchases, materialLabourSupplies,
  investmentParties, investorLocationAllocations,
  contractorCosts, supervisorCosts, parties, stockLedger
} from './schema.ts';

export async function getLocationsWithRecordCount(_userId?: number, options?: { includeCentral?: boolean }) {
  try {
    const whereCondition = options?.includeCentral
      ? eq(locations.isDeleted, 0)
      : and(
          eq(locations.isDeleted, 0),
          sql`LOWER(TRIM(${locations.name})) NOT IN ('central inventory for all sites', 'central inventory', 'central stock')`
        );

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
      .where(whereCondition)
      .groupBy(locations.id)
      .orderBy(locations.name);
  } catch (error) {
    console.warn('[Locations] Database query error, returning empty fallback list:', error);
    return [];
  }
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
  const target = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
  if (target.length && /central inventory/i.test(target[0].name)) {
    throw new Error('Central Inventory system location cannot be deleted');
  }

  const result = await db.update(locations)
    .set({ isDeleted: 1, updatedAt: new Date() })
    .where(and(eq(locations.id, locationId), eq(locations.isDeleted, 0)))
    .returning();

  if (result.length) {
    // Cascade soft-delete across all modules and child tables for this location
    await Promise.all([
      db.update(records).set({ isDeleted: 1, updatedAt: new Date() }).where(eq(records.locationId, locationId)),
      db.update(labourSalaries).set({ isDeleted: 1 }).where(eq(labourSalaries.locationId, locationId)),
      db.update(labourTeams).set({ isDeleted: 1 }).where(eq(labourTeams.locationId, locationId)),
      db.update(labourMaster).set({ isDeleted: 1 }).where(eq(labourMaster.locationId, locationId)),
      db.update(siteSupplies).set({ isDeleted: 1 }).where(eq(siteSupplies.locationId, locationId)),
      db.update(materialSupplies).set({ isDeleted: 1 }).where(eq(materialSupplies.locationId, locationId)),
      db.update(materialPurchases).set({ isDeleted: 1 }).where(eq(materialPurchases.locationId, locationId)),
      db.update(materialLabourSupplies).set({ isDeleted: 1 }).where(eq(materialLabourSupplies.locationId, locationId)),
      db.update(investmentParties).set({ isDeleted: 1, updatedAt: new Date() }).where(eq(investmentParties.locationId, locationId)),
      db.update(investorLocationAllocations).set({ isDeleted: 1 }).where(eq(investorLocationAllocations.locationId, locationId)),
      db.update(contractorCosts).set({ isDeleted: 1, updatedAt: new Date() }).where(eq(contractorCosts.locationId, locationId)),
      db.update(supervisorCosts).set({ isDeleted: 1 }).where(eq(supervisorCosts.locationId, locationId)),
      db.update(parties).set({ isDeleted: 1 }).where(eq(parties.locationId, locationId)),
      db.update(stockLedger).set({ isDeleted: 1 }).where(eq(stockLedger.locationId, locationId))
    ]);

    await db.insert(auditLogs).values({
      userId,
      action: 'DELETE_LOCATION',
      entityType: 'LOCATION',
      entityId: locationId,
    });
  }

  return result[0];
}

/**
 * Cleanup any orphaned records that belong to already deleted locations
 */
export async function cleanupDeletedLocationsData() {
  try {
    const deletedLocs = await db.select({ id: locations.id }).from(locations)
      .where(and(eq(locations.isDeleted, 1), sql`LOWER(TRIM(${locations.name})) NOT IN ('central inventory for all sites', 'central inventory', 'central stock')`));
    if (!deletedLocs.length) return;
    const deletedIds = deletedLocs.map(l => l.id).join(',');
    if (!deletedIds) return;

    await db.execute(sql`
      UPDATE records SET is_deleted = 1 WHERE location_id IN (${sql.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE labour_salaries SET is_deleted = 1 WHERE location_id IN (${sql.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE labour_teams SET is_deleted = 1 WHERE location_id IN (${sql.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE labour_master SET is_deleted = 1 WHERE location_id IN (${sql.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE site_supplies SET is_deleted = 1 WHERE location_id IN (${sql.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE material_supplies SET is_deleted = 1 WHERE location_id IN (${sql.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE material_purchases SET is_deleted = 1 WHERE location_id IN (${sql.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE material_labour_supplies SET is_deleted = 1 WHERE location_id IN (${sql.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE investment_parties SET is_deleted = 1 WHERE location_id IN (${sql.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE investor_location_allocations SET is_deleted = 1 WHERE location_id IN (${sql.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE contractor_costs SET is_deleted = 1 WHERE location_id IN (${sql.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE supervisor_costs SET is_deleted = 1 WHERE location_id IN (${sql.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE parties SET is_deleted = 1 WHERE location_id IN (${sql.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE stock_ledger SET is_deleted = 1 WHERE location_id IN (${sql.raw(deletedIds)}) AND is_deleted = 0;
    `);
  } catch (err) {
    console.error('Error cleaning up deleted locations data:', err);
  }
}

