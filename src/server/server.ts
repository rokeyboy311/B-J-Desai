import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
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
import { normalizeMaterialsAndStockDB, runDatabaseMigrations } from "./lib/accounting.ts";
import { cleanupDeletedLocationsData } from "../db/locations.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Global uncaught exception and rejection protection for container stability
  process.on('uncaughtException', (err) => {
    console.error('[Process] Uncaught Exception:', err);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[Process] Unhandled Rejection:', reason);
  });

  // Middleware & CORS configuration
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : [];

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile webviews, curl, same-origin)
      if (!origin) return callback(null, true);

      // If specific allowed origins are configured
      if (allowedOrigins.length > 0 && !allowedOrigins.includes('*')) {
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        // Always allow AI Studio preview / localhost environments
        const isLocalOrPreview = origin.includes('localhost') || 
                                 origin.includes('127.0.0.1') || 
                                 origin.endsWith('.googleusercontent.com') ||
                                 origin.endsWith('.run.app');
        if (isLocalOrPreview) {
          return callback(null, true);
        }
        return callback(new Error(`CORS policy error: Origin ${origin} not allowed.`));
      }

      return callback(null, true); // Safe for iframe preview environments
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

  // Universal Database Password check for ANY record or details deletion across all endpoints
  // Strictly enforces: "Koi pn record ke koi pn details ne delete karva mate pan same password set karo. Only 1 j password database ma save karo and verification mate database ma jai ne check kare"
  app.use("/api", async (req, res, next) => {
    if (req.method === "DELETE") {
      const providedPassword =
        (req.headers["x-delete-password"] as string) ||
        (req.query.deletePassword as string) ||
        (req.body && req.body.deletePassword);

      const isAuthorized = await verifyPasswordAgainstDB(providedPassword || "");
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
    res.json({ status: "ok" });
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
        watch: process.env.DISABLE_HMR === 'true' ? null : undefined,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // Run database migrations, single universal password init, and stock reconciliation in background
    (async () => {
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
  });
}

startServer();
