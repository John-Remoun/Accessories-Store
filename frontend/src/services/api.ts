const rawBaseUrl = import.meta.env.VITE_API_URL || '/api/v1';
const API_BASE_URL = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('access_token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    const err: any = new Error('Backend API unavailable. Please check server connectivity.');
    err.isNetworkError = true;
    throw err;
  }

  let resData: any = null;
  try {
    resData = await response.json();
  } catch {
    // Non-JSON response
  }

  if (response.ok && resData) {
    if (resData.success !== undefined) {
      if (resData.success) {
        return resData.data as T;
      }
      throw new Error(resData.message || 'Operation failed');
    }
    return resData as T;
  }

  const errMsg = resData?.message || `HTTP ${response.status}: Failed to execute request`;
  const error: any = new Error(errMsg);
  error.status = response.status;
  throw error;
}

// Cache and in-flight deduplication map for invoice details
const invoiceDetailCache = new Map<string, { data: any; timestamp: number }>();
const invoiceDetailInFlight = new Map<string, Promise<any>>();

export const invalidateInvoiceCache = (id?: string) => {
  if (id) {
    invoiceDetailCache.delete(id.trim());
  } else {
    invoiceDetailCache.clear();
  }
};

export const api = {
  invalidateInvoiceCache,
  getSyncVersion: () => request<{ version: string; timestamp: string }>('/sync/version'),
  // Auth
  login: async (username: string, password?: string) => {
    const cleanUsername = username.trim();
    const cleanPassword = password?.trim() || '';

    if (!cleanUsername || !cleanPassword) {
      const err: any = new Error('اسم المستخدم وكلمة السر إجبارية');
      err.status = 400;
      throw err;
    }

    return request<{ user: any; accessToken: string; refreshToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
    });
  },
  getMe: () => request<any>('/auth/me'),

  // Users
  getUsers: () => request<any[]>('/users'),
  createUser: (user: any) => request<any>('/users', { method: 'POST', body: JSON.stringify(user) }),
  updateUser: (id: string, updates: any) => request<any>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteUser: (id: string) => request<any>(`/users/${id}`, { method: 'DELETE' }),

  // Branches
  getBranches: () => request<any[]>('/branches'),
  createBranch: (branch: any) => request<any>('/branches', { method: 'POST', body: JSON.stringify(branch) }),
  updateBranch: (id: string, updates: any) => request<any>(`/branches/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteBranch: (id: string) => request<any>(`/branches/${id}`, { method: 'DELETE' }),

  // Categories
  getCategories: () => request<any[]>('/categories'),
  createCategory: (cat: any) => request<any>('/categories', { method: 'POST', body: JSON.stringify(cat) }),
  updateCategory: (id: string, nameAr: string) => request<any>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ nameAr }) }),
  deleteCategory: (id: string) => request<any>(`/categories/${id}`, { method: 'DELETE' }),

  // Products
  getProducts: () => request<any[]>('/products'),
  getProductBranchDataList: (branchId?: string) =>
    request<any[]>(branchId ? `/products/branch-data/all?branchId=${encodeURIComponent(branchId)}` : '/products/branch-data/all'),
  createProduct: (product: any, branchDataList: any[]) =>
    request<any>('/products', { method: 'POST', body: JSON.stringify({ ...product, branchDataList }) }),
  updateProduct: (id: string, updates: any) => request<any>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  updateBranchData: (data: any) => request<any>('/products/branch-data', { method: 'POST', body: JSON.stringify(data) }),
  deleteProduct: (id: string) => request<any>(`/products/${id}`, { method: 'DELETE' }),
  adjustStock: (productId: string, branchId: string, targetQuantity: number, prefix: string) =>
    request<any>('/products/adjust-stock', { method: 'POST', body: JSON.stringify({ productId, branchId, targetQuantity: Number(targetQuantity), prefix }) }),

  // Physical Items
  getPhysicalItems: () => request<any[]>('/physical-items'),
  generatePhysicalItems: (productId: string, branchId: string, quantity: number, prefix: string) =>
    request<any[]>('/physical-items/generate', { method: 'POST', body: JSON.stringify({ productId, branchId, quantity: Number(quantity), prefix }) }),
  updatePhysicalItemStatus: (id: string, status: string) =>
    request<any>(`/physical-items/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Invoices
  getInvoices: () => request<any[]>('/invoices'),
  getInvoiceById: (id: string): Promise<any> => {
    const cleanId = id.trim();
    // Return cached invoice if fresh (under 30s)
    const cached = invoiceDetailCache.get(cleanId);
    if (cached && Date.now() - cached.timestamp < 30000) {
      return Promise.resolve(cached.data);
    }
    // Deduplicate concurrent in-flight requests for the same invoice ID
    const inFlight = invoiceDetailInFlight.get(cleanId);
    if (inFlight) {
      return inFlight;
    }
    const p = request<any>(`/invoices/${cleanId}`)
      .then((data) => {
        invoiceDetailCache.set(cleanId, { data, timestamp: Date.now() });
        invoiceDetailInFlight.delete(cleanId);
        return data;
      })
      .catch((err) => {
        invoiceDetailInFlight.delete(cleanId);
        throw err;
      });
    invoiceDetailInFlight.set(cleanId, p);
    return p;
  },
  getPaginatedInvoices: (params: {
    page?: number;
    limit?: number;
    branchId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    paymentStatus?: string;
    isFavorite?: boolean;
    customerPhone?: string;
  }) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.branchId) q.set('branchId', params.branchId);
    if (params.search) q.set('search', params.search);
    if (params.startDate) q.set('startDate', params.startDate);
    if (params.endDate) q.set('endDate', params.endDate);
    if (params.paymentStatus) q.set('paymentStatus', params.paymentStatus);
    if (params.isFavorite !== undefined) q.set('isFavorite', String(params.isFavorite));
    if (params.customerPhone) q.set('customerPhone', params.customerPhone);
    return request<{ data: any[]; total: number; page: number; limit: number; totalPages: number }>(`/invoices?${q.toString()}`);
  },
  getReportsSummary: (params?: { branchId?: string; startDate?: string; endDate?: string; year?: number; month?: number }) => {
    const q = new URLSearchParams();
    if (params?.branchId) q.set('branchId', params.branchId);
    if (params?.startDate) q.set('startDate', params.startDate);
    if (params?.endDate) q.set('endDate', params.endDate);
    if (params?.year !== undefined) q.set('year', String(params.year));
    if (params?.month !== undefined) q.set('month', String(params.month));
    return request<{
      branchSummaries: Array<{
        branchId: string;
        revenue: number;
        cost: number;
        netProfit: number;
        remainingDebt: number;
        invoicesCount: number;
      }>;
      overall: {
        revenue: number;
        cost: number;
        netProfit: number;
        remainingDebt: number;
        invoicesCount: number;
      };
      employeeRankings: Array<{
        employeeId: string;
        totalSalesAmount: number;
        totalInvoicesCount: number;
      }>;
      dailyMetrics: Array<{
        dayNum: number;
        revenue: number;
        cost: number;
        netProfit: number;
        remainingDebt: number;
        invoicesCount: number;
        cash: number;
        vodafone: number;
        instapay: number;
      }>;
    }>(`/invoices/reports-summary?${q.toString()}`);
  },
  getCustomerStatement: (params: { phone?: string; name?: string; branchId?: string }) => {
    const q = new URLSearchParams();
    if (params.phone) q.set('phone', params.phone);
    if (params.name) q.set('name', params.name);
    if (params.branchId) q.set('branchId', params.branchId);
    return request<{
      customerPhone: string;
      customerName: string;
      totalPurchases: number;
      totalPaid: number;
      totalDebt: number;
      invoices: any[];
      unpaidInvoices: any[];
      paidInvoices: any[];
    }>(`/invoices/customer-statement?${q.toString()}`);
  },
  getCustomerSummaries: (params?: { branchId?: string } | string) => {
    const q = new URLSearchParams();
    const branchId = typeof params === 'string' ? params : params?.branchId;
    if (branchId) q.set('branchId', branchId);
    return request<Array<{
      phone: string;
      name: string;
      invoiceCount: number;
      totalSpent: number;
      totalDebt: number;
      lastVisit: string;
    }>>(`/invoices/customers-summary?${q.toString()}`);
  },
  createInvoice: (invoice: any) => {
    invalidateInvoiceCache();
    return request<any>('/invoices', { method: 'POST', body: JSON.stringify(invoice) });
  },
  updateInvoice: (id: string, data: any) => {
    invalidateInvoiceCache(id);
    return request<any>(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteInvoicesByIds: (ids: string[]) => {
    if (Array.isArray(ids)) ids.forEach(id => invalidateInvoiceCache(id));
    return request<any>('/invoices/delete-many', { method: 'POST', body: JSON.stringify({ ids }) });
  },
  payInvoice: (id: string, amount: number) => {
    invalidateInvoiceCache(id);
    return request<any>(`/invoices/${id}/pay`, { method: 'PATCH', body: JSON.stringify({ amount }) });
  },
  payCustomerDebt: (customerPhone: string, amount: number, branchId?: string) => {
    invalidateInvoiceCache();
    return request<any>('/invoices/pay-customer-debt', { method: 'POST', body: JSON.stringify({ customerPhone, amount, branchId }) });
  },

  // Customers
  getCustomers: () => request<any[]>('/customers'),
  saveCustomer: (customer: any) => request<any>('/customers', { method: 'POST', body: JSON.stringify(customer) }),
  deleteCustomer: (idOrPhone: string) => request<any>(`/customers/${idOrPhone}`, { method: 'DELETE' }),

  // Expenses
  getFixedExpenses: (branchId?: string) => request<any[]>(branchId ? `/fixed-expenses/branch/${branchId}` : '/fixed-expenses'),
  createFixedExpense: (expense: any) => request<any>('/fixed-expenses', { method: 'POST', body: JSON.stringify(expense) }),
  deleteFixedExpense: (id: string) => request<any>(`/fixed-expenses/${id}`, { method: 'DELETE' }),

  // Compositions
  getCompositions: (branchId: string) => request<any[]>(`/compositions/branch/${branchId}`),
  createComposition: (comp: any) => request<any>('/compositions', { method: 'POST', body: JSON.stringify(comp) }),
  deleteComposition: (id: string) => request<any>(`/compositions/${id}`, { method: 'DELETE' }),

  // Suppliers & Purchases
  getSuppliers: () => request<any[]>('/suppliers'),
  createSupplier: (purchase: any) => request<any>('/suppliers', { method: 'POST', body: JSON.stringify(purchase) }),
  saveSupplierPurchase: (purchase: any) => request<any>('/suppliers', { method: 'POST', body: JSON.stringify(purchase) }),
  updateSupplier: (id: string, updates: any) => request<any>(`/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  updateSupplierPurchase: (id: string, updates: any) => request<any>(`/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteSupplier: (id: string) => request<any>(`/suppliers/${id}`, { method: 'DELETE' }),
  deleteSupplierPurchase: (id: string) => request<any>(`/suppliers/${id}`, { method: 'DELETE' }),
};
