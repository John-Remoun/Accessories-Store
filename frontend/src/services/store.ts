import { mockBranches, mockCategories, mockCustomers, mockPhysicalItems, mockInvoices, mockProducts, mockUsers, mockProductBranchData } from '../mock/data';
import { Branch, Category, Customer, PhysicalItem, Invoice, Product, User, ProductBranchData, FixedExpense, ProductComposition, SupplierPurchase, SupplierPaymentRecord } from '../types';
import { api } from './api';

const STORE_KEY = 'accessories_store_data_v13';

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
  suppliers: SupplierPurchase[];
}

class StoreService {
  private state: AppState;
  private listeners: Set<() => void> = new Set();
  private tombstonedInvoiceIds: Set<string> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private isSocketConnected = false;
  private lastFullSyncTimestamp = 0;
  private lastQuickSyncTimestamp = 0;
  private syncWithBackendPromise: Promise<void> | null = null;
  private quickSyncPromise: Promise<void> | null = null;
  private lastSyncedVersion: string | null = null;
  private consecutiveSyncFailures = 0;
  private nextAllowedSyncTime = 0;

  public setSocketConnected(connected: boolean) {
    const wasConnected = this.isSocketConnected;
    this.isSocketConnected = connected;
    // Only re-sync on reconnect if at least 5 minutes (300,000ms) have elapsed since last full sync
    if (connected && !wasConnected && Date.now() - this.lastFullSyncTimestamp > 300000) {
      this.quickSyncStockAndInvoices();
    }
  }

  public isSocketActive(): boolean {
    return this.isSocketConnected;
  }

  constructor() {
    this.state = this.loadState();
    this.syncWithBackend();

    if (typeof window !== 'undefined') {
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          this.broadcastChannel = new BroadcastChannel('accessories_store_sync_v2');
          this.broadcastChannel.onmessage = (event) => {
            const { type, payload } = event.data || {};
            if (type === 'STOCK_UPDATED' && payload) {
              this.applyRealtimeStockUpdate(payload.branchId, payload.items, false);
            } else if (type === 'INVOICE_CREATED' && payload) {
              if (!this.state.invoices) this.state.invoices = [];
              if (!this.state.invoices.some(i => i.id === payload.id || i.invoiceNumber === payload.invoiceNumber)) {
                this.state.invoices.unshift(payload);
                this.saveState(true);
              }
            } else if (type === 'INVOICE_UPDATED' && payload) {
              if (!this.state.invoices) this.state.invoices = [];
              const idx = this.state.invoices.findIndex(i => i.id === payload.id || i.invoiceNumber === payload.invoiceNumber);
              if (idx !== -1) {
                this.state.invoices[idx] = { ...this.state.invoices[idx], ...payload };
                this.saveState(true);
              }
            } else if (type === 'INVOICES_DELETED' && payload && Array.isArray(payload.ids)) {
              const delSet = new Set(payload.ids);
              payload.ids.forEach((id: string) => this.tombstonedInvoiceIds.add(id));
              this.state.invoices = (this.state.invoices || []).filter(i => !delSet.has(i.id) && !delSet.has(i.invoiceNumber));
              this.saveState(true);
            } else if (type === 'EXPENSE_CREATED' && payload) {
              if (!this.state.fixedExpenses) this.state.fixedExpenses = [];
              if (!this.state.fixedExpenses.some(e => e.id === payload.id)) {
                this.state.fixedExpenses.unshift(payload);
                this.saveState(true);
              }
            } else if (type === 'EXPENSE_DELETED' && payload) {
              this.state.fixedExpenses = (this.state.fixedExpenses || []).filter(e => e.id !== payload.id);
              this.saveState(true);
            } else if (type === 'PRODUCT_CREATED' && payload) {
              if (!this.state.products) this.state.products = [];
              if (!this.state.products.some(p => p.id === payload.product?.id)) {
                this.state.products.unshift(payload.product);
                if (Array.isArray(payload.branchData)) {
                  this.state.productBranchData = [...(this.state.productBranchData || []), ...payload.branchData];
                }
                this.saveState(true);
              }
            } else if (type === 'PRODUCT_UPDATED' && payload) {
              if (!this.state.products) this.state.products = [];
              const pIdx = this.state.products.findIndex(p => p.id === payload.id);
              if (pIdx !== -1) {
                this.state.products[pIdx] = { ...this.state.products[pIdx], ...payload };
                this.saveState(true);
              }
            } else if (type === 'PRODUCT_DELETED' && payload) {
              this.state.products = (this.state.products || []).filter(p => p.id !== payload.id);
              this.state.productBranchData = (this.state.productBranchData || []).filter(bd => bd.productId !== payload.id);
              this.saveState(true);
            }
          };
        } catch (bcErr) {
          console.warn('BroadcastChannel initialization notice:', bcErr);
        }
      }

      window.addEventListener('storage', (e) => {
        if (e.key === STORE_KEY) {
          this.state = this.loadState();
          this.notifyListeners();
        }
      });

      // Window focus: only light sync if at least 5 minutes have elapsed and tab is active
      window.addEventListener('focus', () => {
        if (typeof document !== 'undefined' && (document.visibilityState === 'hidden' || document.hidden)) return;
        if (Date.now() - this.lastFullSyncTimestamp > 300000) {
          this.quickSyncStockAndInvoices();
        }
      });

