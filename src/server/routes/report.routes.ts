import express, { type Response } from 'express';
import { db } from '../../db/index.ts';
import { 
  locations, records, investmentParties, investmentTransactions,
  materialPurchases, materialSupplies, siteSupplies, siteSupplyItems,
  materials, labourTeams,
  labourSalaries, supervisorCosts,
  investors, investorLocationAllocations,
  contractorCosts
} from '../../db/schema.ts';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { requireAuth, type AuthRequest } from '../middleware/auth.ts';
import { 
  generateExcelBuffer, 
  generateInvestorStatementBuffer, 
  generateVendorPurchasesBuffer, 
  generateCustomerSuppliesBuffer, 
  generateRefundableRecordsBuffer,
  generateSiteSuppliesBuffer,
  generateMaterialAnalyticsBuffer
} from '../lib/excel.ts';
import { calculateCategory2Capital } from '../lib/accounting.ts';
import { assertLocationAccess } from '../lib/locationAuth.ts';

const reportRouter = express.Router();
reportRouter.use(requireAuth);

/**
 * GET /api/reports/location-analytics
 * Location-wise comparative analytics strictly implementing the new workflow:
 * - Location ID & Name
 * - Investor Capital: Capital allocated from Admin to this location minus investments
 * - Investment Capital: Total transferred into project investment
 * - Customer Supply: Total customer material supplies
 * - Site Supply: Total site supplies
 * - Labour Attendance: Net salary of labour attendance
 * - Contractor Cost: Total contractor cost recorded
 * - Contractor Cost Reconciliation:
 *   Expected Cost = Site Supply + Labour Attendance
 *   Recorded Cost = Contractor Cost
 *   Difference = Recorded Cost - Expected Cost
 *   Status = MATCHED | SURPLUS | DEFICIT
 */
reportRouter.get('/location-analytics', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const locationIdParam = req.query.locationId && req.query.locationId !== 'ALL' && req.query.locationId !== '0'
      ? parseInt(req.query.locationId as string, 10)
      : undefined;

    const locCondition = locationIdParam && !isNaN(locationIdParam)
      ? eq(locations.id, locationIdParam)
      : undefined;

    const locRows = await db.select({ id: locations.id, name: locations.name })
      .from(locations)
      .where(and(eq(locations.isDeleted, 0), locCondition))
      .orderBy(locations.name);

    const analyticsList = [];

    for (const loc of locRows) {
      const [invTxs, custSupp, siteSupp, labour, contr] = await Promise.all([
        db.execute(sql`
          SELECT it.type, COALESCE(SUM(CAST(it.amount AS numeric)), 0) as total
          FROM investment_transactions it
          JOIN investment_parties ip ON it.party_id = ip.id
          WHERE ip.location_id = ${loc.id} AND it.is_deleted = 0 AND ip.is_deleted = 0
          GROUP BY it.type
        `),
        db.execute(sql`
          SELECT COALESCE(SUM(CAST(total_amount AS numeric)), 0) as total
          FROM material_supplies
          WHERE location_id = ${loc.id} AND is_deleted = 0
        `),
        db.execute(sql`
          SELECT COALESCE(SUM(CAST(total_amount AS numeric)), 0) as total
          FROM site_supplies
          WHERE location_id = ${loc.id} AND is_deleted = 0
        `),
        db.execute(sql`
          SELECT COALESCE(SUM(CAST(net_salary AS numeric)), 0) as total
          FROM labour_salaries
          WHERE location_id = ${loc.id} AND is_deleted = 0
        `),
        db.execute(sql`
          SELECT COALESCE(SUM(CAST(amount AS numeric)), 0) as total
          FROM supervisor_costs
          WHERE location_id = ${loc.id} AND is_deleted = 0
        `)
      ]);

      let contrib = 0, invest = 0, upad = 0;
      invTxs.rows.forEach((r: any) => {
        if (r.type === 'CONTRIBUTION') contrib += parseFloat(r.total || '0');
        if (r.type === 'INVESTMENT') invest += parseFloat(r.total || '0');
        if (r.type === 'UPAD' || r.type === 'PAYMENT') upad += parseFloat(r.total || '0');
      });

      const investorCapitalAvailable = Math.max(0, Math.round((contrib - invest - upad) * 100) / 100);
      const investmentCapital = Math.round(invest * 100) / 100;
      const customerSupply = Math.round(parseFloat(custSupp.rows[0]?.total as string || '0') * 100) / 100;
      const siteSupply = Math.round(parseFloat(siteSupp.rows[0]?.total as string || '0') * 100) / 100;
      const labourAttendance = Math.round(parseFloat(labour.rows[0]?.total as string || '0') * 100) / 100;
      const contractorCost = Math.round(parseFloat(contr.rows[0]?.total as string || '0') * 100) / 100;

      // 1. Site Expenses vs Investment Capital Matching
      const totalThreeSiteExpenses = Math.round((customerSupply + siteSupply + labourAttendance) * 100) / 100;
      const investmentVariance = Math.round((investmentCapital - totalThreeSiteExpenses) * 100) / 100;
      const investmentStatus = Math.abs(investmentVariance) < 1 ? 'MATCHED' : (investmentVariance > 0 ? 'SURPLUS' : 'DEFICIT');

      // 2. Site Supply + Labour Attendance vs Contractor Cost Matching
      const expectedContractorCost = Math.round((siteSupply + labourAttendance) * 100) / 100;
      const reconciliationDifference = Math.round((contractorCost - expectedContractorCost) * 100) / 100;
      const status = Math.abs(reconciliationDifference) < 1 ? 'MATCHED' : (reconciliationDifference > 0 ? 'SURPLUS' : 'DEFICIT');

      analyticsList.push({
        locationId: loc.id,
        locationName: loc.name,
        investorCapitalTotal: Math.round(contrib * 100) / 100,
        investorCapitalAvailable,
        investmentCapital,
        customerSupply,
        siteSupply,
        labourAttendance,
        totalThreeSiteExpenses,
        investmentVariance,
        investmentStatus,
        contractorCost,
        expectedContractorCost,
        reconciliationDifference,
        status
      });
    }

    // Totals across queried locations
    const totals = {
      investorCapitalTotal: Math.round(analyticsList.reduce((acc, l) => acc + l.investorCapitalTotal, 0) * 100) / 100,
      investorCapitalAvailable: Math.round(analyticsList.reduce((acc, l) => acc + l.investorCapitalAvailable, 0) * 100) / 100,
      investmentCapital: Math.round(analyticsList.reduce((acc, l) => acc + l.investmentCapital, 0) * 100) / 100,
      customerSupply: Math.round(analyticsList.reduce((acc, l) => acc + l.customerSupply, 0) * 100) / 100,
      siteSupply: Math.round(analyticsList.reduce((acc, l) => acc + l.siteSupply, 0) * 100) / 100,
      labourAttendance: Math.round(analyticsList.reduce((acc, l) => acc + l.labourAttendance, 0) * 100) / 100,
      totalThreeSiteExpenses: Math.round(analyticsList.reduce((acc, l) => acc + l.totalThreeSiteExpenses, 0) * 100) / 100,
      investmentVariance: Math.round(analyticsList.reduce((acc, l) => acc + l.investmentVariance, 0) * 100) / 100,
      contractorCost: Math.round(analyticsList.reduce((acc, l) => acc + l.contractorCost, 0) * 100) / 100,
      expectedContractorCost: Math.round(analyticsList.reduce((acc, l) => acc + l.expectedContractorCost, 0) * 100) / 100,
      reconciliationDifference: Math.round(analyticsList.reduce((acc, l) => acc + l.reconciliationDifference, 0) * 100) / 100,
    };

    res.json({
      locations: analyticsList,
      totals,
      count: analyticsList.length
    });
  } catch (error: any) {
    console.error('[Location Analytics GET Error]', error);
    res.status(500).json({ error: 'Failed to calculate location analytics' });
  }
});

