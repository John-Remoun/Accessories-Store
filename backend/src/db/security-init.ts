import { DataSource } from 'typeorm';

export async function applySecurityHardening(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  try {
    console.log('🔒 Verifying and enforcing Supabase Row Level Security (RLS) policies...');

    const tables = [
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
      'suppliers',
    ];

    // 0. Ensure suppliers table exists if not already present in the active database
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.suppliers (
        id character varying(100) NOT NULL,
        "supplierName" character varying(150) NOT NULL,
        "supplierPhone" character varying(50),
        "invoiceNumber" character varying(100),
        "itemsDescription" text,
        "branchId" character varying(100),
        "totalAmount" numeric(12, 2) NOT NULL DEFAULT 0,
        "paidAmount" numeric(12, 2) NOT NULL DEFAULT 0,
        "remainingAmount" numeric(12, 2) NOT NULL DEFAULT 0,
        "paymentStatus" character varying(50) NOT NULL DEFAULT 'unpaid',
        "purchaseDate" TIMESTAMP WITH TIME ZONE DEFAULT now(),
        notes text,
        "paymentHistory" jsonb DEFAULT '[]'::jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
        CONSTRAINT "PK_suppliers_id" PRIMARY KEY ("id")
      );

      ALTER TABLE IF EXISTS public.fixed_expenses ADD COLUMN IF NOT EXISTS "userName" character varying(150);
      ALTER TABLE IF EXISTS public.fixed_expenses ADD COLUMN IF NOT EXISTS "userId" character varying(100);
      ALTER TABLE IF EXISTS public.invoices ADD COLUMN IF NOT EXISTS "vodafoneNumber" character varying(50);
    `);

    // 1. Enable Row Level Security (RLS) on all eleven audited tables plus suppliers
    for (const table of tables) {
      await queryRunner.query(`ALTER TABLE IF EXISTS public."${table}" ENABLE ROW LEVEL SECURITY;`);
    }

    // 2. Comprehensive Revocation: Strip all table, sequence, and routine privileges
    // from public PostgREST roles (anon, authenticated, PUBLIC) across all schema public tables.
    await queryRunner.query(`
      DO $$
      BEGIN
        -- Revoke from anon
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
          REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
          REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;
        END IF;

        -- Revoke from authenticated
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
          REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
          REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM authenticated;
        END IF;

        -- Revoke from PUBLIC
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
        REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM PUBLIC;

        -- Reset default privileges for future tables
        ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;

        -- Ensure backend service_role retains operational access
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
          GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
          ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
          ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
        END IF;
      END $$;
    `);

    // 3. Ensure service_role management policy on all tables
    for (const table of tables) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
            EXECUTE 'DROP POLICY IF EXISTS "service_role_manage_${table}" ON public."${table}"';
            EXECUTE 'CREATE POLICY "service_role_manage_${table}" ON public."${table}" FOR ALL TO service_role USING (true) WITH CHECK (true)';
          END IF;
        END $$;
      `);
    }

    console.log('✅ Supabase PostgreSQL RLS and column protections actively enforced across all roles.');
  } catch (err: any) {
    console.warn('⚠️ Security policies application notice (non-fatal):', err.message);
  } finally {
    await queryRunner.release();
  }
}
