import { apiFetch } from './api';

const CENTRAL_SPREADSHEET_KEY = 'bj_google_central_spreadsheet_id';
const LOCATION_SPREADSHEET_PREFIX = 'bj_google_loc_spreadsheet_';

export interface LocationSheetStats {
  locationId: number;
  locationName: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  investorsCount: number;
  siteSuppliesCount: number;
  teamsCount: number;
  attendanceCount: number;
  expensesCount: number;
  syncedAt: string;
}

export interface CentralSyncStats {
  purchasesCount: number;
  stockCount: number;
  customerSuppliesCount: number;
  investorsCount: number;
  expensesCount: number;
  locationsCount: number;
  syncedAt: string;
}

export interface AllSyncResults {
  central: { spreadsheetId: string; stats: CentralSyncStats };
  locations: LocationSheetStats[];
  syncedAt: string;
}

// Key helpers
export function getSavedCentralSpreadsheetId(): string | null {
  return localStorage.getItem(CENTRAL_SPREADSHEET_KEY) || localStorage.getItem('bj_google_spreadsheet_id');
}

export function setSavedCentralSpreadsheetId(id: string) {
  localStorage.setItem(CENTRAL_SPREADSHEET_KEY, id);
  localStorage.setItem('bj_google_spreadsheet_id', id); // backward compatibility
}

export function getSavedLocationSpreadsheetId(locationId: number): string | null {
  return localStorage.getItem(`${LOCATION_SPREADSHEET_PREFIX}${locationId}`);
}

export function setSavedLocationSpreadsheetId(locationId: number, spreadsheetId: string) {
  localStorage.setItem(`${LOCATION_SPREADSHEET_PREFIX}${locationId}`, spreadsheetId);
}

export function getSpreadsheetUrl(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

export function clearAllSavedSpreadsheetIds() {
  localStorage.removeItem(CENTRAL_SPREADSHEET_KEY);
  localStorage.removeItem('bj_google_spreadsheet_id');
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LOCATION_SPREADSHEET_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
}

/**
 * Ensures all requested tab names exist in the spreadsheet.
 * If any tab is missing, it dynamically adds it using Google Sheets batchUpdate.
 */
async function ensureSheetTabsExist(accessToken: string, spreadsheetId: string, requiredTabs: string[]) {
  try {
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!metaRes.ok) return;

    const metaData = await metaRes.json();
    const existingTitles: string[] = (metaData.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);

    const missingTabs = requiredTabs.filter(t => !existingTitles.includes(t));
    if (missingTabs.length > 0) {
      const requests = missingTabs.map(title => ({
        addSheet: {
          properties: {
            title,
            gridProperties: { frozenRowCount: 1 }
          }
        }
      }));

      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
      });
    }
  } catch (err) {
    console.warn('ensureSheetTabsExist warning:', err);
  }
}

/**
 * 1. CENTRAL SPREADSHEET (Purchases, Stock, Customer Supply, Admin Capital & All Sites Summary)
 */
