import { db } from '../src/db/index.js';
import { sql } from 'drizzle-orm';

async function resetAllAmounts() {
  console.log('🔄 Starting full database reset for manual workflow testing...');

  try {
    const tables = [
      'stock_ledger',
      'site_supply_items',
      'site_supplies',
      'material_supplies',
      'material_purchases',
      'material_labour_supplies',
      'labour_salaries',
      'supervisor_costs',
      'contractor_costs',
      'records',
      'investor_location_allocations',
      'investor_transactions',
      'investment_transactions',
      'investment_parties',
      'audit_logs'
    ];

    for (const table of tables) {
      try {
        await db.execute(sql.raw(`DELETE FROM ${table};`));
        console.log(`Cleared ${table}`);
      } catch (e: any) {
        console.log(`Warning clearing ${table}: ${e.message}`);
      }
    }

    // Reset default rates and min stock on materials table to 0
    try {
      await db.execute(sql`
        UPDATE materials 
        SET default_rate = '0.00', min_stock = '0.00';
      `);
      console.log('Reset materials default_rate to 0.00');
    } catch (e: any) {
      console.log(`Warning updating materials: ${e.message}`);
    }

    console.log('✅ Database amounts and transactions successfully reset to 0!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to reset database amounts:', error);
    process.exit(1);
  }
}

resetAllAmounts();
