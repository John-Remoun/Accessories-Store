import bcrypt from 'bcryptjs';
import { AppDataSource } from '../config/data-source';
import { UserEntity } from '../modules/users/user.entity';
import { BranchEntity } from '../modules/branches/branch.entity';

export async function seedDatabase() {
  console.log('🌱 Checking essential branches & initial admin accounts...');

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const branchRepo = AppDataSource.getRepository(BranchEntity);
  const userRepo = AppDataSource.getRepository(UserEntity);

  // 1. Seed Branches if not exist
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

  // 2. Seed Initial Admin Users ONLY if they do not already exist
  // We NEVER overwrite existing passwords on server startup!
  const initialUsers: Partial<UserEntity>[] = [
    { id: 'admin-bola', username: 'bola', name: 'Bola', role: 'admin', joinDate: '2026-01-01' },
    { id: 'admin-mina', username: 'mina', name: 'Mina', role: 'admin', joinDate: '2026-01-01' },
    { id: 'admin-test', username: 'test', name: 'Test', role: 'admin', joinDate: '2026-01-01' },
  ];

  for (const uData of initialUsers) {
    const existing = await userRepo.findOne({ where: { username: uData.username } });
    if (!existing) {
      const defaultPassword = uData.username === 'test' ? '12344321' : '00000000';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);
      const u = userRepo.create({
        ...uData,
        password: hashedPassword,
      });
      await userRepo.save(u);
      console.log(`Initialized initial admin account: ${uData.username}`);
    }
  }

  console.log('✅ Initial database verification complete.');
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
