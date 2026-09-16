const fs = require('fs');
const file = 'src/server/routes/siteSupply.routes.ts';
let code = fs.readFileSync(file, 'utf8');

const putMethod = `
siteSupplyRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { locationId, date, teamId, responsiblePerson, workDescription, referenceNumber, notes, investorId, items } = req.body;
    
    if (!locationId || !date || !items || !items.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const totalAmount = items.reduce((sum: number, item: any) => sum + (parseFloat(item.quantity) * parseFloat(item.rate)), 0);

    const result = await db.transaction(async (tx) => {
      // Revert old stock
      const oldItems = await tx.select().from(siteSupplyItems).where(eq(siteSupplyItems.siteSupplyId, id));
      for (const item of oldItems) {
         await StockManager.addStockMovement(tx, req.dbUser!.id, locationId, item.materialId, 'IN', parseFloat(item.quantity as any), id, 'SITE_SUPPLY_UPDATE_REVERT', 'Reversed for update');
      }
      
      await tx.delete(siteSupplyItems).where(eq(siteSupplyItems.siteSupplyId, id));

      const supply = await tx.update(siteSupplies).set({
        locationId, date, teamId: teamId || null, responsiblePerson, workDescription, referenceNumber, notes,
        investorId: investorId || null, totalAmount: totalAmount.toString()
      }).where(and(eq(siteSupplies.id, id), eq(siteSupplies.userId, req.dbUser!.id))).returning();
      
      for (const item of items) {
        if (item.materialId && parseFloat(item.quantity) > 0) {
          const amount = parseFloat(item.quantity) * parseFloat(item.rate);
          await tx.insert(siteSupplyItems).values({
            siteSupplyId: id,
            materialId: item.materialId,
            quantity: item.quantity.toString(),
            rate: item.rate.toString(),
            amount: amount.toString()
          });
          
          await StockManager.addStockMovement(tx, req.dbUser!.id, locationId, item.materialId, 'OUT', parseFloat(item.quantity), id, 'SITE_SUPPLY', notes);
        }
      }
      
      await tx.insert(auditLogs).values({
        userId: req.dbUser!.id, action: 'UPDATE_SITE_SUPPLY', entityType: 'SITE_SUPPLY', entityId: id
      });

      return supply[0];
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update record' });
  }
});
`;

code = code.replace("siteSupplyRouter.delete('/:id'", putMethod + "\nsiteSupplyRouter.delete('/:id'");
fs.writeFileSync(file, code);
