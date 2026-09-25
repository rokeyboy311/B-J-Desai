/**
 * B-J DESAI ACCOUNTING - CUSTOMER & SITE SUPPLY ENGINE
 */

function createCustomerSupply(payload, requestId) {
  if (isDuplicateRequest(requestId)) {
    return { success: true, duplicate: true, message: "Request already processed." };
  }

  var partyName = validateRequiredField(payload.partyName, "Customer Name");
  var materialName = validateRequiredField(payload.materialName, "Material Name");
  var quantity = validatePositiveAmount(payload.quantity, "Quantity");
  var rate = parseNumber(payload.rate, 0);
  var locationId = validateRequiredField(payload.locationId, "Location ID");

  var subtotal = quantity * rate;
  var transportCost = parseNumber(payload.transportCost, 0);
  var discount = parseNumber(payload.discount, 0);
  var taxPercentage = parseNumber(payload.taxPercentage, 0);
  var tax = ((subtotal - discount) * taxPercentage) / 100;
  var totalAmount = subtotal + transportCost + tax - discount;

  var supplyRecord = {
    id: generateUniqueId("SUP_C"),
    date: payload.date || new Date().toISOString().split("T")[0],
    partyName: partyName,
    materialName: materialName,
    quantity: quantity,
    unit: payload.unit || "BRASS",
    rate: rate,
    subtotal: subtotal,
    transportCost: transportCost,
    discount: discount,
    taxPercentage: taxPercentage,
    tax: tax,
    totalAmount: totalAmount,
    paidAmount: parseNumber(payload.paidAmount, 0),
    outstandingAmount: totalAmount - parseNumber(payload.paidAmount, 0),
    paymentStatus: payload.paymentStatus || "UNPAID",
    paymentMethod: payload.paymentMethod || "Bank Transfer",
    referenceNumber: payload.referenceNumber || "",
    invoiceNumber: payload.invoiceNumber || "",
    address: payload.address || "",
    notes: payload.notes || "",
    locationId: locationId,
    createdAt: new Date().toISOString(),
    isDeleted: 0
  };

  insertRowObject(CONFIG.SHEETS.CUSTOMER_SUPPLY, supplyRecord);
  recalculateStockLedger(materialName);

  recordAuditLog("CREATE_CUSTOMER_SUPPLY", "CUSTOMER_SUPPLY", supplyRecord.id, totalAmount, null, supplyRecord, "SUCCESS", requestId, payload.userId, locationId);

  return { success: true, data: supplyRecord, message: "Customer supply recorded successfully." };
}

function createSiteSupply(payload, requestId) {
  if (isDuplicateRequest(requestId)) {
    return { success: true, duplicate: true, message: "Request already processed." };
  }

  var materialName = validateRequiredField(payload.materialName, "Material Name");
  var quantity = validatePositiveAmount(payload.quantity, "Quantity");
  var rate = parseNumber(payload.rate, 0);
  var locationId = validateRequiredField(payload.locationId, "Location ID");
  var amount = quantity * rate;

  var siteRecord = {
    id: generateUniqueId("SUP_S"),
    date: payload.date || new Date().toISOString().split("T")[0],
    locationId: locationId,
    teamId: payload.teamId || "",
    teamName: payload.teamName || "General Site Team",
    materialName: materialName,
    quantity: quantity,
    unit: payload.unit || "BRASS",
    rate: rate,
    amount: amount,
    responsiblePerson: payload.responsiblePerson || "",
    workDescription: payload.workDescription || "",
    referenceNumber: payload.referenceNumber || "",
    notes: payload.notes || "",
    createdAt: new Date().toISOString(),
    isDeleted: 0
  };

  insertRowObject(CONFIG.SHEETS.SITE_SUPPLY, siteRecord);
  recalculateStockLedger(materialName);

  recordAuditLog("CREATE_SITE_SUPPLY", "SITE_SUPPLY", siteRecord.id, amount, null, siteRecord, "SUCCESS", requestId, payload.userId, locationId);

  return { success: true, data: siteRecord, message: "Site supply recorded successfully." };
}
