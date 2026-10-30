import { Router, type Response } from 'express';
import { requireAuth, requireCategoryAuth, type AuthRequest } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { 
  investmentParties, investmentTransactions, auditLogs,
  materialPurchases, materialSupplies, siteSupplies,
  labourSalaries, supervisorCosts, records,
  investors, investorTransactions as globalInvTx, investorLocationAllocations,
  locations, contractorCosts
} from '../../db/schema.ts';
import { eq, and, or, desc, sql, ne } from 'drizzle-orm';
import { z } from 'zod';
import { assertLocationAccess } from '../lib/locationAuth.ts';
import { getAdminCapitalSummary, getOrCreateCentralLocation } from '../lib/accounting.ts';

const investmentRouter = Router();
investmentRouter.use(requireAuth);
investmentRouter.use(requireCategoryAuth);

const partySchema = z.object({
  locationId: z.number().int().positive().optional(),
  partyName: z.string().min(1).max(100),
  initialAmount: z.union([z.number(), z.string()]).transform(Number).optional(),
  initialDate: z.string().optional()
});

const txSchema = z.object({
  partyId: z.number().int().positive(),
  type: z.enum(['INVESTMENT', 'UPAD', 'PAYMENT', 'CONTRIBUTION']),
  amount: z.union([z.number().positive(), z.string().regex(/^\d+(\.\d{1,2})?$/)]).transform(Number),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
});

/**
 * GET /api/investments/admin-capital-summary
 * Returns central Admin Capital pool metrics:
 * Total Contributed, Withdrawn, Allocated to Locations, Material Purchases, Available Balance, and Investor-level metrics
 */
investmentRouter.get('/admin-capital-summary', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const summary = await getAdminCapitalSummary(db, userId);
    res.json(summary);
  } catch (error: any) {
    console.error('[Admin Capital Summary GET Error]', error);
    res.status(500).json({ error: 'Failed to calculate admin capital summary' });
  }
});

// --- GLOBAL INVESTORS ENDPOINTS ---

/**
 * GET /api/investments/global-investors
 * Returns all global investors for this user with real-time balance calculations:
 * Total Capital (Contributions) - Total Upad - Total Allocated = Available Balance
 */
investmentRouter.get('/global-investors', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const allInvestors = await db.select().from(investors).where(
      eq(investors.isDeleted, 0)
    ).orderBy(desc(investors.createdAt));

    const investorIds = allInvestors.map(i => i.id);

    let allTxs: any[] = [];
    let allAllocs: any[] = [];

    if (investorIds.length > 0) {
      allTxs = await db.select().from(globalInvTx).where(
        and(
          sql`${globalInvTx.investorId} IN (${sql.join(investorIds, sql`, `)})`,
          eq(globalInvTx.isDeleted, 0)
        )
      ).orderBy(desc(globalInvTx.date), desc(globalInvTx.id));

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
        createdAt: investorLocationAllocations.createdAt,
      })
      .from(investorLocationAllocations)
      .innerJoin(locations, eq(investorLocationAllocations.locationId, locations.id))
      .where(
        and(
          sql`${investorLocationAllocations.investorId} IN (${sql.join(investorIds, sql`, `)})`,
          eq(investorLocationAllocations.isDeleted, 0)
        )
      ).orderBy(desc(investorLocationAllocations.date));
    }

    const result = allInvestors.map(inv => {
      const txs = allTxs.filter(t => t.investorId === inv.id);
      const allocs = allAllocs.filter(a => a.investorId === inv.id);

      const totalCapital = Math.round(
        txs.filter(t => t.type === 'CONTRIBUTION' || t.type === 'CAPITAL' || t.type === 'INVESTMENT')
           .reduce((acc, t) => acc + (parseFloat(String(t.amount || 0)) || 0), 0) * 100
      ) / 100;

      const totalUpad = Math.round(
        txs.filter(t => t.type === 'UPAD' || t.type === 'WITHDRAWAL' || t.type === 'PAYMENT')
           .reduce((acc, t) => acc + (parseFloat(String(t.amount || 0)) || 0), 0) * 100
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
  } catch (error: any) {
    console.warn('[Global Investors GET Notice] Database query fallback:', error?.message || error);
    res.json([]);
  }
});

/**
 * POST /api/investments/global-investors
 * Create a new global investor
 */
investmentRouter.post('/global-investors', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, mobile, email, address, notes, initialContribution, initialDate, paymentMethod, referenceNumber } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Investor Name is required' });

    const cleanName = String(name).trim().toUpperCase();

    const existingGlobal = await db.select().from(investors).where(
      and(
        eq(investors.isDeleted, 0),
        sql`UPPER(${investors.name}) = ${cleanName}`
      )
    ).limit(1);

    let newInvestor: any;
    let isExisting = false;

    if (existingGlobal.length > 0) {
      newInvestor = existingGlobal[0];
      isExisting = true;
      if (newInvestor.name !== cleanName) {
        await db.update(investors).set({ name: cleanName, updatedAt: new Date() }).where(eq(investors.id, newInvestor.id));
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
      await db.insert(globalInvTx).values({
        investorId: newInvestor.id,
        userId,
        type: 'CONTRIBUTION',
        amount: String(initAmt),
        date: initialDate || new Date().toISOString().split('T')[0],
        paymentMethod: paymentMethod || 'Bank Transfer',
        referenceNumber: referenceNumber || null,
        description: isExisting ? 'Additional Capital Contribution' : 'Initial Capital Contribution',
        isDeleted: 0
      });
    }

    await db.insert(auditLogs).values({
      userId,
      action: isExisting ? 'ADD_CAPITAL_TO_EXISTING_INVESTOR' : 'CREATE_GLOBAL_INVESTOR',
      entityType: 'INVESTMENT',
      entityId: newInvestor.id,
      metadata: JSON.stringify({ name: cleanName, initialContribution: initAmt, isExisting })
    });

    res.status(isExisting ? 200 : 201).json({ ...newInvestor, isExisting });
  } catch (error: any) {
    console.error('[Global Investor POST Error]', error);
    res.status(400).json({ error: error?.message || 'Failed to create investor' });
  }
});

/**
 * PUT /api/investments/global-investors/:id
 * Update global investor profile
 */
investmentRouter.put('/global-investors/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Valid ID required' });

    const { name, mobile, email, address, notes } = req.body;

    const updated = await db.update(investors).set({
      ...(name !== undefined && { name: String(name).trim() }),
      ...(mobile !== undefined && { mobile: mobile ? String(mobile).trim() : null }),
      ...(email !== undefined && { email: email ? String(email).trim() : null }),
      ...(address !== undefined && { address: address ? String(address).trim() : null }),
      ...(notes !== undefined && { notes: notes ? String(notes).trim() : null }),
      updatedAt: new Date()
    }).where(and(eq(investors.id, id), eq(investors.isDeleted, 0))).returning();

    if (!updated.length) return res.status(404).json({ error: 'Investor not found' });

    res.json(updated[0]);
  } catch (error: any) {
    console.error('[Global Investor PUT Error]', error);
    res.status(400).json({ error: error?.message || 'Failed to update investor' });
  }
});

/**
 * DELETE /api/investments/global-investors/:id
 * Soft delete global investor
 */
investmentRouter.delete('/global-investors/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Valid ID required' });

    const updated = await db.update(investors).set({
      isDeleted: 1,
      updatedAt: new Date()
    }).where(and(eq(investors.id, id), eq(investors.isDeleted, 0))).returning();

    if (!updated.length) return res.status(404).json({ error: 'Investor not found' });

    res.json({ success: true, message: 'Investor deleted successfully' });
  } catch (error: any) {
    console.error('[Global Investor DELETE Error]', error);
    res.status(500).json({ error: 'Failed to delete investor' });
  }
});

/**
 * POST /api/investments/global-transactions
 * Add Contribution (Admin Capital Inflow) or Upad (Admin Capital Withdrawal)
 * Called by AdminPage Inflow / Outflow modals
 */
investmentRouter.post('/global-transactions', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const rawInvId = req.body.investorId || req.body.partyId;
    const investorId = parseInt(String(rawInvId), 10);
    if (isNaN(investorId)) return res.status(400).json({ error: 'Valid investor ID required' });

    const { type, amount, date, paymentMethod, referenceNumber, description, notes } = req.body;
    const parsedAmount = parseFloat(String(amount));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive amount required' });
    }

    const txType = String(type || 'CONTRIBUTION').toUpperCase();
    if (!['CONTRIBUTION', 'UPAD', 'CAPITAL', 'WITHDRAWAL', 'INVESTMENT', 'PAYMENT'].includes(txType)) {
      return res.status(400).json({ error: 'Invalid transaction type' });
    }

    const normalizedType = (txType === 'CAPITAL' || txType === 'INVESTMENT') ? 'CONTRIBUTION' : ((txType === 'WITHDRAWAL' || txType === 'PAYMENT') ? 'UPAD' : txType);

    const inserted = await db.insert(globalInvTx).values({
      investorId,
      userId,
      type: normalizedType,
      amount: String(parsedAmount),
      date: date || new Date().toISOString().split('T')[0],
      paymentMethod: paymentMethod || 'Bank Transfer',
      referenceNumber: referenceNumber || null,
      description: description || notes || null,
      isDeleted: 0
    }).returning();

    await db.insert(auditLogs).values({
      userId,
      action: normalizedType === 'CONTRIBUTION' ? 'ADMIN_CAPITAL_CONTRIBUTION' : 'ADMIN_CAPITAL_WITHDRAWAL',
      entityType: 'INVESTMENT',
      entityId: inserted[0].id,
      metadata: JSON.stringify({ investorId, amount: parsedAmount, type: normalizedType })
    });

    res.status(201).json(inserted[0]);
  } catch (error: any) {
    console.error('[Global Transaction POST Error]', error);
    res.status(400).json({ error: error?.message || 'Failed to record transaction' });
  }
});

