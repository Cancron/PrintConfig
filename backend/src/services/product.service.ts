/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from 'mongoose';
import { ProductModel } from '../models/Product.js';
import { ProductCategoryModel } from '../models/ProductCategory.js';
import { ApiError } from '../middleware/errorHandler.js';
import { applyModifier } from '../utils/pricing.js';
import { slugify } from '../utils/slug.js';
import { getVariantRoomOrientation, liftLegacyProductRooms, ROOM_ORIENTATIONS } from '../utils/roomPreview.js';
import { normalizeFrontendContentPayload, publicFrontendContent } from '../utils/frontendContent.js';
import { visibleQuery } from './category.service.js';
import { resolveAccountId } from './account.service.js';
import { authenticateApiPrivateKey } from './merchant.service.js';

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

function normalizeEditorProductSelection(data: Record<string, any>) {
  const selection = data.editorProductSelection ?? {};
  data.editorProductSelection = {
    mode: selection.mode === 'same-category' || selection.mode === 'specific' ? selection.mode : 'single',
    specificProductIds: Array.isArray(selection.specificProductIds) ? selection.specificProductIds : [],
  };
}

async function validateEditorProductSelection(data: Record<string, any>, productId?: string) {
  const ids = data.editorProductSelection.specificProductIds.map(String);
  if (new Set(ids).size !== ids.length) throw new ApiError(400, 'Specific product selections must be unique.');
  if (ids.some((id: string) => !Types.ObjectId.isValid(id))) throw new ApiError(400, 'Specific product selections must contain valid Product ObjectIds.');
  if (productId && ids.includes(productId)) throw new ApiError(400, 'A product cannot select itself.');
  let existingIds = new Set<string>();
  if (productId) {
    const current = await ProductModel.findById(productId).select('editorProductSelection.specificProductIds').lean();
    existingIds = new Set((current?.editorProductSelection?.specificProductIds ?? []).map(String));
  }
  const addedIds = ids.filter((id: string) => !existingIds.has(id));
  if (addedIds.length === 0) return;
  const visibility: Record<string, unknown>[] = [{ scope: 'shared' }];
  if (data.scope === 'merchant' && data.merchantId) visibility.push({ scope: 'merchant', merchantId: data.merchantId });
  else visibility.push({ scope: 'merchant' });
  const count = await ProductModel.countDocuments({ _id: { $in: addedIds }, accountId: data.accountId, status: 'active', $or: visibility });
  if (count !== addedIds.length) throw new ApiError(400, 'New specific product selections must be active and visible within this account.');
}
function normalizeFrontendContent(data: Record<string, any>) {
  data.frontendContent = normalizeFrontendContentPayload(data.frontendContent);
}
function normalizeRoomOwnership(data: Record<string, any>) {
  const lifted = liftLegacyProductRooms(data);
  data.roomPreviews = lifted.roomPreviews;
  data.variants = lifted.variants;
}
function validateProductShape(data: Record<string, any>) {
  if (data.surface && !data.surface.code) throw new ApiError(400, 'Surface code is required.');
  const frontendContent = data.frontendContent ?? {};
  const rating = Number(frontendContent.reviewRating);
  const reviewCount = Number(frontendContent.reviewCount);
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) throw new ApiError(400, 'Review rating must be between 0 and 5.');
  if (!Number.isFinite(reviewCount) || reviewCount < 0) throw new ApiError(400, 'Review count must be zero or greater.');
  if (frontendContent.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(frontendContent.supportEmail))) throw new ApiError(400, 'Support email must be valid.');
  for (const badge of frontendContent.trustBadges ?? []) {
    if (!String(badge.text ?? '').trim()) throw new ApiError(400, 'Trust badge text is required.');
    if (!Number.isFinite(Number(badge.sortOrder))) throw new ApiError(400, 'Trust badge sort order must be numeric.');
  }
  const definitionKeys = new Set<string>();
  let groupByCount = 0;
  for (const definition of data.variantOptionDefinitions ?? []) {
    const key = String(definition.key ?? '').trim();
    if (!String(definition.name ?? '').trim()) throw new ApiError(400, 'Variant option definition name is required.');
    if (!key) throw new ApiError(400, 'Variant option definition key is required.');
    const normalizedKey = key.toLowerCase();
    if (definitionKeys.has(normalizedKey)) throw new ApiError(400, 'Variant option definition keys must be unique within product.');
    definitionKeys.add(normalizedKey);
    if (definition.groupBy) groupByCount += 1;
  }
  if (groupByCount > 1) throw new ApiError(400, 'Only one variant option definition can be used for grouping.');
  const requiredDefinitions = (data.variantOptionDefinitions ?? []).filter((definition: Record<string, unknown>) => definition.required === true);
  const skus = new Set<string>();
  for (const variant of data.variants ?? []) {
    if (skus.has(String(variant.sku).toLowerCase())) throw new ApiError(400, 'Variant SKU must be unique within product.');
    skus.add(String(variant.sku).toLowerCase());
    for (const definition of requiredDefinitions) {
      if (!String(variant.options?.[definition.key] ?? '').trim()) throw new ApiError(400, `Variant ${variant.sku || variant.name || ''} is missing required option ${definition.name}.`);
    }
    if (!(variant.width > 0) || !(variant.height > 0)) throw new ApiError(400, 'Variant width and height must be greater than 0.');
    if (!(variant.dpi > 0)) throw new ApiError(400, 'Variant dpi must be greater than 0.');

  }
  const claimedRoomDefaults = new Set<string>();
  for (const room of data.roomPreviews ?? []) {
    if (!String(room.name ?? '').trim()) throw new ApiError(400, 'Room preview name is required.');
    try {
      const url = new URL(String(room.roomImageUrl ?? ''));
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
    } catch {
      throw new ApiError(400, 'Room preview image must be a valid HTTP or HTTPS URL.');
    }
    const orientations = Array.isArray(room.orientations) ? room.orientations : [];
    const defaults = Array.isArray(room.defaultOrientations) ? room.defaultOrientations : [];
    if (orientations.length === 0 || orientations.some((value: string) => !ROOM_ORIENTATIONS.includes(value as any))) throw new ApiError(400, 'Room preview must support at least one valid orientation.');
    if (defaults.some((value: string) => !orientations.includes(value))) throw new ApiError(400, 'Room default orientations must also be supported orientations.');
    for (const orientation of defaults) {
      if (claimedRoomDefaults.has(orientation)) throw new ApiError(400, `Only one room preview can be default for ${orientation}.`);
      claimedRoomDefaults.add(orientation);
    }
    if (room.centerLeftPercent < 0 || room.centerLeftPercent > 100 || room.centerTopPercent < 0 || room.centerTopPercent > 100) throw new ApiError(400, 'Room preview center position must be between 0 and 100.');
    if (!(room.maxWidthPercent > 0) || room.maxWidthPercent > 100 || !(room.maxHeightPercent > 0) || room.maxHeightPercent > 100) throw new ApiError(400, 'Room preview maximum dimensions must be greater than 0 and no more than 100.');
    if (room.centerLeftPercent - room.maxWidthPercent / 2 < 0 || room.centerLeftPercent + room.maxWidthPercent / 2 > 100 || room.centerTopPercent - room.maxHeightPercent / 2 < 0 || room.centerTopPercent + room.maxHeightPercent / 2 > 100) throw new ApiError(400, 'Room preview rectangle must stay inside the image.');
  }  const groupCodes = new Set<string>();
  for (const group of data.optionGroups ?? []) {
    if (!/^(?=.*[a-z0-9])[a-z0-9_-]+$/.test(String(group.code ?? ''))) throw new ApiError(400, 'Option group code may use lowercase letters, numbers, hyphens, and underscores only.');
    if (groupCodes.has(group.code)) throw new ApiError(400, 'Option group code must be unique within product.');
    groupCodes.add(group.code);
    const values = new Set<string>();
    let defaultCount = 0;
    for (const value of group.values ?? []) {
      if (!/^(?=.*[a-z0-9])[a-z0-9_.-]+$/.test(String(value.value ?? ''))) throw new ApiError(400, 'Option value may use lowercase letters, numbers, periods, hyphens, and underscores only.');
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
  return ProductModel.find(query).sort({ categoryId: 1, name: 1 });
}

export async function getProduct(id: string) {
  return ProductModel.findById(id);
}

export async function createProduct(payload: Record<string, any>) {
  normalizeScope(payload);
  await normalizeRefs(payload);
  payload.slug = payload.slug || slugify(String(payload.name ?? 'product'));
  normalizeFrontendContent(payload);
  normalizeEditorProductSelection(payload);
  normalizeRoomOwnership(payload);
  validateProductShape(payload);
  await validateEditorProductSelection(payload);
  await assertUniqueSlug(payload);
  return ProductModel.create(payload);
}

export async function updateProduct(id: string, payload: Record<string, any>) {
  normalizeScope(payload);
  await normalizeRefs(payload);
  payload.slug = payload.slug || slugify(String(payload.name ?? 'product'));
  normalizeFrontendContent(payload);
  normalizeEditorProductSelection(payload);
  normalizeRoomOwnership(payload);
  validateProductShape(payload);
  await validateEditorProductSelection(payload, id);
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
  const sharedRoomData = liftLegacyProductRooms(product);
  const source = { ...product, roomPreviews: sharedRoomData.roomPreviews, variants: sharedRoomData.variants };
  const templateVariantIndexes = (product.templates ?? []).map((template: any) =>
    (product.variants ?? []).findIndex((variant: any) => String(variant._id) === String(template.variantId)),
  );
  const copy = new ProductModel({
    ...stripIds(source),
    name: `${product.name} Copy`,
    slug: `${product.slug}-copy-${Date.now()}`,
    status: 'draft',
    scope,
    merchantId: scope === 'shared' ? null : payload.merchantId ?? product.merchantId,
  });
  copy.templates.forEach((template: any, index: number) => {
    const variantIndex = templateVariantIndexes[index];
    template.productId = copy._id;
    template.surfaceId = (copy.surface as any)?._id;
    template.variantId = variantIndex >= 0 ? copy.variants[variantIndex]?._id : undefined;
  });
  return copy.save();
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

function publicProductSummary(product: any) {
  return {
    _id: String(product._id),
    name: product.name,
    slug: product.slug,
    productType: product.productType,
    thumbnailUrl: product.thumbnailUrl,
    basePrice: product.basePrice,
    scope: product.scope,
  };
}

async function resolvePublicProductSelection(product: any, merchantId?: string) {
  const selection = product.editorProductSelection ?? { mode: 'single', specificProductIds: [] };
  if (merchantId && !Types.ObjectId.isValid(merchantId)) throw new ApiError(400, 'merchantId must be a valid MongoDB ObjectId.');
  let effectiveMerchantId: string | null = merchantId ?? null;
  if (product.scope === 'merchant') {
    const sourceMerchantId = String(product.merchantId ?? '');
    if (merchantId && merchantId !== sourceMerchantId) throw new ApiError(404, 'Product not found.');
    effectiveMerchantId = sourceMerchantId;
  }
  if (selection.mode === 'single') return { mode: 'single', products: [] };
  const visibility: Record<string, unknown>[] = [{ scope: 'shared' }];
  if (effectiveMerchantId) visibility.push({ scope: 'merchant', merchantId: effectiveMerchantId });
  const baseQuery: Record<string, any> = {
    _id: { $ne: product._id },
    accountId: product.accountId,
    status: 'active',
    $or: visibility,
  };
  if (selection.mode === 'same-category') {
    const products = await ProductModel.find({ ...baseQuery, categoryId: product.categoryId })
      .select('name slug productType thumbnailUrl basePrice scope')
      .lean();
    products.sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
    return { mode: 'same-category', products: products.map(publicProductSummary) };
  }
  const ids = (selection.specificProductIds ?? []).map(String);
  const products = await ProductModel.find({ ...baseQuery, _id: { $in: ids, $ne: product._id } })
    .select('name slug productType thumbnailUrl basePrice scope')
    .lean();
  const byId = new Map(products.map((item: any) => [String(item._id), item]));
  return { mode: 'specific', products: ids.map((selectedId: string) => byId.get(selectedId)).filter(Boolean).map(publicProductSummary) };
}
function publicOptionGroups(optionGroups: any[] = []) {
  return optionGroups
    .slice()
    .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
    .map((group) => ({
      _id: group._id,
      name: group.name,
      code: group.code,
      displayType: group.displayType,
      required: group.required,
      sortOrder: group.sortOrder,
      values: (group.values ?? [])
        .filter((value: any) => value.isActive !== false)
        .slice()
        .sort((a: any, b: any) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
        .map((value: any) => ({
          _id: value._id,
          label: value.label,
          value: value.value,
          priceModifierType: value.priceModifierType,
          priceModifier: value.priceModifier,
          isDefault: value.isDefault,
          sortOrder: value.sortOrder,
          previewImageUrl: value.previewImageUrl,
          thumbnailImageUrl: value.thumbnailImageUrl,
          metadata: {
            colorHex: value.metadata?.colorHex ?? '',
            description: value.metadata?.description ?? '',
          },
        })),
    }));
}
export async function getPublicProductConfig(id: string, merchantId?: string) {
  const product = await ProductModel.findById(id).lean();
  if (!product) throw new ApiError(404, 'Product not found.');
  if (product.status !== 'active') throw new ApiError(404, 'Product not found.');
  const sharedRoomData = liftLegacyProductRooms(product);
  const productSelection = await resolvePublicProductSelection(product, merchantId);
  const activeVariants = (sharedRoomData.variants ?? []).filter((variant: any) => variant.status === 'active').map((variant: any) => ({
    _id: variant._id,
    name: variant.name,
    sku: variant.sku,
    price: variant.price,
    options: variant.options,
    width: variant.width,
    height: variant.height,
    unit: variant.unit,
    dpi: variant.dpi,
    previewImageUrl: variant.previewImageUrl,
    thumbnailImageUrl: variant.thumbnailImageUrl,
    roomOrientation: getVariantRoomOrientation(variant),

  }));
  return {
    _id: product._id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    productType: product.productType,
    basePrice: product.basePrice,
    thumbnailUrl: product.thumbnailUrl,
    surface: product.surface,
    variantOptionDefinitions: product.variantOptionDefinitions,
    optionGroups: publicOptionGroups(product.optionGroups),
    roomPreviews: sharedRoomData.roomPreviews.slice().sort((a: any, b: any) => a.sortOrder - b.sortOrder),
    frontendContent: publicFrontendContent(product.frontendContent),
    productSelection,
    editorRules: product.editorRules,
    exportRules: product.exportRules,
    variants: activeVariants,
  };
}
export async function getEditorProductConfig(id: string, apiPrivateKey: string) {
  const merchant = await authenticateApiPrivateKey(apiPrivateKey);
  if (!merchant) throw new ApiError(401, 'A valid merchant API private key is required.');
  return getPublicProductConfig(id, String(merchant._id));
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
    const optionValue = group.values.find((value: any) => value.isActive !== false && value.value === selected);
    if (!optionValue) continue;
    const amount = applyModifier(variant.price, optionValue as any, variant.options ?? {}, group.code);
    if (!Number.isFinite(amount)) {
      throw new ApiError(400, `Variant ${variant.sku} must have a numeric _${optionValue.value} or _${group.code} option for variant-dependent pricing.`);
    }
    modifiers.push({ groupCode: group.code, value: optionValue.value, amount });
  }
  const modifierTotal = modifiers.reduce((sum, item) => sum + item.amount, 0);
  return { basePrice: variant.price, modifiers, finalPrice: Math.round((variant.price + modifierTotal) * 100) / 100 };
}

function stripIds<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripIds) as T;
  if (value instanceof Types.ObjectId || value instanceof Date || Buffer.isBuffer(value)) return value;
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === '_id' || key === '__v' || key === 'createdAt' || key === 'updatedAt') continue;
      output[key] = stripIds(child);
    }
    return output as T;
  }
  return value;
}

