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
