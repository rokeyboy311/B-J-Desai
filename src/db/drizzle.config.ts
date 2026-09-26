import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const rawUrl = process.env.DATABASE_URL?.trim();
const dbUrl =
  (rawUrl && !rawUrl.includes("ep-odd-king-ae3gm793"))
    ? rawUrl
    : "postgresql://neondb_owner:npg_EFhz2LiMmG9c@ep-twilight-hat-b4jrehma-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    url: dbUrl,
    ssl: { rejectUnauthorized: false },
  },
  verbose: true,
});

