import express from "express";
import path from "path";
import fs from "fs";
import app, { ensureDbInitialized } from "./app.ts";

async function startServer() {
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // Global uncaught exception and rejection protection for container stability
  process.on('uncaughtException', (err) => {
    console.error('[Process] Uncaught Exception:', err);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[Process] Unhandled Rejection:', reason);
  });

  // Serve public directory assets (icons, manifest, svgs) directly
  const publicPath = path.join(process.cwd(), 'public');
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.svg') || filePath.endsWith('.png') || filePath.endsWith('.ico') || filePath.endsWith('.json')) {
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        }
      }
    }));
  }

  // Vite middleware for development vs Production static serving
  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.K_SERVICE);
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (isProduction && hasDist) {
    // Production static serving
    app.use(express.static(distPath, { maxAge: '1h', index: false }));
    app.use((req, res) => {
      // Never send index.html for API routes or asset files
      if (req.path.startsWith('/api') || req.path.startsWith('/assets') || /\.(js|css|json|png|jpg|jpeg|svg|ico|woff2?)$/i.test(req.path)) {
        return res.status(404).send('Not Found');
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // Development mode with Vite middleware
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
        watch: process.env.DISABLE_HMR === 'true' ? null : undefined,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Run database migrations & initialization
    ensureDbInitialized().catch(err => {
      console.warn('[Bootstrap] Non-fatal init warning:', err);
    });
  });
}

startServer();
