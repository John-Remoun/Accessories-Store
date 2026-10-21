import { AppDataSource } from '../../config/data-source';
import { PhysicalItemEntity, PhysicalItemStatus } from './physical-item.entity';
import { AppError } from '../../common/exceptions/app-error';
import { memoryCache } from '../../common/cache/cache.service';

export class PhysicalItemService {
  private itemRepo = AppDataSource.getRepository(PhysicalItemEntity);

  public async getAllItems() {
    const cached = memoryCache.get<PhysicalItemEntity[]>('physical_items:all');
    if (cached) return cached;

    const items = await this.itemRepo.find({
      order: { createdAt: 'DESC' },
    });
    memoryCache.set('physical_items:all', items, 60);
    return items;
  }

  public async getItemsByProduct(productId: string) {
    return this.itemRepo.find({
      where: { productId },
    });
  }

  public async getItemsByBranch(branchId: string) {
    return this.itemRepo.find({
      where: { branchId },
    });
  }

  public async generateItems(productId: string, branchId: string, quantity: number, prefix: string) {
    memoryCache.invalidate('physical_items');
    const itemId = `QR-${prefix}`;
    let item = await this.itemRepo.findOne({ where: { productId, branchId } });
    if (!item) {
      item = this.itemRepo.create({
        id: itemId,
        productId,
        branchId,
        status: 'available',
        serialNumber: prefix,
      });
      await this.itemRepo.save(item);
    }
    return [item];
  }

  public async getItemById(id: string) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) {
      throw new AppError('Physical item not found', 404);
    }
    return item;
  }

  public async markItemStatus(id: string, status: PhysicalItemStatus) {
    memoryCache.invalidate('physical_items');
    const item = await this.getItemById(id);
    item.status = status;
    return this.itemRepo.save(item);
  }

  public async deleteItem(id: string) {
    memoryCache.invalidate('physical_items');
    const item = await this.getItemById(id);
    await this.itemRepo.remove(item);
    return { success: true };
  }
}
