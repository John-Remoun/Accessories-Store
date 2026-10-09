import { z } from 'zod';

export const invoiceItemSchema = z.object({
  physicalItemId: z.string().optional().nullable().default(''),
  productId: z.string(),
  productName: z.string().optional().nullable(),
  unitPrice: z.number(),
  unitCost: z.number().optional().nullable().default(0),
  quantity: z.number().optional().default(1),
  profit: z.number().optional().nullable().default(0),
});

export const createInvoiceSchema = z.object({
  id: z.string().optional(),
  invoiceNumber: z.string().optional(),
  branchId: z.string().optional().default('b1'),
  employeeId: z.string().optional().default('u1'),
  customerId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  date: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  subtotal: z.number(),
  discount: z.number().optional().default(0),
  total: z.number(),
  totalCost: z.number().optional().default(0),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'vodafone_cash', 'instapay']).optional().default('cash'),
  paymentStatus: z.enum(['paid', 'partial', 'deferred']).optional().default('paid'),
  paymentSubMethod: z.enum(['cash', 'vodafone_cash', 'instapay']).optional().nullable(),
  paidAmount: z.number().optional().default(0),
  remainingAmount: z.number().optional().default(0),
});
