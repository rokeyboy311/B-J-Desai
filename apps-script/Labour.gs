/**
 * B-J DESAI ACCOUNTING - LABOUR ATTENDANCE & SALARY ENGINE
 */

function createLabourAttendance(payload, requestId) {
  if (isDuplicateRequest(requestId)) {
    return { success: true, duplicate: true, message: "Request already processed." };
  }

  var labourName = validateRequiredField(payload.labourName, "Labour / Worker Name");
  var locationId = validateRequiredField(payload.locationId, "Location ID");

  var days = parseNumber(payload.days, 1);
  var dailyRate = parseNumber(payload.dailyRate, 0);
  var tcQuantity = parseNumber(payload.tcQuantity || payload.quantity, 0);
  var tcRate = parseNumber(payload.tcRate || payload.rate, 0);

  var workEarnings = tcQuantity * tcRate;
  var dailyEarnings = days * dailyRate;
  var grossSalary = workEarnings + dailyEarnings + parseNumber(payload.otherEarnings, 0);

  var deduction = parseNumber(payload.deduction, 0);
  var upad = parseNumber(payload.upad, 0);
  var netSalary = grossSalary - deduction;
  var paymentAmount = parseNumber(payload.paymentAmount, 0);
  var balance = netSalary - upad - paymentAmount;

  var labourRecord = {
    id: generateUniqueId("LAB"),
    locationId: locationId,
    date: payload.date || new Date().toISOString().split("T")[0],
    labourName: labourName,
    labourTeam: payload.labourTeam || payload.teamName || "",
    attendanceType: payload.attendanceType || "PRESENT",
    workType: payload.workType || payload.workDescription || "General Work",
    days: days,
    dailyRate: dailyRate,
    tcQuantity: tcQuantity,
    tcRate: tcRate,
    grossSalary: grossSalary,
    deduction: deduction,
    netSalary: netSalary,
    upad: upad,
    paymentAmount: paymentAmount,
    balance: balance,
    paymentMethod: payload.paymentMethod || "Cash",
    referenceNumber: payload.referenceNumber || payload.tcNumber || "",
    notes: payload.notes || "",
    createdAt: new Date().toISOString(),
    isDeleted: 0
  };

  insertRowObject(CONFIG.SHEETS.LABOUR_ATTENDANCE, labourRecord);

  recordAuditLog("CREATE_LABOUR_ATTENDANCE", "LABOUR_ATTENDANCE", labourRecord.id, netSalary, null, labourRecord, "SUCCESS", requestId, payload.userId, locationId);

  return { success: true, data: labourRecord, message: "Labour attendance & salary recorded successfully." };
}

function getLabourAttendanceByLocation(locationId) {
  var records = fetchTableRecords(CONFIG.SHEETS.LABOUR_ATTENDANCE);
  if (locationId) {
    records = records.filter(function(r) {
      return String(r.locationId) === String(locationId);
    });
  }
  return records;
}
