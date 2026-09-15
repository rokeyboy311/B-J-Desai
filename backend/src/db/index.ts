import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = (): Pool => {
  if (!global._postgresPool) {
    const isProduction = process.env.NODE_ENV === 'production';
    const connectionString = process.env.DATABASE_URL;

    let poolConfig: PoolConfig;

    if (connectionString) {
      const isRemote =
        connectionString.includes('render.com') ||
        connectionString.includes('neon.tech') ||
        connectionString.includes('supabase.co') ||
        isProduction;

      poolConfig = {
        connectionString,
        ssl: process.env.DATABASE_SSL === 'false' ? false : (isRemote ? { rejectUnauthorized: false } : false),
        max: 10,
        connectionTimeoutMillis: 15000,
      };
    } else {
      poolConfig = {
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: 10,
        connectionTimeoutMillis: 15000,
      };
    }

    global._postgresPool = new Pool(poolConfig);

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
