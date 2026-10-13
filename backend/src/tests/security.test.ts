import assert from 'assert';
import http from 'http';
import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, authorizeRoles } from '../common/middleware/auth.middleware';
import { generateAccessToken } from '../common/utils/jwt.utils';
import { errorHandler } from '../common/middleware/error.middleware';

async function runSecurityTests() {
  console.log('🧪 Starting Comprehensive Automated Security Regression Tests (Zero-Dependency)...\n');
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
    // TEST SUITE 4: SAFE ERROR HANDLING & INFORMATION DISCLOSURE
    // =========================================================================
    console.log('\n--- Suite 4: Safe Error Reporting (No Leakage) ---');

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
