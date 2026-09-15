const fs = require('fs');
const file = 'src/server/routes/material.routes.ts';
let code = fs.readFileSync(file, 'utf8');

const putEndpoint = `
materialRouter.put('/:type/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { type, id } = req.params;
    const numId = parseInt(id as string, 10);
    
    if (type === 'purchase' || type === 'supply') {
      const data = req.body;
      const subtotal = Math.round(data.quantity * data.rate * 100) / 100;
      const taxableAmount = subtotal - (data.discount || 0);
      const taxAmount = Math.round(taxableAmount * ((data.taxPercentage || 0) / 100) * 100) / 100;
      const totalAmount = Math.round((taxableAmount + taxAmount + (data.transportCost || data.transport || 0)) * 100) / 100;
      const paid = data.paidAmount !== undefined ? data.paidAmount : (data.paymentStatus === 'PAID' ? totalAmount : 0);
      const outstanding = data.outstandingAmount !== undefined ? data.outstandingAmount : Math.max(0, totalAmount - paid);
      
      const result = await db.transaction(async (tx) => {
        let record: any;
        
        if (type === 'purchase') {
          // Revert old stock
          const oldRec = await tx.select().from(materialPurchases).where(and(eq(materialPurchases.id, numId), eq(materialPurchases.userId, req.dbUser!.id)));
          if (oldRec.length && oldRec[0].materialId) {
             await StockManager.addStockMovement(tx, req.dbUser!.id, oldRec[0].locationId, oldRec[0].materialId, 'OUT', parseFloat(oldRec[0].quantity), numId, 'PURCHASE_UPDATE_REVERT', 'Reversed for update');
          }

          const updated = await tx.update(materialPurchases).set({
            date: data.date, partyName: data.partyName || '', materialName: data.materialName || '', materialId: data.materialId,
            quantity: data.quantity.toString(), unit: data.unit || '', rate: data.rate.toString(),
            subtotal: subtotal.toString(), transportCost: (data.transportCost || 0).toString(),
            discount: (data.discount || 0).toString(), taxPercentage: (data.taxPercentage || 0).toString(),
            tax: taxAmount.toString(), totalAmount: totalAmount.toString(),
            paidAmount: paid.toString(), outstandingAmount: outstanding.toString(),
            paymentStatus: data.paymentStatus || 'UNPAID',
            paymentMethod: data.paymentMethod, referenceNumber: data.referenceNumber, description: data.description || data.notes
          }).where(and(eq(materialPurchases.id, numId), eq(materialPurchases.userId, req.dbUser!.id))).returning();
          record = updated[0];
          
          if (data.materialId && data.quantity > 0) {
            await StockManager.addStockMovement(tx, req.dbUser!.id, data.locationId, data.materialId, 'IN', data.quantity, numId, 'PURCHASE', data.description || data.notes);
          }
        } else {
          // Revert old stock
          const oldRec = await tx.select().from(materialSupplies).where(and(eq(materialSupplies.id, numId), eq(materialSupplies.userId, req.dbUser!.id)));
          if (oldRec.length && oldRec[0].materialId) {
             await StockManager.addStockMovement(tx, req.dbUser!.id, oldRec[0].locationId, oldRec[0].materialId, 'IN', parseFloat(oldRec[0].quantity), numId, 'MATERIAL_SUPPLY_UPDATE_REVERT', 'Reversed for update');
          }

          const updated = await tx.update(materialSupplies).set({
            date: data.date, partyName: data.partyName || '', partyId: data.partyId,
            materialName: data.materialName || '', materialId: data.materialId,
            quantity: data.quantity.toString(), unit: data.unit || '', rate: data.rate.toString(),
            subtotal: subtotal.toString(), transportCost: (data.transportCost || 0).toString(),
            discount: (data.discount || 0).toString(), taxPercentage: (data.taxPercentage || 0).toString(),
            tax: taxAmount.toString(), totalAmount: totalAmount.toString(),
            paidAmount: paid.toString(), outstandingAmount: outstanding.toString(),
            paymentStatus: data.paymentStatus || 'UNPAID',
            paymentMethod: data.paymentMethod, referenceNumber: data.referenceNumber, notes: data.description || data.notes
          }).where(and(eq(materialSupplies.id, numId), eq(materialSupplies.userId, req.dbUser!.id))).returning();
          record = updated[0];
          
          if (data.materialId && data.quantity > 0) {
            await StockManager.addStockMovement(tx, req.dbUser!.id, data.locationId, data.materialId, 'OUT', data.quantity, numId, 'MATERIAL_SUPPLY', data.description || data.notes);
          }
        }
        
        await tx.insert(auditLogs).values({ userId: req.dbUser!.id, action: \`UPDATE_\${String(type).toUpperCase()}\`, entityType: 'MATERIAL_TRANSACTION', entityId: numId });
        return record;
      });
      return res.json(result);
    }
    res.status(400).json({ error: 'Invalid type' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});
`;

code = code.replace("materialRouter.delete('/:type/:id'", putEndpoint + "\nmaterialRouter.delete('/:type/:id'");
fs.writeFileSync(file, code);
