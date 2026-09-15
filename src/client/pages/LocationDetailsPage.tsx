import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { auth } from "../lib/firebase";
import { 
  ArrowLeft, Download, Landmark, TrendingDown,
  ChevronDown, Truck, Wrench, HardHat, Wallet, TrendingUp, User
, Database } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PurchaseIcon } from "../components/icons/PurchaseIcon";

import InvestmentTab, { InvestmentSubCategory } from "../components/categories/InvestmentTab";
import ExpenseTab, { ExpenseSubCategory } from "../components/categories/ExpenseTab";
import SupervisorCostTab from "../components/categories/SupervisorCostTab";
import MasterDataTab from "../components/categories/MasterDataTab";

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

      {/* Main Two-Category Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Navigation Sidebar: 1st Investment & 2nd Expense */}
        <div className="flex overflow-x-auto lg:flex-col gap-3 lg:w-72 flex-shrink-0 no-scrollbar pb-2 lg:pb-0">
          
          {/* 1st Category: INVESTMENT */}
          <div className="flex flex-col gap-1.5 bg-white p-2 rounded-2xl border border-slate-200/60 shadow-sm min-w-[240px] lg:min-w-0">
            <button type="button"
              id="main-cat-investment"
              onClick={() => setActiveCategory("investment")}
              className={`flex items-center justify-between p-3 rounded-xl transition-all duration-200 text-left ${
                activeCategory === "investment"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                  : "hover:bg-slate-50 text-slate-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${activeCategory === "investment" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-sm">1. Investment</div>
                  <div className={`text-xs ${activeCategory === "investment" ? "text-emerald-100" : "text-slate-400"}`}>
                    Capital & Upad
                  </div>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeCategory === "investment" ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-700"
              }`}>
                1st Cat
              </span>
            </button>

            {/* Investment Sub-Categories */}
            <div className={`flex flex-col gap-1 pl-3 pr-1 py-1 border-l-2 ml-4 ${
              activeCategory === "investment" ? "border-emerald-500" : "border-slate-200"
            }`}>
              <button type="button"
                onClick={() => {
                  setActiveCategory("investment");
                  setInvestmentSubCategory("INVESTMENT");
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                  activeCategory === "investment" && investmentSubCategory === "INVESTMENT"
                    ? "bg-emerald-100 text-emerald-800 font-bold"
                    : "text-slate-600 hover:text-emerald-700 hover:bg-slate-50"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  activeCategory === "investment" && investmentSubCategory === "INVESTMENT" ? "bg-emerald-600" : "bg-slate-300"
                }`}></span>
                1. Investment
              </button>

              <button type="button"
                onClick={() => {
                  setActiveCategory("investment");
                  setInvestmentSubCategory("UPAD");
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                  activeCategory === "investment" && investmentSubCategory === "UPAD"
                    ? "bg-amber-100 text-amber-900 font-bold"
                    : "text-slate-600 hover:text-amber-700 hover:bg-slate-50"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  activeCategory === "investment" && investmentSubCategory === "UPAD" ? "bg-amber-600" : "bg-slate-300"
                }`}></span>
                2. Upad
              </button>

              <button type="button"
                onClick={() => {
                  setActiveCategory("investment");
                  setInvestmentSubCategory("PARTIES");
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                  activeCategory === "investment" && investmentSubCategory === "PARTIES"
                    ? "bg-blue-100 text-blue-900 font-bold"
                    : "text-slate-600 hover:text-blue-700 hover:bg-slate-50"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  activeCategory === "investment" && investmentSubCategory === "PARTIES" ? "bg-blue-600" : "bg-slate-300"
                }`}></span>
                Party Ledger
              </button>

              <button type="button"
                onClick={() => {
                  setActiveCategory("investment");
                  setInvestmentSubCategory("CONNECTED_EXPENSES");
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                  activeCategory === "investment" && investmentSubCategory === "CONNECTED_EXPENSES"
                    ? "bg-rose-100 text-rose-900 font-bold"
                    : "text-slate-600 hover:text-rose-700 hover:bg-slate-50"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  activeCategory === "investment" && investmentSubCategory === "CONNECTED_EXPENSES" ? "bg-rose-600" : "bg-slate-300"
                }`}></span>
                Part 2: Connected Exp
              </button>
            </div>
          </div>

          {/* 2nd Category: EXPENSE */}
          <div className="flex flex-col gap-1.5 bg-white p-2 rounded-2xl border border-slate-200/60 shadow-sm min-w-[240px] lg:min-w-0">
            <button type="button"
              id="main-cat-expense"
              onClick={() => setActiveCategory("expense")}
              className={`flex items-center justify-between p-3 rounded-xl transition-all duration-200 text-left ${
                activeCategory === "expense"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-500/20"
                  : "hover:bg-slate-50 text-slate-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${activeCategory === "expense" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"}`}>
                  <TrendingDown className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-sm">2. Expense</div>
                  <div className={`text-xs ${activeCategory === "expense" ? "text-rose-100" : "text-slate-400"}`}>
                    Materials & Labour
                  </div>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeCategory === "expense" ? "bg-rose-700 text-white" : "bg-rose-50 text-rose-700"
              }`}>
                2nd Cat
              </span>
            </button>

            {/* Expense Sub-Categories */}
            <div className={`flex flex-col gap-1 pl-3 pr-1 py-1 border-l-2 ml-4 ${
              activeCategory === "expense" ? "border-rose-500" : "border-slate-200"
            }`}>
              <button type="button"
                onClick={() => {
                  setActiveCategory("expense");
                  setExpenseSubCategory("material-purchase");
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                  activeCategory === "expense" && expenseSubCategory === "material-purchase"
                    ? "bg-rose-100 text-rose-900 font-bold"
                    : "text-slate-600 hover:text-rose-700 hover:bg-slate-50"
                }`}
              >
                <PurchaseIcon className="w-3 h-3 text-slate-400" />
                1. Material Purchase
              </button>

              <button type="button"
                onClick={() => {
                  setActiveCategory("expense");
                  setExpenseSubCategory("material-supply");
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                  activeCategory === "expense" && expenseSubCategory === "material-supply"
                    ? "bg-rose-100 text-rose-900 font-bold"
                    : "text-slate-600 hover:text-rose-700 hover:bg-slate-50"
                }`}
              >
                <Truck className="w-3 h-3 text-slate-400" />
                2. Material Supply
              </button>

              <button type="button"
                onClick={() => {
                  setActiveCategory("expense");
                  setExpenseSubCategory("material-labour-supply");
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                  activeCategory === "expense" && expenseSubCategory === "material-labour-supply"
                    ? "bg-rose-100 text-rose-900 font-bold"
                    : "text-slate-600 hover:text-rose-700 hover:bg-slate-50"
                }`}
              >
                <Wrench className="w-3 h-3 text-slate-400" />
                3. Site Supply
              </button>

              <button type="button"
                onClick={() => {
                  setActiveCategory("expense");
                  setExpenseSubCategory("labour-salary");
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                  activeCategory === "expense" && expenseSubCategory === "labour-salary"
                    ? "bg-rose-100 text-rose-900 font-bold"
                    : "text-slate-600 hover:text-rose-700 hover:bg-slate-50"
                }`}
              >
                <HardHat className="w-3 h-3 text-slate-400" />
                4. Labour Salary
              </button>

              <button type="button"
                onClick={() => {
                  setActiveCategory("expense");
                  setExpenseSubCategory("site-expenses");
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                  activeCategory === "expense" && expenseSubCategory === "site-expenses"
                    ? "bg-rose-100 text-rose-900 font-bold"
                    : "text-slate-600 hover:text-rose-700 hover:bg-slate-50"
                }`}
              >
                <Wallet className="w-3 h-3 text-slate-400" />
                5. Site Expenses
              </button>
            </div>
          </div>
          {/* 4th Category: MASTER DATA */}
    <div className="flex flex-col gap-1.5 bg-white p-2 rounded-2xl border border-slate-200/60 shadow-sm min-w-[240px] lg:min-w-0">
      <button type="button"
        id="main-cat-master"
        onClick={() => setActiveCategory("master")}
        className={`flex items-center justify-between p-3 rounded-xl transition-all duration-200 text-left ${
          activeCategory === "master"
            ? "bg-slate-800 text-white shadow-md shadow-slate-900/20"
            : "hover:bg-slate-50 text-slate-700"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${activeCategory === "master" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}`}>
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-sm">4. Master Data</div>
            <div className={`text-xs ${activeCategory === "master" ? "text-slate-300" : "text-slate-400"}`}>
              Materials & Labour Config
            </div>
          </div>
        </div>
      </button>
    </div>

    {/* 3rd Category: SUPERVISOR COST */}
          <div className="flex flex-col gap-1.5 bg-white p-2 rounded-2xl border border-slate-200/60 shadow-sm min-w-[240px] lg:min-w-0">
            <button type="button"
              id="main-cat-supervisor"
              onClick={() => setActiveCategory("supervisor")}
              className={`flex items-center justify-between p-3 rounded-xl transition-all duration-200 text-left ${
                activeCategory === "supervisor"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "hover:bg-slate-50 text-slate-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${activeCategory === "supervisor" ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"}`}>
                  <HardHat className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-sm">3. Supervisor</div>
                  <div className={`text-xs ${activeCategory === "supervisor" ? "text-indigo-100" : "text-slate-400"}`}>
                    Site Supervisor Cost
                  </div>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeCategory === "supervisor" ? "bg-indigo-700 text-white" : "bg-indigo-50 text-indigo-700"
              }`}>
                3rd Cat
              </span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4 sm:p-6 lg:p-8 min-h-[600px] overflow-hidden">
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
              {activeCategory === "master" && (
      <MasterDataTab locationId={Number(locationId)} />
    )}
  </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

