process.env.DB_SCHEMA = 'test_isolation';
import { AppDataSource } from '../config/data-source';
import { CategoryEntity } from '../modules/categories/category.entity';

async function testIsolation() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  // 1. Get counts in public and test_isolation before
  const publicCountBefore = await AppDataSource.query(`SELECT COUNT(*)::int AS cnt FROM public.categories`);
  const testCountBefore = await AppDataSource.query(`SELECT COUNT(*)::int AS cnt FROM test_isolation.categories`);
  console.log('BEFORE: public.categories =', publicCountBefore[0].cnt, '| test_isolation.categories =', testCountBefore[0].cnt);

  // 2. Insert through TypeORM repository
  const catRepo = AppDataSource.getRepository(CategoryEntity);
  const testCat = await catRepo.save({
    id: `test_iso_check_${Date.now()}`,
    nameAr: 'فئة عزل اختباري',
    nameEn: 'Isolated Test Category',
    branchId: 'b1',
  });
  console.log('Saved category via TypeORM repository:', testCat.id);

  // 3. Get counts in public and test_isolation after
  const publicCountAfter = await AppDataSource.query(`SELECT COUNT(*)::int AS cnt FROM public.categories`);
  const testCountAfter = await AppDataSource.query(`SELECT COUNT(*)::int AS cnt FROM test_isolation.categories`);
  console.log('AFTER:  public.categories =', publicCountAfter[0].cnt, '| test_isolation.categories =', testCountAfter[0].cnt);

  // 4. Verify that public count remained IDENTICAL
  if (publicCountBefore[0].cnt !== publicCountAfter[0].cnt) {
    throw new Error('LEAK DETECTED: public.categories was modified!');
  } else {
    console.log('🎉 PROOF VERIFIED: public.categories was completely untouched (0 changes)!');
  }

  // Clean up from test_isolation
  await AppDataSource.query(`DELETE FROM test_isolation.categories WHERE id = $1`, [testCat.id]);
  await AppDataSource.destroy();
}

testIsolation().catch((err) => {
  console.error('Isolation check failed:', err);
  process.exit(1);
});
