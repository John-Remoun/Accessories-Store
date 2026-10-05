import { AppDataSource } from '../config/data-source';
import { seedDatabase } from './seed';

async function cleanTestData() {
  console.log('🧹 Cleaning test data from PostgreSQL database...');
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // Delete transactional and inventory data while keeping users and branches
    await queryRunner.query(`DELETE FROM "invoice_items";`);
    await queryRunner.query(`DELETE FROM "invoices";`);
    await queryRunner.query(`DELETE FROM "customers";`);
    await queryRunner.query(`DELETE FROM "physical_items";`);
    await queryRunner.query(`DELETE FROM "product_branch_data";`);
    await queryRunner.query(`DELETE FROM "products";`);
    await queryRunner.query(`DELETE FROM "categories";`);

    await queryRunner.commitTransaction();
    console.log('✅ PostgreSQL test data cleaned successfully!');
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error('❌ Error cleaning PostgreSQL test data:', err);
  } finally {
    await queryRunner.release();
  }

  // Ensure super admin users and branches exist
  await seedDatabase();
}

cleanTestData().then(() => process.exit(0)).catch(() => process.exit(1));