reportRouter.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const locationIdParam = req.query.locationId && req.query.locationId !== 'ALL'
      ? parseInt(req.query.locationId as string, 10)
      : undefined;

    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
    }
    
    // Base location condition
    const locCondition = locationIdParam 
      ? sql`${locations.id} = ${locationIdParam}`
      : sql`1=1`;

    const locIds = await db.select({ id: locations.id }).from(locations)
      .where(and(eq(locations.isDeleted, 0), locCondition));
    const validLocIds = locIds.map(l => l.id);
    if (validLocIds.length === 0) {
      return res.json({
        totalIncome: 0, totalBillInvestment: 0, grossExpense: 0, actualExpense: 0, totalRefundable: 0, totalRefunded: 0, pendingRefundable: 0, netIncome: 0,
        totalInvestment: 0, totalInvestmentPayment: 0, totalInvestmentUpad: 0, investmentBalance: 0,
        totalMaterialPurchase: 0, totalMaterialPurchasePaid: 0, totalMaterialPurchaseOutstanding: 0,
        totalMaterialSupply: 0, totalMaterialSupplyPaid: 0, totalMaterialSupplyOutstanding: 0,
        totalMaterialLabourSupply: 0, totalMaterialLabourSupplyPaid: 0, totalMaterialLabourSupplyOutstanding: 0,
        totalSupervisorCost: 0,
        labourMetrics: { totalNetSalary: 0, totalUpad: 0, totalPayment: 0, totalBalance: 0 },
        rawLabourAtt: [],
        investorParties: [],
        category1InvestorSummary: {
          investorTotalCapital: 0,
          investmentKaryaTotal: 0,
          investorUpadTotal: 0,
          availableInvestorsBalance: 0
        },
        category2InvestmentSummary: {
          investmentFromInvestorsCapital: 0,
          billInvestment: 0,
          fullCapital: 0,
          totalDeductions: 0,
          investorUpadReturn: 0,
          remainingCapital: 0
        },
        connectedExpenses: {
          investmentFromInvestorsCapital: 0,
          billInvestment: 0,
          fullCapital: 0,
          totalInvested: 0, totalUpad: 0, netCapitalPool: 0,
          materialPurchaseExpense: 0, siteSupplyExpense: 0, labourSalaryExpense: 0, generalExpense: 0,
          totalExpensesCut: 0, remainingCapital: 0, utilizationRate: 0,
          categoryDetails: {
            cat3MaterialPurchases: 0,
            cat4MaterialSupplies: 0,
            cat5SiteSupplies: 0,
            cat67Labour: 0,
            cat8GeneralOrSupervisor: 0
          }
        },
        stockSummary: { items: [], totalDistinctMaterials: 0, totalStockUnits: 0, totalStockValuation: 0, lowStockCount: 0 },
        supervisorAudit: { totalSupervisorCost: 0, totalSiteSupply: 0, variance: 0, reconciliationStatus: 'MATCHED' }
      });
    }
    
    const idList = validLocIds.join(',');

    // 1. Income & Expenses
    const ieQuery = await db.execute(sql`
      SELECT 
        type, 
        category,
        SUM(amount) as amt, 
        SUM(refundable_amount) as ref_amt, 
        SUM(refunded_amount) as refd_amt
      FROM records
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY type, category
    `);
    
    let totalIncome = 0, grossExpense = 0, totalRefundable = 0, totalRefunded = 0, totalBillInvestment = 0;
    for (const r of ieQuery.rows) {
      const amt = parseFloat(r.amt as string || '0');
      if (r.type === 'INCOME') {
        totalIncome += amt;
        if (r.category === 'BILL_INVESTMENT') {
          totalBillInvestment += amt;
        }
      }
      if (r.type === 'EXPENSE') {
        grossExpense += amt;
        const refAmt = parseFloat(r.ref_amt as string || '0') || ((r.category === 'REFUNDABLE_RECORD' || r.category === 'REFUNDABLE') ? amt : 0);
        totalRefundable += refAmt;
        totalRefunded += parseFloat(r.refd_amt as string || '0');
      }
    }
    // Accounting Rule: Refundable amounts are NOT expenses (assets/receivables until refunded)
    const actualExpense = Math.max(0, Math.round((grossExpense - totalRefundable) * 100) / 100);
    const pendingRefundable = Math.max(0, Math.round((totalRefundable - totalRefunded) * 100) / 100);
    const netIncome = Math.round((totalIncome - actualExpense) * 100) / 100;

    // 2. Investment & Investor Transactions Breakdown
    const invQuery = await db.execute(sql`
      SELECT t.type, SUM(t.amount) as amt
      FROM investment_transactions t
      JOIN investment_parties p ON t.party_id = p.id
      WHERE t.is_deleted = 0 AND p.location_id IN (${sql.raw(idList)})
      GROUP BY t.type
    `);
    
    let totalInvestmentKarya = 0;
    let totalContribution = 0;
    let totalInvestmentPayment = 0;
    let totalInvestmentUpad = 0;

    for (const r of invQuery.rows) {
      const a = parseFloat(r.amt as string || '0');
      if (r.type === 'INVESTMENT') totalInvestmentKarya += a;
      if (r.type === 'CONTRIBUTION') totalContribution += a;
      if (r.type === 'PAYMENT') totalInvestmentPayment += a;
      if (r.type === 'UPAD') totalInvestmentUpad += a;
    }

    // Include global investor pool direct allocations to locations (investor_location_allocations)
    const allocQuery = await db.execute(sql`
      SELECT SUM(amount) as amt
      FROM investor_location_allocations
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
    `);
    const totalAllocations = parseFloat(allocQuery.rows[0]?.amt as string || '0') || 0;
    totalInvestmentKarya += totalAllocations;

    // Category 1: Investor Capital Summary
    // Investor Total Capital = Contributions (or contributions + initial capital)
    const investorTotalCapital = totalContribution > 0 ? totalContribution : totalInvestmentKarya;
    const totalInvestorUpad = totalInvestmentUpad + totalInvestmentPayment;
    const availableInvestorsBalance = Math.max(0, Math.round((investorTotalCapital - totalInvestmentKarya - totalInvestorUpad) * 100) / 100);

    // Category 2: Investment from Investors Capital (Strictly Investment Karya total)
    const investmentFromInvestorsCapital = Math.round(totalInvestmentKarya * 100) / 100;
    const totalProjectCapital = Math.round((investmentFromInvestorsCapital + totalBillInvestment) * 100) / 100;
    const investmentBalance = totalProjectCapital - totalInvestmentPayment;

    // 3. Material Purchase (Category 3)
    const mpQuery = await db.execute(sql`
      SELECT SUM(total_amount) as tot, SUM(paid_amount) as pd, SUM(outstanding_amount) as out
      FROM material_purchases
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
    `);
    const totalMaterialPurchase = parseFloat(mpQuery.rows[0]?.tot as string || '0');
    const totalMaterialPurchasePaid = parseFloat(mpQuery.rows[0]?.pd as string || '0');
    const totalMaterialPurchaseOutstanding = parseFloat(mpQuery.rows[0]?.out as string || '0');

    // 4. Material Supply (Category 4)
    const msQuery = await db.execute(sql`
      SELECT SUM(total_amount) as tot, SUM(paid_amount) as pd, SUM(outstanding_amount) as out
      FROM material_supplies
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
    `);
    const totalMaterialSupply = parseFloat(msQuery.rows[0]?.tot as string || '0');
    const totalMaterialSupplyPaid = parseFloat(msQuery.rows[0]?.pd as string || '0');
    const totalMaterialSupplyOutstanding = parseFloat(msQuery.rows[0]?.out as string || '0');

    // 5. Site Supply (Category 5)
    const mlsQuery = await db.execute(sql`
      SELECT SUM(total_amount) as tot, 0 as pd, 0 as out
      FROM site_supplies
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
    `);
    const totalMaterialLabourSupply = parseFloat(mlsQuery.rows[0]?.tot as string || '0');
    const totalMaterialLabourSupplyPaid = parseFloat(mlsQuery.rows[0]?.pd as string || '0');
    const totalMaterialLabourSupplyOutstanding = parseFloat(mlsQuery.rows[0]?.out as string || '0');

    // 6. Labour Salary (Category 6 & 7)
    const lsQuery = await db.execute(sql`
      SELECT SUM(net_salary) as net, SUM(upad) as upad, SUM(payment_amount) as pd, SUM(balance) as bal
      FROM labour_salaries
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
    `);
    const labourMetrics = {
      totalNetSalary: parseFloat(lsQuery.rows[0]?.net as string || '0'),
      totalUpad: parseFloat(lsQuery.rows[0]?.upad as string || '0'),
      totalPayment: parseFloat(lsQuery.rows[0]?.pd as string || '0'),
      totalBalance: parseFloat(lsQuery.rows[0]?.bal as string || '0')
    };

    const rawLabourAtt = await db.execute(sql`
      SELECT substring(date from 1 for 7) as month, SUM(days) as days, SUM(tc_quantity) as tcs
      FROM labour_salaries
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY month ORDER BY month
    `);

    // 7. Supervisor Costs (Category 8)
    const supQuery = await db.execute(sql`
      SELECT SUM(amount) as tot
      FROM supervisor_costs
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
    `);
    const totalSupervisorCost = parseFloat(supQuery.rows[0]?.tot as string || '0');

    // 8. Investor Parties Breakdown (Category 1 Individual Passbooks)
    const invPartiesQuery = await db.execute(sql`
      SELECT 
        p.id, 
        p.party_name as "partyName",
        COALESCE(SUM(CASE WHEN t.type = 'INVESTMENT' THEN t.amount ELSE 0 END), 0) as "totalInvestmentKarya",
        COALESCE(SUM(CASE WHEN t.type = 'CONTRIBUTION' THEN t.amount ELSE 0 END), 0) as "totalContribution",
        COALESCE(SUM(CASE WHEN t.type = 'UPAD' THEN t.amount ELSE 0 END), 0) as "totalUpad",
        COALESCE(SUM(CASE WHEN t.type = 'PAYMENT' THEN t.amount ELSE 0 END), 0) as "totalPayment"
      FROM investment_parties p
      LEFT JOIN investment_transactions t ON t.party_id = p.id AND t.is_deleted = 0
      WHERE p.is_deleted = 0 AND p.location_id IN (${sql.raw(idList)})
      GROUP BY p.id, p.party_name
      ORDER BY "totalContribution" DESC, p.party_name ASC
    `);

    const investorParties = invPartiesQuery.rows.map((r: any) => {
      const invKarya = parseFloat(r.totalInvestmentKarya || '0');
      const contrib = parseFloat(r.totalContribution || '0');
      const upd = parseFloat(r.totalUpad || '0');
      const pay = parseFloat(r.totalPayment || '0');
      const partyCapital = contrib > 0 ? contrib : invKarya;
      return {
        id: Number(r.id),
        partyName: r.partyName as string,
        totalContribution: contrib,
        totalInvestment: invKarya,
        totalInvestmentKarya: invKarya,
        totalUpad: upd,
        totalPayment: pay,
        balance: Math.round((partyCapital - invKarya - upd - pay) * 100) / 100
      };
    });

    // 9. Category 2 (Project Investment) Deductions & Analytics Calculation via accounting.ts
    const labourPaidOut = Math.round((labourMetrics.totalPayment + labourMetrics.totalUpad) * 100) / 100;

    const cat2Calculation = calculateCategory2Capital({
      investmentFromInvestors: investmentFromInvestorsCapital,
      billInvestment: totalBillInvestment,
      cat3Deduction: 0, // Material Purchases completely removed from Category 2 operational deductions as per user request
      cat4Deduction: 0, // Material Supply is customer sales, not project capital deduction
      cat5Deduction: totalMaterialLabourSupply,
      cat6Deduction: labourPaidOut,
      refundableDeduction: pendingRefundable,
      investorUpadReturn: totalInvestmentPayment
    });

    const utilizationRate = cat2Calculation.fullCapital > 0 
      ? Math.min(100, Math.round((cat2Calculation.totalDeductions / cat2Calculation.fullCapital) * 100)) 
      : (cat2Calculation.totalDeductions > 0 ? 100 : 0);

    const connectedExpenses = {
      investmentFromInvestorsCapital: cat2Calculation.investmentFromInvestors,
      billInvestment: cat2Calculation.billInvestment,
      fullCapital: cat2Calculation.fullCapital,
      totalInvested: cat2Calculation.fullCapital,
      totalUpad: cat2Calculation.investorUpadReturn,
      netCapitalPool: cat2Calculation.fullCapital,
      materialPurchaseExpense: 0,
      siteSupplyExpense: cat2Calculation.cat5Deduction,
      labourSalaryExpense: cat2Calculation.cat6Deduction,
      refundableExpense: cat2Calculation.refundableDeduction,
      generalExpense: 0,
      totalExpensesCut: cat2Calculation.totalDeductions,
      remainingCapital: cat2Calculation.remainingCapital,
      utilizationRate,
      categoryDetails: {
        cat3MaterialPurchases: 0,
        cat4MaterialSupplies: cat2Calculation.cat4Deduction,
        cat5SiteSupplies: cat2Calculation.cat5Deduction,
        cat6Labour: cat2Calculation.cat6Deduction,
        cat67Labour: cat2Calculation.cat6Deduction,
        refundableRecords: cat2Calculation.refundableDeduction,
        cat8GeneralOrSupervisor: 0
      }
    };

    const category1InvestorSummary = {
      investorTotalCapital: Math.round(investorTotalCapital * 100) / 100,
      investmentKaryaTotal: Math.round(totalInvestmentKarya * 100) / 100,
      investorUpadTotal: Math.round(totalInvestorUpad * 100) / 100,
      availableInvestorsBalance
    };

    const category2InvestmentSummary = {
      investmentFromInvestorsCapital: cat2Calculation.investmentFromInvestors,
      billInvestment: cat2Calculation.billInvestment,
      fullCapital: cat2Calculation.fullCapital,
      totalDeductions: cat2Calculation.totalDeductions,
      investorUpadReturn: cat2Calculation.investorUpadReturn,
      remainingCapital: cat2Calculation.remainingCapital
    };

    // 10. Live Stock Inventory Summary (From Canonical Stock Ledger)
    const stockQuery = await db.execute(sql`
      SELECT 
        m.id as "materialId",
        m.name as "materialName", 
        m.default_unit as "unit", 
        SUM(CASE WHEN l.transaction_type = 'IN' THEN CAST(ABS(l.quantity) AS DECIMAL) ELSE 0 END) as "purchasedQty",
        SUM(CASE WHEN l.transaction_type = 'OUT' AND l.reference_type = 'MATERIAL_SUPPLY' THEN CAST(ABS(l.quantity) AS DECIMAL) ELSE 0 END) as "otherSupplyQty",
        SUM(CASE WHEN l.transaction_type = 'OUT' AND l.reference_type = 'SITE_SUPPLY' THEN CAST(ABS(l.quantity) AS DECIMAL) ELSE 0 END) as "siteSupplyQty",
        SUM(CASE WHEN l.transaction_type = 'OUT' AND l.reference_type NOT IN ('MATERIAL_SUPPLY', 'SITE_SUPPLY') THEN CAST(ABS(l.quantity) AS DECIMAL) ELSE 0 END) as "miscOutQty",
        (SELECT SUM(total_amount) FROM material_purchases mp WHERE mp.material_id = m.id AND mp.is_deleted = 0 AND mp.location_id IN (${sql.raw(idList)})) as "totalValue"
      FROM stock_ledger l
      JOIN materials m ON l.material_id = m.id
      WHERE l.location_id IN (${sql.raw(idList)}) AND (l.is_deleted = 0 OR l.is_deleted IS NULL)
      GROUP BY m.id, m.name, m.default_unit
    `);
    
    const stockItems = stockQuery.rows.map((row: any) => {
      const purchasedQty = parseFloat(row.purchasedQty || '0');
      const otherSupplyQty = parseFloat(row.otherSupplyQty || '0');
      const siteSupplyQty = parseFloat(row.siteSupplyQty || '0');
      const miscOutQty = parseFloat(row.miscOutQty || '0');
      const totalSupplied = otherSupplyQty + siteSupplyQty + miscOutQty;
      const currentStock = Math.round((purchasedQty - totalSupplied) * 100) / 100;
      
      const totalValue = parseFloat(row.totalValue || '0');
      const avgRate = purchasedQty > 0 ? (totalValue / purchasedQty) : 0;
      const valuation = Math.max(0, Math.round(currentStock * avgRate * 100) / 100);
      
      let status = 'IN_STOCK';
      if (currentStock <= 0) status = 'OUT_OF_STOCK';
      else if (currentStock <= 15) status = 'LOW_STOCK';
      
      return {
        materialName: row.materialName,
        unit: row.unit || 'Unit',
        purchasedQty,
        otherSupplyQty,
        siteSupplyQty,
        currentStock,
        valuation,
        status
      };
    });

    const totalDistinctMaterials = stockItems.length;
    const totalStockUnits = stockItems.reduce((acc: number, s: any) => acc + (s.currentStock > 0 ? s.currentStock : 0), 0);
    const totalStockValuation = stockItems.reduce((acc: number, s: any) => acc + s.valuation, 0);
    const lowStockCount = stockItems.filter((s: any) => s.status === 'LOW_STOCK' || s.status === 'OUT_OF_STOCK').length;
    const stockSummary = {
      items: stockItems,
      totalDistinctMaterials,
      totalStockUnits,
      totalStockValuation,
      lowStockCount
    };

    const variance = Math.round((totalSupervisorCost - totalMaterialLabourSupply) * 100) / 100;
    const supervisorAudit = {
      totalSupervisorCost,
      totalSiteSupply: totalMaterialLabourSupply,
      variance,
      reconciliationStatus: Math.abs(variance) < 0.01 ? 'MATCHED' : (variance > 0 ? 'SURPLUS' : 'DEFICIT')
    };

    res.json({
      totalIncome, totalBillInvestment, grossExpense, actualExpense, totalRefundable, totalRefunded, pendingRefundable, netIncome,
      totalInvestment: totalProjectCapital,
      totalInvestmentPayment,
      totalInvestmentUpad,
      investmentBalance,
      totalMaterialPurchase, totalMaterialPurchasePaid, totalMaterialPurchaseOutstanding,
      totalMaterialSupply, totalMaterialSupplyPaid, totalMaterialSupplyOutstanding,
      totalMaterialLabourSupply, totalMaterialLabourSupplyPaid, totalMaterialLabourSupplyOutstanding,
      totalSupervisorCost,
      labourMetrics,
      rawLabourAtt: rawLabourAtt.rows,
      investorParties,
      category1InvestorSummary,
      category2InvestmentSummary,
      connectedExpenses,
      stockSummary,
      supervisorAudit
    });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to fetch dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

