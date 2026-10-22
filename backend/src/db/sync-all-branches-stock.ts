import { AppDataSource } from '../config/data-source';
import { BranchEntity } from '../modules/branches/branch.entity';
import { ProductEntity } from '../modules/products/product.entity';
import { ProductBranchDataEntity } from '../modules/products/product-branch-data.entity';
import { PhysicalItemEntity } from '../modules/physical-items/physical-item.entity';

export async function syncAllBranchesProducts() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const branchRepo = AppDataSource.getRepository(BranchEntity);
  const prodRepo = AppDataSource.getRepository(ProductEntity);
  const pbdRepo = AppDataSource.getRepository(ProductBranchDataEntity);
  const physRepo = AppDataSource.getRepository(PhysicalItemEntity);

  console.log('⚡ Loading all products, branches, existing pricing, and physical items...');
  const [branches, products, allExistingPbd, allExistingPhys] = await Promise.all([
    branchRepo.find(),
    prodRepo.find(),
    pbdRepo.find(),
    physRepo.find({ select: ['id', 'productId', 'branchId'] }),
  ]);

  console.log(`Checking ${products.length} products across ${branches.length} branches...`);

  // Build quick lookup maps
  const pbdMap = new Set<string>();
  const pbdByProduct = new Map<string, ProductBranchDataEntity>();
  allExistingPbd.forEach(pbd => {
    pbdMap.add(`${pbd.productId}_${pbd.branchId}`);
    if (!pbdByProduct.has(pbd.productId)) {
      pbdByProduct.set(pbd.productId, pbd);
    }
  });

  const physMap = new Set<string>();
  allExistingPhys.forEach(ph => {
    physMap.add(`${ph.productId}_${ph.branchId}`);
  });

  const pbdToInsert: ProductBranchDataEntity[] = [];
  const physToInsert: PhysicalItemEntity[] = [];

  for (const product of products) {
    const samplePbd = pbdByProduct.get(product.id);

    const cost = samplePbd ? Number(samplePbd.cost) : 0;
    const price1 = samplePbd ? Number(samplePbd.price1) : 0;
    const price1Label = samplePbd?.price1Label || 'سعر 1';
    const price2 = samplePbd ? Number(samplePbd.price2) : price1;
    const price2Label = samplePbd?.price2Label || 'سعر 2';
    const price3 = samplePbd ? Number(samplePbd.price3) : price1;
    const price3Label = samplePbd?.price3Label || 'سعر 3';
    const price4 = samplePbd ? Number(samplePbd.price4) : price1;
    const price4Label = samplePbd?.price4Label || 'سعر 4';
    const minStock = samplePbd ? Number(samplePbd.minStock) : 10;

    const prefix = (product.sku || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'ITM';

    for (const branch of branches) {
      const pbdKey = `${product.id}_${branch.id}`;
      if (!pbdMap.has(pbdKey)) {
        pbdToInsert.push(
          pbdRepo.create({
            productId: product.id,
            branchId: branch.id,
            cost,
            price1,
            price1Label,
            price2,
            price2Label,
            price3,
            price3Label,
            price4,
            price4Label,
            minStock,
            quantity: 0,
          })
        );
        pbdMap.add(pbdKey);
      }

      const physKey = `${product.id}_${branch.id}`;
      if (!physMap.has(physKey)) {
        const uniqueSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        physToInsert.push(
          physRepo.create({
            id: `QR-${prefix}-${branch.id}-${uniqueSuffix}`,
            productId: product.id,
            branchId: branch.id,
            status: 'available',
            serialNumber: prefix,
          })
        );
        physMap.add(physKey);
      }
    }
  }

  if (pbdToInsert.length > 0) {
    console.log(`📦 Bulk inserting ${pbdToInsert.length} missing product_branch_data records in batches of 200...`);
    for (let i = 0; i < pbdToInsert.length; i += 200) {
      await pbdRepo.save(pbdToInsert.slice(i, i + 200));
      console.log(`  Saved batch ${Math.min(i + 200, pbdToInsert.length)} / ${pbdToInsert.length}`);
    }
    console.log(`✅ Successfully synced ${pbdToInsert.length} product_branch_data records!`);
  } else {
    console.log('✅ All branches already have complete product branch data.');
  }

  if (physToInsert.length > 0) {
    console.log(`🏷️ Bulk inserting ${physToInsert.length} physical QR items in batches of 200...`);
    for (let i = 0; i < physToInsert.length; i += 200) {
      await physRepo.save(physToInsert.slice(i, i + 200));
      console.log(`  Saved batch ${Math.min(i + 200, physToInsert.length)} / ${physToInsert.length}`);
    }
    console.log(`✅ Successfully synced ${physToInsert.length} physical items!`);
  } else {
    console.log('✅ All branches already have physical items.');
  }

  // Print final summary
  const summary = await AppDataSource.query(`
    SELECT "branchId", count(*) as total_products, sum(quantity) as total_qty 
    FROM product_branch_data 
    GROUP BY "branchId"
    ORDER BY "branchId"
  `);
  console.log('📊 FINAL SUMMARY OF PRODUCTS PER BRANCH:', summary);
}

if (require.main === module) {
  syncAllBranchesProducts()
    .then(() => AppDataSource.destroy())
    .catch((err) => {
      console.error('Sync failed:', err);
      process.exit(1);
    });
}
