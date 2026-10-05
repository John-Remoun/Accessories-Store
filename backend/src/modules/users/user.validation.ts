import { z } from 'zod';

export const createUserSchema = z.object({
  id: z.string().optional(),
  username: z.string().min(2, 'Username is required'),
  name: z.string().min(2, 'Name is required'),
  role: z.enum(['admin', 'manager', 'employee']),
  password: z.string().optional(),
  branchId: z.string().optional(),
  profileImage: z.string().optional(),
  joinDate: z.string().optional(),
  salesCount: z.number().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

export const updateUserSchema = createUserSchema.partial();
