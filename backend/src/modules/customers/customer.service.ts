import { AppDataSource } from '../../config/data-source';
import { CustomerEntity } from './customer.entity';
import { AppError } from '../../common/exceptions/app-error';
import { memoryCache } from '../../common/cache/cache.service';

export class CustomerService {
  private customerRepo = AppDataSource.getRepository(CustomerEntity);

  public async getAllCustomers() {
    const cached = memoryCache.get<CustomerEntity[]>('customers:all');
    if (cached) return cached;

    const customers = await this.customerRepo.find({
      order: { createdAt: 'DESC' },
    });
    memoryCache.set('customers:all', customers, 120);
    return customers;
  }

  public async getCustomerById(id: string) {
    const customer = await this.customerRepo.findOne({ where: { id } });
    if (!customer) {
      throw new AppError('Customer not found', 404);
    }
    return customer;
  }

  public async createOrUpdateCustomer(data: Partial<CustomerEntity>) {
    memoryCache.invalidate('customers');
    let existing: CustomerEntity | null = null;

    if (data.id) {
      existing = await this.customerRepo.findOne({ where: { id: data.id } });
    }

    if (!existing && data.phone && data.phone.trim().length > 0) {
      existing = await this.customerRepo.findOne({ where: { phone: data.phone.trim() } });
    }

    if (existing) {
      Object.assign(existing, data);
      return this.customerRepo.save(existing);
    }

    const id = data.id || `cust_${Date.now()}`;
    const customer = this.customerRepo.create({
      ...data,
      id,
      phone: data.phone?.trim() || '',
    });

    return this.customerRepo.save(customer);
  }

  public async deleteCustomer(idOrPhone: string) {
    memoryCache.invalidate('customers');
    const term = idOrPhone.trim();
    const customer = await this.customerRepo.findOne({
      where: [{ id: term }, { phone: term }],
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    await this.customerRepo.remove(customer);
    return { success: true };
  }
}
