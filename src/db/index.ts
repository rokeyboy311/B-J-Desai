import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const NEON_CONNECTION_STRING =
  'postgresql://neondb_owner:npg_EFhz2LiMmG9c@ep-twilight-hat-b4jrehma-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';

export const getDatabaseUrl = (): string => {
  const envUrl = process.env.DATABASE_URL?.trim();
  // If envUrl is the obsolete database or empty, use the new Neon database
  if (!envUrl || envUrl.includes('ep-odd-king-ae3gm793')) {
    return NEON_CONNECTION_STRING;
  }
  let clean = envUrl;
  if ((clean.startsWith("'") && clean.endsWith("'")) || (clean.startsWith('"') && clean.endsWith('"'))) {
    clean = clean.slice(1, -1).trim();
  }
  return clean || NEON_CONNECTION_STRING;
};

export const createPool = () => {
  if (!global._postgresPool) {
    let connStr = getDatabaseUrl();

    // Always configure SSL for remote PostgreSQL / Neon
    const isRemote =
      connStr.includes('sslmode=require') ||
      connStr.includes('neon.tech') ||
      connStr.includes('aws.neon.tech');

    const config: any = {
      connectionString: connStr,
      max: process.env.NODE_ENV === 'production' ? 10 : 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      ssl: isRemote ? { rejectUnauthorized: false } : undefined,
    };

    global._postgresPool = new Pool(config);

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
