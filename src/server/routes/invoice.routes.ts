import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { invoices, invoiceItems, items, payments, auditLogs } from '../../db/schema.ts';
import { eq, and, desc, sql, or } from 'drizzle-orm';
import { z } from 'zod';

const invoiceRouter = Router();
invoiceRouter.use(requireAuth);

const itemInputSchema = z.object({
  itemId: z.number().int().optional().nullable(),
  description: z.string().min(1),
  hsnCode: z.string().optional().nullable().default(''),
  quantity: z.union([z.number(), z.string()]).transform(v => Math.max(0.01, Number(v) || 1)),
  unit: z.string().optional().default('Nos'),
  rate: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 0)),
  discount: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 0)),
  taxRate: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 0)),
});

const invoiceSchema = z.object({
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
  isInterState: z.boolean().optional().default(false),
  invoiceType: z.enum(['TAX_INVOICE', 'BILL_OF_SUPPLY', 'PROFORMA', 'PURCHASE_BILL']).default('TAX_INVOICE'),
  notes: z.string().optional().nullable().default(''),
  terms: z.string().optional().nullable().default(''),
  paidAmount: z.union([z.number(), z.string()]).transform(v => Math.max(0, Number(v) || 0)).optional().default(0),
  paymentMode: z.string().optional().default('BANK_TRANSFER'),
  referenceNumber: z.string().optional().nullable().default(''),
  items: z.array(itemInputSchema).min(1),
});

// GET /api/invoices - List invoices with filtering
invoiceRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const { locationId, partyId, status, search, invoiceType } = req.query;

    let query = db.select().from(invoices).where(
      and(
        eq(invoices.userId, userId),
        eq(invoices.isDeleted, 0),
        locationId ? eq(invoices.locationId, Number(locationId)) : sql`1=1`,
        partyId ? eq(invoices.partyId, Number(partyId)) : sql`1=1`,
        status ? eq(invoices.paymentStatus, String(status)) : sql`1=1`,
        invoiceType ? eq(invoices.invoiceType, String(invoiceType)) : sql`1=1`,
        search ? or(
          sql`LOWER(${invoices.invoiceNumber}) LIKE LOWER(${'%' + search + '%'})`,
          sql`LOWER(${invoices.partyName}) LIKE LOWER(${'%' + search + '%'})`
        ) : sql`1=1`
      )
    ).orderBy(desc(invoices.invoiceDate), desc(invoices.id));

    const invoiceList = await query;
    res.json(invoiceList);
  } catch (error) {
    console.error('Failed to fetch invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET /api/invoices/next-number - Get next invoice sequence number
invoiceRouter.get('/next-number', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const currentYear = new Date().getFullYear();
    const prefix = `INV-${currentYear}-`;

    const latest = await db.select({ num: invoices.invoiceNumber })
      .from(invoices)
      .where(and(eq(invoices.userId, userId), sql`${invoices.invoiceNumber} LIKE ${prefix + '%'}`))
      .orderBy(desc(invoices.id))
      .limit(1);

    let nextSeq = 1;
    if (latest.length > 0 && latest[0].num) {
      const parts = latest[0].num.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }

    const nextInvoiceNumber = `${prefix}${String(nextSeq).padStart(3, '0')}`;
    res.json({ nextInvoiceNumber });
  } catch (error) {
    res.json({ nextInvoiceNumber: `INV-${new Date().getFullYear()}-001` });
  }
});

