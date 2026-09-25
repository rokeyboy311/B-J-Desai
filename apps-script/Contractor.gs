/**
 * B-J DESAI ACCOUNTING - CONTRACTOR COST ENGINE
 */

function createContractorCost(payload, requestId) {
  if (isDuplicateRequest(requestId)) {
    return { success: true, duplicate: true, message: "Request already processed." };
  }

  var contractorName = validateRequiredField(payload.contractorName, "Contractor Name");
  var locationId = validateRequiredField(payload.locationId, "Location ID");
  var amount = validatePositiveAmount(payload.amount, "Contractor Bill Amount");

  var deductionAmount = parseNumber(payload.deductionAmount, 0);
  var netAmount = amount - deductionAmount;

  var contractorRecord = {
    id: generateUniqueId("CON"),
    locationId: locationId,
    contractorName: contractorName,
    teamName: payload.teamName || "",
    date: payload.date || new Date().toISOString().split("T")[0],
    amount: amount,
    deductionAmount: deductionAmount,
    netAmount: netAmount,
    paymentStatus: payload.paymentStatus || "PAID",
    workDescription: payload.workDescription || payload.workName || "Contract Work",
    paymentMethod: payload.paymentMethod || "Bank Transfer",
    referenceNumber: payload.referenceNumber || "",
    notes: payload.notes || "",
    createdAt: new Date().toISOString(),
    isDeleted: 0
  };

  insertRowObject(CONFIG.SHEETS.CONTRACTOR_COST, contractorRecord);

  recordAuditLog("CREATE_CONTRACTOR_COST", "CONTRACTOR_COST", contractorRecord.id, netAmount, null, contractorRecord, "SUCCESS", requestId, payload.userId, locationId);

  return { success: true, data: contractorRecord, message: "Contractor cost recorded successfully." };
}

function getContractorCostsByLocation(locationId) {
  var records = fetchTableRecords(CONFIG.SHEETS.CONTRACTOR_COST);
  if (locationId) {
    records = records.filter(function(r) {
      return String(r.locationId) === String(locationId);
    });
  }
  return records;
}
