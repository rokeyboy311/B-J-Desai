import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useBusiness } from "../../contexts/BusinessContext";
import { 
  LogOut, LayoutDashboard, MapPin, FileSpreadsheet,
  User, Building2, Menu, X, FileText, ShoppingBag, 
  Wallet, Boxes, Users, CreditCard, UserCheck, Plus,
  ChevronDown, Calendar, ShieldCheck
} from "lucide-react";
import { PWAInstallButton } from "../PWAInstallButton";
import { motion, AnimatePresence } from "motion/react";

export default function AppLayout() {
  const { logout, user } = useAuth();
  const { 
    businesses, 
    activeBusiness, 
    setActiveBusiness, 
    locations, 
    activeLocationId, 
    setActiveLocationId,
    financialYear 
  } = useBusiness();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

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
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-lg">
            B
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold tracking-tight text-white truncate">
              {activeBusiness?.businessName || "Bina Enterprise"}
            </h1>
            <p className="text-[11px] text-indigo-300 font-medium tracking-wide uppercase mt-0.5 flex items-center gap-1">
              <ShieldCheck size={12} /> Indian Accounting ERP
            </p>
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
                    className="absolute inset-0 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/30"
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
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-white shadow-inner shrink-0 text-sm">
              {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {user?.displayName || "Administrator"}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {user?.email}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => navigate("/profile")}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
            >
              <User size={13} /> Settings
            </button>
            <button 
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg text-xs font-medium transition-colors"
            >
              <LogOut size={13} /> Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0 h-screen overflow-hidden relative">
        
        {/* Desktop Top Header Bar */}
        <header className="hidden md:flex h-18 items-center justify-between px-8 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-10 shadow-xs">
          {/* Business & Location Context Switchers */}
          <div className="flex items-center gap-3">
            {/* Business Selector */}
            {businesses.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-100/80 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700">
                <Building2 size={14} className="text-indigo-600" />
                <select
                  value={activeBusiness?.id || ""}
                  onChange={(e) => {
                    const b = businesses.find(x => x.id === Number(e.target.value));
                    if (b) setActiveBusiness(b);
                  }}
                  aria-label="Active Business"
                  className="bg-transparent border-none text-slate-800 font-semibold focus:outline-hidden cursor-pointer"
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>{b.businessName}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Location Selector */}
            <div className="flex items-center gap-2 bg-slate-100/80 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700">
              <MapPin size={14} className="text-emerald-600" />
              <select
                value={activeLocationId}
                onChange={(e) => {
                  const val = e.target.value;
                  setActiveLocationId(val === "ALL" ? "ALL" : Number(val));
                }}
                aria-label="Branch / Worksite"
                className="bg-transparent border-none text-slate-800 font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Branches & Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            {/* Indian Financial Year Badge */}
            <div className="hidden lg:flex items-center gap-1.5 bg-indigo-50 border border-indigo-200/60 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700">
              <Calendar size={13} />
              <span>FY {financialYear}</span>
            </div>
          </div>

          {/* Quick Actions & PWA Install */}
          <div className="flex items-center gap-3">
            {/* Quick Add Dropdown */}
            <div className="relative">
              <button
                onClick={() => setQuickAddOpen(!quickAddOpen)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
              >
                <Plus size={15} />
                <span>Quick Add</span>
                <ChevronDown size={13} />
              </button>

              <AnimatePresence>
                {quickAddOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 5 }}
                    className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 text-xs font-medium text-slate-700"
                  >
                    <button
                      onClick={() => { setQuickAddOpen(false); navigate("/sales"); }}
                      className="w-full text-left px-4 py-2 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2.5"
                    >
                      <FileText size={14} className="text-indigo-500" /> New Tax Invoice
                    </button>
                    <button
                      onClick={() => { setQuickAddOpen(false); navigate("/purchases"); }}
                      className="w-full text-left px-4 py-2 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2.5"
                    >
                      <ShoppingBag size={14} className="text-amber-500" /> New Purchase Bill
                    </button>
                    <button
                      onClick={() => { setQuickAddOpen(false); navigate("/expenses"); }}
                      className="w-full text-left px-4 py-2 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2.5"
                    >
                      <Wallet size={14} className="text-rose-500" /> Record Expense / Income
                    </button>
                    <button
                      onClick={() => { setQuickAddOpen(false); navigate("/payments"); }}
                      className="w-full text-left px-4 py-2 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2.5"
                    >
                      <CreditCard size={14} className="text-blue-500" /> Record Payment / Receipt
                    </button>
                    <button
                      onClick={() => { setQuickAddOpen(false); navigate("/labour"); }}
                      className="w-full text-left px-4 py-2 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2.5"
                    >
                      <UserCheck size={14} className="text-emerald-500" /> Worker Wage / Upad
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <PWAInstallButton />
          </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden bg-white/90 backdrop-blur-xl border-b border-slate-200/80 p-3.5 flex items-center justify-between z-30 sticky top-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm shrink-0">
              B
            </div>
            <div className="truncate">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight truncate">
                {activeBusiness?.businessName || "Bina Enterprise"}
              </h1>
              <p className="text-[10px] text-slate-500 truncate">
                {locations.find(l => l.id === activeLocationId)?.name || "All Branches"}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            aria-label="Toggle navigation menu"
            className="p-2 -mr-1 text-slate-600 hover:text-slate-900"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </header>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="md:hidden absolute top-[58px] left-0 right-0 bg-white shadow-2xl z-50 border-b border-slate-200 py-3 px-4 space-y-1 max-h-[85vh] overflow-y-auto"
            >
              {/* Mobile Context Switcher */}
              <div className="bg-slate-50 p-3 rounded-xl mb-3 space-y-2 border border-slate-200/60">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Business Unit</label>
                  <select
                    value={activeBusiness?.id || ""}
                    onChange={(e) => {
                      const b = businesses.find(x => x.id === Number(e.target.value));
                      if (b) setActiveBusiness(b);
                    }}
                    className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg p-2 mt-0.5 text-slate-800"
                  >
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>{b.businessName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Branch / Site</label>
                  <select
                    value={activeLocationId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setActiveLocationId(val === "ALL" ? "ALL" : Number(val));
                    }}
                    className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg p-2 mt-0.5 text-slate-800"
                  >
                    <option value="ALL">All Branches & Locations</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <button 
                    key={item.path}
                    onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                      isActive ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <item.icon size={17} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                    {item.name}
                  </button>
                );
              })}

              <div className="h-px bg-slate-100 my-2" />
              <button 
                onClick={() => { navigate("/profile"); setMobileMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm text-slate-600 hover:bg-slate-50"
              >
                <User size={17} className="text-slate-400" />
                Profile & Business Details
              </button>
              <button 
                onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm text-rose-600 hover:bg-rose-50"
              >
                <LogOut size={17} className="text-rose-400" />
                Sign Out
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Page Content */}
        <div className="flex-1 overflow-y-auto">
          <motion.div 
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
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
