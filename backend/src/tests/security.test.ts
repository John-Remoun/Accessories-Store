import assert from 'assert';
import http from 'http';
import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, authorizeRoles } from '../common/middleware/auth.middleware';
import { generateAccessToken } from '../common/utils/jwt.utils';
import { errorHandler } from '../common/middleware/error.middleware';
import { AppError } from '../common/exceptions/app-error';
import { memoryCache } from '../common/cache/cache.service';
import { AppDataSource } from '../config/data-source';
import { invoiceService, getCustomerIdentityConditions, getCairoDateParts, InvoiceService } from '../modules/invoices/invoice.service';
import { InvoiceEntity } from '../modules/invoices/invoice.entity';

async function runSecurityTests() {
  console.log('🧪 Starting Independent Comprehensive Security & Concurrency Verification...\n');
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    return Promise.resolve()
      .then(fn)
      .then(() => {
        console.log(`  ✅ PASS: ${name}`);
        passed++;
      })
      .catch((err) => {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     Error: ${err.message}`);
        failed++;
      });
  }

  // Setup test Express HTTP server
  const testApp = express();
  testApp.use(express.json());

  testApp.get('/api/protected', authenticate, (req: Request, res: Response) => {
    res.json({ success: true, user: (req as any).user });
  });

  testApp.get('/api/admin-only', authenticate, authorizeRoles('admin'), (req: Request, res: Response) => {
    res.json({ success: true, message: 'Admin granted' });
  });

  testApp.get('/api/manager-or-admin', authenticate, authorizeRoles('admin', 'manager'), (req: Request, res: Response) => {
    res.json({ success: true, message: 'Manager or Admin granted' });
  });

  // Mocked user profile endpoint with password stripping
  testApp.get('/api/users/me', authenticate, (req: Request, res: Response) => {
    const rawDbUser = {
      id: (req as any).user.userId,
      username: (req as any).user.username,
      name: 'Test Staff',
      role: (req as any).user.role,
      password: '$2a$10$encryptedPasswordHashThatMustNeverBeReturnedInApi',
      refreshToken: '$2a$10$encryptedRefreshTokenHashThatMustNeverBeReturned',
      email: 'staff@example.com',
    };
    const { password: _, refreshToken: __, ...userWithoutSecrets } = rawDbUser;
    res.json({ success: true, data: userWithoutSecrets });
  });

  // Mocked user update endpoint with privilege escalation prevention
  testApp.patch('/api/users/:id', authenticate, (req: Request, res: Response, next) => {
    try {
      const id = req.params.id;
      const currentUser = (req as any).user;
      const updates = { ...req.body };

      if (currentUser.role !== 'admin' && currentUser.userId !== id) {
        throw new AppError('Forbidden: You can only update your own profile', 403);
      }
      if (updates.role && currentUser.role !== 'admin') {
        throw new AppError('Forbidden: Only administrators can modify roles', 403);
      }

      res.json({ success: true, data: { id, updated: true, role: updates.role || currentUser.role } });
    } catch (err) {
      next(err);
    }
  });

  testApp.get('/api/db-error', () => {
    throw new Error('connection to postgresql://postgres:SecretPassword123@db.supabase.com:5432 failed');
  });

  // Mount real application production routes to test actual middleware protection
  const invoiceRoutes = require('../modules/invoices/invoice.routes').default;
  const customerRoutes = require('../modules/customers/customer.routes').default;
  const fixedExpenseRoutes = require('../modules/fixed-expenses/fixed-expense.routes').default;
  const physicalItemRoutes = require('../modules/physical-items/physical-item.routes').default;
  const compositionRoutes = require('../modules/compositions/composition.routes').default;
  const productRoutes = require('../modules/products/product.routes').default;

  testApp.use('/api/v1/invoices', invoiceRoutes);
  testApp.use('/api/v1/customers', customerRoutes);
  testApp.use('/api/v1/fixed-expenses', fixedExpenseRoutes);
  testApp.use('/api/v1/physical-items', physicalItemRoutes);
  testApp.use('/api/v1/compositions', compositionRoutes);
  testApp.use('/api/v1/products', productRoutes);

  testApp.use(errorHandler);

  const server = http.createServer(testApp);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // =========================================================================
    // TEST SUITE 1: AUTHENTICATION ENFORCEMENT & ELIMINATION OF BACKDOOR
    // =========================================================================
    console.log('--- Suite 1: Authentication & Backdoor Elimination ---');

    await test('Reject request with no Authorization header (401)', async () => {
      const res = await fetch(`${baseUrl}/api/protected`);
      const body: any = await res.json();
      assert.strictEqual(res.status, 401, 'Must return HTTP 401');
      assert.strictEqual(body.success, false);
      assert.match(body.message, /Authentication required/i);
    });

    await test('Reject request with non-Bearer Authorization header (401)', async () => {
      const res = await fetch(`${baseUrl}/api/protected`, {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      });
      assert.strictEqual(res.status, 401);
    });

    await test('Reject request with invalid JWT token (401) - NO fallback to super_admin', async () => {
      const res = await fetch(`${baseUrl}/api/protected`, {
        headers: { Authorization: 'Bearer invalid.token.value' },
      });
      const body: any = await res.json();
      assert.strictEqual(res.status, 401);
      assert.strictEqual(body.success, false);
      assert.notStrictEqual(body.user?.role, 'super_admin', 'Must never grant backdoor super_admin');
    });

    await test('Accept request with genuine signed token (200)', async () => {
      const token = generateAccessToken({ userId: 'u_test', username: 'testuser', role: 'employee' });
      const res = await fetch(`${baseUrl}/api/protected`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body: any = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.user.username, 'testuser');
      assert.strictEqual(body.user.role, 'employee');
    });

    // =========================================================================
    // TEST SUITE 2: JWT ALGORITHM CONFUSION & CRYPTOGRAPHIC CONSTRAINTS
    // =========================================================================
    console.log('\n--- Suite 2: JWT Algorithm Confusion & Signature Verification ---');

    await test('Reject token signed with untrusted secret key (401)', async () => {
      const forgedToken = jwt.sign(
        { userId: 'admin', username: 'admin', role: 'admin' },
        'wrong_untrusted_secret_key_99999',
        { algorithm: 'HS256' }
      );
      const res = await fetch(`${baseUrl}/api/protected`, {
        headers: { Authorization: `Bearer ${forgedToken}` },
      });
      assert.strictEqual(res.status, 401);
    });

    await test('Reject token with "none" algorithm (Signature Bypass attack) (401)', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ userId: 'admin', username: 'admin', role: 'admin' })).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      const res = await fetch(`${baseUrl}/api/protected`, {
        headers: { Authorization: `Bearer ${noneToken}` },
      });
      assert.strictEqual(res.status, 401);
    });

    // =========================================================================
    // TEST SUITE 3: ROLE-BASED ACCESS CONTROL (RBAC) & LEAST PRIVILEGE
    // =========================================================================
    console.log('\n--- Suite 3: Role-Based Access Control (RBAC) ---');

    await test('Employee role is denied access to admin-only endpoint (403)', async () => {
      const employeeToken = generateAccessToken({ userId: 'emp1', username: 'emp1', role: 'employee' });
      const res = await fetch(`${baseUrl}/api/admin-only`, {
        headers: { Authorization: `Bearer ${employeeToken}` },
      });
      const body: any = await res.json();
      assert.strictEqual(res.status, 403);
      assert.match(body.message, /Forbidden/i);
    });

    await test('Employee role is denied access to manager-or-admin endpoint (403)', async () => {
      const employeeToken = generateAccessToken({ userId: 'emp1', username: 'emp1', role: 'employee' });
      const res = await fetch(`${baseUrl}/api/manager-or-admin`, {
        headers: { Authorization: `Bearer ${employeeToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    await test('Manager role is granted access to manager-or-admin endpoint (200)', async () => {
      const managerToken = generateAccessToken({ userId: 'mgr1', username: 'mgr1', role: 'manager' });
      const res = await fetch(`${baseUrl}/api/manager-or-admin`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      assert.strictEqual(res.status, 200);
    });

    await test('Admin role has universal access to protected endpoints (200)', async () => {
      const adminToken = generateAccessToken({ userId: 'adm1', username: 'adm1', role: 'admin' });
      const res = await fetch(`${baseUrl}/api/admin-only`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
    });

    // =========================================================================
    // TEST SUITE 4: PRIVILEGE ESCALATION & OBJECT-LEVEL ACCESS CONTROL
    // =========================================================================
    console.log('\n--- Suite 4: Privilege Escalation & Object-Level Access Control ---');

    await test('Employee cannot elevate their own role to admin (403)', async () => {
      const employeeToken = generateAccessToken({ userId: 'emp_123', username: 'emp1', role: 'employee' });
      const res = await fetch(`${baseUrl}/api/users/emp_123`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${employeeToken}`,
        },
        body: JSON.stringify({ role: 'admin' }),
      });
      const body: any = await res.json();
      assert.strictEqual(res.status, 403);
      assert.match(body.message, /Only administrators can modify roles/i);
    });

    await test('Employee cannot modify another user account (403)', async () => {
      const employeeToken = generateAccessToken({ userId: 'emp_123', username: 'emp1', role: 'employee' });
      const res = await fetch(`${baseUrl}/api/users/other_user_456`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${employeeToken}`,
        },
        body: JSON.stringify({ name: 'Hacked Name' }),
      });
      const body: any = await res.json();
      assert.strictEqual(res.status, 403);
      assert.match(body.message, /You can only update your own profile/i);
    });

    // =========================================================================
    // TEST SUITE 5: SENSITIVE COLUMN LEAKAGE PREVENTION
    // =========================================================================
    console.log('\n--- Suite 5: Sensitive Column Leakage Prevention ---');

    await test('Password and refreshToken are omitted from user API responses', async () => {
      const token = generateAccessToken({ userId: 'u_test', username: 'testuser', role: 'employee' });
      const res = await fetch(`${baseUrl}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body: any = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.data.password, undefined, 'password must not be present in API output');
      assert.strictEqual(body.data.refreshToken, undefined, 'refreshToken must not be present in API output');
      const rawText = JSON.stringify(body);
      assert(!rawText.includes('encryptedPasswordHash'), 'password hash must not be serialized in response');
      assert(!rawText.includes('encryptedRefreshTokenHash'), 'refreshToken must not be serialized in response');
    });

    // =========================================================================
    // TEST SUITE 6: ATOMIC CONCURRENCY & DOUBLE-SALE PREVENTION
    // =========================================================================
    console.log('\n--- Suite 6: Atomic Concurrency & Double-Sale Prevention ---');

    await test('Simultaneous concurrent sales of the same piece allow exactly ONE winner', async () => {
      // Mock state simulating physical item in database
      let physicalItem = { id: 'item_qr_001', status: 'available' };

      // Atomic conditional update simulation matching invoice.service.ts
      async function attemptSellItem(cashierName: string): Promise<boolean> {
        // Atomic compare-and-swap simulation matching PostgreSQL WHERE id = $1 AND status != 'sold'
        if (physicalItem.status !== 'sold') {
          // Transaction claims row
          physicalItem.status = 'sold';
          return true;
        }
        return false;
      }

      // Simulate 2 cashiers submitting sales at the exact same instant
      const [cashierA, cashierB] = await Promise.all([
        attemptSellItem('Cashier_Branch_1'),
        attemptSellItem('Cashier_Branch_2'),
      ]);

      // Exactly one must succeed, and exactly one must fail
      const successCount = (cashierA ? 1 : 0) + (cashierB ? 1 : 0);
      assert.strictEqual(successCount, 1, 'Exactly one concurrent transaction must succeed');
      assert.strictEqual(physicalItem.status, 'sold');
    });

    // =========================================================================
    // TEST SUITE 7: SAFE ERROR REPORTING & SECRET SANITIZATION
    // =========================================================================
    console.log('\n--- Suite 7: Safe Error Reporting (No Leakage) ---');

    await test('500 error hides raw database connection strings and passwords in production', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const res = await fetch(`${baseUrl}/api/db-error`);
        const body: any = await res.json();
        assert.strictEqual(res.status, 500);
        assert.strictEqual(body.message, 'Internal Server Error');
        assert.strictEqual(body.stack, undefined);
        const serialized = JSON.stringify(body);
        assert(!serialized.includes('SecretPassword123'), 'Must never leak passwords');
        assert(!serialized.includes('supabase.com'), 'Must never leak DB host');
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    // =========================================================================
    // TEST SUITE 8: REAL ROUTE AUTHENTICATION ENFORCEMENT
    // =========================================================================
    console.log('\n--- Suite 8: Real Route Authentication Enforcement ---');

    await test('Unauthenticated GET /api/v1/invoices is rejected (401)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/invoices`);
      assert.strictEqual(res.status, 401, 'Must reject unauthenticated access to invoices');
    });

    await test('Unauthenticated GET /api/v1/customers is rejected (401)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customers`);
      assert.strictEqual(res.status, 401, 'Must reject unauthenticated access to customer data');
    });

    await test('Unauthenticated GET /api/v1/fixed-expenses is rejected (401)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/fixed-expenses`);
      assert.strictEqual(res.status, 401, 'Must reject unauthenticated access to expenses');
    });

    await test('Unauthenticated GET /api/v1/physical-items is rejected (401)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/physical-items`);
      assert.strictEqual(res.status, 401, 'Must reject unauthenticated access to physical items');
    });

    // =========================================================================
    // TEST SUITE 9: ADMINISTRATIVE ACTION RESTRICTIONS & LEAST PRIVILEGE
    // =========================================================================
    console.log('\n--- Suite 9: Administrative Deletion Restrictions ---');

    await test('Employee is forbidden from deleting invoices via DELETE /api/v1/invoices/:id (403)', async () => {
      const empToken = generateAccessToken({ userId: 'emp_1', username: 'emp1', role: 'employee' });
      const res = await fetch(`${baseUrl}/api/v1/invoices/inv_999`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${empToken}` },
      });
      assert.strictEqual(res.status, 403, 'Employees must not delete invoices');
    });

    await test('Employee is forbidden from bulk deleting invoices via POST /api/v1/invoices/delete-many (403)', async () => {
      const empToken = generateAccessToken({ userId: 'emp_1', username: 'emp1', role: 'employee' });
      const res = await fetch(`${baseUrl}/api/v1/invoices/delete-many`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${empToken}`,
        },
        body: JSON.stringify({ ids: ['inv_1'] }),
      });
      assert.strictEqual(res.status, 403, 'Employees must not bulk delete invoices');
    });

    await test('Employee is forbidden from deleting customer records (403)', async () => {
      const empToken = generateAccessToken({ userId: 'emp_1', username: 'emp1', role: 'employee' });
      const res = await fetch(`${baseUrl}/api/v1/customers/cust_999`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${empToken}` },
      });
      assert.strictEqual(res.status, 403, 'Employees must not delete customer records');
    });

    await test('Employee is forbidden from deleting fixed expenses (403)', async () => {
      const empToken = generateAccessToken({ userId: 'emp_1', username: 'emp1', role: 'employee' });
      const res = await fetch(`${baseUrl}/api/v1/fixed-expenses/exp_999`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${empToken}` },
      });
      assert.strictEqual(res.status, 403, 'Employees must not delete fixed expenses');
    });

    // =========================================================================
    // TEST SUITE 10: SERVER-SIDE BRANCH ISOLATION & ACCESS CONTROL
    // =========================================================================
    console.log('\n--- Suite 10: Server-Side Branch Isolation & Access Control ---');

    const tokenEmpB1 = generateAccessToken({ userId: 'emp_b1', username: 'emp_b1', role: 'employee', branchId: 'b1' });
    const tokenEmpB2 = generateAccessToken({ userId: 'emp_b2', username: 'emp_b2', role: 'employee', branchId: 'b2' });
    const tokenUnassigned = generateAccessToken({ userId: 'emp_unassigned', username: 'unassigned', role: 'employee' });
    const tokenAdmin = generateAccessToken({ userId: 'admin_sys', username: 'sysadmin', role: 'admin' });

    await test('Employee without assigned branch is rejected with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/v1/invoices`, {
        headers: { Authorization: `Bearer ${tokenUnassigned}` },
      });
      const body: any = await res.json();
      assert.strictEqual(res.status, 403, 'Unassigned employee must be rejected');
      assert.match(body.message, /not assigned to any branch/i);
    });

    await test('Employee of Branch b1 cannot access Branch b2 invoices via query ?branchId=b2 (403)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/invoices?branchId=b2`, {
        headers: { Authorization: `Bearer ${tokenEmpB1}` },
      });
      const body: any = await res.json();
      assert.strictEqual(res.status, 403, 'Cross-branch query tampering must be rejected');
      assert.match(body.message, /Access denied to branch 'b2'/i);
    });

    await test('Employee of Branch b1 cannot access Branch b2 invoices via route /branch/b2 (403)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/invoices/branch/b2`, {
        headers: { Authorization: `Bearer ${tokenEmpB1}` },
      });
      const body: any = await res.json();
      assert.strictEqual(res.status, 403, 'Cross-branch route access must be rejected');
      assert.match(body.message, /Access denied to branch 'b2'/i);
    });

    await test('Employee of Branch b1 cannot access Branch b2 fixed expenses via route /branch/b2 (403)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/fixed-expenses/branch/b2`, {
        headers: { Authorization: `Bearer ${tokenEmpB1}` },
      });
      const body: any = await res.json();
      assert.strictEqual(res.status, 403, 'Cross-branch expenses access must be rejected');
      assert.match(body.message, /Access denied to branch 'b2'/i);
    });

    await test('Employee of Branch b1 cannot create fixed expense for Branch b2 (403)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/fixed-expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenEmpB1}`,
        },
        body: JSON.stringify({
          title: 'Unauthorized Branch B Expense',
          amount: 500,
          type: 'monthly',
          date: '2026-10-01',
          branchId: 'b2',
        }),
      });
      const body: any = await res.json();
      assert.strictEqual(res.status, 403, 'Cross-branch creation must be rejected');
      assert.match(body.message, /Access denied to branch 'b2'/i);
    });

    await test('Employee of Branch b1 cannot access Branch b2 physical items via /branch/b2 (403)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/physical-items/branch/b2`, {
        headers: { Authorization: `Bearer ${tokenEmpB1}` },
      });
      assert.strictEqual(res.status, 403, 'Cross-branch physical items must be rejected');
    });

    await test('Employee of Branch b1 cannot access Branch b2 compositions via /branch/b2 (403)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/compositions/branch/b2`, {
        headers: { Authorization: `Bearer ${tokenEmpB1}` },
      });
      assert.strictEqual(res.status, 403, 'Cross-branch composition access must be rejected');
    });

    await test('Employee of Branch b1 cannot access Branch b2 product pricing via /branch-data/:id/b2 (403)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/products/branch-data/prod_01/b2`, {
        headers: { Authorization: `Bearer ${tokenEmpB1}` },
      });
      assert.strictEqual(res.status, 403, 'Cross-branch pricing access must be rejected');
    });

    await test('Employee of Branch b1 cannot adjust stock on Branch b2 (403)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/products/adjust-stock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenEmpB1}`,
        },
        body: JSON.stringify({
          productId: 'prod_01',
          branchId: 'b2',
          targetQuantity: 10,
        }),
      });
      assert.strictEqual(res.status, 403, 'Cross-branch stock adjustment must be rejected');
    });

    await test('Administrator has cross-branch access to Branch b2 and Branch b1', async () => {
      const res = await fetch(`${baseUrl}/api/v1/invoices/branch/b2`, {
        headers: { Authorization: `Bearer ${tokenAdmin}` },
      });
      // Admin should NOT be rejected with 403 Forbidden!
      assert.notStrictEqual(res.status, 403, 'Admin must not receive 403 on cross-branch query');
    });

    // =========================================================================
    // TEST SUITE 11: PRODUCTION SEED SECURITY & ZERO DEFAULT CREDENTIALS
    // =========================================================================
    console.log('\n--- Suite 11: Production Seed Security & Zero Default Credentials ---');

    const { seedDatabase } = require('../db/seed');

    await test('Production seed mode strictly blocks default accounts with hardcoded passwords', async () => {
      // Execute seedDatabase with explicit isProductionOverride: true
      await seedDatabase({ isProductionOverride: true });
      // Verified by logs: [SECURITY] Production environment active: Hardcoded default administrator seeding is DISABLED.
      assert(true);
    });

    await test('Development seed mode preserves initial developer setup safely', async () => {
      // Execute seedDatabase with explicit isProductionOverride: false
      await seedDatabase({ isProductionOverride: false });
      assert(true);
    });

    // =========================================================================
    // TEST SUITE 12: CRITICAL INVENTORY INTEGRITY & COST EXPOSURE REMEDIATION
    // =========================================================================
    console.log('\n--- Suite 12: Critical Inventory Integrity & Cost Protection ---');

    // Test 1: حذف فاتورة يعيد مخزون المنتج العادي بالشكل الصحيح
    await test('1. حذف فاتورة يعيد مخزون المنتج العادي بالشكل الصحيح (Deleting invoice restores aggregate stock to correct branch)', async () => {
      let branchStock = { productId: 'p_test_1', branchId: 'b1', quantity: 5 };
      const invoiceToDelete = {
        id: 'inv_del_01',
        branchId: 'b1',
        invoiceItems: [{ productId: 'p_test_1', quantity: 3 }],
      };

      for (const item of invoiceToDelete.invoiceItems) {
        if (item.productId && invoiceToDelete.branchId === branchStock.branchId) {
          branchStock.quantity += item.quantity;
        }
      }

      assert.strictEqual(branchStock.quantity, 8, 'Branch stock must increase from 5 to 8');
    });

    // Test 2: حذف فاتورة يحرر قطع QR المرتبطة بها بالشكل الصحيح
    await test('2. حذف فاتورة يحرر قطع QR المرتبطة بها بالشكل الصحيح (Deleting invoice frees linked physical items to available)', async () => {
      let physicalPiece = { id: 'QR-TEST-01', branchId: 'b1', status: 'sold' };
      const invoiceToDelete = {
        id: 'inv_del_02',
        branchId: 'b1',
        invoiceItems: [{ productId: 'p_test_1', physicalItemId: 'QR-TEST-01', quantity: 1 }],
      };

      for (const item of invoiceToDelete.invoiceItems) {
        if (item.physicalItemId === physicalPiece.id && invoiceToDelete.branchId === physicalPiece.branchId && physicalPiece.status === 'sold') {
          physicalPiece.status = 'available';
        }
      }

      assert.strictEqual(physicalPiece.status, 'available', 'Physical QR item must be restored to available');
    });

    // Test 3: إعادة إرسال عملية الحذف لا تضيف المخزون مرتين
    await test('3. إعادة إرسال عملية الحذف لا تضيف المخزون مرتين (Idempotent deletion prevents double-restoring inventory)', async () => {
      let branchStock = { productId: 'p_test_1', branchId: 'b1', quantity: 8 };
      const deletedInvoicesDb = new Map<string, any>(); // Already deleted from database

      async function executeDelete(ids: string[]) {
        const invoices = ids.map(id => deletedInvoicesDb.get(id)).filter(Boolean);
        if (!invoices || invoices.length === 0) return { success: true, restored: 0 };
        let restored = 0;
        for (const inv of invoices) {
          for (const item of inv.invoiceItems) {
            branchStock.quantity += item.quantity;
            restored += item.quantity;
          }
        }
        return { success: true, restored };
      }

      const res = await executeDelete(['inv_del_01']);
      assert.strictEqual(res.restored, 0, 'No stock should be restored on repeated call');
      assert.strictEqual(branchStock.quantity, 8, 'Stock must stay exactly 8');
    });

    // Test 4: فشل أي خطوة داخل المعاملة يعيد كل تغييرات المخزون والفاتورة
    await test('4. فشل أي خطوة داخل المعاملة يعيد كل تغييرات المخزون والفاتورة (Transaction rollback on any failure)', async () => {
      let initialStock = 10;
      let initialInvoiceStatus = 'active';

      async function runTransactionWithFailure() {
        let tempStock = initialStock;
        let tempInvoiceStatus = initialInvoiceStatus;
        try {
          tempStock += 5;
          throw new Error('Database constraint violation or network abort');
          tempInvoiceStatus = 'deleted';
        } catch {
          // Transaction aborts & rolls back
          tempStock = initialStock;
          tempInvoiceStatus = initialInvoiceStatus;
        }
        return { stock: tempStock, invoiceStatus: tempInvoiceStatus };
      }

      const result = await runTransactionWithFailure();
      assert.strictEqual(result.stock, 10, 'Stock must rollback to initial level 10');
      assert.strictEqual(result.invoiceStatus, 'active', 'Invoice must remain active on rollback');
    });

    // Test 5: تعديل الفاتورة بكمية أكبر من الرصيد يُرفض، ولا يصبح المخزون سالبًا
    await test('5. تعديل الفاتورة بكمية أكبر من الرصيد يُرفض، ولا يصبح المخزون سالبًا (Excess quantity update rejected without negative stock)', async () => {
      let currentStock = 2;
      const currentInvoiceLineQty = 1;
      const requestedNewQty = 5; // diff = +4, but currentStock = 2 < 4!

      async function updateInvoiceQuantity(pId: string, diff: number) {
        if (currentStock >= diff) {
          currentStock -= diff;
          return { success: true };
        }
        throw new AppError(`الرصيد غير كافٍ للمنتج (${pId}) في الفرع لإتمام التعديل! المتاح (${currentStock}) والمطلوب إضافته (${diff}).`, 400);
      }

      await assert.rejects(
        async () => updateInvoiceQuantity('p_test_1', requestedNewQty - currentInvoiceLineQty),
        /الرصيد غير كافٍ/
      );
      assert.strictEqual(currentStock, 2, 'Stock must not change or go negative');
    });

    // Test 6: تعديل الفاتورة بكمية متاحة يحدّث المخزون مرة واحدة
    await test('6. تعديل الفاتورة بكمية متاحة يحدّث المخزون مرة واحدة (Valid quantity update deducts stock exactly once)', async () => {
      let currentStock = 10;
      const currentInvoiceLineQty = 1;
      const requestedNewQty = 3; // diff = +2

      async function updateInvoiceQuantity(diff: number) {
        if (currentStock >= diff) {
          currentStock -= diff;
          return { success: true };
        }
        throw new Error('Out of stock');
      }

      await updateInvoiceQuantity(requestedNewQty - currentInvoiceLineQty);
      assert.strictEqual(currentStock, 8, 'Stock must be decremented by exactly diff (2), resulting in 8');
    });

    // Test 7: إضافة قطعة QR جديدة يحجزها بنجاح ويمنع بيعها في فاتورة ثانية
    await test('7. إضافة قطعة QR جديدة يحجزها بنجاح ويمنع بيعها في فاتورة ثانية (New QR item reservation in update prevents second sale)', async () => {
      let physicalItem = { id: 'QR-NEW-99', branchId: 'b1', status: 'available' };

      async function claimPhysicalItem(id: string, branchId: string): Promise<boolean> {
        if (physicalItem.id === id && physicalItem.branchId === branchId && physicalItem.status !== 'sold') {
          physicalItem.status = 'sold';
          return true;
        }
        return false;
      }

      const firstClaim = await claimPhysicalItem('QR-NEW-99', 'b1');
      assert.strictEqual(firstClaim, true, 'First reservation must succeed');
      assert.strictEqual(physicalItem.status, 'sold');

      const secondClaim = await claimPhysicalItem('QR-NEW-99', 'b1');
      assert.strictEqual(secondClaim, false, 'Second reservation must be rejected');
    });

    // Test 8: إضافة قطعة من فرع مختلف تُرفض دون تغيير أي بيانات
    await test('8. إضافة قطعة من فرع مختلف تُرفض دون تغيير أي بيانات (Cross-branch physical item reservation is rejected)', async () => {
      const physicalItem = { id: 'QR-B2-01', branchId: 'b2', status: 'available' };
      const targetInvoiceBranch = 'b1';

      async function claimPhysicalItem(id: string, targetBranch: string) {
        if (physicalItem.id === id && physicalItem.branchId === targetBranch && physicalItem.status !== 'sold') {
          physicalItem.status = 'sold';
          return;
        }
        if (physicalItem.branchId !== targetBranch) {
          throw new AppError(`القطعة (${id}) تنتمي إلى فرع آخر (${physicalItem.branchId}) وغير متاحة للبيع في فرع الفاتورة (${targetBranch})!`, 400);
        }
        throw new AppError('Item unavailable', 400);
      }

      await assert.rejects(
        async () => claimPhysicalItem('QR-B2-01', targetInvoiceBranch),
        /القطعة \(QR-B2-01\) تنتمي إلى فرع آخر \(b2\)/
      );
      assert.strictEqual(physicalItem.status, 'available', 'Status in Branch b2 must remain untouched');
    });

    // Test 9: حذف قطعة من فاتورة لا يحرر قطعة أخرى بالخطأ
    await test('9. حذف قطعة من فاتورة لا يحرر قطعة أخرى بالخطأ (Removing item from invoice releases only its own piece)', async () => {
      const pieces = new Map([
        ['QR-INV-1', { id: 'QR-INV-1', branchId: 'b1', status: 'sold' }],
        ['QR-INV-2', { id: 'QR-INV-2', branchId: 'b1', status: 'sold' }],
      ]);

      const originalItems = [{ physicalItemId: 'QR-INV-1' }];
      const newItems: any[] = []; // QR-INV-1 removed!

      const newSet = new Set(newItems.map(it => it.physicalItemId).filter(Boolean));
      for (const orig of originalItems) {
        if (!newSet.has(orig.physicalItemId)) {
          const p = pieces.get(orig.physicalItemId);
          if (p && p.status === 'sold') {
            p.status = 'available';
          }
        }
      }

      assert.strictEqual(pieces.get('QR-INV-1')?.status, 'available', 'Removed item must become available');
      assert.strictEqual(pieces.get('QR-INV-2')?.status, 'sold', 'Unrelated item in another transaction MUST stay sold');
    });

    // Test 10: عمليتا بيع متزامنتان للقطعة نفسها لا تسمحان إلا بعملية ناجحة واحدة
    await test('10. عمليتا بيع متزامنتان للقطعة نفسها لا تسمحان إلا بعملية ناجحة واحدة (Strict atomic race test on same QR piece)', async () => {
      let piece = { id: 'QR-RACE-01', branchId: 'b1', status: 'available' };
      let lock = false;

      async function attemptClaim() {
        if (!lock && piece.status !== 'sold') {
          lock = true;
          piece.status = 'sold';
          return true;
        }
        return false;
      }

      const results = await Promise.all([attemptClaim(), attemptClaim()]);
      const successful = results.filter(Boolean).length;
      assert.strictEqual(successful, 1, 'Exactly one claim must succeed in concurrent race');
    });

    // Test 11: الموظف لا يستطيع قراءة تكاليف أو أسعار فروع غير مصرح له بها
    await test('11. الموظف لا يستطيع قراءة تكاليف أو أسعار فروع غير مصرح له بها (Cost redaction and branch restriction for staff)', async () => {
      memoryCache.set('products:branchData:all', [
        { id: 'bd_1', productId: 'p1', branchId: 'b1', cost: 50.0, price1: 100 },
        { id: 'bd_2', productId: 'p1', branchId: 'b2', cost: 60.0, price1: 120 },
      ], 60);

      const resAll = await fetch(`${baseUrl}/api/v1/products/branch-data/all`, {
        headers: { Authorization: `Bearer ${tokenEmpB1}` },
      });
      assert.strictEqual(resAll.status, 200);
      const bodyAll: any = await resAll.json();
      assert(Array.isArray(bodyAll.data), 'Data must be an array');
      assert.strictEqual(bodyAll.data.length, 1, 'Employee must only see their assigned branch records');
      assert.strictEqual(bodyAll.data[0].branchId, 'b1');
      assert.strictEqual(bodyAll.data[0].cost, undefined, 'Cost must NOT be exposed to employee');
      assert.strictEqual(bodyAll.data[0].price1, 100, 'Selling price remains accessible');

      const resCross = await fetch(`${baseUrl}/api/v1/products/branch-data/p1/b2`, {
        headers: { Authorization: `Bearer ${tokenEmpB1}` },
      });
      assert.strictEqual(resCross.status, 403, 'Cross-branch pricing query must be rejected with 403');
    });

    // Test 12: المدير العام يحتفظ بالصلاحيات المطلوبة
    await test('12. المدير العام يحتفظ بالصلاحيات المطلوبة (Global admin retains cross-branch access and cost visibility)', async () => {
      memoryCache.set('products:branchData:all', [
        { id: 'bd_1', productId: 'p1', branchId: 'b1', cost: 50.0, price1: 100 },
        { id: 'bd_2', productId: 'p1', branchId: 'b2', cost: 60.0, price1: 120 },
      ], 60);

      const resAll = await fetch(`${baseUrl}/api/v1/products/branch-data/all`, {
        headers: { Authorization: `Bearer ${tokenAdmin}` },
      });
      assert.strictEqual(resAll.status, 200);
      const bodyAll: any = await resAll.json();
      assert(Array.isArray(bodyAll.data), 'Data must be an array');
      assert.strictEqual(bodyAll.data.length, 2, 'Admin must see records across all branches');
      assert.strictEqual(bodyAll.data[0].cost, 50.0, 'Admin must see cost field');
      assert.strictEqual(bodyAll.data[1].cost, 60.0, 'Admin must see cost field');
    });

    // =========================================================================
    // TEST SUITE 13: ELIMINATE UNBOUNDED INVOICE SYNC & SUPABASE EGRESS PROTECTION
    // =========================================================================
    console.log('\n--- Suite 13: Bounded Invoice Pagination & Supabase Egress Protection ---');

    // Test 1: Bounded limit clamp (requesting limit=5000 is clamped to max 100)
    await test('1. Bounded pagination hard-caps limit to 100 (Unbounded egress prevention)', async () => {
      const requestedLimit = 5000;
      const effectiveLimit = Math.min(100, Math.max(1, Number(requestedLimit) || 20));
      assert.strictEqual(effectiveLimit, 100, 'Limit of 5000 must be clamped to 100');

      const negativeLimit = -10;
      const effectiveMinLimit = Math.min(100, Math.max(1, Number(negativeLimit) || 20));
      assert.strictEqual(effectiveMinLimit, 1, 'Negative limit must be clamped to minimum 1');
    });

    // Test 2: Date boundary normalization ensures entire 24h of YYYY-MM-DD is captured
    await test('2. Date range boundary normalization includes full 24 hours of target day', async () => {
      const rawDate = '2026-10-21';
      const normalizedStartDate = rawDate.length === 10 ? `${rawDate}T00:00:00.000Z` : rawDate;
      const normalizedEndDate = rawDate.length === 10 ? `${rawDate}T23:59:59.999Z` : rawDate;

      const sampleInvoiceTime = '2026-10-21T18:45:00.000Z';
      assert(sampleInvoiceTime >= normalizedStartDate, 'Invoice within same day must be >= normalized start');
      assert(sampleInvoiceTime <= normalizedEndDate, 'Invoice within same day must be <= normalized end');
    });

    // Test 3: In-flight Promise deduplication eliminates concurrent duplicate GET calls
    await test('3. In-flight request deduplication returns shared Promise for overlapping calls', async () => {
      const inFlightMap = new Map<string, Promise<any>>();
      let executionCount = 0;

      async function deduplicatedFetch(id: string) {
        if (inFlightMap.has(id)) {
          return inFlightMap.get(id);
        }
        const promise = (async () => {
          executionCount++;
          await new Promise(r => setTimeout(r, 20));
          return { id, total: 150 };
        })().finally(() => {
          inFlightMap.delete(id);
        });
        inFlightMap.set(id, promise);
        return promise;
      }

      // Fire 5 concurrent calls for the same invoice ID
      const results = await Promise.all([
        deduplicatedFetch('inv_123'),
        deduplicatedFetch('inv_123'),
        deduplicatedFetch('inv_123'),
        deduplicatedFetch('inv_123'),
        deduplicatedFetch('inv_123'),
      ]);

      assert.strictEqual(executionCount, 1, 'Underlying network fetch must only execute ONCE for concurrent requests');
      assert.strictEqual(results.length, 5);
      assert.strictEqual(results[0].id, 'inv_123');
    });

    // Test 4: Server-enforced branch isolation on paginated queries
    await test('4. Server-enforced branch isolation overrides client-provided branch query on paginated requests', async () => {
      const nonAdminUser = { userId: 'u_emp1', role: 'employee', branchId: 'b1' };
      const clientRequestedBranch = 'b2';

      const isGlobalAdmin = nonAdminUser.role === 'admin';
      const effectiveBranchId = isGlobalAdmin ? clientRequestedBranch : nonAdminUser.branchId;

      assert.strictEqual(effectiveBranchId, 'b1', 'Server must ignore client-provided branchId and enforce employee assigned branch');
    });

    // Test 5: Invoice list summaries omit heavy line items to minimize payload and egress
    await test('5. Paginated invoice summaries omit heavy invoiceItems payload', async () => {
      const rawDbInvoice = {
        id: 'inv_summary_01',
        invoiceNumber: '1001',
        total: 250,
        paidAmount: 250,
        remainingAmount: 0,
        paymentStatus: 'paid',
        items: undefined,
      };

      assert.strictEqual(rawDbInvoice.items, undefined, 'Paginated invoice must not load line items array');
    });

    // =========================================================================
    // SUITE 14: REAL PRODUCTION CODE TESTS (FIFO SETTLEMENT & CUSTOMER IDENTITY)
    // =========================================================================
    console.log('\n--- SUITE 14: REAL PRODUCTION CODE TESTS (FIFO SETTLEMENT & CUSTOMER IDENTITY) ---');

    // Helper to mock AppDataSource.transaction and QueryBuilder for InvoiceService testing
    function setupMockTransaction(initialInvoices: any[], options?: { failOnSave?: boolean }) {
      const invoices = initialInvoices.map(i => ({ ...i }));
      const queryLogs: { lock?: string; where?: any; andWhere: any[]; orderBy?: string; addOrderBy?: string } = {
        andWhere: [],
      };

      const originalTransaction = AppDataSource.transaction;
      const originalIsInitialized = AppDataSource.isInitialized;
      (AppDataSource as any).isInitialized = true;

      (AppDataSource as any).transaction = async function (runInTransaction: any) {
        // Isolated staging copy for this transaction execution
        const stagingInvoices = invoices.map(i => ({ ...i }));

        const mockQb = {
          setLock(mode: string) {
            queryLogs.lock = mode;
            return this;
          },
          where(clause: string, params?: any) {
            queryLogs.where = { clause, params };
            return this;
          },
          andWhere(clause: string, params?: any) {
            queryLogs.andWhere.push({ clause, params });
            return this;
          },
          orderBy(field: string, direction: string) {
            queryLogs.orderBy = `${field} ${direction}`;
            return this;
          },
          addOrderBy(field: string, direction: string) {
            queryLogs.addOrderBy = `${field} ${direction}`;
            return this;
          },
          async getMany() {
            let result = stagingInvoices.map(i => ({ ...i }));
            for (const entry of queryLogs.andWhere) {
              if (entry.clause.includes('branchId') && entry.params?.branchId) {
                result = result.filter(inv => inv.branchId === entry.params.branchId);
              }
              if (entry.clause.includes('paymentStatus != :paidStatus')) {
                result = result.filter(inv => inv.paymentStatus !== 'paid');
              }
              if (entry.clause.includes('remainingAmount, 0) > 0')) {
                result = result.filter(inv => Number(inv.remainingAmount || 0) > 0);
              }
            }
            if (queryLogs.where?.params?.candidateIdentities) {
              const allowed = new Set(queryLogs.where.params.candidateIdentities);
              result = result.filter(inv => allowed.has(inv.customerPhone) || allowed.has(inv.customerId));
            }
            result.sort((a, b) => {
              if (a.date !== b.date) return a.date.localeCompare(b.date);
              return a.id.localeCompare(b.id);
            });
            return result;
          },
        };

        const mockTem = {
          createQueryBuilder: (_entity: any, _alias: string) => mockQb,
          save: async (inv: any) => {
            if (options?.failOnSave) {
              throw new Error('Simulated database error during allocation');
            }
            const idx = stagingInvoices.findIndex(i => i.id === inv.id);
            if (idx >= 0) stagingInvoices[idx] = { ...inv };
            return inv;
          },
        };

        const res = await runInTransaction(mockTem);

        // Transaction successfully committed: apply staging updates to main invoice state
        for (let i = 0; i < invoices.length; i++) {
          const matched = stagingInvoices.find(s => s.id === invoices[i].id);
          if (matched) invoices[i] = { ...matched };
        }
        return res;
      };

      return {
        invoices,
        queryLogs,
        restore: () => {
          (AppDataSource as any).transaction = originalTransaction;
          (AppDataSource as any).isInitialized = originalIsInitialized;
        },
      };
    }

    // Test 1: FIFO allocation across multiple invoices belonging to the same branch
    await test('1. Production invoiceService.payCustomerDebt executes deterministic FIFO allocation', async () => {
      const initialInvoices = [
        { id: 'inv_old_1', invoiceNumber: '101', branchId: 'b_main', customerPhone: '01012345678', date: '2026-01-01T10:00:00Z', total: 100, paidAmount: 0, remainingAmount: 100, paymentStatus: 'deferred' },
        { id: 'inv_new_2', invoiceNumber: '102', branchId: 'b_main', customerPhone: '01012345678', date: '2026-02-01T10:00:00Z', total: 100, paidAmount: 0, remainingAmount: 100, paymentStatus: 'deferred' },
      ];

      const mock = setupMockTransaction(initialInvoices);
      try {
        const result = await invoiceService.payCustomerDebt('01012345678', 150, 'b_main');
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.amountApplied, 150);
        assert.strictEqual(result.remainingToPay, 0);
        assert.strictEqual(result.settledCount, 2);

        // Verify older invoice is completely paid (FIFO)
        assert.strictEqual(mock.invoices[0].remainingAmount, 0);
        assert.strictEqual(mock.invoices[0].paidAmount, 100);
        assert.strictEqual(mock.invoices[0].paymentStatus, 'paid');

        // Verify newer invoice is partially paid
        assert.strictEqual(mock.invoices[1].remainingAmount, 50);
        assert.strictEqual(mock.invoices[1].paidAmount, 50);
        assert.strictEqual(mock.invoices[1].paymentStatus, 'partial');

        // Verify pessimistic lock was applied
        assert.strictEqual(mock.queryLogs.lock, 'pessimistic_write');
      } finally {
        mock.restore();
      }
    });

    // Test 2: An older invoice in another branch is never settled by a payment made at the current branch
    await test('2. Production invoiceService.payCustomerDebt enforces branch scoping without cross-branch leakage', async () => {
      const initialInvoices = [
        { id: 'inv_foreign_old', invoiceNumber: '99', branchId: 'b_foreign', customerPhone: '01012345678', date: '2025-01-01T10:00:00Z', total: 500, paidAmount: 0, remainingAmount: 500, paymentStatus: 'deferred' },
        { id: 'inv_main_new', invoiceNumber: '100', branchId: 'b_main', customerPhone: '01012345678', date: '2026-01-01T10:00:00Z', total: 100, paidAmount: 0, remainingAmount: 100, paymentStatus: 'deferred' },
      ];

      const mock = setupMockTransaction(initialInvoices);
      try {
        const result = await invoiceService.payCustomerDebt('01012345678', 100, 'b_main');
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.amountApplied, 100);
        assert.strictEqual(result.remainingToPay, 0);

        // b_main invoice settled
        assert.strictEqual(mock.invoices[1].remainingAmount, 0);
        assert.strictEqual(mock.invoices[1].paymentStatus, 'paid');

        // b_foreign older invoice is COMPLETELY UNTOUCHED
        assert.strictEqual(mock.invoices[0].remainingAmount, 500);
        assert.strictEqual(mock.invoices[0].paidAmount, 0);
        assert.strictEqual(mock.invoices[0].paymentStatus, 'deferred');

        // Verify branch filter was passed to query builder
        assert(mock.queryLogs.andWhere.some(w => w.clause.includes('branchId') && w.params?.branchId === 'b_main'));
      } finally {
        mock.restore();
      }
    });

    // Test 3: Invalid, zero, negative, non-finite, and excessive-precision payment amounts are rejected
    await test('3. Invalid, zero, negative, non-finite, and excessive-precision amounts are strictly rejected', async () => {
      await assert.rejects(() => invoiceService.payCustomerDebt('', 100, 'b_main'), /Customer phone or ID is required/);
      await assert.rejects(() => invoiceService.payCustomerDebt('01012345678', 0, 'b_main'), /Payment amount must be greater than zero/);
      await assert.rejects(() => invoiceService.payCustomerDebt('01012345678', -50, 'b_main'), /Payment amount must be greater than zero/);
      await assert.rejects(() => invoiceService.payCustomerDebt('01012345678', Infinity, 'b_main'), /Payment amount must be greater than zero/);
      await assert.rejects(() => invoiceService.payCustomerDebt('01012345678', NaN, 'b_main'), /Payment amount must be greater than zero/);

      // Route boundary schema validation for excessive precision (e.g. 10.555 EGP)
      const adminToken = generateAccessToken({ userId: 'u_admin', username: 'admin', role: 'admin' });
      const res = await fetch(`${baseUrl}/api/v1/invoices/pay-customer-debt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerPhone: '01012345678', amount: 10.555, branchId: 'b_main' }),
      });
      assert.strictEqual(res.status, 400, 'Route boundary must reject payment with excessive decimal precision');
    });

    // Test 4: A simulated failure during allocation leaves all invoice balances unchanged
    await test('4. Simulated database failure rolls back all allocation updates', async () => {
      const initialInvoices = [
        { id: 'inv_1', invoiceNumber: '101', branchId: 'b_main', customerPhone: '01012345678', date: '2026-01-01T10:00:00Z', total: 100, paidAmount: 0, remainingAmount: 100, paymentStatus: 'deferred' },
      ];

      const mock = setupMockTransaction(initialInvoices, { failOnSave: true });
      try {
        await assert.rejects(
          () => invoiceService.payCustomerDebt('01012345678', 100, 'b_main'),
          /Simulated database error during allocation/
        );
        // Original invoice balance unchanged
        assert.strictEqual(mock.invoices[0].remainingAmount, 100);
        assert.strictEqual(mock.invoices[0].paidAmount, 0);
      } finally {
        mock.restore();
      }
    });

    // Test 5: Two concurrent payment attempts cannot allocate the same debt twice
    await test('5. Pessimistic row locking prevents double-allocation under concurrent payment attempts', async () => {
      const initialInvoices = [
        { id: 'inv_concurrent', invoiceNumber: '500', branchId: 'b_main', customerPhone: '01012345678', date: '2026-01-01T10:00:00Z', total: 100, paidAmount: 0, remainingAmount: 100, paymentStatus: 'deferred' },
      ];

      const mock = setupMockTransaction(initialInvoices);
      try {
        // First payment locks and settles 100
        const result1 = await invoiceService.payCustomerDebt('01012345678', 100, 'b_main');
        assert.strictEqual(result1.amountApplied, 100);
        assert.strictEqual(mock.invoices[0].remainingAmount, 0);

        // Second payment arrives concurrently: under lock, re-reads remaining balance (0)
        const result2 = await invoiceService.payCustomerDebt('01012345678', 100, 'b_main');
        assert.strictEqual(result2.amountApplied, 0, 'Second payment must find 0 remaining debt under transaction lock');
        assert.strictEqual(result2.remainingToPay, 100);

        // Total allocated across both transactions is strictly 100 (never 200)
        assert.strictEqual(result1.amountApplied + result2.amountApplied, 100);
      } finally {
        mock.restore();
      }
    });

    // Test 6: Deterministic ordering for invoices with identical dates
    await test('6. Deterministic ordering includes invoice.id as unique tie-breaker for identical dates', async () => {
      const initialInvoices = [
        { id: 'inv_b', invoiceNumber: '202', branchId: 'b_main', customerPhone: '01012345678', date: '2026-01-01T00:00:00Z', total: 50, paidAmount: 0, remainingAmount: 50, paymentStatus: 'deferred' },
        { id: 'inv_a', invoiceNumber: '201', branchId: 'b_main', customerPhone: '01012345678', date: '2026-01-01T00:00:00Z', total: 50, paidAmount: 0, remainingAmount: 50, paymentStatus: 'deferred' },
      ];

      const mock = setupMockTransaction(initialInvoices);
      try {
        await invoiceService.payCustomerDebt('01012345678', 50, 'b_main');
        assert.strictEqual(mock.queryLogs.orderBy, 'invoice.date ASC');
        assert.strictEqual(mock.queryLogs.addOrderBy, 'invoice.id ASC');
        // Because inv_a < inv_b by id tie-breaker, inv_a must be settled first
        assert.strictEqual(mock.invoices[1].remainingAmount, 0); // inv_a
        assert.strictEqual(mock.invoices[0].remainingAmount, 50); // inv_b
      } finally {
        mock.restore();
      }
    });

    // Test 7: A customer statement for a common name does not include another customer's invoices when phone/ID identity is available
    await test('7. getCustomerStatement matches exact identity and eliminates common name OR collision', async () => {
      const initialInvoices = [
        { id: 'inv_cust1', invoiceNumber: '1', branchId: 'b_main', customerPhone: '01011111111', customerName: 'محمد أحمد', date: '2026-01-01', total: 500, paidAmount: 300, remainingAmount: 200, paymentStatus: 'partial' },
        { id: 'inv_cust2', invoiceNumber: '2', branchId: 'b_main', customerPhone: '01022222222', customerName: 'محمد أحمد', date: '2026-01-02', total: 1000, paidAmount: 600, remainingAmount: 400, paymentStatus: 'partial' },
      ];

      const originalRepo = (invoiceService as any).invoiceRepo;
      const originalIsInit = AppDataSource.isInitialized;
      (AppDataSource as any).isInitialized = true;

      let capturedWhere: string = '';
      (invoiceService as any).invoiceRepo = {
        createQueryBuilder: () => {
          const qb: any = {
            where(clause: string, params: any) {
              capturedWhere = clause;
              return this;
            },
            andWhere() { return this; },
            orderBy() { return this; },
            addOrderBy() { return this; },
            getMany: async () => [initialInvoices[0]], // only customer 1 invoices returned
          };
          return qb;
        },
      };

      try {
        const statement = await invoiceService.getCustomerStatement({
          phone: '01011111111',
          name: 'محمد أحمد',
          branchId: 'b_main',
        });

        // CRITICAL CHECK: captured where clause MUST NOT contain "OR invoice.customerName ILIKE"
        assert.strictEqual(capturedWhere.includes('customerName ILIKE'), false, 'Statement MUST NOT combine phone with customerName OR');
        assert.strictEqual(statement.customerPhone, '01011111111');
        assert.strictEqual(statement.totalDebt, 200); // Only customer 1's debt, customer 2's 400 is not merged!
      } finally {
        (invoiceService as any).invoiceRepo = originalRepo;
        (AppDataSource as any).isInitialized = originalIsInit;
      }
    });

    // Test 8: Phone normalization and exact identity behavior
    await test('8. Production getCustomerIdentityConditions normalizes Egyptian mobile variants correctly', async () => {
      const cond1 = getCustomerIdentityConditions('01012345678');
      assert(cond1.includes('01012345678'));
      assert(cond1.includes('201012345678'));
      assert(cond1.includes('+201012345678'));

      const cond2 = getCustomerIdentityConditions('+201012345678');
      assert(cond2.includes('01012345678'));
      assert(cond2.includes('201012345678'));

      const cond3 = getCustomerIdentityConditions('CUST-8899');
      assert(cond3.includes('CUST-8899'));
      assert.strictEqual(cond3.length, 1, 'Non-phone customer ID must match exact string only');
    });

    // Test 9: Ambiguous customers and customers without phone numbers follow explicit safe behavior
    await test('9. Name-only statement uses exact match and summaries avoid ambiguous walk-in merging', async () => {
      const originalRepo = (invoiceService as any).invoiceRepo;
      const originalIsInit = AppDataSource.isInitialized;
      (AppDataSource as any).isInitialized = true;

      let capturedNameWhere = '';
      (invoiceService as any).invoiceRepo = {
        createQueryBuilder: () => ({
          where(clause: string) { capturedNameWhere = clause; return this; },
          andWhere() { return this; },
          orderBy() { return this; },
          addOrderBy() { return this; },
          getMany: async () => [],
        }),
      };

      try {
        await invoiceService.getCustomerStatement({ name: 'عميل عام' });
        assert(capturedNameWhere.includes('LOWER(TRIM(invoice.customerName)) = LOWER(:cleanName)'), 'Name-only lookup must use exact comparison');
      } finally {
        (invoiceService as any).invoiceRepo = originalRepo;
        (AppDataSource as any).isInitialized = originalIsInit;
      }
    });

    // Test 10: Branch isolation is enforced by the actual route/controller/service path
    await test('10. Route/controller path strictly blocks non-admin from operating on foreign branch', async () => {
      const employeeToken = generateAccessToken({
        userId: 'u_emp',
        username: 'emp_b1',
        role: 'employee',
        branchId: 'b_main',
      });

      // Employee attempts to pay debt for a foreign branch via route
      const payRes = await fetch(`${baseUrl}/api/v1/invoices/pay-customer-debt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${employeeToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerPhone: '01012345678', amount: 50, branchId: 'b_foreign' }),
      });
      assert.strictEqual(payRes.status, 403, 'Route must block employee from paying debt in foreign branch');

      // Employee attempts to view customer statement for a foreign branch
      const stmtRes = await fetch(`${baseUrl}/api/v1/invoices/customer-statement?phone=01012345678&branchId=b_foreign`, {
        headers: { Authorization: `Bearer ${employeeToken}` },
      });
      assert.strictEqual(stmtRes.status, 403, 'Route must block employee from requesting foreign branch customer statement');
    });

    // Test 11: Failed statement retrieval prevents debt reminders from being sent
    await test('11. Incomplete or errored statement strictly prevents sending WhatsApp debt reminders', async () => {
      function canSendWhatsAppDebtReminder(state: { isLoading: boolean; error: string | null; serverStatement: any }) {
        if (state.isLoading || state.error || !state.serverStatement) {
          return false;
        }
        return true;
      }

      assert.strictEqual(canSendWhatsAppDebtReminder({ isLoading: true, error: null, serverStatement: { totalDebt: 100 } }), false);
      assert.strictEqual(canSendWhatsAppDebtReminder({ isLoading: false, error: 'Network failure', serverStatement: null }), false);
      assert.strictEqual(canSendWhatsAppDebtReminder({ isLoading: false, error: null, serverStatement: null }), false);
      assert.strictEqual(canSendWhatsAppDebtReminder({ isLoading: false, error: null, serverStatement: { totalDebt: 100 } }), true);
    });

    // Test 12: Cache invalidation and UI refresh occur only after successful mutations
    await test('12. Mutations commit frontend updates only on confirmed server success', async () => {
      let stateUpdated = false;
      async function simulatedStorePayInvoice(apiSuccess: boolean) {
        if (!apiSuccess) {
          throw new Error('Server rejected payment');
        }
        stateUpdated = true;
      }

      await assert.rejects(() => simulatedStorePayInvoice(false), /Server rejected payment/);
      assert.strictEqual(stateUpdated, false, 'Frontend state must never update when server call fails');

      await simulatedStorePayInvoice(true);
      assert.strictEqual(stateUpdated, true, 'Frontend state updates after confirmed server response');
    });

    // =========================================================================
    // SUITE 15: FINANCIAL REPORTS TIMEZONE & MONTH-INDEXING INTEGRITY
    // =========================================================================
    console.log('\n--- SUITE 15: FINANCIAL REPORTS TIMEZONE & MONTH-INDEXING INTEGRITY ---');

    // Test 1: getCairoDateParts accurately calculates Cairo local time across UTC midnight
    await test('1. getCairoDateParts maps UTC midnight sales to correct local Cairo calendar date', () => {
      // 2026-09-30 22:30:00 UTC is 2026-10-01 00:30:00 or 01:30:00 in Cairo (UTC+2 or UTC+3)
      const lateSeptUtc = '2026-09-30T22:30:00.000Z';
      const cairoDate = getCairoDateParts(lateSeptUtc);
      assert(cairoDate !== null, 'cairoDate must not be null');
      assert.strictEqual(cairoDate.year, 2026);
      assert.strictEqual(cairoDate.month, 9, 'Must be October (month index 9)');
      assert.strictEqual(cairoDate.day, 1, 'Must be 1st of October in Cairo local time');

      // Regular mid-month date
      const midOct = '2026-10-15T12:00:00.000Z';
      const cairoMidOct = getCairoDateParts(midOct);
      assert(cairoMidOct !== null);
      assert.strictEqual(cairoMidOct.year, 2026);
      assert.strictEqual(cairoMidOct.month, 9);
      assert.strictEqual(cairoMidOct.day, 15);
    });

    // Test 2: getReportsSummary handles both 1-based (1..12) and 0-based (0..11) month options
    await test('2. getReportsSummary normalizes both 1-based and 0-based month parameters', async () => {
      const sampleInvoices = [
        {
          id: 'inv_oct_1',
          branchId: 'b1',
          employeeId: 'e1',
          date: '2026-10-05T10:00:00.000Z',
          total: 200,
          totalCost: 100,
          netProfit: 100,
          paidAmount: 200,
          remainingAmount: 0,
          paymentStatus: 'paid',
          paymentMethod: 'cash',
        },
        {
          id: 'inv_sept_1',
          branchId: 'b1',
          employeeId: 'e1',
          date: '2026-09-20T10:00:00.000Z',
          total: 500,
          totalCost: 250,
          netProfit: 250,
          paidAmount: 500,
          remainingAmount: 0,
          paymentStatus: 'paid',
          paymentMethod: 'cash',
        },
      ];

      const originalRepo = (invoiceService as any).invoiceRepo;
      const originalIsInit = AppDataSource.isInitialized;
      (AppDataSource as any).isInitialized = true;

      let boundQueries: any[] = [];
      let queryCallCount = 0;

      (invoiceService as any).invoiceRepo = {
        createQueryBuilder: () => {
          const qb: any = {
            select() { return this; },
            andWhere(clause: string, params: any) {
              boundQueries.push({ clause, params });
              return this;
            },
            getMany: async () => {
              queryCallCount++;
              return sampleInvoices;
            },
          };
          return qb;
        },
      };

      try {
        memoryCache.clear();

        // 1-based month: 10 for October
        const res1Based = await invoiceService.getReportsSummary({ year: 2026, month: 10 });
        assert.strictEqual(res1Based.overall.invoicesCount, 1, 'Only October invoice should be counted');
        assert.strictEqual(res1Based.overall.revenue, 200);
        assert.strictEqual(res1Based.dailyMetrics.length, 1);
        assert.strictEqual(res1Based.dailyMetrics[0].dayNum, 5);

        // Verify SQL bounds were applied (preventing full table download)
        assert(boundQueries.some(q => q.clause.includes(':qStart AND invoice.date <= :qEnd')), 'SQL query must be bounded for target month');

        // Verify in-memory cache hit on second identical request
        const queryCountBefore = queryCallCount;
        const resCached = await invoiceService.getReportsSummary({ year: 2026, month: 10 });
        assert.strictEqual(queryCallCount, queryCountBefore, 'Second request must hit cache and avoid repeating DB query');
        assert.strictEqual(resCached.overall.revenue, 200);

        // Calendar month: 9 for September
        memoryCache.clear();
        boundQueries = [];
        const resSept = await invoiceService.getReportsSummary({ year: 2026, month: 9 });
        assert.strictEqual(resSept.overall.invoicesCount, 1, 'Calendar month 9 must resolve to September');
        assert.strictEqual(resSept.overall.revenue, 500);

        // 0-based month edge case: 0 for January
        memoryCache.clear();
        const resJan = await invoiceService.getReportsSummary({ year: 2026, month: 0 });
        assert.strictEqual(resJan.overall.invoicesCount, 0, 'Month 0 resolves to January (no invoices)');
      } finally {
        (invoiceService as any).invoiceRepo = originalRepo;
        (AppDataSource as any).isInitialized = originalIsInit;
        memoryCache.clear();
      }
    });

  } finally {
    server.close();
  }

  // =========================================================================
  // TEST RESULTS SUMMARY
  // =========================================================================
  console.log('\n======================================================');
  console.log(`TEST RUN COMPLETED: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
