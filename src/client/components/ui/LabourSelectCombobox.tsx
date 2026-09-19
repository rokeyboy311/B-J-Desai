import React, { useState, useEffect, useRef, useMemo } from "react";
import { Users, Check, Plus, Search, ChevronDown, X, HardHat, Loader2 } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { triggerSync } from "../../hooks/useLiveSync";

export interface LabourWorker {
  id: number | string;
  name: string;
  dailyRate?: number | string | null;
  workType?: string | null;
  teamId?: number | null;
  teamName?: string | null;
  locationId?: number | null;
}

interface LabourSelectComboboxProps {
  workers: LabourWorker[];
  selectedId: string | number;
  selectedName?: string;
  onSelect: (worker: { id: number | string; name: string; dailyRate?: string | number | null; teamId?: number | null }) => void;
  onClear?: () => void;
  selectedTeamId?: string | number;
  locationId: number;
  onOpenManageModal?: () => void;
  placeholder?: string;
  required?: boolean;
  onWorkerCreated?: (newWorker: LabourWorker) => void;
  className?: string;
}

export function LabourSelectCombobox({
  workers,
  selectedId,
  selectedName,
  onSelect,
  onClear,
  selectedTeamId,
  locationId,
  onOpenManageModal,
  placeholder = "-- Select or type labour name --",
  required = false,
  onWorkerCreated,
  className = ""
}: LabourSelectComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find currently selected worker
  const currentWorker = useMemo(() => {
    if (selectedId) {
      const found = workers.find(w => String(w.id) === String(selectedId));
      if (found) return found;
    }
    if (selectedName) {
      const found = workers.find(w => w.name.trim().toLowerCase() === selectedName.trim().toLowerCase());
      if (found) return found;
    }
    return null;
  }, [workers, selectedId, selectedName]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter workers based on search term and optionally team
  const filteredWorkers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return workers.filter(w => {
      if (!term) return true;
      return (
        w.name.toLowerCase().includes(term) ||
        (w.teamName && w.teamName.toLowerCase().includes(term)) ||
        (w.workType && w.workType.toLowerCase().includes(term))
      );
    });
  }, [workers, searchTerm]);

  // Group or prioritize workers by team if selectedTeamId is active
  const prioritizedWorkers = useMemo(() => {
    if (!selectedTeamId) return filteredWorkers;
    const teamIdStr = String(selectedTeamId);
    const teamMembers: LabourWorker[] = [];
    const otherWorkers: LabourWorker[] = [];

    filteredWorkers.forEach(w => {
      if (w.teamId && String(w.teamId) === teamIdStr) {
        teamMembers.push(w);
      } else {
        otherWorkers.push(w);
      }
    });

    return [...teamMembers, ...otherWorkers];
  }, [filteredWorkers, selectedTeamId]);

  // Exact match check for search term
  const exactMatchExists = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return workers.some(w => w.name.trim().toLowerCase() === term);
  }, [workers, searchTerm]);

  const handleQuickAdd = async () => {
    const trimmed = searchTerm.trim();
    if (!trimmed || isCreating) return;

    try {
      setIsCreating(true);
      const teamIdNum = selectedTeamId ? parseInt(String(selectedTeamId), 10) : null;
      const created = await apiFetch("/master/labour", {
        method: "POST",
        body: JSON.stringify({
          locationId,
          name: trimmed,
          teamId: teamIdNum || null,
          dailyRate: "0",
          workType: "Worker"
        })
      });

      triggerSync("master_labour");
      triggerSync("labour");

      const newWorkerItem: LabourWorker = {
        id: created.id,
        name: created.name,
        dailyRate: created.dailyRate || "0",
        teamId: created.teamId || null,
        locationId
      };

      if (onWorkerCreated) {
        onWorkerCreated(newWorkerItem);
      }

      onSelect({
        id: created.id,
        name: created.name,
        dailyRate: created.dailyRate || "0",
        teamId: created.teamId || null
      });

      setSearchTerm("");
      setIsOpen(false);
    } catch (err: any) {
      alert("Failed to quick add labour: " + (err.message || "Unknown error"));
    } finally {
      setIsCreating(false);
    }
  };

  const displayName = currentWorker ? currentWorker.name : (selectedName || "");

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button / Box */}
      <div
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
          }
        }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm bg-slate-50 border rounded-lg cursor-pointer transition-all shadow-xs ${
          isOpen ? "border-amber-500 ring-2 ring-amber-500/20 bg-white" : "border-slate-200 hover:border-slate-300"
        } ${!displayName && required ? "border-dashed" : ""}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Users className={`w-4 h-4 shrink-0 ${displayName ? "text-amber-600" : "text-slate-400"}`} />
          {displayName ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-slate-900 truncate">{displayName}</span>
              {currentWorker?.dailyRate && Number(currentWorker.dailyRate) > 0 && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.2 rounded shrink-0">
                  ₹{Number(currentWorker.dailyRate).toLocaleString()}/day
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 text-sm select-none">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {displayName && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onClear) onClear();
                setSearchTerm("");
              }}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Bar */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!exactMatchExists && searchTerm.trim()) {
                      handleQuickAdd();
                    } else if (prioritizedWorkers.length > 0) {
                      const first = prioritizedWorkers[0];
                      onSelect({
                        id: first.id,
                        name: first.name,
                        dailyRate: first.dailyRate,
                        teamId: first.teamId
                      });
                      setIsOpen(false);
                      setSearchTerm("");
                    }
                  }
                }}
                placeholder="Search or type worker name..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium"
              />
            </div>
          </div>

          {/* Quick Add Button if typed name doesn't match */}
          {searchTerm.trim() && !exactMatchExists && (
            <div className="p-2 bg-amber-50 border-b border-amber-100">
              <button
                type="button"
                disabled={isCreating}
                onClick={handleQuickAdd}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Adding labour...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Quick Add & Select &quot;{searchTerm.trim()}&quot;</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Workers List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
            {prioritizedWorkers.map((w) => {
              const isSelected = String(w.id) === String(selectedId) || (displayName && w.name.trim().toLowerCase() === displayName.trim().toLowerCase());
              const isTeamMember = selectedTeamId && w.teamId && String(w.teamId) === String(selectedTeamId);

              return (
                <div
                  key={w.id}
                  onClick={() => {
                    onSelect({
                      id: w.id,
                      name: w.name,
                      dailyRate: w.dailyRate,
                      teamId: w.teamId
                    });
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                  className={`px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-amber-50/70 cursor-pointer transition-colors ${
                    isSelected ? "bg-amber-50 font-bold" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? "bg-amber-600" : isTeamMember ? "bg-blue-500" : "bg-slate-300"}`} />
                    <span className={`text-xs truncate ${isSelected ? "text-amber-900 font-black" : "text-slate-800"}`}>
                      {w.name}
                    </span>
                    {w.teamName ? (
                      <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-medium shrink-0 flex items-center gap-0.5">
                        <HardHat className="w-2.5 h-2.5 text-slate-400" />
                        {w.teamName}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {w.dailyRate && Number(w.dailyRate) > 0 ? (
                      <span className="text-[10px] font-semibold text-slate-500">
                        ₹{Number(w.dailyRate).toLocaleString()}
                      </span>
                    ) : null}
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-600" />}
                  </div>
                </div>
              );
            })}

            {prioritizedWorkers.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-xs text-slate-400">
                  {searchTerm ? `No labour worker matching "${searchTerm}"` : "No registered labour workers found."}
                </p>
                {searchTerm.trim() ? null : (
                  <p className="text-[11px] text-amber-700 font-semibold mt-1">
                    Type a worker name above to quick-add, or use Manage Labour.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer with Manage Labour Modal Link */}
          {onOpenManageModal && (
            <div className="p-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px] font-medium">
                {workers.length} {workers.length === 1 ? "worker" : "workers"} in master
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenManageModal();
                }}
                className="text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Manage All Labour
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
