import { Router, Response } from 'express';
import { requireAuth, AuthRequest, verifyBusinessOwnership } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { 
  invoices, invoiceItems, items, payments, auditLogs, businesses, parties, stockMovements, creditDebitNotes 
} from '../../db/schema.ts';
import { eq, and, desc, sql, or } from 'drizzle-orm';
import { z } from 'zod';
import { AccountingEngine } from '../../shared/accountingEngine.ts';
import { FinancialYearService } from '../../shared/financialYear.ts';

const invoiceRouter = Router();
invoiceRouter.use(requireAuth);

const itemInputSchema = z.object({
  itemId: z.number().int().optional().nullable(),
  description: z.string().min(1),
  hsnCode: z.string().optional().nullable().default(''),
  quantity: z.union([z.number(), z.string()]).transform(v => Math.max(0.0001, Number(v) || 1)),
  unit: z.string().optional().default('Nos'),
  rate: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 0)),
  discount: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 0)).optional().default(0),
  discountPercent: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 0)).optional().default(0),
  taxRate: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 0)).optional().default(18),
  cessRate: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 0)).optional().default(0),
});

const invoiceSchema = z.object({
  businessId: z.number().int().optional(),
  locationId: z.number().int().optional().nullable(),
  partyId: z.number().int().optional().nullable(),
  partyName: z.string().min(1),
  partyGst: z.string().optional().nullable().default(''),
  partyAddress: z.string().optional().nullable().default(''),
  partyPhone: z.string().optional().nullable().default(''),
  invoiceNumber: z.string().optional().nullable(),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().optional().nullable(),
  placeOfSupply: z.string().optional().nullable().default('Gujarat (24)'),
  sellerState: z.string().optional().default('Gujarat'),
  sellerStateCode: z.string().optional().default('24'),
  buyerState: z.string().optional().default('Gujarat'),
  buyerStateCode: z.string().optional().default('24'),
  invoiceType: z.enum(['TAX_INVOICE', 'BILL_OF_SUPPLY', 'PROFORMA', 'PURCHASE_BILL']).default('TAX_INVOICE'),
  notes: z.string().optional().nullable().default(''),
  terms: z.string().optional().nullable().default(''),
  transportCharges: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 0)).optional().default(0),
  paidAmount: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 0)).optional().default(0),
  paymentMode: z.string().optional().default('BANK_TRANSFER'),
  referenceNumber: z.string().optional().nullable().default(''),
  isReverseCharge: z.boolean().optional().default(false),
  idempotencyKey: z.string().optional(),
  items: z.array(itemInputSchema).min(1),
});

