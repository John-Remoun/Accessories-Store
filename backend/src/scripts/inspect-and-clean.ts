import { AppDataSource } from '../config/data-source';

async function main() {
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

  // Find top latest invoices
  const latestInvs = await AppDataSource.query(`
    SELECT id, "invoiceNumber", "createdAt", total, "branchId", "customerName", "customerPhone"
    FROM invoices
    ORDER BY "createdAt" DESC
    LIMIT 10
  `);
  console.log('LATEST INVOICES:');
  console.log(JSON.stringify(latestInvs, null, 2));

  // Find latest customers
  const latestCusts = await AppDataSource.query(`
    SELECT id, name, phone, "createdAt"
    FROM customers
    ORDER BY "createdAt" DESC
    LIMIT 10
  `);
  console.log('LATEST CUSTOMERS:');
  console.log(JSON.stringify(latestCusts, null, 2));

  // Find latest compositions
  const latestComps = await AppDataSource.query(`
    SELECT id, name, "createdAt"
    FROM product_compositions
    ORDER BY "updatedAt" DESC
    LIMIT 10
  `);
  console.log('LATEST COMPOSITIONS:');
  console.log(JSON.stringify(latestComps, null, 2));

  const allTables = await AppDataSource.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `);
  console.log('PUBLIC TABLES:', allTables.map((t: any) => t.tablename));

  // Verify no test customer remnants remain
  const checkCust = await AppDataSource.query(`
    SELECT id, name, phone FROM customers WHERE phone IN ('01011112222', '01033334444') OR id LIKE 'test_%'
  `);
  console.log('TEST CUSTOMERS IN DB (SHOULD BE ZERO):', checkCust);

  // Compare stock with backup_pbd_20261024
  const stockDiff = await AppDataSource.query(`
    SELECT pbd."productId", pbd."branchId", pbd.quantity AS current_qty, bkp.quantity AS bkp_qty
    FROM product_branch_data pbd
    LEFT JOIN backup_pbd_20261024 bkp 
      ON pbd."productId" = bkp."productId" AND pbd."branchId" = bkp."branchId"
    WHERE pbd.quantity != bkp.quantity OR bkp.quantity IS NULL
  `);
  console.log('STOCK DIFFERENCES FROM BACKUP_PBD_20261024:');
  console.log(JSON.stringify(stockDiff, null, 2));

  // Current row counts
  const tables = ['products', 'product_branch_data', 'categories', 'customers', 'suppliers', 'invoices', 'invoice_items', 'fixed_expenses', 'product_compositions', 'physical_items'];
  console.log('CURRENT COUNTS:');
  for (const t of tables) {
    const q = await AppDataSource.query(`SELECT COUNT(*)::int AS cnt FROM "${t}"`);
    console.log(`${t}: ${q[0].cnt}`);
  }

  const sumTotal = await AppDataSource.query(`SELECT COALESCE(SUM(total), 0)::numeric AS sum_total FROM invoices`);
  console.log(`CURRENT INVOICES SUM: ${sumTotal[0].sum_total}`);

  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
