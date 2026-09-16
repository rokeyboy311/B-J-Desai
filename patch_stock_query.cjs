const fs = require('fs');
let code = fs.readFileSync('src/server/routes/report.routes.ts', 'utf8');

// Replace materialLabourSupplies with siteSupplies and siteSupplyItems
code = code.replace(
  /db\.select\(\{\s*materialName: materialLabourSupplies\.materialName,\s*unit: materialLabourSupplies\.materialUnit,\s*quantity: materialLabourSupplies\.materialQuantity,\s*\}\)\.from\(materialLabourSupplies\)\.where\(and\(eq\(materialLabourSupplies\.userId, userId\), eq\(materialLabourSupplies\.isDeleted, 0\), sql\`location_id IN \(\\\$\{sql\.raw\(idList\)\}\)\`\)\)/,
  `db.execute(sql\`
        SELECT i.material_id, m.material_name as "materialName", m.unit, SUM(i.quantity) as "quantity"
        FROM site_supply_items i
        JOIN site_supplies s ON i.site_supply_id = s.id
        JOIN materials m ON i.material_id = m.id
        WHERE s.user_id = \${userId} AND s.is_deleted = 0 AND s.location_id IN (\${sql.raw(idList)}) AND i.is_deleted = 0
        GROUP BY i.material_id, m.material_name, m.unit
      \`)`
);

// We need to parse siteSuppliesForStock differently because it's from db.execute
code = code.replace(
  /const \[purchasesForStock, suppliesForStock, siteSuppliesForStock\] = await Promise\.all\(\[/,
  'const [purchasesForStock, suppliesForStock, siteSuppliesForStockRaw] = await Promise.all(['
);

code = code.replace(
  /for \(const ms of siteSuppliesForStock\) \{/,
  `const siteSuppliesForStock = siteSuppliesForStockRaw.rows || [];
    for (const ms of siteSuppliesForStock) {`
);

fs.writeFileSync('src/server/routes/report.routes.ts', code);
