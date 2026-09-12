import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { getRecords, getRecordMetrics } from '../../db/records.ts';
import { db } from '../../db/index.ts';
import { locations, records } from '../../db/schema.ts';
import { eq, and, sql } from 'drizzle-orm';
import { generateExcelBuffer } from '../lib/excel.ts';

const reportRouter = Router();

reportRouter.use(requireAuth);

reportRouter.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;

    // Get total locations
    const locResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(locations)
      .where(and(eq(locations.userId, userId), eq(locations.isDeleted, 0)));
      
    const totalLocations = locResult[0].count;

    // Get global totals
    const metricsResult = await db.select({
      type: records.type,
      total: sql<string>`sum(${records.amount})`
    })
    .from(records)
    .where(and(eq(records.userId, userId), eq(records.isDeleted, 0)))
    .groupBy(records.type);

    let totalIncome = 0;
    let totalExpense = 0;

    metricsResult.forEach(row => {
      if (row.type === 'INCOME') totalIncome += parseFloat(row.total || '0');
      if (row.type === 'EXPENSE') totalExpense += parseFloat(row.total || '0');
    });

    res.json({
      totalLocations,
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense
    });
  } catch (error) {
    console.error('Failed to fetch dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

reportRouter.get('/analytics', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;

    // Fetch all records
    const allRecords = await db.select({
      type: records.type,
      amount: records.amount,
      date: records.date,
      category: records.category
    })
    .from(records)
    .where(and(eq(records.userId, userId), eq(records.isDeleted, 0)));

    // Process for Monthly Bar Chart
    const monthlyMap = new Map<string, { Income: number, Expense: number }>();
    
    // Process for Category Pie Chart (Expenses only for simplicity, or both if needed. Let's do Expense)
    const categoryMap = new Map<string, number>();

    allRecords.forEach(r => {
      // month grouping (YYYY-MM)
      const monthKey = r.date.substring(0, 7);
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { Income: 0, Expense: 0 });
      }
      
      const amt = parseFloat(r.amount);
      const monthData = monthlyMap.get(monthKey)!;
      
      if (r.type === 'INCOME') monthData.Income += amt;
      else if (r.type === 'EXPENSE') monthData.Expense += amt;

      if (r.type === 'EXPENSE') {
        const cat = r.category?.trim() || 'Uncategorized';
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + amt);
      }
    });

    // Format output
    const monthly = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({ month, ...data }));

    const categories = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    res.json({ monthly, categories });
  } catch (error) {
    console.error('Failed to generate analytics:', error);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

reportRouter.get('/export-location/:id', async (req: AuthRequest, res: Response) => {
  try {
    const locationId = parseInt(req.params.id as string, 10);
    if (isNaN(locationId)) {
      return res.status(400).json({ error: 'Invalid location ID' });
    }

    // Verify location ownership and get name
    const locationResult = await db.select().from(locations).where(
      and(eq(locations.id, locationId), eq(locations.userId, req.dbUser!.id))
    );

    if (locationResult.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }
    const locationName = locationResult[0].name;

    // Fetch data
    const records = await getRecords(req.dbUser!.id, locationId);
    const metrics = await getRecordMetrics(req.dbUser!.id, locationId);

    // Generate Excel
    const buffer = generateExcelBuffer(locationName, records, metrics);

    // Send response
    const filename = `Hisab-Kitab_${locationName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Failed to export excel:', error);
    res.status(500).json({ error: 'Failed to generate Excel export' });
  }
});

export default reportRouter;
