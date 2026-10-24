import { AppDataSource } from '../config/data-source';

export async function setupIsolatedTestSchema() {
  if (!AppDataSource.isInitialized) {
    let retries = 5;
    while (retries > 0) {
      try {
        await AppDataSource.initialize();
        break;
      } catch (err: any) {
        retries--;
        console.warn(`[DB Connection Warning] ${err.message}. Retrying (${retries} attempts left)...`);
        if (retries === 0) throw err;
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
  }

  console.log('🔒 Preparing isolated test schema "test_isolation"...');
  await AppDataSource.query(`CREATE SCHEMA IF NOT EXISTS test_isolation;`);

  const tables = [
    'branches',
    'users',
    'categories',
    'products',
    'product_branch_data',
    'physical_items',
    'customers',
    'suppliers',
    'invoices',
    'invoice_items',
    'fixed_expenses',
    'product_compositions',
  ];

  for (const table of tables) {
    // Create identical table structure in test_isolation schema
    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS test_isolation."${table}" (
        LIKE public."${table}" INCLUDING ALL
      );
    `);
  }

  // Populate static lookup tables in test_isolation if empty
  const branchCount = await AppDataSource.query(`SELECT COUNT(*)::int AS cnt FROM test_isolation.branches`);
  if (branchCount[0].cnt === 0) {
    await AppDataSource.query(`INSERT INTO test_isolation.branches SELECT * FROM public.branches ON CONFLICT DO NOTHING`);
  }

  const userCount = await AppDataSource.query(`SELECT COUNT(*)::int AS cnt FROM test_isolation.users`);
  if (userCount[0].cnt === 0) {
    await AppDataSource.query(`INSERT INTO test_isolation.users SELECT * FROM public.users ON CONFLICT DO NOTHING`);
  }

  console.log('✅ Isolated test schema "test_isolation" is fully initialized with identical schema.');
}

if (require.main === module) {
  setupIsolatedTestSchema().then(async () => {
    await AppDataSource.destroy();
  }).catch((err) => {
    console.error('Error setting up isolated schema:', err);
    process.exit(1);
  });
}
