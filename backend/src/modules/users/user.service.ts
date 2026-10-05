import bcrypt from 'bcryptjs';
import { AppDataSource } from '../../config/data-source';
import { UserEntity } from './user.entity';
import { AppError } from '../../common/exceptions/app-error';

export class UserService {
  private userRepo = AppDataSource.getRepository(UserEntity);

  public async getAllUsers() {
    return this.userRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  public async getUserById(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }

  public async getUserByUsername(username: string) {
    return this.userRepo.findOne({ where: { username: username.trim() } });
  }

  public async createUser(data: Partial<UserEntity>) {
    const existing = await this.userRepo.findOne({ where: { username: data.username } });
    if (existing) {
      throw new AppError('Username already exists', 400);
    }

    const id = data.id || `u_${Date.now()}`;
    const rawPassword = data.password || 'password';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const user = this.userRepo.create({
      ...data,
      id,
      password: hashedPassword,
      joinDate: data.joinDate || new Date().toISOString().split('T')[0],
      salesCount: data.salesCount || 0,
    });

    await this.userRepo.save(user);

    const { password: _, refreshToken: __, ...userWithoutSecrets } = user;
    return userWithoutSecrets;
  }

  public async updateUser(id: string, updates: Partial<UserEntity>) {
    const user = await this.getUserById(id);

    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    Object.assign(user, updates);
    await this.userRepo.save(user);

    const { password: _, refreshToken: __, ...userWithoutSecrets } = user;
    return userWithoutSecrets;
  }

  public async deleteUser(id: string) {
    const user = await this.getUserById(id);
    await this.userRepo.remove(user);
    return { success: true };
  }
}
