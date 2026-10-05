const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('access_token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const resData = await response.json();
  if (!response.ok || !resData.success) {
    throw new Error(resData.message || 'API request failed');
  }

  return resData.data as T;
}

export const api = {
  // Auth
  login: (username: string, password?: string) =>
    request<{ user: any; accessToken: string; refreshToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
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
  getProductBranchDataList: () => request<any[]>('/products/branch-data/all'),
  createProduct: (product: any, branchDataList: any[]) =>
    request<any>('/products', { method: 'POST', body: JSON.stringify({ ...product, branchDataList }) }),
  updateProduct: (id: string, updates: any) => request<any>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  updateBranchData: (data: any) => request<any>('/products/branch-data', { method: 'POST', body: JSON.stringify(data) }),
  deleteProduct: (id: string) => request<any>(`/products/${id}`, { method: 'DELETE' }),
  adjustStock: (productId: string, branchId: string, targetQuantity: number, prefix: string) =>
    request<any>('/products/adjust-stock', { method: 'POST', body: JSON.stringify({ productId, branchId, targetQuantity, prefix }) }),

  // Physical Items
  getPhysicalItems: () => request<any[]>('/physical-items'),
  generatePhysicalItems: (productId: string, branchId: string, quantity: number, prefix: string) =>
    request<any[]>('/physical-items/generate', { method: 'POST', body: JSON.stringify({ productId, branchId, quantity, prefix }) }),
  updatePhysicalItemStatus: (id: string, status: string) =>
    request<any>(`/physical-items/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Invoices
  getInvoices: () => request<any[]>('/invoices'),
  createInvoice: (invoice: any) => request<any>('/invoices', { method: 'POST', body: JSON.stringify(invoice) }),
  deleteInvoicesByIds: (ids: string[]) => request<any>('/invoices/delete-many', { method: 'POST', body: JSON.stringify({ ids }) }),

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
};
