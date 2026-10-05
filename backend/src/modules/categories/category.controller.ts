import { Request, Response, NextFunction } from 'express';
import { CategoryService } from './category.service';
import { sendResponse } from '../../common/utils/response.utils';

const categoryService = new CategoryService();

export class CategoryController {
  public async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await categoryService.getAllCategories();
      return sendResponse(res, 200, 'Categories retrieved successfully', categories);
    } catch (error) {
      next(error);
    }
  }

  public async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const category = await categoryService.getCategoryById(id);
      return sendResponse(res, 200, 'Category retrieved successfully', category);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await categoryService.createCategory(req.body);
      return sendResponse(res, 201, 'Category created successfully', category);
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { nameAr } = req.body;
      const category = await categoryService.updateCategory(id, nameAr);
      return sendResponse(res, 200, 'Category updated successfully', category);
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await categoryService.deleteCategory(id);
      return sendResponse(res, 200, 'Category deleted successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
