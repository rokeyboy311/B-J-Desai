import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { createLocationSchema, updateLocationSchema } from '../validators/location.validator.ts';
import { getLocationsWithRecordCount, createLocation, updateLocation, deleteLocation } from '../../db/locations.ts';

const locationRouter = Router();

// Apply auth middleware to all routes in this router
locationRouter.use(requireAuth);

locationRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const locations = await getLocationsWithRecordCount(req.dbUser!.id);
    res.json(locations);
  } catch (error) {
    console.error('Failed to fetch locations from DB:', error, error.stack || error.message);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

locationRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Valid id required' });
    }
    const locations = await getLocationsWithRecordCount(req.dbUser!.id);
    const location = locations.find(l => l.id === id);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json(location);
  } catch (error) {
    console.error('Failed to fetch location by id:', error);
    res.status(500).json({ error: 'Failed to fetch location' });
  }
});

locationRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createLocationSchema.parse(req.body);
    const location = await createLocation(req.dbUser!.id, data.name, data.address);
    res.status(201).json(location);
  } catch (error: any) {
    if (error.name === 'ZodError') throw error; // Let the global error handler catch ZodErrors
    console.error('Failed to create location:', error);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

locationRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const data = updateLocationSchema.parse(req.body);
    
    const location = await updateLocation(req.dbUser!.id, id, data.name, data.address);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json(location);
  } catch (error: any) {
    if (error.name === 'ZodError') throw error;
    console.error('Failed to update location:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

locationRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const location = await deleteLocation(req.dbUser!.id, id);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json({ success: true, message: 'Location deleted' });
  } catch (error) {
    console.error('Failed to delete location:', error);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

export default locationRouter;
