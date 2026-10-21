import { AppDataSource } from '../../config/data-source';
import { FixedExpenseEntity } from './fixed-expense.entity';
import { AppError } from '../../common/exceptions/app-error';
import { memoryCache } from '../../common/cache/cache.service';

export class FixedExpenseService {
  private expenseRepo = AppDataSource.getRepository(FixedExpenseEntity);

  public async getExpensesByBranch(branchId?: string) {
    const cacheKey = branchId ? `fixed_expenses:branch:${branchId}` : 'fixed_expenses:all';
    const cached = memoryCache.get<FixedExpenseEntity[]>(cacheKey);
    if (cached) return cached;

    let expenses: FixedExpenseEntity[];
    if (branchId) {
      expenses = await this.expenseRepo.find({
        where: { branchId },
        order: { createdAt: 'DESC' },
      });
    } else {
      expenses = await this.expenseRepo.find({
        order: { createdAt: 'DESC' },
      });
    }
    memoryCache.set(cacheKey, expenses, 120);
    return expenses;
  }

  public async createExpense(data: Partial<FixedExpenseEntity>) {
    memoryCache.invalidate('fixed_expenses');
    const id = data.id || `exp_${Date.now()}`;
    const date = data.date || new Date().toISOString();

    const expense = this.expenseRepo.create({
      ...data,
      id,
      date,
    });

    return this.expenseRepo.save(expense);
  }

  public async deleteExpense(id: string) {
    memoryCache.invalidate('fixed_expenses');
    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) {
      throw new AppError('Expense record not found', 404);
    }
    await this.expenseRepo.remove(expense);
    return { success: true };
  }
}
