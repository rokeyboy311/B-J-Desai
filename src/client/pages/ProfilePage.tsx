import React, { useState } from "react";
import { Shield, Lock, User, Key, Check } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { apiFetch } from "../lib/api";

export default function ProfilePage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isChangingPin, setIsChangingPin] = useState(false);

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin || newPin.length < 4) {
      showToast("PIN must be at least 4 digits", "error");
      return;
    }
    if (newPin !== confirmPin) {
      showToast("New PIN and Confirm PIN do not match", "error");
      return;
    }

    try {
      setIsChangingPin(true);
      await apiFetch("/auth/change-pin", {
        method: "POST",
        body: JSON.stringify({ currentPin, newPin })
      });
      showToast("Security PIN updated successfully!", "success");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (err: any) {
      showToast(err.message || "Failed to update PIN", "error");
    } finally {
      setIsChangingPin(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header matching 14_profile.svg */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Profile</h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">Account and application preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Admin Profile Box matching 14_profile.svg */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Admin Profile</h2>

          <div className="flex items-center gap-4 pt-2">
            <div className="w-14 h-14 rounded-2xl bg-[#0B1D3A] text-white flex items-center justify-center font-black text-xl shadow-md">
              A
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Admin</h3>
              <p className="text-xs text-slate-400 font-medium">Super Admin &bull; Full ERP Privileges</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400">System Role</span>
              <span className="font-bold text-slate-800">Master Owner / Super Admin</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400">Security Gate</span>
              <span className="font-bold text-emerald-600">Category PIN Protected</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Database Engine</span>
              <span className="font-bold text-blue-600">Unified Central Database</span>
            </div>
          </div>
        </div>

        {/* Application Preferences Box matching 14_profile.svg */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Application Preferences</h2>

          <div className="space-y-3 pt-1 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">Realtime Multi-Device Sync</div>
                <div className="text-[10px] text-slate-400">Instant background synchronization across tabs & phones</div>
              </div>
              <span className="px-2 py-1 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px]">ACTIVE</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">Indian Currency Formatting</div>
                <div className="text-[10px] text-slate-400">Formatted in Lakhs & Crores (e.g., ₹1,25,000)</div>
              </div>
              <span className="px-2 py-1 bg-blue-50 text-blue-700 font-bold rounded text-[10px]">ENABLED</span>
            </div>
          </div>
        </div>

      </div>

      {/* Security & Session Box matching 14_profile.svg */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Security & Session</h2>

        <form onSubmit={handleChangePin} className="max-w-md space-y-4 pt-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Current PIN / Password</label>
            <input
              type="password"
              required
              placeholder="••••"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">New Security PIN</label>
              <input
                type="password"
                required
                placeholder="••••"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Confirm New PIN</label>
              <input
                type="password"
                required
                placeholder="••••"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none font-bold"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isChangingPin}
            className="px-4 py-2.5 bg-[#0B1D3A] hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
          >
            {isChangingPin ? "Updating PIN..." : "Update Security Credentials"}
          </button>
        </form>
      </div>

    </div>
  );
}
