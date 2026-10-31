import React, { useState, useEffect, useRef } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "./Modal";
import { Users, Plus, Search, Pencil, Trash2, Check, X } from "lucide-react";
import { triggerSync, useLiveSync } from "../../hooks/useLiveSync";
import { useToast } from "../../contexts/ToastContext";

interface LabourItem {
  id: number;
  name: string;
  mobile?: string | null;
  workType?: string | null;
  dailyRate?: number | string | null;
  teamId?: number | null;
  locationId: number;
}

interface ManageLabourModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationId: number;
  onSelectLabour?: (labour: LabourItem) => void;
  currentSelectedId?: number | string;
}

export function ManageLabourModal({
  isOpen,
  onClose,
  locationId,
  onSelectLabour,
  currentSelectedId
}: ManageLabourModalProps) {
  const { showToast, confirmAction } = useToast();
  const [labourList, setLabourList] = useState<LabourItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Single field state for Labour / Worker name
  const [labourName, setLabourName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const loadLabour = async () => {
    if (!locationId) return;
    try {
      setLoading(true);
      const res = await apiFetch(`/master/labour?locationId=${locationId}`);
      setLabourList(res || []);
    } catch (err) {
      console.error("Failed to load labour list", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLabour();
      setLabourName("");
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
    if (isOpen) loadLabour();
  }, 3500);

  const handleEditClick = (l: LabourItem) => {
    setEditingId(l.id);
    setLabourName(l.name);
    setErrorMsg("");
    setSuccessMsg("");
    inputRef.current?.focus();
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setLabourName("");
    setErrorMsg("");
  };

  const handleDeleteClick = async (id: number, name: string) => {
    const confirmed = await confirmAction({
      title: "Delete Worker",
      message: `Are you sure you want to delete worker "${name}"?`,
      confirmLabel: "Delete",
      isDanger: true
    });
    if (!confirmed) return;
    try {
      await apiFetch(`/master/labour/${id}`, { method: "DELETE" });
      triggerSync("master_labour");
      triggerSync("labour");
      if (editingId === id) {
        handleCancelEdit();
      }
      showToast("Worker deleted", "success");
      loadLabour();
    } catch (err: any) {
      showToast(err.message || "Failed to delete labour worker", "error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = labourName.trim();
    if (!trimmedName) {
      setErrorMsg("Please enter a labour / worker name");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      let savedLabour: LabourItem;
      if (editingId) {
        savedLabour = await apiFetch(`/master/labour/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: trimmedName
          })
        });
        setSuccessMsg(`Worker "${trimmedName}" updated!`);
      } else {
        savedLabour = await apiFetch(`/master/labour`, {
          method: "POST",
          body: JSON.stringify({
            locationId,
            name: trimmedName,
            dailyRate: "0",
            workType: "Worker"
          })
        });
        setSuccessMsg(`Worker "${trimmedName}" created!`);
      }

      triggerSync("master_labour");
      triggerSync("labour");
      await loadLabour();

      // If opened with onSelectLabour callback, select and close
      if (onSelectLabour) {
        onSelectLabour(savedLabour);
        onClose();
        return;
      }

      // Reset for creating multiple workers
      setLabourName("");
      setEditingId(null);
      inputRef.current?.focus();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save labour worker");
    } finally {
      setSaving(false);
    }
  };

  const filteredLabour = labourList.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shadow-xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="font-black text-slate-900 text-base">Manage Labour Worker</span>
            <p className="text-xs text-slate-500 font-medium">Create multiple workers and manage worker names</p>
          </div>
        </div>
      }
      maxWidth="lg"
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

        {successMsg && !onSelectLabour && (
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

        {/* SINGLE INPUT FORM (Labour Name only) */}
        <form onSubmit={handleSubmit} className="bg-slate-50 border border-amber-100 p-4 rounded-2xl space-y-3">
          <div>
            <label htmlFor="labour-name-input" className="block text-xs font-bold text-slate-700 mb-1.5">
              Labour / Worker Name *
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="labour-name-input"
                ref={inputRef}
                type="text"
                required
                value={labourName}
                onChange={e => setLabourName(e.target.value)}
                placeholder="Enter worker name (e.g. Mukeshbhai, Kantibhai, Raju...)"
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium shadow-xs"
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
                  disabled={saving || !labourName.trim()}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {saving ? (
                    "Saving..."
                  ) : editingId ? (
                    <>
                      <Check className="w-4 h-4" /> Update Name
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Add Labour
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* WORKER LIST WITH SEARCH & ACTIONS */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Labour Workers ({labourList.length})
            </span>
            {labourList.length > 5 && (
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search labour..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}
          </div>

          <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white shadow-xs">
            {filteredLabour.map(l => {
              const isSelected = String(currentSelectedId) === String(l.id);
              const isBeingEdited = editingId === l.id;
              return (
                <div
                  key={l.id}
                  className={`p-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors ${
                    isBeingEdited ? "bg-amber-50/60" : isSelected ? "bg-amber-50/70" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <span className="font-bold text-sm text-slate-900 truncate">
                      {l.name}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold shrink-0">
                        Selected
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onSelectLabour && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectLabour(l);
                          onClose();
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-amber-600 text-white shadow-xs"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                        }`}
                      >
                        {isSelected ? "Active" : "Select"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleEditClick(l)}
                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit Labour Name"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(l.id, l.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Labour"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredLabour.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-xs">
                {searchTerm
                  ? `No labour found matching "${searchTerm}"`
                  : "No labour workers created yet. Enter a worker name above and click Add Labour."}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
