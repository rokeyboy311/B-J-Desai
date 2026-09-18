import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Lock, LayoutDashboard, MapPin, Receipt, FileSpreadsheet, History, Building2, Menu, X, Database, ShieldCheck, RefreshCw } from "lucide-react";
import { PWAInstallButton } from "../PWAInstallButton";
import { motion, AnimatePresence } from "motion/react";
import { triggerGlobalSync } from "../../hooks/useLiveSync";

export default function AppLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = () => {
    setIsSyncing(true);
    triggerGlobalSync();
    setTimeout(() => {
      setIsSyncing(false);
    }, 600);
  };

  const handleLockERP = async () => {
    await logout();
  };

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Locations", path: "/locations", icon: MapPin },
    { name: "Records", path: "/records", icon: Receipt },
    { name: "Reports", path: "/reports", icon: FileSpreadsheet },
    { name: "Activity", path: "/activity", icon: History },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Desktop Sidebar */}
      <aside className="w-[280px] bg-slate-900 text-slate-100 hidden md:flex flex-col h-screen sticky top-0 shadow-2xl z-20">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 ring-2 ring-indigo-500/20">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-tight">Bina Enterprise</h1>
            <p className="text-[11px] text-indigo-400 font-medium tracking-wide uppercase mt-0.5">Central ERP System</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto mt-2">
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
          <div className="bg-slate-800/50 rounded-xl p-3 flex items-center gap-3 border border-slate-700/50">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-xs font-semibold text-white truncate">
                  Central Database
                </p>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                All Devices Synced
              </p>
            </div>
          </div>
          
          <button 
            onClick={handleLockERP}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 rounded-xl text-xs font-semibold transition-colors"
          >
            <Lock size={14} /> Lock ERP Screen
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0 h-screen overflow-hidden relative">
        
        {/* Desktop Header */}
        <header className="hidden md:flex h-20 items-center justify-between px-8 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-slate-800 capitalize">
              {location.pathname === '/' ? 'Accounting Dashboard' : location.pathname.split('/')[1]}
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/50">
              <ShieldCheck className="w-3.5 h-3.5" /> PIN Verified
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Unified Central DB</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleManualSync}
              title="Click to instantly sync data across devices"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition active:scale-95 cursor-pointer"
            >
              <RefreshCw size={13} className={isSyncing ? "animate-spin text-indigo-600" : "text-slate-500"} />
              <span>{isSyncing ? "Syncing..." : "Sync Data"}</span>
            </button>
            <PWAInstallButton />
          </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden bg-white/80 backdrop-blur-xl border-b border-slate-200/50 p-4 flex items-center justify-between z-30 sticky top-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Building2 size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">Bina Enterprise</h1>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live Synced" />
              </div>
              <p className="text-[10px] text-slate-500">Central ERP • Live Sync</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualSync}
              title="Refresh Data"
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <RefreshCw size={18} className={isSyncing ? "animate-spin text-indigo-600" : ""} />
            </button>
            <button
              onClick={handleLockERP}
              title="Lock Screen"
              className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition"
            >
              <Lock size={18} />
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 -mr-1 text-slate-600">
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
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
                  onClick={() => { handleLockERP(); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm text-rose-600 hover:bg-rose-50"
                >
                  <Lock size={18} className="text-rose-400" />
                  Lock ERP Screen
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 flex items-center justify-around z-40 px-1 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)] pt-1">
        {navItems.slice(0, 4).map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <button 
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center p-2 flex-1 relative ${isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {isActive && (
                <motion.div layoutId="mobile-nav-indicator" className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-indigo-600 rounded-b-full" />
              )}
              <item.icon size={20} className={`mb-1 mt-1 ${isActive ? 'text-indigo-600' : ''}`} />
              <span className="text-[10px] font-medium tracking-wide">{item.name}</span>
            </button>
          )
        })}
      </nav>
    </div>
  );
}
