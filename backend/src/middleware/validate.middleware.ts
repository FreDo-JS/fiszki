import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';

// Validates and REPLACES req.body/query/params with the parsed result of the
// schema. Because zod objects are not `.passthrough()` by default, any field
// not explicitly declared in the schema is stripped here — this is what
// prevents mass-assignment (e.g. a client trying to smuggle `role: "ADMIN"`
// or `userId` into a request body).
export function validate(schema: AnyZodObject) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (parsed.body) req.body = parsed.body;
      if (parsed.query) req.query = parsed.query;
      if (parsed.params) req.params = parsed.params;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(ApiError.badRequest('Validation failed', err.flatten()));
      }
      next(err);
    }
  };
}