reportRouter.get('/stock', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const locationId = req.query.locationId ? parseInt(req.query.locationId as string, 10) : undefined;
    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }
    const locCondition = locationId ? sql`s.location_id = ${locationId}` : sql`1=1`;

    const stockEntries = await db.execute(sql`
      SELECT 
        s.id,
        s.location_id as "locationId",
        s.material_id as "materialId",
        COALESCE(m.name, s.notes, 'Material') as "materialName",
        COALESCE(m.default_unit, 'Unit') as "unit",
        s.transaction_type as "transactionType",
        s.quantity,
        s.reference_type as "referenceType",
        s.reference_id as "referenceId",
        s.notes,
        s.created_at as "createdAt"
      FROM stock_ledger s
      LEFT JOIN materials m ON s.material_id = m.id
      WHERE ${locCondition} AND (s.is_deleted = 0 OR s.is_deleted IS NULL)
      ORDER BY s.created_at DESC, s.id DESC
    `);

    res.json(stockEntries.rows);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to fetch stock records:', error);
    res.status(500).json({ error: 'Failed to fetch stock records' });
  }
});

reportRouter.get('/reconciliation', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const siteSupplyQuery = await db.execute(sql`
      SELECT s.location_id as "locationId", l.name as "locationName", s.team_id as "teamId", t.name as "teamName", SUM(s.total_amount) as "totalSiteSupply"
      FROM site_supplies s
      INNER JOIN locations l ON s.location_id = l.id
      LEFT JOIN labour_teams t ON s.team_id = t.id
      WHERE s.is_deleted = 0 AND l.is_deleted = 0
      GROUP BY s.location_id, l.name, s.team_id, t.name
    `);
    
    const supQuery = await db.execute(sql`
      SELECT c.location_id as "locationId", l.name as "locationName", SUM(c.amount) as "totalSupervisorCost"
      FROM supervisor_costs c
      INNER JOIN locations l ON c.location_id = l.id
      WHERE c.is_deleted = 0 AND l.is_deleted = 0
      GROUP BY c.location_id, l.name
    `);
    
    const locationsMap = new Map();
    
    supQuery.rows.forEach((r: any) => {
      const locId = Number(r.locationId);
      if (!locationsMap.has(locId)) {
        locationsMap.set(locId, {
          locationId: locId,
          locationName: r.locationName || 'Unknown Location',
          totalSupervisorCost: 0,
          totalSiteSupply: 0,
          teams: []
        });
      }
      locationsMap.get(locId).totalSupervisorCost += parseFloat(r.totalSupervisorCost as string || '0');
    });
    
    siteSupplyQuery.rows.forEach((r: any) => {
      const locId = Number(r.locationId);
      if (!locationsMap.has(locId)) {
        locationsMap.set(locId, {
          locationId: locId,
          locationName: r.locationName || 'Unknown Location',
          totalSupervisorCost: 0,
          totalSiteSupply: 0,
          teams: []
        });
      }
      const loc = locationsMap.get(locId);
      const supplyAmt = parseFloat(r.totalSiteSupply as string || '0');
      loc.totalSiteSupply += supplyAmt;
      
      loc.teams.push({
        teamId: Number(r.teamId),
        teamName: r.teamName || 'Unassigned / Independent',
        siteSupplyValue: supplyAmt
      });
    });
    
    const results = Array.from(locationsMap.values()).map(loc => {
      const variance = loc.totalSupervisorCost - loc.totalSiteSupply;
      let status = 'MATCHED';
      if (Math.abs(variance) > 1) {
        status = variance > 0 ? 'SUPERVISOR_SURPLUS' : 'SITE_EXCESS';
      }
      return {
        ...loc,
        variance,
        reconciliationStatus: status
      };
    });
    
    res.json(results);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Reconciliation report error:', error);
    res.status(500).json({ error: 'Failed to generate reconciliation report' });
  }
});