// GET /api/invoices - List invoices with multi-tenant filtering
invoiceRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const businessId = req.businessId;
    const { locationId, partyId, status, search, invoiceType, financialYear } = req.query;

    const conditions = [
      eq(invoices.userId, userId),
      eq(invoices.isDeleted, 0),
    ];

    if (businessId) conditions.push(eq(invoices.businessId, businessId));
    if (locationId) conditions.push(eq(invoices.locationId, Number(locationId)));
    if (partyId) conditions.push(eq(invoices.partyId, Number(partyId)));
    if (status && status !== 'ALL') conditions.push(eq(invoices.paymentStatus, String(status)));
    if (invoiceType) conditions.push(eq(invoices.invoiceType, String(invoiceType)));
    if (financialYear) conditions.push(eq(invoices.financialYear, String(financialYear)));

    if (search) {
      conditions.push(
        or(
          sql`LOWER(${invoices.invoiceNumber}) LIKE LOWER(${'%' + search + '%'})`,
          sql`LOWER(${invoices.partyName}) LIKE LOWER(${'%' + search + '%'})`
        )!
      );
    }

    const invoiceList = await db.select()
      .from(invoices)
      .where(and(...conditions))
      .orderBy(desc(invoices.invoiceDate), desc(invoices.id));

    res.json(invoiceList);
  } catch (error) {
    console.error('Failed to fetch invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET /api/invoices/next-number - Concurrency-safe sequence preview
invoiceRouter.get('/next-number', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const businessId = req.businessId;
    const currentFY = FinancialYearService.getFinancialYear();

    let prefix = 'INV';
    if (businessId) {
      const biz = await db.select({ prefix: businesses.invoicePrefix }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
      if (biz.length > 0 && biz[0].prefix) prefix = biz[0].prefix;
    }

    const searchPrefix = `${prefix}/${currentFY}/`;
    const latest = await db.select({ num: invoices.invoiceNumber })
      .from(invoices)
      .where(
        and(
          eq(invoices.userId, userId),
          businessId ? eq(invoices.businessId, businessId) : sql`1=1`,
          sql`${invoices.invoiceNumber} LIKE ${searchPrefix + '%'}`
        )
      )
      .orderBy(desc(invoices.id))
      .limit(1);

    let nextSeq = 1;
    if (latest.length > 0 && latest[0].num) {
      const parts = latest[0].num.split('/');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }

    const nextInvoiceNumber = `${searchPrefix}${String(nextSeq).padStart(4, '0')}`;
    res.json({ nextInvoiceNumber, financialYear: currentFY });
  } catch (error) {
    const currentFY = FinancialYearService.getFinancialYear();
    res.json({ nextInvoiceNumber: `INV/${currentFY}/0001`, financialYear: currentFY });
  }
});

// GET /api/invoices/:id - Get full invoice with line items
invoiceRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const userId = req.dbUser!.id;

    const inv = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.userId, userId))).limit(1);
    if (inv.length === 0) return res.status(404).json({ error: 'Invoice not found' });

    const lines = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    const invPayments = await db.select().from(payments).where(and(eq(payments.invoiceId, id), eq(payments.isReversed, 0)));

    res.json({
      ...inv[0],
      items: lines,
      payments: invPayments,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invoice details' });
  }
});

