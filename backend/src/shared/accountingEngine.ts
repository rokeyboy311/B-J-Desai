/**
 * @file src/shared/accountingEngine.ts
 * Single Source of Truth for all Accounting, GST, Inventory, and Labour Calculations.
 * Pure TypeScript with ZERO database or browser dependencies.
 * Uses deterministic 2-decimal arithmetic to eliminate binary float drift.
 */

export class DecimalMath {
  static round(value: number, decimals: number = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
  }

  static add(...values: number[]): number {
    const sum = values.reduce((acc, val) => acc + (Number(val) || 0), 0);
    return DecimalMath.round(sum);
  }

  static sub(a: number, b: number): number {
    return DecimalMath.round((Number(a) || 0) - (Number(b) || 0));
  }

  static mul(a: number, b: number): number {
    return DecimalMath.round((Number(a) || 0) * (Number(b) || 0));
  }

  static div(a: number, b: number): number {
    if (!b || b === 0) return 0;
    return DecimalMath.round((Number(a) || 0) / Number(b));
  }

  static max(a: number, b: number): number {
    return Math.max(DecimalMath.round(a), DecimalMath.round(b));
  }

  static min(a: number, b: number): number {
    return Math.min(DecimalMath.round(a), DecimalMath.round(b));
  }
}

export interface GstBreakdown {
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
}

export interface LineItemCalculation {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cessAmount: number;
  totalTax: number;
  totalAmount: number;
}

export interface DocumentTotals {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cessAmount: number;
  totalTax: number;
  transportCharges: number;
  roundOff: number;
  totalAmount: number;
}

export interface LabourCalculationResult {
  baseSalary: number;
  grossSalary: number;
  netSalary: number;
  balance: number;
}

