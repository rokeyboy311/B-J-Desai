/**
 * B-J DESAI ACCOUNTING - LOCATION MANAGEMENT ENGINE
 */

function getAllLocations() {
  var locs = fetchTableRecords(CONFIG.SHEETS.LOCATIONS);
  var investments = fetchTableRecords(CONFIG.SHEETS.INVESTMENT_CAPITAL);
  var purchases = fetchTableRecords(CONFIG.SHEETS.MATERIAL_PURCHASES);
  var siteSupplies = fetchTableRecords(CONFIG.SHEETS.SITE_SUPPLY);
  var labourAtt = fetchTableRecords(CONFIG.SHEETS.LABOUR_ATTENDANCE);
  var contractors = fetchTableRecords(CONFIG.SHEETS.CONTRACTOR_COST);
  var supervisors = fetchTableRecords(CONFIG.SHEETS.SUPERVISOR_COST);

  return locs.map(function(loc) {
    var totalInvestment = 0;
    for (var i = 0; i < investments.length; i++) {
      if (String(investments[i].locationId) === String(loc.id)) {
        totalInvestment += parseNumber(investments[i].amount, 0);
      }
    }

    var totalPurchases = 0;
    for (var p = 0; p < purchases.length; p++) {
      if (String(purchases[p].locationId) === String(loc.id)) {
        totalPurchases += parseNumber(purchases[p].totalAmount, 0);
      }
    }

    var totalSiteSupply = 0;
    for (var s = 0; s < siteSupplies.length; s++) {
      if (String(siteSupplies[s].locationId) === String(loc.id)) {
        totalSiteSupply += parseNumber(siteSupplies[s].amount, 0);
      }
    }

    var totalLabourCost = 0;
    for (var l = 0; l < labourAtt.length; l++) {
      if (String(labourAtt[l].locationId) === String(loc.id)) {
        totalLabourCost += parseNumber(labourAtt[l].netSalary, 0);
      }
    }

    var totalContractorCost = 0;
    for (var c = 0; c < contractors.length; c++) {
      if (String(contractors[c].locationId) === String(loc.id)) {
        totalContractorCost += parseNumber(contractors[c].netAmount, 0);
      }
    }

    var totalSupervisorCost = 0;
    for (var sv = 0; sv < supervisors.length; sv++) {
      if (String(supervisors[sv].locationId) === String(loc.id)) {
        totalSupervisorCost += parseNumber(supervisors[sv].amount, 0);
      }
    }

    var totalExpenses = totalPurchases + totalSiteSupply + totalLabourCost + totalContractorCost + totalSupervisorCost;

    return {
      id: loc.id,
      name: loc.name,
      address: loc.address || "",
      createdAt: loc.createdAt,
      totalInvestment: totalInvestment,
      totalPurchases: totalPurchases,
      totalSiteSupply: totalSiteSupply,
      totalLabourCost: totalLabourCost,
      totalContractorCost: totalContractorCost,
      totalSupervisorCost: totalSupervisorCost,
      totalExpenses: totalExpenses,
      availableBalance: totalInvestment - totalExpenses
    };
  });
}

function createLocation(payload, requestId) {
  var name = validateRequiredField(payload.name, "Location Name");
  
  var newLoc = {
    id: generateUniqueId("LOC"),
    name: name,
    address: payload.address || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDeleted: 0
  };

  insertRowObject(CONFIG.SHEETS.LOCATIONS, newLoc);
  recordAuditLog("CREATE_LOCATION", "LOCATION", newLoc.id, 0, null, newLoc, "SUCCESS", requestId);

  return { success: true, data: newLoc, message: "Location created successfully!" };
}
