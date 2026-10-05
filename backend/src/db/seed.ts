import bcrypt from 'bcryptjs';
import { AppDataSource } from '../config/data-source';
import { UserEntity } from '../modules/users/user.entity';
import { BranchEntity } from '../modules/branches/branch.entity';
import { CategoryEntity } from '../modules/categories/category.entity';
import { ProductEntity } from '../modules/products/product.entity';
import { ProductBranchDataEntity } from '../modules/products/product-branch-data.entity';
import { PhysicalItemEntity } from '../modules/physical-items/physical-item.entity';

export async function seedDatabase() {
  console.log('🌱 Seeding database...');

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const branchRepo = AppDataSource.getRepository(BranchEntity);
  const userRepo = AppDataSource.getRepository(UserEntity);
  const categoryRepo = AppDataSource.getRepository(CategoryEntity);
  const productRepo = AppDataSource.getRepository(ProductEntity);
  const branchDataRepo = AppDataSource.getRepository(ProductBranchDataEntity);
  const physicalItemRepo = AppDataSource.getRepository(PhysicalItemEntity);

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

  // 3. Seed Categories
  const initialCategories = [
    { id: 'c1', nameAr: 'خاتم', nameEn: 'Rings' },
    { id: 'c2', nameAr: 'سلسله', nameEn: 'Necklaces' },
    { id: 'c3', nameAr: 'أساور', nameEn: 'Bracelets' },
    { id: 'c4', nameAr: 'حلقان', nameEn: 'Earrings' },
  ];

  for (const cData of initialCategories) {
    const existing = await categoryRepo.findOne({ where: { id: cData.id } });
    if (!existing) {
      const cat = categoryRepo.create(cData);
      await categoryRepo.save(cat);
    }
  }

  // 4. Seed Products
  const initialProducts = [
    {
      id: 'p1',
      nameAr: 'خاتم فضة عيار 925',
      nameEn: 'Sterling Silver Ring 925',
      sku: 'RNG-1001',
      productCode: 'RNG-1001',
      categoryId: 'c1',
      material: 'فضة 925',
      color: 'فضي',
      size: 'أنواع',
      isActive: true,
    },
    {
      id: 'p2',
      nameAr: 'سلسلة فضة أنيقة',
      nameEn: 'Elegant Silver Necklace',
      sku: 'NCK-2001',
      productCode: 'NCK-2001',
      categoryId: 'c2',
      material: 'فضة 925',
      color: 'فضي',
      size: '45 سم',
      isActive: true,
    },
    {
      id: 'p3',
      nameAr: 'إسورة فضة فاخرة',
      nameEn: 'Luxury Silver Bracelet',
      sku: 'BRC-3001',
      productCode: 'BRC-3001',
      categoryId: 'c3',
      material: 'فضة 925',
      color: 'فضي',
      size: 'أنواع',
      isActive: true,
    },
  ];

  for (const pData of initialProducts) {
    const existing = await productRepo.findOne({ where: { id: pData.id } });
    if (!existing) {
      const prod = productRepo.create(pData);
      await productRepo.save(prod);
    }
  }

  // 5. Seed Product Branch Data ONLY for El Maktab Branch (b4) for strict per-branch isolation
  const initialBranchId = 'b4';
  for (const pData of initialProducts) {
    const existingBD = await branchDataRepo.findOne({ where: { productId: pData.id, branchId: initialBranchId } });
    if (!existingBD) {
      const bd = branchDataRepo.create({
        productId: pData.id,
        branchId: initialBranchId,
        cost: 10,
        price1: 25,
        price1Label: 'قطاعي',
        price2: 20,
        price2Label: 'جملة',
        price3: 18,
        price3Label: 'سعر خاص VIP',
        price4: 25,
        price4Label: 'سعر 4',
        minStock: 10,
      });
      await branchDataRepo.save(bd);
    }
  }

  // 6. Seed Physical Items for El Maktab Branch (b4) if table is empty
  const itemCount = await physicalItemRepo.count({ where: { branchId: 'b4' } });
  if (itemCount === 0) {
    const itemsToCreate: Partial<PhysicalItemEntity>[] = [];

    // p1: 50 items
    for (let i = 1; i <= 50; i++) {
      itemsToCreate.push({
        id: `QR-RNG-${i.toString().padStart(4, '0')}`,
        productId: 'p1',
        branchId: 'b4',
        status: 'available',
        serialNumber: i.toString(),
      });
    }

    // p2: 50 items
    for (let i = 1; i <= 50; i++) {
      itemsToCreate.push({
        id: `QR-NCK-${i.toString().padStart(4, '0')}`,
        productId: 'p2',
        branchId: 'b4',
        status: 'available',
        serialNumber: i.toString(),
      });
    }

    // p3: 96 items
    for (let i = 1; i <= 96; i++) {
      itemsToCreate.push({
        id: `QR-BRC-${i.toString().padStart(4, '0')}`,
        productId: 'p3',
        branchId: 'b4',
        status: 'available',
        serialNumber: i.toString(),
      });
    }

    const itemEntities = itemsToCreate.map((item) => physicalItemRepo.create(item));
    await physicalItemRepo.save(itemEntities);
  }

  console.log('✅ Seeding completed successfully!');
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}