reportRouter.get('/locations-breakdown', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    // Fetch all active, undeleted locations
    const activeLocations = await db.select({
      id: locations.id,
      name: locations.name,
      address: locations.address,
      createdAt: locations.createdAt,
    }).from(locations)
      .where(eq(locations.isDeleted, 0))
      .orderBy(locations.name);

    if (activeLocations.length === 0) {
      return res.json([]);
    }

    const locBreakdown = await Promise.all(
      activeLocations.map(async (loc) => {
        const locId = loc.id;

        // 1. Records count & Income/Bill Investment & Master Data counts
        const [recCountRes, ieRes, matCountRes, partyCountRes, teamCountRes] = await Promise.all([
          db.execute(sql`SELECT COUNT(id) as count FROM records WHERE location_id = ${locId} AND is_deleted = 0`),
          db.execute(sql`
            SELECT 
              SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) as income,
              SUM(CASE WHEN type = 'INCOME' AND category = 'BILL_INVESTMENT' THEN amount ELSE 0 END) as bill_investment,
              SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) as expense,
              SUM(CASE WHEN type = 'EXPENSE' AND (category = 'REFUNDABLE_RECORD' OR category = 'REFUNDABLE') THEN amount ELSE 0 END) as refundable,
              SUM(CASE WHEN refunded_amount > 0 THEN refunded_amount ELSE 0 END) as refunded
            FROM records 
            WHERE location_id = ${locId} AND is_deleted = 0
          `),
          db.execute(sql`SELECT COUNT(id) as count FROM materials WHERE location_id = ${locId} AND is_deleted = 0`),
          db.execute(sql`SELECT COUNT(id) as count FROM investment_parties WHERE location_id = ${locId} AND is_deleted = 0`),
          db.execute(sql`SELECT COUNT(id) as count FROM labour_teams WHERE location_id = ${locId} AND is_deleted = 0`)
        ]);

        const recordCount = parseInt(recCountRes.rows[0]?.count as string || '0', 10);
        const billInvestment = parseFloat(ieRes.rows[0]?.bill_investment as string || '0');
        const totalIncome = parseFloat(ieRes.rows[0]?.income as string || '0');
        const totalRefundable = parseFloat(ieRes.rows[0]?.refundable as string || '0');
        const totalRefunded = parseFloat(ieRes.rows[0]?.refunded as string || '0');
        const pendingRefundable = Math.max(0, totalRefundable - totalRefunded);

        const materialCount = parseInt(matCountRes.rows[0]?.count as string || '0', 10);
        const partyCount = parseInt(partyCountRes.rows[0]?.count as string || '0', 10);
        const teamCount = parseInt(teamCountRes.rows[0]?.count as string || '0', 10);

        // 2. Investor Capital allocated to this location
        const [allocRes, invPartyRes] = await Promise.all([
          db.execute(sql`
            SELECT SUM(amount) as total 
            FROM investor_location_allocations 
            WHERE location_id = ${locId} AND is_deleted = 0
          `),
          db.execute(sql`
            SELECT 
              SUM(CASE WHEN t.type = 'INVESTMENT' THEN t.amount ELSE 0 END) as total_invested,
              SUM(CASE WHEN t.type = 'CONTRIBUTION' THEN t.amount ELSE 0 END) as total_contribution,
              SUM(CASE WHEN t.type = 'UPAD' THEN t.amount ELSE 0 END) as total_upad,
              SUM(CASE WHEN t.type = 'PAYMENT' THEN t.amount ELSE 0 END) as total_payment
            FROM investment_parties p
            LEFT JOIN investment_transactions t ON t.party_id = p.id AND t.is_deleted = 0
            WHERE p.location_id = ${locId} AND p.is_deleted = 0
          `)
        ]);

        const allocatedCapital = parseFloat(allocRes.rows[0]?.total as string || '0');
        const investorKarya = parseFloat(invPartyRes.rows[0]?.total_invested as string || '0');
        const investorContribution = parseFloat(invPartyRes.rows[0]?.total_contribution as string || '0');
        const investorUpad = parseFloat(invPartyRes.rows[0]?.total_upad as string || '0');
        const investorPayment = parseFloat(invPartyRes.rows[0]?.total_payment as string || '0');

        const totalInvestorCapital = allocatedCapital + investorKarya;
        const investorTotalContribution = investorContribution > 0 ? investorContribution : totalInvestorCapital;
        const investorAvailableBalance = Math.max(0, Math.round((investorTotalContribution - totalInvestorCapital - (investorUpad + investorPayment)) * 100) / 100);

        // 3. Material Purchases (Cat 3)
        const mpRes = await db.execute(sql`
          SELECT 
            COALESCE(SUM(total_amount), 0) as total,
            COALESCE(SUM(paid_amount), 0) as paid
          FROM material_purchases
          WHERE location_id = ${locId} AND is_deleted = 0
        `);
        const materialPurchases = parseFloat(mpRes.rows[0]?.total as string || '0');
        const materialPurchasesPaid = parseFloat(mpRes.rows[0]?.paid as string || '0');

        // 4. Material Supplies (Cat 2 in location - Customer Sales)
        const msRes = await db.execute(sql`
          SELECT 
            COALESCE(SUM(total_amount), 0) as total,
            COALESCE(SUM(paid_amount), 0) as paid
          FROM material_supplies
          WHERE location_id = ${locId} AND is_deleted = 0
        `);
        const materialSupplies = parseFloat(msRes.rows[0]?.total as string || '0');
        const materialSuppliesPaid = parseFloat(msRes.rows[0]?.paid as string || '0');
        const materialSuppliesPending = Math.max(0, Math.round((materialSupplies - materialSuppliesPaid) * 100) / 100);

        // 5. Site Supplies (Cat 3 in location - Site Materials Dispatched)
        const ssRes = await db.execute(sql`
          SELECT COALESCE(SUM(total_amount), 0) as total
          FROM site_supplies
          WHERE location_id = ${locId} AND is_deleted = 0
        `);
        const siteSupplies = parseFloat(ssRes.rows[0]?.total as string || '0');

        // 6. Labour Attendance (Cat 5: Attendance & Team Upad; Cat 6: Other Kharch)
        const lsRes = await db.execute(sql`
          SELECT 
            COALESCE(SUM(CASE WHEN attendance_type IN ('DAY', 'TC') OR (attendance_type != 'OTHER_KHARCH' AND attendance_type != 'UPAD' AND (days > 0 OR tc_quantity > 0 OR gross_salary > 0)) THEN gross_salary ELSE 0 END), 0) as attendance_wages,
            COALESCE(SUM(CASE WHEN attendance_type = 'UPAD' OR upad > 0 THEN upad ELSE 0 END), 0) as total_upad,
            COALESCE(SUM(CASE WHEN attendance_type = 'OTHER_KHARCH' THEN payment_amount ELSE 0 END), 0) as total_other_kharch,
            COALESCE(SUM(CASE WHEN attendance_type = 'DAY' THEN days ELSE 0 END), 0) as days,
            COALESCE(SUM(tc_quantity), 0) as work_qty,
            COUNT(id) as record_count
          FROM labour_salaries
          WHERE location_id = ${locId} AND is_deleted = 0
        `);
        const attendanceWages = parseFloat(lsRes.rows[0]?.attendance_wages as string || '0');
        const labourUpad = parseFloat(lsRes.rows[0]?.total_upad as string || '0');
        const totalOtherKharch = parseFloat(lsRes.rows[0]?.total_other_kharch as string || '0');
        const labourNetSalary = Math.round((attendanceWages - labourUpad) * 100) / 100;
        const labourDays = parseFloat(lsRes.rows[0]?.days as string || '0');
        const labourWorkQty = parseFloat(lsRes.rows[0]?.work_qty as string || '0');
        const labourRecordCount = parseInt(lsRes.rows[0]?.record_count as string || '0', 10);

        // 7. Contractor Costs (Cat 7 in location - Reconciliation)
        const ccRes = await db.execute(sql`
          SELECT 
            COALESCE(SUM(amount), 0) as recorded_total,
            COALESCE(SUM(deduction_amount), 0) as deduction_total,
            COALESCE(SUM(net_amount), 0) as net_total,
            COUNT(id) as cost_count
          FROM contractor_costs
          WHERE location_id = ${locId} AND is_deleted = 0
        `);
        const recordedContractorCost = parseFloat(ccRes.rows[0]?.recorded_total as string || '0');
        const expectedContractorCost = Math.round((siteSupplies + attendanceWages) * 100) / 100;
        const contractorVariance = Math.round((recordedContractorCost - expectedContractorCost) * 100) / 100;

        // Location 7 Categories Calculations:
        // Cat 2: Investment Capital (પ્રોજેક્ટ મૂડી & કપાત - Net Project Capital)
        const fullProjectCapital = Math.round((totalInvestorCapital + billInvestment) * 100) / 100;
        const projectOperationalDeductions = Math.round((siteSupplies + labourUpad + totalOtherKharch + pendingRefundable) * 100) / 100;
        const remainingProjectCapital = Math.round((fullProjectCapital - projectOperationalDeductions - investorPayment) * 100) / 100;

        return {
          id: loc.id,
          name: loc.name,
          address: loc.address,
          createdAt: loc.createdAt,
          recordCount,

          // Full 7 Categories Analytics Per Location (Sequence 1 to 7):
          // 1. Investor Capital (Investor Pool)
          cat1InvestorCapital: {
            totalContribution: investorTotalContribution,
            allocatedCapital: totalInvestorCapital,
            investorUpad: investorUpad + investorPayment,
            availableBalance: investorAvailableBalance
          },

          // 2. Investment Capital
          cat2InvestmentCapital: {
            fullCapital: fullProjectCapital,
            investorCapital: totalInvestorCapital,
            billInvestment,
            operationalDeductions: projectOperationalDeductions,
            investorUpadReturn: investorPayment,
            remainingCapital: remainingProjectCapital
          },

          // 3. Customer Supply (Customer Sales Billed)
          cat3CustomerSupply: {
            totalSupply: materialSupplies,
            received: materialSuppliesPaid,
            pending: materialSuppliesPending
          },

          // 4. Site Supply to Labour Team
          cat4SiteSupply: {
            totalSiteSupply: siteSupplies
          },

          // 5. Labour Attendance (Attendance total - Upad)
          cat5LabourAttendance: {
            attendanceWages,
            upad: labourUpad,
            netBalance: labourNetSalary,
            days: labourDays,
            workQty: labourWorkQty,
            recordCount: labourRecordCount
          },

          // 6. Other Kharch (Site Sundry / Tea / Fuel Expenses)
          cat6OtherKharch: {
            totalOtherKharch
          },

          // 7. Contractor Cost
          cat7ContractorCost: {
            recorded: recordedContractorCost,
            expected: expectedContractorCost,
            variance: contractorVariance,
            status: Math.abs(contractorVariance) <= 0.01 ? 'MATCHED' : (contractorVariance > 0 ? 'SURPLUS' : 'DEFICIT')
          },

          // Master Registry Data
          masterData: {
            materialsCount: materialCount,
            partiesCount: partyCount,
            teamsCount: teamCount
          },

          // Backwards compatibility properties
          cat1InvestmentCapital: {
            fullCapital: fullProjectCapital,
            investorCapital: totalInvestorCapital,
            billInvestment,
            operationalDeductions: projectOperationalDeductions,
            investorUpadReturn: investorPayment,
            remainingCapital: remainingProjectCapital
          },
          cat2MaterialSupply: {
            totalSupply: materialSupplies,
            received: materialSuppliesPaid,
            pending: materialSuppliesPending
          },
          cat3SiteSupply: {
            totalSiteSupply: siteSupplies
          },
          cat4LabourAttendance: {
            attendanceWages,
            netSalary: labourNetSalary,
            grossSalary: attendanceWages,
            upad: labourUpad,
            payment: labourUpad,
            balance: labourNetSalary,
            days: labourDays,
            workQty: labourWorkQty,
            recordCount: labourRecordCount
          },
          cat5ContractorCost: {
            recorded: recordedContractorCost,
            expected: expectedContractorCost,
            variance: contractorVariance,
            status: Math.abs(contractorVariance) <= 0.01 ? 'MATCHED' : (contractorVariance > 0 ? 'SURPLUS' : 'DEFICIT')
          },
          cat6MasterData: {
            materialsCount: materialCount,
            partiesCount: partyCount,
            teamsCount: teamCount
          },
          cat7InvestorCapital: {
            totalContribution: investorTotalContribution,
            allocatedCapital: totalInvestorCapital,
            investorUpad: investorUpad + investorPayment,
            availableBalance: investorAvailableBalance
          },
          investorCapital: totalInvestorCapital,
          investorUpad,
          investorPayment,
          billInvestment,
          totalIncome,
          materialPurchases,
          materialPurchasesPaid,
          materialSupplies,
          materialSuppliesPaid,
          siteSupplies,
          otherKharchTotal: totalOtherKharch,
          labourMetrics: {
            attendanceWages,
            netSalary: labourNetSalary,
            grossSalary: attendanceWages,
            upad: labourUpad,
            payment: labourUpad,
            balance: labourNetSalary,
            days: labourDays,
            workQty: labourWorkQty,
            recordCount: labourRecordCount
          },
          contractorCosts: {
            recorded: recordedContractorCost,
            expected: expectedContractorCost,
            variance: contractorVariance,
            status: Math.abs(contractorVariance) <= 0.01 ? 'MATCHED' : (contractorVariance > 0 ? 'SURPLUS' : 'DEFICIT')
          }
        };
      })
    );

    res.json(locBreakdown);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Locations breakdown error:', error);
    res.status(500).json({ error: 'Failed to generate locations breakdown' });
  }
});

reportRouter.get('/analytics', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const locationIdParam = req.query.locationId && req.query.locationId !== 'ALL'
      ? parseInt(req.query.locationId as string, 10)
      : undefined;

    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
    }

    const locCondition = locationIdParam 
      ? sql`${locations.id} = ${locationIdParam}`
      : sql`1=1`;

    const locIds = await db.select({ id: locations.id }).from(locations)
      .where(and(eq(locations.isDeleted, 0), locCondition));
    const validLocIds = locIds.map(l => l.id);
    if (validLocIds.length === 0) {
      return res.json({ monthly: [], categories: [] });
    }
    const idList = validLocIds.join(',');

    const monthlyMap: Record<string, { month: string; Income: number; Expense: number }> = {};
    const getOrInitMonth = (m: string) => {
      if (!monthlyMap[m]) {
        monthlyMap[m] = { month: m, Income: 0, Expense: 0 };
      }
      return monthlyMap[m];
    };

    // Records (Income & Expenses, with refundable amounts excluded from expense)
    const recordsRows = await db.execute(sql`
      SELECT substring(date from 1 for 7) as m, type, SUM(amount) as amt, SUM(refundable_amount) as ref_amt
      FROM records
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY m, type
    `);
    for (const r of recordsRows.rows) {
      if (!r.m) continue;
      const entry = getOrInitMonth(r.m as string);
      const amt = parseFloat(r.amt as string || '0');
      const refAmt = parseFloat(r.ref_amt as string || '0');
      if (r.type === 'INCOME') entry.Income += amt;
      else if (r.type === 'EXPENSE') entry.Expense += Math.max(0, amt - refAmt);
    }

    // Material Supplies (Income)
    const msRows = await db.execute(sql`
      SELECT substring(date from 1 for 7) as m, SUM(total_amount) as amt
      FROM material_supplies
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY m
    `);
    for (const r of msRows.rows) {
      if (!r.m) continue;
      const entry = getOrInitMonth(r.m as string);
      entry.Income += parseFloat(r.amt as string || '0');
    }

    // Material Purchases (Expense)
    const mpRows = await db.execute(sql`
      SELECT substring(date from 1 for 7) as m, SUM(total_amount) as amt
      FROM material_purchases
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY m
    `);
    for (const r of mpRows.rows) {
      if (!r.m) continue;
      const entry = getOrInitMonth(r.m as string);
      entry.Expense += parseFloat(r.amt as string || '0');
    }

    // Site Supplies (Expense)
    const mlsRows = await db.execute(sql`
      SELECT substring(date from 1 for 7) as m, SUM(total_amount) as amt
      FROM site_supplies
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY m
    `);
    for (const r of mlsRows.rows) {
      if (!r.m) continue;
      const entry = getOrInitMonth(r.m as string);
      entry.Expense += parseFloat(r.amt as string || '0');
    }

    // Labour Salaries (Expense)
    const lsRows = await db.execute(sql`
      SELECT substring(date from 1 for 7) as m, SUM(net_salary) as amt
      FROM labour_salaries
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY m
    `);
    for (const r of lsRows.rows) {
      if (!r.m) continue;
      const entry = getOrInitMonth(r.m as string);
      entry.Expense += parseFloat(r.amt as string || '0');
    }

    // Supervisor Costs (Expense)
    const scRows = await db.execute(sql`
      SELECT substring(date from 1 for 7) as m, SUM(amount) as amt
      FROM supervisor_costs
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY m
    `);
    for (const r of scRows.rows) {
      if (!r.m) continue;
      const entry = getOrInitMonth(r.m as string);
      entry.Expense += parseFloat(r.amt as string || '0');
    }

    const monthly = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));

    // Categories Breakdown
    const catMap: Record<string, number> = {};
    const addCat = (name: string, amt: number) => {
      if (amt > 0) catMap[name] = (catMap[name] || 0) + amt;
    };

    const catRecords = await db.execute(sql`
      SELECT category, SUM(amount) as amt
      FROM records
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      GROUP BY category
    `);
    for (const r of catRecords.rows) {
      const name = (r.category as string) || 'General';
      addCat(name, parseFloat(r.amt as string || '0'));
    }

    const sumQuery = async (query: any) => {
      const res = await db.execute(query);
      return parseFloat(res.rows[0]?.tot as string || '0');
    };

    const mpTot = await sumQuery(sql`SELECT SUM(total_amount) as tot FROM material_purchases WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})`);
    addCat('Material Purchase', mpTot);

    const msTot = await sumQuery(sql`SELECT SUM(total_amount) as tot FROM material_supplies WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})`);
    addCat('Material Supply', msTot);

    const mlsTot = await sumQuery(sql`SELECT SUM(total_amount) as tot FROM site_supplies WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})`);
    addCat('Site Supply', mlsTot);

    const lsTot = await sumQuery(sql`SELECT SUM(net_salary) as tot FROM labour_salaries WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})`);
    addCat('Labour Salary', lsTot);

    const scTot = await sumQuery(sql`SELECT SUM(amount) as tot FROM supervisor_costs WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})`);
    addCat('Supervisor Cost', scTot);

    const categories = Object.entries(catMap).map(([name, value]) => ({ name, value: Math.round(value) }));

    res.json({ monthly, categories });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to fetch analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

