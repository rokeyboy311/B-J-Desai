import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getOrCreateUser } from '../../db/users.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: { id: number; uid: string; email: string; name: string | null };
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
  
  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
  } catch (tokenError) {
    console.error('Error verifying Firebase ID token:', tokenError);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    return;
  }

  try {
    // Sync to PostgreSQL to get our internal integer ID
    const dbUser = await getOrCreateUser(
      decodedToken.uid,
      decodedToken.email || '',
      decodedToken.name
    );
    req.dbUser = dbUser;
    next();
  } catch (dbError) {
    console.error('Failed to sync user to database:', dbError);
    res.status(500).json({ error: 'Failed to synchronize user profile' });
    return;
  }
};
