import fs from 'fs';
let code = fs.readFileSync('src/db/schema.ts', 'utf8');

// We need to add 'CONTRIBUTION' to investmentTypeEnum
if (!code.includes("'CONTRIBUTION'")) {
  code = code.replace(
    "['INVESTMENT', 'PAYMENT', 'UPAD']",
    "['INVESTMENT', 'PAYMENT', 'UPAD', 'CONTRIBUTION']"
  );
  fs.writeFileSync('src/db/schema.ts', code);
  console.log("Added CONTRIBUTION to investmentTypeEnum");
} else {
  console.log("CONTRIBUTION already exists");
}
