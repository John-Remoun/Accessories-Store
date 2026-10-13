import { z } from 'zod';

export const createSupplierSchema = z.object({
  id: z.string().optional(),
  supplierName: z.string().min(1, 'اسم المورد إجباري'),
  supplierPhone: z.string().optional(),
  invoiceNumber: z.string().optional(),
  itemsDescription: z.string().optional(),
  branchId: z.string().optional(),
  totalAmount: z.number().nonnegative().default(0),
  paidAmount: z.number().nonnegative().default(0),
  remainingAmount: z.number().default(0),
  paymentStatus: z.enum(['paid', 'partial', 'unpaid']).default('unpaid'),
  purchaseDate: z.string().or(z.date()).optional(),
  notes: z.string().optional(),
  paymentHistory: z.array(z.any()).optional().default([]),
});

export const updateSupplierSchema = createSupplierSchema.partial();
