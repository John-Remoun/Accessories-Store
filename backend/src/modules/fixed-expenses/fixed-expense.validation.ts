import { z } from 'zod';

export const createFixedExpenseSchema = z.object({
  id: z.string().optional(),
  branchId: z.string().min(1, 'branchId is required'),
  title: z.string().min(1, 'Title is required'),
  amount: z.number().min(0, 'Amount must be non-negative'),
  type: z.enum(['daily', 'monthly']),
  date: z.string().optional(),
});
