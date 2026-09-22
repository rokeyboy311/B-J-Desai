import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../lib/api";
import { User, Mail, Lock, LogOut, AlertCircle, CheckCircle2, Shield, KeyRound, Clock, Activity, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const { user, lockApp } = useAuth();
  const navigate = useNavigate();

  // Unified Security Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    if (newPassword.length < 4) {
      setError("New password must be at least 4 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/auth/change-pin", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (res.success) {
        setSuccess(res.message || "Unified Security Password updated successfully in database!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setError(res.error || "Failed to update Security Password.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to update Security Password.");
    } finally {
      setLoading(false);
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
              <h2 className="text-lg font-bold text-slate-900">{user?.name || "B J Desai Admin"}</h2>
              <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {user?.email || "admin@bjdesai.com"}
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

      {/* Unified Security Password Management Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6 max-w-2xl">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Unified Security Password</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Single universal database password controlling Login, Category 1 & 2 Access, and Record Deletions.
            </p>
          </div>
        </div>

        <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100/80 text-xs text-indigo-900 leading-relaxed">
          <p className="font-semibold mb-1">🔐 Single Security Password Architecture</p>
          Only 1 password is saved in the database (<code className="bg-indigo-100 px-1.5 py-0.5 rounded text-indigo-800 font-mono font-bold">Bh@ju1204</code> by default). Any record deletion, category access, or application unlock verifies directly against the database record before granting permission.
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs font-semibold text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Current Security Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">New Security Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (e.g. Bh@ju1204)"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Updating in Database..." : "Update Security Password in Database"}
          </button>
        </form>
      </div>
    </div>
  );
}
