import bcrypt from 'bcryptjs';
import { AppDataSource } from '../config/data-source';
import { UserEntity } from '../modules/users/user.entity';
import { BranchEntity } from '../modules/branches/branch.entity';

async function resetCleanDatabase() {
  console.log('🔄 Starting Database Reset & Cleanup for Client Handover...');

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  // 1. Wipe Invoices and Invoice Items completely
  console.log('🧹 Wiping invoice_items and invoices...');
  await AppDataSource.query(`DELETE FROM "invoice_items"`);
  await AppDataSource.query(`DELETE FROM "invoices"`);

  // 2. Wipe physical items, fixed expenses, customers test data
  console.log('🧹 Wiping test physical_items, fixed_expenses, customers...');
  await AppDataSource.query(`DELETE FROM "physical_items"`);
  await AppDataSource.query(`DELETE FROM "fixed_expenses"`);
  await AppDataSource.query(`DELETE FROM "customers"`);

  // 3. Clean Users table: Keep ONLY the 3 essential super admin accounts (bola, mina, test)
  console.log('🧹 Cleaning users table to keep ONLY bola, mina, test...');
  await AppDataSource.query(`DELETE FROM "users" WHERE LOWER(username) NOT IN ('bola', 'mina', 'test')`);

  // 4. Ensure the 3 accounts exist with correct roles, zero sales count, and proper passwords
  const userRepo = AppDataSource.getRepository(UserEntity);
  const hashedPasswordDefault = await bcrypt.hash('00000000', 10);
  const hashedPasswordTest = await bcrypt.hash('12344321', 10);

  const targetAdmins = [
    { id: 'admin-bola', username: 'bola', name: 'Bola', role: 'admin' as const, password: hashedPasswordDefault },
    { id: 'admin-mina', username: 'mina', name: 'Mina', role: 'admin' as const, password: hashedPasswordDefault },
    { id: 'admin-test', username: 'test', name: 'Test', role: 'admin' as const, password: hashedPasswordTest },
  ];

  for (const admin of targetAdmins) {
    let existing = await userRepo.findOne({ where: { username: admin.username } });
    if (!existing) {
      existing = userRepo.create({
        id: admin.id,
        username: admin.username,
        name: admin.name,
        role: admin.role,
        password: admin.password,
        salesCount: 0,
        joinDate: '2026-01-01',
      });
      await userRepo.save(existing);
      console.log(`  + Created admin user: ${admin.username}`);
    } else {
      existing.role = 'admin';
      existing.salesCount = 0;
      existing.branchId = undefined;
      // preserve existing password
      if (!existing.password) {
        existing.password = admin.password;
      }
      await userRepo.save(existing);
      console.log(`  ✓ Updated admin user: ${admin.username}`);
    }
  }

  // 5. Ensure the 4 primary branches exist
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
      console.log(`  + Created branch: ${bData.nameAr}`);
    }
  }

  // Verification report
  const finalUsers = await AppDataSource.query(`SELECT id, username, role, "salesCount" FROM "users"`);
  const finalInvoices = await AppDataSource.query(`SELECT count(*) FROM "invoices"`);
  const finalInvoiceItems = await AppDataSource.query(`SELECT count(*) FROM "invoice_items"`);
  const finalCustomers = await AppDataSource.query(`SELECT count(*) FROM "customers"`);
  const finalExpenses = await AppDataSource.query(`SELECT count(*) FROM "fixed_expenses"`);

  console.log('\n================ Verification Report ================');
  console.log('Users remaining:', finalUsers);
  console.log('Invoices count:', finalInvoices[0].count);
  console.log('Invoice Items count:', finalInvoiceItems[0].count);
  console.log('Customers count:', finalCustomers[0].count);
  console.log('Fixed Expenses count:', finalExpenses[0].count);
  console.log('====================================================\n');

  console.log('✅ Database reset successfully completed for client handover!');
  await AppDataSource.destroy();
}

resetCleanDatabase().catch((err) => {
  console.error('❌ Reset failed:', err);
  process.exit(1);
});
