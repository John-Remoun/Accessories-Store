import { Request, Response, NextFunction } from 'express';
import { PhysicalItemService } from './physical-item.service';
import { sendResponse } from '../../common/utils/response.utils';
import { resolveBranchScope } from '../../common/utils/branch-auth.utils';

const itemService = new PhysicalItemService();

export class PhysicalItemController {
  public async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, no-cache');
      const scope = await resolveBranchScope(req, req.query.branchId as string);
      const items = scope.isGlobalAdmin && !req.query.branchId
        ? await itemService.getAllItems()
        : await itemService.getItemsByBranch(scope.branchId || (req.query.branchId as string));
      return sendResponse(res, 200, 'Physical items retrieved successfully', items);
    } catch (error) {
      next(error);
    }
  }

  public async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, no-cache');
      const id = req.params.id as string;
      const item = await itemService.getItemById(id);
      await resolveBranchScope(req, item.branchId);
      return sendResponse(res, 200, 'Physical item retrieved successfully', item);
    } catch (error) {
      next(error);
    }
  }

  public async getByProduct(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, no-cache');
      const productId = req.params.productId as string;
      const scope = await resolveBranchScope(req);
      let items = await itemService.getItemsByProduct(productId);
      if (!scope.isGlobalAdmin && scope.branchId) {
        items = items.filter(it => it.branchId === scope.branchId);
      }
      return sendResponse(res, 200, 'Physical items for product retrieved', items);
    } catch (error) {
      next(error);
    }
  }

  public async getByBranch(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, no-cache');
      const branchId = req.params.branchId as string;
      await resolveBranchScope(req, branchId);
      const items = await itemService.getItemsByBranch(branchId);
      return sendResponse(res, 200, 'Physical items for branch retrieved', items);
    } catch (error) {
      next(error);
    }
  }

  public async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId, branchId, quantity, prefix } = req.body;
      const scope = await resolveBranchScope(req, branchId);
      const targetBranch = scope.isGlobalAdmin ? (branchId || scope.branchId || 'b1') : scope.branchId;
      const items = await itemService.generateItems(productId, targetBranch, quantity, prefix || 'ITEM');
      return sendResponse(res, 201, 'Physical items generated successfully', items);
    } catch (error) {
      next(error);
    }
  }

  public async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const existing = await itemService.getItemById(id);
      await resolveBranchScope(req, existing.branchId);
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
      const existing = await itemService.getItemById(id);
      await resolveBranchScope(req, existing.branchId);
      const result = await itemService.deleteItem(id);
      return sendResponse(res, 200, 'Physical item deleted successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
