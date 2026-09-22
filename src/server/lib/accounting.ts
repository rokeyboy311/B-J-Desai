import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { 
  stockLedger, 
  materials, 
  auditLogs,
  investors,
  investorTransactions,
  investorLocationAllocations,
  materialPurchases,
  locations
} from '../../db/schema.ts';

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
  quantity?: number;
  rate?: number;
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
  quantity?: number | string;
  rate?: number | string;
  otherEarnings?: number | string;
  grossSalary?: number | string;
  netSalary?: number | string;
  deduction?: number | string;
  upad?: number | string;
  paymentAmount?: number | string;
  amount?: number | string;
}): LabourSalaryCalculation {
  const attUpper = String(input.attendanceType || '').toUpperCase();

  // 1. Team Upad (Advance Payment to Team)
  if (attUpper.includes('UPAD') || attUpper === 'TEAM_UPAD') {
    const upadAmt = Math.max(0, parseFloat(String(input.upad || input.paymentAmount || input.amount || 0)) || 0);
    return {
      days: 0,
      dailyRate: 0,
      tcQuantity: 0,
      tcRate: 0,
      quantity: 0,
      rate: 0,
      otherEarnings: 0,
      grossSalary: 0,
      deduction: 0,
      netSalary: 0,
      upad: upadAmt,
      paymentAmount: upadAmt,
      balance: -upadAmt // negative balance represents advance taken
    };
  }

  // 2. Other Kharch (Site / Labour Miscellaneous Expense)
  if (attUpper.includes('KHARCH') || attUpper === 'OTHER_KHARCH' || attUpper === 'EXPENSE') {
    const expAmt = Math.max(0, parseFloat(String(input.amount || input.paymentAmount || input.grossSalary || input.otherEarnings || 0)) || 0);
    return {
      days: 0,
      dailyRate: 0,
      tcQuantity: 0,
      tcRate: 0,
      quantity: 0,
      rate: 0,
      otherEarnings: 0,
      grossSalary: expAmt,
      deduction: 0,
      netSalary: expAmt,
      upad: 0,
      paymentAmount: expAmt,
      balance: 0
    };
  }

  // 3. Add Attendance: Day Wise or TC Wise
  const isWork = attUpper.includes('WORK') || attUpper.includes('TC');
  const days = Math.max(0, parseFloat(String(input.days || 0)) || 0);
  const dailyRate = Math.max(0, parseFloat(String(input.dailyRate || 0)) || 0);
  const workQuantity = Math.max(0, parseFloat(String(input.quantity ?? input.tcQuantity ?? 0)) || 0);
  const workRate = Math.max(0, parseFloat(String(input.rate ?? input.tcRate ?? dailyRate)) || 0);
  const otherEarnings = Math.max(0, parseFloat(String(input.otherEarnings || 0)) || 0);
  const deduction = Math.max(0, parseFloat(String(input.deduction || 0)) || 0);
  const upad = Math.max(0, parseFloat(String(input.upad || 0)) || 0);
  const paymentAmount = Math.max(0, parseFloat(String(input.paymentAmount || 0)) || 0);

  const baseSalary = isWork ? round2(workQuantity * workRate) : round2(days * dailyRate);
  const grossSalary = round2(baseSalary + otherEarnings);
  const netSalary = Math.max(0, round2(grossSalary - deduction));
  const totalPaidOut = round2(upad + paymentAmount);
  // Balance calculation
  const balance = round2(netSalary - totalPaidOut);

  return {
    days,
    dailyRate,
    tcQuantity: workQuantity,
    tcRate: workRate,
    quantity: workQuantity,
    rate: workRate,
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
 * Total Deductions = Cat 3 (Material Purchases) + Cat 4 (Material Supplies) + Cat 5 (Site Supplies) + Cat 6 (Labour Attendance + Team Upad + Other Kharch) + Refundable Outflows
 * Remaining Capital = Full Capital - Total Deductions (Cat 3 to 6 & Refundables) - Investor Upad / Return
 */
export function calculateCategory2Capital(input: {
  investmentFromInvestors: number;
  billInvestment?: number;
  cat3Deduction: number;
  cat4Deduction?: number;
  cat5Deduction: number;
  cat6Deduction: number;
  cat67Deduction?: number;
  cat8Deduction?: number;
  refundableDeduction?: number;
  investorUpadReturn?: number;
}): {
  investmentFromInvestors: number;
  billInvestment: number;
  fullCapital: number;
  totalDeductions: number;
  cat3Deduction: number;
  cat4Deduction: number;
  cat5Deduction: number;
  cat6Deduction: number;
  cat67Deduction: number;
  refundableDeduction: number;
  investorUpadReturn: number;
  remainingCapital: number;
} {
  const investmentFromInvestors = round2(input.investmentFromInvestors || 0);
  const billInvestment = round2(input.billInvestment || 0);
  const fullCapital = round2(investmentFromInvestors + billInvestment);
  const cat3 = round2(input.cat3Deduction || 0);
  const cat4 = round2(input.cat4Deduction || 0);
  const cat5 = round2(input.cat5Deduction || 0);
  const cat6 = round2(input.cat6Deduction ?? input.cat67Deduction ?? 0);
  const refundableDeduction = round2(input.refundableDeduction || 0);
  const investorUpadReturn = round2(input.investorUpadReturn || 0);

  // Total deductions across Categories 3, 4, 5, 6 and Refundable Outflows
  const totalDeductions = round2(cat3 + cat4 + cat5 + cat6 + refundableDeduction);
  const remainingCapital = round2(fullCapital - totalDeductions - investorUpadReturn);

  return {
    investmentFromInvestors,
    billInvestment,
    fullCapital,
    totalDeductions,
    cat3Deduction: cat3,
    cat4Deduction: cat4,
    cat5Deduction: cat5,
    cat6Deduction: cat6,
    cat67Deduction: cat6,
    refundableDeduction,
    investorUpadReturn,
    remainingCapital
  };
}

export interface SiteSupplyItemCalculation {
  materialId: number;
  quantity: number;
  unit: string;
  rate: number;
  subtotal: number;
  taxPercentage: number;
  taxAmount: number;
  totalAmount: number;
}

export function calculateSiteSupplyItemTotals(input: {
  materialId: number | string;
  quantity: number | string;
  unit?: string;
  rate: number | string;
  taxPercentage?: number | string;
  taxAmount?: number | string;
}): SiteSupplyItemCalculation {
  const quantity = Math.max(0, parseFloat(String(input.quantity)) || 0);
  const rate = Math.max(0, parseFloat(String(input.rate)) || 0);
  const subtotal = round2(quantity * rate);
  const taxPercentage = Math.max(0, parseFloat(String(input.taxPercentage || 0)) || 0);

  let taxAmount = 0;
  if (input.taxAmount !== undefined && !isNaN(parseFloat(String(input.taxAmount))) && parseFloat(String(input.taxAmount)) > 0) {
    taxAmount = round2(input.taxAmount);
  } else {
    taxAmount = round2(subtotal * (taxPercentage / 100));
  }

  const totalAmount = round2(subtotal + taxAmount);

  return {
    materialId: parseInt(String(input.materialId), 10),
    quantity,
    unit: input.unit || 'Nos',
    rate,
    subtotal,
    taxPercentage,
    taxAmount,
    totalAmount
  };
}

export function calculateSiteSupplyTotals(items: Array<{
  materialId: number | string;
  quantity: number | string;
  unit?: string;
  rate: number | string;
  taxPercentage?: number | string;
  taxAmount?: number | string;
}>): {
  items: SiteSupplyItemCalculation[];
  totalQuantity: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
} {
  const processedItems = items.map(calculateSiteSupplyItemTotals);
  const totalQuantity = round2(processedItems.reduce((acc, i) => acc + i.quantity, 0));
  const subtotal = round2(processedItems.reduce((acc, i) => acc + i.subtotal, 0));
  const taxAmount = round2(processedItems.reduce((acc, i) => acc + i.taxAmount, 0));
  const totalAmount = round2(subtotal + taxAmount);

  return {
    items: processedItems,
    totalQuantity,
    subtotal,
    taxAmount,
    totalAmount
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

  /**
   * Calculates the central enterprise-wide stock balance for a given material
   * Central Stock = Total Purchases (IN) - Total Customer Supplies (OUT) - Total Site Supplies (OUT) + Adjustments
   */
  static async getCentralStock(
    dbOrTx: any,
    materialId: number
  ): Promise<number> {
    const res = await dbOrTx
      .select({
        balance: sql<string>`COALESCE(SUM(CAST(${stockLedger.quantity} AS numeric)), 0)`
      })
      .from(stockLedger)
      .where(
        and(
          eq(stockLedger.materialId, materialId),
          eq(stockLedger.isDeleted, 0)
        )
      );

    return round2(parseFloat(res[0]?.balance || '0'));
  }

  /**
   * Validates available central stock before allowing Customer Supply or Site Supply
   */
  static async checkCentralStockAvailability(
    dbOrTx: any,
    materialId: number,
    deductQty: number
  ): Promise<{ available: boolean; currentStock: number; newBalance: number }> {
    const currentStock = await this.getCentralStock(dbOrTx, materialId);
    const newBalance = round2(currentStock - deductQty);
    return {
      available: newBalance >= 0,
      currentStock,
      newBalance
    };
  }
}

export interface AdminCapitalSummaryResult {
  totalContributed: number;
  totalWithdrawn: number;
  totalAllocated: number;
  totalPurchases: number;
  availableAdminCapital: number;
  investors: Array<{
    id: number;
    name: string;
    mobile: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    totalContributed: number;
    totalWithdrawn: number;
    totalAllocated: number;
    availableCapital: number;
  }>;
  recentTransfers: Array<any>;
  recentPurchases: Array<any>;
}

/**
 * Calculates authoritative Admin Capital metrics according to the 3-Tier Capital workflow:
 * ADMIN CAPITAL:
 * Total Contributed (from Investors)
 * - Total Withdrawn (Investor Upads)
 * - Total Transferred to Locations (Allocated to Location Investor Capital)
 * - Total Material Purchases (Directly funded from Admin Capital)
 * = Available Admin Capital
 */
export async function getAdminCapitalSummary(
  dbOrTx: any = db,
  userId?: number
): Promise<AdminCapitalSummaryResult> {
  // 1. Fetch all active investors
  const activeInvestors = await dbOrTx
    .select()
    .from(investors)
    .where(eq(investors.isDeleted, 0))
    .orderBy(desc(investors.createdAt));

  const investorIds = activeInvestors.map((i: any) => i.id);

  // 2. Fetch all investor transactions (CONTRIBUTION & UPAD)
  let allTxs: any[] = [];
  if (investorIds.length > 0) {
    allTxs = await dbOrTx
      .select()
      .from(investorTransactions)
      .where(
        and(
          sql`${investorTransactions.investorId} IN (${sql.join(investorIds, sql`, `)})`,
          eq(investorTransactions.isDeleted, 0)
        )
      )
      .orderBy(desc(investorTransactions.date), desc(investorTransactions.id));
  }

  // 3. Fetch all allocations from Admin Capital to Location Investor Capital
  let allAllocations: any[] = [];
  if (investorIds.length > 0) {
    allAllocations = await dbOrTx
      .select({
        id: investorLocationAllocations.id,
        investorId: investorLocationAllocations.investorId,
        investorName: investors.name,
        locationId: investorLocationAllocations.locationId,
        locationName: locations.name,
        amount: investorLocationAllocations.amount,
        date: investorLocationAllocations.date,
        paymentMethod: investorLocationAllocations.paymentMethod,
        referenceNumber: investorLocationAllocations.referenceNumber,
        notes: investorLocationAllocations.notes,
        createdAt: investorLocationAllocations.createdAt,
      })
      .from(investorLocationAllocations)
      .leftJoin(investors, eq(investorLocationAllocations.investorId, investors.id))
      .leftJoin(locations, eq(investorLocationAllocations.locationId, locations.id))
      .where(
        and(
          sql`${investorLocationAllocations.investorId} IN (${sql.join(investorIds, sql`, `)})`,
          eq(investorLocationAllocations.isDeleted, 0)
        )
      )
      .orderBy(desc(investorLocationAllocations.date), desc(investorLocationAllocations.id));
  }

  // 4. Fetch all Material Purchases funded from Admin Capital
  const allPurchases = await dbOrTx
    .select({
      id: materialPurchases.id,
      date: materialPurchases.date,
      partyName: materialPurchases.partyName,
      materialName: materialPurchases.materialName,
      quantity: materialPurchases.quantity,
      unit: materialPurchases.unit,
      rate: materialPurchases.rate,
      totalAmount: materialPurchases.totalAmount,
      paidAmount: materialPurchases.paidAmount,
      paymentStatus: materialPurchases.paymentStatus,
      referenceNumber: materialPurchases.referenceNumber,
      description: materialPurchases.description,
      locationId: materialPurchases.locationId,
      locationName: locations.name,
    })
    .from(materialPurchases)
    .leftJoin(locations, eq(materialPurchases.locationId, locations.id))
    .where(eq(materialPurchases.isDeleted, 0))
    .orderBy(desc(materialPurchases.date), desc(materialPurchases.id));

  // 5. Aggregate overall totals
  const totalContributed = round2(
    allTxs
      .filter((t: any) => t.type === 'CONTRIBUTION' || t.type === 'CAPITAL' || t.type === 'INVESTMENT')
      .reduce((acc: number, t: any) => acc + (parseFloat(String(t.amount || 0)) || 0), 0)
  );

  const totalWithdrawn = round2(
    allTxs
      .filter((t: any) => t.type === 'UPAD' || t.type === 'WITHDRAWAL' || t.type === 'PAYMENT')
      .reduce((acc: number, t: any) => acc + (parseFloat(String(t.amount || 0)) || 0), 0)
  );

  const totalAllocated = round2(
    allAllocations.reduce((acc: number, a: any) => acc + (parseFloat(String(a.amount || 0)) || 0), 0)
  );

  const totalPurchases = round2(
    allPurchases.reduce((acc: number, p: any) => acc + (parseFloat(String(p.totalAmount || 0)) || 0), 0)
  );

  const availableAdminCapital = round2(totalContributed - totalWithdrawn - totalAllocated - totalPurchases);

  // 6. Calculate investor-specific metrics
  const investorList = activeInvestors.map((inv: any) => {
    const invTxs = allTxs.filter((t: any) => t.investorId === inv.id);
    const invAllocs = allAllocations.filter((a: any) => a.investorId === inv.id);

    const contributed = round2(
      invTxs
        .filter((t: any) => t.type === 'CONTRIBUTION' || t.type === 'CAPITAL' || t.type === 'INVESTMENT')
        .reduce((acc: number, t: any) => acc + (parseFloat(String(t.amount || 0)) || 0), 0)
    );

    const withdrawn = round2(
      invTxs
        .filter((t: any) => t.type === 'UPAD' || t.type === 'WITHDRAWAL' || t.type === 'PAYMENT')
        .reduce((acc: number, t: any) => acc + (parseFloat(String(t.amount || 0)) || 0), 0)
    );

    const allocated = round2(
      invAllocs.reduce((acc: number, a: any) => acc + (parseFloat(String(a.amount || 0)) || 0), 0)
    );

    const availableCapital = round2(contributed - withdrawn - allocated);

    return {
      id: inv.id,
      name: inv.name,
      mobile: inv.mobile,
      email: inv.email,
      address: inv.address,
      notes: inv.notes,
      totalContributed: contributed,
      totalWithdrawn: withdrawn,
      totalAllocated: allocated,
      availableCapital
    };
  });

  return {
    totalContributed,
    totalWithdrawn,
    totalAllocated,
    totalPurchases,
    availableAdminCapital,
    investors: investorList,
    recentTransfers: allAllocations,
    recentPurchases: allPurchases
  };
}

/**
 * Normalizes all existing material records to UPPERCASE to prevent duplicate stock creation,
 * links any unlinked purchases/supplies to canonical uppercase materials, and reconciles stock.
 */
export async function normalizeMaterialsAndStockDB(): Promise<void> {
  try {
    // 1. Normalize all material names to UPPERCASE in master table
    await db.execute(sql`
      UPDATE materials 
      SET name = UPPER(TRIM(name)) 
      WHERE name IS NOT NULL AND name != UPPER(TRIM(name));
    `);

    // 2. Normalize purchase & supply tables material names
    await db.execute(sql`
      UPDATE material_purchases 
      SET material_name = UPPER(TRIM(material_name)) 
      WHERE material_name IS NOT NULL AND material_name != UPPER(TRIM(material_name));
    `);

    await db.execute(sql`
      UPDATE material_supplies 
      SET material_name = UPPER(TRIM(material_name)) 
      WHERE material_name IS NOT NULL AND material_name != UPPER(TRIM(material_name));
    `);

    await db.execute(sql`
      UPDATE material_labour_supplies 
      SET material_name = UPPER(TRIM(material_name)) 
      WHERE material_name IS NOT NULL AND material_name != UPPER(TRIM(material_name));
    `);

    // 3. Link unlinked purchases to master materials
    const unlinkedPurchases = await db.execute(sql`
      SELECT id, user_id, location_id, material_name, unit, rate, quantity
      FROM material_purchases
      WHERE (material_id IS NULL OR material_id = 0) AND is_deleted = 0 AND material_name IS NOT NULL
    `);

    for (const row of unlinkedPurchases.rows as any[]) {
      const cleanName = String(row.material_name || '').trim().toUpperCase();
      if (!cleanName) continue;

      let mat = await db.select().from(materials).where(
        and(
          eq(materials.locationId, Number(row.location_id)),
          sql`UPPER(TRIM(${materials.name})) = ${cleanName}`,
          eq(materials.isDeleted, 0)
        )
      ).limit(1);

      let matId: number;
      if (mat = mat.length ? mat : []) {
        if (mat.length > 0) {
          matId = mat[0].id;
        } else {
          const created = await db.insert(materials).values({
            userId: Number(row.user_id),
            locationId: Number(row.location_id),
            name: cleanName,
            defaultUnit: row.unit || 'Unit',
            defaultRate: String(row.rate || '0.00'),
            minStock: '0.00',
            isActive: 1,
            isDeleted: 0
          }).returning();
          matId = created[0].id;
        }

        await db.execute(sql`
          UPDATE material_purchases 
          SET material_id = ${matId}, material_name = ${cleanName}
          WHERE id = ${row.id};
        `);

        // Check if stock ledger entry exists
        const stockCheck = await db.select().from(stockLedger).where(
          and(
            eq(stockLedger.referenceId, Number(row.id)),
            eq(stockLedger.referenceType, 'PURCHASE')
          )
        );
        if (stockCheck.length === 0 && parseFloat(String(row.quantity || 0)) > 0) {
          await StockManager.addStockMovement(
            db,
            Number(row.user_id),
            Number(row.location_id),
            matId,
            'IN',
            parseFloat(String(row.quantity)),
            Number(row.id),
            'PURCHASE',
            'Auto reconciled'
          );
        }
      }
    }

    // 4. Link unlinked material supplies
    const unlinkedSupplies = await db.execute(sql`
      SELECT id, user_id, location_id, material_name, unit, rate, quantity
      FROM material_supplies
      WHERE (material_id IS NULL OR material_id = 0) AND is_deleted = 0 AND material_name IS NOT NULL
    `);

    for (const row of unlinkedSupplies.rows as any[]) {
      const cleanName = String(row.material_name || '').trim().toUpperCase();
      if (!cleanName) continue;

      let mat = await db.select().from(materials).where(
        and(
          eq(materials.locationId, Number(row.location_id)),
          sql`UPPER(TRIM(${materials.name})) = ${cleanName}`,
          eq(materials.isDeleted, 0)
        )
      ).limit(1);

      let matId: number;
      if (mat.length > 0) {
        matId = mat[0].id;
      } else {
        const created = await db.insert(materials).values({
          userId: Number(row.user_id),
          locationId: Number(row.location_id),
          name: cleanName,
          defaultUnit: row.unit || 'Unit',
          defaultRate: String(row.rate || '0.00'),
          minStock: '0.00',
          isActive: 1,
          isDeleted: 0
        }).returning();
        matId = created[0].id;
      }

      await db.execute(sql`
        UPDATE material_supplies 
        SET material_id = ${matId}, material_name = ${cleanName}
        WHERE id = ${row.id};
      `);

      const stockCheck = await db.select().from(stockLedger).where(
        and(
          eq(stockLedger.referenceId, Number(row.id)),
          eq(stockLedger.referenceType, 'MATERIAL_SUPPLY')
        )
      );
      if (stockCheck.length === 0 && parseFloat(String(row.quantity || 0)) > 0) {
        await StockManager.addStockMovement(
          db,
          Number(row.user_id),
          Number(row.location_id),
          matId,
          'OUT',
          parseFloat(String(row.quantity)),
          Number(row.id),
          'MATERIAL_SUPPLY',
          'Auto reconciled'
        );
      }
    }

    console.log('[Accounting] Material names normalized to UPPERCASE and stock reconciled.');
  } catch (err) {
    console.error('[Accounting] Normalization error (non-fatal):', err);
  }
}

/**
 * Safely backfills legacy investment data into global investors and location allocations
 */
export async function runDatabaseMigrations(): Promise<void> {
  try {
    // Backfill / migrate data from legacy investment_parties & investment_transactions if any
    try {
      const legacyParties = await db.execute(sql`
        SELECT DISTINCT ip.id, ip.user_id, ip.party_name, ip.location_id
        FROM investment_parties ip
        WHERE ip.is_deleted = 0
      `);

      for (const row of legacyParties.rows as any[]) {
        const cleanName = String(row.party_name || '').trim();
        if (!cleanName) continue;

        // Check if investor already exists in global investors
        let invRes = await db.execute(sql`
          SELECT id FROM investors 
          WHERE user_id = ${row.user_id} AND UPPER(TRIM(name)) = UPPER(TRIM(${cleanName})) AND is_deleted = 0
          LIMIT 1
        `);

        let investorId: number;
        if (invRes.rows.length > 0) {
          investorId = Number((invRes.rows[0] as any).id);
        } else {
          const inserted = await db.execute(sql`
            INSERT INTO investors (user_id, name, created_at, updated_at, is_deleted)
            VALUES (${row.user_id}, ${cleanName}, NOW(), NOW(), 0)
            RETURNING id
          `);
          investorId = Number((inserted.rows[0] as any).id);
        }

        // Migrate legacy transactions for this party
        const legacyTxs = await db.execute(sql`
          SELECT id, user_id, party_id, type, amount, date, description, payment_method, reference_number
          FROM investment_transactions
          WHERE party_id = ${row.id} AND is_deleted = 0
        `);

        for (const tx of legacyTxs.rows as any[]) {
          const txType = String(tx.type || '').toUpperCase();
          const amt = parseFloat(String(tx.amount || 0));
          if (isNaN(amt) || amt <= 0) continue;

          if (txType === 'CONTRIBUTION') {
            // Check if already in investor_transactions
            const existTx = await db.execute(sql`
              SELECT id FROM investor_transactions 
              WHERE investor_id = ${investorId} AND type = 'CONTRIBUTION' AND amount = ${tx.amount} AND date = ${tx.date} AND is_deleted = 0
              LIMIT 1
            `);
            if (existTx.rows.length === 0) {
              await db.execute(sql`
                INSERT INTO investor_transactions (investor_id, user_id, type, amount, date, payment_method, reference_number, description, is_deleted)
                VALUES (${investorId}, ${tx.user_id}, 'CONTRIBUTION', ${tx.amount}, ${tx.date}, ${tx.payment_method}, ${tx.reference_number}, ${tx.description}, 0)
              `);
            }
          } else if (txType === 'INVESTMENT') {
            // Location allocation
            const existAlloc = await db.execute(sql`
              SELECT id FROM investor_location_allocations
              WHERE investor_id = ${investorId} AND location_id = ${row.location_id} AND amount = ${tx.amount} AND date = ${tx.date} AND is_deleted = 0
              LIMIT 1
            `);
            if (existAlloc.rows.length === 0) {
              await db.execute(sql`
                INSERT INTO investor_location_allocations (investor_id, location_id, user_id, amount, date, payment_method, reference_number, notes, is_deleted)
                VALUES (${investorId}, ${row.location_id}, ${tx.user_id}, ${tx.amount}, ${tx.date}, ${tx.payment_method}, ${tx.reference_number}, ${tx.description}, 0)
              `);
            }
          } else if (txType === 'UPAD' || txType === 'PAYMENT') {
            // Investor Upad
            const existUpad = await db.execute(sql`
              SELECT id FROM investor_transactions 
              WHERE investor_id = ${investorId} AND type = 'UPAD' AND amount = ${tx.amount} AND date = ${tx.date} AND is_deleted = 0
              LIMIT 1
            `);
            if (existUpad.rows.length === 0) {
              await db.execute(sql`
                INSERT INTO investor_transactions (investor_id, user_id, type, amount, date, payment_method, reference_number, description, is_deleted)
                VALUES (${investorId}, ${tx.user_id}, 'UPAD', ${tx.amount}, ${tx.date}, ${tx.payment_method}, ${tx.reference_number}, ${tx.description}, 0)
              `);
            }
          }
        }
      }
    } catch (migErr) {
      console.warn('[Accounting] Legacy migration check notice:', migErr);
    }

    console.log('[Accounting] Historical data sync check completed.');
  } catch (err) {
    console.error('[Accounting] Data sync error:', err);
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
