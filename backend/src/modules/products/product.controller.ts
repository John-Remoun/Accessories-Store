import { Request, Response, NextFunction } from 'express';
import { ProductService } from './product.service';
import { sendResponse } from '../../common/utils/response.utils';
import { resolveBranchScope } from '../../common/utils/branch-auth.utils';
import { AppError } from '../../common/exceptions/app-error';

const productService = new ProductService();

export class ProductController {
  public async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, no-cache');
      const scope = await resolveBranchScope(req, req.query.branchId as string | undefined);
      const targetBranchId = scope.isGlobalAdmin ? (req.query.branchId as string | undefined) : scope.branchId;
      const products = await productService.getAllProducts(targetBranchId);
      return sendResponse(res, 200, 'Products retrieved successfully', products);
    } catch (error) {
      next(error);
    }
  }

  public async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, no-cache');
      const id = req.params.id as string;
      const product = await productService.getProductById(id);
      const scope = await resolveBranchScope(req, product.branchId);
      if (!scope.isGlobalAdmin && product.branchId !== scope.branchId) {
        throw new AppError('Forbidden: Access denied to product of another branch', 403);
      }
      return sendResponse(res, 200, 'Product retrieved successfully', product);
    } catch (error) {
      next(error);
    }
  }

  public async getAllBranchData(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
      const scope = await resolveBranchScope(req, req.query.branchId as string | undefined);
      const isGlobalAdmin = scope.isGlobalAdmin;
      const targetBranchId = isGlobalAdmin ? (req.query.branchId as string | undefined) : scope.branchId;

      // Direct SQL-level branch filtering and cost redaction with 30s cache
      const list = await productService.getAllBranchData(targetBranchId, isGlobalAdmin);

      return sendResponse(res, 200, 'Product branch data list retrieved', list);
    } catch (error) {
      next(error);
    }
  }

  public async getBranchData(req: Request, res: Response, next: NextFunction) {
    try {
      const productId = req.params.productId as string;
      const branchId = req.params.branchId as string;
      const scope = await resolveBranchScope(req, branchId);
      const data = await productService.getBranchData(productId, branchId);

      if (!data) {
        return sendResponse(res, 404, 'Product branch data not found', null);
      }

      if (!scope.isGlobalAdmin) {
        const { cost, ...safeData } = data as any;
        return sendResponse(res, 200, 'Product branch data retrieved', safeData);
      }

      return sendResponse(res, 200, 'Product branch data retrieved', data);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchDataList, ...productData } = req.body;
      const scope = await resolveBranchScope(req);
      const targetBranchId = scope.isGlobalAdmin ? (productData.branchId || scope.branchId) : scope.branchId;
      if (!targetBranchId) {
        throw new AppError('branchId is required to create a product', 400);
      }
      const cleanBranchDataList = Array.isArray(branchDataList)
        ? branchDataList.map((b: any) => (!scope.isGlobalAdmin ? { ...b, branchId: targetBranchId } : b))
        : branchDataList;
      const product = await productService.createProduct(
        { ...productData, branchId: targetBranchId },
        cleanBranchDataList,
        targetBranchId
      );
      return sendResponse(res, 201, 'Product created successfully', product);
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const existing = await productService.getProductById(id);
      const scope = await resolveBranchScope(req, existing.branchId);
      const product = await productService.updateProduct(id, req.body, scope.branchId, scope.isGlobalAdmin);
      return sendResponse(res, 200, 'Product updated successfully', product);
    } catch (error) {
      next(error);
    }
  }

  public async updateBranchData(req: Request, res: Response, next: NextFunction) {
    try {
      await resolveBranchScope(req, req.body.branchId);
      const data = await productService.updateBranchData(req.body);
      return sendResponse(res, 200, 'Branch pricing data updated', data);
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const existing = await productService.getProductById(id);
      const scope = await resolveBranchScope(req, existing.branchId);
      const result = await productService.deleteProduct(id, scope.branchId, scope.isGlobalAdmin);
      return sendResponse(res, 200, 'Product deleted successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async adjustStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId, branchId, targetQuantity, prefix } = req.body;
      await resolveBranchScope(req, branchId);
      const result = await productService.adjustStockQuantity(productId, branchId, targetQuantity, prefix || 'ITEM');
      return sendResponse(res, 200, 'Stock adjusted successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