// GET /api/invoices/:id - Get full invoice with line items
invoiceRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid invoice ID' });

    const invoiceResult = await db.select().from(invoices).where(
      and(eq(invoices.id, id), eq(invoices.userId, userId), eq(invoices.isDeleted, 0))
    );

    if (invoiceResult.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoiceResult[0];
    const itemsList = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    const paymentsList = await db.select().from(payments).where(and(eq(payments.invoiceId, id), eq(payments.isDeleted, 0)));

    res.json({
      ...invoice,
      items: itemsList,
      payments: paymentsList
    });
  } catch (error) {
    console.error('Failed to fetch invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// POST /api/invoices - Create a new GST invoice with items and calculations
invoiceRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const data = invoiceSchema.parse(req.body);

    // Generate invoice number if not provided
    let invoiceNumber = data.invoiceNumber?.trim();
    if (!invoiceNumber) {
      const currentYear = new Date().getFullYear();
      const prefix = `INV-${currentYear}-`;
      const countRes = await db.select({ count: sql<number>`count(*)` })
        .from(invoices)
        .where(eq(invoices.userId, userId));
      const nextNum = (Number(countRes[0]?.count) || 0) + 1;
      invoiceNumber = `${prefix}${String(nextNum).padStart(3, '0')}`;
    }

    // Process line items & tax calculation
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const processedItems = data.items.map(item => {
      const gross = Math.round(item.quantity * item.rate * 100) / 100;
      const discount = Math.min(gross, item.discount);
      const taxable = Math.round((gross - discount) * 100) / 100;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (data.isInterState) {
        igst = Math.round(taxable * (item.taxRate / 100) * 100) / 100;
      } else {
        cgst = Math.round(taxable * (item.taxRate / 200) * 100) / 100;
        sgst = Math.round(taxable * (item.taxRate / 200) * 100) / 100;
      }

      const totalAmount = Math.round((taxable + cgst + sgst + igst) * 100) / 100;

      subtotal += gross;
      totalDiscount += discount;
      totalTaxable += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      return {
        ...item,
        gross,
        discount,
        taxable,
        cgst,
        sgst,
        igst,
        totalAmount
      };
    });

    const totalTax = Math.round((totalCgst + totalSgst + totalIgst) * 100) / 100;
    const rawTotal = totalTaxable + totalTax;
    const roundedGrandTotal = Math.round(rawTotal);
    const roundOff = Math.round((roundedGrandTotal - rawTotal) * 100) / 100;

    const paidAmount = Math.min(roundedGrandTotal, data.paidAmount);
    const balanceAmount = Math.max(0, roundedGrandTotal - paidAmount);
    const paymentStatus = paidAmount >= roundedGrandTotal ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID';

    // Insert invoice header
    const insertResult = await db.insert(invoices).values({
      userId,
      locationId: data.locationId || null,
      partyId: data.partyId || null,
      partyName: data.partyName,
      partyGst: data.partyGst || null,
      partyAddress: data.partyAddress || null,
      partyPhone: data.partyPhone || null,
      invoiceNumber,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate || null,
      placeOfSupply: data.placeOfSupply || 'Gujarat (24)',
      invoiceType: data.invoiceType,
      subtotal: subtotal.toFixed(2),
      discount: totalDiscount.toFixed(2),
      taxableAmount: totalTaxable.toFixed(2),
      cgst: totalCgst.toFixed(2),
      sgst: totalSgst.toFixed(2),
      igst: totalIgst.toFixed(2),
      totalTax: totalTax.toFixed(2),
      roundOff: roundOff.toFixed(2),
      totalAmount: roundedGrandTotal.toFixed(2),
      paidAmount: paidAmount.toFixed(2),
      balanceAmount: balanceAmount.toFixed(2),
      paymentStatus,
      notes: data.notes || null,
      terms: data.terms || null,
    }).returning();

    const createdInvoice = insertResult[0];

    // Insert line items & update stock
    for (const item of processedItems) {
      await db.insert(invoiceItems).values({
        invoiceId: createdInvoice.id,
        itemId: item.itemId || null,
        description: item.description,
        hsnCode: item.hsnCode || null,
        quantity: item.quantity.toString(),
        unit: item.unit,
        rate: item.rate.toString(),
        discount: item.discount.toString(),
        taxableAmount: item.taxable.toString(),
        taxRate: item.taxRate.toString(),
        cgst: item.cgst.toString(),
        sgst: item.sgst.toString(),
        igst: item.igst.toString(),
        totalAmount: item.totalAmount.toString(),
      });

      // Deduct stock if linked to catalog item and sale invoice
      if (item.itemId && (data.invoiceType === 'TAX_INVOICE' || data.invoiceType === 'BILL_OF_SUPPLY')) {
        await db.update(items)
          .set({
            currentStock: sql`${items.currentStock} - ${item.quantity}`,
            updatedAt: new Date()
          })
          .where(and(eq(items.id, item.itemId), eq(items.userId, userId)));
      }
    }

    // If initial payment recorded, create payment record
    if (paidAmount > 0) {
      await db.insert(payments).values({
        userId,
        locationId: data.locationId || null,
        partyId: data.partyId || null,
        partyName: data.partyName,
        invoiceId: createdInvoice.id,
        date: data.invoiceDate,
        amount: paidAmount.toFixed(2),
        paymentType: 'PAYMENT_IN',
        paymentMode: data.paymentMode || 'BANK_TRANSFER',
        referenceNumber: data.referenceNumber || `INV-${invoiceNumber}`,
        notes: `Receipt against Invoice ${invoiceNumber}`,
      });
    }

    await db.insert(auditLogs).values({
      userId,
      action: 'CREATE_INVOICE',
      entityType: 'INVOICE',
      entityId: createdInvoice.id,
      metadata: JSON.stringify({ invoiceNumber, totalAmount: roundedGrandTotal, partyName: data.partyName })
    });

    res.status(201).json(createdInvoice);
  } catch (error: any) {
    console.error('Failed to create invoice:', error);
    res.status(400).json({ error: error?.message || 'Failed to create invoice' });
  }
});

