-- ==============================================================================
-- SUPABASE POSTGRESQL SECURITY REMEDIATION: RESTORE RLS & SECURE ALL TABLES
-- Date: 2026-10-13
-- Description:
--   1. Re-enables Row Level Security (RLS) on all public tables after unauthorized
--      disabling in legacy scripts.
--   2. Revokes blanket grants (GRANT ALL) from public roles: anon, authenticated, PUBLIC.
--   3. Secures 'suppliers' and all core business tables.
--   4. Eliminates PostgREST direct access to sensitive columns and tables.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. REVOKE UNRESTRICTED PERMISSIONS FROM ANON, AUTHENTICATED & PUBLIC
-- ------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated, PUBLIC;

-- Reset default privileges so future tables are not granted to public roles
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated, PUBLIC;

-- Ensure service_role (backend application connection) retains required operational permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- ------------------------------------------------------------------------------
-- 2. CREATE AND SECURE 'suppliers' TABLE
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 3. RE-ENABLE ROW LEVEL SECURITY (RLS) ON ALL AUDITED TABLES
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
ALTER TABLE IF EXISTS public.suppliers ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 4. HARDEN RLS POLICIES FOR ALL TABLES (SERVICE_ROLE ONLY)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "service_role_manage_all_users" ON public.users;
CREATE POLICY "service_role_manage_all_users" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manage_all_branches" ON public.branches;
CREATE POLICY "service_role_manage_all_branches" ON public.branches FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manage_all_categories" ON public.categories;
CREATE POLICY "service_role_manage_all_categories" ON public.categories FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manage_all_products" ON public.products;
CREATE POLICY "service_role_manage_all_products" ON public.products FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manage_all_pbd" ON public.product_branch_data;
CREATE POLICY "service_role_manage_all_pbd" ON public.product_branch_data FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manage_all_pi" ON public.physical_items;
CREATE POLICY "service_role_manage_all_pi" ON public.physical_items FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manage_all_customers" ON public.customers;
CREATE POLICY "service_role_manage_all_customers" ON public.customers FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manage_all_invoices" ON public.invoices;
CREATE POLICY "service_role_manage_all_invoices" ON public.invoices FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manage_all_invoice_items" ON public.invoice_items;
CREATE POLICY "service_role_manage_all_invoice_items" ON public.invoice_items FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manage_all_expenses" ON public.fixed_expenses;
CREATE POLICY "service_role_manage_all_expenses" ON public.fixed_expenses FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manage_all_compositions" ON public.product_compositions;
CREATE POLICY "service_role_manage_all_compositions" ON public.product_compositions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manage_all_suppliers" ON public.suppliers;
CREATE POLICY "service_role_manage_all_suppliers" ON public.suppliers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5. CONFIRMATION VERIFICATION
-- ------------------------------------------------------------------------------
-- Ensure no public policy permits unrestricted read or write
DROP POLICY IF EXISTS "allow_read_safe_user_profiles" ON public.users;
DROP POLICY IF EXISTS "allow_all_branches" ON public.branches;
DROP POLICY IF EXISTS "allow_all_categories" ON public.categories;
DROP POLICY IF EXISTS "allow_all_products" ON public.products;
