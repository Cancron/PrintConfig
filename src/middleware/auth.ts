import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './errorHandler.js';
import { verifyToken } from '../services/auth.service.js';
import { withAccountContext } from '../db/accountContext.js';

export interface AuthedRequest extends Request {
  user?: {
    id: string;
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
      id: String(payload.sub),
      email: String(payload.email ?? ''),
      name: String(payload.name ?? ''),
      role: String(payload.role ?? 'admin'),
      accountId: payload.accountId ? String(payload.accountId) : undefined,
    };
    if (!req.user.accountId) throw new Error('Account is missing from authentication token.');
    const accountId = req.user.accountId;
    if (req.query.accountId && req.query.accountId !== accountId) {
      next(new ApiError(403, 'Account does not match your session.'));
      return;
    }
    if (req.body?.accountId && req.body.accountId !== accountId) {
      next(new ApiError(403, 'Account does not match your session.'));
      return;
    }
    req.query.accountId = accountId;
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) req.body.accountId = accountId;
    withAccountContext(accountId, next);
  } catch {
    next(new ApiError(401, 'Invalid or expired token.'));
  }
}