reportRouter.get('/export-location/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const locationId = parseInt(req.params.id as string, 10);
    if (isNaN(locationId)) return res.status(400).json({ error: "Valid location ID required" });
    await assertLocationAccess(userId, locationId);

    const tab = req.query.tab as string || 'all';

    const locResult = await db.select().from(locations).where(and(eq(locations.id, locationId), eq(locations.isDeleted, 0)));
    if (!locResult.length) return res.status(404).json({ error: 'Location not found' });
    const locationName = locResult[0].name;

    const exportData: any = {};
    if (tab === 'all' || tab === 'expense' || tab === 'income-expense') {
      exportData.incomeExpense = await db.select().from(records).where(and(eq(records.locationId, locationId), eq(records.isDeleted, 0)));
    }
    if (tab === 'all' || tab === 'investment' || tab === 'investor' || tab === 'investors' || tab === 'investor_capital' || tab === 'investor-capital') {
      exportData.investments = await db.select({
        date: investmentTransactions.date, type: investmentTransactions.type, amount: investmentTransactions.amount,
        description: investmentTransactions.description, paymentMethod: investmentTransactions.paymentMethod,
        referenceNumber: investmentTransactions.referenceNumber, partyName: investmentParties.partyName
      }).from(investmentTransactions).innerJoin(investmentParties, eq(investmentTransactions.partyId, investmentParties.id))
      .where(and(eq(investmentParties.locationId, locationId), eq(investmentTransactions.isDeleted, 0)));

      exportData.investorAllocations = await db.select({
        date: investorLocationAllocations.date,
        investorName: investors.name,
        amount: investorLocationAllocations.amount,
        paymentMethod: investorLocationAllocations.paymentMethod,
        referenceNumber: investorLocationAllocations.referenceNumber,
        notes: investorLocationAllocations.notes,
      })
      .from(investorLocationAllocations)
      .innerJoin(investors, eq(investorLocationAllocations.investorId, investors.id))
      .where(and(eq(investorLocationAllocations.locationId, locationId), eq(investorLocationAllocations.isDeleted, 0)));
    }
    if (tab === 'all' || tab === 'material-purchase' || tab === 'materials' || tab === 'stock') {
      exportData.purchases = await db.select().from(materialPurchases).where(and(eq(materialPurchases.locationId, locationId), eq(materialPurchases.isDeleted, 0)));
    }
    if (tab === 'all' || tab === 'material-supply' || tab === 'materials' || tab === 'stock') {
      exportData.supplies = await db.select().from(materialSupplies).where(and(eq(materialSupplies.locationId, locationId), eq(materialSupplies.isDeleted, 0)));
    }
    if (tab === 'all' || tab === 'material-labour-supply' || tab === 'site-supply' || tab === 'materials' || tab === 'stock') {
      exportData.siteSupplies = await db.execute(sql`SELECT s.*, i.material_id, i.quantity, i.rate, i.amount as item_amount FROM site_supplies s LEFT JOIN site_supply_items i ON s.id = i.site_supply_id WHERE s.location_id = ${locationId} AND s.is_deleted = 0`).then(res => res.rows);
    }
    if (tab === 'all' || tab === 'labour-salary' || tab === 'labour') {
      exportData.salaries = await db.select().from(labourSalaries).where(and(eq(labourSalaries.locationId, locationId), eq(labourSalaries.isDeleted, 0)));
    }
    if (tab === 'all' || tab === 'supervisor-cost' || tab === 'supervisor') {
      exportData.supervisorCosts = await db.select().from(supervisorCosts).where(and(eq(supervisorCosts.locationId, locationId), eq(supervisorCosts.isDeleted, 0)));
    }
    if (tab === 'all' || tab === 'contractor-cost' || tab === 'contractor-costs' || tab === 'contractor' || tab === 'contractors') {
      exportData.contractorCosts = await db.select().from(contractorCosts).where(and(eq(contractorCosts.locationId, locationId), eq(contractorCosts.isDeleted, 0)));
    }

    const buffer = generateExcelBuffer(locationName, exportData, tab);
    res.setHeader('Content-Disposition', `attachment; filename="Export_${locationName.replace(/\s+/g, '_')}_${tab}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to export location:', error);
    res.status(500).json({ error: 'Failed to export location' });
  }
});

reportRouter.get('/export-all', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const exportData: any = {};
    
    exportData.incomeExpense = await db.select().from(records).where(eq(records.isDeleted, 0));
    exportData.investments = await db.select({
      date: investmentTransactions.date, type: investmentTransactions.type, amount: investmentTransactions.amount,
      description: investmentTransactions.description, paymentMethod: investmentTransactions.paymentMethod,
      referenceNumber: investmentTransactions.referenceNumber, partyName: investmentParties.partyName
    }).from(investmentTransactions).innerJoin(investmentParties, eq(investmentTransactions.partyId, investmentParties.id))
    .where(eq(investmentTransactions.isDeleted, 0));
    
    exportData.purchases = await db.select().from(materialPurchases).where(eq(materialPurchases.isDeleted, 0));
    exportData.supplies = await db.select().from(materialSupplies).where(eq(materialSupplies.isDeleted, 0));
    exportData.siteSupplies = await db.execute(sql`SELECT s.*, i.material_id, i.quantity, i.rate, i.amount as item_amount FROM site_supplies s LEFT JOIN site_supply_items i ON s.id = i.site_supply_id WHERE s.is_deleted = 0`).then(res => res.rows);
    exportData.salaries = await db.select().from(labourSalaries).where(eq(labourSalaries.isDeleted, 0));
    exportData.supervisorCosts = await db.select().from(supervisorCosts).where(eq(supervisorCosts.isDeleted, 0));
    exportData.contractorCosts = await db.select().from(contractorCosts).where(eq(contractorCosts.isDeleted, 0));

    const buffer = generateExcelBuffer('All_Locations', exportData, 'all');
    res.setHeader('Content-Disposition', `attachment; filename="Export_All_Locations.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to export all:', error);
    res.status(500).json({ error: 'Failed to export all' });
  }
});

// -------------------------------------------------------------
// GET /api/reports/all-refundable-records (for detailed modal on dashboard)
// -------------------------------------------------------------
reportRouter.get('/all-refundable-records', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const locationIdParam = req.query.locationId && req.query.locationId !== 'ALL'
      ? parseInt(req.query.locationId as string, 10)
      : undefined;

    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
    }

    const locCondition = locationIdParam
      ? sql`${records.locationId} = ${locationIdParam}`
      : sql`1=1`;

    const allRecords = await db.select({
      id: records.id,
      date: records.date,
      locationId: records.locationId,
      locationName: locations.name,
      partyName: records.partyName,
      amount: records.amount,
      refundableAmount: sql<string>`case when coalesce(${records.refundableAmount}, 0) > 0 then ${records.refundableAmount} else ${records.amount} end`,
      refundedAmount: sql<string>`coalesce(${records.refundedAmount}, '0.00')`,
      refundStatus: sql<string>`coalesce(${records.refundStatus}, 'PENDING')`,
      paymentMethod: records.paymentMethod,
      referenceNumber: records.referenceNumber,
      description: records.description,
      notes: records.notes
    })
    .from(records)
    .innerJoin(locations, eq(records.locationId, locations.id))
    .where(and(
      eq(records.isDeleted, 0),
      eq(locations.isDeleted, 0),
      locCondition,
      sql`(${records.refundableAmount} > 0 OR ${records.category} = 'REFUNDABLE_RECORD' OR ${records.category} = 'REFUNDABLE')`
    ))
    .orderBy(sql`${records.date} DESC`, sql`${records.id} DESC`);

    res.json(allRecords);
  } catch (error: any) {
    console.error('Failed to fetch all refundable records:', error);
    res.status(500).json({ error: 'Failed to fetch refundable records' });
  }
});

// -------------------------------------------------------------
// GET /api/reports/export-investor/:partyId (Individual Investor Passbook)
// -------------------------------------------------------------
reportRouter.get('/export-investor/:partyId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const partyId = parseInt(req.params.partyId as string, 10);
    if (isNaN(partyId)) return res.status(400).json({ error: "Invalid investor ID" });

    const [party] = await db.select().from(investmentParties).where(and(
      eq(investmentParties.id, partyId),
      eq(investmentParties.isDeleted, 0)
    ));
    if (!party) return res.status(404).json({ error: "Investor account not found" });

    await assertLocationAccess(userId, party.locationId);

    const [loc] = await db.select({ name: locations.name }).from(locations).where(eq(locations.id, party.locationId));
    const locationName = loc ? loc.name : 'Project Location';

    const transactions = await db.select().from(investmentTransactions).where(and(
      eq(investmentTransactions.partyId, partyId),
      eq(investmentTransactions.isDeleted, 0)
    )).orderBy(sql`${investmentTransactions.date} ASC`, sql`${investmentTransactions.id} ASC`);

    const buffer = generateInvestorStatementBuffer(party, transactions, locationName);
    const sanitized = party.partyName.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="Investor_${sanitized}_Passbook.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error: any) {
    console.error('Failed to export investor statement:', error);
    res.status(500).json({ error: 'Failed to export investor passbook' });
  }
});

// -------------------------------------------------------------
// GET /api/reports/export-vendor-purchases (Material Purchases / Vendor Bill)
// -------------------------------------------------------------
reportRouter.get('/export-vendor-purchases', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const partyName = req.query.partyName ? String(req.query.partyName).trim() : '';
    const locationIdParam = req.query.locationId && req.query.locationId !== 'ALL' ? parseInt(req.query.locationId as string, 10) : undefined;

    let locCondition = sql`1=1`;
    let locName = 'All Locations';
    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
      locCondition = sql`${materialPurchases.locationId} = ${locationIdParam}`;
      const [l] = await db.select({ name: locations.name }).from(locations).where(eq(locations.id, locationIdParam));
      if (l) locName = l.name;
    }

    const partyCondition = partyName ? sql`${materialPurchases.partyName} = ${partyName}` : sql`1=1`;

    const purchases = await db.select().from(materialPurchases).where(and(
      eq(materialPurchases.isDeleted, 0),
      locCondition,
      partyCondition
    )).orderBy(sql`${materialPurchases.date} DESC`, sql`${materialPurchases.id} DESC`);

    const vendorLabel = partyName || 'All_Vendors';
    const buffer = generateVendorPurchasesBuffer(vendorLabel, purchases, locName);
    const safeVendor = vendorLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="Vendor_Purchases_${safeVendor}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error: any) {
    console.error('Failed to export vendor purchases:', error);
    res.status(500).json({ error: 'Failed to export vendor purchases' });
  }
});

