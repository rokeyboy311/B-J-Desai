const fs = require('fs');
const file = 'src/client/components/categories/MaterialPurchaseTab.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/paymentMethod: record\.paymentMethod \|\| "BANK",\s+referenceNumber: record\.referenceNumber \|\| "",\s+description: record\.description \|\| "",\s+notes: "",\s+materialId: record\.materialId \|\| ""/g, 
'paymentMethod: record.paymentMethod || "BANK", referenceNumber: record.referenceNumber || "", description: record.description || record.invoiceNumber || "", notes: record.notes || record.description || "", materialId: record.materialId || ""');

fs.writeFileSync(file, code);
