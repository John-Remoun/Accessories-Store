import { AppDataSource } from '../config/data-source';

async function main() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const tables = [
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

  console.log('=== EXACT CURRENT TABLE ROW COUNTS IN DATABASE ===');
  for (const table of tables) {
    const info = await AppDataSource.query(`SELECT schemaname FROM pg_tables WHERE tablename = $1`, [table]);
    const schemas = info.map((i: any) => i.schemaname).join(', ');
    const res = await AppDataSource.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
    console.log(`${table} (schema: [${schemas}]): ${res[0].count}`);
  }

  const invSum = await AppDataSource.query(`SELECT COALESCE(SUM(total), 0)::numeric AS sum_total FROM invoices`);
  console.log(`invoices_total_sum: ${invSum[0].sum_total}`);

  const itemsSum = await AppDataSource.query(`SELECT COUNT(*)::int AS items_count, COALESCE(SUM(quantity), 0)::int AS pieces_count FROM invoice_items`);
  console.log(`invoice_items_count: ${itemsSum[0].items_count}, pieces: ${itemsSum[0].pieces_count}`);

  // Check any test remnants
  const testRemnants: Record<string, number> = {};
  for (const table of tables) {
    let col = 'id';
    if (table === 'product_branch_data') {
      const q = await AppDataSource.query(`SELECT COUNT(*)::int AS cnt FROM product_branch_data WHERE "productId" LIKE 'test_%'`);
      testRemnants[table] = q[0].cnt;
      continue;
    }
    if (table === 'invoice_items') {
      const q = await AppDataSource.query(`SELECT COUNT(*)::int AS cnt FROM invoice_items WHERE "invoiceId" LIKE 'test_%' OR "productId" LIKE 'test_%'`);
      testRemnants[table] = q[0].cnt;
      continue;
    }
    const q = await AppDataSource.query(`SELECT COUNT(*)::int AS cnt FROM "${table}" WHERE "${col}" LIKE 'test_%'`);
    testRemnants[table] = q[0].cnt;
  }
  console.log('=== TEST REMNANTS FOUND (id LIKE "test_%") ===');
  console.log(JSON.stringify(testRemnants, null, 2));

  // Also check if any invoices have phone 01011112222 or 01033334444 created by test
  const testPhoneInvs = await AppDataSource.query(`SELECT id, "invoiceNumber", total, "customerPhone" FROM invoices WHERE "customerPhone" IN ('01011112222', '01033334444') OR "invoiceNumber" LIKE 'INV-B%'`);
  console.log('Test phone invoices:', testPhoneInvs);

  // Also check customers created by test
  const testPhoneCust = await AppDataSource.query(`SELECT id, name, phone FROM customers WHERE phone IN ('01011112222', '01033334444') OR name LIKE '%تزوير%' OR name LIKE '%مخزون%'`);
  console.log('Test phone customers:', testPhoneCust);

  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('Error verifying database state:', err);
  process.exit(1);
});
