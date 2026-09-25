/**
 * B-J DESAI ACCOUNTING - CAPITAL MANAGEMENT ENGINE
 * Enforces atomic financial transfers across 3 capital tiers:
 * 1. Admin Capital
 * 2. Investor Capital (Location-wise)
 * 3. Investment Capital (Location-wise)
 */

function getAdminCapitalSummary() {
  var adminTxs = fetchTableRecords(CONFIG.SHEETS.ADMIN_CAPITAL);
  var allocations = fetchTableRecords(CONFIG.SHEETS.INVESTOR_CAPITAL);
  var purchases = fetchTableRecords(CONFIG.SHEETS.MATERIAL_PURCHASES);

  var totalContributed = 0;
  var totalWithdrawn = 0;

  for (var i = 0; i < adminTxs.length; i++) {
    var amt = parseNumber(adminTxs[i].amount, 0);
    var type = String(adminTxs[i].type || "CONTRIBUTION").toUpperCase();
    if (type === "CONTRIBUTION" || type === "CAPITAL") {
      totalContributed += amt;
    } else if (type === "UPAD" || type === "WITHDRAWAL") {
      totalWithdrawn += amt;
    }
  }

  var totalAllocated = 0;
  for (var j = 0; j < allocations.length; j++) {
    totalAllocated += parseNumber(allocations[j].amount, 0);
  }

  var totalPurchasesCost = 0;
  for (var k = 0; k < purchases.length; k++) {
    totalPurchasesCost += parseNumber(purchases[k].totalAmount, 0);
  }

  var availableAdminCapital = totalContributed - totalAllocated - totalPurchasesCost - totalWithdrawn;

  return {
    totalContributed: totalContributed,
    totalAllocated: totalAllocated,
    totalPurchases: totalPurchasesCost,
    totalWithdrawn: totalWithdrawn,
    availableAdminCapital: availableAdminCapital
  };
}

function getInvestorCapitalBalance(investorId, locationId) {
  var allocations = fetchTableRecords(CONFIG.SHEETS.INVESTOR_CAPITAL);
  var investments = fetchTableRecords(CONFIG.SHEETS.INVESTMENT_CAPITAL);

  var totalAllocated = 0;
  for (var i = 0; i < allocations.length; i++) {
    if (String(allocations[i].investorId) === String(investorId)) {
      if (!locationId || String(allocations[i].locationId) === String(locationId)) {
        totalAllocated += parseNumber(allocations[i].amount, 0);
      }
    }
  }

  var totalInvested = 0;
  for (var j = 0; j < investments.length; j++) {
    if (String(investments[j].investorId) === String(investorId)) {
      if (!locationId || String(investments[j].locationId) === String(locationId)) {
        totalInvested += parseNumber(investments[j].amount, 0);
      }
    }
  }

  return {
    investorId: investorId,
    locationId: locationId || null,
    totalAllocated: totalAllocated,
    totalInvested: totalInvested,
    availableBalance: totalAllocated - totalInvested
  };
}

/**
 * ATOMIC TRANSFER: Admin Capital -> Investor Capital (Location-wise)
 */
