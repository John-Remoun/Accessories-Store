import { Request, Response, NextFunction } from 'express';
import { ProductService } from './product.service';
import { sendResponse } from '../../common/utils/response.utils';

const productService = new ProductService();

export class ProductController {
  public async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const products = await productService.getAllProducts();
      return sendResponse(res, 200, 'Products retrieved successfully', products);
    } catch (error) {
      next(error);
    }
  }

  public async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const product = await productService.getProductById(id);
      return sendResponse(res, 200, 'Product retrieved successfully', product);
    } catch (error) {
      next(error);
    }
  }

  public async getAllBranchData(req: Request, res: Response, next: NextFunction) {
    try {
      const list = await productService.getAllBranchData();
      return sendResponse(res, 200, 'Product branch data list retrieved', list);
    } catch (error) {
      next(error);
    }
  }

  public async getBranchData(req: Request, res: Response, next: NextFunction) {
    try {
      const productId = req.params.productId as string;
      const branchId = req.params.branchId as string;
      const data = await productService.getBranchData(productId, branchId);
      return sendResponse(res, 200, 'Product branch data retrieved', data);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchDataList, ...productData } = req.body;
      const product = await productService.createProduct(productData, branchDataList);
      return sendResponse(res, 201, 'Product created successfully', product);
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const product = await productService.updateProduct(id, req.body);
      return sendResponse(res, 200, 'Product updated successfully', product);
    } catch (error) {
      next(error);
    }
  }

  public async updateBranchData(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await productService.updateBranchData(req.body);
      return sendResponse(res, 200, 'Branch pricing data updated', data);
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await productService.deleteProduct(id);
      return sendResponse(res, 200, 'Product deleted successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async adjustStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId, branchId, targetQuantity, prefix } = req.body;
      const result = await productService.adjustStockQuantity(productId, branchId, targetQuantity, prefix || 'ITEM');
      return sendResponse(res, 200, 'Stock adjusted successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