/**
 * GET /api/investments/global-transactions
 * List global investor transactions
 */
investmentRouter.get('/global-transactions', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const investorIdParam = req.query.investorId as string | undefined;
    const invId = investorIdParam ? parseInt(investorIdParam, 10) : undefined;

    const records = await db.select({
      id: globalInvTx.id,
      investorId: globalInvTx.investorId,
      investorName: investors.name,
      userId: globalInvTx.userId,
      type: globalInvTx.type,
      amount: globalInvTx.amount,
      date: globalInvTx.date,
      paymentMethod: globalInvTx.paymentMethod,
      referenceNumber: globalInvTx.referenceNumber,
      description: globalInvTx.description,
      createdAt: globalInvTx.createdAt,
    }).from(globalInvTx)
      .innerJoin(investors, eq(globalInvTx.investorId, investors.id))
      .where(
        and(
          eq(globalInvTx.isDeleted, 0),
          invId ? eq(globalInvTx.investorId, invId) : sql`1=1`
        )
      )
      .orderBy(desc(globalInvTx.date), desc(globalInvTx.id));

    res.json(records);
  } catch (error: any) {
    console.error('[Global Transactions GET Error]', error);
    res.status(500).json({ error: 'Failed to fetch global transactions' });
  }
});

/**
 * PUT /api/investments/global-transactions/:txId
 */
investmentRouter.put('/global-transactions/:txId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const txId = parseInt(String(req.params.txId), 10);
    if (isNaN(txId)) return res.status(400).json({ error: 'Valid transaction ID required' });

    const { type, amount, date, paymentMethod, referenceNumber, description, notes } = req.body;
    const updateData: any = {};
    if (amount !== undefined) {
      const parsedAmount = parseFloat(String(amount));
      if (isNaN(parsedAmount) || parsedAmount <= 0) return res.status(400).json({ error: 'Valid positive amount required' });
      updateData.amount = String(parsedAmount);
    }
    if (type) {
      const txType = String(type).toUpperCase();
      updateData.type = (txType === 'CAPITAL' || txType === 'INVESTMENT') ? 'CONTRIBUTION' : ((txType === 'WITHDRAWAL' || txType === 'PAYMENT') ? 'UPAD' : txType);
    }
    if (date) updateData.date = date;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (referenceNumber !== undefined) updateData.referenceNumber = referenceNumber;
    if (description !== undefined || notes !== undefined) updateData.description = description || notes || null;

    const updated = await db.update(globalInvTx).set(updateData)
      .where(and(eq(globalInvTx.id, txId), eq(globalInvTx.isDeleted, 0)))
      .returning();

    if (updated.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json(updated[0]);
  } catch (error: any) {
    console.error('[Global Tx PUT Error]', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

/**
 * DELETE /api/investments/global-transactions/:txId
 */
investmentRouter.delete('/global-transactions/:txId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const txId = parseInt(String(req.params.txId), 10);
    if (isNaN(txId)) return res.status(400).json({ error: 'Valid transaction ID required' });

    await db.update(globalInvTx).set({ isDeleted: 1 })
      .where(eq(globalInvTx.id, txId));

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Global Tx DELETE Error]', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

/**
 * POST /api/investments/global-investors/:id/transactions
 * Add Contribution (Capital) or Upad (Withdrawal)
 */
investmentRouter.post('/global-investors/:id/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const investorId = parseInt(String(req.params.id), 10);
    if (isNaN(investorId)) return res.status(400).json({ error: 'Valid investor ID required' });

    const { type, amount, date, paymentMethod, referenceNumber, description, notes } = req.body;
    const parsedAmount = parseFloat(String(amount));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive amount required' });
    }

    const txType = String(type || 'CONTRIBUTION').toUpperCase();
    if (!['CONTRIBUTION', 'UPAD', 'CAPITAL', 'WITHDRAWAL', 'INVESTMENT', 'PAYMENT'].includes(txType)) {
      return res.status(400).json({ error: 'Invalid transaction type' });
    }

    const normalizedType = (txType === 'CAPITAL' || txType === 'INVESTMENT') ? 'CONTRIBUTION' : ((txType === 'WITHDRAWAL' || txType === 'PAYMENT') ? 'UPAD' : txType);

    const inserted = await db.insert(globalInvTx).values({
      investorId,
      userId,
      type: normalizedType,
      amount: String(parsedAmount),
      date: date || new Date().toISOString().split('T')[0],
      paymentMethod: paymentMethod || 'Bank Transfer',
      referenceNumber: referenceNumber || null,
      description: description || notes || null,
      isDeleted: 0
    }).returning();

    await db.insert(auditLogs).values({
      userId,
      action: normalizedType === 'CONTRIBUTION' ? 'ADMIN_CAPITAL_CONTRIBUTION' : 'ADMIN_CAPITAL_WITHDRAWAL',
      entityType: 'INVESTMENT',
      entityId: inserted[0].id,
      metadata: JSON.stringify({ investorId, amount: parsedAmount, type: normalizedType })
    });

    res.status(201).json(inserted[0]);
  } catch (error: any) {
    console.error('[Investor Tx POST Error]', error);
    res.status(400).json({ error: error?.message || 'Failed to add investor transaction' });
  }
});

/**
 * DELETE /api/investments/global-investors/transactions/:txId
 */
investmentRouter.delete('/global-investors/transactions/:txId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const txId = parseInt(String(req.params.txId), 10);
    if (isNaN(txId)) return res.status(400).json({ error: 'Valid transaction ID required' });

    await db.update(globalInvTx).set({ isDeleted: 1 })
      .where(eq(globalInvTx.id, txId));

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Investor Tx DELETE Error]', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

/**
 * GET /api/investments/location-allocations?locationId=X
 * Category 1 Part 1: List all capital allocations from investors to this location
 */
investmentRouter.get('/location-allocations', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const locParam = req.query.locationId as string | undefined;
    const locationId = (locParam && locParam !== 'ALL' && locParam !== '0' && !isNaN(parseInt(locParam, 10)))
      ? parseInt(locParam, 10)
      : undefined;

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
      createdAt: investorLocationAllocations.createdAt,
    })
    .from(investorLocationAllocations)
    .innerJoin(investors, eq(investorLocationAllocations.investorId, investors.id))
    .where(
      and(
        locationId ? eq(investorLocationAllocations.locationId, locationId) : undefined,
        eq(investorLocationAllocations.isDeleted, 0)
      )
    )
    .orderBy(desc(investorLocationAllocations.date), desc(investorLocationAllocations.id));

    res.json(allocs);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('[Location Allocations GET Error]', error);
    res.status(500).json({ error: 'Failed to fetch location allocations' });
  }
});

/**
 * POST /api/investments/location-allocations
 * Category 1 Part 1: Allocate capital from global investor to a location
 * Atomic transaction: Verifies Admin Capital & unallocated Investor balance inside transaction.
 */
investmentRouter.post('/location-allocations', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { investorId, locationId, amount, date, paymentMethod, referenceNumber, notes } = req.body;
    const invId = parseInt(String(investorId), 10);
    const locId = parseInt(String(locationId), 10);
    const allocAmount = parseFloat(String(amount));

    if (isNaN(locId) || locId <= 0) {
      return res.status(400).json({ error: 'Please select a project location' });
    }

    if (isNaN(invId) || isNaN(allocAmount) || allocAmount <= 0) {
      return res.status(400).json({ error: 'Valid investor and positive amount are required' });
    }

    await assertLocationAccess(userId, locId);

    const result = await db.transaction(async (tx) => {
      // 1. Verify investor exists
      let invName = 'Investor';
      const globalInv = await tx.select().from(investors).where(
        and(eq(investors.id, invId), eq(investors.isDeleted, 0))
      ).limit(1);

      if (globalInv.length > 0) {
        invName = globalInv[0].name;
      } else {
        const partyInv = await tx.select().from(investmentParties).where(
          and(eq(investmentParties.id, invId), eq(investmentParties.isDeleted, 0))
        ).limit(1);
        if (partyInv.length > 0) {
          invName = partyInv[0].partyName;
        } else {
          throw new Error('Investor not found');
        }
      }

      // 2. 3-Tier Capital Validation inside transaction: Check available Admin Capital & Investor unallocated capital
      const adminSummary = await getAdminCapitalSummary(tx, userId);
      if (allocAmount > adminSummary.availableAdminCapital) {
        throw new Error(
          `Cannot transfer ₹${allocAmount.toLocaleString('en-IN')}: Exceeds available Admin Capital (₹${adminSummary.availableAdminCapital.toLocaleString('en-IN')}).`
        );
      }

      const invSummary = adminSummary.investors.find(i => i.id === invId);
      const avail = invSummary ? invSummary.availableCapital : 0;
      if (!invSummary || allocAmount > avail) {
        throw new Error(
          `Cannot transfer ₹${allocAmount.toLocaleString('en-IN')}: Selected investor ${invName} has only ₹${avail.toLocaleString('en-IN')} unallocated Admin Capital available.`
        );
      }

      // 3. Insert allocation record
      const inserted = await tx.insert(investorLocationAllocations).values({
        investorId: invId,
        locationId: locId,
        userId,
        amount: String(allocAmount),
        date: date || new Date().toISOString().split('T')[0],
        paymentMethod: paymentMethod || 'Bank Transfer',
        referenceNumber: referenceNumber || null,
        notes: notes || null,
        isDeleted: 0
      }).returning();

      // 4. Auto-sync into Category 1 Location Investment Parties (for selection in Add Investment Capital)
      const existingParty = await tx.select().from(investmentParties).where(
        and(
          eq(investmentParties.locationId, locId),
          sql`UPPER(${investmentParties.partyName}) = ${invName.toUpperCase()}`,
          eq(investmentParties.isDeleted, 0)
        )
      ).limit(1);

      if (existingParty.length === 0) {
        await tx.insert(investmentParties).values({
          userId,
          locationId: locId,
          partyName: invName.toUpperCase(),
        });
      }

      // 5. Audit log
      await tx.insert(auditLogs).values({
        userId,
        action: 'ALLOCATE_INVESTOR_CAPITAL',
        entityType: 'INVESTMENT',
        entityId: inserted[0].id,
        metadata: JSON.stringify({ investorId: invId, locationId: locId, amount: allocAmount })
      });

      return inserted[0];
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('[Location Allocation POST Error]', error);
    res.status(400).json({ error: error?.message || 'Failed to allocate capital' });
  }
});

