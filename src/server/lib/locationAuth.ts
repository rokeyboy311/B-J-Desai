import { db } from '../../db/index.ts';
import { locations } from '../../db/schema.ts';
import { eq, and } from 'drizzle-orm';

export interface LocationRecord {
  id: number;
  userId: number;
  name: string;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: number;
}

export class LocationAccessError extends Error {
  status: number;
  constructor(message: string, status: number = 400) {
    super(message);
    this.name = 'LocationAccessError';
    this.status = status;
  }
}

/**
 * Asserts that the provided locationId exists, is active (not deleted unless allowDeleted option is set),
 * and can be accessed by the requesting user.
 * Throws a LocationAccessError (with appropriate HTTP status) on failure.
 */
export async function assertLocationAccess(
  userId: number,
  locationId: number | string | undefined | null,
  options?: { allowDeleted?: boolean }
): Promise<LocationRecord> {
  if (locationId === undefined || locationId === null || locationId === '') {
    throw new LocationAccessError('Location ID is required', 400);
  }

  const parsedId = typeof locationId === 'number' ? locationId : parseInt(String(locationId), 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    throw new LocationAccessError('Invalid location ID provided', 400);
  }

  const whereCondition = options?.allowDeleted
    ? eq(locations.id, parsedId)
    : and(eq(locations.id, parsedId), eq(locations.isDeleted, 0));

  const rows = await db
    .select()
    .from(locations)
    .where(whereCondition)
    .limit(1);

  if (rows.length === 0) {
    throw new LocationAccessError(`Location with ID ${parsedId} not found`, 404);
  }

  const location = rows[0];
  return location;
}
