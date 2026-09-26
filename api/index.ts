import app, { ensureDbInitialized } from "../src/server/app.ts";

// Background bootstrap for serverless cold-starts
ensureDbInitialized().catch((err) => {
  console.warn("[Vercel Serverless] DB initialization background note:", err);
});

export default app;