/**
 * DELETE /api/investments/location-allocations/:id
 * Atomic rollback & integrity check:
 * Prevents deleting allocation if capital has already been deployed into Location Investment Capital.
 */
investmentRouter.delete('/location-allocations/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Valid ID required' });

    await db.transaction(async (tx) => {
      const existing = await tx.select().from(investorLocationAllocations)
        .where(and(eq(investorLocationAllocations.id, id), eq(investorLocationAllocations.isDeleted, 0)))
        .limit(1);
      if (!existing.length) throw new Error('Allocation record not found');

      const alloc = existing[0];
      if (alloc.locationId && alloc.locationId > 0) {
        await assertLocationAccess(userId, alloc.locationId);
      }

      // Verify that deleting this allocation will not cause negative investor capital at this location
      const invRow = await tx.select({ name: investors.name }).from(investors).where(eq(investors.id, alloc.investorId)).limit(1);
      const investorName = invRow[0]?.name ? invRow[0].name.trim().toUpperCase() : '';

      if (investorName && alloc.locationId) {
        // Query total allocations for this investor at this location
        const allocQuery = await tx.select({
          total: sql<string>`COALESCE(SUM(CAST(${investorLocationAllocations.amount} AS numeric)), 0)`
        }).from(investorLocationAllocations)
          .where(and(
            eq(investorLocationAllocations.locationId, alloc.locationId),
            eq(investorLocationAllocations.investorId, alloc.investorId),
            eq(investorLocationAllocations.isDeleted, 0)
          ));
        const totalAllocated = parseFloat(allocQuery[0]?.total || '0');

        // Query total already deployed into project investment capital
        const deployedQuery = await tx.select({
          total: sql<string>`COALESCE(SUM(CAST(${investmentTransactions.amount} AS numeric)), 0)`
        }).from(investmentTransactions)
          .innerJoin(investmentParties, eq(investmentTransactions.partyId, investmentParties.id))
          .where(and(
            eq(investmentParties.locationId, alloc.locationId),
            sql`UPPER(${investmentParties.partyName}) = ${investorName}`,
            eq(investmentTransactions.type, 'INVESTMENT'),
            eq(investmentTransactions.isDeleted, 0),
            eq(investmentParties.isDeleted, 0)
          ));
        const alreadyInvested = parseFloat(deployedQuery[0]?.total || '0');

        const allocAmt = parseFloat(String(alloc.amount || 0));
        const remainingIfDeleted = Math.round((totalAllocated - allocAmt) * 100) / 100;
        if (remainingIfDeleted < alreadyInvested) {
          throw new Error(
            `Cannot delete allocation of ₹${allocAmt.toLocaleString('en-IN')}: ₹${alreadyInvested.toLocaleString('en-IN')} has already been invested into project investment capital. Please reverse/delete the project investment first.`
          );
        }
      }

      await tx.update(investorLocationAllocations).set({ isDeleted: 1 })
        .where(eq(investorLocationAllocations.id, id));

      await tx.insert(auditLogs).values({
        userId,
        action: 'DELETE_LOCATION_ALLOCATION',
        entityType: 'INVESTMENT',
        entityId: id,
        metadata: JSON.stringify({ allocationId: id, amount: alloc.amount, locationId: alloc.locationId })
      });
    });

    res.json({ success: true, message: 'Allocation deleted successfully' });
  } catch (error: any) {
    console.error('[Location Allocation DELETE Error]', error);
    res.status(400).json({ error: error?.message || 'Failed to delete allocation' });
  }
});

/**
 * PUT /api/investments/location-allocations/:id
 * Edit an existing capital allocation to location
 */
investmentRouter.put('/location-allocations/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Valid ID required' });

    const { investorId, amount, date, paymentMethod, referenceNumber, notes } = req.body;
    const newAmount = parseFloat(String(amount));
    if (isNaN(newAmount) || newAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive amount is required' });
    }

    const updated = await db.transaction(async (tx) => {
      const existing = await tx.select().from(investorLocationAllocations)
        .where(and(eq(investorLocationAllocations.id, id), eq(investorLocationAllocations.isDeleted, 0)))
        .limit(1);
      if (!existing.length) throw new Error('Allocation record not found');

      const alloc = existing[0];
      if (alloc.locationId && alloc.locationId > 0) {
        await assertLocationAccess(userId, alloc.locationId);
      }

      const oldAmount = parseFloat(String(alloc.amount || 0)) || 0;
      const targetInvestorId = investorId ? parseInt(String(investorId), 10) : alloc.investorId;
      const isSameInvestor = targetInvestorId === alloc.investorId;

      // Validate against Admin Capital & Investor available balance (adding back oldAmount)
      const adminSummary = await getAdminCapitalSummary(tx, userId);
      const effectiveAdminAvailable = Math.round((adminSummary.availableAdminCapital + oldAmount) * 100) / 100;
      if (newAmount > effectiveAdminAvailable) {
        throw new Error(
          `Cannot update allocation to ₹${newAmount.toLocaleString('en-IN')}: Exceeds available Admin Capital (₹${effectiveAdminAvailable.toLocaleString('en-IN')}).`
        );
      }

      const invSummary = adminSummary.investors.find(i => i.id === targetInvestorId);
      if (invSummary) {
        const effectiveInvestorAvailable = Math.round((invSummary.availableCapital + (isSameInvestor ? oldAmount : 0)) * 100) / 100;
        if (newAmount > effectiveInvestorAvailable) {
          throw new Error(
            `Cannot update allocation to ₹${newAmount.toLocaleString('en-IN')}: Selected investor ${invSummary.name} has only ₹${effectiveInvestorAvailable.toLocaleString('en-IN')} available.`
          );
        }
      }

      // Check that reducing amount or changing investor does not fall below already-invested Category 2 capital
      if (alloc.locationId && (!isSameInvestor || newAmount < oldAmount)) {
        const oldInvRow = await tx.select({ name: investors.name }).from(investors).where(eq(investors.id, alloc.investorId)).limit(1);
        const oldInvName = oldInvRow[0]?.name ? oldInvRow[0].name.trim().toUpperCase() : '';
        if (oldInvName) {
          const allocQuery = await tx.select({
            total: sql<string>`COALESCE(SUM(CAST(${investorLocationAllocations.amount} AS numeric)), 0)`
          }).from(investorLocationAllocations)
            .where(and(
              eq(investorLocationAllocations.locationId, alloc.locationId),
              eq(investorLocationAllocations.investorId, alloc.investorId),
              eq(investorLocationAllocations.isDeleted, 0)
            ));
          const totalAllocated = parseFloat(allocQuery[0]?.total || '0') || 0;

          const deployedQuery = await tx.select({
            total: sql<string>`COALESCE(SUM(CAST(${investmentTransactions.amount} AS numeric)), 0)`
          }).from(investmentTransactions)
            .innerJoin(investmentParties, eq(investmentTransactions.partyId, investmentParties.id))
            .where(and(
              eq(investmentParties.locationId, alloc.locationId),
              sql`UPPER(${investmentParties.partyName}) = ${oldInvName}`,
              eq(investmentTransactions.type, 'INVESTMENT'),
              eq(investmentTransactions.isDeleted, 0),
              eq(investmentParties.isDeleted, 0)
            ));
          const alreadyInvested = parseFloat(deployedQuery[0]?.total || '0') || 0;

          const newTotalForOldInv = isSameInvestor
            ? Math.round((totalAllocated - oldAmount + newAmount) * 100) / 100
            : Math.round((totalAllocated - oldAmount) * 100) / 100;

          if (newTotalForOldInv < alreadyInvested) {
            throw new Error(
              `Cannot reduce allocation below ₹${alreadyInvested.toLocaleString('en-IN')}: That amount has already been deployed into Category 2 Investment Capital.`
            );
          }
        }
      }

      const [resRec] = await tx.update(investorLocationAllocations).set({
        investorId: targetInvestorId,
        amount: String(newAmount),
        date: date || alloc.date,
        paymentMethod: paymentMethod || alloc.paymentMethod,
        referenceNumber: referenceNumber !== undefined ? referenceNumber : alloc.referenceNumber,
        notes: notes !== undefined ? notes : alloc.notes
      }).where(eq(investorLocationAllocations.id, id)).returning();

      await tx.insert(auditLogs).values({
        userId,
        action: 'UPDATE_LOCATION_ALLOCATION',
        entityType: 'INVESTMENT',
        entityId: id,
        metadata: JSON.stringify({ allocationId: id, oldAmount: alloc.amount, newAmount, investorId: targetInvestorId })
      });

      return resRec;
    });

    res.json(updated);
  } catch (error: any) {
    console.error('[Location Allocation PUT Error]', error);
    res.status(400).json({ error: error?.message || 'Failed to update allocation' });
  }
});

