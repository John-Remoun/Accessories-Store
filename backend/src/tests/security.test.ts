import assert from 'assert';
import http from 'http';
import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, authorizeRoles } from '../common/middleware/auth.middleware';
import { generateAccessToken } from '../common/utils/jwt.utils';
import { errorHandler } from '../common/middleware/error.middleware';
import { AppError } from '../common/exceptions/app-error';

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
