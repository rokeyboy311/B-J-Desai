import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { LogOut, LayoutDashboard, MapPin, Receipt, FileSpreadsheet, History } from "lucide-react";

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
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Hisab-Kitab</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <button 
            onClick={() => navigate("/")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button 
            onClick={() => navigate("/locations")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${location.pathname.startsWith('/locations') ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <MapPin size={18} />
            Locations
          </button>
          <button 
            onClick={() => navigate("/records")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${location.pathname.startsWith('/records') ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Receipt size={18} />
            All Records
          </button>
          <button 
            onClick={() => navigate("/reports")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${location.pathname.startsWith('/reports') ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <FileSpreadsheet size={18} />
            Reports
          </button>
          <button 
            onClick={() => navigate("/activity")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${location.pathname.startsWith('/activity') ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <History size={18} />
            Activity Log
          </button>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
              {user?.email?.[0].toUpperCase() || "U"}
            </div>
            <div className="text-sm font-medium text-gray-900 truncate">
              {user?.email}
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg font-medium text-sm transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10 sticky top-0">
          <h1 className="text-xl font-bold text-gray-900">Hisab-Kitab</h1>
          <button onClick={handleLogout} className="text-gray-500 hover:text-rose-600">
            <LogOut size={20} />
          </button>
        </header>

        {/* Dynamic Page Content */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-center justify-around z-50 px-1 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => navigate("/")}
          className={`flex flex-col items-center justify-center p-2 flex-1 ${location.pathname === '/' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <LayoutDashboard size={20} className="mb-1" />
          <span className="text-[10px] font-medium">Dashboard</span>
        </button>
        <button 
          onClick={() => navigate("/locations")}
          className={`flex flex-col items-center justify-center p-2 flex-1 ${location.pathname.startsWith('/locations') ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <MapPin size={20} className="mb-1" />
          <span className="text-[10px] font-medium">Locations</span>
        </button>
        <button 
          onClick={() => navigate("/records")}
          className={`flex flex-col items-center justify-center p-2 flex-1 ${location.pathname.startsWith('/records') ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <Receipt size={20} className="mb-1" />
          <span className="text-[10px] font-medium">Records</span>
        </button>
        <button 
          onClick={() => navigate("/reports")}
          className={`flex flex-col items-center justify-center p-2 flex-1 ${location.pathname.startsWith('/reports') ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <FileSpreadsheet size={20} className="mb-1" />
          <span className="text-[10px] font-medium">Reports</span>
        </button>
        <button 
          onClick={() => navigate("/activity")}
          className={`flex flex-col items-center justify-center p-2 flex-1 ${location.pathname.startsWith('/activity') ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <History size={20} className="mb-1" />
          <span className="text-[10px] font-medium">Activity</span>
        </button>
      </nav>
    </div>
  );
}
