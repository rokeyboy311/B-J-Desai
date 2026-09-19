import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getOrCreateUser } from '../../db/users.ts';

export const MASTER_PIN = process.env.APP_ACCESS_PIN || process.env.APP_MASTER_PIN || "199198197";

export function timingSafeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

// In-memory brute force rate limiter for PIN attempts
interface RateLimitEntry {
  attempts: number;
  blockedUntil: number | null;
}

const pinRateLimitMap = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

export function checkPinRateLimit(key: string): { allowed: boolean; retryAfterMinutes?: number } {
  const now = Date.now();
  const entry = pinRateLimitMap.get(key);
  if (!entry) return { allowed: true };

  if (entry.blockedUntil && entry.blockedUntil > now) {
    const remainingMs = entry.blockedUntil - now;
    const retryAfterMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
    return { allowed: false, retryAfterMinutes };
  }

  // Reset if lockout window has expired
  if (entry.blockedUntil && entry.blockedUntil <= now) {
    pinRateLimitMap.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordFailedPinAttempt(key: string): { allowed: boolean; retryAfterMinutes?: number } {
  const now = Date.now();
  const entry = pinRateLimitMap.get(key) || { attempts: 0, blockedUntil: null };
  entry.attempts += 1;

  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + LOCKOUT_MS;
    pinRateLimitMap.set(key, entry);
    const retryAfterMinutes = Math.ceil(LOCKOUT_MS / (60 * 1000));
    return { allowed: false, retryAfterMinutes };
  }

  pinRateLimitMap.set(key, entry);
  return { allowed: true };
}

export function resetPinRateLimit(key: string): void {
  pinRateLimitMap.delete(key);
}

const PIN_SECRET = process.env.JWT_SECRET || process.env.APP_PIN_SECRET || 'b_d_accounting_erp_pin_auth_secret_key_199198197';

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

// Verify HMAC token using timing-safe comparison
export function verifyPinToken(token: string): boolean {
  try {
    if (!token || !token.includes('.')) return false;
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return false;
    const expectedSig = crypto.createHmac('sha256', PIN_SECRET).update(encodedPayload).digest('base64url');
    if (!timingSafeCompare(signature, expectedSig)) return false;
    
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
  const user = await getOrCreateUser(
    'central-bd-accounting',
    'system@bd-accounting.local',
    'B_D Accounting ERP'
  );
  if (!user || !user.id) {
    throw new Error('System user account could not be initialized from database.');
  }
  cachedSystemUser = user;
  return user;
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
    const user = await getSystemUser();
    if (!user || !user.id) {
      res.status(401).json({ error: 'Unauthorized: User not found in database' });
      return;
    }
    req.dbUser = user;
    next();
  } catch (err) {
    console.error('Failed to attach authenticated user to request:', err);
    res.status(503).json({ error: 'Database service unavailable. Access denied.' });
  }
};
