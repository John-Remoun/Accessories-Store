import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.utils';
import { AppError } from '../exceptions/app-error';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication required: Missing or invalid authorization token', 401));
  }

  const token = authHeader.split(' ')[1];
  if (!token || token.trim() === '') {
    return next(new AppError('Authentication required: Token is missing', 401));
  }

  try {
    const payload = verifyAccessToken(token);
    (req as any).user = payload;
    next();
  } catch (error: any) {
    return next(new AppError('Invalid or expired authentication token', 401));
  }
}

export function authorizeRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return next(new AppError('Unauthorized: Authentication required', 401));
    }

    // Admin has superuser privileges across all routes
    if (user.role === 'admin' || user.role === 'super_admin') {
      return next();
    }

    if (!roles.includes(user.role)) {
      return next(new AppError('Forbidden: Access denied for your role', 403));
    }

    next();
  };
}
