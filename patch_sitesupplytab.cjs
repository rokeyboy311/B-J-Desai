const fs = require('fs');
const file = 'src/client/components/categories/SiteSupplyTab.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/import \{ Modal \} from "\.\.\/ui\/Modal";/g, 'import { Modal } from "../ui/Modal";\nimport { Pencil } from "lucide-react";');

const oldUseState = `  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    teamId: "",
    materialId: "",
    quantity: "",
    rate: "", // Optional, as it's internal
    description: "",
  });`;

const newUseState = `  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    teamId: "",
    materialId: "",
    quantity: "",
    rate: "0",
    description: "",
  });`;
code = code.replace(oldUseState, newUseState);

const oldLoad = `        // Note: API for site supply might be different, let's assume /site-supply
        apiFetch(\`/materials/labour-supply?locationId=\${locationId}\`).catch(() => []),`;

const newLoad = `        apiFetch(\`/site-supplies?locationId=\${locationId}\`).catch(() => []),`;
code = code.replace(oldLoad, newLoad);

const oldHandleSubmit = `  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const team = teams.find(t => t.id.toString() === formData.teamId);
      const material = materials.find(m => m.id.toString() === formData.materialId);

      await apiFetch("/materials/labour-supply", {
        method: "POST", 
        body: JSON.stringify({
          ...formData,
          teamName: team ? team.name : "",
          materialName: material ? material.name : "",
          unit: material?.defaultUnit || 'Nos',
          locationId
        }),
      });
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error("Failed to save supply:", err);
    }
  };`;

const newHandleSubmit = `  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? \`/site-supplies/\${editingId}\` : "/site-supplies";
      const method = editingId ? "PUT" : "POST";

      await apiFetch(url, {
        method, 
        body: JSON.stringify({
          locationId,
          date: formData.date,
          teamId: formData.teamId ? parseInt(formData.teamId) : null,
          notes: formData.description,
          items: [{
            materialId: parseInt(formData.materialId),
            quantity: formData.quantity,
            rate: formData.rate || 0
          }]
        }),
      });
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error("Failed to save supply:", err);
    }
  };`;
code = code.replace(oldHandleSubmit, newHandleSubmit);

const oldReset = `  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split("T")[0],
      teamId: "",
      materialId: "",
      quantity: "",
      rate: "",
      description: "",
    });
  };`;

const newReset = `  const resetForm = () => {
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      teamId: "",
      materialId: "",
      quantity: "",
      rate: "0",
      description: "",
    });
  };

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    const item = record.items?.[0] || {};
    setFormData({
      date: record.date || new Date().toISOString().split("T")[0],
      teamId: record.teamId?.toString() || "",
      materialId: item.materialId?.toString() || "",
      quantity: item.quantity || "",
      rate: item.rate || "0",
      description: record.notes || "",
    });
    setIsModalOpen(true);
  };`;
code = code.replace(oldReset, newReset);

code = code.replace(/apiFetch\(\`\/materials\/labour-supply\/\$\{id\}\`/g, 'apiFetch(`/site-supplies/${id}`');

const oldTableRows = `                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="p-3 text-slate-600">{r.date}</td>
                  <td className="p-3">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5"><HardHat className="w-3.5 h-3.5 text-teal-600" /> {r.teamName || r.partyName || "-"}</div>
                  </td>
                  <td className="p-3 text-teal-700 font-semibold">{r.materialName}</td>
                  <td className="p-3 text-right font-bold">{r.quantity} {r.unit}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => handleDelete(r.id)} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>`;

const newTableRows = `                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="p-3 text-slate-600">{r.date}</td>
                  <td className="p-3">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5"><HardHat className="w-3.5 h-3.5 text-teal-600" /> {teams.find(t => t.id === r.teamId)?.name || "-"}</div>
                  </td>
                  <td className="p-3 text-teal-700 font-semibold">{r.items?.[0] ? materials.find(m => m.id === r.items[0].materialId)?.name : '-'}</td>
                  <td className="p-3 text-right font-bold">{r.items?.[0]?.quantity} {materials.find(m => m.id === r.items?.[0]?.materialId)?.defaultUnit}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => handleEdit(r)} className="text-slate-400 hover:text-amber-600 p-1"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(r.id)} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>`;
code = code.replace(oldTableRows, newTableRows);

code = code.replace(/title="Issue Material to Site Labour"/g, 'title={editingId ? "Edit Site Supply" : "Issue Material to Site Labour"}');
code = code.replace(/<button type="submit".*?>Issue Supply & Deduct Stock<\/button>/g, '<button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-lg">{editingId ? "Update Supply" : "Issue Supply & Deduct Stock"}</button>');

fs.writeFileSync(file, code);
