/**
 * B-J DESAI ACCOUNTING - REPORTING & DASHBOARD METRICS ENGINE
 */

function getDashboardAnalytics() {
  var capitalSummary = getAdminCapitalSummary();
  var locations = getAllLocations();
  var investors = getAllInvestors();
  var stock = getCentralMaterialStock();

  var totalLocationInvestments = 0;
  var totalLocationExpenses = 0;

  for (var i = 0; i < locations.length; i++) {
    totalLocationInvestments += locations[i].totalInvestment;
    totalLocationExpenses += locations[i].totalExpenses;
  }

  return {
    adminCapital: capitalSummary,
    locationsCount: locations.length,
    investorsCount: investors.length,
    totalLocationInvestments: totalLocationInvestments,
    totalLocationExpenses: totalLocationExpenses,
    overallNetBalance: capitalSummary.availableAdminCapital + (totalLocationInvestments - totalLocationExpenses),
    topLocations: locations.slice(0, 5),
    materialStockSummary: stock
  };
}

function getGlobalRecordsData() {
  var purchases = fetchTableRecords(CONFIG.SHEETS.MATERIAL_PURCHASES);
  var customerSupplies = fetchTableRecords(CONFIG.SHEETS.CUSTOMER_SUPPLY);
  var siteSupplies = fetchTableRecords(CONFIG.SHEETS.SITE_SUPPLY);
  var labourAtt = fetchTableRecords(CONFIG.SHEETS.LABOUR_ATTENDANCE);
  var contractors = fetchTableRecords(CONFIG.SHEETS.CONTRACTOR_COST);
  var capitalTxs = fetchTableRecords(CONFIG.SHEETS.CAPITAL_TRANSACTIONS);

  return {
    materialPurchases: purchases,
    customerSupplies: customerSupplies,
    siteSupplies: siteSupplies,
    labourAttendance: labourAtt,
    contractorCosts: contractors,
    capitalTransactions: capitalTxs
  };
}