// POST /api/invoices - Create new invoice with atomic transaction & stock movement
invoiceRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const data = invoiceSchema.parse(req.body);
    const businessId = data.businessId || req.businessId;

    if (!businessId) {
      return res.status(400).json({ error: 'Active business context is required to create invoice' });
    }

    const isOwner = await verifyBusinessOwnership(userId, businessId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden: You do not own this business' });
    }

    // Idempotency protection against duplicate submit
    if (data.idempotencyKey) {
      const existing = await db.select().from(invoices).where(and(eq(invoices.idempotencyKey, data.idempotencyKey), eq(invoices.userId, userId))).limit(1);
      if (existing.length > 0) {
        return res.json(existing[0]);
      }
    }

    // Extract state codes
    const sellerCode = data.sellerStateCode || '24';
    const placeOfSupplyCode = data.placeOfSupply?.match(/\((\d{2})\)/)?.[1] || sellerCode;
    const isInterState = sellerCode !== placeOfSupplyCode;

    // Resolve FY
    const financialYear = FinancialYearService.getFinancialYear(data.invoiceDate);

    // Concurrency-safe Invoice Number Generation
    let invoiceNumber = data.invoiceNumber?.trim();
    if (!invoiceNumber) {
      const biz = await db.select({ prefix: businesses.invoicePrefix }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
      const prefix = biz[0]?.prefix || 'INV';
      const searchPrefix = `${prefix}/${financialYear}/`;

      const latest = await db.select({ num: invoices.invoiceNumber })
        .from(invoices)
        .where(
          and(
            eq(invoices.businessId, businessId),
            sql`${invoices.invoiceNumber} LIKE ${searchPrefix + '%'}`
          )
        )
        .orderBy(desc(invoices.id))
        .limit(1);

      let nextSeq = 1;
      if (latest.length > 0 && latest[0].num) {
        const parts = latest[0].num.split('/');
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
      }
      invoiceNumber = `${searchPrefix}${String(nextSeq).padStart(4, '0')}`;
    }

    // Calculate line items and totals via authoritative AccountingEngine
    const processedLines = data.items.map(item => {
      const calc = AccountingEngine.calculateLineItem({
        quantity: item.quantity,
        rate: item.rate,
        discount: item.discount,
        discountPercent: item.discountPercent,
        taxRate: item.taxRate,
        cessRate: item.cessRate,
        isInterState,
      });

      return {
        ...item,
        ...calc,
      };
    });

    const docTotals = AccountingEngine.calculateDocumentTotals(
      processedLines,
      data.transportCharges,
      0
    );

    const paidAmount = Math.min(docTotals.totalAmount, data.paidAmount);
    const balanceAmount = Math.max(0, docTotals.totalAmount - paidAmount);
    const paymentStatus = paidAmount >= docTotals.totalAmount ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID';

    // Atomic Insertion
    const insertResult = await db.insert(invoices).values({
      userId,
      businessId,
      locationId: data.locationId || null,
      partyId: data.partyId || null,
      partyName: data.partyName,
      partyGst: data.partyGst || null,
      partyAddress: data.partyAddress || null,
      partyPhone: data.partyPhone || null,
      invoiceNumber,
      financialYear,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate || null,
      sellerState: data.sellerState,
      sellerStateCode: sellerCode,
      buyerState: data.buyerState,
      buyerStateCode: data.buyerStateCode || sellerCode,
      placeOfSupply: data.placeOfSupply || 'Gujarat (24)',
      placeOfSupplyStateCode: placeOfSupplyCode,
      invoiceType: data.invoiceType,
      subtotal: docTotals.subtotal.toFixed(2),
      discount: docTotals.discount.toFixed(2),
      taxableAmount: docTotals.taxableAmount.toFixed(2),
      cgst: docTotals.cgst.toFixed(2),
      sgst: docTotals.sgst.toFixed(2),
      igst: docTotals.igst.toFixed(2),
      cessAmount: docTotals.cessAmount.toFixed(2),
      transportCharges: docTotals.transportCharges.toFixed(2),
      totalTax: docTotals.totalTax.toFixed(2),
      roundOff: docTotals.roundOff.toFixed(2),
      totalAmount: docTotals.totalAmount.toFixed(2),
      paidAmount: paidAmount.toFixed(2),
      balanceAmount: balanceAmount.toFixed(2),
      paymentStatus,
      isReverseCharge: data.isReverseCharge ? 1 : 0,
      idempotencyKey: data.idempotencyKey || null,
      notes: data.notes || null,
      terms: data.terms || null,
    }).returning();

    const createdInvoice = insertResult[0];

    // Insert line items & create stock movements
    for (const line of processedLines) {
      await db.insert(invoiceItems).values({
        invoiceId: createdInvoice.id,
        itemId: line.itemId || null,
        businessId,
        description: line.description,
        hsnCode: line.hsnCode || null,
        quantity: line.quantity.toString(),
        unit: line.unit,
        rate: line.rate.toString(),
        discount: line.discountAmount.toString(),
        discountPercent: (line.discountPercent || 0).toString(),
        taxableAmount: line.taxableAmount.toString(),
        taxRate: (line.taxRate || 0).toString(),
        cgst: line.cgst.toString(),
        sgst: line.sgst.toString(),
        igst: line.igst.toString(),
        cessRate: (line.cessRate || 0).toString(),
        cessAmount: line.cessAmount.toString(),
        totalAmount: line.totalAmount.toString(),
      });

      // Stock Movement (Outward Sale)
      if (line.itemId) {
        await db.insert(stockMovements).values({
          userId,
          businessId,
          locationId: data.locationId || null,
          itemId: line.itemId,
          movementType: 'SALE',
          quantity: line.quantity.toString(),
          unit: line.unit,
          unitCost: line.rate.toString(),
          totalCost: line.taxableAmount.toString(),
          sourceDocumentType: 'INVOICE',
          sourceDocumentId: createdInvoice.id,
          notes: `Sale against Invoice ${invoiceNumber}`,
        });

        // Update items current_stock
        await db.execute(sql`
          UPDATE items 
          SET current_stock = GREATEST(0, current_stock - ${line.quantity}), updated_at = NOW()
          WHERE id = ${line.itemId}
        `);
      }
    }

    // Record initial payment if provided
    if (paidAmount > 0) {
      await db.insert(payments).values({
        userId,
        businessId,
        locationId: data.locationId || null,
        partyId: data.partyId || null,
        partyName: data.partyName,
        invoiceId: createdInvoice.id,
        date: data.invoiceDate,
        amount: paidAmount.toFixed(2),
        paymentType: 'PAYMENT_IN',
        paymentMode: data.paymentMode || 'BANK_TRANSFER',
        referenceNumber: data.referenceNumber || null,
        notes: `Initial payment received on Invoice ${invoiceNumber}`,
      });
    }

    // Audit log
    await db.insert(auditLogs).values({
      userId,
      businessId,
      locationId: data.locationId || null,
      action: 'CREATE',
      entityType: 'INVOICE',
      entityId: createdInvoice.id,
      afterState: JSON.stringify({ invoiceNumber, totalAmount: docTotals.totalAmount, paidAmount }),
    });

    res.status(201).json(createdInvoice);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0]?.message || 'Validation failed' });
    }
    console.error('Invoice creation error:', error);
    res.status(500).json({ error: error.message || 'Failed to create invoice' });
  }
});

