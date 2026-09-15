const fs = require('fs');
let s = fs.readFileSync('src/client/pages/LocationDetailsPage.tsx', 'utf8');

if (!s.includes('Database')) {
  s = s.replace(
    /\} from "lucide-react";/,
    ', Database } from "lucide-react";'
  );
}

fs.writeFileSync('src/client/pages/LocationDetailsPage.tsx', s);
