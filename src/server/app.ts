import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler.ts";
import authRouter from "./routes/auth.routes.ts";
import locationRouter from "./routes/location.routes.ts";
import recordRouter from "./routes/record.routes.ts";
import reportRouter from "./routes/report.routes.ts";
import auditRouter from "./routes/audit.routes.ts";
import investmentRouter from "./routes/investment.routes.ts";
import materialRouter from "./routes/material.routes.ts";
import labourRouter from "./routes/labour.routes.ts";
import supervisorRouter from "./routes/supervisor.routes.ts";
import masterRouter from "./routes/master.routes.ts";
import siteSupplyRouter from "./routes/siteSupply.routes.ts";
import syncRouter from "./routes/sync.routes.ts";
import incomeRouter from "./routes/income.routes.ts";
import contractorRouter from "./routes/contractor.routes.ts";
import { realtimeSyncMiddleware } from "./lib/realtimeSync.ts";
import { 
  initializeSinglePasswordInDB, 
  verifyPasswordAgainstDB 
} from "./lib/security.ts";
import { verifyPinToken } from "./middleware/auth.ts";
import { normalizeMaterialsAndStockDB, runDatabaseMigrations } from "./lib/accounting.ts";
import { cleanupDeletedLocationsData } from "../db/locations.ts";

let dbInitPromise: Promise<void> | null = null;

export async function ensureDbInitialized(): Promise<void> {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      try {
        await runDatabaseMigrations();
        await initializeSinglePasswordInDB();
        await normalizeMaterialsAndStockDB();
        await cleanupDeletedLocationsData();
        console.log('[Bootstrap] Database initialization, deleted location cleanup & accounting sanity checks completed.');
      } catch (err) {
        console.error('[Bootstrap] Background initialization warning:', err);
      }
    })();
  }
  return dbInitPromise;
}

export function createExpressApp() {
  const app = express();

  // CORS configuration for Vercel, Localhost & Cloud environments
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : [];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.length > 0 && !allowedOrigins.includes('*')) {
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        const isAllowedDomain = 
          origin.includes('localhost') || 
          origin.includes('127.0.0.1') || 
          origin.endsWith('.googleusercontent.com') ||
          origin.endsWith('.run.app') ||
          origin.endsWith('.vercel.app');
        if (isAllowedDomain) {
          return callback(null, true);
        }
        return callback(new Error(`CORS policy error: Origin ${origin} not allowed.`));
      }

      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-app-pin-token', 'x-category-pin-token', 'x-delete-password', 'Cache-Control', 'Pragma']
  }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Prevent caching for all API responses so all devices see latest live data immediately
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    next();
  });

  // URL normalization: ensure API routes starting without /api or rewritten by Vercel are handled
  app.use((req, res, next) => {
    // Strip /api/index.ts or /api/index prefix if injected by Vercel serverless rewrites
    if (req.url.startsWith('/api/index.ts')) {
      req.url = req.url.replace(/^\/api\/index\.ts/, '/api');
    } else if (req.url.startsWith('/api/index')) {
      req.url = req.url.replace(/^\/api\/index/, '/api');
    }

    const knownApiPrefixes = [
      '/sync', '/auth', '/access', '/locations', '/records', '/reports', 
      '/audit-logs', '/investments', '/materials', '/site-supplies', 
      '/labour', '/supervisor-costs', '/contractor-costs', '/contractors', 
      '/master', '/incomes', '/health', '/gas-proxy'
    ];
    if (!req.url.startsWith('/api') && knownApiPrefixes.some(p => req.url.startsWith(p))) {
      req.url = '/api' + req.url;
    }
    next();
  });

  // Universal Database Password check for ANY record or details deletion across all endpoints
  app.use("/api", async (req, res, next) => {
    if (req.method === "DELETE") {
      const providedPassword =
        (req.headers["x-delete-password"] as string) ||
        (req.query.deletePassword as string) ||
        (req.body && req.body.deletePassword);

      let isAuthorized = false;
      if (providedPassword) {
        isAuthorized = await verifyPasswordAgainstDB(providedPassword);
      }

      // Fallback: If delete-password header is empty, verify if user has an active authenticated session
      if (!isAuthorized) {
        const authHeader = (req.headers.authorization as string) || (req.headers['x-app-pin-token'] as string);
        if (authHeader) {
          const token = authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : authHeader;
          if (token && verifyPinToken(token)) {
            isAuthorized = true;
          }
        }
      }

      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          error: 'Security authorization required: Valid security password ("Bh@ju1203") is required to delete any record or details.',
          requiresDeletePassword: true
        });
      }
    }
    next();
  });

  // Real-time mutation interception middleware
  app.use(realtimeSyncMiddleware);

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Register domain routers
  app.use("/api/sync", syncRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/access", authRouter);
  app.use("/api/locations", locationRouter);
  app.use("/api/records", recordRouter);
  app.use("/api/reports", reportRouter);
  app.use("/api/audit-logs", auditRouter);
  app.use("/api/investments", investmentRouter);
  app.use("/api/materials", materialRouter);
  app.use("/api/site-supplies", siteSupplyRouter);
  app.use("/api/labour", labourRouter);
  app.use("/api/supervisor-costs", supervisorRouter);
  app.use("/api/contractor-costs", contractorRouter);
  app.use("/api/contractors", contractorRouter);
  app.use("/api/master", masterRouter);
  app.use("/api/incomes", incomeRouter);

  // Register global error handler (must be after routes)
  app.use(errorHandler);

  return app;
}

const app = createExpressApp();
export default app;
