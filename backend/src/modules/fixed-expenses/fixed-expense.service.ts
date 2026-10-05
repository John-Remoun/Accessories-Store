import { AppDataSource } from '../../config/data-source';
import { FixedExpenseEntity } from './fixed-expense.entity';
import { AppError } from '../../common/exceptions/app-error';

export class FixedExpenseService {
  private expenseRepo = AppDataSource.getRepository(FixedExpenseEntity);

  public async getExpensesByBranch(branchId?: string) {
    if (branchId) {
      return this.expenseRepo.find({
        where: { branchId },
        order: { createdAt: 'DESC' },
      });
    }
    return this.expenseRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  public async createExpense(data: Partial<FixedExpenseEntity>) {
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
    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) {
      throw new AppError('Expense record not found', 404);
    }
    await this.expenseRepo.remove(expense);
    return { success: true };
  }
}
