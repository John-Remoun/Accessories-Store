import { Request, Response, NextFunction } from 'express';
import { FixedExpenseService } from './fixed-expense.service';
import { sendResponse } from '../../common/utils/response.utils';

const expenseService = new FixedExpenseService();

export class FixedExpenseController {
  public async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const expenses = await expenseService.getExpensesByBranch();
      return sendResponse(res, 200, 'Fixed expenses retrieved', expenses);
    } catch (error) {
      next(error);
    }
  }

  public async getByBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.params.branchId as string;
      const expenses = await expenseService.getExpensesByBranch(branchId);
      return sendResponse(res, 200, 'Fixed expenses retrieved', expenses);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction) {
    try {
      const expense = await expenseService.createExpense(req.body);
      return sendResponse(res, 201, 'Fixed expense added', expense);
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await expenseService.deleteExpense(id);
      return sendResponse(res, 200, 'Fixed expense deleted', result);
    } catch (error) {
      next(error);
    }
  }
}
