import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from './index.ts';
import { locations, records, invoices, materialPurchases, auditLogs } from './schema.ts';

export async function getLocationsWithRecordCount(userId: number, businessId?: number) {
  const conditions = [
    eq(locations.userId, userId),
    eq(locations.isDeleted, 0)
  ];
  
  if (businessId) {
    conditions.push(eq(locations.businessId, businessId));
  }

  return await db
    .select({
      id: locations.id,
      businessId: locations.businessId,
      name: locations.name,
      address: locations.address,
      city: locations.city,
      state: locations.state,
      pincode: locations.pincode,
      gstin: locations.gstin,
      contactPerson: locations.contactPerson,
      mobile: locations.mobile,
      createdAt: locations.createdAt,
      updatedAt: locations.updatedAt,
      recordCount: sql<number>`count(distinct ${records.id})::int`,
      invoiceCount: sql<number>`count(distinct ${invoices.id})::int`,
    })
    .from(locations)
    .leftJoin(
      records,
      and(
        eq(records.locationId, locations.id),
        eq(records.isDeleted, 0)
      )
    )
    .leftJoin(
      invoices,
      and(
        eq(invoices.locationId, locations.id),
        eq(invoices.isDeleted, 0)
      )
    )
    .where(and(...conditions))
    .groupBy(locations.id)
    .orderBy(desc(locations.id));
}

export async function createLocation(userId: number, data: any) {
  const result = await db.insert(locations).values({
    userId,
    businessId: data.businessId || null,
    name: data.name,
    address: data.address || null,
    city: data.city || null,
    state: data.state || 'Gujarat',
    pincode: data.pincode || null,
    gstin: data.gstin || null,
    contactPerson: data.contactPerson || null,
    mobile: data.mobile || null,
  }).returning();
  
  await db.insert(auditLogs).values({
    userId,
    businessId: data.businessId || null,
    locationId: result[0].id,
    action: 'CREATE',
    entityType: 'LOCATION',
    entityId: result[0].id,
    afterState: JSON.stringify(result[0]),
  });

  return result[0];
}

export async function updateLocation(userId: number, locationId: number, data: any) {
  const result = await db.update(locations)
    .set({ 
      ...data,
      updatedAt: new Date() 
    })
    .where(and(eq(locations.id, locationId), eq(locations.userId, userId)))
    .returning();
    
  if (result.length) {
    await db.insert(auditLogs).values({
      userId,
      businessId: result[0].businessId,
      locationId,
      action: 'UPDATE',
      entityType: 'LOCATION',
      entityId: locationId,
      afterState: JSON.stringify(result[0]),
    });
  }

  return result[0];
}

export async function deleteLocation(userId: number, locationId: number) {
  // Safety check: ensure no active invoices or purchases exist
  const activeInvoices = await db.select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.locationId, locationId), eq(invoices.isDeleted, 0), eq(invoices.isVoid, 0)))
    .limit(1);

  if (activeInvoices.length > 0) {
    throw new Error('Cannot archive location with active invoices. Void invoices first.');
  }

  const result = await db.update(locations)
    .set({ isDeleted: 1, updatedAt: new Date() })
    .where(and(eq(locations.id, locationId), eq(locations.userId, userId)))
    .returning();

  if (result.length) {
    await db.insert(auditLogs).values({
      userId,
      businessId: result[0].businessId,
      locationId,
      action: 'ARCHIVE',
      entityType: 'LOCATION',
      entityId: locationId,
    });
  }

  return result[0];
}
