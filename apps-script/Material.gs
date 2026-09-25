/**
 * B-J DESAI ACCOUNTING - MATERIAL PURCHASE & STOCK ENGINE
 */

function createMaterialPurchase(payload, requestId) {
  if (isDuplicateRequest(requestId)) {
    return { success: true, duplicate: true, message: "Request already processed." };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error("System busy processing another transaction. Please retry.");
  }

  try {
    var partyName = validateRequiredField(payload.partyName, "Supplier/Party Name");
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

    // Validate available Admin Capital
    var adminSummary = getAdminCapitalSummary();
    if (totalAmount > adminSummary.availableAdminCapital) {
      throw new Error("Insufficient Admin Capital for material purchase. Available: ₹" + adminSummary.availableAdminCapital.toFixed(2) + ", Purchase Total: ₹" + totalAmount.toFixed(2));
    }

    var purchaseRecord = {
      id: generateUniqueId("PUR"),
      materialId: payload.materialId || "",
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
      paidAmount: parseNumber(payload.paidAmount, totalAmount),
      outstandingAmount: totalAmount - parseNumber(payload.paidAmount, totalAmount),
      paymentStatus: payload.paymentStatus || "PAID",
      paymentMethod: payload.paymentMethod || "Bank Transfer",
      referenceNumber: payload.referenceNumber || "",
      invoiceNumber: payload.invoiceNumber || "",
      gst: payload.gst || "",
      address: payload.address || "",
      notes: payload.notes || "",
      locationId: locationId,
      createdAt: new Date().toISOString(),
      isDeleted: 0
    };

    insertRowObject(CONFIG.SHEETS.MATERIAL_PURCHASES, purchaseRecord);

    // Update or create Stock entry
    recalculateStockLedger(materialName);

    recordAuditLog(
      "CREATE_MATERIAL_PURCHASE",
      "MATERIAL_PURCHASE",
      purchaseRecord.id,
      totalAmount,
      { availableAdmin: adminSummary.availableAdminCapital },
      { newAvailableAdmin: adminSummary.availableAdminCapital - totalAmount },
      "SUCCESS",
      requestId,
      payload.userId,
      locationId
    );

    return {
      success: true,
      data: purchaseRecord,
      message: "Material purchase successfully recorded & deducted from Admin Capital."
    };

  } finally {
    lock.releaseLock();
  }
}

function getCentralMaterialStock() {
  var stockSheet = fetchTableRecords(CONFIG.SHEETS.MATERIAL_STOCK);
  var purchases = fetchTableRecords(CONFIG.SHEETS.MATERIAL_PURCHASES);
  var customerSupplies = fetchTableRecords(CONFIG.SHEETS.CUSTOMER_SUPPLY);
  var siteSupplies = fetchTableRecords(CONFIG.SHEETS.SITE_SUPPLY);

  var stockMap = {};

  // Process Inward Purchases
  for (var p = 0; p < purchases.length; p++) {
    var name = String(purchases[p].materialName).toUpperCase().trim();
    if (!stockMap[name]) {
      stockMap[name] = {
        materialName: purchases[p].materialName,
        unit: purchases[p].unit || "BRASS",
        purchasedQty: 0,
        suppliedQty: 0,
        totalCost: 0
      };
    }
    var pQty = parseNumber(purchases[p].quantity, 0);
    stockMap[name].purchasedQty += pQty;
    stockMap[name].totalCost += parseNumber(purchases[p].totalAmount, 0);
  }

  // Process Outward Customer Supply
  for (var c = 0; c < customerSupplies.length; c++) {
    var cName = String(customerSupplies[c].materialName).toUpperCase().trim();
    if (stockMap[cName]) {
      stockMap[cName].suppliedQty += parseNumber(customerSupplies[c].quantity, 0);
    }
  }

  // Process Outward Site Supply
  for (var s = 0; s < siteSupplies.length; s++) {
    var sName = String(siteSupplies[s].materialName).toUpperCase().trim();
    if (stockMap[sName]) {
      stockMap[sName].suppliedQty += parseNumber(siteSupplies[s].quantity, 0);
    }
  }

  var result = [];
  for (var k in stockMap) {
    var item = stockMap[k];
    var currentStock = item.purchasedQty - item.suppliedQty;
    var avgRate = item.purchasedQty > 0 ? (item.totalCost / item.purchasedQty) : 0;
    var totalValue = currentStock * avgRate;

    result.push({
      materialName: item.materialName,
      unit: item.unit,
      purchasedQty: item.purchasedQty,
      suppliedQty: item.suppliedQty,
      currentStock: currentStock,
      avgRate: avgRate,
      totalValue: totalValue
    });
  }

  return result;
}

function recalculateStockLedger(materialName) {
  // Triggers recalculation on central material stock table
  var stockList = getCentralMaterialStock();
  var ss = getDbSpreadsheet();
  var stockSheet = ss.getSheetByName(CONFIG.SHEETS.MATERIAL_STOCK);
  if (!stockSheet) return;

  var item = null;
  for (var i = 0; i < stockList.length; i++) {
    if (String(stockList[i].materialName).toUpperCase() === String(materialName).toUpperCase()) {
      item = stockList[i];
      break;
    }
  }

  if (item) {
    var rows = getSheetRows(stockSheet);
    var found = false;
    for (var r = 0; r < rows.length; r++) {
      if (String(rows[r].materialName).toUpperCase() === String(materialName).toUpperCase()) {
        updateRowObject(CONFIG.SHEETS.MATERIAL_STOCK, rows[r].id, {
          purchasedQty: item.purchasedQty,
          suppliedQty: item.suppliedQty,
          currentStock: item.currentStock,
          avgRate: item.avgRate,
          totalValue: item.totalValue,
          updatedAt: new Date().toISOString()
        });
        found = true;
        break;
      }
    }
    if (!found) {
      insertRowObject(CONFIG.SHEETS.MATERIAL_STOCK, {
        id: generateUniqueId("STK"),
        materialName: item.materialName,
        category: "GENERAL",
        unit: item.unit,
        purchasedQty: item.purchasedQty,
        suppliedQty: item.suppliedQty,
        currentStock: item.currentStock,
        avgRate: item.avgRate,
        totalValue: item.totalValue,
        updatedAt: new Date().toISOString()
      });
    }
  }
}
