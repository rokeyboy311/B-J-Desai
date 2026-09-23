import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { 
  Lock, LayoutDashboard, MapPin, Receipt, FileSpreadsheet, 
  History, Building2, Menu, X, Database, ShieldCheck, 
  RefreshCw, FileDown, MoreHorizontal, Shield, ChevronRight, Users, Package,
  Search, LogOut
} from "lucide-react";
import { PWAInstallButton } from "../PWAInstallButton";
import { motion, AnimatePresence } from "motion/react";
import { triggerGlobalSync } from "../../hooks/useLiveSync";
import { useGoogleSync } from "../../contexts/GoogleSyncContext";
import AppLogo from "../icons/AppLogo";

export default function AppLayout() {
  const { logout, user } = useAuth();
  const { isConnected, setIsModalOpen } = useGoogleSync();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");

  const handleManualSync = () => {
    setIsSyncing(true);
    triggerGlobalSync();
    setTimeout(() => {
      setIsSyncing(false);
    }, 600);
  };

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    setMoreSheetOpen(false);
    await logout();
  };

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Admin", path: "/admin", icon: ShieldCheck },
    { name: "Location", path: "/locations", icon: MapPin },
    { name: "Customer Supply", path: "/customer-supply", icon: Users },
    { name: "Material Purchase", path: "/material-purchase", icon: Package },
  ];

  const primaryMobileNav = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Admin", path: "/admin", icon: ShieldCheck },
    { name: "Location", path: "/locations", icon: MapPin },
    { name: "Customer", path: "/customer-supply", icon: Users },
    { name: "Purchase", path: "/material-purchase", icon: Package },
  ];

  const secondaryNav = [
    { name: "Reports", path: "/reports", icon: FileSpreadsheet, desc: "Business reporting & traceability" },
    { name: "Activity Log", path: "/activity", icon: History, desc: "Audit trail of system activity" },
    { name: "Excel Downloads", path: "/excel-downloads", icon: FileDown, desc: "Export ledgers & reports" },
    { name: "Profile", path: "/profile", icon: Shield, desc: "Account & preferences" },
  ];

  const isSecondaryActive = secondaryNav.some(
    item => location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))
  );

  return (
    <div className="h-[100dvh] bg-[#F4F6F9] flex text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-hidden">
      
      {/* Desktop Deep Navy Sidebar */}
      <aside className="w-[260px] bg-[#0B1D3A] text-slate-200 hidden md:flex flex-col h-full shadow-2xl z-20 shrink-0 border-r border-slate-800">
        
        {/* Brand Logo Header */}
        <div className="p-5 flex items-center gap-3 border-b border-slate-800/80">
          <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-sm border border-slate-200">
            <AppLogo />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-white leading-tight">B J</h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide">Accounting & Investment</p>
          </div>
        </div>
        
        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <button 
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all relative cursor-pointer ${
                  isActive ? 'bg-[#1E88E5] text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon size={16} className="shrink-0" />
                <span>{item.name}</span>
              </button>
            );
          })}

          <div className="pt-5 pb-1 px-3">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
              System
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl font-medium text-xs transition-all relative cursor-pointer text-slate-300 hover:text-white hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={15} className="shrink-0 text-emerald-400" />
              <span>Google Sheets Sync</span>
            </div>
            {isConnected ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            ) : (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                Live
              </span>
            )}
          </button>

          {secondaryNav.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <button 
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl font-medium text-xs transition-all relative cursor-pointer ${
                  isActive ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <item.icon size={15} className="shrink-0" />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer / Logout */}
        <div className="p-4 border-t border-slate-800/80">
          <button 
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        
        {/* Top Header Bar matching SVG wireframes */}
        <header className="hidden md:flex h-16 items-center justify-between px-8 bg-white border-b border-slate-200/90 shrink-0 z-10 shadow-xs">
          
          {/* Global Search Input */}
          <div className="relative w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Search anything..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Right Admin Status */}
          <div className="flex items-center gap-3">
            {/* Google Sheets Sync Pill */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs ${
                isConnected 
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <FileSpreadsheet size={15} className={isConnected ? "text-emerald-600" : "text-slate-500"} />
              <span>{isConnected ? "Google Sheets Live" : "Connect Google Sheets"}</span>
              {isConnected && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              )}
            </button>

            <button
              type="button"
              onClick={handleManualSync}
              title="Click to refresh/sync data"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <RefreshCw size={13} className={isSyncing ? "animate-spin text-blue-600" : "text-slate-400"} />
              <span>{isSyncing ? "Syncing..." : "Sync"}</span>
            </button>

            <PWAInstallButton />

            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <div className="text-right">
                <div className="text-xs font-bold text-slate-900 leading-none">Admin</div>
                <div className="text-[10px] text-slate-400 font-medium">Super Admin</div>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden bg-[#0B1D3A] text-white px-4 py-3 flex items-center justify-between z-30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white p-1 border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
              <AppLogo />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">B J</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="p-1.5 text-emerald-400 hover:text-white rounded-lg cursor-pointer relative"
              title="Google Sheets Live Sync"
            >
              <FileSpreadsheet size={18} />
              {isConnected && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 absolute top-1 right-1"></span>
              )}
            </button>
            <button
              type="button"
              onClick={handleManualSync}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg cursor-pointer"
            >
              <RefreshCw size={16} className={isSyncing ? "animate-spin text-blue-400" : ""} />
            </button>
            <button 
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
              className="p-1.5 text-slate-300 hover:text-white rounded-lg cursor-pointer"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>

        {/* Mobile Slide-down Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden absolute top-[53px] left-0 right-0 bg-[#0B1D3A] text-white shadow-2xl z-40 border-b border-slate-800 overflow-hidden"
            >
              <div className="p-4 space-y-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                  return (
                    <button 
                      key={item.path}
                      type="button"
                      onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all cursor-pointer ${
                        isActive ? 'bg-[#1E88E5] text-white font-bold' : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <item.icon size={16} />
                      <span className="flex-1 text-left">{item.name}</span>
                    </button>
                  );
                })}
                <div className="h-px bg-slate-800 my-2" />
                {secondaryNav.map((item) => (
                  <button 
                    key={item.path}
                    type="button"
                    onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/5 cursor-pointer"
                  >
                    <item.icon size={15} />
                    <span>{item.name}</span>
                  </button>
                ))}
                <div className="h-px bg-slate-800 my-2" />
                <button 
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Page Content Scroll Container */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <motion.div 
            key={location.pathname}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="p-4 sm:p-6 md:p-8 max-w-[1600px] mx-auto w-full pb-24 md:pb-10"
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
      
      {/* Mobile Bottom Navigation matching 15_responsive_mobile.svg */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around z-30 px-1 py-1 shadow-lg"
      >
        {primaryMobileNav.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <button 
              key={item.path}
              type="button"
              onClick={() => { setMoreSheetOpen(false); navigate(item.path); }}
              className={`flex flex-col items-center justify-center py-1.5 px-2 flex-1 relative min-h-[46px] rounded-lg transition-colors cursor-pointer ${
                isActive ? 'text-blue-600' : 'text-slate-400'
              }`}
            >
              <item.icon size={18} className="mb-0.5" />
              <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.name}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreSheetOpen(!moreSheetOpen)}
          className={`flex flex-col items-center justify-center py-1.5 px-2 flex-1 relative min-h-[46px] rounded-lg transition-colors cursor-pointer ${
            isSecondaryActive || moreSheetOpen ? 'text-blue-600' : 'text-slate-400'
          }`}
        >
          <MoreHorizontal size={18} className="mb-0.5" />
          <span className="text-[10px] font-medium">Menu</span>
        </button>
      </nav>

      {/* Mobile "More" Bottom Sheet */}
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
              className="relative bg-white rounded-t-2xl border-t border-slate-200 shadow-2xl p-4 space-y-2 z-10 max-h-[80vh] overflow-y-auto"
            >
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-2" />
              {secondaryNav.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => {
                    navigate(item.path);
                    setMoreSheetOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-left cursor-pointer"
                >
                  <item.icon size={18} className="text-slate-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">{item.name}</div>
                    <div className="text-[10px] text-slate-400">{item.desc}</div>
                  </div>
                </button>
              ))}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  <LogOut size={15} />
                  <span>Logout</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
