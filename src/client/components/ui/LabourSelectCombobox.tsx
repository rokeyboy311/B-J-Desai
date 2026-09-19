import React, { useState, useEffect, useRef, useMemo } from "react";
import { Users, Check, Plus, ChevronDown, X, HardHat, Loader2, Sparkles } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { triggerSync } from "../../hooks/useLiveSync";
import { useToast } from "../../contexts/ToastContext";

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
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal input value with incoming props
  useEffect(() => {
    if (selectedId) {
      const found = workers.find(w => String(w.id) === String(selectedId));
      if (found) {
        setInputValue(found.name);
        return;
      }
    }
    if (selectedName !== undefined) {
      setInputValue(selectedName || "");
    }
  }, [selectedId, selectedName, workers]);

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

  // Find currently matched worker by ID or exact Name
  const matchedWorker = useMemo(() => {
    if (selectedId) {
      const found = workers.find(w => String(w.id) === String(selectedId));
      if (found) return found;
    }
    if (inputValue.trim()) {
      const found = workers.find(w => w.name.trim().toLowerCase() === inputValue.trim().toLowerCase());
      if (found) return found;
    }
    return null;
  }, [workers, selectedId, inputValue]);

  // Filter workers based on input
  const filteredWorkers = useMemo(() => {
    const term = inputValue.trim().toLowerCase();
    if (!term) return workers;
    return workers.filter(w => {
      return (
        w.name.toLowerCase().includes(term) ||
        (w.teamName && w.teamName.toLowerCase().includes(term)) ||
        (w.workType && w.workType.toLowerCase().includes(term))
      );
    });
  }, [workers, inputValue]);

  // Group into team members vs others if selectedTeamId is active
  const { teamMembers, otherWorkers } = useMemo(() => {
    if (!selectedTeamId) {
      return { teamMembers: [], otherWorkers: filteredWorkers };
    }
    const teamIdStr = String(selectedTeamId);
    const members: LabourWorker[] = [];
    const others: LabourWorker[] = [];

    filteredWorkers.forEach(w => {
      if (w.teamId && String(w.teamId) === teamIdStr) {
        members.push(w);
      } else {
        others.push(w);
      }
    });

    return { teamMembers: members, otherWorkers: others };
  }, [filteredWorkers, selectedTeamId]);

  // Check if current typed input is already an exact match in workers
  const isExactMatch = useMemo(() => {
    const term = inputValue.trim().toLowerCase();
    if (!term) return false;
    return workers.some(w => w.name.trim().toLowerCase() === term);
  }, [workers, inputValue]);

  // When user types in the input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setIsOpen(true);

    // Look for immediate exact or close match
    const match = workers.find(w => w.name.trim().toLowerCase() === val.trim().toLowerCase());
    if (match) {
      onSelect({
        id: match.id,
        name: match.name,
        dailyRate: match.dailyRate,
        teamId: match.teamId
      });
    } else {
      // Pass typed name directly so attendance submission works even for new names!
      onSelect({
        id: "",
        name: val,
        dailyRate: "",
        teamId: selectedTeamId ? Number(selectedTeamId) : null
      });
    }
  };

  // When user selects a worker from dropdown
  const handleSelectWorker = (worker: LabourWorker) => {
    setInputValue(worker.name);
    setIsOpen(false);
    onSelect({
      id: worker.id,
      name: worker.name,
      dailyRate: worker.dailyRate,
      teamId: worker.teamId
    });
  };

  // Clear button handler
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInputValue("");
    setIsOpen(false);
    if (onClear) onClear();
    else onSelect({ id: "", name: "", dailyRate: "", teamId: null });
    inputRef.current?.focus();
  };

  // Quick Add to Master
  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const trimmed = inputValue.trim();
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
        teamName: created.teamName || null,
        workType: "Worker",
        locationId
      };

      if (onWorkerCreated) {
        onWorkerCreated(newWorkerItem);
      }

      handleSelectWorker(newWorkerItem);
      showToast(`Labour worker "${trimmed}" added to master!`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to add labour worker", "error");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Hidden input for HTML5 form validation if required */}
      {required && (
        <input
          type="text"
          value={inputValue}
          required={required}
          onChange={() => {}}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      {/* Main Input Field */}
      <div
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm bg-slate-50 border rounded-lg transition-all shadow-xs ${
          isOpen ? "border-amber-500 ring-2 ring-amber-500/20 bg-white" : "border-slate-200 hover:border-slate-300"
        } ${!inputValue && required ? "border-dashed" : ""}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Users className={`w-4 h-4 shrink-0 ${inputValue ? "text-amber-600" : "text-slate-400"}`} />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 font-medium focus:outline-none text-sm"
          />
          {matchedWorker?.dailyRate && Number(matchedWorker.dailyRate) > 0 && (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded shrink-0 select-none">
              ₹{Number(matchedWorker.dailyRate).toLocaleString()}/day
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsOpen(!isOpen);
              if (!isOpen) inputRef.current?.focus();
            }}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-transform"
            title="Toggle list"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${isOpen ? "rotate-180 text-amber-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-72 flex flex-col">
          {/* Quick Add Banner if typed name is not registered in master */}
          {inputValue.trim() && !isExactMatch && (
            <div className="p-2 bg-amber-50/90 border-b border-amber-100 flex items-center justify-between gap-2 shrink-0">
              <div className="text-[11px] text-amber-900 font-medium truncate">
                New worker: <span className="font-bold">&quot;{inputValue.trim()}&quot;</span>
              </div>
              <button
                type="button"
                disabled={isCreating}
                onClick={handleQuickAdd}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3" />
                    <span>Add to Master</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Workers List Container */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
            {/* Team Members Section if team is selected */}
            {selectedTeamId && teamMembers.length > 0 && (
              <div>
                <div className="px-3 py-1.5 bg-amber-500/10 text-amber-900 font-bold text-[10px] tracking-wider uppercase flex items-center gap-1">
                  <HardHat className="w-3 h-3 text-amber-700" />
                  Selected Team Members ({teamMembers.length})
                </div>
                {teamMembers.map(w => renderWorkerItem(w, true))}
              </div>
            )}

            {/* Other Workers Section */}
            {otherWorkers.length > 0 && (
              <div>
                {selectedTeamId && teamMembers.length > 0 && (
                  <div className="px-3 py-1.5 bg-slate-100/80 text-slate-600 font-bold text-[10px] tracking-wider uppercase">
                    All Other Workers ({otherWorkers.length})
                  </div>
                )}
                {otherWorkers.map(w => renderWorkerItem(w, false))}
              </div>
            )}

            {/* Empty State */}
            {filteredWorkers.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-xs text-slate-500 font-medium">
                  {inputValue.trim()
                    ? `No existing worker matches "${inputValue.trim()}".`
                    : "No labour workers registered yet."}
                </p>
                {inputValue.trim() ? (
                  <p className="text-[11px] text-amber-800 font-medium mt-1">
                    You can still use this name for attendance or click &quot;Add to Master&quot; above.
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-800 font-medium mt-1">
                    Type a worker name above to select or add them.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer with Manage Labour Shortcut */}
          {onOpenManageModal && (
            <div className="p-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-400 text-[11px] font-medium">
                {workers.length} {workers.length === 1 ? "worker" : "workers"} in directory
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenManageModal();
                }}
                className="text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 hover:underline cursor-pointer text-xs"
              >
                <Sparkles className="w-3 h-3" /> Manage Directory
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  function renderWorkerItem(w: LabourWorker, isTeamMember: boolean) {
    const isSelected =
      String(w.id) === String(selectedId) ||
      (inputValue.trim() && w.name.trim().toLowerCase() === inputValue.trim().toLowerCase());

    return (
      <div
        key={w.id}
        onMouseDown={(e) => {
          // Use onMouseDown so it fires before onBlur / click-outside
          e.preventDefault();
          handleSelectWorker(w);
        }}
        className={`px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-amber-50/80 cursor-pointer transition-colors ${
          isSelected ? "bg-amber-50/90 font-bold" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isSelected ? "bg-amber-600" : isTeamMember ? "bg-blue-500" : "bg-slate-300"
            }`}
          />
          <span className={`text-xs truncate ${isSelected ? "text-amber-950 font-black" : "text-slate-800"}`}>
            {w.name}
          </span>
          {w.teamName ? (
            <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded font-medium shrink-0 flex items-center gap-0.5">
              <HardHat className="w-2.5 h-2.5 text-slate-400" />
              {w.teamName}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {w.dailyRate && Number(w.dailyRate) > 0 ? (
            <span className="text-[10px] font-semibold text-slate-500">
              ₹{Number(w.dailyRate).toLocaleString()}/day
            </span>
          ) : null}
          {isSelected && <Check className="w-3.5 h-3.5 text-amber-600" />}
        </div>
      </div>
    );
  }
}
