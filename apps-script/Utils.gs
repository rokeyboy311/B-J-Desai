/**
 * B-J DESAI ACCOUNTING - UTILITY & RESPONSE HELPERS
 */

function responseSuccess(data, requestId, message) {
  var res = {
    success: true,
    requestId: requestId || ("REQ-" + new Date().getTime()),
    data: data || {},
    message: message || "Operation completed successfully",
    error: null,
    timestamp: new Date().toISOString(),
    version: APP_VERSION
  };
  return ContentService.createTextOutput(JSON.stringify(res))
    .setMimeType(ContentService.MimeType.JSON);
}

function responseError(code, message, requestId, status) {
  var res = {
    success: false,
    requestId: requestId || ("REQ-" + new Date().getTime()),
    data: null,
    error: {
      code: code || "UNKNOWN_ERROR",
      message: message || "An unexpected error occurred",
      status: status || 400
    },
    timestamp: new Date().toISOString(),
    version: APP_VERSION
  };
  return ContentService.createTextOutput(JSON.stringify(res))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseJsonPayload(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
      console.warn("Failed to parse JSON post body:", err);
    }
  }
  if (e.parameter) {
    var p = e.parameter;
    if (p.payload) {
      try {
        return JSON.parse(p.payload);
      } catch (err2) {}
    }
    return p;
  }
  return {};
}

function sanitizeString(str) {
  if (str === null || str === undefined) return "";
  return String(str).trim();
}

function parseNumber(val, defaultVal) {
  var num = parseFloat(val);
  return isNaN(num) ? (defaultVal || 0) : num;
}
