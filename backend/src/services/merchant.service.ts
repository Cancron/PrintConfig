import { MerchantModel } from '../models/Merchant.js';
import { resolveAccountId } from './account.service.js';

export { resolveAccountId };

export async function listMerchants(accountId?: string) {
  return MerchantModel.find({ accountId: resolveAccountId(accountId) }).sort({ name: 1 });
}

export async function getMerchant(id: string) {
  return MerchantModel.findById(id);
}

export async function createMerchant(data: Record<string, unknown>) {
  return MerchantModel.create({ ...data, accountId: resolveAccountId(String(data.accountId ?? '')) });
}

export async function updateMerchant(id: string, data: Record<string, unknown>) {
  const payload = { ...data };
  if (payload.accountId) payload.accountId = resolveAccountId(String(payload.accountId));
  return MerchantModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
}

export async function deleteMerchant(id: string) {
  return MerchantModel.findByIdAndDelete(id);
}

