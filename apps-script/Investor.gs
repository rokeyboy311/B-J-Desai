/**
 * B-J DESAI ACCOUNTING - INVESTOR MANAGEMENT ENGINE
 */

function getAllInvestors() {
  var investors = fetchTableRecords(CONFIG.SHEETS.INVESTORS);
  var adminTxs = fetchTableRecords(CONFIG.SHEETS.ADMIN_CAPITAL);
  var allocations = fetchTableRecords(CONFIG.SHEETS.INVESTOR_CAPITAL);
  var investments = fetchTableRecords(CONFIG.SHEETS.INVESTMENT_CAPITAL);

  return investors.map(function(inv) {
    var totalCapital = 0;
    var totalUpad = 0;

    for (var a = 0; a < adminTxs.length; a++) {
      if (String(adminTxs[a].investorId) === String(inv.id)) {
        var amt = parseNumber(adminTxs[a].amount, 0);
        var type = String(adminTxs[a].type || "CONTRIBUTION").toUpperCase();
        if (type === "CONTRIBUTION" || type === "CAPITAL") {
          totalCapital += amt;
        } else if (type === "UPAD" || type === "WITHDRAWAL") {
          totalUpad += amt;
        }
      }
    }

    var totalAllocated = 0;
    for (var b = 0; b < allocations.length; b++) {
      if (String(allocations[b].investorId) === String(inv.id)) {
        totalAllocated += parseNumber(allocations[b].amount, 0);
      }
    }

    var totalInvested = 0;
    for (var c = 0; c < investments.length; c++) {
      if (String(investments[c].investorId) === String(inv.id)) {
        totalInvested += parseNumber(investments[c].amount, 0);
      }
    }

    return {
      id: inv.id,
      name: inv.name,
      mobile: inv.mobile || "",
      email: inv.email || "",
      address: inv.address || "",
      notes: inv.notes || "",
      totalCapital: totalCapital,
      totalUpad: totalUpad,
      totalAllocated: totalAllocated,
      totalInvested: totalInvested,
      availableCapital: totalCapital - totalAllocated - totalUpad,
      createdAt: inv.createdAt
    };
  });
}

function createInvestor(payload, requestId) {
  var name = validateRequiredField(payload.name, "Investor Name");
  
  var newInv = {
    id: generateUniqueId("INV_M"),
    name: name,
    mobile: payload.mobile || "",
    email: payload.email || "",
    address: payload.address || "",
    notes: payload.notes || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDeleted: 0
  };

  insertRowObject(CONFIG.SHEETS.INVESTORS, newInv);

  // If initial capital contribution is specified
  if (payload.totalCapital && parseNumber(payload.totalCapital, 0) > 0) {
    var capitalAmt = parseNumber(payload.totalCapital, 0);
    var adminRec = {
      id: generateUniqueId("ADM"),
      investorId: newInv.id,
      type: "CONTRIBUTION",
      amount: capitalAmt,
      date: payload.date || new Date().toISOString().split("T")[0],
      paymentMethod: payload.paymentMethod || "Bank Transfer",
      referenceNumber: payload.referenceNumber || "",
      description: "Initial Investor Capital Contribution",
      createdAt: new Date().toISOString(),
      isDeleted: 0
    };
    insertRowObject(CONFIG.SHEETS.ADMIN_CAPITAL, adminRec);
  }

  recordAuditLog("CREATE_INVESTOR", "INVESTOR", newInv.id, payload.totalCapital || 0, null, newInv, "SUCCESS", requestId);

  return { success: true, data: newInv, message: "Investor registered successfully!" };
}

function getInvestorPassbook(investorId) {
  var invs = fetchTableRecords(CONFIG.SHEETS.INVESTORS);
  var investor = null;
  for (var i = 0; i < invs.length; i++) {
    if (String(invs[i].id) === String(investorId)) {
      investor = invs[i];
      break;
    }
  }
  if (!investor) throw new Error("Investor not found.");

  var adminTxs = fetchTableRecords(CONFIG.SHEETS.ADMIN_CAPITAL);
  var allocations = fetchTableRecords(CONFIG.SHEETS.INVESTOR_CAPITAL);
  var investments = fetchTableRecords(CONFIG.SHEETS.INVESTMENT_CAPITAL);
  var locations = fetchTableRecords(CONFIG.SHEETS.LOCATIONS);

  var getLocName = function(locId) {
    for (var l = 0; l < locations.length; l++) {
      if (String(locations[l].id) === String(locId)) return locations[l].name;
    }
    return "Site #" + locId;
  };

  var passbook = [];

  for (var a = 0; a < adminTxs.length; a++) {
    if (String(adminTxs[a].investorId) === String(investorId)) {
      passbook.push({
        id: adminTxs[a].id,
        date: adminTxs[a].date,
        type: adminTxs[a].type || "CONTRIBUTION",
        category: "ADMIN_CAPITAL",
        amount: parseNumber(adminTxs[a].amount, 0),
        description: adminTxs[a].description || "Admin Capital Contribution",
        paymentMethod: adminTxs[a].paymentMethod,
        referenceNumber: adminTxs[a].referenceNumber
      });
    }
  }

  for (var b = 0; b < allocations.length; b++) {
    if (String(allocations[b].investorId) === String(investorId)) {
      passbook.push({
        id: allocations[b].id,
        date: allocations[b].date,
        type: "ALLOCATION",
        category: "INVESTOR_CAPITAL",
        amount: parseNumber(allocations[b].amount, 0),
        locationName: getLocName(allocations[b].locationId),
        description: "Allocated to " + getLocName(allocations[b].locationId),
        paymentMethod: allocations[b].paymentMethod,
        referenceNumber: allocations[b].referenceNumber
      });
    }
  }

  for (var c = 0; c < investments.length; c++) {
    if (String(investments[c].investorId) === String(investorId)) {
      passbook.push({
        id: investments[c].id,
        date: investments[c].date,
        type: "INVESTMENT",
        category: "INVESTMENT_CAPITAL",
        amount: parseNumber(investments[c].amount, 0),
        locationName: getLocName(investments[c].locationId),
        description: "Site Investment at " + getLocName(investments[c].locationId),
        paymentMethod: investments[c].paymentMethod,
        referenceNumber: investments[c].referenceNumber
      });
    }
  }

  passbook.sort(function(x, y) {
    return new Date(y.date) - new Date(x.date);
  });

  return { investor: investor, transactions: passbook };
}
