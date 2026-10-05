import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1700000000000 implements MigrationInterface {
    name = 'InitialMigration1700000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "users" (
                "id" character varying(100) NOT NULL,
                "username" character varying(100) NOT NULL,
                "name" character varying(150) NOT NULL,
                "role" character varying(20) NOT NULL DEFAULT 'employee',
                "password" character varying(255) NOT NULL,
                "branchId" character varying(100),
                "profileImage" character varying(500),
                "joinDate" character varying(50),
                "salesCount" integer NOT NULL DEFAULT 0,
                "phone" character varying(50),
                "email" character varying(150),
                "refreshToken" character varying(500),
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_users_username" UNIQUE ("username"),
                CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "branches" (
                "id" character varying(100) NOT NULL,
                "nameEn" character varying(150) NOT NULL,
                "nameAr" character varying(150) NOT NULL,
                "location" character varying(300) NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_branches_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "categories" (
                "id" character varying(100) NOT NULL,
                "nameEn" character varying(150) NOT NULL,
                "nameAr" character varying(150) NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_categories_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "products" (
                "id" character varying(100) NOT NULL,
                "nameEn" character varying(200) NOT NULL,
                "nameAr" character varying(200) NOT NULL,
                "descriptionEn" text NOT NULL DEFAULT '',
                "descriptionAr" text NOT NULL DEFAULT '',
                "categoryId" character varying(100) NOT NULL,
                "subcategoryId" character varying(100),
                "imageUrl" character varying(500),
                "sku" character varying(100) NOT NULL,
                "productCode" character varying(100) NOT NULL,
                "material" character varying(100) NOT NULL,
                "color" character varying(100) NOT NULL,
                "size" character varying(100) NOT NULL,
                "brand" character varying(100),
                "notes" text,
                "isActive" boolean NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_products_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_products_category" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "product_branch_data" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "productId" character varying(100) NOT NULL,
                "branchId" character varying(100) NOT NULL,
                "cost" numeric(12,2) NOT NULL DEFAULT 0,
                "price1" numeric(12,2) NOT NULL DEFAULT 0,
                "price1Label" character varying(100) NOT NULL DEFAULT 'قطاعي',
                "price2" numeric(12,2) NOT NULL DEFAULT 0,
                "price2Label" character varying(100) NOT NULL DEFAULT 'جملة',
                "price3" numeric(12,2) NOT NULL DEFAULT 0,
                "price3Label" character varying(100) NOT NULL DEFAULT 'سعر خاص VIP',
                "price4" numeric(12,2) NOT NULL DEFAULT 0,
                "price4Label" character varying(100) NOT NULL DEFAULT 'سعر 4',
                "minStock" integer NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_product_branch_data_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_pbd_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_pbd_branch" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_product_branch_unique" ON "product_branch_data" ("productId", "branchId")
        `);

        await queryRunner.query(`
            CREATE TABLE "physical_items" (
                "id" character varying(100) NOT NULL,
                "productId" character varying(100) NOT NULL,
                "branchId" character varying(100) NOT NULL,
                "status" character varying(50) NOT NULL DEFAULT 'available',
                "serialNumber" character varying(100) NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_physical_items_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_pi_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_pi_branch" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "customers" (
                "id" character varying(100) NOT NULL,
                "name" character varying(150) NOT NULL,
                "phone" character varying(50) NOT NULL,
                "email" character varying(150),
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_customers_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "invoices" (
                "id" character varying(100) NOT NULL,
                "invoiceNumber" character varying(100) NOT NULL,
                "branchId" character varying(100) NOT NULL,
                "employeeId" character varying(100) NOT NULL,
                "customerId" character varying(100),
                "customerName" character varying(150),
                "customerPhone" character varying(50),
                "date" character varying(100) NOT NULL,
                "subtotal" numeric(12,2) NOT NULL DEFAULT 0,
                "discount" numeric(12,2) NOT NULL DEFAULT 0,
                "total" numeric(12,2) NOT NULL DEFAULT 0,
                "totalCost" numeric(12,2) NOT NULL DEFAULT 0,
                "netProfit" numeric(12,2) NOT NULL DEFAULT 0,
                "paymentMethod" character varying(50) NOT NULL DEFAULT 'cash',
                "paymentStatus" character varying(50) NOT NULL DEFAULT 'paid',
                "paymentSubMethod" character varying(50),
                "paidAmount" numeric(12,2) NOT NULL DEFAULT 0,
                "remainingAmount" numeric(12,2) NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_invoices_invoiceNumber" UNIQUE ("invoiceNumber"),
                CONSTRAINT "PK_invoices_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_invoices_branch" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT,
                CONSTRAINT "FK_invoices_employee" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE RESTRICT
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "invoice_items" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "invoiceId" character varying(100) NOT NULL,
                "productId" character varying(100) NOT NULL,
                "physicalItemId" character varying(100) NOT NULL,
                "unitPrice" numeric(12,2) NOT NULL DEFAULT 0,
                "unitCost" numeric(12,2) NOT NULL DEFAULT 0,
                "quantity" integer NOT NULL DEFAULT 1,
                "profit" numeric(12,2) NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_invoice_items_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_invoice_items_invoice" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_invoice_items_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT,
                CONSTRAINT "FK_invoice_items_physical_item" FOREIGN KEY ("physicalItemId") REFERENCES "physical_items"("id") ON DELETE RESTRICT
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "fixed_expenses" (
                "id" character varying(100) NOT NULL,
                "branchId" character varying(100) NOT NULL,
                "title" character varying(200) NOT NULL,
                "amount" numeric(12,2) NOT NULL DEFAULT 0,
                "type" character varying(50) NOT NULL DEFAULT 'monthly',
                "date" character varying(50) NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_fixed_expenses_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_fixed_expenses_branch" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "product_compositions" (
                "id" character varying(100) NOT NULL,
                "branchId" character varying(100) NOT NULL,
                "name" character varying(200) NOT NULL,
                "quantity" integer NOT NULL DEFAULT 0,
                "price1" numeric(12,2) NOT NULL DEFAULT 0,
                "price2" numeric(12,2) NOT NULL DEFAULT 0,
                "price3" numeric(12,2) NOT NULL DEFAULT 0,
                "price4" numeric(12,2),
                "totalCost" numeric(12,2) NOT NULL DEFAULT 0,
                "internalComponents" jsonb NOT NULL,
                "externalComponents" jsonb NOT NULL,
                "createdProductId" character varying(100),
                "createdAt" character varying(100) NOT NULL,
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_product_compositions_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_compositions_branch" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "product_compositions"`);
        await queryRunner.query(`DROP TABLE "fixed_expenses"`);
        await queryRunner.query(`DROP TABLE "invoice_items"`);
        await queryRunner.query(`DROP TABLE "invoices"`);
        await queryRunner.query(`DROP TABLE "customers"`);
        await queryRunner.query(`DROP TABLE "physical_items"`);
        await queryRunner.query(`DROP INDEX "IDX_product_branch_unique"`);
        await queryRunner.query(`DROP TABLE "product_branch_data"`);
        await queryRunner.query(`DROP TABLE "products"`);
        await queryRunner.query(`DROP TABLE "categories"`);
        await queryRunner.query(`DROP TABLE "branches"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }
}
