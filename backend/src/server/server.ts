import express from "express";
import path from "path";
import { app } from "./app.ts";

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  // Serve static public assets if available
  const publicPath = path.join(process.cwd(), "public");
  app.use(express.static(publicPath));

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Bina Enterprise ERP Backend API running on port ${PORT} (0.0.0.0:${PORT})`);
  });
}

startServer();
