import { Request, Response, NextFunction } from 'express';
import { CustomerService } from './customer.service';
import { sendResponse } from '../../common/utils/response.utils';
import { resolveBranchScope } from '../../common/utils/branch-auth.utils';
import { AppError } from '../../common/exceptions/app-error';

const customerService = new CustomerService();

export class CustomerController {
  public async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, no-cache');
      const scope = await resolveBranchScope(req, req.query.branchId as string | undefined);
      const targetBranchId = scope.isGlobalAdmin ? (req.query.branchId as string | undefined) : scope.branchId;
      const customers = await customerService.getAllCustomers(targetBranchId);
      return sendResponse(res, 200, 'Customers retrieved successfully', customers);
    } catch (error) {
      next(error);
    }
  }

  public async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, no-cache');
      const id = req.params.id as string;
      const customer = await customerService.getCustomerById(id);
      const scope = await resolveBranchScope(req, customer.branchId);
      if (!scope.isGlobalAdmin && customer.branchId !== scope.branchId) {
        throw new AppError('Forbidden: Access denied to customer of another branch', 403);
      }
      return sendResponse(res, 200, 'Customer retrieved successfully', customer);
    } catch (error) {
      next(error);
    }
  }

  public async createOrUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = await resolveBranchScope(req);
      const targetBranchId = scope.isGlobalAdmin ? (req.body.branchId || scope.branchId) : scope.branchId;
      if (!targetBranchId) {
        throw new AppError('branchId is required to create or update a customer', 400);
      }
      const customer = await customerService.createOrUpdateCustomer(
        { ...req.body, branchId: targetBranchId },
        scope.branchId,
        scope.isGlobalAdmin
      );
      return sendResponse(res, 201, 'Customer saved successfully', customer);
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const idOrPhone = req.params.idOrPhone as string;
      const customer = await customerService.getCustomerById(idOrPhone).catch(() => null);
      if (customer) {
        const scope = await resolveBranchScope(req, customer.branchId);
        const result = await customerService.deleteCustomer(idOrPhone, scope.branchId, scope.isGlobalAdmin);
        return sendResponse(res, 200, 'Customer deleted successfully', result);
      }
      const result = await customerService.deleteCustomer(idOrPhone);
      return sendResponse(res, 200, 'Customer deleted successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