export class AccountingEngine {
  /**
   * Validates Indian GSTIN format and extracts 2-digit state code.
   */
  static validateGstin(gstin?: string | null): { isValid: boolean; stateCode: string; error?: string } {
    if (!gstin || !gstin.trim()) {
      return { isValid: false, stateCode: '', error: 'GSTIN is empty' };
    }
    const clean = gstin.trim().toUpperCase();
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(clean)) {
      return { isValid: false, stateCode: clean.slice(0, 2), error: 'Invalid GSTIN format' };
    }
    return { isValid: true, stateCode: clean.slice(0, 2) };
  }

  /**
   * Determines GST breakdown based on Place of Supply vs Seller State.
   * Priority: Place of Supply State Code vs Seller State Code.
   */
  static calculateGst(
    taxableAmount: number,
    gstRate: number,
    isInterState: boolean,
    cessRate: number = 0
  ): GstBreakdown {
    const tax = DecimalMath.max(0, taxableAmount);
    const rate = DecimalMath.max(0, gstRate);
    const cessPct = DecimalMath.max(0, cessRate);

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isInterState) {
      igst = DecimalMath.round((tax * rate) / 100);
    } else {
      // Split equally between CGST and SGST
      cgst = DecimalMath.round((tax * (rate / 2)) / 100);
      sgst = DecimalMath.round((tax * (rate / 2)) / 100);
    }

    const cess = DecimalMath.round((tax * cessPct) / 100);
    const totalTax = DecimalMath.add(cgst, sgst, igst, cess);

    return { cgst, sgst, igst, cess, totalTax };
  }

  /**
   * Calculates a single line item with discount, GST, and Cess.
   */
  static calculateLineItem(params: {
    quantity: number;
    rate: number;
    discount?: number;
    discountPercent?: number;
    taxRate?: number;
    cessRate?: number;
    isInterState?: boolean;
    isTaxInclusive?: boolean;
  }): LineItemCalculation {
    const qty = DecimalMath.max(0, params.quantity || 0);
    const rate = DecimalMath.max(0, params.rate || 0);
    const taxRate = DecimalMath.max(0, params.taxRate || 0);
    const cessRate = DecimalMath.max(0, params.cessRate || 0);
    const isInterState = Boolean(params.isInterState);
    const isTaxInclusive = Boolean(params.isTaxInclusive);

    const subtotal = DecimalMath.mul(qty, rate);

    let discountAmount = DecimalMath.max(0, params.discount || 0);
    if (params.discountPercent && params.discountPercent > 0) {
      discountAmount = DecimalMath.round((subtotal * params.discountPercent) / 100);
    }
    discountAmount = DecimalMath.min(subtotal, discountAmount);

    let taxableAmount = DecimalMath.sub(subtotal, discountAmount);

    if (isTaxInclusive && (taxRate > 0 || cessRate > 0)) {
      const combinedRate = (taxRate + cessRate) / 100;
      taxableAmount = DecimalMath.round(taxableAmount / (1 + combinedRate));
    }

    const gst = AccountingEngine.calculateGst(taxableAmount, taxRate, isInterState, cessRate);
    const totalAmount = DecimalMath.add(taxableAmount, gst.totalTax);

    return {
      subtotal,
      discountAmount,
      taxableAmount,
      cgst: gst.cgst,
      sgst: gst.sgst,
      igst: gst.igst,
      cessAmount: gst.cess,
      totalTax: gst.totalTax,
      totalAmount,
    };
  }

  /**
   * Aggregates line items into document-level totals with transport charges and round-off.
   */
  static calculateDocumentTotals(
    lines: Array<{
      taxableAmount: number;
      cgst: number;
      sgst: number;
      igst: number;
      cessAmount?: number;
      subtotal?: number;
      discountAmount?: number;
    }>,
    transportCharges: number = 0,
    otherCharges: number = 0
  ): DocumentTotals {
    let subtotal = 0;
    let discount = 0;
    let taxableAmount = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let cessAmount = 0;

    for (const line of lines) {
      subtotal = DecimalMath.add(subtotal, line.subtotal ?? line.taxableAmount);
      discount = DecimalMath.add(discount, line.discountAmount || 0);
      taxableAmount = DecimalMath.add(taxableAmount, line.taxableAmount);
      cgst = DecimalMath.add(cgst, line.cgst);
      sgst = DecimalMath.add(sgst, line.sgst);
      igst = DecimalMath.add(igst, line.igst);
      cessAmount = DecimalMath.add(cessAmount, line.cessAmount || 0);
    }

    const totalTax = DecimalMath.add(cgst, sgst, igst, cessAmount);
    const transport = DecimalMath.max(0, transportCharges);
    const other = DecimalMath.max(0, otherCharges);

    const calculatedTotal = DecimalMath.add(taxableAmount, totalTax, transport, other);
    const roundedTotal = Math.round(calculatedTotal);
    const roundOff = DecimalMath.sub(roundedTotal, calculatedTotal);

    return {
      subtotal,
      discount,
      taxableAmount,
      cgst,
      sgst,
      igst,
      cessAmount,
      totalTax,
      transportCharges: transport,
      roundOff,
      totalAmount: roundedTotal,
    };
  }

  /**
   * Labour wage calculation:
   * Strictly separates Day-wise mode from TC-wise mode.
   * Day mode: Days * DailyRate (Half day = 0.5 * DailyRate).
   * TC mode: TCQuantity * TCRate (Zero daily rate multiplication).
   */
  static calculateLabourSalary(params: {
    workType?: string; // 'DAY_WORK' | 'TC_WORK'
    attendanceType?: string; // 'Full-day' | 'Half-day' | 'TC'
    days?: number;
    dailyRate?: number;
    tcQuantity?: number;
    tcRate?: number;
    otherEarnings?: number;
    deduction?: number;
    upad?: number;
    paymentAmount?: number;
  }): LabourCalculationResult {
    const isTc =
      params.workType === 'TC_WORK' ||
      params.attendanceType === 'TC' ||
      (Number(params.tcQuantity || 0) > 0 && Number(params.tcRate || 0) > 0);

    let baseSalary = 0;
    if (isTc) {
      const tcQty = DecimalMath.max(0, params.tcQuantity || 0);
      const tcRate = DecimalMath.max(0, params.tcRate || 0);
      baseSalary = DecimalMath.mul(tcQty, tcRate);
    } else {
      const isHalfDay =
        params.attendanceType === 'Half-day' ||
        params.attendanceType === 'HALF_DAY';
      const effectiveDays = isHalfDay ? 0.5 : DecimalMath.max(0, params.days || 0);
      const dailyRate = DecimalMath.max(0, params.dailyRate || 0);
      baseSalary = DecimalMath.mul(effectiveDays, dailyRate);
    }

    const otherEarnings = DecimalMath.max(0, params.otherEarnings || 0);
    const deduction = DecimalMath.max(0, params.deduction || 0);
    const upad = DecimalMath.max(0, params.upad || 0);
    const paymentAmount = DecimalMath.max(0, params.paymentAmount || 0);

    const grossSalary = DecimalMath.add(baseSalary, otherEarnings);
    const netSalary = DecimalMath.sub(grossSalary, deduction);
    const balance = DecimalMath.sub(netSalary, DecimalMath.add(upad, paymentAmount));

    return {
      baseSalary,
      grossSalary,
      netSalary,
      balance,
    };
  }

  /**
   * Refundable accounting logic:
   * Refundable deposits must not distort operating expense or revenue.
   */
  static calculateRefundable(amount: number, refundableAmount: number, refundedAmount: number) {
    const totalOutflow = DecimalMath.max(0, amount);
    const refundable = DecimalMath.max(0, refundableAmount);
    const refunded = DecimalMath.max(0, refundedAmount);

    const actualExpense = DecimalMath.max(0, DecimalMath.sub(totalOutflow, refundable));
    const pendingRefundable = DecimalMath.max(0, DecimalMath.sub(refundable, refunded));

    return {
      actualExpense,
      totalRefundable: refundable,
      totalRefunded: refunded,
      pendingRefundable,
    };
  }

  /**
   * Perpetual Weighted-Average Inventory Cost Recalculation:
   * Recalculates unit cost on incoming purchase:
   * NewAverageCost = (CurrentValue + IncomingCost) / (CurrentQty + IncomingQty)
   */
  static calculateWeightedAverageUnitCost(
    currentQty: number,
    currentUnitCost: number,
    incomingQty: number,
    incomingUnitCost: number
  ): number {
    const curQ = DecimalMath.max(0, currentQty);
    const curCost = DecimalMath.max(0, currentUnitCost);
    const inQ = DecimalMath.max(0, incomingQty);
    const inCost = DecimalMath.max(0, incomingUnitCost);

    const totalQty = DecimalMath.add(curQ, inQ);
    if (totalQty <= 0) return inCost > 0 ? inCost : curCost;

    const totalValue = DecimalMath.add(
      DecimalMath.mul(curQ, curCost),
      DecimalMath.mul(inQ, inCost)
    );

    return DecimalMath.div(totalValue, totalQty);
  }

  /**
   * Cost of Goods Sold (COGS) Formula:
   * COGS = Opening Stock Value + Purchases Cost - Purchase Returns Cost - Closing Stock Value
   */
  static calculateCOGS(
    openingStockValue: number,
    purchasesCost: number,
    purchaseReturnsCost: number,
    closingStockValue: number
  ): number {
    const opening = DecimalMath.max(0, openingStockValue);
    const purchases = DecimalMath.max(0, purchasesCost);
    const returns = DecimalMath.max(0, purchaseReturnsCost);
    const closing = DecimalMath.max(0, closingStockValue);

    return DecimalMath.max(0, DecimalMath.sub(DecimalMath.add(opening, purchases), DecimalMath.add(returns, closing)));
  }

  /**
   * Outstanding balance calculation:
   * Outstanding = Total Amount - Paid Amount
   */
  static calculateOutstanding(totalAmount: number, paidAmount: number): { outstanding: number; status: string } {
    const total = DecimalMath.max(0, totalAmount);
    const paid = DecimalMath.max(0, paidAmount);
    const outstanding = DecimalMath.max(0, DecimalMath.sub(total, paid));

    let status = 'UNPAID';
    if (outstanding === 0 && total > 0) {
      status = 'PAID';
    } else if (paid > 0 && outstanding > 0) {
      status = 'PARTIAL';
    }

    return { outstanding, status };
  }
}
