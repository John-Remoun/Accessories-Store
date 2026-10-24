import { Request, Response, NextFunction } from 'express';
import { FixedExpenseService } from './fixed-expense.service';
import { sendResponse } from '../../common/utils/response.utils';
import { resolveBranchScope } from '../../common/utils/branch-auth.utils';

const expenseService = new FixedExpenseService();

export class FixedExpenseController {
  public async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, no-cache');
      const scope = await resolveBranchScope(req, req.query.branchId as string);
      const effectiveBranchId = scope.isGlobalAdmin ? (req.query.branchId as string) : scope.branchId;
      const expenses = await expenseService.getExpensesByBranch(effectiveBranchId);
      return sendResponse(res, 200, 'Fixed expenses retrieved', expenses);
    } catch (error) {
      next(error);
    }
  }

  public async getByBranch(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, no-cache');
      const branchId = req.params.branchId as string;
      await resolveBranchScope(req, branchId);
      const expenses = await expenseService.getExpensesByBranch(branchId);
      return sendResponse(res, 200, 'Fixed expenses retrieved', expenses);
    } catch (error) {
      next(error);
    }
  }

  public async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, no-cache');
      const id = req.params.id as string;
      const existing = await expenseService.getExpenseById(id);
      await resolveBranchScope(req, existing.branchId);
      return sendResponse(res, 200, 'Fixed expense retrieved', existing);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = await resolveBranchScope(req, req.body.branchId);
      const authUser = (req as any).user;
      const payload = {
        ...req.body,
        branchId: scope.isGlobalAdmin ? (req.body.branchId || scope.branchId || 'b1') : scope.branchId,
        userId: req.body.userId || authUser?.userId || authUser?.id,
        userName: req.body.userName || authUser?.name || authUser?.username,
      };
      const expense = await expenseService.createExpense(payload);
      return sendResponse(res, 201, 'Fixed expense added', expense);
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const existing = await expenseService.getExpenseById(id);
      await resolveBranchScope(req, existing.branchId);
      const result = await expenseService.deleteExpense(id);
      return sendResponse(res, 200, 'Fixed expense deleted', result);
    } catch (error) {
      next(error);
    }
  }
}
