import express, { Response } from 'express';
import { db } from '../../db/index.js';
import { parties, labourTeams, invoices, materialPurchases, materialSupplies, payments, auditLogs, taxRates, creditDebitNotes } from '../../db/schema.js';
import { eq, and, desc, sql, or, ilike } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import { DecimalMath } from '../../shared/accountingEngine.js';

const masterRouter = express.Router();
masterRouter.use(requireAuth);

const partySchema = z.object({
  businessId: z.number().int().optional().nullable(),
  locationId: z.number().int().optional().nullable(),
  name: z.string().min(1, 'Party name is required'),
  partyType: z.enum(['CUSTOMER', 'SUPPLIER', 'BOTH']).default('CUSTOMER'),
  phone: z.string().optional().nullable().default(''),
  email: z.string().optional().nullable().default(''),
  pan: z.string().optional().nullable().default(''),
  state: z.string().optional().nullable().default('Gujarat'),
  stateCode: z.string().optional().nullable().default('24'),
  address: z.string().optional().nullable().default(''),
  gst: z.string().optional().nullable().default(''),
  openingBalance: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 0)).optional().default(0),
  openingBalanceType: z.enum(['TO_RECEIVE', 'TO_PAY']).default('TO_RECEIVE'),
  creditLimit: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  paymentTermsDays: z.union([z.number(), z.string()]).transform(Number).optional().default(30),
  notes: z.string().optional().nullable().default(''),
});

const taxRateSchema = z.object({
  businessId: z.number().int().optional().nullable(),
  name: z.string().min(1, 'Tax rate name is required'),
  gstRate: z.union([z.number(), z.string()]).transform(Number),
  cgstRate: z.union([z.number(), z.string()]).transform(Number),
  sgstRate: z.union([z.number(), z.string()]).transform(Number),
  igstRate: z.union([z.number(), z.string()]).transform(Number),
  cessRate: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  isDefault: z.union([z.number(), z.boolean()]).transform(v => (v ? 1 : 0)).optional().default(0),
});

