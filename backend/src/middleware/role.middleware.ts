import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';

export function requireRole(...roles: Array<'USER' | 'ADMIN'>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
}
