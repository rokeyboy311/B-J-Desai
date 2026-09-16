const fs = require('fs');
let code = fs.readFileSync('src/server/routes/report.routes.ts', 'utf8');

const queryToReplace = `      db.select({
        materialName: materialLabourSupplies.materialName,
        unit: materialLabourSupplies.materialUnit,
        quantity: materialLabourSupplies.materialQuantity,
      }).from(materialLabourSupplies).where(and(eq(materialLabourSupplies.userId, userId), eq(materialLabourSupplies.isDeleted, 0), sql\`location_id IN (\${sql.raw(idList)})\`))`;

const newQuery = `      db.execute(sql\`
        SELECT m.material_name as "materialName", m.unit, SUM(CAST(i.quantity AS DECIMAL)) as "quantity"
        FROM site_supply_items i
        JOIN site_supplies s ON i.site_supply_id = s.id
        JOIN materials m ON i.material_id = m.id
        WHERE s.user_id = \${userId} AND s.is_deleted = 0 AND s.location_id IN (\${sql.raw(idList)}) AND i.is_deleted = 0
        GROUP BY m.material_name, m.unit
      \`) as Promise<any>`;

code = code.replace(queryToReplace, newQuery);

fs.writeFileSync('src/server/routes/report.routes.ts', code);
