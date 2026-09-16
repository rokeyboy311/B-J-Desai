const fs = require('fs');
const file = 'src/client/components/categories/IncomeExpenseTab.tsx';
let code = fs.readFileSync(file, 'utf8');

const importPencil = `import { Plus, Trash2, Settings2, Pencil } from "lucide-react";`;
code = code.replace(/import \{ Plus, Trash2, Settings2 \} from "lucide-react";/, importPencil);

const oldUseState = `  const [formData, setFormData] = useState({
    type: "EXPENSE",
    date: new Date().toISOString().split("T")[0],
    partyName: "",
    teamName: "",
    amount: "",
    description: "",
  });`;

const newUseState = `  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    type: "EXPENSE",
    date: new Date().toISOString().split("T")[0],
    partyName: "",
    teamName: "",
    amount: "",
    description: "",
  });`;
code = code.replace(oldUseState, newUseState);

const oldReset = `  const resetForm = () => {
    setFormData({
      type: "EXPENSE",
      date: new Date().toISOString().split("T")[0],
      partyName: "",
      teamName: "",
      amount: "",
      description: "",
    });
  };`;

const newReset = `  const resetForm = () => {
    setEditingId(null);
    setFormData({
      type: "EXPENSE",
      date: new Date().toISOString().split("T")[0],
      partyName: "",
      teamName: "",
      amount: "",
      description: "",
    });
  };

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    setFormData({
      type: record.type || "EXPENSE",
      date: record.date || new Date().toISOString().split("T")[0],
      partyName: record.partyName || "",
      teamName: record.teamName || "",
      amount: record.amount || "",
      description: record.description || "",
    });
    setIsModalOpen(true);
  };`;
code = code.replace(oldReset, newReset);

const oldSubmit = `  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/records", {
        method: "POST",
        body: JSON.stringify({ ...formData, locationId }),
      });
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error(err);
    }
  };`;

const newSubmit = `  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? \`/records/\${editingId}\` : "/records";
      const method = editingId ? "PUT" : "POST";
      await apiFetch(url, {
        method,
        body: JSON.stringify({ ...formData, locationId }),
      });
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error(err);
    }
  };`;
code = code.replace(oldSubmit, newSubmit);

const oldTableAction = `                    <button onClick={() => handleDelete(r.id)} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4" /></button>
                  </td>`;

const newTableAction = `                    <button onClick={() => handleEdit(r)} className="text-slate-400 hover:text-amber-600 p-1"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(r.id)} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4" /></button>
                  </td>`;
code = code.replace(oldTableAction, newTableAction);

code = code.replace(/title="Add Site Expense"/g, 'title={editingId ? "Edit Site Expense" : "Add Site Expense"}');
code = code.replace(/<button type="submit".*?>Save Site Expense<\/button>/g, '<button type="submit" className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-lg">{editingId ? "Update Site Expense" : "Save Site Expense"}</button>');

fs.writeFileSync(file, code);
