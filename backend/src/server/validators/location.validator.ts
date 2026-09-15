import { z } from 'zod';

export const createLocationSchema = z.object({
  businessId: z.number().int().optional(),
  name: z.string().min(1, "Location name is required").max(100),
  address: z.string().max(255).optional().nullable().default(''),
  city: z.string().optional().nullable().default(''),
  state: z.string().default('Gujarat'),
  pincode: z.string().optional().nullable().default(''),
  gstin: z.string().optional().nullable().default(''),
  contactPerson: z.string().optional().nullable().default(''),
  mobile: z.string().optional().nullable().default(''),
});

export const updateLocationSchema = createLocationSchema.partial();
