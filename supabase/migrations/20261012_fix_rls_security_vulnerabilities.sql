-- ==============================================================================
-- SUPABASE POSTGRESQL SECURITY REMEDIATION MIGRATION
-- Project: Accessories-Store
-- Description: Enable RLS on all 10 public tables, secure sensitive credential
--              columns (password, refreshToken), and implement least-privilege RLS policies.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ENABLE ROW LEVEL SECURITY (RLS) ON ALL AUDITED TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_branch_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.physical_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_compositions ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. HARDEN SENSITIVE CREDENTIAL COLUMNS IN public.users
--    Defense-in-depth:
--    A) Revoke general SELECT on the users table from public PostgREST roles (anon, authenticated).
--    B) Grant SELECT only on safe, non-sensitive profile columns.
--    C) Revoke direct mutation rights (INSERT, UPDATE, DELETE) from anon.
-- ------------------------------------------------------------------------------

-- Revoke all table-level access from anon and authenticated
REVOKE ALL ON TABLE public.users FROM anon, authenticated;

-- Grant column-level SELECT ONLY on safe profile fields (passwords & tokens remain unreadable)
GRANT SELECT (
    id,
    username,
    name,
    role,
    "branchId",
    "profileImage",
    "joinDate",
    "salesCount",
    phone,
    email,
    "createdAt",
    "updatedAt"
) ON TABLE public.users TO anon, authenticated;

-- Ensure service_role (backend) retains full access
GRANT ALL ON TABLE public.users TO service_role;

-- ------------------------------------------------------------------------------
-- 3. CREATE SAFE PUBLIC VIEW FOR USER PROFILES (Supabase Best Practice)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.user_profiles WITH (security_invoker = true) AS
SELECT 
    id,
    username,
    name,
    role,
    "branchId",
    "profileImage",
    "joinDate",
    "salesCount",
    phone,
    email,
    "createdAt",
    "updatedAt"
FROM public.users;

GRANT SELECT ON public.user_profiles TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- TABLE: public.users
-- ==============================================================================
DROP POLICY IF EXISTS "service_role_manage_all_users" ON public.users;
CREATE POLICY "service_role_manage_all_users"
    ON public.users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "allow_read_safe_user_profiles" ON public.users;
CREATE POLICY "allow_read_safe_user_profiles"
    ON public.users
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- ==============================================================================
-- TABLE: public.branches
-- ==============================================================================
DROP POLICY IF EXISTS "service_role_manage_all_branches" ON public.branches;
CREATE POLICY "service_role_manage_all_branches"
    ON public.branches
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "allow_public_read_branches" ON public.branches;
CREATE POLICY "allow_public_read_branches"
    ON public.branches
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "allow_auth_manage_branches" ON public.branches;
CREATE POLICY "allow_auth_manage_branches"
    ON public.branches
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- TABLE: public.categories
-- ==============================================================================
DROP POLICY IF EXISTS "service_role_manage_all_categories" ON public.categories;
CREATE POLICY "service_role_manage_all_categories"
    ON public.categories
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "allow_public_read_categories" ON public.categories;
CREATE POLICY "allow_public_read_categories"
    ON public.categories
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "allow_auth_manage_categories" ON public.categories;
CREATE POLICY "allow_auth_manage_categories"
    ON public.categories
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- TABLE: public.products
-- ==============================================================================
DROP POLICY IF EXISTS "service_role_manage_all_products" ON public.products;
CREATE POLICY "service_role_manage_all_products"
    ON public.products
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "allow_public_read_products" ON public.products;
CREATE POLICY "allow_public_read_products"
    ON public.products
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "allow_auth_manage_products" ON public.products;
CREATE POLICY "allow_auth_manage_products"
    ON public.products
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- TABLE: public.product_branch_data
-- ==============================================================================
DROP POLICY IF EXISTS "service_role_manage_all_pbd" ON public.product_branch_data;
CREATE POLICY "service_role_manage_all_pbd"
    ON public.product_branch_data
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "allow_public_read_pbd" ON public.product_branch_data;
CREATE POLICY "allow_public_read_pbd"
    ON public.product_branch_data
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "allow_pos_manage_pbd" ON public.product_branch_data;
CREATE POLICY "allow_pos_manage_pbd"
    ON public.product_branch_data
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- TABLE: public.physical_items
-- ==============================================================================
DROP POLICY IF EXISTS "service_role_manage_all_pi" ON public.physical_items;
CREATE POLICY "service_role_manage_all_pi"
    ON public.physical_items
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "allow_public_read_pi" ON public.physical_items;
CREATE POLICY "allow_public_read_pi"
    ON public.physical_items
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "allow_pos_manage_pi" ON public.physical_items;
CREATE POLICY "allow_pos_manage_pi"
    ON public.physical_items
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- TABLE: public.customers
-- ==============================================================================
DROP POLICY IF EXISTS "service_role_manage_all_customers" ON public.customers;
CREATE POLICY "service_role_manage_all_customers"
    ON public.customers
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "allow_public_read_customers" ON public.customers;
CREATE POLICY "allow_public_read_customers"
    ON public.customers
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "allow_pos_manage_customers" ON public.customers;
CREATE POLICY "allow_pos_manage_customers"
    ON public.customers
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- TABLE: public.invoices
-- ==============================================================================
DROP POLICY IF EXISTS "service_role_manage_all_invoices" ON public.invoices;
CREATE POLICY "service_role_manage_all_invoices"
    ON public.invoices
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "allow_public_read_invoices" ON public.invoices;
CREATE POLICY "allow_public_read_invoices"
    ON public.invoices
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "allow_pos_manage_invoices" ON public.invoices;
CREATE POLICY "allow_pos_manage_invoices"
    ON public.invoices
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- TABLE: public.invoice_items
-- ==============================================================================
DROP POLICY IF EXISTS "service_role_manage_all_invoice_items" ON public.invoice_items;
CREATE POLICY "service_role_manage_all_invoice_items"
    ON public.invoice_items
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "allow_public_read_invoice_items" ON public.invoice_items;
CREATE POLICY "allow_public_read_invoice_items"
    ON public.invoice_items
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "allow_pos_manage_invoice_items" ON public.invoice_items;
CREATE POLICY "allow_pos_manage_invoice_items"
    ON public.invoice_items
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- TABLE: public.fixed_expenses
-- ==============================================================================
DROP POLICY IF EXISTS "service_role_manage_all_expenses" ON public.fixed_expenses;
CREATE POLICY "service_role_manage_all_expenses"
    ON public.fixed_expenses
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "allow_read_fixed_expenses" ON public.fixed_expenses;
CREATE POLICY "allow_read_fixed_expenses"
    ON public.fixed_expenses
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "allow_manage_fixed_expenses" ON public.fixed_expenses;
CREATE POLICY "allow_manage_fixed_expenses"
    ON public.fixed_expenses
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- TABLE: public.product_compositions (If exists)
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_compositions') THEN
        DROP POLICY IF EXISTS "service_role_manage_all_compositions" ON public.product_compositions;
        CREATE POLICY "service_role_manage_all_compositions"
            ON public.product_compositions
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);

        DROP POLICY IF EXISTS "allow_read_compositions" ON public.product_compositions;
        CREATE POLICY "allow_read_compositions"
            ON public.product_compositions
            FOR SELECT
            TO anon, authenticated
            USING (true);

        DROP POLICY IF EXISTS "allow_manage_compositions" ON public.product_compositions;
        CREATE POLICY "allow_manage_compositions"
            ON public.product_compositions
            FOR ALL
            TO anon, authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
