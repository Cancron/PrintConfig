import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './errorHandler.js';
import { verifyToken } from '../services/auth.service.js';

export interface AuthedRequest extends Request {
  user?: {
    _id: string;
    email: string;
    name: string;
    role: string;
    accountId?: string;
  };
}

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new ApiError(401, 'Authentication required.'));
    return;
  }
  const token = header.slice(7);
  try {
    const payload = verifyToken(token);
    req.user = {
      _id: String(payload.sub),
      email: String(payload.email ?? ''),
      name: String(payload.name ?? ''),
      role: String(payload.role ?? 'admin'),
      accountId: payload.accountId ? String(payload.accountId) : undefined,
    };
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired token.'));
  }
}
