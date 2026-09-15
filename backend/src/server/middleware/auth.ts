import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getOrCreateUser } from '../../db/users.ts';
import { db } from '../../db/index.ts';
import { businesses, locations } from '../../db/schema.ts';
import { eq, and } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: { id: number; uid: string; email: string; name: string | null };
  businessId?: number;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    
    // Sync to PostgreSQL to get our internal integer ID
    const dbUser = await getOrCreateUser(
      decodedToken.uid,
      decodedToken.email || '',
      decodedToken.name
    );
    req.dbUser = dbUser;
    
    // Resolve active business from header or query, or fallback to default business
    const reqBizId = req.headers['x-business-id'] || req.query.businessId;
    if (reqBizId) {
      const parsedId = Number(reqBizId);
      if (!isNaN(parsedId)) {
        const isOwner = await verifyBusinessOwnership(dbUser.id, parsedId);
        if (isOwner) {
          req.businessId = parsedId;
        }
      }
    }
    
    if (!req.businessId) {
      // Fetch primary business for user
      const primaryBiz = await db.select({ id: businesses.id })
        .from(businesses)
        .where(and(eq(businesses.userId, dbUser.id), eq(businesses.isDeleted, 0)))
        .limit(1);
      if (primaryBiz.length > 0) {
        req.businessId = primaryBiz[0].id;
      }
    }

    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    return;
  }
};

/**
 * Server-side tenant isolation check: Verifies that the authenticated user owns the business.
 */
export async function verifyBusinessOwnership(userId: number, businessId: number): Promise<boolean> {
  if (!userId || !businessId) return false;
  const match = await db.select({ id: businesses.id })
    .from(businesses)
    .where(and(eq(businesses.id, businessId), eq(businesses.userId, userId), eq(businesses.isDeleted, 0)))
    .limit(1);
  return match.length > 0;
}

/**
 * Server-side tenant isolation check: Verifies that the location belongs to a business owned by the user.
 */
export async function verifyLocationOwnership(userId: number, locationId: number): Promise<boolean> {
  if (!userId || !locationId) return false;
  const match = await db.select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.id, locationId), eq(locations.userId, userId), eq(locations.isDeleted, 0)))
    .limit(1);
  return match.length > 0;
}
