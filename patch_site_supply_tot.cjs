const fs = require('fs');
let code = fs.readFileSync('src/server/routes/report.routes.ts', 'utf8');

code = code.replace(
  /const mlsQuery = await db\.execute\(sql\`[\s\S]*?FROM material_labour_supplies[\s\S]*?\`\);/,
  `const mlsQuery = await db.execute(sql\`
      SELECT SUM(total_amount) as tot, 0 as pd, 0 as out
      FROM site_supplies
      WHERE user_id = \${userId} AND is_deleted = 0 AND location_id IN (\${sql.raw(idList)})
    \`);`
);

fs.writeFileSync('src/server/routes/report.routes.ts', code);
