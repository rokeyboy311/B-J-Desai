import re

def patch_file(filepath, label):
    with open(filepath, "r") as f:
        content = f.read()
    
    # 1. Add Pencil to imports
    content = content.replace("Trash2, Eye, IndianRupee", "Trash2, Eye, IndianRupee, Pencil")

    # 2. Add editingId state
    state_anchor = "const [isDetailsOpen, setIsDetailsOpen] = useState(false);"
    state_addition = "\n  const [editingId, setEditingId] = useState<number | null>(null);"
    content = content.replace(state_anchor, state_anchor + state_addition)

    # 3. Update handleSubmit
    submit_target = """  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/materials/""" + label + """", {
        method: "POST","""
    submit_replacement = """  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/materials/""" + label + """/${editingId}` : "/materials/""" + label + """";
      const method = editingId ? "PUT" : "POST";
      await apiFetch(url, {
        method, """
    content = content.replace(submit_target, submit_replacement)

    # 4. Handle Modal Title
    modal_target = f'<Modal isOpen={{isModalOpen}} onClose={{() => setIsModalOpen(false)}} title="Add Material {label.capitalize()}">'
    modal_replacement = f'<Modal isOpen={{isModalOpen}} onClose={{() => setIsModalOpen(false)}} title={{editingId ? "Edit Material {label.capitalize()}" : "Add Material {label.capitalize()}"}}>'
    content = content.replace(modal_target, modal_replacement)

    # 5. Handle resetForm to also reset editingId
    reset_target = "const resetForm = () => {"
    reset_replacement = "const resetForm = () => {\n    setEditingId(null);"
    content = content.replace(reset_target, reset_replacement)

    # 6. Open Modal Button (Add New) -> should clear editingId
    add_btn_target = "setIsModalOpen(true)"
    # We want to replace only the first occurrence or specific one where it's used to add.
    # Actually, in the JSX: <button onClick={() => { resetForm(); setIsModalOpen(true); }}
    add_btn_target2 = """onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}"""
    # this might be different. Let's look for "resetForm();"
    # Just setting editingId(null) inside resetForm is enough!

    # 7. Add handleEdit function
    handle_edit = """
  const handleEdit = (record: any) => {
    setEditingId(record.id);
    let unitM = "Custom";
    let custU = record.unit || "";
    if (PRESET_UNITS.includes(record.unit)) {
      unitM = record.unit;
      custU = "";
    }
    setUnitMode(unitM);
    setCustomUnit(custU);

    setFormData({
      date: record.date || new Date().toISOString().split("T")[0],
      partyName: record.partyName || "",
      materialName: record.materialName || "",
      quantity: record.quantity || "",
      rate: record.rate || "",
      transportCost: record.transportCost || "",
      discount: record.discount || "",
      taxPercentage: record.taxPercentage || "",
      paymentStatus: record.paymentStatus || "UNPAID",
      paymentMethod: record.paymentMethod || "BANK",
      referenceNumber: record.referenceNumber || "",
      description: record.description || ""
    });
    setIsModalOpen(true);
  };
"""
    content = content.replace("const handleDelete =", handle_edit + "\n  const handleDelete =")

    # 8. Add Pencil icon in the table
    action_target = """<button 
                            onClick={() => {
                              setSelectedRecord(r);
                              setIsDetailsOpen(true);
                            }}
                            className="p-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>"""
    action_replacement = action_target + """
                          <button 
                            onClick={() => handleEdit(r)}
                            className="p-1.5 text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>"""
    content = content.replace(action_target, action_replacement)

    # Write back
    with open(filepath, "w") as f:
        f.write(content)

patch_file("src/client/components/categories/MaterialPurchaseTab.tsx", "purchase")
patch_file("src/client/components/categories/MaterialSupplyTab.tsx", "supply")

