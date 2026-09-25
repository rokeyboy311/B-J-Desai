/**
 * B-J DESAI ACCOUNTING - AUDIT LOG ENGINE
 */

function recordAuditLog(action, entityType, entityId, amount, beforeVal, afterVal, status, requestId, userId, locationId) {
  try {
    var auditRecord = {
      auditId: generateUniqueId("AUD"),
      requestId: requestId || "",
      action: action || "MUTATION",
      entityType: entityType || "RECORD",
      entityId: entityId || "",
      userId: userId || "ADMIN",
      locationId: locationId || "",
      amount: amount || 0,
      beforeValue: typeof beforeVal === "object" ? JSON.stringify(beforeVal) : String(beforeVal || ""),
      afterValue: typeof afterVal === "object" ? JSON.stringify(afterVal) : String(afterVal || ""),
      status: status || "SUCCESS",
      timestamp: new Date().toISOString()
    };

    insertRowObject(CONFIG.SHEETS.AUDIT_LOG, auditRecord);
  } catch (err) {
    console.error("Error recording audit log:", err);
  }
}

function getAuditLogs(limit) {
  var logs = fetchTableRecords(CONFIG.SHEETS.AUDIT_LOG, false);
  logs.sort(function(a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
  if (limit) {
    return logs.slice(0, limit);
  }
  return logs;
}
