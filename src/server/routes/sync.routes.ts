import { Router, type Request, type Response } from 'express';
import { realtimeSync } from '../lib/realtimeSync.ts';

const syncRouter = Router();

// Server-Sent Events stream for instant real-time pushes to all devices
syncRouter.get('/events', (req: Request, res: Response) => {
  realtimeSync.registerClient(req, res);
});

// Lightweight version polling endpoint
syncRouter.get('/version', (req: Request, res: Response) => {
  res.json({
    version: realtimeSync.getVersion(),
    timestamp: Date.now()
  });
});

// Manual broadcast trigger
syncRouter.post('/trigger', (req: Request, res: Response) => {
  realtimeSync.notifyMutation('MANUAL_SYNC', req.body?.path || 'manual', req.body || {});
  res.json({ success: true, version: realtimeSync.getVersion() });
});

export default syncRouter;
