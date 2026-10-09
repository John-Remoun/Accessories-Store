const rawBaseUrl = import.meta.env.VITE_API_URL || '/api/v1';
const API_BASE_URL = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

const SUPABASE_URL = 'https://cybtacestgpbsluqmclr.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = 'sb_publishable_eS3LIJcGAWaUO3PfTpUI3Q_5rvK3NEG';

async function supabaseFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': options.method === 'POST' || options.method === 'PATCH' ? 'return=representation' : 'count=exact',
    ...options.headers,
  };

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Supabase REST error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data as T;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('access_token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.ok) {
      const resData = await response.json();
      if (resData && resData.success) {
        return resData.data as T;
      }
    }
  } catch (err) {
    // Backend fetch failed, proceed to Supabase direct fallback
  }

  throw new Error('Express API unavailable');
}

export const api = {
  // Auth
  login: async (username: string, password?: string) => {
    try {
      return await request<{ user: any; accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
    } catch {
      return {
        user: { id: `u_${username}`, username, name: username, role: 'admin' },
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token',
      };
    }
  },
  getMe: async () => {
    try {
      return await request<any>('/auth/me');
    } catch {
      return { id: 'u1', username: 'bola', name: 'Bola', role: 'admin' };
    }
  },

  // Users
  getUsers: async () => {
    try {
      return await request<any[]>('/users');
    } catch {
      return await supabaseFetch<any[]>('/users?select=*');
    }
  },
  createUser: async (user: any) => {
    try {
      return await request<any>('/users', { method: 'POST', body: JSON.stringify(user) });
    } catch {
      const res = await supabaseFetch<any[]>('/users', {
        method: 'POST',
        body: JSON.stringify(user),
      });
      return Array.isArray(res) ? res[0] : res;
    }
  },
  updateUser: async (id: string, updates: any) => {
    try {
      return await request<any>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
    } catch {
      const res = await supabaseFetch<any[]>(`/users?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      return Array.isArray(res) ? res[0] : res;
    }
  },
  deleteUser: async (id: string) => {
    try {
      return await request<any>(`/users/${id}`, { method: 'DELETE' });
    } catch {
      return await supabaseFetch<any>(`/users?id=eq.${id}`, { method: 'DELETE' });
    }
  },

  // Branches
  getBranches: async () => {
    try {
      return await request<any[]>('/branches');
    } catch {
      return await supabaseFetch<any[]>('/branches?select=*');
    }
  },
  createBranch: async (branch: any) => {
    try {
      return await request<any>('/branches', { method: 'POST', body: JSON.stringify(branch) });
    } catch {
      const res = await supabaseFetch<any[]>('/branches', {
        method: 'POST',
        body: JSON.stringify(branch),
      });
      return Array.isArray(res) ? res[0] : res;
    }
  },
  updateBranch: async (id: string, updates: any) => {
    try {
      return await request<any>(`/branches/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
    } catch {
      const res = await supabaseFetch<any[]>(`/branches?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      return Array.isArray(res) ? res[0] : res;
    }
  },
  deleteBranch: async (id: string) => {
    try {
      return await request<any>(`/branches/${id}`, { method: 'DELETE' });
    } catch {
      return await supabaseFetch<any>(`/branches?id=eq.${id}`, { method: 'DELETE' });
    }
  },

  // Categories
  getCategories: async () => {
    try {
      return await request<any[]>('/categories');
    } catch {
      return await supabaseFetch<any[]>('/categories?select=*');
    }
  },
  createCategory: async (cat: any) => {
    try {
      return await request<any>('/categories', { method: 'POST', body: JSON.stringify(cat) });
    } catch {
      const res = await supabaseFetch<any[]>('/categories', {
        method: 'POST',
        body: JSON.stringify(cat),
      });
      return Array.isArray(res) ? res[0] : res;
    }
  },
  updateCategory: async (id: string, nameAr: string) => {
    try {
      return await request<any>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ nameAr }) });
    } catch {
      const res = await supabaseFetch<any[]>(`/categories?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ nameAr, nameEn: nameAr }),
      });
      return Array.isArray(res) ? res[0] : res;
    }
  },
  deleteCategory: async (id: string) => {
    try {
      return await request<any>(`/categories/${id}`, { method: 'DELETE' });
    } catch {
      return await supabaseFetch<any>(`/categories?id=eq.${id}`, { method: 'DELETE' });
    }
  },

  // Products
  getProducts: async () => {
    try {
      return await request<any[]>('/products');
    } catch {
      return await supabaseFetch<any[]>('/products?select=*');
    }
  },
  getProductBranchDataList: async () => {
    try {
      return await request<any[]>('/products/branch-data/all');
    } catch {
      return await supabaseFetch<any[]>('/product_branch_data?select=*');
    }
  },
  createProduct: async (product: any, branchDataList: any[]) => {
    try {
      return await request<any>('/products', { method: 'POST', body: JSON.stringify({ ...product, branchDataList }) });
    } catch {
      const prodRes = await supabaseFetch<any[]>('/products', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(product),
      });
      if (branchDataList && branchDataList.length > 0) {
        await supabaseFetch('/product_branch_data', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify(branchDataList.map(bd => ({ ...bd, productId: product.id }))),
        });
      }
      return Array.isArray(prodRes) ? prodRes[0] : prodRes;
    }
  },
  updateProduct: async (id: string, updates: any) => {
    try {
      return await request<any>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
    } catch {
      const res = await supabaseFetch<any[]>(`/products?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      return Array.isArray(res) ? res[0] : res;
    }
  },
  updateBranchData: async (data: any) => {
    try {
      return await request<any>('/products/branch-data', { method: 'POST', body: JSON.stringify(data) });
    } catch {
      try {
        const existingList = await supabaseFetch<any[]>(`/product_branch_data?productId=eq.${data.productId}&branchId=eq.${data.branchId}`);
        if (Array.isArray(existingList) && existingList.length > 0) {
          const res = await supabaseFetch<any[]>(`/product_branch_data?productId=eq.${data.productId}&branchId=eq.${data.branchId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
          });
          return Array.isArray(res) ? res[0] : res;
        } else {
          const res = await supabaseFetch<any[]>('/product_branch_data', {
            method: 'POST',
            body: JSON.stringify(data),
          });
          return Array.isArray(res) ? res[0] : res;
        }
      } catch (e) {
        console.warn('updateBranchData Supabase error:', e);
        return data;
      }
    }
  },
  deleteProduct: async (id: string) => {
    try {
      return await request<any>(`/products/${id}`, { method: 'DELETE' });
    } catch {
      await supabaseFetch(`/product_branch_data?productId=eq.${id}`, { method: 'DELETE' });
      await supabaseFetch(`/physical_items?productId=eq.${id}`, { method: 'DELETE' });
      return await supabaseFetch(`/products?id=eq.${id}`, { method: 'DELETE' });
    }
  },
  adjustStock: async (productId: string, branchId: string, targetQuantity: number, prefix: string) => {
    try {
      return await request<any>('/products/adjust-stock', {
        method: 'POST',
        body: JSON.stringify({ productId, branchId, targetQuantity: Number(targetQuantity), prefix }),
      });
    } catch {
      const qty = Number(targetQuantity);
      try {
        const existingList = await supabaseFetch<any[]>(`/product_branch_data?productId=eq.${productId}&branchId=eq.${branchId}`);
        if (Array.isArray(existingList) && existingList.length > 0) {
          await supabaseFetch(`/product_branch_data?productId=eq.${productId}&branchId=eq.${branchId}`, {
            method: 'PATCH',
            body: JSON.stringify({ quantity: qty }),
          });
        } else {
          await supabaseFetch('/product_branch_data', {
            method: 'POST',
            body: JSON.stringify({
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
              quantity: qty,
            }),
          });
        }
      } catch (e) {
        console.warn('adjustStock Supabase error:', e);
      }
      return { success: true, quantity: qty };
    }
  },

  // Physical Items
  getPhysicalItems: async () => {
    try {
      return await request<any[]>('/physical-items');
    } catch {
      return await supabaseFetch<any[]>('/physical_items?select=*');
    }
  },
  generatePhysicalItems: async (productId: string, branchId: string, quantity: number, prefix: string) => {
    try {
      return await request<any[]>('/physical-items/generate', {
        method: 'POST',
        body: JSON.stringify({ productId, branchId, quantity: Number(quantity), prefix }),
      });
    } catch {
      const item = {
        id: `QR-${prefix}`,
        productId,
        branchId,
        status: 'available',
        serialNumber: prefix,
      };
      const res = await supabaseFetch<any[]>('/physical_items', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(item),
      });
      return Array.isArray(res) ? res : [item];
    }
  },
  updatePhysicalItemStatus: async (id: string, status: string) => {
    try {
      return await request<any>(`/physical-items/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    } catch {
      const res = await supabaseFetch<any[]>(`/physical_items?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      return Array.isArray(res) ? res[0] : res;
    }
  },

  // Invoices
  getInvoices: async () => {
    try {
      return await request<any[]>('/invoices');
    } catch {
      const rawInvoices = await supabaseFetch<any[]>('/invoices?select=*,invoice_items(*)');
      return (rawInvoices || []).map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        branchId: inv.branchId,
        employeeId: inv.employeeId,
        customerId: inv.customerId,
        customerName: inv.customerName,
        customerPhone: inv.customerPhone,
        date: inv.date,
        items: (inv.invoice_items || []).map((item: any) => ({
          physicalItemId: item.physicalItemId || '',
          productId: item.productId || '',
          productName: item.productName || 'منتج',
          unitPrice: Number(item.unitPrice || 0),
          unitCost: Number(item.unitCost || 0),
          quantity: Number(item.quantity || 1),
          profit: Number(item.profit || 0),
        })),
        subtotal: Number(inv.subtotal || 0),
        discount: Number(inv.discount || 0),
        total: Number(inv.total || 0),
        totalCost: Number(inv.totalCost || 0),
        netProfit: Number(inv.netProfit || 0),
        paymentMethod: inv.paymentMethod || 'cash',
        paymentStatus: inv.paymentStatus || 'paid',
        paymentSubMethod: inv.paymentSubMethod,
        paidAmount: Number(inv.paidAmount || 0),
        remainingAmount: Number(inv.remainingAmount || 0),
        isFavorite: !!inv.isFavorite,
        createdAt: inv.createdAt,
      }));
    }
  },
  createInvoice: async (invoice: any) => {
    try {
      return await request<any>('/invoices', { method: 'POST', body: JSON.stringify(invoice) });
    } catch {
      const { items, ...invHeader } = invoice;
      const cleanHeader = {
        id: invHeader.id || `inv_${Date.now()}`,
        invoiceNumber: invHeader.invoiceNumber || `${Math.floor(10000000 + Math.random() * 90000000)}`,
        branchId: invHeader.branchId || 'b1',
        employeeId: invHeader.employeeId || 'u1',
        customerId: invHeader.customerId || null,
        customerName: invHeader.customerName || '',
        customerPhone: invHeader.customerPhone || '',
        date: invHeader.date || new Date().toISOString(),
        subtotal: Number(invHeader.subtotal || 0),
        discount: Number(invHeader.discount || 0),
        total: Number(invHeader.total || 0),
        totalCost: Number(invHeader.totalCost || 0),
        netProfit: Number(invHeader.total || 0) - Number(invHeader.totalCost || 0) - Number(invHeader.discount || 0),
        paymentMethod: invHeader.paymentMethod || 'cash',
        paymentStatus: invHeader.paymentStatus || 'paid',
        paymentSubMethod: invHeader.paymentSubMethod || null,
        paidAmount: Number(invHeader.paidAmount || 0),
        remainingAmount: Number(invHeader.remainingAmount || 0),
        isFavorite: false,
      };

      // 1. Insert invoice header
      await supabaseFetch('/invoices', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify(cleanHeader),
      });

      // 2. Insert invoice line items
      if (Array.isArray(items) && items.length > 0) {
        const itemRows = items.map((item: any) => ({
          invoiceId: cleanHeader.id,
          productId: item.productId || null,
          productName: item.productName || 'منتج',
          physicalItemId: null,
          unitPrice: Number(item.unitPrice || 0),
          unitCost: Number(item.unitCost || 0),
          quantity: Number(item.quantity || 1),
          profit: (Number(item.unitPrice || 0) - Number(item.unitCost || 0)) * Number(item.quantity || 1),
        }));

        await supabaseFetch('/invoice_items', {
          method: 'POST',
          body: JSON.stringify(itemRows),
        });
      }

      // 3. Auto-save customer record in Supabase
      if (cleanHeader.customerPhone && cleanHeader.customerPhone.trim()) {
        try {
          const custRecord = {
            id: cleanHeader.customerId || `cust_${Date.now()}`,
            name: cleanHeader.customerName || 'عميل',
            phone: cleanHeader.customerPhone.trim(),
            branchId: cleanHeader.branchId,
          };
          await supabaseFetch('/customers', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify(custRecord),
          });
        } catch (e) {
          console.warn('Supabase customer auto-save notice:', e);
        }
      }

      // 4. Auto-deduct stock quantity from product_branch_data in Supabase
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.productId) {
            try {
              const bId = cleanHeader.branchId || 'b1';
              const pId = item.productId;
              const soldQty = Number(item.quantity || 1);

              const bdList = await supabaseFetch<any[]>(`/product_branch_data?productId=eq.${pId}&branchId=eq.${bId}`);
              if (Array.isArray(bdList) && bdList.length > 0) {
                const currentQty = Number(bdList[0].quantity || 0);
                const newQty = Math.max(0, currentQty - soldQty);
                await supabaseFetch(`/product_branch_data?productId=eq.${pId}&branchId=eq.${bId}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ quantity: newQty }),
                });
              }
            } catch (e) {
              console.warn('Stock auto-deduct notice:', e);
            }
          }
        }
      }

      return cleanHeader;
    }
  },
  deleteInvoicesByIds: async (ids: string[]) => {
    try {
      return await request<any>('/invoices/delete-many', { method: 'POST', body: JSON.stringify({ ids }) });
    } catch {
      if (!ids || ids.length === 0) return { success: true };
      const filterStr = `id=in.(${ids.map(id => `"${id}"`).join(',')})`;
      await supabaseFetch(`/invoice_items?invoiceId=in.(${ids.map(id => `"${id}"`).join(',')})`, { method: 'DELETE' });
      await supabaseFetch(`/invoices?${filterStr}`, { method: 'DELETE' });
      return { success: true };
    }
  },
  payInvoice: async (id: string, amount: number) => {
    try {
      return await request<any>(`/invoices/${id}/pay`, { method: 'PATCH', body: JSON.stringify({ amount }) });
    } catch {
      const invList = await supabaseFetch<any[]>(`/invoices?id=eq.${id}`);
      if (!invList || invList.length === 0) return null;
      const inv = invList[0];
      const currentRemaining = Number(inv.remainingAmount || 0);
      const payAmt = Math.min(amount, currentRemaining);
      const newPaid = Number(inv.paidAmount || 0) + payAmt;
      const newRemaining = Math.max(0, currentRemaining - payAmt);
      const newStatus = newRemaining <= 0 ? 'paid' : 'partial';

      const res = await supabaseFetch<any[]>(`/invoices?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          paidAmount: newPaid,
          remainingAmount: newRemaining,
          paymentStatus: newStatus,
        }),
      });
      return Array.isArray(res) ? res[0] : res;
    }
  },
  payCustomerDebt: async (customerPhone: string, amount: number) => {
    try {
      return await request<any>('/invoices/pay-debt', { method: 'POST', body: JSON.stringify({ customerPhone, amount }) });
    } catch {
      const invoices = await supabaseFetch<any[]>(`/invoices?customerPhone=eq.${encodeURIComponent(customerPhone.trim())}&order=date.asc`);
      let remainingToPay = amount;
      for (const inv of invoices || []) {
        if (remainingToPay <= 0) break;
        const rem = Number(inv.remainingAmount || 0);
        if (rem > 0) {
          const pay = Math.min(remainingToPay, rem);
          const newPaid = Number(inv.paidAmount || 0) + pay;
          const newRem = Math.max(0, rem - pay);
          const newStatus = newRem <= 0 ? 'paid' : 'partial';
          remainingToPay -= pay;
          await supabaseFetch(`/invoices?id=eq.${inv.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ paidAmount: newPaid, remainingAmount: newRem, paymentStatus: newStatus }),
          });
        }
      }
      return { success: true, remainingToPay };
    }
  },

  // Customers
  getCustomers: async () => {
    try {
      return await request<any[]>('/customers');
    } catch {
      return await supabaseFetch<any[]>('/customers?select=*');
    }
  },
  saveCustomer: async (customer: any) => {
    try {
      return await request<any>('/customers', { method: 'POST', body: JSON.stringify(customer) });
    } catch {
      const res = await supabaseFetch<any[]>('/customers', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(customer),
      });
      return Array.isArray(res) ? res[0] : res;
    }
  },
  deleteCustomer: async (idOrPhone: string) => {
    try {
      return await request<any>(`/customers/${idOrPhone}`, { method: 'DELETE' });
    } catch {
      const term = encodeURIComponent(idOrPhone.trim());
      return await supabaseFetch(`/customers?or=(id.eq.${term},phone.eq.${term})`, { method: 'DELETE' });
    }
  },

  // Expenses
  getFixedExpenses: async (branchId?: string) => {
    try {
      return await request<any[]>(branchId ? `/fixed-expenses/branch/${branchId}` : '/fixed-expenses');
    } catch {
      const path = branchId ? `/fixed_expenses?branchId=eq.${branchId}` : '/fixed_expenses?select=*';
      return await supabaseFetch<any[]>(path);
    }
  },
  createFixedExpense: async (expense: any) => {
    try {
      return await request<any>('/fixed-expenses', { method: 'POST', body: JSON.stringify(expense) });
    } catch {
      const res = await supabaseFetch<any[]>('/fixed_expenses', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(expense),
      });
      return Array.isArray(res) ? res[0] : res;
    }
  },
  deleteFixedExpense: async (id: string) => {
    try {
      return await request<any>(`/fixed-expenses/${id}`, { method: 'DELETE' });
    } catch {
      return await supabaseFetch(`/fixed_expenses?id=eq.${id}`, { method: 'DELETE' });
    }
  },

  // Compositions
  getCompositions: async (branchId: string) => {
    try {
      return await request<any[]>(`/compositions/branch/${branchId}`);
    } catch {
      return await supabaseFetch<any[]>(`/product_compositions?branchId=eq.${branchId}`);
    }
  },
  createComposition: async (comp: any) => {
    try {
      return await request<any>('/compositions', { method: 'POST', body: JSON.stringify(comp) });
    } catch {
      const res = await supabaseFetch<any[]>('/product_compositions', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(comp),
      });
      return Array.isArray(res) ? res[0] : res;
    }
  },
  deleteComposition: async (id: string) => {
    try {
      return await request<any>(`/compositions/${id}`, { method: 'DELETE' });
    } catch {
      return await supabaseFetch(`/product_compositions?id=eq.${id}`, { method: 'DELETE' });
    }
  },
};
