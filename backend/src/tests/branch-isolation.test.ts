process.env.DB_SCHEMA = 'test_isolation';
import assert from 'assert';
import http from 'http';
import app from '../app';
import { AppDataSource } from '../config/data-source';
import { setupIsolatedTestSchema } from '../scripts/setup-test-schema';
import { generateAccessToken } from '../common/utils/jwt.utils';
import { ProductEntity } from '../modules/products/product.entity';
import { ProductBranchDataEntity } from '../modules/products/product-branch-data.entity';
import { CategoryEntity } from '../modules/categories/category.entity';
import { CustomerEntity } from '../modules/customers/customer.entity';
import { SupplierEntity } from '../modules/suppliers/supplier.entity';
import { InvoiceEntity } from '../modules/invoices/invoice.entity';
import { FixedExpenseEntity } from '../modules/fixed-expenses/fixed-expense.entity';
import { ProductCompositionEntity } from '../modules/compositions/composition.entity';
import { PhysicalItemEntity } from '../modules/physical-items/physical-item.entity';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { initSocketServer, broadcastStockUpdate, broadcastInvoiceCreated, broadcastProductCreated } from '../common/socket/socket.service';

async function runBranchIsolationTests() {
  console.log('========================================================================');
  console.log('🔒 STARTING COMPREHENSIVE BRANCH ISOLATION & HARDENING TEST SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      if (err.stack) {
        console.error(`     Stack: ${err.stack.split('\n').slice(1, 4).join('\n')}`);
      }
      failed++;
    }
  }

  // Initialize DB and isolated test schema
  await setupIsolatedTestSchema();

  const monitoredTables = [
    'products',
    'product_branch_data',
    'categories',
    'customers',
    'suppliers',
    'invoices',
    'invoice_items',
    'fixed_expenses',
    'product_compositions',
    'physical_items',
  ];

  const publicCountsBefore: Record<string, number> = {};
  for (const t of monitoredTables) {
    const r = await AppDataSource.query(`SELECT COUNT(*)::int AS cnt FROM public."${t}"`);
    publicCountsBefore[t] = r[0].cnt;
  }

  // Start HTTP Server on random port using real Express app
  const server = http.createServer(app);
  initSocketServer(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  const socketUrl = `http://127.0.0.1:${address.port}`;

  // Tokens for actors
  const tokenAdmin = generateAccessToken({ userId: 'u_admin_test', username: 'admin_test', role: 'admin' });
  const tokenManagerB1 = generateAccessToken({ userId: 'u_mgr_b1', username: 'mgr_b1', role: 'manager', branchId: 'b1' });
  const tokenStaffB1 = generateAccessToken({ userId: 'u_staff_b1', username: 'cashier_b1', role: 'cashier', branchId: 'b1' });
  const tokenStaffB2 = generateAccessToken({ userId: 'u_staff_b2', username: 'cashier_b2', role: 'cashier', branchId: 'b2' });
  const tokenStaffB3 = generateAccessToken({ userId: 'u_staff_b3', username: 'cashier_b3', role: 'cashier', branchId: 'b3' });

  // Test identifiers for clean lifecycle
  const testRunId = Date.now();
  const createdIds: {
    categories: string[];
    products: string[];
    customers: string[];
    suppliers: string[];
    invoices: string[];
    fixedExpenses: string[];
    compositions: string[];
    physicalItems: string[];
  } = {
    categories: [],
    products: [],
    customers: [],
    suppliers: [],
    invoices: [],
    fixedExpenses: [],
    compositions: [],
    physicalItems: [],
  };

  try {
    // -------------------------------------------------------------------------
    // SETUP TEST FIXTURES: B1 and B2 base entities
    // -------------------------------------------------------------------------
    console.log('--- Setting Up Base Branch Fixtures ---');
    const catRepo = AppDataSource.getRepository(CategoryEntity);
    const prodRepo = AppDataSource.getRepository(ProductEntity);
    const pbdRepo = AppDataSource.getRepository(ProductBranchDataEntity);
    const custRepo = AppDataSource.getRepository(CustomerEntity);
    const suppRepo = AppDataSource.getRepository(SupplierEntity);
    const invRepo = AppDataSource.getRepository(InvoiceEntity);
    const expRepo = AppDataSource.getRepository(FixedExpenseEntity);
    const compRepo = AppDataSource.getRepository(ProductCompositionEntity);
    const physRepo = AppDataSource.getRepository(PhysicalItemEntity);

    // Categories
    const catB1 = await catRepo.save({
      id: `test_cat_b1_${testRunId}`,
      nameAr: `فئة اختبار ب1 ${testRunId}`,
      nameEn: `Test Cat B1 ${testRunId}`,
      branchId: 'b1',
    });
    createdIds.categories.push(catB1.id);

    const catB2 = await catRepo.save({
      id: `test_cat_b2_${testRunId}`,
      nameAr: `فئة اختبار ب2 ${testRunId}`,
      nameEn: `Test Cat B2 ${testRunId}`,
      branchId: 'b2',
    });
    createdIds.categories.push(catB2.id);

    // Products
    const prodB1 = await prodRepo.save({
      id: `test_prod_b1_${testRunId}`,
      nameAr: `منتج اختبار ب1 ${testRunId}`,
      nameEn: `Test Prod B1 ${testRunId}`,
      descriptionAr: '',
      descriptionEn: '',
      categoryId: catB1.id,
      branchId: 'b1',
      sku: `SKU-B1-${testRunId}`,
      productCode: `PCODE-B1-${testRunId}`,
      material: 'Steel',
      color: 'Silver',
      size: 'M',
      isActive: true,
    });
    createdIds.products.push(prodB1.id);

    const pbdB1 = await pbdRepo.save({
      productId: prodB1.id,
      branchId: 'b1',
      quantity: 20,
      price1: 100,
      cost: 50,
    });

    const prodB2 = await prodRepo.save({
      id: `test_prod_b2_${testRunId}`,
      nameAr: `منتج اختبار ب2 ${testRunId}`,
      nameEn: `Test Prod B2 ${testRunId}`,
      descriptionAr: '',
      descriptionEn: '',
      categoryId: catB2.id,
      branchId: 'b2',
      sku: `SKU-B2-${testRunId}`,
      productCode: `PCODE-B2-${testRunId}`,
      material: 'Gold',
      color: 'Yellow',
      size: 'L',
      isActive: true,
    });
    createdIds.products.push(prodB2.id);

    const pbdB2 = await pbdRepo.save({
      productId: prodB2.id,
      branchId: 'b2',
      quantity: 20,
      price1: 150,
      cost: 70,
    });

    // Customers
    const custB1 = await custRepo.save({
      id: `test_cust_b1_${testRunId}`,
      name: `عميل فرع ب1 ${testRunId}`,
      phone: `0101111${testRunId.toString().slice(-4)}`,
      branchId: 'b1',
    });
    createdIds.customers.push(custB1.id);

    const custB2 = await custRepo.save({
      id: `test_cust_b2_${testRunId}`,
      name: `عميل فرع ب2 ${testRunId}`,
      phone: `0102222${testRunId.toString().slice(-4)}`,
      branchId: 'b2',
    });
    createdIds.customers.push(custB2.id);

    // Suppliers
    const suppB1 = await suppRepo.save({
      id: `test_supp_b1_${testRunId}`,
      supplierName: `مورد فرع ب1 ${testRunId}`,
      supplierPhone: `0111111${testRunId.toString().slice(-4)}`,
      branchId: 'b1',
      totalAmount: 1000,
      paidAmount: 500,
      remainingAmount: 500,
      paymentStatus: 'partial',
    });
    createdIds.suppliers.push(suppB1.id);

    const suppB2 = await suppRepo.save({
      id: `test_supp_b2_${testRunId}`,
      supplierName: `مورد فرع ب2 ${testRunId}`,
      supplierPhone: `0112222${testRunId.toString().slice(-4)}`,
      branchId: 'b2',
      totalAmount: 2000,
      paidAmount: 1000,
      remainingAmount: 1000,
      paymentStatus: 'partial',
    });
    createdIds.suppliers.push(suppB2.id);

    // Fixed Expenses
    const expB1 = await expRepo.save({
      id: `test_exp_b1_${testRunId}`,
      title: `إيجار ب1 ${testRunId}`,
      amount: 500,
      branchId: 'b1',
      date: new Date().toISOString().split('T')[0],
      type: 'monthly',
    });
    createdIds.fixedExpenses.push(expB1.id);

    const expB2 = await expRepo.save({
      id: `test_exp_b2_${testRunId}`,
      title: `إيجار ب2 ${testRunId}`,
      amount: 600,
      branchId: 'b2',
      date: new Date().toISOString().split('T')[0],
      type: 'monthly',
    });
    createdIds.fixedExpenses.push(expB2.id);

    // Compositions
    const compB1 = await compRepo.save({
      id: `test_comp_b1_${testRunId}`,
      name: `تركيبة ب1 ${testRunId}`,
      branchId: 'b1',
      totalCost: 100,
      sellingPrice: 200,
      price1: 200,
      price2: 190,
      price3: 180,
      quantity: 5,
      internalComponents: [],
      externalComponents: [],
      createdAt: new Date().toISOString(),
    });
    createdIds.compositions.push(compB1.id);

    const compB2 = await compRepo.save({
      id: `test_comp_b2_${testRunId}`,
      name: `تركيبة ب2 ${testRunId}`,
      branchId: 'b2',
      totalCost: 120,
      sellingPrice: 240,
      price1: 240,
      price2: 230,
      price3: 220,
      quantity: 5,
      internalComponents: [],
      externalComponents: [],
      createdAt: new Date().toISOString(),
    });
    createdIds.compositions.push(compB2.id);

    // Physical Items
    const physB1 = await physRepo.save({
      id: `test_phys_b1_${testRunId}`,
      productId: prodB1.id,
      branchId: 'b1',
      serialNumber: `SN_B1_${testRunId}`,
      status: 'available',
    });
    createdIds.physicalItems.push(physB1.id);

    const physB2 = await physRepo.save({
      id: `test_phys_b2_${testRunId}`,
      productId: prodB2.id,
      branchId: 'b2',
      serialNumber: `SN_B2_${testRunId}`,
      status: 'available',
    });
    createdIds.physicalItems.push(physB2.id);

    // Invoices
    const invB1 = await invRepo.save({
      id: `test_inv_b1_${testRunId}`,
      invoiceNumber: `INV-B1-${testRunId}`,
      branchId: 'b1',
      employeeId: 'u_staff_b1',
      subtotal: 100,
      total: 100,
      paidAmount: 100,
      remainingAmount: 0,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      totalCost: 50,
      netProfit: 50,
      date: new Date().toISOString(),
    });
    createdIds.invoices.push(invB1.id);

    const invB2 = await invRepo.save({
      id: `test_inv_b2_${testRunId}`,
      invoiceNumber: `INV-B2-${testRunId}`,
      branchId: 'b2',
      employeeId: 'u_staff_b2',
      subtotal: 150,
      total: 150,
      paidAmount: 150,
      remainingAmount: 0,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      totalCost: 70,
      netProfit: 80,
      date: new Date().toISOString(),
    });
    createdIds.invoices.push(invB2.id);

    console.log('Base fixtures created successfully.\n');

    // =========================================================================
    // SUITE 1: DATA SEPARATION (الفصل التام في الاستعلامات)
    // =========================================================================
    console.log('--- Suite 1: Data Separation (الفصل التام) ---');

    await test('Staff B2 cannot see Products of Branch B1 in GET /products', async () => {
      const res = await fetch(`${baseUrl}/products`, {
        headers: { Authorization: `Bearer ${tokenStaffB2}` },
      });
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      const list = Array.isArray(json.data) ? json.data : (json.data?.data || []);
      const foundB1 = list.find((p: any) => p.id === prodB1.id);
      assert.strictEqual(foundB1, undefined, 'Branch B1 product must not appear in Branch B2 query');
    });

    await test('Staff B2 cannot see Categories of Branch B1 in GET /categories', async () => {
      const res = await fetch(`${baseUrl}/categories`, {
        headers: { Authorization: `Bearer ${tokenStaffB2}` },
      });
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      const list = json.data || [];
      const foundB1 = list.find((c: any) => c.id === catB1.id);
      assert.strictEqual(foundB1, undefined, 'Branch B1 category must not appear in Branch B2 query');
    });

    await test('Staff B2 cannot see Customers of Branch B1 in GET /customers', async () => {
      const res = await fetch(`${baseUrl}/customers`, {
        headers: { Authorization: `Bearer ${tokenStaffB2}` },
      });
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      const list = json.data || [];
      const foundB1 = list.find((c: any) => c.id === custB1.id);
      assert.strictEqual(foundB1, undefined, 'Branch B1 customer must not appear in Branch B2 query');
    });

    await test('Staff B2 cannot see Suppliers of Branch B1 in GET /suppliers', async () => {
      const res = await fetch(`${baseUrl}/suppliers`, {
        headers: { Authorization: `Bearer ${tokenStaffB2}` },
      });
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      const list = json.data || [];
      const foundB1 = list.find((s: any) => s.id === suppB1.id);
      assert.strictEqual(foundB1, undefined, 'Branch B1 supplier must not appear in Branch B2 query');
    });

    await test('Staff B2 cannot see Invoices of Branch B1 in GET /invoices', async () => {
      const res = await fetch(`${baseUrl}/invoices`, {
        headers: { Authorization: `Bearer ${tokenStaffB2}` },
      });
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      const list = Array.isArray(json.data) ? json.data : (json.data?.data || []);
      const foundB1 = list.find((i: any) => i.id === invB1.id);
      assert.strictEqual(foundB1, undefined, 'Branch B1 invoice must not appear in Branch B2 query');
    });

    // =========================================================================
    // SUITE 2: IDOR PREVENTION (منع IDOR - 403 Forbidden عبر المعرفات المباشرة)
    // =========================================================================
    console.log('\n--- Suite 2: IDOR Prevention (منع IDOR - 403 Forbidden) ---');

    await test('Staff B1 cannot GET Invoice of Branch B2 (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/invoices/${invB2.id}`, {
        headers: { Authorization: `Bearer ${tokenStaffB1}` },
      });
      assert.strictEqual(res.status, 403, 'Must return 403 when reading invoice from another branch');
    });

    await test('Staff B1 cannot PUT/Update Invoice of Branch B2 (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/invoices/${invB2.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenStaffB1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subtotal: 999, total: 999 }),
      });
      assert.strictEqual(res.status, 403, 'Must return 403 when updating invoice from another branch');
    });

    await test('Staff B1 cannot GET Product of Branch B2 (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/products/${prodB2.id}`, {
        headers: { Authorization: `Bearer ${tokenStaffB1}` },
      });
      assert.strictEqual(res.status, 403, 'Must return 403 when reading product from another branch');
    });

    await test('Staff B1 cannot PUT/Update Product of Branch B2 (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/products/${prodB2.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenStaffB1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nameAr: 'Hacked Name' }),
      });
      assert.strictEqual(res.status, 403, 'Must return 403 when updating product from another branch');
    });

    await test('Staff B1 cannot DELETE Product of Branch B2 (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/products/${prodB2.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenStaffB1}` },
      });
      assert.strictEqual(res.status, 403, 'Must return 403 when deleting product from another branch');
    });

    await test('Staff B1 cannot PUT/Update Category of Branch B2 (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/categories/${catB2.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenStaffB1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nameAr: 'Hacked Category' }),
      });
      assert.strictEqual(res.status, 403, 'Must return 403 when updating category from another branch');
    });

    await test('Staff B1 cannot DELETE Category of Branch B2 (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/categories/${catB2.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenStaffB1}` },
      });
      assert.strictEqual(res.status, 403, 'Must return 403 when deleting category from another branch');
    });

    await test('Staff B1 cannot GET Customer of Branch B2 (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/customers/${custB2.id}`, {
        headers: { Authorization: `Bearer ${tokenStaffB1}` },
      });
      assert.strictEqual(res.status, 403, 'Must return 403 when reading customer from another branch');
    });

    await test('Staff B1 cannot PUT/Update Supplier of Branch B2 (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/suppliers/${suppB2.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenStaffB1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ supplierName: 'Hacked Supplier' }),
      });
      assert.strictEqual(res.status, 403, 'Must return 403 when updating supplier from another branch');
    });

    await test('Staff B1 cannot DELETE Supplier of Branch B2 (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/suppliers/${suppB2.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenStaffB1}` },
      });
      assert.strictEqual(res.status, 403, 'Must return 403 when deleting supplier from another branch');
    });

    await test('Staff B1 cannot GET Fixed Expense of Branch B2 (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/fixed-expenses/${expB2.id}`, {
        headers: { Authorization: `Bearer ${tokenStaffB1}` },
      });
      assert.strictEqual(res.status, 403, 'Must return 403 when reading fixed expense from another branch');
    });

    await test('Staff B1 cannot DELETE Fixed Expense of Branch B2 (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/fixed-expenses/${expB2.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenStaffB1}` },
      });
      assert.strictEqual(res.status, 403, 'Must return 403 when deleting fixed expense from another branch');
    });

    await test('Staff B1 cannot GET Composition of Branch B2 (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/compositions/${compB2.id}`, {
        headers: { Authorization: `Bearer ${tokenStaffB1}` },
      });
      assert.strictEqual(res.status, 403, 'Must return 403 when reading composition from another branch');
    });

    await test('Staff B1 cannot DELETE Composition of Branch B2 (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/compositions/${compB2.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenStaffB1}` },
      });
      assert.strictEqual(res.status, 403, 'Must return 403 when deleting composition from another branch');
    });

    await test('Staff B1 cannot GET Physical Item of Branch B2 (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/physical-items/${physB2.id}`, {
        headers: { Authorization: `Bearer ${tokenStaffB1}` },
      });
      assert.strictEqual(res.status, 403, 'Must return 403 when reading physical item from another branch');
    });

    // =========================================================================
    // SUITE 3: FORGED BODY BRANCHID PROTECTION (منع تزوير branchId في الـ body)
    // =========================================================================
    console.log('\n--- Suite 3: Forged Body branchId Protection (منع التزوير) ---');

    await test('Staff B1 POST /products with forged branchId: "b2" is overridden to "b1"', async () => {
      const res = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenStaffB1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nameAr: `منتج تزوير ${testRunId}`,
          categoryId: catB1.id,
          branchId: 'b2', // Attempted forge!
          branchDataList: [{
            branchId: 'b1',
            cost: 80,
            price1: 150,
            quantity: 5,
          }],
        }),
      });
      assert.strictEqual(res.status, 201);
      const json: any = await res.json();
      assert.strictEqual(json.data.branchId, 'b1', 'Server must ignore body branchId and force token branch b1');
      createdIds.products.push(json.data.id);
    });

    await test('Staff B1 POST /products with legacy categoryId (without _b1) automatically resolves to B1 category', async () => {
      const res = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenStaffB1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nameAr: `منتج فئة قديمة ${testRunId}`,
          categoryId: 'cat_1791902651363', // Legacy ID without _b1
          sku: `LEGACY-${testRunId.toString().slice(-4)}`,
          productCode: `LEGACY-${testRunId.toString().slice(-4)}`,
          material: 'ستانلس',
          color: 'فضي',
          size: 'M',
        }),
      });
      assert.strictEqual(res.status, 201);
      const json: any = await res.json();
      assert.strictEqual(json.data.categoryId, 'cat_1791902651363_b1', 'Legacy category ID must resolve to b1 category');
      createdIds.products.push(json.data.id);
    });

    await test('Cashier B1 cannot POST /categories (403 Forbidden - manager/admin only)', async () => {
      const res = await fetch(`${baseUrl}/categories`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenStaffB1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nameAr: `فئة كاشير ${testRunId}`, branchId: 'b1' }),
      });
      assert.strictEqual(res.status, 403, 'Cashier must be forbidden from creating categories');
    });

    await test('Manager B1 POST /categories with forged branchId: "b2" is overridden to "b1"', async () => {
      const res = await fetch(`${baseUrl}/categories`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenManagerB1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nameAr: `فئة تزوير ${testRunId}`,
          branchId: 'b2', // Attempted forge!
        }),
      });
      assert.strictEqual(res.status, 201);
      const json: any = await res.json();
      assert.strictEqual(json.data.branchId, 'b1', 'Server must ignore body branchId and force token branch b1');
      createdIds.categories.push(json.data.id);
    });

    await test('Cashier B1 cannot POST /suppliers (403 Forbidden - manager/admin only)', async () => {
      const res = await fetch(`${baseUrl}/suppliers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenStaffB1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ supplierName: `مورد كاشير ${testRunId}`, branchId: 'b1' }),
      });
      assert.strictEqual(res.status, 403, 'Cashier must be forbidden from creating suppliers');
    });

    await test('Manager B1 POST /suppliers with forged branchId: "b2" is overridden to "b1"', async () => {
      const res = await fetch(`${baseUrl}/suppliers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenManagerB1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supplierName: `مورد تزوير ${testRunId}`,
          supplierPhone: `0123456${testRunId.toString().slice(-4)}`,
          branchId: 'b2', // Attempted forge!
        }),
      });
      assert.strictEqual(res.status, 201);
      const json: any = await res.json();
      assert.strictEqual(json.data.branchId, 'b1', 'Server must ignore body branchId and force token branch b1');
      createdIds.suppliers.push(json.data.id);
    });

    await test('Staff B1 POST /customers with forged branchId: "b2" is overridden to "b1"', async () => {
      const res = await fetch(`${baseUrl}/customers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenStaffB1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `عميل تزوير ${testRunId}`,
          phone: `0109999${testRunId.toString().slice(-4)}`,
          branchId: 'b2', // Attempted forge!
        }),
      });
      assert.strictEqual(res.status, 201);
      const json: any = await res.json();
      assert.strictEqual(json.data.branchId, 'b1', 'Server must ignore body branchId and force token branch b1');
      createdIds.customers.push(json.data.id);
    });

    await test('Staff B1 POST /invoices with forged branchId: "b2" is overridden to "b1"', async () => {
      const res = await fetch(`${baseUrl}/invoices`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenStaffB1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branchId: 'b2', // Attempted forge!
          employeeId: 'u_staff_b1',
          customerName: `عميل تزوير ${testRunId}`,
          customerPhone: '01011112222',
          subtotal: 100,
          total: 100,
          paidAmount: 100,
          remainingAmount: 0,
          paymentMethod: 'cash',
          paymentStatus: 'paid',
          items: [{
            productId: prodB1.id,
            productName: prodB1.nameAr,
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
            unitCost: 50,
            totalCost: 50,
          }],
        }),
      });
      assert.strictEqual(res.status, 201);
      const json: any = await res.json();
      assert.strictEqual(json.data.branchId, 'b1', 'Server must ignore body branchId and force token branch b1');
      createdIds.invoices.push(json.data.id);
    });

    // =========================================================================
    // SUITE 4: CLEAN ADMIN SWITCHING (تبديل الأدمن النظيف وبدون خلط)
    // =========================================================================
    console.log('\n--- Suite 4: Clean Admin Branch Switching (التبديل النظيف) ---');

    await test('Admin querying ?branchId=b1 sees strictly B1 products with zero B2 mixture', async () => {
      const res = await fetch(`${baseUrl}/products?branchId=b1`, {
        headers: { Authorization: `Bearer ${tokenAdmin}` },
      });
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      const list = Array.isArray(json.data) ? json.data : (json.data?.data || []);
      const hasB1 = list.some((p: any) => p.id === prodB1.id);
      const hasB2 = list.some((p: any) => p.id === prodB2.id);
      assert.strictEqual(hasB1, true, 'Admin query for b1 must include B1 products');
      assert.strictEqual(hasB2, false, 'Admin query for b1 must NEVER include B2 products');
    });

    await test('Admin querying ?branchId=b2 sees strictly B2 products with zero B1 mixture', async () => {
      const res = await fetch(`${baseUrl}/products?branchId=b2`, {
        headers: { Authorization: `Bearer ${tokenAdmin}` },
      });
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      const list = Array.isArray(json.data) ? json.data : (json.data?.data || []);
      const hasB1 = list.some((p: any) => p.id === prodB1.id);
      const hasB2 = list.some((p: any) => p.id === prodB2.id);
      assert.strictEqual(hasB2, true, 'Admin query for b2 must include B2 products');
      assert.strictEqual(hasB1, false, 'Admin query for b2 must NEVER include B1 products');
    });

    await test('Admin querying ?branchId=b1 sees strictly B1 categories with zero B2 mixture', async () => {
      const res = await fetch(`${baseUrl}/categories?branchId=b1`, {
        headers: { Authorization: `Bearer ${tokenAdmin}` },
      });
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      const list = json.data || [];
      const hasB1 = list.some((c: any) => c.id === catB1.id);
      const hasB2 = list.some((c: any) => c.id === catB2.id);
      assert.strictEqual(hasB1, true, 'Admin query for b1 must include B1 categories');
      assert.strictEqual(hasB2, false, 'Admin query for b1 must NEVER include B2 categories');
    });

    await test('Admin querying ?branchId=b2 sees strictly B2 categories with zero B1 mixture', async () => {
      const res = await fetch(`${baseUrl}/categories?branchId=b2`, {
        headers: { Authorization: `Bearer ${tokenAdmin}` },
      });
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      const list = json.data || [];
      const hasB1 = list.some((c: any) => c.id === catB1.id);
      const hasB2 = list.some((c: any) => c.id === catB2.id);
      assert.strictEqual(hasB2, true, 'Admin query for b2 must include B2 categories');
      assert.strictEqual(hasB1, false, 'Admin query for b2 must NEVER include B1 categories');
    });

    await test('Admin querying ?branchId=b1 sees strictly B1 invoices with zero B2 mixture', async () => {
      const res = await fetch(`${baseUrl}/invoices?branchId=b1`, {
        headers: { Authorization: `Bearer ${tokenAdmin}` },
      });
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      const list = Array.isArray(json.data) ? json.data : (json.data?.data || []);
      const hasB1 = list.some((i: any) => i.id === invB1.id);
      const hasB2 = list.some((i: any) => i.id === invB2.id);
      assert.strictEqual(hasB1, true, 'Admin query for b1 must include B1 invoices');
      assert.strictEqual(hasB2, false, 'Admin query for b1 must NEVER include B2 invoices');
    });

    await test('Admin querying ?branchId=b2 sees strictly B2 invoices with zero B1 mixture', async () => {
      const res = await fetch(`${baseUrl}/invoices?branchId=b2`, {
        headers: { Authorization: `Bearer ${tokenAdmin}` },
      });
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      const list = Array.isArray(json.data) ? json.data : (json.data?.data || []);
      const hasB1 = list.some((i: any) => i.id === invB1.id);
      const hasB2 = list.some((i: any) => i.id === invB2.id);
      assert.strictEqual(hasB2, true, 'Admin query for b2 must include B2 invoices');
      assert.strictEqual(hasB1, false, 'Admin query for b2 must NEVER include B1 invoices');
    });

    // =========================================================================
    // SUITE 5: CACHE-CONTROL HEADERS (التحقق من حظر public والسماح بـ private)
    // =========================================================================
    console.log('\n--- Suite 5: Cache-Control Headers Verification (ترويسات الكاش) ---');

    const cacheEndpoints = [
      '/products',
      '/categories',
      '/invoices',
      '/customers',
      '/suppliers',
      '/fixed-expenses',
      '/compositions',
      '/physical-items',
    ];

    for (const ep of cacheEndpoints) {
      await test(`Endpoint ${ep} must NEVER have "Cache-Control: public" and must be private`, async () => {
        const res = await fetch(`${baseUrl}${ep}`, {
          headers: { Authorization: `Bearer ${tokenStaffB1}` },
        });
        const cacheControl = res.headers.get('cache-control') || '';
        assert.doesNotMatch(cacheControl, /\bpublic\b/i, `Endpoint ${ep} MUST NOT be public`);
        assert.match(cacheControl, /private|no-cache|no-store/i, `Endpoint ${ep} must be private or no-cache`);
      });
    }

    // =========================================================================
    // SUITE 6: INVENTORY DEDUCTIONS ISOLATION (عزل خصم المخزون بين الفروع)
    // =========================================================================
    console.log('\n--- Suite 6: Inventory Deductions Isolation (عزل خصم المخزون) ---');

    // Create a product that exists in both branches to test isolated branch stock
    const sharedTestProd = await prodRepo.save({
      id: `test_shared_prod_${testRunId}`,
      nameAr: `منتج مخزون مشترك ${testRunId}`,
      nameEn: `Shared Stock Prod ${testRunId}`,
      descriptionAr: '',
      descriptionEn: '',
      categoryId: catB1.id,
      branchId: 'b1',
      sku: `SKU-SHARED-${testRunId}`,
      productCode: `PCODE-SHARED-${testRunId}`,
      material: 'Brass',
      color: 'Bronze',
      size: 'S',
      isActive: true,
    });
    createdIds.products.push(sharedTestProd.id);

    // Initial stock: 20 units in B1, 20 units in B2
    const sharedPbdB1 = await pbdRepo.save({
      productId: sharedTestProd.id,
      branchId: 'b1',
      quantity: 20,
      price1: 80,
      cost: 40,
    });

    const sharedPbdB2 = await pbdRepo.save({
      productId: sharedTestProd.id,
      branchId: 'b2',
      quantity: 20,
      price1: 80,
      cost: 40,
    });

    await test('Selling 5 units in Branch B1 decrements B1 stock to 15 without affecting B2 (remains 20)', async () => {
      const res = await fetch(`${baseUrl}/invoices`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenStaffB1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branchId: 'b1',
          employeeId: 'u_staff_b1',
          customerName: `عميل مخزون ${testRunId}`,
          customerPhone: '01033334444',
          subtotal: 400,
          total: 400,
          paidAmount: 400,
          remainingAmount: 0,
          paymentMethod: 'cash',
          paymentStatus: 'paid',
          items: [{
            productId: sharedTestProd.id,
            productName: sharedTestProd.nameAr,
            quantity: 5,
            unitPrice: 80,
            totalPrice: 400,
            unitCost: 40,
            totalCost: 200,
          }],
        }),
      });
      const json: any = await res.json();
      if (res.status !== 201) {
        console.error('FAILED INVOICE RES:', JSON.stringify(json));
      }
      assert.strictEqual(res.status, 201);
      createdIds.invoices.push(json.data.id);

      // Verify B1 stock directly in database
      const checkB1 = await pbdRepo.findOne({ where: { id: sharedPbdB1.id } });
      assert.strictEqual(Number(checkB1?.quantity), 15, 'Branch B1 stock must be decremented from 20 to 15');

      // Verify B2 stock directly in database: MUST REMAIN UNTOUCHED AT 20
      const checkB2 = await pbdRepo.findOne({ where: { id: sharedPbdB2.id } });
      assert.strictEqual(Number(checkB2?.quantity), 20, 'Branch B2 stock MUST REMAIN UNTOUCHED at 20');
    });

    await test('Selling a physical item belonging to Branch B2 inside Branch B1 invoice is strictly REJECTED (400)', async () => {
      const res = await fetch(`${baseUrl}/invoices`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenStaffB1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branchId: 'b1',
          employeeId: 'u_staff_b1',
          subtotal: 80,
          total: 80,
          paidAmount: 80,
          remainingAmount: 0,
          paymentMethod: 'cash',
          paymentStatus: 'paid',
          items: [{
            productId: sharedTestProd.id,
            physicalItemId: physB2.id, // Piece belongs to Branch B2!
            productName: sharedTestProd.nameAr,
            quantity: 1,
            unitPrice: 80,
            totalPrice: 80,
            unitCost: 40,
            totalCost: 40,
          }],
        }),
      });
      assert.strictEqual(res.status, 400, 'Must reject selling piece belonging to another branch');
      const json: any = await res.json();
      assert.match(json.message, /تنتمي إلى فرع آخر|غير متاحة للبيع/i);
    });

    // =========================================================================
    // SUITE 7: ADDITIONAL ISOLATION CHECKS (Socket.io, Search, Stock, Reports, Empty Branch)
    // =========================================================================
    console.log('\n--- Suite 7: Additional Isolation Checks (التحققات الإضافية المطلوبة) ---');

    // 1. Socket.io Branch Isolation
    await test('Socket.io: Staff of Branch B does NOT receive events emitted for Branch A', async () => {
      const clientA: ClientSocket = ioClient(socketUrl, {
        auth: { token: `Bearer ${tokenStaffB1}` },
        transports: ['websocket'],
        forceNew: true,
      });

      const clientB: ClientSocket = ioClient(socketUrl, {
        auth: { token: `Bearer ${tokenStaffB2}` },
        transports: ['websocket'],
        forceNew: true,
      });

      await Promise.all([
        new Promise<void>((resolve) => clientA.on('connect', () => resolve())),
        new Promise<void>((resolve) => clientB.on('connect', () => resolve())),
      ]);

      let clientAReceived = 0;
      let clientBReceived = 0;

      clientA.on('inventory:stock-updated', () => clientAReceived++);
      clientA.on('invoice:created', () => clientAReceived++);
      clientA.on('product:created', () => clientAReceived++);

      clientB.on('inventory:stock-updated', () => clientBReceived++);
      clientB.on('invoice:created', () => clientBReceived++);
      clientB.on('product:created', () => clientBReceived++);

      // Emit events targeting Branch B1
      broadcastStockUpdate({
        branchId: 'b1',
        items: [{ productId: prodB1.id, productName: prodB1.nameAr, newQuantity: 10, isOutOfStock: false }],
      });
      broadcastInvoiceCreated({ id: 'test_inv_socket', branchId: 'b1', total: 100 } as any);
      broadcastProductCreated({ id: 'test_prod_socket', branchId: 'b1', nameAr: 'socket test' } as any);

      // Wait 350ms for message propagation
      await new Promise((r) => setTimeout(r, 350));

      clientA.disconnect();
      clientB.disconnect();

      assert.strictEqual(clientAReceived, 3, 'Client of Branch A must receive all 3 events emitted to Branch A');
      assert.strictEqual(clientBReceived, 0, 'Client of Branch B must receive ZERO events emitted to Branch A');
    });

    // 2. Customer Search Isolation
    await test('Customer of Branch A does NOT appear in search query of Branch B', async () => {
      const res = await fetch(`${baseUrl}/customers`, {
        headers: { Authorization: `Bearer ${tokenStaffB2}` },
      });
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      const list = json.data || [];
      const foundPhone = list.find((c: any) => c.phone === custB1.phone);
      const foundName = list.find((c: any) => c.name === custB1.name);
      assert.strictEqual(foundPhone, undefined, 'Branch A customer phone must not appear in Branch B');
      assert.strictEqual(foundName, undefined, 'Branch A customer name must not appear in Branch B');
    });

    // 3. Isolated Quantity & Price Tier Modification
    await test('Modifying quantity and price tier of a product in Branch A does NOT affect Branch B', async () => {
      const res = await fetch(`${baseUrl}/products/branch-data`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenStaffB1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: sharedTestProd.id,
          branchId: 'b1',
          quantity: 12,
          price1: 180,
          cost: 40,
        }),
      });
      assert.strictEqual(res.status, 200);

      // Verify B1 updated
      const checkB1 = await pbdRepo.findOne({ where: { id: sharedPbdB1.id } });
      assert.strictEqual(Number(checkB1?.quantity), 12, 'Branch B1 quantity must be updated to 12');
      assert.strictEqual(Number(checkB1?.price1), 180, 'Branch B1 price1 must be updated to 180');

      // Verify B2 untouched
      const checkB2 = await pbdRepo.findOne({ where: { id: sharedPbdB2.id } });
      assert.strictEqual(Number(checkB2?.quantity), 20, 'Branch B2 quantity must remain untouched at 20');
      assert.strictEqual(Number(checkB2?.price1), 80, 'Branch B2 price1 must remain untouched at 80');
    });

    // 4. Dashboard, Reports, and Profits Calculated Strictly Per-Branch
    await test('Reports summary for an empty branch (b3) returns zero sales, zero profit, zero invoices', async () => {
      const res = await fetch(`${baseUrl}/invoices/reports-summary`, {
        headers: { Authorization: `Bearer ${tokenStaffB3}` },
      });
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      const data = json.data;
      assert.strictEqual(Number(data.totalSales || 0), 0, 'Empty branch total sales must be 0');
      assert.strictEqual(Number(data.netProfit || 0), 0, 'Empty branch net profit must be 0');
      assert.strictEqual(Number(data.invoicesCount || 0), 0, 'Empty branch invoices count must be 0');
    });

    // 5. New Branch Without Products Opens Empty
    await test('New branch without products (b3) opens empty with 0 products', async () => {
      const res = await fetch(`${baseUrl}/products`, {
        headers: { Authorization: `Bearer ${tokenStaffB3}` },
      });
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      const list = Array.isArray(json.data) ? json.data : (json.data?.data || []);
      assert.strictEqual(list.length, 0, 'Branch with no products must return 0 products');
    });

  } finally {
    console.log('\n--- Cleaning Up Temporary Test Fixtures in test_isolation ---');
    try {
      if (createdIds.invoices.length > 0) {
        await AppDataSource.query(`DELETE FROM test_isolation.invoice_items WHERE "invoiceId" = ANY($1)`, [createdIds.invoices]);
        await AppDataSource.query(`DELETE FROM test_isolation.invoices WHERE id = ANY($1)`, [createdIds.invoices]);
      }
      if (createdIds.physicalItems.length > 0) {
        await AppDataSource.query(`DELETE FROM test_isolation.physical_items WHERE id = ANY($1)`, [createdIds.physicalItems]);
      }
      if (createdIds.compositions.length > 0) {
        await AppDataSource.query(`DELETE FROM test_isolation.product_compositions WHERE id = ANY($1)`, [createdIds.compositions]);
      }
      if (createdIds.fixedExpenses.length > 0) {
        await AppDataSource.query(`DELETE FROM test_isolation.fixed_expenses WHERE id = ANY($1)`, [createdIds.fixedExpenses]);
      }
      if (createdIds.suppliers.length > 0) {
        await AppDataSource.query(`DELETE FROM test_isolation.suppliers WHERE id = ANY($1)`, [createdIds.suppliers]);
      }
      if (createdIds.customers.length > 0) {
        await AppDataSource.query(`DELETE FROM test_isolation.customers WHERE id = ANY($1) OR id LIKE 'test_%' OR phone IN ('01011112222', '01033334444')`, [createdIds.customers]);
      }
      if (createdIds.products.length > 0) {
        await AppDataSource.query(`DELETE FROM test_isolation.product_branch_data WHERE "productId" = ANY($1)`, [createdIds.products]);
        await AppDataSource.query(`DELETE FROM test_isolation.products WHERE id = ANY($1)`, [createdIds.products]);
      }
      if (createdIds.categories.length > 0) {
        await AppDataSource.query(`DELETE FROM test_isolation.categories WHERE id = ANY($1)`, [createdIds.categories]);
      }
      console.log('Cleanup completed successfully in test_isolation.');
    } catch (cleanErr: any) {
      console.warn('Warning during cleanup:', cleanErr.message);
    }

    console.log('\n--- VERIFYING PUBLIC SCHEMA INTEGRITY (BEFORE VS AFTER TEST RUN) ---');
    console.log('--------------------------------------------------------------------------------');
    console.log('| Table Name           | Before Run | After Run  | Delta | Status              |');
    console.log('--------------------------------------------------------------------------------');
    let integrityCheckPassed = true;
    for (const t of monitoredTables) {
      const r = await AppDataSource.query(`SELECT COUNT(*)::int AS cnt FROM public."${t}"`);
      const after = r[0].cnt;
      const before = publicCountsBefore[t];
      const delta = after - before;
      const status = delta === 0 ? '✅ 100% UNTOUCHED' : '❌ MODIFIED!';
      if (delta !== 0) integrityCheckPassed = false;
      console.log(`| ${t.padEnd(20)} | ${String(before).padStart(10)} | ${String(after).padStart(10)} | ${String(delta).padStart(5)} | ${status.padEnd(19)} |`);
    }
    console.log('--------------------------------------------------------------------------------');
    if (!integrityCheckPassed) {
      console.error('❌ CRITICAL INTEGRITY FAILURE: Public schema was modified during test run!');
      failed++;
    } else {
      console.log('✅ VERIFIED: Public schema row counts are 100% identical before and after.\n');
    }

    server.close();
  }

  console.log('\n========================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================================\n');

  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(failed > 0 ? 1 : 0);
}

// Run if executed directly
if (require.main === module) {
  runBranchIsolationTests().catch((err) => {
    console.error('Fatal Test Runner Error:', err);
    process.exit(1);
  });
}

export { runBranchIsolationTests };
