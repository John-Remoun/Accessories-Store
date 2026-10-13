import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment configuration
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('[ERROR] DATABASE_URL (or POSTGRES_URL) environment variable is required to run this script.');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' },
});

async function run() {
  await client.connect();
  console.log('Connected to PostgreSQL database');

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

  // 2. Enable Row Level Security (RLS) on suppliers table
  await client.query(`
    ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
  `);
  console.log('Enabled RLS on public.suppliers');

  // 3. Grant table permissions exclusively to service_role (backend application)
  // Revoke public/anon unrestricted access
  await client.query(`
    REVOKE ALL ON TABLE public.suppliers FROM anon, public;
    GRANT ALL ON TABLE public.suppliers TO service_role;
  `);

  await client.end();
  console.log('Database script completed successfully.');
}

run().catch((err) => {
  console.error('Migration error:', err.message);
  process.exit(1);
});