/**
 * POST /api/investments/transfer-to-investment-capital
 * Transfers capital from Location Investor Capital to Location Investment Capital (Tier 2 -> Tier 3)
 * Workflow:
 * Location -> Investment Capital -> Add Investment Capital From Investors
 * -> Select Investor -> Enter Amount
 * -> Atomically verifies available Investor Capital at this location inside transaction
 * -> Decreases available Investor Capital
 * -> Increases Location Investment Capital
 * -> Realtime sync & audit log
 */
investmentRouter.post('/transfer-to-investment-capital', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { locationId, partyId, investorId, amount, date, paymentMethod, referenceNumber, notes } = req.body;
    const locId = parseInt(String(locationId), 10);
    const transferAmount = parseFloat(String(amount));

    if (isNaN(locId) || locId <= 0) {
      return res.status(400).json({ error: 'Valid Location ID is required' });
    }
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive transfer amount is required' });
    }

    await assertLocationAccess(userId, locId);

    const result = await db.transaction(async (tx) => {
      // 1. Resolve partyId from partyId or investorId
      let pId = partyId ? parseInt(String(partyId), 10) : null;
      let resolvedParty: any;

      if (pId && !isNaN(pId)) {
        const parties = await tx.select().from(investmentParties).where(
          and(eq(investmentParties.id, pId), eq(investmentParties.isDeleted, 0))
        ).limit(1);
        if (parties.length > 0) resolvedParty = parties[0];
      } else if (investorId) {
        const invId = parseInt(String(investorId), 10);
        const inv = await tx.select().from(investors).where(
          and(eq(investors.id, invId), eq(investors.isDeleted, 0))
        ).limit(1);
        if (inv.length > 0) {
          const cleanName = inv[0].name.trim().toUpperCase();
          const existingParty = await tx.select().from(investmentParties).where(
            and(
              eq(investmentParties.locationId, locId),
              sql`UPPER(${investmentParties.partyName}) = ${cleanName}`,
              eq(investmentParties.isDeleted, 0)
            )
          ).limit(1);
          if (existingParty.length > 0) {
            resolvedParty = existingParty[0];
            pId = existingParty[0].id;
          } else {
            const created = await tx.insert(investmentParties).values({
              userId,
              locationId: locId,
              partyName: cleanName
            }).returning();
            resolvedParty = created[0];
            pId = created[0].id;
          }
        }
      }

      if (!resolvedParty || !pId) {
        throw new Error('Investor / Party not found for this location');
      }

      // 2. Check investor's uninvested Investor Capital balance at this location
      const cleanName = resolvedParty.partyName.trim().toUpperCase();
      const allocRows = await tx.select({
        total: sql<string>`COALESCE(SUM(CAST(${investorLocationAllocations.amount} AS numeric)), 0)`
      })
      .from(investorLocationAllocations)
      .innerJoin(investors, eq(investorLocationAllocations.investorId, investors.id))
      .where(and(
        eq(investorLocationAllocations.locationId, locId),
        eq(investorLocationAllocations.isDeleted, 0),
        sql`UPPER(${investors.name}) = ${cleanName}`
      ));
      const cat7Allocated = parseFloat(allocRows[0]?.total || '0') || 0;

      const txRows = await tx.select({
        total: sql<string>`COALESCE(SUM(CAST(${investmentTransactions.amount} AS numeric)), 0)`
      })
      .from(investmentTransactions)
      .where(and(
        eq(investmentTransactions.partyId, pId),
        eq(investmentTransactions.type, 'INVESTMENT'),
        eq(investmentTransactions.isDeleted, 0)
      ));
      const alreadyInvested = parseFloat(txRows[0]?.total || '0') || 0;

      const availableInvestorCapital = Math.max(0, Math.round((cat7Allocated - alreadyInvested) * 100) / 100);

      if (transferAmount > availableInvestorCapital) {
        throw new Error(
          `Cannot transfer ₹${transferAmount.toLocaleString('en-IN')}: Selected investor ${resolvedParty.partyName} has only ₹${availableInvestorCapital.toLocaleString('en-IN')} available Investor Capital at this location.`
        );
      }

      // 3. Execute transfer atomically
      const insertedTx = await tx.insert(investmentTransactions).values({
        partyId: pId,
        userId,
        type: 'INVESTMENT',
        amount: String(transferAmount),
        date: date || new Date().toISOString().split('T')[0],
        paymentMethod: paymentMethod || 'Bank Transfer',
        referenceNumber: referenceNumber || null,
        description: notes ? `Investment into Project: ${notes}` : `Investment into Project (from ${resolvedParty.partyName})`,
        isDeleted: 0
      }).returning();

      // 4. Audit log
      await tx.insert(auditLogs).values({
        userId,
        action: 'INVESTOR_TO_INVESTMENT_TRANSFER',
        entityType: 'INVESTMENT',
        entityId: insertedTx[0].id,
        metadata: JSON.stringify({
          partyId: pId,
          locationId: locId,
          amount: transferAmount,
          investorName: resolvedParty.partyName
        })
      });

      return {
        transaction: insertedTx[0],
        remainingInvestorCapital: Math.round((availableInvestorCapital - transferAmount) * 100) / 100
      };
    });

    res.status(201).json({
      success: true,
      transaction: result.transaction,
      remainingInvestorCapital: result.remainingInvestorCapital
    });
  } catch (error: any) {
    console.error('[Transfer to Investment Capital POST Error]', error);
    res.status(400).json({ error: error?.message || 'Failed to transfer to investment capital' });
  }
});

/**
 * GET /api/investments/bills?locationId=X
 * Category 1 Part 2: Inflow from bills / invoices
 */
investmentRouter.get('/bills', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const locParam = req.query.locationId as string | undefined;
    const locationId = (locParam && locParam !== 'ALL' && locParam !== '0' && !isNaN(parseInt(locParam, 10)))
      ? parseInt(locParam, 10)
      : undefined;

    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }

    const bills = await db.select().from(records).where(
      and(
        locationId ? eq(records.locationId, locationId) : undefined,
        eq(records.isDeleted, 0),
        eq(records.type, 'INCOME'),
        eq(records.category, 'BILL_INVESTMENT')
      )
    ).orderBy(desc(records.date), desc(records.id));

    res.json(bills);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('[Investment Bills GET Error]', error);
    res.status(500).json({ error: 'Failed to fetch bill investments' });
  }
});

/**
 * POST /api/investments/bills
 * Category 1 Part 2: Add an investment from bill
 */
investmentRouter.post('/bills', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { locationId, partyName, amount, date, description, paymentMethod, referenceNumber } = req.body;
    const locId = parseInt(String(locationId), 10);
    const parsedAmount = parseFloat(String(amount));

    if (isNaN(locId) || locId <= 0) {
      return res.status(400).json({ error: 'Please select a project location' });
    }

    if (!partyName || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valid Party/Invoice Name and positive amount are required' });
    }

    await assertLocationAccess(userId, locId);

    const inserted = await db.insert(records).values({
      userId,
      locationId: locId,
      type: 'INCOME',
      category: 'BILL_INVESTMENT',
      partyName: String(partyName).trim(),
      amount: String(parsedAmount),
      date: date || new Date().toISOString().split('T')[0],
      description: description || null,
      paymentMethod: paymentMethod || 'Bank Transfer',
      referenceNumber: referenceNumber || null,
      isDeleted: 0
    }).returning();

    await db.insert(auditLogs).values({
      userId,
      action: 'CREATE_BILL_INVESTMENT',
      entityType: 'INVESTMENT',
      entityId: inserted[0].id,
      metadata: JSON.stringify({ locationId: locId, partyName, amount: parsedAmount })
    });

    res.status(201).json(inserted[0]);
  } catch (error: any) {
    console.error('[Investment Bills POST Error]', error);
    res.status(400).json({ error: error?.message || 'Failed to create bill investment' });
  }
});

