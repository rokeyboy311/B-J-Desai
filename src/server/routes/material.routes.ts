import { Router, Response } from 'express';
import { requireAuth, AuthRequest, verifyBusinessOwnership } from '../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { materialPurchases, materialSupplies, materialLabourSupplies, items, payments, stockMovements, auditLogs } from '../../db/schema.ts';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { AccountingEngine, DecimalMath } from '../../shared/accountingEngine.ts';
import { FinancialYearService } from '../../shared/financialYear.ts';

const materialRouter = Router();
materialRouter.use(requireAuth);

const purchaseSupplySchema = z.object({
  businessId: z.number().int().optional(),
  locationId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partyName: z.string().min(1),
  materialName: z.string().min(1),
  materialCategory: z.string().optional().nullable().default(''),
  quantity: z.union([z.number(), z.string()]).transform(Number),
  unit: z.string().min(1),
  rate: z.union([z.number(), z.string()]).transform(Number),
  transportCost: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  discount: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  taxPercentage: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  taxRate: z.union([z.number(), z.string()]).transform(Number).optional(),
  paymentStatus: z.string().optional().default('UNPAID'),
  paymentMethod: z.string().optional().nullable().default('BANK_TRANSFER'),
  referenceNumber: z.string().optional().nullable().default(''),
  invoiceNumber: z.string().optional().nullable().default(''),
  supplierInvoiceNo: z.string().optional().nullable(),
  gst: z.string().optional().nullable().default(''),
  supplierGst: z.string().optional().nullable(),
  address: z.string().optional().nullable().default(''),
  notes: z.string().optional().nullable().default(''),
  description: z.string().optional().nullable().default(''),
  paidAmount: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
}).transform(data => ({
  ...data,
  taxPercentage: data.taxPercentage || data.taxRate || 0,
  invoiceNumber: data.invoiceNumber || data.supplierInvoiceNo || '',
  gst: data.gst || data.supplierGst || '',
}));

const labourSupplySchema = z.object({
  businessId: z.number().int().optional(),
  locationId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  siteLocationName: z.string().optional().nullable().default(''),
  teamName: z.string().optional().nullable().default(''),
  materialName: z.string().optional().nullable().default(''),
  materialQuantity: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  materialUnit: z.string().optional().default('Nos'),
  materialRate: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  partyName: z.string().optional().default('N/A'),
  workDescription: z.string().optional().default('N/A'),
  materialAmount: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  labourType: z.string().optional().default('Standard'),
  labourQuantity: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  labourUnit: z.string().optional().default('Days'),
  labourRate: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  labourAmount: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  taxPercentage: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
  taxRate: z.union([z.number(), z.string()]).transform(Number).optional(),
  paymentStatus: z.string().optional().default('UNPAID'),
  paymentMethod: z.string().optional().nullable().default('BANK_TRANSFER'),
  referenceNumber: z.string().optional().nullable().default(''),
  invoiceNumber: z.string().optional().nullable().default(''),
  gst: z.string().optional().nullable().default(''),
  address: z.string().optional().nullable().default(''),
  notes: z.string().optional().nullable().default(''),
  paidAmount: z.union([z.number(), z.string()]).transform(Number).optional().default(0),
}).transform(data => ({
  ...data,
  taxPercentage: data.taxPercentage || data.taxRate || 0,
}));

function normalizeMaterialType(type: string): 'purchase' | 'supply' | 'labour-supply' | null {
  const t = type.toLowerCase();
  if (t === 'purchase' || t === 'purchases') return 'purchase';
  if (t === 'supply' || t === 'supplies') return 'supply';
  if (t === 'labour-supply' || t === 'labour_supply' || t === 'laboursupply') return 'labour-supply';
  return null;
}

