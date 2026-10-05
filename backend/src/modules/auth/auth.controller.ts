import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { sendResponse } from '../../common/utils/response.utils';

const authService = new AuthService();

export class AuthController {
  public async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;
      const result = await authService.login(username, password);
      return sendResponse(res, 200, 'Login successful', result);
    } catch (error) {
      next(error);
    }
  }

  public async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refresh(refreshToken);
      return sendResponse(res, 200, 'Token refreshed successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (user) {
        await authService.logout(user.userId);
      }
      return sendResponse(res, 200, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  public async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) {
        return sendResponse(res, 401, 'Unauthorized');
      }
      const profile = await authService.getMe(user.userId);
      return sendResponse(res, 200, 'Current user profile fetched', profile);
    } catch (error) {
      next(error);
    }
  }
}
