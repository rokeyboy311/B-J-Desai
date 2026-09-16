import { db } from './src/db/index.ts';
import { sql } from 'drizzle-orm';

async function run() {
  const result = await db.execute(sql`SELECT count(*) FROM records WHERE is_deleted IS NULL;`);
  console.log(result.rows);
  process.exit(0);
}
run();
