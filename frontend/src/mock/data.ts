import { Branch, Category, Customer, PhysicalItem, Invoice, Product, User, ProductBranchData } from '../types';

export const mockUsers: User[] = [
  { id: 'admin-bola', username: 'bola', name: 'Bola', role: 'admin', password: '00000000', joinDate: '2026-01-01' },
  { id: 'admin-mina', username: 'mina', name: 'Mina', role: 'admin', password: '00000000', joinDate: '2026-01-01' },
  { id: 'admin-test', username: 'test', name: 'Test', role: 'admin', password: '12344321', joinDate: '2026-01-01' },
];

export const mockBranches: Branch[] = [
  { id: 'b4', nameEn: 'El Maktab Branch', nameAr: 'فرع المكتب', location: 'بني سويف - المكتب الرئيسي' },
  { id: 'b1', nameEn: 'Ahmed Orabi Branch', nameAr: 'فرع أحمد عرابي', location: 'بني سويف - ش/ أحمد عرابي أمام مول النصر' },
  { id: 'b2', nameEn: 'El Modereya Branch', nameAr: 'فرع ميدان المديرية', location: 'بني سويف - ميدان المديرية خلف استوديو وان' },
  { id: 'b3', nameEn: 'Corniche Branch', nameAr: 'فرع كورنيش النيل', location: 'بني سويف - كورنيش النيل بوابة ٢ أمام لاميرا' },
];

export const mockCategories: Category[] = [];

export const mockProducts: Product[] = [];

export const mockProductBranchData: ProductBranchData[] = [];

export const mockPhysicalItems: PhysicalItem[] = [];

export const mockCustomers: Customer[] = [];

export const mockInvoices: Invoice[] = [];
