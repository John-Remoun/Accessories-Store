import { AppDataSource } from '../../config/data-source';
import { FixedExpenseEntity } from './fixed-expense.entity';
import { AppError } from '../../common/exceptions/app-error';
import { memoryCache } from '../../common/cache/cache.service';
import { broadcastExpenseCreated, broadcastExpenseDeleted } from '../../common/socket/socket.service';

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

    const saved = await this.expenseRepo.save(expense);
    try {
      broadcastExpenseCreated(saved);
    } catch (bErr) {
      console.warn('⚠️ [Socket.io] Broadcast error after expense create:', bErr);
    }
    return saved;
  }

  public async deleteExpense(id: string) {
    memoryCache.invalidate('fixed_expenses');
    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) {
      throw new AppError('Expense record not found', 404);
    }
    const branchId = expense.branchId;
    await this.expenseRepo.remove(expense);
    try {
      broadcastExpenseDeleted(id, branchId);
    } catch (bErr) {
      console.warn('⚠️ [Socket.io] Broadcast error after expense delete:', bErr);
    }
    return { success: true };
  }
}
