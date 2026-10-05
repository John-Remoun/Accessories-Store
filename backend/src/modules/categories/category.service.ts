import { AppDataSource } from '../../config/data-source';
import { CategoryEntity } from './category.entity';
import { ProductEntity } from '../products/product.entity';
import { AppError } from '../../common/exceptions/app-error';

export class CategoryService {
  private categoryRepo = AppDataSource.getRepository(CategoryEntity);
  private productRepo = AppDataSource.getRepository(ProductEntity);

  public async getAllCategories() {
    return this.categoryRepo.find({
      order: { createdAt: 'ASC' },
    });
  }

  public async getCategoryById(id: string) {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new AppError('Category not found', 404);
    }
    return category;
  }

  public async createCategory(data: { id?: string; nameAr: string; nameEn?: string }) {
    const id = data.id || `c_${Date.now()}`;
    const nameEn = data.nameEn || data.nameAr;
    const category = this.categoryRepo.create({
      id,
      nameAr: data.nameAr,
      nameEn,
    });
    return this.categoryRepo.save(category);
  }

  public async updateCategory(id: string, nameAr: string) {
    const category = await this.getCategoryById(id);
    category.nameAr = nameAr;
    category.nameEn = nameAr;
    return this.categoryRepo.save(category);
  }

  public async deleteCategory(id: string) {
    const category = await this.getCategoryById(id);
    
    // Block deletion if category has associated products
    const productCount = await this.productRepo.count({ where: { categoryId: id } });
    if (productCount > 0) {
      throw new AppError(`لا يمكن حذف هذه الفئة لأنها تحتوي على ${productCount} منتج مرتبط بها! يرجى نقل أو حذف المنتجات أولاً.`, 400);
    }

    await this.categoryRepo.remove(category);
    return { success: true };
  }
}
