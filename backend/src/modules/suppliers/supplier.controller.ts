import { Request, Response, NextFunction } from 'express';
import { SupplierService } from './supplier.service';
import { sendResponse } from '../../common/utils/response.utils';
import { resolveBranchScope } from '../../common/utils/branch-auth.utils';
import { AppError } from '../../common/exceptions/app-error';

const supplierService = new SupplierService();

export class SupplierController {
  public async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, no-cache');
      const scope = await resolveBranchScope(req, req.query.branchId as string | undefined);
      const targetBranchId = scope.isGlobalAdmin ? (req.query.branchId as string | undefined) : scope.branchId;
      const suppliers = await supplierService.getAllSuppliers(targetBranchId);
      return sendResponse(res, 200, 'Suppliers retrieved successfully', suppliers);
    } catch (error) {
      next(error);
    }
  }

  public async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, no-cache');
      const id = req.params.id as string;
      const supplier = await supplierService.getSupplierById(id);
      const scope = await resolveBranchScope(req, supplier.branchId);
      if (!scope.isGlobalAdmin && supplier.branchId !== scope.branchId) {
        throw new AppError('Forbidden: Access denied to supplier record of another branch', 403);
      }
      return sendResponse(res, 200, 'Supplier retrieved successfully', supplier);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = await resolveBranchScope(req);
      const targetBranchId = scope.isGlobalAdmin ? (req.body.branchId || scope.branchId) : scope.branchId;
      if (!targetBranchId) {
        throw new AppError('branchId is required to create a supplier record', 400);
      }
      const supplier = await supplierService.createSupplier(
        { ...req.body, branchId: targetBranchId },
        targetBranchId
      );
      return sendResponse(res, 201, 'Supplier created successfully', supplier);
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const existing = await supplierService.getSupplierById(id);
      const scope = await resolveBranchScope(req, existing.branchId);
      const supplier = await supplierService.updateSupplier(id, req.body, scope.branchId, scope.isGlobalAdmin);
      return sendResponse(res, 200, 'Supplier updated successfully', supplier);
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const existing = await supplierService.getSupplierById(id);
      const scope = await resolveBranchScope(req, existing.branchId);
      const result = await supplierService.deleteSupplier(id, scope.branchId, scope.isGlobalAdmin);
      return sendResponse(res, 200, 'Supplier deleted successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
