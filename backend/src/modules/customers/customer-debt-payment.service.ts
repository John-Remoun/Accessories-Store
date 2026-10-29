import { AppDataSource } from '../../config/data-source';
import { CustomerDebtPaymentEntity } from './customer-debt-payment.entity';
import { memoryCache } from '../../common/cache/cache.service';
import { broadcastDebtPaymentCreated } from '../../common/socket/socket.service';

export class CustomerDebtPaymentService {
  private repo = AppDataSource.getRepository(CustomerDebtPaymentEntity);

  public async getDebtPayments(options?: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
    year?: number;
    month?: number;
  }) {
    const cacheKey = `customer_debt_payments:${options?.branchId || 'all'}:${options?.year || 'all'}:${options?.month || 'all'}`;
    const cached = memoryCache.get<CustomerDebtPaymentEntity[]>(cacheKey);
    if (cached) return cached;

    let qb = this.repo.createQueryBuilder('cdp').orderBy('cdp.date', 'DESC');

    if (options?.branchId) {
      qb = qb.andWhere('cdp.branchId = :branchId', { branchId: options.branchId });
    }

    if (options?.startDate) {
      qb = qb.andWhere('cdp.date >= :startDate', { startDate: options.startDate });
    }

    if (options?.endDate) {
      qb = qb.andWhere('cdp.date <= :endDate', { endDate: options.endDate });
    }

    const items = await qb.getMany();

    let filtered = items;
    if (options?.year !== undefined || options?.month !== undefined) {
      filtered = items.filter(item => {
        const d = new Date(item.date);
        if (isNaN(d.getTime())) return false;
        if (options.year !== undefined && d.getFullYear() !== options.year) return false;
        if (options.month !== undefined && (d.getMonth() + 1) !== options.month && d.getMonth() !== options.month) return false;
        return true;
      });
    }

    memoryCache.set(cacheKey, filtered, 60);
    return filtered;
  }

  public async createDebtPayment(data: Partial<CustomerDebtPaymentEntity>) {
    memoryCache.invalidate('customer_debt_payments');
    memoryCache.invalidate('invoices');

    const id = data.id || `cdp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const date = data.date || new Date().toISOString();

    const payment = this.repo.create({
      ...data,
      id,
      amount: Number(data.amount || 0),
      paymentMethod: data.paymentMethod || 'cash',
      date,
    });

    const saved = await this.repo.save(payment);

    try {
      broadcastDebtPaymentCreated(saved);
    } catch {}

    return saved;
  }

  public async deleteDebtPayment(id: string) {
    memoryCache.invalidate('customer_debt_payments');
    memoryCache.invalidate('invoices');
    await this.repo.delete(id);
    return { success: true };
  }
}

export const customerDebtPaymentService = new CustomerDebtPaymentService();
