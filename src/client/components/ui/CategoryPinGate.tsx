import React, { useState, useEffect } from "react";
import { Lock, Unlock, KeyRound, ShieldAlert, ArrowRight, CheckCircle2 } from "lucide-react";
import { apiFetch, setStoredCategoryPinToken, clearStoredCategoryPinToken, invalidateClientApiCache } from "../../lib/api";
import { triggerGlobalSync } from "../../hooks/useLiveSync";

interface CategoryPinGateProps {
  categoryName: string;
  categoryNumber: number;
  children: React.ReactNode;
}

const CATEGORY_UNLOCKED_SESSION_KEY = "bd_erp_category_pin_unlocked";

export function isCategoryUnlocked(): boolean {
  try {
    return sessionStorage.getItem(CATEGORY_UNLOCKED_SESSION_KEY) === "true";
  } catch (e) {
    return false;
  }
}

export function setCategoryUnlocked(unlocked: boolean): void {
  try {
    if (unlocked) {
      sessionStorage.setItem(CATEGORY_UNLOCKED_SESSION_KEY, "true");
    } else {
      sessionStorage.removeItem(CATEGORY_UNLOCKED_SESSION_KEY);
      clearStoredCategoryPinToken();
    }
  } catch (e) {
    console.warn("Failed to set category unlock status in sessionStorage", e);
  }
}

export default function CategoryPinGate({
  categoryName,
  categoryNumber,
  children
}: CategoryPinGateProps) {
  const [unlocked, setUnlocked] = useState<boolean>(() => isCategoryUnlocked());
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setUnlocked(isCategoryUnlocked());
  }, []);

  const handleVerifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin || pin.length < 4) {
      setErrorMsg("Please enter a valid PIN");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await apiFetch("/auth/verify-category-pin", {
        method: "POST",
        body: JSON.stringify({ pin: pin.trim() })
      });

      if (res && res.verified) {
        if (res.categoryToken) {
          setStoredCategoryPinToken(res.categoryToken);
        }
        setCategoryUnlocked(true);
        setUnlocked(true);
        setPin("");
        invalidateClientApiCache();
        triggerGlobalSync();
      } else {
        setErrorMsg(res?.error || "Incorrect Category PIN. Access denied.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Incorrect Category PIN. Access denied.");
    } finally {
      setLoading(false);
    }
  };

  const handleLock = () => {
    clearStoredCategoryPinToken();
    setCategoryUnlocked(false);
    setUnlocked(false);
    setPin("");
    setErrorMsg("");
  };

  if (unlocked) {
    return (
      <div className="space-y-4">
        {/* Subtle Category Security Banner */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">
              Category {categoryNumber} ({categoryName}) — PIN Verified & Unlocked
            </span>
          </div>
          <button
            type="button"
            onClick={handleLock}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg border border-emerald-200 transition-colors cursor-pointer shadow-2xs"
            title="Lock Category again"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock</span>
          </button>
        </div>

        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 max-w-md mx-auto text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-inner">
        <Lock className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <h3 className="text-xl font-black text-slate-900 tracking-tight">
          Protected Category
        </h3>
        <p className="text-xs text-slate-500 font-medium">
          Category {categoryNumber} ({categoryName}) contains confidential financial records. Please enter your authorized PIN to view and manage details.
        </p>
      </div>

      {errorMsg && (
        <div className="w-full p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2 text-left">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleVerifyPin} className="w-full space-y-4">
        <div className="relative flex items-center">
          <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
          <input
            type="password"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              if (errorMsg) setErrorMsg("");
            }}
            placeholder="Enter Security Password..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-inner"
            autoFocus
          />
        </div>

        <button
          type="submit"
          disabled={loading || !pin}
          className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            "Verifying from Database..."
          ) : (
            <>
              <Unlock className="w-4 h-4" /> Unlock Category
            </>
          )}
        </button>
      </form>
    </div>
  );
}
