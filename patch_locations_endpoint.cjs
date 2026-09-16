const fs = require('fs');
const file = 'src/server/routes/location.routes.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "console.error('Failed to fetch locations:', error);",
  "console.error('Failed to fetch locations from DB:', error, error.stack || error.message);"
);

fs.writeFileSync(file, code);
