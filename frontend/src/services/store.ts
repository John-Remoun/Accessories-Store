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
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.loadState();
    this.syncWithBackend();

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => this.syncWithBackend());
      setInterval(() => this.syncWithBackend(), 2500);
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(fn => {
      try { fn(); } catch (e) { console.error('Listener error:', e); }
    });
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
        const backendExp = fixedExp.value;
        const localExp = this.state.fixedExpenses || [];
        const expMap = new Map<string, FixedExpense>();
        backendExp.forEach(e => expMap.set(e.id, e));
        localExp.forEach(e => {
          if (!expMap.has(e.id)) {
            expMap.set(e.id, e);
          }
        });
        this.state.fixedExpenses = Array.from(expMap.values());
      }

      if (invs.status === 'fulfilled' && Array.isArray(invs.value)) {
        const backendInvs = invs.value;
        const localInvs = this.state.invoices || [];
        const invMap = new Map<string, Invoice>();
        backendInvs.forEach(inv => invMap.set(inv.id, inv));
        localInvs.forEach(inv => {
          if (!invMap.has(inv.id)) {
            invMap.set(inv.id, inv);
          }
        });
        this.state.invoices = Array.from(invMap.values()).sort(
          (a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime()
        );
      }

      if (branchList.status === 'fulfilled' && Array.isArray(branchList.value) && branchList.value.length > 0) {
        this.state.branches = branchList.value;
      }

      if (customerList.status === 'fulfilled' && Array.isArray(customerList.value)) {
        const backendCusts = customerList.value;
        const localCusts = this.state.customers || [];
        const custMap = new Map<string, Customer>();
        backendCusts.forEach(c => custMap.set(c.id, c));
        localCusts.forEach(c => {
          if (!custMap.has(c.id)) {
            custMap.set(c.id, c);
          }
        });
        this.state.customers = Array.from(custMap.values());
      }

      if (userList.status === 'fulfilled' && Array.isArray(userList.value) && userList.value.length > 0) {
        const backendUsers = userList.value;
        const currentUsers = this.state.users || mockUsers;
        this.state.users = backendUsers.map(bUser => {
          const existing = currentUsers.find(
            u => u && (u.id === bUser.id || (u.username || '').trim().toLowerCase() === (bUser.username || '').trim().toLowerCase())
          );
          return {
            ...bUser,
            password: bUser.password || existing?.password || '00000000',
          };
        });
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
        this.state.productBranchData = branchDataList.value.map(bd => ({
          ...bd,
          cost: Number(bd.cost || 0),
          price1: Number(bd.price1 || 0),
          price2: Number(bd.price2 || 0),
          price3: Number(bd.price3 || 0),
          price4: Number(bd.price4 || 0),
          minStock: Number(bd.minStock ?? 10),
          quantity: Number(bd.quantity || 0)
        }));
      }

      // Sync Physical Items
      if (physItems.status === 'fulfilled' && Array.isArray(physItems.value)) {
        this.state.physicalItems = physItems.value;
      }

      this.saveState();
      this.notifyListeners();
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
          const idx = state.users.findIndex(
            (u: User) => u && u.username && u.username.trim().toLowerCase() === defaultUser.username.trim().toLowerCase()
          );
          if (idx === -1) {
            state.users.push(defaultUser);
          } else {
            state.users[idx] = {
              ...defaultUser,
              ...state.users[idx],
              password: state.users[idx].password || defaultUser.password,
            };
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
    this.notifyListeners();
  }

  public resetState() {
    this.state = this.getDefaultState();
    this.saveState();
  }

  // --- Users ---
  public getUsers() { return this.state?.users || mockUsers; }
  public getUserByUsername(username: string) {
    if (!username) return undefined;
    const clean = username.trim().toLowerCase();
    return (this.getUsers() || []).find(u => u && u.username && u.username.trim().toLowerCase() === clean);
  }
  public async addUser(user: User) {
    if (!this.state.users) this.state.users = [];
    this.state.users.push(user);
    this.saveState();
    try {
      await api.createUser(user);
      await this.syncWithBackend();
    } catch (err) {
      console.warn('DB sync warning (createUser):', err);
    }
  }
  public async updateUser(id: string, updates: Partial<User>) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u?.id === id);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...updates };
      this.saveState();
      try {
        await api.updateUser(id, updates);
        await this.syncWithBackend();
      } catch (err) {
        console.warn('DB sync warning (updateUser):', err);
      }
    }
  }
  public async deleteUser(id: string) {
    this.state.users = (this.state.users || []).filter(u => u?.id !== id);
    this.saveState();
    try {
      await api.deleteUser(id);
      await this.syncWithBackend();
    } catch (err) {
      console.warn('DB sync warning (deleteUser):', err);
    }
  }

  // --- Branches ---
  public getBranches() {
    const list = [...(this.state?.branches || mockBranches)];
    for (const mb of mockBranches) {
      if (!list.some(b => b?.id === mb.id)) {
        list.push(mb);
      }
    }
    return list;
  }
  public getBranch(id: string) { return this.getBranches().find(b => b?.id === id); }
  public async addBranch(branch: Branch) {
    if (!this.state.branches) this.state.branches = [];
    this.state.branches.push(branch);
    this.saveState();
    try {
      await api.createBranch(branch);
      await this.syncWithBackend();
    } catch (err) {
      console.warn('DB sync warning (createBranch):', err);
    }
  }
  public async updateBranch(id: string, updates: Partial<Branch>) {
    const branches = this.getBranches();
    const idx = branches.findIndex(b => b?.id === id);
    if (idx !== -1) {
      branches[idx] = { ...branches[idx], ...updates };
      this.saveState();
      try {
        await api.updateBranch(id, updates);
        await this.syncWithBackend();
      } catch (err) {
        console.warn('DB sync warning (updateBranch):', err);
      }
    }
  }
  public async deleteBranch(id: string) {
    this.state.branches = (this.state.branches || []).filter(b => b?.id !== id);
    this.saveState();
    try {
      await api.deleteBranch(id);
      await this.syncWithBackend();
    } catch (err) {
      console.warn('DB sync warning (deleteBranch):', err);
    }
  }

  // --- Categories ---
  public getCategories() { return this.state?.categories || []; }
  public async addCategory(cat: Category) {
    if (!this.state.categories) this.state.categories = [];
    this.state.categories.push(cat);
    this.saveState();
    try {
      await api.createCategory(cat);
      await this.syncWithBackend();
    } catch (err) {
      console.warn('DB sync warning (createCategory):', err);
    }
  }
  public async updateCategory(id: string, nameAr: string) {
    const cat = (this.state.categories || []).find(c => c?.id === id);
    if (cat) {
      cat.nameAr = nameAr;
      cat.nameEn = nameAr;
      this.saveState();
      try {
        await api.updateCategory(id, nameAr);
        await this.syncWithBackend();
      } catch (err) {
        console.warn('DB sync warning (updateCategory):', err);
      }
    }
  }
  public async deleteCategory(id: string) {
    const linkedProductsCount = (this.state.products || []).filter(p => p?.categoryId === id).length;
    if (linkedProductsCount > 0) {
      throw new Error(`لا يمكن حذف هذه الفئة لأنها تحتوي على ${linkedProductsCount} منتج مرتبط بها! يرجى نقل أو حذف المنتجات أولاً.`);
    }
    this.state.categories = (this.state.categories || []).filter(c => c?.id !== id);
    this.saveState();
    try {
      await api.deleteCategory(id);
      await this.syncWithBackend();
    } catch (err) {
      console.warn('DB sync warning (deleteCategory):', err);
    }
  }

  // --- Products & Branch Data ---
  public getProducts() { return this.state?.products || []; }
  public getProduct(id: string) { return this.getProducts().find(p => p?.id === id); }
  public async addProduct(product: Product, branchDataList: ProductBranchData[]) {
    if (!this.state.products) this.state.products = [];
    if (!this.state.productBranchData) this.state.productBranchData = [];
    this.state.products.push(product);
    this.state.productBranchData.push(...branchDataList);
    this.saveState();
    try {
      await api.createProduct(product, branchDataList);
      await this.syncWithBackend();
    } catch (err) {
      console.warn('DB sync warning (createProduct):', err);
    }
  }
  public async updateProduct(id: string, updates: Partial<Product>) {
    const prods = this.getProducts();
    const idx = prods.findIndex(p => p?.id === id);
    if (idx !== -1) {
      prods[idx] = { ...prods[idx], ...updates };
      this.saveState();
      try {
        await api.updateProduct(id, updates);
        await this.syncWithBackend();
      } catch (err) {
        console.warn('DB sync warning (updateProduct):', err);
      }
    }
  }
  public getProductBranchData(productId: string, branchId: string) {
    return (this.state?.productBranchData || []).find(d => d?.productId === productId && d?.branchId === branchId);
  }
  public async updateProductBranchData(data: ProductBranchData) {
    if (!this.state.productBranchData) this.state.productBranchData = [];
    const idx = this.state.productBranchData.findIndex(d => d?.productId === data.productId && d?.branchId === data.branchId);
    let updatedData: ProductBranchData;
    if (idx !== -1) {
      const existing = this.state.productBranchData[idx];
      updatedData = {
        ...existing,
        ...data,
        cost: data.cost !== undefined ? Number(data.cost) : Number(existing.cost || 0),
        price1: data.price1 !== undefined ? Number(data.price1) : Number(existing.price1 || 0),
        price2: data.price2 !== undefined ? Number(data.price2) : Number(existing.price2 || 0),
        price3: data.price3 !== undefined ? Number(data.price3) : Number(existing.price3 || 0),
        price4: data.price4 !== undefined ? Number(data.price4) : Number(existing.price4 || 0),
        quantity: data.quantity !== undefined ? Number(data.quantity) : Number(existing.quantity || 0)
      };
      this.state.productBranchData[idx] = updatedData;
    } else {
      updatedData = {
        ...data,
        cost: Number(data.cost || 0),
        price1: Number(data.price1 || 0),
        price2: Number(data.price2 || 0),
        price3: Number(data.price3 || 0),
        price4: Number(data.price4 || 0),
        quantity: Number(data.quantity || 0)
      };
      this.state.productBranchData.push(updatedData);
    }
    this.saveState();
    try {
      await api.updateBranchData(updatedData);
      await this.syncWithBackend();
    } catch (err) {
      console.warn('DB sync warning (updateProductBranchData):', err);
    }
  }

  public async deleteProduct(id: string) {
    this.state.products = (this.state.products || []).filter(p => p?.id !== id);
    this.state.productBranchData = (this.state.productBranchData || []).filter(d => d?.productId !== id);
    this.state.physicalItems = (this.state.physicalItems || []).filter(i => i?.productId !== id);
    this.saveState();
    try {
      await api.deleteProduct(id);
      await this.syncWithBackend();
    } catch (err) {
      console.warn('DB sync warning (deleteProduct):', err);
    }
  }

  public async adjustProductBranchQuantity(productId: string, branchId: string, targetQuantity: number, prefix: string) {
    const bd = this.getProductBranchData(productId, branchId);
    const qty = Number(targetQuantity);
    if (bd) {
      bd.quantity = qty;
      this.saveState();
    } else {
      this.updateProductBranchData({
        productId,
        branchId,
        cost: 0,
        price1: 0,
        price1Label: 'سعر 1',
        price2: 0,
        price2Label: 'سعر 2',
        price3: 0,
        price3Label: 'سعر 3',
        price4: 0,
        price4Label: 'سعر 4',
        minStock: 10,
        quantity: qty
      });
    }
    this.generatePhysicalItems(productId, branchId, qty, prefix);
    try {
      await api.adjustStock(productId, branchId, qty, prefix);
      await this.syncWithBackend();
    } catch (err) {
      console.warn('DB sync warning (adjustStock):', err);
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
  public async addInvoice(invoice: Invoice) {
    if (!this.state.invoices) this.state.invoices = [];
    this.state.invoices.unshift(invoice);
    this.saveState();
    try {
      await api.createInvoice(invoice);
      await this.syncWithBackend();
    } catch (err) {
      console.warn('DB sync warning (createInvoice):', err);
    }
  }
  public toggleFavoriteInvoice(id: string) {
    const inv = (this.state.invoices || []).find(i => i?.id === id);
    if (inv) {
      inv.isFavorite = !inv.isFavorite;
      this.saveState();
    }
  }

  public async payInvoice(id: string, amount: number) {
    const inv = (this.state.invoices || []).find(i => i?.id === id);
    if (inv && amount > 0) {
      const currentRemaining = inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.total - (inv.paidAmount || 0));
      const payAmt = Math.min(amount, currentRemaining);
      inv.paidAmount = (inv.paidAmount || 0) + payAmt;
      inv.remainingAmount = Math.max(0, currentRemaining - payAmt);
      inv.paymentStatus = inv.remainingAmount <= 0 ? 'paid' : 'partial';
      this.saveState();
      try {
        await api.payInvoice(id, amount);
        await this.syncWithBackend();
      } catch (err) {
        console.warn('DB sync warning (payInvoice):', err);
      }
    }
  }

  public async payCustomerDebt(customerPhoneOrId: string, amount: number) {
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
    try {
      await api.payCustomerDebt(term, amount);
      await this.syncWithBackend();
    } catch (err) {
      console.warn('DB sync warning (payCustomerDebt):', err);
    }
  }

  public async deleteInvoicesByIds(ids: string[]) {
    const set = new Set(ids);
    this.state.invoices = (this.state.invoices || []).filter(i => !set.has(i?.id));
    this.saveState();
    try {
      await api.deleteInvoicesByIds(ids);
      await this.syncWithBackend();
    } catch (err) {
      console.warn('DB sync warning (deleteInvoicesByIds):', err);
    }
  }

  // --- Customers ---
  public getCustomers() { return this.state?.customers || []; }
  public getCustomersByBranch(branchId: string) {
    return (this.state?.customers || []).filter(c => !c.branchId || c.branchId === branchId);
  }
  public async addCustomer(customer: Customer) {
    if (!this.state.customers) this.state.customers = [];
    const existingIndex = this.state.customers.findIndex(
      c => c?.id === customer.id || (c?.phone && customer.phone && c.phone.trim() === customer.phone.trim() && (!c.branchId || !customer.branchId || c.branchId === customer.branchId))
    );
    if (existingIndex !== -1) {
      this.state.customers[existingIndex] = { ...this.state.customers[existingIndex], ...customer };
    } else {
      this.state.customers.push(customer);
    }
    this.saveState();
    try {
      await api.saveCustomer(customer);
      await this.syncWithBackend();
    } catch (err) {
      console.warn('DB sync warning (saveCustomer):', err);
    }
  }
  public async removeCustomer(idOrPhone: string) {
    const term = idOrPhone.trim();
    this.state.customers = (this.state.customers || []).filter(
      c => c?.id !== term && c?.phone?.trim() !== term
    );
    this.saveState();
    try {
      await api.deleteCustomer(term);
      await this.syncWithBackend();
    } catch (err) {
      console.warn('DB sync warning (deleteCustomer):', err);
    }
  }

  // --- Fixed Expenses ---
  public getAllFixedExpenses(): FixedExpense[] {
    if (!this.state.fixedExpenses) this.state.fixedExpenses = [];
    return this.state.fixedExpenses;
  }
  public getFixedExpensesByBranch(branchId: string): FixedExpense[] {
    return this.getAllFixedExpenses().filter(e => e?.branchId === branchId);
  }
  public async addFixedExpense(expense: FixedExpense) {
    if (!this.state.fixedExpenses) this.state.fixedExpenses = [];
    this.state.fixedExpenses.push(expense);
    this.saveState();
    try {
      await api.createFixedExpense(expense);
      await this.syncWithBackend();
    } catch (err) {
      console.warn('DB sync warning (createFixedExpense):', err);
    }
  }
  public async removeFixedExpense(id: string) {
    if (!this.state.fixedExpenses) return;
    this.state.fixedExpenses = this.state.fixedExpenses.filter(e => e?.id !== id);
    this.saveState();
    try {
      await api.deleteFixedExpense(id);
      await this.syncWithBackend();
    } catch (err) {
      console.warn('DB sync warning (deleteFixedExpense):', err);
    }
  }

  // --- Product Compositions ---
  public getCompositionsByBranch(branchId: string): ProductComposition[] {
    if (!this.state.compositions) this.state.compositions = [];
    return this.state.compositions.filter(c => c?.branchId === branchId);
  }

  public async addComposition(comp: ProductComposition) {
    if (!this.state.compositions) this.state.compositions = [];
    this.state.compositions.push(comp);
    this.saveState();
    try {
      await api.createComposition(comp);
      await this.syncWithBackend();
    } catch (err) {
      console.warn('DB sync warning (createComposition):', err);
    }
  }

  public async deleteComposition(id: string) {
    if (!this.state.compositions) return;
    this.state.compositions = this.state.compositions.filter(c => c?.id !== id);
    this.saveState();
    try {
      await api.deleteComposition(id);
      await this.syncWithBackend();
    } catch (err) {
      console.warn('DB sync warning (deleteComposition):', err);
    }
  }
}

export const store = new StoreService();
