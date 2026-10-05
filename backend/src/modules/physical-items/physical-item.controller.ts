import { Request, Response, NextFunction } from 'express';
import { PhysicalItemService } from './physical-item.service';
import { sendResponse } from '../../common/utils/response.utils';

const itemService = new PhysicalItemService();

export class PhysicalItemController {
  public async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await itemService.getAllItems();
      return sendResponse(res, 200, 'Physical items retrieved successfully', items);
    } catch (error) {
      next(error);
    }
  }

  public async getByProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const productId = req.params.productId as string;
      const items = await itemService.getItemsByProduct(productId);
      return sendResponse(res, 200, 'Physical items for product retrieved', items);
    } catch (error) {
      next(error);
    }
  }

  public async getByBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.params.branchId as string;
      const items = await itemService.getItemsByBranch(branchId);
      return sendResponse(res, 200, 'Physical items for branch retrieved', items);
    } catch (error) {
      next(error);
    }
  }

  public async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId, branchId, quantity, prefix } = req.body;
      const items = await itemService.generateItems(productId, branchId, quantity, prefix || 'ITEM');
      return sendResponse(res, 201, 'Physical items generated successfully', items);
    } catch (error) {
      next(error);
    }
  }

  public async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { status } = req.body;
      const item = await itemService.markItemStatus(id, status);
      return sendResponse(res, 200, 'Physical item status updated', item);
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await itemService.deleteItem(id);
      return sendResponse(res, 200, 'Physical item deleted successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
