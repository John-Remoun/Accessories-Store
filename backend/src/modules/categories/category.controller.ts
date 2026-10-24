import { Request, Response, NextFunction } from 'express';
import { CategoryService } from './category.service';
import { sendResponse } from '../../common/utils/response.utils';
import { resolveBranchScope } from '../../common/utils/branch-auth.utils';
import { AppError } from '../../common/exceptions/app-error';

const categoryService = new CategoryService();

export class CategoryController {
  public async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, no-cache');
      const scope = await resolveBranchScope(req, req.query.branchId as string | undefined);
      const targetBranchId = scope.isGlobalAdmin ? (req.query.branchId as string | undefined) : scope.branchId;
      const categories = await categoryService.getAllCategories(targetBranchId);
      return sendResponse(res, 200, 'Categories retrieved successfully', categories);
    } catch (error) {
      next(error);
    }
  }

  public async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, no-cache');
      const id = req.params.id as string;
      const category = await categoryService.getCategoryById(id);
      const scope = await resolveBranchScope(req, category.branchId);
      if (!scope.isGlobalAdmin && category.branchId !== scope.branchId) {
        throw new AppError('Forbidden: Access denied to category of another branch', 403);
      }
      return sendResponse(res, 200, 'Category retrieved successfully', category);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = await resolveBranchScope(req);
      const targetBranchId = scope.isGlobalAdmin ? (req.body.branchId || scope.branchId) : scope.branchId;
      if (!targetBranchId) {
        throw new AppError('branchId is required to create a category', 400);
      }
      const category = await categoryService.createCategory({
        ...req.body,
        branchId: targetBranchId,
      });
      return sendResponse(res, 201, 'Category created successfully', category);
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const existing = await categoryService.getCategoryById(id);
      const scope = await resolveBranchScope(req, existing.branchId);
      const { nameAr } = req.body;
      const category = await categoryService.updateCategory(id, nameAr, scope.branchId, scope.isGlobalAdmin);
      return sendResponse(res, 200, 'Category updated successfully', category);
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const existing = await categoryService.getCategoryById(id);
      const scope = await resolveBranchScope(req, existing.branchId);
      const result = await categoryService.deleteCategory(id, scope.branchId, scope.isGlobalAdmin);
      return sendResponse(res, 200, 'Category deleted successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
