import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.ts';
import { createRecordSchema, updateRecordSchema } from '../validators/record.validator.ts';
import { getRecords, getAllRecords, getRecordMetrics, createRecord, updateRecord, deleteRecord } from '../../db/records.ts';
import { assertLocationAccess } from '../lib/locationAuth.ts';

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
    const locParam = req.query.locationId as string | undefined;
    const locationId = (locParam && locParam !== 'ALL' && locParam !== '0' && !isNaN(parseInt(locParam, 10)))
      ? parseInt(locParam, 10)
      : undefined;

    if (locationId) {
      await assertLocationAccess(req.dbUser!.id, locationId);
    }

    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      type: req.query.type as 'INCOME' | 'EXPENSE' | undefined,
    };

    const data = await getRecords(req.dbUser!.id, locationId, filters);
    res.json(data);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to fetch records:', error);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

recordRouter.get('/metrics', async (req: AuthRequest, res: Response) => {
  try {
    const locParam = req.query.locationId as string | undefined;
    const locationId = (locParam && locParam !== 'ALL' && locParam !== '0' && !isNaN(parseInt(locParam, 10)))
      ? parseInt(locParam, 10)
      : undefined;

    if (locationId) {
      await assertLocationAccess(req.dbUser!.id, locationId);
    }

    const metrics = await getRecordMetrics(req.dbUser!.id, locationId);
    res.json(metrics);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to fetch metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

recordRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const locId = req.body.locationId ? parseInt(String(req.body.locationId), 10) : NaN;
    if (isNaN(locId) || locId <= 0) {
      return res.status(400).json({ error: 'મહેરબાની કરીને પ્રોજેક્ટ લોકેશન સિલેક્ટ કરો / Please select a project location' });
    }
    const data = createRecordSchema.parse(req.body);
    await assertLocationAccess(req.dbUser!.id, data.locationId);
    const record = await createRecord(req.dbUser!.id, data);
    res.status(201).json(record);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    if (error.name === 'ZodError') throw error;
    console.error('Failed to create record:', error);
    res.status(500).json({ error: 'Failed to create record' });
  }
});

recordRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const data = updateRecordSchema.parse(req.body);
    if (data.locationId) {
      await assertLocationAccess(req.dbUser!.id, data.locationId);
    }
    
    const record = await updateRecord(req.dbUser!.id, id, data);
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(record);
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
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
  } catch (error: any) {
    if (error?.status) return res.status(error.status).json({ error: error.message });
    console.error('Failed to delete record:', error);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

export default recordRouter;
