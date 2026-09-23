import React from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PinScreen } from "./PinScreen";
import AppLogo from "./icons/AppLogo";

export const ProtectedRoute: React.FC = () => {
  const { isUnlocked, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white select-none p-4">
        <div className="w-16 h-16 rounded-2xl bg-white p-2.5 flex items-center justify-center shadow-2xl shadow-amber-500/20 mb-4 ring-2 ring-slate-700/50">
          <AppLogo />
        </div>
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm text-slate-200 font-bold">B J</p>
        <p className="text-xs text-slate-500 font-medium mt-1">Loading ERP System...</p>
      </div>
    );
  }

  if (!isUnlocked) {
    return <PinScreen />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
