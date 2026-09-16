const fs = require('fs');
let code = fs.readFileSync('src/server/routes/report.routes.ts', 'utf8');

code = code.replace(
  /exportData\.labourSupplies = await db\.select\(\)\.from\(materialLabourSupplies\)\.where\(and\(eq\(materialLabourSupplies\.locationId, locationId\), eq\(materialLabourSupplies\.userId, userId\), eq\(materialLabourSupplies\.isDeleted, 0\)\)\);/g,
  `exportData.siteSupplies = await db.execute(sql\`SELECT s.*, i.material_id, i.quantity, i.rate, i.amount as item_amount FROM site_supplies s LEFT JOIN site_supply_items i ON s.id = i.site_supply_id WHERE s.user_id = \${userId} AND s.location_id = \${locationId} AND s.is_deleted = 0\`).then(res => res.rows);`
);

code = code.replace(
  /exportData\.labourSupplies = await db\.select\(\)\.from\(materialLabourSupplies\)\.where\(and\(eq\(materialLabourSupplies\.userId, userId\), eq\(materialLabourSupplies\.isDeleted, 0\)\)\);/g,
  `exportData.siteSupplies = await db.execute(sql\`SELECT s.*, i.material_id, i.quantity, i.rate, i.amount as item_amount FROM site_supplies s LEFT JOIN site_supply_items i ON s.id = i.site_supply_id WHERE s.user_id = \${userId} AND s.is_deleted = 0\`).then(res => res.rows);`
);

fs.writeFileSync('src/server/routes/report.routes.ts', code);
