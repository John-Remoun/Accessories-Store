import { AppDataSource } from '../../config/data-source';
import { CustomerEntity } from './customer.entity';
import { AppError } from '../../common/exceptions/app-error';
import { memoryCache } from '../../common/cache/cache.service';

export class CustomerService {
  private customerRepo = AppDataSource.getRepository(CustomerEntity);

  public async getAllCustomers(branchId?: string) {
    const targetBranch = branchId?.trim();
    const cacheKey = targetBranch ? `customers:branch:${targetBranch}` : 'customers:all';
    const cached = memoryCache.get<CustomerEntity[]>(cacheKey);
    if (cached) return cached;

    const whereClause = targetBranch ? { branchId: targetBranch } : {};
    const customers = await this.customerRepo.find({
      where: whereClause,
      order: { createdAt: 'DESC' },
    });
    memoryCache.set(cacheKey, customers, 120);
    return customers;
  }

  public async getCustomerById(id: string) {
    const customer = await this.customerRepo.findOne({ where: { id } });
    if (!customer) {
      throw new AppError('Customer not found', 404);
    }
    return customer;
  }

  public async createOrUpdateCustomer(data: Partial<CustomerEntity>, scopeBranchId?: string, isGlobalAdmin?: boolean) {
    memoryCache.invalidate('customers');
    let existing: CustomerEntity | null = null;

    if (data.id) {
      existing = await this.customerRepo.findOne({ where: { id: data.id } });
    }

    if (!existing && data.phone && data.phone.trim().length > 0) {
      const phone = data.phone.trim();
      const targetBranch = scopeBranchId || data.branchId;
      if (targetBranch) {
        existing = await this.customerRepo.findOne({ where: { phone, branchId: targetBranch } });
      } else {
        existing = await this.customerRepo.findOne({ where: { phone } });
      }
    }

    if (existing) {
      if (!isGlobalAdmin && scopeBranchId && existing.branchId !== scopeBranchId) {
        throw new AppError('Forbidden: Access denied to customer belonging to another branch', 403);
      }
      const { branchId, ...safeData } = data;
      Object.assign(existing, safeData);
      return this.customerRepo.save(existing);
    }

    const effectiveBranchId = scopeBranchId || data.branchId;
    if (!effectiveBranchId) {
      throw new AppError('branchId is required to create a customer', 400);
    }

    const id = data.id || `cust_${Date.now()}`;
    const customer = this.customerRepo.create({
      ...data,
      id,
      branchId: effectiveBranchId,
      phone: data.phone?.trim() || '',
    });

    return this.customerRepo.save(customer);
  }

  public async deleteCustomer(idOrPhone: string, scopeBranchId?: string, isGlobalAdmin?: boolean) {
    memoryCache.invalidate('customers');
    const term = idOrPhone.trim();
    const customer = await this.customerRepo.findOne({
      where: [{ id: term }, { phone: term }],
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    if (!isGlobalAdmin && scopeBranchId && customer.branchId !== scopeBranchId) {
      throw new AppError('Forbidden: Access denied to delete customer belonging to another branch', 403);
    }

    await this.customerRepo.remove(customer);
    return { success: true };
  }
}
