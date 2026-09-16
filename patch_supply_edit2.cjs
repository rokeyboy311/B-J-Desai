const fs = require('fs');
const file = 'src/client/components/categories/MaterialSupplyTab.tsx';
let code = fs.readFileSync(file, 'utf8');

const injectCode = `
  const handleEdit = (record: any) => {
    setEditingId(record.id);
    setFormData({
      date: record.date || new Date().toISOString().split("T")[0],
      partyId: record.partyId?.toString() || "",
      materialId: record.materialId?.toString() || "",
      quantity: record.quantity || "",
      rate: record.rate || "",
      taxPercentage: record.taxPercentage || "18",
      transportCost: record.transportCost || "0",
      discount: record.discount || "0",
      referenceNumber: record.referenceNumber || "",
      description: record.notes || record.description || "",
      unit: record.unit || "Nos"
    });
    setIsModalOpen(true);
  };
`;

code = code.replace("  const handleDelete = ", injectCode + "\n  const handleDelete = ");
fs.writeFileSync(file, code);
