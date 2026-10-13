import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres.cybtacestgpbsluqmclr:Zni39zBUN7x0rfD7@aws-0-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL');

  // 1. Create suppliers table if not exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.suppliers (
      id VARCHAR PRIMARY KEY,
      "supplierName" VARCHAR NOT NULL,
      "supplierPhone" VARCHAR,
      "invoiceNumber" VARCHAR,
      "itemsDescription" TEXT,
      "branchId" VARCHAR,
      "totalAmount" NUMERIC(12, 2) DEFAULT 0,
      "paidAmount" NUMERIC(12, 2) DEFAULT 0,
      "remainingAmount" NUMERIC(12, 2) DEFAULT 0,
      "paymentStatus" VARCHAR DEFAULT 'unpaid',
      "purchaseDate" TIMESTAMPTZ DEFAULT NOW(),
      notes TEXT,
      "paymentHistory" JSONB DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('Created/verified suppliers table');

  // 2. Grant permissions on all tables to anon, authenticated, service_role
  await client.query(`
    GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  `);
  console.log('Granted all permissions to anon, authenticated, service_role');

  // 3. For each table, disable RLS so PostgREST allows unrestricted reads/writes from app
  const tables = [
    'users', 'branches', 'categories', 'products', 'product_branch_data', 
    'physical_items', 'customers', 'invoices', 'invoice_items', 
    'fixed_expenses', 'product_compositions', 'suppliers'
  ];

  for (const tbl of tables) {
    await client.query(`ALTER TABLE public.${tbl} DISABLE ROW LEVEL SECURITY;`);
    console.log(`Disabled RLS on ${tbl}`);
  }

  await client.end();
  console.log('Finished successfully!');
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
