import { z } from 'zod';

export const internalComponentSchema = z.object({
  productId: z.string(),
  quantity: z.number(),
  selectedPriceTier: z.enum(['price1', 'price2', 'price3', 'price4']).optional(),
});

export const externalComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number(),
  quantity: z.number(),
});

export const createCompositionSchema = z.object({
  id: z.string().optional(),
  branchId: z.string().min(1, 'branchId is required'),
  name: z.string().min(1, 'Name is required'),
  quantity: z.number().default(0),
  price1: z.number().default(0),
  price2: z.number().default(0),
  price3: z.number().default(0),
  price4: z.number().optional(),
  totalCost: z.number().default(0),
  internalComponents: z.array(internalComponentSchema).default([]),
  externalComponents: z.array(externalComponentSchema).default([]),
  createdProductId: z.string().optional(),
  createdAt: z.string().optional(),
});
