import { Request, Response, NextFunction } from 'express';
import { SalaryWithdrawalService } from './salary-withdrawal.service';
import { sendResponse } from '../../common/utils/response.utils';
import { resolveBranchScope } from '../../common/utils/branch-auth.utils';
import { AppError } from '../../common/exceptions/app-error';

const withdrawalService = new SalaryWithdrawalService();

export class SalaryWithdrawalController {
  public async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, no-cache');
      const scope = await resolveBranchScope(req, req.query.branchId as string);
      const authUser = (req as any).user;

      const effectiveBranchId = scope.isGlobalAdmin ? (req.query.branchId as string) : scope.branchId;
      // If employee, can only view their own withdrawals unless manager/admin
      const effectiveUserId = scope.isGlobalAdmin || authUser.role === 'manager'
        ? (req.query.userId as string)
        : authUser.userId;

      const items = await withdrawalService.getWithdrawals({
        branchId: effectiveBranchId,
        userId: effectiveUserId,
        year: req.query.year ? Number(req.query.year) : undefined,
        month: req.query.month ? Number(req.query.month) : undefined,
      });

      return sendResponse(res, 200, 'Salary withdrawals retrieved', items);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction) {
    try {
      const authUser = (req as any).user;
      const scope = await resolveBranchScope(req, req.body.branchId || authUser.branchId);

      // Determine userId and userName
      const targetUserId = authUser.role === 'admin' && req.body.userId ? req.body.userId : authUser.userId;
      const targetUserName = req.body.userName || authUser.name || authUser.username || 'موظف';
      const targetBranchId = req.body.branchId || scope.branchId || authUser.branchId || 'b1';

      const created = await withdrawalService.createWithdrawal({
        ...req.body,
        userId: targetUserId,
        userName: targetUserName,
        branchId: targetBranchId,
        date: req.body.date || new Date().toISOString(),
      });

      return sendResponse(res, 201, 'Salary withdrawal recorded successfully', created);
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const authUser = (req as any).user;
      const id = req.params.id as string;
      const existing = await withdrawalService.getWithdrawalById(id);

      // Only admin or the employee who created it can delete
      if (authUser.role !== 'admin' && authUser.userId !== existing.userId) {
        throw new AppError('Forbidden: Access denied to delete this withdrawal', 403);
      }

      const result = await withdrawalService.deleteWithdrawal(id);
      return sendResponse(res, 200, 'Salary withdrawal deleted successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

