import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './errorHandler.js';

export function validateRequest(validate: (req: Request) => string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors = validate(req);
    if (errors.length > 0) return next(new ApiError(400, 'Validation failed.', errors));
    next();
  };
}
