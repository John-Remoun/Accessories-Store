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

    // 1. Enable Row Level Security (RLS) on all eleven audited tables plus suppliers
    for (const table of tables) {
      await queryRunner.query(`ALTER TABLE IF EXISTS public."${table}" ENABLE ROW LEVEL SECURITY;`);
    }

    // 2. Harden sensitive columns on public.users and restrict PostgREST public access
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          REVOKE ALL ON TABLE public.users FROM anon;
          GRANT SELECT (
            id, username, name, role, "branchId", "profileImage", 
            "joinDate", "salesCount", phone, email, "createdAt", "updatedAt"
          ) ON TABLE public.users TO anon;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          REVOKE ALL ON TABLE public.users FROM authenticated;
          GRANT SELECT (
            id, username, name, role, "branchId", "profileImage", 
            "joinDate", "salesCount", phone, email, "createdAt", "updatedAt"
          ) ON TABLE public.users TO authenticated;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
          GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
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

    console.log('✅ Supabase PostgreSQL RLS and column protections actively enforced.');
  } catch (err: any) {
    console.warn('⚠️ Security policies application notice (non-fatal):', err.message);
  } finally {
    await queryRunner.release();
  }
}