materialRouter.get('/:type', async (req: AuthRequest, res: Response) => {
  try {
    const normType = normalizeMaterialType(String(req.params.type));
    if (!normType) return res.status(400).json({ error: 'Invalid type' });

    const businessId = req.businessId;
    const locationIdParam = req.query.locationId as string;
    const locationId = locationIdParam && locationIdParam !== 'all' ? parseInt(locationIdParam, 10) : undefined;

    const baseConditions = [
      eq(materialPurchases.userId, req.dbUser!.id),
      eq(materialPurchases.isDeleted, 0),
    ];
    if (businessId) baseConditions.push(eq(materialPurchases.businessId, businessId));
    if (locationId) baseConditions.push(eq(materialPurchases.locationId, locationId));

    let data;
    if (normType === 'purchase') {
      data = await db.select().from(materialPurchases).where(and(...baseConditions)).orderBy(desc(materialPurchases.date), desc(materialPurchases.id));
    } else if (normType === 'supply') {
      const supplyCond = [
        eq(materialSupplies.userId, req.dbUser!.id),
        eq(materialSupplies.isDeleted, 0),
      ];
      if (businessId) supplyCond.push(eq(materialSupplies.businessId, businessId));
      if (locationId) supplyCond.push(eq(materialSupplies.locationId, locationId));
      data = await db.select().from(materialSupplies).where(and(...supplyCond)).orderBy(desc(materialSupplies.date), desc(materialSupplies.id));
    } else if (normType === 'labour-supply') {
      const lsCond = [
        eq(materialLabourSupplies.userId, req.dbUser!.id),
        eq(materialLabourSupplies.isDeleted, 0),
      ];
      if (businessId) lsCond.push(eq(materialLabourSupplies.businessId, businessId));
      if (locationId) lsCond.push(eq(materialLabourSupplies.locationId, locationId));
      data = await db.select().from(materialLabourSupplies).where(and(...lsCond)).orderBy(desc(materialLabourSupplies.date), desc(materialLabourSupplies.id));
    }
    res.json(data);
  } catch (error) {
    console.error('Failed to fetch material records:', error);
    res.status(500).json({ error: 'Failed to fetch material records' });
  }
});