// GET /api/master/parties - List parties with optimized single-query balance aggregation
masterRouter.get('/parties', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const businessId = req.query.businessId ? parseInt(String(req.query.businessId), 10) : req.businessId;
    const locationId = req.query.locationId ? parseInt(String(req.query.locationId), 10) : undefined;
    const partyType = req.query.partyType ? String(req.query.partyType).trim() : undefined;
    const search = req.query.search ? String(req.query.search).trim() : undefined;

    const conditions = [
      eq(parties.userId, userId),
      eq(parties.isDeleted, 0),
    ];

    if (businessId) {
      conditions.push(or(eq(parties.businessId, businessId), sql`${parties.businessId} IS NULL`)!);
    }
    if (locationId && !isNaN(locationId)) {
      conditions.push(eq(parties.locationId, locationId));
    }
    if (partyType) {
      conditions.push(eq(parties.partyType, partyType));
    }
    if (search) {
      conditions.push(ilike(parties.name, `%${search}%`));
    }

    const partyList = await db.select().from(parties).where(
      and(...conditions)
    ).orderBy(desc(parties.createdAt));

    // Batch aggregate calculations in 3 queries instead of 3 * N queries
    const [invoiceAgg, supplyAgg, purchaseAgg] = await Promise.all([
      db.select({
        partyName: invoices.partyName,
        total: sql<string>`COALESCE(sum(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`,
        paid: sql<string>`COALESCE(sum(CAST(${invoices.paidAmount} AS NUMERIC)), 0)`,
        balance: sql<string>`COALESCE(sum(CAST(${invoices.balanceAmount} AS NUMERIC)), 0)`,
      })
      .from(invoices)
      .where(and(eq(invoices.userId, userId), eq(invoices.isDeleted, 0), eq(invoices.isVoid, 0)))
      .groupBy(invoices.partyName),

      db.select({
        partyName: materialSupplies.partyName,
        total: sql<string>`COALESCE(sum(CAST(${materialSupplies.totalAmount} AS NUMERIC)), 0)`,
        paid: sql<string>`COALESCE(sum(CAST(${materialSupplies.paidAmount} AS NUMERIC)), 0)`,
        balance: sql<string>`COALESCE(sum(CAST(${materialSupplies.outstandingAmount} AS NUMERIC)), 0)`,
      })
      .from(materialSupplies)
      .where(and(eq(materialSupplies.userId, userId), eq(materialSupplies.isDeleted, 0), eq(materialSupplies.isVoid, 0)))
      .groupBy(materialSupplies.partyName),

      db.select({
        partyName: materialPurchases.partyName,
        total: sql<string>`COALESCE(sum(CAST(${materialPurchases.totalAmount} AS NUMERIC)), 0)`,
        paid: sql<string>`COALESCE(sum(CAST(${materialPurchases.paidAmount} AS NUMERIC)), 0)`,
        balance: sql<string>`COALESCE(sum(CAST(${materialPurchases.outstandingAmount} AS NUMERIC)), 0)`,
      })
      .from(materialPurchases)
      .where(and(eq(materialPurchases.userId, userId), eq(materialPurchases.isDeleted, 0), eq(materialPurchases.isVoid, 0)))
      .groupBy(materialPurchases.partyName),
    ]);

    const invMap = new Map(invoiceAgg.map(r => [r.partyName?.toLowerCase(), parseFloat(r.balance || '0')]));
    const supMap = new Map(supplyAgg.map(r => [r.partyName?.toLowerCase(), parseFloat(r.balance || '0')]));
    const purMap = new Map(purchaseAgg.map(r => [r.partyName?.toLowerCase(), parseFloat(r.balance || '0')]));

    const enrichedParties = partyList.map((party) => {
      const pKey = party.name.toLowerCase();
      const invBal = invMap.get(pKey) || 0;
      const supOut = supMap.get(pKey) || 0;
      const purOut = purMap.get(pKey) || 0;

      const opBal = parseFloat(party.openingBalance || '0');
      const opReceivable = party.openingBalanceType === 'TO_RECEIVE' ? opBal : 0;
      const opPayable = party.openingBalanceType === 'TO_PAY' ? opBal : 0;

      const totalReceivable = DecimalMath.add(invBal, supOut, opReceivable);
      const totalPayable = DecimalMath.add(purOut, opPayable);
      const netOutstanding = DecimalMath.sub(totalReceivable, totalPayable);

      return {
        ...party,
        totalReceivable,
        totalPayable,
        netOutstanding,
        currentBalance: Math.abs(netOutstanding).toFixed(2),
        currentBalanceType: netOutstanding > 0 ? 'TO_RECEIVE' : netOutstanding < 0 ? 'TO_PAY' : 'SETTLED',
      };
    });

    res.json(enrichedParties);
  } catch (err: any) {
    console.error('Failed to fetch parties:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch parties' });
  }
});

