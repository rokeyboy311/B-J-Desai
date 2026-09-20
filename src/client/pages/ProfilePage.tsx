import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../lib/api";
import { User, Mail, Lock, LogOut, AlertCircle, CheckCircle2, Shield, KeyRound, Clock, Activity, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const { user, lockApp } = useAuth();
  const navigate = useNavigate();

  // Master PIN change form
  const [currentMasterPin, setCurrentMasterPin] = useState("");
  const [newMasterPin, setNewMasterPin] = useState("");
  const [confirmMasterPin, setConfirmMasterPin] = useState("");
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterSuccess, setMasterSuccess] = useState("");
  const [masterError, setMasterError] = useState("");

  // Category PIN change form
  const [currentCatPin, setCurrentCatPin] = useState("");
  const [newCatPin, setNewCatPin] = useState("");
  const [confirmCatPin, setConfirmCatPin] = useState("");
  const [catLoading, setCatLoading] = useState(false);
  const [catSuccess, setCatSuccess] = useState("");
  const [catError, setCatError] = useState("");

  const handleChangeMasterPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMasterError("");
    setMasterSuccess("");

    if (!currentMasterPin || !newMasterPin || !confirmMasterPin) {
      setMasterError("Please fill in all master PIN fields.");
      return;
    }

    if (newMasterPin !== confirmMasterPin) {
      setMasterError("New PIN and confirmation do not match.");
      return;
    }

    if (newMasterPin.length < 4) {
      setMasterError("New PIN must be at least 4 digits.");
      return;
    }

    setMasterLoading(true);
    try {
      const res = await apiFetch("/auth/change-pin", {
        method: "POST",
        body: JSON.stringify({
          pinType: "master",
          currentPin: currentMasterPin,
          newPin: newMasterPin,
        }),
      });

      if (res.success) {
        setMasterSuccess(res.message || "Master PIN updated successfully!");
        setCurrentMasterPin("");
        setNewMasterPin("");
        setConfirmMasterPin("");
      } else {
        setMasterError(res.error || "Failed to update Master PIN.");
      }
    } catch (err: any) {
      setMasterError(err.message || "Failed to update Master PIN.");
    } finally {
      setMasterLoading(false);
    }
  };

  const handleChangeCategoryPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatError("");
    setCatSuccess("");

    if (!currentCatPin || !newCatPin || !confirmCatPin) {
      setCatError("Please fill in all category PIN fields.");
      return;
    }

    if (newCatPin !== confirmCatPin) {
      setCatError("New PIN and confirmation do not match.");
      return;
    }

    if (newCatPin.length < 4) {
      setCatError("New PIN must be at least 4 digits.");
      return;
    }

    setCatLoading(true);
    try {
      const res = await apiFetch("/auth/change-pin", {
        method: "POST",
        body: JSON.stringify({
          pinType: "category",
          currentPin: currentCatPin,
          newPin: newCatPin,
        }),
      });

      if (res.success) {
        setCatSuccess(res.message || "Category Lock PIN updated successfully!");
        setCurrentCatPin("");
        setNewCatPin("");
        setConfirmCatPin("");
      } else {
        setCatError(res.error || "Failed to update Category Lock PIN.");
      }
    } catch (err: any) {
      setCatError(err.message || "Failed to update Category Lock PIN.");
    } finally {
      setCatLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600" />
            System Profile & Security
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your administrator credentials, access PINs, and security keys.
          </p>
        </div>
        <button
          type="button"
          onClick={() => lockApp()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm"
        >
          <Lock size={16} />
          Lock Application Now
        </button>
      </header>

      {/* Account Info Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-md shadow-indigo-600/20">
              BD
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{user?.name || "B_D Administrator"}</h2>
              <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {user?.email || "admin@bina.enterprise"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <Check className="w-3 h-3 mr-1" /> Active Session
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              Role: Administrator
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-xs font-semibold text-slate-500">Security Architecture</div>
            <div className="text-sm font-bold text-slate-800 mt-1">Role-Based PIN + PostgreSQL</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-xs font-semibold text-slate-500">Real-time Synchronization</div>
            <div className="text-sm font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Sync Active
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-xs font-semibold text-slate-500">Audit Trail Tracking</div>
            <button
              type="button"
              onClick={() => navigate("/activity-log")}
              className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors mt-1 flex items-center gap-1"
            >
              View System Logs →
            </button>
          </div>
        </div>
      </div>

      {/* PIN Management Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Master PIN Change */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Change Master PIN</h3>
              <p className="text-xs text-slate-500">Full application access credential</p>
            </div>
          </div>

          <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900">
            Default Master PIN: <span className="font-mono font-bold">199198197</span> (or Alt: <span className="font-mono font-bold">190190</span>)
          </div>

          {masterError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{masterError}</span>
            </div>
          )}

          {masterSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{masterSuccess}</span>
            </div>
          )}

          <form onSubmit={handleChangeMasterPin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Current Master PIN</label>
              <input
                type="password"
                value={currentMasterPin}
                onChange={(e) => setCurrentMasterPin(e.target.value)}
                placeholder="Enter current master PIN"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">New Master PIN</label>
              <input
                type="password"
                value={newMasterPin}
                onChange={(e) => setNewMasterPin(e.target.value)}
                placeholder="Enter new 4-12 digit PIN"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New Master PIN</label>
              <input
                type="password"
                value={confirmMasterPin}
                onChange={(e) => setConfirmMasterPin(e.target.value)}
                placeholder="Repeat new master PIN"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={masterLoading}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-600/20"
            >
              {masterLoading ? "Updating Master PIN..." : "Update Master PIN"}
            </button>
          </form>
        </div>

        {/* Category PIN Change */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Change Category Lock PIN</h3>
              <p className="text-xs text-slate-500">Protects Category 1 (Investors) & Category 2 (Bills)</p>
            </div>
          </div>

          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-xs text-emerald-900">
            Default Category PIN: <span className="font-mono font-bold">190190</span> (or Master PIN)
          </div>

          {catError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{catError}</span>
            </div>
          )}

          {catSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{catSuccess}</span>
            </div>
          )}

          <form onSubmit={handleChangeCategoryPin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Current Category / Master PIN</label>
              <input
                type="password"
                value={currentCatPin}
                onChange={(e) => setCurrentCatPin(e.target.value)}
                placeholder="Enter current PIN"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">New Category Lock PIN</label>
              <input
                type="password"
                value={newCatPin}
                onChange={(e) => setNewCatPin(e.target.value)}
                placeholder="Enter new 4-12 digit PIN"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New Category PIN</label>
              <input
                type="password"
                value={confirmCatPin}
                onChange={(e) => setConfirmCatPin(e.target.value)}
                placeholder="Repeat new category PIN"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={catLoading}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm shadow-emerald-600/20"
            >
              {catLoading ? "Updating Category PIN..." : "Update Category Lock PIN"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
