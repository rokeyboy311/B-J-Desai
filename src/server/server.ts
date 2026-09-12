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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(cors());
  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Register domain routers
  app.use("/api/auth", authRouter);
  app.use("/api/locations", locationRouter);
  app.use("/api/records", recordRouter);
  app.use("/api/reports", reportRouter);
  app.use("/api/audit-logs", auditRouter);
  
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