// GET /api/master/parties/:id/ledger - Full Party Statement of Account
masterRouter.get('/parties/:id/ledger', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const partyId = parseInt(String(req.params.id), 10);
    if (isNaN(partyId)) return res.status(400).json({ error: 'Valid party ID required' });

    const [party] = await db.select().from(parties).where(
      and(eq(parties.id, partyId), eq(parties.userId, userId), eq(parties.isDeleted, 0))
    );
    if (!party) return res.status(404).json({ error: 'Party not found' });

    // Fetch all transactions involving this party
    const [invList, supList, purList, payList, notesList] = await Promise.all([
      db.select().from(invoices).where(and(eq(invoices.userId, userId), eq(invoices.partyName, party.name), eq(invoices.isDeleted, 0), eq(invoices.isVoid, 0))),
      db.select().from(materialSupplies).where(and(eq(materialSupplies.userId, userId), eq(materialSupplies.partyName, party.name), eq(materialSupplies.isDeleted, 0), eq(materialSupplies.isVoid, 0))),
      db.select().from(materialPurchases).where(and(eq(materialPurchases.userId, userId), eq(materialPurchases.partyName, party.name), eq(materialPurchases.isDeleted, 0), eq(materialPurchases.isVoid, 0))),
      db.select().from(payments).where(and(eq(payments.userId, userId), eq(payments.partyName, party.name), eq(payments.isDeleted, 0), eq(payments.isReversed, 0))),
      db.select().from(creditDebitNotes).where(and(eq(creditDebitNotes.userId, userId), eq(creditDebitNotes.partyId, party.id), eq(creditDebitNotes.isVoid, 0))),
    ]);

    type LedgerEntry = {
      date: string;
      type: string;
      voucherNo: string;
      description: string;
      debit: number;  // Increases what party owes us
      credit: number; // Decreases what party owes us / increases what we owe
    };

    const entries: LedgerEntry[] = [];

    // Opening Balance
    const opBal = parseFloat(party.openingBalance || '0');
    if (opBal > 0) {
      entries.push({
        date: party.createdAt ? new Date(party.createdAt).toISOString().split('T')[0] : '2025-04-01',
        type: 'Opening Balance',
        voucherNo: 'OP-BAL',
        description: `Opening Balance (${party.openingBalanceType === 'TO_RECEIVE' ? 'Receivable' : 'Payable'})`,
        debit: party.openingBalanceType === 'TO_RECEIVE' ? opBal : 0,
        credit: party.openingBalanceType === 'TO_PAY' ? opBal : 0,
      });
    }

    // Invoices (Debit)
    invList.forEach(inv => {
      entries.push({
        date: inv.invoiceDate,
        type: 'GST Invoice',
        voucherNo: inv.invoiceNumber,
        description: `Tax Invoice - ${inv.invoiceType}`,
        debit: parseFloat(inv.totalAmount || '0'),
        credit: 0,
      });
    });

    // Material Supplies (Debit)
    supList.forEach(sup => {
      entries.push({
        date: sup.date,
        type: 'Material Supply',
        voucherNo: sup.invoiceNumber || `SUP-${sup.id}`,
        description: `${sup.materialName} (${sup.quantity} ${sup.unit})`,
        debit: parseFloat(sup.totalAmount || '0'),
        credit: 0,
      });
    });

    // Material Purchases (Credit)
    purList.forEach(pur => {
      entries.push({
        date: pur.date,
        type: 'Purchase Bill',
        voucherNo: pur.invoiceNumber || `PUR-${pur.id}`,
        description: `${pur.materialName} (${pur.quantity} ${pur.unit})`,
        debit: 0,
        credit: parseFloat(pur.totalAmount || '0'),
      });
    });

    // Payments
    payList.forEach(pay => {
      const amt = parseFloat(pay.amount || '0');
      if (pay.paymentType === 'PAYMENT_IN') {
        entries.push({
          date: pay.date,
          type: 'Receipt (Payment In)',
          voucherNo: pay.referenceNumber || `RCPT-${pay.id}`,
          description: pay.notes || `Received via ${pay.paymentMode}`,
          debit: 0,
          credit: amt,
        });
      } else {
        entries.push({
          date: pay.date,
          type: 'Payment Out',
          voucherNo: pay.referenceNumber || `PAY-${pay.id}`,
          description: pay.notes || `Paid via ${pay.paymentMode}`,
          debit: amt,
          credit: 0,
        });
      }
    });

    // Credit / Debit Notes
    notesList.forEach(note => {
      const amt = parseFloat(note.totalAmount || '0');
      if (note.noteType === 'CREDIT_NOTE') {
        entries.push({
          date: note.noteDate,
          type: 'Credit Note',
          voucherNo: note.noteNumber,
          description: note.reason,
          debit: 0,
          credit: amt,
        });
      } else {
        entries.push({
          date: note.noteDate,
          type: 'Debit Note',
          voucherNo: note.noteNumber,
          description: note.reason,
          debit: amt,
          credit: 0,
        });
      }
    });

    // Chronological sorting
    entries.sort((a, b) => a.date.localeCompare(b.date));

    // Running balance
    let runningBalance = 0;
    const ledgerWithRunningBalance = entries.map(entry => {
      runningBalance = DecimalMath.sub(DecimalMath.add(runningBalance, entry.debit), entry.credit);
      return {
        ...entry,
        runningBalance,
      };
    });

    const totalDebit = entries.reduce((s, e) => DecimalMath.add(s, e.debit), 0);
    const totalCredit = entries.reduce((s, e) => DecimalMath.add(s, e.credit), 0);

    res.json({
      party,
      ledger: ledgerWithRunningBalance,
      totalDebit,
      totalCredit,
      closingBalance: runningBalance,
      closingBalanceType: runningBalance > 0 ? 'TO_RECEIVE' : runningBalance < 0 ? 'TO_PAY' : 'SETTLED',
    });
  } catch (err: any) {
    console.error('Failed to generate ledger:', err);
    res.status(500).json({ error: err.message || 'Failed to generate party ledger' });
  }
});

