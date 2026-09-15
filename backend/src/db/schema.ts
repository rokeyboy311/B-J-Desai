import { relations } from 'drizzle-orm';
import { integer, numeric, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

// Enums
export const recordTypeEnum = pgEnum('record_type', ['INCOME', 'EXPENSE']);
export const investmentTypeEnum = pgEnum('investment_type', ['INVESTMENT', 'PAYMENT', 'UPAD']);

// 1. Define the 'users' table (Auth sync).
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Define the 'businesses' table (Multi-Organization hierarchy).
export const businesses = pgTable('businesses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  businessName: text('business_name').notNull(),
  legalName: text('legal_name'),
  address: text('address'),
  city: text('city'),
  state: text('state').default('Gujarat').notNull(),
  pincode: text('pincode'),
  mobile: text('mobile'),
  email: text('email'),
  gstin: text('gstin'),
  pan: text('pan'),
  logo: text('logo'),
  invoicePrefix: text('invoice_prefix').default('INV').notNull(),
  financialYear: text('financial_year').notNull(),
  bankName: text('bank_name'),
  bankAccountNumber: text('bank_account_number'),
  bankIfsc: text('bank_ifsc'),
  bankBranch: text('bank_branch'),
  termsAndConditions: text('terms_and_conditions'),
  isDeleted: integer('is_deleted').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_businesses_user').on(table.userId),
]);

// 3. Define the 'locations' table (Branches / Worksites).
export const locations = pgTable('locations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  name: text('name').notNull(),
  address: text('address'),
  city: text('city'),
  state: text('state').default('Gujarat').notNull(),
  pincode: text('pincode'),
  gstin: text('gstin'), // Optional branch-specific GSTIN
  contactPerson: text('contact_person'),
  mobile: text('mobile'),
  isDeleted: integer('is_deleted').default(0).notNull(), // Soft delete flag (0 = active, 1 = archived)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_locations_business').on(table.businessId),
  index('idx_locations_user').on(table.userId),
]);

