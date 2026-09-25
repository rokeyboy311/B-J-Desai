/**
 * B-J DESAI ACCOUNTING - AUTHENTICATION & PIN LOCK MANAGEMENT
 */

function verifySecurityPin(pin) {
  var settings = fetchTableRecords(CONFIG.SHEETS.SETTINGS, false);
  var storedPin = CONFIG.DEFAULT_SECURITY_PIN;
  
  for (var i = 0; i < settings.length; i++) {
    if (settings[i].key === "CATEGORY_LOCK_PIN") {
      storedPin = String(settings[i].value).trim();
      break;
    }
  }

  if (String(pin).trim() === storedPin) {
    return { success: true, message: "PIN verified successfully." };
  }
  return { success: false, message: "Invalid PIN code." };
}

function updateSecurityPin(oldPin, newPin) {
  var verify = verifySecurityPin(oldPin);
  if (!verify.success) {
    throw new Error("Old PIN code is incorrect.");
  }

  if (!newPin || String(newPin).trim().length < 4) {
    throw new Error("New PIN code must be at least 4 digits.");
  }

  var cleanPin = String(newPin).trim();
  updateRowObject(CONFIG.SHEETS.SETTINGS, "CATEGORY_LOCK_PIN", {
    value: cleanPin,
    updatedAt: new Date().toISOString()
  });

  return { success: true, message: "Security PIN updated successfully." };
}
