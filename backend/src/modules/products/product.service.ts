import { AppDataSource } from '../../config/data-source';
import { ProductEntity } from './product.entity';
import { ProductBranchDataEntity } from './product-branch-data.entity';
import { BranchEntity } from '../branches/branch.entity';
import { PhysicalItemEntity } from '../physical-items/physical-item.entity';
import { AppError } from '../../common/exceptions/app-error';
import { memoryCache } from '../../common/cache/cache.service';
import { bumpSyncVersion } from '../../common/sync/sync-version';
import { broadcastProductCreated, broadcastProductUpdated, broadcastProductDeleted, broadcastStockUpdate } from '../../common/socket/socket.service';

export const MAX_LIST_LIMIT = 5000;

export class ProductService {
  private productRepo = AppDataSource.getRepository(ProductEntity);
  private branchDataRepo = AppDataSource.getRepository(ProductBranchDataEntity);
  private physicalItemRepo = AppDataSource.getRepository(PhysicalItemEntity);
  private branchRepo = AppDataSource.getRepository(BranchEntity);

  public async getAllProducts() {
    const cached = memoryCache.get<ProductEntity[]>('products:all');
    if (cached) return cached;

    const products = await this.productRepo.find({
      order: { createdAt: 'DESC' },
      take: MAX_LIST_LIMIT,
    });
    memoryCache.set('products:all', products, 60);
    return products;
  }

