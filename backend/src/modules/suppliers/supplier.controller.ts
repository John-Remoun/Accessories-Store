import { Request, Response, NextFunction } from 'express';
import { SupplierService } from './supplier.service';
import { sendResponse } from '../../common/utils/response.utils';

const supplierService = new SupplierService();

export class SupplierController {
  public async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const suppliers = await supplierService.getAllSuppliers();
      return sendResponse(res, 200, 'Suppliers retrieved successfully', suppliers);
    } catch (error) {
      next(error);
    }
  }

  public async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const supplier = await supplierService.getSupplierById(id);
      return sendResponse(res, 200, 'Supplier retrieved successfully', supplier);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction) {
    try {
      const supplier = await supplierService.createSupplier(req.body);
      return sendResponse(res, 201, 'Supplier created successfully', supplier);
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const supplier = await supplierService.updateSupplier(id, req.body);
      return sendResponse(res, 200, 'Supplier updated successfully', supplier);
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await supplierService.deleteSupplier(id);
      return sendResponse(res, 200, 'Supplier deleted successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
