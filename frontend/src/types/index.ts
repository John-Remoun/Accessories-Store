export type Role = 'admin' | 'manager' | 'employee';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  password?: string;
  branchId?: string;
  profileImage?: string;
  joinDate?: string;
  salesCount?: number;
  phone?: string;
  email?: string;
}

export interface Branch {
  id: string;
  nameEn: string;
  nameAr: string;
  location: string;
}

export interface Category {
  id: string;
  nameEn: string;
  nameAr: string;
}

export interface Product {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  categoryId: string;
  subcategoryId?: string;
  imageUrl?: string;
  sku: string;
  productCode: string;
  material: string;
  color: string;
  size: string;
  brand?: string;
  notes?: string;
  isActive: boolean;
}

export interface ProductBranchData {
  productId: string;
  branchId: string;
  cost: number;
  price1: number;
  price1Label: string;
  price2: number;
  price2Label: string;
  price3: number;
  price3Label: string;
  price4: number;
  price4Label: string;
  minStock: number;
  quantity?: number;
}

export interface PhysicalItem {
  id: string;
  productId: string;
  branchId: string;
  status: 'available' | 'sold' | 'reserved' | 'damaged' | 'lost';
  serialNumber: string;
}

export interface InvoiceItem {
  physicalItemId: string;
  productId: string;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  branchId: string;
  employeeId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  date: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  totalCost: number; // For profit calculation
  paymentMethod: 'cash' | 'card' | 'transfer' | 'vodafone_cash' | 'instapay';
  paymentStatus?: 'paid' | 'partial' | 'deferred';
  paymentSubMethod?: 'cash' | 'vodafone_cash' | 'instapay';
  paidAmount?: number;
  remainingAmount?: number;
  isFavorite?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

export interface FixedExpense {
  id: string;
  branchId: string;
  title: string;
  amount: number;
  type: 'daily' | 'monthly';
  date: string;
}

export interface InternalComponent {
  productId: string;
  quantity: number;
  selectedPriceTier?: 'price1' | 'price2' | 'price3' | 'price4';
}

export interface ExternalComponent {
  id: string;
  name: string;
  cost: number;
  quantity: number;
}

export interface ProductComposition {
  id: string;
  branchId: string;
  name: string;
  quantity: number; // Available quantity in branch
  price1: number;
  price2: number;
  price3: number;
  price4?: number;
  totalCost: number;
  internalComponents: InternalComponent[];
  externalComponents: ExternalComponent[];
  createdProductId?: string;
  createdAt: string;
}
