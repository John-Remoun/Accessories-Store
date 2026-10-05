import { AppDataSource } from '../../config/data-source';
import { ProductCompositionEntity } from './composition.entity';
import { AppError } from '../../common/exceptions/app-error';

export class CompositionService {
  private compositionRepo = AppDataSource.getRepository(ProductCompositionEntity);

  public async getCompositionsByBranch(branchId: string) {
    return this.compositionRepo.find({
      where: { branchId },
      order: { createdAt: 'DESC' },
    });
  }

  public async createComposition(data: Partial<ProductCompositionEntity>) {
    const id = data.id || `comp_${Date.now()}`;
    const createdAt = data.createdAt || new Date().toISOString();

    const composition = this.compositionRepo.create({
      ...data,
      id,
      createdAt,
    });

    return this.compositionRepo.save(composition);
  }

  public async deleteComposition(id: string) {
    const comp = await this.compositionRepo.findOne({ where: { id } });
    if (!comp) {
      throw new AppError('Composition bundle not found', 404);
    }
    await this.compositionRepo.remove(comp);
    return { success: true };
  }
}
