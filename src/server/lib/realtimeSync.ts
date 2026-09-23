import type { Request, Response, NextFunction } from 'express';

interface SyncClient {
  id: string;
  res: Response;
  connectedAt: number;
}

class RealtimeSyncManager {
  private clients: Set<SyncClient> = new Set();
  private globalVersion: number = Date.now();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Send a keep-alive ping every 15 seconds
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 15000);
  }

  public getVersion(): number {
    return this.globalVersion;
  }

  public registerClient(req: Request, res: Response): void {
    // Disable compression/buffering for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const client: SyncClient = {
      id: clientId,
      res,
      connectedAt: Date.now()
    };

    this.clients.add(client);

    // Send initial handshake with current database version
    const initialPayload = JSON.stringify({
      type: 'INIT',
      version: this.globalVersion,
      clientId,
      activeClientsCount: this.clients.size,
      timestamp: Date.now()
    });
    res.write(`data: ${initialPayload}\n\n`);

    req.on('close', () => {
      this.clients.delete(client);
    });

    req.on('error', () => {
      this.clients.delete(client);
    });
  }

  public notifyMutation(action: string = 'MUTATION', path: string = '', details: any = {}): void {
    this.globalVersion = Date.now();
    const payload = JSON.stringify({
      type: 'MUTATION',
      action,
      path,
      version: this.globalVersion,
      timestamp: Date.now(),
      ...details
    });

    const deadClients: SyncClient[] = [];

    this.clients.forEach(client => {
      try {
        client.res.write(`data: ${payload}\n\n`);
      } catch (err) {
        deadClients.push(client);
      }
    });

    deadClients.forEach(c => this.clients.delete(c));
  }

  private sendHeartbeat(): void {
    const deadClients: SyncClient[] = [];
    const pingPayload = JSON.stringify({
      type: 'PING',
      version: this.globalVersion,
      timestamp: Date.now()
    });

    this.clients.forEach(client => {
      try {
        client.res.write(`data: ${pingPayload}\n\n`);
      } catch (err) {
        deadClients.push(client);
      }
    });

    deadClients.forEach(c => this.clients.delete(c));
  }
}

export const realtimeSync = new RealtimeSyncManager();

/**
 * Express middleware that intercepts successful mutating requests (POST, PUT, PATCH, DELETE)
 * and automatically broadcasts a database sync event to all connected devices.
 */
export function realtimeSyncMiddleware(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (isMutating && !req.path.includes('/auth/') && !req.path.includes('/verify-session')) {
    const originalJson = res.json;
    const originalSend = res.send;

    const triggerBroadcast = () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        realtimeSync.notifyMutation(method, req.path);
      }
    };

    res.json = function (body: any) {
      triggerBroadcast();
      return originalJson.call(this, body);
    };

    res.send = function (body: any) {
      triggerBroadcast();
      return originalSend.call(this, body);
    };
  }

  next();
}
