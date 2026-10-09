import { AppDataSource } from '../../config/data-source';
import { PhysicalItemEntity, PhysicalItemStatus } from './physical-item.entity';
import { AppError } from '../../common/exceptions/app-error';

export class PhysicalItemService {
  private itemRepo = AppDataSource.getRepository(PhysicalItemEntity);

  public async getAllItems() {
    return this.itemRepo.find({
      order: { createdAt: 'DESC' },
    });
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

  public async markItemStatus(id: string, status: PhysicalItemStatus) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) {
      throw new AppError('Physical item not found', 404);
    }
    item.status = status;
    return this.itemRepo.save(item);
  }

  public async deleteItem(id: string) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) {
      throw new AppError('Physical item not found', 404);
    }
    await this.itemRepo.remove(item);
    return { success: true };
  }
}
