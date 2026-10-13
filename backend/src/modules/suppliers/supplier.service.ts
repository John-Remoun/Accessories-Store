import { AppDataSource } from '../../config/data-source';
import { SupplierEntity } from './supplier.entity';
import { AppError } from '../../common/exceptions/app-error';

export class SupplierService {
  private supplierRepo = AppDataSource.getRepository(SupplierEntity);

  public async getAllSuppliers() {
    return this.supplierRepo.find({
      order: { purchaseDate: 'DESC' },
    });
  }

  public async getSupplierById(id: string) {
    const supplier = await this.supplierRepo.findOne({ where: { id } });
    if (!supplier) {
      throw new AppError('Supplier purchase record not found', 404);
    }
    return supplier;
  }

  public async createSupplier(data: Partial<SupplierEntity>) {
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
    const supplier = await this.getSupplierById(id);

    if (updates.purchaseDate) {
      updates.purchaseDate = new Date(updates.purchaseDate);
    }

    Object.assign(supplier, updates);
    return this.supplierRepo.save(supplier);
  }

  public async deleteSupplier(id: string) {
    const supplier = await this.getSupplierById(id);
    await this.supplierRepo.remove(supplier);
    return { success: true };
  }
}
