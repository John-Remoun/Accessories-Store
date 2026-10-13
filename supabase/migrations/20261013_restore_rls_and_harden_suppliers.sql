-- ==============================================================================
-- SUPABASE POSTGRESQL SECURITY REMEDIATION: RESTORE RLS & SECURE SUPPLIERS
-- Date: 2026-10-13
-- Description:
--   1. Re-enables Row Level Security (RLS) on all public tables after unauthorized
--      disabling in fix-rls-and-suppliers.ts.
--   2. Revokes dangerous blanket grants (GRANT ALL) from the public/anon role.
--   3. Secures the 'suppliers' table with RLS and restricts access to 'service_role'.
--   4. Enforces least-privilege access for PostgREST public clients.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. REVOKE UNRESTRICTED PERMISSIONS ACCIDENTALLY GRANTED TO ANON & PUBLIC
-- ------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

-- Reset default privileges so newly created tables are not automatically granted to anon
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

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
-- 4. HARDEN 'suppliers' RLS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "service_role_manage_all_suppliers" ON public.suppliers;
CREATE POLICY "service_role_manage_all_suppliers"
    ON public.suppliers
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Explicitly ensure anon role CANNOT read or write suppliers
REVOKE ALL ON TABLE public.suppliers FROM anon, public;

-- ------------------------------------------------------------------------------
-- 5. ENSURE CRITICAL CREDENTIAL COLUMNS IN public.users REMAIN UNREADABLE VIA ANON
-- ------------------------------------------------------------------------------
REVOKE ALL ON TABLE public.users FROM anon, public;

-- Grant selective safe profile columns ONLY if anon profile lookup is needed
GRANT SELECT (
    id,
    username,
    name,
    role,
    "branchId",
    "profileImage",
    "joinDate",
    phone,
    email,
    "createdAt"
) ON TABLE public.users TO anon, authenticated;

-- Ensure password and refreshToken columns are NEVER readable by anon/authenticated
-- (They can only be accessed by service_role via backend TypeORM)
GRANT ALL ON TABLE public.users TO service_role;
