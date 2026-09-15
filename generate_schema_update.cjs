const fs = require('fs');
let schema = fs.readFileSync('src/db/schema.ts', 'utf8');

const newTables = `
// --- NEW MASTER DATA ---
export const materials = pgTable('materials', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  locationId: integer('location_id').references(() => locations.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  category: text('category'),
  defaultUnit: text('default_unit'),
  defaultRate: numeric('default_rate', { precision: 12, scale: 2 }).default('0'),
  minStock: numeric('min_stock', { precision: 12, scale: 2 }).default('0'),
  isActive: integer('is_active').default(1).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

export const labourMaster = pgTable('labour_master', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  locationId: integer('location_id').references(() => locations.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  mobile: text('mobile'),
  address: text('address'),
  teamId: integer('team_id').references(() => labourTeams.id),
  workType: text('work_type'),
  dailyRate: numeric('daily_rate', { precision: 12, scale: 2 }).default('0'),
  tcRate: numeric('tc_rate', { precision: 12, scale: 2 }).default('0'),
  isActive: integer('is_active').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

// --- STOCK LEDGER ---
export const stockLedger = pgTable('stock_ledger', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  locationId: integer('location_id').references(() => locations.id, { onDelete: 'cascade' }).notNull(),
  materialId: integer('material_id').references(() => materials.id).notNull(),
  transactionType: text('transaction_type').notNull(), // 'IN', 'OUT', 'ADJUST'
  quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull(),
  referenceId: integer('reference_id'),
  referenceType: text('reference_type'), // 'PURCHASE', 'MATERIAL_SUPPLY', 'SITE_SUPPLY', 'MANUAL'
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

// --- NEW SITE SUPPLY (Internal) ---
export const siteSupplies = pgTable('site_supplies', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  locationId: integer('location_id').references(() => locations.id, { onDelete: 'cascade' }).notNull(),
  date: text('date').notNull(),
  teamId: integer('team_id').references(() => labourTeams.id),
  responsiblePerson: text('responsible_person'),
  workDescription: text('work_description'),
  referenceNumber: text('reference_number'),
  notes: text('notes'),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  investorId: integer('investor_id').references(() => investmentParties.id), // Optional linkage
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

export const siteSupplyItems = pgTable('site_supply_items', {
  id: serial('id').primaryKey(),
  siteSupplyId: integer('site_supply_id').references(() => siteSupplies.id, { onDelete: 'cascade' }).notNull(),
  materialId: integer('material_id').references(() => materials.id).notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull(),
  rate: numeric('rate', { precision: 12, scale: 2 }).default('0').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).default('0').notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});

// --- NEW MATERIAL SUPPLY (External) ---
export const materialSupplies = pgTable('material_supplies', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  locationId: integer('location_id').references(() => locations.id, { onDelete: 'cascade' }).notNull(),
  date: text('date').notNull(),
  partyId: integer('party_id').references(() => parties.id), // Customer
  partyName: text('party_name'), // fallback
  address: text('address'),
  gst: text('gst'),
  materialId: integer('material_id').references(() => materials.id),
  materialName: text('material_name'), // fallback
  quantity: numeric('quantity', { precision: 12, scale: 2 }).default('0'),
  unit: text('unit'),
  rate: numeric('rate', { precision: 12, scale: 2 }).default('0'),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).default('0'),
  discount: numeric('discount', { precision: 12, scale: 2 }).default('0'),
  taxPercentage: numeric('tax_percentage', { precision: 5, scale: 2 }).default('0'),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).default('0'),
  transport: numeric('transport', { precision: 12, scale: 2 }).default('0'),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  outstandingAmount: numeric('outstanding_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  paymentStatus: text('payment_status').default('UNPAID'),
  paymentMethod: text('payment_method'),
  referenceNumber: text('reference_number'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isDeleted: integer('is_deleted').default(0).notNull(),
});
`;

if (!schema.includes('materials = pgTable')) {
  schema = schema.replace('// --- Master Data Tables ---', '// --- Master Data Tables ---\n' + newTables);
}

// Ensure old materialPurchases has materialId
if (!schema.includes("materialId: integer('material_id')")) {
  schema = schema.replace(
    "export const materialPurchases = pgTable('material_purchases', {",
    "export const materialPurchases = pgTable('material_purchases', {\n  materialId: integer('material_id').references(() => materials.id),"
  );
  schema = schema.replace(
    "export const labourSalaries = pgTable('labour_salaries', {",
    "export const labourSalaries = pgTable('labour_salaries', {\n  labourMasterId: integer('labour_master_id').references(() => labourMaster.id),"
  );
}

// Let's add relations for these
const newRelations = `
export const materialsRelations = relations(materials, ({ one, many }) => ({
  location: one(locations, { fields: [materials.locationId], references: [locations.id] }),
  author: one(users, { fields: [materials.userId], references: [users.id] }),
  stockLedger: many(stockLedger),
}));

export const labourMasterRelations = relations(labourMaster, ({ one }) => ({
  location: one(locations, { fields: [labourMaster.locationId], references: [locations.id] }),
  author: one(users, { fields: [labourMaster.userId], references: [users.id] }),
  team: one(labourTeams, { fields: [labourMaster.teamId], references: [labourTeams.id] }),
}));

export const stockLedgerRelations = relations(stockLedger, ({ one }) => ({
  location: one(locations, { fields: [stockLedger.locationId], references: [locations.id] }),
  author: one(users, { fields: [stockLedger.userId], references: [users.id] }),
  material: one(materials, { fields: [stockLedger.materialId], references: [materials.id] }),
}));

export const siteSuppliesRelations = relations(siteSupplies, ({ one, many }) => ({
  location: one(locations, { fields: [siteSupplies.locationId], references: [locations.id] }),
  author: one(users, { fields: [siteSupplies.userId], references: [users.id] }),
  team: one(labourTeams, { fields: [siteSupplies.teamId], references: [labourTeams.id] }),
  investor: one(investmentParties, { fields: [siteSupplies.investorId], references: [investmentParties.id] }),
  items: many(siteSupplyItems),
}));

export const siteSupplyItemsRelations = relations(siteSupplyItems, ({ one }) => ({
  siteSupply: one(siteSupplies, { fields: [siteSupplyItems.siteSupplyId], references: [siteSupplies.id] }),
  material: one(materials, { fields: [siteSupplyItems.materialId], references: [materials.id] }),
}));
`;

if (!schema.includes('materialsRelations')) {
  schema += '\n' + newRelations;
}

fs.writeFileSync('src/db/schema.ts', schema);
console.log('Schema updated successfully');
