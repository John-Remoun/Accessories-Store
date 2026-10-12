import bcrypt from 'bcryptjs';
import { AppDataSource } from '../config/data-source';
import { UserEntity } from '../modules/users/user.entity';
import { BranchEntity } from '../modules/branches/branch.entity';

export async function executeFullReset() {
  console.log('====================================================');
  console.log('🔄 STARTING COMPREHENSIVE DATABASE RESET...');
  console.log('====================================================');

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    console.log('🧹 1. Truncating all transactional & inventory tables...');
    
    // Clear invoice items, invoices, compositions, physical items, branch product data, products, categories, customers, fixed expenses
    await queryRunner.query(`
      TRUNCATE TABLE 
        "invoice_items",
        "invoices",
        "product_compositions",
        "physical_items",
        "product_branch_data",
        "products",
        "categories",
        "customers",
        "fixed_expenses"
      CASCADE;
    `);
    console.log('   ✓ Invoices, products, categories, physical items, and customers wiped completely.');
  } catch (err) {
    console.warn('   ⚠️ Truncate cascade error, applying individual DELETE fallbacks:', err);
    await queryRunner.query(`DELETE FROM "invoice_items"`);
    await queryRunner.query(`DELETE FROM "invoices"`);
    await queryRunner.query(`DELETE FROM "product_compositions"`);
    await queryRunner.query(`DELETE FROM "physical_items"`);
    await queryRunner.query(`DELETE FROM "product_branch_data"`);
    await queryRunner.query(`DELETE FROM "products"`);
    await queryRunner.query(`DELETE FROM "categories"`);
    await queryRunner.query(`DELETE FROM "customers"`);
    await queryRunner.query(`DELETE FROM "fixed_expenses"`);
  } finally {
    await queryRunner.release();
  }

  // 2. Clean Users: Delete any user other than bola, mina, test
  console.log('🧹 2. Cleaning Users table (keeping ONLY bola, mina, test)...');
  await AppDataSource.query(`DELETE FROM "users" WHERE LOWER(username) NOT IN ('bola', 'mina', 'test');`);

  // 3. Setup and verify the 3 accounts with exact required passwords
  console.log('🔑 3. Setting exact credentials for the 3 accounts...');
  const userRepo = AppDataSource.getRepository(UserEntity);
  const hash00000000 = await bcrypt.hash('00000000', 10);
  const hash12344321 = await bcrypt.hash('12344321', 10);

  const targetUsers = [
    {
      id: 'admin-bola',
      username: 'bola',
      name: 'Bola',
      role: 'admin' as const,
      password: hash00000000,
      expectedPass: '00000000',
    },
    {
      id: 'admin-mina',
      username: 'mina',
      name: 'Mina',
      role: 'admin' as const,
      password: hash00000000,
      expectedPass: '00000000',
    },
    {
      id: 'admin-test',
      username: 'test',
      name: 'Test',
      role: 'admin' as const,
      password: hash12344321,
      expectedPass: '12344321',
    },
  ];

  for (const target of targetUsers) {
    let user = await userRepo.findOne({ where: { username: target.username } });
    if (!user) {
      user = userRepo.create({
        id: target.id,
        username: target.username,
        name: target.name,
        role: target.role,
        password: target.password,
        salesCount: 0,
        joinDate: '2026-01-01',
      });
      await userRepo.save(user);
      console.log(`   + Created account: ${target.username} (Password: ${target.expectedPass})`);
    } else {
      user.name = target.name;
      user.role = target.role;
      user.password = target.password;
      user.salesCount = 0;
      user.branchId = undefined;
      await userRepo.save(user);
      console.log(`   ✓ Updated account: ${target.username} (Password updated to: ${target.expectedPass})`);
    }
  }

  // 4. Ensure the 4 primary store branches exist
  console.log('🏢 4. Ensuring essential branches exist...');
  const branchRepo = AppDataSource.getRepository(BranchEntity);
  const initialBranches = [
    { id: 'b4', nameEn: 'El Maktab Branch', nameAr: 'فرع المكتب', location: 'بني سويف - المكتب الرئيسي' },
    { id: 'b1', nameEn: 'Ahmed Orabi Branch', nameAr: 'فرع أحمد عرابي', location: 'بني سويف - ش/ أحمد عرابي أمام مول النصر' },
    { id: 'b2', nameEn: 'El Modereya Branch', nameAr: 'فرع ميدان المديرية', location: 'بني سويف - ميدان المديرية خلف استوديو وان' },
    { id: 'b3', nameEn: 'Corniche Branch', nameAr: 'فرع كورنيش النيل', location: 'بني سويف - كورنيش النيل بوابة ٢ أمام لاميرا' },
  ];

  for (const bData of initialBranches) {
    const existing = await branchRepo.findOne({ where: { id: bData.id } });
    if (!existing) {
      const b = branchRepo.create(bData);
      await branchRepo.save(b);
      console.log(`   + Created branch: ${bData.nameAr}`);
    }
  }

  // 5. Verification Report
  console.log('\n====================================================');
  console.log('📊 DATABASE VERIFICATION REPORT AFTER RESET:');
  console.log('====================================================');

  const tableList = [
    'products',
    'categories',
    'product_branch_data',
    'physical_items',
    'product_compositions',
    'invoices',
    'invoice_items',
    'customers',
    'fixed_expenses',
    'branches',
    'users',
  ];

  const countsQuery = `
    SELECT 
      (SELECT count(*) FROM "products") AS products,
      (SELECT count(*) FROM "categories") AS categories,
      (SELECT count(*) FROM "product_branch_data") AS product_branch_data,
      (SELECT count(*) FROM "physical_items") AS physical_items,
      (SELECT count(*) FROM "product_compositions") AS product_compositions,
      (SELECT count(*) FROM "invoices") AS invoices,
      (SELECT count(*) FROM "invoice_items") AS invoice_items,
      (SELECT count(*) FROM "customers") AS customers,
      (SELECT count(*) FROM "fixed_expenses") AS fixed_expenses,
      (SELECT count(*) FROM "branches") AS branches,
      (SELECT count(*) FROM "users") AS users
  `;
  const countsRes = await AppDataSource.query(countsQuery);
  const row = countsRes[0];
  console.log('Row counts in DB:');
  for (const [key, val] of Object.entries(row)) {
    console.log(`- ${key}: ${val} rows`);
  }

  const finalUsers = await AppDataSource.query(`SELECT id, username, name, role, password FROM "users" ORDER BY username ASC`);
  console.log('\nVerified Active Users in DB:');
  for (const u of finalUsers) {
    const isBolaMinaPass = await bcrypt.compare('00000000', u.password || '');
    const isTestPass = await bcrypt.compare('12344321', u.password || '');
    const verifiedPass = isBolaMinaPass ? '00000000 (VALID)' : isTestPass ? '12344321 (VALID)' : 'INVALID';
    console.log(`- Username: "${u.username}", Role: "${u.role}", Name: "${u.name}", Password Match: ${verifiedPass}`);
  }

  console.log('====================================================');
  console.log('✅ DATABASE FULL RESET COMPLETED SUCCESSFULLY!');
  console.log('====================================================\n');

  await AppDataSource.destroy();
}

if (require.main === module) {
  executeFullReset()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Reset failed:', err);
      process.exit(1);
    });
}
