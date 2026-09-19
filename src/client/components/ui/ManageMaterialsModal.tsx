import React, { useState, useEffect, useRef } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "./Modal";
import { Package, Plus, Search, Pencil, Trash2, Check, X, Sparkles } from "lucide-react";
import { triggerSync, useLiveSync } from "../../hooks/useLiveSync";
import { useToast } from "../../contexts/ToastContext";

interface MaterialItem {
  id: number;
  name: string;
  category?: string | null;
  defaultUnit?: string | null;
  defaultRate?: string | number | null;
  minStock?: string | number | null;
  notes?: string | null;
  locationId: number;
}

interface ManageMaterialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationId: number;
  onSelectMaterial?: (material: MaterialItem) => void;
  currentSelectedId?: number | string;
}

export function ManageMaterialsModal({
  isOpen,
  onClose,
  locationId,
  onSelectMaterial,
  currentSelectedId
}: ManageMaterialsModalProps) {
  const { showToast, confirmAction } = useToast();
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Single field state
  const [materialName, setMaterialName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const loadMaterials = async () => {
    if (!locationId) return;
    try {
      setLoading(true);
      const res = await apiFetch(`/master/materials?locationId=${locationId}`);
      setMaterials(res || []);
    } catch (err) {
      console.error("Failed to load materials", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMaterials();
      setMaterialName("");
      setEditingId(null);
      setErrorMsg("");
      setSuccessMsg("");
      setSearchTerm("");
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, locationId]);

  useLiveSync(() => {
    if (isOpen) loadMaterials();
  }, 3500);

  const handleEditClick = (mat: MaterialItem) => {
    setEditingId(mat.id);
    setMaterialName(mat.name);
    setErrorMsg("");
    setSuccessMsg("");
    inputRef.current?.focus();
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setMaterialName("");
    setErrorMsg("");
  };

  const handleDeleteClick = async (id: number, name: string) => {
    const confirmed = await confirmAction({
      title: "Delete Material",
      message: `Are you sure you want to delete material "${name}"?`,
      confirmLabel: "Delete",
      isDanger: true
    });
    if (!confirmed) return;
    try {
      await apiFetch(`/master/materials/${id}`, { method: "DELETE" });
      triggerSync("master_materials");
      triggerSync("materials");
      if (editingId === id) {
        handleCancelEdit();
      }
      showToast("Material deleted", "success");
      loadMaterials();
    } catch (err: any) {
      showToast(err.message || "Failed to delete material", "error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = materialName.trim();
    if (!trimmedName) {
      setErrorMsg("Please enter a material name");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      let savedMaterial: MaterialItem;
      if (editingId) {
        savedMaterial = await apiFetch(`/master/materials/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: trimmedName
          })
        });
        setSuccessMsg(`Material "${trimmedName}" updated!`);
      } else {
        savedMaterial = await apiFetch(`/master/materials`, {
          method: "POST",
          body: JSON.stringify({
            locationId,
            name: trimmedName
          })
        });
        setSuccessMsg(`Material "${trimmedName}" added successfully!`);
      }

      triggerSync("master_materials");
      triggerSync("materials");
      await loadMaterials();
      
      // If modal was opened with onSelectMaterial (e.g. from an active form), automatically select and close
      if (onSelectMaterial) {
        onSelectMaterial(savedMaterial);
        onClose();
        return;
      }

      // Otherwise reset input for fast continuous addition
      setMaterialName("");
      setEditingId(null);
      inputRef.current?.focus();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save material");
    } finally {
      setSaving(false);
    }
  };

  const filteredMaterials = materials.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl shadow-xs">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="font-black text-slate-900 text-base">Manage Material</span>
            <p className="text-xs text-slate-500 font-medium">Quickly add or manage material names</p>
          </div>
        </div>
      }
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Alerts */}
        {errorMsg && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center justify-between">
            <span>{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg("")} className="text-rose-400 hover:text-rose-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMsg && !onSelectMaterial && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button type="button" onClick={() => setSuccessMsg("")} className="text-emerald-400 hover:text-emerald-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* SINGLE INPUT FORM */}
        <form onSubmit={handleSubmit} className="bg-slate-50 border border-indigo-100 p-4 rounded-2xl space-y-3">
          <div>
            <label htmlFor="material-name-input" className="block text-xs font-bold text-slate-700 mb-1.5">
              Material Name *
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="material-name-input"
                ref={inputRef}
                type="text"
                required
                value={materialName}
                onChange={e => setMaterialName(e.target.value)}
                placeholder="Enter material name (e.g. Cement, Steel 12mm, Sand, Bricks...)"
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium shadow-xs"
                autoComplete="off"
              />
              <div className="flex gap-2 shrink-0">
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-3.5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving || !materialName.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {saving ? (
                    "Saving..."
                  ) : editingId ? (
                    <>
                      <Check className="w-4 h-4" /> Update Material
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Add Material
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* MATERIAL LIST WITH SEARCH */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Material Names ({materials.length})
            </span>
            {materials.length > 5 && (
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search name..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white shadow-xs">
            {filteredMaterials.map(mat => {
              const isSelected = String(currentSelectedId) === String(mat.id);
              const isBeingEdited = editingId === mat.id;
              return (
                <div
                  key={mat.id}
                  className={`p-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors ${
                    isBeingEdited ? "bg-amber-50/60" : isSelected ? "bg-indigo-50/70" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                    <span className="font-bold text-sm text-slate-900 truncate">
                      {mat.name}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold shrink-0">
                        Selected
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onSelectMaterial && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectMaterial(mat);
                          onClose();
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        }`}
                      >
                        {isSelected ? "Active" : "Select"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleEditClick(mat)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit Material Name"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(mat.id, mat.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Material"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredMaterials.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-xs">
                {searchTerm
                  ? `No material found matching "${searchTerm}"`
                  : "No materials added yet. Enter a material name above and click Add Material."}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
