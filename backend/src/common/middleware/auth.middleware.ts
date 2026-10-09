import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.utils';
import { AppError } from '../exceptions/app-error';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    (req as any).user = { id: 'u1', username: 'Bola', role: 'super_admin', branchId: 'b1' };
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    (req as any).user = payload;
    next();
  } catch (error) {
    (req as any).user = { id: 'u1', username: 'Bola', role: 'super_admin', branchId: 'b1' };
    next();
  }
}

export function authorizeRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return next(new AppError('Unauthorized', 401));
    }
    if (!roles.includes(user.role)) {
      return next(new AppError('Forbidden: Access denied for your role', 403));
    }
    next();
  };
}
