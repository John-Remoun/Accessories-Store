import { AppDataSource } from '../../config/data-source';
import { BranchEntity } from './branch.entity';
import { AppError } from '../../common/exceptions/app-error';

export class BranchService {
  private branchRepo = AppDataSource.getRepository(BranchEntity);

  public async getAllBranches() {
    return this.branchRepo.find({
      order: { createdAt: 'ASC' },
    });
  }

  public async getBranchById(id: string) {
    const branch = await this.branchRepo.findOne({ where: { id } });
    if (!branch) {
      throw new AppError('Branch not found', 404);
    }
    return branch;
  }

  public async createBranch(data: Partial<BranchEntity>) {
    const id = data.id || `b_${Date.now()}`;
    const branch = this.branchRepo.create({
      ...data,
      id,
    });
    return this.branchRepo.save(branch);
  }

  public async updateBranch(id: string, updates: Partial<BranchEntity>) {
    const branch = await this.getBranchById(id);
    Object.assign(branch, updates);
    return this.branchRepo.save(branch);
  }

  public async deleteBranch(id: string) {
    const branch = await this.getBranchById(id);
    await this.branchRepo.remove(branch);
    return { success: true };
  }
}
