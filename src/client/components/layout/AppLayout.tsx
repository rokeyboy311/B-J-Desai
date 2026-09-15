import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { 
  LogOut, LayoutDashboard, MapPin, FileSpreadsheet, History, 
  User, Building2, Menu, X, FileText, ShoppingBag, 
  Wallet, Boxes, Users, CreditCard, UserCheck
} from "lucide-react";
import { PWAInstallButton } from "../PWAInstallButton";
import { motion, AnimatePresence } from "motion/react";

export default function AppLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Sales & Invoicing", path: "/sales", icon: FileText },
    { name: "Purchases", path: "/purchases", icon: ShoppingBag },
    { name: "Income & Expenses", path: "/expenses", icon: Wallet },
    { name: "Inventory & Products", path: "/inventory", icon: Boxes },
    { name: "Parties & Ledgers", path: "/parties", icon: Users },
    { name: "Payments & Receipts", path: "/payments", icon: CreditCard },
    { name: "Accounting & Reports", path: "/reports", icon: FileSpreadsheet },
    { name: "Labour / Employees", path: "/labour", icon: UserCheck },
    { name: "Locations / Branches", path: "/locations", icon: MapPin },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Desktop Sidebar */}
      <aside className="w-[280px] bg-slate-900 text-slate-100 hidden md:flex flex-col h-screen sticky top-0 shadow-2xl z-20">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Bina Ent.</h1>
            <p className="text-xs text-slate-400 font-medium tracking-wide uppercase mt-0.5">Workspace</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto mt-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <button 
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all relative ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="active-nav-desktop"
                    className="absolute inset-0 bg-indigo-600 rounded-xl"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <item.icon size={18} className="relative z-10" />
                <span className="relative z-10">{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="bg-slate-800/50 rounded-xl p-4 flex items-center gap-3 border border-slate-700/50">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-white shadow-inner shrink-0">
              {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user?.displayName || "Administrator"}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {user?.email}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => navigate("/profile")}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
            >
              <User size={14} /> Profile
            </button>
            <button 
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg text-xs font-medium transition-colors"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0 h-screen overflow-hidden relative">
        
        {/* Desktop Header */}
        <header className="hidden md:flex h-20 items-center justify-between px-8 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-slate-800 capitalize">
              {location.pathname === '/' ? 'Dashboard' : location.pathname.split('/')[1]}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <PWAInstallButton />
          </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden bg-white/80 backdrop-blur-xl border-b border-slate-200/50 p-4 flex items-center justify-between z-30 sticky top-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Building2 size={18} />
            </div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Bina Ent.</h1>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 -mr-2 text-slate-600">
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </header>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="md:hidden absolute top-[65px] left-0 right-0 bg-white shadow-2xl z-20 border-b border-slate-100 py-4 px-4 space-y-1"
            >
               {navItems.map((item) => {
                  const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                  return (
                    <button 
                      key={item.path}
                      onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                        isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <item.icon size={18} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                      {item.name}
                    </button>
                  );
                })}
                <div className="h-px bg-slate-100 my-4" />
                <button 
                  onClick={() => { navigate("/profile"); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm text-slate-600 hover:bg-slate-50"
                >
                  <User size={18} className="text-slate-400" />
                  Profile Settings
                </button>
                <button 
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm text-rose-600 hover:bg-rose-50"
                >
                  <LogOut size={18} className="text-rose-400" />
                  Sign Out
                </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Page Content */}
        <div className="flex-1 overflow-y-auto">
          <motion.div 
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-4 md:p-8 max-w-[1600px] mx-auto w-full"
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
      
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-200 flex items-center justify-around z-40 px-1 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)] pt-1">
        {navItems.slice(0, 4).map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <button 
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center p-2 flex-1 relative ${isActive ? 'text-indigo-600 font-semibold' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {isActive && (
                <motion.div layoutId="mobile-nav-indicator" className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-indigo-600 rounded-b-full" />
              )}
              <item.icon size={18} className="mb-0.5 mt-0.5" />
              <span className="text-[10px] truncate max-w-[65px]">{item.name.split(' ')[0]}</span>
            </button>
          );
        })}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`flex flex-col items-center justify-center p-2 flex-1 ${mobileMenuOpen ? 'text-indigo-600 font-semibold' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Menu size={18} className="mb-0.5 mt-0.5" />
          <span className="text-[10px]">All ERP</span>
        </button>
      </nav>
    </div>
  );
}
