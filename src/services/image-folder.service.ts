import { Types } from 'mongoose';
import { ImageFolderModel } from '../models/ImageFolder.js';
import { ImageAssetModel } from '../models/ImageAsset.js';
import { ApiError } from '../middleware/errorHandler.js';
import { resolveAccountId } from './account.service.js';
import { slugify } from '../utils/slug.js';
import { visibleQuery } from './category.service.js';

interface FolderFilters { accountId?: string; merchantId?: string; folderId?: string; scope?: string; search?: string }

function normalizeScope(data: Record<string, unknown>) {
  if (data.scope === 'shared') data.merchantId = null;
  if (data.scope !== 'shared' && data.scope !== 'merchant') throw new ApiError(400, 'Folder scope is required.');
  if (data.scope === 'merchant' && !data.merchantId) throw new ApiError(400, 'merchantId is required for merchant folders.');
}

function normalizeRefs(data: Record<string, unknown>) {
  data.accountId = resolveAccountId(String(data.accountId ?? ''));
  normalizeScope(data);
  for (const key of ['merchantId', 'parentFolderId'] as const) {
    if (data[key] && !Types.ObjectId.isValid(String(data[key]))) throw new ApiError(400, `${key} must be a valid MongoDB ObjectId.`);
  }
  if (!data.parentFolderId) data.parentFolderId = null;
}

export async function listFolders(filters: FolderFilters) {
  const accountId = resolveAccountId(filters.accountId);
  const query: Record<string, unknown> = { ...visibleQuery(accountId, filters.merchantId), parentFolderId: filters.folderId || null };
  if (filters.scope === 'shared' || filters.scope === 'merchant') query.scope = filters.scope;
  if (filters.search) query.name = { $regex: filters.search, $options: 'i' };
  return ImageFolderModel.find(query).sort({ sortOrder: 1, name: 1 });
}

export async function listAllFolders(filters: Pick<FolderFilters, 'accountId' | 'merchantId'>) {
  const accountId = resolveAccountId(filters.accountId);
  return ImageFolderModel.find(visibleQuery(accountId, filters.merchantId)).sort({ name: 1 });
}

async function assertParentAvailable(data: Record<string, unknown>) {
  if (!data.parentFolderId) return;
  const parent = await ImageFolderModel.findById(data.parentFolderId);
  if (!parent || String(parent.accountId) !== String(data.accountId) || parent.scope !== data.scope || String(parent.merchantId ?? '') !== String(data.merchantId ?? '')) throw new ApiError(400, 'Parent folder must belong to the same account and scope.');
}
export async function createFolder(payload: Record<string, unknown>) {
  normalizeRefs(payload);
  if (!String(payload.name ?? '').trim()) throw new ApiError(400, 'Folder name is required.');
  await assertParentAvailable(payload);
  payload.slug = slugify(String(payload.name));
  const duplicate = await ImageFolderModel.findOne({ accountId: payload.accountId, merchantId: payload.scope === 'shared' ? null : payload.merchantId, scope: payload.scope, parentFolderId: payload.parentFolderId, slug: payload.slug });
  if (duplicate) throw new ApiError(409, 'Folder name must be unique inside this folder.');
  return ImageFolderModel.create(payload);
}

export async function updateFolder(id: string, payload: Record<string, unknown>) {
  normalizeRefs(payload);
  if (!String(payload.name ?? '').trim()) throw new ApiError(400, 'Folder name is required.');
  await assertParentAvailable(payload);
  payload.slug = slugify(String(payload.name));
  const duplicate = await ImageFolderModel.findOne({ _id: { $ne: id }, accountId: payload.accountId, merchantId: payload.scope === 'shared' ? null : payload.merchantId, scope: payload.scope, parentFolderId: payload.parentFolderId, slug: payload.slug });
  if (duplicate) throw new ApiError(409, 'Folder name must be unique inside this folder.');
  return ImageFolderModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
}

export async function deleteFolder(id: string) {
  const [child, asset] = await Promise.all([ImageFolderModel.exists({ parentFolderId: id }), ImageAssetModel.exists({ folderId: id })]);
  if (child || asset) throw new ApiError(409, 'Folder must be empty before it can be deleted.');
  const deleted = await ImageFolderModel.findByIdAndDelete(id);
  if (!deleted) throw new ApiError(404, 'Folder not found.');
  return deleted;
}

export async function getFolder(id: string) { return ImageFolderModel.findById(id); }