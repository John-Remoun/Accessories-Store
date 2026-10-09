import { z } from 'zod';

export const createCustomerSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional().default('عميل'),
  phone: z.string().optional().default(''),
  email: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial();
