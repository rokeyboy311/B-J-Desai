import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    let config: any;

    if (process.env.SQL_HOST && process.env.SQL_DB_NAME) {
      config = {
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER || process.env.SQL_ADMIN_USER || 'postgres',
        password: process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD || '',
        database: process.env.SQL_DB_NAME,
        max: 10,
        connectionTimeoutMillis: 15000,
      };
    } else if (process.env.DATABASE_URL) {
      let connStr = process.env.DATABASE_URL.trim();
      if ((connStr.startsWith("'") && connStr.endsWith("'")) || (connStr.startsWith('"') && connStr.endsWith('"'))) {
        connStr = connStr.slice(1, -1).trim();
      }
      config = {
        connectionString: connStr,
        max: 10,
        connectionTimeoutMillis: 15000,
        ssl: connStr.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
      };
    } else {
      config = {
        host: process.env.SQL_HOST || 'localhost',
        user: process.env.SQL_USER || 'postgres',
        password: process.env.SQL_PASSWORD || '',
        database: process.env.SQL_DB_NAME || 'postgres',
        max: 10,
        connectionTimeoutMillis: 15000,
      };
    }

    global._postgresPool = new Pool(config);

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
