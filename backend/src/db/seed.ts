import bcrypt from 'bcryptjs';
import { AppDataSource } from '../config/data-source';
import { UserEntity } from '../modules/users/user.entity';
import { BranchEntity } from '../modules/branches/branch.entity';

export async function seedDatabase() {
  console.log('🌱 Seeding essential branches & super admin users...');

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const branchRepo = AppDataSource.getRepository(BranchEntity);
  const userRepo = AppDataSource.getRepository(UserEntity);

  // 1. Seed Branches
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
    }
  }

  // 2. Seed Super Admin Users (Bola, Mina & Test)
  const hashedPasswordDefault = await bcrypt.hash('00000000', 10);
  const hashedPasswordTest = await bcrypt.hash('12344321', 10);
  const initialUsers: Partial<UserEntity>[] = [
    { id: 'admin-bola', username: 'bola', name: 'Bola', role: 'admin', password: hashedPasswordDefault, joinDate: '2026-01-01' },
    { id: 'admin-mina', username: 'mina', name: 'Mina', role: 'admin', password: hashedPasswordDefault, joinDate: '2026-01-01' },
    { id: 'admin-test', username: 'test', name: 'Test', role: 'admin', password: hashedPasswordTest, joinDate: '2026-01-01' },
  ];

  for (const uData of initialUsers) {
    const existing = await userRepo.findOne({ where: { username: uData.username } });
    if (!existing) {
      const u = userRepo.create(uData);
      await userRepo.save(u);
    } else {
      existing.name = uData.name!;
      existing.password = uData.password!;
      existing.role = 'admin';
      await userRepo.save(existing);
    }
  }

  console.log('✅ Essential Seeding completed successfully (Branches & Super Admins ready)!');
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
