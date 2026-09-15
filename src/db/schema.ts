import { relations } from 'drizzle-orm';
import { integer, numeric, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Enums
export const recordTypeEnum = pgEnum('record_type', ['INCOME', 'EXPENSE']);
export const investmentTypeEnum = pgEnum('investment_type', ['INVESTMENT', 'PAYMENT', 'UPAD']);

// Define the 'users' table.
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Define the 'locations' table.
export const locations = pgTable('locations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  address: text('address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(), // Soft delete flag (0 = active, 1 = deleted)
});

// Define the 'records' table (Bina Enterprise) - Used for Income & Expenses
export const records = pgTable('records', {
  id: serial('id').primaryKey(),
  locationId: integer('location_id')
    .references(() => locations.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
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
  refundableAmount: numeric('refundable_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  refundedAmount: numeric('refunded_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  refundStatus: text('refund_status').default('N/A').notNull(), // N/A, PENDING, PARTIAL, FULL
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(), // Soft delete flag
});

// Category 1: Investment Parties
export const investmentParties = pgTable('investment_parties', {
  id: serial('id').primaryKey(),
  locationId: integer('location_id').references(() => locations.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  partyName: text('party_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

// Category 1: Investment Transactions
export const investmentTransactions = pgTable('investment_transactions', {
  id: serial('id').primaryKey(),
  partyId: integer('party_id').references(() => investmentParties.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
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
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  materialName: text('material_name').notNull(),
  adjustment: numeric('adjustment', { precision: 12, scale: 2 }).default('0').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Category 3: Material Purchases
export const materialPurchases = pgTable('material_purchases', {
  address: text('address'),
  gst: text('gst'),
  materialCategory: text('material_category'),
  invoiceNumber: text('invoice_number'),
  notes: text('notes'),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  outstandingAmount: numeric('outstanding_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  id: serial('id').primaryKey(),
  locationId: integer('location_id').references(() => locations.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: text('date').notNull(),
  partyName: text('party_name').notNull(),
  materialName: text('material_name').notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull(),
  unit: text('unit').notNull(),
  rate: numeric('rate', { precision: 12, scale: 2 }).notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  transportCost: numeric('transport_cost', { precision: 12, scale: 2 }).default('0').notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).default('0').notNull(),
  taxPercentage: numeric('tax_percentage', { precision: 5, scale: 2 }).default('0').notNull(),
  tax: numeric('tax', { precision: 12, scale: 2 }).default('0').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  paymentStatus: text('payment_status').default('UNPAID').notNull(),
  paymentMethod: text('payment_method'),
  referenceNumber: text('reference_number'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

// Category 4: Material Supplies
export const materialSupplies = pgTable('material_supplies', {
  address: text('address'),
  gst: text('gst'),
  materialCategory: text('material_category'),
  invoiceNumber: text('invoice_number'),
  notes: text('notes'),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  outstandingAmount: numeric('outstanding_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  id: serial('id').primaryKey(),
  locationId: integer('location_id').references(() => locations.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: text('date').notNull(),
  partyName: text('party_name').notNull(),
  materialName: text('material_name').notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull(),
  unit: text('unit').notNull(),
  rate: numeric('rate', { precision: 12, scale: 2 }).notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  transportCost: numeric('transport_cost', { precision: 12, scale: 2 }).default('0').notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).default('0').notNull(),
  taxPercentage: numeric('tax_percentage', { precision: 5, scale: 2 }).default('0').notNull(),
  tax: numeric('tax', { precision: 12, scale: 2 }).default('0').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  paymentStatus: text('payment_status').default('UNPAID').notNull(),
  paymentMethod: text('payment_method'),
  referenceNumber: text('reference_number'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

// Category 5: Material Labour Supplies
export const materialLabourSupplies = pgTable('material_labour_supplies', {
  address: text('address'),
  gst: text('gst'),
  materialUnit: text('material_unit'),
  labourType: text('labour_type'),
  labourQuantity: numeric('labour_quantity', { precision: 12, scale: 2 }).default('0'),
  labourUnit: text('labour_unit'),
  materialRate: numeric('material_rate', { precision: 12, scale: 2 }).default('0'),
  labourRate: numeric('labour_rate', { precision: 12, scale: 2 }).default('0'),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  outstandingAmount: numeric('outstanding_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  invoiceNumber: text('invoice_number'),
  notes: text('notes'),
  id: serial('id').primaryKey(),
  locationId: integer('location_id').references(() => locations.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: text('date').notNull(),
  siteLocationName: text('site_location_name'),
  teamName: text('team_name'),
  materialName: text('material_name'),
  materialQuantity: numeric('material_quantity', { precision: 12, scale: 2 }).default('0'),
  partyName: text('party_name').notNull(),
  workDescription: text('work_description').notNull(),
  materialAmount: numeric('material_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  labourAmount: numeric('labour_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  taxPercentage: numeric('tax_percentage', { precision: 5, scale: 2 }).default('0').notNull(),
  tax: numeric('tax', { precision: 12, scale: 2 }).default('0').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  paymentStatus: text('payment_status').default('UNPAID').notNull(),
  paymentMethod: text('payment_method'),
  referenceNumber: text('reference_number'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

// Category 6: Labour Salaries & Upad
export const labourSalaries = pgTable('labour_salaries', {
  labourId: text('labour_id'),
  address: text('address'),
  periodFrom: text('period_from'),
  periodTo: text('period_to'),
  workType: text('work_type'),
  tcQuantity: numeric('tc_quantity', { precision: 12, scale: 2 }).default('0').notNull(),
  tcRate: numeric('tc_rate', { precision: 12, scale: 2 }).default('0').notNull(),
  outstandingAmount: numeric('outstanding_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  id: serial('id').primaryKey(),
  locationId: integer('location_id').references(() => locations.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: text('date').notNull(),
  siteLocationName: text('site_location_name'),
  labourName: text('labour_name').notNull(),
  labourTeam: text('labour_team'),
  attendanceType: text('attendance_type'),
  tcNumber: text('tc_number'),
  description: text('description'),
  days: numeric('days', { precision: 5, scale: 2 }).default('0').notNull(),
  dailyRate: numeric('daily_rate', { precision: 12, scale: 2 }).default('0').notNull(),
  otherEarnings: numeric('other_earnings', { precision: 12, scale: 2 }).default('0').notNull(),
  grossSalary: numeric('gross_salary', { precision: 12, scale: 2 }).default('0').notNull(),
  deduction: numeric('deduction', { precision: 12, scale: 2 }).default('0').notNull(),
  netSalary: numeric('net_salary', { precision: 12, scale: 2 }).default('0').notNull(),
  upad: numeric('upad', { precision: 12, scale: 2 }).default('0').notNull(),
  paymentAmount: numeric('payment_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  balance: numeric('balance', { precision: 12, scale: 2 }).default('0').notNull(),
  paymentMethod: text('payment_method'),
  referenceNumber: text('reference_number'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

// Define the 'audit_logs' table.
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  action: text('action').notNull(), // e.g., 'CREATE_RECORD', 'DELETE_LOCATION'
  entityType: text('entity_type').notNull(), // e.g., 'LOCATION', 'RECORD'
  entityId: integer('entity_id'),
  metadata: text('metadata'), // JSON string for extra info
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Category 3: Site Supervisor Cost
export const supervisorCosts = pgTable('supervisor_costs', {
  id: serial('id').primaryKey(),
  locationId: integer('location_id').references(() => locations.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: text('date').notNull(),
  supervisorName: text('supervisor_name').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description'),
  paymentMethod: text('payment_method'),
  referenceNumber: text('reference_number'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});


// --- Master Data Tables ---
export const parties = pgTable('parties', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  locationId: integer('location_id').references(() => locations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  partyType: text('party_type').default('CUSTOMER').notNull(), // CUSTOMER, SUPPLIER, BOTH
  phone: text('phone'),
  email: text('email'),
  pan: text('pan'),
  state: text('state'),
  stateCode: text('state_code'),
  address: text('address'),
  gst: text('gst'),
  openingBalance: numeric('opening_balance', { precision: 12, scale: 2 }).default('0').notNull(),
  openingBalanceType: text('opening_balance_type').default('TO_RECEIVE').notNull(), // TO_RECEIVE (Debit), TO_PAY (Credit)
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

// Products & Services Catalog
export const items = pgTable('items', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  type: text('type').default('PRODUCT').notNull(), // PRODUCT, SERVICE
  hsnCode: text('hsn_code'),
  unit: text('unit').default('Nos').notNull(),
  salePrice: numeric('sale_price', { precision: 12, scale: 2 }).default('0').notNull(),
  purchasePrice: numeric('purchase_price', { precision: 12, scale: 2 }).default('0').notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('18').notNull(), // 0, 5, 12, 18, 28
  openingStock: numeric('opening_stock', { precision: 12, scale: 2 }).default('0').notNull(),
  currentStock: numeric('current_stock', { precision: 12, scale: 2 }).default('0').notNull(),
  minStockAlert: numeric('min_stock_alert', { precision: 12, scale: 2 }).default('0').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

// GST Invoices & Bills
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  locationId: integer('location_id').references(() => locations.id, { onDelete: 'set null' }),
  partyId: integer('party_id').references(() => parties.id, { onDelete: 'set null' }),
  partyName: text('party_name').notNull(),
  partyGst: text('party_gst'),
  partyAddress: text('party_address'),
  partyPhone: text('party_phone'),
  invoiceNumber: text('invoice_number').notNull(),
  invoiceDate: text('invoice_date').notNull(),
  dueDate: text('due_date'),
  placeOfSupply: text('place_of_supply'),
  invoiceType: text('invoice_type').default('TAX_INVOICE').notNull(), // TAX_INVOICE, BILL_OF_SUPPLY, PROFORMA, PURCHASE_BILL
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).default('0').notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).default('0').notNull(),
  taxableAmount: numeric('taxable_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  cgst: numeric('cgst', { precision: 12, scale: 2 }).default('0').notNull(),
  sgst: numeric('sgst', { precision: 12, scale: 2 }).default('0').notNull(),
  igst: numeric('igst', { precision: 12, scale: 2 }).default('0').notNull(),
  totalTax: numeric('total_tax', { precision: 12, scale: 2 }).default('0').notNull(),
  roundOff: numeric('round_off', { precision: 6, scale: 2 }).default('0').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  balanceAmount: numeric('balance_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  paymentStatus: text('payment_status').default('UNPAID').notNull(), // UNPAID, PARTIAL, PAID
  notes: text('notes'),
  terms: text('terms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

// Invoice Line Items
export const invoiceItems = pgTable('invoice_items', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  itemId: integer('item_id').references(() => items.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  hsnCode: text('hsn_code'),
  quantity: numeric('quantity', { precision: 12, scale: 2 }).default('1').notNull(),
  unit: text('unit').default('Nos').notNull(),
  rate: numeric('rate', { precision: 12, scale: 2 }).notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).default('0').notNull(),
  taxableAmount: numeric('taxable_amount', { precision: 12, scale: 2 }).notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  cgst: numeric('cgst', { precision: 12, scale: 2 }).default('0').notNull(),
  sgst: numeric('sgst', { precision: 12, scale: 2 }).default('0').notNull(),
  igst: numeric('igst', { precision: 12, scale: 2 }).default('0').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
});

// Payments & Receipts Ledger
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  locationId: integer('location_id').references(() => locations.id, { onDelete: 'set null' }),
  partyId: integer('party_id').references(() => parties.id, { onDelete: 'set null' }),
  partyName: text('party_name').notNull(),
  invoiceId: integer('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  date: text('date').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentType: text('payment_type').notNull(), // PAYMENT_IN (Receipt from Customer), PAYMENT_OUT (Payment to Vendor/Labour)
  paymentMode: text('payment_mode').default('CASH').notNull(), // CASH, BANK_TRANSFER, UPI, CHEQUE, NEFT
  referenceNumber: text('reference_number'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

export const labourTeams = pgTable('labour_teams', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  locationId: integer('location_id').references(() => locations.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

// --- Relationships ---

export const usersRelations = relations(users, ({ many }) => ({
  locations: many(locations),
  records: many(records),
  auditLogs: many(auditLogs),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  author: one(users, {
    fields: [locations.userId],
    references: [users.id],
  }),
  records: many(records),
}));

export const recordsRelations = relations(records, ({ one }) => ({
  location: one(locations, {
    fields: [records.locationId],
    references: [locations.id],
  }),
  author: one(users, {
    fields: [records.userId],
    references: [users.id],
  }),
}));

export const investmentPartiesRelations = relations(investmentParties, ({ one, many }) => ({
  location: one(locations, {
    fields: [investmentParties.locationId],
    references: [locations.id],
  }),
  transactions: many(investmentTransactions),
}));

export const investmentTransactionsRelations = relations(investmentTransactions, ({ one }) => ({
  party: one(investmentParties, {
    fields: [investmentTransactions.partyId],
    references: [investmentParties.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  author: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const partiesRelations = relations(parties, ({ one }) => ({
  location: one(locations, {
    fields: [parties.locationId],
    references: [locations.id],
  }),
  author: one(users, {
    fields: [parties.userId],
    references: [users.id],
  }),
}));

export const labourTeamsRelations = relations(labourTeams, ({ one }) => ({
  location: one(locations, {
    fields: [labourTeams.locationId],
    references: [locations.id],
  }),
  author: one(users, {
    fields: [labourTeams.userId],
    references: [users.id],
  }),
}));
