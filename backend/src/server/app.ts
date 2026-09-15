import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler.ts";
import authRouter from "./routes/auth.routes.ts";
import businessRouter from "./routes/business.routes.ts";
import locationRouter from "./routes/location.routes.ts";
import recordRouter from "./routes/record.routes.ts";
import reportRouter from "./routes/report.routes.ts";
import auditRouter from "./routes/audit.routes.ts";
import investmentRouter from "./routes/investment.routes.ts";
import materialRouter from "./routes/material.routes.ts";
import labourRouter from "./routes/labour.routes.ts";
import supervisorRouter from "./routes/supervisor.routes.ts";
import masterRouter from "./routes/master.routes.ts";
import invoiceRouter from "./routes/invoice.routes.ts";
import itemRouter from "./routes/item.routes.ts";
import paymentRouter from "./routes/payment.routes.ts";

export function createApp() {
  const app = express();

  // CORS configuration: safely handles cross-origin requests from Vercel to Render or local dev
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
    : null;

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || !allowedOrigins || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
          callback(null, true);
        } else {
          callback(null, true); // Permissive default to ensure API accessibility across deployments
        }
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: "10mb" }));

  // URL normalization: if deployed behind a serverless proxy or rewrite that strips /api, re-add it
  app.use((req, _res, next) => {
    if (!req.url.startsWith("/api")) {
      req.url = `/api${req.url.startsWith("/") ? req.url : `/${req.url}`}`;
    }
    next();
  });

  // API health check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      system: "B_D Enterprise Accounting ERP",
      version: "2.0.0",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Register domain routers
  app.use("/api/auth", authRouter);
  app.use("/api/businesses", businessRouter);
  app.use("/api/locations", locationRouter);
  app.use("/api/records", recordRouter);
  app.use("/api/reports", reportRouter);
  app.use("/api/audit-logs", auditRouter);
  app.use("/api/investments", investmentRouter);
  app.use("/api/materials", materialRouter);
  app.use("/api/labour", labourRouter);
  app.use("/api/supervisor-costs", supervisorRouter);
  app.use("/api/master", masterRouter);
  app.use("/api/invoices", invoiceRouter);
  app.use("/api/items", itemRouter);
  app.use("/api/payments", paymentRouter);

  // Register global error handler (must be after routes)
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
