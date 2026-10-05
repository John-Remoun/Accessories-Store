import { z } from 'zod';

export const createCustomerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Customer name is required'),
  phone: z.string().min(1, 'Customer phone is required'),
  email: z.string().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();
