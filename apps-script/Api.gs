/**
 * B-J DESAI ACCOUNTING - API ROUTER & DISPATCHER
 */

function dispatchApiAction(action, payload, requestId) {
  var act = String(action || "").toUpperCase().trim();

  switch (act) {
    case "INITIALIZE_SHEETS":
    case "SETUP_DATABASE":
      return initializeDatabase();

    case "GET_BOOTSTRAP_DATA":
    case "GET_DATA":
      return {
        adminCapital: getAdminCapitalSummary(),
        locations: getAllLocations(),
        investors: getAllInvestors(),
        materialStock: getCentralMaterialStock(),
        records: getGlobalRecordsData(),
        auditLogs: getAuditLogs(50)
      };

    case "GET_LOCATIONS":
      return getAllLocations();

    case "GET_INVESTORS":
      return getAllInvestors();

    case "GET_INVESTOR_PASSBOOK":
      return getInvestorPassbook(payload.investorId);

    case "GET_CAPITAL_SUMMARY":
      return getAdminCapitalSummary();

    case "GET_MATERIAL_STOCK":
      return getCentralMaterialStock();

    case "GET_GLOBAL_RECORDS":
      return getGlobalRecordsData();

    case "GET_DASHBOARD":
      return getDashboardAnalytics();

    case "GET_LABOUR":
      return getLabourAttendanceByLocation(payload ? payload.locationId : null);

    case "GET_CONTRACTOR_COSTS":
      return getContractorCostsByLocation(payload ? payload.locationId : null);

    case "CREATE_INVESTOR":
      return createInvestor(payload, requestId);

    case "CREATE_LOCATION":
      return createLocation(payload, requestId);

    case "TRANSFER_ADMIN_TO_INVESTOR":
      return transferAdminToInvestor(payload, requestId);

    case "TRANSFER_INVESTOR_TO_INVESTMENT":
      return transferInvestorToInvestment(payload, requestId);

    case "CREATE_MATERIAL_PURCHASE":
      return createMaterialPurchase(payload, requestId);

    case "CREATE_CUSTOMER_SUPPLY":
      return createCustomerSupply(payload, requestId);

    case "CREATE_SITE_SUPPLY":
      return createSiteSupply(payload, requestId);

    case "CREATE_LABOUR_ATTENDANCE":
      return createLabourAttendance(payload, requestId);

    case "CREATE_CONTRACTOR_COST":
      return createContractorCost(payload, requestId);

    case "VERIFY_PIN":
      return verifySecurityPin(payload.pin);

    case "UPDATE_PIN":
      return updateSecurityPin(payload.oldPin, payload.newPin);

    case "BACKUP_DATABASE":
      return backupDatabase(payload ? payload.frequency : "Daily");

    case "RESTORE_DATABASE":
      return restoreDatabaseFromBackup(payload.backupData, payload.adminPin);

    default:
      throw new Error("Unknown action requested: " + action);
  }
}
