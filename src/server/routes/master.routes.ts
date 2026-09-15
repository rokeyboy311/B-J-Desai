import express, { Response } from 'express';
import { db } from '../../db/index.js';
import { parties, labourTeams, invoices, materialPurchases, materialSupplies, payments, auditLogs } from '../../db/schema.js';
import { eq, and, desc, sql, or } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';

const masterRouter = express.Router();
masterRouter.use(requireAuth);

const partySchema = z.object({
  name: z.string().min(1),
  locationId: z.number().int().optional().nullable(),
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
  notes: z.string().optional().nullable().default(''),
});

// GET /api/master/parties - List parties with computed receivables/payables
masterRouter.get('/parties', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const { locationId, partyType, search } = req.query;

    const partyList = await db.select().from(parties).where(
      and(
        eq(parties.userId, userId),
        eq(parties.isDeleted, 0),
        locationId ? eq(parties.locationId, Number(locationId)) : sql`1=1`,
        partyType ? eq(parties.partyType, String(partyType)) : sql`1=1`,
        search ? sql`LOWER(${parties.name}) LIKE LOWER(${'%' + search + '%'})` : sql`1=1`
      )
    ).orderBy(desc(parties.createdAt));

    // Calculate outstanding balances for each party
    const enrichedParties = await Promise.all(partyList.map(async (party) => {
      // 1. Invoices balance (Receivables)
      const invQuery = await db.select({
        total: sql<string>`sum(${invoices.totalAmount})`,
        paid: sql<string>`sum(${invoices.paidAmount})`,
        balance: sql<string>`sum(${invoices.balanceAmount})`,
      }).from(invoices).where(
        and(
          eq(invoices.userId, userId),
          eq(invoices.partyName, party.name),
          eq(invoices.isDeleted, 0)
        )
      );

      // 2. Material supplies balance (Receivables from location supply tab)
      const supQuery = await db.select({
        total: sql<string>`sum(${materialSupplies.totalAmount})`,
        paid: sql<string>`sum(${materialSupplies.paidAmount})`,
        out: sql<string>`sum(${materialSupplies.outstandingAmount})`,
      }).from(materialSupplies).where(
        and(
          eq(materialSupplies.userId, userId),
          eq(materialSupplies.partyName, party.name),
          eq(materialSupplies.isDeleted, 0)
        )
      );

      // 3. Material purchases balance (Payables to suppliers)
      const purQuery = await db.select({
        total: sql<string>`sum(${materialPurchases.totalAmount})`,
        paid: sql<string>`sum(${materialPurchases.paidAmount})`,
        out: sql<string>`sum(${materialPurchases.outstandingAmount})`,
      }).from(materialPurchases).where(
        and(
          eq(materialPurchases.userId, userId),
          eq(materialPurchases.partyName, party.name),
          eq(materialPurchases.isDeleted, 0)
        )
      );

      const invBal = parseFloat(invQuery[0]?.balance || '0');
      const supOut = parseFloat(supQuery[0]?.out || '0');
      const purOut = parseFloat(purQuery[0]?.out || '0');
      const opBal = parseFloat(party.openingBalance || '0');
      const opReceivable = party.openingBalanceType === 'TO_RECEIVE' ? opBal : 0;
      const opPayable = party.openingBalanceType === 'TO_PAY' ? opBal : 0;

      const totalReceivable = invBal + supOut + opReceivable;
      const totalPayable = purOut + opPayable;
      const netOutstanding = totalReceivable - totalPayable; // positive means they owe us, negative means we owe them

      return {
        ...party,
        totalReceivable: Math.round(totalReceivable * 100) / 100,
        totalPayable: Math.round(totalPayable * 100) / 100,
        netOutstanding: Math.round(netOutstanding * 100) / 100,
        currentBalance: Math.abs(Math.round(netOutstanding * 100) / 100).toFixed(2),
        currentBalanceType: netOutstanding > 0 ? 'TO_RECEIVE' : netOutstanding < 0 ? 'TO_PAY' : 'SETTLED',
      };
    }));

    res.json(enrichedParties);
  } catch (err) {
    console.error('Failed to fetch parties:', err);
    res.status(500).json({ error: "Failed to fetch parties" });
  }
});

