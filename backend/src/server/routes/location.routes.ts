import { Router, Response } from 'express';
import { requireAuth, AuthRequest, verifyBusinessOwnership } from '../middleware/auth.ts';
import { createLocationSchema, updateLocationSchema } from '../validators/location.validator.ts';
import { getLocationsWithRecordCount, createLocation, updateLocation, deleteLocation } from '../../db/locations.ts';

const locationRouter = Router();
locationRouter.use(requireAuth);

locationRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.businessId;
    const locations = await getLocationsWithRecordCount(req.dbUser!.id, businessId);
    res.json(locations);
  } catch (error) {
    console.error('Failed to fetch locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

locationRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createLocationSchema.parse(req.body);
    const businessId = data.businessId || req.businessId;
    if (businessId) {
      const isOwner = await verifyBusinessOwnership(req.dbUser!.id, businessId);
      if (!isOwner) {
        return res.status(403).json({ error: 'Forbidden: You do not own this business' });
      }
    }

    const location = await createLocation(req.dbUser!.id, {
      ...data,
      businessId,
    });
    res.status(201).json(location);
  } catch (error: any) {
    if (error.name === 'ZodError') throw error;
    console.error('Failed to create location:', error);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

locationRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const data = updateLocationSchema.parse(req.body);
    
    const location = await updateLocation(req.dbUser!.id, id, data);
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
    res.json({ success: true, message: 'Location archived' });
  } catch (error: any) {
    console.error('Failed to delete location:', error);
    res.status(400).json({ error: error.message || 'Failed to archive location' });
  }
});

export default locationRouter;
