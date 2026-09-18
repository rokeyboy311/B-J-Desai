import { Router, Request, Response } from 'express';
import { MASTER_PIN, VALID_PINS, generatePinToken, verifyPinToken, requireAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { securitySettings } from '../../db/schema.ts';
import { eq } from 'drizzle-orm';

const authRouter = Router();

// Endpoint to verify master PIN and issue app access token
authRouter.post('/verify-pin', (req: Request, res: Response) => {
  try {
    const { pin } = req.body;
    
    if (!pin || typeof pin !== 'string') {
      return res.status(400).json({ success: false, error: 'PIN is required' });
    }

    const trimmedPin = pin.trim();
    if (VALID_PINS.includes(trimmedPin)) {
      const token = generatePinToken();
      return res.json({
        success: true,
        token,
        message: 'PIN verified successfully. Access granted.'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid PIN. Access denied. (Default Master PIN: 199198197 or 1234)'
    });
  } catch (error) {
    console.error('Error verifying PIN:', error);
    return res.status(500).json({ success: false, error: 'Internal server error verifying PIN' });
  }
});

// Endpoint to verify Category 1 (Investor) & Category 2 (Investment/Bills) Lock PIN from database
authRouter.post('/verify-category-pin', async (req: Request, res: Response) => {
  try {
    const { pin } = req.body;
    if (!pin || typeof pin !== 'string') {
      return res.status(400).json({ success: false, error: 'Category PIN is required' });
    }

    const trimmedPin = pin.trim();

    // Query database for CATEGORY_LOCK_PIN
    let dbPin = '190190';
    try {
      const settings = await db.select().from(securitySettings).where(eq(securitySettings.key, 'CATEGORY_LOCK_PIN'));
      if (settings.length > 0 && settings[0].value) {
        dbPin = settings[0].value.trim();
      } else {
        // Seed default 190190
        await db.insert(securitySettings).values({
          key: 'CATEGORY_LOCK_PIN',
          value: '190190',
          description: 'PIN lock for Category 1 Investor and Category 2 Investment'
        }).onConflictDoNothing();
      }
    } catch (dbErr) {
      console.error('Failed to query securitySettings table, using fallback:', dbErr);
    }

    // Verify against DB PIN or default 190190
    if (trimmedPin === dbPin || trimmedPin === '190190' || trimmedPin === MASTER_PIN) {
      return res.json({
        success: true,
        verified: true,
        message: 'Category PIN verified successfully. Access granted to Investor & Investment details.'
      });
    }

    return res.status(401).json({
      success: false,
      verified: false,
      error: 'Incorrect PIN. Access to Investor and Investment details is restricted.'
    });
  } catch (error) {
    console.error('Error verifying category PIN:', error);
    return res.status(500).json({ success: false, error: 'Internal server error verifying category PIN' });
  }
});

// Endpoint to check category lock configuration
authRouter.get('/category-lock-status', async (req: Request, res: Response) => {
  res.json({
    locked: true,
    categoryNames: ['1. Investor Category', '2. Investment Category'],
    description: 'Investor, Investment and Bill records are PIN-protected.'
  });
});


// Helper for session verification
const handleVerifySession = (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || (req.headers['x-app-pin-token'] as string) || (req.body && req.body.token);
  if (!authHeader) {
    return res.status(401).json({ valid: false, error: 'Missing token' });
  }

  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') 
    ? authHeader.split('Bearer ')[1] 
    : String(authHeader);
  const isValid = verifyPinToken(token);

  if (isValid) {
    return res.json({ 
      valid: true, 
      app: 'B_D Accounting ERP',
      user: { id: 1, email: 'admin@bina.enterprise', name: 'B_D Administrator' }
    });
  }

  return res.status(401).json({ valid: false, error: 'Invalid or expired session token' });
};

// Endpoint to verify if current session token is valid (supports GET and POST)
authRouter.get('/verify-session', handleVerifySession);
authRouter.post('/verify-session', handleVerifySession);

// Endpoint to return system profile for active session
authRouter.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({
    user: req.dbUser || { id: 1, name: 'B_D Accounting ERP' },
    app: 'B_D Accounting ERP'
  });
});

export default authRouter;
