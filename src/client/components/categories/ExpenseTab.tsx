import React, { useState, useEffect } from "react";
import { 
  Truck, Wrench, HardHat, Wallet, 
  TrendingDown, ArrowRight
} from "lucide-react";
import { PurchaseIcon } from "../icons/PurchaseIcon";
import MaterialPurchaseTab from "./MaterialPurchaseTab";
import MaterialSupplyTab from "./MaterialSupplyTab";
import SiteSupplyTab from "./SiteSupplyTab";

import IncomeExpenseTab from "./IncomeExpenseTab";
import { apiFetch } from "../../lib/api";
import { useLiveSync } from "../../hooks/useLiveSync";

export type ExpenseSubCategory = 
  | "material-purchase" 
  | "material-supply" 
  | "material-labour-supply" 
  | "labour-salary" 
  | "site-expenses";

interface ExpenseTabProps {
  locationId: number;
  activeSubCategory?: ExpenseSubCategory;
  onSubCategoryChange?: (subCategory: ExpenseSubCategory) => void;
}

export default function ExpenseTab({
  locationId,
  activeSubCategory: controlledSubCategory,
  onSubCategoryChange
}: ExpenseTabProps) {
  const [internalSubCategory, setInternalSubCategory] = useState<ExpenseSubCategory>("material-purchase");
  const subCategory = controlledSubCategory || internalSubCategory;

  const handleSetSubCategory = (cat: ExpenseSubCategory) => {
    if (onSubCategoryChange) {
      onSubCategoryChange(cat);
    }
    setInternalSubCategory(cat);
  };

  const [metrics, setMetrics] = useState({
    materialPurchaseTotal: 0,
    materialSupplyTotal: 0,
    materialLabourTotal: 0,
    labourSalaryTotal: 0,
    siteExpenseTotal: 0,
    loading: true
  });

  useEffect(() => {
    loadExpenseMetrics();
  }, [locationId]);

  useLiveSync(() => {
    loadExpenseMetrics();
  }, 3500);

  const loadExpenseMetrics = async () => {
    try {
      const [purchases, supplies, labourSupplies, salaries, incomeExpense] = await Promise.all([
        apiFetch(`/materials/purchase?locationId=${locationId}`).catch(() => []),
        apiFetch(`/materials/supply?locationId=${locationId}`).catch(() => []),
        apiFetch(`/materials/labour-supply?locationId=${locationId}`).catch(() => []),
        apiFetch(`/labour/salary?locationId=${locationId}`).catch(() => []),
        apiFetch(`/records?locationId=${locationId}`).catch(() => []),
      ]);

      const purTotal = (purchases || []).reduce((acc: number, r: any) => {
        const qty = parseFloat(r.quantity) || 0;
        const rate = parseFloat(r.rate) || 0;
        const sub = parseFloat(r.subtotal) || Math.round(qty * rate * 100) / 100;
        const disc = parseFloat(r.discount) || 0;
        const trans = parseFloat(r.transportCost) || 0;
        const taxRate = parseFloat(r.taxPercentage) || 0;
        const taxable = Math.max(0, sub - disc);
        const tax = parseFloat(r.tax) || Math.round(taxable * (taxRate / 100) * 100) / 100;
        const calculated = Math.round((taxable + tax + trans) * 100) / 100;
        const rowTot = (parseFloat(r.totalAmount) > 0 && Math.abs(parseFloat(r.totalAmount) - (taxable + tax + trans)) < 1)
          ? parseFloat(r.totalAmount)
          : calculated;
        return acc + rowTot;
      }, 0);
      const supTotal = (supplies || []).reduce((acc: number, r: any) => acc + (parseFloat(r.totalAmount) || 0), 0);
      const labSupTotal = (labourSupplies || []).reduce((acc: number, r: any) => acc + (parseFloat(r.totalAmount) || 0), 0);
      const salTotal = (salaries || []).reduce((acc: number, r: any) => acc + (parseFloat(r.paymentAmount || r.netSalary) || 0), 0);
      const siteTotal = (incomeExpense || [])
        .filter((r: any) => r.type === "EXPENSE")
        .reduce((acc: number, r: any) => acc + (parseFloat(r.amount) || 0), 0);

      setMetrics({
        materialPurchaseTotal: purTotal,
        materialSupplyTotal: supTotal,
        materialLabourTotal: labSupTotal,
        labourSalaryTotal: salTotal,
        siteExpenseTotal: siteTotal,
        loading: false
      });
    } catch (err) {
      console.error("Failed to load expense metrics:", err);
      setMetrics(prev => ({ ...prev, loading: false }));
    }
  };

  const expenseSubCategories = [
    {
      id: "material-purchase" as ExpenseSubCategory,
      number: "1",
      label: "Material Purchase",
      shortLabel: "Material Purchase",
      icon: PurchaseIcon,
      color: "blue",
      total: metrics.materialPurchaseTotal,
      description: "Raw material procurement & supplier bills",
    },
    {
      id: "material-supply" as ExpenseSubCategory,
      number: "2",
      label: "Material Supply",
      shortLabel: "Material Supply",
      icon: Truck,
      color: "emerald",
      total: metrics.materialSupplyTotal,
      description: "Supplied materials & delivery dispatches",
    },
    {
      id: "material-labour-supply" as ExpenseSubCategory,
      number: "3",
      label: "Site Supply",
      shortLabel: "Site Supply",
      icon: Wrench,
      color: "indigo",
      total: metrics.materialLabourTotal,
      description: "Site material and contract work supply",
    },
    {
      id: "labour-salary" as ExpenseSubCategory,
      number: "4",
      label: "Labour Salary",
      shortLabel: "Labour Salary",
      icon: HardHat,
      color: "amber",
      total: metrics.labourSalaryTotal,
      description: "Worker attendance, daily wages, upad & payout",
    },
    {
      id: "site-expenses" as ExpenseSubCategory,
      number: "5",
      label: "Site Expenses",
      shortLabel: "Site Expenses",
      icon: Wallet,
      color: "purple",
      total: metrics.siteExpenseTotal,
      description: "General petty cash & site operational expenses",
    },
  ];

  const totalAllExpenses = 
    metrics.materialPurchaseTotal + 
    metrics.materialSupplyTotal + 
    metrics.materialLabourTotal + 
    metrics.labourSalaryTotal + 
    metrics.siteExpenseTotal;

  return (
    <div className="space-y-6" id="expense-category-container">
      {/* Category Header with Total Expense KPI */}
      <div className="bg-gradient-to-r from-rose-50/70 via-orange-50/40 to-amber-50/50 border border-rose-200/70 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-500 text-white rounded-xl shadow-sm shadow-rose-500/20">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                2nd Category
              </span>
              <h2 className="text-lg font-bold text-slate-900">Expense Management</h2>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Sub-categories: Material Purchase, Material Supply, Site Supply, Labour Salary & Site Expenses
            </p>
          </div>
        </div>

        <div className="flex items-baseline gap-2 bg-white/80 border border-rose-100 px-4 py-2 rounded-xl self-start sm:self-auto shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Expenses:</span>
          <span className="text-xl font-bold text-rose-600">
            ₹{totalAllExpenses.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Sub-Category Navigation Bar */}
      <div className="bg-slate-50/90 p-1.5 rounded-2xl border border-gray-200/80 shadow-inner">
        <div className="flex items-center gap-1.5 overflow-x-auto p-0.5 no-scrollbar">
          {expenseSubCategories.map((cat) => {
            const Icon = cat.icon;
            const isActive = subCategory === cat.id;
            return (
              <button type="button"
                key={cat.id}
                id={`expense-subcat-${cat.id}`}
                onClick={() => handleSetSubCategory(cat.id)}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-[1.01]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
                }`}
              >
                <div className={`p-1 rounded-lg ${isActive ? "bg-white/20 text-white" : "bg-slate-200/70 text-slate-700"}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span>{cat.number}. {cat.shortLabel}</span>
                {cat.total > 0 && (
                  <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? "bg-blue-700/80 text-white" : "bg-slate-200 text-slate-700"
                  }`}>
                    ₹{cat.total >= 100000 ? `${(cat.total / 100000).toFixed(1)}L` : cat.total.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Render the Active Sub-Category Component */}
      <div className="pt-1">
        {subCategory === "material-purchase" && (
          <MaterialPurchaseTab locationId={locationId} />
        )}
        {subCategory === "material-supply" && (
          <MaterialSupplyTab locationId={locationId} />
        )}
        {subCategory === "material-labour-supply" && (
          <SiteSupplyTab locationId={locationId} />
        )}
        {subCategory === "labour-salary" && (
          <div className="p-4 bg-red-50 text-red-600 rounded">Labour operations moved to dedicated tab</div>
        )}
        {subCategory === "site-expenses" && (
          <IncomeExpenseTab locationId={locationId} />
        )}
      </div>
    </div>
  );
}
