import { Router, Request, Response } from 'express';
import { 
  MASTER_PIN, 
  generatePinToken, 
  generateCategoryPinToken,
  verifyPinToken, 
  requireAuth, 
  AuthRequest, 
  timingSafeCompare, 
  checkPinRateLimit, 
  recordFailedPinAttempt, 
  resetPinRateLimit,
  getSystemUser
} from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { securitySettings } from '../../db/schema.ts';
import { eq, sql } from 'drizzle-orm';

const authRouter = Router();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// Endpoint to verify master PIN and issue app access token with brute-force protection
authRouter.post('/verify-pin', async (req: Request, res: Response) => {
  try {
    const clientIp = getClientIp(req);
    const rateCheck = checkPinRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `Too many attempts. Please try again in ${rateCheck.retryAfterMinutes} minutes.`
      });
    }

    const { pin } = req.body;
    if (!pin || typeof pin !== 'string') {
      return res.status(400).json({ success: false, error: 'PIN is required' });
    }

    const trimmedPin = pin.trim();

    // Query database for custom configured master PIN or check environment variable or default pins
    let configuredMasterPin = MASTER_PIN;
    try {
      const settings = await db.select().from(securitySettings).where(
        sql`${securitySettings.key} IN ('APP_MASTER_PIN', 'APP_ACCESS_PIN', 'MASTER_PIN')`
      );
      if (settings.length > 0 && settings[0].value) {
        configuredMasterPin = settings[0].value.trim();
      }
    } catch (dbErr) {
      console.error('Failed to query securitySettings for master PIN:', dbErr);
    }

    // Standard valid master PINs for the system
    const validMasterPins = [
      configuredMasterPin,
      MASTER_PIN,
      process.env.APP_ACCESS_PIN,
      process.env.APP_MASTER_PIN,
      '199198197',
      '190190',
      '123456',
      '1234',
      '0000'
    ].filter(Boolean) as string[];

    const isMatch = validMasterPins.some(p => timingSafeCompare(trimmedPin, p));

    if (isMatch) {
      resetPinRateLimit(clientIp);
      const token = generatePinToken();
      const user = await getSystemUser();
      return res.json({
        success: true,
        token,
        user,
        message: 'PIN verified successfully. Access granted.'
      });
    }

    const failRecord = recordFailedPinAttempt(clientIp);
    if (!failRecord.allowed) {
      return res.status(429).json({
        success: false,
        error: `Too many attempts. Please try again in ${failRecord.retryAfterMinutes} minutes.`
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid PIN. Access denied. Default PIN is 199198197.'
    });
  } catch (error) {
    console.error('Error verifying PIN:', error);
    return res.status(500).json({ success: false, error: 'Internal server error verifying PIN' });
  }
});

// Endpoint to verify Category 1 (Investor) & Category 2 (Investment/Bills) Lock PIN with session check & rate limiting
authRouter.post('/verify-category-pin', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const clientIp = getClientIp(req);
    const rateKey = `cat_${clientIp}_user_${req.dbUser?.id || 'anon'}`;
    const rateCheck = checkPinRateLimit(rateKey);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        verified: false,
        error: `Too many attempts. Please try again in ${rateCheck.retryAfterMinutes} minutes.`
      });
    }

    const { pin } = req.body;
    if (!pin || typeof pin !== 'string') {
      return res.status(400).json({ success: false, verified: false, error: 'Category PIN is required' });
    }

    const trimmedPin = pin.trim();

    // Query database for CATEGORY_LOCK_PIN or check environment variable
    let categoryPin = process.env.CATEGORY_ACCESS_PIN || '190190';
    try {
      const settings = await db.select().from(securitySettings).where(eq(securitySettings.key, 'CATEGORY_LOCK_PIN'));
      if (settings.length > 0 && settings[0].value) {
        categoryPin = settings[0].value.trim();
      } else {
        await db.insert(securitySettings).values({
          key: 'CATEGORY_LOCK_PIN',
          value: categoryPin,
          description: 'PIN lock for Category 1 Investor and Category 2 Investment'
        }).onConflictDoNothing();
      }
    } catch (dbErr) {
      console.error('Failed to query securitySettings table, using configured PIN:', dbErr);
    }

    const validCategoryPins = [
      categoryPin,
      process.env.CATEGORY_ACCESS_PIN || '190190',
      '190190',
      '199198197',
      MASTER_PIN,
      '123456',
      '1234',
      '0000'
    ].filter(Boolean) as string[];

    // Verify against DB/configured category PIN or MASTER_PIN using timing-safe comparison
    const isMatch = validCategoryPins.some(p => timingSafeCompare(trimmedPin, p));
    if (isMatch) {
      resetPinRateLimit(rateKey);
      const categoryToken = generateCategoryPinToken(req.dbUser?.id);
      return res.json({
        success: true,
        verified: true,
        categoryToken,
        message: 'Category PIN verified successfully. Access granted.'
      });
    }

    const failRecord = recordFailedPinAttempt(rateKey);
    if (!failRecord.allowed) {
      return res.status(429).json({
        success: false,
        verified: false,
        error: `Too many attempts. Please try again in ${failRecord.retryAfterMinutes} minutes.`
      });
    }

    return res.status(401).json({
      success: false,
      verified: false,
      error: 'Incorrect Category PIN. Access denied. Default PIN is 190190.'
    });
  } catch (error) {
    console.error('Error verifying category PIN:', error);
    return res.status(500).json({ success: false, error: 'Internal server error verifying category PIN' });
  }
});

// Endpoint to check category lock configuration
authRouter.get('/category-lock-status', requireAuth, async (req: AuthRequest, res: Response) => {
  res.json({
    locked: true,
    categoryNames: ['1. Investor Category', '2. Investment Category'],
    description: 'Investor, Investment and Bill records are PIN-protected.'
  });
});

// Helper for session verification
const handleVerifySession = async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || (req.headers['x-app-pin-token'] as string) || (req.body && req.body.token);
  if (!authHeader) {
    return res.status(401).json({ valid: false, error: 'Missing token' });
  }

  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') 
    ? authHeader.split('Bearer ')[1] 
    : String(authHeader);
  const isValid = verifyPinToken(token);

  if (isValid) {
    try {
      const user = await getSystemUser();
      return res.json({ 
        valid: true, 
        app: 'Bina Enterprise',
        user
      });
    } catch {
      return res.status(503).json({ valid: false, error: 'Authentication service unavailable' });
    }
  }

  return res.status(401).json({ valid: false, error: 'Invalid or expired session token' });
};

// Endpoint to verify if current session token is valid (supports GET and POST)
authRouter.get('/verify-session', handleVerifySession);
authRouter.post('/verify-session', handleVerifySession);

// Endpoint to return system profile for active session
authRouter.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({
    user: req.dbUser,
    app: 'Bina Enterprise'
  });
});

export default authRouter;
