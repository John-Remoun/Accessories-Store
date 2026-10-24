import { AppDataSource } from '../../config/data-source';
import { CategoryEntity } from './category.entity';
import { ProductEntity } from '../products/product.entity';
import { AppError } from '../../common/exceptions/app-error';
import { memoryCache } from '../../common/cache/cache.service';

export class CategoryService {
  private categoryRepo = AppDataSource.getRepository(CategoryEntity);
  private productRepo = AppDataSource.getRepository(ProductEntity);

  public async getAllCategories(branchId?: string) {
    const targetBranch = branchId?.trim();
    const cacheKey = targetBranch ? `categories:branch:${targetBranch}` : 'categories:all';
    const cached = memoryCache.get<CategoryEntity[]>(cacheKey);
    if (cached) return cached;

    const whereClause = targetBranch ? { branchId: targetBranch } : {};
    const categories = await this.categoryRepo.find({
      where: whereClause,
      order: { createdAt: 'ASC' },
    });
    memoryCache.set(cacheKey, categories, 300);
    return categories;
  }

  public async getCategoryById(id: string) {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new AppError('Category not found', 404);
    }
    return category;
  }

  public async createCategory(data: { id?: string; nameAr: string; nameEn?: string; branchId: string }) {
    memoryCache.invalidate('categories');
    if (!data.branchId) {
      throw new AppError('branchId is required to create a category', 400);
    }
    const id = data.id || `cat_${Date.now()}_${data.branchId}`;
    const nameEn = data.nameEn || data.nameAr;
    const category = this.categoryRepo.create({
      id,
      nameAr: data.nameAr,
      nameEn,
      branchId: data.branchId,
    });
    return this.categoryRepo.save(category);
  }

  public async updateCategory(id: string, nameAr: string, scopeBranchId?: string, isGlobalAdmin?: boolean) {
    memoryCache.invalidate('categories');
    const category = await this.getCategoryById(id);

    if (!isGlobalAdmin && scopeBranchId && category.branchId !== scopeBranchId) {
      throw new AppError('Forbidden: Access denied to category belonging to another branch', 403);
    }

    category.nameAr = nameAr;
    category.nameEn = nameAr;
    return this.categoryRepo.save(category);
  }

  public async deleteCategory(id: string, scopeBranchId?: string, isGlobalAdmin?: boolean) {
    memoryCache.invalidate('categories');
    const category = await this.getCategoryById(id);

    if (!isGlobalAdmin && scopeBranchId && category.branchId !== scopeBranchId) {
      throw new AppError('Forbidden: Access denied to delete category belonging to another branch', 403);
    }
    
    // Block deletion if category has associated products
    const productCount = await this.productRepo.count({ where: { categoryId: id } });
    if (productCount > 0) {
      throw new AppError(`لا يمكن حذف هذه الفئة لأنها تحتوي على ${productCount} منتج مرتبط بها! يرجى نقل أو حذف المنتجات أولاً.`, 400);
    }

    await this.categoryRepo.remove(category);
    return { success: true };
  }
}