// GET /api/master/parties/:id/ledger - Full Party Statement of Account
masterRouter.get('/parties/:id/ledger', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const partyId = parseInt(String(req.params.id), 10);
    if (isNaN(partyId)) return res.status(400).json({ error: 'Valid party ID required' });

    const partyRes = await db.select().from(parties).where(
      and(eq(parties.id, partyId), eq(parties.userId, userId), eq(parties.isDeleted, 0))
    );
    if (partyRes.length === 0) return res.status(404).json({ error: 'Party not found' });
    const party = partyRes[0];

    // Fetch all transactions involving this party
    const [invList, supList, purList, payList] = await Promise.all([
      db.select().from(invoices).where(and(eq(invoices.userId, userId), eq(invoices.partyName, party.name), eq(invoices.isDeleted, 0))),
      db.select().from(materialSupplies).where(and(eq(materialSupplies.userId, userId), eq(materialSupplies.partyName, party.name), eq(materialSupplies.isDeleted, 0))),
      db.select().from(materialPurchases).where(and(eq(materialPurchases.userId, userId), eq(materialPurchases.partyName, party.name), eq(materialPurchases.isDeleted, 0))),
      db.select().from(payments).where(and(eq(payments.userId, userId), eq(payments.partyName, party.name), eq(payments.isDeleted, 0))),
    ]);

    type LedgerEntry = {
      date: string;
      type: string;
      voucherNo: string;
      description: string;
      debit: number;  // increases what they owe us (Sales, Supplies)
      credit: number; // decreases what they owe us (Receipts, Purchases)
    };

    const entries: LedgerEntry[] = [];

    // Opening Balance
    const opBal = parseFloat(party.openingBalance || '0');
    if (opBal > 0) {
      entries.push({
        date: party.createdAt ? new Date(party.createdAt).toISOString().split('T')[0] : '2025-01-01',
        type: 'Opening Balance',
        voucherNo: 'OP-BAL',
        description: 'Opening Balance',
        debit: party.openingBalanceType === 'TO_RECEIVE' ? opBal : 0,
        credit: party.openingBalanceType === 'TO_PAY' ? opBal : 0,
      });
    }

    // Invoices (Debit - Sale)
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

    // Material Supplies (Debit - Sale)
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

    // Material Purchases (Credit - We owe them)
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

    // Payments (Payment In = Credit reducing receivable; Payment Out = Debit reducing payable)
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

    // Sort entries chronologically
    entries.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate running balance
    let runningBalance = 0;
    const ledgerWithRunningBalance = entries.map(entry => {
      runningBalance += (entry.debit - entry.credit);
      return {
        ...entry,
        runningBalance: Math.round(runningBalance * 100) / 100,
      };
    });

    res.json({
      party,
      ledger: ledgerWithRunningBalance,
      totalDebit: entries.reduce((s, e) => s + e.debit, 0),
      totalCredit: entries.reduce((s, e) => s + e.credit, 0),
      closingBalance: Math.round(runningBalance * 100) / 100,
    });
  } catch (err) {
    console.error('Failed to generate ledger:', err);
    res.status(500).json({ error: 'Failed to generate party ledger' });
  }
});

// POST /api/master/parties - Create party
masterRouter.post('/parties', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const data = partySchema.parse(req.body);

    const inserted = await db.insert(parties).values({
      userId,
      locationId: data.locationId || null,
      name: data.name,
      partyType: data.partyType,
      phone: data.phone || null,
      email: data.email || null,
      pan: data.pan || null,
      state: data.state || 'Gujarat',
      stateCode: data.stateCode || '24',
      address: data.address || null,
      gst: data.gst || null,
      openingBalance: data.openingBalance.toString(),
      openingBalanceType: data.openingBalanceType,
      notes: data.notes || null,
    }).returning();

    await db.insert(auditLogs).values({
      userId,
      action: 'CREATE_PARTY',
      entityType: 'PARTY',
      entityId: inserted[0].id,
      metadata: JSON.stringify({ name: data.name, partyType: data.partyType })
    });

    res.status(201).json(inserted[0]);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "Failed to create party" });
  }
});

// PUT /api/master/parties/:id - Update party
masterRouter.put('/parties/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid party ID' });

    const data = partySchema.parse(req.body);

    const updated = await db.update(parties).set({
      name: data.name,
      partyType: data.partyType,
      phone: data.phone || null,
      email: data.email || null,
      pan: data.pan || null,
      state: data.state || 'Gujarat',
      stateCode: data.stateCode || '24',
      address: data.address || null,
      gst: data.gst || null,
      openingBalance: data.openingBalance.toString(),
      openingBalanceType: data.openingBalanceType,
      notes: data.notes || null,
    }).where(and(eq(parties.id, id), eq(parties.userId, userId))).returning();

    if (updated.length === 0) return res.status(404).json({ error: 'Party not found' });
    res.json(updated[0]);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "Failed to update party" });
  }
});

// DELETE /api/master/parties/:id - Soft delete party
masterRouter.delete('/parties/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid party ID' });

    await db.update(parties)
      .set({ isDeleted: 1 })
      .where(and(eq(parties.id, id), eq(parties.userId, userId)));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete party" });
  }
});

// Teams
masterRouter.get('/teams', async (req: AuthRequest, res: Response) => {
  try {
    const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
    const records = await db.select().from(labourTeams).where(
      and(
        eq(labourTeams.userId, req.dbUser!.id),
        locationId ? eq(labourTeams.locationId, locationId) : sql`1=1`,
        eq(labourTeams.isDeleted, 0)
      )
    );
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});

masterRouter.post('/teams', async (req: AuthRequest, res: Response) => {
  try {
    const { name, locationId } = req.body;
    if (!name || !locationId) return res.status(400).json({ error: "Name and Location ID required" });
    const inserted = await db.insert(labourTeams).values({ name, locationId, userId: req.dbUser!.id }).returning();
    await db.insert(auditLogs).values({ userId: req.dbUser!.id, action: 'CREATE_TEAM', entityType: 'TEAM', entityId: inserted[0].id, metadata: JSON.stringify({ name, locationId }) });
    res.status(201).json(inserted[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create team" });
  }
});

export default masterRouter;
