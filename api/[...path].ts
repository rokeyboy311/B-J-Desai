import app, { ensureDbInitialized } from "../src/server/app.ts";

ensureDbInitialized().catch((err) => {
  console.warn("[Vercel Serverless] DB initialization background note:", err);
});

export default function handler(req: any, res: any) {
  return app(req, res);
}