// -------------------------------------------------------------
// GET /api/reports/export-customer-supplies (Material Supply / Customer Bill)
// -------------------------------------------------------------
reportRouter.get('/export-customer-supplies', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const partyName = req.query.partyName ? String(req.query.partyName).trim() : '';
    const locationIdParam = req.query.locationId && req.query.locationId !== 'ALL' ? parseInt(req.query.locationId as string, 10) : undefined;

    let locCondition = sql`1=1`;
    let locName = 'All Locations';
    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
      locCondition = sql`${materialSupplies.locationId} = ${locationIdParam}`;
      const [l] = await db.select({ name: locations.name }).from(locations).where(eq(locations.id, locationIdParam));
      if (l) locName = l.name;
    }

    const partyCondition = partyName ? sql`${materialSupplies.partyName} = ${partyName}` : sql`1=1`;

    const supplies = await db.select().from(materialSupplies).where(and(
      eq(materialSupplies.isDeleted, 0),
      locCondition,
      partyCondition
    )).orderBy(sql`${materialSupplies.date} DESC`, sql`${materialSupplies.id} DESC`);

    const customerLabel = partyName || 'All_Customers';
    const buffer = generateCustomerSuppliesBuffer(customerLabel, supplies, locName);
    const safeCust = customerLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="Customer_Bill_${safeCust}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error: any) {
    console.error('Failed to export customer supplies:', error);
    res.status(500).json({ error: 'Failed to export customer supplies' });
  }
});

// -------------------------------------------------------------
// GET /api/reports/export-site-supplies (Category 5 Site Material Supply / Internal Dispatch)
// -------------------------------------------------------------
reportRouter.get('/export-site-supplies', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const locationIdParam = req.query.locationId && req.query.locationId !== 'ALL' ? parseInt(req.query.locationId as string, 10) : undefined;

    let locCondition = sql`1=1`;
    let locName = 'All Locations';
    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
      locCondition = sql`${siteSupplies.locationId} = ${locationIdParam}`;
      const [l] = await db.select({ name: locations.name }).from(locations).where(eq(locations.id, locationIdParam));
      if (l) locName = l.name;
    }

    const supplies = await db.select({
      id: siteSupplies.id,
      locationId: siteSupplies.locationId,
      date: siteSupplies.date,
      teamId: siteSupplies.teamId,
      responsiblePerson: siteSupplies.responsiblePerson,
      workDescription: siteSupplies.workDescription,
      referenceNumber: siteSupplies.referenceNumber,
      notes: siteSupplies.notes,
      totalAmount: siteSupplies.totalAmount,
      teamName: labourTeams.name,
      locationName: locations.name,
    })
    .from(siteSupplies)
    .leftJoin(labourTeams, eq(siteSupplies.teamId, labourTeams.id))
    .leftJoin(locations, eq(siteSupplies.locationId, locations.id))
    .where(and(
      eq(siteSupplies.isDeleted, 0),
      locCondition
    ))
    .orderBy(sql`${siteSupplies.date} DESC`, sql`${siteSupplies.id} DESC`);

    const recordIds = supplies.map(r => r.id);
    let allItems: any[] = [];
    if (recordIds.length > 0) {
      allItems = await db.select({
        id: siteSupplyItems.id,
        siteSupplyId: siteSupplyItems.siteSupplyId,
        materialId: siteSupplyItems.materialId,
        quantity: siteSupplyItems.quantity,
        rate: siteSupplyItems.rate,
        amount: siteSupplyItems.amount,
        materialName: materials.name,
        defaultUnit: materials.defaultUnit,
      })
      .from(siteSupplyItems)
      .leftJoin(materials, eq(siteSupplyItems.materialId, materials.id))
      .where(and(
        inArray(siteSupplyItems.siteSupplyId, recordIds),
        eq(siteSupplyItems.isDeleted, 0)
      ));
    }

    const formattedList = supplies.map(r => {
      let meta: any = {};
      if (r.notes && r.notes.startsWith('{') && r.notes.endsWith('}')) {
        try {
          meta = JSON.parse(r.notes);
        } catch {
          meta = {};
        }
      }
      return {
        ...r,
        displayNotes: meta.userNotes !== undefined ? meta.userNotes : r.notes,
        subtotal: meta.subtotal || r.totalAmount,
        taxAmount: meta.taxAmount || '0',
        items: allItems.filter(i => i.siteSupplyId === r.id).map(it => {
          let itemMeta: any = {};
          if (meta.itemsDetail && meta.itemsDetail[it.id]) {
            itemMeta = meta.itemsDetail[it.id];
          }
          return {
            ...it,
            unit: itemMeta.unit || it.defaultUnit || 'Nos',
            taxPercentage: itemMeta.taxPercentage || 0,
            taxAmount: itemMeta.taxAmount || 0,
            subtotal: itemMeta.subtotal || it.amount,
            totalWithGst: it.amount
          };
        })
      };
    });

    const buffer = generateSiteSuppliesBuffer(formattedList, locName);
    const safeLoc = locName.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="Site_Supplies_${safeLoc}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error: any) {
    console.error('Failed to export site supplies:', error);
    res.status(500).json({ error: 'Failed to export site supplies' });
  }
});

