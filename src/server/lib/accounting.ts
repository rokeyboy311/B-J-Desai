import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { stockLedger, materials, auditLogs } from '../../db/schema.ts';

/**
 * Utility function to round numeric values to 2 decimal places (standard Indian currency precision)
 */
export function round2(val: number | string | null | undefined): number {
  const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
  if (isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export interface GSTCalculationResult {
  taxableAmount: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  isInterState: boolean;
}

export function calculateGST(
  taxableAmount: number,
  gstRate: number,
  isInterState: boolean = false
): GSTCalculationResult {
  const taxRate = Math.max(0, gstRate || 0);
  const taxBase = Math.max(0, taxableAmount || 0);
  const totalTax = round2(taxBase * (taxRate / 100));

  if (isInterState) {
    return {
      taxableAmount: taxBase,
      gstRate: taxRate,
      cgst: 0,
      sgst: 0,
      igst: totalTax,
      totalTax,
      isInterState: true
    };
  } else {
    const halfTax = round2(totalTax / 2);
    // Ensure sum matches totalTax without rounding gap
    const otherHalf = round2(totalTax - halfTax);
    return {
      taxableAmount: taxBase,
      gstRate: taxRate,
      cgst: halfTax,
      sgst: otherHalf,
      igst: 0,
      totalTax,
      isInterState: false
    };
  }
}

export interface MaterialPurchaseCalculation {
  quantity: number;
  rate: number;
  subtotal: number;
  discount: number;
  taxableAmount: number;
  taxPercentage: number;
  tax: number;
  transportCost: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
}

export function calculateMaterialPurchaseTotals(input: {
  quantity: number | string;
  rate: number | string;
  discount?: number | string;
  taxPercentage?: number | string;
  tax?: number | string;
  transportCost?: number | string;
  paidAmount?: number | string;
  paymentStatus?: string;
}): MaterialPurchaseCalculation {
  const quantity = Math.max(0, parseFloat(String(input.quantity)) || 0);
  const rate = Math.max(0, parseFloat(String(input.rate)) || 0);
  const discount = Math.max(0, parseFloat(String(input.discount || 0)) || 0);
  const taxPercentage = Math.max(0, parseFloat(String(input.taxPercentage || 0)) || 0);
  const transportCost = Math.max(0, parseFloat(String(input.transportCost || 0)) || 0);

  const subtotal = round2(quantity * rate);
  const taxableAmount = Math.max(0, round2(subtotal - discount));

  let tax: number;
  if (input.tax !== undefined && !isNaN(parseFloat(String(input.tax))) && parseFloat(String(input.tax)) > 0) {
    tax = round2(input.tax);
  } else {
    tax = round2(taxableAmount * (taxPercentage / 100));
  }

  const totalAmount = round2(taxableAmount + tax + transportCost);
  let paidAmount = 0;
  if (input.paidAmount !== undefined && !isNaN(parseFloat(String(input.paidAmount)))) {
    paidAmount = round2(input.paidAmount);
  } else if (input.paymentStatus === 'PAID') {
    paidAmount = totalAmount;
  }

  const outstandingAmount = Math.max(0, round2(totalAmount - paidAmount));

  let paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' = 'UNPAID';
  if (paidAmount >= totalAmount && totalAmount > 0) {
    paymentStatus = 'PAID';
  } else if (paidAmount > 0 && paidAmount < totalAmount) {
    paymentStatus = 'PARTIAL';
  }

  return {
    quantity,
    rate,
    subtotal,
    discount,
    taxableAmount,
    taxPercentage,
    tax,
    transportCost,
    totalAmount,
    paidAmount,
    outstandingAmount,
    paymentStatus
  };
}

export interface LabourSalaryCalculation {
  days: number;
  dailyRate: number;
  tcQuantity: number;
  tcRate: number;
  otherEarnings: number;
  grossSalary: number;
  deduction: number;
  netSalary: number;
  upad: number;
  paymentAmount: number;
  balance: number;
}

export function calculateLabourSalaryTotals(input: {
  attendanceType?: string;
  days?: number | string;
  dailyRate?: number | string;
  tcQuantity?: number | string;
  tcRate?: number | string;
  otherEarnings?: number | string;
  deduction?: number | string;
  upad?: number | string;
  paymentAmount?: number | string;
}): LabourSalaryCalculation {
  const isTc = String(input.attendanceType || '').toUpperCase() === 'TC';
  const days = Math.max(0, parseFloat(String(input.days || 0)) || 0);
  const dailyRate = Math.max(0, parseFloat(String(input.dailyRate || 0)) || 0);
  const tcQuantity = Math.max(0, parseFloat(String(input.tcQuantity || 0)) || 0);
  const tcRate = Math.max(0, parseFloat(String(input.tcRate || 0)) || 0);
  const otherEarnings = Math.max(0, parseFloat(String(input.otherEarnings || 0)) || 0);
  const deduction = Math.max(0, parseFloat(String(input.deduction || 0)) || 0);
  const upad = Math.max(0, parseFloat(String(input.upad || 0)) || 0);
  const paymentAmount = Math.max(0, parseFloat(String(input.paymentAmount || 0)) || 0);

  const baseSalary = isTc ? round2(tcQuantity * tcRate) : round2(days * dailyRate);
  const grossSalary = round2(baseSalary + otherEarnings);
  const netSalary = Math.max(0, round2(grossSalary - deduction));
  const totalPaidOut = round2(upad + paymentAmount);
  const balance = Math.max(0, round2(netSalary - totalPaidOut));

  return {
    days,
    dailyRate,
    tcQuantity,
    tcRate,
    otherEarnings,
    grossSalary,
    deduction,
    netSalary,
    upad,
    paymentAmount,
    balance
  };
}

/**
 * Category 1 (Investors) Capital & Upad calculation
 */
export function calculateInvestorSummary(transactions: Array<{
  type: string;
  amount: number | string;
}>): {
  totalCapital: number;
  totalUpad: number;
  availableBalance: number;
} {
  let totalCapital = 0;
  let totalUpad = 0;

  for (const tx of transactions) {
    const amt = parseFloat(String(tx.amount)) || 0;
    const typeUpper = (tx.type || '').toUpperCase();
    if (typeUpper === 'INVESTMENT' || typeUpper === 'CONTRIBUTION') {
      totalCapital += amt;
    } else if (typeUpper === 'UPAD' || typeUpper === 'PAYMENT') {
      totalUpad += amt;
    }
  }

  const availableBalance = Math.max(0, round2(totalCapital - totalUpad));
  return {
    totalCapital: round2(totalCapital),
    totalUpad: round2(totalUpad),
    availableBalance
  };
}

/**
 * Category 2 (Project Investment) Capital Flow & Deductions calculation
 * Full Capital = Investment from Investors (Investment Karya) + Bill Investment
 * Remaining Capital = Full Capital - Deductions (Cat 3 to 8) - Investor Upad / Return
 */
export function calculateCategory2Capital(input: {
  investmentFromInvestors: number;
  billInvestment?: number;
  cat3Deduction: number;
  cat4Deduction: number;
  cat5Deduction: number;
  cat67Deduction: number;
  cat8Deduction: number;
  investorUpadReturn?: number;
}): {
  investmentFromInvestors: number;
  billInvestment: number;
  fullCapital: number;
  totalDeductions: number;
  cat3Deduction: number;
  cat4Deduction: number;
  cat5Deduction: number;
  cat67Deduction: number;
  cat8Deduction: number;
  investorUpadReturn: number;
  remainingCapital: number;
} {
  const investmentFromInvestors = round2(input.investmentFromInvestors || 0);
  const billInvestment = round2(input.billInvestment || 0);
  const fullCapital = round2(investmentFromInvestors + billInvestment);
  const cat3 = round2(input.cat3Deduction || 0);
  const cat4 = round2(input.cat4Deduction || 0);
  const cat5 = round2(input.cat5Deduction || 0);
  const cat67 = round2(input.cat67Deduction || 0);
  const cat8 = round2(input.cat8Deduction || 0);
  const investorUpadReturn = round2(input.investorUpadReturn || 0);

  const totalDeductions = round2(cat3 + cat4 + cat5 + cat67 + cat8);
  const remainingCapital = round2(fullCapital - totalDeductions - investorUpadReturn);

  return {
    investmentFromInvestors,
    billInvestment,
    fullCapital,
    totalDeductions,
    cat3Deduction: cat3,
    cat4Deduction: cat4,
    cat5Deduction: cat5,
    cat67Deduction: cat67,
    cat8Deduction: cat8,
    investorUpadReturn,
    remainingCapital
  };
}

export class StockManager {
  /**
   * Atomically records a stock movement in the stock ledger
   */
  static async addStockMovement(
    dbTx: any,
    userId: number,
    locationId: number,
    materialId: number,
    type: 'IN' | 'OUT' | 'ADJUST',
    quantity: number,
    refId: number,
    refType: string,
    notes?: string
  ): Promise<void> {
    const parsedQty = parseFloat(String(quantity));
    if (!materialId || isNaN(parsedQty)) {
      throw new Error('Invalid stock movement parameters: materialId and valid quantity required');
    }
    const finalQty = type === 'OUT' ? -Math.abs(parsedQty) : Math.abs(parsedQty);

    await dbTx.insert(stockLedger).values({
      userId,
      locationId,
      materialId,
      transactionType: type,
      quantity: finalQty.toString(),
      referenceId: refId,
      referenceType: refType,
      notes: notes || null
    });
  }

  /**
   * Calculates the current stock balance for a given material at a location
   */
  static async getCurrentBalance(
    dbOrTx: any,
    locationId: number,
    materialId: number
  ): Promise<number> {
    const res = await dbOrTx
      .select({
        balance: sql<string>`COALESCE(SUM(CAST(${stockLedger.quantity} AS numeric)), 0)`
      })
      .from(stockLedger)
      .where(
        and(
          eq(stockLedger.locationId, locationId),
          eq(stockLedger.materialId, materialId),
          eq(stockLedger.isDeleted, 0)
        )
      );

    return round2(parseFloat(res[0]?.balance || '0'));
  }

  /**
   * Reconciles stock records and checks for negative stock
   */
  static async checkStockAvailability(
    dbOrTx: any,
    locationId: number,
    materialId: number,
    deductQty: number
  ): Promise<{ available: boolean; currentStock: number; newBalance: number }> {
    const currentStock = await this.getCurrentBalance(dbOrTx, locationId, materialId);
    const newBalance = round2(currentStock - deductQty);
    return {
      available: newBalance >= 0,
      currentStock,
      newBalance
    };
  }
}

export class AccountingCalculator {
  static calculateMaterialTotal(
    quantity: number,
    rate: number,
    discount: number,
    taxPercentage: number,
    transportCost: number
  ) {
    const res = calculateMaterialPurchaseTotals({
      quantity,
      rate,
      discount,
      taxPercentage,
      transportCost
    });
    return {
      subtotal: res.subtotal,
      taxableAmount: res.taxableAmount,
      tax: res.tax,
      total: res.totalAmount
    };
  }

  static calculateMaterialLabourTotal(
    materialAmount: number,
    labourAmount: number,
    discount: number,
    taxPercentage: number
  ) {
    const subtotal = round2((materialAmount || 0) + (labourAmount || 0));
    const taxableAmount = Math.max(0, round2(subtotal - (discount || 0)));
    const tax = round2(taxableAmount * ((taxPercentage || 0) / 100));
    const total = round2(taxableAmount + tax);
    return { subtotal, taxableAmount, tax, total };
  }

  static calculateLabourSalary(
    days: number,
    dailyRate: number,
    tcQuantity: number,
    tcRate: number,
    otherEarnings: number,
    deduction: number,
    isTc: boolean
  ) {
    const res = calculateLabourSalaryTotals({
      attendanceType: isTc ? 'TC' : 'DAILY',
      days,
      dailyRate,
      tcQuantity,
      tcRate,
      otherEarnings,
      deduction
    });
    return { grossSalary: res.grossSalary, netSalary: res.netSalary };
  }
}