      // Periodic light stock/invoice sync every 5 minutes (300,000ms), paused when tab is hidden
      setInterval(() => {
        if (typeof document !== 'undefined' && (document.visibilityState === 'hidden' || document.hidden)) return;
        this.quickSyncStockAndInvoices();
      }, 300000);

      // Full database sync every 15 minutes (900,000ms), paused when tab is hidden
      setInterval(() => {
        if (typeof document !== 'undefined' && (document.visibilityState === 'hidden' || document.hidden)) return;
        this.syncWithBackend();
      }, 900000);
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

  public isCurrentUserAdmin(): boolean {
    if (typeof window === 'undefined') return true;
    try {
      const storedId = localStorage.getItem('mock_auth_id');
      if (!storedId) return true;
      const user = (this.state?.users || mockUsers).find(u => u && u.id === storedId);
      if (!user) return true;
      return user.role === 'admin' || !user.branchId || ['bola', 'mina', 'test'].includes((user.username || '').toLowerCase());
    } catch {
      return true;
    }
  }

  private getActiveBranchId(): string | undefined {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('last_active_branch') || undefined;
      } catch {}
    }
    return undefined;
  }

  public async quickSyncStockAndInvoices(targetBranchId?: string): Promise<void> {
    if (this.quickSyncPromise) return this.quickSyncPromise;

    const now = Date.now();
    if (now - this.lastQuickSyncTimestamp < 15000) {
      // Cooldown enforced (at least 15s between quick syncs)
      return;
    }
    this.lastQuickSyncTimestamp = now;

    this.quickSyncPromise = (async () => {
      try {
        const isAdmin = this.isCurrentUserAdmin();
        const branchToSync = targetBranchId || (isAdmin ? undefined : this.getActiveBranchId());
        const [branchDataList, invs] = await Promise.allSettled([
          api.getProductBranchDataList(branchToSync),
          api.getPaginatedInvoices({ page: 1, limit: 30, branchId: branchToSync }),
        ]);

        let stateChanged = false;

        // 1. Reconcile stock changes without wiping other branches
        if (branchDataList.status === 'fulfilled' && Array.isArray(branchDataList.value)) {
          const previousData = this.state.productBranchData || [];
          const changedItems: Array<{ productId: string; productName: string; newQuantity: number; isOutOfStock: boolean }> = [];

          branchDataList.value.forEach(newBd => {
            const oldBd = previousData.find(o => o && o.productId === newBd.productId && o.branchId === newBd.branchId);
            if (oldBd && Number(oldBd.quantity || 0) !== Number(newBd.quantity || 0)) {
              const prod = (this.state.products || []).find(p => p && p.id === newBd.productId);
              const nQty = Number(newBd.quantity || 0);
              changedItems.push({
                productId: newBd.productId,
                productName: prod?.nameAr || prod?.nameEn || 'منتج',
                newQuantity: nQty,
                isOutOfStock: nQty <= 0
              });
              stateChanged = true;
            }
          });

          const normalizedFresh = branchDataList.value.map(bd => ({
            ...bd,
            cost: Number(bd.cost || 0),
            price1: Number(bd.price1 || 0),
            price2: Number(bd.price2 || 0),
            price3: Number(bd.price3 || 0),
            price4: Number(bd.price4 || 0),
            minStock: Number(bd.minStock ?? 10),
            quantity: Number(bd.quantity || 0)
          }));

          const updatedBranchIds = new Set(normalizedFresh.map(d => d.branchId));
          const preservedOtherBranches = (this.state.productBranchData || []).filter(
            d => d && !updatedBranchIds.has(d.branchId)
          );
          this.state.productBranchData = [...preservedOtherBranches, ...normalizedFresh];
          stateChanged = true;

          if (changedItems.length > 0 && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('inventory:stock-updated', {
              detail: {
                branchId: branchDataList.value[0]?.branchId || 'b4',
                items: changedItems,
                timestamp: new Date().toISOString()
              }
            }));
          }
        }

        // 2. Reconcile recent invoices without full-table wipe
        if (invs.status === 'fulfilled' && invs.value) {
          const rawInvs: any[] = Array.isArray(invs.value) ? invs.value : (invs.value?.data || []);
          if (rawInvs.length > 0) {
            const existingMap = new Map((this.state.invoices || []).map(i => [i.id || i.invoiceNumber, i]));
            let invoicesChanged = false;
            rawInvs.forEach(freshInv => {
              if (freshInv && !this.tombstonedInvoiceIds.has(freshInv.id) && !this.tombstonedInvoiceIds.has(freshInv.invoiceNumber)) {
                const key = freshInv.id || freshInv.invoiceNumber;
                const old = existingMap.get(key);
                if (!old || old.paymentStatus !== freshInv.paymentStatus || old.paidAmount !== freshInv.paidAmount) {
                  existingMap.set(key, { ...(old || {}), ...freshInv });
                  invoicesChanged = true;
                }
              }
            });
            if (invoicesChanged) {
              this.state.invoices = Array.from(existingMap.values())
                .sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());
              stateChanged = true;
            }
          }
        }

        if (stateChanged) {
          this.saveState(true);
        }
      } catch {
        // quiet fail on quick sync
      } finally {
        this.quickSyncPromise = null;
      }
    })();

    return this.quickSyncPromise;
  }

  public async syncWithBackend(): Promise<void> {
    if (this.syncWithBackendPromise) return this.syncWithBackendPromise;

    const now = Date.now();
    if (now < this.nextAllowedSyncTime) {
      console.warn('Backend sync deferred due to exponential backoff');
      return;
    }

    this.syncWithBackendPromise = (async () => {
      try {
        // Lightweight sync version check: skip heavy downloads if backend data hasn't changed
        let serverVersion: string | null = null;
        if (this.state.products && this.state.products.length > 0) {
          try {
            const verRes = await api.getSyncVersion();
            serverVersion = (verRes as any)?.data?.version || (verRes as any)?.version || null;
            if (serverVersion && serverVersion === this.lastSyncedVersion) {
              // Version unchanged, skip downloading full tables
              this.consecutiveSyncFailures = 0;
              return;
            }
          } catch {
            // Version check fallback: proceed to sync
          }
        }

        const isAdmin = this.isCurrentUserAdmin();
        const branchToSync = isAdmin ? undefined : this.getActiveBranchId();
        const [
          fixedExp,
          invs,
          prodList,
          branchDataList,
          catList,
          physItems,
          branchList,
          customerList,
          userList,
          supplierList
        ] = await Promise.allSettled([
          api.getFixedExpenses(),
          api.getPaginatedInvoices({ page: 1, limit: 100, branchId: branchToSync }),
          api.getProducts(),
          api.getProductBranchDataList(branchToSync),
          api.getCategories(),
          api.getPhysicalItems(),
          api.getBranches(),
          api.getCustomers(),
          api.getUsers(),
          api.getSuppliers(),
        ]);

        if (fixedExp.status === 'fulfilled' && Array.isArray(fixedExp.value)) {
          this.state.fixedExpenses = fixedExp.value.map(e => ({
            ...e,
            amount: Number(e.amount) || 0,
          }));
        }

        if (invs.status === 'fulfilled' && invs.value) {
          const rawInvs: any[] = Array.isArray(invs.value) ? invs.value : (invs.value?.data || []);
          if (rawInvs.length > 0) {
            const invoiceMap = new Map((this.state.invoices || []).map(i => [i.id || i.invoiceNumber, i]));
            rawInvs.forEach(i => {
              if (i && !this.tombstonedInvoiceIds.has(i.id) && !this.tombstonedInvoiceIds.has(i.invoiceNumber)) {
                invoiceMap.set(i.id || i.invoiceNumber, i);
              }
            });
            this.state.invoices = Array.from(invoiceMap.values())
              .sort(
                (a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime()
              );
          }
        }

        if (branchList.status === 'fulfilled' && Array.isArray(branchList.value) && branchList.value.length > 0) {
          this.state.branches = branchList.value;
        }

        if (customerList.status === 'fulfilled' && Array.isArray(customerList.value)) {
          this.state.customers = customerList.value;
        }

        if (userList.status === 'fulfilled' && Array.isArray(userList.value) && userList.value.length > 0) {
          const backendUsers = userList.value;
          const currentUsers = this.state.users || mockUsers;
          this.state.users = backendUsers.map(bUser => {
            const existing = currentUsers.find(
              u => u && (u.id === bUser.id || (u.username || '').trim().toLowerCase() === (bUser.username || '').trim().toLowerCase())
            );
            const isSuper = ['bola', 'mina', 'test'].includes((bUser.username || '').trim().toLowerCase()) ||
                            (bUser.id && bUser.id.startsWith('admin_') && !bUser.branchId && !bUser.branch_id);
            const resolvedBranchId = isSuper ? undefined : (bUser.branch_id || bUser.branchId || existing?.branchId);
            return {
              ...bUser,
              role: isSuper ? ('admin' as const) : ('employee' as const),
              branchId: resolvedBranchId,
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
          const previousData = this.state.productBranchData || [];
          const changedItems: Array<{ productId: string; productName: string; newQuantity: number; isOutOfStock: boolean }> = [];

          branchDataList.value.forEach(newBd => {
            const oldBd = previousData.find(o => o && o.productId === newBd.productId && o.branchId === newBd.branchId);
            if (oldBd && Number(oldBd.quantity || 0) !== Number(newBd.quantity || 0)) {
              const prod = (this.state.products || []).find(p => p && p.id === newBd.productId);
              const nQty = Number(newBd.quantity || 0);
              changedItems.push({
                productId: newBd.productId,
                productName: prod?.nameAr || prod?.nameEn || 'منتج',
                newQuantity: nQty,
                isOutOfStock: nQty <= 0
              });
            }
          });

          const normalizedFresh = branchDataList.value.map(bd => ({
            ...bd,
            cost: Number(bd.cost || 0),
            price1: Number(bd.price1 || 0),
            price2: Number(bd.price2 || 0),
            price3: Number(bd.price3 || 0),
            price4: Number(bd.price4 || 0),
            minStock: Number(bd.minStock ?? 10),
            quantity: Number(bd.quantity || 0)
          }));

          const updatedBranchIds = new Set(normalizedFresh.map(d => d.branchId));
          const preservedOtherBranches = (this.state.productBranchData || []).filter(
            d => d && !updatedBranchIds.has(d.branchId)
          );
          this.state.productBranchData = [...preservedOtherBranches, ...normalizedFresh];

          if (changedItems.length > 0 && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('inventory:stock-updated', {
              detail: {
                branchId: branchDataList.value[0]?.branchId || 'b4',
                items: changedItems,
                timestamp: new Date().toISOString()
              }
            }));
          }
        }

        // Sync Physical Items
        if (physItems.status === 'fulfilled' && Array.isArray(physItems.value)) {
          this.state.physicalItems = physItems.value;
        }

        // Sync Suppliers
        if (supplierList.status === 'fulfilled' && Array.isArray(supplierList.value)) {
          this.state.suppliers = supplierList.value.map(s => ({
            ...s,
            totalAmount: Number(s.totalAmount || 0),
            paidAmount: Number(s.paidAmount || 0),
            remainingAmount: Number(s.remainingAmount || 0),
            paymentHistory: Array.isArray(s.paymentHistory) ? s.paymentHistory : [],
          }));
        }

        this.lastFullSyncTimestamp = Date.now();
        this.consecutiveSyncFailures = 0;
        this.nextAllowedSyncTime = 0;
        if (serverVersion) {
          this.lastSyncedVersion = serverVersion;
        } else {
          try {
            const verRes = await api.getSyncVersion();
            this.lastSyncedVersion = (verRes as any)?.data?.version || (verRes as any)?.version || null;
          } catch {}
        }
        this.saveState(true);
      } catch (e) {
        this.consecutiveSyncFailures++;
        const backoffDelay = Math.min(300000, 2000 * Math.pow(2, this.consecutiveSyncFailures));
        this.nextAllowedSyncTime = Date.now() + backoffDelay;
        console.warn(`Backend sync warning (consecutive failures: ${this.consecutiveSyncFailures}, backoff: ${backoffDelay}ms):`, e);
      } finally {
        this.syncWithBackendPromise = null;
      }
    })();

    return this.syncWithBackendPromise;
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
          invoices: (Array.isArray(parsed.invoices) ? parsed.invoices : []).map((inv: any) => {
            if (!inv) return inv;
            const t = Number(inv.total);
            const cleanTot = isNaN(t) ? 0 : Math.max(0, t);
            const p = Number(inv.paidAmount);
            const cleanPaid = isNaN(p) ? (inv.paymentStatus === 'paid' ? cleanTot : 0) : Math.max(0, p);
            const r = Number(inv.remainingAmount);
            const cleanRem = isNaN(r) ? Math.max(0, cleanTot - cleanPaid) : Math.max(0, r);

            let sp = inv.splitPayments;
            if (sp) {
              const sc = Number(sp.cash);
              const sv = Number(sp.vodafone_cash);
              const si = Number(sp.instapay);
              sp = {
                cash: isNaN(sc) ? 0 : Math.max(0, sc),
                vodafone_cash: isNaN(sv) ? 0 : Math.max(0, sv),
                instapay: isNaN(si) ? 0 : Math.max(0, si),
              };
            }
            return {
              ...inv,
              total: cleanTot,
              subtotal: isNaN(Number(inv.subtotal)) ? cleanTot : Number(inv.subtotal),
              paidAmount: cleanPaid,
              remainingAmount: cleanRem,
              splitPayments: sp,
            };
          }),
          fixedExpenses: Array.isArray(parsed.fixedExpenses)
            ? parsed.fixedExpenses.map((e: any) => ({ ...e, amount: Number(e.amount) || 0 }))
            : [],
          compositions: Array.isArray(parsed.compositions) ? parsed.compositions : [],
          suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : [],
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
              role: 'admin',
              password: defaultUser.password || state.users[idx].password,
              phone: state.users[idx].phone || defaultUser.phone,
            };
          }
        }

        // Auto-heal any branch employee who was accidentally marked as admin
        state.users = state.users.map(u => {
          if (!u) return u;
          const isSuper = ['bola', 'mina', 'test'].includes((u.username || '').trim().toLowerCase()) ||
                          (u.id && u.id.startsWith('admin_') && !u.branchId);
          if (!isSuper && (u.branchId || u.id.startsWith('u_'))) {
            return { ...u, role: 'employee' as const };
          }
          return u;
        });

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
      suppliers: [],
    };
  }

  public saveState(notify = true) {
    localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
    if (notify) {
      this.notifyListeners();
    }
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
    const isSuper = (user.role === 'admin' && !user.branchId) ||
                    ['bola', 'mina', 'test'].includes(user.username.trim().toLowerCase());
    const sanitizedUser: User = {
      ...user,
      role: isSuper ? ('admin' as const) : ('employee' as const),
      branchId: isSuper ? undefined : user.branchId,
    };
    this.state.users.push(sanitizedUser);
    this.saveState();
    try {
      await api.createUser(sanitizedUser);
    } catch (err) {
      console.warn('DB sync warning (createUser):', err);
    }
  }
  public async updateUser(id: string, updates: Partial<User>) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u?.id === id);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...updates };
      this.saveState(true);
      try {
        await api.updateUser(id, updates);
      } catch (err) {
        console.warn('DB sync warning (updateUser):', err);
      }
    }
  }
  public async deleteUser(id: string) {
    this.state.users = (this.state.users || []).filter(u => u?.id !== id);
    this.saveState(true);
    try {
      await api.deleteUser(id);
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
    this.saveState(true);
    try {
      await api.createBranch(branch);
    } catch (err) {
      console.warn('DB sync warning (createBranch):', err);
    }
  }
  public async updateBranch(id: string, updates: Partial<Branch>) {
    const branches = this.getBranches();
    const idx = branches.findIndex(b => b?.id === id);
    if (idx !== -1) {
      branches[idx] = { ...branches[idx], ...updates };
      this.saveState(true);
      try {
        await api.updateBranch(id, updates);
      } catch (err) {
        console.warn('DB sync warning (updateBranch):', err);
      }
    }
  }
  public async deleteBranch(id: string) {
    this.state.branches = (this.state.branches || []).filter(b => b?.id !== id);
    this.saveState(true);
    try {
      await api.deleteBranch(id);
    } catch (err) {
      console.warn('DB sync warning (deleteBranch):', err);
    }
  }

  // --- Categories ---
  public getCategories() { return this.state?.categories || []; }
  public async addCategory(cat: Category) {
    if (!this.state.categories) this.state.categories = [];
    this.state.categories.push(cat);
    this.saveState(true);
    try {
      await api.createCategory(cat);
    } catch (err) {
      console.warn('DB sync warning (createCategory):', err);
    }
  }
  public async updateCategory(id: string, nameAr: string) {
    const cat = (this.state.categories || []).find(c => c?.id === id);
    if (cat) {
      cat.nameAr = nameAr;
      cat.nameEn = nameAr;
      this.saveState(true);
      try {
        await api.updateCategory(id, nameAr);
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
    this.saveState(true);
    try {
      await api.deleteCategory(id);
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

    // STRICT BRANCH ISOLATION: Products belong strictly to the branch they are created in!
    // Never auto-populate other branches with 0 stock.
    const normalizedBranchData: ProductBranchData[] = (branchDataList || []).map(bd => ({
      ...bd,
      cost: Number(bd.cost || 0),
      price1: Number(bd.price1 || 0),
      price1Label: bd.price1Label || 'سعر 1',
      price2: Number(bd.price2 || 0),
      price2Label: bd.price2Label || 'سعر 2',
      price3: Number(bd.price3 || 0),
      price3Label: bd.price3Label || 'سعر 3',
      price4: Number(bd.price4 || 0),
      price4Label: bd.price4Label || 'سعر 4',
      minStock: Number(bd.minStock ?? 10),
      quantity: Number(bd.quantity || 0),
    }));

    this.state.products.push(product);
    this.state.productBranchData.push(...normalizedBranchData);
    this.saveState(true);

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'PRODUCT_CREATED',
          payload: { product, branchData: normalizedBranchData }
        });
      } catch {}
    }

    try {
      await api.createProduct(product, normalizedBranchData);
    } catch (err) {
      console.warn('DB sync warning (createProduct):', err);
    }
  }

  public addProductFromSocket(product: any, branchData?: any[]) {
    if (!product || !product.id) return;
    if (!this.state.products) this.state.products = [];
    if (!this.state.products.some(p => p.id === product.id)) {
      this.state.products.unshift(product);
      if (Array.isArray(branchData)) {
        this.state.productBranchData = [...(this.state.productBranchData || []), ...branchData];
      }
      this.saveState(true);
    }
  }

  public async updateProduct(id: string, updates: Partial<Product>) {
    const prods = this.getProducts();
    const idx = prods.findIndex(p => p?.id === id);
    if (idx !== -1) {
      prods[idx] = { ...prods[idx], ...updates };
      this.saveState(true);

      if (this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({
            type: 'PRODUCT_UPDATED',
            payload: prods[idx]
          });
        } catch {}
      }

      try {
        await api.updateProduct(id, updates);
      } catch (err) {
        console.warn('DB sync warning (updateProduct):', err);
      }
    }
  }

  public updateProductFromSocket(product: any) {
    if (!product || !product.id) return;
    if (!this.state.products) this.state.products = [];
    const idx = this.state.products.findIndex(p => p.id === product.id);
    if (idx !== -1) {
      this.state.products[idx] = { ...this.state.products[idx], ...product };
      this.saveState(true);
    }
  }

  public getProductBranchData(productId: string, branchId: string) {
    return (this.state?.productBranchData || []).find(d => d?.productId === productId && d?.branchId === branchId);
  }

  public getProductBranchDataByBranch(branchId: string): ProductBranchData[] {
    return (this.state?.productBranchData || []).filter(d => d && d.branchId === branchId);
  }

  public getAllProductBranchData(): ProductBranchData[] {
    return this.state?.productBranchData || [];
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
    this.saveState(true);
    try {
      await api.updateBranchData(updatedData);
    } catch (err) {
      console.warn('DB sync warning (updateProductBranchData):', err);
    }
  }

  public applyRealtimeStockUpdate(branchId: string, items: Array<{ productId: string; newQuantity: number }>, broadcast = true) {
    if (!this.state.productBranchData) this.state.productBranchData = [];
    let hasChanges = false;
    for (const item of items) {
      const idx = this.state.productBranchData.findIndex(
        bd => bd && bd.productId === item.productId && (bd.branchId === branchId || !branchId)
      );
      if (idx !== -1) {
        if (Number(this.state.productBranchData[idx].quantity) !== Number(item.newQuantity)) {
          this.state.productBranchData[idx] = {
            ...this.state.productBranchData[idx],
            quantity: Number(item.newQuantity),
          };
          hasChanges = true;
        }
      }
    }
    if (hasChanges) {
      this.saveState(true);
      if (broadcast && this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({
            type: 'STOCK_UPDATED',
            payload: { branchId, items }
          });
        } catch {}
      }
    }
  }

  public async deleteProduct(id: string) {
    this.state.products = (this.state.products || []).filter(p => p?.id !== id);
    this.state.productBranchData = (this.state.productBranchData || []).filter(d => d?.productId !== id);
    this.state.physicalItems = (this.state.physicalItems || []).filter(i => i?.productId !== id);
    this.saveState(true);

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'PRODUCT_DELETED',
          payload: { id }
        });
      } catch {}
    }

    try {
      await api.deleteProduct(id);
    } catch (err) {
      console.warn('DB sync warning (deleteProduct):', err);
    }
  }

  public deleteProductFromSocket(id: string) {
    if (!id) return;
    this.state.products = (this.state.products || []).filter(p => p.id !== id);
    this.state.productBranchData = (this.state.productBranchData || []).filter(bd => bd.productId !== id);
    this.saveState(true);
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
    // 1. Send to server/DB first!
    const created = await api.createInvoice(invoice);

    const invoiceToStore = created && created.id ? created : invoice;

    // 2. Only commit to local state after backend confirmation
    if (!this.state.invoices) this.state.invoices = [];
    this.state.invoices = this.state.invoices.filter(
      i => i.id !== invoiceToStore.id && i.invoiceNumber !== invoiceToStore.invoiceNumber
    );
    this.state.invoices.unshift(invoiceToStore);

    // 3. Immediately apply the stock numbers returned by the DB transaction
    if (created && Array.isArray(created.updatedStock) && created.updatedStock.length > 0) {
      this.applyRealtimeStockUpdate(invoice.branchId, created.updatedStock, true);
    }

    this.saveState(false);

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'INVOICE_CREATED',
          payload: invoiceToStore
        });
      } catch {}
    }

    this.notifyListeners();
    return invoiceToStore;
  }

  public addInvoiceFromSocket(invoice: any) {
    if (!invoice || !invoice.id) return;
    if (this.tombstonedInvoiceIds.has(invoice.id) || this.tombstonedInvoiceIds.has(invoice.invoiceNumber)) return;
    if (!this.state.invoices) this.state.invoices = [];
    if (!this.state.invoices.some(i => i.id === invoice.id || i.invoiceNumber === invoice.invoiceNumber)) {
      this.state.invoices.unshift(invoice);
      this.saveState(false);
      this.notifyListeners();
    }
  }

  public updateInvoiceFromSocket(invoice: any) {
    if (!invoice || !invoice.id) return;
    if (this.tombstonedInvoiceIds.has(invoice.id) || this.tombstonedInvoiceIds.has(invoice.invoiceNumber)) return;
    if (!this.state.invoices) this.state.invoices = [];
    const idx = this.state.invoices.findIndex(i => i.id === invoice.id || i.invoiceNumber === invoice.invoiceNumber);
    if (idx !== -1) {
      this.state.invoices[idx] = { ...this.state.invoices[idx], ...invoice };
      this.saveState(false);
      this.notifyListeners();
    }
  }

  public async updateInvoice(updatedInvoice: Invoice, returnedStock?: Array<{ productId: string; quantity: number }>) {
    if (!this.state.invoices) this.state.invoices = [];
    const targetId = updatedInvoice.id || updatedInvoice.invoiceNumber;
    const idx = this.state.invoices.findIndex(i => i.id === updatedInvoice.id || i.invoiceNumber === updatedInvoice.invoiceNumber);
    if (idx !== -1) {
      this.state.invoices[idx] = { ...this.state.invoices[idx], ...updatedInvoice };
    } else {
      this.state.invoices.unshift(updatedInvoice);
    }

    // Immediately restore stock locally for returned items
    if (returnedStock && returnedStock.length > 0) {
      for (const ret of returnedStock) {
        const bd = (this.state.productBranchData || []).find(
          b => b.productId === ret.productId && b.branchId === updatedInvoice.branchId
        );
        if (bd) {
          bd.quantity = Math.max(0, (bd.quantity || 0) + Number(ret.quantity));
        } else {
          // Check if this was a composition product
          const comp = (this.state.compositions || []).find(
            c => ((ret as any).productName && (c.name === (ret as any).productName || c.name.includes((ret as any).productName))) || c.id === ret.productId
          );
          if (comp && Array.isArray(comp.internalComponents)) {
            comp.internalComponents.forEach(ic => {
              const rawBd = (this.state.productBranchData || []).find(
                b => b.productId === ic.productId && b.branchId === updatedInvoice.branchId
              );
              if (rawBd) {
                rawBd.quantity = Math.max(0, (rawBd.quantity || 0) + (Number(ic.quantity || 1) * Number(ret.quantity)));
              }
            });
          }
        }
      }
    }

    this.saveState(true);

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'INVOICE_UPDATED',
          payload: updatedInvoice
        });
      } catch {}
    }

    const serverRes = await api.updateInvoice(targetId, updatedInvoice);
    const formatted = serverRes?.formattedInvoice || (serverRes?.id ? serverRes : updatedInvoice);
    const stockItems = serverRes?.updatedStockItems || serverRes?.updatedStock || [];

    if (Array.isArray(stockItems) && stockItems.length > 0) {
      this.applyRealtimeStockUpdate(updatedInvoice.branchId, stockItems, true);
    }
    if (formatted && (formatted.id || formatted.invoiceNumber)) {
      const finalIdx = this.state.invoices.findIndex(i => i.id === formatted.id || i.invoiceNumber === formatted.invoiceNumber);
      if (finalIdx !== -1) {
        this.state.invoices[finalIdx] = { ...this.state.invoices[finalIdx], ...formatted };
      }
    }

    this.saveState(true);
    return formatted;
  }

  public deleteInvoicesFromSocket(ids: string[]) {
    if (!ids || ids.length === 0) return;
    const delSet = new Set(ids);
    ids.forEach(id => this.tombstonedInvoiceIds.add(id));
    this.state.invoices = (this.state.invoices || []).filter(i => !delSet.has(i.id) && !delSet.has(i.invoiceNumber));
    this.saveState(false);
    this.notifyListeners();
  }
  public toggleFavoriteInvoice(id: string) {
    const inv = (this.state.invoices || []).find(i => i?.id === id);
    if (inv) {
      inv.isFavorite = !inv.isFavorite;
      this.saveState();
    }
  }

  public async payInvoice(id: string, amount: number) {
    if (amount <= 0) return;
    try {
      const res = await api.payInvoice(id, amount);
      const inv = (this.state.invoices || []).find(i => i?.id === id);
      if (inv) {
        const currentRemaining = inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.total - (inv.paidAmount || 0));
        const payAmt = Math.min(amount, currentRemaining);
        inv.paidAmount = (inv.paidAmount || 0) + payAmt;
        inv.remainingAmount = Math.max(0, currentRemaining - payAmt);
        inv.paymentStatus = inv.remainingAmount <= 0 ? 'paid' : 'partial';
        this.saveState();
      }
      return res;
    } catch (err) {
      console.warn('DB sync warning (payInvoice):', err);
      throw err;
    } finally {
      api.invalidateInvoiceCache(id);
      await this.quickSyncStockAndInvoices();
      this.notifyListeners();
    }
  }

  public async payCustomerDebt(customerPhoneOrId: string, amount: number, branchId?: string) {
    if (amount <= 0) return;
    const term = customerPhoneOrId.trim();
    try {
      const res = await api.payCustomerDebt(term, amount, branchId);
      return res;
    } catch (err) {
      console.warn('DB sync warning (payCustomerDebt):', err);
      throw err;
    } finally {
      api.invalidateInvoiceCache();
      await this.quickSyncStockAndInvoices();
      this.notifyListeners();
    }
  }

  public async deleteInvoicesByIds(ids: string[], fallbackInvoices?: Invoice[]) {
    if (!ids || ids.length === 0) return;
    const inputSet = new Set(ids);
    // Find all matching invoices to capture both their id and invoiceNumber
    const matched = (this.state.invoices || []).filter(i => inputSet.has(i?.id) || inputSet.has(i?.invoiceNumber));
    if (fallbackInvoices && fallbackInvoices.length > 0) {
      fallbackInvoices.forEach(fi => {
        if (!matched.some(m => m.id === fi.id || m.invoiceNumber === fi.invoiceNumber)) {
          matched.push(fi);
        }
      });
    }
    const fullSet = new Set([
      ...ids,
      ...matched.map(m => m.id),
      ...matched.map(m => m.invoiceNumber),
    ].filter(Boolean));

    // Tombstone all IDs so background sync will NEVER re-add them
    fullSet.forEach(id => this.tombstonedInvoiceIds.add(id));

    // Restore stock locally for each item in the deleted invoices
    matched.forEach(inv => {
      const bId = inv.branchId;
      (inv.items || []).forEach(item => {
        const q = Number(item.quantity || 1);
        const bd = (this.state.productBranchData || []).find(
          b => b.productId === item.productId && b.branchId === bId
        );
        if (bd) {
          bd.quantity = Math.max(0, (bd.quantity || 0) + q);
        } else {
          // Check if this was a composition product
          const itemName = item.productName || '';
          const cleanName = itemName.replace(/\s*\(تركيبة خاصة\)\s*/g, '').trim();
          const comp = (this.state.compositions || []).find(
            c => c.id === item.productId ||
                 c.createdProductId === item.productId ||
                 (itemName && c.name === itemName) ||
                 (cleanName && (c.name === cleanName || c.name.includes(cleanName) || cleanName.includes(c.name)))
          );
          if (comp && Array.isArray(comp.internalComponents)) {
            comp.internalComponents.forEach(ic => {
              const rawBd = (this.state.productBranchData || []).find(
                b => b.productId === ic.productId && b.branchId === bId
              );
              if (rawBd) {
                rawBd.quantity = Math.max(0, (rawBd.quantity || 0) + (Number(ic.quantity || 1) * q));
              }
            });
          }
        }
      });
    });

    // Instant local removal with ZERO LAG
    this.state.invoices = (this.state.invoices || []).filter(i => !fullSet.has(i?.id) && !fullSet.has(i?.invoiceNumber));
    this.saveState(true);
    this.notifyListeners();

    // Broadcast instant deletion across tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'INVOICES_DELETED',
          payload: { ids: Array.from(fullSet) }
        });
      } catch {}
    }

    // Call API in background without blocking UI or doing heavy sync
    try {
      await api.deleteInvoicesByIds(Array.from(fullSet));
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
    const normalizedExpense: FixedExpense = {
      ...expense,
      amount: Number(expense.amount) || 0,
    };
    this.state.fixedExpenses = this.state.fixedExpenses.filter(e => e.id !== expense.id);
    this.state.fixedExpenses.unshift(normalizedExpense);
    this.saveState(true);

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'EXPENSE_CREATED',
          payload: normalizedExpense,
        });
      } catch {}
    }

    try {
      await api.createFixedExpense(expense);
    } catch (err) {
      console.warn('DB sync warning (createFixedExpense):', err);
    }
  }

  public async removeFixedExpense(id: string) {
    if (!this.state.fixedExpenses) return;
    this.state.fixedExpenses = this.state.fixedExpenses.filter(e => e?.id !== id);
    this.saveState(true);

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'EXPENSE_DELETED',
          payload: { id },
        });
      } catch {}
    }

    try {
      await api.deleteFixedExpense(id);
    } catch (err) {
      console.warn('DB sync warning (deleteFixedExpense):', err);
    }
  }

  public addExpenseFromSocket(expense: any) {
    if (!expense || !expense.id) return;
    if (!this.state.fixedExpenses) this.state.fixedExpenses = [];
    if (!this.state.fixedExpenses.some(e => e.id === expense.id)) {
      this.state.fixedExpenses.unshift({
        ...expense,
        amount: Number(expense.amount) || 0,
      });
      this.saveState(true);
    }
  }

  public removeExpenseFromSocket(id: string) {
    if (!id || !this.state.fixedExpenses) return;
    this.state.fixedExpenses = this.state.fixedExpenses.filter(e => e.id !== id);
    this.saveState(true);
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
    } catch (err) {
      console.warn('DB sync warning (deleteComposition):', err);
    }
  }

  // --- Suppliers & Purchases ---
  public getSupplierPurchases(): SupplierPurchase[] {
    if (!this.state.suppliers) this.state.suppliers = [];
    return [...this.state.suppliers].sort((a, b) => {
      const dateA = new Date(a.purchaseDate || a.createdAt || 0).getTime();
      const dateB = new Date(b.purchaseDate || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }

  public getSupplierPurchaseById(id: string): SupplierPurchase | undefined {
    if (!this.state.suppliers) this.state.suppliers = [];
    return this.state.suppliers.find(s => s.id === id);
  }

  public async addSupplierPurchase(purchase: SupplierPurchase) {
    if (!this.state.suppliers) this.state.suppliers = [];
    this.state.suppliers.unshift(purchase);
    this.saveState();
    try {
      await api.saveSupplierPurchase(purchase);
    } catch (err) {
      console.warn('DB sync warning (addSupplierPurchase):', err);
    }
  }

  public async updateSupplierPurchase(id: string, updates: Partial<SupplierPurchase>) {
    if (!this.state.suppliers) this.state.suppliers = [];
    const idx = this.state.suppliers.findIndex(s => s.id === id);
    if (idx !== -1) {
      this.state.suppliers[idx] = {
        ...this.state.suppliers[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.saveState();
      try {
        await api.updateSupplierPurchase(id, updates);
      } catch (err) {
        console.warn('DB sync warning (updateSupplierPurchase):', err);
      }
    }
  }

  public async deleteSupplierPurchase(id: string) {
    if (!this.state.suppliers) return;
    this.state.suppliers = this.state.suppliers.filter(s => s.id !== id);
    this.saveState();
    try {
      await api.deleteSupplierPurchase(id);
    } catch (err) {
      console.warn('DB sync warning (deleteSupplierPurchase):', err);
    }
  }

  public async recordSupplierPayment(id: string, amount: number, notes?: string) {
    if (!this.state.suppliers || amount <= 0) return;
    const idx = this.state.suppliers.findIndex(s => s.id === id);
    if (idx === -1) return;

    const current = this.state.suppliers[idx];
    const newPaidAmount = Number((current.paidAmount + amount).toFixed(2));
    const newRemainingAmount = Math.max(0, Number((current.totalAmount - newPaidAmount).toFixed(2)));
    
    let newStatus: 'paid' | 'partial' | 'unpaid' = 'unpaid';
    if (newRemainingAmount <= 0) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partial';
    }

    const newPaymentRecord: SupplierPaymentRecord = {
      id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      amount,
      date: new Date().toISOString(),
      notes,
    };

    const updatedHistory = [...(current.paymentHistory || []), newPaymentRecord];

    const updates = {
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount,
      paymentStatus: newStatus,
      paymentHistory: updatedHistory,
      updatedAt: new Date().toISOString(),
    };

    this.state.suppliers[idx] = {
      ...current,
      ...updates,
    };

    this.saveState();

    try {
      await api.updateSupplierPurchase(id, updates);
    } catch (err) {
      console.warn('DB sync warning (recordSupplierPayment):', err);
    }
  }
}

export const store = new StoreService();
