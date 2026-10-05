import { Request, Response, NextFunction } from 'express';
import { CompositionService } from './composition.service';
import { sendResponse } from '../../common/utils/response.utils';

const compService = new CompositionService();

export class CompositionController {
  public async getByBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.params.branchId as string;
      const compositions = await compService.getCompositionsByBranch(branchId);
      return sendResponse(res, 200, 'Branch compositions retrieved', compositions);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction) {
    try {
      const comp = await compService.createComposition(req.body);
      return sendResponse(res, 201, 'Composition bundle created', comp);
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await compService.deleteComposition(id);
      return sendResponse(res, 200, 'Composition bundle deleted', result);
    } catch (error) {
      next(error);
    }
  }
}
