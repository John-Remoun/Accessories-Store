import { Request, Response, NextFunction } from 'express';
import { CompositionService } from './composition.service';
import { sendResponse } from '../../common/utils/response.utils';
import { resolveBranchScope } from '../../common/utils/branch-auth.utils';

const compService = new CompositionService();

export class CompositionController {
  public async getByBranch(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, no-cache');
      const branchId = req.params.branchId as string;
      await resolveBranchScope(req, branchId);
      const compositions = await compService.getCompositionsByBranch(branchId);
      return sendResponse(res, 200, 'Branch compositions retrieved', compositions);
    } catch (error) {
      next(error);
    }
  }

  public async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, no-cache');
      const id = req.params.id as string;
      const comp = await compService.getCompositionById(id);
      await resolveBranchScope(req, comp.branchId);
      return sendResponse(res, 200, 'Composition retrieved', comp);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = await resolveBranchScope(req, req.body.branchId);
      const targetBranchId = scope.isGlobalAdmin ? (req.body.branchId || scope.branchId || 'b1') : scope.branchId;
      const payload = {
        ...req.body,
        branchId: targetBranchId,
      };
      const comp = await compService.createComposition(payload);
      return sendResponse(res, 201, 'Composition bundle created', comp);
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const existing = await compService.getCompositionById(id);
      await resolveBranchScope(req, existing.branchId);
      const result = await compService.deleteComposition(id);
      return sendResponse(res, 200, 'Composition bundle deleted', result);
    } catch (error) {
      next(error);
    }
  }
}
