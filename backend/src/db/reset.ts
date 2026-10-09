import 'reflect-metadata';
import { AppDataSource } from '../config/data-source';
import { seedDatabase } from './seed';

export async function resetDatabaseToCleanState() {
  console.log('🧹 Clearing all transactional data from PostgreSQL Database...');

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // Truncate tables with CASCADE
    await queryRunner.query(`TRUNCATE TABLE "physical_items", "invoice_items", "invoices", "product_compositions", "product_branch_data", "products", "categories", "customers", "fixed_expenses" CASCADE;`);
    
    // Ensure invoice_items schema is relaxed to allow transient items and compositions without foreign key errors
    try {
      await queryRunner.query(`ALTER TABLE "invoice_items" DROP CONSTRAINT IF EXISTS "FK_invoice_items_product";`);
      await queryRunner.query(`ALTER TABLE "invoice_items" DROP CONSTRAINT IF EXISTS "FK_invoice_items_physical_item";`);
      await queryRunner.query(`ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "productName" character varying(255);`);
      await queryRunner.query(`ALTER TABLE "invoice_items" ALTER COLUMN "productId" DROP NOT NULL;`);
      await queryRunner.query(`ALTER TABLE "invoice_items" ALTER COLUMN "physicalItemId" DROP NOT NULL;`);
    } catch (e) {
      console.warn('Schema relaxation notice:', e);
    }

    await queryRunner.commitTransaction();
    console.log('✅ All categories, products, physical items, invoices, customers, and expenses cleared successfully!');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('❌ Failed to truncate tables, attempting row deletion fallback:', error);

    // Fallback: Delete rows individually
    await AppDataSource.getRepository('physical_items').delete({});
    await AppDataSource.getRepository('invoice_items').delete({});
    await AppDataSource.getRepository('invoices').delete({});
    await AppDataSource.getRepository('product_compositions').delete({});
    await AppDataSource.getRepository('product_branch_data').delete({});
    await AppDataSource.getRepository('products').delete({});
    await AppDataSource.getRepository('categories').delete({});
    await AppDataSource.getRepository('customers').delete({});
    await AppDataSource.getRepository('fixed_expenses').delete({});
  } finally {
    await queryRunner.release();
  }

  // Ensure default super admins and branches exist
  await seedDatabase();
  console.log('🎉 Database fully reset to ZERO with Super Admin accounts ready!');
}

if (require.main === module) {
  resetDatabaseToCleanState()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Reset failed:', err);
      process.exit(1);
    });
}
