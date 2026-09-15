const fs = require('fs');

function fix(file) {
  let s = fs.readFileSync(file, 'utf8');
  s = s.replace(
    'const res = await apiFetch(`/materials/supply?locationId=${locationId}`),',
    'const [res, mats, parts] = await Promise.all([apiFetch(`/materials/supply?locationId=${locationId}`),'
  );
  s = s.replace(
    'const res = await apiFetch(`/materials/purchase?locationId=${locationId}`),',
    'const [res, mats, parts] = await Promise.all([apiFetch(`/materials/purchase?locationId=${locationId}`),'
  );
  s = s.replace(
    'apiFetch(`/master/parties?locationId=${locationId}`).catch(() => []);',
    'apiFetch(`/master/parties?locationId=${locationId}`).catch(() => [])]);'
  );
  fs.writeFileSync(file, s);
}

fix('src/client/components/categories/MaterialSupplyTab.tsx');
fix('src/client/components/categories/MaterialPurchaseTab.tsx');
console.log('Fixed tabs');