  public async getProductById(id: string) {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) {
      throw new AppError('Product not found', 404);
    }
    return product;
  }

  public async getAllBranchData(branchId?: string, includeCost: boolean = false) {
    const targetBranch = branchId?.trim();
    const branchCacheKey = targetBranch
      ? `products:branchData:${targetBranch}:${includeCost ? 'withCost' : 'noCost'}`
      : `products:branchData:all:${includeCost ? 'withCost' : 'noCost'}`;

    const cached = memoryCache.get<ProductBranchDataEntity[]>(branchCacheKey);
    if (cached) return cached;

    // Check pre-warmed products:branchData:all if populated in memoryCache
    const legacyAll = memoryCache.get<ProductBranchDataEntity[]>('products:branchData:all');
    if (legacyAll && Array.isArray(legacyAll)) {
      let filtered = targetBranch ? legacyAll.filter(item => item.branchId === targetBranch) : legacyAll;
      if (!includeCost) {
        filtered = filtered.map((item: any) => {
          const { cost, ...safeData } = item;
          return safeData as any;
        });
      }
      return filtered;
    }

    const selectColumns: (keyof ProductBranchDataEntity)[] = [
      'id',
      'productId',
      'branchId',
      'price1',
      'price1Label',
      'price2',
      'price2Label',
      'price3',
      'price3Label',
      'price4',
      'price4Label',
      'minStock',
      'quantity',
      'updatedAt',
    ];
    if (includeCost) {
      selectColumns.push('cost');
    }

    const whereClause = targetBranch ? { branchId: targetBranch } : {};

    const rawData = await this.branchDataRepo.find({
      where: whereClause,
      select: selectColumns,
      take: MAX_LIST_LIMIT,
    });

    const data = !includeCost
      ? rawData.map((item: any) => {
          const { cost, ...rest } = item;
          return rest as ProductBranchDataEntity;
        })
      : rawData;

    memoryCache.set(branchCacheKey, data, 30);
    return data;
  }

  public async getBranchData(productId: string, branchId: string) {
    return this.branchDataRepo.findOne({
      where: { productId, branchId },
    });
  }

  public async createProduct(productData: Partial<ProductEntity>, branchDataList: Partial<ProductBranchDataEntity>[] = []) {
    memoryCache.invalidate('products');
    bumpSyncVersion();

    const id = productData.id || `p_${Date.now()}`;
    const product = this.productRepo.create({
      ...productData,
      id,
      nameEn: productData.nameEn || productData.nameAr || '',
    });

    await this.productRepo.save(product);

    // Auto-populate for all branches so every branch has the product in its catalog
    const allBranches = await this.branchRepo.find();
    const baseBd = branchDataList[0] || {};
    const cost = Number(baseBd.cost || 0);
    const p1 = Number(baseBd.price1 || 0);
    const p1Label = baseBd.price1Label || 'سعر 1';
    const p2 = Number(baseBd.price2 || p1);
    const p2Label = baseBd.price2Label || 'سعر 2';
    const p3 = Number(baseBd.price3 || p1);
    const p3Label = baseBd.price3Label || 'سعر 3';
    const p4 = Number(baseBd.price4 || p1);
    const p4Label = baseBd.price4Label || 'سعر 4';
    const minStock = Number(baseBd.minStock ?? 10);

    const entities: ProductBranchDataEntity[] = [];
    const prefix = (productData.sku || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'ITM';

    for (const b of allBranches) {
      const explicitBd = branchDataList.find(bd => bd.branchId === b.id);
      const qty = explicitBd ? Number(explicitBd.quantity || 0) : 0;
      entities.push(
        this.branchDataRepo.create({
          productId: id,
          branchId: b.id,
          cost: explicitBd && explicitBd.cost !== undefined ? Number(explicitBd.cost) : cost,
          price1: explicitBd && explicitBd.price1 !== undefined ? Number(explicitBd.price1) : p1,
          price1Label: explicitBd?.price1Label || p1Label,
          price2: explicitBd && explicitBd.price2 !== undefined ? Number(explicitBd.price2) : p2,
          price2Label: explicitBd?.price2Label || p2Label,
          price3: explicitBd && explicitBd.price3 !== undefined ? Number(explicitBd.price3) : p3,
          price3Label: explicitBd?.price3Label || p3Label,
          price4: explicitBd && explicitBd.price4 !== undefined ? Number(explicitBd.price4) : p4,
          price4Label: explicitBd?.price4Label || p4Label,
          minStock: explicitBd && explicitBd.minStock !== undefined ? Number(explicitBd.minStock) : minStock,
          quantity: qty,
        })
      );

      // Generate physical QR item for each branch
      const itemId = `QR-${prefix}-${b.id}`;
      const existingItem = await this.physicalItemRepo.findOne({ where: { productId: id, branchId: b.id } });
      if (!existingItem) {
        const item = this.physicalItemRepo.create({
          id: itemId,
          productId: id,
          branchId: b.id,
          status: 'available',
          serialNumber: prefix,
        });
        await this.physicalItemRepo.save(item);
      }
    }

    await this.branchDataRepo.save(entities);

    try {
      broadcastProductCreated(product, entities);
    } catch (bErr) {
      console.warn('⚠️ [Socket.io] Broadcast error after product create:', bErr);
    }

    return product;
  }

  public async updateProduct(id: string, updates: Partial<ProductEntity>) {
    memoryCache.invalidate('products');
    bumpSyncVersion();
    const product = await this.getProductById(id);
    Object.assign(product, updates);
    const updated = await this.productRepo.save(product);
    try {
      broadcastProductUpdated(updated);
    } catch (bErr) {
      console.warn('⚠️ [Socket.io] Broadcast error after product update:', bErr);
    }
    return updated;
  }

  public async updateBranchData(data: Partial<ProductBranchDataEntity>) {
    memoryCache.invalidate('products');
    bumpSyncVersion();
    if (!data.productId || !data.branchId) {
      throw new AppError('productId and branchId are required', 400);
    }

    let existing = await this.branchDataRepo.findOne({
      where: { productId: data.productId, branchId: data.branchId },
    });

    if (existing) {
      Object.assign(existing, data);
    } else {
      existing = this.branchDataRepo.create(data);
    }

    const saved = await this.branchDataRepo.save(existing);
    if (saved && data.quantity !== undefined) {
      try {
        broadcastStockUpdate({
          branchId: data.branchId,
          items: [{
            productId: data.productId,
            productName: '',
            newQuantity: Number(data.quantity),
            isOutOfStock: Number(data.quantity) <= 0
          }]
        });
      } catch (bErr) {
        console.warn('⚠️ [Socket.io] Broadcast error after branch data update:', bErr);
      }
    }
    return saved;
  }

  public async deleteProduct(id: string) {
    memoryCache.invalidate('products');
    bumpSyncVersion();
    const product = await this.getProductById(id);

    // Delete associated branch data and physical items
    await this.branchDataRepo.delete({ productId: id });
    await this.physicalItemRepo.delete({ productId: id });
    await this.productRepo.remove(product);

    try {
      broadcastProductDeleted(id);
    } catch (bErr) {
      console.warn('⚠️ [Socket.io] Broadcast error after product delete:', bErr);
    }

    return { success: true };
  }

  public async adjustStockQuantity(productId: string, branchId: string, targetQuantity: number, prefix: string) {
    memoryCache.invalidate('products');
    bumpSyncVersion();
    let bd = await this.branchDataRepo.findOne({ where: { productId, branchId } });
    if (bd) {
      bd.quantity = Number(targetQuantity);
      await this.branchDataRepo.save(bd);
    } else {
      bd = this.branchDataRepo.create({
        productId,
        branchId,
        cost: 0,
        price1: 0,
        price1Label: 'سعر 1',
        price2: 0,
        price2Label: 'سعر 2',
        price3: 0,
        price3Label: 'سعر 3',
        price4: 0,
        price4Label: 'سعر 4',
        minStock: 10,
        quantity: Number(targetQuantity)
      });
      await this.branchDataRepo.save(bd);
    }

    // Ensure 1 QR code barcode item exists in physical_items for scanning
    const itemId = `QR-${prefix}`;
    let item = await this.physicalItemRepo.findOne({ where: { id: itemId } });
    if (!item) {
      item = this.physicalItemRepo.create({
        id: itemId,
        productId,
        branchId,
        status: 'available',
        serialNumber: prefix,
      });
      try {
        await this.physicalItemRepo.save(item);
      } catch (e) {
        console.warn('Physical item save notice:', e);
      }
    }

    try {
      broadcastStockUpdate({
        branchId,
        items: [{
          productId,
          productName: '',
          newQuantity: Number(targetQuantity),
          isOutOfStock: Number(targetQuantity) <= 0
        }]
      });
    } catch (bErr) {
      console.warn('⚠️ [Socket.io] Broadcast error after adjustStockQuantity:', bErr);
    }

    return { success: true, quantity: Number(targetQuantity) };
  }
}
