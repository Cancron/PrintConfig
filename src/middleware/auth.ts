import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './errorHandler.js';
import { verifyToken } from '../services/auth.service.js';
import { withAccountContext } from '../db/accountContext.js';
import { UserModel } from '../models/User.js';

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    accountId?: string;
  };
}

export async function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new ApiError(401, 'Authentication required.'));
    return;
  }
  const token = header.slice(7);
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    next(new ApiError(401, 'Invalid or expired token.'));
    return;
  }
  const accountId = String(payload.accountId ?? '');
  if (!accountId) {
    next(new ApiError(401, 'Invalid or expired token.'));
    return;
  }
  try {
    const user = await UserModel.findOne({ id: String(payload.sub ?? ''), accountId }).lean();
    if (!user || user.isActive !== true) {
      next(new ApiError(401, 'User account is inactive or missing.'));
      return;
    }
    req.user = {
      id: String(user.id),
      email: String(user.email ?? ''),
      name: String(user.name ?? ''),
      role: String(user.role ?? 'admin'),
      accountId,
    };
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
  } catch (error) {
    next(error);
  }
}
