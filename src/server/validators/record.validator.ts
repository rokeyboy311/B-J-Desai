import { z } from 'zod';

export const createRecordSchema = z.object({
  locationId: z.number().int().positive("Location ID is required"),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.union([z.number().positive(), z.string().regex(/^\d+(\.\d{1,2})?$/)]).transform(Number),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)").optional().nullable(),
  partyName: z.string().min(1, "Party name is required").max(100),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  paymentMethod: z.string().max(50).optional().nullable(),
  referenceNumber: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateRecordSchema = createRecordSchema.omit({ locationId: true });
