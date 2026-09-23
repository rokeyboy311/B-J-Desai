import fs from "node:fs";
import path from "node:path";
import { execSync, spawn } from "node:child_process";

const distServer = path.join(process.cwd(), "dist", "server.cjs");

// If dist/server.cjs is missing, build it on the fly
if (!fs.existsSync(distServer)) {
  console.log("[Server] dist/server.cjs not found. Running build...");
  try {
    execSync("npx esbuild src/server/server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs", {
      stdio: "inherit",
    });
  } catch (err) {
    console.error("[Server] Build failed on startup:", err);
  }
}

if (fs.existsSync(distServer)) {
  await import("./dist/server.cjs");
} else {
  console.log("[Server] Spawning tsx fallback for src/server/server.ts...");
  const child = spawn("npx", ["tsx", "src/server/server.ts"], {
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}


