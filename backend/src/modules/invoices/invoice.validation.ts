import { z } from 'zod';

export const invoiceItemSchema = z.object({
  physicalItemId: z.string(),
  productId: z.string(),
  productName: z.string().optional(),
  unitPrice: z.number(),
  unitCost: z.number().optional(),
  quantity: z.number().optional().default(1),
  profit: z.number().optional(),
});

export const createInvoiceSchema = z.object({
  id: z.string().optional(),
  invoiceNumber: z.string().optional(),
  branchId: z.string().min(1, 'branchId is required'),
  employeeId: z.string().min(1, 'employeeId is required'),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  date: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  subtotal: z.number(),
  discount: z.number().default(0),
  total: z.number(),
  totalCost: z.number().default(0),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'vodafone_cash', 'instapay']).default('cash'),
  paymentStatus: z.enum(['paid', 'partial', 'deferred']).optional().default('paid'),
  paymentSubMethod: z.enum(['cash', 'vodafone_cash', 'instapay']).optional(),
  paidAmount: z.number().optional(),
  remainingAmount: z.number().optional(),
});
