import { z } from 'zod';

export const productBranchDataSchema = z.object({
  productId: z.string().optional(),
  branchId: z.string().min(1, 'branchId is required'),
  cost: z.number().default(0),
  price1: z.number().default(0),
  price1Label: z.string().default('سعر 1'),
  price2: z.number().default(0),
  price2Label: z.string().default('سعر 2'),
  price3: z.number().default(0),
  price3Label: z.string().default('سعر 3'),
  price4: z.number().default(0),
  price4Label: z.string().default('سعر 4'),
  minStock: z.number().default(0),
  quantity: z.number().default(0),
});

export const createProductSchema = z.object({
  id: z.string().optional(),
  nameEn: z.string().default(''),
  nameAr: z.string().min(1, 'Arabic product name is required'),
  descriptionEn: z.string().optional().default(''),
  descriptionAr: z.string().optional().default(''),
  categoryId: z.string().min(1, 'Category is required'),
  subcategoryId: z.string().optional(),
  imageUrl: z.string().optional(),
  sku: z.string().default(''),
  productCode: z.string().default(''),
  material: z.string().default(''),
  color: z.string().default(''),
  size: z.string().default(''),
  brand: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
  branchDataList: z.array(productBranchDataSchema).optional().default([]),
});

export const updateProductSchema = createProductSchema.partial();