// POST /api/master/parties - Create party
masterRouter.post('/parties', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const data = partySchema.parse(req.body);

    const [inserted] = await db.insert(parties).values({
      userId,
      businessId: data.businessId || req.businessId || null,
      locationId: data.locationId || null,
      name: data.name.trim(),
      partyType: data.partyType,
      phone: data.phone || null,
      email: data.email || null,
      pan: data.pan ? data.pan.toUpperCase() : null,
      state: data.state || 'Gujarat',
      stateCode: data.stateCode || '24',
      address: data.address || null,
      gst: data.gst ? data.gst.toUpperCase() : null,
      openingBalance: data.openingBalance.toString(),
      openingBalanceType: data.openingBalanceType,
      creditLimit: data.creditLimit.toString(),
      paymentTermsDays: data.paymentTermsDays,
      notes: data.notes || null,
    }).returning();

    await db.insert(auditLogs).values({
      userId,
      businessId: inserted.businessId,
      locationId: inserted.locationId,
      action: 'CREATE',
      entityType: 'PARTY',
      entityId: inserted.id,
      afterState: JSON.stringify(inserted),
    });

    res.status(201).json(inserted);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to create party' });
  }
});

// PUT /api/master/parties/:id - Update party
masterRouter.put('/parties/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid party ID' });

    const [existing] = await db.select().from(parties).where(
      and(eq(parties.id, id), eq(parties.userId, userId), eq(parties.isDeleted, 0))
    );
    if (!existing) return res.status(404).json({ error: 'Party not found' });

    const data = partySchema.parse(req.body);

    const [updated] = await db.update(parties).set({
      businessId: data.businessId !== undefined ? data.businessId : existing.businessId,
      locationId: data.locationId !== undefined ? data.locationId : existing.locationId,
      name: data.name.trim(),
      partyType: data.partyType,
      phone: data.phone || null,
      email: data.email || null,
      pan: data.pan ? data.pan.toUpperCase() : null,
      state: data.state || 'Gujarat',
      stateCode: data.stateCode || '24',
      address: data.address || null,
      gst: data.gst ? data.gst.toUpperCase() : null,
      openingBalance: data.openingBalance.toString(),
      openingBalanceType: data.openingBalanceType,
      creditLimit: data.creditLimit.toString(),
      paymentTermsDays: data.paymentTermsDays,
      notes: data.notes || null,
    }).where(and(eq(parties.id, id), eq(parties.userId, userId))).returning();

    await db.insert(auditLogs).values({
      userId,
      businessId: updated.businessId,
      locationId: updated.locationId,
      action: 'UPDATE',
      entityType: 'PARTY',
      entityId: id,
      beforeState: JSON.stringify(existing),
      afterState: JSON.stringify(updated),
    });

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update party' });
  }
});

// DELETE /api/master/parties/:id - Soft delete party
masterRouter.delete('/parties/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid party ID' });

    const [existing] = await db.select().from(parties).where(
      and(eq(parties.id, id), eq(parties.userId, userId), eq(parties.isDeleted, 0))
    );
    if (!existing) return res.status(404).json({ error: 'Party not found' });

    await db.update(parties)
      .set({ isDeleted: 1 })
      .where(and(eq(parties.id, id), eq(parties.userId, userId)));

    await db.insert(auditLogs).values({
      userId,
      businessId: existing.businessId,
      locationId: existing.locationId,
      action: 'DELETE',
      entityType: 'PARTY',
      entityId: id,
      beforeState: JSON.stringify(existing),
    });

    res.json({ success: true, message: 'Party deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete party' });
  }
});

// --- TAX RATES CRUD ---

