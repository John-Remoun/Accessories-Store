import { z } from 'zod';

export const createBranchSchema = z.object({
  id: z.string().optional(),
  nameEn: z.string().min(1, 'English name is required'),
  nameAr: z.string().min(1, 'Arabic name is required'),
  location: z.string().min(1, 'Location is required'),
});

export const updateBranchSchema = createBranchSchema.partial();
