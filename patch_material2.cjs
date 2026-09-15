const fs = require('fs');
const file = 'src/client/components/categories/MaterialPurchaseTab.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/description: "",\s+materialId: ""/g, 'description: "",\n    notes: "",\n    materialId: ""');
fs.writeFileSync(file, code);