// 4. Reusable Tax Rates (Business-scoped).
export const taxRates = pgTable('tax_rates', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  name: text('name').notNull(), // e.g. 'GST 18%'
  gstRate: numeric('gst_rate', { precision: 5, scale: 2 }).notNull(),
  cgstRate: numeric('cgst_rate', { precision: 5, scale: 2 }).notNull(),
  sgstRate: numeric('sgst_rate', { precision: 5, scale: 2 }).notNull(),
  igstRate: numeric('igst_rate', { precision: 5, scale: 2 }).notNull(),
  cessRate: numeric('cess_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  isDefault: integer('is_default').default(0).notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. First-class Opening Balances.
export const openingBalances = pgTable('opening_balances', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  locationId: integer('location_id').references(() => locations.id),
  entityType: text('entity_type').notNull(), // 'CUSTOMER', 'SUPPLIER', 'CASH', 'BANK', 'ITEM_STOCK', 'LABOUR'
  entityId: integer('entity_id').notNull(),
  entityName: text('entity_name').notNull(),
  debitAmount: numeric('debit_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  creditAmount: numeric('credit_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  stockQuantity: numeric('stock_quantity', { precision: 12, scale: 4 }).default('0').notNull(),
  stockRate: numeric('stock_rate', { precision: 12, scale: 2 }).default('0').notNull(),
  effectiveDate: text('effective_date').notNull(),
  financialYear: text('financial_year').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Define the 'records' table (Income & Non-invoice Expenses).
export const records = pgTable('records', {
  id: serial('id').primaryKey(),
  locationId: integer('location_id').references(() => locations.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  userId: integer('user_id').references(() => users.id).notNull(),
  type: recordTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  date: text('date').notNull(), // Format: YYYY-MM-DD
  time: text('time'), // Format: HH:MM
  partyName: text('party_name').notNull(),
  teamName: text('team_name'),
  description: text('description'),
  category: text('category'),
  paymentMethod: text('payment_method'),
  referenceNumber: text('reference_number'),
  notes: text('notes'),
  taxableAmount: numeric('taxable_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  gstRate: numeric('gst_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  gstAmount: numeric('gst_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  refundableAmount: numeric('refundable_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  refundedAmount: numeric('refunded_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  refundStatus: text('refund_status').default('N/A').notNull(), // N/A, PENDING, PARTIAL, FULL
  isVoid: integer('is_void').default(0).notNull(),
  voidReason: text('void_reason'),
  voidedAt: timestamp('voided_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
}, (table) => [
  index('idx_records_lookup').on(table.userId, table.locationId, table.date),
]);

// 7. Refunds Ledger (Linked to records).
export const refunds = pgTable('refunds', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  locationId: integer('location_id').references(() => locations.id),
  recordId: integer('record_id').references(() => records.id).notNull(),
  refundDate: text('refund_date').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').default('CASH').notNull(),
  referenceNumber: text('reference_number'),
  notes: text('notes'),
  isVoid: integer('is_void').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. Historical Investment Parties & Transactions.
export const investmentParties = pgTable('investment_parties', {
  id: serial('id').primaryKey(),
  locationId: integer('location_id').references(() => locations.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  userId: integer('user_id').references(() => users.id).notNull(),
  partyName: text('party_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

export const investmentTransactions = pgTable('investment_transactions', {
  id: serial('id').primaryKey(),
  partyId: integer('party_id').references(() => investmentParties.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  type: investmentTypeEnum('type').notNull(), // INVESTMENT, PAYMENT, UPAD
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  date: text('date').notNull(),
  description: text('description'),
  paymentMethod: text('payment_method'),
  referenceNumber: text('reference_number'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

export const materialStockAdjustments = pgTable('material_stock_adjustments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  materialName: text('material_name').notNull(),
  adjustment: numeric('adjustment', { precision: 12, scale: 2 }).default('0').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. Master Products & Services Catalog.
export const items = pgTable('items', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  name: text('name').notNull(),
  sku: text('sku'),
  type: text('type').default('PRODUCT').notNull(), // PRODUCT, SERVICE
  category: text('category'),
  hsnCode: text('hsn_code'),
  unit: text('unit').default('Nos').notNull(),
  salePrice: numeric('sale_price', { precision: 12, scale: 2 }).default('0').notNull(),
  purchasePrice: numeric('purchase_price', { precision: 12, scale: 2 }).default('0').notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('18').notNull(),
  cessRate: numeric('cess_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  openingStock: numeric('opening_stock', { precision: 12, scale: 4 }).default('0').notNull(),
  currentStock: numeric('current_stock', { precision: 12, scale: 4 }).default('0').notNull(),
  minStockAlert: numeric('min_stock_alert', { precision: 12, scale: 4 }).default('0').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

// 10. Transaction-Based Stock Movements Ledger.
export const stockMovements = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  locationId: integer('location_id').references(() => locations.id),
  itemId: integer('item_id').references(() => items.id).notNull(),
  movementType: text('movement_type').notNull(), // 'PURCHASE', 'SALE', 'PURCHASE_RETURN', 'SALE_RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'REVERSAL'
  quantity: numeric('quantity', { precision: 12, scale: 4 }).notNull(),
  unit: text('unit').default('Nos').notNull(),
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).default('0').notNull(),
  totalCost: numeric('total_cost', { precision: 12, scale: 2 }).default('0').notNull(),
  sourceDocumentType: text('source_document_type').notNull(), // 'INVOICE', 'PURCHASE_BILL', 'CREDIT_NOTE', 'DEBIT_NOTE', 'MANUAL_ADJUSTMENT'
  sourceDocumentId: integer('source_document_id').notNull(),
  sourceLineId: integer('source_line_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_stock_item').on(table.itemId),
  index('idx_stock_doc').on(table.sourceDocumentType, table.sourceDocumentId),
]);

// 11. Material Purchases (Procurement Bills).
export const materialPurchases = pgTable('material_purchases', {
  id: serial('id').primaryKey(),
  locationId: integer('location_id').references(() => locations.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  userId: integer('user_id').references(() => users.id).notNull(),
  date: text('date').notNull(),
  financialYear: text('financial_year'),
  partyName: text('party_name').notNull(),
  materialName: text('material_name').notNull(),
  materialCategory: text('material_category'),
  quantity: numeric('quantity', { precision: 12, scale: 4 }).notNull(),
  unit: text('unit').notNull(),
  rate: numeric('rate', { precision: 12, scale: 2 }).notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  transportCost: numeric('transport_cost', { precision: 12, scale: 2 }).default('0').notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).default('0').notNull(),
  taxPercentage: numeric('tax_percentage', { precision: 5, scale: 2 }).default('0').notNull(),
  tax: numeric('tax', { precision: 12, scale: 2 }).default('0').notNull(),
  cgst: numeric('cgst', { precision: 12, scale: 2 }).default('0').notNull(),
  sgst: numeric('sgst', { precision: 12, scale: 2 }).default('0').notNull(),
  igst: numeric('igst', { precision: 12, scale: 2 }).default('0').notNull(),
  cess: numeric('cess', { precision: 12, scale: 2 }).default('0').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  outstandingAmount: numeric('outstanding_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  paymentStatus: text('payment_status').default('UNPAID').notNull(),
  paymentMethod: text('payment_method'),
  referenceNumber: text('reference_number'),
  invoiceNumber: text('invoice_number'),
  gst: text('gst'),
  address: text('address'),
  notes: text('notes'),
  description: text('description'),
  isVoid: integer('is_void').default(0).notNull(),
  voidReason: text('void_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

// 12. Historical Material Supplies.
export const materialSupplies = pgTable('material_supplies', {
  id: serial('id').primaryKey(),
  locationId: integer('location_id').references(() => locations.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  userId: integer('user_id').references(() => users.id).notNull(),
  date: text('date').notNull(),
  partyName: text('party_name').notNull(),
  materialName: text('material_name').notNull(),
  materialCategory: text('material_category'),
  quantity: numeric('quantity', { precision: 12, scale: 4 }).notNull(),
  unit: text('unit').notNull(),
  rate: numeric('rate', { precision: 12, scale: 2 }).notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  transportCost: numeric('transport_cost', { precision: 12, scale: 2 }).default('0').notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).default('0').notNull(),
  taxPercentage: numeric('tax_percentage', { precision: 5, scale: 2 }).default('0').notNull(),
  tax: numeric('tax', { precision: 12, scale: 2 }).default('0').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  outstandingAmount: numeric('outstanding_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  paymentStatus: text('payment_status').default('UNPAID').notNull(),
  paymentMethod: text('payment_method'),
  referenceNumber: text('reference_number'),
  invoiceNumber: text('invoice_number'),
  gst: text('gst'),
  address: text('address'),
  notes: text('notes'),
  description: text('description'),
  isVoid: integer('is_void').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

// 13. Historical Material Labour Supplies.
export const materialLabourSupplies = pgTable('material_labour_supplies', {
  id: serial('id').primaryKey(),
  locationId: integer('location_id').references(() => locations.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  userId: integer('user_id').references(() => users.id).notNull(),
  date: text('date').notNull(),
  siteLocationName: text('site_location_name'),
  teamName: text('team_name'),
  partyName: text('party_name').notNull(),
  materialName: text('material_name'),
  materialQuantity: numeric('material_quantity', { precision: 12, scale: 4 }).default('0'),
  materialUnit: text('material_unit'),
  materialRate: numeric('material_rate', { precision: 12, scale: 2 }).default('0'),
  materialAmount: numeric('material_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  labourType: text('labour_type'),
  labourQuantity: numeric('labour_quantity', { precision: 12, scale: 4 }).default('0'),
  labourUnit: text('labour_unit'),
  labourRate: numeric('labour_rate', { precision: 12, scale: 2 }).default('0'),
  labourAmount: numeric('labour_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  workDescription: text('work_description').notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  taxPercentage: numeric('tax_percentage', { precision: 5, scale: 2 }).default('0').notNull(),
  tax: numeric('tax', { precision: 12, scale: 2 }).default('0').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  outstandingAmount: numeric('outstanding_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  paymentStatus: text('payment_status').default('UNPAID').notNull(),
  paymentMethod: text('payment_method'),
  referenceNumber: text('reference_number'),
  invoiceNumber: text('invoice_number'),
  gst: text('gst'),
  address: text('address'),
  notes: text('notes'),
  isVoid: integer('is_void').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

// 14. Labour Wages & Upad (Day vs TC strictly separated).
export const labourSalaries = pgTable('labour_salaries', {
  id: serial('id').primaryKey(),
  locationId: integer('location_id').references(() => locations.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  userId: integer('user_id').references(() => users.id).notNull(),
  date: text('date').notNull(),
  siteLocationName: text('site_location_name'),
  labourId: text('labour_id'),
  labourName: text('labour_name').notNull(),
  labourTeam: text('labour_team'),
  address: text('address'),
  periodFrom: text('period_from'),
  periodTo: text('period_to'),
  workType: text('work_type').default('DAY_WORK').notNull(), // 'DAY_WORK' | 'TC_WORK'
  attendanceType: text('attendance_type').default('Full-day').notNull(), // 'Full-day', 'Half-day', 'TC'
  tcNumber: text('tc_number'),
  description: text('description'),
  days: numeric('days', { precision: 5, scale: 2 }).default('0').notNull(),
  dailyRate: numeric('daily_rate', { precision: 12, scale: 2 }).default('0').notNull(),
  tcQuantity: numeric('tc_quantity', { precision: 12, scale: 4 }).default('0').notNull(),
  tcRate: numeric('tc_rate', { precision: 12, scale: 2 }).default('0').notNull(),
  dailyRateSnapshot: numeric('daily_rate_snapshot', { precision: 12, scale: 2 }).default('0').notNull(),
  otherEarnings: numeric('other_earnings', { precision: 12, scale: 2 }).default('0').notNull(),
  grossSalary: numeric('gross_salary', { precision: 12, scale: 2 }).default('0').notNull(),
  deduction: numeric('deduction', { precision: 12, scale: 2 }).default('0').notNull(),
  netSalary: numeric('net_salary', { precision: 12, scale: 2 }).default('0').notNull(),
  upad: numeric('upad', { precision: 12, scale: 2 }).default('0').notNull(),
  paymentAmount: numeric('payment_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  balance: numeric('balance', { precision: 12, scale: 2 }).default('0').notNull(),
  outstandingAmount: numeric('outstanding_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  paymentMethod: text('payment_method'),
  referenceNumber: text('reference_number'),
  notes: text('notes'),
  isVoid: integer('is_void').default(0).notNull(),
  voidReason: text('void_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
}, (table) => [
  index('idx_labour_worker').on(table.userId, table.labourName),
]);

// 15. Audit Logs.
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  locationId: integer('location_id').references(() => locations.id),
  action: text('action').notNull(), // 'CREATE', 'UPDATE', 'VOID', 'REVERSE', 'DELETE_MASTER'
  entityType: text('entity_type').notNull(), // 'INVOICE', 'PURCHASE', 'PAYMENT', 'RECORD', 'LABOUR', 'ITEM', 'PARTY', 'LOCATION'
  entityId: integer('entity_id'),
  beforeState: text('before_state'),
  afterState: text('after_state'),
  metadata: text('metadata'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 16. Site Supervisor Cost.
export const supervisorCosts = pgTable('supervisor_costs', {
  id: serial('id').primaryKey(),
  locationId: integer('location_id').references(() => locations.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  userId: integer('user_id').references(() => users.id).notNull(),
  date: text('date').notNull(),
  supervisorName: text('supervisor_name').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description'),
  paymentMethod: text('payment_method'),
  referenceNumber: text('reference_number'),
  isVoid: integer('is_void').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

// 17. Master Parties (Customers & Suppliers).
export const parties = pgTable('parties', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  locationId: integer('location_id').references(() => locations.id),
  name: text('name').notNull(),
  partyType: text('party_type').default('CUSTOMER').notNull(), // CUSTOMER, SUPPLIER, BOTH
  phone: text('phone'),
  email: text('email'),
  pan: text('pan'),
  state: text('state').default('Gujarat').notNull(),
  stateCode: text('state_code').default('24').notNull(),
  address: text('address'),
  gst: text('gst'),
  openingBalance: numeric('opening_balance', { precision: 12, scale: 2 }).default('0').notNull(),
  openingBalanceType: text('opening_balance_type').default('TO_RECEIVE').notNull(), // TO_RECEIVE (Debit), TO_PAY (Credit)
  creditLimit: numeric('credit_limit', { precision: 12, scale: 2 }).default('0').notNull(),
  paymentTermsDays: integer('payment_terms_days').default(30).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
}, (table) => [
  index('idx_parties_business').on(table.businessId),
  index('idx_parties_name').on(table.name),
]);

// 18. GST Invoices & Bills.
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  locationId: integer('location_id').references(() => locations.id),
  partyId: integer('party_id').references(() => parties.id),
  partyName: text('party_name').notNull(),
  partyGst: text('party_gst'),
  partyAddress: text('party_address'),
  partyPhone: text('party_phone'),
  invoiceNumber: text('invoice_number').notNull(),
  financialYear: text('financial_year').notNull(),
  invoiceDate: text('invoice_date').notNull(),
  dueDate: text('due_date'),
  sellerState: text('seller_state').default('Gujarat').notNull(),
  sellerStateCode: text('seller_state_code').default('24').notNull(),
  buyerState: text('buyer_state').default('Gujarat').notNull(),
  buyerStateCode: text('buyer_state_code').default('24').notNull(),
  placeOfSupply: text('place_of_supply').default('Gujarat (24)').notNull(),
  placeOfSupplyStateCode: text('place_of_supply_state_code').default('24').notNull(),
  invoiceType: text('invoice_type').default('TAX_INVOICE').notNull(), // TAX_INVOICE, BILL_OF_SUPPLY, PROFORMA, CREDIT_NOTE, DEBIT_NOTE
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).default('0').notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).default('0').notNull(),
  taxableAmount: numeric('taxable_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  cgst: numeric('cgst', { precision: 12, scale: 2 }).default('0').notNull(),
  sgst: numeric('sgst', { precision: 12, scale: 2 }).default('0').notNull(),
  igst: numeric('igst', { precision: 12, scale: 2 }).default('0').notNull(),
  cessAmount: numeric('cess_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  transportCharges: numeric('transport_charges', { precision: 12, scale: 2 }).default('0').notNull(),
  totalTax: numeric('total_tax', { precision: 12, scale: 2 }).default('0').notNull(),
  roundOff: numeric('round_off', { precision: 6, scale: 2 }).default('0').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  balanceAmount: numeric('balance_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  paymentStatus: text('payment_status').default('UNPAID').notNull(), // UNPAID, PARTIAL, PAID, VOID
  isReverseCharge: integer('is_reverse_charge').default(0).notNull(),
  isVoid: integer('is_void').default(0).notNull(),
  voidReason: text('void_reason'),
  voidedAt: timestamp('voided_at'),
  originalInvoiceId: integer('original_invoice_id'),
  idempotencyKey: text('idempotency_key'),
  notes: text('notes'),
  terms: text('terms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
}, (table) => [
  uniqueIndex('idx_invoices_unique_num').on(table.businessId, table.financialYear, table.invoiceNumber),
  index('idx_invoices_user_date').on(table.userId, table.invoiceDate),
]);

// 19. Invoice Line Items.
export const invoiceItems = pgTable('invoice_items', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  itemId: integer('item_id').references(() => items.id),
  businessId: integer('business_id').references(() => businesses.id),
  description: text('description').notNull(),
  hsnCode: text('hsn_code'),
  quantity: numeric('quantity', { precision: 12, scale: 4 }).default('1').notNull(),
  unit: text('unit').default('Nos').notNull(),
  rate: numeric('rate', { precision: 12, scale: 2 }).notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).default('0').notNull(),
  discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).default('0').notNull(),
  taxableAmount: numeric('taxable_amount', { precision: 12, scale: 2 }).notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  cgst: numeric('cgst', { precision: 12, scale: 2 }).default('0').notNull(),
  sgst: numeric('sgst', { precision: 12, scale: 2 }).default('0').notNull(),
  igst: numeric('igst', { precision: 12, scale: 2 }).default('0').notNull(),
  cessRate: numeric('cess_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  cessAmount: numeric('cess_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
});

// 20. Credit & Debit Notes.
export const creditDebitNotes = pgTable('credit_debit_notes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  locationId: integer('location_id').references(() => locations.id),
  partyId: integer('party_id').references(() => parties.id),
  originalInvoiceId: integer('original_invoice_id').references(() => invoices.id).notNull(),
  noteType: text('note_type').notNull(), // 'CREDIT_NOTE', 'DEBIT_NOTE'
  noteNumber: text('note_number').notNull(),
  noteDate: text('note_date').notNull(),
  financialYear: text('financial_year').notNull(),
  reason: text('reason').notNull(),
  taxableAmount: numeric('taxable_amount', { precision: 12, scale: 2 }).notNull(),
  cgst: numeric('cgst', { precision: 12, scale: 2 }).default('0').notNull(),
  sgst: numeric('sgst', { precision: 12, scale: 2 }).default('0').notNull(),
  igst: numeric('igst', { precision: 12, scale: 2 }).default('0').notNull(),
  cessAmount: numeric('cess_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  stockAffecting: integer('stock_affecting').default(0).notNull(),
  isVoid: integer('is_void').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 21. Centralized Payments & Receipts Ledger.
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  locationId: integer('location_id').references(() => locations.id),
  partyId: integer('party_id').references(() => parties.id),
  partyName: text('party_name').notNull(),
  invoiceId: integer('invoice_id').references(() => invoices.id),
  purchaseId: integer('purchase_id').references(() => materialPurchases.id),
  labourSalaryId: integer('labour_salary_id').references(() => labourSalaries.id),
  recordId: integer('record_id').references(() => records.id),
  date: text('date').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentType: text('payment_type').notNull(), // PAYMENT_IN (Receipt), PAYMENT_OUT (Payment)
  paymentMode: text('payment_mode').default('CASH').notNull(), // CASH, BANK_TRANSFER, UPI, CHEQUE, NEFT
  referenceNumber: text('reference_number'),
  notes: text('notes'),
  isReversed: integer('is_reversed').default(0).notNull(),
  reversalReason: text('reversal_reason'),
  reversedAt: timestamp('reversed_at'),
  reversalPaymentId: integer('reversal_payment_id'),
  idempotencyKey: text('idempotency_key'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
}, (table) => [
  index('idx_payments_lookup').on(table.userId, table.date, table.paymentType),
]);

// 22. Labour Teams Master.
export const labourTeams = pgTable('labour_teams', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id),
  locationId: integer('location_id').references(() => locations.id).notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

// --- Relations ---

export const usersRelations = relations(users, ({ many }) => ({
  businesses: many(businesses),
  locations: many(locations),
  records: many(records),
  invoices: many(invoices),
  auditLogs: many(auditLogs),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  user: one(users, { fields: [businesses.userId], references: [users.id] }),
  locations: many(locations),
  records: many(records),
  invoices: many(invoices),
  items: many(items),
  parties: many(parties),
  stockMovements: many(stockMovements),
  payments: many(payments),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  business: one(businesses, { fields: [locations.businessId], references: [businesses.id] }),
  user: one(users, { fields: [locations.userId], references: [users.id] }),
  records: many(records),
  invoices: many(invoices),
  materialPurchases: many(materialPurchases),
  labourSalaries: many(labourSalaries),
  payments: many(payments),
}));

export const recordsRelations = relations(records, ({ one, many }) => ({
  location: one(locations, { fields: [records.locationId], references: [locations.id] }),
  business: one(businesses, { fields: [records.businessId], references: [businesses.id] }),
  user: one(users, { fields: [records.userId], references: [users.id] }),
  refunds: many(refunds),
}));

export const refundsRelations = relations(refunds, ({ one }) => ({
  record: one(records, { fields: [refunds.recordId], references: [records.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  business: one(businesses, { fields: [invoices.businessId], references: [businesses.id] }),
  location: one(locations, { fields: [invoices.locationId], references: [locations.id] }),
  party: one(parties, { fields: [invoices.partyId], references: [parties.id] }),
  user: one(users, { fields: [invoices.userId], references: [users.id] }),
  items: many(invoiceItems),
  payments: many(payments),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
  item: one(items, { fields: [invoiceItems.itemId], references: [items.id] }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  item: one(items, { fields: [stockMovements.itemId], references: [items.id] }),
  business: one(businesses, { fields: [stockMovements.businessId], references: [businesses.id] }),
  location: one(locations, { fields: [stockMovements.locationId], references: [locations.id] }),
}));

export const partiesRelations = relations(parties, ({ one, many }) => ({
  business: one(businesses, { fields: [parties.businessId], references: [businesses.id] }),
  location: one(locations, { fields: [parties.locationId], references: [locations.id] }),
  user: one(users, { fields: [parties.userId], references: [users.id] }),
  invoices: many(invoices),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  business: one(businesses, { fields: [payments.businessId], references: [businesses.id] }),
  location: one(locations, { fields: [payments.locationId], references: [locations.id] }),
  party: one(parties, { fields: [payments.partyId], references: [parties.id] }),
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
}));
