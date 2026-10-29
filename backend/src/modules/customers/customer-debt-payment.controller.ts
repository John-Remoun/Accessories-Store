import { Request, Response, NextFunction } from 'express';
import { customerDebtPaymentService } from './customer-debt-payment.service';
import { sendResponse } from '../../common/utils/response';

export class CustomerDebtPaymentController {
  public async getDebtPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.query.branchId as string;
      const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
      const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const payments = await customerDebtPaymentService.getDebtPayments({
        branchId,
        year,
        month,
        startDate,
        endDate,
      });

      return sendResponse(res, 200, 'Customer debt payments retrieved successfully', payments);
    } catch (err) {
      next(err);
    }
  }

  public async createDebtPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const payload = {
        ...req.body,
        userName: user?.name || user?.username || req.body.userName,
      };
      const payment = await customerDebtPaymentService.createDebtPayment(payload);
      return sendResponse(res, 201, 'Debt payment recorded successfully', payment);
    } catch (err) {
      next(err);
    }
  }

  public async deleteDebtPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await customerDebtPaymentService.deleteDebtPayment(id);
      return sendResponse(res, 200, 'Debt payment deleted successfully', result);
    } catch (err) {
      next(err);
    }
  }
}

export const customerDebtPaymentController = new CustomerDebtPaymentController();

