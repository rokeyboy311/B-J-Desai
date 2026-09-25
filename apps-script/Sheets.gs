/**
 * B-J DESAI ACCOUNTING - GOOGLE SHEETS DATABASE ENGINE
 */

function getDbSpreadsheet() {
  if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID.trim() !== "") {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function ensureSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  if (sheet.getLastRow() === 0 && headers && headers.length > 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f1f5f9");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function initializeDatabase() {
  var ss = getDbSpreadsheet();
  
  ensureSheet(ss, CONFIG.SHEETS.SETTINGS, ["key", "value", "description", "updatedAt"]);
  ensureSheet(ss, CONFIG.SHEETS.USERS, ["id", "uid", "email", "name", "role", "createdAt", "updatedAt", "isDeleted"]);
  ensureSheet(ss, CONFIG.SHEETS.INVESTORS, ["id", "name", "mobile", "email", "address", "notes", "createdAt", "updatedAt", "isDeleted"]);
  ensureSheet(ss, CONFIG.SHEETS.LOCATIONS, ["id", "name", "address", "createdAt", "updatedAt", "isDeleted"]);
  ensureSheet(ss, CONFIG.SHEETS.ADMIN_CAPITAL, ["id", "investorId", "type", "amount", "date", "paymentMethod", "referenceNumber", "description", "createdAt", "isDeleted"]);
  ensureSheet(ss, CONFIG.SHEETS.INVESTOR_CAPITAL, ["id", "investorId", "locationId", "amount", "date", "paymentMethod", "referenceNumber", "notes", "createdAt", "isDeleted"]);
  ensureSheet(ss, CONFIG.SHEETS.INVESTMENT_CAPITAL, ["id", "investorId", "locationId", "amount", "date", "paymentMethod", "referenceNumber", "notes", "createdAt", "isDeleted"]);
  ensureSheet(ss, CONFIG.SHEETS.CAPITAL_TRANSACTIONS, ["id", "transactionId", "action", "sourceCapital", "destinationCapital", "investorId", "locationId", "amount", "reference", "createdAt", "userId", "version"]);
  ensureSheet(ss, CONFIG.SHEETS.MATERIAL_PURCHASES, ["id", "materialId", "date", "partyName", "materialName", "quantity", "unit", "rate", "subtotal", "transportCost", "discount", "taxPercentage", "tax", "totalAmount", "paidAmount", "outstandingAmount", "paymentStatus", "paymentMethod", "referenceNumber", "invoiceNumber", "gst", "address", "notes", "locationId", "createdAt", "isDeleted"]);
  ensureSheet(ss, CONFIG.SHEETS.MATERIAL_STOCK, ["id", "materialName", "category", "unit", "purchasedQty", "suppliedQty", "currentStock", "avgRate", "totalValue", "updatedAt"]);
  ensureSheet(ss, CONFIG.SHEETS.CUSTOMER_SUPPLY, ["id", "date", "partyName", "materialName", "quantity", "unit", "rate", "subtotal", "transportCost", "discount", "taxPercentage", "tax", "totalAmount", "paidAmount", "outstandingAmount", "paymentStatus", "paymentMethod", "referenceNumber", "invoiceNumber", "address", "notes", "locationId", "createdAt", "isDeleted"]);
  ensureSheet(ss, CONFIG.SHEETS.SITE_SUPPLY, ["id", "date", "locationId", "teamId", "teamName", "materialName", "quantity", "unit", "rate", "amount", "responsiblePerson", "workDescription", "referenceNumber", "notes", "createdAt", "isDeleted"]);
  ensureSheet(ss, CONFIG.SHEETS.LABOUR_ATTENDANCE, ["id", "locationId", "date", "labourName", "labourTeam", "attendanceType", "workType", "days", "dailyRate", "tcQuantity", "tcRate", "grossSalary", "deduction", "netSalary", "upad", "paymentAmount", "balance", "paymentMethod", "referenceNumber", "notes", "createdAt", "isDeleted"]);
  ensureSheet(ss, CONFIG.SHEETS.CONTRACTOR_COST, ["id", "locationId", "contractorName", "teamName", "date", "amount", "deductionAmount", "netAmount", "paymentStatus", "workDescription", "paymentMethod", "referenceNumber", "notes", "createdAt", "isDeleted"]);
  ensureSheet(ss, CONFIG.SHEETS.SUPERVISOR_COST, ["id", "locationId", "date", "supervisorName", "amount", "description", "paymentMethod", "referenceNumber", "createdAt", "isDeleted"]);
  ensureSheet(ss, CONFIG.SHEETS.TRANSACTIONS, ["id", "locationId", "type", "amount", "date", "partyName", "teamName", "description", "category", "paymentMethod", "referenceNumber", "notes", "createdAt", "isDeleted"]);
  ensureSheet(ss, CONFIG.SHEETS.AUDIT_LOG, ["auditId", "requestId", "action", "entityType", "entityId", "userId", "locationId", "amount", "beforeValue", "afterValue", "status", "timestamp"]);
  ensureSheet(ss, CONFIG.SHEETS.SYNC_META, ["key", "value", "updatedAt"]);

  // Set default PIN if missing
  var settingsSheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
  var data = getSheetRows(settingsSheet);
  var pinExists = false;
  for (var i = 0; i < data.length; i++) {
    if (data[i].key === "CATEGORY_LOCK_PIN") {
      pinExists = true;
      break;
    }
  }
  if (!pinExists) {
    settingsSheet.appendRow(["CATEGORY_LOCK_PIN", CONFIG.DEFAULT_SECURITY_PIN, "Category Security PIN Lock", new Date().toISOString()]);
  }

  return { success: true, message: "Google Sheets database structure initialized successfully." };
}

function generateUniqueId(prefix) {
  var p = prefix || "REC";
  var timePart = new Date().getTime().toString(36).toUpperCase();
  var randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return p + "-" + timePart + "-" + randomPart;
}

function getSheetRows(sheet) {
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var result = [];
  for (var r = 0; r < values.length; r++) {
    var rowObj = {};
    for (var c = 0; c < headers.length; c++) {
      rowObj[headers[c]] = values[r][c];
    }
    result.push(rowObj);
  }
  return result;
}

function fetchTableRecords(sheetName, filterActiveOnly) {
  var ss = getDbSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var rows = getSheetRows(sheet);
  if (filterActiveOnly !== false) {
    rows = rows.filter(function(r) {
      return String(r.isDeleted) !== "1" && String(r.isDeleted) !== "true";
    });
  }
  return rows;
}

function insertRowObject(sheetName, recordObj) {
  var ss = getDbSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet not found: " + sheetName);

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    var key = headers[i];
    var val = recordObj[key];
    if (val === undefined || val === null) val = "";
    row.push(val);
  }
  sheet.appendRow(row);
  return recordObj;
}

function updateRowObject(sheetName, id, updateObj) {
  var ss = getDbSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet not found: " + sheetName);

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idColIdx = headers.indexOf("id");
  if (idColIdx === -1) idColIdx = headers.indexOf("auditId");
  if (idColIdx === -1) idColIdx = 0;

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;

  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (var r = 0; r < values.length; r++) {
    if (String(values[r][idColIdx]) === String(id)) {
      var rowIndex = r + 2;
      for (var key in updateObj) {
        var colIdx = headers.indexOf(key);
        if (colIdx !== -1) {
          sheet.getRange(rowIndex, colIdx + 1).setValue(updateObj[key]);
        }
      }
      return true;
    }
  }
  return false;
}

function softDeleteRow(sheetName, id) {
  return updateRowObject(sheetName, id, { isDeleted: 1, updatedAt: new Date().toISOString() });
}
