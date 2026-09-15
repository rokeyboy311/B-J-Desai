/**
 * @file src/db/migrate_v2.ts
 * Idempotent, non-destructive migration script for B_D Accounting ERP upgrade.
 * Backfills business hierarchy, initializes new tables and columns,
 * and validates row counts and financial totals before and after migration.
 */

import { sql } from 'drizzle-orm';
import { db } from './index.ts';
import { FinancialYearService } from '../shared/financialYear.ts';

export async function runMigration() {
  console.log('--- Starting B_D Accounting Migration v2.0 ---');

  try {
    // Step 1: Pre-flight Audit (Snapshot counts and sums)
    console.log('[Step 1] Recording pre-migration counts...');
    const preUsers = await db.execute(sql`SELECT count(*)::int as cnt FROM users`);
    const preLocations = await db.execute(sql`SELECT count(*)::int as cnt FROM locations`);
    const preRecords = await db.execute(sql`SELECT count(*)::int as cnt, COALESCE(sum(amount), 0)::numeric as amt FROM records WHERE is_deleted = 0`);
    const preInvoices = await db.execute(sql`SELECT count(*)::int as cnt, COALESCE(sum(total_amount), 0)::numeric as amt FROM invoices WHERE is_deleted = 0`);
    const prePurchases = await db.execute(sql`SELECT count(*)::int as cnt, COALESCE(sum(total_amount), 0)::numeric as amt FROM material_purchases WHERE is_deleted = 0`);

    console.log(`Pre-migration state: Users=${preUsers.rows[0].cnt}, Locations=${preLocations.rows[0].cnt}, Records=${preRecords.rows[0].cnt}, Invoices=${preInvoices.rows[0].cnt}`);

    // Step 2: DDL Additions (Safe & Idempotent)
    console.log('[Step 2] Executing safe DDL additions...');

    // 2.1 Create businesses table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS businesses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        business_name TEXT NOT NULL,
        legal_name TEXT,
        address TEXT,
        city TEXT,
        state TEXT NOT NULL DEFAULT 'Gujarat',
        pincode TEXT,
        mobile TEXT,
        email TEXT,
        gstin TEXT,
        pan TEXT,
        logo TEXT,
        invoice_prefix TEXT NOT NULL DEFAULT 'INV',
        financial_year TEXT NOT NULL,
        bank_name TEXT,
        bank_account_number TEXT,
        bank_ifsc TEXT,
        bank_branch TEXT,
        terms_and_conditions TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 2.2 Create tax_rates table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tax_rates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        business_id INTEGER REFERENCES businesses(id),
        name TEXT NOT NULL,
        gst_rate NUMERIC(5, 2) NOT NULL,
        cgst_rate NUMERIC(5, 2) NOT NULL,
        sgst_rate NUMERIC(5, 2) NOT NULL,
        igst_rate NUMERIC(5, 2) NOT NULL,
        cess_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
        is_default INTEGER NOT NULL DEFAULT 0,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 2.3 Create opening_balances table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS opening_balances (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        business_id INTEGER REFERENCES businesses(id),
        location_id INTEGER REFERENCES locations(id),
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        entity_name TEXT NOT NULL,
        debit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        credit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        stock_quantity NUMERIC(12, 4) NOT NULL DEFAULT 0,
        stock_rate NUMERIC(12, 2) NOT NULL DEFAULT 0,
        effective_date TEXT NOT NULL,
        financial_year TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 2.4 Create refunds table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS refunds (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        business_id INTEGER REFERENCES businesses(id),
        location_id INTEGER REFERENCES locations(id),
        record_id INTEGER NOT NULL REFERENCES records(id),
        refund_date TEXT NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'CASH',
        reference_number TEXT,
        notes TEXT,
        is_void INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 2.5 Create stock_movements table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        business_id INTEGER REFERENCES businesses(id),
        location_id INTEGER REFERENCES locations(id),
        item_id INTEGER NOT NULL REFERENCES items(id),
        movement_type TEXT NOT NULL,
        quantity NUMERIC(12, 4) NOT NULL,
        unit TEXT NOT NULL DEFAULT 'Nos',
        unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
        total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
        source_document_type TEXT NOT NULL,
        source_document_id INTEGER NOT NULL,
        source_line_id INTEGER,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 2.6 Create credit_debit_notes table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS credit_debit_notes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        business_id INTEGER REFERENCES businesses(id),
        location_id INTEGER REFERENCES locations(id),
        party_id INTEGER REFERENCES parties(id),
        original_invoice_id INTEGER NOT NULL REFERENCES invoices(id),
        note_type TEXT NOT NULL,
        note_number TEXT NOT NULL,
        note_date TEXT NOT NULL,
        financial_year TEXT NOT NULL,
        reason TEXT NOT NULL,
        taxable_amount NUMERIC(12, 2) NOT NULL,
        cgst NUMERIC(12, 2) NOT NULL DEFAULT 0,
        sgst NUMERIC(12, 2) NOT NULL DEFAULT 0,
        igst NUMERIC(12, 2) NOT NULL DEFAULT 0,
        cess_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        total_amount NUMERIC(12, 2) NOT NULL,
        stock_affecting INTEGER NOT NULL DEFAULT 0,
        is_void INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Step 3: Add nullable columns to existing tables
    console.log('[Step 3] Adding new columns to existing tables...');
    const alterStatements = [
      `ALTER TABLE locations ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses(id);`,
      `ALTER TABLE locations ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'Gujarat';`,
      `ALTER TABLE locations ADD COLUMN IF NOT EXISTS city TEXT;`,
      `ALTER TABLE locations ADD COLUMN IF NOT EXISTS pincode TEXT;`,
      `ALTER TABLE locations ADD COLUMN IF NOT EXISTS gstin TEXT;`,
      `ALTER TABLE locations ADD COLUMN IF NOT EXISTS contact_person TEXT;`,
      `ALTER TABLE locations ADD COLUMN IF NOT EXISTS mobile TEXT;`,

      `ALTER TABLE records ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses(id);`,
      `ALTER TABLE records ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;`,
      `ALTER TABLE records ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0;`,
      `ALTER TABLE records ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;`,
      `ALTER TABLE records ADD COLUMN IF NOT EXISTS is_void INTEGER NOT NULL DEFAULT 0;`,
      `ALTER TABLE records ADD COLUMN IF NOT EXISTS void_reason TEXT;`,
      `ALTER TABLE records ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP;`,

      `ALTER TABLE items ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses(id);`,
      `ALTER TABLE items ADD COLUMN IF NOT EXISTS sku TEXT;`,
      `ALTER TABLE items ADD COLUMN IF NOT EXISTS category TEXT;`,
      `ALTER TABLE items ADD COLUMN IF NOT EXISTS cess_rate NUMERIC(5, 2) NOT NULL DEFAULT 0;`,

      `ALTER TABLE parties ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses(id);`,
      `ALTER TABLE parties ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12, 2) NOT NULL DEFAULT 0;`,
      `ALTER TABLE parties ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER NOT NULL DEFAULT 30;`,

      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses(id);`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS financial_year TEXT;`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS seller_state TEXT NOT NULL DEFAULT 'Gujarat';`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS seller_state_code TEXT NOT NULL DEFAULT '24';`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS buyer_state TEXT NOT NULL DEFAULT 'Gujarat';`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS buyer_state_code TEXT NOT NULL DEFAULT '24';`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS place_of_supply_state_code TEXT NOT NULL DEFAULT '24';`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_reverse_charge INTEGER NOT NULL DEFAULT 0;`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_void INTEGER NOT NULL DEFAULT 0;`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS void_reason TEXT;`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP;`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cess_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS transport_charges NUMERIC(12, 2) NOT NULL DEFAULT 0;`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS idempotency_key TEXT;`,

      `ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses(id);`,
      `ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;`,
      `ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS cess_rate NUMERIC(5, 2) NOT NULL DEFAULT 0;`,
      `ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS cess_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;`,

      `ALTER TABLE material_purchases ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses(id);`,
      `ALTER TABLE material_purchases ADD COLUMN IF NOT EXISTS financial_year TEXT;`,
      `ALTER TABLE material_purchases ADD COLUMN IF NOT EXISTS cgst NUMERIC(12, 2) NOT NULL DEFAULT 0;`,
      `ALTER TABLE material_purchases ADD COLUMN IF NOT EXISTS sgst NUMERIC(12, 2) NOT NULL DEFAULT 0;`,
      `ALTER TABLE material_purchases ADD COLUMN IF NOT EXISTS igst NUMERIC(12, 2) NOT NULL DEFAULT 0;`,
      `ALTER TABLE material_purchases ADD COLUMN IF NOT EXISTS cess NUMERIC(12, 2) NOT NULL DEFAULT 0;`,
      `ALTER TABLE material_purchases ADD COLUMN IF NOT EXISTS is_void INTEGER NOT NULL DEFAULT 0;`,
      `ALTER TABLE material_purchases ADD COLUMN IF NOT EXISTS void_reason TEXT;`,

      `ALTER TABLE labour_salaries ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses(id);`,
      `ALTER TABLE labour_salaries ADD COLUMN IF NOT EXISTS work_type TEXT NOT NULL DEFAULT 'DAY_WORK';`,
      `ALTER TABLE labour_salaries ADD COLUMN IF NOT EXISTS daily_rate_snapshot NUMERIC(12, 2) NOT NULL DEFAULT 0;`,
      `ALTER TABLE labour_salaries ADD COLUMN IF NOT EXISTS is_void INTEGER NOT NULL DEFAULT 0;`,
      `ALTER TABLE labour_salaries ADD COLUMN IF NOT EXISTS void_reason TEXT;`,

      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses(id);`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS purchase_id INTEGER REFERENCES material_purchases(id);`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS labour_salary_id INTEGER REFERENCES labour_salaries(id);`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS record_id INTEGER REFERENCES records(id);`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_reversed INTEGER NOT NULL DEFAULT 0;`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS reversal_reason TEXT;`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMP;`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS reversal_payment_id INTEGER;`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;`,

      `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses(id);`,
      `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id);`,
      `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS before_state TEXT;`,
      `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS after_state TEXT;`,
      `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;`,
      `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;`,
    ];

    for (const stmt of alterStatements) {
      await db.execute(sql.raw(stmt));
    }

    // Step 4: Seed default business for existing users
    console.log('[Step 4] Ensuring default business exists for every user...');
    const currentFY = FinancialYearService.getFinancialYear();
    const allUsers = await db.execute(sql`SELECT id FROM users`);
    
    for (const u of allUsers.rows) {
      const uId = Number(u.id);
      const existingBiz = await db.execute(sql`SELECT id FROM businesses WHERE user_id = ${uId} LIMIT 1`);
      
      let bizId: number;
      if (existingBiz.rows.length === 0) {
        const created = await db.execute(sql`
          INSERT INTO businesses (user_id, business_name, legal_name, invoice_prefix, financial_year, state)
          VALUES (${uId}, 'Bina Enterprise', 'Bina Enterprise', 'INV', ${currentFY}, 'Gujarat')
          RETURNING id;
        `);
        bizId = Number(created.rows[0].id);
        console.log(`Created default business ID ${bizId} for User ${uId}`);
      } else {
        bizId = Number(existingBiz.rows[0].id);
      }

      // Step 5: Map unlinked locations to default business
      await db.execute(sql`UPDATE locations SET business_id = ${bizId} WHERE user_id = ${uId} AND business_id IS NULL`);
      await db.execute(sql`UPDATE items SET business_id = ${bizId} WHERE user_id = ${uId} AND business_id IS NULL`);
      await db.execute(sql`UPDATE parties SET business_id = ${bizId} WHERE user_id = ${uId} AND business_id IS NULL`);
      await db.execute(sql`UPDATE records SET business_id = ${bizId} WHERE user_id = ${uId} AND business_id IS NULL`);
      await db.execute(sql`UPDATE invoices SET business_id = ${bizId}, financial_year = COALESCE(financial_year, ${currentFY}) WHERE user_id = ${uId} AND business_id IS NULL`);
      await db.execute(sql`UPDATE invoice_items SET business_id = ${bizId} WHERE business_id IS NULL`);
      await db.execute(sql`UPDATE material_purchases SET business_id = ${bizId}, financial_year = COALESCE(financial_year, ${currentFY}) WHERE user_id = ${uId} AND business_id IS NULL`);
      await db.execute(sql`UPDATE labour_salaries SET business_id = ${bizId} WHERE user_id = ${uId} AND business_id IS NULL`);
      await db.execute(sql`UPDATE payments SET business_id = ${bizId} WHERE user_id = ${uId} AND business_id IS NULL`);
    }

    // Step 6: Post-flight Verification
    console.log('[Step 6] Verifying row counts and sums after migration...');
    const postUsers = await db.execute(sql`SELECT count(*)::int as cnt FROM users`);
    const postLocations = await db.execute(sql`SELECT count(*)::int as cnt FROM locations`);
    const postRecords = await db.execute(sql`SELECT count(*)::int as cnt, COALESCE(sum(amount), 0)::numeric as amt FROM records WHERE is_deleted = 0`);
    const postInvoices = await db.execute(sql`SELECT count(*)::int as cnt, COALESCE(sum(total_amount), 0)::numeric as amt FROM invoices WHERE is_deleted = 0`);
    const postPurchases = await db.execute(sql`SELECT count(*)::int as cnt, COALESCE(sum(total_amount), 0)::numeric as amt FROM material_purchases WHERE is_deleted = 0`);

    if (
      postUsers.rows[0].cnt !== preUsers.rows[0].cnt ||
      postLocations.rows[0].cnt !== preLocations.rows[0].cnt ||
      postRecords.rows[0].cnt !== preRecords.rows[0].cnt ||
      postInvoices.rows[0].cnt !== preInvoices.rows[0].cnt ||
      postPurchases.rows[0].cnt !== prePurchases.rows[0].cnt
    ) {
      throw new Error('Migration verification failed: row count discrepancy detected!');
    }

    console.log('✅ Migration v2.0 completed successfully! All historical data preserved.');
    return { success: true };
  } catch (error) {
    console.error('❌ Migration v2.0 failed:', error);
    throw error;
  }
}
