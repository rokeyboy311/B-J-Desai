import React, { useState, useEffect, useRef } from "react";
import { apiFetch } from "../../lib/api";
import { Modal } from "./Modal";
import { HardHat, Plus, Search, Pencil, Trash2, Check, X } from "lucide-react";
import { triggerSync, useLiveSync } from "../../hooks/useLiveSync";
import { useToast } from "../../contexts/ToastContext";

interface TeamItem {
  id: number;
  name: string;
  phone?: string | null;
  locationId: number;
}

interface ManageTeamsModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationId: number;
  onSelectTeam?: (team: TeamItem) => void;
  currentSelectedId?: number | string;
}

export function ManageTeamsModal({
  isOpen,
  onClose,
  locationId,
  onSelectTeam,
  currentSelectedId
}: ManageTeamsModalProps) {
  const { showToast, confirmAction } = useToast();
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Single field state for team name
  const [teamName, setTeamName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const loadTeams = async () => {
    if (!locationId) return;
    try {
      setLoading(true);
      const res = await apiFetch(`/master/teams?locationId=${locationId}`);
      setTeams(res || []);
    } catch (err) {
      console.error("Failed to load teams", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTeams();
      setTeamName("");
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
    if (isOpen) loadTeams();
  }, 3500);

  const handleEditClick = (t: TeamItem) => {
    setEditingId(t.id);
    setTeamName(t.name);
    setErrorMsg("");
    setSuccessMsg("");
    inputRef.current?.focus();
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTeamName("");
    setErrorMsg("");
  };

  const handleDeleteClick = async (id: number, name: string) => {
    const confirmed = await confirmAction({
      title: "Delete Team",
      message: `Are you sure you want to delete team "${name}"?`,
      confirmLabel: "Delete",
      isDanger: true
    });
    if (!confirmed) return;
    try {
      await apiFetch(`/master/teams/${id}`, { method: "DELETE" });
      triggerSync("master_teams");
      triggerSync("teams");
      if (editingId === id) {
        handleCancelEdit();
      }
      showToast("Team deleted", "success");
      loadTeams();
    } catch (err: any) {
      showToast(err.message || "Failed to delete team", "error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = teamName.trim();
    if (!trimmedName) {
      setErrorMsg("Please enter a team name");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      let savedTeam: TeamItem;
      if (editingId) {
        savedTeam = await apiFetch(`/master/teams/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: trimmedName
          })
        });
        setSuccessMsg(`Team "${trimmedName}" updated!`);
      } else {
        savedTeam = await apiFetch(`/master/teams`, {
          method: "POST",
          body: JSON.stringify({
            locationId,
            name: trimmedName
          })
        });
        setSuccessMsg(`Team "${trimmedName}" created!`);
      }

      triggerSync("master_teams");
      triggerSync("teams");
      await loadTeams();

      // If opened with onSelectTeam callback, select and close
      if (onSelectTeam) {
        onSelectTeam(savedTeam);
        onClose();
        return;
      }

      // Reset for creating multiple teams
      setTeamName("");
      setEditingId(null);
      inputRef.current?.focus();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save team");
    } finally {
      setSaving(false);
    }
  };

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-teal-100 text-teal-700 rounded-xl shadow-xs">
            <HardHat className="w-5 h-5" />
          </div>
          <div>
            <span className="font-black text-slate-900 text-base">Manage Labour Team</span>
            <p className="text-xs text-slate-500 font-medium">Create multiple teams and manage team names</p>
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

        {successMsg && !onSelectTeam && (
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

        {/* SINGLE INPUT FORM (Team Name only) */}
        <form onSubmit={handleSubmit} className="bg-slate-50 border border-teal-100 p-4 rounded-2xl space-y-3">
          <div>
            <label htmlFor="team-name-input" className="block text-xs font-bold text-slate-700 mb-1.5">
              Team Name *
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="team-name-input"
                ref={inputRef}
                type="text"
                required
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="Enter team name (e.g. Ramesh Mason Team, RCC Slab Team...)"
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-medium shadow-xs"
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
                  disabled={saving || !teamName.trim()}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {saving ? (
                    "Saving..."
                  ) : editingId ? (
                    <>
                      <Check className="w-4 h-4" /> Update Team
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Add Team
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* TEAM LIST WITH SEARCH & ACTIONS */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Labour Teams ({teams.length})
            </span>
            {teams.length > 5 && (
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search team..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-teal-500"
                />
              </div>
            )}
          </div>

          <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white shadow-xs">
            {filteredTeams.map(t => {
              const isSelected = String(currentSelectedId) === String(t.id);
              const isBeingEdited = editingId === t.id;
              return (
                <div
                  key={t.id}
                  className={`p-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors ${
                    isBeingEdited ? "bg-amber-50/60" : isSelected ? "bg-teal-50/70" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                    <span className="font-bold text-sm text-slate-900 truncate">
                      {t.name}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-bold shrink-0">
                        Selected
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onSelectTeam && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTeam(t);
                          onClose();
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-teal-600 text-white shadow-xs"
                            : "bg-teal-50 text-teal-700 hover:bg-teal-100"
                        }`}
                      >
                        {isSelected ? "Active" : "Select"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleEditClick(t)}
                      className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit Team Name"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(t.id, t.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Team"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredTeams.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-xs">
                {searchTerm
                  ? `No team found matching "${searchTerm}"`
                  : "No teams created yet. Enter a team name above and click Add Team."}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
