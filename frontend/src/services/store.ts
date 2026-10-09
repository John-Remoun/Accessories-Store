import { mockBranches, mockCategories, mockCustomers, mockPhysicalItems, mockInvoices, mockProducts, mockUsers, mockProductBranchData } from '../mock/data';
import { Branch, Category, Customer, PhysicalItem, Invoice, Product, User, ProductBranchData, FixedExpense, ProductComposition } from '../types';
import { api } from './api';

const STORE_KEY = 'accessories_store_data_v12';

export interface AppState {
  users: User[];
  branches: Branch[];
  categories: Category[];
  products: Product[];
  productBranchData: ProductBranchData[];
  physicalItems: PhysicalItem[];
  customers: Customer[];
  invoices: Invoice[];
  fixedExpenses: FixedExpense[];
  compositions: ProductComposition[];
}

class StoreService {
  private state: AppState;

  constructor() {
    this.state = this.loadState();
    this.syncWithBackend();

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => this.syncWithBackend());
      setInterval(() => this.syncWithBackend(), 8000);
    }
  }

  public async syncWithBackend() {
    try {
      const [
        fixedExp,
        invs,
        prodList,
        branchDataList,
        catList,
        physItems,
        branchList,
        customerList,
        userList
      ] = await Promise.allSettled([
        api.getFixedExpenses(),
        api.getInvoices(),
        api.getProducts(),
        api.getProductBranchDataList(),
        api.getCategories(),
        api.getPhysicalItems(),
        api.getBranches(),
        api.getCustomers(),
        api.getUsers(),
      ]);

      if (fixedExp.status === 'fulfilled' && Array.isArray(fixedExp.value)) {
        this.state.fixedExpenses = fixedExp.value;
      }
      if (invs.status === 'fulfilled' && Array.isArray(invs.value)) {
        this.state.invoices = invs.value;
      }
      if (branchList.status === 'fulfilled' && Array.isArray(branchList.value) && branchList.value.length > 0) {
        this.state.branches = branchList.value;
      }
      if (customerList.status === 'fulfilled' && Array.isArray(customerList.value)) {
        this.state.customers = customerList.value;
      }
      if (userList.status === 'fulfilled' && Array.isArray(userList.value) && userList.value.length > 0) {
        this.state.users = userList.value;
      }

      // Sync Categories
      if (catList.status === 'fulfilled' && Array.isArray(catList.value)) {
        this.state.categories = catList.value;
      }

      // Sync Products & Branch Data
      if (prodList.status === 'fulfilled' && Array.isArray(prodList.value)) {
        this.state.products = prodList.value;
      }

      if (branchDataList.status === 'fulfilled' && Array.isArray(branchDataList.value)) {
        this.state.productBranchData = branchDataList.value;
      }

      // Sync Physical Items
      if (physItems.status === 'fulfilled' && Array.isArray(physItems.value)) {
        this.state.physicalItems = physItems.value;
      }

      this.saveState();
    } catch (e) {
      console.warn('Backend sync warning:', e);
    }
  }

  private loadState(): AppState {
    const stored = localStorage.getItem(STORE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const state: AppState = {
          users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : mockUsers,
          branches: Array.isArray(parsed.branches) && parsed.branches.length > 0 ? parsed.branches : mockBranches,
          categories: Array.isArray(parsed.categories) ? parsed.categories : [],
          products: Array.isArray(parsed.products) ? parsed.products : [],
          productBranchData: Array.isArray(parsed.productBranchData) ? parsed.productBranchData : [],
          physicalItems: Array.isArray(parsed.physicalItems) ? parsed.physicalItems : [],
          customers: Array.isArray(parsed.customers) ? parsed.customers : [],
          invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
          fixedExpenses: Array.isArray(parsed.fixedExpenses) ? parsed.fixedExpenses : [],
          compositions: Array.isArray(parsed.compositions) ? parsed.compositions : [],
        };

        // Auto-reconcile default super admin users (Bola, Mina, Test)
        for (const defaultUser of mockUsers) {
          const exists = state.users.some((u: User) => u?.username === defaultUser.username);
          if (!exists) {
            state.users.push(defaultUser);
          }
        }

        return state;
      } catch (e) {
        console.error('Failed to parse stored state, reverting to clean state.', e);
      }
    }
    return this.getDefaultState();
  }

  private getDefaultState(): AppState {
    return {
      users: mockUsers,
      branches: mockBranches,
      categories: [],
      products: [],
      productBranchData: [],
      physicalItems: [],
      customers: [],
      invoices: [],
      fixedExpenses: [],
      compositions: [],
    };
  }

  private saveState() {
    localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
  }

  public resetState() {
    this.state = this.getDefaultState();
    this.saveState();
  }

  // --- Users ---
  public getUsers() { return this.state?.users || mockUsers; }
  public getUserByUsername(username: string) { return this.getUsers().find(u => u?.username === username); }
  public addUser(user: User) {
    if (!this.state.users) this.state.users = [];
    this.state.users.push(user);
    this.saveState();
    api.createUser(user).catch(err => console.warn('DB sync warning (createUser):', err));
  }
  public updateUser(id: string, updates: Partial<User>) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u?.id === id);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...updates };
      this.saveState();
      api.updateUser(id, updates).catch(err => console.warn('DB sync warning (updateUser):', err));
    }
  }
  public deleteUser(id: string) {
    this.state.users = (this.state.users || []).filter(u => u?.id !== id);
    this.saveState();
    api.deleteUser(id).catch(err => console.warn('DB sync warning (deleteUser):', err));
  }

  // --- Branches ---
  public getBranches() { return this.state?.branches || mockBranches; }
  public getBranch(id: string) { return this.getBranches().find(b => b?.id === id); }
  public addBranch(branch: Branch) {
    if (!this.state.branches) this.state.branches = [];
    this.state.branches.push(branch);
    this.saveState();
    api.createBranch(branch).catch(err => console.warn('DB sync warning (createBranch):', err));
  }
  public updateBranch(id: string, updates: Partial<Branch>) {
    const branches = this.getBranches();
    const idx = branches.findIndex(b => b?.id === id);
    if (idx !== -1) {
      branches[idx] = { ...branches[idx], ...updates };
      this.saveState();
      api.updateBranch(id, updates).catch(err => console.warn('DB sync warning (updateBranch):', err));
    }
  }
  public deleteBranch(id: string) {
    this.state.branches = (this.state.branches || []).filter(b => b?.id !== id);
    this.saveState();
    api.deleteBranch(id).catch(err => console.warn('DB sync warning (deleteBranch):', err));
  }

  // --- Categories ---
  public getCategories() { return this.state?.categories || []; }
  public addCategory(cat: Category) {
    if (!this.state.categories) this.state.categories = [];
    this.state.categories.push(cat);
    this.saveState();
    api.createCategory(cat).catch(err => console.warn('DB sync warning (createCategory):', err));
  }
  public updateCategory(id: string, nameAr: string) {
    const cat = (this.state.categories || []).find(c => c?.id === id);
    if (cat) {
      cat.nameAr = nameAr;
      cat.nameEn = nameAr;
      this.saveState();
      api.updateCategory(id, nameAr).catch(err => console.warn('DB sync warning (updateCategory):', err));
    }
  }
  public deleteCategory(id: string) {
    const linkedProductsCount = (this.state.products || []).filter(p => p?.categoryId === id).length;
    if (linkedProductsCount > 0) {
      throw new Error(`لا يمكن حذف هذه الفئة لأنها تحتوي على ${linkedProductsCount} منتج مرتبط بها! يرجى نقل أو حذف المنتجات أولاً.`);
    }
    this.state.categories = (this.state.categories || []).filter(c => c?.id !== id);
    this.saveState();
    api.deleteCategory(id).catch(err => console.warn('DB sync warning (deleteCategory):', err));
  }

  // --- Products & Branch Data ---
  public getProducts() { return this.state?.products || []; }
  public getProduct(id: string) { return this.getProducts().find(p => p?.id === id); }
  public addProduct(product: Product, branchDataList: ProductBranchData[]) {
    if (!this.state.products) this.state.products = [];
    if (!this.state.productBranchData) this.state.productBranchData = [];
    this.state.products.push(product);
    this.state.productBranchData.push(...branchDataList);
    this.saveState();
    api.createProduct(product, branchDataList).catch(err => console.warn('DB sync warning (createProduct):', err));
  }
  public updateProduct(id: string, updates: Partial<Product>) {
    const prods = this.getProducts();
    const idx = prods.findIndex(p => p?.id === id);
    if (idx !== -1) {
      prods[idx] = { ...prods[idx], ...updates };
      this.saveState();
      api.updateProduct(id, updates).catch(err => console.warn('DB sync warning (updateProduct):', err));
    }
  }
  public getProductBranchData(productId: string, branchId: string) {
    return (this.state?.productBranchData || []).find(d => d?.productId === productId && d?.branchId === branchId);
  }
  public updateProductBranchData(data: ProductBranchData) {
    if (!this.state.productBranchData) this.state.productBranchData = [];
    const idx = this.state.productBranchData.findIndex(d => d?.productId === data.productId && d?.branchId === data.branchId);
    if (idx !== -1) {
      this.state.productBranchData[idx] = data;
    } else {
      this.state.productBranchData.push(data);
    }
    this.saveState();
    api.updateBranchData(data).catch(err => console.warn('DB sync warning (updateBranchData):', err));
  }

  public deleteProduct(id: string) {
    this.state.products = (this.state.products || []).filter(p => p?.id !== id);
    this.state.productBranchData = (this.state.productBranchData || []).filter(d => d?.productId !== id);
    this.state.physicalItems = (this.state.physicalItems || []).filter(i => i?.productId !== id);
    this.saveState();
    api.deleteProduct(id).catch(err => console.warn('DB sync warning (deleteProduct):', err));
  }

  public adjustProductBranchQuantity(productId: string, branchId: string, targetQuantity: number, prefix: string) {
    const availableItems = (this.state.physicalItems || []).filter(
      i => i?.productId === productId && i?.branchId === branchId && i?.status === 'available'
    );
    const currentCount = availableItems.length;

    if (targetQuantity > currentCount) {
      const toAdd = targetQuantity - currentCount;
      this.generatePhysicalItems(productId, branchId, toAdd, prefix);
    } else if (targetQuantity < currentCount) {
      const toRemoveCount = currentCount - targetQuantity;
      let removed = 0;
      this.state.physicalItems = (this.state.physicalItems || []).filter(item => {
        if (item?.productId === productId && item?.branchId === branchId && item?.status === 'available' && removed < toRemoveCount) {
          removed++;
          return false;
        }
        return true;
      });
      this.saveState();
      api.adjustStock(productId, branchId, targetQuantity, prefix).catch(err => console.warn('DB sync warning (adjustStock):', err));
    }
  }

  // --- Physical Items ---
  public getPhysicalItems() { return this.state?.physicalItems || []; }
  public getPhysicalItemsByProduct(productId: string) {
    return this.getPhysicalItems().filter(i => i?.productId === productId);
  }
  public getPhysicalItemsByBranch(branchId: string) {
    return this.getPhysicalItems().filter(i => i?.branchId === branchId);
  }
  public generatePhysicalItems(productId: string, branchId: string, quantity: number, prefix: string) {
    if (!this.state.physicalItems) this.state.physicalItems = [];
    const itemId = `QR-${prefix}`;
    const exists = this.state.physicalItems.some(i => i.id === itemId || (i.productId === productId && i.branchId === branchId));
    if (!exists) {
      this.state.physicalItems.push({
        id: itemId,
        productId,
        branchId,
        status: 'available',
        serialNumber: prefix
      });
    }
    this.saveState();
    api.generatePhysicalItems(productId, branchId, quantity, prefix).catch(err => console.warn('DB sync warning (generatePhysicalItems):', err));
  }

  public markPhysicalItemSold(id: string) {
    const item = (this.state.physicalItems || []).find(i => i?.id === id);
    if (item) {
      item.status = 'sold';
      this.saveState();
      api.updatePhysicalItemStatus(id, 'sold').catch(err => console.warn('DB sync warning (updatePhysicalItemStatus):', err));
    }
  }

  // --- Invoices ---
  public getInvoices() { return this.state?.invoices || []; }
  public getInvoicesByBranch(branchId: string) {
    return this.getInvoices().filter(i => i?.branchId === branchId);
  }
  public addInvoice(invoice: Invoice) {
    if (!this.state.invoices) this.state.invoices = [];
    this.state.invoices.push(invoice);
    this.saveState();
    api.createInvoice(invoice).catch(err => {
      console.warn('DB sync warning (createInvoice):', err);
    });
  }
  public toggleFavoriteInvoice(id: string) {
    const inv = (this.state.invoices || []).find(i => i?.id === id);
    if (inv) {
      inv.isFavorite = !inv.isFavorite;
      this.saveState();
    }
  }

  public payInvoice(id: string, amount: number) {
    const inv = (this.state.invoices || []).find(i => i?.id === id);
    if (inv && amount > 0) {
      const currentRemaining = inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.total - (inv.paidAmount || 0));
      const payAmt = Math.min(amount, currentRemaining);
      inv.paidAmount = (inv.paidAmount || 0) + payAmt;
      inv.remainingAmount = Math.max(0, currentRemaining - payAmt);
      inv.paymentStatus = inv.remainingAmount <= 0 ? 'paid' : 'partial';
      this.saveState();
    }
  }

  public payCustomerDebt(customerPhoneOrId: string, amount: number) {
    if (amount <= 0) return;
    const term = customerPhoneOrId.trim();
    const customerInvoices = (this.state.invoices || [])
      .filter(i => (i?.customerPhone && i.customerPhone.trim() === term) || i?.customerId === term)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let remainingToPay = amount;
    for (const inv of customerInvoices) {
      const rem = inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.total - (inv.paidAmount || 0));
      if (rem > 0 && remainingToPay > 0) {
        const payAmt = Math.min(remainingToPay, rem);
        inv.paidAmount = (inv.paidAmount || 0) + payAmt;
        inv.remainingAmount = Math.max(0, rem - payAmt);
        inv.paymentStatus = inv.remainingAmount <= 0 ? 'paid' : 'partial';
        remainingToPay -= payAmt;
      }
    }
    this.saveState();
  }

  public deleteInvoicesByIds(ids: string[]) {
    const set = new Set(ids);
    this.state.invoices = (this.state.invoices || []).filter(i => !set.has(i?.id));
    this.saveState();
    api.deleteInvoicesByIds(ids).catch(err => {
      console.warn('DB sync warning (deleteInvoicesByIds):', err);
    });
  }

  // --- Customers ---
  public getCustomers() { return this.state?.customers || []; }
  public addCustomer(customer: Customer) {
    if (!this.state.customers) this.state.customers = [];
    const existingIndex = this.state.customers.findIndex(
      c => c?.id === customer.id || (c?.phone && customer.phone && c.phone.trim() === customer.phone.trim())
    );
    if (existingIndex !== -1) {
      this.state.customers[existingIndex] = { ...this.state.customers[existingIndex], ...customer };
    } else {
      this.state.customers.push(customer);
    }
    this.saveState();
    api.saveCustomer(customer).catch(err => {
      console.warn('DB sync warning (saveCustomer):', err);
    });
  }
  public removeCustomer(idOrPhone: string) {
    const term = idOrPhone.trim();
    this.state.customers = (this.state.customers || []).filter(
      c => c?.id !== term && c?.phone?.trim() !== term
    );
    this.saveState();
    api.deleteCustomer(term).catch(err => {
      console.warn('DB sync warning (deleteCustomer):', err);
    });
  }

  // --- Fixed Expenses ---
  public getAllFixedExpenses(): FixedExpense[] {
    if (!this.state.fixedExpenses) this.state.fixedExpenses = [];
    return this.state.fixedExpenses;
  }
  public getFixedExpensesByBranch(branchId: string): FixedExpense[] {
    return this.getAllFixedExpenses().filter(e => e?.branchId === branchId);
  }
  public addFixedExpense(expense: FixedExpense) {
    if (!this.state.fixedExpenses) this.state.fixedExpenses = [];
    this.state.fixedExpenses.push(expense);
    this.saveState();
    api.createFixedExpense(expense).catch(err => {
      console.warn('DB sync warning (createFixedExpense):', err);
    });
  }
  public removeFixedExpense(id: string) {
    if (!this.state.fixedExpenses) return;
    this.state.fixedExpenses = this.state.fixedExpenses.filter(e => e?.id !== id);
    this.saveState();
    api.deleteFixedExpense(id).catch(err => {
      console.warn('DB sync warning (deleteFixedExpense):', err);
    });
  }

  // --- Product Compositions ---
  public getCompositionsByBranch(branchId: string): ProductComposition[] {
    if (!this.state.compositions) this.state.compositions = [];
    return this.state.compositions.filter(c => c?.branchId === branchId);
  }

  public addComposition(comp: ProductComposition) {
    if (!this.state.compositions) this.state.compositions = [];
    this.state.compositions.push(comp);
    this.saveState();
    api.createComposition(comp).catch(err => {
      console.warn('DB sync warning (createComposition):', err);
    });
  }

  public deleteComposition(id: string) {
    if (!this.state.compositions) return;
    this.state.compositions = this.state.compositions.filter(c => c?.id !== id);
    this.saveState();
    api.deleteComposition(id).catch(err => {
      console.warn('DB sync warning (deleteComposition):', err);
    });
  }
}

export const store = new StoreService();
