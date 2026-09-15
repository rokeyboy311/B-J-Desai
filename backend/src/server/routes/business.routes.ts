import { Router, Response } from 'express';
import { requireAuth, AuthRequest, verifyBusinessOwnership } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { businesses, locations, invoices, auditLogs } from '../../db/schema.ts';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { FinancialYearService } from '../../shared/financialYear.ts';

const businessRouter = Router();
businessRouter.use(requireAuth);

const businessSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  legalName: z.string().optional().nullable().default(''),
  address: z.string().optional().nullable().default(''),
  city: z.string().optional().nullable().default(''),
  state: z.string().default('Gujarat'),
  pincode: z.string().optional().nullable().default(''),
  mobile: z.string().optional().nullable().default(''),
  email: z.string().email().optional().nullable().or(z.literal('')),
  gstin: z.string().optional().nullable().default(''),
  pan: z.string().optional().nullable().default(''),
  logo: z.string().optional().nullable().default(''),
  invoicePrefix: z.string().min(1).default('INV'),
  financialYear: z.string().optional(),
  bankName: z.string().optional().nullable().default(''),
  bankAccountNumber: z.string().optional().nullable().default(''),
  bankIfsc: z.string().optional().nullable().default(''),
  bankBranch: z.string().optional().nullable().default(''),
  termsAndConditions: z.string().optional().nullable().default(''),
});

// GET /api/businesses - List user's businesses
businessRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const list = await db.select()
      .from(businesses)
      .where(and(eq(businesses.userId, userId), eq(businesses.isDeleted, 0)))
      .orderBy(desc(businesses.createdAt));
    
    // If user has no business, create default business automatically
    if (list.length === 0) {
      const currentFY = FinancialYearService.getFinancialYear();
      const created = await db.insert(businesses).values({
        userId,
        businessName: 'Bina Enterprise',
        legalName: 'Bina Enterprise',
        state: 'Gujarat',
        invoicePrefix: 'INV',
        financialYear: currentFY,
      }).returning();
      return res.json(created);
    }

    res.json(list);
  } catch (error) {
    console.error('Failed to fetch businesses:', error);
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

// GET /api/businesses/:id - Get business by ID
businessRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const userId = req.dbUser!.id;
    const isOwner = await verifyBusinessOwnership(userId, id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden: You do not own this business' });
    }

    const biz = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
    if (biz.length === 0) {
      return res.status(404).json({ error: 'Business not found' });
    }

    res.json(biz[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch business' });
  }
});

// POST /api/businesses - Create new business
businessRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const data = businessSchema.parse(req.body);
    const fy = data.financialYear || FinancialYearService.getFinancialYear();

    const created = await db.insert(businesses).values({
      userId,
      ...data,
      email: data.email || null,
      financialYear: fy,
    }).returning();

    await db.insert(auditLogs).values({
      userId,
      businessId: created[0].id,
      action: 'CREATE',
      entityType: 'BUSINESS',
      entityId: created[0].id,
      afterState: JSON.stringify(created[0]),
    });

    res.status(201).json(created[0]);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0]?.message || 'Validation error' });
    }
    console.error('Failed to create business:', error);
    res.status(500).json({ error: 'Failed to create business' });
  }
});

// PUT /api/businesses/:id - Update business
businessRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const userId = req.dbUser!.id;
    const isOwner = await verifyBusinessOwnership(userId, id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden: You do not own this business' });
    }

    const data = businessSchema.parse(req.body);
    const updated = await db.update(businesses).set({
      ...data,
      email: data.email || null,
      updatedAt: new Date(),
    }).where(eq(businesses.id, id)).returning();

    res.json(updated[0]);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0]?.message || 'Validation error' });
    }
    res.status(500).json({ error: 'Failed to update business' });
  }
});

// DELETE /api/businesses/:id - Soft-delete business (restricted if active invoices exist)
businessRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const userId = req.dbUser!.id;
    const isOwner = await verifyBusinessOwnership(userId, id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden: You do not own this business' });
    }

    // Safety check: ensure no active invoices exist under this business
    const activeInvoices = await db.select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.businessId, id), eq(invoices.isDeleted, 0), eq(invoices.isVoid, 0)))
      .limit(1);

    if (activeInvoices.length > 0) {
      return res.status(400).json({ error: 'Cannot archive business with active posted invoices' });
    }

    await db.update(businesses).set({ isDeleted: 1, updatedAt: new Date() }).where(eq(businesses.id, id));
    res.json({ success: true, message: 'Business archived successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to archive business' });
  }
});

export default businessRouter;