function transferAdminToInvestor(payload, requestId) {
  if (isDuplicateRequest(requestId)) {
    return { success: true, duplicate: true, message: "Request already processed." };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // Wait up to 10 seconds for lock
  } catch (e) {
    throw new Error("System is currently processing another financial transaction. Please try again.");
  }

  try {
    var amount = validatePositiveAmount(payload.amount, "Transfer Amount");
    var investorId = validateRequiredField(payload.investorId, "Investor ID");
    var locationId = validateRequiredField(payload.locationId, "Location ID");

    // Server-side balance verification
    var adminSummary = getAdminCapitalSummary();
    if (amount > adminSummary.availableAdminCapital) {
      throw new Error("Insufficient Admin Capital. Available: ₹" + adminSummary.availableAdminCapital.toFixed(2) + ", Requested: ₹" + amount.toFixed(2));
    }

    var allocRecord = {
      id: generateUniqueId("ALC"),
      investorId: investorId,
      locationId: locationId,
      amount: amount,
      date: payload.date || new Date().toISOString().split("T")[0],
      paymentMethod: payload.paymentMethod || "Bank Transfer",
      referenceNumber: payload.referenceNumber || "",
      notes: payload.notes || "Admin Capital Allocation to Location",
      createdAt: new Date().toISOString(),
      isDeleted: 0
    };

    insertRowObject(CONFIG.SHEETS.INVESTOR_CAPITAL, allocRecord);

    var txnRecord = {
      id: generateUniqueId("TXN"),
      transactionId: allocRecord.id,
      action: "TRANSFER_ADMIN_TO_INVESTOR",
      sourceCapital: "ADMIN_CAPITAL",
      destinationCapital: "INVESTOR_CAPITAL",
      investorId: investorId,
      locationId: locationId,
      amount: amount,
      reference: payload.referenceNumber || "",
      createdAt: new Date().toISOString(),
      userId: payload.userId || "ADMIN",
      version: 1
    };

    insertRowObject(CONFIG.SHEETS.CAPITAL_TRANSACTIONS, txnRecord);

    recordAuditLog(
      "TRANSFER_ADMIN_TO_INVESTOR",
      "INVESTOR_CAPITAL",
      allocRecord.id,
      amount,
      { availableAdmin: adminSummary.availableAdminCapital },
      { newAvailableAdmin: adminSummary.availableAdminCapital - amount },
      "SUCCESS",
      requestId,
      payload.userId,
      locationId
    );

    return {
      success: true,
      data: allocRecord,
      message: "Admin Capital successfully transferred to Investor Capital!"
    };

  } finally {
    lock.releaseLock();
  }
}

/**
 * ATOMIC TRANSFER: Investor Capital -> Investment Capital (Location-wise)
 */
function transferInvestorToInvestment(payload, requestId) {
  if (isDuplicateRequest(requestId)) {
    return { success: true, duplicate: true, message: "Request already processed." };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error("System is currently processing another financial transaction. Please try again.");
  }

  try {
    var amount = validatePositiveAmount(payload.amount, "Investment Amount");
    var investorId = validateRequiredField(payload.investorId, "Investor ID");
    var locationId = validateRequiredField(payload.locationId, "Location ID");

    // Server-side balance verification
    var investorBal = getInvestorCapitalBalance(investorId, locationId);
    if (amount > investorBal.availableBalance) {
      throw new Error("Insufficient Investor Capital balance. Available: ₹" + investorBal.availableBalance.toFixed(2) + ", Requested: ₹" + amount.toFixed(2));
    }

    var investRecord = {
      id: generateUniqueId("INV"),
      investorId: investorId,
      locationId: locationId,
      amount: amount,
      date: payload.date || new Date().toISOString().split("T")[0],
      paymentMethod: payload.paymentMethod || "Bank Transfer",
      referenceNumber: payload.referenceNumber || "",
      notes: payload.notes || "Investment from Investor Capital",
      createdAt: new Date().toISOString(),
      isDeleted: 0
    };

    insertRowObject(CONFIG.SHEETS.INVESTMENT_CAPITAL, investRecord);

    var txnRecord = {
      id: generateUniqueId("TXN"),
      transactionId: investRecord.id,
      action: "TRANSFER_INVESTOR_TO_INVESTMENT",
      sourceCapital: "INVESTOR_CAPITAL",
      destinationCapital: "INVESTMENT_CAPITAL",
      investorId: investorId,
      locationId: locationId,
      amount: amount,
      reference: payload.referenceNumber || "",
      createdAt: new Date().toISOString(),
      userId: payload.userId || "ADMIN",
      version: 1
    };

    insertRowObject(CONFIG.SHEETS.CAPITAL_TRANSACTIONS, txnRecord);

    recordAuditLog(
      "TRANSFER_INVESTOR_TO_INVESTMENT",
      "INVESTMENT_CAPITAL",
      investRecord.id,
      amount,
      { availableInvestorCap: investorBal.availableBalance },
      { newAvailableInvestorCap: investorBal.availableBalance - amount },
      "SUCCESS",
      requestId,
      payload.userId,
      locationId
    );

    return {
      success: true,
      data: investRecord,
      message: "Investor Capital successfully transferred to Location Investment!"
    };

  } finally {
    lock.releaseLock();
  }
}
