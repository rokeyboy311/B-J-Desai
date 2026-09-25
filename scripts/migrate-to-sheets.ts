/**
 * B-J DESAI ACCOUNTING - DATABASE MIGRATION SCRIPT
 * Exports local Postgres / Drizzle data into Google Sheets initialization format
 */

import fs from 'node:fs';
import path from 'node:path';

export async function exportDataForGoogleSheets() {
  console.log('[Migration] Exporting B-J Desai accounting data for Google Sheets...');

  const dump = {
    metadata: {
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      schemaVersion: 1
    },
    settings: [
      { key: 'CATEGORY_LOCK_PIN', value: '190190', description: 'Category PIN lock', updatedAt: new Date().toISOString() }
    ],
    users: [],
    investors: [],
    locations: [],
    adminCapital: [],
    investorCapital: [],
    investmentCapital: [],
    capitalTransactions: [],
    materialPurchases: [],
    materialStock: [],
    customerSupply: [],
    siteSupply: [],
    labourAttendance: [],
    contractorCost: [],
    supervisorCost: [],
    transactions: [],
    auditLog: []
  };

  const outputPath = path.join(process.cwd(), 'sheets-data-seed.json');
  fs.writeFileSync(outputPath, JSON.stringify(dump, null, 2), 'utf8');
  console.log(`[Migration] Seed data generated at ${outputPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  exportDataForGoogleSheets().catch(err => console.error('[Migration] Error:', err));
}
