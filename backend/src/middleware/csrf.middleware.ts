import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Since auth relies on httpOnly cookies, state-changing requests are also
// required to carry an Origin (or Referer) header that matches the CORS
// whitelist. A cross-site page can trigger the request but cannot forge this
// header, which — combined with SameSite=Lax cookies — blocks CSRF without
// needing a separate token dance.
export function verifyOrigin(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.headers.origin ?? (req.headers.referer ? new URL(req.headers.referer).origin : undefined);

  if (!origin || !env.corsOrigin.includes(origin)) {
    return next(ApiError.forbidden('Invalid request origin'));
  }
  next();
}
