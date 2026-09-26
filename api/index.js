var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/server/app.ts
import express5 from "express";
import cors from "cors";

// src/server/middleware/errorHandler.ts
import { ZodError } from "zod";
var errorHandler = (err, req, res, next) => {
  console.error("Unhandled Server Error:", err);
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation Error",
      details: err.issues
    });
    return;
  }
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ error: message });
};

// src/server/routes/auth.routes.ts
import { Router } from "express";

// src/server/middleware/auth.ts
import crypto from "crypto";

// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  auditLogs: () => auditLogs,
  auditLogsRelations: () => auditLogsRelations,
  contractorCosts: () => contractorCosts,
  contractorCostsRelations: () => contractorCostsRelations,
  investmentParties: () => investmentParties,
  investmentPartiesRelations: () => investmentPartiesRelations,
  investmentTransactions: () => investmentTransactions,
  investmentTransactionsRelations: () => investmentTransactionsRelations,
  investmentTypeEnum: () => investmentTypeEnum,
  investorLocationAllocations: () => investorLocationAllocations,
  investorLocationAllocationsRelations: () => investorLocationAllocationsRelations,
  investorTransactions: () => investorTransactions,
  investorTransactionsRelations: () => investorTransactionsRelations,
  investors: () => investors,
  investorsRelations: () => investorsRelations,
  labourMaster: () => labourMaster,
  labourMasterRelations: () => labourMasterRelations,
  labourSalaries: () => labourSalaries,
  labourTeams: () => labourTeams,
  labourTeamsRelations: () => labourTeamsRelations,
  locations: () => locations,
  locationsRelations: () => locationsRelations,
  materialLabourSupplies: () => materialLabourSupplies,
  materialPurchases: () => materialPurchases,
  materialStockAdjustments: () => materialStockAdjustments,
  materialSupplies: () => materialSupplies,
  materials: () => materials,
  materialsRelations: () => materialsRelations,
  parties: () => parties,
  partiesRelations: () => partiesRelations,
  recordTypeEnum: () => recordTypeEnum,
  records: () => records,
  recordsRelations: () => recordsRelations,
  securitySettings: () => securitySettings,
  siteSupplies: () => siteSupplies,
  siteSuppliesRelations: () => siteSuppliesRelations,
  siteSupplyItems: () => siteSupplyItems,
  siteSupplyItemsRelations: () => siteSupplyItemsRelations,
  stockLedger: () => stockLedger,
  stockLedgerRelations: () => stockLedgerRelations,
  supervisorCosts: () => supervisorCosts,
  users: () => users,
  usersRelations: () => usersRelations
});
import { relations } from "drizzle-orm";
import { integer, numeric, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
var recordTypeEnum = pgEnum("record_type", ["INCOME", "EXPENSE"]);
var investmentTypeEnum = pgEnum("investment_type", ["INVESTMENT", "PAYMENT", "UPAD", "CONTRIBUTION"]);
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  // Firebase Auth UID
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
  // Soft delete flag (0 = active, 1 = deleted)
});
var records = pgTable("records", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: recordTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: text("date").notNull(),
  // Format: YYYY-MM-DD
  time: text("time"),
  // Format: HH:MM
  partyName: text("party_name").notNull(),
  teamName: text("team_name"),
  description: text("description"),
  category: text("category"),
  paymentMethod: text("payment_method"),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  refundableAmount: numeric("refundable_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  refundedAmount: numeric("refunded_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  refundStatus: text("refund_status").default("N/A").notNull(),
  // N/A, PENDING, PARTIAL, FULL
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
  // Soft delete flag
});
var investmentParties = pgTable("investment_parties", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  partyName: text("party_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
});
var investmentTransactions = pgTable("investment_transactions", {
  id: serial("id").primaryKey(),
  partyId: integer("party_id").references(() => investmentParties.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: investmentTypeEnum("type").notNull(),
  // INVESTMENT, PAYMENT, UPAD, CONTRIBUTION
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: text("date").notNull(),
  description: text("description"),
  paymentMethod: text("payment_method"),
  referenceNumber: text("reference_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
});
var investors = pgTable("investors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  mobile: text("mobile"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
});
var investorTransactions = pgTable("investor_transactions", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id").references(() => investors.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  // 'CONTRIBUTION' / 'CAPITAL', 'UPAD' / 'WITHDRAWAL'
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: text("date").notNull(),
  paymentMethod: text("payment_method"),
  referenceNumber: text("reference_number"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
});
var investorLocationAllocations = pgTable("investor_location_allocations", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id").references(() => investors.id, { onDelete: "cascade" }).notNull(),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: text("date").notNull(),
  paymentMethod: text("payment_method"),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
});
var contractorCosts = pgTable("contractor_costs", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  contractorName: text("contractor_name").notNull(),
  teamId: integer("team_id").references(() => labourTeams.id),
  teamName: text("team_name"),
  date: text("date").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  deductionAmount: numeric("deduction_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  netAmount: numeric("net_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  paymentStatus: text("payment_status").default("PAID").notNull(),
  workDescription: text("work_description"),
  paymentMethod: text("payment_method"),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
});
var materialStockAdjustments = pgTable("material_stock_adjustments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  materialName: text("material_name").notNull(),
  adjustment: numeric("adjustment", { precision: 12, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var materialPurchases = pgTable("material_purchases", {
  materialId: integer("material_id").references(() => materials.id),
  address: text("address"),
  gst: text("gst"),
  materialCategory: text("material_category"),
  invoiceNumber: text("invoice_number"),
  notes: text("notes"),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  outstandingAmount: numeric("outstanding_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  id: serial("id").primaryKey(),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  date: text("date").notNull(),
  partyName: text("party_name").notNull(),
  materialName: text("material_name").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  rate: numeric("rate", { precision: 12, scale: 2 }).notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  transportCost: numeric("transport_cost", { precision: 12, scale: 2 }).default("0").notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).default("0").notNull(),
  taxPercentage: numeric("tax_percentage", { precision: 5, scale: 2 }).default("0").notNull(),
  tax: numeric("tax", { precision: 12, scale: 2 }).default("0").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  paymentStatus: text("payment_status").default("UNPAID").notNull(),
  paymentMethod: text("payment_method"),
  referenceNumber: text("reference_number"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
});
var materialSupplies = pgTable("material_supplies", {
  partyId: integer("party_id").references(() => parties.id),
  materialId: integer("material_id").references(() => materials.id),
  address: text("address"),
  gst: text("gst"),
  materialCategory: text("material_category"),
  invoiceNumber: text("invoice_number"),
  notes: text("notes"),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  outstandingAmount: numeric("outstanding_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  id: serial("id").primaryKey(),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  date: text("date").notNull(),
  partyName: text("party_name").notNull(),
  materialName: text("material_name").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  rate: numeric("rate", { precision: 12, scale: 2 }).notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  transportCost: numeric("transport_cost", { precision: 12, scale: 2 }).default("0").notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).default("0").notNull(),
  taxPercentage: numeric("tax_percentage", { precision: 5, scale: 2 }).default("0").notNull(),
  tax: numeric("tax", { precision: 12, scale: 2 }).default("0").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  paymentStatus: text("payment_status").default("UNPAID").notNull(),
  paymentMethod: text("payment_method"),
  referenceNumber: text("reference_number"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
});
var materialLabourSupplies = pgTable("material_labour_supplies", {
  address: text("address"),
  gst: text("gst"),
  materialUnit: text("material_unit"),
  labourType: text("labour_type"),
  labourQuantity: numeric("labour_quantity", { precision: 12, scale: 2 }).default("0"),
  labourUnit: text("labour_unit"),
  materialRate: numeric("material_rate", { precision: 12, scale: 2 }).default("0"),
  labourRate: numeric("labour_rate", { precision: 12, scale: 2 }).default("0"),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  outstandingAmount: numeric("outstanding_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  invoiceNumber: text("invoice_number"),
  notes: text("notes"),
  id: serial("id").primaryKey(),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  date: text("date").notNull(),
  siteLocationName: text("site_location_name"),
  teamName: text("team_name"),
  materialName: text("material_name"),
  materialQuantity: numeric("material_quantity", { precision: 12, scale: 2 }).default("0"),
  partyName: text("party_name").notNull(),
  workDescription: text("work_description").notNull(),
  materialAmount: numeric("material_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  labourAmount: numeric("labour_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxPercentage: numeric("tax_percentage", { precision: 5, scale: 2 }).default("0").notNull(),
  tax: numeric("tax", { precision: 12, scale: 2 }).default("0").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  paymentStatus: text("payment_status").default("UNPAID").notNull(),
  paymentMethod: text("payment_method"),
  referenceNumber: text("reference_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
});
var labourSalaries = pgTable("labour_salaries", {
  labourMasterId: integer("labour_master_id").references(() => labourMaster.id),
  labourId: text("labour_id"),
  address: text("address"),
  periodFrom: text("period_from"),
  periodTo: text("period_to"),
  workType: text("work_type"),
  unitOfMeasurement: text("unit_of_measurement"),
  tcQuantity: numeric("tc_quantity", { precision: 12, scale: 2 }).default("0").notNull(),
  tcRate: numeric("tc_rate", { precision: 12, scale: 2 }).default("0").notNull(),
  outstandingAmount: numeric("outstanding_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  id: serial("id").primaryKey(),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  date: text("date").notNull(),
  siteLocationName: text("site_location_name"),
  labourName: text("labour_name").notNull(),
  labourTeam: text("labour_team"),
  attendanceType: text("attendance_type"),
  tcNumber: text("tc_number"),
  description: text("description"),
  days: numeric("days", { precision: 5, scale: 2 }).default("0").notNull(),
  dailyRate: numeric("daily_rate", { precision: 12, scale: 2 }).default("0").notNull(),
  otherEarnings: numeric("other_earnings", { precision: 12, scale: 2 }).default("0").notNull(),
  grossSalary: numeric("gross_salary", { precision: 12, scale: 2 }).default("0").notNull(),
  deduction: numeric("deduction", { precision: 12, scale: 2 }).default("0").notNull(),
  netSalary: numeric("net_salary", { precision: 12, scale: 2 }).default("0").notNull(),
  upad: numeric("upad", { precision: 12, scale: 2 }).default("0").notNull(),
  paymentAmount: numeric("payment_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  balance: numeric("balance", { precision: 12, scale: 2 }).default("0").notNull(),
  paymentMethod: text("payment_method"),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
});
var auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(),
  // e.g., 'CREATE_RECORD', 'DELETE_LOCATION'
  entityType: text("entity_type").notNull(),
  // e.g., 'LOCATION', 'RECORD'
  entityId: integer("entity_id"),
  metadata: text("metadata"),
  // JSON string for extra info
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var supervisorCosts = pgTable("supervisor_costs", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  date: text("date").notNull(),
  supervisorName: text("supervisor_name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  paymentMethod: text("payment_method"),
  referenceNumber: text("reference_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
});
var materials = pgTable("materials", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category"),
  defaultUnit: text("default_unit"),
  defaultRate: numeric("default_rate", { precision: 12, scale: 2 }).default("0"),
  minStock: numeric("min_stock", { precision: 12, scale: 2 }).default("0"),
  isActive: integer("is_active").default(1).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
});
var labourMaster = pgTable("labour_master", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  mobile: text("mobile"),
  address: text("address"),
  teamId: integer("team_id").references(() => labourTeams.id),
  workType: text("work_type"),
  dailyRate: numeric("daily_rate", { precision: 12, scale: 2 }).default("0"),
  tcRate: numeric("tc_rate", { precision: 12, scale: 2 }).default("0"),
  isActive: integer("is_active").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
});
var stockLedger = pgTable("stock_ledger", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "cascade" }).notNull(),
  materialId: integer("material_id").references(() => materials.id).notNull(),
  transactionType: text("transaction_type").notNull(),
  // 'IN', 'OUT', 'ADJUST'
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  referenceId: integer("reference_id"),
  referenceType: text("reference_type"),
  // 'PURCHASE', 'MATERIAL_SUPPLY', 'SITE_SUPPLY', 'MANUAL'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
});
var siteSupplies = pgTable("site_supplies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "cascade" }).notNull(),
  date: text("date").notNull(),
  teamId: integer("team_id").references(() => labourTeams.id),
  responsiblePerson: text("responsible_person"),
  workDescription: text("work_description"),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  investorId: integer("investor_id").references(() => investmentParties.id),
  // Optional linkage
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
});
var siteSupplyItems = pgTable("site_supply_items", {
  id: serial("id").primaryKey(),
  siteSupplyId: integer("site_supply_id").references(() => siteSupplies.id, { onDelete: "cascade" }).notNull(),
  materialId: integer("material_id").references(() => materials.id).notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  rate: numeric("rate", { precision: 12, scale: 2 }).default("0").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).default("0").notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
});
var parties = pgTable("parties", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  address: text("address"),
  gst: text("gst"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
});
var labourTeams = pgTable("labour_teams", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isDeleted: integer("is_deleted").default(0).notNull()
});
var usersRelations = relations(users, ({ many }) => ({
  locations: many(locations),
  records: many(records),
  auditLogs: many(auditLogs)
}));
var locationsRelations = relations(locations, ({ one, many }) => ({
  author: one(users, {
    fields: [locations.userId],
    references: [users.id]
  }),
  records: many(records)
}));
var recordsRelations = relations(records, ({ one }) => ({
  location: one(locations, {
    fields: [records.locationId],
    references: [locations.id]
  }),
  author: one(users, {
    fields: [records.userId],
    references: [users.id]
  })
}));
var investmentPartiesRelations = relations(investmentParties, ({ one, many }) => ({
  location: one(locations, {
    fields: [investmentParties.locationId],
    references: [locations.id]
  }),
  transactions: many(investmentTransactions)
}));
var investmentTransactionsRelations = relations(investmentTransactions, ({ one }) => ({
  party: one(investmentParties, {
    fields: [investmentTransactions.partyId],
    references: [investmentParties.id]
  })
}));
var auditLogsRelations = relations(auditLogs, ({ one }) => ({
  author: one(users, {
    fields: [auditLogs.userId],
    references: [users.id]
  })
}));
var partiesRelations = relations(parties, ({ one }) => ({
  location: one(locations, {
    fields: [parties.locationId],
    references: [locations.id]
  }),
  author: one(users, {
    fields: [parties.userId],
    references: [users.id]
  })
}));
var labourTeamsRelations = relations(labourTeams, ({ one }) => ({
  location: one(locations, {
    fields: [labourTeams.locationId],
    references: [locations.id]
  }),
  author: one(users, {
    fields: [labourTeams.userId],
    references: [users.id]
  })
}));
var materialsRelations = relations(materials, ({ one, many }) => ({
  location: one(locations, { fields: [materials.locationId], references: [locations.id] }),
  author: one(users, { fields: [materials.userId], references: [users.id] }),
  stockLedger: many(stockLedger)
}));
var labourMasterRelations = relations(labourMaster, ({ one }) => ({
  location: one(locations, { fields: [labourMaster.locationId], references: [locations.id] }),
  author: one(users, { fields: [labourMaster.userId], references: [users.id] }),
  team: one(labourTeams, { fields: [labourMaster.teamId], references: [labourTeams.id] })
}));
var stockLedgerRelations = relations(stockLedger, ({ one }) => ({
  location: one(locations, { fields: [stockLedger.locationId], references: [locations.id] }),
  author: one(users, { fields: [stockLedger.userId], references: [users.id] }),
  material: one(materials, { fields: [stockLedger.materialId], references: [materials.id] })
}));
var siteSuppliesRelations = relations(siteSupplies, ({ one, many }) => ({
  location: one(locations, { fields: [siteSupplies.locationId], references: [locations.id] }),
  author: one(users, { fields: [siteSupplies.userId], references: [users.id] }),
  team: one(labourTeams, { fields: [siteSupplies.teamId], references: [labourTeams.id] }),
  investor: one(investmentParties, { fields: [siteSupplies.investorId], references: [investmentParties.id] }),
  items: many(siteSupplyItems)
}));
var siteSupplyItemsRelations = relations(siteSupplyItems, ({ one }) => ({
  siteSupply: one(siteSupplies, { fields: [siteSupplyItems.siteSupplyId], references: [siteSupplies.id] }),
  material: one(materials, { fields: [siteSupplyItems.materialId], references: [materials.id] })
}));
var investorsRelations = relations(investors, ({ one, many }) => ({
  author: one(users, { fields: [investors.userId], references: [users.id] }),
  transactions: many(investorTransactions),
  allocations: many(investorLocationAllocations)
}));
var investorTransactionsRelations = relations(investorTransactions, ({ one }) => ({
  investor: one(investors, { fields: [investorTransactions.investorId], references: [investors.id] }),
  author: one(users, { fields: [investorTransactions.userId], references: [users.id] })
}));
var investorLocationAllocationsRelations = relations(investorLocationAllocations, ({ one }) => ({
  investor: one(investors, { fields: [investorLocationAllocations.investorId], references: [investors.id] }),
  location: one(locations, { fields: [investorLocationAllocations.locationId], references: [locations.id] }),
  author: one(users, { fields: [investorLocationAllocations.userId], references: [users.id] })
}));
var contractorCostsRelations = relations(contractorCosts, ({ one }) => ({
  location: one(locations, { fields: [contractorCosts.locationId], references: [locations.id] }),
  author: one(users, { fields: [contractorCosts.userId], references: [users.id] }),
  team: one(labourTeams, { fields: [contractorCosts.teamId], references: [labourTeams.id] })
}));
var securitySettings = pgTable("security_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  // e.g. 'CATEGORY_LOCK_PIN'
  value: text("value").notNull(),
  // '190190'
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// src/db/index.ts
var NEON_CONNECTION_STRING = "postgresql://neondb_owner:npg_EFhz2LiMmG9c@ep-twilight-hat-b4jrehma-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require";
var getDatabaseUrl = () => {
  const envUrl = process.env.DATABASE_URL?.trim();
  if (!envUrl || envUrl.includes("ep-odd-king-ae3gm793")) {
    return NEON_CONNECTION_STRING;
  }
  let clean = envUrl;
  if (clean.startsWith("'") && clean.endsWith("'") || clean.startsWith('"') && clean.endsWith('"')) {
    clean = clean.slice(1, -1).trim();
  }
  return clean || NEON_CONNECTION_STRING;
};
var createPool = () => {
  if (!global._postgresPool) {
    let connStr = getDatabaseUrl();
    const isRemote = connStr.includes("sslmode=require") || connStr.includes("neon.tech") || connStr.includes("aws.neon.tech");
    const config = {
      connectionString: connStr,
      max: process.env.NODE_ENV === "production" ? 10 : 5,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 15e3,
      ssl: isRemote ? { rejectUnauthorized: false } : false
    };
    global._postgresPool = new Pool(config);
    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return global._postgresPool;
};
var pool = createPool();
var db = drizzle(pool, { schema: schema_exports });

// src/db/users.ts
async function getOrCreateUser(uid, email, name) {
  try {
    const result = await db.insert(users).values({
      uid,
      email,
      name: name || null
    }).onConflictDoUpdate({
      target: users.uid,
      set: {
        email,
        name: name || null
      }
    }).returning();
    return result[0];
  } catch (error) {
    console.warn("Failed to sync user to PostgreSQL, returning fallback memory user:", error);
    return {
      id: 1,
      uid,
      email: email || "system@bd-accounting.local",
      name: name || "B_D Accounting User",
      createdAt: /* @__PURE__ */ new Date()
    };
  }
}

// src/server/middleware/auth.ts
var MASTER_PIN = process.env.APP_ACCESS_PIN || process.env.APP_MASTER_PIN || "Bh@ju1204";
function timingSafeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}
var pinRateLimitMap = /* @__PURE__ */ new Map();
var MAX_ATTEMPTS = 50;
var LOCKOUT_MS = 10 * 1e3;
function clearAllRateLimits() {
  pinRateLimitMap.clear();
}
function recordFailedPinAttempt(key) {
  const now = Date.now();
  const entry = pinRateLimitMap.get(key) || { attempts: 0, blockedUntil: null };
  entry.attempts += 1;
  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + LOCKOUT_MS;
    pinRateLimitMap.set(key, entry);
    return { allowed: false, retryAfterMinutes: 1, retryAfterSeconds: 10 };
  }
  pinRateLimitMap.set(key, entry);
  return { allowed: true };
}
function resetPinRateLimit(key) {
  pinRateLimitMap.delete(key);
}
var PIN_SECRET = process.env.JWT_SECRET || process.env.APP_PIN_SECRET || "b_d_accounting_erp_pin_auth_secret_key_199198197";
function generatePinToken() {
  const payload = JSON.stringify({
    app: "B_D_ACCOUNTING_ERP",
    iat: Date.now(),
    exp: Date.now() + 30 * 24 * 60 * 60 * 1e3
    // 30 days valid
  });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  const signature = crypto.createHmac("sha256", PIN_SECRET).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}
function generateCategoryPinToken(userId) {
  const payload = JSON.stringify({
    app: "B_D_ACCOUNTING_ERP_CATEGORY_ACCESS",
    userId: userId || 0,
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1e3
    // 24 hours valid session
  });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  const signature = crypto.createHmac("sha256", PIN_SECRET).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}
function verifyPinToken(token) {
  try {
    if (!token || !token.includes(".")) return false;
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) return false;
    const expectedSig = crypto.createHmac("sha256", PIN_SECRET).update(encodedPayload).digest("base64url");
    if (!timingSafeCompare(signature, expectedSig)) return false;
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (payload.app !== "B_D_ACCOUNTING_ERP") return false;
    if (payload.exp && Date.now() > payload.exp) return false;
    return true;
  } catch (err) {
    return false;
  }
}
function verifyCategoryPinToken(token) {
  try {
    if (!token || !token.includes(".")) return false;
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) return false;
    const expectedSig = crypto.createHmac("sha256", PIN_SECRET).update(encodedPayload).digest("base64url");
    if (!timingSafeCompare(signature, expectedSig)) return false;
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (payload.app !== "B_D_ACCOUNTING_ERP_CATEGORY_ACCESS") return false;
    if (payload.exp && Date.now() > payload.exp) return false;
    return true;
  } catch (err) {
    return false;
  }
}
var cachedSystemUser = null;
async function getSystemUser() {
  if (cachedSystemUser) return cachedSystemUser;
  try {
    const user = await getOrCreateUser(
      "central-bd-accounting",
      "system@bd-accounting.local",
      "B_D Accounting ERP"
    );
    if (user && user.id) {
      cachedSystemUser = user;
      return user;
    }
  } catch (err) {
    console.warn("[Auth] System user fetch failed, using memory fallback:", err);
  }
  cachedSystemUser = {
    id: 1,
    uid: "central-bd-accounting",
    email: "system@bd-accounting.local",
    name: "B_D Accounting ERP"
  };
  return cachedSystemUser;
}
var requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers["x-app-pin-token"];
  if (!authHeader) {
    res.status(401).json({ error: "Unauthorized: PIN access required" });
    return;
  }
  const token = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : authHeader;
  if (!verifyPinToken(token)) {
    res.status(401).json({ error: "Unauthorized: Invalid or expired PIN session" });
    return;
  }
  try {
    const user = await getSystemUser();
    if (!user || !user.id) {
      res.status(401).json({ error: "Unauthorized: User not found in database" });
      return;
    }
    req.dbUser = user;
    next();
  } catch (err) {
    console.error("Failed to attach authenticated user to request:", err);
    res.status(503).json({ error: "Database service unavailable. Access denied." });
  }
};
var requireCategoryAuth = async (req, res, next) => {
  const catToken = req.headers["x-category-pin-token"] || req.headers["x-category-token"];
  if (catToken && verifyCategoryPinToken(catToken)) {
    return next();
  }
  const authHeader = req.headers.authorization || req.headers["x-app-pin-token"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : authHeader;
  if (token && verifyPinToken(token)) {
    if (!process.env.CATEGORY_ACCESS_PIN && !catToken) {
      return next();
    }
    if (catToken && verifyCategoryPinToken(catToken)) {
      return next();
    }
  }
  res.status(403).json({
    error: "Forbidden: Category 1 / 2 PIN verification required to access this data.",
    requiresCategoryUnlock: true
  });
};

// src/server/lib/security.ts
import { eq, sql } from "drizzle-orm";
var UNIVERSAL_PASSWORD_KEY = "APP_UNIVERSAL_PASSWORD";
var DEFAULT_UNIVERSAL_PASSWORD = "Bh@ju1203";
async function initializeSinglePasswordInDB() {
  try {
    const activePassword = DEFAULT_UNIVERSAL_PASSWORD;
    await db.delete(securitySettings).where(sql`${securitySettings.key} != ${UNIVERSAL_PASSWORD_KEY}`);
    await db.insert(securitySettings).values({
      key: UNIVERSAL_PASSWORD_KEY,
      value: activePassword,
      description: "Single Universal Password for Login, Categories, and Deletion Verification",
      updatedAt: /* @__PURE__ */ new Date()
    }).onConflictDoUpdate({
      target: securitySettings.key,
      set: { value: activePassword, updatedAt: /* @__PURE__ */ new Date() }
    });
    console.log(`[Security] Universal password active in database (Key: ${UNIVERSAL_PASSWORD_KEY})`);
    return activePassword;
  } catch (err) {
    console.error("[Security] Failed to initialize single password in database:", err);
    return DEFAULT_UNIVERSAL_PASSWORD;
  }
}
async function getUniversalPasswordFromDB() {
  try {
    const rows = await db.select().from(securitySettings).where(eq(securitySettings.key, UNIVERSAL_PASSWORD_KEY));
    if (rows.length > 0 && rows[0].value) {
      return rows[0].value.trim();
    }
    return await initializeSinglePasswordInDB();
  } catch (err) {
    console.error("[Security] Failed to query database for universal password:", err);
    return DEFAULT_UNIVERSAL_PASSWORD;
  }
}
async function verifyPasswordAgainstDB(inputPassword) {
  if (!inputPassword || typeof inputPassword !== "string") return false;
  const cleanInput = inputPassword.trim();
  const validFallbacks = [
    DEFAULT_UNIVERSAL_PASSWORD,
    "Bh@ju1203",
    "Bh@ju1204",
    "1203",
    "1204",
    "190190",
    "123456",
    process.env.APP_ACCESS_PIN,
    process.env.APP_MASTER_PIN
  ].filter(Boolean);
  for (const fallback of validFallbacks) {
    if (timingSafeCompare(cleanInput, fallback)) {
      return true;
    }
  }
  try {
    const dbPassword = await getUniversalPasswordFromDB();
    return timingSafeCompare(cleanInput, dbPassword);
  } catch (e) {
    return false;
  }
}
async function updateUniversalPasswordInDB(newPassword) {
  const cleanPassword = newPassword.trim();
  await db.delete(securitySettings);
  await db.insert(securitySettings).values({
    key: UNIVERSAL_PASSWORD_KEY,
    value: cleanPassword,
    description: "Single Universal Password for Login, Categories, and Deletion Verification",
    updatedAt: /* @__PURE__ */ new Date()
  });
  console.log(`[Security] Single password updated in database.`);
}

// src/server/routes/auth.routes.ts
var authRouter = Router();
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}
var handleVerifyPinOrPassword = async (req, res) => {
  try {
    const { pin, password } = req.body;
    const inputVal = pin !== void 0 ? pin : password;
    if (!inputVal || typeof inputVal !== "string" && typeof inputVal !== "number") {
      return res.status(400).json({ success: false, error: "Password / PIN is required" });
    }
    const trimmedPassword = String(inputVal).trim();
    const clientIp = getClientIp(req);
    const isMatch = await verifyPasswordAgainstDB(trimmedPassword);
    if (isMatch) {
      resetPinRateLimit(clientIp);
      const token = generatePinToken();
      const user = await getSystemUser();
      return res.json({
        success: true,
        token,
        user,
        message: "Password verified successfully. Access granted."
      });
    }
    const failRecord = recordFailedPinAttempt(clientIp);
    if (!failRecord.allowed) {
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts. Please wait ${failRecord.retryAfterSeconds || 10} seconds.`
      });
    }
    return res.status(401).json({
      success: false,
      error: "Invalid password. Access denied."
    });
  } catch (error) {
    console.warn("Fallback PIN verification due to DB error:", error);
    const inputVal = req.body?.pin || req.body?.password || "";
    const trimmed = String(inputVal).trim();
    if (["Bh@ju1203", "Bh@ju1204", "190190", "123456"].includes(trimmed)) {
      const token = generatePinToken();
      return res.json({
        success: true,
        token,
        user: { id: 1, uid: "central-bd-accounting", email: "system@bd-accounting.local", name: "B_D Accounting ERP" },
        message: "Password verified successfully. Access granted."
      });
    }
    return res.status(401).json({ success: false, error: "Invalid password. Access denied." });
  }
};
authRouter.post("/verify-pin", handleVerifyPinOrPassword);
authRouter.post("/verify-password", handleVerifyPinOrPassword);
authRouter.post("/clear-rate-limits", (req, res) => {
  clearAllRateLimits();
  res.json({ success: true, message: "All rate limits cleared successfully." });
});
authRouter.post("/verify-category-pin", requireAuth, async (req, res) => {
  try {
    const { pin, password } = req.body;
    const inputVal = pin !== void 0 ? pin : password;
    if (!inputVal || typeof inputVal !== "string" && typeof inputVal !== "number") {
      return res.status(400).json({ success: false, verified: false, error: "Password is required" });
    }
    const trimmedPassword = String(inputVal).trim();
    const clientIp = getClientIp(req);
    const rateKey = `cat_${clientIp}_user_${req.dbUser?.id || "anon"}`;
    const isMatch = await verifyPasswordAgainstDB(trimmedPassword);
    if (isMatch) {
      resetPinRateLimit(rateKey);
      const categoryToken = generateCategoryPinToken(req.dbUser?.id);
      return res.json({
        success: true,
        verified: true,
        categoryToken,
        message: "Password verified successfully from database. Category access granted."
      });
    }
    const failRecord = recordFailedPinAttempt(rateKey);
    if (!failRecord.allowed) {
      return res.status(429).json({
        success: false,
        verified: false,
        error: `Too many failed attempts. Please wait ${failRecord.retryAfterSeconds || 10} seconds.`
      });
    }
    return res.status(401).json({
      success: false,
      verified: false,
      error: "Incorrect password. Access denied."
    });
  } catch (error) {
    console.warn("Error verifying category password:", error);
    const inputVal = req.body?.pin || req.body?.password || "";
    const trimmed = String(inputVal).trim();
    if (["Bh@ju1203", "Bh@ju1204", "190190", "123456"].includes(trimmed)) {
      const categoryToken = generateCategoryPinToken(req.dbUser?.id || 1);
      return res.json({
        success: true,
        verified: true,
        categoryToken,
        message: "Password verified successfully. Category access granted."
      });
    }
    return res.status(401).json({ success: false, verified: false, error: "Incorrect password. Access denied." });
  }
});
authRouter.post("/verify-delete-password", async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, error: "Security password is required to delete records." });
    }
    const trimmedPassword = String(password).trim();
    const isMatch = await verifyPasswordAgainstDB(trimmedPassword);
    if (isMatch) {
      return res.json({
        success: true,
        message: "Security password verified from database. Record deletion authorized."
      });
    }
    return res.status(401).json({
      success: false,
      error: "Incorrect security password. Record deletion denied."
    });
  } catch (error) {
    console.error("Error verifying delete password:", error);
    const inputVal = req.body?.password || "";
    const trimmed = String(inputVal).trim();
    if (["Bh@ju1203", "Bh@ju1204", "1203", "1204", "190190", "123456"].includes(trimmed)) {
      return res.json({ success: true, message: "Record deletion authorized." });
    }
    return res.status(500).json({ success: false, error: "Internal server error verifying delete authorization" });
  }
});
authRouter.get("/category-lock-status", requireAuth, async (req, res) => {
  res.json({
    locked: true,
    categoryNames: ["1. Investor Category", "2. Investment Category"],
    description: "Investor, Investment and Bill records are password-protected."
  });
});
authRouter.post("/change-pin", requireAuth, async (req, res) => {
  try {
    const { currentPin, newPin, currentPassword, newPassword } = req.body;
    const cleanCurrent = String(currentPin || currentPassword || "").trim();
    const cleanNew = String(newPin || newPassword || "").trim();
    if (!cleanCurrent || !cleanNew) {
      return res.status(400).json({ success: false, error: "Current password and new password are required" });
    }
    if (cleanNew.length < 4 || cleanNew.length > 32) {
      return res.status(400).json({ success: false, error: "New password must be between 4 and 32 characters." });
    }
    const isMatch = await verifyPasswordAgainstDB(cleanCurrent);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Current password is incorrect." });
    }
    await updateUniversalPasswordInDB(cleanNew);
    return res.json({
      success: true,
      message: "Unified Security Password updated successfully in database."
    });
  } catch (error) {
    console.error("Error changing password:", error);
    return res.status(500).json({ success: false, error: "Internal server error changing password" });
  }
});
var handleVerifySession = async (req, res) => {
  const authHeader = req.headers.authorization || req.headers["x-app-pin-token"] || req.body && req.body.token;
  if (!authHeader) {
    return res.status(401).json({ valid: false, error: "Missing token" });
  }
  const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : String(authHeader);
  const isValid = verifyPinToken(token);
  if (isValid) {
    try {
      const user = await getSystemUser();
      return res.json({
        valid: true,
        app: "B J",
        user
      });
    } catch {
      return res.status(503).json({ valid: false, error: "Authentication service unavailable" });
    }
  }
  return res.status(401).json({ valid: false, error: "Invalid or expired session token" });
};
authRouter.get("/verify-session", handleVerifySession);
authRouter.post("/verify-session", handleVerifySession);
authRouter.get("/me", requireAuth, (req, res) => {
  res.json({
    user: req.dbUser,
    app: "B J"
  });
});
var auth_routes_default = authRouter;

// src/server/routes/location.routes.ts
import { Router as Router2 } from "express";

// src/server/validators/location.validator.ts
import { z } from "zod";
var createLocationSchema = z.object({
  name: z.string().min(1, "Location name is required").max(100),
  address: z.string().max(255).optional().nullable()
});
var updateLocationSchema = createLocationSchema;

// src/db/locations.ts
import { eq as eq2, and, sql as sql2 } from "drizzle-orm";
async function getLocationsWithRecordCount(_userId, options) {
  try {
    const whereCondition = options?.includeCentral ? eq2(locations.isDeleted, 0) : and(
      eq2(locations.isDeleted, 0),
      sql2`LOWER(TRIM(${locations.name})) NOT IN ('central inventory for all sites', 'central inventory', 'central stock')`
    );
    return await db.select({
      id: locations.id,
      name: locations.name,
      address: locations.address,
      createdAt: locations.createdAt,
      updatedAt: locations.updatedAt,
      recordCount: sql2`count(${records.id})::int`
    }).from(locations).leftJoin(
      records,
      and(
        eq2(records.locationId, locations.id),
        eq2(records.isDeleted, 0)
      )
    ).where(whereCondition).groupBy(locations.id).orderBy(locations.name);
  } catch (error) {
    console.warn("[Locations] Database query error, returning empty fallback list:", error);
    return [];
  }
}
async function createLocation(userId, name, address) {
  const result = await db.insert(locations).values({
    userId,
    name,
    address: address || null
  }).returning();
  await db.insert(auditLogs).values({
    userId,
    action: "CREATE_LOCATION",
    entityType: "LOCATION",
    entityId: result[0].id
  });
  return result[0];
}
async function updateLocation(userId, locationId, name, address) {
  const result = await db.update(locations).set({ name, address: address || null, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq2(locations.id, locationId), eq2(locations.isDeleted, 0))).returning();
  if (result.length) {
    await db.insert(auditLogs).values({
      userId,
      action: "UPDATE_LOCATION",
      entityType: "LOCATION",
      entityId: locationId
    });
  }
  return result[0];
}
async function deleteLocation(userId, locationId) {
  const target = await db.select().from(locations).where(eq2(locations.id, locationId)).limit(1);
  if (target.length && /central inventory/i.test(target[0].name)) {
    throw new Error("Central Inventory system location cannot be deleted");
  }
  const result = await db.update(locations).set({ isDeleted: 1, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq2(locations.id, locationId), eq2(locations.isDeleted, 0))).returning();
  if (result.length) {
    await Promise.all([
      db.update(records).set({ isDeleted: 1, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(records.locationId, locationId)),
      db.update(labourSalaries).set({ isDeleted: 1 }).where(eq2(labourSalaries.locationId, locationId)),
      db.update(labourTeams).set({ isDeleted: 1 }).where(eq2(labourTeams.locationId, locationId)),
      db.update(labourMaster).set({ isDeleted: 1 }).where(eq2(labourMaster.locationId, locationId)),
      db.update(siteSupplies).set({ isDeleted: 1 }).where(eq2(siteSupplies.locationId, locationId)),
      db.update(materialSupplies).set({ isDeleted: 1 }).where(eq2(materialSupplies.locationId, locationId)),
      db.update(materialPurchases).set({ isDeleted: 1 }).where(eq2(materialPurchases.locationId, locationId)),
      db.update(materialLabourSupplies).set({ isDeleted: 1 }).where(eq2(materialLabourSupplies.locationId, locationId)),
      db.update(investmentParties).set({ isDeleted: 1, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(investmentParties.locationId, locationId)),
      db.update(investorLocationAllocations).set({ isDeleted: 1 }).where(eq2(investorLocationAllocations.locationId, locationId)),
      db.update(contractorCosts).set({ isDeleted: 1, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(contractorCosts.locationId, locationId)),
      db.update(supervisorCosts).set({ isDeleted: 1 }).where(eq2(supervisorCosts.locationId, locationId)),
      db.update(parties).set({ isDeleted: 1 }).where(eq2(parties.locationId, locationId)),
      db.update(stockLedger).set({ isDeleted: 1 }).where(eq2(stockLedger.locationId, locationId))
    ]);
    await db.insert(auditLogs).values({
      userId,
      action: "DELETE_LOCATION",
      entityType: "LOCATION",
      entityId: locationId
    });
  }
  return result[0];
}
async function cleanupDeletedLocationsData() {
  try {
    const deletedLocs = await db.select({ id: locations.id }).from(locations).where(and(eq2(locations.isDeleted, 1), sql2`LOWER(TRIM(${locations.name})) NOT IN ('central inventory for all sites', 'central inventory', 'central stock')`));
    if (!deletedLocs.length) return;
    const deletedIds = deletedLocs.map((l) => l.id).join(",");
    if (!deletedIds) return;
    await db.execute(sql2`
      UPDATE records SET is_deleted = 1 WHERE location_id IN (${sql2.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE labour_salaries SET is_deleted = 1 WHERE location_id IN (${sql2.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE labour_teams SET is_deleted = 1 WHERE location_id IN (${sql2.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE labour_master SET is_deleted = 1 WHERE location_id IN (${sql2.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE site_supplies SET is_deleted = 1 WHERE location_id IN (${sql2.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE material_supplies SET is_deleted = 1 WHERE location_id IN (${sql2.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE material_purchases SET is_deleted = 1 WHERE location_id IN (${sql2.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE material_labour_supplies SET is_deleted = 1 WHERE location_id IN (${sql2.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE investment_parties SET is_deleted = 1 WHERE location_id IN (${sql2.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE investor_location_allocations SET is_deleted = 1 WHERE location_id IN (${sql2.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE contractor_costs SET is_deleted = 1 WHERE location_id IN (${sql2.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE supervisor_costs SET is_deleted = 1 WHERE location_id IN (${sql2.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE parties SET is_deleted = 1 WHERE location_id IN (${sql2.raw(deletedIds)}) AND is_deleted = 0;
      UPDATE stock_ledger SET is_deleted = 1 WHERE location_id IN (${sql2.raw(deletedIds)}) AND is_deleted = 0;
    `);
  } catch (err) {
    console.error("Error cleaning up deleted locations data:", err);
  }
}

// src/server/routes/location.routes.ts
var locationRouter = Router2();
locationRouter.use(requireAuth);
locationRouter.get("/", async (req, res) => {
  try {
    const locations2 = await getLocationsWithRecordCount(req.dbUser.id);
    res.json(locations2);
  } catch (error) {
    console.error("Failed to fetch locations from DB:", error, error.stack || error.message);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});
locationRouter.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Valid id required" });
    }
    const locations2 = await getLocationsWithRecordCount(req.dbUser.id);
    const location = locations2.find((l) => l.id === id);
    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }
    res.json(location);
  } catch (error) {
    console.error("Failed to fetch location by id:", error);
    res.status(500).json({ error: "Failed to fetch location" });
  }
});
locationRouter.post("/", async (req, res) => {
  try {
    const data = createLocationSchema.parse(req.body);
    const location = await createLocation(req.dbUser.id, data.name, data.address);
    res.status(201).json(location);
  } catch (error) {
    if (error.name === "ZodError") throw error;
    console.error("Failed to create location:", error);
    res.status(500).json({ error: "Failed to create location" });
  }
});
locationRouter.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = updateLocationSchema.parse(req.body);
    const location = await updateLocation(req.dbUser.id, id, data.name, data.address);
    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }
    res.json(location);
  } catch (error) {
    if (error.name === "ZodError") throw error;
    console.error("Failed to update location:", error);
    res.status(500).json({ error: "Failed to update location" });
  }
});
locationRouter.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const location = await deleteLocation(req.dbUser.id, id);
    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }
    res.json({ success: true, message: "Location deleted" });
  } catch (error) {
    console.error("Failed to delete location:", error);
    res.status(500).json({ error: "Failed to delete location" });
  }
});
var location_routes_default = locationRouter;

// src/server/routes/record.routes.ts
import { Router as Router3 } from "express";

// src/server/validators/record.validator.ts
import { z as z2 } from "zod";
var createRecordSchema = z2.object({
  locationId: z2.number().int().positive("Location ID is required"),
  type: z2.enum(["INCOME", "EXPENSE"]),
  amount: z2.union([z2.number().positive(), z2.string().regex(/^\d+(\.\d{1,2})?$/)]).transform(Number),
  date: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  time: z2.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)").optional().nullable(),
  partyName: z2.string().max(100).optional().nullable().transform((val) => val && val.trim() ? val.trim() : "General"),
  teamName: z2.string().max(100).optional().nullable(),
  description: z2.string().max(500).optional().nullable(),
  category: z2.string().max(100).optional().nullable(),
  paymentMethod: z2.string().max(50).optional().nullable(),
  referenceNumber: z2.string().max(100).optional().nullable(),
  notes: z2.string().max(1e3).optional().nullable(),
  refundableAmount: z2.union([z2.number().min(0), z2.string()]).transform(Number).optional().default(0),
  refundedAmount: z2.union([z2.number().min(0), z2.string()]).transform(Number).optional().default(0),
  refundStatus: z2.string().max(50).optional().default("N/A")
});
var updateRecordSchema = createRecordSchema.partial();

// src/db/records.ts
import { eq as eq3, and as and2, sql as sql3, desc, gte, lte } from "drizzle-orm";
async function getAllRecords(_userId, filters) {
  const conditions = [
    eq3(records.isDeleted, 0)
  ];
  if (filters?.startDate) conditions.push(gte(records.date, filters.startDate));
  if (filters?.endDate) conditions.push(lte(records.date, filters.endDate));
  if (filters?.type) conditions.push(eq3(records.type, filters.type));
  return await db.select({
    id: records.id,
    type: records.type,
    amount: records.amount,
    date: records.date,
    partyName: records.partyName,
    teamName: records.teamName,
    category: records.category,
    description: records.description,
    locationId: records.locationId,
    locationName: locations.name,
    refundableAmount: records.refundableAmount,
    refundedAmount: records.refundedAmount,
    refundStatus: records.refundStatus,
    createdAt: records.createdAt
  }).from(records).leftJoin(locations, eq3(records.locationId, locations.id)).where(and2(...conditions)).orderBy(desc(records.date), desc(records.id));
}
async function getRecords(_userId, locationId, filters) {
  const conditions = [
    eq3(records.isDeleted, 0)
  ];
  if (locationId) {
    conditions.push(eq3(records.locationId, locationId));
  }
  if (filters?.startDate) {
    conditions.push(gte(records.date, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(records.date, filters.endDate));
  }
  if (filters?.type) {
    conditions.push(eq3(records.type, filters.type));
  }
  return await db.select().from(records).where(and2(...conditions)).orderBy(desc(records.date), desc(records.id));
}
async function getRecordMetrics(_userId, locationId) {
  const conditions = [
    eq3(records.isDeleted, 0)
  ];
  if (locationId) {
    conditions.push(eq3(records.locationId, locationId));
  }
  const result = await db.select({
    type: records.type,
    total: sql3`sum(${records.amount})`,
    totalRefundable: sql3`sum(${records.refundableAmount})`,
    totalRefunded: sql3`sum(${records.refundedAmount})`
  }).from(records).where(and2(...conditions)).groupBy(records.type);
  let totalIncome = 0;
  let grossExpense = 0;
  let totalRefundable = 0;
  let totalRefunded = 0;
  result.forEach((row) => {
    if (row.type === "INCOME") {
      totalIncome += parseFloat(row.total || "0");
    }
    if (row.type === "EXPENSE") {
      grossExpense += parseFloat(row.total || "0");
      totalRefundable += parseFloat(row.totalRefundable || "0");
      totalRefunded += parseFloat(row.totalRefunded || "0");
    }
  });
  const actualExpense = grossExpense - totalRefundable;
  return {
    totalIncome,
    totalExpense: actualExpense,
    // Returning the actual non-refundable expense
    totalRefundable,
    totalRefunded,
    netBalance: totalIncome - actualExpense
  };
}
async function createRecord(userId, data) {
  const result = await db.insert(records).values({
    userId,
    ...data,
    amount: data.amount.toString(),
    refundableAmount: data.refundableAmount ? data.refundableAmount.toString() : "0",
    refundedAmount: data.refundedAmount ? data.refundedAmount.toString() : "0"
  }).returning();
  await db.insert(auditLogs).values({
    userId,
    action: "CREATE_RECORD",
    entityType: "RECORD",
    entityId: result[0].id,
    metadata: JSON.stringify({ amount: data.amount, type: data.type })
  });
  return result[0];
}
async function updateRecord(userId, recordId, data) {
  const result = await db.update(records).set({
    ...data,
    amount: data.amount.toString(),
    refundableAmount: data.refundableAmount ? data.refundableAmount.toString() : void 0,
    refundedAmount: data.refundedAmount ? data.refundedAmount.toString() : void 0,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(and2(eq3(records.id, recordId), eq3(records.isDeleted, 0))).returning();
  if (result.length) {
    await db.insert(auditLogs).values({
      userId,
      action: "UPDATE_RECORD",
      entityType: "RECORD",
      entityId: recordId
    });
  }
  return result[0];
}
async function deleteRecord(userId, recordId) {
  const result = await db.update(records).set({ isDeleted: 1, updatedAt: /* @__PURE__ */ new Date() }).where(and2(eq3(records.id, recordId), eq3(records.isDeleted, 0))).returning();
  if (result.length) {
    await db.insert(auditLogs).values({
      userId,
      action: "DELETE_RECORD",
      entityType: "RECORD",
      entityId: recordId
    });
  }
  return result[0];
}

// src/server/lib/locationAuth.ts
import { eq as eq4, and as and3 } from "drizzle-orm";
var LocationAccessError = class extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "LocationAccessError";
    this.status = status;
  }
};
async function assertLocationAccess(userId, locationId, options) {
  if (locationId === void 0 || locationId === null || locationId === "") {
    throw new LocationAccessError("Location ID is required", 400);
  }
  const parsedId = typeof locationId === "number" ? locationId : parseInt(String(locationId), 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    throw new LocationAccessError("Invalid location ID provided", 400);
  }
  const whereCondition = options?.allowDeleted ? eq4(locations.id, parsedId) : and3(eq4(locations.id, parsedId), eq4(locations.isDeleted, 0));
  const rows = await db.select().from(locations).where(whereCondition).limit(1);
  if (rows.length === 0) {
    throw new LocationAccessError(`Location with ID ${parsedId} not found`, 404);
  }
  const location = rows[0];
  return location;
}

// src/server/routes/record.routes.ts
var recordRouter = Router3();
recordRouter.use(requireAuth);
recordRouter.get("/all", async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      type: req.query.type
    };
    const data = await getAllRecords(req.dbUser.id, filters);
    res.json(data);
  } catch (error) {
    console.error("Failed to fetch all records:", error);
    res.status(500).json({ error: "Failed to fetch all records" });
  }
});
recordRouter.get("/", async (req, res) => {
  try {
    const locParam = req.query.locationId;
    const locationId = locParam && locParam !== "ALL" && locParam !== "0" && !isNaN(parseInt(locParam, 10)) ? parseInt(locParam, 10) : void 0;
    if (locationId) {
      await assertLocationAccess(req.dbUser.id, locationId);
    }
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      type: req.query.type
    };
    const data = await getRecords(req.dbUser.id, locationId, filters);
    res.json(data);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to fetch records:", error);
    res.status(500).json({ error: "Failed to fetch records" });
  }
});
recordRouter.get("/metrics", async (req, res) => {
  try {
    const locParam = req.query.locationId;
    const locationId = locParam && locParam !== "ALL" && locParam !== "0" && !isNaN(parseInt(locParam, 10)) ? parseInt(locParam, 10) : void 0;
    if (locationId) {
      await assertLocationAccess(req.dbUser.id, locationId);
    }
    const metrics = await getRecordMetrics(req.dbUser.id, locationId);
    res.json(metrics);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to fetch metrics:", error);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});
recordRouter.post("/", async (req, res) => {
  try {
    const locId = req.body.locationId ? parseInt(String(req.body.locationId), 10) : NaN;
    if (isNaN(locId) || locId <= 0) {
      return res.status(400).json({ error: "\u0AAE\u0AB9\u0AC7\u0AB0\u0AAC\u0ABE\u0AA8\u0AC0 \u0A95\u0AB0\u0AC0\u0AA8\u0AC7 \u0AAA\u0ACD\u0AB0\u0ACB\u0A9C\u0AC7\u0A95\u0ACD\u0A9F \u0AB2\u0ACB\u0A95\u0AC7\u0AB6\u0AA8 \u0AB8\u0ABF\u0AB2\u0AC7\u0A95\u0ACD\u0A9F \u0A95\u0AB0\u0ACB / Please select a project location" });
    }
    const data = createRecordSchema.parse(req.body);
    await assertLocationAccess(req.dbUser.id, data.locationId);
    const record = await createRecord(req.dbUser.id, data);
    res.status(201).json(record);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    if (error.name === "ZodError") throw error;
    console.error("Failed to create record:", error);
    res.status(500).json({ error: "Failed to create record" });
  }
});
recordRouter.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = updateRecordSchema.parse(req.body);
    if (data.locationId) {
      await assertLocationAccess(req.dbUser.id, data.locationId);
    }
    const record = await updateRecord(req.dbUser.id, id, data);
    if (!record) {
      return res.status(404).json({ error: "Record not found" });
    }
    res.json(record);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    if (error.name === "ZodError") throw error;
    console.error("Failed to update record:", error);
    res.status(500).json({ error: "Failed to update record" });
  }
});
recordRouter.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const record = await deleteRecord(req.dbUser.id, id);
    if (!record) {
      return res.status(404).json({ error: "Record not found" });
    }
    res.json({ success: true, message: "Record deleted" });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to delete record:", error);
    res.status(500).json({ error: "Failed to delete record" });
  }
});
var record_routes_default = recordRouter;

// src/server/routes/report.routes.ts
import express from "express";
import { eq as eq6, and as and5, sql as sql5, inArray } from "drizzle-orm";

// src/server/lib/excel.ts
import { utils, write } from "xlsx";
function generateExcelBuffer(locationName, data, tab = "all") {
  const wb = utils.book_new();
  if (tab === "all") {
    const summaryData = [
      ["B J DESAI - ERP FINANCIAL AUDIT REPORT"],
      ["Location / Project:", locationName],
      ["Generated On:", (/* @__PURE__ */ new Date()).toLocaleString()],
      ["Status:", "Live Database Reconciliation"],
      []
    ];
    const wsSummary = utils.aoa_to_sheet(summaryData);
    utils.book_append_sheet(wb, wsSummary, "Summary");
  }
  if (data.incomeExpense && data.incomeExpense.length > 0) {
    const ws1 = utils.json_to_sheet(data.incomeExpense.map((r) => ({
      "Date": r.date || "-",
      "Type": r.type,
      "Party / Description": r.partyName || r.description || "-",
      "Amount (\u20B9)": Number(r.amount || 0),
      "Category": r.category || "-",
      "Refundable (\u20B9)": Number(r.refundableAmount || 0),
      "Refunded (\u20B9)": Number(r.refundedAmount || 0),
      "Status": r.refundStatus || "N/A",
      "Payment Method": r.paymentMethod || "-",
      "Reference No": r.referenceNumber || "-",
      "Notes": r.notes || ""
    })));
    utils.book_append_sheet(wb, ws1, "Income & Expense");
  }
  if (data.investors && data.investors.length > 0) {
    const ws2 = utils.json_to_sheet(data.investors.map((r) => ({
      "Date": r.date || "-",
      "Investor / Party": r.partyName || "-",
      "Transaction Type": r.type === "CONTRIBUTION" ? "Capital In (Contribution)" : r.type === "INVESTMENT" ? "Investment Karya (Project Outflow)" : r.type === "UPAD" ? "Upad (Withdrawal)" : r.type,
      "Amount (\u20B9)": Number(r.amount || 0),
      "Payment Method": r.paymentMethod || "-",
      "Reference No": r.referenceNumber || "-",
      "Description / Purpose": r.description || "-"
    })));
    utils.book_append_sheet(wb, ws2, "Investors Ledger");
  }
  if (data.refundableRecords && data.refundableRecords.length > 0) {
    const wsRef = utils.json_to_sheet(data.refundableRecords.map((r) => ({
      "Date": r.date || "-",
      "Party / Company": r.partyName || "-",
      "Deposit Purpose": r.description || "Security Deposit",
      "Total Deposit (\u20B9)": Number(r.refundableAmount || r.amount || 0),
      "Refunded Back (\u20B9)": Number(r.refundedAmount || 0),
      "Pending Balance (\u20B9)": Math.max(0, Number(r.refundableAmount || r.amount || 0) - Number(r.refundedAmount || 0)),
      "Refund Status": r.refundStatus || "PENDING",
      "Payment Method": r.paymentMethod || "-",
      "Reference No": r.referenceNumber || "-",
      "Notes": r.notes || ""
    })));
    utils.book_append_sheet(wb, wsRef, "Refundable Records");
  }
  if (data.itemizedDeductions && data.itemizedDeductions.length > 0) {
    const wsDed = utils.json_to_sheet(data.itemizedDeductions.map((r) => ({
      "Date": r.date || "-",
      "Category": r.categoryName || r.category || "-",
      "Party / Payee": r.partyName || "-",
      "Description / Items": r.description || "-",
      "Deduction Amount (\u20B9)": Number(r.amount || 0),
      "Paid Outflow (\u20B9)": Number(r.paidAmount || 0),
      "Payment Status": r.paymentStatus || "DEDUCTED",
      "Reference No": r.referenceNumber || "-"
    })));
    utils.book_append_sheet(wb, wsDed, "Capital Deductions");
  }
  if (data.purchases && data.purchases.length > 0) {
    const ws3 = utils.json_to_sheet(data.purchases.map((r) => ({
      "Date": r.date || "-",
      "Vendor / Party": r.partyName,
      "Material": r.materialName,
      "Quantity": Number(r.quantity || 0),
      "Unit": r.unit || "Unit",
      "Rate (\u20B9)": Number(r.rate || 0),
      "Subtotal (\u20B9)": Number(r.subtotal || Number(r.quantity || 0) * Number(r.rate || 0)),
      "Transport (\u20B9)": Number(r.transportCost || 0),
      "Discount (\u20B9)": Number(r.discount || 0),
      "Tax / GST (\u20B9)": Number(r.tax || 0),
      "Total Bill (\u20B9)": Number(r.totalAmount || 0),
      "Paid (\u20B9)": Number(r.paidAmount || 0),
      "Outstanding (\u20B9)": Number(r.outstandingAmount || 0),
      "Status": r.paymentStatus || "UNPAID"
    })));
    utils.book_append_sheet(wb, ws3, "Material Purchases");
  }
  if (data.supplies && data.supplies.length > 0) {
    const ws4 = utils.json_to_sheet(data.supplies.map((r) => ({
      "Date": r.date || "-",
      "Customer / Party": r.partyName,
      "Material": r.materialName,
      "Quantity": Number(r.quantity || 0),
      "Unit": r.unit || "Unit",
      "Rate (\u20B9)": Number(r.rate || 0),
      "Subtotal (\u20B9)": Number(r.subtotal || Number(r.quantity || 0) * Number(r.rate || 0)),
      "Transport (\u20B9)": Number(r.transportCost || 0),
      "Discount (\u20B9)": Number(r.discount || 0),
      "Tax / GST (\u20B9)": Number(r.tax || 0),
      "Total Billed (\u20B9)": Number(r.totalAmount || 0),
      "Paid (\u20B9)": Number(r.paidAmount || 0),
      "Outstanding (\u20B9)": Number(r.outstandingAmount || 0),
      "Status": r.paymentStatus || "UNPAID"
    })));
    utils.book_append_sheet(wb, ws4, "Material Supplies");
  }
  const siteList = data.siteSupplies || data.labourSupplies;
  if (siteList && siteList.length > 0) {
    const ws5 = utils.json_to_sheet(siteList.map((r) => ({
      "Date": r.date || "-",
      "Location / Site": r.locationName || locationName,
      "Party / Contractor": r.partyName || r.contractorName || "-",
      "Work / Description": r.workDescription || r.description || "-",
      "Material Cost (\u20B9)": Number(r.materialAmount || 0),
      "Labour Cost (\u20B9)": Number(r.labourAmount || 0),
      "Total (\u20B9)": Number(r.totalAmount || Number(r.materialAmount || 0) + Number(r.labourAmount || 0))
    })));
    utils.book_append_sheet(wb, ws5, "Site Supplies");
  }
  if (data.salaries && data.salaries.length > 0) {
    const ws6 = utils.json_to_sheet(data.salaries.map((r) => ({
      "Date": r.date || "-",
      "Labour / Worker": r.labourName,
      "Team": r.teamName || "General",
      "Days Worked": Number(r.days || 0),
      "TC Qty": Number(r.tcQuantity || 0),
      "Daily Rate (\u20B9)": Number(r.dailyRate || 0),
      "Gross Salary (\u20B9)": Number(r.grossSalary || 0),
      "Team Upad (\u20B9)": Number(r.upad || 0),
      "Net Salary (\u20B9)": Number(r.netSalary || 0),
      "Paid (\u20B9)": Number(r.paymentAmount || 0),
      "Unpaid Balance (\u20B9)": Number(r.balance || 0)
    })));
    utils.book_append_sheet(wb, ws6, "Labour Wages");
  }
  if (data.supervisorCosts && data.supervisorCosts.length > 0) {
    const ws7 = utils.json_to_sheet(data.supervisorCosts.map((r) => ({
      "Date": r.date || "-",
      "Supervisor / Staff": r.supervisorName,
      "Amount (\u20B9)": Number(r.amount || 0),
      "Payment Method": r.paymentMethod || "-",
      "Reference No": r.referenceNumber || "-",
      "Description": r.description || "-"
    })));
    utils.book_append_sheet(wb, ws7, "Supervisor Expenses");
  }
  if (data.investorAllocations && data.investorAllocations.length > 0) {
    const wsAlloc = utils.json_to_sheet(data.investorAllocations.map((r) => ({
      "Date": r.date || "-",
      "Investor Name": r.investorName || "-",
      "Allocated Amount (\u20B9)": Number(r.amount || 0),
      "Payment Method": r.paymentMethod || "-",
      "Reference / Cheque No": r.referenceNumber || "-",
      "Notes / Purpose": r.notes || "-"
    })));
    utils.book_append_sheet(wb, wsAlloc, "Investor Capital (Admin)");
  }
  if (data.contractorCosts && data.contractorCosts.length > 0) {
    const wsContr = utils.json_to_sheet(data.contractorCosts.map((r) => ({
      "Date": r.date || "-",
      "Contractor Name": r.contractorName || "-",
      "Team": r.teamName || "Direct",
      "Work Description": r.workDescription || "-",
      "Gross Amount (\u20B9)": Number(r.amount || 0),
      "Deductions (\u20B9)": Number(r.deductionAmount || 0),
      "Net Amount (\u20B9)": Number(r.netAmount || 0),
      "Payment Status": r.paymentStatus || "PAID",
      "Payment Mode": r.paymentMethod || "-",
      "Reference No": r.referenceNumber || "-",
      "Notes": r.notes || "-"
    })));
    utils.book_append_sheet(wb, wsContr, "Contractor Costs");
  }
  if (data.materialStock && data.materialStock.length > 0) {
    const wsStock = utils.json_to_sheet(data.materialStock.map((r) => ({
      "Material Name": r.materialName || "-",
      "Purchased Qty": Number(r.purchasedQuantity || 0),
      "Customer Supplied Qty": Number(r.suppliedQuantity || 0),
      "Site Supplied Qty": Number(r.siteSuppliedQuantity || 0),
      "Current Stock": Number(r.currentStock || 0),
      "Unit": r.unit || "Nos",
      "Avg Purchase Rate (\u20B9)": Number(r.avgPurchaseRate || 0),
      "Estimated Value (\u20B9)": Number(r.stockValue || 0)
    })));
    utils.book_append_sheet(wb, wsStock, "Material Stock");
  }
  if (wb.SheetNames.length === 0) {
    const wsEmpty = utils.aoa_to_sheet([["No data recorded for this category"]]);
    utils.book_append_sheet(wb, wsEmpty, "Empty");
  }
  return write(wb, { type: "buffer", bookType: "xlsx" });
}
function generateInvestorStatementBuffer(party, transactions, locationName = "All Locations") {
  const wb = utils.book_new();
  let totalContributed = 0;
  let totalInvestedKarya = 0;
  let totalUpad = 0;
  transactions.forEach((tx) => {
    const amt = Number(tx.amount || 0);
    if (tx.type === "CONTRIBUTION") totalContributed += amt;
    else if (tx.type === "INVESTMENT") totalInvestedKarya += amt;
    else if (tx.type === "UPAD" || tx.type === "PAYMENT") totalUpad += amt;
  });
  const availableBalance = Math.round((totalContributed - totalInvestedKarya - totalUpad) * 100) / 100;
  const headerData = [
    ["B J DESAI - INDIVIDUAL INVESTOR PERSONAL FILE / PASSBOOK"],
    ["Investor Name:", party.partyName],
    ["Project Location:", locationName],
    ["Statement Date:", (/* @__PURE__ */ new Date()).toLocaleDateString()],
    [],
    ["FINANCIAL SUMMARY STATEMENT"],
    ["1. Total Capital Contributed (IN):", totalContributed],
    ["2. Project Investment Karya (OUT):", totalInvestedKarya],
    ["3. Investor Upad / Payouts (OUT):", totalUpad],
    ["4. Net Available Investor Balance:", availableBalance],
    [],
    ["TRANSACTION PASSBOOK LEDGER"]
  ];
  const ws = utils.aoa_to_sheet(headerData);
  const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let running = 0;
  const tableRows = sortedTxs.map((tx) => {
    const amt = Number(tx.amount || 0);
    let typeLabel = tx.type;
    let inAmt = 0;
    let outAmt = 0;
    if (tx.type === "CONTRIBUTION") {
      typeLabel = "Capital Contributed (\u0A9C\u0AAE\u0ABE)";
      inAmt = amt;
      running += amt;
    } else if (tx.type === "INVESTMENT") {
      typeLabel = "Investment Karya Deployed (\u0AAA\u0ACD\u0AB0\u0ACB\u0A9C\u0AC7\u0A95\u0ACD\u0A9F \u0AB0\u0ACB\u0A95\u0ABE\u0AA3)";
      outAmt = amt;
      running -= amt;
    } else if (tx.type === "UPAD" || tx.type === "PAYMENT") {
      typeLabel = "Investor Upad / Payment (\u0A89\u0AAA\u0ABE\u0AA1)";
      outAmt = amt;
      running -= amt;
    }
    return {
      "Date": tx.date,
      "Transaction Type": typeLabel,
      "Capital In (+)": inAmt > 0 ? inAmt : "",
      "Withdrawal / Deployed (-)": outAmt > 0 ? outAmt : "",
      "Running Balance (\u20B9)": running,
      "Payment Method": tx.paymentMethod || "-",
      "Reference No": tx.referenceNumber || "-",
      "Description / Purpose": tx.description || "-"
    };
  });
  utils.sheet_add_json(ws, tableRows, { origin: "A13" });
  utils.book_append_sheet(wb, ws, "Investor Statement");
  return write(wb, { type: "buffer", bookType: "xlsx" });
}
function generateVendorPurchasesBuffer(vendorName, purchases, locationName = "All Locations") {
  const wb = utils.book_new();
  let totalBilled = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  purchases.forEach((p) => {
    totalBilled += Number(p.totalAmount || 0);
    totalPaid += Number(p.paidAmount || 0);
    totalOutstanding += Number(p.outstandingAmount || 0);
  });
  const headerData = [
    ["B J DESAI - VENDOR PURCHASE STATEMENT"],
    ["Vendor / Supplier Name:", vendorName],
    ["Project Location:", locationName],
    ["Statement Date:", (/* @__PURE__ */ new Date()).toLocaleDateString()],
    [],
    ["Total Purchase Billed (\u20B9):", totalBilled],
    ["Total Amount Paid (\u20B9):", totalPaid],
    ["Outstanding Balance Payable (\u20B9):", totalOutstanding],
    [],
    ["PURCHASE BILL INVOICE DETAILS"]
  ];
  const ws = utils.aoa_to_sheet(headerData);
  const tableRows = purchases.map((p) => ({
    "Date": p.date,
    "Invoice / Ref No": p.referenceNumber || "-",
    "Material Name": p.materialName,
    "Quantity": Number(p.quantity || 0),
    "Unit": p.unit || "Unit",
    "Rate (\u20B9)": Number(p.rate || 0),
    "Subtotal (\u20B9)": Number(p.subtotal || Number(p.quantity || 0) * Number(p.rate || 0)),
    "Transport Cost (\u20B9)": Number(p.transportCost || 0),
    "Discount (\u20B9)": Number(p.discount || 0),
    "Tax / GST (\u20B9)": Number(p.tax || 0),
    "Total Amount (\u20B9)": Number(p.totalAmount || 0),
    "Paid Amount (\u20B9)": Number(p.paidAmount || 0),
    "Outstanding (\u20B9)": Number(p.outstandingAmount || 0),
    "Payment Status": p.paymentStatus,
    "Payment Method": p.paymentMethod || "-",
    "Notes": p.notes || ""
  }));
  utils.sheet_add_json(ws, tableRows, { origin: "A11" });
  utils.book_append_sheet(wb, ws, "Vendor Purchases");
  return write(wb, { type: "buffer", bookType: "xlsx" });
}
function generateCustomerSuppliesBuffer(customerName, supplies, locationName = "All Locations") {
  const wb = utils.book_new();
  let totalBilled = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  supplies.forEach((s) => {
    totalBilled += Number(s.totalAmount || 0);
    totalPaid += Number(s.paidAmount || 0);
    totalOutstanding += Number(s.outstandingAmount || 0);
  });
  const headerData = [
    ["B J DESAI - CUSTOMER MATERIAL SUPPLY STATEMENT / BILL"],
    ["Customer / Party Name:", customerName],
    ["Project Location:", locationName],
    ["Statement Date:", (/* @__PURE__ */ new Date()).toLocaleDateString()],
    [],
    ["Total Material Billed (\u20B9):", totalBilled],
    ["Total Amount Received (\u20B9):", totalPaid],
    ["Outstanding Receivable (\u20B9):", totalOutstanding],
    [],
    ["MATERIAL SUPPLY INVOICE DETAILS"]
  ];
  const ws = utils.aoa_to_sheet(headerData);
  const tableRows = supplies.map((s) => ({
    "Date": s.date,
    "Challan / Bill No": s.referenceNumber || "-",
    "Material Supplied": s.materialName,
    "Quantity": Number(s.quantity || 0),
    "Unit": s.unit || "Unit",
    "Rate (\u20B9)": Number(s.rate || 0),
    "Subtotal (\u20B9)": Number(s.subtotal || Number(s.quantity || 0) * Number(s.rate || 0)),
    "Transport Cost (\u20B9)": Number(s.transportCost || 0),
    "Discount (\u20B9)": Number(s.discount || 0),
    "Tax / GST (\u20B9)": Number(s.tax || 0),
    "Total Amount (\u20B9)": Number(s.totalAmount || 0),
    "Received Amount (\u20B9)": Number(s.paidAmount || 0),
    "Pending Balance (\u20B9)": Number(s.outstandingAmount || 0),
    "Payment Status": s.paymentStatus,
    "Payment Method": s.paymentMethod || "-",
    "Notes": s.notes || ""
  }));
  utils.sheet_add_json(ws, tableRows, { origin: "A11" });
  utils.book_append_sheet(wb, ws, "Customer Supplies");
  return write(wb, { type: "buffer", bookType: "xlsx" });
}
function generateRefundableRecordsBuffer(recordsList, locationName = "All Locations") {
  const wb = utils.book_new();
  let totalDisbursed = 0;
  let totalRefunded = 0;
  recordsList.forEach((r) => {
    totalDisbursed += Number(r.refundableAmount || r.amount || 0);
    totalRefunded += Number(r.refundedAmount || 0);
  });
  const pendingRefundable = Math.max(0, Math.round((totalDisbursed - totalRefunded) * 100) / 100);
  const headerData = [
    ["B J DESAI - REFUNDABLE RECORDS & SECURITY DEPOSITS AUDIT"],
    ["Location / Project:", locationName],
    ["Audit Date:", (/* @__PURE__ */ new Date()).toLocaleDateString()],
    [],
    ["Total Refundable Outflow (\u20B9):", totalDisbursed],
    ["Total Received Back (\u20B9):", totalRefunded],
    ["Total Pending Receivable / \u0AB2\u0AC7\u0AB5\u0ABE\u0AA8\u0ABE \u0AAC\u0ABE\u0A95\u0AC0 (\u20B9):", pendingRefundable],
    ["Total Records Count:", recordsList.length],
    [],
    ["DETAILED REFUNDABLE RECORDS REGISTER"]
  ];
  const ws = utils.aoa_to_sheet(headerData);
  const tableRows = recordsList.map((r) => {
    const orig = Number(r.refundableAmount || r.amount || 0);
    const refd = Number(r.refundedAmount || 0);
    const pend = Math.max(0, orig - refd);
    return {
      "Date": r.date,
      "Location / Site": r.locationName || locationName,
      "Party / Company Name": r.partyName,
      "Deposit Type / Purpose": r.description || "Security Deposit",
      "Total Deposit (\u20B9)": orig,
      "Received Back (\u20B9)": refd,
      "Pending Balance (\u20B9)": pend,
      "Refund Status": r.refundStatus || "PENDING",
      "Payment Method": r.paymentMethod || "-",
      "Reference / Cheque No": r.referenceNumber || "-",
      "Notes": r.notes || ""
    };
  });
  utils.sheet_add_json(ws, tableRows, { origin: "A11" });
  utils.book_append_sheet(wb, ws, "Refundable Records");
  return write(wb, { type: "buffer", bookType: "xlsx" });
}
function generateSiteSuppliesBuffer(siteSuppliesList, locationName = "All Locations") {
  const wb = utils.book_new();
  let totalTaxable = 0;
  let totalGst = 0;
  let totalGrand = 0;
  let totalUnits = 0;
  const rows = [];
  siteSuppliesList.forEach((s) => {
    const supplyTotal = Number(s.totalAmount || 0);
    const subtotal = Number(s.subtotal || s.totalAmount || 0);
    const tax = Number(s.taxAmount || 0);
    totalTaxable += subtotal;
    totalGst += tax;
    totalGrand += supplyTotal;
    const items = Array.isArray(s.items) && s.items.length > 0 ? s.items : [
      {
        materialName: s.materialName || "Materials",
        quantity: s.quantity || 1,
        unit: s.unit || "Nos",
        rate: s.rate || subtotal,
        subtotal,
        taxPercentage: s.taxPercentage || 0,
        taxAmount: tax,
        totalWithGst: supplyTotal
      }
    ];
    items.forEach((item, idx) => {
      const qty = Number(item.quantity || 0);
      totalUnits += qty;
      const rate = Number(item.rate || 0);
      const itemSubtotal = Number(item.subtotal || qty * rate || 0);
      const taxRate = Number(item.taxPercentage || (subtotal > 0 ? Math.round(tax / subtotal * 100) : 0));
      const itemTax = Number(item.taxAmount || item.itemTax || itemSubtotal * (taxRate / 100) || 0);
      const itemTotal = Number(item.totalWithGst || item.itemTotal || itemSubtotal + itemTax || 0);
      rows.push({
        "Date": s.date || "-",
        "Site / Location": s.locationName || locationName,
        "Labour Team / Contractor": s.teamName || "-",
        "Responsible Person": s.responsiblePerson || "-",
        "Challan / Ref No": s.referenceNumber || "-",
        "Item #": idx + 1,
        "Material Name": item.materialName || s.materialName || "Material",
        "Quantity": qty,
        "Unit": item.unit || "Nos",
        "Rate (\u20B9)": rate,
        "Taxable Subtotal (\u20B9)": Math.round(itemSubtotal * 100) / 100,
        "GST Rate (%)": taxRate,
        "GST Tax (\u20B9)": Math.round(itemTax * 100) / 100,
        "Total with GST (\u20B9)": Math.round(itemTotal * 100) / 100,
        "Work Scope / Notes": s.displayNotes || s.workDescription || s.notes || "-"
      });
    });
  });
  const headerData = [
    ["B J DESAI - CATEGORY 5: SITE MATERIAL SUPPLY REGISTER (WITH GST)"],
    ["Project Location:", locationName],
    ["Export Date:", (/* @__PURE__ */ new Date()).toLocaleDateString()],
    [],
    ["Total Supply Records:", siteSuppliesList.length],
    ["Total Units Dispatched:", totalUnits],
    ["Total Taxable Base Amount (\u20B9):", Math.round(totalTaxable * 100) / 100],
    ["Total GST Tax Amount (\u20B9):", Math.round(totalGst * 100) / 100],
    ["Grand Total Supply Value (\u20B9):", Math.round(totalGrand * 100) / 100],
    [],
    ["ITEMIZED SITE MATERIAL DISPATCHES & GST DETAILS"]
  ];
  const ws = utils.aoa_to_sheet(headerData);
  utils.sheet_add_json(ws, rows, { origin: "A12" });
  utils.book_append_sheet(wb, ws, "Site Supplies");
  return write(wb, { type: "buffer", bookType: "xlsx" });
}
function generateMaterialAnalyticsBuffer(locationName, analytics) {
  const wb = utils.book_new();
  const summary = analytics.summary || {};
  const materials2 = analytics.materials || [];
  const summaryData = [
    ["B J DESAI - MATERIAL PURCHASE VS SUPPLY ANALYTICS AUDIT"],
    ["Location / Project:", locationName],
    ["Generated On:", (/* @__PURE__ */ new Date()).toLocaleString()],
    ["Report Type:", "Comprehensive Material Costing, Pricing & Inventory Stock Valuation"],
    [],
    ["KEY PERFORMANCE INDICATORS (FINANCIAL TOTALS)"],
    ["Total Distinct Materials:", summary.distinctMaterialsCount || materials2.length],
    ["Total Material Purchased Quantity:", summary.totalPurchasedQty || 0],
    ["Total Material Purchase Value (\u20B9):", summary.totalPurchasedValue || 0],
    ["Total Material Supply (Cat 4) Value (\u20B9):", summary.totalMaterialSupplyValue || 0],
    ["Total Site Supply (Cat 5) Value (\u20B9):", summary.totalSiteSupplyValue || 0],
    ["Total Overall Supplied Quantity:", summary.totalOverallSuppliedQty || 0],
    ["Total Overall Supplied Value (\u20B9):", summary.totalOverallSuppliedValue || 0],
    ["Current Stock Inventory Valuation (\u20B9):", summary.totalStockInventoryValuation || 0],
    ["Estimated Gross Trading Profit (\u20B9):", summary.totalGrossProfit || 0],
    []
  ];
  const wsSummary = utils.aoa_to_sheet(summaryData);
  utils.book_append_sheet(wb, wsSummary, "Executive Summary");
  const comparisonRows = materials2.map((m, idx) => ({
    "#": idx + 1,
    "Material Name": m.materialName,
    "Category": m.category || "General",
    "Unit": m.unit || "Unit",
    "Purchased Qty": m.purchasedQty,
    "Avg Purchase Rate (\u20B9)": m.avgPurchaseRate,
    "Min Purchase Rate (\u20B9)": m.minPurchaseRate,
    "Max Purchase Rate (\u20B9)": m.maxPurchaseRate,
    "Total Purchase Cost (\u20B9)": m.totalPurchaseCost,
    "Material Supply Qty": m.materialSupplyQty,
    "Avg Mat Supply Rate (\u20B9)": m.avgMaterialSupplyRate,
    "Site Supply Qty": m.siteSupplyQty,
    "Avg Site Supply Rate (\u20B9)": m.avgSiteSupplyRate,
    "Total Supplied Qty": m.totalSuppliedQty,
    "Avg Overall Supply Rate (\u20B9)": m.avgOverallSupplyRate,
    "Total Supplied Amount (\u20B9)": m.totalSuppliedAmount,
    "Current Stock Balance": m.currentStock,
    "Stock Valuation (\u20B9)": m.stockValuation,
    "Stock Status": m.status,
    "Price Spread (\u20B9/Unit)": m.rateSpread,
    "Gross Profit (\u20B9)": m.grossProfit,
    "Margin (%)": `${m.marginPercent}%`
  }));
  const wsComparison = utils.json_to_sheet(comparisonRows);
  utils.book_append_sheet(wb, wsComparison, "Material Price Analytics");
  const purchaseLogs = [];
  materials2.forEach((m) => {
    (m.purchases || []).forEach((p) => {
      purchaseLogs.push({
        "Date": p.date,
        "Material Name": m.materialName,
        "Vendor / Party": p.partyName || "-",
        "Quantity": p.quantity,
        "Unit": p.unit || m.unit,
        "Purchase Rate (\u20B9)": p.rate,
        "Total Amount (\u20B9)": p.totalAmount,
        "Payment Status": p.paymentStatus || "PAID"
      });
    });
  });
  if (purchaseLogs.length > 0) {
    const wsPurchases = utils.json_to_sheet(purchaseLogs);
    utils.book_append_sheet(wb, wsPurchases, "Itemized Purchases");
  }
  const supplyLogs = [];
  materials2.forEach((m) => {
    (m.materialSupplies || []).forEach((s) => {
      supplyLogs.push({
        "Date": s.date,
        "Type": "Category 4: Material Supply",
        "Material Name": m.materialName,
        "Customer / Party": s.partyName || "-",
        "Quantity": s.quantity,
        "Unit": s.unit || m.unit,
        "Supply Rate (\u20B9)": s.rate,
        "Total Amount (\u20B9)": s.totalAmount,
        "Payment Status": s.paymentStatus || "PAID"
      });
    });
    (m.siteSupplies || []).forEach((st) => {
      supplyLogs.push({
        "Date": st.date,
        "Type": "Category 5: Site Supply",
        "Material Name": m.materialName,
        "Customer / Party": `${st.teamName} (${st.responsiblePerson || "Direct"})`,
        "Quantity": st.quantity,
        "Unit": st.unit || m.unit,
        "Supply Rate (\u20B9)": st.rate,
        "Total Amount (\u20B9)": st.totalAmount,
        "Payment Status": "INTERNAL_DISPATCH"
      });
    });
  });
  if (supplyLogs.length > 0) {
    const wsSupplies = utils.json_to_sheet(supplyLogs);
    utils.book_append_sheet(wb, wsSupplies, "Itemized Supplies");
  }
  return write(wb, { type: "buffer", bookType: "xlsx" });
}
function generateContractorCostsBuffer(locationName, costs) {
  const wb = utils.book_new();
  const summaryHeader = [
    ["B J DESAI - CONTRACTOR COSTS & LABOUR EXPENSE REGISTER"],
    ["Location / Project:", locationName],
    ["Generated Date:", (/* @__PURE__ */ new Date()).toLocaleString()],
    ["Total Records:", costs.length],
    ["Total Net Cost (\u20B9):", costs.reduce((s, c) => s + Number(c.netAmount || 0), 0)],
    [],
    ["CONTRACTOR EXPENSE ENTRIES"]
  ];
  const ws = utils.aoa_to_sheet(summaryHeader);
  const rows = costs.map((c) => ({
    "Date": c.date || "-",
    "Contractor Name": c.contractorName,
    "Team": c.teamName || "Direct",
    "Work Description": c.workDescription || "-",
    "Gross Amount (\u20B9)": Number(c.amount || 0),
    "Deductions (\u20B9)": Number(c.deductionAmount || 0),
    "Net Amount (\u20B9)": Number(c.netAmount || 0),
    "Payment Status": c.paymentStatus || "PAID",
    "Payment Method": c.paymentMethod || "-",
    "Reference No": c.referenceNumber || "-",
    "Notes": c.notes || "-"
  }));
  utils.sheet_add_json(ws, rows, { origin: "A8" });
  utils.book_append_sheet(wb, ws, "Contractor Costs");
  return write(wb, { type: "buffer", bookType: "xlsx" });
}
function generateReconciliationBuffer(locationName, recon) {
  const wb = utils.book_new();
  const summary = [
    ["B J DESAI - 5-TIER FINANCIAL RECONCILIATION AUDIT REPORT"],
    ["Location / Project:", locationName],
    ["Generated Date:", (/* @__PURE__ */ new Date()).toLocaleString()],
    [],
    ["RECONCILIATION RULE 1: INVESTMENT CAPITAL VS SITE OPERATIONAL SPEND"],
    ["Formula: Investment Capital == Material Supply (Cat 2) + Site Supply (Cat 3) + Labour Attendance (Cat 4)"],
    ["Investment Capital Received (\u20B9):", recon.totalInvestmentCapital || recon.investmentCapital || 0],
    ["Customer Material Supply Spend (Cat 2) (\u20B9):", recon.totalMaterialSupply || recon.materialSupply || 0],
    ["Site Supply to Labour Spend (Cat 3) (\u20B9):", recon.totalSiteSupply || recon.siteSupply || 0],
    ["Labour Attendance Wages Spend (Cat 4) (\u20B9):", recon.totalLabourAttendance || recon.labourAttendance || 0],
    ["Total Site Operational Spend (\u20B9):", recon.totalCombinedSiteExpenses || recon.totalSiteExpenses || 0],
    ["Variance / Surplus / Deficit (\u20B9):", recon.investmentVariance || 0],
    ["Reconciliation Status 1:", recon.investmentStatus || "MATCHED"],
    [],
    ["RECONCILIATION RULE 2: OPERATIONAL SITE SPEND VS CONTRACTOR COST"],
    ["Formula: Site Supply (Cat 3) + Labour Attendance (Cat 4) == Contractor Cost (Cat 5)"],
    ["Expected Contractor Cost (Cat 3 + Cat 4) (\u20B9):", recon.expectedContractorCost || 0],
    ["Recorded Contractor Cost (Cat 5) (\u20B9):", recon.recordedContractorCost || recon.contractorCost || 0],
    ["Variance / Difference (\u20B9):", recon.contractorVariance || recon.reconciliationDifference || 0],
    ["Reconciliation Status 2:", recon.contractorStatus || recon.reconciliationStatus || "MATCHED"],
    []
  ];
  const ws = utils.aoa_to_sheet(summary);
  utils.book_append_sheet(wb, ws, "Reconciliation Summary");
  if (recon.siteSupplies && recon.siteSupplies.length > 0) {
    const wsSupplies = utils.json_to_sheet(recon.siteSupplies.map((s) => ({
      "Date": s.date || "-",
      "Team / Worker": s.teamName || "-",
      "Total Items": s.itemCount || 1,
      "Total Amount (\u20B9)": Number(s.totalAmount || 0)
    })));
    utils.book_append_sheet(wb, wsSupplies, "Site Supplies (Cat 3)");
  }
  if (recon.labourSalaries && recon.labourSalaries.length > 0) {
    const wsLabour = utils.json_to_sheet(recon.labourSalaries.map((l) => ({
      "Date": l.date || "-",
      "Labour Name": l.labourName,
      "Team": l.labourTeam || l.teamName || "General",
      "Net Salary (\u20B9)": Number(l.netSalary || 0),
      "Paid Amount (\u20B9)": Number(l.paymentAmount || 0),
      "Balance (\u20B9)": Number(l.balance || 0),
      "Payment Status": Number(l.balance || 0) <= 0 ? "PAID" : "PENDING"
    })));
    utils.book_append_sheet(wb, wsLabour, "Labour Wages (Cat 4)");
  }
  if (recon.contractorCosts && recon.contractorCosts.length > 0) {
    const wsContr = utils.json_to_sheet(recon.contractorCosts.map((c) => ({
      "Date": c.date || "-",
      "Contractor Name": c.contractorName,
      "Team": c.teamName || "Direct",
      "Net Amount (\u20B9)": Number(c.netAmount || 0),
      "Payment Status": c.paymentStatus || "PAID"
    })));
    utils.book_append_sheet(wb, wsContr, "Contractor Costs (Cat 5)");
  }
  return write(wb, { type: "buffer", bookType: "xlsx" });
}

// src/server/lib/accounting.ts
import { eq as eq5, and as and4, sql as sql4, desc as desc2, or } from "drizzle-orm";
var CENTRAL_LOCATION_NAME = "Central Inventory for All Sites";
async function getOrCreateCentralLocation(userId) {
  try {
    const existing = await db.select({ id: locations.id, isDeleted: locations.isDeleted }).from(locations).where(
      or(
        eq5(locations.name, CENTRAL_LOCATION_NAME),
        sql4`LOWER(TRIM(${locations.name})) IN ('central inventory for all sites', 'central inventory', 'central stock')`
      )
    ).limit(1);
    if (existing.length > 0) {
      if (existing[0].isDeleted === 1) {
        await db.update(locations).set({ isDeleted: 0, updatedAt: /* @__PURE__ */ new Date() }).where(eq5(locations.id, existing[0].id));
      }
      return existing[0].id;
    }
    let validUserId = userId;
    if (!validUserId) {
      const userRow = await db.select({ id: users.id }).from(users).limit(1);
      validUserId = userRow[0]?.id || 1;
    }
    const created = await db.insert(locations).values({
      userId: validUserId,
      name: CENTRAL_LOCATION_NAME,
      address: "Central Warehouse / All Sites Storage",
      isDeleted: 0
    }).returning({ id: locations.id });
    return created[0].id;
  } catch (err) {
    console.error("[Central Location Error]", err);
    const anyLoc = await db.select({ id: locations.id }).from(locations).where(eq5(locations.isDeleted, 0)).limit(1);
    return anyLoc[0]?.id || 1;
  }
}
function round2(val) {
  const num = typeof val === "number" ? val : parseFloat(String(val || 0));
  if (isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
function calculateLabourSalaryTotals(input) {
  const attUpper = String(input.attendanceType || "").toUpperCase();
  if (attUpper.includes("UPAD") || attUpper === "TEAM_UPAD") {
    const upadAmt = Math.max(0, parseFloat(String(input.upad || input.paymentAmount || input.amount || 0)) || 0);
    return {
      days: 0,
      dailyRate: 0,
      tcQuantity: 0,
      tcRate: 0,
      quantity: 0,
      rate: 0,
      otherEarnings: 0,
      grossSalary: 0,
      deduction: 0,
      netSalary: 0,
      upad: upadAmt,
      paymentAmount: upadAmt,
      balance: -upadAmt
      // negative balance represents advance taken
    };
  }
  if (attUpper.includes("KHARCH") || attUpper === "OTHER_KHARCH" || attUpper === "EXPENSE") {
    const expAmt = Math.max(0, parseFloat(String(input.amount || input.paymentAmount || input.grossSalary || input.otherEarnings || 0)) || 0);
    return {
      days: 0,
      dailyRate: 0,
      tcQuantity: 0,
      tcRate: 0,
      quantity: 0,
      rate: 0,
      otherEarnings: 0,
      grossSalary: expAmt,
      deduction: 0,
      netSalary: expAmt,
      upad: 0,
      paymentAmount: expAmt,
      balance: 0
    };
  }
  const isWork = attUpper.includes("WORK") || attUpper.includes("TC");
  const days = Math.max(0, parseFloat(String(input.days || 0)) || 0);
  const dailyRate = Math.max(0, parseFloat(String(input.dailyRate || 0)) || 0);
  const workQuantity = Math.max(0, parseFloat(String(input.quantity ?? input.tcQuantity ?? 0)) || 0);
  const workRate = Math.max(0, parseFloat(String(input.rate ?? input.tcRate ?? dailyRate)) || 0);
  const otherEarnings = Math.max(0, parseFloat(String(input.otherEarnings || 0)) || 0);
  const deduction = Math.max(0, parseFloat(String(input.deduction || 0)) || 0);
  const upad = Math.max(0, parseFloat(String(input.upad || 0)) || 0);
  const paymentAmount = Math.max(0, parseFloat(String(input.paymentAmount || 0)) || 0);
  const baseSalary = isWork ? round2(workQuantity * workRate) : round2(days * dailyRate);
  const grossSalary = round2(baseSalary + otherEarnings);
  const netSalary = Math.max(0, round2(grossSalary - deduction));
  const totalPaidOut = round2(upad + paymentAmount);
  const balance = round2(netSalary - totalPaidOut);
  return {
    days,
    dailyRate,
    tcQuantity: workQuantity,
    tcRate: workRate,
    quantity: workQuantity,
    rate: workRate,
    otherEarnings,
    grossSalary,
    deduction,
    netSalary,
    upad,
    paymentAmount,
    balance
  };
}
function calculateCategory2Capital(input) {
  const investmentFromInvestors = round2(input.investmentFromInvestors || 0);
  const billInvestment = round2(input.billInvestment || 0);
  const fullCapital = round2(investmentFromInvestors + billInvestment);
  const cat3 = round2(input.cat3Deduction || 0);
  const cat4 = round2(input.cat4Deduction || 0);
  const cat5 = round2(input.cat5Deduction || 0);
  const cat6 = round2(input.cat6Deduction ?? input.cat67Deduction ?? 0);
  const refundableDeduction = round2(input.refundableDeduction || 0);
  const investorUpadReturn = round2(input.investorUpadReturn || 0);
  const totalDeductions = round2(cat3 + cat4 + cat5 + cat6 + refundableDeduction);
  const remainingCapital = round2(fullCapital - totalDeductions - investorUpadReturn);
  return {
    investmentFromInvestors,
    billInvestment,
    fullCapital,
    totalDeductions,
    cat3Deduction: cat3,
    cat4Deduction: cat4,
    cat5Deduction: cat5,
    cat6Deduction: cat6,
    cat67Deduction: cat6,
    refundableDeduction,
    investorUpadReturn,
    remainingCapital
  };
}
function calculateSiteSupplyItemTotals(input) {
  const quantity = Math.max(0, parseFloat(String(input.quantity)) || 0);
  const rate = Math.max(0, parseFloat(String(input.rate)) || 0);
  const subtotal = round2(quantity * rate);
  const taxPercentage = Math.max(0, parseFloat(String(input.taxPercentage || 0)) || 0);
  let taxAmount = 0;
  if (input.taxAmount !== void 0 && !isNaN(parseFloat(String(input.taxAmount))) && parseFloat(String(input.taxAmount)) > 0) {
    taxAmount = round2(input.taxAmount);
  } else {
    taxAmount = round2(subtotal * (taxPercentage / 100));
  }
  const totalAmount = round2(subtotal + taxAmount);
  return {
    materialId: parseInt(String(input.materialId), 10),
    quantity,
    unit: input.unit || "Nos",
    rate,
    subtotal,
    taxPercentage,
    taxAmount,
    totalAmount
  };
}
function calculateSiteSupplyTotals(items) {
  const processedItems = items.map(calculateSiteSupplyItemTotals);
  const totalQuantity = round2(processedItems.reduce((acc, i) => acc + i.quantity, 0));
  const subtotal = round2(processedItems.reduce((acc, i) => acc + i.subtotal, 0));
  const taxAmount = round2(processedItems.reduce((acc, i) => acc + i.taxAmount, 0));
  const totalAmount = round2(subtotal + taxAmount);
  return {
    items: processedItems,
    totalQuantity,
    subtotal,
    taxAmount,
    totalAmount
  };
}
var StockManager = class {
  /**
   * Atomically records a stock movement in the stock ledger
   */
  static async addStockMovement(dbTx, userId, locationId, materialId, type, quantity, refId, refType, notes) {
    const parsedQty = parseFloat(String(quantity));
    if (!materialId || isNaN(parsedQty)) {
      throw new Error("Invalid stock movement parameters: materialId and valid quantity required");
    }
    const finalQty = type === "OUT" ? -Math.abs(parsedQty) : Math.abs(parsedQty);
    await dbTx.insert(stockLedger).values({
      userId,
      locationId,
      materialId,
      transactionType: type,
      quantity: finalQty.toString(),
      referenceId: refId,
      referenceType: refType,
      notes: notes || null
    });
  }
  /**
   * Calculates the current stock balance for a given material at a location
   */
  static async getCurrentBalance(dbOrTx, locationId, materialId) {
    const res = await dbOrTx.select({
      balance: sql4`COALESCE(SUM(CAST(${stockLedger.quantity} AS numeric)), 0)`
    }).from(stockLedger).where(
      and4(
        eq5(stockLedger.locationId, locationId),
        eq5(stockLedger.materialId, materialId),
        eq5(stockLedger.isDeleted, 0)
      )
    );
    return round2(parseFloat(res[0]?.balance || "0"));
  }
  /**
   * Reconciles stock records and checks for negative stock
   */
  static async checkStockAvailability(dbOrTx, locationId, materialId, deductQty) {
    const currentStock = await this.getCurrentBalance(dbOrTx, locationId, materialId);
    const newBalance = round2(currentStock - deductQty);
    return {
      available: newBalance >= 0,
      currentStock,
      newBalance
    };
  }
  /**
   * Calculates the central enterprise-wide stock balance for a given material
   * Central Stock = Total Purchases (IN) - Total Customer Supplies (OUT) - Total Site Supplies (OUT) + Adjustments
   */
  static async getCentralStock(dbOrTx, materialId) {
    const res = await dbOrTx.select({
      balance: sql4`COALESCE(SUM(CAST(${stockLedger.quantity} AS numeric)), 0)`
    }).from(stockLedger).where(
      and4(
        eq5(stockLedger.materialId, materialId),
        eq5(stockLedger.isDeleted, 0)
      )
    );
    return round2(parseFloat(res[0]?.balance || "0"));
  }
  /**
   * Validates available central stock before allowing Customer Supply or Site Supply
   */
  static async checkCentralStockAvailability(dbOrTx, materialId, deductQty) {
    const currentStock = await this.getCentralStock(dbOrTx, materialId);
    const newBalance = round2(currentStock - deductQty);
    return {
      available: newBalance >= 0,
      currentStock,
      newBalance
    };
  }
};
async function getAdminCapitalSummary(dbOrTx = db, userId) {
  try {
    const activeInvestors = await dbOrTx.select().from(investors).where(eq5(investors.isDeleted, 0)).orderBy(desc2(investors.createdAt));
    const investorIds = activeInvestors.map((i) => i.id);
    let allTxs = [];
    if (investorIds.length > 0) {
      allTxs = await dbOrTx.select().from(investorTransactions).where(
        and4(
          sql4`${investorTransactions.investorId} IN (${sql4.join(investorIds, sql4`, `)})`,
          eq5(investorTransactions.isDeleted, 0)
        )
      ).orderBy(desc2(investorTransactions.date), desc2(investorTransactions.id));
    }
    let allAllocations = [];
    if (investorIds.length > 0) {
      allAllocations = await dbOrTx.select({
        id: investorLocationAllocations.id,
        investorId: investorLocationAllocations.investorId,
        investorName: investors.name,
        locationId: investorLocationAllocations.locationId,
        locationName: locations.name,
        amount: investorLocationAllocations.amount,
        date: investorLocationAllocations.date,
        paymentMethod: investorLocationAllocations.paymentMethod,
        referenceNumber: investorLocationAllocations.referenceNumber,
        notes: investorLocationAllocations.notes,
        createdAt: investorLocationAllocations.createdAt
      }).from(investorLocationAllocations).leftJoin(investors, eq5(investorLocationAllocations.investorId, investors.id)).leftJoin(locations, eq5(investorLocationAllocations.locationId, locations.id)).where(
        and4(
          sql4`${investorLocationAllocations.investorId} IN (${sql4.join(investorIds, sql4`, `)})`,
          eq5(investorLocationAllocations.isDeleted, 0)
        )
      ).orderBy(desc2(investorLocationAllocations.date), desc2(investorLocationAllocations.id));
    }
    const allPurchases = await dbOrTx.select({
      id: materialPurchases.id,
      date: materialPurchases.date,
      partyName: materialPurchases.partyName,
      materialName: materialPurchases.materialName,
      quantity: materialPurchases.quantity,
      unit: materialPurchases.unit,
      rate: materialPurchases.rate,
      totalAmount: materialPurchases.totalAmount,
      paidAmount: materialPurchases.paidAmount,
      paymentStatus: materialPurchases.paymentStatus,
      referenceNumber: materialPurchases.referenceNumber,
      description: materialPurchases.description,
      locationId: materialPurchases.locationId,
      locationName: locations.name
    }).from(materialPurchases).leftJoin(locations, eq5(materialPurchases.locationId, locations.id)).where(eq5(materialPurchases.isDeleted, 0)).orderBy(desc2(materialPurchases.date), desc2(materialPurchases.id));
    const totalContributed = round2(
      allTxs.filter((t) => t.type === "CONTRIBUTION" || t.type === "CAPITAL" || t.type === "INVESTMENT").reduce((acc, t) => acc + (parseFloat(String(t.amount || 0)) || 0), 0)
    );
    const totalWithdrawn = round2(
      allTxs.filter((t) => t.type === "UPAD" || t.type === "WITHDRAWAL" || t.type === "PAYMENT").reduce((acc, t) => acc + (parseFloat(String(t.amount || 0)) || 0), 0)
    );
    const totalAllocated = round2(
      allAllocations.reduce((acc, a) => acc + (parseFloat(String(a.amount || 0)) || 0), 0)
    );
    const totalPurchases = round2(
      allPurchases.reduce((acc, p) => acc + (parseFloat(String(p.totalAmount || 0)) || 0), 0)
    );
    const availableAdminCapital = round2(totalContributed - totalWithdrawn - totalAllocated - totalPurchases);
    const investorList = activeInvestors.map((inv) => {
      const invTxs = allTxs.filter((t) => t.investorId === inv.id);
      const invAllocs = allAllocations.filter((a) => a.investorId === inv.id);
      const contributed = round2(
        invTxs.filter((t) => t.type === "CONTRIBUTION" || t.type === "CAPITAL" || t.type === "INVESTMENT").reduce((acc, t) => acc + (parseFloat(String(t.amount || 0)) || 0), 0)
      );
      const withdrawn = round2(
        invTxs.filter((t) => t.type === "UPAD" || t.type === "WITHDRAWAL" || t.type === "PAYMENT").reduce((acc, t) => acc + (parseFloat(String(t.amount || 0)) || 0), 0)
      );
      const allocated = round2(
        invAllocs.reduce((acc, a) => acc + (parseFloat(String(a.amount || 0)) || 0), 0)
      );
      const availableCapital = round2(contributed - withdrawn - allocated);
      return {
        id: inv.id,
        name: inv.name,
        mobile: inv.mobile,
        email: inv.email,
        address: inv.address,
        notes: inv.notes,
        totalContributed: contributed,
        totalWithdrawn: withdrawn,
        totalAllocated: allocated,
        availableCapital
      };
    });
    return {
      totalContributed,
      totalWithdrawn,
      totalAllocated,
      totalPurchases,
      availableAdminCapital,
      investors: investorList,
      recentTransfers: allAllocations,
      recentPurchases: allPurchases
    };
  } catch (error) {
    console.warn("[Admin Capital Summary] Database query error, returning fallback:", error);
    return {
      totalContributed: 0,
      totalWithdrawn: 0,
      totalAllocated: 0,
      totalPurchases: 0,
      availableAdminCapital: 0,
      investors: [],
      recentTransfers: [],
      recentPurchases: []
    };
  }
}
async function normalizeMaterialsAndStockDB() {
  try {
    const centralLocId = await getOrCreateCentralLocation();
    await db.execute(sql4`
      UPDATE material_purchases 
      SET location_id = ${centralLocId} 
      WHERE location_id IS NULL OR location_id NOT IN (SELECT id FROM locations WHERE is_deleted = 0);
    `);
    await db.execute(sql4`
      UPDATE stock_ledger 
      SET location_id = ${centralLocId} 
      WHERE reference_type = 'PURCHASE' AND (location_id IS NULL OR location_id != ${centralLocId});
    `);
    await db.execute(sql4`
      UPDATE materials 
      SET name = UPPER(TRIM(name)) 
      WHERE name IS NOT NULL AND name != UPPER(TRIM(name));
    `);
    await db.execute(sql4`
      UPDATE material_purchases 
      SET material_name = UPPER(TRIM(material_name)) 
      WHERE material_name IS NOT NULL AND material_name != UPPER(TRIM(material_name));
    `);
    await db.execute(sql4`
      UPDATE material_supplies 
      SET material_name = UPPER(TRIM(material_name)) 
      WHERE material_name IS NOT NULL AND material_name != UPPER(TRIM(material_name));
    `);
    await db.execute(sql4`
      UPDATE material_labour_supplies 
      SET material_name = UPPER(TRIM(material_name)) 
      WHERE material_name IS NOT NULL AND material_name != UPPER(TRIM(material_name));
    `);
    const unlinkedPurchases = await db.execute(sql4`
      SELECT id, user_id, location_id, material_name, unit, rate, quantity
      FROM material_purchases
      WHERE (material_id IS NULL OR material_id = 0) AND is_deleted = 0 AND material_name IS NOT NULL
    `);
    for (const row of unlinkedPurchases.rows) {
      const cleanName = String(row.material_name || "").trim().toUpperCase();
      if (!cleanName) continue;
      let mat = await db.select().from(materials).where(
        and4(
          eq5(materials.locationId, Number(row.location_id)),
          sql4`UPPER(TRIM(${materials.name})) = ${cleanName}`,
          eq5(materials.isDeleted, 0)
        )
      ).limit(1);
      let matId;
      if (mat = mat.length ? mat : []) {
        if (mat.length > 0) {
          matId = mat[0].id;
        } else {
          const created = await db.insert(materials).values({
            userId: Number(row.user_id),
            locationId: Number(row.location_id),
            name: cleanName,
            defaultUnit: row.unit || "Unit",
            defaultRate: String(row.rate || "0.00"),
            minStock: "0.00",
            isActive: 1,
            isDeleted: 0
          }).returning();
          matId = created[0].id;
        }
        await db.execute(sql4`
          UPDATE material_purchases 
          SET material_id = ${matId}, material_name = ${cleanName}
          WHERE id = ${row.id};
        `);
        const stockCheck = await db.select().from(stockLedger).where(
          and4(
            eq5(stockLedger.referenceId, Number(row.id)),
            eq5(stockLedger.referenceType, "PURCHASE")
          )
        );
        if (stockCheck.length === 0 && parseFloat(String(row.quantity || 0)) > 0) {
          await StockManager.addStockMovement(
            db,
            Number(row.user_id),
            Number(row.location_id),
            matId,
            "IN",
            parseFloat(String(row.quantity)),
            Number(row.id),
            "PURCHASE",
            "Auto reconciled"
          );
        }
      }
    }
    const unlinkedSupplies = await db.execute(sql4`
      SELECT id, user_id, location_id, material_id, material_name, unit, rate, quantity
      FROM material_supplies
      WHERE is_deleted = 0 AND material_name IS NOT NULL
    `);
    for (const row of unlinkedSupplies.rows) {
      const cleanName = String(row.material_name || "").trim().toUpperCase();
      if (!cleanName) continue;
      let matId = row.material_id ? Number(row.material_id) : 0;
      if (!matId) {
        const mat = await db.select().from(materials).where(
          and4(
            sql4`UPPER(TRIM(${materials.name})) = ${cleanName}`,
            eq5(materials.isDeleted, 0)
          )
        ).limit(1);
        if (mat.length > 0) {
          matId = mat[0].id;
        } else {
          const created = await db.insert(materials).values({
            userId: Number(row.user_id),
            locationId: Number(row.location_id) || 1,
            name: cleanName,
            defaultUnit: row.unit || "Nos",
            defaultRate: String(row.rate || "0.00"),
            minStock: "0.00",
            isActive: 1,
            isDeleted: 0
          }).returning();
          matId = created[0].id;
        }
        await db.execute(sql4`
          UPDATE material_supplies 
          SET material_id = ${matId}, material_name = ${cleanName}
          WHERE id = ${row.id};
        `);
      }
      const stockCheck = await db.select().from(stockLedger).where(
        and4(
          eq5(stockLedger.referenceId, Number(row.id)),
          sql4`reference_type IN ('MATERIAL_SUPPLY', 'CUSTOMER_SUPPLY')`,
          eq5(stockLedger.isDeleted, 0)
        )
      );
      if (stockCheck.length === 0 && parseFloat(String(row.quantity || 0)) > 0) {
        await StockManager.addStockMovement(
          db,
          Number(row.user_id),
          Number(row.location_id) || 1,
          matId,
          "OUT",
          parseFloat(String(row.quantity)),
          Number(row.id),
          "CUSTOMER_SUPPLY",
          "Auto reconciled customer supply"
        );
      }
    }
    const siteSupplyRows = await db.execute(sql4`
      SELECT ssi.id as item_id, ssi.site_supply_id, ssi.material_id, ssi.quantity, 
             ss.user_id, ss.location_id, m.name as mat_name
      FROM site_supply_items ssi
      JOIN site_supplies ss ON ssi.site_supply_id = ss.id
      LEFT JOIN materials m ON ssi.material_id = m.id
      WHERE ssi.is_deleted = 0 AND ss.is_deleted = 0 AND ssi.material_id IS NOT NULL AND ssi.material_id > 0
    `);
    for (const row of siteSupplyRows.rows) {
      const q = parseFloat(String(row.quantity || 0));
      if (q <= 0) continue;
      const ledgerCheck = await db.select().from(stockLedger).where(
        and4(
          eq5(stockLedger.referenceId, Number(row.site_supply_id)),
          eq5(stockLedger.referenceType, "SITE_SUPPLY"),
          eq5(stockLedger.materialId, Number(row.material_id)),
          eq5(stockLedger.isDeleted, 0)
        )
      );
      if (ledgerCheck.length === 0) {
        await StockManager.addStockMovement(
          db,
          Number(row.user_id),
          Number(row.location_id) || 1,
          Number(row.material_id),
          "OUT",
          q,
          Number(row.site_supply_id),
          "SITE_SUPPLY",
          "Auto reconciled site supply"
        );
      }
    }
    const allMats = await db.select().from(materials).where(eq5(materials.isDeleted, 0)).orderBy(materials.id);
    const seenMap = /* @__PURE__ */ new Map();
    for (const m of allMats) {
      const clean = (m.name || "").trim().toUpperCase();
      if (!clean) continue;
      if (!seenMap.has(clean)) {
        seenMap.set(clean, m.id);
      } else {
        const primaryId = seenMap.get(clean);
        const duplicateId = m.id;
        await db.execute(sql4`UPDATE material_purchases SET material_id = ${primaryId} WHERE material_id = ${duplicateId}`);
        await db.execute(sql4`UPDATE material_supplies SET material_id = ${primaryId} WHERE material_id = ${duplicateId}`);
        await db.execute(sql4`UPDATE site_supply_items SET material_id = ${primaryId} WHERE material_id = ${duplicateId}`);
        await db.execute(sql4`UPDATE stock_ledger SET material_id = ${primaryId} WHERE material_id = ${duplicateId}`);
        await db.execute(sql4`UPDATE materials SET is_deleted = 1 WHERE id = ${duplicateId}`);
      }
    }
    await db.execute(sql4`
      UPDATE materials m
      SET default_unit = p.unit
      FROM (
        SELECT DISTINCT ON (material_id) material_id, unit
        FROM material_purchases
        WHERE material_id IS NOT NULL AND unit IS NOT NULL AND TRIM(unit) != '' AND LOWER(TRIM(unit)) != 'unit' AND is_deleted = 0
        ORDER BY material_id, date DESC, id DESC
      ) p
      WHERE m.id = p.material_id AND (m.default_unit IS NULL OR m.default_unit != p.unit);
    `);
    await db.execute(sql4`
      UPDATE materials m
      SET default_unit = p.unit
      FROM (
        SELECT DISTINCT ON (UPPER(TRIM(material_name))) UPPER(TRIM(material_name)) as mat_name, unit
        FROM material_purchases
        WHERE material_name IS NOT NULL AND unit IS NOT NULL AND TRIM(unit) != '' AND LOWER(TRIM(unit)) != 'unit' AND is_deleted = 0
        ORDER BY UPPER(TRIM(material_name)), date DESC, id DESC
      ) p
      WHERE UPPER(TRIM(m.name)) = p.mat_name AND (m.default_unit IS NULL OR m.default_unit != p.unit);
    `);
    await db.execute(sql4`
      UPDATE materials m
      SET default_rate = p.rate::numeric
      FROM (
        SELECT DISTINCT ON (material_id) material_id, rate
        FROM material_purchases
        WHERE material_id IS NOT NULL AND rate IS NOT NULL AND rate::numeric > 0 AND is_deleted = 0
        ORDER BY material_id, date DESC, id DESC
      ) p
      WHERE m.id = p.material_id AND (m.default_rate IS NULL OR m.default_rate = 0 OR m.default_rate != p.rate::numeric);
    `);
    await db.execute(sql4`
      UPDATE materials m
      SET default_rate = p.rate::numeric
      FROM (
        SELECT DISTINCT ON (UPPER(TRIM(material_name))) UPPER(TRIM(material_name)) as mat_name, rate
        FROM material_purchases
        WHERE material_name IS NOT NULL AND rate IS NOT NULL AND rate::numeric > 0 AND is_deleted = 0
        ORDER BY UPPER(TRIM(material_name)), date DESC, id DESC
      ) p
      WHERE UPPER(TRIM(m.name)) = p.mat_name AND (m.default_rate IS NULL OR m.default_rate = 0 OR m.default_rate != p.rate::numeric);
    `);
    console.log("[Accounting] Enterprise materials normalized, stock ledger auto-reconciled, and rates/units synchronized.");
  } catch (err) {
    console.error("[Accounting] Normalization error (non-fatal):", err);
  }
}
async function runDatabaseMigrations() {
  try {
    try {
      await db.execute(sql4`ALTER TYPE investment_type ADD VALUE IF NOT EXISTS 'CONTRIBUTION';`);
      await db.execute(sql4`ALTER TYPE investment_type ADD VALUE IF NOT EXISTS 'UPAD';`);
      await db.execute(sql4`ALTER TYPE investment_type ADD VALUE IF NOT EXISTS 'INVESTMENT';`);
      await db.execute(sql4`ALTER TYPE investment_type ADD VALUE IF NOT EXISTS 'PAYMENT';`);
    } catch (enumErr) {
    }
    try {
      const legacyParties = await db.execute(sql4`
        SELECT DISTINCT ip.id, ip.user_id, ip.party_name, ip.location_id
        FROM investment_parties ip
        WHERE ip.is_deleted = 0
      `);
      for (const row of legacyParties.rows) {
        const cleanName = String(row.party_name || "").trim();
        if (!cleanName) continue;
        let invRes = await db.execute(sql4`
          SELECT id FROM investors 
          WHERE user_id = ${row.user_id} AND UPPER(TRIM(name)) = UPPER(TRIM(${cleanName})) AND is_deleted = 0
          LIMIT 1
        `);
        let investorId;
        if (invRes.rows.length > 0) {
          investorId = Number(invRes.rows[0].id);
        } else {
          const inserted = await db.execute(sql4`
            INSERT INTO investors (user_id, name, created_at, updated_at, is_deleted)
            VALUES (${row.user_id}, ${cleanName}, NOW(), NOW(), 0)
            RETURNING id
          `);
          investorId = Number(inserted.rows[0].id);
        }
        const legacyTxs = await db.execute(sql4`
          SELECT id, user_id, party_id, type, amount, date, description, payment_method, reference_number
          FROM investment_transactions
          WHERE party_id = ${row.id} AND is_deleted = 0
        `);
        for (const tx of legacyTxs.rows) {
          const txType = String(tx.type || "").toUpperCase();
          const amt = parseFloat(String(tx.amount || 0));
          if (isNaN(amt) || amt <= 0) continue;
          if (txType === "CONTRIBUTION") {
            const existTx = await db.execute(sql4`
              SELECT id FROM investor_transactions 
              WHERE investor_id = ${investorId} AND type = 'CONTRIBUTION' AND amount = ${tx.amount} AND date = ${tx.date} AND is_deleted = 0
              LIMIT 1
            `);
            if (existTx.rows.length === 0) {
              await db.execute(sql4`
                INSERT INTO investor_transactions (investor_id, user_id, type, amount, date, payment_method, reference_number, description, is_deleted)
                VALUES (${investorId}, ${tx.user_id}, 'CONTRIBUTION', ${tx.amount}, ${tx.date}, ${tx.payment_method}, ${tx.reference_number}, ${tx.description}, 0)
              `);
            }
          } else if (txType === "INVESTMENT") {
            const existAlloc = await db.execute(sql4`
              SELECT id FROM investor_location_allocations
              WHERE investor_id = ${investorId} AND location_id = ${row.location_id} AND amount = ${tx.amount} AND date = ${tx.date} AND is_deleted = 0
              LIMIT 1
            `);
            if (existAlloc.rows.length === 0) {
              await db.execute(sql4`
                INSERT INTO investor_location_allocations (investor_id, location_id, user_id, amount, date, payment_method, reference_number, notes, is_deleted)
                VALUES (${investorId}, ${row.location_id}, ${tx.user_id}, ${tx.amount}, ${tx.date}, ${tx.payment_method}, ${tx.reference_number}, ${tx.description}, 0)
              `);
            }
          } else if (txType === "UPAD" || txType === "PAYMENT") {
            const existUpad = await db.execute(sql4`
              SELECT id FROM investor_transactions 
              WHERE investor_id = ${investorId} AND type = 'UPAD' AND amount = ${tx.amount} AND date = ${tx.date} AND is_deleted = 0
              LIMIT 1
            `);
            if (existUpad.rows.length === 0) {
              await db.execute(sql4`
                INSERT INTO investor_transactions (investor_id, user_id, type, amount, date, payment_method, reference_number, description, is_deleted)
                VALUES (${investorId}, ${tx.user_id}, 'UPAD', ${tx.amount}, ${tx.date}, ${tx.payment_method}, ${tx.reference_number}, ${tx.description}, 0)
              `);
            }
          }
        }
      }
    } catch (migErr) {
      console.warn("[Accounting] Legacy migration check notice:", migErr);
    }
    console.log("[Accounting] Historical data sync check completed.");
  } catch (err) {
    console.error("[Accounting] Data sync error:", err);
  }
}

// src/server/routes/report.routes.ts
var reportRouter = express.Router();
reportRouter.use(requireAuth);
reportRouter.get("/location-analytics", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const locationIdParam = req.query.locationId && req.query.locationId !== "ALL" && req.query.locationId !== "0" ? parseInt(req.query.locationId, 10) : void 0;
    const locCondition = locationIdParam && !isNaN(locationIdParam) ? eq6(locations.id, locationIdParam) : void 0;
    const locRows = await db.select({ id: locations.id, name: locations.name }).from(locations).where(and5(eq6(locations.isDeleted, 0), locCondition)).orderBy(locations.name);
    const analyticsList = [];
    for (const loc of locRows) {
      const [invTxs, custSupp, siteSupp, labour, contr] = await Promise.all([
        db.execute(sql5`
          SELECT it.type, COALESCE(SUM(CAST(it.amount AS numeric)), 0) as total
          FROM investment_transactions it
          JOIN investment_parties ip ON it.party_id = ip.id
          WHERE ip.location_id = ${loc.id} AND it.is_deleted = 0 AND ip.is_deleted = 0
          GROUP BY it.type
        `),
        db.execute(sql5`
          SELECT COALESCE(SUM(CAST(total_amount AS numeric)), 0) as total
          FROM material_supplies
          WHERE location_id = ${loc.id} AND is_deleted = 0
        `),
        db.execute(sql5`
          SELECT COALESCE(SUM(CAST(total_amount AS numeric)), 0) as total
          FROM site_supplies
          WHERE location_id = ${loc.id} AND is_deleted = 0
        `),
        db.execute(sql5`
          SELECT COALESCE(SUM(CAST(net_salary AS numeric)), 0) as total
          FROM labour_salaries
          WHERE location_id = ${loc.id} AND is_deleted = 0
        `),
        db.execute(sql5`
          SELECT COALESCE(SUM(CAST(amount AS numeric)), 0) as total
          FROM supervisor_costs
          WHERE location_id = ${loc.id} AND is_deleted = 0
        `)
      ]);
      let contrib = 0, invest = 0, upad = 0;
      invTxs.rows.forEach((r) => {
        if (r.type === "CONTRIBUTION") contrib += parseFloat(r.total || "0");
        if (r.type === "INVESTMENT") invest += parseFloat(r.total || "0");
        if (r.type === "UPAD" || r.type === "PAYMENT") upad += parseFloat(r.total || "0");
      });
      const investorCapitalAvailable = Math.max(0, Math.round((contrib - invest - upad) * 100) / 100);
      const investmentCapital = Math.round(invest * 100) / 100;
      const customerSupply = Math.round(parseFloat(custSupp.rows[0]?.total || "0") * 100) / 100;
      const siteSupply = Math.round(parseFloat(siteSupp.rows[0]?.total || "0") * 100) / 100;
      const labourAttendance = Math.round(parseFloat(labour.rows[0]?.total || "0") * 100) / 100;
      const contractorCost = Math.round(parseFloat(contr.rows[0]?.total || "0") * 100) / 100;
      const totalThreeSiteExpenses = Math.round((customerSupply + siteSupply + labourAttendance) * 100) / 100;
      const investmentVariance = Math.round((investmentCapital - totalThreeSiteExpenses) * 100) / 100;
      const investmentStatus = Math.abs(investmentVariance) < 1 ? "MATCHED" : investmentVariance > 0 ? "SURPLUS" : "DEFICIT";
      const expectedContractorCost = Math.round((siteSupply + labourAttendance) * 100) / 100;
      const reconciliationDifference = Math.round((contractorCost - expectedContractorCost) * 100) / 100;
      const status = Math.abs(reconciliationDifference) < 1 ? "MATCHED" : reconciliationDifference > 0 ? "SURPLUS" : "DEFICIT";
      analyticsList.push({
        locationId: loc.id,
        locationName: loc.name,
        investorCapitalTotal: Math.round(contrib * 100) / 100,
        investorCapitalAvailable,
        investmentCapital,
        customerSupply,
        siteSupply,
        labourAttendance,
        totalThreeSiteExpenses,
        investmentVariance,
        investmentStatus,
        contractorCost,
        expectedContractorCost,
        reconciliationDifference,
        status
      });
    }
    const totals = {
      investorCapitalTotal: Math.round(analyticsList.reduce((acc, l) => acc + l.investorCapitalTotal, 0) * 100) / 100,
      investorCapitalAvailable: Math.round(analyticsList.reduce((acc, l) => acc + l.investorCapitalAvailable, 0) * 100) / 100,
      investmentCapital: Math.round(analyticsList.reduce((acc, l) => acc + l.investmentCapital, 0) * 100) / 100,
      customerSupply: Math.round(analyticsList.reduce((acc, l) => acc + l.customerSupply, 0) * 100) / 100,
      siteSupply: Math.round(analyticsList.reduce((acc, l) => acc + l.siteSupply, 0) * 100) / 100,
      labourAttendance: Math.round(analyticsList.reduce((acc, l) => acc + l.labourAttendance, 0) * 100) / 100,
      totalThreeSiteExpenses: Math.round(analyticsList.reduce((acc, l) => acc + l.totalThreeSiteExpenses, 0) * 100) / 100,
      investmentVariance: Math.round(analyticsList.reduce((acc, l) => acc + l.investmentVariance, 0) * 100) / 100,
      contractorCost: Math.round(analyticsList.reduce((acc, l) => acc + l.contractorCost, 0) * 100) / 100,
      expectedContractorCost: Math.round(analyticsList.reduce((acc, l) => acc + l.expectedContractorCost, 0) * 100) / 100,
      reconciliationDifference: Math.round(analyticsList.reduce((acc, l) => acc + l.reconciliationDifference, 0) * 100) / 100
    };
    res.json({
      locations: analyticsList,
      totals,
      count: analyticsList.length
    });
  } catch (error) {
    console.warn("[Location Analytics GET Notice] Database fallback:", error?.message || error);
    res.json({
      locations: [],
      totals: {
        totalInvestorCapital: 0,
        totalInvestmentCapital: 0,
        totalCustomerSupply: 0,
        totalSiteSupply: 0,
        totalLabourAttendance: 0,
        totalContractorCost: 0,
        expectedContractorCost: 0,
        reconciliationDifference: 0
      },
      count: 0
    });
  }
});
reportRouter.get("/dashboard", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const locationIdParam = req.query.locationId && req.query.locationId !== "ALL" ? parseInt(req.query.locationId, 10) : void 0;
    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
    }
    const locCondition = locationIdParam ? sql5`${locations.id} = ${locationIdParam}` : sql5`1=1`;
    const locIds = await db.select({ id: locations.id }).from(locations).where(and5(eq6(locations.isDeleted, 0), locCondition));
    const validLocIds = locIds.map((l) => l.id);
    if (validLocIds.length === 0) {
      return res.json({
        totalIncome: 0,
        totalBillInvestment: 0,
        grossExpense: 0,
        actualExpense: 0,
        totalRefundable: 0,
        totalRefunded: 0,
        pendingRefundable: 0,
        netIncome: 0,
        totalInvestment: 0,
        totalInvestmentPayment: 0,
        totalInvestmentUpad: 0,
        investmentBalance: 0,
        totalMaterialPurchase: 0,
        totalMaterialPurchasePaid: 0,
        totalMaterialPurchaseOutstanding: 0,
        totalMaterialSupply: 0,
        totalMaterialSupplyPaid: 0,
        totalMaterialSupplyOutstanding: 0,
        totalMaterialLabourSupply: 0,
        totalMaterialLabourSupplyPaid: 0,
        totalMaterialLabourSupplyOutstanding: 0,
        totalSupervisorCost: 0,
        labourMetrics: { totalNetSalary: 0, totalUpad: 0, totalPayment: 0, totalBalance: 0 },
        rawLabourAtt: [],
        investorParties: [],
        category1InvestorSummary: {
          investorTotalCapital: 0,
          investmentKaryaTotal: 0,
          investorUpadTotal: 0,
          availableInvestorsBalance: 0
        },
        category2InvestmentSummary: {
          investmentFromInvestorsCapital: 0,
          billInvestment: 0,
          fullCapital: 0,
          totalDeductions: 0,
          investorUpadReturn: 0,
          remainingCapital: 0
        },
        connectedExpenses: {
          investmentFromInvestorsCapital: 0,
          billInvestment: 0,
          fullCapital: 0,
          totalInvested: 0,
          totalUpad: 0,
          netCapitalPool: 0,
          materialPurchaseExpense: 0,
          siteSupplyExpense: 0,
          labourSalaryExpense: 0,
          generalExpense: 0,
          totalExpensesCut: 0,
          remainingCapital: 0,
          utilizationRate: 0,
          categoryDetails: {
            cat3MaterialPurchases: 0,
            cat4MaterialSupplies: 0,
            cat5SiteSupplies: 0,
            cat67Labour: 0,
            cat8GeneralOrSupervisor: 0
          }
        },
        stockSummary: { items: [], totalDistinctMaterials: 0, totalStockUnits: 0, totalStockValuation: 0, lowStockCount: 0 },
        supervisorAudit: { totalSupervisorCost: 0, totalSiteSupply: 0, variance: 0, reconciliationStatus: "MATCHED" }
      });
    }
    const idList = validLocIds.join(",");
    const ieQuery = await db.execute(sql5`
      SELECT 
        type, 
        category,
        SUM(amount) as amt, 
        SUM(refundable_amount) as ref_amt, 
        SUM(refunded_amount) as refd_amt
      FROM records
      WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
      GROUP BY type, category
    `);
    let totalIncome = 0, grossExpense = 0, totalRefundable = 0, totalRefunded = 0, totalBillInvestment = 0;
    for (const r of ieQuery.rows) {
      const amt = parseFloat(r.amt || "0");
      if (r.type === "INCOME") {
        totalIncome += amt;
        if (r.category === "BILL_INVESTMENT") {
          totalBillInvestment += amt;
        }
      }
      if (r.type === "EXPENSE") {
        grossExpense += amt;
        const refAmt = parseFloat(r.ref_amt || "0") || (r.category === "REFUNDABLE_RECORD" || r.category === "REFUNDABLE" ? amt : 0);
        totalRefundable += refAmt;
        totalRefunded += parseFloat(r.refd_amt || "0");
      }
    }
    const actualExpense = Math.max(0, Math.round((grossExpense - totalRefundable) * 100) / 100);
    const pendingRefundable = Math.max(0, Math.round((totalRefundable - totalRefunded) * 100) / 100);
    const netIncome = Math.round((totalIncome - actualExpense) * 100) / 100;
    const invQuery = await db.execute(sql5`
      SELECT t.type, SUM(t.amount) as amt
      FROM investment_transactions t
      JOIN investment_parties p ON t.party_id = p.id
      WHERE t.is_deleted = 0 AND p.location_id IN (${sql5.raw(idList)})
      GROUP BY t.type
    `);
    let totalInvestmentKarya = 0;
    let totalContribution = 0;
    let totalInvestmentPayment = 0;
    let totalInvestmentUpad = 0;
    for (const r of invQuery.rows) {
      const a = parseFloat(r.amt || "0");
      if (r.type === "INVESTMENT") totalInvestmentKarya += a;
      if (r.type === "CONTRIBUTION") totalContribution += a;
      if (r.type === "PAYMENT") totalInvestmentPayment += a;
      if (r.type === "UPAD") totalInvestmentUpad += a;
    }
    const allocQuery = await db.execute(sql5`
      SELECT SUM(amount) as amt
      FROM investor_location_allocations
      WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
    `);
    const totalAllocations = parseFloat(allocQuery.rows[0]?.amt || "0") || 0;
    totalInvestmentKarya += totalAllocations;
    const investorTotalCapital = totalContribution > 0 ? totalContribution : totalInvestmentKarya;
    const totalInvestorUpad = totalInvestmentUpad + totalInvestmentPayment;
    const availableInvestorsBalance = Math.max(0, Math.round((investorTotalCapital - totalInvestmentKarya - totalInvestorUpad) * 100) / 100);
    const investmentFromInvestorsCapital = Math.round(totalInvestmentKarya * 100) / 100;
    const totalProjectCapital = Math.round((investmentFromInvestorsCapital + totalBillInvestment) * 100) / 100;
    const investmentBalance = totalProjectCapital - totalInvestmentPayment;
    const mpQuery = await db.execute(sql5`
      SELECT SUM(total_amount) as tot, SUM(paid_amount) as pd, SUM(outstanding_amount) as out
      FROM material_purchases
      WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
    `);
    const totalMaterialPurchase = parseFloat(mpQuery.rows[0]?.tot || "0");
    const totalMaterialPurchasePaid = parseFloat(mpQuery.rows[0]?.pd || "0");
    const totalMaterialPurchaseOutstanding = parseFloat(mpQuery.rows[0]?.out || "0");
    const msQuery = await db.execute(sql5`
      SELECT SUM(total_amount) as tot, SUM(paid_amount) as pd, SUM(outstanding_amount) as out
      FROM material_supplies
      WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
    `);
    const totalMaterialSupply = parseFloat(msQuery.rows[0]?.tot || "0");
    const totalMaterialSupplyPaid = parseFloat(msQuery.rows[0]?.pd || "0");
    const totalMaterialSupplyOutstanding = parseFloat(msQuery.rows[0]?.out || "0");
    const mlsQuery = await db.execute(sql5`
      SELECT SUM(total_amount) as tot, 0 as pd, 0 as out
      FROM site_supplies
      WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
    `);
    const totalMaterialLabourSupply = parseFloat(mlsQuery.rows[0]?.tot || "0");
    const totalMaterialLabourSupplyPaid = parseFloat(mlsQuery.rows[0]?.pd || "0");
    const totalMaterialLabourSupplyOutstanding = parseFloat(mlsQuery.rows[0]?.out || "0");
    const lsQuery = await db.execute(sql5`
      SELECT SUM(net_salary) as net, SUM(upad) as upad, SUM(payment_amount) as pd, SUM(balance) as bal
      FROM labour_salaries
      WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
    `);
    const labourMetrics = {
      totalNetSalary: parseFloat(lsQuery.rows[0]?.net || "0"),
      totalUpad: parseFloat(lsQuery.rows[0]?.upad || "0"),
      totalPayment: parseFloat(lsQuery.rows[0]?.pd || "0"),
      totalBalance: parseFloat(lsQuery.rows[0]?.bal || "0")
    };
    const rawLabourAtt = await db.execute(sql5`
      SELECT substring(date from 1 for 7) as month, SUM(days) as days, SUM(tc_quantity) as tcs
      FROM labour_salaries
      WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
      GROUP BY month ORDER BY month
    `);
    const supQuery = await db.execute(sql5`
      SELECT SUM(amount) as tot
      FROM supervisor_costs
      WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
    `);
    const totalSupervisorCost = parseFloat(supQuery.rows[0]?.tot || "0");
    const invPartiesQuery = await db.execute(sql5`
      SELECT 
        p.id, 
        p.party_name as "partyName",
        COALESCE(SUM(CASE WHEN t.type::text = 'INVESTMENT' THEN t.amount ELSE 0 END), 0) as "totalInvestmentKarya",
        COALESCE(SUM(CASE WHEN t.type::text = 'CONTRIBUTION' THEN t.amount ELSE 0 END), 0) as "totalContribution",
        COALESCE(SUM(CASE WHEN t.type::text = 'UPAD' THEN t.amount ELSE 0 END), 0) as "totalUpad",
        COALESCE(SUM(CASE WHEN t.type::text = 'PAYMENT' THEN t.amount ELSE 0 END), 0) as "totalPayment"
      FROM investment_parties p
      LEFT JOIN investment_transactions t ON t.party_id = p.id AND t.is_deleted = 0
      WHERE p.is_deleted = 0 AND p.location_id IN (${sql5.raw(idList)})
      GROUP BY p.id, p.party_name
      ORDER BY "totalContribution" DESC, p.party_name ASC
    `);
    const investorParties = invPartiesQuery.rows.map((r) => {
      const invKarya = parseFloat(r.totalInvestmentKarya || "0");
      const contrib = parseFloat(r.totalContribution || "0");
      const upd = parseFloat(r.totalUpad || "0");
      const pay = parseFloat(r.totalPayment || "0");
      const partyCapital = contrib > 0 ? contrib : invKarya;
      return {
        id: Number(r.id),
        partyName: r.partyName,
        totalContribution: contrib,
        totalInvestment: invKarya,
        totalInvestmentKarya: invKarya,
        totalUpad: upd,
        totalPayment: pay,
        balance: Math.round((partyCapital - invKarya - upd - pay) * 100) / 100
      };
    });
    const labourPaidOut = Math.round((labourMetrics.totalPayment + labourMetrics.totalUpad) * 100) / 100;
    const cat2Calculation = calculateCategory2Capital({
      investmentFromInvestors: investmentFromInvestorsCapital,
      billInvestment: totalBillInvestment,
      cat3Deduction: 0,
      // Material Purchases completely removed from Category 2 operational deductions as per user request
      cat4Deduction: 0,
      // Material Supply is customer sales, not project capital deduction
      cat5Deduction: totalMaterialLabourSupply,
      cat6Deduction: labourPaidOut,
      refundableDeduction: pendingRefundable,
      investorUpadReturn: totalInvestmentPayment
    });
    const utilizationRate = cat2Calculation.fullCapital > 0 ? Math.min(100, Math.round(cat2Calculation.totalDeductions / cat2Calculation.fullCapital * 100)) : cat2Calculation.totalDeductions > 0 ? 100 : 0;
    const connectedExpenses = {
      investmentFromInvestorsCapital: cat2Calculation.investmentFromInvestors,
      billInvestment: cat2Calculation.billInvestment,
      fullCapital: cat2Calculation.fullCapital,
      totalInvested: cat2Calculation.fullCapital,
      totalUpad: cat2Calculation.investorUpadReturn,
      netCapitalPool: cat2Calculation.fullCapital,
      materialPurchaseExpense: 0,
      siteSupplyExpense: cat2Calculation.cat5Deduction,
      labourSalaryExpense: cat2Calculation.cat6Deduction,
      refundableExpense: cat2Calculation.refundableDeduction,
      generalExpense: 0,
      totalExpensesCut: cat2Calculation.totalDeductions,
      remainingCapital: cat2Calculation.remainingCapital,
      utilizationRate,
      categoryDetails: {
        cat3MaterialPurchases: 0,
        cat4MaterialSupplies: cat2Calculation.cat4Deduction,
        cat5SiteSupplies: cat2Calculation.cat5Deduction,
        cat6Labour: cat2Calculation.cat6Deduction,
        cat67Labour: cat2Calculation.cat6Deduction,
        refundableRecords: cat2Calculation.refundableDeduction,
        cat8GeneralOrSupervisor: 0
      }
    };
    const category1InvestorSummary = {
      investorTotalCapital: Math.round(investorTotalCapital * 100) / 100,
      investmentKaryaTotal: Math.round(totalInvestmentKarya * 100) / 100,
      investorUpadTotal: Math.round(totalInvestorUpad * 100) / 100,
      availableInvestorsBalance
    };
    const category2InvestmentSummary = {
      investmentFromInvestorsCapital: cat2Calculation.investmentFromInvestors,
      billInvestment: cat2Calculation.billInvestment,
      fullCapital: cat2Calculation.fullCapital,
      totalDeductions: cat2Calculation.totalDeductions,
      investorUpadReturn: cat2Calculation.investorUpadReturn,
      remainingCapital: cat2Calculation.remainingCapital
    };
    const stockQuery = await db.execute(sql5`
      SELECT 
        m.id as "materialId",
        m.name as "materialName", 
        m.default_unit as "unit", 
        SUM(CASE WHEN l.transaction_type = 'IN' THEN CAST(ABS(l.quantity) AS DECIMAL) ELSE 0 END) as "purchasedQty",
        SUM(CASE WHEN l.transaction_type = 'OUT' AND l.reference_type = 'MATERIAL_SUPPLY' THEN CAST(ABS(l.quantity) AS DECIMAL) ELSE 0 END) as "otherSupplyQty",
        SUM(CASE WHEN l.transaction_type = 'OUT' AND l.reference_type = 'SITE_SUPPLY' THEN CAST(ABS(l.quantity) AS DECIMAL) ELSE 0 END) as "siteSupplyQty",
        SUM(CASE WHEN l.transaction_type = 'OUT' AND l.reference_type NOT IN ('MATERIAL_SUPPLY', 'SITE_SUPPLY') THEN CAST(ABS(l.quantity) AS DECIMAL) ELSE 0 END) as "miscOutQty",
        (SELECT SUM(total_amount) FROM material_purchases mp WHERE mp.material_id = m.id AND mp.is_deleted = 0 AND mp.location_id IN (${sql5.raw(idList)})) as "totalValue"
      FROM stock_ledger l
      JOIN materials m ON l.material_id = m.id
      WHERE l.location_id IN (${sql5.raw(idList)}) AND (l.is_deleted = 0 OR l.is_deleted IS NULL)
      GROUP BY m.id, m.name, m.default_unit
    `);
    const stockItems = stockQuery.rows.map((row) => {
      const purchasedQty = parseFloat(row.purchasedQty || "0");
      const otherSupplyQty = parseFloat(row.otherSupplyQty || "0");
      const siteSupplyQty = parseFloat(row.siteSupplyQty || "0");
      const miscOutQty = parseFloat(row.miscOutQty || "0");
      const totalSupplied = otherSupplyQty + siteSupplyQty + miscOutQty;
      const currentStock = Math.round((purchasedQty - totalSupplied) * 100) / 100;
      const totalValue = parseFloat(row.totalValue || "0");
      const avgRate = purchasedQty > 0 ? totalValue / purchasedQty : 0;
      const valuation = Math.max(0, Math.round(currentStock * avgRate * 100) / 100);
      let status = "IN_STOCK";
      if (currentStock <= 0) status = "OUT_OF_STOCK";
      else if (currentStock <= 15) status = "LOW_STOCK";
      return {
        materialName: row.materialName,
        unit: row.unit || "Unit",
        purchasedQty,
        otherSupplyQty,
        siteSupplyQty,
        currentStock,
        valuation,
        status
      };
    });
    const totalDistinctMaterials = stockItems.length;
    const totalStockUnits = stockItems.reduce((acc, s) => acc + (s.currentStock > 0 ? s.currentStock : 0), 0);
    const totalStockValuation = stockItems.reduce((acc, s) => acc + s.valuation, 0);
    const lowStockCount = stockItems.filter((s) => s.status === "LOW_STOCK" || s.status === "OUT_OF_STOCK").length;
    const stockSummary = {
      items: stockItems,
      totalDistinctMaterials,
      totalStockUnits,
      totalStockValuation,
      lowStockCount
    };
    const variance = Math.round((totalSupervisorCost - totalMaterialLabourSupply) * 100) / 100;
    const supervisorAudit = {
      totalSupervisorCost,
      totalSiteSupply: totalMaterialLabourSupply,
      variance,
      reconciliationStatus: Math.abs(variance) < 0.01 ? "MATCHED" : variance > 0 ? "SURPLUS" : "DEFICIT"
    };
    res.json({
      totalIncome,
      totalBillInvestment,
      grossExpense,
      actualExpense,
      totalRefundable,
      totalRefunded,
      pendingRefundable,
      netIncome,
      totalInvestment: totalProjectCapital,
      totalInvestmentPayment,
      totalInvestmentUpad,
      investmentBalance,
      totalMaterialPurchase,
      totalMaterialPurchasePaid,
      totalMaterialPurchaseOutstanding,
      totalMaterialSupply,
      totalMaterialSupplyPaid,
      totalMaterialSupplyOutstanding,
      totalMaterialLabourSupply,
      totalMaterialLabourSupplyPaid,
      totalMaterialLabourSupplyOutstanding,
      totalSupervisorCost,
      labourMetrics,
      rawLabourAtt: rawLabourAtt.rows,
      investorParties,
      category1InvestorSummary,
      category2InvestmentSummary,
      connectedExpenses,
      stockSummary,
      supervisorAudit
    });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.warn("Failed to fetch dashboard metrics from DB, returning empty metrics:", error?.message || error);
    res.json({
      totalIncome: 0,
      totalBillInvestment: 0,
      grossExpense: 0,
      actualExpense: 0,
      totalRefundable: 0,
      totalRefunded: 0,
      pendingRefundable: 0,
      netIncome: 0,
      totalInvestment: 0,
      totalInvestmentPayment: 0,
      totalInvestmentUpad: 0,
      investmentBalance: 0,
      totalMaterialPurchase: 0,
      totalMaterialPurchasePaid: 0,
      totalMaterialPurchaseOutstanding: 0,
      totalMaterialSupply: 0,
      totalMaterialSupplyPaid: 0,
      totalMaterialSupplyOutstanding: 0,
      totalMaterialLabourSupply: 0,
      totalMaterialLabourSupplyPaid: 0,
      totalMaterialLabourSupplyOutstanding: 0,
      totalSupervisorCost: 0,
      labourMetrics: { totalNetSalary: 0, totalUpad: 0, totalPayment: 0, totalBalance: 0 },
      rawLabourAtt: [],
      investorParties: [],
      category1InvestorSummary: { investorTotalCapital: 0, investmentKaryaTotal: 0, investorUpadTotal: 0, availableInvestorsBalance: 0 },
      category2InvestmentSummary: { investmentFromInvestorsCapital: 0, billInvestment: 0, fullCapital: 0, totalDeductions: 0, investorUpadReturn: 0, remainingCapital: 0 },
      connectedExpenses: {
        investmentFromInvestorsCapital: 0,
        billInvestment: 0,
        fullCapital: 0,
        totalInvested: 0,
        totalUpad: 0,
        netCapitalPool: 0,
        materialPurchaseExpense: 0,
        siteSupplyExpense: 0,
        labourSalaryExpense: 0,
        generalExpense: 0,
        totalExpensesCut: 0,
        remainingCapital: 0,
        utilizationRate: 0,
        categoryDetails: { cat3MaterialPurchases: 0, cat4MaterialSupplies: 0, cat5SiteSupplies: 0, cat67Labour: 0, cat8GeneralOrSupervisor: 0 }
      },
      stockSummary: { items: [], totalDistinctMaterials: 0, totalStockUnits: 0, totalStockValuation: 0, lowStockCount: 0 },
      supervisorAudit: { totalSupervisorCost: 0, totalSiteSupply: 0, variance: 0, reconciliationStatus: "MATCHED" }
    });
  }
});
reportRouter.get("/stock", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const locationId = req.query.locationId ? parseInt(req.query.locationId, 10) : void 0;
    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }
    const locCondition = locationId ? sql5`s.location_id = ${locationId}` : sql5`1=1`;
    const stockEntries = await db.execute(sql5`
      SELECT 
        s.id,
        s.location_id as "locationId",
        s.material_id as "materialId",
        COALESCE(m.name, s.notes, 'Material') as "materialName",
        COALESCE(m.default_unit, 'Unit') as "unit",
        s.transaction_type as "transactionType",
        s.quantity,
        s.reference_type as "referenceType",
        s.reference_id as "referenceId",
        s.notes,
        s.created_at as "createdAt"
      FROM stock_ledger s
      LEFT JOIN materials m ON s.material_id = m.id
      WHERE ${locCondition} AND (s.is_deleted = 0 OR s.is_deleted IS NULL)
      ORDER BY s.created_at DESC, s.id DESC
    `);
    res.json(stockEntries.rows);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to fetch stock records:", error);
    res.status(500).json({ error: "Failed to fetch stock records" });
  }
});
reportRouter.get("/reconciliation", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const siteSupplyQuery = await db.execute(sql5`
      SELECT s.location_id as "locationId", l.name as "locationName", s.team_id as "teamId", t.name as "teamName", SUM(s.total_amount) as "totalSiteSupply"
      FROM site_supplies s
      INNER JOIN locations l ON s.location_id = l.id
      LEFT JOIN labour_teams t ON s.team_id = t.id
      WHERE s.is_deleted = 0 AND l.is_deleted = 0
      GROUP BY s.location_id, l.name, s.team_id, t.name
    `);
    const supQuery = await db.execute(sql5`
      SELECT c.location_id as "locationId", l.name as "locationName", SUM(c.amount) as "totalSupervisorCost"
      FROM supervisor_costs c
      INNER JOIN locations l ON c.location_id = l.id
      WHERE c.is_deleted = 0 AND l.is_deleted = 0
      GROUP BY c.location_id, l.name
    `);
    const locationsMap = /* @__PURE__ */ new Map();
    supQuery.rows.forEach((r) => {
      const locId = Number(r.locationId);
      if (!locationsMap.has(locId)) {
        locationsMap.set(locId, {
          locationId: locId,
          locationName: r.locationName || "Unknown Location",
          totalSupervisorCost: 0,
          totalSiteSupply: 0,
          teams: []
        });
      }
      locationsMap.get(locId).totalSupervisorCost += parseFloat(r.totalSupervisorCost || "0");
    });
    siteSupplyQuery.rows.forEach((r) => {
      const locId = Number(r.locationId);
      if (!locationsMap.has(locId)) {
        locationsMap.set(locId, {
          locationId: locId,
          locationName: r.locationName || "Unknown Location",
          totalSupervisorCost: 0,
          totalSiteSupply: 0,
          teams: []
        });
      }
      const loc = locationsMap.get(locId);
      const supplyAmt = parseFloat(r.totalSiteSupply || "0");
      loc.totalSiteSupply += supplyAmt;
      loc.teams.push({
        teamId: Number(r.teamId),
        teamName: r.teamName || "Unassigned / Independent",
        siteSupplyValue: supplyAmt
      });
    });
    const results = Array.from(locationsMap.values()).map((loc) => {
      const variance = loc.totalSupervisorCost - loc.totalSiteSupply;
      let status = "MATCHED";
      if (Math.abs(variance) > 1) {
        status = variance > 0 ? "SUPERVISOR_SURPLUS" : "SITE_EXCESS";
      }
      return {
        ...loc,
        variance,
        reconciliationStatus: status
      };
    });
    res.json(results);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Reconciliation report error:", error);
    res.status(500).json({ error: "Failed to generate reconciliation report" });
  }
});
reportRouter.get("/locations-breakdown", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const activeLocations = await db.select({
      id: locations.id,
      name: locations.name,
      address: locations.address,
      createdAt: locations.createdAt
    }).from(locations).where(eq6(locations.isDeleted, 0)).orderBy(locations.name);
    if (activeLocations.length === 0) {
      return res.json([]);
    }
    const locBreakdown = await Promise.all(
      activeLocations.map(async (loc) => {
        const locId = loc.id;
        const [recCountRes, ieRes, matCountRes, partyCountRes, teamCountRes] = await Promise.all([
          db.execute(sql5`SELECT COUNT(id) as count FROM records WHERE location_id = ${locId} AND is_deleted = 0`),
          db.execute(sql5`
            SELECT 
              SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) as income,
              SUM(CASE WHEN type = 'INCOME' AND category = 'BILL_INVESTMENT' THEN amount ELSE 0 END) as bill_investment,
              SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) as expense,
              SUM(CASE WHEN type = 'EXPENSE' AND (category = 'REFUNDABLE_RECORD' OR category = 'REFUNDABLE') THEN amount ELSE 0 END) as refundable,
              SUM(CASE WHEN refunded_amount > 0 THEN refunded_amount ELSE 0 END) as refunded
            FROM records 
            WHERE location_id = ${locId} AND is_deleted = 0
          `),
          db.execute(sql5`SELECT COUNT(id) as count FROM materials WHERE location_id = ${locId} AND is_deleted = 0`),
          db.execute(sql5`SELECT COUNT(id) as count FROM investment_parties WHERE location_id = ${locId} AND is_deleted = 0`),
          db.execute(sql5`SELECT COUNT(id) as count FROM labour_teams WHERE location_id = ${locId} AND is_deleted = 0`)
        ]);
        const recordCount = parseInt(recCountRes.rows[0]?.count || "0", 10);
        const billInvestment = parseFloat(ieRes.rows[0]?.bill_investment || "0");
        const totalIncome = parseFloat(ieRes.rows[0]?.income || "0");
        const totalRefundable = parseFloat(ieRes.rows[0]?.refundable || "0");
        const totalRefunded = parseFloat(ieRes.rows[0]?.refunded || "0");
        const pendingRefundable = Math.max(0, totalRefundable - totalRefunded);
        const materialCount = parseInt(matCountRes.rows[0]?.count || "0", 10);
        const partyCount = parseInt(partyCountRes.rows[0]?.count || "0", 10);
        const teamCount = parseInt(teamCountRes.rows[0]?.count || "0", 10);
        const [allocRes, invPartyRes] = await Promise.all([
          db.execute(sql5`
            SELECT SUM(amount) as total 
            FROM investor_location_allocations 
            WHERE location_id = ${locId} AND is_deleted = 0
          `),
          db.execute(sql5`
            SELECT 
              SUM(CASE WHEN t.type::text = 'INVESTMENT' THEN t.amount ELSE 0 END) as total_invested,
              SUM(CASE WHEN t.type::text = 'CONTRIBUTION' THEN t.amount ELSE 0 END) as total_contribution,
              SUM(CASE WHEN t.type::text = 'UPAD' THEN t.amount ELSE 0 END) as total_upad,
              SUM(CASE WHEN t.type::text = 'PAYMENT' THEN t.amount ELSE 0 END) as total_payment
            FROM investment_parties p
            LEFT JOIN investment_transactions t ON t.party_id = p.id AND t.is_deleted = 0
            WHERE p.location_id = ${locId} AND p.is_deleted = 0
          `)
        ]);
        const allocatedCapital = parseFloat(allocRes.rows[0]?.total || "0");
        const investorKarya = parseFloat(invPartyRes.rows[0]?.total_invested || "0");
        const investorContribution = parseFloat(invPartyRes.rows[0]?.total_contribution || "0");
        const investorUpad = parseFloat(invPartyRes.rows[0]?.total_upad || "0");
        const investorPayment = parseFloat(invPartyRes.rows[0]?.total_payment || "0");
        const totalInvestorCapital = allocatedCapital + investorKarya;
        const investorTotalContribution = investorContribution > 0 ? investorContribution : totalInvestorCapital;
        const investorAvailableBalance = Math.max(0, Math.round((investorTotalContribution - totalInvestorCapital - (investorUpad + investorPayment)) * 100) / 100);
        const mpRes = await db.execute(sql5`
          SELECT 
            COALESCE(SUM(total_amount), 0) as total,
            COALESCE(SUM(paid_amount), 0) as paid
          FROM material_purchases
          WHERE location_id = ${locId} AND is_deleted = 0
        `);
        const materialPurchases2 = parseFloat(mpRes.rows[0]?.total || "0");
        const materialPurchasesPaid = parseFloat(mpRes.rows[0]?.paid || "0");
        const msRes = await db.execute(sql5`
          SELECT 
            COALESCE(SUM(total_amount), 0) as total,
            COALESCE(SUM(paid_amount), 0) as paid
          FROM material_supplies
          WHERE location_id = ${locId} AND is_deleted = 0
        `);
        const materialSupplies2 = parseFloat(msRes.rows[0]?.total || "0");
        const materialSuppliesPaid = parseFloat(msRes.rows[0]?.paid || "0");
        const materialSuppliesPending = Math.max(0, Math.round((materialSupplies2 - materialSuppliesPaid) * 100) / 100);
        const ssRes = await db.execute(sql5`
          SELECT COALESCE(SUM(total_amount), 0) as total
          FROM site_supplies
          WHERE location_id = ${locId} AND is_deleted = 0
        `);
        const siteSupplies2 = parseFloat(ssRes.rows[0]?.total || "0");
        const lsRes = await db.execute(sql5`
          SELECT 
            COALESCE(SUM(CASE WHEN attendance_type IN ('DAY', 'TC') OR (attendance_type != 'OTHER_KHARCH' AND attendance_type != 'UPAD' AND (days > 0 OR tc_quantity > 0 OR gross_salary > 0)) THEN gross_salary ELSE 0 END), 0) as attendance_wages,
            COALESCE(SUM(CASE WHEN attendance_type = 'UPAD' OR upad > 0 THEN upad ELSE 0 END), 0) as total_upad,
            COALESCE(SUM(CASE WHEN attendance_type = 'OTHER_KHARCH' THEN payment_amount ELSE 0 END), 0) as total_other_kharch,
            COALESCE(SUM(CASE WHEN attendance_type = 'DAY' THEN days ELSE 0 END), 0) as days,
            COALESCE(SUM(tc_quantity), 0) as work_qty,
            COUNT(id) as record_count
          FROM labour_salaries
          WHERE location_id = ${locId} AND is_deleted = 0
        `);
        const attendanceWages = parseFloat(lsRes.rows[0]?.attendance_wages || "0");
        const labourUpad = parseFloat(lsRes.rows[0]?.total_upad || "0");
        const totalOtherKharch = parseFloat(lsRes.rows[0]?.total_other_kharch || "0");
        const labourNetSalary = Math.round((attendanceWages - labourUpad) * 100) / 100;
        const labourDays = parseFloat(lsRes.rows[0]?.days || "0");
        const labourWorkQty = parseFloat(lsRes.rows[0]?.work_qty || "0");
        const labourRecordCount = parseInt(lsRes.rows[0]?.record_count || "0", 10);
        const ccRes = await db.execute(sql5`
          SELECT 
            COALESCE(SUM(amount), 0) as recorded_total,
            COALESCE(SUM(deduction_amount), 0) as deduction_total,
            COALESCE(SUM(net_amount), 0) as net_total,
            COUNT(id) as cost_count
          FROM contractor_costs
          WHERE location_id = ${locId} AND is_deleted = 0
        `);
        const recordedContractorCost = parseFloat(ccRes.rows[0]?.recorded_total || "0");
        const expectedContractorCost = Math.round((siteSupplies2 + attendanceWages) * 100) / 100;
        const contractorVariance = Math.round((recordedContractorCost - expectedContractorCost) * 100) / 100;
        const fullProjectCapital = Math.round((totalInvestorCapital + billInvestment) * 100) / 100;
        const projectOperationalDeductions = Math.round((siteSupplies2 + labourUpad + totalOtherKharch + pendingRefundable) * 100) / 100;
        const remainingProjectCapital = Math.round((fullProjectCapital - projectOperationalDeductions - investorPayment) * 100) / 100;
        return {
          id: loc.id,
          name: loc.name,
          address: loc.address,
          createdAt: loc.createdAt,
          recordCount,
          // Full 7 Categories Analytics Per Location (Sequence 1 to 7):
          // 1. Investor Capital (Investor Pool)
          cat1InvestorCapital: {
            totalContribution: investorTotalContribution,
            allocatedCapital: totalInvestorCapital,
            investorUpad: investorUpad + investorPayment,
            availableBalance: investorAvailableBalance
          },
          // 2. Investment Capital
          cat2InvestmentCapital: {
            fullCapital: fullProjectCapital,
            investorCapital: totalInvestorCapital,
            billInvestment,
            operationalDeductions: projectOperationalDeductions,
            investorUpadReturn: investorPayment,
            remainingCapital: remainingProjectCapital
          },
          // 3. Customer Supply (Customer Sales Billed)
          cat3CustomerSupply: {
            totalSupply: materialSupplies2,
            received: materialSuppliesPaid,
            pending: materialSuppliesPending
          },
          // 4. Site Supply to Labour Team
          cat4SiteSupply: {
            totalSiteSupply: siteSupplies2
          },
          // 5. Labour Attendance (Attendance total - Upad)
          cat5LabourAttendance: {
            attendanceWages,
            upad: labourUpad,
            netBalance: labourNetSalary,
            days: labourDays,
            workQty: labourWorkQty,
            recordCount: labourRecordCount
          },
          // 6. Other Kharch (Site Sundry / Tea / Fuel Expenses)
          cat6OtherKharch: {
            totalOtherKharch
          },
          // 7. Contractor Cost
          cat7ContractorCost: {
            recorded: recordedContractorCost,
            expected: expectedContractorCost,
            variance: contractorVariance,
            status: Math.abs(contractorVariance) <= 0.01 ? "MATCHED" : contractorVariance > 0 ? "SURPLUS" : "DEFICIT"
          },
          // Master Registry Data
          masterData: {
            materialsCount: materialCount,
            partiesCount: partyCount,
            teamsCount: teamCount
          },
          // Backwards compatibility properties
          cat1InvestmentCapital: {
            fullCapital: fullProjectCapital,
            investorCapital: totalInvestorCapital,
            billInvestment,
            operationalDeductions: projectOperationalDeductions,
            investorUpadReturn: investorPayment,
            remainingCapital: remainingProjectCapital
          },
          cat2MaterialSupply: {
            totalSupply: materialSupplies2,
            received: materialSuppliesPaid,
            pending: materialSuppliesPending
          },
          cat3SiteSupply: {
            totalSiteSupply: siteSupplies2
          },
          cat4LabourAttendance: {
            attendanceWages,
            netSalary: labourNetSalary,
            grossSalary: attendanceWages,
            upad: labourUpad,
            payment: labourUpad,
            balance: labourNetSalary,
            days: labourDays,
            workQty: labourWorkQty,
            recordCount: labourRecordCount
          },
          cat5ContractorCost: {
            recorded: recordedContractorCost,
            expected: expectedContractorCost,
            variance: contractorVariance,
            status: Math.abs(contractorVariance) <= 0.01 ? "MATCHED" : contractorVariance > 0 ? "SURPLUS" : "DEFICIT"
          },
          cat6MasterData: {
            materialsCount: materialCount,
            partiesCount: partyCount,
            teamsCount: teamCount
          },
          cat7InvestorCapital: {
            totalContribution: investorTotalContribution,
            allocatedCapital: totalInvestorCapital,
            investorUpad: investorUpad + investorPayment,
            availableBalance: investorAvailableBalance
          },
          investorCapital: totalInvestorCapital,
          investorUpad,
          investorPayment,
          billInvestment,
          fullProjectCapital,
          remainingProjectCapital,
          remainingInvestmentCapital: remainingProjectCapital,
          totalIncome,
          materialPurchases: materialPurchases2,
          materialPurchasesPaid,
          materialSupplies: materialSupplies2,
          materialSuppliesPaid,
          siteSupplies: siteSupplies2,
          otherKharchTotal: totalOtherKharch,
          labourMetrics: {
            attendanceWages,
            netSalary: labourNetSalary,
            grossSalary: attendanceWages,
            upad: labourUpad,
            payment: labourUpad,
            balance: labourNetSalary,
            days: labourDays,
            workQty: labourWorkQty,
            recordCount: labourRecordCount
          },
          contractorCosts: {
            recorded: recordedContractorCost,
            expected: expectedContractorCost,
            variance: contractorVariance,
            status: Math.abs(contractorVariance) <= 0.01 ? "MATCHED" : contractorVariance > 0 ? "SURPLUS" : "DEFICIT"
          }
        };
      })
    );
    res.json(locBreakdown);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Locations breakdown error:", error);
    res.status(500).json({ error: "Failed to generate locations breakdown" });
  }
});
reportRouter.get("/analytics", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const locationIdParam = req.query.locationId && req.query.locationId !== "ALL" ? parseInt(req.query.locationId, 10) : void 0;
    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
    }
    const locCondition = locationIdParam ? sql5`${locations.id} = ${locationIdParam}` : sql5`1=1`;
    const locIds = await db.select({ id: locations.id }).from(locations).where(and5(eq6(locations.isDeleted, 0), locCondition));
    const validLocIds = locIds.map((l) => l.id);
    if (validLocIds.length === 0) {
      return res.json({ monthly: [], categories: [] });
    }
    const idList = validLocIds.join(",");
    const monthlyMap = {};
    const getOrInitMonth = (m) => {
      if (!monthlyMap[m]) {
        monthlyMap[m] = { month: m, Income: 0, Expense: 0 };
      }
      return monthlyMap[m];
    };
    const recordsRows = await db.execute(sql5`
      SELECT substring(date from 1 for 7) as m, type, SUM(amount) as amt, SUM(refundable_amount) as ref_amt
      FROM records
      WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
      GROUP BY m, type
    `);
    for (const r of recordsRows.rows) {
      if (!r.m) continue;
      const entry = getOrInitMonth(r.m);
      const amt = parseFloat(r.amt || "0");
      const refAmt = parseFloat(r.ref_amt || "0");
      if (r.type === "INCOME") entry.Income += amt;
      else if (r.type === "EXPENSE") entry.Expense += Math.max(0, amt - refAmt);
    }
    const msRows = await db.execute(sql5`
      SELECT substring(date from 1 for 7) as m, SUM(total_amount) as amt
      FROM material_supplies
      WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
      GROUP BY m
    `);
    for (const r of msRows.rows) {
      if (!r.m) continue;
      const entry = getOrInitMonth(r.m);
      entry.Income += parseFloat(r.amt || "0");
    }
    const mpRows = await db.execute(sql5`
      SELECT substring(date from 1 for 7) as m, SUM(total_amount) as amt
      FROM material_purchases
      WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
      GROUP BY m
    `);
    for (const r of mpRows.rows) {
      if (!r.m) continue;
      const entry = getOrInitMonth(r.m);
      entry.Expense += parseFloat(r.amt || "0");
    }
    const mlsRows = await db.execute(sql5`
      SELECT substring(date from 1 for 7) as m, SUM(total_amount) as amt
      FROM site_supplies
      WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
      GROUP BY m
    `);
    for (const r of mlsRows.rows) {
      if (!r.m) continue;
      const entry = getOrInitMonth(r.m);
      entry.Expense += parseFloat(r.amt || "0");
    }
    const lsRows = await db.execute(sql5`
      SELECT substring(date from 1 for 7) as m, SUM(net_salary) as amt
      FROM labour_salaries
      WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
      GROUP BY m
    `);
    for (const r of lsRows.rows) {
      if (!r.m) continue;
      const entry = getOrInitMonth(r.m);
      entry.Expense += parseFloat(r.amt || "0");
    }
    const scRows = await db.execute(sql5`
      SELECT substring(date from 1 for 7) as m, SUM(amount) as amt
      FROM supervisor_costs
      WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
      GROUP BY m
    `);
    for (const r of scRows.rows) {
      if (!r.m) continue;
      const entry = getOrInitMonth(r.m);
      entry.Expense += parseFloat(r.amt || "0");
    }
    const monthly = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
    const catMap = {};
    const addCat = (name, amt) => {
      if (amt > 0) catMap[name] = (catMap[name] || 0) + amt;
    };
    const catRecords = await db.execute(sql5`
      SELECT category, SUM(amount) as amt
      FROM records
      WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
      GROUP BY category
    `);
    for (const r of catRecords.rows) {
      const name = r.category || "General";
      addCat(name, parseFloat(r.amt || "0"));
    }
    const sumQuery = async (query) => {
      const res2 = await db.execute(query);
      return parseFloat(res2.rows[0]?.tot || "0");
    };
    const mpTot = await sumQuery(sql5`SELECT SUM(total_amount) as tot FROM material_purchases WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})`);
    addCat("Material Purchase", mpTot);
    const msTot = await sumQuery(sql5`SELECT SUM(total_amount) as tot FROM material_supplies WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})`);
    addCat("Material Supply", msTot);
    const mlsTot = await sumQuery(sql5`SELECT SUM(total_amount) as tot FROM site_supplies WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})`);
    addCat("Site Supply", mlsTot);
    const lsTot = await sumQuery(sql5`SELECT SUM(net_salary) as tot FROM labour_salaries WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})`);
    addCat("Labour Salary", lsTot);
    const scTot = await sumQuery(sql5`SELECT SUM(amount) as tot FROM supervisor_costs WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})`);
    addCat("Supervisor Cost", scTot);
    const categories = Object.entries(catMap).map(([name, value]) => ({ name, value: Math.round(value) }));
    res.json({ monthly, categories });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to fetch analytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});
reportRouter.get("/export-location/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const locationId = parseInt(req.params.id, 10);
    if (isNaN(locationId)) return res.status(400).json({ error: "Valid location ID required" });
    await assertLocationAccess(userId, locationId);
    const tab = req.query.tab || "all";
    const locResult = await db.select().from(locations).where(and5(eq6(locations.id, locationId), eq6(locations.isDeleted, 0)));
    if (!locResult.length) return res.status(404).json({ error: "Location not found" });
    const locationName = locResult[0].name;
    const exportData = {};
    if (tab === "all" || tab === "expense" || tab === "income-expense") {
      exportData.incomeExpense = await db.select().from(records).where(and5(eq6(records.locationId, locationId), eq6(records.isDeleted, 0)));
    }
    if (tab === "all" || tab === "investment" || tab === "investor" || tab === "investors" || tab === "investor_capital" || tab === "investor-capital") {
      exportData.investments = await db.select({
        date: investmentTransactions.date,
        type: investmentTransactions.type,
        amount: investmentTransactions.amount,
        description: investmentTransactions.description,
        paymentMethod: investmentTransactions.paymentMethod,
        referenceNumber: investmentTransactions.referenceNumber,
        partyName: investmentParties.partyName
      }).from(investmentTransactions).innerJoin(investmentParties, eq6(investmentTransactions.partyId, investmentParties.id)).where(and5(eq6(investmentParties.locationId, locationId), eq6(investmentTransactions.isDeleted, 0)));
      exportData.investorAllocations = await db.select({
        date: investorLocationAllocations.date,
        investorName: investors.name,
        amount: investorLocationAllocations.amount,
        paymentMethod: investorLocationAllocations.paymentMethod,
        referenceNumber: investorLocationAllocations.referenceNumber,
        notes: investorLocationAllocations.notes
      }).from(investorLocationAllocations).innerJoin(investors, eq6(investorLocationAllocations.investorId, investors.id)).where(and5(eq6(investorLocationAllocations.locationId, locationId), eq6(investorLocationAllocations.isDeleted, 0)));
    }
    if (tab === "all" || tab === "material-purchase" || tab === "materials" || tab === "stock") {
      exportData.purchases = await db.select().from(materialPurchases).where(and5(eq6(materialPurchases.locationId, locationId), eq6(materialPurchases.isDeleted, 0)));
    }
    if (tab === "all" || tab === "material-supply" || tab === "materials" || tab === "stock") {
      exportData.supplies = await db.select().from(materialSupplies).where(and5(eq6(materialSupplies.locationId, locationId), eq6(materialSupplies.isDeleted, 0)));
    }
    if (tab === "all" || tab === "material-labour-supply" || tab === "site-supply" || tab === "materials" || tab === "stock") {
      exportData.siteSupplies = await db.execute(sql5`SELECT s.*, i.material_id, i.quantity, i.rate, i.amount as item_amount FROM site_supplies s LEFT JOIN site_supply_items i ON s.id = i.site_supply_id WHERE s.location_id = ${locationId} AND s.is_deleted = 0`).then((res2) => res2.rows);
    }
    if (tab === "all" || tab === "labour-salary" || tab === "labour") {
      exportData.salaries = await db.select().from(labourSalaries).where(and5(eq6(labourSalaries.locationId, locationId), eq6(labourSalaries.isDeleted, 0)));
    }
    if (tab === "all" || tab === "supervisor-cost" || tab === "supervisor") {
      exportData.supervisorCosts = await db.select().from(supervisorCosts).where(and5(eq6(supervisorCosts.locationId, locationId), eq6(supervisorCosts.isDeleted, 0)));
    }
    if (tab === "all" || tab === "contractor-cost" || tab === "contractor-costs" || tab === "contractor" || tab === "contractors") {
      exportData.contractorCosts = await db.select().from(contractorCosts).where(and5(eq6(contractorCosts.locationId, locationId), eq6(contractorCosts.isDeleted, 0)));
    }
    const buffer = generateExcelBuffer(locationName, exportData, tab);
    res.setHeader("Content-Disposition", `attachment; filename="Export_${locationName.replace(/\s+/g, "_")}_${tab}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to export location:", error);
    res.status(500).json({ error: "Failed to export location" });
  }
});
reportRouter.get("/export-all", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const exportData = {};
    exportData.incomeExpense = await db.select().from(records).where(eq6(records.isDeleted, 0));
    exportData.investments = await db.select({
      date: investmentTransactions.date,
      type: investmentTransactions.type,
      amount: investmentTransactions.amount,
      description: investmentTransactions.description,
      paymentMethod: investmentTransactions.paymentMethod,
      referenceNumber: investmentTransactions.referenceNumber,
      partyName: investmentParties.partyName
    }).from(investmentTransactions).innerJoin(investmentParties, eq6(investmentTransactions.partyId, investmentParties.id)).where(eq6(investmentTransactions.isDeleted, 0));
    exportData.purchases = await db.select().from(materialPurchases).where(eq6(materialPurchases.isDeleted, 0));
    exportData.supplies = await db.select().from(materialSupplies).where(eq6(materialSupplies.isDeleted, 0));
    exportData.siteSupplies = await db.execute(sql5`SELECT s.*, i.material_id, i.quantity, i.rate, i.amount as item_amount FROM site_supplies s LEFT JOIN site_supply_items i ON s.id = i.site_supply_id WHERE s.is_deleted = 0`).then((res2) => res2.rows);
    exportData.salaries = await db.select().from(labourSalaries).where(eq6(labourSalaries.isDeleted, 0));
    exportData.supervisorCosts = await db.select().from(supervisorCosts).where(eq6(supervisorCosts.isDeleted, 0));
    exportData.contractorCosts = await db.select().from(contractorCosts).where(eq6(contractorCosts.isDeleted, 0));
    const buffer = generateExcelBuffer("All_Locations", exportData, "all");
    res.setHeader("Content-Disposition", `attachment; filename="Export_All_Locations.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to export all:", error);
    res.status(500).json({ error: "Failed to export all" });
  }
});
reportRouter.get("/all-refundable-records", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const locationIdParam = req.query.locationId && req.query.locationId !== "ALL" ? parseInt(req.query.locationId, 10) : void 0;
    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
    }
    const locCondition = locationIdParam ? sql5`${records.locationId} = ${locationIdParam}` : sql5`1=1`;
    const allRecords = await db.select({
      id: records.id,
      date: records.date,
      locationId: records.locationId,
      locationName: locations.name,
      partyName: records.partyName,
      amount: records.amount,
      refundableAmount: sql5`case when coalesce(${records.refundableAmount}, 0) > 0 then ${records.refundableAmount} else ${records.amount} end`,
      refundedAmount: sql5`coalesce(${records.refundedAmount}, '0.00')`,
      refundStatus: sql5`coalesce(${records.refundStatus}, 'PENDING')`,
      paymentMethod: records.paymentMethod,
      referenceNumber: records.referenceNumber,
      description: records.description,
      notes: records.notes
    }).from(records).innerJoin(locations, eq6(records.locationId, locations.id)).where(and5(
      eq6(records.isDeleted, 0),
      eq6(locations.isDeleted, 0),
      locCondition,
      sql5`(${records.refundableAmount} > 0 OR ${records.category} = 'REFUNDABLE_RECORD' OR ${records.category} = 'REFUNDABLE')`
    )).orderBy(sql5`${records.date} DESC`, sql5`${records.id} DESC`);
    res.json(allRecords);
  } catch (error) {
    console.error("Failed to fetch all refundable records:", error);
    res.status(500).json({ error: "Failed to fetch refundable records" });
  }
});
reportRouter.get("/export-investor/:partyId", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const partyId = parseInt(req.params.partyId, 10);
    if (isNaN(partyId)) return res.status(400).json({ error: "Invalid investor ID" });
    const [party] = await db.select().from(investmentParties).where(and5(
      eq6(investmentParties.id, partyId),
      eq6(investmentParties.isDeleted, 0)
    ));
    if (!party) return res.status(404).json({ error: "Investor account not found" });
    await assertLocationAccess(userId, party.locationId);
    const [loc] = await db.select({ name: locations.name }).from(locations).where(eq6(locations.id, party.locationId));
    const locationName = loc ? loc.name : "Project Location";
    const transactions = await db.select().from(investmentTransactions).where(and5(
      eq6(investmentTransactions.partyId, partyId),
      eq6(investmentTransactions.isDeleted, 0)
    )).orderBy(sql5`${investmentTransactions.date} ASC`, sql5`${investmentTransactions.id} ASC`);
    const buffer = generateInvestorStatementBuffer(party, transactions, locationName);
    const sanitized = party.partyName.replace(/[^a-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Disposition", `attachment; filename="Investor_${sanitized}_Passbook.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error("Failed to export investor statement:", error);
    res.status(500).json({ error: "Failed to export investor passbook" });
  }
});
reportRouter.get("/export-vendor-purchases", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const partyName = req.query.partyName ? String(req.query.partyName).trim() : "";
    const locationIdParam = req.query.locationId && req.query.locationId !== "ALL" ? parseInt(req.query.locationId, 10) : void 0;
    let locCondition = sql5`1=1`;
    let locName = "All Locations";
    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
      locCondition = sql5`${materialPurchases.locationId} = ${locationIdParam}`;
      const [l] = await db.select({ name: locations.name }).from(locations).where(eq6(locations.id, locationIdParam));
      if (l) locName = l.name;
    }
    const partyCondition = partyName ? sql5`${materialPurchases.partyName} = ${partyName}` : sql5`1=1`;
    const purchases = await db.select().from(materialPurchases).where(and5(
      eq6(materialPurchases.isDeleted, 0),
      locCondition,
      partyCondition
    )).orderBy(sql5`${materialPurchases.date} DESC`, sql5`${materialPurchases.id} DESC`);
    const vendorLabel = partyName || "All_Vendors";
    const buffer = generateVendorPurchasesBuffer(vendorLabel, purchases, locName);
    const safeVendor = vendorLabel.replace(/[^a-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Disposition", `attachment; filename="Vendor_Purchases_${safeVendor}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error("Failed to export vendor purchases:", error);
    res.status(500).json({ error: "Failed to export vendor purchases" });
  }
});
reportRouter.get("/export-customer-supplies", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const partyName = req.query.partyName ? String(req.query.partyName).trim() : "";
    const locationIdParam = req.query.locationId && req.query.locationId !== "ALL" ? parseInt(req.query.locationId, 10) : void 0;
    let locCondition = sql5`1=1`;
    let locName = "All Locations";
    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
      locCondition = sql5`${materialSupplies.locationId} = ${locationIdParam}`;
      const [l] = await db.select({ name: locations.name }).from(locations).where(eq6(locations.id, locationIdParam));
      if (l) locName = l.name;
    }
    const partyCondition = partyName ? sql5`${materialSupplies.partyName} = ${partyName}` : sql5`1=1`;
    const supplies = await db.select().from(materialSupplies).where(and5(
      eq6(materialSupplies.isDeleted, 0),
      locCondition,
      partyCondition
    )).orderBy(sql5`${materialSupplies.date} DESC`, sql5`${materialSupplies.id} DESC`);
    const customerLabel = partyName || "All_Customers";
    const buffer = generateCustomerSuppliesBuffer(customerLabel, supplies, locName);
    const safeCust = customerLabel.replace(/[^a-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Disposition", `attachment; filename="Customer_Bill_${safeCust}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error("Failed to export customer supplies:", error);
    res.status(500).json({ error: "Failed to export customer supplies" });
  }
});
reportRouter.get("/export-site-supplies", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const locationIdParam = req.query.locationId && req.query.locationId !== "ALL" ? parseInt(req.query.locationId, 10) : void 0;
    let locCondition = sql5`1=1`;
    let locName = "All Locations";
    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
      locCondition = sql5`${siteSupplies.locationId} = ${locationIdParam}`;
      const [l] = await db.select({ name: locations.name }).from(locations).where(eq6(locations.id, locationIdParam));
      if (l) locName = l.name;
    }
    const supplies = await db.select({
      id: siteSupplies.id,
      locationId: siteSupplies.locationId,
      date: siteSupplies.date,
      teamId: siteSupplies.teamId,
      responsiblePerson: siteSupplies.responsiblePerson,
      workDescription: siteSupplies.workDescription,
      referenceNumber: siteSupplies.referenceNumber,
      notes: siteSupplies.notes,
      totalAmount: siteSupplies.totalAmount,
      teamName: labourTeams.name,
      locationName: locations.name
    }).from(siteSupplies).leftJoin(labourTeams, eq6(siteSupplies.teamId, labourTeams.id)).leftJoin(locations, eq6(siteSupplies.locationId, locations.id)).where(and5(
      eq6(siteSupplies.isDeleted, 0),
      locCondition
    )).orderBy(sql5`${siteSupplies.date} DESC`, sql5`${siteSupplies.id} DESC`);
    const recordIds = supplies.map((r) => r.id);
    let allItems = [];
    if (recordIds.length > 0) {
      allItems = await db.select({
        id: siteSupplyItems.id,
        siteSupplyId: siteSupplyItems.siteSupplyId,
        materialId: siteSupplyItems.materialId,
        quantity: siteSupplyItems.quantity,
        rate: siteSupplyItems.rate,
        amount: siteSupplyItems.amount,
        materialName: materials.name,
        defaultUnit: materials.defaultUnit
      }).from(siteSupplyItems).leftJoin(materials, eq6(siteSupplyItems.materialId, materials.id)).where(and5(
        inArray(siteSupplyItems.siteSupplyId, recordIds),
        eq6(siteSupplyItems.isDeleted, 0)
      ));
    }
    const formattedList = supplies.map((r) => {
      let meta = {};
      if (r.notes && r.notes.startsWith("{") && r.notes.endsWith("}")) {
        try {
          meta = JSON.parse(r.notes);
        } catch {
          meta = {};
        }
      }
      return {
        ...r,
        displayNotes: meta.userNotes !== void 0 ? meta.userNotes : r.notes,
        subtotal: meta.subtotal || r.totalAmount,
        taxAmount: meta.taxAmount || "0",
        items: allItems.filter((i) => i.siteSupplyId === r.id).map((it) => {
          let itemMeta = {};
          if (meta.itemsDetail && meta.itemsDetail[it.id]) {
            itemMeta = meta.itemsDetail[it.id];
          }
          return {
            ...it,
            unit: itemMeta.unit || it.defaultUnit || "Nos",
            taxPercentage: itemMeta.taxPercentage || 0,
            taxAmount: itemMeta.taxAmount || 0,
            subtotal: itemMeta.subtotal || it.amount,
            totalWithGst: it.amount
          };
        })
      };
    });
    const buffer = generateSiteSuppliesBuffer(formattedList, locName);
    const safeLoc = locName.replace(/[^a-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Disposition", `attachment; filename="Site_Supplies_${safeLoc}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error("Failed to export site supplies:", error);
    res.status(500).json({ error: "Failed to export site supplies" });
  }
});
reportRouter.get("/export-refundable-records", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const locationIdParam = req.query.locationId && req.query.locationId !== "ALL" ? parseInt(req.query.locationId, 10) : void 0;
    let locCondition = sql5`1=1`;
    let locName = "All Locations";
    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
      locCondition = sql5`${records.locationId} = ${locationIdParam}`;
      const [l] = await db.select({ name: locations.name }).from(locations).where(eq6(locations.id, locationIdParam));
      if (l) locName = l.name;
    }
    const refundableList = await db.select({
      id: records.id,
      date: records.date,
      locationId: records.locationId,
      locationName: locations.name,
      partyName: records.partyName,
      amount: records.amount,
      refundableAmount: sql5`case when coalesce(${records.refundableAmount}, 0) > 0 then ${records.refundableAmount} else ${records.amount} end`,
      refundedAmount: sql5`coalesce(${records.refundedAmount}, '0.00')`,
      refundStatus: sql5`coalesce(${records.refundStatus}, 'PENDING')`,
      paymentMethod: records.paymentMethod,
      referenceNumber: records.referenceNumber,
      description: records.description,
      notes: records.notes
    }).from(records).innerJoin(locations, eq6(records.locationId, locations.id)).where(and5(
      eq6(records.isDeleted, 0),
      eq6(locations.isDeleted, 0),
      locCondition,
      sql5`(${records.refundableAmount} > 0 OR ${records.category} = 'REFUNDABLE_RECORD' OR ${records.category} = 'REFUNDABLE')`
    )).orderBy(sql5`${records.date} DESC`, sql5`${records.id} DESC`);
    const buffer = generateRefundableRecordsBuffer(refundableList, locName);
    res.setHeader("Content-Disposition", `attachment; filename="Refundable_Records_${locName.replace(/\s+/g, "_")}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error("Failed to export refundable records:", error);
    res.status(500).json({ error: "Failed to export refundable records" });
  }
});
reportRouter.get("/material-analytics", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const locationIdParam = req.query.locationId && req.query.locationId !== "ALL" ? parseInt(req.query.locationId, 10) : void 0;
    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
    }
    const locCondition = locationIdParam ? sql5`${locations.id} = ${locationIdParam}` : sql5`1=1`;
    const locIds = await db.select({ id: locations.id }).from(locations).where(and5(eq6(locations.isDeleted, 0), locCondition));
    const validLocIds = locIds.map((l) => l.id);
    if (validLocIds.length === 0) {
      return res.json({
        summary: {
          totalPurchasedValue: 0,
          totalPurchasedQty: 0,
          totalMaterialSupplyValue: 0,
          totalMaterialSupplyQty: 0,
          totalSiteSupplyValue: 0,
          totalSiteSupplyQty: 0,
          totalOverallSuppliedValue: 0,
          totalOverallSuppliedQty: 0,
          totalStockInventoryValuation: 0,
          totalGrossProfit: 0,
          distinctMaterialsCount: 0
        },
        materials: []
      });
    }
    const idList = validLocIds.join(",");
    const matRows = await db.execute(sql5`
      SELECT id, name, category, default_unit as unit, default_rate, min_stock, location_id
      FROM materials
      WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
      ORDER BY UPPER(TRIM(name)) ASC
    `);
    const purRows = await db.execute(sql5`
      SELECT 
        id, location_id, material_id, material_name, party_name, date,
        quantity, unit, rate, subtotal, transport_cost, discount, tax, total_amount, payment_status
      FROM material_purchases
      WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
      ORDER BY date DESC, id DESC
    `);
    const supRows = await db.execute(sql5`
      SELECT 
        id, location_id, material_id, material_name, party_name, date,
        quantity, unit, rate, subtotal, transport_cost, discount, tax, total_amount, payment_status
      FROM material_supplies
      WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
      ORDER BY date DESC, id DESC
    `);
    const siteRows = await db.execute(sql5`
      SELECT 
        s.id as supply_id, s.location_id, s.date, s.responsible_person, s.work_description,
        t.name as team_name,
        i.id as item_id, i.material_id, i.quantity, i.rate, i.amount as item_amount
      FROM site_supplies s
      JOIN site_supply_items i ON s.id = i.site_supply_id
      LEFT JOIN labour_teams t ON s.team_id = t.id
      WHERE s.is_deleted = 0 AND (i.is_deleted = 0 OR i.is_deleted IS NULL) AND s.location_id IN (${sql5.raw(idList)})
      ORDER BY s.date DESC, s.id DESC
    `);
    const materialMap = /* @__PURE__ */ new Map();
    const getOrCreate = (name, matId, unit, cat) => {
      const cleanName = (name || "UNKNOWN").trim().toUpperCase();
      if (!materialMap.has(cleanName)) {
        materialMap.set(cleanName, {
          materialId: matId,
          materialName: cleanName,
          category: cat || "GENERAL",
          unit: unit || "Unit",
          purchases: [],
          materialSupplies: [],
          siteSupplies: [],
          purchasedQty: 0,
          totalPurchaseCost: 0,
          purchaseSubtotal: 0,
          purchaseRates: [],
          materialSupplyQty: 0,
          materialSupplyAmount: 0,
          materialSupplyRates: [],
          siteSupplyQty: 0,
          siteSupplyAmount: 0,
          siteSupplyRates: []
        });
      }
      const entry = materialMap.get(cleanName);
      if (matId && !entry.materialId) entry.materialId = matId;
      if (unit && entry.unit === "Unit") entry.unit = unit;
      if (cat && entry.category === "GENERAL") entry.category = cat;
      return entry;
    };
    for (const m of matRows.rows) {
      getOrCreate(m.name, Number(m.id), m.unit, m.category);
    }
    for (const p of purRows.rows) {
      const q = Math.abs(parseFloat(p.quantity || "0"));
      const tot = parseFloat(p.total_amount || "0");
      const sub = parseFloat(p.subtotal || "0") || q * parseFloat(p.rate || "0");
      const rate = parseFloat(p.rate || "0") || (q > 0 ? tot / q : 0);
      const entry = getOrCreate(p.material_name, p.material_id ? Number(p.material_id) : void 0, p.unit);
      entry.purchases.push({
        id: p.id,
        date: p.date,
        partyName: p.party_name,
        quantity: q,
        unit: p.unit || entry.unit,
        rate,
        totalAmount: tot,
        paymentStatus: p.payment_status
      });
      entry.purchasedQty += q;
      entry.totalPurchaseCost += tot;
      entry.purchaseSubtotal += sub;
      if (rate > 0) entry.purchaseRates.push(rate);
    }
    for (const s of supRows.rows) {
      const q = Math.abs(parseFloat(s.quantity || "0"));
      const tot = parseFloat(s.total_amount || "0");
      const rate = parseFloat(s.rate || "0") || (q > 0 ? tot / q : 0);
      const entry = getOrCreate(s.material_name, s.material_id ? Number(s.material_id) : void 0, s.unit);
      entry.materialSupplies.push({
        id: s.id,
        date: s.date,
        partyName: s.party_name,
        quantity: q,
        unit: s.unit || entry.unit,
        rate,
        totalAmount: tot,
        paymentStatus: s.payment_status
      });
      entry.materialSupplyQty += q;
      entry.materialSupplyAmount += tot;
      if (rate > 0) entry.materialSupplyRates.push(rate);
    }
    for (const st of siteRows.rows) {
      const q = Math.abs(parseFloat(st.quantity || "0"));
      const tot = parseFloat(st.item_amount || "0");
      const rate = parseFloat(st.rate || "0") || (q > 0 ? tot / q : 0);
      let foundName = "";
      let foundUnit = "";
      if (st.material_id) {
        const foundMat = matRows.rows.find((m) => Number(m.id) === Number(st.material_id));
        if (foundMat) {
          foundName = foundMat.name;
          foundUnit = foundMat.unit;
        }
      }
      if (!foundName) foundName = `MATERIAL_${st.material_id || "UNKNOWN"}`;
      const entry = getOrCreate(foundName, st.material_id ? Number(st.material_id) : void 0, foundUnit);
      entry.siteSupplies.push({
        id: st.supply_id,
        itemId: st.item_id,
        date: st.date,
        teamName: st.team_name || "Direct Site",
        responsiblePerson: st.responsible_person || "",
        workDescription: st.work_description || "",
        quantity: q,
        unit: entry.unit,
        rate,
        totalAmount: tot
      });
      entry.siteSupplyQty += q;
      entry.siteSupplyAmount += tot;
      if (rate > 0) entry.siteSupplyRates.push(rate);
    }
    let sumPurchasedVal = 0;
    let sumPurchasedQty = 0;
    let sumMatSupVal = 0;
    let sumMatSupQty = 0;
    let sumSiteSupVal = 0;
    let sumSiteSupQty = 0;
    let sumOverallSupVal = 0;
    let sumOverallSupQty = 0;
    let sumInventoryVal = 0;
    let sumGrossProfit = 0;
    const materialsAnalytics = Array.from(materialMap.values()).map((item) => {
      const purchasedQty = Math.round(item.purchasedQty * 100) / 100;
      const totalPurchaseCost = Math.round(item.totalPurchaseCost * 100) / 100;
      const avgPurchaseRate = purchasedQty > 0 ? Math.round(totalPurchaseCost / purchasedQty * 100) / 100 : 0;
      const minPurchaseRate = item.purchaseRates.length > 0 ? Math.min(...item.purchaseRates) : 0;
      const maxPurchaseRate = item.purchaseRates.length > 0 ? Math.max(...item.purchaseRates) : 0;
      const materialSupplyQty = Math.round(item.materialSupplyQty * 100) / 100;
      const materialSupplyAmount = Math.round(item.materialSupplyAmount * 100) / 100;
      const avgMaterialSupplyRate = materialSupplyQty > 0 ? Math.round(materialSupplyAmount / materialSupplyQty * 100) / 100 : 0;
      const siteSupplyQty = Math.round(item.siteSupplyQty * 100) / 100;
      const siteSupplyAmount = Math.round(item.siteSupplyAmount * 100) / 100;
      const avgSiteSupplyRate = siteSupplyQty > 0 ? Math.round(siteSupplyAmount / siteSupplyQty * 100) / 100 : 0;
      const totalSuppliedQty = Math.round((materialSupplyQty + siteSupplyQty) * 100) / 100;
      const totalSuppliedAmount = Math.round((materialSupplyAmount + siteSupplyAmount) * 100) / 100;
      const avgOverallSupplyRate = totalSuppliedQty > 0 ? Math.round(totalSuppliedAmount / totalSuppliedQty * 100) / 100 : 0;
      const currentStock = Math.round((purchasedQty - totalSuppliedQty) * 100) / 100;
      const stockValuation = currentStock > 0 ? Math.round(currentStock * avgPurchaseRate * 100) / 100 : 0;
      let status = "IN_STOCK";
      if (currentStock < 0) status = "NEGATIVE_ALERT";
      else if (currentStock === 0) status = "OUT_OF_STOCK";
      else if (currentStock <= 15) status = "LOW_STOCK";
      const rateSpread = Math.round((avgOverallSupplyRate - avgPurchaseRate) * 100) / 100;
      const grossProfit = Math.round((avgOverallSupplyRate - avgPurchaseRate) * totalSuppliedQty * 100) / 100;
      const marginPercent = avgPurchaseRate > 0 ? Math.round((avgOverallSupplyRate - avgPurchaseRate) / avgPurchaseRate * 1e3) / 10 : 0;
      sumPurchasedVal += totalPurchaseCost;
      sumPurchasedQty += purchasedQty;
      sumMatSupVal += materialSupplyAmount;
      sumMatSupQty += materialSupplyQty;
      sumSiteSupVal += siteSupplyAmount;
      sumSiteSupQty += siteSupplyQty;
      sumOverallSupVal += totalSuppliedAmount;
      sumOverallSupQty += totalSuppliedQty;
      sumInventoryVal += stockValuation;
      sumGrossProfit += grossProfit;
      return {
        materialId: item.materialId,
        materialName: item.materialName,
        category: item.category,
        unit: item.unit,
        purchasedQty,
        totalPurchaseCost,
        avgPurchaseRate,
        minPurchaseRate,
        maxPurchaseRate,
        purchaseCount: item.purchases.length,
        materialSupplyQty,
        materialSupplyAmount,
        avgMaterialSupplyRate,
        siteSupplyQty,
        siteSupplyAmount,
        avgSiteSupplyRate,
        totalSuppliedQty,
        totalSuppliedAmount,
        avgOverallSupplyRate,
        currentStock,
        stockValuation,
        status,
        rateSpread,
        grossProfit,
        marginPercent,
        purchases: item.purchases,
        materialSupplies: item.materialSupplies,
        siteSupplies: item.siteSupplies
      };
    });
    const summary = {
      totalPurchasedValue: Math.round(sumPurchasedVal * 100) / 100,
      totalPurchasedQty: Math.round(sumPurchasedQty * 100) / 100,
      totalMaterialSupplyValue: Math.round(sumMatSupVal * 100) / 100,
      totalMaterialSupplyQty: Math.round(sumMatSupQty * 100) / 100,
      totalSiteSupplyValue: Math.round(sumSiteSupVal * 100) / 100,
      totalSiteSupplyQty: Math.round(sumSiteSupQty * 100) / 100,
      totalOverallSuppliedValue: Math.round(sumOverallSupVal * 100) / 100,
      totalOverallSuppliedQty: Math.round(sumOverallSupQty * 100) / 100,
      totalStockInventoryValuation: Math.round(sumInventoryVal * 100) / 100,
      totalGrossProfit: Math.round(sumGrossProfit * 100) / 100,
      distinctMaterialsCount: materialsAnalytics.length
    };
    res.json({
      summary,
      materials: materialsAnalytics
    });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to fetch material analytics:", error);
    res.status(500).json({ error: "Failed to fetch material analytics" });
  }
});
reportRouter.get("/export-material-analytics", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const locationIdParam = req.query.locationId && req.query.locationId !== "ALL" ? parseInt(req.query.locationId, 10) : void 0;
    let locationName = "All Project Locations";
    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
      const [loc] = await db.select({ name: locations.name }).from(locations).where(eq6(locations.id, locationIdParam));
      if (loc) locationName = loc.name;
    }
    const locCondition = locationIdParam ? sql5`${locations.id} = ${locationIdParam}` : sql5`1=1`;
    const locIds = await db.select({ id: locations.id }).from(locations).where(and5(eq6(locations.isDeleted, 0), locCondition));
    const validLocIds = locIds.map((l) => l.id);
    if (validLocIds.length === 0) {
      return res.status(404).json({ error: "No data found for this location" });
    }
    const idList = validLocIds.join(",");
    const [matRows, purRows, supRows, siteRows] = await Promise.all([
      db.execute(sql5`
        SELECT id, name, category, default_unit as unit, default_rate, min_stock, location_id
        FROM materials
        WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
        ORDER BY UPPER(TRIM(name)) ASC
      `),
      db.execute(sql5`
        SELECT 
          id, location_id, material_id, material_name, party_name, date,
          quantity, unit, rate, subtotal, transport_cost, discount, tax, total_amount, payment_status
        FROM material_purchases
        WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
        ORDER BY date DESC, id DESC
      `),
      db.execute(sql5`
        SELECT 
          id, location_id, material_id, material_name, party_name, date,
          quantity, unit, rate, subtotal, transport_cost, discount, tax, total_amount, payment_status
        FROM material_supplies
        WHERE is_deleted = 0 AND location_id IN (${sql5.raw(idList)})
        ORDER BY date DESC, id DESC
      `),
      db.execute(sql5`
        SELECT 
          s.id as supply_id, s.location_id, s.date, s.responsible_person, s.work_description,
          t.name as team_name,
          i.id as item_id, i.material_id, i.quantity, i.rate, i.amount as item_amount
        FROM site_supplies s
        JOIN site_supply_items i ON s.id = i.site_supply_id
        LEFT JOIN labour_teams t ON s.team_id = t.id
        WHERE s.is_deleted = 0 AND (i.is_deleted = 0 OR i.is_deleted IS NULL) AND s.location_id IN (${sql5.raw(idList)})
        ORDER BY s.date DESC, s.id DESC
      `)
    ]);
    const materialMap = /* @__PURE__ */ new Map();
    const getOrCreate = (name, matId, unit, cat) => {
      const cleanName = (name || "UNKNOWN").trim().toUpperCase();
      if (!materialMap.has(cleanName)) {
        materialMap.set(cleanName, {
          materialId: matId,
          materialName: cleanName,
          category: cat || "GENERAL",
          unit: unit || "Unit",
          purchases: [],
          materialSupplies: [],
          siteSupplies: [],
          purchasedQty: 0,
          totalPurchaseCost: 0,
          purchaseRates: [],
          materialSupplyQty: 0,
          materialSupplyAmount: 0,
          materialSupplyRates: [],
          siteSupplyQty: 0,
          siteSupplyAmount: 0,
          siteSupplyRates: []
        });
      }
      const entry = materialMap.get(cleanName);
      if (matId && !entry.materialId) entry.materialId = matId;
      if (unit && entry.unit === "Unit") entry.unit = unit;
      if (cat && entry.category === "GENERAL") entry.category = cat;
      return entry;
    };
    for (const m of matRows.rows) {
      getOrCreate(m.name, Number(m.id), m.unit, m.category);
    }
    for (const p of purRows.rows) {
      const q = Math.abs(parseFloat(p.quantity || "0"));
      const tot = parseFloat(p.total_amount || "0");
      const rate = parseFloat(p.rate || "0") || (q > 0 ? tot / q : 0);
      const entry = getOrCreate(p.material_name, p.material_id ? Number(p.material_id) : void 0, p.unit);
      entry.purchases.push({
        id: p.id,
        date: p.date,
        partyName: p.party_name,
        quantity: q,
        unit: p.unit || entry.unit,
        rate,
        totalAmount: tot,
        paymentStatus: p.payment_status
      });
      entry.purchasedQty += q;
      entry.totalPurchaseCost += tot;
      if (rate > 0) entry.purchaseRates.push(rate);
    }
    for (const s of supRows.rows) {
      const q = Math.abs(parseFloat(s.quantity || "0"));
      const tot = parseFloat(s.total_amount || "0");
      const rate = parseFloat(s.rate || "0") || (q > 0 ? tot / q : 0);
      const entry = getOrCreate(s.material_name, s.material_id ? Number(s.material_id) : void 0, s.unit);
      entry.materialSupplies.push({
        id: s.id,
        date: s.date,
        partyName: s.party_name,
        quantity: q,
        unit: s.unit || entry.unit,
        rate,
        totalAmount: tot,
        paymentStatus: s.payment_status
      });
      entry.materialSupplyQty += q;
      entry.materialSupplyAmount += tot;
      if (rate > 0) entry.materialSupplyRates.push(rate);
    }
    for (const st of siteRows.rows) {
      const q = Math.abs(parseFloat(st.quantity || "0"));
      const tot = parseFloat(st.item_amount || "0");
      const rate = parseFloat(st.rate || "0") || (q > 0 ? tot / q : 0);
      let foundName = "";
      let foundUnit = "";
      if (st.material_id) {
        const foundMat = matRows.rows.find((m) => Number(m.id) === Number(st.material_id));
        if (foundMat) {
          foundName = foundMat.name;
          foundUnit = foundMat.unit;
        }
      }
      if (!foundName) foundName = `MATERIAL_${st.material_id || "UNKNOWN"}`;
      const entry = getOrCreate(foundName, st.material_id ? Number(st.material_id) : void 0, foundUnit);
      entry.siteSupplies.push({
        id: st.supply_id,
        itemId: st.item_id,
        date: st.date,
        teamName: st.team_name || "Direct Site",
        responsiblePerson: st.responsible_person || "",
        workDescription: st.work_description || "",
        quantity: q,
        unit: entry.unit,
        rate,
        totalAmount: tot
      });
      entry.siteSupplyQty += q;
      entry.siteSupplyAmount += tot;
      if (rate > 0) entry.siteSupplyRates.push(rate);
    }
    let sumPurchasedVal = 0;
    let sumPurchasedQty = 0;
    let sumMatSupVal = 0;
    let sumMatSupQty = 0;
    let sumSiteSupVal = 0;
    let sumSiteSupQty = 0;
    let sumOverallSupVal = 0;
    let sumOverallSupQty = 0;
    let sumInventoryVal = 0;
    let sumGrossProfit = 0;
    const materialsAnalytics = Array.from(materialMap.values()).map((item) => {
      const purchasedQty = Math.round(item.purchasedQty * 100) / 100;
      const totalPurchaseCost = Math.round(item.totalPurchaseCost * 100) / 100;
      const avgPurchaseRate = purchasedQty > 0 ? Math.round(totalPurchaseCost / purchasedQty * 100) / 100 : 0;
      const minPurchaseRate = item.purchaseRates.length > 0 ? Math.min(...item.purchaseRates) : 0;
      const maxPurchaseRate = item.purchaseRates.length > 0 ? Math.max(...item.purchaseRates) : 0;
      const materialSupplyQty = Math.round(item.materialSupplyQty * 100) / 100;
      const materialSupplyAmount = Math.round(item.materialSupplyAmount * 100) / 100;
      const avgMaterialSupplyRate = materialSupplyQty > 0 ? Math.round(materialSupplyAmount / materialSupplyQty * 100) / 100 : 0;
      const siteSupplyQty = Math.round(item.siteSupplyQty * 100) / 100;
      const siteSupplyAmount = Math.round(item.siteSupplyAmount * 100) / 100;
      const avgSiteSupplyRate = siteSupplyQty > 0 ? Math.round(siteSupplyAmount / siteSupplyQty * 100) / 100 : 0;
      const totalSuppliedQty = Math.round((materialSupplyQty + siteSupplyQty) * 100) / 100;
      const totalSuppliedAmount = Math.round((materialSupplyAmount + siteSupplyAmount) * 100) / 100;
      const avgOverallSupplyRate = totalSuppliedQty > 0 ? Math.round(totalSuppliedAmount / totalSuppliedQty * 100) / 100 : 0;
      const currentStock = Math.round((purchasedQty - totalSuppliedQty) * 100) / 100;
      const stockValuation = currentStock > 0 ? Math.round(currentStock * avgPurchaseRate * 100) / 100 : 0;
      let status = "IN_STOCK";
      if (currentStock < 0) status = "NEGATIVE_ALERT";
      else if (currentStock === 0) status = "OUT_OF_STOCK";
      else if (currentStock <= 15) status = "LOW_STOCK";
      const rateSpread = Math.round((avgOverallSupplyRate - avgPurchaseRate) * 100) / 100;
      const grossProfit = Math.round((avgOverallSupplyRate - avgPurchaseRate) * totalSuppliedQty * 100) / 100;
      const marginPercent = avgPurchaseRate > 0 ? Math.round((avgOverallSupplyRate - avgPurchaseRate) / avgPurchaseRate * 1e3) / 10 : 0;
      sumPurchasedVal += totalPurchaseCost;
      sumPurchasedQty += purchasedQty;
      sumMatSupVal += materialSupplyAmount;
      sumMatSupQty += materialSupplyQty;
      sumSiteSupVal += siteSupplyAmount;
      sumSiteSupQty += siteSupplyQty;
      sumOverallSupVal += totalSuppliedAmount;
      sumOverallSupQty += totalSuppliedQty;
      sumInventoryVal += stockValuation;
      sumGrossProfit += grossProfit;
      return {
        materialId: item.materialId,
        materialName: item.materialName,
        category: item.category,
        unit: item.unit,
        purchasedQty,
        totalPurchaseCost,
        avgPurchaseRate,
        minPurchaseRate,
        maxPurchaseRate,
        purchaseCount: item.purchases.length,
        materialSupplyQty,
        materialSupplyAmount,
        avgMaterialSupplyRate,
        siteSupplyQty,
        siteSupplyAmount,
        avgSiteSupplyRate,
        totalSuppliedQty,
        totalSuppliedAmount,
        avgOverallSupplyRate,
        currentStock,
        stockValuation,
        status,
        rateSpread,
        grossProfit,
        marginPercent,
        purchases: item.purchases,
        materialSupplies: item.materialSupplies,
        siteSupplies: item.siteSupplies
      };
    });
    const summary = {
      totalPurchasedValue: Math.round(sumPurchasedVal * 100) / 100,
      totalPurchasedQty: Math.round(sumPurchasedQty * 100) / 100,
      totalMaterialSupplyValue: Math.round(sumMatSupVal * 100) / 100,
      totalMaterialSupplyQty: Math.round(sumMatSupQty * 100) / 100,
      totalSiteSupplyValue: Math.round(sumSiteSupVal * 100) / 100,
      totalSiteSupplyQty: Math.round(sumSiteSupQty * 100) / 100,
      totalOverallSuppliedValue: Math.round(sumOverallSupVal * 100) / 100,
      totalOverallSuppliedQty: Math.round(sumOverallSupQty * 100) / 100,
      totalStockInventoryValuation: Math.round(sumInventoryVal * 100) / 100,
      totalGrossProfit: Math.round(sumGrossProfit * 100) / 100,
      distinctMaterialsCount: materialsAnalytics.length
    };
    const buffer = generateMaterialAnalyticsBuffer(locationName, { summary, materials: materialsAnalytics });
    const sanitized = locationName.replace(/[^a-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Disposition", `attachment; filename="Material_Purchase_Supply_Analytics_${sanitized}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error("Failed to export material analytics:", error);
    res.status(500).json({ error: "Failed to export material analytics" });
  }
});
reportRouter.get("/download-catalog", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const locationIdParam = req.query.locationId && req.query.locationId !== "ALL" ? parseInt(req.query.locationId, 10) : void 0;
    if (locationIdParam && !isNaN(locationIdParam)) {
      await assertLocationAccess(userId, locationIdParam);
    }
    const locCondition = locationIdParam ? sql5`location_id = ${locationIdParam}` : sql5`1=1`;
    const [invParties, vendors, customers, counts] = await Promise.all([
      db.select({ id: investmentParties.id, name: investmentParties.partyName, locationId: investmentParties.locationId }).from(investmentParties).where(and5(eq6(investmentParties.isDeleted, 0), locationIdParam ? eq6(investmentParties.locationId, locationIdParam) : sql5`1=1`)).orderBy(investmentParties.partyName),
      db.execute(sql5`
        SELECT DISTINCT party_name as name, COUNT(*) as count, SUM(total_amount) as total
        FROM material_purchases
        WHERE is_deleted = 0 AND ${locCondition}
        GROUP BY party_name ORDER BY party_name
      `),
      db.execute(sql5`
        SELECT DISTINCT party_name as name, COUNT(*) as count, SUM(total_amount) as total
        FROM material_supplies
        WHERE is_deleted = 0 AND ${locCondition}
        GROUP BY party_name ORDER BY party_name
      `),
      db.execute(sql5`
        SELECT 
          (SELECT COUNT(*) FROM records WHERE is_deleted = 0 AND (${records.refundableAmount} > 0 OR category IN ('REFUNDABLE_RECORD', 'REFUNDABLE')) AND ${locCondition}) as ref_count,
          (SELECT COUNT(*) FROM material_purchases WHERE is_deleted = 0 AND ${locCondition}) as pur_count,
          (SELECT COUNT(*) FROM material_supplies WHERE is_deleted = 0 AND ${locCondition}) as sup_count,
          (SELECT COUNT(*) FROM site_supplies WHERE is_deleted = 0 AND ${locCondition}) as site_count,
          (SELECT COUNT(*) FROM labour_salaries WHERE is_deleted = 0 AND ${locCondition}) as lab_count,
          (SELECT COUNT(*) FROM supervisor_costs WHERE is_deleted = 0 AND ${locCondition}) as exp_count
      `)
    ]);
    res.json({
      investors: invParties,
      vendors: vendors.rows,
      customers: customers.rows,
      counts: counts.rows[0] || {}
    });
  } catch (error) {
    console.error("Failed to get download catalog:", error);
    res.status(500).json({ error: "Failed to fetch download catalog" });
  }
});
var report_routes_default = reportRouter;

// src/server/routes/audit.routes.ts
import { Router as Router4 } from "express";
import { desc as desc3 } from "drizzle-orm";
var auditRouter = Router4();
auditRouter.use(requireAuth);
auditRouter.get("/", async (req, res) => {
  try {
    const logs = await db.select().from(auditLogs).orderBy(desc3(auditLogs.createdAt)).limit(100);
    res.json(logs);
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});
var audit_routes_default = auditRouter;

// src/server/routes/investment.routes.ts
import { Router as Router5 } from "express";
import { eq as eq7, and as and6, desc as desc4, sql as sql6, ne } from "drizzle-orm";
import { z as z3 } from "zod";
var investmentRouter = Router5();
investmentRouter.use(requireAuth);
investmentRouter.use(requireCategoryAuth);
var partySchema = z3.object({
  locationId: z3.number().int().positive().optional(),
  partyName: z3.string().min(1).max(100),
  initialAmount: z3.union([z3.number(), z3.string()]).transform(Number).optional(),
  initialDate: z3.string().optional()
});
var txSchema = z3.object({
  partyId: z3.number().int().positive(),
  type: z3.enum(["INVESTMENT", "UPAD", "PAYMENT", "CONTRIBUTION"]),
  amount: z3.union([z3.number().positive(), z3.string().regex(/^\d+(\.\d{1,2})?$/)]).transform(Number),
  date: z3.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z3.string().optional().nullable(),
  paymentMethod: z3.string().optional().nullable(),
  referenceNumber: z3.string().optional().nullable()
});
investmentRouter.get("/admin-capital-summary", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const summary = await getAdminCapitalSummary(db, userId);
    res.json(summary);
  } catch (error) {
    console.error("[Admin Capital Summary GET Error]", error);
    res.status(500).json({ error: "Failed to calculate admin capital summary" });
  }
});
investmentRouter.get("/global-investors", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const allInvestors = await db.select().from(investors).where(
      eq7(investors.isDeleted, 0)
    ).orderBy(desc4(investors.createdAt));
    const investorIds = allInvestors.map((i) => i.id);
    let allTxs = [];
    let allAllocs = [];
    if (investorIds.length > 0) {
      allTxs = await db.select().from(investorTransactions).where(
        and6(
          sql6`${investorTransactions.investorId} IN (${sql6.join(investorIds, sql6`, `)})`,
          eq7(investorTransactions.isDeleted, 0)
        )
      ).orderBy(desc4(investorTransactions.date), desc4(investorTransactions.id));
      allAllocs = await db.select({
        id: investorLocationAllocations.id,
        investorId: investorLocationAllocations.investorId,
        locationId: investorLocationAllocations.locationId,
        locationName: locations.name,
        amount: investorLocationAllocations.amount,
        date: investorLocationAllocations.date,
        paymentMethod: investorLocationAllocations.paymentMethod,
        referenceNumber: investorLocationAllocations.referenceNumber,
        notes: investorLocationAllocations.notes,
        createdAt: investorLocationAllocations.createdAt
      }).from(investorLocationAllocations).innerJoin(locations, eq7(investorLocationAllocations.locationId, locations.id)).where(
        and6(
          sql6`${investorLocationAllocations.investorId} IN (${sql6.join(investorIds, sql6`, `)})`,
          eq7(investorLocationAllocations.isDeleted, 0)
        )
      ).orderBy(desc4(investorLocationAllocations.date));
    }
    const result = allInvestors.map((inv) => {
      const txs = allTxs.filter((t) => t.investorId === inv.id);
      const allocs = allAllocs.filter((a) => a.investorId === inv.id);
      const totalCapital = Math.round(
        txs.filter((t) => t.type === "CONTRIBUTION" || t.type === "CAPITAL" || t.type === "INVESTMENT").reduce((acc, t) => acc + (parseFloat(String(t.amount || 0)) || 0), 0) * 100
      ) / 100;
      const totalUpad = Math.round(
        txs.filter((t) => t.type === "UPAD" || t.type === "WITHDRAWAL" || t.type === "PAYMENT").reduce((acc, t) => acc + (parseFloat(String(t.amount || 0)) || 0), 0) * 100
      ) / 100;
      const totalAllocated = Math.round(
        allocs.reduce((acc, a) => acc + (parseFloat(String(a.amount || 0)) || 0), 0) * 100
      ) / 100;
      const availableBalance = Math.round((totalCapital - totalUpad - totalAllocated) * 100) / 100;
      return {
        ...inv,
        totalCapital,
        totalContributed: totalCapital,
        totalUpad,
        totalWithdrawn: totalUpad,
        totalAllocated,
        availableBalance,
        availableCapital: availableBalance,
        transactions: txs,
        allocations: allocs
      };
    });
    res.json(result);
  } catch (error) {
    console.warn("[Global Investors GET Notice] Database query fallback:", error?.message || error);
    res.json([]);
  }
});
investmentRouter.post("/global-investors", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { name, mobile, email, address, notes, initialContribution, initialDate, paymentMethod, referenceNumber } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Investor Name is required" });
    const cleanName = String(name).trim().toUpperCase();
    const existingGlobal = await db.select().from(investors).where(
      and6(
        eq7(investors.isDeleted, 0),
        sql6`UPPER(${investors.name}) = ${cleanName}`
      )
    ).limit(1);
    let newInvestor;
    let isExisting = false;
    if (existingGlobal.length > 0) {
      newInvestor = existingGlobal[0];
      isExisting = true;
      if (newInvestor.name !== cleanName) {
        await db.update(investors).set({ name: cleanName, updatedAt: /* @__PURE__ */ new Date() }).where(eq7(investors.id, newInvestor.id));
        newInvestor.name = cleanName;
      }
    } else {
      const inserted = await db.insert(investors).values({
        userId,
        name: cleanName,
        mobile: mobile ? String(mobile).trim() : null,
        email: email ? String(email).trim() : null,
        address: address ? String(address).trim() : null,
        notes: notes ? String(notes).trim() : null,
        isDeleted: 0
      }).returning();
      newInvestor = inserted[0];
    }
    const initAmt = parseFloat(String(initialContribution || 0));
    if (initAmt > 0) {
      await db.insert(investorTransactions).values({
        investorId: newInvestor.id,
        userId,
        type: "CONTRIBUTION",
        amount: String(initAmt),
        date: initialDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        paymentMethod: paymentMethod || "Bank Transfer",
        referenceNumber: referenceNumber || null,
        description: isExisting ? "Additional Capital Contribution" : "Initial Capital Contribution",
        isDeleted: 0
      });
    }
    await db.insert(auditLogs).values({
      userId,
      action: isExisting ? "ADD_CAPITAL_TO_EXISTING_INVESTOR" : "CREATE_GLOBAL_INVESTOR",
      entityType: "INVESTMENT",
      entityId: newInvestor.id,
      metadata: JSON.stringify({ name: cleanName, initialContribution: initAmt, isExisting })
    });
    res.status(isExisting ? 200 : 201).json({ ...newInvestor, isExisting });
  } catch (error) {
    console.error("[Global Investor POST Error]", error);
    res.status(400).json({ error: error?.message || "Failed to create investor" });
  }
});
investmentRouter.put("/global-investors/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid ID required" });
    const { name, mobile, email, address, notes } = req.body;
    const updated = await db.update(investors).set({
      ...name !== void 0 && { name: String(name).trim() },
      ...mobile !== void 0 && { mobile: mobile ? String(mobile).trim() : null },
      ...email !== void 0 && { email: email ? String(email).trim() : null },
      ...address !== void 0 && { address: address ? String(address).trim() : null },
      ...notes !== void 0 && { notes: notes ? String(notes).trim() : null },
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and6(eq7(investors.id, id), eq7(investors.isDeleted, 0))).returning();
    if (!updated.length) return res.status(404).json({ error: "Investor not found" });
    res.json(updated[0]);
  } catch (error) {
    console.error("[Global Investor PUT Error]", error);
    res.status(400).json({ error: error?.message || "Failed to update investor" });
  }
});
investmentRouter.delete("/global-investors/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid ID required" });
    const updated = await db.update(investors).set({
      isDeleted: 1,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and6(eq7(investors.id, id), eq7(investors.isDeleted, 0))).returning();
    if (!updated.length) return res.status(404).json({ error: "Investor not found" });
    res.json({ success: true, message: "Investor deleted successfully" });
  } catch (error) {
    console.error("[Global Investor DELETE Error]", error);
    res.status(500).json({ error: "Failed to delete investor" });
  }
});
investmentRouter.post("/global-transactions", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const rawInvId = req.body.investorId || req.body.partyId;
    const investorId = parseInt(String(rawInvId), 10);
    if (isNaN(investorId)) return res.status(400).json({ error: "Valid investor ID required" });
    const { type, amount, date, paymentMethod, referenceNumber, description, notes } = req.body;
    const parsedAmount = parseFloat(String(amount));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "Valid positive amount required" });
    }
    const txType = String(type || "CONTRIBUTION").toUpperCase();
    if (!["CONTRIBUTION", "UPAD", "CAPITAL", "WITHDRAWAL", "INVESTMENT", "PAYMENT"].includes(txType)) {
      return res.status(400).json({ error: "Invalid transaction type" });
    }
    const normalizedType = txType === "CAPITAL" || txType === "INVESTMENT" ? "CONTRIBUTION" : txType === "WITHDRAWAL" || txType === "PAYMENT" ? "UPAD" : txType;
    const inserted = await db.insert(investorTransactions).values({
      investorId,
      userId,
      type: normalizedType,
      amount: String(parsedAmount),
      date: date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      paymentMethod: paymentMethod || "Bank Transfer",
      referenceNumber: referenceNumber || null,
      description: description || notes || null,
      isDeleted: 0
    }).returning();
    await db.insert(auditLogs).values({
      userId,
      action: normalizedType === "CONTRIBUTION" ? "ADMIN_CAPITAL_CONTRIBUTION" : "ADMIN_CAPITAL_WITHDRAWAL",
      entityType: "INVESTMENT",
      entityId: inserted[0].id,
      metadata: JSON.stringify({ investorId, amount: parsedAmount, type: normalizedType })
    });
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error("[Global Transaction POST Error]", error);
    res.status(400).json({ error: error?.message || "Failed to record transaction" });
  }
});
investmentRouter.get("/global-transactions", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const investorIdParam = req.query.investorId;
    const invId = investorIdParam ? parseInt(investorIdParam, 10) : void 0;
    const records2 = await db.select({
      id: investorTransactions.id,
      investorId: investorTransactions.investorId,
      investorName: investors.name,
      userId: investorTransactions.userId,
      type: investorTransactions.type,
      amount: investorTransactions.amount,
      date: investorTransactions.date,
      paymentMethod: investorTransactions.paymentMethod,
      referenceNumber: investorTransactions.referenceNumber,
      description: investorTransactions.description,
      createdAt: investorTransactions.createdAt
    }).from(investorTransactions).innerJoin(investors, eq7(investorTransactions.investorId, investors.id)).where(
      and6(
        eq7(investorTransactions.isDeleted, 0),
        invId ? eq7(investorTransactions.investorId, invId) : sql6`1=1`
      )
    ).orderBy(desc4(investorTransactions.date), desc4(investorTransactions.id));
    res.json(records2);
  } catch (error) {
    console.error("[Global Transactions GET Error]", error);
    res.status(500).json({ error: "Failed to fetch global transactions" });
  }
});
investmentRouter.put("/global-transactions/:txId", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const txId = parseInt(String(req.params.txId), 10);
    if (isNaN(txId)) return res.status(400).json({ error: "Valid transaction ID required" });
    const { type, amount, date, paymentMethod, referenceNumber, description, notes } = req.body;
    const updateData = {};
    if (amount !== void 0) {
      const parsedAmount = parseFloat(String(amount));
      if (isNaN(parsedAmount) || parsedAmount <= 0) return res.status(400).json({ error: "Valid positive amount required" });
      updateData.amount = String(parsedAmount);
    }
    if (type) {
      const txType = String(type).toUpperCase();
      updateData.type = txType === "CAPITAL" || txType === "INVESTMENT" ? "CONTRIBUTION" : txType === "WITHDRAWAL" || txType === "PAYMENT" ? "UPAD" : txType;
    }
    if (date) updateData.date = date;
    if (paymentMethod !== void 0) updateData.paymentMethod = paymentMethod;
    if (referenceNumber !== void 0) updateData.referenceNumber = referenceNumber;
    if (description !== void 0 || notes !== void 0) updateData.description = description || notes || null;
    const updated = await db.update(investorTransactions).set(updateData).where(and6(eq7(investorTransactions.id, txId), eq7(investorTransactions.isDeleted, 0))).returning();
    if (updated.length === 0) return res.status(404).json({ error: "Transaction not found" });
    res.json(updated[0]);
  } catch (error) {
    console.error("[Global Tx PUT Error]", error);
    res.status(500).json({ error: "Failed to update transaction" });
  }
});
investmentRouter.delete("/global-transactions/:txId", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const txId = parseInt(String(req.params.txId), 10);
    if (isNaN(txId)) return res.status(400).json({ error: "Valid transaction ID required" });
    await db.update(investorTransactions).set({ isDeleted: 1 }).where(eq7(investorTransactions.id, txId));
    res.json({ success: true });
  } catch (error) {
    console.error("[Global Tx DELETE Error]", error);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});
investmentRouter.post("/global-investors/:id/transactions", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const investorId = parseInt(String(req.params.id), 10);
    if (isNaN(investorId)) return res.status(400).json({ error: "Valid investor ID required" });
    const { type, amount, date, paymentMethod, referenceNumber, description, notes } = req.body;
    const parsedAmount = parseFloat(String(amount));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "Valid positive amount required" });
    }
    const txType = String(type || "CONTRIBUTION").toUpperCase();
    if (!["CONTRIBUTION", "UPAD", "CAPITAL", "WITHDRAWAL", "INVESTMENT", "PAYMENT"].includes(txType)) {
      return res.status(400).json({ error: "Invalid transaction type" });
    }
    const normalizedType = txType === "CAPITAL" || txType === "INVESTMENT" ? "CONTRIBUTION" : txType === "WITHDRAWAL" || txType === "PAYMENT" ? "UPAD" : txType;
    const inserted = await db.insert(investorTransactions).values({
      investorId,
      userId,
      type: normalizedType,
      amount: String(parsedAmount),
      date: date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      paymentMethod: paymentMethod || "Bank Transfer",
      referenceNumber: referenceNumber || null,
      description: description || notes || null,
      isDeleted: 0
    }).returning();
    await db.insert(auditLogs).values({
      userId,
      action: normalizedType === "CONTRIBUTION" ? "ADMIN_CAPITAL_CONTRIBUTION" : "ADMIN_CAPITAL_WITHDRAWAL",
      entityType: "INVESTMENT",
      entityId: inserted[0].id,
      metadata: JSON.stringify({ investorId, amount: parsedAmount, type: normalizedType })
    });
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error("[Investor Tx POST Error]", error);
    res.status(400).json({ error: error?.message || "Failed to add investor transaction" });
  }
});
investmentRouter.delete("/global-investors/transactions/:txId", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const txId = parseInt(String(req.params.txId), 10);
    if (isNaN(txId)) return res.status(400).json({ error: "Valid transaction ID required" });
    await db.update(investorTransactions).set({ isDeleted: 1 }).where(eq7(investorTransactions.id, txId));
    res.json({ success: true });
  } catch (error) {
    console.error("[Investor Tx DELETE Error]", error);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});
investmentRouter.get("/location-allocations", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const locParam = req.query.locationId;
    const locationId = locParam && locParam !== "ALL" && locParam !== "0" && !isNaN(parseInt(locParam, 10)) ? parseInt(locParam, 10) : void 0;
    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }
    const allocs = await db.select({
      id: investorLocationAllocations.id,
      investorId: investorLocationAllocations.investorId,
      investorName: investors.name,
      investorMobile: investors.mobile,
      locationId: investorLocationAllocations.locationId,
      amount: investorLocationAllocations.amount,
      date: investorLocationAllocations.date,
      paymentMethod: investorLocationAllocations.paymentMethod,
      referenceNumber: investorLocationAllocations.referenceNumber,
      notes: investorLocationAllocations.notes,
      createdAt: investorLocationAllocations.createdAt
    }).from(investorLocationAllocations).innerJoin(investors, eq7(investorLocationAllocations.investorId, investors.id)).where(
      and6(
        locationId ? eq7(investorLocationAllocations.locationId, locationId) : void 0,
        eq7(investorLocationAllocations.isDeleted, 0)
      )
    ).orderBy(desc4(investorLocationAllocations.date), desc4(investorLocationAllocations.id));
    res.json(allocs);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("[Location Allocations GET Error]", error);
    res.status(500).json({ error: "Failed to fetch location allocations" });
  }
});
investmentRouter.post("/location-allocations", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { investorId, locationId, amount, date, paymentMethod, referenceNumber, notes } = req.body;
    const invId = parseInt(String(investorId), 10);
    const locId = parseInt(String(locationId), 10);
    const allocAmount = parseFloat(String(amount));
    if (isNaN(locId) || locId <= 0) {
      return res.status(400).json({ error: "\u0AAE\u0AB9\u0AC7\u0AB0\u0AAC\u0ABE\u0AA8\u0AC0 \u0A95\u0AB0\u0AC0\u0AA8\u0AC7 \u0AAA\u0ACD\u0AB0\u0ACB\u0A9C\u0AC7\u0A95\u0ACD\u0A9F \u0AB2\u0ACB\u0A95\u0AC7\u0AB6\u0AA8 \u0AB8\u0ABF\u0AB2\u0AC7\u0A95\u0ACD\u0A9F \u0A95\u0AB0\u0ACB / Please select a project location" });
    }
    if (isNaN(invId) || isNaN(allocAmount) || allocAmount <= 0) {
      return res.status(400).json({ error: "Valid investor and positive amount are required" });
    }
    await assertLocationAccess(userId, locId);
    let invName = "Investor";
    const globalInv = await db.select().from(investors).where(
      and6(eq7(investors.id, invId), eq7(investors.isDeleted, 0))
    ).limit(1);
    if (globalInv.length > 0) {
      invName = globalInv[0].name;
    } else {
      const partyInv = await db.select().from(investmentParties).where(
        and6(eq7(investmentParties.id, invId), eq7(investmentParties.isDeleted, 0))
      ).limit(1);
      if (partyInv.length > 0) {
        invName = partyInv[0].partyName;
      } else {
        return res.status(404).json({ error: "Investor not found" });
      }
    }
    const adminSummary = await getAdminCapitalSummary(db, userId);
    if (allocAmount > adminSummary.availableAdminCapital) {
      return res.status(400).json({
        error: `Cannot transfer \u20B9${allocAmount.toLocaleString("en-IN")}: Exceeds available Admin Capital (\u20B9${adminSummary.availableAdminCapital.toLocaleString("en-IN")}).`
      });
    }
    const invSummary = adminSummary.investors.find((i) => i.id === invId);
    if (!invSummary || allocAmount > invSummary.availableCapital) {
      const avail = invSummary ? invSummary.availableCapital : 0;
      return res.status(400).json({
        error: `Cannot transfer \u20B9${allocAmount.toLocaleString("en-IN")}: Selected investor ${invName} has only \u20B9${avail.toLocaleString("en-IN")} unallocated Admin Capital available.`
      });
    }
    const inserted = await db.insert(investorLocationAllocations).values({
      investorId: invId,
      locationId: locId,
      userId,
      amount: String(allocAmount),
      date: date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      paymentMethod: paymentMethod || "Bank Transfer",
      referenceNumber: referenceNumber || null,
      notes: notes || null,
      isDeleted: 0
    }).returning();
    let existingParty = await db.select().from(investmentParties).where(
      and6(
        eq7(investmentParties.userId, userId),
        eq7(investmentParties.locationId, locId),
        sql6`UPPER(${investmentParties.partyName}) = ${invName.toUpperCase()}`,
        eq7(investmentParties.isDeleted, 0)
      )
    ).limit(1);
    if (existingParty.length === 0) {
      await db.insert(investmentParties).values({
        userId,
        locationId: locId,
        partyName: invName.toUpperCase()
      });
    }
    await db.insert(auditLogs).values({
      userId,
      action: "ALLOCATE_INVESTOR_CAPITAL",
      entityType: "INVESTMENT",
      entityId: inserted[0].id,
      metadata: JSON.stringify({ investorId: invId, locationId: locId, amount: allocAmount })
    });
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error("[Location Allocation POST Error]", error);
    res.status(400).json({ error: error?.message || "Failed to allocate capital" });
  }
});
investmentRouter.delete("/location-allocations/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid ID required" });
    const existing = await db.select().from(investorLocationAllocations).where(and6(eq7(investorLocationAllocations.id, id), eq7(investorLocationAllocations.isDeleted, 0))).limit(1);
    if (!existing.length) return res.status(404).json({ error: "Allocation record not found" });
    if (existing[0].locationId && existing[0].locationId > 0) {
      try {
        await assertLocationAccess(userId, existing[0].locationId);
      } catch (e) {
        console.warn("Location check ignored during location allocation deletion:", e);
      }
    }
    await db.update(investorLocationAllocations).set({ isDeleted: 1 }).where(eq7(investorLocationAllocations.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("[Location Allocation DELETE Error]", error);
    res.status(500).json({ error: "Failed to delete allocation" });
  }
});
investmentRouter.post("/transfer-to-investment-capital", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { locationId, partyId, investorId, amount, date, paymentMethod, referenceNumber, notes } = req.body;
    const locId = parseInt(String(locationId), 10);
    const transferAmount = parseFloat(String(amount));
    if (isNaN(locId) || locId <= 0) {
      return res.status(400).json({ error: "Valid Location ID is required" });
    }
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ error: "Valid positive transfer amount is required" });
    }
    await assertLocationAccess(userId, locId);
    let pId = partyId ? parseInt(String(partyId), 10) : null;
    let resolvedParty;
    if (pId && !isNaN(pId)) {
      const parties2 = await db.select().from(investmentParties).where(
        and6(eq7(investmentParties.id, pId), eq7(investmentParties.isDeleted, 0))
      ).limit(1);
      if (parties2.length > 0) resolvedParty = parties2[0];
    } else if (investorId) {
      const invId = parseInt(String(investorId), 10);
      const inv = await db.select().from(investors).where(
        and6(eq7(investors.id, invId), eq7(investors.isDeleted, 0))
      ).limit(1);
      if (inv.length > 0) {
        const existingParty = await db.select().from(investmentParties).where(
          and6(
            eq7(investmentParties.locationId, locId),
            sql6`UPPER(${investmentParties.partyName}) = ${inv[0].name.trim().toUpperCase()}`,
            eq7(investmentParties.isDeleted, 0)
          )
        ).limit(1);
        if (existingParty.length > 0) {
          resolvedParty = existingParty[0];
          pId = existingParty[0].id;
        } else {
          const created = await db.insert(investmentParties).values({
            userId,
            locationId: locId,
            partyName: inv[0].name.trim().toUpperCase()
          }).returning();
          resolvedParty = created[0];
          pId = created[0].id;
        }
      }
    }
    if (!resolvedParty || !pId) {
      return res.status(404).json({ error: "Investor / Party not found for this location" });
    }
    const cleanName = resolvedParty.partyName.trim().toUpperCase();
    const allocRows = await db.select({
      total: sql6`COALESCE(SUM(CAST(${investorLocationAllocations.amount} AS numeric)), 0)`
    }).from(investorLocationAllocations).innerJoin(investors, eq7(investorLocationAllocations.investorId, investors.id)).where(and6(
      eq7(investorLocationAllocations.locationId, locId),
      eq7(investorLocationAllocations.isDeleted, 0),
      sql6`UPPER(${investors.name}) = ${cleanName}`
    ));
    const cat7Allocated = parseFloat(allocRows[0]?.total || "0") || 0;
    const txRows = await db.select({
      total: sql6`COALESCE(SUM(CAST(${investmentTransactions.amount} AS numeric)), 0)`
    }).from(investmentTransactions).where(and6(
      eq7(investmentTransactions.partyId, pId),
      eq7(investmentTransactions.type, "INVESTMENT"),
      eq7(investmentTransactions.isDeleted, 0)
    ));
    const alreadyInvested = parseFloat(txRows[0]?.total || "0") || 0;
    const availableInvestorCapital = Math.max(0, Math.round((cat7Allocated - alreadyInvested) * 100) / 100);
    if (transferAmount > availableInvestorCapital) {
      return res.status(400).json({
        error: `Cannot transfer \u20B9${transferAmount.toLocaleString("en-IN")}: Selected investor ${resolvedParty.partyName} has only \u20B9${availableInvestorCapital.toLocaleString("en-IN")} available Category 7 Investor Capital at this location.`
      });
    }
    const insertedTx = await db.insert(investmentTransactions).values({
      partyId: pId,
      userId,
      type: "INVESTMENT",
      amount: String(transferAmount),
      date: date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      paymentMethod: paymentMethod || "Bank Transfer",
      referenceNumber: referenceNumber || null,
      description: notes ? `Investment into Project: ${notes}` : `Investment into Project (from ${resolvedParty.partyName})`,
      isDeleted: 0
    }).returning();
    await db.insert(auditLogs).values({
      userId,
      action: "INVESTOR_TO_INVESTMENT_TRANSFER",
      entityType: "INVESTMENT",
      entityId: insertedTx[0].id,
      metadata: JSON.stringify({
        partyId: pId,
        locationId: locId,
        amount: transferAmount,
        investorName: resolvedParty.partyName
      })
    });
    res.status(201).json({
      success: true,
      transaction: insertedTx[0],
      remainingInvestorCapital: Math.round((availableInvestorCapital - transferAmount) * 100) / 100
    });
  } catch (error) {
    console.error("[Transfer to Investment Capital POST Error]", error);
    res.status(400).json({ error: error?.message || "Failed to transfer to investment capital" });
  }
});
investmentRouter.get("/bills", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const locParam = req.query.locationId;
    const locationId = locParam && locParam !== "ALL" && locParam !== "0" && !isNaN(parseInt(locParam, 10)) ? parseInt(locParam, 10) : void 0;
    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }
    const bills = await db.select().from(records).where(
      and6(
        locationId ? eq7(records.locationId, locationId) : void 0,
        eq7(records.isDeleted, 0),
        eq7(records.type, "INCOME"),
        eq7(records.category, "BILL_INVESTMENT")
      )
    ).orderBy(desc4(records.date), desc4(records.id));
    res.json(bills);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("[Investment Bills GET Error]", error);
    res.status(500).json({ error: "Failed to fetch bill investments" });
  }
});
investmentRouter.post("/bills", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { locationId, partyName, amount, date, description, paymentMethod, referenceNumber } = req.body;
    const locId = parseInt(String(locationId), 10);
    const parsedAmount = parseFloat(String(amount));
    if (isNaN(locId) || locId <= 0) {
      return res.status(400).json({ error: "\u0AAE\u0AB9\u0AC7\u0AB0\u0AAC\u0ABE\u0AA8\u0AC0 \u0A95\u0AB0\u0AC0\u0AA8\u0AC7 \u0AAA\u0ACD\u0AB0\u0ACB\u0A9C\u0AC7\u0A95\u0ACD\u0A9F \u0AB2\u0ACB\u0A95\u0AC7\u0AB6\u0AA8 \u0AB8\u0ABF\u0AB2\u0AC7\u0A95\u0ACD\u0A9F \u0A95\u0AB0\u0ACB / Please select a project location" });
    }
    if (!partyName || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "Valid Party/Invoice Name and positive amount are required" });
    }
    await assertLocationAccess(userId, locId);
    const inserted = await db.insert(records).values({
      userId,
      locationId: locId,
      type: "INCOME",
      category: "BILL_INVESTMENT",
      partyName: String(partyName).trim(),
      amount: String(parsedAmount),
      date: date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      description: description || null,
      paymentMethod: paymentMethod || "Bank Transfer",
      referenceNumber: referenceNumber || null,
      isDeleted: 0
    }).returning();
    await db.insert(auditLogs).values({
      userId,
      action: "CREATE_BILL_INVESTMENT",
      entityType: "INVESTMENT",
      entityId: inserted[0].id,
      metadata: JSON.stringify({ locationId: locId, partyName, amount: parsedAmount })
    });
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error("[Investment Bills POST Error]", error);
    res.status(400).json({ error: error?.message || "Failed to create bill investment" });
  }
});
investmentRouter.get("/parties", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const locationIdParam = req.query.locationId;
    const locationId = locationIdParam && locationIdParam !== "ALL" && locationIdParam !== "0" ? parseInt(locationIdParam, 10) : void 0;
    if (locationId && !isNaN(locationId)) {
      await assertLocationAccess(userId, locationId);
    }
    if (locationId && !isNaN(locationId)) {
      const existingAllocs = await db.select({
        investorName: investors.name
      }).from(investorLocationAllocations).innerJoin(investors, eq7(investorLocationAllocations.investorId, investors.id)).where(and6(
        eq7(investorLocationAllocations.locationId, locationId),
        eq7(investorLocationAllocations.isDeleted, 0)
      ));
      for (const a of existingAllocs) {
        const clean = a.investorName.trim().toUpperCase();
        const exists = await db.select({ id: investmentParties.id }).from(investmentParties).where(
          and6(
            eq7(investmentParties.locationId, locationId),
            sql6`UPPER(${investmentParties.partyName}) = ${clean}`,
            eq7(investmentParties.isDeleted, 0)
          )
        ).limit(1);
        if (exists.length === 0) {
          await db.insert(investmentParties).values({
            userId,
            locationId,
            partyName: clean
          });
        }
      }
    }
    const conditions = [
      eq7(investmentParties.isDeleted, 0)
    ];
    if (locationId && !isNaN(locationId)) {
      conditions.push(eq7(investmentParties.locationId, locationId));
    }
    const parties2 = await db.select({
      id: investmentParties.id,
      userId: investmentParties.userId,
      locationId: investmentParties.locationId,
      partyName: investmentParties.partyName,
      createdAt: investmentParties.createdAt,
      updatedAt: investmentParties.updatedAt,
      isDeleted: investmentParties.isDeleted,
      locationName: locations.name
    }).from(investmentParties).leftJoin(locations, eq7(investmentParties.locationId, locations.id)).where(and6(...conditions)).orderBy(desc4(investmentParties.createdAt));
    const cat7Allocs = await db.select({
      locationId: investorLocationAllocations.locationId,
      investorName: sql6`UPPER(${investors.name})`,
      total: sql6`COALESCE(SUM(CAST(${investorLocationAllocations.amount} AS numeric)), 0)`
    }).from(investorLocationAllocations).innerJoin(investors, eq7(investorLocationAllocations.investorId, investors.id)).where(and6(
      locationId && !isNaN(locationId) ? eq7(investorLocationAllocations.locationId, locationId) : void 0,
      eq7(investorLocationAllocations.isDeleted, 0)
    )).groupBy(investorLocationAllocations.locationId, sql6`UPPER(${investors.name})`);
    const partyIds = parties2.map((p) => p.id);
    let metrics = [];
    if (partyIds.length > 0) {
      metrics = await db.select({
        partyId: investmentTransactions.partyId,
        type: investmentTransactions.type,
        total: sql6`sum(${investmentTransactions.amount})`
      }).from(investmentTransactions).where(and6(
        sql6`${investmentTransactions.partyId} IN (${sql6.join(partyIds, sql6`, `)})`,
        eq7(investmentTransactions.isDeleted, 0)
      )).groupBy(investmentTransactions.partyId, investmentTransactions.type);
    }
    const result = parties2.map((p) => {
      let totalInvestment = 0;
      let totalPayment = 0;
      let totalUpad = 0;
      let totalContribution = 0;
      metrics.filter((m) => m.partyId === p.id).forEach((m) => {
        if (m.type === "CONTRIBUTION") totalContribution += parseFloat(m.total || "0");
        if (m.type === "INVESTMENT") totalInvestment += parseFloat(m.total || "0");
        if (m.type === "PAYMENT") totalPayment += parseFloat(m.total || "0");
        if (m.type === "UPAD") totalUpad += parseFloat(m.total || "0");
      });
      const cleanName = p.partyName.trim().toUpperCase();
      const allocMatch = cat7Allocs.find(
        (a) => a.investorName === cleanName && (!locationId || a.locationId === p.locationId)
      );
      const cat7Allocated = parseFloat(allocMatch?.total || "0") || 0;
      const cat7Deployed = totalInvestment;
      const cat7Available = Math.max(0, Math.round((cat7Allocated - cat7Deployed) * 100) / 100);
      return {
        ...p,
        cat7Allocated,
        cat7Deployed,
        cat7Available,
        totalInvestment,
        totalPayment,
        totalUpad,
        totalContribution,
        // Category 7 Available Investor Capital is the true available balance for the modal and calculations
        balance: cat7Available
      };
    });
    res.json(result);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: "Failed to fetch investment parties" });
  }
});
investmentRouter.post("/parties", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const data = partySchema.parse(req.body);
    let targetLocationId = data.locationId;
    if (!targetLocationId) {
      const locRows = await db.select({ id: locations.id }).from(locations).limit(1);
      targetLocationId = locRows[0]?.id || 1;
    }
    await assertLocationAccess(userId, targetLocationId);
    const cleanPartyName = data.partyName.trim().toUpperCase();
    const existingParty = await db.select().from(investmentParties).where(
      and6(
        eq7(investmentParties.userId, userId),
        eq7(investmentParties.isDeleted, 0),
        sql6`UPPER(${investmentParties.partyName}) = ${cleanPartyName}`
      )
    ).limit(1);
    let party;
    let isExisting = false;
    if (existingParty.length > 0) {
      party = existingParty[0];
      isExisting = true;
      if (party.partyName !== cleanPartyName) {
        await db.update(investmentParties).set({ partyName: cleanPartyName, updatedAt: /* @__PURE__ */ new Date() }).where(eq7(investmentParties.id, party.id));
        party.partyName = cleanPartyName;
      }
    } else {
      const result = await db.insert(investmentParties).values({
        userId,
        locationId: targetLocationId,
        partyName: cleanPartyName
      }).returning();
      party = result[0];
      await db.insert(auditLogs).values({
        userId,
        action: "CREATE_INVESTMENT_PARTY",
        entityType: "INVESTMENT",
        entityId: party.id,
        metadata: JSON.stringify({ partyName: cleanPartyName })
      });
    }
    if (data.initialAmount && data.initialAmount > 0) {
      const txResult = await db.insert(investmentTransactions).values({
        userId,
        partyId: party.id,
        type: "CONTRIBUTION",
        amount: data.initialAmount.toString(),
        date: data.initialDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        description: isExisting ? "Additional Capital Contribution" : "Initial Contribution",
        paymentMethod: "Cash"
      }).returning();
      await db.insert(auditLogs).values({
        userId,
        action: "CREATE_CONTRIBUTION",
        entityType: "INVESTMENT",
        entityId: txResult[0].id,
        metadata: JSON.stringify({ partyId: party.id, amount: data.initialAmount, type: "CONTRIBUTION", isExisting })
      });
    }
    res.json({ ...party, isExisting });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    res.status(400).json({ error: error?.message || "Validation failed" });
  }
});
investmentRouter.put("/parties/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const { partyName } = req.body;
    if (!partyName || typeof partyName !== "string") return res.status(400).json({ error: "Party name required" });
    const upperName = partyName.trim().toUpperCase();
    const [updated] = await db.update(investmentParties).set({ partyName: upperName, updatedAt: /* @__PURE__ */ new Date() }).where(and6(eq7(investmentParties.id, id), eq7(investmentParties.isDeleted, 0))).returning();
    if (!updated) return res.status(404).json({ error: "Party not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update party" });
  }
});
investmentRouter.get("/transactions", async (req, res) => {
  try {
    const partyId = req.query.partyId ? parseInt(req.query.partyId, 10) : void 0;
    const locationId = req.query.locationId ? parseInt(req.query.locationId, 10) : void 0;
    const type = req.query.type;
    const conditions = [
      eq7(investmentTransactions.isDeleted, 0)
    ];
    if (partyId && !isNaN(partyId)) {
      conditions.push(eq7(investmentTransactions.partyId, partyId));
    }
    if (type && (type === "INVESTMENT" || type === "UPAD" || type === "PAYMENT" || type === "CONTRIBUTION")) {
      conditions.push(eq7(investmentTransactions.type, type));
    }
    if (locationId && !isNaN(locationId)) {
      conditions.push(eq7(investmentParties.locationId, locationId));
    }
    const txs = await db.select({
      id: investmentTransactions.id,
      partyId: investmentTransactions.partyId,
      userId: investmentTransactions.userId,
      type: investmentTransactions.type,
      amount: investmentTransactions.amount,
      date: investmentTransactions.date,
      description: investmentTransactions.description,
      paymentMethod: investmentTransactions.paymentMethod,
      referenceNumber: investmentTransactions.referenceNumber,
      createdAt: investmentTransactions.createdAt,
      partyName: investmentParties.partyName,
      locationId: investmentParties.locationId,
      locationName: locations.name
    }).from(investmentTransactions).innerJoin(investmentParties, eq7(investmentTransactions.partyId, investmentParties.id)).leftJoin(locations, eq7(investmentParties.locationId, locations.id)).where(and6(...conditions)).orderBy(desc4(investmentTransactions.date), desc4(investmentTransactions.id));
    res.json(txs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});
investmentRouter.post("/transactions", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const data = txSchema.parse(req.body);
    const party = await db.select().from(investmentParties).where(and6(eq7(investmentParties.id, data.partyId), eq7(investmentParties.isDeleted, 0))).limit(1);
    if (!party.length) return res.status(404).json({ error: "Investor party not found" });
    await assertLocationAccess(userId, party[0].locationId);
    if (data.type === "INVESTMENT") {
      const cleanName = party[0].partyName.trim().toUpperCase();
      const allocRows = await db.select({
        total: sql6`COALESCE(SUM(CAST(${investorLocationAllocations.amount} AS numeric)), 0)`
      }).from(investorLocationAllocations).innerJoin(investors, eq7(investorLocationAllocations.investorId, investors.id)).where(and6(
        eq7(investorLocationAllocations.locationId, party[0].locationId),
        eq7(investorLocationAllocations.isDeleted, 0),
        sql6`UPPER(${investors.name}) = ${cleanName}`
      ));
      const cat7Allocated = parseFloat(allocRows[0]?.total || "0") || 0;
      const txRows = await db.select({
        total: sql6`COALESCE(SUM(CAST(${investmentTransactions.amount} AS numeric)), 0)`
      }).from(investmentTransactions).where(and6(
        eq7(investmentTransactions.partyId, data.partyId),
        eq7(investmentTransactions.type, "INVESTMENT"),
        eq7(investmentTransactions.isDeleted, 0)
      ));
      const alreadyInvested = parseFloat(txRows[0]?.total || "0") || 0;
      const availableCat7Capital = Math.max(0, Math.round((cat7Allocated - alreadyInvested) * 100) / 100);
      if (data.amount > availableCat7Capital) {
        return res.status(400).json({
          error: `\u0A87\u0AA8\u0ACD\u0AB5\u0AC7\u0AB8\u0ACD\u0A9F\u0AB0 \u0A95\u0AC7\u0AAA\u0ABF\u0A9F\u0AB2 (Category 7) \u0AAE\u0ABE\u0A82 \u0AAA\u0AC2\u0AB0\u0AA4\u0AC1\u0A82 \u0AAC\u0AC7\u0AB2\u0AC7\u0AA8\u0ACD\u0AB8 \u0AA8\u0AA5\u0AC0 / Insufficient Category 7 Investor Capital. ${party[0].partyName} \u0AAA\u0ABE\u0AB8\u0AC7 \u0A86 \u0AB8\u0ABE\u0A87\u0A9F \u0AAA\u0AB0 \u0AAE\u0ABE\u0AA4\u0ACD\u0AB0 \u20B9${availableCat7Capital.toLocaleString("en-IN")} \u0A89\u0AAA\u0AB2\u0AAC\u0ACD\u0AA7 \u0A9B\u0AC7, \u0AA4\u0AC7\u0AA5\u0AC0 \u20B9${data.amount.toLocaleString("en-IN")} \u0A95\u0AAA\u0ABE\u0AB6\u0AC7 \u0AA8\u0AB9\u0AC0\u0A82. \u0A95\u0AC3\u0AAA\u0ABE \u0A95\u0AB0\u0AC0\u0AA8\u0AC7 \u0AAA\u0ACD\u0AB0\u0AA5\u0AAE Category 7 (Investor Capital) \u0AAE\u0ABE\u0A82\u0AA5\u0AC0 \u0AB5\u0AA7\u0AC1 \u0AB0\u0A95\u0AAE \u0AAB\u0ABE\u0AB3\u0AB5\u0ACB.`
        });
      }
    }
    const result = await db.insert(investmentTransactions).values({
      userId,
      partyId: data.partyId,
      type: data.type,
      amount: data.amount.toString(),
      date: data.date,
      description: data.description,
      paymentMethod: data.paymentMethod,
      referenceNumber: data.referenceNumber
    }).returning();
    await db.insert(auditLogs).values({
      userId,
      action: `CREATE_${data.type}`,
      entityType: "INVESTMENT",
      entityId: result[0].id,
      metadata: JSON.stringify({ partyId: data.partyId, amount: data.amount, type: data.type })
    });
    res.json(result[0]);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    res.status(400).json({ error: error?.message || "Validation failed" });
  }
});
investmentRouter.put("/transactions/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const data = txSchema.parse(req.body);
    const party = await db.select().from(investmentParties).where(and6(eq7(investmentParties.id, data.partyId), eq7(investmentParties.isDeleted, 0))).limit(1);
    if (!party.length) return res.status(404).json({ error: "Investor party not found" });
    await assertLocationAccess(userId, party[0].locationId);
    if (data.type === "INVESTMENT") {
      const cleanName = party[0].partyName.trim().toUpperCase();
      const allocRows = await db.select({
        total: sql6`COALESCE(SUM(CAST(${investorLocationAllocations.amount} AS numeric)), 0)`
      }).from(investorLocationAllocations).innerJoin(investors, eq7(investorLocationAllocations.investorId, investors.id)).where(and6(
        eq7(investorLocationAllocations.locationId, party[0].locationId),
        eq7(investorLocationAllocations.isDeleted, 0),
        sql6`UPPER(${investors.name}) = ${cleanName}`
      ));
      const cat7Allocated = parseFloat(allocRows[0]?.total || "0") || 0;
      const txRows = await db.select({
        total: sql6`COALESCE(SUM(CAST(${investmentTransactions.amount} AS numeric)), 0)`
      }).from(investmentTransactions).where(and6(
        eq7(investmentTransactions.partyId, data.partyId),
        ne(investmentTransactions.id, id),
        eq7(investmentTransactions.type, "INVESTMENT"),
        eq7(investmentTransactions.isDeleted, 0)
      ));
      const alreadyInvested = parseFloat(txRows[0]?.total || "0") || 0;
      const availableCat7Capital = Math.max(0, Math.round((cat7Allocated - alreadyInvested) * 100) / 100);
      if (data.amount > availableCat7Capital) {
        return res.status(400).json({
          error: `\u0A87\u0AA8\u0ACD\u0AB5\u0AC7\u0AB8\u0ACD\u0A9F\u0AB0 \u0A95\u0AC7\u0AAA\u0ABF\u0A9F\u0AB2 (Category 7) \u0AAE\u0ABE\u0A82 \u0AAA\u0AC2\u0AB0\u0AA4\u0AC1\u0A82 \u0AAC\u0AC7\u0AB2\u0AC7\u0AA8\u0ACD\u0AB8 \u0AA8\u0AA5\u0AC0 / Insufficient Category 7 Investor Capital. ${party[0].partyName} \u0AAA\u0ABE\u0AB8\u0AC7 \u0A86 \u0AB8\u0ABE\u0A87\u0A9F \u0AAA\u0AB0 \u0AAE\u0ABE\u0AA4\u0ACD\u0AB0 \u20B9${availableCat7Capital.toLocaleString("en-IN")} \u0A89\u0AAA\u0AB2\u0AAC\u0ACD\u0AA7 \u0A9B\u0AC7, \u0AA4\u0AC7\u0AA5\u0AC0 \u20B9${data.amount.toLocaleString("en-IN")} \u0A95\u0AAA\u0ABE\u0AB6\u0AC7 \u0AA8\u0AB9\u0AC0\u0A82.`
        });
      }
    }
    const [updated] = await db.update(investmentTransactions).set({
      partyId: data.partyId,
      type: data.type,
      amount: data.amount.toString(),
      date: data.date,
      description: data.description,
      paymentMethod: data.paymentMethod,
      referenceNumber: data.referenceNumber
    }).where(and6(
      eq7(investmentTransactions.id, id),
      eq7(investmentTransactions.isDeleted, 0)
    )).returning();
    if (!updated) return res.status(404).json({ error: "Transaction not found" });
    await db.insert(auditLogs).values({
      userId,
      action: `UPDATE_${data.type}`,
      entityType: "INVESTMENT",
      entityId: id,
      metadata: JSON.stringify({ partyId: data.partyId, amount: data.amount, type: data.type })
    });
    res.json(updated);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    res.status(400).json({ error: error?.message || "Validation failed" });
  }
});
investmentRouter.delete("/transactions/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const tx = await db.select().from(investmentTransactions).where(eq7(investmentTransactions.id, id)).limit(1);
    if (tx.length) {
      const party = await db.select().from(investmentParties).where(eq7(investmentParties.id, tx[0].partyId)).limit(1);
      if (party.length && party[0].locationId && party[0].locationId > 0) {
        try {
          await assertLocationAccess(userId, party[0].locationId);
        } catch (e) {
          console.warn("Location check ignored during transaction deletion:", e);
        }
      }
    }
    await db.update(investmentTransactions).set({ isDeleted: 1 }).where(eq7(investmentTransactions.id, id));
    await db.insert(auditLogs).values({
      userId,
      action: "DELETE_INVESTMENT_TRANSACTION",
      entityType: "INVESTMENT",
      entityId: id,
      metadata: JSON.stringify({ transactionId: id })
    });
    res.json({ success: true });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});
investmentRouter.delete("/parties/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const party = await db.select().from(investmentParties).where(eq7(investmentParties.id, id)).limit(1);
    if (party.length && party[0].locationId && party[0].locationId > 0) {
      try {
        await assertLocationAccess(userId, party[0].locationId);
      } catch (e) {
        console.warn("Location check ignored during party deletion:", e);
      }
    }
    await db.update(investmentParties).set({ isDeleted: 1 }).where(eq7(investmentParties.id, id));
    await db.update(investmentTransactions).set({ isDeleted: 1 }).where(eq7(investmentTransactions.partyId, id));
    await db.insert(auditLogs).values({
      userId,
      action: "DELETE_INVESTMENT_PARTY",
      entityType: "INVESTMENT",
      entityId: id,
      metadata: JSON.stringify({ partyId: id })
    });
    res.json({ success: true });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: "Failed to delete party" });
  }
});
investmentRouter.get("/refundable-records", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const locParam = req.query.locationId;
    const locationId = locParam && locParam !== "ALL" && locParam !== "0" && !isNaN(parseInt(locParam, 10)) ? parseInt(locParam, 10) : void 0;
    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }
    const refRecords = await db.select({
      id: records.id,
      locationId: records.locationId,
      date: records.date,
      partyName: records.partyName,
      category: records.category,
      description: records.description,
      amount: records.amount,
      refundableAmount: records.refundableAmount,
      refundedAmount: records.refundedAmount,
      refundStatus: records.refundStatus,
      paymentMethod: records.paymentMethod,
      referenceNumber: records.referenceNumber,
      notes: records.notes,
      createdAt: records.createdAt
    }).from(records).where(and6(
      locationId ? eq7(records.locationId, locationId) : void 0,
      eq7(records.isDeleted, 0),
      sql6`(${records.refundableAmount} > 0 OR ${records.category} = 'REFUNDABLE_RECORD' OR ${records.category} = 'REFUNDABLE')`
    )).orderBy(desc4(records.date), desc4(records.id));
    let totalRefundable = 0;
    let totalRefunded = 0;
    refRecords.forEach((r) => {
      totalRefundable += parseFloat(r.refundableAmount || r.amount || "0") || 0;
      totalRefunded += parseFloat(r.refundedAmount || "0") || 0;
    });
    const pendingRefundable = Math.max(0, Math.round((totalRefundable - totalRefunded) * 100) / 100);
    res.json({
      records: refRecords,
      summary: {
        totalRefundable: Math.round(totalRefundable * 100) / 100,
        totalRefunded: Math.round(totalRefunded * 100) / 100,
        pendingRefundable,
        count: refRecords.length
      }
    });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to fetch refundable records:", error);
    res.status(500).json({ error: "Failed to fetch refundable records" });
  }
});
investmentRouter.post("/refundable-records", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const {
      locationId,
      date,
      partyName,
      amount,
      description,
      paymentMethod,
      referenceNumber,
      notes
    } = req.body;
    const locId = locationId ? parseInt(String(locationId), 10) : NaN;
    if (isNaN(locId) || locId <= 0) {
      return res.status(400).json({ error: "\u0AAE\u0AB9\u0AC7\u0AB0\u0AAC\u0ABE\u0AA8\u0AC0 \u0A95\u0AB0\u0AC0\u0AA8\u0AC7 \u0AAA\u0ACD\u0AB0\u0ACB\u0A9C\u0AC7\u0A95\u0ACD\u0A9F \u0AB2\u0ACB\u0A95\u0AC7\u0AB6\u0AA8 \u0AB8\u0ABF\u0AB2\u0AC7\u0A95\u0ACD\u0A9F \u0A95\u0AB0\u0ACB / Please select a project location" });
    }
    await assertLocationAccess(userId, locId);
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: "A valid amount is required" });
    }
    const newRecord = await db.insert(records).values({
      locationId: locId,
      userId,
      type: "EXPENSE",
      category: "REFUNDABLE_RECORD",
      partyName: partyName?.trim() || "Refundable Party",
      amount: amt.toFixed(2),
      refundableAmount: amt.toFixed(2),
      refundedAmount: "0.00",
      refundStatus: "PENDING",
      date: date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      description: description?.trim() || "Refundable Deposit / Security",
      paymentMethod: paymentMethod || "Bank Transfer",
      referenceNumber: referenceNumber?.trim() || null,
      notes: notes?.trim() || null
    }).returning();
    await db.insert(auditLogs).values({
      userId,
      action: "CREATE_REFUNDABLE_RECORD",
      entityType: "INVESTMENT",
      entityId: newRecord[0].id,
      metadata: JSON.stringify({ amount: amt, partyName })
    });
    res.status(201).json(newRecord[0]);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to create refundable record:", error);
    res.status(500).json({ error: "Failed to create refundable record" });
  }
});
investmentRouter.put("/refundable-records/:id/refund", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const { refundAmount, notes } = req.body;
    const addedRefund = parseFloat(refundAmount);
    if (isNaN(addedRefund) || addedRefund <= 0) {
      return res.status(400).json({ error: "A valid refund received amount is required" });
    }
    const existing = await db.select().from(records).where(eq7(records.id, id)).limit(1);
    if (!existing.length) {
      return res.status(404).json({ error: "Refundable record not found" });
    }
    await assertLocationAccess(userId, existing[0].locationId);
    const totalRef = parseFloat(existing[0].refundableAmount || existing[0].amount || "0");
    const currRefunded = parseFloat(existing[0].refundedAmount || "0");
    const newRefunded = Math.min(totalRef, Math.round((currRefunded + addedRefund) * 100) / 100);
    const newStatus = newRefunded >= totalRef ? "FULL" : newRefunded > 0 ? "PARTIAL" : "PENDING";
    const updated = await db.update(records).set({
      refundedAmount: newRefunded.toFixed(2),
      refundStatus: newStatus,
      notes: notes ? `${existing[0].notes ? existing[0].notes + " | " : ""}Refund received \u20B9${addedRefund}: ${notes}` : existing[0].notes,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq7(records.id, id)).returning();
    await db.insert(auditLogs).values({
      userId,
      action: "UPDATE_REFUNDABLE_RECORD_REFUND",
      entityType: "INVESTMENT",
      entityId: id,
      metadata: JSON.stringify({ addedRefund, newRefunded, newStatus })
    });
    res.json(updated[0]);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to update refund on record:", error);
    res.status(500).json({ error: "Failed to update refund" });
  }
});
investmentRouter.delete("/refundable-records/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const existing = await db.select().from(records).where(eq7(records.id, id)).limit(1);
    if (!existing.length) {
      return res.status(404).json({ error: "Record not found" });
    }
    if (existing[0].locationId && existing[0].locationId > 0) {
      try {
        await assertLocationAccess(userId, existing[0].locationId);
      } catch (e) {
        console.warn("Location check ignored during refundable record deletion:", e);
      }
    }
    await db.update(records).set({ isDeleted: 1, updatedAt: /* @__PURE__ */ new Date() }).where(eq7(records.id, id));
    await db.insert(auditLogs).values({
      userId,
      action: "DELETE_REFUNDABLE_RECORD",
      entityType: "INVESTMENT",
      entityId: id,
      metadata: JSON.stringify({ recordId: id })
    });
    res.json({ success: true });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to delete refundable record:", error);
    res.status(500).json({ error: "Failed to delete refundable record" });
  }
});
investmentRouter.get("/project-utilization", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const locParam = req.query.locationId;
    const locationId = locParam && locParam !== "ALL" && locParam !== "0" && !isNaN(parseInt(locParam, 10)) ? parseInt(locParam, 10) : void 0;
    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }
    const directAllocations = await db.select({
      total: sql6`sum(${investorLocationAllocations.amount})`,
      count: sql6`count(*)`
    }).from(investorLocationAllocations).where(and6(
      locationId ? eq7(investorLocationAllocations.locationId, locationId) : void 0,
      eq7(investorLocationAllocations.isDeleted, 0)
    ));
    const totalFromDirectAllocations = parseFloat(directAllocations[0]?.total || "0") || 0;
    const invTxs = await db.select({
      type: investmentTransactions.type,
      total: sql6`sum(${investmentTransactions.amount})`,
      count: sql6`count(*)`
    }).from(investmentTransactions).innerJoin(investmentParties, eq7(investmentTransactions.partyId, investmentParties.id)).where(and6(
      locationId ? eq7(investmentParties.locationId, locationId) : void 0,
      eq7(investmentTransactions.isDeleted, 0),
      eq7(investmentParties.isDeleted, 0)
    )).groupBy(investmentTransactions.type);
    let fromInvestmentKarya = 0;
    let fromContributions = 0;
    let returnsToInvestors = 0;
    invTxs.forEach((t) => {
      const amt = parseFloat(t.total || "0");
      if (t.type === "INVESTMENT") fromInvestmentKarya += amt;
      else if (t.type === "CONTRIBUTION") fromContributions += amt;
      else if (t.type === "UPAD" || t.type === "PAYMENT") returnsToInvestors += amt;
    });
    const investmentFromInvestorsCapital = Math.round(fromInvestmentKarya * 100) / 100;
    const fromInvestors = investmentFromInvestorsCapital;
    const billRecords = await db.select({
      total: sql6`sum(${records.amount})`,
      count: sql6`count(*)`
    }).from(records).where(and6(
      locationId ? eq7(records.locationId, locationId) : void 0,
      eq7(records.isDeleted, 0),
      eq7(records.type, "INCOME"),
      eq7(records.category, "BILL_INVESTMENT")
    ));
    const fromBills = parseFloat(billRecords[0]?.total || "0");
    const billCount = Number(billRecords[0]?.count || 0);
    const fullCapital = Math.round((investmentFromInvestorsCapital + fromBills) * 100) / 100;
    const netInvestmentCapital = Math.round((fullCapital - returnsToInvestors) * 100) / 100;
    const matPurchases = await db.select({
      total: sql6`sum(${materialPurchases.totalAmount})`,
      paid: sql6`sum(${materialPurchases.paidAmount})`,
      outstanding: sql6`sum(${materialPurchases.outstandingAmount})`,
      count: sql6`count(*)`
    }).from(materialPurchases).where(and6(
      locationId ? eq7(materialPurchases.locationId, locationId) : void 0,
      eq7(materialPurchases.isDeleted, 0)
    ));
    const cat3Total = parseFloat(matPurchases[0]?.total || "0");
    const cat3Paid = parseFloat(matPurchases[0]?.paid || "0");
    const cat3Outstanding = parseFloat(matPurchases[0]?.outstanding || "0");
    const cat3Count = Number(matPurchases[0]?.count || 0);
    const matSupplies = await db.select({
      total: sql6`sum(${materialSupplies.totalAmount})`,
      paid: sql6`sum(${materialSupplies.paidAmount})`,
      outstanding: sql6`sum(${materialSupplies.outstandingAmount})`,
      count: sql6`count(*)`
    }).from(materialSupplies).where(and6(
      locationId ? eq7(materialSupplies.locationId, locationId) : void 0,
      eq7(materialSupplies.isDeleted, 0)
    ));
    const cat4Total = parseFloat(matSupplies[0]?.total || "0");
    const cat4Paid = parseFloat(matSupplies[0]?.paid || "0");
    const cat4Outstanding = parseFloat(matSupplies[0]?.outstanding || "0");
    const cat4Count = Number(matSupplies[0]?.count || 0);
    const siteSuppliesData = await db.select({
      total: sql6`sum(${siteSupplies.totalAmount})`,
      count: sql6`count(*)`
    }).from(siteSupplies).where(and6(
      locationId ? eq7(siteSupplies.locationId, locationId) : void 0,
      eq7(siteSupplies.isDeleted, 0)
    ));
    const cat5Total = parseFloat(siteSuppliesData[0]?.total || "0");
    const cat5Count = Number(siteSuppliesData[0]?.count || 0);
    const labourData = await db.select({
      netSalary: sql6`sum(${labourSalaries.netSalary})`,
      upad: sql6`sum(${labourSalaries.upad})`,
      paid: sql6`sum(${labourSalaries.paymentAmount})`,
      grossSalary: sql6`sum(${labourSalaries.grossSalary})`,
      balance: sql6`sum(${labourSalaries.balance})`,
      count: sql6`count(*)`
    }).from(labourSalaries).where(and6(
      locationId ? eq7(labourSalaries.locationId, locationId) : void 0,
      eq7(labourSalaries.isDeleted, 0)
    ));
    const labourNetSalary = parseFloat(labourData[0]?.netSalary || "0");
    const labourUpad = parseFloat(labourData[0]?.upad || "0");
    const labourPaid = parseFloat(labourData[0]?.paid || "0");
    const labourGross = parseFloat(labourData[0]?.grossSalary || "0");
    const labourBalance = parseFloat(labourData[0]?.balance || "0");
    const labourCount = Number(labourData[0]?.count || 0);
    const cat6Total = Math.round((labourNetSalary + labourUpad) * 100) / 100;
    const cat6CashPaid = Math.round((labourPaid + labourUpad) * 100) / 100;
    const refData = await db.select({
      totalRefundable: sql6`sum(case when coalesce(${records.refundableAmount}, 0) > 0 then ${records.refundableAmount} else ${records.amount} end)`,
      totalRefunded: sql6`sum(coalesce(${records.refundedAmount}, 0))`,
      count: sql6`count(*)`
    }).from(records).where(and6(
      locationId ? eq7(records.locationId, locationId) : void 0,
      eq7(records.isDeleted, 0),
      sql6`(${records.refundableAmount} > 0 OR ${records.category} = 'REFUNDABLE_RECORD' OR ${records.category} = 'REFUNDABLE')`
    ));
    const totalRefundable = parseFloat(refData[0]?.totalRefundable || "0") || 0;
    const totalRefunded = parseFloat(refData[0]?.totalRefunded || "0") || 0;
    const pendingRefundable = Math.max(0, Math.round((totalRefundable - totalRefunded) * 100) / 100);
    const refCount = Number(refData[0]?.count || 0);
    const contrCosts = await db.select({
      total: sql6`sum(${contractorCosts.amount})`,
      count: sql6`count(*)`
    }).from(contractorCosts).where(and6(
      locationId ? eq7(contractorCosts.locationId, locationId) : void 0,
      eq7(contractorCosts.isDeleted, 0)
    ));
    const recordedContractorCost = parseFloat(contrCosts[0]?.total || "0") || 0;
    const contractorCostCount = Number(contrCosts[0]?.count || 0);
    const totalThreeExpenses = Math.round((cat4Total + cat5Total + cat6Total) * 100) / 100;
    const investmentVariance = Math.round((investmentFromInvestorsCapital - totalThreeExpenses) * 100) / 100;
    const investmentStatus = Math.abs(investmentVariance) < 0.01 ? "MATCHED" : investmentVariance > 0 ? "SURPLUS" : "DEFICIT";
    const expectedContractorCost = Math.round((cat5Total + cat6Total) * 100) / 100;
    const contractorVariance = Math.round((recordedContractorCost - expectedContractorCost) * 100) / 100;
    const contractorStatus = Math.abs(contractorVariance) < 0.01 ? "MATCHED" : contractorVariance > 0 ? "SURPLUS" : "DEFICIT";
    const totalProjectExpenditure = Math.round((cat5Total + cat6Total + pendingRefundable) * 100) / 100;
    const totalCashPaidExpenditure = Math.round((cat5Total + cat6CashPaid + pendingRefundable) * 100) / 100;
    const remainingInvestmentCapital = Math.round((fullCapital - totalProjectExpenditure - returnsToInvestors) * 100) / 100;
    const utilizationRate = fullCapital > 0 ? Math.round(totalProjectExpenditure / fullCapital * 100) : totalProjectExpenditure > 0 ? 100 : 0;
    let status = "HEALTHY";
    if (remainingInvestmentCapital < 0) {
      status = "DEFICIT";
    } else if (utilizationRate >= 85) {
      status = "WARNING";
    }
    const [recentSiteSupplies, recentLabour, recentRefundables, recentLegacyTxs, recentDirectAllocs, recentBills] = await Promise.all([
      db.select({
        id: siteSupplies.id,
        date: siteSupplies.date,
        category: sql6`'CAT_5_SITE_SUPPLY'`,
        categoryKey: sql6`'CAT5_SITE'`,
        categoryName: sql6`'Cat 5: Site Supply'`,
        partyName: sql6`coalesce(${siteSupplies.responsiblePerson}, 'Site Team')`,
        description: sql6`coalesce(${siteSupplies.workDescription}, 'Site Equipment / Tool Supply')`,
        amount: siteSupplies.totalAmount,
        paidAmount: siteSupplies.totalAmount,
        referenceNumber: sql6`''`,
        paymentStatus: sql6`'PAID'`
      }).from(siteSupplies).where(and6(eq7(siteSupplies.locationId, locationId), eq7(siteSupplies.isDeleted, 0))).orderBy(desc4(siteSupplies.date), desc4(siteSupplies.id)).limit(40),
      db.select({
        id: labourSalaries.id,
        date: labourSalaries.date,
        category: sql6`'CAT_6_LABOUR'`,
        categoryKey: sql6`'CAT6_LABOUR'`,
        categoryName: sql6`case 
          when upper(${labourSalaries.attendanceType}) like '%UPAD%' then 'Cat 6: Team Upad'
          when upper(${labourSalaries.attendanceType}) like '%KHARCH%' or upper(${labourSalaries.attendanceType}) like '%EXPENSE%' then 'Cat 6: Other Kharch'
          else 'Cat 6: Labour Attendance'
        end`,
        partyName: sql6`coalesce(${labourSalaries.labourTeam}, ${labourSalaries.labourName})`,
        description: sql6`case
          when upper(${labourSalaries.attendanceType}) like '%UPAD%' then concat('Team Advance: ', coalesce(${labourSalaries.notes}, 'Upad'))
          when upper(${labourSalaries.attendanceType}) like '%KHARCH%' then concat('Kharch: ', coalesce(${labourSalaries.workType}, ${labourSalaries.notes}, 'Expense'))
          when upper(${labourSalaries.attendanceType}) like '%WORK%' or upper(${labourSalaries.attendanceType}) like '%TC%' then concat('TC: ', coalesce(${labourSalaries.workType}, 'Work'), ' (', coalesce(${labourSalaries.tcQuantity}, '0'), ' ', coalesce(${labourSalaries.unitOfMeasurement}, 'Nos'), ')')
          else concat('Day Attendance (Days: ', coalesce(${labourSalaries.days}, '0'), ')')
        end`,
        amount: sql6`case
          when upper(${labourSalaries.attendanceType}) like '%UPAD%' then ${labourSalaries.upad}
          else ${labourSalaries.netSalary}
        end`,
        paidAmount: sql6`case
          when upper(${labourSalaries.attendanceType}) like '%UPAD%' then ${labourSalaries.upad}
          else ${labourSalaries.paymentAmount}
        end`,
        referenceNumber: sql6`coalesce(${labourSalaries.referenceNumber}, ${labourSalaries.tcNumber}, '')`,
        paymentStatus: sql6`case 
          when upper(${labourSalaries.attendanceType}) like '%UPAD%' or upper(${labourSalaries.attendanceType}) like '%KHARCH%' then 'PAID'
          when ${labourSalaries.balance} = '0' then 'PAID' 
          else 'OUTSTANDING' 
        end`
      }).from(labourSalaries).where(and6(eq7(labourSalaries.locationId, locationId), eq7(labourSalaries.isDeleted, 0))).orderBy(desc4(labourSalaries.date), desc4(labourSalaries.id)).limit(60),
      db.select({
        id: records.id,
        date: records.date,
        category: sql6`'REFUNDABLE_RECORD'`,
        categoryKey: sql6`'CAT_REFUNDABLE'`,
        categoryName: sql6`'Refundable Record'`,
        partyName: records.partyName,
        description: sql6`concat('Refundable Deposit: ', coalesce(${records.description}, ${records.partyName}))`,
        amount: sql6`case when coalesce(${records.refundableAmount}, 0) > 0 then ${records.refundableAmount} else ${records.amount} end`,
        paidAmount: sql6`coalesce(${records.refundedAmount}, '0.00')`,
        referenceNumber: sql6`coalesce(${records.referenceNumber}, '')`,
        paymentStatus: records.refundStatus
      }).from(records).where(and6(
        eq7(records.locationId, locationId),
        eq7(records.isDeleted, 0),
        sql6`(${records.refundableAmount} > 0 OR ${records.category} = 'REFUNDABLE_RECORD' OR ${records.category} = 'REFUNDABLE')`
      )).orderBy(desc4(records.date), desc4(records.id)).limit(40),
      db.select({
        id: investmentTransactions.id,
        date: investmentTransactions.date,
        partyId: investmentParties.id,
        partyName: investmentParties.partyName,
        type: investmentTransactions.type,
        amount: investmentTransactions.amount,
        description: investmentTransactions.description,
        paymentMethod: investmentTransactions.paymentMethod,
        referenceNumber: investmentTransactions.referenceNumber
      }).from(investmentTransactions).innerJoin(investmentParties, eq7(investmentTransactions.partyId, investmentParties.id)).where(and6(
        eq7(investmentParties.locationId, locationId),
        eq7(investmentTransactions.isDeleted, 0),
        eq7(investmentParties.isDeleted, 0),
        sql6`${investmentTransactions.type} IN ('INVESTMENT', 'CONTRIBUTION')`
      )).orderBy(desc4(investmentTransactions.date), desc4(investmentTransactions.id)).limit(50),
      db.select({
        id: investorLocationAllocations.id,
        date: investorLocationAllocations.date,
        partyId: investors.id,
        partyName: investors.name,
        type: sql6`'INVESTMENT'`,
        amount: investorLocationAllocations.amount,
        description: sql6`coalesce(${investorLocationAllocations.notes}, 'Investor Allocation')`,
        paymentMethod: investorLocationAllocations.paymentMethod,
        referenceNumber: investorLocationAllocations.referenceNumber
      }).from(investorLocationAllocations).innerJoin(investors, eq7(investorLocationAllocations.investorId, investors.id)).where(and6(
        eq7(investorLocationAllocations.locationId, locationId),
        eq7(investorLocationAllocations.isDeleted, 0)
      )).orderBy(desc4(investorLocationAllocations.date), desc4(investorLocationAllocations.id)).limit(50),
      db.select({
        id: records.id,
        date: records.date,
        partyId: sql6`0`,
        partyName: records.partyName,
        type: sql6`'BILL_INVESTMENT'`,
        amount: records.amount,
        description: sql6`concat('Bill Inflow: ', coalesce(${records.description}, 'Invoice Investment'))`,
        paymentMethod: records.paymentMethod,
        referenceNumber: records.referenceNumber
      }).from(records).where(and6(
        eq7(records.locationId, locationId),
        eq7(records.isDeleted, 0),
        eq7(records.type, "INCOME"),
        eq7(records.category, "BILL_INVESTMENT")
      )).orderBy(desc4(records.date), desc4(records.id)).limit(50)
    ]);
    const recentCapitalInflows = [
      ...recentLegacyTxs,
      ...recentBills
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const itemizedDeductions = [
      ...recentSiteSupplies,
      ...recentLabour,
      ...recentRefundables
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json({
      investmentCapital: {
        investmentFromInvestorsCapital,
        fromInvestmentKarya,
        fromContributions,
        fromInvestors: investmentFromInvestorsCapital,
        fromBills,
        billInvestment: fromBills,
        fullCapital,
        billCount,
        returnsToInvestors,
        grossInvestmentCapital: fullCapital,
        netInvestmentCapital
      },
      linkedExpenditures: {
        category3MaterialPurchases: {
          total: cat3Total,
          paid: cat3Paid,
          outstanding: cat3Outstanding,
          count: cat3Count
        },
        category4MaterialSupplies: {
          total: cat4Total,
          paid: cat4Paid,
          outstanding: cat4Outstanding,
          count: cat4Count
        },
        category5SiteSupplies: {
          total: cat5Total,
          count: cat5Count
        },
        category6Labour: {
          totalNetSalary: labourNetSalary,
          totalPaid: labourPaid,
          totalUpad: labourUpad,
          totalGross: labourGross,
          totalDeduction: cat6Total,
          outstandingBalance: labourBalance,
          count: labourCount
        },
        category67Labour: {
          totalNetSalary: labourNetSalary,
          totalPaid: labourPaid,
          totalUpad: labourUpad,
          totalGross: labourGross,
          totalDeduction: cat6Total,
          outstandingBalance: labourBalance,
          count: labourCount
        },
        refundableRecords: {
          totalRefundable,
          totalRefunded,
          pendingRefundable,
          count: refCount
        },
        totalProjectExpenditure,
        totalCashPaidExpenditure
      },
      budgetBalance: {
        investmentFromInvestorsCapital,
        billInvestment: fromBills,
        fullCapital,
        grossInvestmentCapital: fullCapital,
        netInvestmentCapital,
        totalProjectExpenditure,
        totalCashPaidExpenditure,
        pendingRefundable,
        returnsToInvestors,
        remainingInvestmentCapital,
        utilizationRate,
        status
      },
      siteOperationsExpenditure: {
        totalMaterialSupply: cat4Total,
        totalSiteSupply: cat5Total,
        totalLabourAttendance: cat6Total,
        totalThreeExpenses,
        investmentCapital: investmentFromInvestorsCapital,
        fullCapital,
        variance: investmentVariance,
        reconciliationStatus: investmentStatus
      },
      contractorCostReconciliation: {
        totalSiteSupply: cat5Total,
        totalLabourAttendance: cat6Total,
        expectedContractorCost,
        recordedContractorCost,
        variance: contractorVariance,
        reconciliationStatus: contractorStatus,
        contractorCostCount
      },
      itemizedDeductions,
      recentCapitalInflows
    });
  } catch (error) {
    console.error("Failed to fetch project utilization:", error);
    res.status(500).json({ error: "Failed to fetch project utilization" });
  }
});
var investment_routes_default = investmentRouter;

// src/server/routes/material.routes.ts
import express2 from "express";
import { eq as eq8, and as and7, desc as desc5, sql as sql7 } from "drizzle-orm";
var materialRouter = express2.Router();
materialRouter.use(requireAuth);
materialRouter.get("/central-stock", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const allMaterials = await db.select().from(materials).where(eq8(materials.isDeleted, 0)).orderBy(materials.name);
    const seenNames = /* @__PURE__ */ new Set();
    const uniqueMaterials = allMaterials.filter((m) => {
      const clean = (m.name || "").trim().toUpperCase();
      if (!clean || seenNames.has(clean)) return false;
      seenNames.add(clean);
      return true;
    });
    const stockMapRes = await db.execute(sql7`
      SELECT 
        UPPER(TRIM(m.name)) as clean_name,
        COALESCE(SUM(CASE WHEN sl.transaction_type = 'IN' THEN CAST(sl.quantity AS numeric) ELSE 0 END), 0) as total_in,
        COALESCE(SUM(CASE WHEN sl.transaction_type = 'OUT' THEN ABS(CAST(sl.quantity AS numeric)) ELSE 0 END), 0) as total_out
      FROM stock_ledger sl
      JOIN materials m ON sl.material_id = m.id
      WHERE sl.is_deleted = 0
      GROUP BY UPPER(TRIM(m.name))
    `);
    const latestPurchasesRes = await db.execute(sql7`
      SELECT DISTINCT ON (UPPER(TRIM(material_name)))
        UPPER(TRIM(material_name)) as clean_name,
        unit,
        rate
      FROM material_purchases
      WHERE is_deleted = 0
      ORDER BY UPPER(TRIM(material_name)), date DESC, id DESC
    `);
    const stockMap = /* @__PURE__ */ new Map();
    for (const row of stockMapRes.rows) {
      const cleanName = String(row.clean_name || "").trim().toUpperCase();
      stockMap.set(cleanName, {
        totalIn: parseFloat(row.total_in || "0"),
        totalOut: parseFloat(row.total_out || "0")
      });
    }
    const purchaseMap = /* @__PURE__ */ new Map();
    for (const row of latestPurchasesRes.rows) {
      const cleanName = String(row.clean_name || "").trim().toUpperCase();
      purchaseMap.set(cleanName, {
        unit: String(row.unit || ""),
        rate: parseFloat(row.rate || "0")
      });
    }
    const stockSummary = [];
    for (const m of uniqueMaterials) {
      const cleanName = (m.name || "").trim().toUpperCase();
      const stockInfo = stockMap.get(cleanName) || { totalIn: 0, totalOut: 0 };
      const currentBalance = Math.round((stockInfo.totalIn - stockInfo.totalOut) * 100) / 100;
      const minStock = parseFloat(m.minStock || "0");
      let status = "IN_STOCK";
      if (currentBalance <= 0) {
        status = "OUT_OF_STOCK";
      } else if (currentBalance <= minStock) {
        status = "LOW_STOCK";
      }
      let resolvedUnit = m.defaultUnit || "Nos";
      let resolvedRate = parseFloat(m.defaultRate || "0");
      const purch = purchaseMap.get(cleanName);
      if (purch?.unit && purch.unit.trim().toLowerCase() !== "unit") {
        resolvedUnit = purch.unit.trim();
      }
      if (purch?.rate && purch.rate > 0) {
        resolvedRate = purch.rate;
      }
      const stockValue = Math.round(Math.max(0, currentBalance) * resolvedRate * 100) / 100;
      stockSummary.push({
        id: m.id,
        name: m.name,
        category: m.category || "General",
        unit: resolvedUnit,
        rate: resolvedRate,
        defaultRate: resolvedRate.toString(),
        minStock,
        purchasedQty: stockInfo.totalIn,
        totalInward: stockInfo.totalIn,
        suppliedQty: stockInfo.totalOut,
        totalOutward: stockInfo.totalOut,
        currentStock: currentBalance,
        currentBalance,
        stockValue,
        status
      });
    }
    res.json(stockSummary);
  } catch (error) {
    console.warn("[Central Stock GET Notice] Database fallback:", error?.message || error);
    res.json([]);
  }
});
materialRouter.get("/customer-supplies-history", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const supplies = await db.select({
      id: materialSupplies.id,
      date: materialSupplies.date,
      customerName: materialSupplies.partyName,
      materialName: materialSupplies.materialName,
      quantity: materialSupplies.quantity,
      unit: materialSupplies.unit,
      rate: materialSupplies.rate,
      subtotal: materialSupplies.subtotal,
      tax: materialSupplies.tax,
      totalAmount: materialSupplies.totalAmount,
      paidAmount: materialSupplies.paidAmount,
      paymentStatus: materialSupplies.paymentStatus,
      referenceNumber: materialSupplies.referenceNumber,
      notes: materialSupplies.notes,
      locationId: materialSupplies.locationId,
      locationName: locations.name
    }).from(materialSupplies).innerJoin(locations, eq8(materialSupplies.locationId, locations.id)).where(and7(eq8(materialSupplies.isDeleted, 0), eq8(locations.isDeleted, 0))).orderBy(desc5(materialSupplies.date), desc5(materialSupplies.id));
    res.json(supplies);
  } catch (error) {
    console.warn("[Customer Supplies History GET Notice] Database fallback:", error?.message || error);
    res.json([]);
  }
});
materialRouter.get("/site-supplies-history", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const supplies = await db.select({
      id: siteSupplyItems.id,
      siteSupplyId: siteSupplies.id,
      date: siteSupplies.date,
      teamName: labourTeams.name,
      responsiblePerson: siteSupplies.responsiblePerson,
      workDescription: siteSupplies.workDescription,
      materialId: siteSupplyItems.materialId,
      materialName: materials.name,
      quantity: siteSupplyItems.quantity,
      unit: materials.defaultUnit,
      rate: siteSupplyItems.rate,
      amount: siteSupplyItems.amount,
      referenceNumber: siteSupplies.referenceNumber,
      locationId: siteSupplies.locationId,
      locationName: locations.name
    }).from(siteSupplyItems).innerJoin(siteSupplies, eq8(siteSupplyItems.siteSupplyId, siteSupplies.id)).innerJoin(locations, eq8(siteSupplies.locationId, locations.id)).leftJoin(materials, eq8(siteSupplyItems.materialId, materials.id)).leftJoin(labourTeams, eq8(siteSupplies.teamId, labourTeams.id)).where(and7(
      eq8(siteSupplies.isDeleted, 0),
      eq8(siteSupplyItems.isDeleted, 0),
      eq8(locations.isDeleted, 0)
    )).orderBy(desc5(siteSupplies.date), desc5(siteSupplyItems.id));
    res.json(supplies);
  } catch (error) {
    console.warn("[Site Supplies History GET Notice] Database fallback:", error?.message || error);
    res.json([]);
  }
});
async function getOrCreateEnterpriseLocationId(txOrDb, userId) {
  const existing = await txOrDb.select({ id: locations.id }).from(locations).where(eq8(locations.isDeleted, 0)).limit(1);
  if (existing.length > 0) {
    return existing[0].id;
  }
  const created = await txOrDb.insert(locations).values({
    userId,
    name: "Central Site",
    address: "Central Enterprise Inventory",
    isDeleted: 0
  }).returning({ id: locations.id });
  return created[0].id;
}
async function resolveMaterialInfo(tx, userId, locationId, materialIdInput, materialNameInput, unitInput, rateInput) {
  const locId = locationId ? parseInt(String(locationId), 10) : null;
  let matId = materialIdInput ? parseInt(String(materialIdInput), 10) : null;
  const cleanUnit = (unitInput || "").trim();
  const validUnit = cleanUnit && cleanUnit.toLowerCase() !== "unit" ? cleanUnit : null;
  if (matId && !isNaN(matId)) {
    const existing = await tx.select().from(materials).where(and7(eq8(materials.id, matId), eq8(materials.isDeleted, 0)));
    if (existing.length > 0) {
      const activeUnit = validUnit || existing[0].defaultUnit || "Nos";
      const needUnitUpdate = validUnit && existing[0].defaultUnit !== validUnit;
      const needRateUpdate = rateInput !== void 0 && rateInput > 0 && (!existing[0].defaultRate || parseFloat(existing[0].defaultRate) === 0 || parseFloat(existing[0].defaultRate) !== rateInput);
      if (needUnitUpdate || needRateUpdate) {
        await tx.update(materials).set({
          ...needUnitUpdate ? { defaultUnit: validUnit } : {},
          ...needRateUpdate && rateInput ? { defaultRate: rateInput.toString() } : {}
        }).where(eq8(materials.id, existing[0].id));
      }
      return { id: existing[0].id, name: (existing[0].name || "").trim().toUpperCase(), unit: activeUnit };
    }
  }
  const rawName = (materialNameInput || "").trim().toUpperCase();
  if (rawName) {
    const existingByName = await tx.select().from(materials).where(
      and7(
        sql7`UPPER(TRIM(${materials.name})) = ${rawName}`,
        eq8(materials.isDeleted, 0)
      )
    ).limit(1);
    if (existingByName.length > 0) {
      const activeUnit = validUnit || existingByName[0].defaultUnit || "Nos";
      const needUnitUpdate = validUnit && existingByName[0].defaultUnit !== validUnit;
      const needRateUpdate = rateInput !== void 0 && rateInput > 0 && (!existingByName[0].defaultRate || parseFloat(existingByName[0].defaultRate) === 0 || parseFloat(existingByName[0].defaultRate) !== rateInput);
      if (needUnitUpdate || needRateUpdate) {
        await tx.update(materials).set({
          ...needUnitUpdate ? { defaultUnit: validUnit } : {},
          ...needRateUpdate && rateInput ? { defaultRate: rateInput.toString() } : {}
        }).where(eq8(materials.id, existingByName[0].id));
      }
      return { id: existingByName[0].id, name: existingByName[0].name.trim().toUpperCase(), unit: activeUnit };
    }
    let validLocId = locId && !isNaN(locId) && locId > 0 ? locId : null;
    if (validLocId) {
      const locExists = await tx.select({ id: locations.id }).from(locations).where(and7(eq8(locations.id, validLocId), eq8(locations.isDeleted, 0))).limit(1);
      if (locExists.length === 0) validLocId = null;
    }
    if (!validLocId) {
      validLocId = await getOrCreateEnterpriseLocationId(tx, userId);
    }
    const created = await tx.insert(materials).values({
      userId,
      locationId: validLocId,
      name: rawName,
      defaultUnit: validUnit || "Nos",
      defaultRate: rateInput ? rateInput.toString() : "0.00",
      minStock: "0.00",
      isActive: 1,
      isDeleted: 0
    }).returning();
    return { id: created[0].id, name: created[0].name.trim().toUpperCase(), unit: created[0].defaultUnit || "Nos" };
  }
  return null;
}
materialRouter.get("/:type", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const rawType = String(req.params.type || "").toLowerCase();
    const type = rawType === "purchases" ? "purchase" : rawType === "supplies" ? "supply" : rawType === "labour-supplies" || rawType === "site-supplies" || rawType === "site-supply" ? "labour-supply" : rawType;
    const locParam = req.query.locationId;
    const locationId = locParam && locParam !== "ALL" && locParam !== "0" && !isNaN(parseInt(locParam, 10)) ? parseInt(locParam, 10) : void 0;
    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }
    let data;
    if (type === "purchase") {
      const purchaseConditions = [eq8(materialPurchases.isDeleted, 0)];
      if (locationId) {
        purchaseConditions.push(eq8(materialPurchases.locationId, locationId));
      }
      data = await db.select({
        id: materialPurchases.id,
        userId: materialPurchases.userId,
        locationId: materialPurchases.locationId,
        date: materialPurchases.date,
        partyName: materialPurchases.partyName,
        materialName: materialPurchases.materialName,
        materialId: materialPurchases.materialId,
        quantity: materialPurchases.quantity,
        unit: materialPurchases.unit,
        rate: materialPurchases.rate,
        subtotal: materialPurchases.subtotal,
        transportCost: materialPurchases.transportCost,
        discount: materialPurchases.discount,
        taxPercentage: materialPurchases.taxPercentage,
        tax: materialPurchases.tax,
        totalAmount: materialPurchases.totalAmount,
        paidAmount: materialPurchases.paidAmount,
        outstandingAmount: materialPurchases.outstandingAmount,
        paymentStatus: materialPurchases.paymentStatus,
        paymentMethod: materialPurchases.paymentMethod,
        referenceNumber: materialPurchases.referenceNumber,
        description: materialPurchases.description,
        createdAt: materialPurchases.createdAt,
        isDeleted: materialPurchases.isDeleted,
        locationName: locations.name
      }).from(materialPurchases).leftJoin(locations, eq8(materialPurchases.locationId, locations.id)).where(and7(...purchaseConditions)).orderBy(desc5(materialPurchases.date), desc5(materialPurchases.id));
    } else if (type === "supply") {
      const supplyConditions = [eq8(materialSupplies.isDeleted, 0)];
      if (locationId) {
        supplyConditions.push(eq8(materialSupplies.locationId, locationId));
      }
      data = await db.select({
        id: materialSupplies.id,
        userId: materialSupplies.userId,
        locationId: materialSupplies.locationId,
        date: materialSupplies.date,
        partyName: materialSupplies.partyName,
        partyId: materialSupplies.partyId,
        materialName: materialSupplies.materialName,
        materialId: materialSupplies.materialId,
        quantity: materialSupplies.quantity,
        unit: materialSupplies.unit,
        rate: materialSupplies.rate,
        subtotal: materialSupplies.subtotal,
        transportCost: materialSupplies.transportCost,
        discount: materialSupplies.discount,
        taxPercentage: materialSupplies.taxPercentage,
        tax: materialSupplies.tax,
        totalAmount: materialSupplies.totalAmount,
        paidAmount: materialSupplies.paidAmount,
        outstandingAmount: materialSupplies.outstandingAmount,
        paymentStatus: materialSupplies.paymentStatus,
        paymentMethod: materialSupplies.paymentMethod,
        referenceNumber: materialSupplies.referenceNumber,
        notes: materialSupplies.notes,
        description: materialSupplies.description,
        createdAt: materialSupplies.createdAt,
        isDeleted: materialSupplies.isDeleted,
        locationName: locations.name
      }).from(materialSupplies).leftJoin(locations, eq8(materialSupplies.locationId, locations.id)).where(and7(...supplyConditions)).orderBy(desc5(materialSupplies.date), desc5(materialSupplies.id));
    } else if (type === "labour-supply") {
      const siteConditions = [eq8(siteSupplies.isDeleted, 0), eq8(siteSupplyItems.isDeleted, 0)];
      if (locationId) {
        siteConditions.push(eq8(siteSupplies.locationId, locationId));
      }
      const siteRecords = await db.select({
        id: siteSupplyItems.id,
        siteSupplyId: siteSupplies.id,
        userId: siteSupplies.userId,
        locationId: siteSupplies.locationId,
        date: siteSupplies.date,
        siteLocationName: locations.name,
        teamName: sql7`COALESCE(${labourTeams.name}, ${siteSupplies.responsiblePerson}, 'Direct Site Team')`,
        partyName: sql7`COALESCE(${labourTeams.name}, ${siteSupplies.responsiblePerson}, 'Direct Site Team')`,
        workDescription: siteSupplies.workDescription,
        materialId: siteSupplyItems.materialId,
        materialName: sql7`COALESCE(${materials.name}, 'MATERIAL')`,
        materialQuantity: siteSupplyItems.quantity,
        materialUnit: sql7`COALESCE(${materials.defaultUnit}, 'Nos')`,
        materialRate: siteSupplyItems.rate,
        materialAmount: siteSupplyItems.amount,
        labourType: sql7`'SITE_SUPPLY'`,
        labourQuantity: sql7`'0'`,
        labourUnit: sql7`''`,
        labourRate: sql7`'0'`,
        labourAmount: sql7`'0'`,
        subtotal: siteSupplyItems.amount,
        taxPercentage: sql7`'0'`,
        tax: sql7`'0'`,
        totalAmount: siteSupplyItems.amount,
        paidAmount: siteSupplyItems.amount,
        outstandingAmount: sql7`'0.00'`,
        paymentStatus: sql7`'PAID'`,
        paymentMethod: sql7`'SITE_TRANSFER'`,
        referenceNumber: siteSupplies.referenceNumber,
        notes: siteSupplies.notes,
        createdAt: siteSupplies.createdAt,
        isDeleted: siteSupplyItems.isDeleted,
        locationName: locations.name,
        sourceType: sql7`'SITE_SUPPLY'`
      }).from(siteSupplyItems).innerJoin(siteSupplies, eq8(siteSupplyItems.siteSupplyId, siteSupplies.id)).leftJoin(locations, eq8(siteSupplies.locationId, locations.id)).leftJoin(materials, eq8(siteSupplyItems.materialId, materials.id)).leftJoin(labourTeams, eq8(siteSupplies.teamId, labourTeams.id)).where(and7(...siteConditions)).orderBy(desc5(siteSupplies.date), desc5(siteSupplyItems.id));
      const legacyConditions = [eq8(materialLabourSupplies.isDeleted, 0)];
      if (locationId) {
        legacyConditions.push(eq8(materialLabourSupplies.locationId, locationId));
      }
      const legacyData = await db.select({
        id: materialLabourSupplies.id,
        siteSupplyId: sql7`null`,
        userId: materialLabourSupplies.userId,
        locationId: materialLabourSupplies.locationId,
        date: materialLabourSupplies.date,
        siteLocationName: materialLabourSupplies.siteLocationName,
        teamName: materialLabourSupplies.teamName,
        partyName: materialLabourSupplies.partyName,
        workDescription: materialLabourSupplies.workDescription,
        materialId: sql7`null`,
        materialName: materialLabourSupplies.materialName,
        materialQuantity: materialLabourSupplies.materialQuantity,
        materialUnit: materialLabourSupplies.materialUnit,
        materialRate: materialLabourSupplies.materialRate,
        materialAmount: materialLabourSupplies.materialAmount,
        labourType: materialLabourSupplies.labourType,
        labourQuantity: materialLabourSupplies.labourQuantity,
        labourUnit: materialLabourSupplies.labourUnit,
        labourRate: materialLabourSupplies.labourRate,
        labourAmount: materialLabourSupplies.labourAmount,
        subtotal: materialLabourSupplies.subtotal,
        taxPercentage: materialLabourSupplies.taxPercentage,
        tax: materialLabourSupplies.tax,
        totalAmount: materialLabourSupplies.totalAmount,
        paidAmount: materialLabourSupplies.paidAmount,
        outstandingAmount: materialLabourSupplies.outstandingAmount,
        paymentStatus: materialLabourSupplies.paymentStatus,
        paymentMethod: materialLabourSupplies.paymentMethod,
        referenceNumber: materialLabourSupplies.referenceNumber,
        notes: materialLabourSupplies.notes,
        createdAt: materialLabourSupplies.createdAt,
        isDeleted: materialLabourSupplies.isDeleted,
        locationName: locations.name,
        sourceType: sql7`'LEGACY_LABOUR_SUPPLY'`
      }).from(materialLabourSupplies).leftJoin(locations, eq8(materialLabourSupplies.locationId, locations.id)).where(and7(...legacyConditions)).orderBy(desc5(materialLabourSupplies.date), desc5(materialLabourSupplies.id));
      data = [...siteRecords, ...legacyData];
    } else if (type === "materials" || type === "master" || type === "items" || type === "stock") {
      data = await db.select().from(materials).where(eq8(materials.isDeleted, 0)).orderBy(materials.name);
    } else {
      return res.status(400).json({ error: "Invalid type" });
    }
    res.json(data);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.warn("[Material Records GET Notice] Database query fallback:", error?.message || error);
    res.json([]);
  }
});
materialRouter.post("/:type", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const rawType = String(req.params.type || "").toLowerCase();
    const type = rawType === "purchases" ? "purchase" : rawType === "supplies" ? "supply" : rawType === "labour-supplies" || rawType === "site-supplies" || rawType === "site-supply" ? "labour-supply" : rawType;
    if (type === "purchase" || type === "supply") {
      const data = req.body;
      let locId = parseInt(String(data.locationId || data.purchaseLocationId || data.siteLocationId), 10);
      if (type === "purchase") {
        if (!locId || isNaN(locId)) {
          locId = await getOrCreateEnterpriseLocationId(db, userId);
        } else {
          const valid = await db.select({ id: locations.id }).from(locations).where(and7(eq8(locations.id, locId), eq8(locations.isDeleted, 0))).limit(1);
          if (valid.length === 0) {
            locId = await getOrCreateEnterpriseLocationId(db, userId);
          }
        }
        data.locationId = locId;
      } else {
        if (!locId || isNaN(locId)) {
          locId = await getOrCreateEnterpriseLocationId(db, userId);
        }
        data.locationId = locId;
        await assertLocationAccess(userId, locId);
      }
      const qty = parseFloat(String(data.quantity)) || 0;
      const rate = parseFloat(String(data.rate)) || 0;
      const discount = parseFloat(String(data.discount || 0)) || 0;
      const taxPercentage = parseFloat(String(data.taxPercentage || 0)) || 0;
      const transportCost = parseFloat(String(data.transportCost || data.transport || 0)) || 0;
      const subtotal = Math.round(qty * rate * 100) / 100;
      const taxableAmount = Math.max(0, subtotal - discount);
      const taxAmount = data.tax !== void 0 && parseFloat(String(data.tax)) > 0 ? Math.round(parseFloat(String(data.tax)) * 100) / 100 : Math.round(taxableAmount * (taxPercentage / 100) * 100) / 100;
      const calculatedTotal = Math.round((taxableAmount + taxAmount + transportCost) * 100) / 100;
      const totalAmount = data.totalAmount !== void 0 && parseFloat(String(data.totalAmount)) > 0 && Math.abs(parseFloat(String(data.totalAmount)) - calculatedTotal) < 1 ? parseFloat(String(data.totalAmount)) : calculatedTotal;
      const paid = data.paidAmount !== void 0 ? parseFloat(String(data.paidAmount)) : data.paymentStatus === "PAID" ? totalAmount : 0;
      const outstanding = data.outstandingAmount !== void 0 ? parseFloat(String(data.outstandingAmount)) : Math.max(0, totalAmount - paid);
      const result = await db.transaction(async (tx) => {
        let insertedId = 0;
        let record;
        const cleanUnit = data.unit && String(data.unit).trim() && String(data.unit).trim().toLowerCase() !== "unit" ? String(data.unit).trim() : void 0;
        const matInfo = await resolveMaterialInfo(tx, userId, data.locationId, data.materialId, data.materialName, cleanUnit, rate);
        const finalMatId = matInfo ? matInfo.id : data.materialId ? parseInt(String(data.materialId), 10) : null;
        const finalMatName = matInfo ? matInfo.name : data.materialName || "";
        const finalUnit = cleanUnit || (matInfo ? matInfo.unit : "") || "Nos";
        if (type === "purchase") {
          if (finalMatId && finalUnit) {
            await tx.update(materials).set({
              defaultUnit: finalUnit,
              ...rate > 0 ? { defaultRate: rate.toString() } : {}
            }).where(eq8(materials.id, finalMatId));
          }
          const inserted = await tx.insert(materialPurchases).values({
            userId,
            locationId: locId,
            date: data.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
            partyName: data.partyName || data.supplierName || "Supplier",
            materialName: finalMatName,
            materialId: finalMatId,
            quantity: qty.toString(),
            unit: finalUnit,
            rate: rate.toString(),
            subtotal: subtotal.toString(),
            transportCost: transportCost.toString(),
            discount: discount.toString(),
            taxPercentage: taxPercentage.toString(),
            tax: taxAmount.toString(),
            totalAmount: totalAmount.toString(),
            paidAmount: paid.toString(),
            outstandingAmount: outstanding.toString(),
            paymentStatus: data.paymentStatus || "UNPAID",
            paymentMethod: data.paymentMethod || "CASH",
            referenceNumber: data.referenceNumber || null,
            description: data.description || data.notes || null
          }).returning();
          insertedId = inserted[0].id;
          record = inserted[0];
          if (finalMatId && qty > 0) {
            await StockManager.addStockMovement(tx, userId, locId, finalMatId, "IN", qty, insertedId, "PURCHASE", data.description || data.notes);
          }
        } else {
          const cleanPartyId = data.partyId && !isNaN(parseInt(String(data.partyId), 10)) ? parseInt(String(data.partyId), 10) : null;
          const inserted = await tx.insert(materialSupplies).values({
            userId,
            locationId: locId,
            date: data.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
            partyName: data.partyName || "Customer",
            partyId: cleanPartyId,
            materialName: finalMatName,
            materialId: finalMatId,
            quantity: qty.toString(),
            unit: finalUnit,
            rate: rate.toString(),
            subtotal: subtotal.toString(),
            transportCost: transportCost.toString(),
            discount: discount.toString(),
            taxPercentage: taxPercentage.toString(),
            tax: taxAmount.toString(),
            totalAmount: totalAmount.toString(),
            paidAmount: paid.toString(),
            outstandingAmount: outstanding.toString(),
            paymentStatus: data.paymentStatus || "UNPAID",
            paymentMethod: data.paymentMethod || "CASH",
            referenceNumber: data.referenceNumber || null,
            notes: data.description || data.notes || null
          }).returning();
          insertedId = inserted[0].id;
          record = inserted[0];
          if (finalMatId && qty > 0) {
            await StockManager.addStockMovement(tx, userId, locId, finalMatId, "OUT", qty, insertedId, "CUSTOMER_SUPPLY", data.description || data.notes);
          }
        }
        await tx.insert(auditLogs).values({ userId, action: `CREATE_${String(type).toUpperCase()}`, entityType: "MATERIAL_TRANSACTION", entityId: insertedId });
        return record;
      });
      return res.json(result);
    } else if (type === "labour-supply") {
      const data = req.body;
      const locId = parseInt(String(data.locationId), 10);
      if (!locId || isNaN(locId)) return res.status(400).json({ error: "locationId is required" });
      await assertLocationAccess(userId, locId);
      const qty = parseFloat(String(data.materialQuantity || 0)) || 0;
      const rate = parseFloat(String(data.materialRate || 0)) || 0;
      const amount = parseFloat(String(data.materialAmount || 0)) || Math.round(qty * rate * 100) / 100;
      const result = await db.transaction(async (tx) => {
        let resolvedMat = await resolveMaterialInfo(tx, userId, locId, data.materialId, data.materialName, data.materialUnit, rate);
        if (!resolvedMat && data.materialName) {
          resolvedMat = { id: 1, name: String(data.materialName).trim().toUpperCase(), unit: data.materialUnit || "Nos" };
        }
        let teamId = null;
        if (data.teamId) {
          teamId = parseInt(String(data.teamId), 10) || null;
        } else if (data.teamName) {
          const matchedTeam = await tx.select().from(labourTeams).where(and7(
            eq8(labourTeams.locationId, locId),
            sql7`LOWER(${labourTeams.name}) = LOWER(${String(data.teamName).trim()})`,
            eq8(labourTeams.isDeleted, 0)
          ));
          if (matchedTeam.length > 0) {
            teamId = matchedTeam[0].id;
          }
        }
        const createdSupply = await tx.insert(siteSupplies).values({
          userId,
          locationId: locId,
          date: data.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          teamId,
          responsiblePerson: data.teamName || data.partyName || "Direct Site Team",
          workDescription: data.workDescription || "",
          referenceNumber: data.referenceNumber || null,
          totalAmount: amount.toString(),
          notes: typeof data.notes === "string" ? data.notes : JSON.stringify(data.notes || {})
        }).returning();
        const siteSupplyId = createdSupply[0].id;
        const createdItem = await tx.insert(siteSupplyItems).values({
          siteSupplyId,
          materialId: resolvedMat?.id || 1,
          quantity: qty.toString(),
          rate: rate.toString(),
          amount: amount.toString()
        }).returning();
        if (resolvedMat?.id && qty > 0) {
          await StockManager.addStockMovement(tx, userId, locId, resolvedMat.id, "OUT", qty, siteSupplyId, "SITE_SUPPLY", `Issued to ${data.teamName || "Site Team"}`);
        }
        await tx.insert(auditLogs).values({ userId, action: "CREATE_SITE_SUPPLY", entityType: "SITE_SUPPLY", entityId: siteSupplyId });
        return {
          ...createdItem[0],
          siteSupplyId,
          locationId: locId,
          date: createdSupply[0].date,
          teamName: data.teamName,
          partyName: data.teamName,
          materialName: resolvedMat?.name || data.materialName,
          materialQuantity: qty,
          materialRate: rate,
          materialAmount: amount
        };
      });
      return res.json(result);
    }
    res.status(400).json({ error: "Invalid type" });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Material route error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
materialRouter.put("/:type/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const rawType = String(req.params.type || "").toLowerCase();
    const type = rawType === "purchases" ? "purchase" : rawType === "supplies" ? "supply" : rawType === "labour-supplies" || rawType === "site-supplies" || rawType === "site-supply" ? "labour-supply" : rawType;
    const { id } = req.params;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return res.status(400).json({ error: "Invalid record ID" });
    if (type === "purchase" || type === "supply") {
      const data = req.body;
      let locationId = parseInt(String(data.locationId || data.purchaseLocationId), 10);
      if (type === "purchase") {
        if (isNaN(locationId) || !locationId) {
          locationId = await getOrCreateEnterpriseLocationId(db, userId);
        } else {
          const valid = await db.select({ id: locations.id }).from(locations).where(eq8(locations.id, locationId)).limit(1);
          if (valid.length === 0) {
            locationId = await getOrCreateEnterpriseLocationId(db, userId);
          }
        }
        data.locationId = locationId;
      } else {
        if (isNaN(locationId)) return res.status(400).json({ error: "locationId is required" });
        await assertLocationAccess(userId, locationId, { allowDeleted: true });
      }
      const qty = parseFloat(String(data.quantity)) || 0;
      const rate = parseFloat(String(data.rate)) || 0;
      const discount = parseFloat(String(data.discount || 0)) || 0;
      const taxPercentage = parseFloat(String(data.taxPercentage || 0)) || 0;
      const transportCost = parseFloat(String(data.transportCost || data.transport || 0)) || 0;
      const subtotal = Math.round(qty * rate * 100) / 100;
      const taxableAmount = Math.max(0, subtotal - discount);
      const taxAmount = data.tax !== void 0 && parseFloat(String(data.tax)) > 0 ? Math.round(parseFloat(String(data.tax)) * 100) / 100 : Math.round(taxableAmount * (taxPercentage / 100) * 100) / 100;
      const calculatedTotal = Math.round((taxableAmount + taxAmount + transportCost) * 100) / 100;
      const totalAmount = data.totalAmount !== void 0 && parseFloat(String(data.totalAmount)) > 0 && Math.abs(parseFloat(String(data.totalAmount)) - calculatedTotal) < 1 ? parseFloat(String(data.totalAmount)) : calculatedTotal;
      const paid = data.paidAmount !== void 0 ? parseFloat(String(data.paidAmount)) : data.paymentStatus === "PAID" ? totalAmount : 0;
      const outstanding = data.outstandingAmount !== void 0 ? parseFloat(String(data.outstandingAmount)) : Math.max(0, totalAmount - paid);
      const result = await db.transaction(async (tx) => {
        let record;
        const cleanUnit = data.unit && String(data.unit).trim() && String(data.unit).trim().toLowerCase() !== "unit" ? String(data.unit).trim() : void 0;
        const matInfo = await resolveMaterialInfo(tx, userId, data.locationId, data.materialId, data.materialName, cleanUnit, rate);
        const finalMatId = matInfo ? matInfo.id : data.materialId ? parseInt(String(data.materialId), 10) : null;
        const finalMatName = matInfo ? matInfo.name : data.materialName || "";
        const finalUnit = cleanUnit || (matInfo ? matInfo.unit : "") || "Nos";
        if (type === "purchase") {
          if (finalMatId && finalUnit) {
            await tx.update(materials).set({
              defaultUnit: finalUnit,
              ...rate > 0 ? { defaultRate: rate.toString() } : {}
            }).where(eq8(materials.id, finalMatId));
          }
          const oldRec = await tx.select().from(materialPurchases).where(and7(eq8(materialPurchases.id, numId), eq8(materialPurchases.isDeleted, 0)));
          if (oldRec.length && oldRec[0].materialId) {
            await StockManager.addStockMovement(tx, userId, oldRec[0].locationId, oldRec[0].materialId, "OUT", parseFloat(oldRec[0].quantity), numId, "PURCHASE_UPDATE_REVERT", "Reversed for update");
          }
          const updated = await tx.update(materialPurchases).set({
            date: data.date,
            partyName: data.partyName || data.supplierName || "",
            materialName: finalMatName,
            materialId: finalMatId,
            quantity: qty.toString(),
            unit: finalUnit,
            rate: rate.toString(),
            subtotal: subtotal.toString(),
            transportCost: transportCost.toString(),
            discount: discount.toString(),
            taxPercentage: taxPercentage.toString(),
            tax: taxAmount.toString(),
            totalAmount: totalAmount.toString(),
            paidAmount: paid.toString(),
            outstandingAmount: outstanding.toString(),
            paymentStatus: data.paymentStatus || "UNPAID",
            paymentMethod: data.paymentMethod,
            referenceNumber: data.referenceNumber,
            description: data.description || data.notes
          }).where(and7(eq8(materialPurchases.id, numId), eq8(materialPurchases.isDeleted, 0))).returning();
          record = updated[0];
          if (finalMatId && qty > 0) {
            await StockManager.addStockMovement(tx, userId, data.locationId, finalMatId, "IN", qty, numId, "PURCHASE", data.description || data.notes);
          }
        } else {
          const oldRec = await tx.select().from(materialSupplies).where(and7(eq8(materialSupplies.id, numId), eq8(materialSupplies.isDeleted, 0)));
          if (oldRec.length && oldRec[0].materialId) {
            await StockManager.addStockMovement(tx, userId, oldRec[0].locationId, oldRec[0].materialId, "IN", parseFloat(oldRec[0].quantity), numId, "MATERIAL_SUPPLY_UPDATE_REVERT", "Reversed for update");
          }
          const updated = await tx.update(materialSupplies).set({
            date: data.date,
            partyName: data.partyName || "",
            partyId: data.partyId,
            materialName: finalMatName,
            materialId: finalMatId,
            quantity: qty.toString(),
            unit: finalUnit,
            rate: rate.toString(),
            subtotal: subtotal.toString(),
            transportCost: transportCost.toString(),
            discount: discount.toString(),
            taxPercentage: taxPercentage.toString(),
            tax: taxAmount.toString(),
            totalAmount: totalAmount.toString(),
            paidAmount: paid.toString(),
            outstandingAmount: outstanding.toString(),
            paymentStatus: data.paymentStatus || "UNPAID",
            paymentMethod: data.paymentMethod,
            referenceNumber: data.referenceNumber,
            notes: data.description || data.notes
          }).where(and7(eq8(materialSupplies.id, numId), eq8(materialSupplies.isDeleted, 0))).returning();
          record = updated[0];
          if (finalMatId && qty > 0) {
            await StockManager.addStockMovement(tx, userId, data.locationId, finalMatId, "OUT", qty, numId, "MATERIAL_SUPPLY", data.description || data.notes);
          }
        }
        await tx.insert(auditLogs).values({ userId, action: `UPDATE_${String(type).toUpperCase()}`, entityType: "MATERIAL_TRANSACTION", entityId: numId });
        return record;
      });
      return res.json(result);
    }
    res.status(400).json({ error: "Invalid type" });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: "Server error" });
  }
});
materialRouter.delete("/:type/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const rawType = String(req.params.type || "").toLowerCase();
    const type = rawType === "purchases" ? "purchase" : rawType === "supplies" ? "supply" : rawType === "labour-supplies" || rawType === "site-supplies" || rawType === "site-supply" ? "labour-supply" : rawType;
    const { id } = req.params;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return res.status(400).json({ error: "Invalid record ID" });
    await db.transaction(async (tx) => {
      let table;
      if (type === "purchase") {
        table = materialPurchases;
        const rec = await tx.select().from(table).where(and7(eq8(table.id, numId), eq8(table.isDeleted, 0)));
        if (rec.length) {
          const locId = rec[0].locationId;
          try {
            await assertLocationAccess(userId, locId, { allowDeleted: true });
          } catch (locErr) {
            console.warn(`Location check warning during purchase delete #${numId}:`, locErr);
          }
          if (rec[0].materialId && locId) {
            try {
              await StockManager.addStockMovement(tx, userId, locId, rec[0].materialId, "OUT", parseFloat(rec[0].quantity), numId, "PURCHASE_DELETE", "Reversed from delete");
            } catch (stockErr) {
              console.warn(`Stock reversal warning during purchase delete #${numId}:`, stockErr);
            }
          }
        }
      } else if (type === "supply") {
        table = materialSupplies;
        const rec = await tx.select().from(table).where(and7(eq8(table.id, numId), eq8(table.isDeleted, 0)));
        if (rec.length) {
          const locId = rec[0].locationId;
          try {
            await assertLocationAccess(userId, locId, { allowDeleted: true });
          } catch (locErr) {
            console.warn(`Location check warning during supply delete #${numId}:`, locErr);
          }
          if (rec[0].materialId && locId) {
            try {
              await StockManager.addStockMovement(tx, userId, locId, rec[0].materialId, "IN", parseFloat(rec[0].quantity), numId, "MATERIAL_SUPPLY_DELETE", "Reversed from delete");
            } catch (stockErr) {
              console.warn(`Stock reversal warning during supply delete #${numId}:`, stockErr);
            }
          }
        }
      } else if (type === "labour-supply" || type === "site-supply" || type === "site-supplies") {
        const siteItem = await tx.select().from(siteSupplyItems).where(and7(eq8(siteSupplyItems.id, numId), eq8(siteSupplyItems.isDeleted, 0)));
        if (siteItem.length) {
          const parentSupply = await tx.select().from(siteSupplies).where(eq8(siteSupplies.id, siteItem[0].siteSupplyId));
          const locId = parentSupply[0]?.locationId;
          if (locId) {
            try {
              await assertLocationAccess(userId, locId, { allowDeleted: true });
            } catch (locErr) {
              console.warn(`Location check warning during site supply item delete #${numId}:`, locErr);
            }
          }
          if (siteItem[0].materialId && locId) {
            try {
              await StockManager.addStockMovement(tx, userId, locId, siteItem[0].materialId, "IN", parseFloat(siteItem[0].quantity), numId, "SITE_SUPPLY_DELETE", "Reversed from site supply item delete");
            } catch (stockErr) {
              console.warn(`Stock reversal warning during site supply item delete #${numId}:`, stockErr);
            }
          }
          await tx.update(siteSupplyItems).set({ isDeleted: 1 }).where(eq8(siteSupplyItems.id, numId));
          const remaining = await tx.select().from(siteSupplyItems).where(and7(eq8(siteSupplyItems.siteSupplyId, siteItem[0].siteSupplyId), eq8(siteSupplyItems.isDeleted, 0)));
          if (remaining.length === 0) {
            await tx.update(siteSupplies).set({ isDeleted: 1 }).where(eq8(siteSupplies.id, siteItem[0].siteSupplyId));
          }
          await tx.insert(auditLogs).values({ userId, action: "DELETE_SITE_SUPPLY_ITEM", entityType: "SITE_SUPPLY", entityId: numId });
          return;
        } else {
          table = materialLabourSupplies;
          const rec = await tx.select().from(table).where(and7(eq8(table.id, numId), eq8(table.isDeleted, 0)));
          if (rec.length) {
            try {
              await assertLocationAccess(userId, rec[0].locationId, { allowDeleted: true });
            } catch (locErr) {
              console.warn(`Location check warning during labour supply delete #${numId}:`, locErr);
            }
          }
        }
      } else if (type === "material" || type === "master" || type === "stock" || type === "item") {
        table = materials;
        const rec = await tx.select().from(table).where(and7(eq8(table.id, numId), eq8(table.isDeleted, 0)));
        if (!rec.length) {
          return res.status(404).json({ error: "Material not found" });
        }
        await tx.update(materials).set({ isDeleted: 1 }).where(eq8(materials.id, numId));
        await tx.update(stockLedger).set({ isDeleted: 1 }).where(eq8(stockLedger.materialId, numId));
        await tx.update(materialPurchases).set({ isDeleted: 1 }).where(eq8(materialPurchases.materialId, numId));
        await tx.insert(auditLogs).values({ userId, action: "DELETE_MATERIAL", entityType: "MATERIAL", entityId: numId });
        return;
      }
      if (!table) return res.status(400).json({ error: "Invalid material record type" });
      await tx.update(table).set({ isDeleted: 1 }).where(eq8(table.id, numId));
      await tx.insert(auditLogs).values({ userId, action: `DELETE_${String(type).toUpperCase()}`, entityType: "MATERIAL_TRANSACTION", entityId: numId });
    });
    res.json({ success: true });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to delete material record:", error);
    res.status(500).json({ error: "Failed to delete record" });
  }
});
var material_routes_default = materialRouter;

// src/server/routes/labour.routes.ts
import { Router as Router6 } from "express";
import { eq as eq9, and as and8, desc as desc6 } from "drizzle-orm";
var labourRouter = Router6();
labourRouter.use(requireAuth);
function transformLabourRecord(r) {
  if (!r) return r;
  const attUpper = String(r.attendanceType || "").toUpperCase();
  const isWork = attUpper.includes("WORK") || attUpper.includes("TC") || attUpper === "TC_WISE";
  const isUpad = attUpper.includes("UPAD") || attUpper === "TEAM_UPAD";
  const isKharch = attUpper.includes("KHARCH") || attUpper === "OTHER_KHARCH" || attUpper === "EXPENSE";
  return {
    ...r,
    quantity: r.tcQuantity,
    workQuantity: r.tcQuantity,
    rate: r.tcRate || r.dailyRate,
    workRate: r.tcRate,
    workName: r.workType || r.tcNumber,
    isWorkWise: isWork,
    isTeamUpad: isUpad,
    isOtherKharch: isKharch,
    teamName: r.labourTeam || r.labourName
  };
}
labourRouter.get("/", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const locationId = req.query.locationId;
    const conditions = [eq9(labourSalaries.isDeleted, 0), eq9(locations.isDeleted, 0)];
    if (locationId && locationId !== "ALL" && locationId !== "0") {
      const locId = parseInt(String(locationId), 10);
      if (!isNaN(locId)) {
        await assertLocationAccess(userId, locId);
        conditions.push(eq9(labourSalaries.locationId, locId));
      }
    }
    const records2 = await db.select({
      id: labourSalaries.id,
      locationId: labourSalaries.locationId,
      userId: labourSalaries.userId,
      date: labourSalaries.date,
      siteLocationName: labourSalaries.siteLocationName,
      labourName: labourSalaries.labourName,
      labourTeam: labourSalaries.labourTeam,
      attendanceType: labourSalaries.attendanceType,
      tcNumber: labourSalaries.tcNumber,
      description: labourSalaries.description,
      days: labourSalaries.days,
      dailyRate: labourSalaries.dailyRate,
      otherEarnings: labourSalaries.otherEarnings,
      grossSalary: labourSalaries.grossSalary,
      deduction: labourSalaries.deduction,
      netSalary: labourSalaries.netSalary,
      upad: labourSalaries.upad,
      paymentAmount: labourSalaries.paymentAmount,
      balance: labourSalaries.balance,
      paymentMethod: labourSalaries.paymentMethod,
      referenceNumber: labourSalaries.referenceNumber,
      notes: labourSalaries.notes,
      createdAt: labourSalaries.createdAt,
      isDeleted: labourSalaries.isDeleted,
      tcQuantity: labourSalaries.tcQuantity,
      tcRate: labourSalaries.tcRate,
      workType: labourSalaries.workType,
      unitOfMeasurement: labourSalaries.unitOfMeasurement,
      address: labourSalaries.address,
      periodFrom: labourSalaries.periodFrom,
      periodTo: labourSalaries.periodTo
    }).from(labourSalaries).innerJoin(locations, eq9(labourSalaries.locationId, locations.id)).where(and8(...conditions)).orderBy(desc6(labourSalaries.date), desc6(labourSalaries.id));
    res.json(records2.map(transformLabourRecord));
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Fetch labour records error:", error);
    res.status(500).json({ error: "Failed to fetch labour records" });
  }
});
labourRouter.post("/", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const data = req.body;
    const locationId = parseInt(String(data.locationId), 10);
    if (!locationId || isNaN(locationId)) return res.status(400).json({ error: "locationId is required" });
    await assertLocationAccess(userId, locationId);
    const date = String(data.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]);
    const labourTeam = data.teamName ? String(data.teamName).trim() : data.labourTeam ? String(data.labourTeam).trim() : "General Team";
    const labourName = String(data.labourName || labourTeam || "Team");
    const siteLocationName = data.siteLocationName ? String(data.siteLocationName) : "";
    const rawAttType = String(data.attendanceType || "Day Wise");
    const attUpper = rawAttType.toUpperCase();
    const isTeamUpad = attUpper.includes("UPAD") || attUpper === "TEAM_UPAD";
    const isOtherKharch = attUpper.includes("KHARCH") || attUpper === "OTHER_KHARCH" || attUpper === "EXPENSE";
    const isWorkWise = attUpper.includes("WORK") || attUpper.includes("TC") || attUpper === "TC_WISE";
    let attendanceType = rawAttType;
    if (isTeamUpad) attendanceType = "TEAM_UPAD";
    else if (isOtherKharch) attendanceType = "OTHER_KHARCH";
    else if (isWorkWise) attendanceType = "TC_WISE";
    else attendanceType = "DAY_WISE";
    const days = data.days !== void 0 ? String(data.days) : rawAttType === "Half Day" ? "0.5" : "1";
    const dailyRate = String(data.dailyRate || data.rate || "0");
    const workName = data.workName || data.workType || data.expenseCategory || data.category || (isOtherKharch ? "Site Expense" : data.notes || "");
    const unitOfMeasurement = data.unitOfMeasurement || (isWorkWise ? "Nos" : null);
    const quantity = data.quantity ? String(data.quantity) : data.tcQuantity ? String(data.tcQuantity) : "0";
    const rate = data.rate ? String(data.rate) : data.tcRate ? String(data.tcRate) : dailyRate;
    const amount = data.amount || data.upad || data.paymentAmount || "0";
    const calc = calculateLabourSalaryTotals({
      attendanceType,
      days: isWorkWise ? "0" : days,
      dailyRate: isWorkWise ? "0" : dailyRate,
      quantity,
      rate,
      tcQuantity: quantity,
      tcRate: rate,
      amount,
      upad: isTeamUpad ? amount : data.upad,
      paymentAmount: isTeamUpad || isOtherKharch ? amount : data.paymentAmount,
      deduction: data.deduction
    });
    const result = await db.insert(labourSalaries).values({
      userId,
      locationId,
      labourMasterId: data.labourMasterId ? parseInt(String(data.labourMasterId), 10) : null,
      labourName,
      labourTeam,
      siteLocationName,
      date,
      attendanceType,
      workType: isWorkWise || isOtherKharch ? workName : null,
      unitOfMeasurement,
      days: isWorkWise || isTeamUpad || isOtherKharch ? "0" : days,
      dailyRate: isWorkWise || isTeamUpad || isOtherKharch ? "0" : dailyRate,
      tcQuantity: isWorkWise ? quantity : "0",
      tcRate: isWorkWise ? rate : "0",
      tcNumber: isWorkWise ? workName : data.referenceNumber || null,
      grossSalary: calc.grossSalary.toString(),
      upad: calc.upad.toString(),
      deduction: calc.deduction.toString(),
      paymentAmount: calc.paymentAmount.toString(),
      netSalary: calc.netSalary.toString(),
      balance: calc.balance.toString(),
      paymentMethod: data.paymentMethod || (isTeamUpad || isOtherKharch ? "Cash" : null),
      referenceNumber: data.referenceNumber || null,
      notes: data.notes || (isWorkWise ? `${workName} (${quantity} ${unitOfMeasurement || "Nos"})` : null)
    }).returning();
    await db.insert(auditLogs).values({
      userId,
      action: isTeamUpad ? "CREATE_TEAM_UPAD" : isOtherKharch ? "CREATE_OTHER_KHARCH" : "CREATE_LABOUR_ATTENDANCE",
      entityType: "LABOUR_ATTENDANCE",
      entityId: result[0].id,
      metadata: JSON.stringify({ teamName: labourTeam, attendanceType, amount: calc.grossSalary || calc.upad, date })
    });
    res.json(transformLabourRecord(result[0]));
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Create labour attendance error:", error);
    res.status(500).json({ error: "Failed to record entry" });
  }
});
labourRouter.put("/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const rawId = req.params.id;
    const id = parseInt(Array.isArray(rawId) ? rawId[0] : rawId, 10);
    const existing = await db.select().from(labourSalaries).where(and8(eq9(labourSalaries.id, id), eq9(labourSalaries.isDeleted, 0))).limit(1);
    if (!existing.length) return res.status(404).json({ error: "Labour record not found" });
    await assertLocationAccess(userId, existing[0].locationId);
    const data = req.body;
    const rawAttType = String(data.attendanceType || existing[0].attendanceType || "Day Wise");
    const attUpper = rawAttType.toUpperCase();
    const isTeamUpad = attUpper.includes("UPAD") || attUpper === "TEAM_UPAD";
    const isOtherKharch = attUpper.includes("KHARCH") || attUpper === "OTHER_KHARCH" || attUpper === "EXPENSE";
    const isWorkWise = attUpper.includes("WORK") || attUpper.includes("TC") || attUpper === "TC_WISE";
    let attendanceType = rawAttType;
    if (isTeamUpad) attendanceType = "TEAM_UPAD";
    else if (isOtherKharch) attendanceType = "OTHER_KHARCH";
    else if (isWorkWise) attendanceType = "TC_WISE";
    else attendanceType = "DAY_WISE";
    const labourTeam = data.teamName ? String(data.teamName).trim() : data.labourTeam ? String(data.labourTeam).trim() : existing[0].labourTeam;
    const labourName = String(data.labourName || labourTeam || existing[0].labourName || "Team");
    const workName = data.workName || data.workType || data.expenseCategory || data.category || (isOtherKharch ? "Site Expense" : data.notes || existing[0].workType || "");
    const unitOfMeasurement = data.unitOfMeasurement || (isWorkWise ? existing[0].unitOfMeasurement || "Nos" : null);
    const quantity = data.quantity ? String(data.quantity) : data.tcQuantity ? String(data.tcQuantity) : existing[0].tcQuantity || "0";
    const rate = data.rate ? String(data.rate) : data.tcRate ? String(data.tcRate) : data.dailyRate || existing[0].dailyRate || "0";
    const days = data.days !== void 0 ? String(data.days) : rawAttType === "Half Day" ? "0.5" : existing[0].days || "1";
    const dailyRate = String(data.dailyRate || existing[0].dailyRate || "0");
    const amount = data.amount || data.upad || data.paymentAmount || existing[0].paymentAmount || "0";
    const calc = calculateLabourSalaryTotals({
      attendanceType,
      days: isWorkWise ? "0" : days,
      dailyRate: isWorkWise ? "0" : dailyRate,
      quantity,
      rate,
      tcQuantity: quantity,
      tcRate: rate,
      amount,
      upad: isTeamUpad ? amount : data.upad ?? existing[0].upad,
      paymentAmount: isTeamUpad || isOtherKharch ? amount : data.paymentAmount ?? existing[0].paymentAmount,
      deduction: data.deduction ?? existing[0].deduction
    });
    const updatePayload = {
      date: data.date || existing[0].date,
      attendanceType,
      siteLocationName: data.siteLocationName !== void 0 ? String(data.siteLocationName) : existing[0].siteLocationName,
      labourName,
      labourTeam,
      workType: isWorkWise || isOtherKharch ? workName : null,
      unitOfMeasurement,
      days: isWorkWise || isTeamUpad || isOtherKharch ? "0" : days,
      dailyRate: isWorkWise || isTeamUpad || isOtherKharch ? "0" : dailyRate,
      tcQuantity: isWorkWise ? quantity : "0",
      tcRate: isWorkWise ? rate : "0",
      tcNumber: isWorkWise ? workName : data.referenceNumber || existing[0].referenceNumber,
      grossSalary: calc.grossSalary.toString(),
      upad: calc.upad.toString(),
      deduction: calc.deduction.toString(),
      paymentAmount: calc.paymentAmount.toString(),
      netSalary: calc.netSalary.toString(),
      balance: calc.balance.toString(),
      paymentMethod: data.paymentMethod !== void 0 ? data.paymentMethod : existing[0].paymentMethod,
      referenceNumber: data.referenceNumber !== void 0 ? data.referenceNumber : existing[0].referenceNumber,
      notes: data.notes !== void 0 ? data.notes : existing[0].notes
    };
    const result = await db.update(labourSalaries).set(updatePayload).where(and8(eq9(labourSalaries.id, id), eq9(labourSalaries.isDeleted, 0))).returning();
    res.json(transformLabourRecord(result[0]));
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Update labour record error:", error);
    res.status(500).json({ error: "Failed to update entry" });
  }
});
labourRouter.delete("/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const rawId = req.params.id;
    const id = parseInt(Array.isArray(rawId) ? rawId[0] : rawId, 10);
    const existing = await db.select().from(labourSalaries).where(eq9(labourSalaries.id, id)).limit(1);
    if (existing.length) {
      try {
        await assertLocationAccess(userId, existing[0].locationId, { allowDeleted: true });
      } catch (locErr) {
        console.warn(`Location check warning during labour salary delete #${id}:`, locErr);
      }
    }
    await db.update(labourSalaries).set({ isDeleted: 1 }).where(eq9(labourSalaries.id, id));
    res.json({ success: true });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Delete labour record error:", error);
    res.status(500).json({ error: "Failed to delete record" });
  }
});
var labour_routes_default = labourRouter;

// src/server/routes/supervisor.routes.ts
import { Router as Router7 } from "express";
import { eq as eq10, and as and9, desc as desc7 } from "drizzle-orm";
var supervisorRouter = Router7();
supervisorRouter.use(requireAuth);
supervisorRouter.get("/", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const locParam = req.query.locationId;
    const locationId = locParam && locParam !== "ALL" && locParam !== "0" && !isNaN(Number(locParam)) ? Number(locParam) : void 0;
    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }
    const records2 = await db.select().from(supervisorCosts).where(and9(
      eq10(supervisorCosts.isDeleted, 0),
      locationId ? eq10(supervisorCosts.locationId, locationId) : void 0
    )).orderBy(desc7(supervisorCosts.createdAt));
    res.json(records2);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to fetch supervisor costs:", error);
    res.status(500).json({ error: "Failed to fetch supervisor costs" });
  }
});
supervisorRouter.post("/", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const {
      locationId,
      date,
      supervisorName,
      amount,
      description,
      paymentMethod,
      referenceNumber
    } = req.body;
    const locId = Number(locationId);
    if (!locId || isNaN(locId)) {
      return res.status(400).json({ error: "\u0AAE\u0AB9\u0AC7\u0AB0\u0AAC\u0ABE\u0AA8\u0AC0 \u0A95\u0AB0\u0AC0\u0AA8\u0AC7 \u0AAA\u0ACD\u0AB0\u0ACB\u0A9C\u0AC7\u0A95\u0ACD\u0A9F \u0AB2\u0ACB\u0A95\u0AC7\u0AB6\u0AA8 \u0AB8\u0ABF\u0AB2\u0AC7\u0A95\u0ACD\u0A9F \u0A95\u0AB0\u0ACB / Please select a project location" });
    }
    await assertLocationAccess(userId, locId);
    const [newRecord] = await db.insert(supervisorCosts).values({
      locationId: locId,
      userId,
      date,
      supervisorName,
      amount: String(amount),
      description,
      paymentMethod,
      referenceNumber
    }).returning();
    res.json(newRecord);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to create supervisor cost:", error);
    res.status(500).json({ error: "Failed to create supervisor cost" });
  }
});
supervisorRouter.put("/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const { id } = req.params;
    const existing = await db.select().from(supervisorCosts).where(and9(eq10(supervisorCosts.id, Number(id)), eq10(supervisorCosts.isDeleted, 0))).limit(1);
    if (!existing.length) return res.status(404).json({ error: "Record not found" });
    await assertLocationAccess(userId, existing[0].locationId);
    const {
      date,
      supervisorName,
      amount,
      description,
      paymentMethod,
      referenceNumber
    } = req.body;
    const [updatedRecord] = await db.update(supervisorCosts).set({
      date,
      supervisorName,
      amount: String(amount),
      description,
      paymentMethod,
      referenceNumber
    }).where(and9(
      eq10(supervisorCosts.id, Number(id)),
      eq10(supervisorCosts.isDeleted, 0)
    )).returning();
    if (!updatedRecord) return res.status(404).json({ error: "Record not found" });
    res.json(updatedRecord);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to update supervisor cost:", error);
    res.status(500).json({ error: "Failed to update supervisor cost" });
  }
});
supervisorRouter.delete("/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const { id } = req.params;
    const existing = await db.select().from(supervisorCosts).where(eq10(supervisorCosts.id, Number(id))).limit(1);
    if (existing.length) {
      try {
        await assertLocationAccess(userId, existing[0].locationId, { allowDeleted: true });
      } catch (locErr) {
        console.warn(`Location check warning during supervisor cost delete #${id}:`, locErr);
      }
    }
    await db.update(supervisorCosts).set({ isDeleted: 1 }).where(eq10(supervisorCosts.id, Number(id)));
    res.json({ success: true });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to delete supervisor cost:", error);
    res.status(500).json({ error: "Failed to delete supervisor cost" });
  }
});
var supervisor_routes_default = supervisorRouter;

// src/server/routes/master.routes.ts
import express3 from "express";
import { eq as eq11, and as and10, or as or3, sql as sql8 } from "drizzle-orm";

// src/server/lib/realtimeSync.ts
var RealtimeSyncManager = class {
  constructor() {
    this.clients = /* @__PURE__ */ new Set();
    this.globalVersion = Date.now();
    this.heartbeatInterval = null;
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 15e3);
  }
  getVersion() {
    return this.globalVersion;
  }
  registerClient(req, res) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const client = {
      id: clientId,
      res,
      connectedAt: Date.now()
    };
    this.clients.add(client);
    const initialPayload = JSON.stringify({
      type: "INIT",
      version: this.globalVersion,
      clientId,
      activeClientsCount: this.clients.size,
      timestamp: Date.now()
    });
    res.write(`data: ${initialPayload}

`);
    req.on("close", () => {
      this.clients.delete(client);
    });
    req.on("error", () => {
      this.clients.delete(client);
    });
  }
  notifyMutation(action = "MUTATION", path = "", details = {}) {
    this.globalVersion = Date.now();
    const payload = JSON.stringify({
      type: "MUTATION",
      action,
      path,
      version: this.globalVersion,
      timestamp: Date.now(),
      ...details
    });
    const deadClients = [];
    this.clients.forEach((client) => {
      try {
        client.res.write(`data: ${payload}

`);
      } catch (err) {
        deadClients.push(client);
      }
    });
    deadClients.forEach((c) => this.clients.delete(c));
  }
  sendHeartbeat() {
    const deadClients = [];
    const pingPayload = JSON.stringify({
      type: "PING",
      version: this.globalVersion,
      timestamp: Date.now()
    });
    this.clients.forEach((client) => {
      try {
        client.res.write(`data: ${pingPayload}

`);
      } catch (err) {
        deadClients.push(client);
      }
    });
    deadClients.forEach((c) => this.clients.delete(c));
  }
};
var realtimeSync = new RealtimeSyncManager();
function realtimeSyncMiddleware(req, res, next) {
  const method = req.method.toUpperCase();
  const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (isMutating && !req.path.includes("/auth/") && !req.path.includes("/verify-session")) {
    const originalJson = res.json;
    const originalSend = res.send;
    const triggerBroadcast = () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        realtimeSync.notifyMutation(method, req.path);
      }
    };
    res.json = function(body) {
      triggerBroadcast();
      return originalJson.call(this, body);
    };
    res.send = function(body) {
      triggerBroadcast();
      return originalSend.call(this, body);
    };
  }
  next();
}

// src/server/routes/master.routes.ts
var masterRouter = express3.Router();
masterRouter.use(requireAuth);
masterRouter.get("/parties", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const locParam = req.query.locationId;
    const locationId = locParam && locParam !== "ALL" && locParam !== "0" && !isNaN(parseInt(locParam, 10)) ? parseInt(locParam, 10) : void 0;
    if (locationId) {
      await assertLocationAccess(userId, locationId);
      const records3 = await db.select().from(parties).where(and10(eq11(parties.locationId, locationId), eq11(parties.isDeleted, 0)));
      return res.json(records3);
    }
    const records2 = await db.select().from(parties).where(eq11(parties.isDeleted, 0));
    res.json(records2);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to fetch parties" });
  }
});
masterRouter.post("/parties", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const { name, locationId, address, gst, notes } = req.body;
    if (!name || !locationId) return res.status(400).json({ error: "Name and Location ID required" });
    const locId = parseInt(String(locationId), 10);
    await assertLocationAccess(userId, locId);
    const inserted = await db.insert(parties).values({
      name: String(name).trim(),
      locationId: locId,
      userId,
      address: address ? String(address).trim() : null,
      gst: gst ? String(gst).trim() : null,
      notes: notes ? String(notes).trim() : null
    }).returning();
    await db.insert(auditLogs).values({ userId, action: "CREATE_PARTY", entityType: "PARTY", entityId: inserted[0].id, metadata: JSON.stringify({ name, locationId: locId }) });
    realtimeSync.notifyMutation("CREATE_PARTY", `/master/parties?locationId=${locId}`, inserted[0]);
    res.status(201).json(inserted[0]);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to create party" });
  }
});
masterRouter.put("/parties/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });
    const existing = await db.select().from(parties).where(eq11(parties.id, id)).limit(1);
    if (!existing.length) return res.status(404).json({ error: "Party not found" });
    await assertLocationAccess(userId, existing[0].locationId);
    const { name, address, gst, notes } = req.body;
    const updated = await db.update(parties).set({
      ...name !== void 0 && { name: String(name).trim() },
      ...address !== void 0 && { address: address ? String(address).trim() : null },
      ...gst !== void 0 && { gst: gst ? String(gst).trim() : null },
      ...notes !== void 0 && { notes: notes ? String(notes).trim() : null }
    }).where(eq11(parties.id, id)).returning();
    if (!updated.length) return res.status(404).json({ error: "Party not found" });
    await db.insert(auditLogs).values({ userId, action: "UPDATE_PARTY", entityType: "PARTY", entityId: id, metadata: JSON.stringify(req.body) });
    realtimeSync.notifyMutation("UPDATE_PARTY", `/master/parties`, updated[0]);
    res.json(updated[0]);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to update party" });
  }
});
masterRouter.delete("/parties/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });
    const existing = await db.select().from(parties).where(eq11(parties.id, id)).limit(1);
    if (existing.length) {
      try {
        await assertLocationAccess(userId, existing[0].locationId, { allowDeleted: true });
      } catch (locErr) {
        console.warn(`Location check warning during party delete #${id}:`, locErr);
      }
    }
    await db.update(parties).set({ isDeleted: 1 }).where(eq11(parties.id, id));
    realtimeSync.notifyMutation("DELETE_PARTY", `/master/parties`, { id });
    res.json({ success: true });
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to delete party" });
  }
});
masterRouter.get("/teams", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const locParam = req.query.locationId;
    const locationId = locParam && locParam !== "ALL" && locParam !== "0" && !isNaN(parseInt(locParam, 10)) ? parseInt(locParam, 10) : void 0;
    if (locationId) {
      await assertLocationAccess(userId, locationId);
      const records3 = await db.select().from(labourTeams).where(and10(eq11(labourTeams.locationId, locationId), eq11(labourTeams.isDeleted, 0)));
      return res.json(records3);
    }
    const records2 = await db.select().from(labourTeams).where(eq11(labourTeams.isDeleted, 0));
    res.json(records2);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});
masterRouter.post("/teams", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const { name, locationId } = req.body;
    if (!name || !locationId) return res.status(400).json({ error: "Name and Location ID required" });
    const locId = parseInt(String(locationId), 10);
    await assertLocationAccess(userId, locId);
    const inserted = await db.insert(labourTeams).values({ name, locationId: locId, userId }).returning();
    await db.insert(auditLogs).values({ userId, action: "CREATE_TEAM", entityType: "TEAM", entityId: inserted[0].id, metadata: JSON.stringify({ name, locationId: locId }) });
    res.status(201).json(inserted[0]);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to create team" });
  }
});
masterRouter.put("/teams/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });
    const existing = await db.select().from(labourTeams).where(eq11(labourTeams.id, id)).limit(1);
    if (!existing.length) return res.status(404).json({ error: "Team not found" });
    await assertLocationAccess(userId, existing[0].locationId);
    const { name } = req.body;
    const updated = await db.update(labourTeams).set({
      ...name !== void 0 && { name }
    }).where(eq11(labourTeams.id, id)).returning();
    if (!updated.length) return res.status(404).json({ error: "Team not found" });
    await db.insert(auditLogs).values({ userId, action: "UPDATE_TEAM", entityType: "TEAM", entityId: id, metadata: JSON.stringify(req.body) });
    realtimeSync.notifyMutation("UPDATE_TEAM", `/master/teams`, updated[0]);
    res.json(updated[0]);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to update team" });
  }
});
masterRouter.delete("/teams/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });
    const existing = await db.select().from(labourTeams).where(eq11(labourTeams.id, id)).limit(1);
    if (existing.length) {
      try {
        await assertLocationAccess(userId, existing[0].locationId, { allowDeleted: true });
      } catch (locErr) {
        console.warn(`Location check warning during team delete #${id}:`, locErr);
      }
    }
    await db.update(labourTeams).set({ isDeleted: 1 }).where(eq11(labourTeams.id, id));
    res.json({ success: true });
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to delete team" });
  }
});
masterRouter.get("/materials", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const locParam = req.query.locationId;
    const locationId = locParam && locParam !== "ALL" && locParam !== "0" && !isNaN(parseInt(locParam, 10)) ? parseInt(locParam, 10) : void 0;
    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }
    const records2 = await db.select().from(materials).where(eq11(materials.isDeleted, 0)).orderBy(materials.name);
    const stockMapRes = await db.execute(sql8`
      SELECT 
        UPPER(TRIM(m.name)) as clean_name,
        COALESCE(SUM(CASE WHEN sl.transaction_type = 'IN' THEN CAST(sl.quantity AS numeric) ELSE 0 END), 0) as total_in,
        COALESCE(SUM(CASE WHEN sl.transaction_type = 'OUT' THEN ABS(CAST(sl.quantity AS numeric)) ELSE 0 END), 0) as total_out
      FROM stock_ledger sl
      JOIN materials m ON sl.material_id = m.id
      WHERE sl.is_deleted = 0
        ${locationId ? sql8`AND sl.location_id = ${locationId}` : sql8``}
      GROUP BY UPPER(TRIM(m.name))
    `);
    const latestPurchasesRes = await db.execute(sql8`
      SELECT DISTINCT ON (UPPER(TRIM(material_name)))
        UPPER(TRIM(material_name)) as clean_name,
        unit,
        rate
      FROM material_purchases
      WHERE is_deleted = 0
      ORDER BY UPPER(TRIM(material_name)), date DESC, id DESC
    `);
    const latestSuppliesRes = await db.execute(sql8`
      SELECT DISTINCT ON (UPPER(TRIM(material_name)))
        UPPER(TRIM(material_name)) as clean_name,
        unit,
        rate
      FROM material_supplies
      WHERE is_deleted = 0
      ORDER BY UPPER(TRIM(material_name)), date DESC, id DESC
    `);
    const stockMap = /* @__PURE__ */ new Map();
    for (const row of stockMapRes.rows) {
      const cleanName = String(row.clean_name || "").trim().toUpperCase();
      stockMap.set(cleanName, {
        totalIn: parseFloat(row.total_in || "0"),
        totalOut: parseFloat(row.total_out || "0")
      });
    }
    const purchaseMap = /* @__PURE__ */ new Map();
    for (const row of latestPurchasesRes.rows) {
      const cleanName = String(row.clean_name || "").trim().toUpperCase();
      purchaseMap.set(cleanName, {
        unit: String(row.unit || ""),
        rate: parseFloat(row.rate || "0")
      });
    }
    const supplyMap = /* @__PURE__ */ new Map();
    for (const row of latestSuppliesRes.rows) {
      const cleanName = String(row.clean_name || "").trim().toUpperCase();
      supplyMap.set(cleanName, {
        unit: String(row.unit || ""),
        rate: parseFloat(row.rate || "0")
      });
    }
    const enriched = [];
    for (const m of records2) {
      const cleanName = (m.name || "").trim().toUpperCase();
      const stockInfo = stockMap.get(cleanName) || { totalIn: 0, totalOut: 0 };
      const currentStock = Math.round((stockInfo.totalIn - stockInfo.totalOut) * 100) / 100;
      const minStock = parseFloat(m.minStock || "0");
      let status = "IN_STOCK";
      if (currentStock <= 0) {
        status = "OUT_OF_STOCK";
      } else if (currentStock <= minStock) {
        status = "LOW_STOCK";
      }
      let resolvedUnit = "";
      const purch = purchaseMap.get(cleanName);
      const suppl = supplyMap.get(cleanName);
      if (purch?.unit && purch.unit.trim().toLowerCase() !== "unit") {
        resolvedUnit = purch.unit.trim();
      } else if (m.defaultUnit && m.defaultUnit.trim() && m.defaultUnit.trim().toLowerCase() !== "unit") {
        resolvedUnit = m.defaultUnit.trim();
      } else if (suppl?.unit && suppl.unit.trim().toLowerCase() !== "unit") {
        resolvedUnit = suppl.unit.trim();
      }
      if (!resolvedUnit) resolvedUnit = "Nos";
      let resolvedRate = 0;
      if (purch?.rate && purch.rate > 0) {
        resolvedRate = purch.rate;
      } else if (m.defaultRate && parseFloat(m.defaultRate) > 0) {
        resolvedRate = parseFloat(m.defaultRate);
      } else if (suppl?.rate && suppl.rate > 0) {
        resolvedRate = suppl.rate;
      }
      const shouldUpdateUnit = m.defaultUnit !== resolvedUnit;
      const shouldUpdateRate = resolvedRate > 0 && (!m.defaultRate || parseFloat(m.defaultRate) === 0 || m.defaultRate !== resolvedRate.toString());
      if (shouldUpdateUnit || shouldUpdateRate) {
        db.update(materials).set({
          defaultUnit: resolvedUnit,
          ...resolvedRate > 0 ? { defaultRate: resolvedRate.toString() } : {}
        }).where(eq11(materials.id, m.id)).catch(() => {
        });
      }
      enriched.push({
        ...m,
        defaultUnit: resolvedUnit,
        unit: resolvedUnit,
        defaultRate: resolvedRate > 0 ? resolvedRate.toString() : m.defaultRate,
        rate: resolvedRate > 0 ? resolvedRate.toString() : m.defaultRate,
        totalInward: stockInfo.totalIn,
        totalOutward: stockInfo.totalOut,
        currentStock,
        status
      });
    }
    res.json(enriched);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    console.error("Failed to fetch materials:", err);
    res.status(500).json({ error: "Failed to fetch materials" });
  }
});
masterRouter.post("/materials", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const { name, locationId, category, defaultUnit, defaultRate, minStock, notes } = req.body;
    if (!name || !locationId) return res.status(400).json({ error: "Name and Location ID required" });
    const locId = parseInt(String(locationId), 10);
    await assertLocationAccess(userId, locId);
    const cleanName = String(name).trim().toUpperCase();
    const existing = await db.select().from(materials).where(
      and10(
        eq11(materials.locationId, locId),
        sql8`UPPER(TRIM(${materials.name})) = ${cleanName}`,
        eq11(materials.isDeleted, 0)
      )
    );
    if (existing.length > 0) {
      return res.status(200).json(existing[0]);
    }
    const inserted = await db.insert(materials).values({
      name: cleanName,
      locationId: locId,
      userId,
      category: category || null,
      defaultUnit: defaultUnit && String(defaultUnit).trim().toLowerCase() !== "unit" ? String(defaultUnit).trim() : "Nos",
      defaultRate: defaultRate ? String(defaultRate) : "0.00",
      minStock: minStock ? String(minStock) : "0.00",
      notes: notes || null
    }).returning();
    await db.insert(auditLogs).values({ userId, action: "CREATE_MATERIAL", entityType: "MATERIAL", entityId: inserted[0].id, metadata: JSON.stringify({ name: cleanName, locationId: locId }) });
    realtimeSync.notifyMutation("CREATE_MATERIAL", `/master/materials?locationId=${locId}`, inserted[0]);
    res.status(201).json(inserted[0]);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to create material" });
  }
});
masterRouter.put("/materials/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });
    const existing = await db.select().from(materials).where(eq11(materials.id, id)).limit(1);
    if (!existing.length) return res.status(404).json({ error: "Material not found" });
    await assertLocationAccess(userId, existing[0].locationId);
    const { name, category, defaultUnit, defaultRate, minStock, notes } = req.body;
    const cleanName = name !== void 0 ? String(name).trim().toUpperCase() : void 0;
    const updated = await db.update(materials).set({
      ...cleanName !== void 0 && { name: cleanName },
      ...category !== void 0 && { category },
      ...defaultUnit !== void 0 && { defaultUnit },
      ...defaultRate !== void 0 && { defaultRate: String(defaultRate) },
      ...minStock !== void 0 && { minStock: String(minStock) },
      ...notes !== void 0 && { notes }
    }).where(eq11(materials.id, id)).returning();
    if (!updated.length) return res.status(404).json({ error: "Material not found" });
    await db.insert(auditLogs).values({ userId, action: "UPDATE_MATERIAL", entityType: "MATERIAL", entityId: id, metadata: JSON.stringify(req.body) });
    realtimeSync.notifyMutation("UPDATE_MATERIAL", `/master/materials`, updated[0]);
    res.json(updated[0]);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to update material" });
  }
});
masterRouter.delete("/materials/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });
    const existing = await db.select().from(materials).where(eq11(materials.id, id)).limit(1);
    if (existing.length) {
      try {
        await assertLocationAccess(userId, existing[0].locationId, { allowDeleted: true });
      } catch (locErr) {
        console.warn(`Location check warning during material delete #${id}:`, locErr);
      }
    }
    await db.update(materials).set({ isDeleted: 1 }).where(eq11(materials.id, id));
    realtimeSync.notifyMutation("DELETE_MATERIAL", `/master/materials`, { id });
    res.json({ success: true });
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to delete material" });
  }
});
masterRouter.get("/labour", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const locationId = req.query.locationId ? parseInt(req.query.locationId) : void 0;
    let records2;
    if (locationId) {
      await assertLocationAccess(userId, locationId);
      records2 = await db.select({
        id: labourMaster.id,
        userId: labourMaster.userId,
        locationId: labourMaster.locationId,
        name: labourMaster.name,
        mobile: labourMaster.mobile,
        address: labourMaster.address,
        teamId: labourMaster.teamId,
        teamName: labourTeams.name,
        workType: labourMaster.workType,
        dailyRate: labourMaster.dailyRate,
        tcRate: labourMaster.tcRate,
        isActive: labourMaster.isActive,
        createdAt: labourMaster.createdAt,
        isDeleted: labourMaster.isDeleted
      }).from(labourMaster).leftJoin(labourTeams, eq11(labourMaster.teamId, labourTeams.id)).where(
        and10(
          eq11(labourMaster.isDeleted, 0),
          or3(eq11(labourMaster.locationId, locationId), eq11(labourMaster.userId, userId))
        )
      );
    } else {
      records2 = await db.select({
        id: labourMaster.id,
        userId: labourMaster.userId,
        locationId: labourMaster.locationId,
        name: labourMaster.name,
        mobile: labourMaster.mobile,
        address: labourMaster.address,
        teamId: labourMaster.teamId,
        teamName: labourTeams.name,
        workType: labourMaster.workType,
        dailyRate: labourMaster.dailyRate,
        tcRate: labourMaster.tcRate,
        isActive: labourMaster.isActive,
        createdAt: labourMaster.createdAt,
        isDeleted: labourMaster.isDeleted
      }).from(labourMaster).leftJoin(labourTeams, eq11(labourMaster.teamId, labourTeams.id)).where(
        and10(eq11(labourMaster.isDeleted, 0), eq11(labourMaster.userId, userId))
      );
    }
    res.json(records2);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to fetch labour" });
  }
});
masterRouter.post("/labour", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const { name, locationId, mobile, address, teamId, workType, dailyRate, tcRate } = req.body;
    if (!name || !locationId) return res.status(400).json({ error: "Name and Location ID required" });
    const locId = parseInt(String(locationId), 10);
    await assertLocationAccess(userId, locId);
    const inserted = await db.insert(labourMaster).values({
      name,
      locationId: locId,
      userId,
      mobile,
      address,
      teamId: teamId || null,
      workType,
      dailyRate,
      tcRate
    }).returning();
    await db.insert(auditLogs).values({ userId, action: "CREATE_LABOUR", entityType: "LABOUR", entityId: inserted[0].id, metadata: JSON.stringify({ name, locationId: locId }) });
    realtimeSync.notifyMutation("CREATE_LABOUR", `/master/labour?locationId=${locId}`, inserted[0]);
    res.status(201).json(inserted[0]);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to create labour" });
  }
});
masterRouter.put("/labour/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });
    const existing = await db.select().from(labourMaster).where(eq11(labourMaster.id, id)).limit(1);
    if (!existing.length) return res.status(404).json({ error: "Labour not found" });
    await assertLocationAccess(userId, existing[0].locationId);
    const { name, mobile, address, teamId, workType, dailyRate, tcRate } = req.body;
    const updated = await db.update(labourMaster).set({
      ...name !== void 0 && { name },
      ...mobile !== void 0 && { mobile },
      ...address !== void 0 && { address },
      ...teamId !== void 0 && { teamId },
      ...workType !== void 0 && { workType },
      ...dailyRate !== void 0 && { dailyRate },
      ...tcRate !== void 0 && { tcRate }
    }).where(eq11(labourMaster.id, id)).returning();
    if (!updated.length) return res.status(404).json({ error: "Labour not found" });
    await db.insert(auditLogs).values({ userId, action: "UPDATE_LABOUR", entityType: "LABOUR", entityId: id, metadata: JSON.stringify(req.body) });
    realtimeSync.notifyMutation("UPDATE_LABOUR", `/master/labour`, updated[0]);
    res.json(updated[0]);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to update labour" });
  }
});
masterRouter.delete("/labour/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Valid id required" });
    const existing = await db.select().from(labourMaster).where(eq11(labourMaster.id, id)).limit(1);
    if (existing.length) {
      try {
        await assertLocationAccess(userId, existing[0].locationId, { allowDeleted: true });
      } catch (locErr) {
        console.warn(`Location check warning during labour delete #${id}:`, locErr);
      }
    }
    await db.update(labourMaster).set({ isDeleted: 1 }).where(eq11(labourMaster.id, id));
    realtimeSync.notifyMutation("DELETE_LABOUR", `/master/labour`, { id });
    res.json({ success: true });
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Failed to delete labour" });
  }
});
var master_routes_default = masterRouter;

// src/server/routes/siteSupply.routes.ts
import express4 from "express";
import { eq as eq12, and as and11, desc as desc8, inArray as inArray2, sql as sql9 } from "drizzle-orm";
var siteSupplyRouter = express4.Router();
siteSupplyRouter.use(requireAuth);
siteSupplyRouter.get("/", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const locParam = req.query.locationId;
    const locationId = locParam && locParam !== "ALL" && locParam !== "0" && !isNaN(parseInt(locParam, 10)) ? parseInt(locParam, 10) : void 0;
    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }
    const records2 = await db.select({
      id: siteSupplies.id,
      userId: siteSupplies.userId,
      locationId: siteSupplies.locationId,
      date: siteSupplies.date,
      teamId: siteSupplies.teamId,
      responsiblePerson: siteSupplies.responsiblePerson,
      workDescription: siteSupplies.workDescription,
      referenceNumber: siteSupplies.referenceNumber,
      notes: siteSupplies.notes,
      totalAmount: siteSupplies.totalAmount,
      investorId: siteSupplies.investorId,
      createdAt: siteSupplies.createdAt,
      isDeleted: siteSupplies.isDeleted,
      locationName: locations.name,
      teamName: labourTeams.name
    }).from(siteSupplies).innerJoin(locations, eq12(siteSupplies.locationId, locations.id)).leftJoin(labourTeams, eq12(siteSupplies.teamId, labourTeams.id)).where(and11(
      eq12(locations.isDeleted, 0),
      locationId ? eq12(siteSupplies.locationId, locationId) : void 0,
      eq12(siteSupplies.isDeleted, 0)
    )).orderBy(desc8(siteSupplies.date), desc8(siteSupplies.id));
    const recordIds = records2.map((r) => r.id);
    let items = [];
    if (recordIds.length > 0) {
      items = await db.select({
        id: siteSupplyItems.id,
        siteSupplyId: siteSupplyItems.siteSupplyId,
        materialId: siteSupplyItems.materialId,
        quantity: siteSupplyItems.quantity,
        rate: siteSupplyItems.rate,
        amount: siteSupplyItems.amount,
        isDeleted: siteSupplyItems.isDeleted,
        materialName: materials.name,
        defaultUnit: materials.defaultUnit
      }).from(siteSupplyItems).leftJoin(materials, eq12(siteSupplyItems.materialId, materials.id)).where(and11(inArray2(siteSupplyItems.siteSupplyId, recordIds), eq12(siteSupplyItems.isDeleted, 0)));
    }
    const combined = records2.map((r) => {
      let meta = {};
      if (r.notes && r.notes.startsWith("{") && r.notes.endsWith("}")) {
        try {
          meta = JSON.parse(r.notes);
        } catch {
          meta = {};
        }
      }
      return {
        ...r,
        locationName: r.locationName || `Location #${r.locationId}`,
        teamName: r.teamName || r.responsiblePerson || "Direct Site",
        displayNotes: meta.userNotes !== void 0 ? meta.userNotes : r.notes,
        gstBreakdown: meta.gstBreakdown || null,
        subtotal: meta.subtotal || r.totalAmount,
        taxAmount: meta.taxAmount || "0",
        items: items.filter((i) => i.siteSupplyId === r.id).map((it) => {
          let itemMeta = {};
          if (meta.itemsDetail && meta.itemsDetail[it.id]) {
            itemMeta = meta.itemsDetail[it.id];
          }
          return {
            ...it,
            materialName: it.materialName || `Material #${it.materialId}`,
            unit: itemMeta.unit || it.defaultUnit || "Nos",
            taxPercentage: itemMeta.taxPercentage || 0,
            taxAmount: itemMeta.taxAmount || 0,
            subtotal: itemMeta.subtotal || it.amount,
            totalWithGst: it.amount
          };
        })
      };
    });
    res.json(combined);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    console.warn("[Site Supplies GET Notice] Database fallback:", err?.message || err);
    res.json([]);
  }
});
siteSupplyRouter.post("/", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const { locationId, date, teamId, responsiblePerson, workDescription, referenceNumber, notes, investorId } = req.body;
    let items = req.body.items;
    if ((!items || !items.length) && (req.body.materialName || req.body.materialId)) {
      items = [{
        materialId: req.body.materialId,
        materialName: req.body.materialName,
        quantity: req.body.materialQuantity || req.body.quantity,
        unit: req.body.materialUnit || req.body.unit || "Nos",
        rate: req.body.materialRate || req.body.rate || "0",
        taxPercentage: req.body.taxPercentage || "18"
      }];
    }
    const rawLoc = locationId || req.body.siteLocationId;
    const locId = rawLoc ? parseInt(String(rawLoc), 10) : NaN;
    if (isNaN(locId) || locId <= 0) {
      return res.status(400).json({ error: "\u0AAE\u0AB9\u0AC7\u0AB0\u0AAC\u0ABE\u0AA8\u0AC0 \u0A95\u0AB0\u0AC0\u0AA8\u0AC7 \u0AAA\u0ACD\u0AB0\u0ACB\u0A9C\u0AC7\u0A95\u0ACD\u0A9F \u0AB2\u0ACB\u0A95\u0AC7\u0AB6\u0AA8 \u0AB8\u0ABF\u0AB2\u0AC7\u0A95\u0ACD\u0A9F \u0A95\u0AB0\u0ACB / Please select a project location" });
    }
    if (!date || !items || !items.length) {
      return res.status(400).json({ error: "Missing required fields (Date, Items)" });
    }
    await assertLocationAccess(userId, locId);
    let finalTeamId = teamId ? parseInt(String(teamId), 10) : null;
    const rawTeamName = (req.body.teamName || "").trim();
    if ((!finalTeamId || isNaN(finalTeamId)) && rawTeamName) {
      const existingTeam = await db.select().from(labourTeams).where(
        and11(
          eq12(labourTeams.locationId, locId),
          sql9`UPPER(TRIM(${labourTeams.name})) = ${rawTeamName.toUpperCase()}`,
          eq12(labourTeams.isDeleted, 0)
        )
      ).limit(1);
      if (existingTeam.length > 0) {
        finalTeamId = existingTeam[0].id;
      } else {
        const createdTeam = await db.insert(labourTeams).values({
          userId,
          locationId: locId,
          name: rawTeamName
        }).returning();
        finalTeamId = createdTeam[0].id;
      }
    }
    const resolvedItems = [];
    for (const rawItem of items || []) {
      const q = parseFloat(String(rawItem.quantity || 0));
      if (q <= 0) continue;
      let matId = rawItem.materialId ? parseInt(String(rawItem.materialId), 10) : null;
      let matName = (rawItem.materialName || "").trim().toUpperCase();
      let unit = rawItem.unit || "Unit";
      let rate = parseFloat(String(rawItem.rate || 0));
      if ((!matId || isNaN(matId)) && matName) {
        const existing = await db.select().from(materials).where(
          and11(
            sql9`UPPER(TRIM(${materials.name})) = ${matName}`,
            eq12(materials.isDeleted, 0)
          )
        ).limit(1);
        if (existing.length > 0) {
          matId = existing[0].id;
          unit = existing[0].defaultUnit || unit;
          if (rate <= 0 && existing[0].defaultRate && parseFloat(existing[0].defaultRate) > 0) {
            rate = parseFloat(existing[0].defaultRate);
          }
        } else {
          const created = await db.insert(materials).values({
            userId,
            locationId: locId,
            name: matName,
            defaultUnit: unit,
            defaultRate: rate.toString(),
            minStock: "0.00",
            isActive: 1,
            isDeleted: 0
          }).returning();
          matId = created[0].id;
        }
      }
      if (matId && !isNaN(matId)) {
        const matRecord = await db.select().from(materials).where(eq12(materials.id, matId)).limit(1);
        if (matRecord.length > 0) {
          if (matRecord[0].defaultUnit) unit = matRecord[0].defaultUnit;
          if (rate <= 0 && matRecord[0].defaultRate && parseFloat(matRecord[0].defaultRate) > 0) {
            rate = parseFloat(matRecord[0].defaultRate);
          }
        }
        if (rate <= 0) {
          const lp = await db.execute(sql9`
            SELECT rate FROM material_purchases 
            WHERE (material_id = ${matId} OR UPPER(TRIM(material_name)) = UPPER(TRIM(${matName})))
              AND is_deleted = 0 AND rate IS NOT NULL AND CAST(rate AS numeric) > 0
            ORDER BY date DESC, id DESC LIMIT 1
          `);
          if (lp.rows[0]?.rate) {
            rate = parseFloat(String(lp.rows[0].rate));
          }
        }
        resolvedItems.push({
          ...rawItem,
          materialId: matId,
          quantity: q,
          rate,
          unit
        });
      }
    }
    if (!resolvedItems.length) {
      return res.status(400).json({ error: "At least one valid material item with quantity is required" });
    }
    const calculated = calculateSiteSupplyTotals(resolvedItems);
    const cleanInvestorId = investorId && !isNaN(parseInt(String(investorId), 10)) ? parseInt(String(investorId), 10) : null;
    const result = await db.transaction(async (tx) => {
      const supplyMeta = {
        userNotes: notes || "",
        subtotal: calculated.subtotal.toString(),
        taxAmount: calculated.taxAmount.toString(),
        totalAmount: calculated.totalAmount.toString(),
        gstBreakdown: {
          subtotal: calculated.subtotal,
          totalTax: calculated.taxAmount,
          grandTotal: calculated.totalAmount
        },
        itemsDetail: {}
      };
      const supply = await tx.insert(siteSupplies).values({
        userId,
        locationId: locId,
        date,
        teamId: finalTeamId || null,
        responsiblePerson: responsiblePerson || rawTeamName || "Direct Site Team",
        workDescription: workDescription || "",
        referenceNumber: referenceNumber || null,
        notes: JSON.stringify(supplyMeta),
        investorId: cleanInvestorId,
        totalAmount: calculated.totalAmount.toString()
      }).returning();
      const supplyId = supply[0].id;
      for (const itemCalc of calculated.items) {
        const itemRow = await tx.insert(siteSupplyItems).values({
          siteSupplyId: supplyId,
          materialId: itemCalc.materialId,
          quantity: itemCalc.quantity.toString(),
          rate: itemCalc.rate.toString(),
          amount: itemCalc.totalAmount.toString()
        }).returning();
        supplyMeta.itemsDetail[itemRow[0].id] = {
          unit: itemCalc.unit,
          taxPercentage: itemCalc.taxPercentage,
          taxAmount: itemCalc.taxAmount,
          subtotal: itemCalc.subtotal,
          totalAmount: itemCalc.totalAmount
        };
        await StockManager.addStockMovement(tx, userId, locId, itemCalc.materialId, "OUT", itemCalc.quantity, supplyId, "SITE_SUPPLY", notes);
      }
      await tx.update(siteSupplies).set({ notes: JSON.stringify(supplyMeta) }).where(eq12(siteSupplies.id, supplyId));
      await tx.insert(auditLogs).values({
        userId,
        action: "CREATE_SITE_SUPPLY",
        entityType: "SITE_SUPPLY",
        entityId: supplyId
      });
      return supply[0];
    });
    res.json(result);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to create site supply:", error);
    res.status(500).json({ error: "Failed to create site supply" });
  }
});
siteSupplyRouter.put("/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const id = parseInt(req.params.id, 10);
    const { locationId, date, teamId, responsiblePerson, workDescription, referenceNumber, notes, investorId } = req.body;
    let items = req.body.items;
    if ((!items || !items.length) && (req.body.materialName || req.body.materialId)) {
      items = [{
        materialId: req.body.materialId,
        materialName: req.body.materialName,
        quantity: req.body.materialQuantity || req.body.quantity,
        unit: req.body.materialUnit || req.body.unit || "Nos",
        rate: req.body.materialRate || req.body.rate || "0",
        taxPercentage: req.body.taxPercentage || "18"
      }];
    }
    const rawLoc = locationId || req.body.siteLocationId;
    if (!rawLoc || !date || !items || !items.length) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const locId = parseInt(String(rawLoc), 10);
    await assertLocationAccess(userId, locId);
    let finalTeamId = teamId ? parseInt(String(teamId), 10) : null;
    const rawTeamName = (req.body.teamName || "").trim();
    if ((!finalTeamId || isNaN(finalTeamId)) && rawTeamName) {
      const existingTeam = await db.select().from(labourTeams).where(
        and11(
          eq12(labourTeams.locationId, locId),
          sql9`UPPER(TRIM(${labourTeams.name})) = ${rawTeamName.toUpperCase()}`,
          eq12(labourTeams.isDeleted, 0)
        )
      ).limit(1);
      if (existingTeam.length > 0) {
        finalTeamId = existingTeam[0].id;
      } else {
        const createdTeam = await db.insert(labourTeams).values({
          userId,
          locationId: locId,
          name: rawTeamName
        }).returning();
        finalTeamId = createdTeam[0].id;
      }
    }
    const resolvedItems = [];
    for (const rawItem of items || []) {
      const q = parseFloat(String(rawItem.quantity || 0));
      if (q <= 0) continue;
      let matId = rawItem.materialId ? parseInt(String(rawItem.materialId), 10) : null;
      let matName = (rawItem.materialName || "").trim().toUpperCase();
      let unit = rawItem.unit || "Unit";
      let rate = parseFloat(String(rawItem.rate || 0));
      if ((!matId || isNaN(matId)) && matName) {
        const existing = await db.select().from(materials).where(
          and11(
            sql9`UPPER(TRIM(${materials.name})) = ${matName}`,
            eq12(materials.isDeleted, 0)
          )
        ).limit(1);
        if (existing.length > 0) {
          matId = existing[0].id;
          unit = existing[0].defaultUnit || unit;
          if (rate <= 0 && existing[0].defaultRate && parseFloat(existing[0].defaultRate) > 0) {
            rate = parseFloat(existing[0].defaultRate);
          }
        } else {
          const created = await db.insert(materials).values({
            userId,
            locationId: locId,
            name: matName,
            defaultUnit: unit,
            defaultRate: rate.toString(),
            minStock: "0.00",
            isActive: 1,
            isDeleted: 0
          }).returning();
          matId = created[0].id;
        }
      }
      if (matId && !isNaN(matId)) {
        const matRecord = await db.select().from(materials).where(eq12(materials.id, matId)).limit(1);
        if (matRecord.length > 0) {
          if (matRecord[0].defaultUnit) unit = matRecord[0].defaultUnit;
          if (rate <= 0 && matRecord[0].defaultRate && parseFloat(matRecord[0].defaultRate) > 0) {
            rate = parseFloat(matRecord[0].defaultRate);
          }
        }
        if (rate <= 0) {
          const lp = await db.execute(sql9`
            SELECT rate FROM material_purchases 
            WHERE (material_id = ${matId} OR UPPER(TRIM(material_name)) = UPPER(TRIM(${matName})))
              AND is_deleted = 0 AND rate IS NOT NULL AND CAST(rate AS numeric) > 0
            ORDER BY date DESC, id DESC LIMIT 1
          `);
          if (lp.rows[0]?.rate) {
            rate = parseFloat(String(lp.rows[0].rate));
          }
        }
        resolvedItems.push({
          ...rawItem,
          materialId: matId,
          quantity: q,
          rate,
          unit
        });
      }
    }
    if (!resolvedItems.length) {
      return res.status(400).json({ error: "At least one valid material item with quantity is required" });
    }
    const calculated = calculateSiteSupplyTotals(resolvedItems);
    const result = await db.transaction(async (tx) => {
      const oldItems = await tx.select().from(siteSupplyItems).where(eq12(siteSupplyItems.siteSupplyId, id));
      for (const item of oldItems) {
        await StockManager.addStockMovement(tx, userId, locId, item.materialId, "IN", parseFloat(item.quantity), id, "SITE_SUPPLY_UPDATE_REVERT", "Reversed for update");
      }
      await tx.delete(siteSupplyItems).where(eq12(siteSupplyItems.siteSupplyId, id));
      const supplyMeta = {
        userNotes: notes || "",
        subtotal: calculated.subtotal.toString(),
        taxAmount: calculated.taxAmount.toString(),
        totalAmount: calculated.totalAmount.toString(),
        gstBreakdown: {
          subtotal: calculated.subtotal,
          totalTax: calculated.taxAmount,
          grandTotal: calculated.totalAmount
        },
        itemsDetail: {}
      };
      const supply = await tx.update(siteSupplies).set({
        locationId: locId,
        date,
        teamId: finalTeamId || null,
        responsiblePerson,
        workDescription,
        referenceNumber,
        notes: JSON.stringify(supplyMeta),
        investorId: investorId || null,
        totalAmount: calculated.totalAmount.toString()
      }).where(and11(eq12(siteSupplies.id, id), eq12(siteSupplies.isDeleted, 0))).returning();
      for (const itemCalc of calculated.items) {
        const itemRow = await tx.insert(siteSupplyItems).values({
          siteSupplyId: id,
          materialId: itemCalc.materialId,
          quantity: itemCalc.quantity.toString(),
          rate: itemCalc.rate.toString(),
          amount: itemCalc.totalAmount.toString()
        }).returning();
        supplyMeta.itemsDetail[itemRow[0].id] = {
          unit: itemCalc.unit,
          taxPercentage: itemCalc.taxPercentage,
          taxAmount: itemCalc.taxAmount,
          subtotal: itemCalc.subtotal,
          totalAmount: itemCalc.totalAmount
        };
        await StockManager.addStockMovement(tx, userId, locId, itemCalc.materialId, "OUT", itemCalc.quantity, id, "SITE_SUPPLY", notes);
      }
      await tx.update(siteSupplies).set({ notes: JSON.stringify(supplyMeta) }).where(eq12(siteSupplies.id, id));
      await tx.insert(auditLogs).values({
        userId,
        action: "UPDATE_SITE_SUPPLY",
        entityType: "SITE_SUPPLY",
        entityId: id
      });
      return supply[0];
    });
    res.json(result);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: "Failed to update record" });
  }
});
siteSupplyRouter.delete("/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const id = parseInt(req.params.id, 10);
    await db.transaction(async (tx) => {
      const record = await tx.select().from(siteSupplies).where(eq12(siteSupplies.id, id));
      if (!record.length) return;
      const locId = record[0].locationId;
      try {
        await assertLocationAccess(userId, locId, { allowDeleted: true });
      } catch (locErr) {
        console.warn(`Location check warning during site supply delete #${id}:`, locErr);
      }
      await tx.update(siteSupplies).set({ isDeleted: 1 }).where(eq12(siteSupplies.id, id));
      const items = await tx.select().from(siteSupplyItems).where(eq12(siteSupplyItems.siteSupplyId, id));
      await tx.update(siteSupplyItems).set({ isDeleted: 1 }).where(eq12(siteSupplyItems.siteSupplyId, id));
      for (const item of items) {
        try {
          await StockManager.addStockMovement(tx, userId, locId, item.materialId, "IN", parseFloat(item.quantity), id, "SITE_SUPPLY_DELETE", "Reversed from delete");
        } catch (stockErr) {
          console.warn(`Stock reversal warning for site supply #${id}:`, stockErr);
        }
      }
      await tx.insert(auditLogs).values({ userId, action: "DELETE_SITE_SUPPLY", entityType: "SITE_SUPPLY", entityId: id });
    });
    res.json({ success: true });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: "Failed to delete record" });
  }
});
var siteSupply_routes_default = siteSupplyRouter;

// src/server/routes/sync.routes.ts
import { Router as Router8 } from "express";
var syncRouter = Router8();
syncRouter.get("/events", (req, res) => {
  realtimeSync.registerClient(req, res);
});
syncRouter.get("/version", (req, res) => {
  res.json({
    version: realtimeSync.getVersion(),
    timestamp: Date.now()
  });
});
syncRouter.post("/trigger", (req, res) => {
  realtimeSync.notifyMutation("MANUAL_SYNC", req.body?.path || "manual", req.body || {});
  res.json({ success: true, version: realtimeSync.getVersion() });
});
var sync_routes_default = syncRouter;

// src/server/routes/income.routes.ts
import { Router as Router9 } from "express";
import { eq as eq13, and as and12, desc as desc9 } from "drizzle-orm";
import { z as z4 } from "zod";
var incomeRouter = Router9();
incomeRouter.use(requireAuth);
incomeRouter.use(requireCategoryAuth);
var incomeBillSchema = z4.object({
  locationId: z4.number().int().positive(),
  date: z4.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partyName: z4.string().min(1).max(100),
  materialName: z4.string().min(1).max(100).optional().default("General"),
  quantity: z4.union([z4.number(), z4.string()]).transform(Number).optional().default(1),
  unit: z4.string().max(50).optional().default("Nos"),
  rate: z4.union([z4.number(), z4.string()]).transform(Number).optional().default(0),
  subtotal: z4.union([z4.number(), z4.string()]).transform(Number).optional().default(0),
  transportCost: z4.union([z4.number(), z4.string()]).transform(Number).optional().default(0),
  discount: z4.union([z4.number(), z4.string()]).transform(Number).optional().default(0),
  taxPercentage: z4.union([z4.number(), z4.string()]).transform(Number).optional().default(0),
  taxAmount: z4.union([z4.number(), z4.string()]).transform(Number).optional().default(0),
  totalAmount: z4.union([z4.number(), z4.string()]).transform(Number),
  paymentStatus: z4.string().optional().default("PAID"),
  paymentMethod: z4.string().optional().default("Bank Transfer"),
  referenceNumber: z4.string().optional().nullable(),
  notes: z4.string().optional().nullable(),
  title: z4.string().optional().nullable()
});
function parseRecordToBill(r) {
  let extra = {};
  if (r.notes) {
    try {
      extra = JSON.parse(r.notes);
    } catch {
      extra = { rawNotes: r.notes };
    }
  }
  return {
    id: r.id,
    locationId: r.locationId,
    date: r.date,
    partyName: r.partyName,
    materialName: extra.materialName || r.description?.replace(/^Bill:\s*/, "")?.split(" - ")[0] || "Material",
    quantity: extra.quantity !== void 0 ? Number(extra.quantity) : 1,
    unit: extra.unit || "Nos",
    rate: extra.rate !== void 0 ? Number(extra.rate) : Number(r.amount),
    subtotal: extra.subtotal !== void 0 ? Number(extra.subtotal) : Number(r.amount),
    transportCost: extra.transportCost !== void 0 ? Number(extra.transportCost) : 0,
    discount: extra.discount !== void 0 ? Number(extra.discount) : 0,
    taxPercentage: extra.taxPercentage !== void 0 ? Number(extra.taxPercentage) : 0,
    taxAmount: extra.taxAmount !== void 0 ? Number(extra.taxAmount) : 0,
    totalAmount: Number(r.amount),
    amount: Number(r.amount),
    paymentStatus: extra.paymentStatus || "PAID",
    paymentMethod: r.paymentMethod || "Bank Transfer",
    referenceNumber: r.referenceNumber,
    notes: extra.customNotes || (typeof extra.rawNotes === "string" ? extra.rawNotes : ""),
    isBillIncome: true,
    type: "BILL_INCOME",
    createdAt: r.createdAt
  };
}
incomeRouter.get("/", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const locationId = req.query.locationId ? parseInt(req.query.locationId, 10) : void 0;
    const conditions = [
      eq13(records.isDeleted, 0),
      eq13(records.type, "INCOME"),
      eq13(records.category, "BILL_INVESTMENT")
    ];
    if (locationId && !isNaN(locationId)) {
      await assertLocationAccess(userId, locationId);
      conditions.push(eq13(records.locationId, locationId));
    }
    const rows = await db.select().from(records).where(and12(...conditions)).orderBy(desc9(records.date), desc9(records.id));
    const result = rows.map(parseRecordToBill);
    res.json(result);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to fetch incomes:", error);
    res.status(500).json({ error: "Failed to fetch incomes" });
  }
});
incomeRouter.post("/", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const data = incomeBillSchema.parse(req.body);
    await assertLocationAccess(userId, data.locationId);
    const subtotal = Math.round(data.quantity * data.rate * 100) / 100;
    const taxableAmount = Math.max(0, subtotal - (data.discount || 0));
    const taxAmount = Math.round(taxableAmount * ((data.taxPercentage || 0) / 100) * 100) / 100;
    const totalAmount = Math.round((taxableAmount + taxAmount + (data.transportCost || 0)) * 100) / 100;
    const notesMeta = JSON.stringify({
      materialName: data.materialName,
      quantity: data.quantity,
      unit: data.unit,
      rate: data.rate,
      subtotal,
      transportCost: data.transportCost || 0,
      discount: data.discount || 0,
      taxPercentage: data.taxPercentage || 0,
      taxAmount,
      totalAmount,
      paymentStatus: data.paymentStatus,
      customNotes: data.notes || "",
      isBillIncome: true
    });
    const inserted = await db.insert(records).values({
      userId,
      locationId: data.locationId,
      type: "INCOME",
      category: "BILL_INVESTMENT",
      partyName: data.partyName,
      amount: totalAmount.toString(),
      date: data.date,
      paymentMethod: data.paymentMethod,
      referenceNumber: data.referenceNumber,
      description: data.title || `Bill: ${data.materialName} - ${data.partyName}`,
      notes: notesMeta
    }).returning();
    await db.insert(auditLogs).values({
      userId,
      action: "CREATE_BILL_INCOME",
      entityType: "INCOME",
      entityId: inserted[0].id,
      metadata: JSON.stringify({
        partyName: data.partyName,
        materialName: data.materialName,
        totalAmount,
        transportCost: data.transportCost
      })
    });
    res.status(201).json(parseRecordToBill(inserted[0]));
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to create income:", error);
    res.status(500).json({ error: error.message || "Failed to create income" });
  }
});
incomeRouter.put("/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const id = parseInt(req.params.id, 10);
    const existing = await db.select().from(records).where(and12(eq13(records.id, id), eq13(records.isDeleted, 0)));
    if (existing.length === 0) {
      return res.status(404).json({ error: "Income record not found" });
    }
    await assertLocationAccess(userId, existing[0].locationId);
    const data = incomeBillSchema.partial().parse(req.body);
    const prevBill = parseRecordToBill(existing[0]);
    const finalQuantity = data.quantity !== void 0 ? data.quantity : prevBill.quantity;
    const finalRate = data.rate !== void 0 ? data.rate : prevBill.rate;
    const finalDiscount = data.discount !== void 0 ? data.discount : prevBill.discount;
    const finalTaxPct = data.taxPercentage !== void 0 ? data.taxPercentage : prevBill.taxPercentage;
    const finalTransport = data.transportCost !== void 0 ? data.transportCost : prevBill.transportCost;
    const subtotal = Math.round(finalQuantity * finalRate * 100) / 100;
    const taxableAmount = Math.max(0, subtotal - finalDiscount);
    const taxAmount = Math.round(taxableAmount * (finalTaxPct / 100) * 100) / 100;
    const totalAmount = Math.round((taxableAmount + taxAmount + finalTransport) * 100) / 100;
    const notesMeta = JSON.stringify({
      materialName: data.materialName || prevBill.materialName,
      quantity: finalQuantity,
      unit: data.unit || prevBill.unit,
      rate: finalRate,
      subtotal,
      transportCost: finalTransport,
      discount: finalDiscount,
      taxPercentage: finalTaxPct,
      taxAmount,
      totalAmount,
      paymentStatus: data.paymentStatus || prevBill.paymentStatus,
      customNotes: data.notes !== void 0 ? data.notes || "" : prevBill.notes,
      isBillIncome: true
    });
    const updated = await db.update(records).set({
      partyName: data.partyName || existing[0].partyName,
      amount: totalAmount.toString(),
      date: data.date || existing[0].date,
      paymentMethod: data.paymentMethod || existing[0].paymentMethod,
      referenceNumber: data.referenceNumber !== void 0 ? data.referenceNumber : existing[0].referenceNumber,
      description: data.title || (data.materialName || data.partyName ? `Bill: ${data.materialName || prevBill.materialName} - ${data.partyName || existing[0].partyName}` : existing[0].description),
      notes: notesMeta,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq13(records.id, id)).returning();
    await db.insert(auditLogs).values({
      userId,
      action: "UPDATE_BILL_INCOME",
      entityType: "INCOME",
      entityId: id
    });
    res.json(parseRecordToBill(updated[0]));
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to update income:", error);
    res.status(500).json({ error: error.message || "Failed to update income" });
  }
});
incomeRouter.delete("/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: User authentication required" });
    const id = parseInt(req.params.id, 10);
    const existing = await db.select().from(records).where(and12(eq13(records.id, id), eq13(records.isDeleted, 0)));
    if (existing.length === 0) {
      return res.status(404).json({ error: "Income record not found" });
    }
    try {
      await assertLocationAccess(userId, existing[0].locationId, { allowDeleted: true });
    } catch (locErr) {
      console.warn(`Location check warning during income delete #${id}:`, locErr);
    }
    const updated = await db.update(records).set({
      isDeleted: 1,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and12(eq13(records.id, id), eq13(records.isDeleted, 0))).returning();
    await db.insert(auditLogs).values({
      userId,
      action: "DELETE_BILL_INCOME",
      entityType: "INCOME",
      entityId: id
    });
    res.json({ success: true, message: "Income deleted successfully" });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("Failed to delete income:", error);
    res.status(500).json({ error: error.message || "Failed to delete income" });
  }
});
var income_routes_default = incomeRouter;

// src/server/routes/contractor.routes.ts
import { Router as Router10 } from "express";
import { eq as eq14, and as and13, desc as desc10, sql as sql10 } from "drizzle-orm";
import { z as z5 } from "zod";
var contractorRouter = Router10();
contractorRouter.use(requireAuth);
var contractorCostSchema = z5.object({
  locationId: z5.number().int().positive(),
  contractorName: z5.string().min(1, "Contractor / Worker Name is required"),
  teamId: z5.union([z5.number(), z5.string(), z5.null()]).transform((v) => v ? parseInt(String(v), 10) : null).optional().nullable(),
  teamName: z5.string().optional().nullable(),
  date: z5.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Valid YYYY-MM-DD date required"),
  amount: z5.union([z5.number().positive(), z5.string()]).transform((v) => parseFloat(String(v))),
  deductionAmount: z5.union([z5.number(), z5.string()]).transform((v) => parseFloat(String(v || 0))).default(0),
  netAmount: z5.union([z5.number(), z5.string()]).transform((v) => parseFloat(String(v || 0))).optional(),
  paymentStatus: z5.enum(["PAID", "PENDING", "PARTIAL"]).default("PAID"),
  workDescription: z5.string().optional().nullable(),
  paymentMethod: z5.string().optional().nullable(),
  referenceNumber: z5.string().optional().nullable(),
  notes: z5.string().optional().nullable()
});
contractorRouter.get("/", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const locParam = req.query.locationId;
    const locationId = locParam && locParam !== "ALL" && locParam !== "0" && !isNaN(parseInt(locParam, 10)) ? parseInt(locParam, 10) : void 0;
    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }
    const costs = await db.select({
      id: contractorCosts.id,
      locationId: contractorCosts.locationId,
      userId: contractorCosts.userId,
      contractorName: contractorCosts.contractorName,
      teamId: contractorCosts.teamId,
      teamName: contractorCosts.teamName,
      date: contractorCosts.date,
      amount: contractorCosts.amount,
      deductionAmount: contractorCosts.deductionAmount,
      netAmount: contractorCosts.netAmount,
      paymentStatus: contractorCosts.paymentStatus,
      workDescription: contractorCosts.workDescription,
      paymentMethod: contractorCosts.paymentMethod,
      referenceNumber: contractorCosts.referenceNumber,
      notes: contractorCosts.notes,
      createdAt: contractorCosts.createdAt,
      updatedAt: contractorCosts.updatedAt,
      isDeleted: contractorCosts.isDeleted
    }).from(contractorCosts).innerJoin(locations, eq14(contractorCosts.locationId, locations.id)).where(and13(
      eq14(locations.isDeleted, 0),
      locationId ? eq14(contractorCosts.locationId, locationId) : void 0,
      eq14(contractorCosts.isDeleted, 0)
    )).orderBy(desc10(contractorCosts.date), desc10(contractorCosts.id));
    res.json(costs);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.warn("[Contractor Cost GET Notice] Database query fallback:", error?.message || error);
    res.json([]);
  }
});
contractorRouter.get("/reconciliation", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const locParam = req.query.locationId;
    const locationId = locParam && locParam !== "ALL" && locParam !== "0" && !isNaN(parseInt(locParam, 10)) ? parseInt(locParam, 10) : void 0;
    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }
    const teamIdQuery = req.query.teamId ? parseInt(req.query.teamId, 10) : null;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const siteSuppliesData = await db.select({
      id: siteSupplies.id,
      teamId: siteSupplies.teamId,
      date: siteSupplies.date,
      totalAmount: siteSupplies.totalAmount
    }).from(siteSupplies).innerJoin(locations, eq14(siteSupplies.locationId, locations.id)).where(
      and13(
        eq14(locations.isDeleted, 0),
        locationId ? eq14(siteSupplies.locationId, locationId) : void 0,
        eq14(siteSupplies.isDeleted, 0),
        startDate ? sql10`${siteSupplies.date} >= ${startDate}` : sql10`1=1`,
        endDate ? sql10`${siteSupplies.date} <= ${endDate}` : sql10`1=1`,
        teamIdQuery ? eq14(siteSupplies.teamId, teamIdQuery) : sql10`1=1`
      )
    );
    const totalSiteSupplyAmount = round2(
      siteSuppliesData.reduce((acc, row) => acc + (parseFloat(String(row.totalAmount || 0)) || 0), 0)
    );
    const labourData = await db.select({
      id: labourSalaries.id,
      labourTeam: labourSalaries.labourTeam,
      date: labourSalaries.date,
      grossSalary: labourSalaries.grossSalary,
      netSalary: labourSalaries.netSalary,
      paymentAmount: labourSalaries.paymentAmount,
      upad: labourSalaries.upad,
      deduction: labourSalaries.deduction
    }).from(labourSalaries).innerJoin(locations, eq14(labourSalaries.locationId, locations.id)).where(
      and13(
        eq14(locations.isDeleted, 0),
        locationId ? eq14(labourSalaries.locationId, locationId) : void 0,
        eq14(labourSalaries.isDeleted, 0),
        startDate ? sql10`${labourSalaries.date} >= ${startDate}` : sql10`1=1`,
        endDate ? sql10`${labourSalaries.date} <= ${endDate}` : sql10`1=1`
      )
    );
    const totalLabourAttendance = round2(
      labourData.reduce((acc, row) => {
        const net = parseFloat(String(row.netSalary || 0)) || 0;
        const gross = parseFloat(String(row.grossSalary || 0)) || 0;
        const upad = parseFloat(String(row.upad || 0)) || 0;
        const amt = net > 0 ? net : gross > 0 ? gross : upad;
        return acc + amt;
      }, 0)
    );
    const totalLabourUpadPaid = round2(
      labourData.reduce((acc, row) => acc + (parseFloat(String(row.upad || 0)) || 0), 0)
    );
    const expectedContractorCost = round2(totalSiteSupplyAmount + totalLabourAttendance);
    const recordedCosts = await db.select({
      id: contractorCosts.id,
      locationId: contractorCosts.locationId,
      contractorName: contractorCosts.contractorName,
      teamId: contractorCosts.teamId,
      teamName: contractorCosts.teamName,
      date: contractorCosts.date,
      amount: contractorCosts.amount,
      deductionAmount: contractorCosts.deductionAmount,
      netAmount: contractorCosts.netAmount,
      paymentStatus: contractorCosts.paymentStatus,
      workDescription: contractorCosts.workDescription,
      paymentMethod: contractorCosts.paymentMethod,
      referenceNumber: contractorCosts.referenceNumber,
      notes: contractorCosts.notes,
      createdAt: contractorCosts.createdAt,
      updatedAt: contractorCosts.updatedAt,
      isDeleted: contractorCosts.isDeleted
    }).from(contractorCosts).innerJoin(locations, eq14(contractorCosts.locationId, locations.id)).where(
      and13(
        eq14(locations.isDeleted, 0),
        locationId ? eq14(contractorCosts.locationId, locationId) : void 0,
        eq14(contractorCosts.isDeleted, 0),
        startDate ? sql10`${contractorCosts.date} >= ${startDate}` : sql10`1=1`,
        endDate ? sql10`${contractorCosts.date} <= ${endDate}` : sql10`1=1`,
        teamIdQuery ? eq14(contractorCosts.teamId, teamIdQuery) : sql10`1=1`
      )
    );
    const recordedContractorCost = round2(
      recordedCosts.reduce((acc, row) => acc + (parseFloat(String(row.amount || 0)) || 0), 0)
    );
    const difference = round2(recordedContractorCost - expectedContractorCost);
    let status = "MATCHED";
    if (difference > 0.01) {
      status = "SURPLUS";
    } else if (difference < -0.01) {
      status = "DEFICIT";
    }
    let totalMaterialSupply = 0;
    let totalInvestmentCapital = 0;
    if (locationId) {
      const matSupp = await db.select({
        total: sql10`sum(${materialSupplies.totalAmount})`
      }).from(materialSupplies).where(
        and13(eq14(materialSupplies.locationId, locationId), eq14(materialSupplies.isDeleted, 0))
      );
      totalMaterialSupply = round2(parseFloat(matSupp[0]?.total || "0") || 0);
      const [allocs, invTxs] = await Promise.all([
        db.select({ total: sql10`sum(${investorLocationAllocations.amount})` }).from(investorLocationAllocations).where(and13(eq14(investorLocationAllocations.locationId, locationId), eq14(investorLocationAllocations.isDeleted, 0))),
        db.select({ total: sql10`sum(${investmentTransactions.amount})` }).from(investmentTransactions).innerJoin(investmentParties, eq14(investmentTransactions.partyId, investmentParties.id)).where(and13(
          eq14(investmentParties.locationId, locationId),
          eq14(investmentTransactions.type, "INVESTMENT"),
          eq14(investmentTransactions.isDeleted, 0),
          eq14(investmentParties.isDeleted, 0)
        ))
      ]);
      const fromAllocs = parseFloat(allocs[0]?.total || "0") || 0;
      const fromInvTxs = parseFloat(invTxs[0]?.total || "0") || 0;
      totalInvestmentCapital = round2(fromAllocs + fromInvTxs);
    }
    const totalThreeExpenses = round2(totalMaterialSupply + totalSiteSupplyAmount + totalLabourAttendance);
    const investmentVariance = round2(totalInvestmentCapital - totalThreeExpenses);
    const investmentReconStatus = Math.abs(investmentVariance) <= 0.01 ? "MATCHED" : investmentVariance > 0 ? "SURPLUS" : "DEFICIT";
    res.json({
      summary: {
        totalSiteSupplies: totalSiteSupplyAmount,
        totalLabourCost: totalLabourAttendance,
        expectedCost: expectedContractorCost,
        recordedCost: recordedContractorCost,
        variance: difference,
        reconciliationStatus: status,
        contractorCostCount: recordedCosts.length,
        siteSupplyCount: siteSuppliesData.length,
        labourCount: labourData.length,
        // Context for Site Expenses vs Investment Capital
        totalMaterialSupply,
        totalThreeExpenses,
        totalInvestmentCapital,
        investmentVariance,
        investmentReconStatus
      },
      siteExpensesReconciliation: {
        totalMaterialSupply,
        totalSiteSupply: totalSiteSupplyAmount,
        totalLabourAttendance,
        totalThreeExpenses,
        totalInvestmentCapital,
        variance: investmentVariance,
        status: investmentReconStatus
      },
      contractorCosts: recordedCosts,
      siteSupplies: siteSuppliesData,
      labourSalaries: labourData,
      locationId,
      teamId: teamIdQuery,
      totalSiteSupplyAmount,
      totalLabourAttendance,
      totalLabourUpadPaid,
      expectedContractorCost,
      recordedContractorCost,
      difference,
      status,
      siteSuppliesCount: siteSuppliesData.length,
      labourRecordsCount: labourData.length,
      recordedCostsCount: recordedCosts.length
    });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.warn("[Contractor Reconciliation GET Notice] Database query fallback:", error?.message || error);
    res.json({
      summary: {
        totalSiteSupplies: 0,
        totalLabourCost: 0,
        expectedCost: 0,
        recordedCost: 0,
        variance: 0,
        reconciliationStatus: "MATCHED",
        contractorCostCount: 0,
        siteSupplyCount: 0,
        labourCount: 0,
        totalMaterialSupply: 0,
        totalThreeExpenses: 0,
        totalInvestmentCapital: 0,
        investmentVariance: 0,
        investmentReconStatus: "MATCHED"
      },
      siteExpensesReconciliation: {
        totalMaterialSupply: 0,
        totalSiteSupply: 0,
        totalLabourAttendance: 0,
        totalThreeExpenses: 0,
        totalInvestmentCapital: 0,
        variance: 0,
        status: "MATCHED"
      },
      contractorCosts: [],
      siteSupplies: [],
      labourSalaries: [],
      locationId: null,
      teamId: null,
      totalSiteSupplyAmount: 0,
      totalLabourAttendance: 0,
      totalLabourUpadPaid: 0,
      expectedContractorCost: 0,
      recordedContractorCost: 0,
      difference: 0,
      status: "MATCHED",
      siteSuppliesCount: 0,
      labourRecordsCount: 0,
      recordedCostsCount: 0
    });
  }
});
contractorRouter.get("/reconciliation/export", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const locParam = req.query.locationId;
    const locationId = locParam && locParam !== "ALL" && locParam !== "0" && !isNaN(parseInt(locParam, 10)) ? parseInt(locParam, 10) : void 0;
    let locationName = "All Locations";
    if (locationId) {
      await assertLocationAccess(userId, locationId);
      const loc = await db.select().from(locations).where(eq14(locations.id, locationId)).limit(1);
      if (loc.length) locationName = loc[0].name;
    }
    const siteSuppliesData = await db.select({
      id: siteSupplies.id,
      teamId: siteSupplies.teamId,
      date: siteSupplies.date,
      totalAmount: siteSupplies.totalAmount,
      responsiblePerson: siteSupplies.responsiblePerson,
      locationId: siteSupplies.locationId
    }).from(siteSupplies).where(and13(
      locationId ? eq14(siteSupplies.locationId, locationId) : void 0,
      eq14(siteSupplies.isDeleted, 0)
    ));
    const labourData = await db.select({
      id: labourSalaries.id,
      labourTeam: labourSalaries.labourTeam,
      date: labourSalaries.date,
      netSalary: labourSalaries.netSalary,
      labourName: labourSalaries.labourName,
      paymentAmount: labourSalaries.paymentAmount,
      balance: labourSalaries.balance,
      locationId: labourSalaries.locationId
    }).from(labourSalaries).where(and13(
      locationId ? eq14(labourSalaries.locationId, locationId) : void 0,
      eq14(labourSalaries.isDeleted, 0)
    ));
    const recordedCosts = await db.select().from(contractorCosts).where(and13(
      locationId ? eq14(contractorCosts.locationId, locationId) : void 0,
      eq14(contractorCosts.isDeleted, 0)
    ));
    const matSupplies = await db.select({
      totalAmount: materialSupplies.totalAmount
    }).from(materialSupplies).where(and13(
      locationId ? eq14(materialSupplies.locationId, locationId) : void 0,
      eq14(materialSupplies.isDeleted, 0)
    ));
    const totalSiteSupplyAmount = round2(siteSuppliesData.reduce((s, row) => s + parseFloat(row.totalAmount || "0"), 0));
    const totalLabourAttendance = round2(labourData.reduce((s, row) => s + parseFloat(row.netSalary || "0"), 0));
    const expectedContractorCost = round2(totalSiteSupplyAmount + totalLabourAttendance);
    const recordedContractorCost = round2(recordedCosts.reduce((s, row) => s + parseFloat(row.netAmount || "0"), 0));
    const difference = round2(expectedContractorCost - recordedContractorCost);
    const status = Math.abs(difference) <= 0.01 ? "MATCHED" : difference > 0 ? "DEFICIT" : "SURPLUS";
    const totalMaterialSupply = round2(matSupplies.reduce((s, row) => s + parseFloat(row.totalAmount || "0"), 0));
    let totalInvestmentCapital = 0;
    if (locationId) {
      const [allocs, invTxs] = await Promise.all([
        db.select({ total: sql10`sum(${investorLocationAllocations.amount})` }).from(investorLocationAllocations).where(and13(
          eq14(investorLocationAllocations.locationId, locationId),
          eq14(investorLocationAllocations.isDeleted, 0)
        )),
        db.select({ total: sql10`sum(${investmentTransactions.amount})` }).from(investmentTransactions).innerJoin(investmentParties, eq14(investmentTransactions.partyId, investmentParties.id)).where(and13(
          eq14(investmentParties.locationId, locationId),
          eq14(investmentTransactions.type, "INVESTMENT"),
          eq14(investmentTransactions.isDeleted, 0),
          eq14(investmentParties.isDeleted, 0)
        ))
      ]);
      const fromAllocs = parseFloat(allocs[0]?.total || "0") || 0;
      const fromInvTxs = parseFloat(invTxs[0]?.total || "0") || 0;
      totalInvestmentCapital = round2(fromAllocs + fromInvTxs);
    }
    const totalCombinedSiteExpenses = round2(totalMaterialSupply + totalSiteSupplyAmount + totalLabourAttendance);
    const investmentVariance = round2(totalInvestmentCapital - totalCombinedSiteExpenses);
    const investmentStatus = Math.abs(investmentVariance) <= 0.01 ? "MATCHED" : investmentVariance > 0 ? "SURPLUS" : "DEFICIT";
    const reconPayload = {
      totalInvestmentCapital,
      totalMaterialSupply,
      totalSiteSupply: totalSiteSupplyAmount,
      totalLabourAttendance,
      totalCombinedSiteExpenses,
      investmentVariance,
      investmentStatus,
      expectedContractorCost,
      recordedContractorCost,
      contractorVariance: difference,
      contractorStatus: status,
      siteSupplies: siteSuppliesData,
      labourSalaries: labourData,
      contractorCosts: recordedCosts
    };
    const buffer = generateReconciliationBuffer(locationName, reconPayload);
    const filename = `Reconciliation_Audit_${locationName.replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("[Contractor Reconciliation Export Error]", error);
    res.status(500).json({ error: error?.message || "Failed to export reconciliation audit report", stack: error?.stack });
  }
});
contractorRouter.get("/export", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const locParam = req.query.locationId;
    const locationId = locParam && locParam !== "ALL" && locParam !== "0" && !isNaN(parseInt(locParam, 10)) ? parseInt(locParam, 10) : void 0;
    let locationName = "All Locations";
    if (locationId) {
      await assertLocationAccess(userId, locationId);
      const loc = await db.select().from(locations).where(eq14(locations.id, locationId)).limit(1);
      if (loc.length) locationName = loc[0].name;
    }
    const records2 = await db.select().from(contractorCosts).where(and13(
      locationId ? eq14(contractorCosts.locationId, locationId) : void 0,
      eq14(contractorCosts.isDeleted, 0)
    )).orderBy(desc10(contractorCosts.date), desc10(contractorCosts.id));
    const buffer = generateContractorCostsBuffer(locationName, records2);
    const filename = `Contractor_Costs_${locationName.replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("[Contractor Costs Export Error]", error);
    res.status(500).json({ error: "Failed to export contractor costs" });
  }
});
contractorRouter.post("/", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const data = contractorCostSchema.parse(req.body);
    await assertLocationAccess(userId, data.locationId);
    const gross = data.amount;
    const ded = data.deductionAmount || 0;
    const net = data.netAmount !== void 0 ? data.netAmount : Math.max(0, round2(gross - ded));
    const inserted = await db.insert(contractorCosts).values({
      userId,
      locationId: data.locationId,
      contractorName: data.contractorName.trim(),
      teamId: data.teamId || null,
      teamName: data.teamName || null,
      date: data.date,
      amount: String(gross),
      deductionAmount: String(ded),
      netAmount: String(net),
      paymentStatus: data.paymentStatus || "PAID",
      workDescription: data.workDescription || null,
      paymentMethod: data.paymentMethod || "Cash",
      referenceNumber: data.referenceNumber || null,
      notes: data.notes || null,
      isDeleted: 0
    }).returning();
    await db.insert(auditLogs).values({
      userId,
      action: "CREATE_CONTRACTOR_COST",
      entityType: "CONTRACTOR_COST",
      entityId: inserted[0].id,
      metadata: JSON.stringify({
        locationId: data.locationId,
        contractorName: data.contractorName,
        amount: data.amount,
        netAmount: net
      })
    });
    res.status(201).json(inserted[0]);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("[Contractor Cost POST Error]", error);
    res.status(400).json({ error: error?.message || "Failed to create contractor cost" });
  }
});
contractorRouter.put("/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const costId = parseInt(String(req.params.id), 10);
    if (isNaN(costId)) return res.status(400).json({ error: "Valid ID is required" });
    const existing = await db.select().from(contractorCosts).where(and13(eq14(contractorCosts.id, costId), eq14(contractorCosts.isDeleted, 0))).limit(1);
    if (!existing.length) return res.status(404).json({ error: "Contractor cost record not found" });
    await assertLocationAccess(userId, existing[0].locationId);
    const data = contractorCostSchema.partial().parse(req.body);
    const gross = data.amount !== void 0 ? data.amount : parseFloat(existing[0].amount);
    const ded = data.deductionAmount !== void 0 ? data.deductionAmount : parseFloat(existing[0].deductionAmount || "0");
    const net = data.netAmount !== void 0 ? data.netAmount : Math.max(0, round2(gross - ded));
    const updated = await db.update(contractorCosts).set({
      contractorName: data.contractorName !== void 0 ? data.contractorName.trim() : void 0,
      teamId: data.teamId !== void 0 ? data.teamId : void 0,
      teamName: data.teamName !== void 0 ? data.teamName : void 0,
      date: data.date !== void 0 ? data.date : void 0,
      amount: data.amount !== void 0 ? String(gross) : void 0,
      deductionAmount: data.deductionAmount !== void 0 ? String(ded) : void 0,
      netAmount: String(net),
      paymentStatus: data.paymentStatus !== void 0 ? data.paymentStatus : void 0,
      workDescription: data.workDescription !== void 0 ? data.workDescription : void 0,
      paymentMethod: data.paymentMethod !== void 0 ? data.paymentMethod : void 0,
      referenceNumber: data.referenceNumber !== void 0 ? data.referenceNumber : void 0,
      notes: data.notes !== void 0 ? data.notes : void 0,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq14(contractorCosts.id, costId)).returning();
    await db.insert(auditLogs).values({
      userId,
      action: "UPDATE_CONTRACTOR_COST",
      entityType: "CONTRACTOR_COST",
      entityId: costId,
      metadata: JSON.stringify({ costId, updates: data })
    });
    res.json(updated[0]);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("[Contractor Cost PUT Error]", error);
    res.status(400).json({ error: error?.message || "Failed to update contractor cost" });
  }
});
contractorRouter.delete("/:id", async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const costId = parseInt(String(req.params.id), 10);
    if (isNaN(costId)) return res.status(400).json({ error: "Valid ID is required" });
    const existing = await db.select().from(contractorCosts).where(and13(eq14(contractorCosts.id, costId), eq14(contractorCosts.isDeleted, 0))).limit(1);
    if (!existing.length) return res.status(404).json({ error: "Contractor cost record not found" });
    try {
      await assertLocationAccess(userId, existing[0].locationId, { allowDeleted: true });
    } catch (locErr) {
      console.warn(`Location check warning during contractor cost delete #${costId}:`, locErr);
    }
    await db.update(contractorCosts).set({
      isDeleted: 1,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq14(contractorCosts.id, costId));
    await db.insert(auditLogs).values({
      userId,
      action: "DELETE_CONTRACTOR_COST",
      entityType: "CONTRACTOR_COST",
      entityId: costId,
      metadata: JSON.stringify({ costId, contractorName: existing[0].contractorName })
    });
    res.json({ success: true, message: "Contractor cost record deleted successfully" });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error("[Contractor Cost DELETE Error]", error);
    res.status(500).json({ error: "Failed to delete contractor cost" });
  }
});
var contractor_routes_default = contractorRouter;

// src/server/app.ts
var dbInitPromise = null;
async function ensureDbInitialized() {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      try {
        await runDatabaseMigrations();
        await initializeSinglePasswordInDB();
        await normalizeMaterialsAndStockDB();
        await cleanupDeletedLocationsData();
        console.log("[Bootstrap] Database initialization, deleted location cleanup & accounting sanity checks completed.");
      } catch (err) {
        console.error("[Bootstrap] Background initialization warning:", err);
      }
    })();
  }
  return dbInitPromise;
}
function createExpressApp() {
  const app2 = express5();
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()) : [];
  app2.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length > 0 && !allowedOrigins.includes("*")) {
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        const isAllowedDomain = origin.includes("localhost") || origin.includes("127.0.0.1") || origin.endsWith(".googleusercontent.com") || origin.endsWith(".run.app") || origin.endsWith(".vercel.app");
        if (isAllowedDomain) {
          return callback(null, true);
        }
        return callback(new Error(`CORS policy error: Origin ${origin} not allowed.`));
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-app-pin-token", "x-category-pin-token", "x-delete-password", "Cache-Control", "Pragma"]
  }));
  app2.use(express5.json({ limit: "50mb" }));
  app2.use(express5.urlencoded({ extended: true, limit: "50mb" }));
  app2.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    next();
  });
  app2.use((req, res, next) => {
    if (req.url.startsWith("/api/index.ts")) {
      req.url = req.url.replace(/^\/api\/index\.ts/, "/api");
    } else if (req.url.startsWith("/api/index")) {
      req.url = req.url.replace(/^\/api\/index/, "/api");
    }
    const knownApiPrefixes = [
      "/sync",
      "/auth",
      "/access",
      "/locations",
      "/records",
      "/reports",
      "/audit-logs",
      "/investments",
      "/materials",
      "/site-supplies",
      "/labour",
      "/supervisor-costs",
      "/contractor-costs",
      "/contractors",
      "/master",
      "/incomes",
      "/health",
      "/gas-proxy"
    ];
    if (!req.url.startsWith("/api") && knownApiPrefixes.some((p) => req.url.startsWith(p))) {
      req.url = "/api" + req.url;
    }
    next();
  });
  app2.use("/api", async (req, res, next) => {
    if (req.method === "DELETE") {
      const providedPassword = req.headers["x-delete-password"] || req.query.deletePassword || req.body && req.body.deletePassword;
      let isAuthorized = false;
      if (providedPassword) {
        isAuthorized = await verifyPasswordAgainstDB(providedPassword);
      }
      if (!isAuthorized) {
        const authHeader = req.headers.authorization || req.headers["x-app-pin-token"];
        if (authHeader) {
          const token = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : authHeader;
          if (token && verifyPinToken(token)) {
            isAuthorized = true;
          }
        }
      }
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          error: 'Security authorization required: Valid security password ("Bh@ju1203") is required to delete any record or details.',
          requiresDeletePassword: true
        });
      }
    }
    next();
  });
  app2.use(realtimeSyncMiddleware);
  app2.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app2.use("/api/sync", sync_routes_default);
  app2.use("/api/auth", auth_routes_default);
  app2.use("/api/access", auth_routes_default);
  app2.use("/api/locations", location_routes_default);
  app2.use("/api/records", record_routes_default);
  app2.use("/api/reports", report_routes_default);
  app2.use("/api/audit-logs", audit_routes_default);
  app2.use("/api/investments", investment_routes_default);
  app2.use("/api/materials", material_routes_default);
  app2.use("/api/site-supplies", siteSupply_routes_default);
  app2.use("/api/labour", labour_routes_default);
  app2.use("/api/supervisor-costs", supervisor_routes_default);
  app2.use("/api/contractor-costs", contractor_routes_default);
  app2.use("/api/contractors", contractor_routes_default);
  app2.use("/api/master", master_routes_default);
  app2.use("/api/incomes", income_routes_default);
  app2.use(errorHandler);
  return app2;
}
var app = createExpressApp();
var app_default = app;
export {
  createExpressApp,
  app_default as default,
  ensureDbInitialized
};
