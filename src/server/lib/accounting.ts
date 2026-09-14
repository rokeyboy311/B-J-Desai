import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  records,
  investmentTransactions,
  investmentParties,
  materialPurchases,
  materialSupplies,
  materialLabourSupplies,
  labourSalaries,
} from '../../db/schema.js';

export class AccountingCalculator {
  static calculateMaterialTotal(quantity: number, rate: number, discount: number, taxPercentage: number, transportCost: number) {
    const subtotal = quantity * rate;
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = taxableAmount * (taxPercentage / 100);
    const total = taxableAmount + tax + transportCost;
    return { subtotal, taxableAmount, tax, total };
  }

  static calculateMaterialLabourTotal(materialAmount: number, labourAmount: number, discount: number, taxPercentage: number) {
    const subtotal = materialAmount + labourAmount;
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = taxableAmount * (taxPercentage / 100);
    const total = taxableAmount + tax;
    return { subtotal, taxableAmount, tax, total };
  }

  static calculateLabourSalary(days: number, dailyRate: number, tcQuantity: number, tcRate: number, otherEarnings: number, deduction: number, isTc: boolean) {
    let baseSalary = 0;
    if (isTc) {
      baseSalary = tcQuantity * tcRate;
    } else {
      baseSalary = days * dailyRate;
    }
    const grossSalary = baseSalary + otherEarnings;
    const netSalary = grossSalary - deduction;
    return { grossSalary, netSalary };
  }
}
