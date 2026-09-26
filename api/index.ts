import type { IncomingMessage, ServerResponse } from "node:http";
import app, { ensureDbInitialized } from "../src/server/app.ts";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await ensureDbInitialized();
  } catch (err) {
    console.warn("[Vercel Handler] DB initialization non-fatal warning:", err);
  }
  return (app as any)(req, res);
}
