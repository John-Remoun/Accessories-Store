import { z } from 'zod';

export const createCategorySchema = z.object({
  id: z.string().optional(),
  nameEn: z.string().optional(),
  nameAr: z.string().min(1, 'Category Arabic name is required'),
});

export const updateCategorySchema = createCategorySchema.partial();
