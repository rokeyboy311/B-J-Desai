import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { 
  Lock, LayoutDashboard, MapPin, Receipt, FileSpreadsheet, 
  History, Building2, Menu, X, Database, ShieldCheck, 
  RefreshCw, FileDown, MoreHorizontal, Shield, ChevronRight, Users, Package
} from "lucide-react";
import { PWAInstallButton } from "../PWAInstallButton";
import { motion, AnimatePresence } from "motion/react";
import { triggerGlobalSync } from "../../hooks/useLiveSync";
import AppLogo from "../icons/AppLogo";

export default function AppLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = () => {
    setIsSyncing(true);
    triggerGlobalSync();
    setTimeout(() => {
      setIsSyncing(false);
    }, 600);
  };

  const handleLockERP = async () => {
    setMobileMenuOpen(false);
    setMoreSheetOpen(false);
    await logout();
  };

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Admin", path: "/admin", icon: ShieldCheck },
    { name: "Location", path: "/locations", icon: MapPin },
    { name: "Material Purchase", path: "/material-purchase", icon: Package },
  ];

  // The primary mobile bottom items
  const primaryMobileNav = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Admin", path: "/admin", icon: ShieldCheck },
    { name: "Location", path: "/locations", icon: MapPin },
    { name: "Materials", path: "/material-purchase", icon: Package },
  ];

  // Secondary items in the "More" drawer / sheet and desktop sidebar
  const secondaryNav = [
    { name: "Global Records", path: "/records", icon: Receipt, desc: "Direct master entry log" },
    { name: "Reports & Analytics", path: "/reports", icon: FileSpreadsheet, desc: "Consolidated financial summaries" },
    { name: "Excel Downloads", path: "/excel-downloads", icon: FileDown, desc: "Export ledger & passbooks" },
    { name: "Activity Log", path: "/activity", icon: History, desc: "Audit trail of actions" },
    { name: "Security & PIN", path: "/profile", icon: Shield, desc: "Update access credentials" },
  ];

  const isSecondaryActive = secondaryNav.some(
    item => location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))
  );

  return (
    <div className="h-[100dvh] bg-[#F8FAFC] flex text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden">
      
      {/* Desktop Sidebar */}
      <aside className="w-[280px] bg-slate-900 text-slate-100 hidden md:flex flex-col h-full shadow-2xl z-20 shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-lg shadow-amber-500/10 ring-2 ring-slate-700/50 shrink-0 overflow-hidden">
            <AppLogo />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-tight">B J Desai</h1>
            <p className="text-[11px] text-indigo-400 font-medium tracking-wide uppercase mt-0.5">Central ERP System</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto mt-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <button 
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all relative cursor-pointer ${
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
                <item.icon size={18} className="relative z-10 shrink-0" />
                <span className="relative z-10">{item.name}</span>
              </button>
            );
          })}

          <div className="pt-4 pb-1 px-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              System Tools
            </span>
          </div>

          {secondaryNav.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <button 
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-xs transition-all relative cursor-pointer ${
                  isActive ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <item.icon size={16} className="shrink-0" />
                <span>{item.name}</span>
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
            type="button"
            onClick={handleLockERP}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Lock size={14} /> Lock ERP Screen
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        
        {/* Desktop Header */}
        <header className="hidden md:flex h-18 items-center justify-between px-8 bg-white/90 backdrop-blur-xl border-b border-slate-200/60 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800 capitalize">
              {location.pathname === '/' 
                ? 'Accounting Dashboard' 
                : location.pathname.startsWith('/locations/')
                ? 'Location Details'
                : location.pathname.replace('/', '').replace('-', ' ')}
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
              type="button"
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
        <header className="md:hidden bg-white/95 backdrop-blur-xl border-b border-slate-200/70 px-4 py-3 flex items-center justify-between z-30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white p-1 border border-slate-200 shadow-xs flex items-center justify-center shrink-0 overflow-hidden">
              <AppLogo />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold text-slate-900 tracking-tight">B J Desai</h1>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live Synced" />
              </div>
              <p className="text-[10px] text-slate-500">Central ERP • Realtime</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleManualSync}
              title="Refresh Data"
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition active:scale-95 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
            >
              <RefreshCw size={17} className={isSyncing ? "animate-spin text-indigo-600" : ""} />
            </button>
            <button
              type="button"
              onClick={handleLockERP}
              title="Lock Screen"
              className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition active:scale-95 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
            >
              <Lock size={17} />
            </button>
            <button 
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>

        {/* Mobile Slide-down Full Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden absolute top-[57px] left-0 right-0 bg-white/95 backdrop-blur-xl shadow-2xl z-40 border-b border-slate-200 overflow-hidden"
            >
              <div className="p-4 space-y-1 max-h-[70vh] overflow-y-auto">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                  return (
                    <button 
                      key={item.path}
                      type="button"
                      onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all cursor-pointer ${
                        isActive ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <item.icon size={18} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                      <span className="flex-1 text-left">{item.name}</span>
                      <ChevronRight size={14} className="text-slate-300" />
                    </button>
                  );
                })}
                <div className="h-px bg-slate-100 my-2" />
                <div className="px-2 py-1 flex items-center justify-between">
                  <PWAInstallButton />
                  <span className="text-[11px] text-slate-400">All Devices Synced</span>
                </div>
                <button 
                  type="button"
                  onClick={() => { handleLockERP(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <Lock size={18} className="text-rose-500" />
                  Lock ERP Screen
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Page Content Scroll Container */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <motion.div 
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="p-3 sm:p-5 md:p-8 max-w-[1600px] mx-auto w-full pb-24 md:pb-10"
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
      
      {/* Mobile Bottom Navigation */}
      <nav 
        id="mobile-bottom-navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 flex items-center justify-around z-30 px-1 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom, 0px))', paddingTop: '0.35rem' }}
      >
        {primaryMobileNav.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <button 
              key={item.path}
              type="button"
              onClick={() => { setMoreSheetOpen(false); navigate(item.path); }}
              className={`flex flex-col items-center justify-center py-1.5 px-2 flex-1 relative min-h-[48px] rounded-lg transition-colors cursor-pointer ${
                isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {isActive && (
                <motion.div layoutId="mobile-nav-indicator" className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-indigo-600 rounded-b-full" />
              )}
              <item.icon size={19} className={`mb-1 ${isActive ? 'text-indigo-600 stroke-[2.5]' : 'text-slate-400'}`} />
              <span className={`text-[10px] tracking-tight leading-none ${isActive ? 'font-bold text-indigo-700' : 'font-medium'}`}>
                {item.name}
              </span>
            </button>
          );
        })}

        {/* More Button */}
        <button
          type="button"
          onClick={() => setMoreSheetOpen(!moreSheetOpen)}
          className={`flex flex-col items-center justify-center py-1.5 px-2 flex-1 relative min-h-[48px] rounded-lg transition-colors cursor-pointer ${
            isSecondaryActive || moreSheetOpen ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
          }`}
          aria-label="More navigation options"
        >
          {(isSecondaryActive || moreSheetOpen) && (
            <motion.div layoutId="mobile-nav-indicator" className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-indigo-600 rounded-b-full" />
          )}
          <div className="relative">
            <MoreHorizontal size={19} className={`mb-1 ${(isSecondaryActive || moreSheetOpen) ? 'text-indigo-600 stroke-[2.5]' : 'text-slate-400'}`} />
            {isSecondaryActive && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-600" />
            )}
          </div>
          <span className={`text-[10px] tracking-tight leading-none ${(isSecondaryActive || moreSheetOpen) ? 'font-bold text-indigo-700' : 'font-medium'}`}>
            More
          </span>
        </button>
      </nav>

      {/* Mobile "More" Bottom Sheet Modal */}
      <AnimatePresence>
        {moreSheetOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreSheetOpen(false)}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative bg-white rounded-t-3xl border-t border-slate-200 shadow-2xl p-5 space-y-3 z-10 max-h-[85vh] overflow-y-auto"
              style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
            >
              {/* Sheet Drag Handle */}
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2" />
              
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">More Tools & Management</h3>
                  <p className="text-xs text-slate-400">Additional modules and administrative controls</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMoreSheetOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-1.5">
                {secondaryNav.map((item) => {
                  const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => {
                        navigate(item.path);
                        setMoreSheetOpen(false);
                      }}
                      className={`w-full flex items-center gap-3.5 p-3 rounded-2xl transition-all text-left cursor-pointer ${
                        isActive 
                          ? 'bg-indigo-50 border border-indigo-200/80 text-indigo-900' 
                          : 'hover:bg-slate-50 border border-transparent text-slate-800'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <item.icon size={19} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{item.name}</div>
                        <div className="text-xs text-slate-400 truncate">{item.desc}</div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300" />
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleManualSync();
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <RefreshCw size={14} className={isSyncing ? "animate-spin text-indigo-600" : "text-slate-500"} />
                    <span>{isSyncing ? "Syncing..." : "Sync All Devices"}</span>
                  </button>
                  <div className="shrink-0">
                    <PWAInstallButton />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLockERP}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Lock size={15} />
                  <span>Lock ERP Screen</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
