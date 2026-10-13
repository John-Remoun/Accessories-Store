import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { sendResponse } from '../../common/utils/response.utils';
import { AppError } from '../../common/exceptions/app-error';

const userService = new UserService();

export class UserController {
  public async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await userService.getAllUsers();
      return sendResponse(res, 200, 'Users retrieved successfully', users);
    } catch (error) {
      next(error);
    }
  }

  public async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const currentUser = (req as any).user;

      // Users can only view their own user detail unless admin or manager
      if (currentUser.role !== 'admin' && currentUser.role !== 'manager' && currentUser.userId !== id) {
        throw new AppError('Forbidden: Access denied', 403);
      }

      const user = await userService.getUserById(id);
      return sendResponse(res, 200, 'User retrieved successfully', user);
    } catch (error) {
      next(error);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userService.createUser(req.body);
      return sendResponse(res, 201, 'User created successfully', user);
    } catch (error) {
      next(error);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const currentUser = (req as any).user;
      const updates = { ...req.body };

      // Protection against unauthorized modification:
      // Non-admins can only update their own record
      if (currentUser.role !== 'admin' && currentUser.userId !== id) {
        throw new AppError('Forbidden: You can only update your own profile', 403);
      }

      // Protection against privilege escalation:
      // Non-admins cannot promote themselves or modify roles
      if (updates.role && currentUser.role !== 'admin') {
        throw new AppError('Forbidden: Only administrators can modify roles', 403);
      }

      const user = await userService.updateUser(id, updates);
      return sendResponse(res, 200, 'User updated successfully', user);
    } catch (error) {
      next(error);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await userService.deleteUser(id);
      return sendResponse(res, 200, 'User deleted successfully', result);
    } catch (error) {
      next(error);
    }
  }
}
