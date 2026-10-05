import { AppDataSource } from '../../config/data-source';
import { ProductEntity } from './product.entity';
import { ProductBranchDataEntity } from './product-branch-data.entity';
import { PhysicalItemEntity } from '../physical-items/physical-item.entity';
import { AppError } from '../../common/exceptions/app-error';

export class ProductService {
  private productRepo = AppDataSource.getRepository(ProductEntity);
  private branchDataRepo = AppDataSource.getRepository(ProductBranchDataEntity);
  private physicalItemRepo = AppDataSource.getRepository(PhysicalItemEntity);

  public async getAllProducts() {
    return this.productRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  public async getProductById(id: string) {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) {
      throw new AppError('Product not found', 404);
    }
    return product;
  }

  public async getAllBranchData() {
    return this.branchDataRepo.find();
  }

  public async getBranchData(productId: string, branchId: string) {
    return this.branchDataRepo.findOne({
      where: { productId, branchId },
    });
  }

  public async createProduct(productData: Partial<ProductEntity>, branchDataList: Partial<ProductBranchDataEntity>[] = []) {
    const id = productData.id || `p_${Date.now()}`;
    const product = this.productRepo.create({
      ...productData,
      id,
      nameEn: productData.nameEn || productData.nameAr || '',
    });

    await this.productRepo.save(product);

    if (branchDataList.length > 0) {
      const entities = branchDataList.map((bd) =>
        this.branchDataRepo.create({
          ...bd,
          productId: id,
        })
      );
      await this.branchDataRepo.save(entities);
    }

    return product;
  }

  public async updateProduct(id: string, updates: Partial<ProductEntity>) {
    const product = await this.getProductById(id);
    Object.assign(product, updates);
    return this.productRepo.save(product);
  }

  public async updateBranchData(data: Partial<ProductBranchDataEntity>) {
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

    return this.branchDataRepo.save(existing);
  }

  public async deleteProduct(id: string) {
    const product = await this.getProductById(id);

    // Delete associated branch data and physical items
    await this.branchDataRepo.delete({ productId: id });
    await this.physicalItemRepo.delete({ productId: id });
    await this.productRepo.remove(product);

    return { success: true };
  }

  public async adjustStockQuantity(productId: string, branchId: string, targetQuantity: number, prefix: string) {
    const availableItems = await this.physicalItemRepo.find({
      where: { productId, branchId, status: 'available' },
    });
    const currentCount = availableItems.length;

    if (targetQuantity > currentCount) {
      const toAdd = targetQuantity - currentCount;
      const allProductItems = await this.physicalItemRepo.find({ where: { productId } });
      const existingCount = allProductItems.length;

      const newItems: PhysicalItemEntity[] = [];
      for (let i = 1; i <= toAdd; i++) {
        const itemNumber = existingCount + i;
        newItems.push(
          this.physicalItemRepo.create({
            id: `QR-${prefix}-${itemNumber.toString().padStart(4, '0')}`,
            productId,
            branchId,
            status: 'available',
            serialNumber: itemNumber.toString(),
          })
        );
      }
      await this.physicalItemRepo.save(newItems);
    } else if (targetQuantity < currentCount) {
      const toRemoveCount = currentCount - targetQuantity;
      const itemsToRemove = availableItems.slice(0, toRemoveCount);
      await this.physicalItemRepo.remove(itemsToRemove);
    }

    return { success: true };
  }
}
