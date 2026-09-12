import { relations } from 'drizzle-orm';
import { integer, numeric, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Enums
export const recordTypeEnum = pgEnum('record_type', ['INCOME', 'EXPENSE']);

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

// Define the 'records' table (Hisab-Kitab).
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
  description: text('description'),
  category: text('category'),
  paymentMethod: text('payment_method'),
  referenceNumber: text('reference_number'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(), // Soft delete flag
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

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  author: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));