// -------------------------------------------------------------
// GET /api/reports/export-refundable-records (Security Deposits / Refundables)
// -------------------------------------------------------------
reportRouter.get('/export-refundable-records', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const locationIdParam = req.query.locationId && req.query.locationId !== 'ALL' ? parseInt(req.query.locationId as string, 10) : undefined;

    let locCondition = sql`1=1`;
    let locName = 'All Locations';
    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
      locCondition = sql`${records.locationId} = ${locationIdParam}`;
      const [l] = await db.select({ name: locations.name }).from(locations).where(eq(locations.id, locationIdParam));
      if (l) locName = l.name;
    }

    const refundableList = await db.select({
      id: records.id,
      date: records.date,
      locationId: records.locationId,
      locationName: locations.name,
      partyName: records.partyName,
      amount: records.amount,
      refundableAmount: sql<string>`case when coalesce(${records.refundableAmount}, 0) > 0 then ${records.refundableAmount} else ${records.amount} end`,
      refundedAmount: sql<string>`coalesce(${records.refundedAmount}, '0.00')`,
      refundStatus: sql<string>`coalesce(${records.refundStatus}, 'PENDING')`,
      paymentMethod: records.paymentMethod,
      referenceNumber: records.referenceNumber,
      description: records.description,
      notes: records.notes
    })
    .from(records)
    .innerJoin(locations, eq(records.locationId, locations.id))
    .where(and(
      eq(records.isDeleted, 0),
      eq(locations.isDeleted, 0),
      locCondition,
      sql`(${records.refundableAmount} > 0 OR ${records.category} = 'REFUNDABLE_RECORD' OR ${records.category} = 'REFUNDABLE')`
    ))
    .orderBy(sql`${records.date} DESC`, sql`${records.id} DESC`);

    const buffer = generateRefundableRecordsBuffer(refundableList, locName);
    res.setHeader('Content-Disposition', `attachment; filename="Refundable_Records_${locName.replace(/\s+/g, '_')}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error: any) {
    console.error('Failed to export refundable records:', error);
    res.status(500).json({ error: 'Failed to export refundable records' });
  }
});

// -------------------------------------------------------------
// GET /api/reports/material-analytics (Full Material Purchase vs Supply Price Analytics)
// -------------------------------------------------------------------------------------
reportRouter.get('/material-analytics', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const locationIdParam = req.query.locationId && req.query.locationId !== 'ALL'
      ? parseInt(req.query.locationId as string, 10)
      : undefined;

    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
    }

    const locCondition = locationIdParam 
      ? sql`${locations.id} = ${locationIdParam}`
      : sql`1=1`;

    const locIds = await db.select({ id: locations.id }).from(locations)
      .where(and(eq(locations.isDeleted, 0), locCondition));
    const validLocIds = locIds.map(l => l.id);
    if (validLocIds.length === 0) {
      return res.json({
        summary: {
          totalPurchasedValue: 0,
          totalPurchasedQty: 0,
          totalMaterialSupplyValue: 0,
          totalMaterialSupplyQty: 0,
          totalSiteSupplyValue: 0,
          totalSiteSupplyQty: 0,
          totalOverallSuppliedValue: 0,
          totalOverallSuppliedQty: 0,
          totalStockInventoryValuation: 0,
          totalGrossProfit: 0,
          distinctMaterialsCount: 0
        },
        materials: []
      });
    }

    const idList = validLocIds.join(',');

    // 1. Fetch materials master
    const matRows = await db.execute(sql`
      SELECT id, name, category, default_unit as unit, default_rate, min_stock, location_id
      FROM materials
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      ORDER BY UPPER(TRIM(name)) ASC
    `);

    // 2. Fetch all material purchases
    const purRows = await db.execute(sql`
      SELECT 
        id, location_id, material_id, material_name, party_name, date,
        quantity, unit, rate, subtotal, transport_cost, discount, tax, total_amount, payment_status
      FROM material_purchases
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      ORDER BY date DESC, id DESC
    `);

    // 3. Fetch all material supplies (Cat 4)
    const supRows = await db.execute(sql`
      SELECT 
        id, location_id, material_id, material_name, party_name, date,
        quantity, unit, rate, subtotal, transport_cost, discount, tax, total_amount, payment_status
      FROM material_supplies
      WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
      ORDER BY date DESC, id DESC
    `);

    // 4. Fetch all site supplies (Cat 5)
    const siteRows = await db.execute(sql`
      SELECT 
        s.id as supply_id, s.location_id, s.date, s.responsible_person, s.work_description,
        t.name as team_name,
        i.id as item_id, i.material_id, i.quantity, i.rate, i.amount as item_amount
      FROM site_supplies s
      JOIN site_supply_items i ON s.id = i.site_supply_id
      LEFT JOIN labour_teams t ON s.team_id = t.id
      WHERE s.is_deleted = 0 AND (i.is_deleted = 0 OR i.is_deleted IS NULL) AND s.location_id IN (${sql.raw(idList)})
      ORDER BY s.date DESC, s.id DESC
    `);

    // Aggregation Map by canonical Material Key (normalized upper case name)
    const materialMap = new Map<string, {
      materialId?: number;
      materialName: string;
      category: string;
      unit: string;
      purchases: any[];
      materialSupplies: any[];
      siteSupplies: any[];
      purchasedQty: number;
      totalPurchaseCost: number;
      purchaseSubtotal: number;
      purchaseRates: number[];
      materialSupplyQty: number;
      materialSupplyAmount: number;
      materialSupplyRates: number[];
      siteSupplyQty: number;
      siteSupplyAmount: number;
      siteSupplyRates: number[];
    }>();

    const getOrCreate = (name: string, matId?: number, unit?: string, cat?: string) => {
      const cleanName = (name || 'UNKNOWN').trim().toUpperCase();
      if (!materialMap.has(cleanName)) {
        materialMap.set(cleanName, {
          materialId: matId,
          materialName: cleanName,
          category: cat || 'GENERAL',
          unit: unit || 'Unit',
          purchases: [],
          materialSupplies: [],
          siteSupplies: [],
          purchasedQty: 0,
          totalPurchaseCost: 0,
          purchaseSubtotal: 0,
          purchaseRates: [],
          materialSupplyQty: 0,
          materialSupplyAmount: 0,
          materialSupplyRates: [],
          siteSupplyQty: 0,
          siteSupplyAmount: 0,
          siteSupplyRates: []
        });
      }
      const entry = materialMap.get(cleanName)!;
      if (matId && !entry.materialId) entry.materialId = matId;
      if (unit && entry.unit === 'Unit') entry.unit = unit;
      if (cat && entry.category === 'GENERAL') entry.category = cat;
      return entry;
    };

    // Populate from master
    for (const m of matRows.rows as any[]) {
      getOrCreate(m.name, Number(m.id), m.unit, m.category);
    }

    // Process Purchases
    for (const p of purRows.rows as any[]) {
      const q = Math.abs(parseFloat(p.quantity || '0'));
      const tot = parseFloat(p.total_amount || '0');
      const sub = parseFloat(p.subtotal || '0') || (q * parseFloat(p.rate || '0'));
      const rate = parseFloat(p.rate || '0') || (q > 0 ? (tot / q) : 0);

      const entry = getOrCreate(p.material_name, p.material_id ? Number(p.material_id) : undefined, p.unit);
      entry.purchases.push({
        id: p.id,
        date: p.date,
        partyName: p.party_name,
        quantity: q,
        unit: p.unit || entry.unit,
        rate,
        totalAmount: tot,
        paymentStatus: p.payment_status
      });
      entry.purchasedQty += q;
      entry.totalPurchaseCost += tot;
      entry.purchaseSubtotal += sub;
      if (rate > 0) entry.purchaseRates.push(rate);
    }

    // Process Material Supplies (Cat 4)
    for (const s of supRows.rows as any[]) {
      const q = Math.abs(parseFloat(s.quantity || '0'));
      const tot = parseFloat(s.total_amount || '0');
      const rate = parseFloat(s.rate || '0') || (q > 0 ? (tot / q) : 0);

      const entry = getOrCreate(s.material_name, s.material_id ? Number(s.material_id) : undefined, s.unit);
      entry.materialSupplies.push({
        id: s.id,
        date: s.date,
        partyName: s.party_name,
        quantity: q,
        unit: s.unit || entry.unit,
        rate,
        totalAmount: tot,
        paymentStatus: s.payment_status
      });
      entry.materialSupplyQty += q;
      entry.materialSupplyAmount += tot;
      if (rate > 0) entry.materialSupplyRates.push(rate);
    }

    // Process Site Supplies (Cat 5)
    for (const st of siteRows.rows as any[]) {
      const q = Math.abs(parseFloat(st.quantity || '0'));
      const tot = parseFloat(st.item_amount || '0');
      const rate = parseFloat(st.rate || '0') || (q > 0 ? (tot / q) : 0);

      // Match master material name
      let foundName = '';
      let foundUnit = '';
      if (st.material_id) {
        const foundMat = (matRows.rows as any[]).find(m => Number(m.id) === Number(st.material_id));
        if (foundMat) {
          foundName = foundMat.name;
          foundUnit = foundMat.unit;
        }
      }
      if (!foundName) foundName = `MATERIAL_${st.material_id || 'UNKNOWN'}`;

      const entry = getOrCreate(foundName, st.material_id ? Number(st.material_id) : undefined, foundUnit);
      entry.siteSupplies.push({
        id: st.supply_id,
        itemId: st.item_id,
        date: st.date,
        teamName: st.team_name || 'Direct Site',
        responsiblePerson: st.responsible_person || '',
        workDescription: st.work_description || '',
        quantity: q,
        unit: entry.unit,
        rate,
        totalAmount: tot
      });
      entry.siteSupplyQty += q;
      entry.siteSupplyAmount += tot;
      if (rate > 0) entry.siteSupplyRates.push(rate);
    }

    // Compute final Analytics per Material
    let sumPurchasedVal = 0;
    let sumPurchasedQty = 0;
    let sumMatSupVal = 0;
    let sumMatSupQty = 0;
    let sumSiteSupVal = 0;
    let sumSiteSupQty = 0;
    let sumOverallSupVal = 0;
    let sumOverallSupQty = 0;
    let sumInventoryVal = 0;
    let sumGrossProfit = 0;

    const materialsAnalytics = Array.from(materialMap.values()).map(item => {
      const purchasedQty = Math.round(item.purchasedQty * 100) / 100;
      const totalPurchaseCost = Math.round(item.totalPurchaseCost * 100) / 100;
      const avgPurchaseRate = purchasedQty > 0 ? Math.round((totalPurchaseCost / purchasedQty) * 100) / 100 : 0;
      const minPurchaseRate = item.purchaseRates.length > 0 ? Math.min(...item.purchaseRates) : 0;
      const maxPurchaseRate = item.purchaseRates.length > 0 ? Math.max(...item.purchaseRates) : 0;

      const materialSupplyQty = Math.round(item.materialSupplyQty * 100) / 100;
      const materialSupplyAmount = Math.round(item.materialSupplyAmount * 100) / 100;
      const avgMaterialSupplyRate = materialSupplyQty > 0 ? Math.round((materialSupplyAmount / materialSupplyQty) * 100) / 100 : 0;

      const siteSupplyQty = Math.round(item.siteSupplyQty * 100) / 100;
      const siteSupplyAmount = Math.round(item.siteSupplyAmount * 100) / 100;
      const avgSiteSupplyRate = siteSupplyQty > 0 ? Math.round((siteSupplyAmount / siteSupplyQty) * 100) / 100 : 0;

      const totalSuppliedQty = Math.round((materialSupplyQty + siteSupplyQty) * 100) / 100;
      const totalSuppliedAmount = Math.round((materialSupplyAmount + siteSupplyAmount) * 100) / 100;
      const avgOverallSupplyRate = totalSuppliedQty > 0 ? Math.round((totalSuppliedAmount / totalSuppliedQty) * 100) / 100 : 0;

      const currentStock = Math.round((purchasedQty - totalSuppliedQty) * 100) / 100;
      const stockValuation = currentStock > 0 ? Math.round(currentStock * avgPurchaseRate * 100) / 100 : 0;

      let status = 'IN_STOCK';
      if (currentStock < 0) status = 'NEGATIVE_ALERT';
      else if (currentStock === 0) status = 'OUT_OF_STOCK';
      else if (currentStock <= 15) status = 'LOW_STOCK';

      const rateSpread = Math.round((avgOverallSupplyRate - avgPurchaseRate) * 100) / 100;
      const grossProfit = Math.round(((avgOverallSupplyRate - avgPurchaseRate) * totalSuppliedQty) * 100) / 100;
      const marginPercent = avgPurchaseRate > 0 ? Math.round(((avgOverallSupplyRate - avgPurchaseRate) / avgPurchaseRate) * 1000) / 10 : 0;

      // Add to overall totals
      sumPurchasedVal += totalPurchaseCost;
      sumPurchasedQty += purchasedQty;
      sumMatSupVal += materialSupplyAmount;
      sumMatSupQty += materialSupplyQty;
      sumSiteSupVal += siteSupplyAmount;
      sumSiteSupQty += siteSupplyQty;
      sumOverallSupVal += totalSuppliedAmount;
      sumOverallSupQty += totalSuppliedQty;
      sumInventoryVal += stockValuation;
      sumGrossProfit += grossProfit;

      return {
        materialId: item.materialId,
        materialName: item.materialName,
        category: item.category,
        unit: item.unit,
        purchasedQty,
        totalPurchaseCost,
        avgPurchaseRate,
        minPurchaseRate,
        maxPurchaseRate,
        purchaseCount: item.purchases.length,
        materialSupplyQty,
        materialSupplyAmount,
        avgMaterialSupplyRate,
        siteSupplyQty,
        siteSupplyAmount,
        avgSiteSupplyRate,
        totalSuppliedQty,
        totalSuppliedAmount,
        avgOverallSupplyRate,
        currentStock,
        stockValuation,
        status,
        rateSpread,
        grossProfit,
        marginPercent,
        purchases: item.purchases,
        materialSupplies: item.materialSupplies,
        siteSupplies: item.siteSupplies
      };
    });

    const summary = {
      totalPurchasedValue: Math.round(sumPurchasedVal * 100) / 100,
      totalPurchasedQty: Math.round(sumPurchasedQty * 100) / 100,
      totalMaterialSupplyValue: Math.round(sumMatSupVal * 100) / 100,
      totalMaterialSupplyQty: Math.round(sumMatSupQty * 100) / 100,
      totalSiteSupplyValue: Math.round(sumSiteSupVal * 100) / 100,
      totalSiteSupplyQty: Math.round(sumSiteSupQty * 100) / 100,
      totalOverallSuppliedValue: Math.round(sumOverallSupVal * 100) / 100,
      totalOverallSuppliedQty: Math.round(sumOverallSupQty * 100) / 100,
      totalStockInventoryValuation: Math.round(sumInventoryVal * 100) / 100,
      totalGrossProfit: Math.round(sumGrossProfit * 100) / 100,
      distinctMaterialsCount: materialsAnalytics.length
    };

    res.json({
      summary,
      materials: materialsAnalytics
    });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to fetch material analytics:', error);
    res.status(500).json({ error: 'Failed to fetch material analytics' });
  }
});

// GET /api/reports/export-material-analytics (Download Material Analytics Excel)
// -----------------------------------------------------------------------------
reportRouter.get('/export-material-analytics', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });

    const locationIdParam = req.query.locationId && req.query.locationId !== 'ALL'
      ? parseInt(req.query.locationId as string, 10)
      : undefined;

    let locationName = "All Project Locations";
    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
      const [loc] = await db.select({ name: locations.name }).from(locations).where(eq(locations.id, locationIdParam));
      if (loc) locationName = loc.name;
    }

    const locCondition = locationIdParam 
      ? sql`${locations.id} = ${locationIdParam}`
      : sql`1=1`;

    const locIds = await db.select({ id: locations.id }).from(locations)
      .where(and(eq(locations.isDeleted, 0), locCondition));
    const validLocIds = locIds.map(l => l.id);
    if (validLocIds.length === 0) {
      return res.status(404).json({ error: 'No data found for this location' });
    }

    const idList = validLocIds.join(',');

    const [matRows, purRows, supRows, siteRows] = await Promise.all([
      db.execute(sql`
        SELECT id, name, category, default_unit as unit, default_rate, min_stock, location_id
        FROM materials
        WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
        ORDER BY UPPER(TRIM(name)) ASC
      `),
      db.execute(sql`
        SELECT 
          id, location_id, material_id, material_name, party_name, date,
          quantity, unit, rate, subtotal, transport_cost, discount, tax, total_amount, payment_status
        FROM material_purchases
        WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
        ORDER BY date DESC, id DESC
      `),
      db.execute(sql`
        SELECT 
          id, location_id, material_id, material_name, party_name, date,
          quantity, unit, rate, subtotal, transport_cost, discount, tax, total_amount, payment_status
        FROM material_supplies
        WHERE is_deleted = 0 AND location_id IN (${sql.raw(idList)})
        ORDER BY date DESC, id DESC
      `),
      db.execute(sql`
        SELECT 
          s.id as supply_id, s.location_id, s.date, s.responsible_person, s.work_description,
          t.name as team_name,
          i.id as item_id, i.material_id, i.quantity, i.rate, i.amount as item_amount
        FROM site_supplies s
        JOIN site_supply_items i ON s.id = i.site_supply_id
        LEFT JOIN labour_teams t ON s.team_id = t.id
        WHERE s.is_deleted = 0 AND (i.is_deleted = 0 OR i.is_deleted IS NULL) AND s.location_id IN (${sql.raw(idList)})
        ORDER BY s.date DESC, s.id DESC
      `)
    ]);

    const materialMap = new Map<string, any>();
    const getOrCreate = (name: string, matId?: number, unit?: string, cat?: string) => {
      const cleanName = (name || 'UNKNOWN').trim().toUpperCase();
      if (!materialMap.has(cleanName)) {
        materialMap.set(cleanName, {
          materialId: matId,
          materialName: cleanName,
          category: cat || 'GENERAL',
          unit: unit || 'Unit',
          purchases: [],
          materialSupplies: [],
          siteSupplies: [],
          purchasedQty: 0,
          totalPurchaseCost: 0,
          purchaseRates: [],
          materialSupplyQty: 0,
          materialSupplyAmount: 0,
          materialSupplyRates: [],
          siteSupplyQty: 0,
          siteSupplyAmount: 0,
          siteSupplyRates: []
        });
      }
      const entry = materialMap.get(cleanName)!;
      if (matId && !entry.materialId) entry.materialId = matId;
      if (unit && entry.unit === 'Unit') entry.unit = unit;
      if (cat && entry.category === 'GENERAL') entry.category = cat;
      return entry;
    };

    for (const m of matRows.rows as any[]) {
      getOrCreate(m.name, Number(m.id), m.unit, m.category);
    }

    for (const p of purRows.rows as any[]) {
      const q = Math.abs(parseFloat(p.quantity || '0'));
      const tot = parseFloat(p.total_amount || '0');
      const rate = parseFloat(p.rate || '0') || (q > 0 ? (tot / q) : 0);
      const entry = getOrCreate(p.material_name, p.material_id ? Number(p.material_id) : undefined, p.unit);
      entry.purchases.push({
        id: p.id,
        date: p.date,
        partyName: p.party_name,
        quantity: q,
        unit: p.unit || entry.unit,
        rate,
        totalAmount: tot,
        paymentStatus: p.payment_status
      });
      entry.purchasedQty += q;
      entry.totalPurchaseCost += tot;
      if (rate > 0) entry.purchaseRates.push(rate);
    }

    for (const s of supRows.rows as any[]) {
      const q = Math.abs(parseFloat(s.quantity || '0'));
      const tot = parseFloat(s.total_amount || '0');
      const rate = parseFloat(s.rate || '0') || (q > 0 ? (tot / q) : 0);
      const entry = getOrCreate(s.material_name, s.material_id ? Number(s.material_id) : undefined, s.unit);
      entry.materialSupplies.push({
        id: s.id,
        date: s.date,
        partyName: s.party_name,
        quantity: q,
        unit: s.unit || entry.unit,
        rate,
        totalAmount: tot,
        paymentStatus: s.payment_status
      });
      entry.materialSupplyQty += q;
      entry.materialSupplyAmount += tot;
      if (rate > 0) entry.materialSupplyRates.push(rate);
    }

    for (const st of siteRows.rows as any[]) {
      const q = Math.abs(parseFloat(st.quantity || '0'));
      const tot = parseFloat(st.item_amount || '0');
      const rate = parseFloat(st.rate || '0') || (q > 0 ? (tot / q) : 0);
      let foundName = '';
      let foundUnit = '';
      if (st.material_id) {
        const foundMat = (matRows.rows as any[]).find(m => Number(m.id) === Number(st.material_id));
        if (foundMat) {
          foundName = foundMat.name;
          foundUnit = foundMat.unit;
        }
      }
      if (!foundName) foundName = `MATERIAL_${st.material_id || 'UNKNOWN'}`;
      const entry = getOrCreate(foundName, st.material_id ? Number(st.material_id) : undefined, foundUnit);
      entry.siteSupplies.push({
        id: st.supply_id,
        itemId: st.item_id,
        date: st.date,
        teamName: st.team_name || 'Direct Site',
        responsiblePerson: st.responsible_person || '',
        workDescription: st.work_description || '',
        quantity: q,
        unit: entry.unit,
        rate,
        totalAmount: tot
      });
      entry.siteSupplyQty += q;
      entry.siteSupplyAmount += tot;
      if (rate > 0) entry.siteSupplyRates.push(rate);
    }

    let sumPurchasedVal = 0;
    let sumPurchasedQty = 0;
    let sumMatSupVal = 0;
    let sumMatSupQty = 0;
    let sumSiteSupVal = 0;
    let sumSiteSupQty = 0;
    let sumOverallSupVal = 0;
    let sumOverallSupQty = 0;
    let sumInventoryVal = 0;
    let sumGrossProfit = 0;

    const materialsAnalytics = Array.from(materialMap.values()).map(item => {
      const purchasedQty = Math.round(item.purchasedQty * 100) / 100;
      const totalPurchaseCost = Math.round(item.totalPurchaseCost * 100) / 100;
      const avgPurchaseRate = purchasedQty > 0 ? Math.round((totalPurchaseCost / purchasedQty) * 100) / 100 : 0;
      const minPurchaseRate = item.purchaseRates.length > 0 ? Math.min(...item.purchaseRates) : 0;
      const maxPurchaseRate = item.purchaseRates.length > 0 ? Math.max(...item.purchaseRates) : 0;

      const materialSupplyQty = Math.round(item.materialSupplyQty * 100) / 100;
      const materialSupplyAmount = Math.round(item.materialSupplyAmount * 100) / 100;
      const avgMaterialSupplyRate = materialSupplyQty > 0 ? Math.round((materialSupplyAmount / materialSupplyQty) * 100) / 100 : 0;

      const siteSupplyQty = Math.round(item.siteSupplyQty * 100) / 100;
      const siteSupplyAmount = Math.round(item.siteSupplyAmount * 100) / 100;
      const avgSiteSupplyRate = siteSupplyQty > 0 ? Math.round((siteSupplyAmount / siteSupplyQty) * 100) / 100 : 0;

      const totalSuppliedQty = Math.round((materialSupplyQty + siteSupplyQty) * 100) / 100;
      const totalSuppliedAmount = Math.round((materialSupplyAmount + siteSupplyAmount) * 100) / 100;
      const avgOverallSupplyRate = totalSuppliedQty > 0 ? Math.round((totalSuppliedAmount / totalSuppliedQty) * 100) / 100 : 0;

      const currentStock = Math.round((purchasedQty - totalSuppliedQty) * 100) / 100;
      const stockValuation = currentStock > 0 ? Math.round(currentStock * avgPurchaseRate * 100) / 100 : 0;

      let status = 'IN_STOCK';
      if (currentStock < 0) status = 'NEGATIVE_ALERT';
      else if (currentStock === 0) status = 'OUT_OF_STOCK';
      else if (currentStock <= 15) status = 'LOW_STOCK';

      const rateSpread = Math.round((avgOverallSupplyRate - avgPurchaseRate) * 100) / 100;
      const grossProfit = Math.round(((avgOverallSupplyRate - avgPurchaseRate) * totalSuppliedQty) * 100) / 100;
      const marginPercent = avgPurchaseRate > 0 ? Math.round(((avgOverallSupplyRate - avgPurchaseRate) / avgPurchaseRate) * 1000) / 10 : 0;

      sumPurchasedVal += totalPurchaseCost;
      sumPurchasedQty += purchasedQty;
      sumMatSupVal += materialSupplyAmount;
      sumMatSupQty += materialSupplyQty;
      sumSiteSupVal += siteSupplyAmount;
      sumSiteSupQty += siteSupplyQty;
      sumOverallSupVal += totalSuppliedAmount;
      sumOverallSupQty += totalSuppliedQty;
      sumInventoryVal += stockValuation;
      sumGrossProfit += grossProfit;

      return {
        materialId: item.materialId,
        materialName: item.materialName,
        category: item.category,
        unit: item.unit,
        purchasedQty,
        totalPurchaseCost,
        avgPurchaseRate,
        minPurchaseRate,
        maxPurchaseRate,
        purchaseCount: item.purchases.length,
        materialSupplyQty,
        materialSupplyAmount,
        avgMaterialSupplyRate,
        siteSupplyQty,
        siteSupplyAmount,
        avgSiteSupplyRate,
        totalSuppliedQty,
        totalSuppliedAmount,
        avgOverallSupplyRate,
        currentStock,
        stockValuation,
        status,
        rateSpread,
        grossProfit,
        marginPercent,
        purchases: item.purchases,
        materialSupplies: item.materialSupplies,
        siteSupplies: item.siteSupplies
      };
    });

    const summary = {
      totalPurchasedValue: Math.round(sumPurchasedVal * 100) / 100,
      totalPurchasedQty: Math.round(sumPurchasedQty * 100) / 100,
      totalMaterialSupplyValue: Math.round(sumMatSupVal * 100) / 100,
      totalMaterialSupplyQty: Math.round(sumMatSupQty * 100) / 100,
      totalSiteSupplyValue: Math.round(sumSiteSupVal * 100) / 100,
      totalSiteSupplyQty: Math.round(sumSiteSupQty * 100) / 100,
      totalOverallSuppliedValue: Math.round(sumOverallSupVal * 100) / 100,
      totalOverallSuppliedQty: Math.round(sumOverallSupQty * 100) / 100,
      totalStockInventoryValuation: Math.round(sumInventoryVal * 100) / 100,
      totalGrossProfit: Math.round(sumGrossProfit * 100) / 100,
      distinctMaterialsCount: materialsAnalytics.length
    };

    const buffer = generateMaterialAnalyticsBuffer(locationName, { summary, materials: materialsAnalytics });
    const sanitized = locationName.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="Material_Purchase_Supply_Analytics_${sanitized}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error: any) {
    console.error('Failed to export material analytics:', error);
    res.status(500).json({ error: 'Failed to export material analytics' });
  }
});

// GET /api/reports/download-catalog (Catalog of all downloadable files)
// -------------------------------------------------------------
reportRouter.get('/download-catalog', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const locationIdParam = req.query.locationId && req.query.locationId !== 'ALL'
      ? parseInt(req.query.locationId as string, 10)
      : undefined;

    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
    }

    const locCondition = locationIdParam ? sql`location_id = ${locationIdParam}` : sql`1=1`;

    // Fetch lists of investors, vendors, customers
    const [invParties, vendors, customers, counts] = await Promise.all([
      db.select({ id: investmentParties.id, name: investmentParties.partyName, locationId: investmentParties.locationId })
        .from(investmentParties)
        .where(and(eq(investmentParties.isDeleted, 0), locationIdParam ? eq(investmentParties.locationId, locationIdParam) : sql`1=1`))
        .orderBy(investmentParties.partyName),
      db.execute(sql`
        SELECT DISTINCT party_name as name, COUNT(*) as count, SUM(total_amount) as total
        FROM material_purchases
        WHERE is_deleted = 0 AND ${locCondition}
        GROUP BY party_name ORDER BY party_name
      `),
      db.execute(sql`
        SELECT DISTINCT party_name as name, COUNT(*) as count, SUM(total_amount) as total
        FROM material_supplies
        WHERE is_deleted = 0 AND ${locCondition}
        GROUP BY party_name ORDER BY party_name
      `),
      db.execute(sql`
        SELECT 
          (SELECT COUNT(*) FROM records WHERE is_deleted = 0 AND (${records.refundableAmount} > 0 OR category IN ('REFUNDABLE_RECORD', 'REFUNDABLE')) AND ${locCondition}) as ref_count,
          (SELECT COUNT(*) FROM material_purchases WHERE is_deleted = 0 AND ${locCondition}) as pur_count,
          (SELECT COUNT(*) FROM material_supplies WHERE is_deleted = 0 AND ${locCondition}) as sup_count,
          (SELECT COUNT(*) FROM site_supplies WHERE is_deleted = 0 AND ${locCondition}) as site_count,
          (SELECT COUNT(*) FROM labour_salaries WHERE is_deleted = 0 AND ${locCondition}) as lab_count,
          (SELECT COUNT(*) FROM supervisor_costs WHERE is_deleted = 0 AND ${locCondition}) as exp_count
      `)
    ]);

    res.json({
      investors: invParties,
      vendors: vendors.rows,
      customers: customers.rows,
      counts: counts.rows[0] || {}
    });
  } catch (error: any) {
    console.error('Failed to get download catalog:', error);
    res.status(500).json({ error: 'Failed to fetch download catalog' });
  }
});

export default reportRouter;
