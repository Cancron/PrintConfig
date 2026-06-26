/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from 'mongoose';
import { ProductModel } from '../models/Product.js';
import { ProductCategoryModel } from '../models/ProductCategory.js';
import { ApiError } from '../middleware/errorHandler.js';
import { applyModifier } from '../utils/pricing.js';
import { slugify } from '../utils/slug.js';
import { visibleQuery } from './category.service.js';
import { resolveAccountId } from './account.service.js';

function normalizeScope(data: Record<string, unknown>) {
  if (data.scope === 'shared') data.merchantId = null;
  if (data.scope === 'merchant' && !data.merchantId) throw new ApiError(400, 'merchantId is required for merchant scoped products.');
}

async function normalizeRefs(data: Record<string, unknown>) {
  data.accountId = resolveAccountId(String(data.accountId ?? ''));
  if (data.scope === 'shared') data.merchantId = null;
  if (data.merchantId && !Types.ObjectId.isValid(String(data.merchantId))) throw new ApiError(400, 'merchantId must be a valid MongoDB ObjectId.');
  if (!data.categoryId || !Types.ObjectId.isValid(String(data.categoryId))) throw new ApiError(400, 'Product must have a valid categoryId.');
}

function validateProductShape(data: Record<string, any>) {
  if (data.surface && !data.surface.code) throw new ApiError(400, 'Surface code is required.');
  const skus = new Set<string>();
  for (const variant of data.variants ?? []) {
    if (skus.has(String(variant.sku).toLowerCase())) throw new ApiError(400, 'Variant SKU must be unique within product.');
    skus.add(String(variant.sku).toLowerCase());
    if (!(variant.width > 0) || !(variant.height > 0)) throw new ApiError(400, 'Variant width and height must be greater than 0.');
    if (!(variant.dpi > 0)) throw new ApiError(400, 'Variant dpi must be greater than 0.');
  }
  const groupCodes = new Set<string>();
  for (const group of data.optionGroups ?? []) {
    if (groupCodes.has(group.code)) throw new ApiError(400, 'Option group code must be unique within product.');
    groupCodes.add(group.code);
    const values = new Set<string>();
    let defaultCount = 0;
    for (const value of group.values ?? []) {
      if (values.has(value.value)) throw new ApiError(400, 'Option value must be unique within option group.');
      values.add(value.value);
      if (value.isDefault) defaultCount += 1;
      if (Number.isNaN(Number(value.priceModifier))) throw new ApiError(400, 'Price modifier must be numeric.');
    }
    if (defaultCount > 1) throw new ApiError(400, 'Only one option value can be default inside an option group.');
  }
}

async function assertUniqueSlug(data: Record<string, unknown>, id?: string) {
  const query: Record<string, unknown> = { accountId: data.accountId, scope: data.scope, merchantId: data.scope === 'shared' ? null : data.merchantId, categoryId: data.categoryId, slug: data.slug };
  if (id) query._id = { $ne: id };
  const existing = await ProductModel.findOne(query);
  if (existing) throw new ApiError(409, 'Product slug must be unique within account, scope, merchant, and category.');
}

export async function listProducts(filters: Record<string, string | undefined>) {
  const accountId = resolveAccountId(filters.accountId);
  const query: Record<string, unknown> = visibleQuery(accountId, filters.merchantId);
  if (filters.categoryId) query.categoryId = filters.categoryId;
  if (filters.status) query.status = filters.status;
  if (filters.scope) query.scope = filters.scope;
  if (filters.search) query.name = { $regex: filters.search, $options: 'i' };
  return ProductModel.find(query).sort({ updatedAt: -1 });
}

export async function getProduct(id: string) {
  return ProductModel.findById(id);
}

export async function createProduct(payload: Record<string, any>) {
  normalizeScope(payload);
  await normalizeRefs(payload);
  payload.slug = payload.slug || slugify(String(payload.name ?? 'product'));
  validateProductShape(payload);
  await assertUniqueSlug(payload);
  return ProductModel.create(payload);
}

export async function updateProduct(id: string, payload: Record<string, any>) {
  normalizeScope(payload);
  await normalizeRefs(payload);
  payload.slug = payload.slug || slugify(String(payload.name ?? 'product'));
  validateProductShape(payload);
  await assertUniqueSlug(payload, id);
  return ProductModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
}

export async function deleteProduct(id: string) {
  return ProductModel.findByIdAndDelete(id);
}

export async function duplicateProduct(id: string, payload: { scope?: 'shared' | 'merchant'; merchantId?: string }) {
  const product = await ProductModel.findById(id).lean();
  if (!product) throw new ApiError(404, 'Product not found.');
  const scope = payload.scope ?? product.scope;
  const copy = await ProductModel.create({ ...stripIds(product), name: `${product.name} Copy`, slug: `${product.slug}-copy-${Date.now()}`, status: 'draft', scope, merchantId: scope === 'shared' ? null : payload.merchantId ?? product.merchantId });
  return copy;
}

export async function exportProduct(id: string) {
  const product = await ProductModel.findById(id).lean();
  if (!product) throw new ApiError(404, 'Product not found.');
  const category = await ProductCategoryModel.findById(product.categoryId).lean();
  return { ...product, categorySnapshot: category };
}

export async function importProduct(payload: Record<string, any>) {
  if (!payload.categoryId && payload.categorySnapshot) {
    const category = await ProductCategoryModel.create(stripIds(payload.categorySnapshot));
    payload.categoryId = category._id;
  }
  return createProduct({ ...stripIds(payload), status: 'draft', slug: `${payload.slug || slugify(payload.name)}-import-${Date.now()}` });
}

export async function calculatePrice(id: string, variantId: string, selectedOptions: Record<string, string>) {
  const product = await ProductModel.findById(id).lean();
  if (!product) throw new ApiError(404, 'Product not found.');
  const variant = product.variants.find((item: any) => String(item._id) === variantId);
  if (!variant) throw new ApiError(404, 'Variant not found.');
  const modifiers: Array<{ groupCode: string; value: string; amount: number }> = [];
  for (const group of product.optionGroups ?? []) {
    const selected = selectedOptions[group.code];
    if (!selected) continue;
    const optionValue = group.values.find((value: any) => value.value === selected);
    if (!optionValue) continue;
    const amount = applyModifier(variant.price, optionValue as any);
    modifiers.push({ groupCode: group.code, value: optionValue.value, amount });
  }
  const modifierTotal = modifiers.reduce((sum, item) => sum + item.amount, 0);
  return { basePrice: variant.price, modifiers, finalPrice: Math.round((variant.price + modifierTotal) * 100) / 100 };
}

function stripIds<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripIds) as T;
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === '_id' || key === '__v') continue;
      output[key] = stripIds(child);
    }
    return output as T;
  }
  return value;
}

