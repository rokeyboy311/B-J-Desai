const fs = require('fs');
const file = 'src/client/lib/api.ts';
let code = fs.readFileSync(file, 'utf8');

const oldFetch = `  let response = await fetch(\`/api\${endpoint}\`, {
    ...options,
    headers,
  });`;

const newFetch = `  let response;
  try {
    response = await fetch(\`/api\${endpoint}\`, {
      ...options,
      headers,
    });
  } catch (netErr) {
    console.error("Network error during fetch:", netErr);
    // Transient network error (e.g. server restarting), wait and retry once
    await new Promise(r => setTimeout(r, 1500));
    response = await fetch(\`/api\${endpoint}\`, {
      ...options,
      headers,
    });
  }`;

code = code.replace(oldFetch, newFetch);
fs.writeFileSync(file, code);
