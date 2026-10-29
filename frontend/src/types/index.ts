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
  salary?: number;
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
  branchId?: string;
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
  branchId?: string;
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
  physicalItemId?: string;
  productId: string;
  productName?: string;
  unitPrice: number;
  quantity?: number;
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
  paymentMethod: 'cash' | 'card' | 'transfer' | 'vodafone_cash' | 'instapay' | 'multi';
  paymentStatus?: 'paid' | 'partial' | 'deferred';
  paymentSubMethod?: 'cash' | 'vodafone_cash' | 'instapay' | 'multi';
  paidAmount?: number;
  remainingAmount?: number;
  splitPayments?: {
    cash?: number;
    vodafone_cash?: number;
    instapay?: number;
  };
  vodafoneNumber?: string;
  isFavorite?: boolean;
  createdAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  branchId?: string;
}

export interface FixedExpense {
  id: string;
  branchId: string;
  title: string;
  amount: number;
  type: 'daily' | 'monthly';
  date: string;
  userId?: string;
  userName?: string;
}

export interface SalaryWithdrawal {
  id: string;
  userId: string;
  userName: string;
  branchId: string;
  amount: number;
  reason: string;
  date: string;
  createdAt?: string;
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

export interface SupplierPaymentRecord {
  id: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface SupplierPurchase {
  id: string;
  supplierName: string;
  supplierPhone?: string;
  invoiceNumber?: string;
  itemsDescription?: string;
  branchId?: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  purchaseDate: string; // ISO string including date and time
  notes?: string;
  paymentHistory?: SupplierPaymentRecord[];
  createdAt: string;
  updatedAt?: string;
}

export const VODAFONE_CASH_NUMBERS = ['01210866936', '01070722762', '01028514926'] as const;
export type VodafoneCashNumber = (typeof VODAFONE_CASH_NUMBERS)[number];

export interface CustomerDebtPayment {
  id: string;
  branchId: string;
  invoiceId?: string;
  customerPhone?: string;
  customerName?: string;
  amount: number;
  paymentMethod: 'cash' | 'vodafone_cash' | 'instapay';
  vodafoneNumber?: string;
  date: string;
  userName?: string;
  createdAt?: string;
}