investmentRouter.get('/parties', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const locationIdParam = req.query.locationId as string | undefined;
    const locationId = locationIdParam && locationIdParam !== 'ALL' && locationIdParam !== '0'
      ? parseInt(locationIdParam, 10)
      : undefined;

    if (locationId && !isNaN(locationId)) {
      await assertLocationAccess(userId, locationId);
    }

    // Auto-sync: if any investors were allocated to this location in Category 7 (investorLocationAllocations)
    // but don't yet exist in investmentParties, auto-create them so they are always visible in dropdowns
    if (locationId && !isNaN(locationId)) {
      const existingAllocs = await db.select({
        investorName: investors.name,
      })
      .from(investorLocationAllocations)
      .innerJoin(investors, eq(investorLocationAllocations.investorId, investors.id))
      .where(and(
        eq(investorLocationAllocations.locationId, locationId),
        eq(investorLocationAllocations.isDeleted, 0)
      ));

      for (const a of existingAllocs) {
        const clean = a.investorName.trim().toUpperCase();
        const exists = await db.select({ id: investmentParties.id }).from(investmentParties).where(
          and(
            eq(investmentParties.locationId, locationId),
            sql`UPPER(${investmentParties.partyName}) = ${clean}`,
            eq(investmentParties.isDeleted, 0)
          )
        ).limit(1);
        if (exists.length === 0) {
          await db.insert(investmentParties).values({
            userId,
            locationId,
            partyName: clean,
          });
        }
      }
    }

    const conditions = [
      eq(investmentParties.isDeleted, 0)
    ];

    if (locationId && !isNaN(locationId)) {
      conditions.push(eq(investmentParties.locationId, locationId));
    }

    const parties = await db.select({
      id: investmentParties.id,
      userId: investmentParties.userId,
      locationId: investmentParties.locationId,
      partyName: investmentParties.partyName,
      createdAt: investmentParties.createdAt,
      updatedAt: investmentParties.updatedAt,
      isDeleted: investmentParties.isDeleted,
      locationName: locations.name
    })
    .from(investmentParties)
    .leftJoin(locations, eq(investmentParties.locationId, locations.id))
    .where(and(...conditions))
    .orderBy(desc(investmentParties.createdAt));

    // Get Category 7 allocations grouped by investor name and location
    const cat7Allocs = await db.select({
      locationId: investorLocationAllocations.locationId,
      investorName: sql<string>`UPPER(${investors.name})`,
      total: sql<string>`COALESCE(SUM(CAST(${investorLocationAllocations.amount} AS numeric)), 0)`
    })
    .from(investorLocationAllocations)
    .innerJoin(investors, eq(investorLocationAllocations.investorId, investors.id))
    .where(and(
      locationId && !isNaN(locationId) ? eq(investorLocationAllocations.locationId, locationId) : undefined,
      eq(investorLocationAllocations.isDeleted, 0)
    ))
    .groupBy(investorLocationAllocations.locationId, sql`UPPER(${investors.name})`);

    // Get metrics for each party
    const partyIds = parties.map(p => p.id);
    let metrics: any[] = [];
    if (partyIds.length > 0) {
      metrics = await db.select({
        partyId: investmentTransactions.partyId,
        type: investmentTransactions.type,
        total: sql<string>`sum(${investmentTransactions.amount})`
      })
      .from(investmentTransactions)
      .where(and(
        sql`${investmentTransactions.partyId} IN (${sql.join(partyIds, sql`, `)})`,
        eq(investmentTransactions.isDeleted, 0)
      ))
      .groupBy(investmentTransactions.partyId, investmentTransactions.type);
    }

    const result = parties.map(p => {
      let totalInvestment = 0;
      let totalPayment = 0;
      let totalUpad = 0;
      let totalContribution = 0;
      
      metrics.filter(m => m.partyId === p.id).forEach(m => {
        if (m.type === 'CONTRIBUTION') totalContribution += parseFloat(m.total || '0');
        if (m.type === 'INVESTMENT') totalInvestment += parseFloat(m.total || '0');
        if (m.type === 'PAYMENT') totalPayment += parseFloat(m.total || '0');
        if (m.type === 'UPAD') totalUpad += parseFloat(m.total || '0');
      });

      const cleanName = p.partyName.trim().toUpperCase();
      const allocMatch = cat7Allocs.find(a => 
        a.investorName === cleanName && (!locationId || a.locationId === p.locationId)
      );
      const cat7Allocated = parseFloat(allocMatch?.total || '0') || 0;
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
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch investment parties' });
  }
});

investmentRouter.post('/parties', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const data = partySchema.parse(req.body);
    let targetLocationId = data.locationId;
    if (!targetLocationId) {
      const locRows = await db.select({ id: locations.id }).from(locations).limit(1);
      targetLocationId = locRows[0]?.id || 1;
    }
    await assertLocationAccess(userId, targetLocationId);

    const cleanPartyName = data.partyName.trim().toUpperCase();

    // Check if investor with same name (case-insensitive) already exists for this user
    const existingParty = await db.select().from(investmentParties).where(
      and(
        eq(investmentParties.userId, userId),
        eq(investmentParties.isDeleted, 0),
        sql`UPPER(${investmentParties.partyName}) = ${cleanPartyName}`
      )
    ).limit(1);

    let party: any;
    let isExisting = false;

    if (existingParty.length > 0) {
      party = existingParty[0];
      isExisting = true;
      if (party.partyName !== cleanPartyName) {
        await db.update(investmentParties)
          .set({ partyName: cleanPartyName, updatedAt: new Date() })
          .where(eq(investmentParties.id, party.id));
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
        action: 'CREATE_INVESTMENT_PARTY',
        entityType: 'INVESTMENT',
        entityId: party.id,
        metadata: JSON.stringify({ partyName: cleanPartyName })
      });
    }

    if (data.initialAmount && data.initialAmount > 0) {
      const txResult = await db.insert(investmentTransactions).values({
        userId,
        partyId: party.id,
        type: 'CONTRIBUTION',
        amount: data.initialAmount.toString(),
        date: data.initialDate || new Date().toISOString().split('T')[0],
        description: isExisting ? 'Additional Capital Contribution' : 'Initial Contribution',
        paymentMethod: 'Cash'
      }).returning();
      
      await db.insert(auditLogs).values({
        userId,
        action: 'CREATE_CONTRIBUTION',
        entityType: 'INVESTMENT',
        entityId: txResult[0].id,
        metadata: JSON.stringify({ partyId: party.id, amount: data.initialAmount, type: 'CONTRIBUTION', isExisting })
      });
    }
    
    res.json({ ...party, isExisting });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    res.status(400).json({ error: error?.message || 'Validation failed' });
  }
});

investmentRouter.put('/parties/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const { partyName } = req.body;
    if (!partyName || typeof partyName !== 'string') return res.status(400).json({ error: 'Party name required' });

    const upperName = partyName.trim().toUpperCase();

    const [updated] = await db.update(investmentParties)
      .set({ partyName: upperName, updatedAt: new Date() })
      .where(and(eq(investmentParties.id, id), eq(investmentParties.isDeleted, 0)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Party not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update party' });
  }
});

investmentRouter.get('/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const partyId = req.query.partyId ? parseInt(req.query.partyId as string, 10) : undefined;
    const locationId = req.query.locationId ? parseInt(req.query.locationId as string, 10) : undefined;
    const type = req.query.type as string | undefined;

    const conditions = [
      eq(investmentTransactions.isDeleted, 0)
    ];

    if (partyId && !isNaN(partyId)) {
      conditions.push(eq(investmentTransactions.partyId, partyId));
    }
    if (type && (type === 'INVESTMENT' || type === 'UPAD' || type === 'PAYMENT' || type === 'CONTRIBUTION')) {
      conditions.push(eq(investmentTransactions.type, type as any));
    }
    if (locationId && !isNaN(locationId)) {
      conditions.push(eq(investmentParties.locationId, locationId));
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
    })
    .from(investmentTransactions)
    .innerJoin(investmentParties, eq(investmentTransactions.partyId, investmentParties.id))
    .leftJoin(locations, eq(investmentParties.locationId, locations.id))
    .where(and(...conditions))
    .orderBy(desc(investmentTransactions.date), desc(investmentTransactions.id));
    
    res.json(txs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

investmentRouter.post('/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const data = txSchema.parse(req.body);
    
    // Validate party belongs to active location
    const party = await db.select().from(investmentParties).where(and(eq(investmentParties.id, data.partyId), eq(investmentParties.isDeleted, 0))).limit(1);
    if (!party.length) return res.status(404).json({ error: 'Investor party not found' });
    await assertLocationAccess(userId, party[0].locationId);

    // If adding Investment Capital from Investor Capital, verify and cut from available Category 7 Investor Capital
    if (data.type === 'INVESTMENT') {
      const cleanName = party[0].partyName.trim().toUpperCase();
      const allocRows = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(${investorLocationAllocations.amount} AS numeric)), 0)`
      })
      .from(investorLocationAllocations)
      .innerJoin(investors, eq(investorLocationAllocations.investorId, investors.id))
      .where(and(
        eq(investorLocationAllocations.locationId, party[0].locationId),
        eq(investorLocationAllocations.isDeleted, 0),
        sql`UPPER(${investors.name}) = ${cleanName}`
      ));
      const cat7Allocated = parseFloat(allocRows[0]?.total || '0') || 0;

      const txRows = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(${investmentTransactions.amount} AS numeric)), 0)`
      })
      .from(investmentTransactions)
      .where(and(
        eq(investmentTransactions.partyId, data.partyId),
        eq(investmentTransactions.type, 'INVESTMENT'),
        eq(investmentTransactions.isDeleted, 0)
      ));
      const alreadyInvested = parseFloat(txRows[0]?.total || '0') || 0;

      const availableCat7Capital = Math.max(0, Math.round((cat7Allocated - alreadyInvested) * 100) / 100);

      if (data.amount > availableCat7Capital) {
        return res.status(400).json({
          error: `Insufficient Category 7 Investor Capital. ${party[0].partyName} has only ₹${availableCat7Capital.toLocaleString('en-IN')} available on this site. Please allocate more capital from Category 7 first.`
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
      entityType: 'INVESTMENT',
      entityId: result[0].id,
      metadata: JSON.stringify({ partyId: data.partyId, amount: data.amount, type: data.type })
    });
    
    res.json(result[0]);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    res.status(400).json({ error: error?.message || 'Validation failed' });
  }
});

investmentRouter.put('/transactions/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const data = txSchema.parse(req.body);

    const party = await db.select().from(investmentParties).where(and(eq(investmentParties.id, data.partyId), eq(investmentParties.isDeleted, 0))).limit(1);
    if (!party.length) return res.status(404).json({ error: 'Investor party not found' });
    await assertLocationAccess(userId, party[0].locationId);

    // If updating Investment Capital from Investor Capital, verify and cut from available Category 7 Investor Capital
    if (data.type === 'INVESTMENT') {
      const cleanName = party[0].partyName.trim().toUpperCase();
      const allocRows = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(${investorLocationAllocations.amount} AS numeric)), 0)`
      })
      .from(investorLocationAllocations)
      .innerJoin(investors, eq(investorLocationAllocations.investorId, investors.id))
      .where(and(
        eq(investorLocationAllocations.locationId, party[0].locationId),
        eq(investorLocationAllocations.isDeleted, 0),
        sql`UPPER(${investors.name}) = ${cleanName}`
      ));
      const cat7Allocated = parseFloat(allocRows[0]?.total || '0') || 0;

      const txRows = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(${investmentTransactions.amount} AS numeric)), 0)`
      })
      .from(investmentTransactions)
      .where(and(
        eq(investmentTransactions.partyId, data.partyId),
        ne(investmentTransactions.id, id),
        eq(investmentTransactions.type, 'INVESTMENT'),
        eq(investmentTransactions.isDeleted, 0)
      ));
      const alreadyInvested = parseFloat(txRows[0]?.total || '0') || 0;

      const availableCat7Capital = Math.max(0, Math.round((cat7Allocated - alreadyInvested) * 100) / 100);

      if (data.amount > availableCat7Capital) {
        return res.status(400).json({
          error: `Insufficient Category 7 Investor Capital. ${party[0].partyName} has only ₹${availableCat7Capital.toLocaleString('en-IN')} available on this site.`
        });
      }
    }

    const [updated] = await db.update(investmentTransactions)
      .set({
        partyId: data.partyId,
        type: data.type,
        amount: data.amount.toString(),
        date: data.date,
        description: data.description,
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber,
      })
      .where(and(
        eq(investmentTransactions.id, id),
        eq(investmentTransactions.isDeleted, 0)
      ))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Transaction not found' });

    await db.insert(auditLogs).values({
      userId,
      action: `UPDATE_${data.type}`,
      entityType: 'INVESTMENT',
      entityId: id,
      metadata: JSON.stringify({ partyId: data.partyId, amount: data.amount, type: data.type })
    });

    res.json(updated);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    res.status(400).json({ error: error?.message || 'Validation failed' });
  }
});

