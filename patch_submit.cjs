const fs = require('fs');
let code = fs.readFileSync('src/client/components/categories/LabourSalaryTab.tsx', 'utf8');

code = code.replace(
  /const isDay = att\.typeCategory === "Day";\n\s*const daysVal = isDay \? \(att\.attendanceType === "Half-day" \? 0\.5 : 1\) : Number\(att\.tcQuantity \|\| 0\);\n\s*const typeVal = isDay \? att\.attendanceType : "TC";/g,
  `const isDay = att.typeCategory === "Day";
        const isPayment = att.typeCategory === "Payment";
        const daysVal = isDay ? (att.attendanceType === "Half-day" ? 0.5 : 1) : Number(att.tcQuantity || 0);
        const typeVal = isPayment ? "Payment" : isDay ? att.attendanceType : "TC";`
);

fs.writeFileSync('src/client/components/categories/LabourSalaryTab.tsx', code);