export async function getOrCreateCentralSpreadsheet(accessToken: string): Promise<string> {
  const existingId = getSavedCentralSpreadsheetId();
  if (existingId) {
    try {
      const checkRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${existingId}?fields=spreadsheetId,properties.title`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (checkRes.ok) {
        return existingId;
      }
    } catch (e) {
      console.warn('Could not access existing central spreadsheet, creating a new one', e);
    }
  }

  const createPayload = {
    properties: {
      title: 'B J Enterprise - Central Purchases & Admin Ledger'
    },
    sheets: [
      { properties: { title: 'Admin & Capital Overview', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Material Purchases', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Stock Inventory', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Customer Supplies', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Global Expenses', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'All Locations Summary', gridProperties: { frozenRowCount: 1 } } }
    ]
  };

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(createPayload)
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(err?.error?.message || 'Failed to create Central Google Spreadsheet');
  }

  const createdData = await createRes.json();
  const newId = createdData.spreadsheetId;
  setSavedCentralSpreadsheetId(newId);
  return newId;
}

export async function syncCentralDataToGoogleSheets(accessToken: string): Promise<{ spreadsheetId: string; stats: CentralSyncStats }> {
  const spreadsheetId = await getOrCreateCentralSpreadsheet(accessToken);

  const requiredTabs = [
    'Admin & Capital Overview',
    'Material Purchases',
    'Stock Inventory',
    'Customer Supplies',
    'Global Expenses',
    'All Locations Summary'
  ];
  await ensureSheetTabsExist(accessToken, spreadsheetId, requiredTabs);

  // Fetch all central data
  const [purchases, centralStock, customerSupplies, globalInvestors, adminSummary, expenses, locations, allocations] = await Promise.all([
    apiFetch('/materials/purchases').catch(() => []),
    apiFetch('/materials/central-stock').catch(() => []),
    apiFetch('/materials/customer-supplies-history').catch(() => []),
    apiFetch('/investments/global-investors').catch(() => []),
    apiFetch('/investments/admin-capital-summary').catch(() => null),
    apiFetch('/expenses').catch(() => []),
    apiFetch('/locations').catch(() => []),
    apiFetch('/investments/location-allocations').catch(() => [])
  ]);

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  // 1. Admin & Capital Overview Data
  const totalAdminCap = adminSummary?.totalContributed || 0;
  const totalAllocated = adminSummary?.totalAllocated || 0;
  const totalPurchasesCost = adminSummary?.totalPurchases || 0;
  const totalWithdrawn = adminSummary?.totalWithdrawn || 0;
  const availAdminCap = adminSummary?.availableAdminCapital ?? (totalAdminCap - totalAllocated - totalPurchasesCost);

  const adminOverviewValues = [
    ['B J ENTERPRISE - CENTRAL ADMIN & INVESTOR CAPITAL MASTER', '', '', '', '', ''],
    ['Last Synced (IST)', timestamp, '', '', '', ''],
    ['', '', '', '', '', ''],
    ['CAPITAL METRIC', 'AMOUNT (₹)', 'DESCRIPTION', '', '', ''],
    ['Total Admin Capital Contributed', totalAdminCap, 'Total capital infused by all registered investors', '', '', ''],
    ['Total Capital Allocated to Sites', totalAllocated, 'Capital transferred to individual project locations', '', '', ''],
    ['Material Purchases Outflow', totalPurchasesCost, 'Direct payments made for warehouse material purchases', '', '', ''],
    ['Total Upad / Withdrawals', totalWithdrawn, 'Capital returned/withdrawn by investors', '', '', ''],
    ['Remaining Available Balance', availAdminCap, 'Unallocated Central Capital Balance', '', '', ''],
    ['', '', '', '', '', ''],
    ['--- ALL REGISTERED INVESTORS & BALANCES ---', '', '', '', '', ''],
    ['Investor ID', 'Investor Name', 'Mobile', 'Total Capital (₹)', 'Allocated (₹)', 'Upad (₹)', 'Remaining Balance (₹)', 'Status']
  ];

  (Array.isArray(globalInvestors) ? globalInvestors : []).forEach((inv: any) => {
    const cap = Number(inv.totalCapital ?? inv.totalContributed ?? 0);
    const alloc = Number(inv.totalAllocated ?? 0);
    const upad = Number(inv.totalUpad ?? inv.totalWithdrawn ?? 0);
    const rem = Number(inv.availableBalance ?? inv.availableCapital ?? (cap - alloc - upad));
    adminOverviewValues.push([
      inv.id || '',
      inv.name || '',
      inv.mobile || '',
      cap,
      alloc,
      upad,
      rem,
      'Active'
    ]);
  });

  // 2. Material Purchases Data
  const purchaseHeaders = [
    'Purchase ID', 'Date', 'Supplier / Party Name', 'Material Name', 'Quantity', 'Unit', 
    'Rate (₹)', 'Tax (%)', 'Tax (₹)', 'Total Amount (₹)', 'Paid Amount (₹)', 
    'Payment Status', 'Payment Method', 'Notes / Remarks'
  ];
  const purchaseRows = (Array.isArray(purchases) ? purchases : []).map((p: any) => [
    p.id || '',
    p.date || '',
    p.supplierName || p.partyName || 'General Supplier',
    p.materialName || '',
    p.quantity || 0,
    p.unit || 'Nos',
    p.rate || 0,
    p.taxPercentage || 0,
    p.tax || 0,
    p.totalAmount || 0,
    p.paidAmount || 0,
    p.paymentStatus || 'PAID',
    p.paymentMethod || 'Bank Transfer',
    p.notes || ''
  ]);
  const purchaseValues = [purchaseHeaders, ...purchaseRows];

  // 3. Central Stock Inventory Data
  const stockHeaders = [
    'Material ID', 'Material Name', 'Unit', 'Purchased Qty (IN)', 
    'Supplied Qty (OUT)', 'Available Stock (Balance)', 'Avg Rate (₹)', 'Total Stock Value (₹)'
  ];
  const stockRows = (Array.isArray(centralStock) ? centralStock : []).map((s: any) => [
    s.id || '',
    s.name || '',
    s.unit || 'Nos',
    s.purchasedQty || s.totalInward || 0,
    s.suppliedQty || s.totalOutward || 0,
    s.currentStock || s.currentBalance || 0,
    s.rate || 0,
    s.stockValue || 0
  ]);
  const stockValues = [stockHeaders, ...stockRows];

  // 4. Customer Supplies Data
  const custSupplyHeaders = [
    'Supply ID', 'Date', 'Customer / Party Name', 'Source Site / Warehouse', 
    'Material Name', 'Quantity', 'Unit', 'Rate (₹)', 'Total Amount (₹)', 
    'Paid Amount (₹)', 'Payment Status', 'Notes'
  ];
  const custSupplyRows = (Array.isArray(customerSupplies) ? customerSupplies : []).map((c: any) => [
    c.id || '',
    c.date || '',
    c.customerName || 'Direct Customer',
    c.locationName || 'Central Warehouse',
    c.materialName || '',
    c.quantity || 0,
    c.unit || 'Nos',
    c.rate || 0,
    c.totalAmount || 0,
    c.paidAmount || 0,
    c.paymentStatus || 'PAID',
    c.notes || ''
  ]);
  const custSupplyValues = [custSupplyHeaders, ...custSupplyRows];

  // 5. Global Expenses
  const expenseHeaders = [
    'Expense ID', 'Date', 'Site / Location', 'Category', 'Payee / Vendor', 
    'Amount (₹)', 'Payment Mode', 'Description / Purpose'
  ];
  const expenseRows = (Array.isArray(expenses) ? expenses : []).map((e: any) => [
    e.id || '',
    e.date || '',
    e.locationName || (e.locationId ? `Location #${e.locationId}` : 'Central Office'),
    e.category || 'General',
    e.payee || e.partyName || '',
    e.amount || 0,
    e.paymentMethod || 'Cash',
    e.description || ''
  ]);
  const expenseValues = [expenseHeaders, ...expenseRows];

  // 6. All Locations Summary
  const locSummaryHeaders = [
    'Location ID', 'Project / Site Name', 'Address', 'Total Capital Allocated (₹)', 'Total Site Supplies Value (₹)', 'Site Status'
  ];
  const locSummaryRows = (Array.isArray(locations) ? locations : []).map((l: any) => {
    const locAllocs = (Array.isArray(allocations) ? allocations : []).filter((a: any) => a.locationId === l.id);
    const totAlloc = locAllocs.reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0);
    return [
      l.id || '',
      l.name || '',
      l.address || '',
      totAlloc,
      '-',
      'Active Site'
    ];
  });
  const locSummaryValues = [locSummaryHeaders, ...locSummaryRows];

  // Batch Write
  const batchData = [
    { range: "'Admin & Capital Overview'!A1:Z500", values: adminOverviewValues },
    { range: "'Material Purchases'!A1:Z2000", values: purchaseValues },
    { range: "'Stock Inventory'!A1:Z500", values: stockValues },
    { range: "'Customer Supplies'!A1:Z2000", values: custSupplyValues },
    { range: "'Global Expenses'!A1:Z2000", values: expenseValues },
    { range: "'All Locations Summary'!A1:Z200", values: locSummaryValues }
  ];

  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ranges: [
          "'Admin & Capital Overview'!A1:Z500",
          "'Material Purchases'!A1:Z2000",
          "'Stock Inventory'!A1:Z500",
          "'Customer Supplies'!A1:Z2000",
          "'Global Expenses'!A1:Z2000",
          "'All Locations Summary'!A1:Z200"
        ]
      })
    });
  } catch (e) {
    console.warn('Batch clear warning:', e);
  }

  const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: batchData
    })
  });

  if (!updateRes.ok) {
    const err = await updateRes.json();
    throw new Error(err?.error?.message || 'Failed to sync central Google Spreadsheet');
  }

  return {
    spreadsheetId,
    stats: {
      purchasesCount: purchases.length,
      stockCount: centralStock.length,
      customerSuppliesCount: customerSupplies.length,
      investorsCount: globalInvestors.length,
      expensesCount: expenses.length,
      locationsCount: locations.length,
      syncedAt: timestamp
    }
  };
}