// GET /api/master/tax-rates - List tax rates (seeds defaults if empty)
masterRouter.get('/tax-rates', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const businessId = req.query.businessId ? parseInt(String(req.query.businessId), 10) : req.businessId;

    let rates = await db.select().from(taxRates).where(
      and(
        eq(taxRates.userId, userId),
        eq(taxRates.isDeleted, 0),
        businessId ? or(eq(taxRates.businessId, businessId), sql`${taxRates.businessId} IS NULL`) : sql`1=1`
      )
    ).orderBy(taxRates.gstRate);

    // Auto-seed standard Indian GST rates if table has zero entries for user
    if (rates.length === 0) {
      const defaultRates = [
        { name: 'GST 0% (Exempt)', gstRate: '0.00', cgstRate: '0.00', sgstRate: '0.00', igstRate: '0.00', isDefault: 0 },
        { name: 'GST 5%', gstRate: '5.00', cgstRate: '2.50', sgstRate: '2.50', igstRate: '5.00', isDefault: 0 },
        { name: 'GST 12%', gstRate: '12.00', cgstRate: '6.00', sgstRate: '6.00', igstRate: '12.00', isDefault: 0 },
        { name: 'GST 18%', gstRate: '18.00', cgstRate: '9.00', sgstRate: '9.00', igstRate: '18.00', isDefault: 1 },
        { name: 'GST 28%', gstRate: '28.00', cgstRate: '14.00', sgstRate: '14.00', igstRate: '28.00', isDefault: 0 },
      ];

      for (const dr of defaultRates) {
        await db.insert(taxRates).values({
          userId,
          businessId: businessId || null,
          name: dr.name,
          gstRate: dr.gstRate,
          cgstRate: dr.cgstRate,
          sgstRate: dr.sgstRate,
          igstRate: dr.igstRate,
          cessRate: '0.00',
          isDefault: dr.isDefault,
        });
      }

      rates = await db.select().from(taxRates).where(
        and(eq(taxRates.userId, userId), eq(taxRates.isDeleted, 0))
      ).orderBy(taxRates.gstRate);
    }

    res.json(rates);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch tax rates' });
  }
});

// POST /api/master/tax-rates - Create tax rate
masterRouter.post('/tax-rates', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const data = taxRateSchema.parse(req.body);

    const [inserted] = await db.insert(taxRates).values({
      userId,
      businessId: data.businessId || req.businessId || null,
      name: data.name.trim(),
      gstRate: data.gstRate.toFixed(2),
      cgstRate: data.cgstRate.toFixed(2),
      sgstRate: data.sgstRate.toFixed(2),
      igstRate: data.igstRate.toFixed(2),
      cessRate: data.cessRate.toFixed(2),
      isDefault: data.isDefault,
    }).returning();

    res.status(201).json(inserted);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to create tax rate' });
  }
});

// PUT /api/master/tax-rates/:id - Update tax rate
masterRouter.put('/tax-rates/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const data = taxRateSchema.parse(req.body);

    const [updated] = await db.update(taxRates).set({
      name: data.name.trim(),
      gstRate: data.gstRate.toFixed(2),
      cgstRate: data.cgstRate.toFixed(2),
      sgstRate: data.sgstRate.toFixed(2),
      igstRate: data.igstRate.toFixed(2),
      cessRate: data.cessRate.toFixed(2),
      isDefault: data.isDefault,
    }).where(and(eq(taxRates.id, id), eq(taxRates.userId, userId))).returning();

    if (!updated) return res.status(404).json({ error: 'Tax rate not found' });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update tax rate' });
  }
});

// DELETE /api/master/tax-rates/:id - Delete tax rate
masterRouter.delete('/tax-rates/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    await db.update(taxRates).set({ isDeleted: 1 }).where(
      and(eq(taxRates.id, id), eq(taxRates.userId, userId))
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete tax rate' });
  }
});

// --- TEAMS CRUD ---

masterRouter.get('/teams', async (req: AuthRequest, res: Response) => {
  try {
    const locationId = req.query.locationId ? parseInt(String(req.query.locationId), 10) : undefined;
    const records = await db.select().from(labourTeams).where(
      and(
        eq(labourTeams.userId, req.dbUser!.id),
        locationId ? eq(labourTeams.locationId, locationId) : sql`1=1`,
        eq(labourTeams.isDeleted, 0)
      )
    );
    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch teams' });
  }
});

masterRouter.post('/teams', async (req: AuthRequest, res: Response) => {
  try {
    const { name, locationId } = req.body;
    if (!name || !locationId) return res.status(400).json({ error: 'Name and Location ID required' });
    const [inserted] = await db.insert(labourTeams).values({
      name: String(name).trim(),
      locationId: Number(locationId),
      userId: req.dbUser!.id
    }).returning();

    await db.insert(auditLogs).values({
      userId: req.dbUser!.id,
      action: 'CREATE',
      entityType: 'TEAM',
      entityId: inserted.id,
      afterState: JSON.stringify(inserted),
    });

    res.status(201).json(inserted);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create team' });
  }
});

export default masterRouter;
