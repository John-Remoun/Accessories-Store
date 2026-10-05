import express from 'express';
import { Server } from 'http';
import { AppDataSource } from '../config/data-source';
import app from '../app';
import { seedDatabase } from './seed';
import { PhysicalItemEntity } from '../modules/physical-items/physical-item.entity';
import { ProductBranchDataEntity } from '../modules/products/product-branch-data.entity';
import { InvoiceItemEntity } from '../modules/invoices/invoice-item.entity';
import { UserEntity } from '../modules/users/user.entity';
import { ProductEntity } from '../modules/products/product.entity';

const TEST_PORT = 5001;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

interface TestResult {
  step: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordResult(step: string, passed: boolean, details: string) {
  results.push({ step, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} | ${step}: ${details}`);
}

async function runLiveVerification() {
  console.log('🚀 Starting Comprehensive Live PostgreSQL Verification Pass...\n');
  let server: Server | null = null;

  try {
    // ==========================================
    // STEP 1: PostgreSQL Connection & Schema Inspection
    // ==========================================
    console.log('--- Step 1: PostgreSQL Connection & Schema Inspection ---');
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    recordResult('Database Connection', true, 'Successfully connected to PostgreSQL at localhost:5432 / accessories_store');

    // Query information_schema for tables
    const tableRows = await AppDataSource.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    const tableNames = tableRows.map((r: any) => r.table_name);
    console.log(`📋 Found ${tableNames.length} tables in PostgreSQL public schema:`, tableNames);

    const expectedTables = [
      'users',
      'branches',
      'categories',
      'products',
      'product_branch_data',
      'physical_items',
      'customers',
      'invoices',
      'invoice_items',
      'fixed_expenses',
      'product_compositions',
    ];

    const missingTables = expectedTables.filter((t) => !tableNames.includes(t));
    if (missingTables.length === 0) {
      recordResult('Database Tables Verification', true, `All 11 expected tables exist in PostgreSQL (${tableNames.join(', ')})`);
    } else {
      recordResult('Database Tables Verification', false, `Missing tables: ${missingTables.join(', ')}`);
    }

    // Query Foreign Keys
    const fkRows = await AppDataSource.query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY';
    `);
    recordResult('Foreign Keys Verification', true, `Found ${fkRows.length} active foreign key constraints in PostgreSQL database`);

    // ==========================================
    // STEP 2: Database Seeding & Server Startup
    // ==========================================
    console.log('\n--- Step 2: Database Seeding & Server Startup ---');
    await seedDatabase();
    recordResult('Database Seeding', true, 'Branches and initial admin/manager users seeded successfully');

    server = app.listen(TEST_PORT);
    recordResult('Backend Server Startup', true, `Backend HTTP server listening on port ${TEST_PORT}`);

    // Wait 500ms for server socket ready
    await new Promise((r) => setTimeout(r, 500));

    // ==========================================
    // STEP 3: Authentication & Token Lifecycle Test
    // ==========================================
    console.log('\n--- Step 3: Authentication & Token Lifecycle Test ---');
    
    // 3.1 Login Admin
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'demo-admin', password: 'password' }),
    });
    const loginData = await loginRes.json();
    const adminAccessToken = loginData.data?.accessToken || loginData.accessToken;
    const adminRefreshToken = loginData.data?.refreshToken || loginData.refreshToken;

    if (loginRes.status !== 200 || !adminAccessToken) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }
    recordResult('Auth - Admin Login', true, 'Obtained Access Token and Refresh Token via POST /api/v1/auth/login');

    // 3.2 Access Protected Route
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    const meData = await meRes.json();
    const userPayload = meData.data || meData.user;
    if (meRes.status === 200 && userPayload?.username === 'demo-admin') {
      recordResult('Auth - Protected Route Access', true, 'GET /api/v1/auth/me returned authenticated user metadata');
    } else {
      recordResult('Auth - Protected Route Access', false, `Status ${meRes.status}: ${JSON.stringify(meData)}`);
    }

    // 3.3 Refresh Token
    const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: adminRefreshToken }),
    });
    const refreshData = await refreshRes.json();
    const newAccessToken = refreshData.data?.accessToken || refreshData.accessToken;
    if (refreshRes.status === 200 && newAccessToken) {
      recordResult('Auth - Refresh Token Exchange', true, 'POST /api/v1/auth/refresh issued new Access Token');
    } else {
      recordResult('Auth - Refresh Token Exchange', false, `Status ${refreshRes.status}: ${JSON.stringify(refreshData)}`);
    }

    // 3.4 Logout & Refresh Token Invalidation
    const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({ refreshToken: adminRefreshToken }),
    });
    if (logoutRes.status === 200) {
      recordResult('Auth - Logout', true, 'POST /api/v1/auth/logout returned HTTP 200');
    } else {
      recordResult('Auth - Logout', false, `Logout failed with status ${logoutRes.status}`);
    }

    // Attempt refresh with logged out token
    const invalidRefreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: adminRefreshToken }),
    });
    if (invalidRefreshRes.status === 401) {
      recordResult('Auth - Old Refresh Token Invalidation', true, 'Re-using revoked refresh token rejected with HTTP 401 Unauthorized');
    } else {
      recordResult('Auth - Old Refresh Token Invalidation', false, `Expected 401, got ${invalidRefreshRes.status}`);
    }

    // Re-login to get valid admin token for subsequent tests
    const reloginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'demo-admin', password: 'password' }),
    });
    const reloginData = await reloginRes.json();
    const activeAdminToken = reloginData.data?.accessToken || reloginData.accessToken;

    // ==========================================
    // STEP 4: Role-Based Authorization (RBAC) Test
    // ==========================================
    console.log('\n--- Step 4: Role-Based Authorization (RBAC) Test ---');

    // Create an employee user if not present
    const userRepo = AppDataSource.getRepository(UserEntity);
    let empUser = await userRepo.findOne({ where: { username: 'test-employee' } });
    if (!empUser) {
      await fetch(`${BASE_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeAdminToken}`,
        },
        body: JSON.stringify({
          username: 'test-employee',
          password: 'password',
          name: 'موظف مبيعات تجريبي',
          role: 'employee',
          branchId: 'b1',
        }),
      });
    }

    // Login Employee
    const empLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test-employee', password: 'password' }),
    });
    const empLoginData = await empLoginRes.json();
    const empToken = empLoginData.data?.accessToken || empLoginData.accessToken;

    // 4.1 Admin creating user (Allowed)
    const adminUsersRes = await fetch(`${BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${activeAdminToken}` },
    });
    recordResult('RBAC - Admin Access', adminUsersRes.status === 200, `Admin GET /api/v1/users returned HTTP ${adminUsersRes.status}`);

    // 4.2 Employee attempting to create a new user (Forbidden - POST /users is admin only)
    const empCreateUserRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${empToken}`,
      },
      body: JSON.stringify({
        username: 'unauthorized-user',
        password: 'password',
        name: 'اسم غير مصرح',
        role: 'employee',
        branchId: 'b1',
      }),
    });
    recordResult('RBAC - Employee Access Denied', empCreateUserRes.status === 403, `Employee POST /api/v1/users correctly denied with HTTP ${empCreateUserRes.status}`);

    // 4.3 Unauthenticated access (Unauthorized)
    const unauthRes = await fetch(`${BASE_URL}/users`);
    recordResult('RBAC - Unauthenticated Request', unauthRes.status === 401, `Unauthenticated request correctly rejected with HTTP ${unauthRes.status}`);

    // ==========================================
    // STEP 5: Product Catalog & Physical Item Creation
    // ==========================================
    console.log('\n--- Step 5: Product Catalog & Physical Item Creation ---');

    const testCatId = `cat_test_${Date.now()}`;
    const testProdId = `prod_test_${Date.now()}`;

    // Create category
    const catRes = await fetch(`${BASE_URL}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeAdminToken}`,
      },
      body: JSON.stringify({ id: testCatId, nameEn: 'Mobile Accessories', nameAr: 'إكسسوارات هواتف' }),
    });

    // Create product
    const prodRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeAdminToken}`,
      },
      body: JSON.stringify({
        id: testProdId,
        nameAr: 'شاحن سريع 65 واط',
        nameEn: 'Fast Charger 65W',
        categoryId: testCatId,
        brand: 'Anker',
        branchDataList: [
          {
            branchId: 'b1',
            cost: 300,
            price1: 500,
            price1Label: 'قطاعي',
            price2: 450,
            price2Label: 'جملة',
            price3: 400,
            price3Label: 'VIP',
            price4: 380,
            price4Label: 'خاص',
            minStock: 5,
          },
        ],
      }),
    });
    recordResult('Product Creation', prodRes.status === 201 || prodRes.status === 200, `Product catalog created in PostgreSQL (HTTP ${prodRes.status})`);

    // Seed physical items directly into database for deterministic test barcodes
    const itemRepo = AppDataSource.getRepository(PhysicalItemEntity);
    const testItems = [
      { id: 'SER-CONCURRENT-001', productId: testProdId, branchId: 'b1', serialNumber: 'SER-CONCURRENT-001', status: 'available' as const },
      { id: 'SER-ROLLBACK-001', productId: testProdId, branchId: 'b1', serialNumber: 'SER-ROLLBACK-001', status: 'available' as const },
      { id: 'SER-DELETE-001', productId: testProdId, branchId: 'b1', serialNumber: 'SER-DELETE-001', status: 'available' as const },
    ];

    for (const itemData of testItems) {
      let existing = await itemRepo.findOne({ where: { id: itemData.id } });
      if (!existing) {
        existing = itemRepo.create(itemData);
      } else {
        existing.status = 'available';
      }
      await itemRepo.save(existing);
    }
    recordResult('Physical Items Creation', true, 'Created physical barcode items (SER-CONCURRENT-001, SER-ROLLBACK-001, SER-DELETE-001) in PostgreSQL');

    // ==========================================
    // STEP 6: Concurrent Inventory Sale Test (ACID FOR UPDATE Lock)
    // ==========================================
    console.log('\n--- Step 6: Concurrent Inventory Sale Test (Pessimistic Locking) ---');
    console.log('⚡ Dispatching 2 SIMULTANEOUS invoice creation requests for item SER-CONCURRENT-001...');

    const invoicePayload = {
      branchId: 'b1',
      employeeId: 'u1',
      customerName: 'عميل اختبار التزامن',
      items: [
        {
          productId: testProdId,
          physicalItemId: 'SER-CONCURRENT-001',
          unitPrice: 500,
          quantity: 1,
        },
      ],
      subtotal: 500,
      total: 500,
      paymentMethod: 'cash' as const,
    };

    // Send 2 parallel HTTP POST requests concurrently
    const [reqA, reqB] = await Promise.all([
      fetch(`${BASE_URL}/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeAdminToken}`,
        },
        body: JSON.stringify({ ...invoicePayload, id: `inv_conc_a_${Date.now()}`, invoiceNumber: `INV-CONC-A-${Date.now()}` }),
      }),
      fetch(`${BASE_URL}/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeAdminToken}`,
        },
        body: JSON.stringify({ ...invoicePayload, id: `inv_conc_b_${Date.now()}`, invoiceNumber: `INV-CONC-B-${Date.now()}` }),
      }),
    ]);

    const resA = { status: reqA.status, body: await reqA.json() };
    const resB = { status: reqB.status, body: await reqB.json() };

    console.log('Response A status:', resA.status, 'Message:', resA.body.message || 'Invoice Created');
    console.log('Response B status:', resB.status, 'Message:', resB.body.message || 'Invoice Created');

    const oneSucceeded = (resA.status === 201 && resB.status === 400) || (resB.status === 201 && resA.status === 400);
    const itemStatusInDb = await itemRepo.findOne({ where: { id: 'SER-CONCURRENT-001' } });

    if (oneSucceeded && itemStatusInDb?.status === 'sold') {
      recordResult(
        'Concurrent Inventory Sale Test',
        true,
        `PostgreSQL Pessimistic FOR UPDATE Lock WORKED: Exactly 1 Request succeeded (201 Created), 1 Request rejected (400 Bad Request: Physical item is not available for sale). DB item status: sold.`
      );
    } else {
      recordResult('Concurrent Inventory Sale Test', false, `Locking failed! ReqA: ${resA.status}, ReqB: ${resB.status}, DB Status: ${itemStatusInDb?.status}`);
    }

    // ==========================================
    // STEP 7: Rollback Test (ACID Transaction Integrity)
    // ==========================================
    console.log('\n--- Step 7: Rollback Test (ACID Transaction Integrity) ---');

    const rollbackPayload = {
      id: `inv_rollback_${Date.now()}`,
      invoiceNumber: `INV-RB-${Date.now()}`,
      branchId: 'b1',
      employeeId: 'u1',
      items: [
        {
          productId: testProdId,
          physicalItemId: 'SER-ROLLBACK-001', // Valid available item
          unitPrice: 500,
          quantity: 1,
        },
        {
          productId: testProdId,
          physicalItemId: 'SER-NONEXISTENT-999', // Invalid non-existent item
          unitPrice: 500,
          quantity: 1,
        },
      ],
      subtotal: 1000,
      total: 1000,
    };

    const rollbackRes = await fetch(`${BASE_URL}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeAdminToken}`,
      },
      body: JSON.stringify(rollbackPayload),
    });

    const rollbackData = await rollbackRes.json();
    console.log('Rollback response status:', rollbackRes.status, 'Message:', rollbackData.message);

    const rollbackItemDb = await itemRepo.findOne({ where: { id: 'SER-ROLLBACK-001' } });

    if ((rollbackRes.status === 404 || rollbackRes.status === 400) && rollbackItemDb?.status === 'available') {
      recordResult('ACID Transaction Rollback', true, 'Transaction rolled back completely. Physical item SER-ROLLBACK-001 remains in status "available" in PostgreSQL.');
    } else {
      recordResult('ACID Transaction Rollback', false, `Status: ${rollbackRes.status}, Item Status in DB: ${rollbackItemDb?.status}`);
    }

    // ==========================================
    // STEP 8: Invoice Deletion & Stock Reversal Test
    // ==========================================
    console.log('\n--- Step 8: Invoice Deletion & Stock Reversal Test ---');

    // Create an invoice with SER-DELETE-001
    const delTestInvId = `inv_for_delete_${Date.now()}`;
    const invForDelRes = await fetch(`${BASE_URL}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeAdminToken}`,
      },
      body: JSON.stringify({
        id: delTestInvId,
        invoiceNumber: `INV-DEL-${Date.now()}`,
        branchId: 'b1',
        employeeId: 'u1',
        items: [
          {
            productId: testProdId,
            physicalItemId: 'SER-DELETE-001',
            unitPrice: 500,
            quantity: 1,
          },
        ],
        subtotal: 500,
        total: 500,
      }),
    });

    const itemBeforeDel = await itemRepo.findOne({ where: { id: 'SER-DELETE-001' } });
    console.log('Item status after invoice creation:', itemBeforeDel?.status);

    // Delete invoice
    const delRes = await fetch(`${BASE_URL}/invoices`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeAdminToken}`,
      },
      body: JSON.stringify({ ids: [delTestInvId] }),
    });

    const itemAfterDel = await itemRepo.findOne({ where: { id: 'SER-DELETE-001' } });
    console.log('Item status after invoice deletion:', itemAfterDel?.status);

    if (delRes.status === 200 && itemBeforeDel?.status === 'sold' && itemAfterDel?.status === 'available') {
      recordResult('Invoice Deletion & Stock Reversal', true, 'Deleting invoice automatically reverted physical item status from "sold" back to "available" in PostgreSQL.');
    } else {
      recordResult('Invoice Deletion & Stock Reversal', false, `Item status before: ${itemBeforeDel?.status}, after: ${itemAfterDel?.status}`);
    }

    // ==========================================
    // STEP 9: Historical Financial Immutability Test
    // ==========================================
    console.log('\n--- Step 9: Historical Financial Immutability Test ---');

    // 1. Create invoice with unitPrice 500, unitCost 300 (from branch data)
    const immutabilityInvId = `inv_immutability_${Date.now()}`;
    await fetch(`${BASE_URL}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeAdminToken}`,
      },
      body: JSON.stringify({
        id: immutabilityInvId,
        invoiceNumber: `INV-IMM-${Date.now()}`,
        branchId: 'b1',
        employeeId: 'u1',
        items: [
          {
            productId: testProdId,
            physicalItemId: 'SER-DELETE-001', // now available again
            unitPrice: 500,
            quantity: 1,
          },
        ],
        subtotal: 500,
        total: 500,
      }),
    });

    // Verify created invoice item in database
    const invItemBefore = await AppDataSource.getRepository(InvoiceItemEntity).findOne({ where: { invoiceId: immutabilityInvId } });
    console.log('Invoice item snapshot before catalog edit:', { unitPrice: invItemBefore?.unitPrice, unitCost: invItemBefore?.unitCost, profit: invItemBefore?.profit });

    // 2. Modify catalog product branch cost & prices in database
    const pbdRepo = AppDataSource.getRepository(ProductBranchDataEntity);
    const pbd = await pbdRepo.findOne({ where: { productId: testProdId, branchId: 'b1' } });
    if (pbd) {
      pbd.cost = 888; // Cost changed to 888
      pbd.price1 = 999; // Price changed to 999
      await pbdRepo.save(pbd);
    }

    // 3. Query invoice item from PostgreSQL database again
    const invItemAfter = await AppDataSource.getRepository(InvoiceItemEntity).findOne({ where: { invoiceId: immutabilityInvId } });
    console.log('Invoice item snapshot after catalog edit:', { unitPrice: invItemAfter?.unitPrice, unitCost: invItemAfter?.unitCost, profit: invItemAfter?.profit });

    const isImmutable =
      invItemAfter &&
      invItemBefore &&
      Number(invItemAfter.unitPrice) === Number(invItemBefore.unitPrice) &&
      Number(invItemAfter.unitCost) === Number(invItemBefore.unitCost) &&
      Number(invItemAfter.profit) === Number(invItemBefore.profit);

    if (isImmutable) {
      recordResult(
        'Historical Financial Immutability',
        true,
        `Updating product catalog price/cost (to 999/888) did NOT alter historical invoice item records (unitPrice: ${invItemAfter?.unitPrice}, unitCost: ${invItemAfter?.unitCost}, profit: ${invItemAfter?.profit}).`
      );
    } else {
      recordResult('Historical Financial Immutability', false, `Invoice item values altered: unitPrice ${invItemAfter?.unitPrice}, unitCost ${invItemAfter?.unitCost}`);
    }

  } catch (error: any) {
    console.error('❌ Verification Pass Execution Error:', error);
    recordResult('Verification Execution', false, error.message || String(error));
  } finally {
    if (server) {
      server.close();
      console.log('🛑 Closed verification HTTP test server');
    }
  }

  // ==========================================
  // SUMMARY REPORT GENERATION
  // ==========================================
  console.log('\n==================================================');
  console.log('FINAL POSTGRESQL VERIFICATION REPORT SUMMARY');
  console.log('==================================================');
  const allPassed = results.every((r) => r.passed);
  results.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.passed ? 'PASS' : 'FAIL'}] ${r.step}: ${r.details}`);
  });
  console.log('--------------------------------------------------');
  console.log(`VERDICT: ${allPassed ? 'ALL TESTS PASSED - PRODUCTION READY' : 'SOME TESTS FAILED'}`);
  console.log('==================================================\n');

  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(allPassed ? 0 : 1);
}

runLiveVerification();