investmentRouter.delete('/transactions/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const tx = await db.select().from(investmentTransactions).where(eq(investmentTransactions.id, id)).limit(1);
    if (tx.length) {
      const party = await db.select().from(investmentParties).where(eq(investmentParties.id, tx[0].partyId)).limit(1);
      if (party.length && party[0].locationId && party[0].locationId > 0) {
        try {
          await assertLocationAccess(userId, party[0].locationId);
        } catch (e) {
          console.warn('Location check ignored during transaction deletion:', e);
        }
      }
    }

    await db.update(investmentTransactions)
      .set({ isDeleted: 1 })
      .where(eq(investmentTransactions.id, id));

    await db.insert(auditLogs).values({
      userId,
      action: 'DELETE_INVESTMENT_TRANSACTION',
      entityType: 'INVESTMENT',
      entityId: id,
      metadata: JSON.stringify({ transactionId: id })
    });

    res.json({ success: true });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

investmentRouter.delete('/parties/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const party = await db.select().from(investmentParties).where(eq(investmentParties.id, id)).limit(1);
    if (party.length && party[0].locationId && party[0].locationId > 0) {
      try {
        await assertLocationAccess(userId, party[0].locationId);
      } catch (e) {
        console.warn('Location check ignored during party deletion:', e);
      }
    }

    await db.update(investmentParties)
      .set({ isDeleted: 1 })
      .where(eq(investmentParties.id, id));

    await db.update(investmentTransactions)
      .set({ isDeleted: 1 })
      .where(eq(investmentTransactions.partyId, id));

    await db.insert(auditLogs).values({
      userId,
      action: 'DELETE_INVESTMENT_PARTY',
      entityType: 'INVESTMENT',
      entityId: id,
      metadata: JSON.stringify({ partyId: id })
    });

    res.json({ success: true });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: 'Failed to delete party' });
  }
});

// Category 2: Refundable Record Endpoints
investmentRouter.get('/refundable-records', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const locParam = req.query.locationId as string | undefined;
    const locationId = (locParam && locParam !== 'ALL' && locParam !== '0' && !isNaN(parseInt(locParam, 10)))
      ? parseInt(locParam, 10)
      : undefined;

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
    })
    .from(records)
    .where(and(
      locationId ? eq(records.locationId, locationId) : undefined,
      eq(records.isDeleted, 0),
      sql`(${records.refundableAmount} > 0 OR ${records.category} = 'REFUNDABLE_RECORD' OR ${records.category} = 'REFUNDABLE')`
    ))
    .orderBy(desc(records.date), desc(records.id));

    let totalRefundable = 0;
    let totalRefunded = 0;

    refRecords.forEach(r => {
      totalRefundable += parseFloat(r.refundableAmount || r.amount || '0') || 0;
      totalRefunded += parseFloat(r.refundedAmount || '0') || 0;
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
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to fetch refundable records:', error);
    res.status(500).json({ error: 'Failed to fetch refundable records' });
  }
});

investmentRouter.post('/refundable-records', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const {
      locationId,
      date,
      partyName,
      amount,
      depositType,
      description,
      paymentMethod,
      referenceNumber,
      notes
    } = req.body;

    let locId = locationId ? parseInt(String(locationId), 10) : NaN;
    if (!isNaN(locId) && locId > 0) {
      await assertLocationAccess(userId, locId);
    } else {
      locId = await getOrCreateCentralLocation(userId);
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: 'A valid amount is required' });
    }

    const resolvedDescription = description?.trim() || (depositType ? `Security Deposit: ${depositType}` : 'Refundable Deposit / Security');

    const newRecord = await db.insert(records).values({
      locationId: locId,
      userId,
      type: 'EXPENSE',
      category: 'REFUNDABLE_RECORD',
      partyName: partyName?.trim() || 'Refundable Party',
      amount: amt.toFixed(2),
      refundableAmount: amt.toFixed(2),
      refundedAmount: '0.00',
      refundStatus: 'PENDING',
      date: date || new Date().toISOString().split('T')[0],
      description: resolvedDescription,
      paymentMethod: paymentMethod || 'Bank Transfer',
      referenceNumber: referenceNumber?.trim() || null,
      notes: notes?.trim() || null
    }).returning();

    await db.insert(auditLogs).values({
      userId,
      action: 'CREATE_REFUNDABLE_RECORD',
      entityType: 'INVESTMENT',
      entityId: newRecord[0].id,
      metadata: JSON.stringify({ amount: amt, partyName })
    });

    res.status(201).json(newRecord[0]);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to create refundable record:', error);
    res.status(500).json({ error: 'Failed to create refundable record' });
  }
});

investmentRouter.put('/refundable-records/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const { partyName, amount, depositType, description, date, paymentMethod, referenceNumber, notes } = req.body;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: 'A valid amount is required' });
    }

    const existing = await db.select().from(records).where(eq(records.id, id)).limit(1);
    if (!existing.length) {
      return res.status(404).json({ error: 'Refundable record not found' });
    }

    try {
      await assertLocationAccess(userId, existing[0].locationId, { allowDeleted: true });
    } catch {}

    const updated = await db.update(records)
      .set({
        partyName: partyName?.trim() || existing[0].partyName,
        amount: amt.toFixed(2),
        refundableAmount: amt.toFixed(2),
        date: date || existing[0].date,
        paymentMethod: paymentMethod || existing[0].paymentMethod,
        referenceNumber: referenceNumber !== undefined ? referenceNumber : existing[0].referenceNumber,
        notes: notes !== undefined ? notes : existing[0].notes,
        description: description ? description.trim() : (depositType ? `Security Deposit: ${depositType}` : existing[0].description),
        updatedAt: new Date()
      })
      .where(eq(records.id, id))
      .returning();

    await db.insert(auditLogs).values({
      userId,
      action: 'UPDATE_REFUNDABLE_RECORD',
      entityType: 'INVESTMENT',
      entityId: id,
      metadata: JSON.stringify({ oldAmount: existing[0].amount, newAmount: amt, partyName })
    });

    res.json(updated[0]);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to update refundable record:', error);
    res.status(500).json({ error: 'Failed to update refundable record' });
  }
});

investmentRouter.put('/refundable-records/:id/refund', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const rawRefund = req.body.refundAmount ?? req.body.refundedAmount;
    const rawNotes = req.body.notes ?? req.body.refundNotes;
    const addedRefund = parseFloat(rawRefund);
    if (isNaN(addedRefund) || addedRefund <= 0) {
      return res.status(400).json({ error: 'A valid refund received amount is required' });
    }

    const existing = await db.select().from(records).where(eq(records.id, id)).limit(1);
    if (!existing.length) {
      return res.status(404).json({ error: 'Refundable record not found' });
    }

    try {
      await assertLocationAccess(userId, existing[0].locationId, { allowDeleted: true });
    } catch {}

    const totalRef = parseFloat(existing[0].refundableAmount || existing[0].amount || '0');
    const currRefunded = parseFloat(existing[0].refundedAmount || '0');
    const newRefunded = Math.min(totalRef, Math.round((currRefunded + addedRefund) * 100) / 100);
    const newStatus = newRefunded >= totalRef ? 'FULL' : (newRefunded > 0 ? 'PARTIAL' : 'PENDING');

    const updated = await db.update(records)
      .set({
        refundedAmount: newRefunded.toFixed(2),
        refundStatus: newStatus,
        notes: rawNotes ? `${existing[0].notes ? existing[0].notes + ' | ' : ''}Refund received ₹${addedRefund}: ${rawNotes}` : existing[0].notes,
        updatedAt: new Date()
      })
      .where(eq(records.id, id))
      .returning();

    await db.insert(auditLogs).values({
      userId,
      action: 'UPDATE_REFUNDABLE_RECORD_REFUND',
      entityType: 'INVESTMENT',
      entityId: id,
      metadata: JSON.stringify({ addedRefund, newRefunded, newStatus })
    });

    res.json(updated[0]);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to update refund on record:', error);
    res.status(500).json({ error: 'Failed to update refund' });
  }
});

investmentRouter.delete('/refundable-records/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const existing = await db.select().from(records).where(eq(records.id, id)).limit(1);
    if (!existing.length) {
      return res.status(404).json({ error: 'Record not found' });
    }

    if (existing[0].locationId && existing[0].locationId > 0) {
      try {
        await assertLocationAccess(userId, existing[0].locationId);
      } catch (e) {
        console.warn('Location check ignored during refundable record deletion:', e);
      }
    }

    await db.update(records)
      .set({ isDeleted: 1, updatedAt: new Date() })
      .where(eq(records.id, id));

    await db.insert(auditLogs).values({
      userId,
      action: 'DELETE_REFUNDABLE_RECORD',
      entityType: 'INVESTMENT',
      entityId: id,
      metadata: JSON.stringify({ recordId: id })
    });

    res.json({ success: true });
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to delete refundable record:', error);
    res.status(500).json({ error: 'Failed to delete refundable record' });
  }
});

