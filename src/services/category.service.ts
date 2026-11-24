import { isUuid } from '../utils/uuid.js';
import { ProductCategoryModel } from '../models/ProductCategory.js';
import { ProductModel } from '../models/Product.js';
import { ApiError } from '../middleware/errorHandler.js';
import { slugify } from '../utils/slug.js';
import { resolveAccountId } from './account.service.js';

export function visibleQuery(accountId: string, merchantId?: string) {
  return { accountId, $or: isUuid(merchantId) ? [{ scope: 'shared' }, { scope: 'merchant', merchantId }] : [{ scope: 'shared' }] };
}

function normalizeScope(data: Record<string, unknown>) {
  if (data.scope === 'shared') data.merchantId = null;
  if (data.scope === 'merchant' && !data.merchantId) throw new ApiError(400, 'merchantId is required for merchant scoped categories.');
}

async function normalizeRefs(data: Record<string, unknown>) {
  data.accountId = resolveAccountId(String(data.accountId ?? ''));
  if (data.scope === 'shared') data.merchantId = null;
  if (data.merchantId && !isUuid(String(data.merchantId))) throw new ApiError(400, 'merchantId must be a valid UUID.');
}

async function assertUniqueSlug(data: Record<string, unknown>, id?: string) {
  const query: Record<string, unknown> = { accountId: data.accountId, scope: data.scope, merchantId: data.scope === 'shared' ? null : data.merchantId, slug: data.slug };
  if (id) query.id = { $ne: id };
  const existing = await ProductCategoryModel.findOne(query);
  if (existing) throw new ApiError(409, 'Category slug must be unique within account, scope, and merchant.');
}

export async function listCategories(filters: { accountId?: string; merchantId?: string }) {
  const accountId = resolveAccountId(filters.accountId);
  return ProductCategoryModel.find(visibleQuery(accountId, filters.merchantId)).sort({ sortOrder: 1, name: 1 });
}

export async function getCategory(id: string) {
  return ProductCategoryModel.findById(id);
}

export async function createCategory(payload: Record<string, unknown>) {
  normalizeScope(payload);
  await normalizeRefs(payload);
  payload.slug = payload.slug || slugify(String(payload.name ?? 'category'));
  await assertUniqueSlug(payload);
  return ProductCategoryModel.create(payload);
}

export async function updateCategory(id: string, payload: Record<string, unknown>) {
  normalizeScope(payload);
  await normalizeRefs(payload);
  payload.slug = payload.slug || slugify(String(payload.name ?? 'category'));
  await assertUniqueSlug(payload, id);
  return ProductCategoryModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
}

export async function deleteCategory(id: string) {
  return ProductCategoryModel.findByIdAndDelete(id);
}

export async function duplicateCategory(id: string, includeProducts = false) {
  const category = await ProductCategoryModel.findById(id).lean();
  if (!category) throw new ApiError(404, 'Category not found.');
  const copy = await ProductCategoryModel.create({ ...stripIds(category), name: `${category.name} Copy`, slug: `${category.slug}-copy-${Date.now()}`, status: 'draft' });
  let products: unknown[] = [];
  if (includeProducts) {
    const sourceProducts = await ProductModel.find({ categoryId: id }).lean();
    products = await ProductModel.insertMany(sourceProducts.map((product: any) => ({ ...stripIds(product), categoryId: copy.id, status: 'draft', name: `${product.name} Copy`, slug: `${product.slug}-copy-${Date.now()}` })));
  }
  return { category: copy, products };
}

function stripIds<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripIds) as T;
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === 'id' || key === '__v') continue;
      output[key] = stripIds(child);
    }
    return output as T;
  }
  return value;
}

