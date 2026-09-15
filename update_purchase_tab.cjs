const fs = require('fs');
let s = fs.readFileSync('src/client/components/categories/MaterialPurchaseTab.tsx', 'utf8');

if (!s.includes('parties, setParties')) {
  s = s.replace(
    'const [loading, setLoading] = useState(true);',
    'const [loading, setLoading] = useState(true);\n  const [materials, setMaterials] = useState<any[]>([]);\n  const [parties, setParties] = useState<any[]>([]);'
  );
}

if (!s.includes('apiFetch(`/master/materials')) {
  s = s.replace(
    'apiFetch(`/materials/purchase?locationId=${locationId}`)',
    'apiFetch(`/materials/purchase?locationId=${locationId}`),\n      apiFetch(`/master/materials?locationId=${locationId}`).catch(() => []),\n      apiFetch(`/master/parties?locationId=${locationId}`).catch(() => [])'
  );
  s = s.replace(
    'const [data] = await Promise.all([',
    'const [data, mats, parts] = await Promise.all(['
  );
  s = s.replace(
    'setRecords(data || []);',
    'setRecords(data || []);\n      setMaterials(mats || []);\n      setParties(parts || []);'
  );
}

s = s.replace(
  'type="text"\n                value={formData.materialName}',
  'type="text"\n                list="materials-list"\n                value={formData.materialName}'
);

s = s.replace(
  'type="text"\n                value={formData.partyName}',
  'type="text"\n                list="parties-list"\n                value={formData.partyName}'
);

if (!s.includes('id="materials-list"')) {
  s = s.replace(
    '</form>',
    `  <datalist id="materials-list">
    {materials.map(m => <option key={m.id} value={m.name} />)}
  </datalist>
  <datalist id="parties-list">
    {parties.map(p => <option key={p.id} value={p.name} />)}
  </datalist>
</form>`
  );
}

// Ensure the form submission looks up the ID
s = s.replace(
  'const submitData = {',
  'const mat = materials.find(m => m.name === formData.materialName);\n    const materialId = mat ? mat.id : undefined;\n    const submitData = {'
);
s = s.replace(
  'locationId,',
  'locationId,\n      materialId,'
);

fs.writeFileSync('src/client/components/categories/MaterialPurchaseTab.tsx', s);
console.log('Fixed MaterialPurchaseTab');