materialRouter.post('/:type', async (req: AuthRequest, res: Response) => {
  try {
    const normType = normalizeMaterialType(String(req.params.type));
    if (!normType) return res.status(400).json({ error: 'Invalid type' });
    const userId = req.dbUser!.id;
    const businessId = req.body.businessId || req.businessId;

    if (normType === 'purchase' || normType === 'supply') {
      const data = purchaseSupplySchema.parse(req.body);
      const financialYear = FinancialYearService.getFinancialYear(data.date);

      // Determine Inter-state vs Intra-state based on supplier GSTIN
      const supplierStateCode = data.gst?.slice(0, 2) || '24';
      const isInterState = supplierStateCode !== '24';

      const lineCalc = AccountingEngine.calculateLineItem({
        quantity: data.quantity,
        rate: data.rate,
        discount: data.discount,
        taxRate: data.taxPercentage,
        isInterState,
      });

      const totalTax = lineCalc.totalTax;
      const rawTotal = DecimalMath.add(lineCalc.taxableAmount, totalTax, data.transportCost);
      const totalAmount = DecimalMath.round(rawTotal);
      const paidAmount = DecimalMath.min(totalAmount, DecimalMath.max(0, data.paidAmount));
      const outstandingAmount = DecimalMath.max(0, DecimalMath.sub(totalAmount, paidAmount));
      const paymentStatus = paidAmount >= totalAmount ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID';

      if (normType === 'purchase') {
        const result = await db.insert(materialPurchases).values({
          userId,
          businessId,
          locationId: data.locationId,
          date: data.date,
          financialYear,
          partyName: data.partyName,
          materialName: data.materialName,
          materialCategory: data.materialCategory || null,
          quantity: data.quantity.toString(),
          unit: data.unit,
          rate: data.rate.toString(),
          subtotal: lineCalc.subtotal.toString(),
          transportCost: data.transportCost.toString(),
          discount: data.discount.toString(),
          taxPercentage: data.taxPercentage.toString(),
          tax: totalTax.toString(),
          cgst: lineCalc.cgst.toString(),
          sgst: lineCalc.sgst.toString(),
          igst: lineCalc.igst.toString(),
          cess: lineCalc.cessAmount.toString(),
          totalAmount: totalAmount.toString(),
          paidAmount: paidAmount.toString(),
          outstandingAmount: outstandingAmount.toString(),
          paymentStatus,
          paymentMethod: data.paymentMethod || 'BANK_TRANSFER',
          referenceNumber: data.referenceNumber || null,
          invoiceNumber: data.invoiceNumber || null,
          gst: data.gst || null,
          address: data.address || null,
          notes: data.notes || null,
          description: data.description || null,
        }).returning();

        const createdPurchase = result[0];

        // Stock Movement (Inward Purchase)
        const matchingItem = await db.select().from(items).where(
          and(
            eq(items.userId, userId),
            sql`LOWER(${items.name}) = LOWER(${data.materialName})`
          )
        ).limit(1);

        if (matchingItem.length > 0) {
          const itm = matchingItem[0];
          await db.insert(stockMovements).values({
            userId,
            businessId,
            locationId: data.locationId,
            itemId: itm.id,
            movementType: 'PURCHASE',
            quantity: data.quantity.toString(),
            unit: data.unit,
            unitCost: data.rate.toString(),
            totalCost: lineCalc.taxableAmount.toString(),
            sourceDocumentType: 'PURCHASE_BILL',
            sourceDocumentId: createdPurchase.id,
            notes: `Purchase from ${data.partyName}`,
          });

          await db.execute(sql`
            UPDATE items 
            SET current_stock = current_stock + ${data.quantity}, updated_at = NOW()
            WHERE id = ${itm.id}
          `);
        }

        // Linked Supplier Payment
        if (paidAmount > 0) {
          await db.insert(payments).values({
            userId,
            businessId,
            locationId: data.locationId,
            partyName: data.partyName,
            purchaseId: createdPurchase.id,
            date: data.date,
            amount: paidAmount.toString(),
            paymentType: 'PAYMENT_OUT',
            paymentMode: data.paymentMethod || 'BANK_TRANSFER',
            referenceNumber: data.referenceNumber || null,
            notes: `Payment for purchase ${createdPurchase.invoiceNumber || createdPurchase.id}`,
          });
        }

        await db.insert(auditLogs).values({
          userId,
          businessId,
          locationId: data.locationId,
          action: 'CREATE',
          entityType: 'PURCHASE',
          entityId: createdPurchase.id,
          afterState: JSON.stringify(createdPurchase),
        });

        return res.status(201).json(createdPurchase);
      } else {
        // Supply
        const result = await db.insert(materialSupplies).values({
          userId,
          businessId,
          locationId: data.locationId,
          date: data.date,
          partyName: data.partyName,
          materialName: data.materialName,
          materialCategory: data.materialCategory || null,
          quantity: data.quantity.toString(),
          unit: data.unit,
          rate: data.rate.toString(),
          subtotal: lineCalc.subtotal.toString(),
          transportCost: data.transportCost.toString(),
          discount: data.discount.toString(),
          taxPercentage: data.taxPercentage.toString(),
          tax: totalTax.toString(),
          totalAmount: totalAmount.toString(),
          paidAmount: paidAmount.toString(),
          outstandingAmount: outstandingAmount.toString(),
          paymentStatus,
          paymentMethod: data.paymentMethod || 'BANK_TRANSFER',
          referenceNumber: data.referenceNumber || null,
          invoiceNumber: data.invoiceNumber || null,
          gst: data.gst || null,
          address: data.address || null,
          notes: data.notes || null,
          description: data.description || null,
        }).returning();

        return res.status(201).json(result[0]);
      }
    } else {
      // Labour supply
      const data = labourSupplySchema.parse(req.body);
      const matAmt = data.materialAmount || (data.materialQuantity * data.materialRate);
      const labAmt = data.labourAmount || (data.labourQuantity * data.labourRate);
      const subtotal = DecimalMath.add(matAmt, labAmt);
      const tax = DecimalMath.round((subtotal * (data.taxPercentage / 100)));
      const totalAmount = DecimalMath.add(subtotal, tax);
      const paidAmount = DecimalMath.min(totalAmount, DecimalMath.max(0, data.paidAmount));
      const outstandingAmount = DecimalMath.max(0, DecimalMath.sub(totalAmount, paidAmount));
      const paymentStatus = paidAmount >= totalAmount ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID';

      const result = await db.insert(materialLabourSupplies).values({
        userId,
        businessId,
        locationId: data.locationId,
        date: data.date,
        siteLocationName: data.siteLocationName || null,
        teamName: data.teamName || null,
        materialName: data.materialName || null,
        materialQuantity: data.materialQuantity.toString(),
        materialUnit: data.materialUnit,
        materialRate: data.materialRate.toString(),
        materialAmount: matAmt.toString(),
        labourType: data.labourType,
        labourQuantity: data.labourQuantity.toString(),
        labourUnit: data.labourUnit,
        labourRate: data.labourRate.toString(),
        labourAmount: labAmt.toString(),
        partyName: data.partyName,
        workDescription: data.workDescription,
        subtotal: subtotal.toString(),
        taxPercentage: data.taxPercentage.toString(),
        tax: tax.toString(),
        totalAmount: totalAmount.toString(),
        paidAmount: paidAmount.toString(),
        outstandingAmount: outstandingAmount.toString(),
        paymentStatus,
        paymentMethod: data.paymentMethod || 'BANK_TRANSFER',
        referenceNumber: data.referenceNumber || null,
        invoiceNumber: data.invoiceNumber || null,
        gst: data.gst || null,
        address: data.address || null,
        notes: data.notes || null,
      }).returning();

      return res.status(201).json(result[0]);
    }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0]?.message || 'Validation failed' });
    }
    console.error('Failed to create material record:', error);
    res.status(500).json({ error: error.message || 'Failed to create record' });
  }
});

