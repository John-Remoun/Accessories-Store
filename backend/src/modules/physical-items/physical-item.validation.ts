import { z } from 'zod';

export const createPhysicalItemsSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  branchId: z.string().min(1, 'branchId is required'),
  quantity: z.number().min(1, 'quantity must be at least 1'),
  prefix: z.string().default('ITEM'),
});

export const updatePhysicalItemStatusSchema = z.object({
  status: z.enum(['available', 'sold', 'reserved', 'damaged', 'lost']),
});