// POST /api/invoices/:id/payments - Record payment against invoice
invoiceRouter.post('/:id/payments', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const invoiceId = parseInt(String(req.params.id), 10);
    if (isNaN(invoiceId)) return res.status(400).json({ error: 'Invalid invoice ID' });

    const paymentSchema = z.object({
      amount: z.union([z.number().positive(), z.string()]).transform(Number),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      paymentMode: z.string().default('BANK_TRANSFER'),
      referenceNumber: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    });

    const data = paymentSchema.parse(req.body);

    const inv = await db.select().from(invoices).where(
      and(eq(invoices.id, invoiceId), eq(invoices.userId, userId), eq(invoices.isDeleted, 0))
    );

    if (inv.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const currentInv = inv[0];

    const currentPaid = parseFloat(currentInv.paidAmount || '0');
    const total = parseFloat(currentInv.totalAmount || '0');
    const newPaid = Math.min(total, currentPaid + data.amount);
    const newBalance = Math.max(0, total - newPaid);
    const newStatus = newPaid >= total ? 'PAID' : 'PARTIAL';

    // Insert payment record
    const payResult = await db.insert(payments).values({
      userId,
      locationId: currentInv.locationId,
      partyId: currentInv.partyId,
      partyName: currentInv.partyName,
      invoiceId,
      date: data.date,
      amount: data.amount.toFixed(2),
      paymentType: 'PAYMENT_IN',
      paymentMode: data.paymentMode,
      referenceNumber: data.referenceNumber || null,
      notes: data.notes || `Payment for invoice ${currentInv.invoiceNumber}`,
    }).returning();

    // Update invoice
    await db.update(invoices).set({
      paidAmount: newPaid.toFixed(2),
      balanceAmount: newBalance.toFixed(2),
      paymentStatus: newStatus,
      updatedAt: new Date()
    }).where(eq(invoices.id, invoiceId));

    res.status(201).json(payResult[0]);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to record payment' });
  }
});

// DELETE /api/invoices/:id - Soft delete invoice
invoiceRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid invoice ID' });

    // Restore stock if needed
    const invItems = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    for (const item of invItems) {
      if (item.itemId) {
        await db.update(items)
          .set({ currentStock: sql`${items.currentStock} + ${item.quantity}` })
          .where(and(eq(items.id, item.itemId), eq(items.userId, userId)));
      }
    }

    await db.update(invoices)
      .set({ isDeleted: 1, updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

export default invoiceRouter;
