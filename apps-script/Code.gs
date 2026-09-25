/**
 * B-J DESAI ACCOUNTING APPLICATION - GOOGLE APPS SCRIPT WEB APP ENTRY POINT
 */

function doGet(e) {
  try {
    var payload = parseJsonPayload(e);
    var action = e.parameter.action || payload.action || "GET_BOOTSTRAP_DATA";
    var requestId = e.parameter.requestId || payload.requestId || ("REQ-" + new Date().getTime());

    var result = dispatchApiAction(action, payload, requestId);
    return responseSuccess(result, requestId, "Success");
  } catch (err) {
    return responseError("API_ERROR", err.message || String(err), e ? e.parameter.requestId : null, 400);
  }
}

function doPost(e) {
  try {
    var payload = parseJsonPayload(e);
    var action = payload.action || (e.parameter ? e.parameter.action : "UNKNOWN");
    var requestId = payload.requestId || (e.parameter ? e.parameter.requestId : ("REQ-" + new Date().getTime()));

    var result = dispatchApiAction(action, payload.payload || payload, requestId);
    return responseSuccess(result, requestId, "Operation completed successfully");
  } catch (err) {
    return responseError("API_ERROR", err.message || String(err), null, 400);
  }
}

/**
 * Triggers full spreadsheet initialization from Apps Script Editor
 */
function setupDatabaseTables() {
  var res = initializeDatabase();
  Logger.log(JSON.stringify(res));
}

/**
 * Scheduled trigger function for Daily backups
 */
function scheduledDailyBackup() {
  var res = backupDatabase("Daily");
  Logger.log("Daily backup complete: " + JSON.stringify(res));
}
