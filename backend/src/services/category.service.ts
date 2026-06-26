import { Types } from 'mongoose';
import { ProductCategoryModel } from '../models/ProductCategory.js';
import { ProductModel } from '../models/Product.js';
import { ApiError } from '../middleware/errorHandler.js';
import { slugify } from '../utils/slug.js';

export function visibleQuery(accountId: string, merchantId?: string) {
  return {
    accountId,
    $or: [{ scope: 'shared' }, { scope: 'merchant', merchantId }],
  };
}

function normalizeScope(data: Record<string, unknown>) {
  if (data.scope === 'shared') data.merchantId = null;
  if (data.scope === 'merchant' && !data.merchantId) throw new ApiError(400, 'merchantId is required for merchant scoped categories.');
}

async function assertUniqueSlug(data: Record<string, unknown>, id?: string) {
  const query: Record<string, unknown> = { accountId: data.accountId, scope: data.scope, merchantId: data.scope === 'shared' ? null : data.merchantId, slug: data.slug };
  if (id) query._id = { $ne: id };
  const existing = await ProductCategoryModel.findOne(query);
  if (existing) throw new ApiError(409, 'Category slug must be unique within account, scope, and merchant.');
}

export async function listCategories(filters: { accountId: string; merchantId?: string }) {
  return ProductCategoryModel.find(visibleQuery(filters.accountId, filters.merchantId)).sort({ sortOrder: 1, name: 1 });
}

export async function getCategory(id: string) {
  return ProductCategoryModel.findById(id);
}

export async function createCategory(payload: Record<string, unknown>) {
  normalizeScope(payload);
  payload.slug = payload.slug || slugify(String(payload.name ?? 'category'));
  await assertUniqueSlug(payload);
  return ProductCategoryModel.create(payload);
}

export async function updateCategory(id: string, payload: Record<string, unknown>) {
  normalizeScope(payload);
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
  const copy = await ProductCategoryModel.create({ ...category, _id: new Types.ObjectId(), name: `${category.name} Copy`, slug: `${category.slug}-copy-${Date.now()}`, status: 'draft' });
  let products: unknown[] = [];
  if (includeProducts) {
    const sourceProducts = await ProductModel.find({ categoryId: id }).lean();
    products = await ProductModel.insertMany(sourceProducts.map((product) => ({ ...product, _id: new Types.ObjectId(), categoryId: copy._id, status: 'draft', name: `${product.name} Copy`, slug: `${product.slug}-copy-${Date.now()}` })));
  }
  return { category: copy, products };
}

export async function seedCanvasCategory(accountId: string) {
  const existing = await ProductCategoryModel.findOne({ accountId, slug: 'canvas-print', scope: 'shared' });
  if (existing) return existing;
  return ProductCategoryModel.create({ _id: 'cat-canvas-print', accountId, merchantId: null, scope: 'shared', name: 'Canvas Print', slug: 'canvas-print', description: 'Print products including canvas, photo papers, acrylic face mount prints, poster printing, framing, and luster paper.', status: 'active', thumbnailUrl: '', sortOrder: 1 });
}

