import { Request, Response, NextFunction } from 'express';
import { BranchService } from './branch.service';
import { sendResponse } from '../../common/utils/response.utils';

const branchService = new BranchService();

export class BranchController {
  public async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const branches = await branchService.getAllBranches();
      return sendResponse(res, 200, 'Branches retrieved successfully', branches);
    } catch (error) {
      next(error);
    }
  }

  public async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const branch = await branchService.getBranchById(id);
      return sendResponse(res, 200, 'Branch retrieved successfully', branch);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction) {
    try {
      const branch = await branchService.createBranch(req.body);
      return sendResponse(res, 201, 'Branch created successfully', branch);
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const branch = await branchService.updateBranch(id, req.body);
      return sendResponse(res, 200, 'Branch updated successfully', branch);
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await branchService.deleteBranch(id);
      return sendResponse(res, 200, 'Branch deleted successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
