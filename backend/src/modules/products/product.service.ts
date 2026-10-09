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
    let bd = await this.branchDataRepo.findOne({ where: { productId, branchId } });
    if (bd) {
      bd.quantity = Number(targetQuantity);
      await this.branchDataRepo.save(bd);
    } else {
      bd = this.branchDataRepo.create({ productId, branchId, quantity: Number(targetQuantity) });
      await this.branchDataRepo.save(bd);
    }

    // Ensure 1 QR code barcode item exists in physical_items for scanning
    const itemId = `QR-${prefix}`;
    let item = await this.physicalItemRepo.findOne({ where: { productId, branchId } });
    if (!item) {
      item = this.physicalItemRepo.create({
        id: itemId,
        productId,
        branchId,
        status: 'available',
        serialNumber: prefix,
      });
      await this.physicalItemRepo.save(item);
    }

    return { success: true, quantity: Number(targetQuantity) };
  }
}
