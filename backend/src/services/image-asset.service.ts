import { Types } from 'mongoose';
import { ImageAssetModel, IMAGE_MIME_TYPES } from '../models/ImageAsset.js';
import { ImageFolderModel } from '../models/ImageFolder.js';
import { ApiError } from '../middleware/errorHandler.js';
import { resolveAccountId } from './account.service.js';
import { visibleQuery } from './category.service.js';
import { galleryBucket } from '../config/supabase.js';
import { createPresignedUploadUrl, deleteObjects, headObject, r2Bucket, r2PublicUrl, type StorageProvider } from '../config/storage.js';
import { randomBytes } from 'node:crypto';

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
  if (payload.storageProvider !== 'supabase' && payload.storageProvider !== 'r2') throw new ApiError(400, 'Unsupported storage provider.');
  if (!String(payload.storagePath ?? '').trim()) throw new ApiError(400, 'storagePath is required for stored assets.');
  if (!String(payload.bucket ?? '').trim()) throw new ApiError(400, 'bucket is required for stored assets.');
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

export async function createUploadIntent(payload: Record<string, unknown>, authenticatedAccountId?: string) {
  const accountId = resolveAccountId(String(payload.accountId ?? authenticatedAccountId ?? ''));
  if (authenticatedAccountId && accountId !== authenticatedAccountId) throw new ApiError(403, 'Cannot upload assets for another account.');
  const scope = payload.scope === 'merchant' ? 'merchant' : payload.scope === 'shared' ? 'shared' : '';
  if (!scope) throw new ApiError(400, 'Image scope is required.');
  const merchantId = scope === 'merchant' ? String(payload.merchantId ?? '') : '';
  if (scope === 'merchant' && !Types.ObjectId.isValid(merchantId)) throw new ApiError(400, 'merchantId is required for merchant images.');
  const folderId = payload.folderId ? String(payload.folderId) : null;
  if (folderId && !Types.ObjectId.isValid(folderId)) throw new ApiError(400, 'folderId must be a valid MongoDB ObjectId.');
  const mimeType = String(payload.mimeType ?? '');
  if (!IMAGE_MIME_TYPES.includes(mimeType as typeof IMAGE_MIME_TYPES[number])) throw new ApiError(400, 'Unsupported image mimeType.');
  const sizeBytes = Number(payload.sizeBytes ?? 0);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > 10 * 1024 * 1024) throw new ApiError(400, 'Image must be between 1 byte and 10 MB.');

  let storagePath = '';
  const overwriteAssetId = String(payload.overwriteAssetId ?? '');
  if (overwriteAssetId) {
    if (!Types.ObjectId.isValid(overwriteAssetId)) throw new ApiError(400, 'overwriteAssetId must be a valid MongoDB ObjectId.');
    const asset = await ImageAssetModel.findById(overwriteAssetId);
    if (!asset || String(asset.accountId) !== accountId) throw new ApiError(404, 'Image asset to overwrite was not found.');
    storagePath = String(asset.storagePath);
  } else {
    const filename = `${Date.now()}-${randomBytes(4).toString('hex')}-${safeFilename(String(payload.filename ?? 'image'))}`;
    storagePath = scope === 'merchant'
      ? `accounts/${accountId}/merchants/${merchantId}/${folderId || 'root'}/${filename}`
      : `accounts/${accountId}/shared/${folderId || 'root'}/${filename}`;
  }
  return createPresignedUploadUrl({ storagePath, contentType: mimeType });
}

export async function completeUpload(payload: Record<string, unknown>, authenticatedAccountId?: string) {
  const accountId = resolveAccountId(String(payload.accountId ?? authenticatedAccountId ?? ''));
  if (authenticatedAccountId && accountId !== authenticatedAccountId) throw new ApiError(403, 'Cannot complete uploads for another account.');
  const storagePath = String(payload.storagePath ?? '').replace(/^\/+|\/+$/g, '');
  if (!storagePath.startsWith(`accounts/${accountId}/`)) throw new ApiError(403, 'Storage path does not belong to this account.');
  const metadata = await headObject(storagePath, r2Bucket).catch(() => null);
  if (!metadata) throw new ApiError(400, 'Uploaded R2 object was not found.');
  const expectedSize = Number(payload.sizeBytes ?? 0);
  if (expectedSize > 0 && Number(metadata.ContentLength ?? 0) !== expectedSize) throw new ApiError(400, 'Uploaded object size does not match the requested file.');
  const mimeType = String(payload.mimeType ?? metadata.ContentType ?? '');
  const publicUrl = r2PublicUrl(storagePath);
  const assetPayload: Record<string, unknown> = {
    ...payload,
    accountId,
    url: publicUrl,
    publicUrl,
    storageProvider: 'r2',
    bucket: r2Bucket,
    storagePath,
    mimeType,
    sizeBytes: Number(metadata.ContentLength ?? expectedSize),
  };
  delete assetPayload.overwriteAssetId;
  normalizeAsset(assetPayload);
  await assertFolderAvailable(assetPayload);
  const overwriteAssetId = String(payload.overwriteAssetId ?? '');
  if (overwriteAssetId) {
    const updated = await ImageAssetModel.findOneAndUpdate({ _id: overwriteAssetId, accountId }, assetPayload, { new: true, runValidators: true });
    if (!updated) throw new ApiError(404, 'Image asset to update was not found.');
    return updated;
  }
  return ImageAssetModel.create(assetPayload);
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
  if (asset.storagePath) {
    try {
      await deleteObjects([asset.storagePath], {
        provider: asset.storageProvider as StorageProvider,
        bucket: asset.bucket || (asset.storageProvider === 'supabase' ? galleryBucket : r2Bucket),
      });
    } catch (error) {
      throw new ApiError(502, `Storage file deletion failed: ${error instanceof Error ? error.message : 'Unknown storage error'}`);
    }
  }
  try {
    await ImageAssetModel.deleteOne({ _id: asset._id });
  } catch (error) {
    throw new ApiError(500, `Image metadata deletion failed after Storage deletion: ${error instanceof Error ? error.message : 'Unknown database error'}`);
  }
  return { deleted: true };
}

function safeFilename(value: string) {
  const normalized = value.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return normalized || 'image';
}
