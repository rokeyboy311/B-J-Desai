/**
 * B-J DESAI ACCOUNTING - GOOGLE DRIVE AUTOMATIC BACKUP & RESTORE ENGINE
 */

function getOrCreateBackupFolders() {
  var rootName = CONFIG.BACKUP_FOLDER_NAME;
  var rootFolders = DriveApp.getFoldersByName(rootName);
  var rootFolder;

  if (rootFolders.hasNext()) {
    rootFolder = rootFolders.next();
  } else {
    rootFolder = DriveApp.createFolder(rootName);
  }

  var getSubfolder = function(name) {
    var subs = rootFolder.getFoldersByName(name);
    if (subs.hasNext()) return subs.next();
    return rootFolder.createFolder(name);
  };

  return {
    root: rootFolder,
    daily: getSubfolder("Daily"),
    weekly: getSubfolder("Weekly"),
    monthly: getSubfolder("Monthly")
  };
}

function backupDatabase(frequencyType) {
  var freq = frequencyType || "Daily";
  var folders = getOrCreateBackupFolders();
  var targetFolder = folders.daily;
  if (freq === "Weekly") targetFolder = folders.weekly;
  if (freq === "Monthly") targetFolder = folders.monthly;

  var dateStr = new Date().toISOString().split("T")[0];
  var timestamp = new Date().toISOString();

  var dbExport = {
    metadata: {
      appName: "B-J Desai Accounting",
      backupVersion: "1.0.0",
      appVersion: APP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      createdAt: timestamp,
      frequency: freq
    },
    settings: fetchTableRecords(CONFIG.SHEETS.SETTINGS, false),
    users: fetchTableRecords(CONFIG.SHEETS.USERS, false),
    investors: fetchTableRecords(CONFIG.SHEETS.INVESTORS, false),
    locations: fetchTableRecords(CONFIG.SHEETS.LOCATIONS, false),
    adminCapital: fetchTableRecords(CONFIG.SHEETS.ADMIN_CAPITAL, false),
    investorCapital: fetchTableRecords(CONFIG.SHEETS.INVESTOR_CAPITAL, false),
    investmentCapital: fetchTableRecords(CONFIG.SHEETS.INVESTMENT_CAPITAL, false),
    capitalTransactions: fetchTableRecords(CONFIG.SHEETS.CAPITAL_TRANSACTIONS, false),
    materialPurchases: fetchTableRecords(CONFIG.SHEETS.MATERIAL_PURCHASES, false),
    materialStock: fetchTableRecords(CONFIG.SHEETS.MATERIAL_STOCK, false),
    customerSupply: fetchTableRecords(CONFIG.SHEETS.CUSTOMER_SUPPLY, false),
    siteSupply: fetchTableRecords(CONFIG.SHEETS.SITE_SUPPLY, false),
    labourAttendance: fetchTableRecords(CONFIG.SHEETS.LABOUR_ATTENDANCE, false),
    contractorCost: fetchTableRecords(CONFIG.SHEETS.CONTRACTOR_COST, false),
    supervisorCost: fetchTableRecords(CONFIG.SHEETS.SUPERVISOR_COST, false),
    transactions: fetchTableRecords(CONFIG.SHEETS.TRANSACTIONS, false),
    auditLog: fetchTableRecords(CONFIG.SHEETS.AUDIT_LOG, false)
  };

  var jsonFileName = "BJ-Desai-Backup-" + dateStr + ".json";
  var jsonFile = targetFolder.createFile(jsonFileName, JSON.stringify(dbExport, null, 2), MimeType.PLAIN_TEXT);

  recordAuditLog("BACKUP_DATABASE", "BACKUP", jsonFile.getId(), 0, null, { fileUrl: jsonFile.getUrl(), fileName: jsonFileName }, "SUCCESS", "BACKUP-" + dateStr);

  return {
    success: true,
    fileId: jsonFile.getId(),
    fileUrl: jsonFile.getUrl(),
    fileName: jsonFileName,
    folderName: freq,
    timestamp: timestamp,
    message: "Full database backup saved to Google Drive successfully!"
  };
}

function restoreDatabaseFromBackup(backupJsonData, adminPin) {
  var auth = verifySecurityPin(adminPin);
  if (!auth.success) {
    throw new Error("Invalid security PIN. Restore access denied.");
  }

  if (!backupJsonData || typeof backupJsonData !== "object" || !backupJsonData.metadata) {
    throw new Error("Invalid backup file payload structure.");
  }

  // Safety backup before restore!
  backupDatabase("PreRestore_Safety");

  var ss = getDbSpreadsheet();

  var restoreSheet = function(sheetName, records) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    if (!records || records.length === 0) return;

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    sheet.clearContents();
    sheet.appendRow(headers);

    for (var i = 0; i < records.length; i++) {
      var row = [];
      for (var h = 0; h < headers.length; h++) {
        var val = records[i][headers[h]];
        if (val === undefined || val === null) val = "";
        row.push(val);
      }
      sheet.appendRow(row);
    }
  };

  if (backupJsonData.settings) restoreSheet(CONFIG.SHEETS.SETTINGS, backupJsonData.settings);
  if (backupJsonData.investors) restoreSheet(CONFIG.SHEETS.INVESTORS, backupJsonData.investors);
  if (backupJsonData.locations) restoreSheet(CONFIG.SHEETS.LOCATIONS, backupJsonData.locations);
  if (backupJsonData.adminCapital) restoreSheet(CONFIG.SHEETS.ADMIN_CAPITAL, backupJsonData.adminCapital);
  if (backupJsonData.investorCapital) restoreSheet(CONFIG.SHEETS.INVESTOR_CAPITAL, backupJsonData.investorCapital);
  if (backupJsonData.investmentCapital) restoreSheet(CONFIG.SHEETS.INVESTMENT_CAPITAL, backupJsonData.investmentCapital);
  if (backupJsonData.capitalTransactions) restoreSheet(CONFIG.SHEETS.CAPITAL_TRANSACTIONS, backupJsonData.capitalTransactions);
  if (backupJsonData.materialPurchases) restoreSheet(CONFIG.SHEETS.MATERIAL_PURCHASES, backupJsonData.materialPurchases);
  if (backupJsonData.materialStock) restoreSheet(CONFIG.SHEETS.MATERIAL_STOCK, backupJsonData.materialStock);
  if (backupJsonData.customerSupply) restoreSheet(CONFIG.SHEETS.CUSTOMER_SUPPLY, backupJsonData.customerSupply);
  if (backupJsonData.siteSupply) restoreSheet(CONFIG.SHEETS.SITE_SUPPLY, backupJsonData.siteSupply);
  if (backupJsonData.labourAttendance) restoreSheet(CONFIG.SHEETS.LABOUR_ATTENDANCE, backupJsonData.labourAttendance);
  if (backupJsonData.contractorCost) restoreSheet(CONFIG.SHEETS.CONTRACTOR_COST, backupJsonData.contractorCost);
  if (backupJsonData.supervisorCost) restoreSheet(CONFIG.SHEETS.SUPERVISOR_COST, backupJsonData.supervisorCost);

  recordAuditLog("RESTORE_DATABASE", "RESTORE", "ALL", 0, null, "Database Restored", "SUCCESS", "RESTORE-" + new Date().getTime());

  return { success: true, message: "Database restored successfully from backup!" };
}
