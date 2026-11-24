import { createHash, randomBytes } from 'node:crypto';
import { MerchantModel } from '../models/Merchant.js';
import { resolveAccountId } from './account.service.js';
import { ApiError } from '../middleware/errorHandler.js';

export { resolveAccountId };

export async function listMerchants(accountId?: string) {
  return MerchantModel.find({ accountId: resolveAccountId(accountId) }).sort({ name: 1 });
}

export async function getMerchant(id: string) {
  return MerchantModel.findById(id);
}

export async function createMerchant(data: Record<string, unknown>) {
  const payload = { ...data };
  delete payload.apiPrivateKeyHash;
  delete payload.apiPrivateKeySecret;
  delete payload.apiPrivateKeyLastFour;
  delete payload.apiPrivateKeyCreatedAt;
  return MerchantModel.create({ ...payload, accountId: resolveAccountId(String(payload.accountId ?? '')) });
}

export async function updateMerchant(id: string, data: Record<string, unknown>) {
  const payload = { ...data };
  delete payload.apiPrivateKeyHash;
  delete payload.apiPrivateKeySecret;
  delete payload.apiPrivateKeyLastFour;
  delete payload.apiPrivateKeyCreatedAt;
  if (payload.accountId) payload.accountId = resolveAccountId(String(payload.accountId));
  return MerchantModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
}

export async function deleteMerchant(id: string) {
  return MerchantModel.findByIdAndDelete(id);
}
function hashApiKey(apiKey: string) {
  return createHash('sha256').update(apiKey).digest('hex');
}

export async function rotateApiPrivateKey(id: string) {
  const apiPrivateKey = `kp_live_${randomBytes(32).toString('base64url')}`;
  const merchant = await MerchantModel.findByIdAndUpdate(
    id,
    {
      apiPrivateKeyHash: hashApiKey(apiPrivateKey),
      apiPrivateKeySecret: apiPrivateKey,
      apiPrivateKeyLastFour: apiPrivateKey.slice(-4),
      apiPrivateKeyCreatedAt: new Date(),
    },
    { new: true, runValidators: true }
  );
  return merchant ? { merchant, apiPrivateKey } : null;
}

export async function authenticateApiPrivateKey(apiPrivateKey: string) {
  if (!apiPrivateKey || !apiPrivateKey.startsWith('kp_live_')) return null;
  return MerchantModel.findOne({
    apiPrivateKeyHash: hashApiKey(apiPrivateKey),
    status: 'active',
  });
}
export async function getMerchantPublicConfig(apiPrivateKey: string) {
  const merchant = await authenticateApiPrivateKey(apiPrivateKey);
  if (!merchant) throw new ApiError(401, 'A valid merchant API private key is required.');
  
  return {
    _id: String(merchant._id),
    name: merchant.name,
    slug: merchant.slug,
    logoUrl: merchant.logoUrl,
    status: merchant.status,
    editorPrimaryColor: merchant.editorPrimaryColor,
    editorSecondaryColor: merchant.editorSecondaryColor,
    editorAccentColor: merchant.editorAccentColor,
  };
}
