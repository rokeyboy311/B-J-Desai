import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';

const authRouter = Router();

// Endpoint to verify token and return user profile
authRouter.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    res.json({
      user: req.dbUser
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

export default authRouter;
