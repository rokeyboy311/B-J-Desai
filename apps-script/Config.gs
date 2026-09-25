/**
 * B-J DESAI ACCOUNTING APPLICATION - GOOGLE APPS SCRIPT BACKEND CONFIGURATION
 * Version: 1.0.0
 * Schema Version: 1
 * API Version: v1
 */

var APP_VERSION = "1.0.0";
var SCHEMA_VERSION = 1;
var API_VERSION = "v1";

var CONFIG = {
  // If blank, Script will use SpreadsheetApp.getActiveSpreadsheet()
  SPREADSHEET_ID: "", 
  BACKUP_FOLDER_NAME: "B-J DESAI BACKUPS",
  DEFAULT_SECURITY_PIN: "190190",
  
  SHEETS: {
    SETTINGS: "Settings",
    USERS: "Users",
    INVESTORS: "Investors",
    LOCATIONS: "Locations",
    ADMIN_CAPITAL: "AdminCapital",
    INVESTOR_CAPITAL: "InvestorCapital",
    INVESTMENT_CAPITAL: "InvestmentCapital",
    CAPITAL_TRANSACTIONS: "CapitalTransactions",
    MATERIAL_PURCHASES: "MaterialPurchases",
    MATERIAL_STOCK: "MaterialStock",
    CUSTOMER_SUPPLY: "CustomerSupply",
    SITE_SUPPLY: "SiteSupply",
    LABOUR_ATTENDANCE: "LabourAttendance",
    CONTRACTOR_COST: "ContractorCost",
    SUPERVISOR_COST: "SupervisorCost",
    TRANSACTIONS: "Transactions",
    AUDIT_LOG: "AuditLog",
    SYNC_META: "SyncMeta"
  }
};