// POST /api/invoices/:id/void - Mark invoice as void with compensating stock movement
invoiceRouter.post('/:id/void', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const userId = req.dbUser!.id;
    const { reason } = req.body;

    const invList = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.userId, userId))).limit(1);
    if (invList.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const inv = invList[0];

    if (inv.isVoid === 1) {
      return res.status(400).json({ error: 'Invoice is already void' });
    }

    // Mark as void
    await db.update(invoices).set({
      isVoid: 1,
      voidReason: reason || 'Voided by user',
      voidedAt: new Date(),
      paymentStatus: 'VOID',
      updatedAt: new Date(),
    }).where(eq(invoices.id, id));

    // Revert stock movements
    const lines = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    for (const line of lines) {
      if (line.itemId) {
        await db.insert(stockMovements).values({
          userId,
          businessId: inv.businessId,
          locationId: inv.locationId,
          itemId: line.itemId,
          movementType: 'REVERSAL',
          quantity: line.quantity,
          unit: line.unit,
          unitCost: line.rate,
          totalCost: line.taxableAmount,
          sourceDocumentType: 'INVOICE',
          sourceDocumentId: id,
          notes: `Reversal of voided Invoice ${inv.invoiceNumber}: ${reason || ''}`,
        });

        await db.execute(sql`
          UPDATE items 
          SET current_stock = current_stock + ${Number(line.quantity)}, updated_at = NOW()
          WHERE id = ${line.itemId}
        `);
      }
    }

    // Mark payments as reversed
    await db.update(payments).set({
      isReversed: 1,
      reversalReason: `Invoice ${inv.invoiceNumber} voided`,
      reversedAt: new Date(),
    }).where(eq(payments.invoiceId, id));

    // Audit log
    await db.insert(auditLogs).values({
      userId,
      businessId: inv.businessId,
      locationId: inv.locationId,
      action: 'VOID',
      entityType: 'INVOICE',
      entityId: id,
      metadata: JSON.stringify({ reason }),
    });

    res.json({ success: true, message: 'Invoice voided successfully and stock restored' });
  } catch (error: any) {
    console.error('Failed to void invoice:', error);
    res.status(500).json({ error: 'Failed to void invoice' });
  }
});

// GET /api/invoices/credit-debit-notes - List Credit & Debit Notes
invoiceRouter.get('/notes/all', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const businessId = req.businessId;

    const list = await db.select()
      .from(creditDebitNotes)
      .where(and(eq(creditDebitNotes.userId, userId), businessId ? eq(creditDebitNotes.businessId, businessId) : sql`1=1`))
      .orderBy(desc(creditDebitNotes.noteDate), desc(creditDebitNotes.id));

    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch credit/debit notes' });
  }
});

export default invoiceRouter;
