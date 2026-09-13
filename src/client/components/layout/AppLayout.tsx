import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { LogOut, LayoutDashboard, MapPin, Receipt, FileSpreadsheet, History, User } from "lucide-react";
import { PWAInstallButton } from "../PWAInstallButton";

export default function AppLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar (Desktop) */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col h-screen sticky top-0">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Bina Enterprise</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <button type="button" 
            onClick={() => navigate("/")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button type="button" 
            onClick={() => navigate("/locations")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${location.pathname.startsWith('/locations') ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <MapPin size={18} />
            Locations
          </button>
          <button type="button" 
            onClick={() => navigate("/records")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${location.pathname.startsWith('/records') ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Receipt size={18} />
            All Records
          </button>
          <button type="button" 
            onClick={() => navigate("/reports")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${location.pathname.startsWith('/reports') ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <FileSpreadsheet size={18} />
            Reports
          </button>
          <button type="button" 
            onClick={() => navigate("/activity")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${location.pathname.startsWith('/activity') ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <History size={18} />
            Activity Log
          </button>
        </nav>

        <div className="p-4 border-t border-gray-200 space-y-3">
          <PWAInstallButton />
          
          <button type="button" 
            onClick={() => navigate("/profile")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${location.pathname.startsWith('/profile') ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
              {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="text-sm font-medium truncate text-left flex-1">
              {user?.displayName || user?.email}
            </div>
          </button>

          <div className="text-[10px] text-gray-400 text-center leading-tight">
            Purchase Icon by UIX Library on{" "}
            <a 
              href="https://icon-icons.com/authors/943-uix-library" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-indigo-600 transition-colors"
            >
              Icon-Icons.com
            </a>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10 sticky top-0">
          <h1 className="text-xl font-bold text-gray-900">Bina Enterprise</h1>
          <div className="flex items-center gap-3">
            <PWAInstallButton />
            <button type="button" onClick={() => navigate("/profile")} className="text-gray-500 hover:text-indigo-600">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
              </div>
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-center justify-around z-50 px-1 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button type="button" 
          onClick={() => navigate("/")}
          className={`flex flex-col items-center justify-center p-2 flex-1 ${location.pathname === '/' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <LayoutDashboard size={20} className="mb-1" />
          <span className="text-[10px] font-medium">Dashboard</span>
        </button>
        <button type="button" 
          onClick={() => navigate("/locations")}
          className={`flex flex-col items-center justify-center p-2 flex-1 ${location.pathname.startsWith('/locations') ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <MapPin size={20} className="mb-1" />
          <span className="text-[10px] font-medium">Locations</span>
        </button>
        <button type="button" 
          onClick={() => navigate("/records")}
          className={`flex flex-col items-center justify-center p-2 flex-1 ${location.pathname.startsWith('/records') ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <Receipt size={20} className="mb-1" />
          <span className="text-[10px] font-medium">Records</span>
        </button>
        <button type="button" 
          onClick={() => navigate("/reports")}
          className={`flex flex-col items-center justify-center p-2 flex-1 ${location.pathname.startsWith('/reports') ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <FileSpreadsheet size={20} className="mb-1" />
          <span className="text-[10px] font-medium">Reports</span>
        </button>
        <button type="button" 
          onClick={() => navigate("/profile")}
          className={`flex flex-col items-center justify-center p-2 flex-1 ${location.pathname.startsWith('/profile') ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <User size={20} className="mb-1" />
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </nav>
    </div>
  );
}
