const fs = require('fs');
let s = fs.readFileSync('src/server/lib/accounting.ts', 'utf8');

const newCode = `
import { stockLedger } from '../../db/schema.js';

export class StockManager {
  static async addStockMovement(dbTx: any, userId: number, locationId: number, materialId: number, type: 'IN'|'OUT'|'ADJUST', quantity: number, refId: number, refType: string, notes?: string) {
    if (!materialId || isNaN(quantity)) throw new Error("Invalid stock movement details");
    await dbTx.insert(stockLedger).values({
      userId,
      locationId,
      materialId,
      transactionType: type,
      quantity: type === 'OUT' ? -Math.abs(quantity) : Math.abs(quantity),
      referenceId: refId,
      referenceType: refType,
      notes
    });
  }
}
`;

if (!s.includes('StockManager')) {
  s = s.replace("import { db } from '../../db/index.js';", "import { db } from '../../db/index.js';\n" + newCode);
}
fs.writeFileSync('src/server/lib/accounting.ts', s);
console.log('Fixed accounting');
