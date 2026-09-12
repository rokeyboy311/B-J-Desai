import { z } from 'zod';

export const createLocationSchema = z.object({
  name: z.string().min(1, "Location name is required").max(100),
  address: z.string().max(255).optional().nullable(),
});

export const updateLocationSchema = createLocationSchema;
