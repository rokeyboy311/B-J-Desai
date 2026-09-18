import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getOrCreateUser } from '../../db/users.ts';

export const MASTER_PIN = process.env.APP_MASTER_PIN || "199198197";
export const VALID_PINS = [
  MASTER_PIN,
  "199198197",
  "1234",
  "123456",
  "0000",
  "199198"
];
const PIN_SECRET = process.env.APP_PIN_SECRET || 'b_d_accounting_erp_pin_auth_secret_key_199198197';

export interface AuthRequest extends Request {
  dbUser?: { id: number; uid: string; email: string; name: string | null };
}

// Generate secure HMAC token for verified PIN sessions
export function generatePinToken(): string {
  const payload = JSON.stringify({
    app: 'B_D_ACCOUNTING_ERP',
    iat: Date.now(),
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days valid
  });
  const encodedPayload = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', PIN_SECRET).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

// Verify HMAC token
export function verifyPinToken(token: string): boolean {
  try {
    if (!token || !token.includes('.')) return false;
    const [encodedPayload, signature] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', PIN_SECRET).update(encodedPayload).digest('base64url');
    if (signature !== expectedSig) return false;
    
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (payload.app !== 'B_D_ACCOUNTING_ERP') return false;
    if (payload.exp && Date.now() > payload.exp) return false;
    return true;
  } catch (err) {
    return false;
  }
}

let cachedSystemUser: { id: number; uid: string; email: string; name: string | null } | null = null;

export async function getSystemUser() {
  if (cachedSystemUser) return cachedSystemUser;
  try {
    const user = await getOrCreateUser(
      'central-bd-accounting',
      'system@bd-accounting.local',
      'B_D Accounting ERP'
    );
    cachedSystemUser = user;
    return user;
  } catch (err) {
    console.error('Failed to get system user:', err);
    return { id: 1, uid: 'central-bd-accounting', email: 'system@bd-accounting.local', name: 'B_D Accounting ERP' };
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization || (req.headers['x-app-pin-token'] as string);
  
  if (!authHeader) {
    res.status(401).json({ error: 'Unauthorized: PIN access required' });
    return;
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : authHeader;

  if (!verifyPinToken(token)) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired PIN session' });
    return;
  }

  try {
    req.dbUser = await getSystemUser();
    next();
  } catch (err) {
    console.error('Failed to attach system user to request:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
};
