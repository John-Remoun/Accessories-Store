import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPerformanceIndexes1700000000002 implements MigrationInterface {
    name = 'AddPerformanceIndexes1700000000002';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Invoices indexes for fast sorting, date filtering and branch isolation
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_invoices_created_at" ON "invoices" ("createdAt" DESC);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_invoices_branchId" ON "invoices" ("branchId");`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_invoices_customerId" ON "invoices" ("customerId");`);

        // 2. Invoice items foreign key index (essential for join and cascade performance)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_invoice_items_invoiceId" ON "invoice_items" ("invoiceId");`);

        // 3. Customer search by phone (eliminates sequential full-table scans)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_customers_phone" ON "customers" ("phone");`);

        // 4. Physical items composite index for stock check and status filtering
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_physical_items_lookup" ON "physical_items" ("productId", "branchId", "status");`);

        // 5. Fixed expenses branch & date indexing for monthly/daily report filtering
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_fixed_expenses_branch_date" ON "fixed_expenses" ("branchId", "date");`);

        // 6. Products category filtering index
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_products_categoryId" ON "products" ("categoryId");`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_categoryId";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fixed_expenses_branch_date";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_physical_items_lookup";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_customers_phone";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoice_items_invoiceId";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_customerId";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_branchId";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_created_at";`);
    }
}
