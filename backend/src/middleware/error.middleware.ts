import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { Prisma } from '@prisma/client';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { message: 'Route not found' } });
}

// Centralized error handler. Never leaks stack traces, SQL, or internal
// details to the client — only a safe message and, for validation errors, a
// field-level details payload.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, details: err.details },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: { message: 'A record with these details already exists' } });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: { message: 'Requested resource not found' } });
    }
  }

  console.error('[unhandled error]', err instanceof Error ? err.stack : err);
  res.status(500).json({ error: { message: 'Something went wrong. Please try again later.' } });
}
