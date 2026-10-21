import { AppDataSource } from '../../config/data-source';
import { BranchEntity } from './branch.entity';
import { AppError } from '../../common/exceptions/app-error';
import { memoryCache } from '../../common/cache/cache.service';

export class BranchService {
  private branchRepo = AppDataSource.getRepository(BranchEntity);

  public async getAllBranches() {
    const cached = memoryCache.get<BranchEntity[]>('branches:all');
    if (cached) return cached;

    const branches = await this.branchRepo.find({
      order: { createdAt: 'ASC' },
    });
    memoryCache.set('branches:all', branches, 300);
    return branches;
  }

  public async getBranchById(id: string) {
    const branch = await this.branchRepo.findOne({ where: { id } });
    if (!branch) {
      throw new AppError('Branch not found', 404);
    }
    return branch;
  }

  public async createBranch(data: Partial<BranchEntity>) {
    memoryCache.invalidate('branches');
    const id = data.id || `b_${Date.now()}`;
    const branch = this.branchRepo.create({
      ...data,
      id,
    });
    return this.branchRepo.save(branch);
  }

  public async updateBranch(id: string, updates: Partial<BranchEntity>) {
    memoryCache.invalidate('branches');
    const branch = await this.getBranchById(id);
    Object.assign(branch, updates);
    return this.branchRepo.save(branch);
  }

  public async deleteBranch(id: string) {
    memoryCache.invalidate('branches');
    const branch = await this.getBranchById(id);
    await this.branchRepo.remove(branch);
    return { success: true };
  }
}
