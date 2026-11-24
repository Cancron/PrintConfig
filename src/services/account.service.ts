import { isUuid } from '../utils/uuid.js';
import { ApiError } from '../middleware/errorHandler.js';

export function resolveAccountId(accountId?: string) {
  if (accountId && isUuid(accountId)) return accountId;
  throw new ApiError(400, 'A valid accountId is required.');
}