// POST /api/materials/purchases/:id/void - Void purchase bill with stock reversal
materialRouter.post('/purchases/:id/void', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const userId = req.dbUser!.id;
    const { reason } = req.body;

    const purList = await db.select().from(materialPurchases).where(
      and(eq(materialPurchases.id, id), eq(materialPurchases.userId, userId))
    ).limit(1);

    if (purList.length === 0) return res.status(404).json({ error: 'Purchase not found' });
    const pur = purList[0];

    if (pur.isVoid === 1) return res.status(400).json({ error: 'Purchase already voided' });

    await db.update(materialPurchases).set({
      isVoid: 1,
      voidReason: reason || 'Voided by user',
      paymentStatus: 'VOID',
    }).where(eq(materialPurchases.id, id));

    // Revert stock
    const matchingItem = await db.select().from(items).where(
      and(eq(items.userId, userId), sql`LOWER(${items.name}) = LOWER(${pur.materialName})`)
    ).limit(1);

    if (matchingItem.length > 0) {
      await db.insert(stockMovements).values({
        userId,
        businessId: pur.businessId,
        locationId: pur.locationId,
        itemId: matchingItem[0].id,
        movementType: 'REVERSAL',
        quantity: pur.quantity,
        unit: pur.unit,
        unitCost: pur.rate,
        totalCost: pur.subtotal,
        sourceDocumentType: 'PURCHASE_BILL',
        sourceDocumentId: id,
        notes: `Reversal of voided purchase: ${reason || ''}`,
      });

      await db.execute(sql`
        UPDATE items 
        SET current_stock = GREATEST(0, current_stock - ${Number(pur.quantity)}), updated_at = NOW()
        WHERE id = ${matchingItem[0].id}
      `);
    }

    // Revert payments
    await db.update(payments).set({
      isReversed: 1,
      reversalReason: `Purchase ${pur.invoiceNumber || id} voided`,
      reversedAt: new Date(),
    }).where(eq(payments.purchaseId, id));

    await db.insert(auditLogs).values({
      userId,
      businessId: pur.businessId,
      locationId: pur.locationId,
      action: 'VOID',
      entityType: 'PURCHASE',
      entityId: id,
      metadata: JSON.stringify({ reason }),
    });

    res.json({ success: true, message: 'Purchase voided and stock adjusted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to void purchase' });
  }
});

// DELETE /api/materials/:type/:id - Soft delete
materialRouter.delete('/:type/:id', async (req: AuthRequest, res: Response) => {
  try {
    const normType = normalizeMaterialType(String(req.params.type));
    if (!normType) return res.status(400).json({ error: 'Invalid type' });
    const id = parseInt(String(req.params.id), 10);
    const userId = req.dbUser!.id;

    const table = normType === 'purchase' ? materialPurchases : normType === 'supply' ? materialSupplies : materialLabourSupplies;
    await db.update(table).set({ isDeleted: 1 }).where(and(eq(table.id, id), eq(table.userId, userId)));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

export default materialRouter;
