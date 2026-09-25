/**
 * B-J DESAI ACCOUNTING - SERVER-SIDE VALIDATION & DUP PROTECTION
 */

function isDuplicateRequest(requestId) {
  if (!requestId) return false;
  
  var ss = getDbSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.AUDIT_LOG);
  if (!sheet) return false;
  
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var reqColIdx = headers.indexOf("requestId");
  if (reqColIdx === -1) return false;

  // Search last 200 records
  var startRow = Math.max(2, lastRow - 200);
  var numRows = lastRow - startRow + 1;
  var values = sheet.getRange(startRow, reqColIdx + 1, numRows, 1).getValues();

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(requestId)) {
      return true;
    }
  }
  return false;
}

function validatePositiveAmount(amount, fieldName) {
  var num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    throw new Error((fieldName || "Amount") + " must be a positive number greater than 0.");
  }
  return num;
}

function validateRequiredField(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error((fieldName || "Field") + " is required.");
  }
  return String(value).trim();
}
