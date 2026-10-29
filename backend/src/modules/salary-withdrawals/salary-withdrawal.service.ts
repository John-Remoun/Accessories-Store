import { AppDataSource } from '../../config/data-source';
import { SalaryWithdrawalEntity } from './salary-withdrawal.entity';
import { AppError } from '../../common/exceptions/app-error';
import { memoryCache } from '../../common/cache/cache.service';

export class SalaryWithdrawalService {
  private repo = AppDataSource.getRepository(SalaryWithdrawalEntity);

  public async getWithdrawals(options?: {
    branchId?: string;
    userId?: string;
    year?: number;
    month?: number;
  }) {
    const cacheKey = `salary_withdrawals:${options?.branchId || 'all'}:${options?.userId || 'all'}:${options?.year || 'all'}:${options?.month || 'all'}`;
    const cached = memoryCache.get<SalaryWithdrawalEntity[]>(cacheKey);
    if (cached) return cached;

    let qb = this.repo.createQueryBuilder('sw').orderBy('sw.date', 'DESC');

    if (options?.branchId) {
      qb = qb.andWhere('sw.branchId = :branchId', { branchId: options.branchId });
    }

    if (options?.userId) {
      qb = qb.andWhere('sw.userId = :userId', { userId: options.userId });
    }

    const items = await qb.getMany();

    // If month or year filtered
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

  public async createWithdrawal(data: Partial<SalaryWithdrawalEntity>) {
    memoryCache.invalidate('salary_withdrawals');
    const id = data.id || `sw_${Date.now()}`;
    const date = data.date || new Date().toISOString();
    const amount = Number(data.amount || 0);

    if (amount <= 0) {
      throw new AppError('Withdrawal amount must be greater than zero', 400);
    }

    if (!data.reason || !data.reason.trim()) {
      throw new AppError('Withdrawal reason is required', 400);
    }

    const record = this.repo.create({
      id,
      userId: data.userId,
      userName: data.userName || 'موظف',
      branchId: data.branchId || 'b1',
      amount,
      reason: data.reason.trim(),
      date,
    });

    const saved = await this.repo.save(record);
    return saved;
  }

  public async getWithdrawalById(id: string) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) {
      throw new AppError('Salary withdrawal not found', 404);
    }
    return item;
  }

  public async deleteWithdrawal(id: string) {
    memoryCache.invalidate('salary_withdrawals');
    const item = await this.getWithdrawalById(id);
    await this.repo.remove(item);
    return { success: true };
  }
}
