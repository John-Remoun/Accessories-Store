import bcrypt from 'bcryptjs';
import { AppDataSource } from '../config/data-source';
import { UserEntity } from '../modules/users/user.entity';
import { BranchEntity } from '../modules/branches/branch.entity';
import { env } from '../config/env.config';

export async function seedDatabase(options?: { isProductionOverride?: boolean }) {
  const isProd = options?.isProductionOverride !== undefined
    ? options.isProductionOverride
    : (env.isProduction || process.env.NODE_ENV === 'production');

  console.log(`🌱 Checking essential branches & initialization policy [Mode: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT/TEST'}]...`);

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const branchRepo = AppDataSource.getRepository(BranchEntity);
  const userRepo = AppDataSource.getRepository(UserEntity);

  // 1. Seed Essential Branches if not exist (Structural lookup data required for FK integrity)
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
      console.log(`Initialized essential branch: ${bData.id} (${bData.nameEn})`);
    }
  }

  // 2. Production Security Policy:
  // In production, NEVER silently create accounts with hardcoded default passwords!
  if (isProd) {
    console.log('🔒 [SECURITY] Production environment active: Hardcoded default administrator seeding is DISABLED.');

    const adminCount = await userRepo.count({ where: { role: 'admin' } });

    if (adminCount > 0) {
      console.log(`✅ [SECURITY] Verified ${adminCount} administrator account(s) present in database. No bootstrap user seeding required.`);
      return;
    }

    // Special bootstrap case: Brand-new blank production database with ZERO admins
    const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    const bootstrapUsername = (process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin').trim();

    if (bootstrapPassword && bootstrapPassword.trim().length >= 12) {
      console.log(`🛡️ [SECURITY] Initializing secure bootstrap administrator '${bootstrapUsername}' from BOOTSTRAP_ADMIN_PASSWORD...`);
      const hashedPassword = await bcrypt.hash(bootstrapPassword.trim(), 10);
      const bootstrapAdmin = userRepo.create({
        id: `admin-${Date.now()}`,
        username: bootstrapUsername,
        name: 'System Administrator',
        role: 'admin',
        password: hashedPassword,
        joinDate: new Date().toISOString().split('T')[0],
      });
      await userRepo.save(bootstrapAdmin);
      console.log(`✅ [SECURITY] Secure bootstrap administrator '${bootstrapUsername}' initialized successfully.`);
    } else {
      console.warn('⚠️ [SECURITY ALERT] Production database contains zero administrator accounts!');
      console.warn('⚠️ Default account creation was blocked for safety. To bootstrap a new system, provide BOOTSTRAP_ADMIN_PASSWORD (min 12 chars) in environment variables or provision an admin account directly.');
    }
    return;
  }

  // 3. Development / Test Environment Initialization:
  // Allowed ONLY when isProd === false. Creates standard dev accounts for local developer convenience.
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
      console.log(`[DEV ONLY] Initialized dev account: ${uData.username}`);
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
