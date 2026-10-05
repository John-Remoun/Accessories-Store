import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { sendResponse } from '../../common/utils/response.utils';

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
      const user = await userService.updateUser(id, req.body);
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
