import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { createRecordSchema, updateRecordSchema } from '../validators/record.validator.ts';
import { getRecords, getAllRecords, getRecordMetrics, createRecord, updateRecord, deleteRecord } from '../../db/records.ts';

const recordRouter = Router();

recordRouter.use(requireAuth);

recordRouter.get('/all', async (req: AuthRequest, res: Response) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      type: req.query.type as 'INCOME' | 'EXPENSE' | undefined,
    };

    const data = await getAllRecords(req.dbUser!.id, filters);
    res.json(data);
  } catch (error) {
    console.error('Failed to fetch all records:', error);
    res.status(500).json({ error: 'Failed to fetch all records' });
  }
});

recordRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const locationId = parseInt(req.query.locationId as string, 10);
    if (isNaN(locationId)) {
      return res.status(400).json({ error: 'locationId query parameter is required' });
    }

    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      type: req.query.type as 'INCOME' | 'EXPENSE' | undefined,
    };

    const data = await getRecords(req.dbUser!.id, locationId, filters);
    res.json(data);
  } catch (error) {
    console.error('Failed to fetch records:', error);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

recordRouter.get('/metrics', async (req: AuthRequest, res: Response) => {
  try {
    const locationId = parseInt(req.query.locationId as string, 10);
    if (isNaN(locationId)) {
      return res.status(400).json({ error: 'locationId query parameter is required' });
    }

    const metrics = await getRecordMetrics(req.dbUser!.id, locationId);
    res.json(metrics);
  } catch (error) {
    console.error('Failed to fetch metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

recordRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createRecordSchema.parse(req.body);
    const record = await createRecord(req.dbUser!.id, data);
    res.status(201).json(record);
  } catch (error: any) {
    if (error.name === 'ZodError') throw error;
    console.error('Failed to create record:', error);
    res.status(500).json({ error: 'Failed to create record' });
  }
});

recordRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const data = updateRecordSchema.parse(req.body);
    
    const record = await updateRecord(req.dbUser!.id, id, data);
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(record);
  } catch (error: any) {
    if (error.name === 'ZodError') throw error;
    console.error('Failed to update record:', error);
    res.status(500).json({ error: 'Failed to update record' });
  }
});

recordRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const record = await deleteRecord(req.dbUser!.id, id);
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json({ success: true, message: 'Record deleted' });
  } catch (error) {
    console.error('Failed to delete record:', error);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

export default recordRouter;
