import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { auth } from "../lib/firebase";
import { 
  ArrowLeft, Download, Landmark, TrendingDown,
  ChevronDown, Truck, Wrench, HardHat, Wallet, TrendingUp, User
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PurchaseIcon } from "../components/icons/PurchaseIcon";

import InvestmentTab, { InvestmentSubCategory } from "../components/categories/InvestmentTab";
import ExpenseTab, { ExpenseSubCategory } from "../components/categories/ExpenseTab";
import SupervisorCostTab from "../components/categories/SupervisorCostTab";

export default function LocationDetailsPage() {
  const { id: locationId } = useParams();
  const navigate = useNavigate();
  
  // Primary Categories: 1st is Investment, 2nd is Expense, 3rd is Supervisor Cost
  const [activeCategory, setActiveCategory] = useState<"investment" | "expense" | "supervisor">("investment");
  const [investmentSubCategory, setInvestmentSubCategory] = useState<InvestmentSubCategory>("INVESTMENT");
  const [expenseSubCategory, setExpenseSubCategory] = useState<ExpenseSubCategory>("material-purchase");

  const [locationName, setLocationName] = useState("Loading...");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLocationDetails();
    
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [locationId]);

  const loadLocationDetails = async () => {
    try {
      const res = await apiFetch(`/locations`);
      const loc = res.find((l: any) => l.id === Number(locationId));
      if (loc) setLocationName(loc.name);
    } catch (error) {
      console.error(error);
    }
  };

  const handleExport = async (tabId: string, tabLabel: string) => {
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/reports/export-location/${locationId}?tab=${tabId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Export_${locationName.replace(/\s+/g, '_')}_${tabLabel.replace(/\s+/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Failed to export Excel file.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-7xl mx-auto pb-12"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button type="button"
            onClick={() => navigate("/locations")}
            className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">{locationName}</h1>
            <p className="text-sm text-slate-500 mt-1">Manage categories and records for this location.</p>
          </div>
        </div>
        
        {/* Export Excel Dropdown */}
        <div className="relative" ref={menuRef}>
          <button type="button"
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={isExporting}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50 w-full sm:w-auto"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{isExporting ? "Exporting..." : "Export Excel"}</span>
            <ChevronDown className="w-4 h-4 ml-1" />
          </button>
          
          <AnimatePresence>
            {showExportMenu && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 mt-2 w-64 bg-white border border-slate-200/60 rounded-xl shadow-lg z-50 overflow-hidden"
              >
                <div className="py-1">
                  <button type="button"
                    onClick={() => handleExport('all', 'All_Categories')}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-800 hover:bg-slate-50 font-bold border-b border-slate-200/60"
                  >
                    Export All Records (Full Ledger)
                  </button>

                  <div className="px-4 py-1.5 text-[11px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50/60">
                    1st Category: Investment
                  </div>
                  <button type="button"
                    onClick={() => handleExport('investment', 'Investment_Records')}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    <Landmark className="w-3.5 h-3.5 text-emerald-600" />
                    Investment & Upad Records
                  </button>

                  <div className="px-4 py-1.5 text-[11px] font-bold text-rose-800 uppercase tracking-wider bg-rose-50/60">
                    2nd Category: Expense
                  </div>
                  <button type="button"
                    onClick={() => handleExport('expense', 'All_Expenses')}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-800 font-medium"
                  >
                    <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                    All Expense Sub-Categories
                  </button>
                  <button type="button"
                    onClick={() => handleExport('material-purchase', 'Material_Purchases')}
                    className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-slate-600 hover:bg-rose-50 hover:text-rose-800 pl-7"
                  >
                    <PurchaseIcon className="w-3 h-3 text-slate-400" />
                    Material Purchases
                  </button>
                  <button type="button"
                    onClick={() => handleExport('material-supply', 'Material_Supplies')}
                    className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-slate-600 hover:bg-rose-50 hover:text-rose-800 pl-7"
                  >
                    <Truck className="w-3 h-3 text-slate-400" />
                    Material Supplies
                  </button>
                  <button type="button"
                    onClick={() => handleExport('material-labour-supply', 'Site_Supplies')}
                    className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-slate-600 hover:bg-rose-50 hover:text-rose-800 pl-7"
                  >
                    <Wrench className="w-3 h-3 text-slate-400" />
                    Site Supplies
                  </button>
                  <button type="button"
                    onClick={() => handleExport('labour-salary', 'Labour_Salaries')}
                    className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-slate-600 hover:bg-rose-50 hover:text-rose-800 pl-7"
                  >
                    <HardHat className="w-3 h-3 text-slate-400" />
                    Labour Salaries
                  </button>
                  <button type="button"
                    onClick={() => handleExport('income-expense', 'Site_Expenses')}
                    className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-slate-600 hover:bg-rose-50 hover:text-rose-800 pl-7"
                  >
                    <Wallet className="w-3 h-3 text-slate-400" />
                    Site / General Expenses
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

            {/* Modern Top Navigation */}
      <div className="flex flex-col gap-4">
        {/* Main Categories */}
        <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/60">
          <button type="button"
            onClick={() => setActiveCategory("investment")} 
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeCategory === "investment" 
                ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200/50" 
                : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <Landmark className="w-4 h-4" /> 1. Investment
          </button>
          
          <button type="button"
            onClick={() => setActiveCategory("expense")} 
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeCategory === "expense" 
                ? "bg-white text-rose-700 shadow-sm ring-1 ring-slate-200/50" 
                : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <TrendingDown className="w-4 h-4" /> 2. Expense
          </button>
          
          <button type="button"
            onClick={() => setActiveCategory("supervisor")} 
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeCategory === "supervisor" 
                ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50" 
                : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <HardHat className="w-4 h-4" /> 3. Supervisor
          </button>
        </div>

        {/* Sub Categories */}
        <div className="min-h-[44px]">
          <AnimatePresence mode="wait">
            {activeCategory === "investment" && (
              <motion.div 
                key="nav-invest"
                initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }}
                className="flex flex-wrap gap-2"
              >
                <button type="button" onClick={() => setInvestmentSubCategory("INVESTMENT")} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${investmentSubCategory === "INVESTMENT" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"}`}>
                  1. Investment
                </button>
                <button type="button" onClick={() => setInvestmentSubCategory("UPAD")} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${investmentSubCategory === "UPAD" ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"}`}>
                  2. Upad
                </button>
                <button type="button" onClick={() => setInvestmentSubCategory("PARTIES")} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${investmentSubCategory === "PARTIES" ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"}`}>
                  Party Ledger
                </button>
              </motion.div>
            )}
            
            {activeCategory === "expense" && (
              <motion.div 
                key="nav-exp"
                initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }}
                className="flex flex-wrap gap-2"
              >
                <button type="button" onClick={() => setExpenseSubCategory("material-purchase")} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all flex items-center gap-2 ${expenseSubCategory === "material-purchase" ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"}`}>
                  <PurchaseIcon className="w-3.5 h-3.5 opacity-70" /> 1. Material Purchase
                </button>
                <button type="button" onClick={() => setExpenseSubCategory("material-supply")} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all flex items-center gap-2 ${expenseSubCategory === "material-supply" ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"}`}>
                  <Truck className="w-3.5 h-3.5 opacity-70" /> 2. Material Supply
                </button>
                <button type="button" onClick={() => setExpenseSubCategory("material-labour-supply")} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all flex items-center gap-2 ${expenseSubCategory === "material-labour-supply" ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"}`}>
                  <Wrench className="w-3.5 h-3.5 opacity-70" /> 3. Site Supply
                </button>
                <button type="button" onClick={() => setExpenseSubCategory("labour-salary")} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all flex items-center gap-2 ${expenseSubCategory === "labour-salary" ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"}`}>
                  <HardHat className="w-3.5 h-3.5 opacity-70" /> 4. Labour Salary
                </button>
                <button type="button" onClick={() => setExpenseSubCategory("site-expenses")} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all flex items-center gap-2 ${expenseSubCategory === "site-expenses" ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"}`}>
                  <Wallet className="w-3.5 h-3.5 opacity-70" /> 5. Site Expenses
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content Area */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4 sm:p-6 lg:p-8 min-h-[600px] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {/* Category 1: Investment */}
              {activeCategory === "investment" && (
                <InvestmentTab 
                  locationId={Number(locationId)} 
                  activeSubCategory={investmentSubCategory}
                  onSubCategoryChange={setInvestmentSubCategory}
                />
              )}

              {/* Category 2: Expense */}
              {activeCategory === "expense" && (
                <ExpenseTab 
                  locationId={Number(locationId)} 
                  activeSubCategory={expenseSubCategory}
                  onSubCategoryChange={setExpenseSubCategory}
                />
              )}

              {/* Category 3: Supervisor Cost */}
              {activeCategory === "supervisor" && (
                <SupervisorCostTab 
                  locationId={Number(locationId)} 
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
    </motion.div>
  );
}

