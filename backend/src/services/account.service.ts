import { Types } from 'mongoose';
import { ApiError } from '../middleware/errorHandler.js';

export function resolveAccountId(accountId?: string) {
  if (accountId && Types.ObjectId.isValid(accountId)) return accountId;
  throw new ApiError(400, 'A valid accountId is required.');
}
