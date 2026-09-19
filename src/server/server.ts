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
import { realtimeSyncMiddleware } from "./lib/realtimeSync.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware & CORS configuration
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : [];

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile webviews, curl, same-origin)
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Safe for iframe preview environments
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-app-pin-token', 'Cache-Control', 'Pragma']
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
  app.use("/api/master", masterRouter);
  app.use("/api/incomes", incomeRouter);
  
  // Register global error handler (must be after routes)
  app.use(errorHandler);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