// Category 2 Linkage: Project Investment Capital & Categories 3, 4, 5, 6 Linked Utilization
investmentRouter.get('/project-utilization', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: User authentication required' });

    const locParam = req.query.locationId as string | undefined;
    const locationId = (locParam && locParam !== 'ALL' && locParam !== '0' && !isNaN(parseInt(locParam, 10)))
      ? parseInt(locParam, 10)
      : undefined;

    if (locationId) {
      await assertLocationAccess(userId, locationId);
    }

    // 1. Investment Capital from Investors (Direct Allocations + Legacy INVESTMENT/CONTRIBUTION transactions)
    const directAllocations = await db.select({
      total: sql<string>`sum(${investorLocationAllocations.amount})`,
      count: sql<number>`count(*)`
    })
    .from(investorLocationAllocations)
    .where(and(
      locationId ? eq(investorLocationAllocations.locationId, locationId) : undefined,
      eq(investorLocationAllocations.isDeleted, 0)
    ));
    const totalFromDirectAllocations = parseFloat(directAllocations[0]?.total || '0') || 0;

    const invTxs = await db.select({
      type: investmentTransactions.type,
      total: sql<string>`sum(${investmentTransactions.amount})`,
      count: sql<number>`count(*)`
    })
    .from(investmentTransactions)
    .innerJoin(investmentParties, eq(investmentTransactions.partyId, investmentParties.id))
    .where(and(
      locationId ? eq(investmentParties.locationId, locationId) : undefined,
      eq(investmentTransactions.isDeleted, 0),
      eq(investmentParties.isDeleted, 0)
    ))
    .groupBy(investmentTransactions.type);

    let fromInvestmentKarya = 0;
    let fromContributions = 0;
    let returnsToInvestors = 0;
    invTxs.forEach(t => {
      const amt = parseFloat(t.total || '0');
      if (t.type === 'INVESTMENT') fromInvestmentKarya += amt;
      else if (t.type === 'CONTRIBUTION') fromContributions += amt;
      else if (t.type === 'UPAD' || t.type === 'PAYMENT') returnsToInvestors += amt;
    });
    
    // Capital deployed to this project from investors via 'Add Investment Capital from Investor Capital'
    const investmentFromInvestorsCapital = Math.round(fromInvestmentKarya * 100) / 100;
    const fromInvestors = investmentFromInvestorsCapital;

    // 2. Bill Investments are managed at the Admin level, not per-location
    const fromBills = 0;
    const billCount = 0;

    // Full Capital in Location = Investment from Investors Capital ONLY
    const fullCapital = Math.round(investmentFromInvestorsCapital * 100) / 100;
    const netInvestmentCapital = Math.round((fullCapital - returnsToInvestors) * 100) / 100;

    // 3. Category 3: Material Purchases
    const matPurchases = await db.select({
      total: sql<string>`sum(${materialPurchases.totalAmount})`,
      paid: sql<string>`sum(${materialPurchases.paidAmount})`,
      outstanding: sql<string>`sum(${materialPurchases.outstandingAmount})`,
      count: sql<number>`count(*)`
    })
    .from(materialPurchases)
    .where(and(
      locationId ? eq(materialPurchases.locationId, locationId) : undefined,
      eq(materialPurchases.isDeleted, 0)
    ));

    const cat3Total = parseFloat(matPurchases[0]?.total || '0');
    const cat3Paid = parseFloat(matPurchases[0]?.paid || '0');
    const cat3Outstanding = parseFloat(matPurchases[0]?.outstanding || '0');
    const cat3Count = Number(matPurchases[0]?.count || 0);

    // 4. Category 4: Material Supplies
    const matSupplies = await db.select({
      total: sql<string>`sum(${materialSupplies.totalAmount})`,
      paid: sql<string>`sum(${materialSupplies.paidAmount})`,
      outstanding: sql<string>`sum(${materialSupplies.outstandingAmount})`,
      count: sql<number>`count(*)`
    })
    .from(materialSupplies)
    .where(and(
      locationId ? eq(materialSupplies.locationId, locationId) : undefined,
      eq(materialSupplies.isDeleted, 0)
    ));

    const cat4Total = parseFloat(matSupplies[0]?.total || '0');
    const cat4Paid = parseFloat(matSupplies[0]?.paid || '0');
    const cat4Outstanding = parseFloat(matSupplies[0]?.outstanding || '0');
    const cat4Count = Number(matSupplies[0]?.count || 0);

    // 5. Category 5: Site Supplies
    const siteSuppliesData = await db.select({
      total: sql<string>`sum(${siteSupplies.totalAmount})`,
      count: sql<number>`count(*)`
    })
    .from(siteSupplies)
    .where(and(
      locationId ? eq(siteSupplies.locationId, locationId) : undefined,
      eq(siteSupplies.isDeleted, 0)
    ));

    const cat5Total = parseFloat(siteSuppliesData[0]?.total || '0');
    const cat5Count = Number(siteSuppliesData[0]?.count || 0);

    // 6. Category 6: Labour Salaries, Team Upad & Other Kharch
    const labourData = await db.select({
      netSalary: sql<string>`sum(case when upper(${labourSalaries.attendanceType}) not like '%UPAD%' then coalesce(${labourSalaries.netSalary}, ${labourSalaries.grossSalary}, 0) else 0 end)`,
      upad: sql<string>`sum(case when upper(${labourSalaries.attendanceType}) like '%UPAD%' then greatest(coalesce(${labourSalaries.upad}, 0), coalesce(${labourSalaries.paymentAmount}, 0), coalesce(${labourSalaries.grossSalary}, 0)) else coalesce(${labourSalaries.upad}, 0) end)`,
      paid: sql<string>`sum(case when upper(${labourSalaries.attendanceType}) like '%UPAD%' then greatest(coalesce(${labourSalaries.upad}, 0), coalesce(${labourSalaries.paymentAmount}, 0), coalesce(${labourSalaries.grossSalary}, 0)) else coalesce(${labourSalaries.paymentAmount}, 0) end)`,
      grossSalary: sql<string>`sum(coalesce(${labourSalaries.grossSalary}, 0))`,
      balance: sql<string>`sum(coalesce(${labourSalaries.balance}, 0))`,
      count: sql<number>`count(*)`
    })
    .from(labourSalaries)
    .where(and(
      locationId ? eq(labourSalaries.locationId, locationId) : undefined,
      eq(labourSalaries.isDeleted, 0)
    ));

    const labourNetSalary = parseFloat(labourData[0]?.netSalary || '0');
    const labourUpad = parseFloat(labourData[0]?.upad || '0');
    const labourPaid = parseFloat(labourData[0]?.paid || '0');
    const labourGross = parseFloat(labourData[0]?.grossSalary || '0');
    const labourBalance = parseFloat(labourData[0]?.balance || '0');
    const labourCount = Number(labourData[0]?.count || 0);

    // In Cat 6, total deduction is calculated from gross wages + team upad + other kharch
    // For records: grossSalary holds attendance / other kharch, upad holds team upad
    // Note: netSalary + upad accurately represents all labour expenditure
    const cat6Total = Math.round((labourNetSalary + labourUpad) * 100) / 100;
    const cat6CashPaid = Math.round((labourPaid + labourUpad) * 100) / 100;

    // Refundable Records are managed at the Admin level, not per-location
    const totalRefundable = 0;
    const totalRefunded = 0;
    const pendingRefundable = 0;
    const refCount = 0;

    // Contractor Costs (Category 5) for matching with (Site Supply + Labour Attendance)
    const contrCosts = await db.select({
      total: sql<string>`sum(${contractorCosts.amount})`,
      count: sql<number>`count(*)`
    })
    .from(contractorCosts)
    .where(and(
      locationId ? eq(contractorCosts.locationId, locationId) : undefined,
      eq(contractorCosts.isDeleted, 0)
    ));
    const recordedContractorCost = parseFloat(contrCosts[0]?.total || '0') || 0;
    const contractorCostCount = Number(contrCosts[0]?.count || 0);

    // Explicit Rule 1: Investment Capital vs (Material Supply + Site Supply + Labour Attendance)
    const totalThreeExpenses = Math.round((cat4Total + cat5Total + cat6Total) * 100) / 100;
    const investmentVariance = Math.round((investmentFromInvestorsCapital - totalThreeExpenses) * 100) / 100;
    const investmentStatus: 'MATCHED' | 'SURPLUS' | 'DEFICIT' = Math.abs(investmentVariance) < 0.01 
      ? 'MATCHED' 
      : (investmentVariance > 0 ? 'SURPLUS' : 'DEFICIT');

    // Explicit Rule 2: (Site Supply + Labour Attendance) vs Contractor Cost
    const expectedContractorCost = Math.round((cat5Total + cat6Total) * 100) / 100;
    const contractorVariance = Math.round((recordedContractorCost - expectedContractorCost) * 100) / 100;
    const contractorStatus: 'MATCHED' | 'SURPLUS' | 'DEFICIT' = Math.abs(contractorVariance) < 0.01 
      ? 'MATCHED' 
      : (contractorVariance > 0 ? 'SURPLUS' : 'DEFICIT');

    // Grand Project Deductions across Site Supplies (Cat 5) and Labour & Kharch (Cat 6) funded by Location Investment Capital
    const totalProjectExpenditure = Math.round((cat5Total + cat6Total) * 100) / 100;
    const totalCashPaidExpenditure = Math.round((cat5Total + cat6CashPaid) * 100) / 100;
    
    // Category 2 formula: Remaining Capital = Full Capital (Investment from Investors) - Deductions (Site Supply + Labour) - Investor Upad / Return
    const remainingInvestmentCapital = Math.round((fullCapital - totalProjectExpenditure - returnsToInvestors) * 100) / 100;
    
    const utilizationRate = fullCapital > 0
      ? Math.round((totalProjectExpenditure / fullCapital) * 100)
      : (totalProjectExpenditure > 0 ? 100 : 0);

    let status = 'HEALTHY';
    if (remainingInvestmentCapital < 0) {
      status = 'DEFICIT';
    } else if (utilizationRate >= 85) {
      status = 'WARNING';
    }

    // Itemized recent operational deductions across Site Supplies, Labour, and Refundables
    const [recentSiteSupplies, recentLabour, recentRefundables, recentLegacyTxs, recentDirectAllocs, recentBills] = await Promise.all([
      db.select({
        id: siteSupplies.id,
        date: siteSupplies.date,
        category: sql<string>`'CAT_5_SITE_SUPPLY'`,
        categoryKey: sql<string>`'CAT5_SITE'`,
        categoryName: sql<string>`'Cat 5: Site Supply'`,
        partyName: sql<string>`coalesce(${siteSupplies.responsiblePerson}, 'Site Team')`,
        description: sql<string>`coalesce(${siteSupplies.workDescription}, 'Site Equipment / Tool Supply')`,
        amount: siteSupplies.totalAmount,
        paidAmount: siteSupplies.totalAmount,
        referenceNumber: sql<string>`''`,
        paymentStatus: sql<string>`'PAID'`
      })
      .from(siteSupplies)
      .where(and(eq(siteSupplies.locationId, locationId), eq(siteSupplies.isDeleted, 0)))
      .orderBy(desc(siteSupplies.date), desc(siteSupplies.id))
      .limit(40),

      db.select({
        id: labourSalaries.id,
        date: labourSalaries.date,
        category: sql<string>`'CAT_6_LABOUR'`,
        categoryKey: sql<string>`'CAT6_LABOUR'`,
        categoryName: sql<string>`case 
          when upper(${labourSalaries.attendanceType}) like '%UPAD%' then 'Cat 6: Team Upad'
          when upper(${labourSalaries.attendanceType}) like '%KHARCH%' or upper(${labourSalaries.attendanceType}) like '%EXPENSE%' then 'Cat 6: Other Kharch'
          else 'Cat 6: Labour Attendance'
        end`,
        partyName: sql<string>`coalesce(${labourSalaries.labourTeam}, ${labourSalaries.labourName})`,
        description: sql<string>`case
          when upper(${labourSalaries.attendanceType}) like '%UPAD%' then concat('Team Advance: ', coalesce(${labourSalaries.notes}, 'Upad'))
          when upper(${labourSalaries.attendanceType}) like '%KHARCH%' then concat('Kharch: ', coalesce(${labourSalaries.workType}, ${labourSalaries.notes}, 'Expense'))
          when upper(${labourSalaries.attendanceType}) like '%WORK%' or upper(${labourSalaries.attendanceType}) like '%TC%' then concat('TC: ', coalesce(${labourSalaries.workType}, 'Work'), ' (', coalesce(${labourSalaries.tcQuantity}, '0'), ' ', coalesce(${labourSalaries.unitOfMeasurement}, 'Nos'), ')')
          else concat('Day Attendance (Days: ', coalesce(${labourSalaries.days}, '0'), ')')
        end`,
        amount: sql<string>`case
          when upper(${labourSalaries.attendanceType}) like '%UPAD%' then greatest(coalesce(${labourSalaries.upad}, 0), coalesce(${labourSalaries.paymentAmount}, 0), coalesce(${labourSalaries.grossSalary}, 0))
          when upper(${labourSalaries.attendanceType}) like '%KHARCH%' or upper(${labourSalaries.attendanceType}) like '%EXPENSE%' then greatest(coalesce(${labourSalaries.paymentAmount}, 0), coalesce(${labourSalaries.grossSalary}, 0), coalesce(${labourSalaries.netSalary}, 0))
          else greatest(coalesce(${labourSalaries.netSalary}, 0), coalesce(${labourSalaries.grossSalary}, 0))
        end`,
        paidAmount: sql<string>`case
          when upper(${labourSalaries.attendanceType}) like '%UPAD%' then greatest(coalesce(${labourSalaries.upad}, 0), coalesce(${labourSalaries.paymentAmount}, 0), coalesce(${labourSalaries.grossSalary}, 0))
          when upper(${labourSalaries.attendanceType}) like '%KHARCH%' or upper(${labourSalaries.attendanceType}) like '%EXPENSE%' then greatest(coalesce(${labourSalaries.paymentAmount}, 0), coalesce(${labourSalaries.grossSalary}, 0), coalesce(${labourSalaries.netSalary}, 0))
          else coalesce(${labourSalaries.paymentAmount}, 0)
        end`,
        referenceNumber: sql<string>`coalesce(${labourSalaries.referenceNumber}, ${labourSalaries.tcNumber}, '')`,
        paymentStatus: sql<string>`case 
          when upper(${labourSalaries.attendanceType}) like '%UPAD%' or upper(${labourSalaries.attendanceType}) like '%KHARCH%' then 'PAID'
          when ${labourSalaries.balance} = '0' then 'PAID' 
          else 'OUTSTANDING' 
        end`
      })
      .from(labourSalaries)
      .where(and(eq(labourSalaries.locationId, locationId), eq(labourSalaries.isDeleted, 0)))
      .orderBy(desc(labourSalaries.date), desc(labourSalaries.id))
      .limit(60),

      db.select({
        id: records.id,
        date: records.date,
        category: sql<string>`'REFUNDABLE_RECORD'`,
        categoryKey: sql<string>`'CAT_REFUNDABLE'`,
        categoryName: sql<string>`'Refundable Record'`,
        partyName: records.partyName,
        description: sql<string>`concat('Refundable Deposit: ', coalesce(${records.description}, ${records.partyName}))`,
        amount: sql<string>`case when coalesce(${records.refundableAmount}, 0) > 0 then ${records.refundableAmount} else ${records.amount} end`,
        paidAmount: sql<string>`coalesce(${records.refundedAmount}, '0.00')`,
        referenceNumber: sql<string>`coalesce(${records.referenceNumber}, '')`,
        paymentStatus: records.refundStatus
      })
      .from(records)
      .where(and(
        eq(records.locationId, locationId),
        eq(records.isDeleted, 0),
        sql`(${records.refundableAmount} > 0 OR ${records.category} = 'REFUNDABLE_RECORD' OR ${records.category} = 'REFUNDABLE')`
      ))
      .orderBy(desc(records.date), desc(records.id))
      .limit(40),

      db.select({
        id: investmentTransactions.id,
        date: investmentTransactions.date,
        partyId: investmentParties.id,
        partyName: investmentParties.partyName,
        type: investmentTransactions.type,
        amount: investmentTransactions.amount,
        description: investmentTransactions.description,
        paymentMethod: investmentTransactions.paymentMethod,
        referenceNumber: investmentTransactions.referenceNumber,
      })
      .from(investmentTransactions)
      .innerJoin(investmentParties, eq(investmentTransactions.partyId, investmentParties.id))
      .where(and(
        eq(investmentParties.locationId, locationId),
        eq(investmentTransactions.isDeleted, 0),
        eq(investmentParties.isDeleted, 0),
        sql`${investmentTransactions.type} IN ('INVESTMENT', 'CONTRIBUTION')`
      ))
      .orderBy(desc(investmentTransactions.date), desc(investmentTransactions.id))
      .limit(50),

      db.select({
        id: investorLocationAllocations.id,
        date: investorLocationAllocations.date,
        partyId: investors.id,
        partyName: investors.name,
        type: sql<string>`'INVESTMENT'`,
        amount: investorLocationAllocations.amount,
        description: sql<string>`coalesce(${investorLocationAllocations.notes}, 'Investor Allocation')`,
        paymentMethod: investorLocationAllocations.paymentMethod,
        referenceNumber: investorLocationAllocations.referenceNumber,
      })
      .from(investorLocationAllocations)
      .innerJoin(investors, eq(investorLocationAllocations.investorId, investors.id))
      .where(and(
        eq(investorLocationAllocations.locationId, locationId),
        eq(investorLocationAllocations.isDeleted, 0)
      ))
      .orderBy(desc(investorLocationAllocations.date), desc(investorLocationAllocations.id))
      .limit(50),

      db.select({
        id: records.id,
        date: records.date,
        partyId: sql<number>`0`,
        partyName: records.partyName,
        type: sql<string>`'BILL_INVESTMENT'`,
        amount: records.amount,
        description: sql<string>`concat('Bill Inflow: ', coalesce(${records.description}, 'Invoice Investment'))`,
        paymentMethod: records.paymentMethod,
        referenceNumber: records.referenceNumber,
      })
      .from(records)
      .where(and(
        eq(records.locationId, locationId),
        eq(records.isDeleted, 0),
        eq(records.type, 'INCOME'),
        eq(records.category, 'BILL_INVESTMENT')
      ))
      .orderBy(desc(records.date), desc(records.id))
      .limit(50)
    ]);

    // Merge all location capital inflows (investment transactions only)
    const recentCapitalInflows = [
      ...recentLegacyTxs
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Merge and sort all location deductions chronologically descending
    const itemizedDeductions = [
      ...recentSiteSupplies,
      ...recentLabour
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
        reconciliationStatus: investmentStatus,
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
    console.error('Failed to fetch project utilization:', error);
    res.status(500).json({ error: 'Failed to fetch project utilization' });
  }
});

export default investmentRouter;
