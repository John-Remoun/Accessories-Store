import { MigrationInterface, QueryRunner } from "typeorm";

export class EnableRLSAndHardenPermissions1700000000001 implements MigrationInterface {
    name = 'EnableRLSAndHardenPermissions1700000000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
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

        // 1. Enable RLS on all eleven reported tables plus suppliers
        for (const table of tables) {
            await queryRunner.query(`ALTER TABLE IF EXISTS public."${table}" ENABLE ROW LEVEL SECURITY;`);
        }

        // 2. Harden sensitive columns on public.users and restrict PostgREST public roles
        await queryRunner.query(`
            DO $$
            BEGIN
                -- Revoke blanket table access from anon and authenticated roles
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                    REVOKE ALL ON TABLE public.users FROM anon;
                    -- Allow safe profile reading only (password and refreshToken remain unreadable)
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

                -- Ensure service_role (backend) retains required operational permissions
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
                    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
                    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
                END IF;
            END $$;
        `);

        // 3. Create service_role policies for all tables
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
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
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

        for (const table of tables) {
            await queryRunner.query(`
                DO $$
                BEGIN
                    EXECUTE 'DROP POLICY IF EXISTS "service_role_manage_${table}" ON public."${table}"';
                END $$;
            `);
            await queryRunner.query(`ALTER TABLE IF EXISTS public."${table}" DISABLE ROW LEVEL SECURITY;`);
        }
    }
}
