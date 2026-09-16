const fs = require('fs');
const file = 'src/client/components/categories/MaterialSupplyTab.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldReset = `  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split("T")[0],
      partyId: "",
      materialId: "",
      quantity: "",
      rate: "",
      taxPercentage: "18",
      transportCost: "0",
      discount: "0",
      referenceNumber: "",
      description: "",
      unit: "Nos"
    });
  };`;

const newReset = `  const resetForm = () => {
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      partyId: "",
      materialId: "",
      quantity: "",
      rate: "",
      taxPercentage: "18",
      transportCost: "0",
      discount: "0",
      referenceNumber: "",
      description: "",
      unit: "Nos"
    });
  };

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
  };`;
code = code.replace(oldReset, newReset);

const oldTableActions = `                  <td className="p-3 text-center">
                    <button onClick={() => handleDelete(r.id)} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4" /></button>
                  </td>`;

const newTableActions = `                  <td className="p-3 text-center">
                    <button onClick={() => handleEdit(r)} className="text-slate-400 hover:text-amber-600 p-1"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(r.id)} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4" /></button>
                  </td>`;
code = code.replace(oldTableActions, newTableActions);

code = code.replace(/title="Add Supply \(GST Bill\)"/g, 'title={editingId ? "Edit Supply" : "Add Supply (GST Bill)"}');
code = code.replace(/<button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-lg">Save External Supply<\/button>/g, '<button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-lg">{editingId ? "Update External Supply" : "Save External Supply"}</button>');

fs.writeFileSync(file, code);
