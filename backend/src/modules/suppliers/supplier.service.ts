import { AppDataSource } from '../../config/data-source';
import { SupplierEntity } from './supplier.entity';
import { AppError } from '../../common/exceptions/app-error';
import { memoryCache } from '../../common/cache/cache.service';

export class SupplierService {
  private supplierRepo = AppDataSource.getRepository(SupplierEntity);

  public async getAllSuppliers() {
    const cached = memoryCache.get<SupplierEntity[]>('suppliers:all');
    if (cached) return cached;

    const suppliers = await this.supplierRepo.find({
      order: { purchaseDate: 'DESC' },
    });
    memoryCache.set('suppliers:all', suppliers, 120);
    return suppliers;
  }

  public async getSupplierById(id: string) {
    const supplier = await this.supplierRepo.findOne({ where: { id } });
    if (!supplier) {
      throw new AppError('Supplier purchase record not found', 404);
    }
    return supplier;
  }

  public async createSupplier(data: Partial<SupplierEntity>) {
    memoryCache.invalidate('suppliers');
    const id = data.id || `sup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const supplier = this.supplierRepo.create({
      ...data,
      id,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : new Date(),
      paymentHistory: Array.isArray(data.paymentHistory) ? data.paymentHistory : [],
    });

    return this.supplierRepo.save(supplier);
  }

  public async updateSupplier(id: string, updates: Partial<SupplierEntity>) {
    memoryCache.invalidate('suppliers');
    const supplier = await this.getSupplierById(id);

    if (updates.purchaseDate) {
      updates.purchaseDate = new Date(updates.purchaseDate);
    }

    Object.assign(supplier, updates);
    return this.supplierRepo.save(supplier);
  }

  public async deleteSupplier(id: string) {
    memoryCache.invalidate('suppliers');
    const supplier = await this.getSupplierById(id);
    await this.supplierRepo.remove(supplier);
    return { success: true };
  }
}
