import React from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PinScreen } from "./PinScreen";

export const ProtectedRoute: React.FC = () => {
  const { isUnlocked, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
        <p className="text-sm text-slate-400 font-medium">Loading B_D Accounting ERP...</p>
      </div>
    );
  }

  if (!isUnlocked) {
    return <PinScreen />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
