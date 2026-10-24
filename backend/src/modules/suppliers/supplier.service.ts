import { AppDataSource } from '../../config/data-source';
import { SupplierEntity } from './supplier.entity';
import { AppError } from '../../common/exceptions/app-error';
import { memoryCache } from '../../common/cache/cache.service';

export class SupplierService {
  private supplierRepo = AppDataSource.getRepository(SupplierEntity);

  public async getAllSuppliers(branchId?: string) {
    const targetBranch = branchId?.trim();
    const cacheKey = targetBranch ? `suppliers:branch:${targetBranch}` : 'suppliers:all';
    const cached = memoryCache.get<SupplierEntity[]>(cacheKey);
    if (cached) return cached;

    const whereClause = targetBranch ? { branchId: targetBranch } : {};
    const suppliers = await this.supplierRepo.find({
      where: whereClause,
      order: { purchaseDate: 'DESC' },
    });
    memoryCache.set(cacheKey, suppliers, 120);
    return suppliers;
  }

  public async getSupplierById(id: string) {
    const supplier = await this.supplierRepo.findOne({ where: { id } });
    if (!supplier) {
      throw new AppError('Supplier purchase record not found', 404);
    }
    return supplier;
  }

  public async createSupplier(data: Partial<SupplierEntity>, scopeBranchId?: string) {
    memoryCache.invalidate('suppliers');
    const effectiveBranchId = scopeBranchId || data.branchId;
    if (!effectiveBranchId) {
      throw new AppError('branchId is required to create a supplier record', 400);
    }
    const id = data.id || `sup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const supplier = this.supplierRepo.create({
      ...data,
      id,
      branchId: effectiveBranchId,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : new Date(),
      paymentHistory: Array.isArray(data.paymentHistory) ? data.paymentHistory : [],
    });

    return this.supplierRepo.save(supplier);
  }

  public async updateSupplier(id: string, updates: Partial<SupplierEntity>, scopeBranchId?: string, isGlobalAdmin?: boolean) {
    memoryCache.invalidate('suppliers');
    const supplier = await this.getSupplierById(id);

    if (!isGlobalAdmin && scopeBranchId && supplier.branchId !== scopeBranchId) {
      throw new AppError('Forbidden: Access denied to supplier record belonging to another branch', 403);
    }

    if (updates.purchaseDate) {
      updates.purchaseDate = new Date(updates.purchaseDate);
    }

    const { branchId, ...safeUpdates } = updates;
    Object.assign(supplier, safeUpdates);
    return this.supplierRepo.save(supplier);
  }

  public async deleteSupplier(id: string, scopeBranchId?: string, isGlobalAdmin?: boolean) {
    memoryCache.invalidate('suppliers');
    const supplier = await this.getSupplierById(id);

    if (!isGlobalAdmin && scopeBranchId && supplier.branchId !== scopeBranchId) {
      throw new AppError('Forbidden: Access denied to delete supplier record belonging to another branch', 403);
    }

    await this.supplierRepo.remove(supplier);
    return { success: true };
  }
}
