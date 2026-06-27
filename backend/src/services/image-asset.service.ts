import { Types } from 'mongoose';
import { ImageAssetModel, IMAGE_MIME_TYPES } from '../models/ImageAsset.js';
import { ImageFolderModel } from '../models/ImageFolder.js';
import { ApiError } from '../middleware/errorHandler.js';
import { resolveAccountId } from './account.service.js';
import { visibleQuery } from './category.service.js';
import { galleryBucket, getSupabaseAdmin } from '../config/supabase.js';

interface AssetFilters { accountId?: string; merchantId?: string; folderId?: string; scope?: string; search?: string }

function normalizeAsset(payload: Record<string, unknown>) {
  payload.accountId = resolveAccountId(String(payload.accountId ?? ''));
  if (payload.scope === 'shared') payload.merchantId = null;
  if (payload.scope !== 'shared' && payload.scope !== 'merchant') throw new ApiError(400, 'Image scope is required.');
  if (payload.scope === 'merchant' && !payload.merchantId) throw new ApiError(400, 'merchantId is required for merchant images.');
  for (const key of ['merchantId', 'folderId'] as const) if (payload[key] && !Types.ObjectId.isValid(String(payload[key]))) throw new ApiError(400, `${key} must be a valid MongoDB ObjectId.`);
  if (!payload.folderId) payload.folderId = null;
  if (!String(payload.name ?? '').trim()) throw new ApiError(400, 'Image name is required.');
  if (!String(payload.url ?? '').trim()) throw new ApiError(400, 'Image URL is required.');
  if (payload.storageProvider !== 'supabase') throw new ApiError(400, 'storageProvider must be supabase.');
  if (!String(payload.storagePath ?? '').trim()) throw new ApiError(400, 'storagePath is required for Supabase assets.');
  if (!String(payload.bucket ?? '').trim()) throw new ApiError(400, 'bucket is required for Supabase assets.');
  if (!IMAGE_MIME_TYPES.includes(payload.mimeType as typeof IMAGE_MIME_TYPES[number])) throw new ApiError(400, 'Unsupported image mimeType.');
  if (!Array.isArray(payload.tags) || payload.tags.some((tag) => typeof tag !== 'string')) throw new ApiError(400, 'Tags must be an array of strings.');
}

export async function listAssets(filters: AssetFilters) {
  const accountId = resolveAccountId(filters.accountId);
  const query: Record<string, unknown> = { ...visibleQuery(accountId, filters.merchantId), folderId: filters.folderId || null };
  if (filters.scope === 'shared' || filters.scope === 'merchant') query.scope = filters.scope;
  if (filters.search) query.$and = [{ $or: [{ name: { $regex: filters.search, $options: 'i' } }, { filename: { $regex: filters.search, $options: 'i' } }, { altText: { $regex: filters.search, $options: 'i' } }, { tags: { $regex: filters.search, $options: 'i' } }] }];
  return ImageAssetModel.find(query).sort({ name: 1 });
}

export async function getAsset(id: string) {
  const asset = await ImageAssetModel.findById(id);
  if (!asset) throw new ApiError(404, 'Image asset not found.');
  return asset;
}

async function assertFolderAvailable(payload: Record<string, unknown>) {
  if (!payload.folderId) return;
  const folder = await ImageFolderModel.findById(payload.folderId);
  if (!folder || String(folder.accountId) !== String(payload.accountId) || folder.scope !== payload.scope || String(folder.merchantId ?? '') !== String(payload.merchantId ?? '')) throw new ApiError(400, 'Folder must belong to the same account and scope as the image.');
}
export async function createAsset(payload: Record<string, unknown>) {
  normalizeAsset(payload);
  await assertFolderAvailable(payload);
  return ImageAssetModel.create(payload);
}

export async function updateAsset(id: string, payload: Record<string, unknown>) {
  normalizeAsset(payload);
  await assertFolderAvailable(payload);
  const updated = await ImageAssetModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  if (!updated) throw new ApiError(404, 'Image asset not found.');
  return updated;
}

export async function moveAsset(id: string, folderId?: string | null) {
  const asset = await ImageAssetModel.findById(id);
  if (!asset) throw new ApiError(404, 'Image asset not found.');
  if (String(asset.folderId ?? '') === String(folderId ?? '')) throw new ApiError(400, 'Image is already in that folder.');
  if (folderId) {
    if (!Types.ObjectId.isValid(folderId)) throw new ApiError(400, 'folderId must be a valid MongoDB ObjectId.');
    const folder = await ImageFolderModel.findById(folderId);
    if (!folder || String(folder.accountId) !== String(asset.accountId) || folder.scope !== asset.scope || String(folder.merchantId ?? '') !== String(asset.merchantId ?? '')) throw new ApiError(400, 'Destination folder must use the same account and scope as the image.');
  }
  // TODO: A future improvement can move the Supabase object; current moves update library metadata only.
  asset.folderId = folderId ? new Types.ObjectId(folderId) : null;
  await asset.save();
  return asset;
}

export async function deleteAsset(id: string) {
  const asset = await ImageAssetModel.findById(id);
  if (!asset) throw new ApiError(404, 'Image asset not found.');
  if (asset.storageProvider === 'supabase' && asset.storagePath) {
    try {
      const { error } = await getSupabaseAdmin().storage.from(asset.bucket || galleryBucket).remove([asset.storagePath]);
      if (error) throw error;
    } catch (error) {
      throw new ApiError(502, `Supabase file deletion failed: ${error instanceof Error ? error.message : 'Unknown Storage error'}`);
    }
  }
  try {
    await ImageAssetModel.deleteOne({ _id: asset._id });
  } catch (error) {
    throw new ApiError(500, `Image metadata deletion failed after Storage deletion: ${error instanceof Error ? error.message : 'Unknown database error'}`);
  }
  return { deleted: true };
}