/**
 * 2. LOCATION-WISE SPREADSHEET (Investor Details, Site Supply Record, and Each Team Tab with Attendance & Supplies)
 */
export async function getOrCreateLocationSpreadsheet(
  accessToken: string,
  locationId: number,
  locationName: string,
  teamNames: string[]
): Promise<string> {
  const existingId = getSavedLocationSpreadsheetId(locationId);
  if (existingId) {
    try {
      const checkRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${existingId}?fields=spreadsheetId,properties.title`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (checkRes.ok) {
        return existingId;
      }
    } catch (e) {
      console.warn(`Could not access existing location spreadsheet for ${locationName}, creating new`, e);
    }
  }

  // Initial sheets
  const sheets = [
    { properties: { title: 'Site Overview', gridProperties: { frozenRowCount: 1 } } },
    { properties: { title: 'Investor Details', gridProperties: { frozenRowCount: 1 } } },
    { properties: { title: 'Site Supply Record', gridProperties: { frozenRowCount: 1 } } },
    { properties: { title: 'Site Expenses', gridProperties: { frozenRowCount: 1 } } }
  ];

  // Add a tab for each team created
  teamNames.forEach((tName) => {
    const cleanTitle = `Team - ${tName}`.substring(0, 50).trim();
    if (!sheets.some(s => s.properties.title === cleanTitle)) {
      sheets.push({ properties: { title: cleanTitle, gridProperties: { frozenRowCount: 1 } } });
    }
  });

  const createPayload = {
    properties: {
      title: `B J Enterprise - ${locationName} (Site Ledger)`
    },
    sheets
  };

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(createPayload)
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(err?.error?.message || `Failed to create Google Spreadsheet for ${locationName}`);
  }

  const createdData = await createRes.json();
  const newId = createdData.spreadsheetId;
  setSavedLocationSpreadsheetId(locationId, newId);
  return newId;
}

/**
 * Synchronizes a single Location's dedicated Google Spreadsheet.
 * Creates tabs:
 * 1. Investor Details
 * 2. Site Supply Record
 * 3. Each Team Tab with:
 *    - Team Total Attendance details
 *    - Team Material Supply records
 * 4. Site Expenses & Overview
 */
export async function syncLocationDataToGoogleSheets(
  accessToken: string,
  locationId: number
): Promise<LocationSheetStats> {
  // 1. Fetch location data and teams
  const [locRes, allocations, siteSupplies, labourRecords, teams, expenses] = await Promise.all([
    apiFetch(`/locations/${locationId}`).catch(() => null),
    apiFetch(`/investments/location-allocations?locationId=${locationId}`).catch(() => []),
    apiFetch(`/materials/site-supplies-history`).catch(() => []),
    apiFetch(`/labour?locationId=${locationId}`).catch(() => []),
    apiFetch(`/master/teams?locationId=${locationId}`).catch(() => []),
    apiFetch(`/expenses?locationId=${locationId}`).catch(() => [])
  ]);

  const locationName = locRes?.name || `Site #${locationId}`;

  // Filter site supplies for this location
  const locSiteSupplies = (Array.isArray(siteSupplies) ? siteSupplies : []).filter(
    (s: any) => s.locationId === locationId || s.locationName === locationName
  );

  // Collect unique teams from teams table AND from labour records
  const teamNamesSet = new Set<string>();
  (Array.isArray(teams) ? teams : []).forEach((t: any) => {
    if (t.name && t.name.trim()) teamNamesSet.add(t.name.trim());
  });
  (Array.isArray(labourRecords) ? labourRecords : []).forEach((l: any) => {
    const t = (l.labourTeam || l.teamName || '').trim();
    if (t && t !== 'General Team' && t !== 'Direct' && t !== '-') teamNamesSet.add(t);
  });
  // Also from site supplies
  locSiteSupplies.forEach((s: any) => {
    const t = (s.teamName || s.recipient || '').trim();
    if (t && t !== 'Site Team' && t !== 'Direct Site' && t !== '-') teamNamesSet.add(t);
  });

  const teamNamesList = Array.from(teamNamesSet);
  if (teamNamesList.length === 0) {
    teamNamesList.push('General Labour Team');
  }

  // Get or Create Spreadsheet
  const spreadsheetId = await getOrCreateLocationSpreadsheet(accessToken, locationId, locationName, teamNamesList);

  // Ensure all tabs exist (Site Overview, Investor Details, Site Supply Record, Site Expenses, plus all Team tabs)
  const requiredTabs = [
    'Site Overview',
    'Investor Details',
    'Site Supply Record',
    'Site Expenses',
    ...teamNamesList.map(t => `Team - ${t}`.substring(0, 50).trim())
  ];
  await ensureSheetTabsExist(accessToken, spreadsheetId, requiredTabs);

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  // 1. SITE OVERVIEW TAB
  const totalAllocatedCap = (Array.isArray(allocations) ? allocations : []).reduce(
    (sum: number, a: any) => sum + Number(a.amount || 0), 0
  );
  const totalSiteSuppliesAmt = locSiteSupplies.reduce(
    (sum: number, s: any) => sum + Number(s.amount || s.totalAmount || 0), 0
  );
  const totalLabourAmt = (Array.isArray(labourRecords) ? labourRecords : []).reduce(
    (sum: number, l: any) => sum + Number(l.grossSalary || l.paymentAmount || 0), 0
  );
  const totalExpensesAmt = (Array.isArray(expenses) ? expenses : []).reduce(
    (sum: number, e: any) => sum + Number(e.amount || 0), 0
  );

  const siteOverviewValues = [
    [`B J ENTERPRISE - ${locationName.toUpperCase()} (SITE LEDGER)`, '', '', ''],
    ['Last Synced (IST)', timestamp, '', ''],
    ['Site Address / Area', locRes?.address || 'Site Location', '', ''],
    ['', '', '', ''],
    ['SITE FINANCIAL SUMMARY', 'AMOUNT (₹)', 'REMARKS', ''],
    ['Total Investor Capital Allocated', totalAllocatedCap, 'Capital assigned specifically to this site', ''],
    ['Total Material Supplies Received', totalSiteSuppliesAmt, 'Materials dispatched to site teams', ''],
    ['Total Labour & Wages Paid', totalLabourAmt, 'Salaries & attendance costs paid to site teams', ''],
    ['Total Site Expenses', totalExpensesAmt, 'Local site operational expenses', ''],
    ['Net Site Balance', totalAllocatedCap - (totalSiteSuppliesAmt + totalLabourAmt + totalExpensesAmt), 'Remaining Site Fund Balance', ''],
    ['', '', '', ''],
    ['SITE TEAMS SUMMARY', '', '', ''],
    ['Total Teams Registered', teamNamesList.length, '', ''],
    ['Total Attendance Logs Recorded', labourRecords.length, '', ''],
    ['Total Site Supply Logs', locSiteSupplies.length, '', '']
  ];

  // 2. TAB 1: INVESTOR DETAILS ("ek investor details")
  const investorHeaders = [
    'Allocation ID', 'Date', 'Investor Name', 'Mobile', 'Allocated Amount (₹)', 
    'Payment Method', 'Ref / Cheque No', 'Notes / Remarks'
  ];
  const investorRows = (Array.isArray(allocations) ? allocations : []).map((a: any) => [
    a.id || '',
    a.date || '',
    a.investorName || 'Investor',
    a.investorMobile || '',
    Number(a.amount || 0),
    a.paymentMethod || 'Bank Transfer',
    a.referenceNumber || '',
    a.notes || ''
  ]);
  const investorValues = [
    [`INVESTOR CAPITAL ALLOCATED TO ${locationName.toUpperCase()}`, '', '', '', '', '', '', ''],
    ['Total Allocated Capital (₹)', totalAllocatedCap, '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    investorHeaders,
    ...investorRows
  ];

  // 3. TAB 2: SITE SUPPLY RECORD ("2nd site supply record")
  const siteSupplyHeaders = [
    'Supply ID', 'Date', 'Material Name', 'Quantity', 'Unit', 
    'Rate (₹)', 'Total Amount (₹)', 'Recipient / Team Name', 'Work Description / Usage', 'Reference No'
  ];
  const siteSupplyRows = locSiteSupplies.map((s: any) => [
    s.id || '',
    s.date || '',
    s.materialName || '',
    s.quantity || 0,
    s.unit || 'Nos',
    s.rate || 0,
    s.amount || s.totalAmount || 0,
    s.teamName || s.recipient || 'Site Team',
    s.workDescription || s.notes || '',
    s.referenceNumber || ''
  ]);
  const siteSupplyValues = [
    [`SITE MATERIAL SUPPLY LOG - ${locationName.toUpperCase()}`, '', '', '', '', '', '', '', '', ''],
    ['Total Material Supply Value (₹)', totalSiteSuppliesAmt, '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
    siteSupplyHeaders,
    ...siteSupplyRows
  ];

  // 4. TAB 4: SITE EXPENSES
  const expenseHeaders = [
    'Expense ID', 'Date', 'Category', 'Payee / Vendor', 
    'Amount (₹)', 'Payment Mode', 'Description / Purpose'
  ];
  const expenseRows = (Array.isArray(expenses) ? expenses : []).map((e: any) => [
    e.id || '',
    e.date || '',
    e.category || 'Site Expense',
    e.payee || e.partyName || '',
    e.amount || 0,
    e.paymentMethod || 'Cash',
    e.description || ''
  ]);
  const expenseValues = [
    [`SITE EXPENSES REGISTER - ${locationName.toUpperCase()}`, '', '', '', '', '', ''],
    ['Total Site Expenses (₹)', totalExpensesAmt, '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    expenseHeaders,
    ...expenseRows
  ];

  // 5. BATCH DATA PREPARATION
  const batchData: { range: string; values: any[][] }[] = [
    { range: "'Site Overview'!A1:Z100", values: siteOverviewValues },
    { range: "'Investor Details'!A1:Z500", values: investorValues },
    { range: "'Site Supply Record'!A1:Z1000", values: siteSupplyValues },
    { range: "'Site Expenses'!A1:Z1000", values: expenseValues }
  ];

  // 6. TABS FOR EACH TEAM CREATED ("jetli team creat thay atli team name na tab create thase")
  // "tema teni total attandance ni details hase and ketlu supply thayu teno record avshe"
  teamNamesList.forEach((teamName) => {
    const tabTitle = `Team - ${teamName}`.substring(0, 50).trim();

    // Filter attendance for this team
    const teamLabour = (Array.isArray(labourRecords) ? labourRecords : []).filter((l: any) => {
      const t = (l.labourTeam || l.teamName || '').trim();
      return t.toLowerCase() === teamName.toLowerCase() || (teamNamesList.length === 1 && (!t || t === 'General Team'));
    });

    // Filter supplies for this team
    const teamSupplies = locSiteSupplies.filter((s: any) => {
      const t = (s.teamName || s.recipient || '').trim();
      return t.toLowerCase() === teamName.toLowerCase() || (teamNamesList.length === 1 && (!t || t === 'Site Team'));
    });

    const totalDays = teamLabour.reduce((acc: number, r: any) => acc + Number(r.days || (r.attendanceType === 'Half Day' ? 0.5 : 1)), 0);
    const totalWagePaid = teamLabour.reduce((acc: number, r: any) => acc + Number(r.grossSalary || r.paymentAmount || 0), 0);
    const totalUpad = teamLabour.reduce((acc: number, r: any) => acc + Number(r.upad || 0), 0);
    const totalTeamSupplyVal = teamSupplies.reduce((acc: number, r: any) => acc + Number(r.amount || r.totalAmount || 0), 0);

    const teamTabValues = [
      [`TEAM: ${teamName.toUpperCase()} - ATTENDANCE & SUPPLY LEDGER`, '', '', '', '', '', '', '', '', ''],
      ['Site Location', locationName, 'Last Synced (IST)', timestamp, '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', ''],
      ['TEAM METRICS OVERVIEW', '', '', '', '', '', '', '', '', ''],
      ['Total Attendance (Days)', totalDays, 'Total Wages / Gross (₹)', totalWagePaid, '', '', '', '', '', ''],
      ['Total Upad / Advance (₹)', totalUpad, 'Total Material Supplied (₹)', totalTeamSupplyVal, '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', ''],
      ['--- SECTION 1: ATTENDANCE & SALARY RECORDS (હાજરી અને મજૂરી વિગત) ---', '', '', '', '', '', '', '', '', ''],
      ['Date', 'Worker / Mason Name', 'Attendance Type', 'Days / Qty', 'Daily Rate (₹)', 'Gross Salary (₹)', 'Upad (₹)', 'Payment Method', 'Ref No', 'Notes / Remarks']
    ];

    if (teamLabour.length === 0) {
      teamTabValues.push(['No attendance records logged for this team yet.', '', '', '', '', '', '', '', '', '']);
    } else {
      teamLabour.forEach((l: any) => {
        teamTabValues.push([
          l.date || '',
          l.labourName || teamName,
          l.attendanceType || 'Day Wise',
          l.days || (l.workQuantity || '1'),
          l.dailyRate || (l.workRate || 0),
          l.grossSalary || l.paymentAmount || 0,
          l.upad || 0,
          l.paymentMethod || 'Cash',
          l.referenceNumber || l.tcNumber || '',
          l.notes || l.workType || ''
        ]);
      });
    }

    teamTabValues.push(['', '', '', '', '', '', '', '', '', '']);
    teamTabValues.push(['--- SECTION 2: MATERIAL SUPPLIED TO THIS TEAM (આ ટીમને આપેલ સામાનનો રેકોર્ડ) ---', '', '', '', '', '', '', '', '', '']);
    teamTabValues.push(['Date', 'Material Name', 'Quantity', 'Unit', 'Rate (₹)', 'Total Amount (₹)', 'Work Description / Usage', '', '', '']);

    if (teamSupplies.length === 0) {
      teamTabValues.push(['No materials supplied to this team yet.', '', '', '', '', '', '', '', '', '']);
    } else {
      teamSupplies.forEach((s: any) => {
        teamTabValues.push([
          s.date || '',
          s.materialName || '',
          s.quantity || 0,
          s.unit || 'Nos',
          s.rate || 0,
          s.amount || s.totalAmount || 0,
          s.workDescription || s.notes || '',
          '', '', ''
        ]);
      });
    }

    batchData.push({
      range: `'${tabTitle}'!A1:Z1000`,
      values: teamTabValues
    });
  });

  // Clear stale data first
  try {
    const clearRanges = requiredTabs.map(t => `'${t}'!A1:Z1000`);
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ranges: clearRanges })
    });
  } catch (e) {
    console.warn('Location batch clear warning:', e);
  }

  // Update sheet values
  const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: batchData
    })
  });

  if (!updateRes.ok) {
    const err = await updateRes.json();
    throw new Error(err?.error?.message || `Failed to update Google Sheet for ${locationName}`);
  }

  return {
    locationId,
    locationName,
    spreadsheetId,
    spreadsheetUrl: getSpreadsheetUrl(spreadsheetId),
    investorsCount: (Array.isArray(allocations) ? allocations : []).length,
    siteSuppliesCount: locSiteSupplies.length,
    teamsCount: teamNamesList.length,
    attendanceCount: (Array.isArray(labourRecords) ? labourRecords : []).length,
    expensesCount: (Array.isArray(expenses) ? expenses : []).length,
    syncedAt: timestamp
  };
}

/**
 * Syncs BOTH Central Spreadsheet AND ALL Location Spreadsheets in a single flow.
 */
export async function syncAllGoogleSheets(accessToken: string): Promise<AllSyncResults> {
  // 1. Sync Central Sheet
  const centralRes = await syncCentralDataToGoogleSheets(accessToken);

  // 2. Fetch all locations and sync each location's dedicated spreadsheet
  const locations = await apiFetch('/locations').catch(() => []);
  const locResults: LocationSheetStats[] = [];

  if (Array.isArray(locations)) {
    for (const loc of locations) {
      if (loc.id) {
        try {
          const locStat = await syncLocationDataToGoogleSheets(accessToken, loc.id);
          locResults.push(locStat);
        } catch (e) {
          console.warn(`Error syncing location sheet for ${loc.name}:`, e);
        }
      }
    }
  }

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  return {
    central: centralRes,
    locations: locResults,
    syncedAt: timestamp
  };
}
