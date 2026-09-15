import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));

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

  // Vite middleware for development vs static build for production
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
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`B_D Enterprise ERP Server running on port ${PORT} (0.0.0.0:${PORT})`);
  });
}

startServer();

