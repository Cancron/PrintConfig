/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Types } from 'mongoose';
import { ProductModel } from '../models/Product.js';
import { ProductCategoryModel } from '../models/ProductCategory.js';
import { LayoutTemplateModel } from '../models/LayoutTemplate.js';
import { CollageModel } from '../models/Collage.js';
import { MerchantModel } from '../models/Merchant.js';
import { ApiError } from '../middleware/errorHandler.js';
import { applyModifier, getVariantConfiguredPrice } from '../utils/pricing.js';
import { slugify } from '../utils/slug.js';
import { getVariantRoomOrientation, liftLegacyProductRooms, ROOM_ORIENTATIONS } from '../utils/roomPreview.js';
import { normalizeFrontendContentPayload, publicFrontendContent } from '../utils/frontendContent.js';
import { visibleQuery } from './category.service.js';
import { resolveAccountId } from './account.service.js';
import { authenticateApiPrivateKey } from './merchant.service.js';
import { galleryBucket, getSupabaseAdmin } from '../config/supabase.js';

export type DependencyCondition = 'equals' | 'not_equals' | 'in' | 'not_in';

export interface DependencyRule {
  dependsOnGroupCode: string;
  condition: DependencyCondition;
  allowedValues: string[];
}

function evaluateDependencyRule(
  rule: DependencyRule,
  selectedValues: Record<string, string>
): boolean {
  const selectedValue = selectedValues[rule.dependsOnGroupCode];

  // If the parent group has no selection, the dependency is not satisfied
  if (selectedValue === undefined || selectedValue === '') {
    return false;
  }

  switch (rule.condition) {
    case 'equals':
      return selectedValue === rule.allowedValues[0];
    case 'not_equals':
      return selectedValue !== rule.allowedValues[0];
    case 'in':
      return rule.allowedValues.includes(selectedValue);
    case 'not_in':
      return !rule.allowedValues.includes(selectedValue);
    default:
      return false;
  }
}

export function evaluateOptionGroupVisibility(
  groups: Array<{ code: string; dependencyRules?: DependencyRule[] }>,
  selectedValues: Record<string, string>
): Record<string, boolean> {
  const result: Record<string, boolean> = {};

  for (const group of groups) {
    // If no dependency rules, group is always visible
    if (!group.dependencyRules || group.dependencyRules.length === 0) {
      result[group.code] = true;
      continue;
    }

    // All rules must pass (AND logic)
    const isVisible = group.dependencyRules.every((rule) =>
      evaluateDependencyRule(rule, selectedValues)
    );
    result[group.code] = isVisible;
  }

  return result;
}

function detectCircularDependencies(
  groups: Array<{ code: string; dependencyRules?: DependencyRule[] }>
): string[] {
  const issues: string[] = [];
  const groupCodes = new Set(groups.map((g) => g.code));

  for (const group of groups) {
    if (!group.dependencyRules) continue;

    for (const rule of group.dependencyRules) {
      // Check if referenced group exists
      if (!groupCodes.has(rule.dependsOnGroupCode)) {
        issues.push(
          `Group "${group.code}" depends on non-existent group "${rule.dependsOnGroupCode}"`
        );
        continue;
      }

      // Check for circular dependency
      const visited = new Set<string>();
      const stack = [group.code];

      while (stack.length > 0) {
        const current = stack.pop()!;
        if (current === rule.dependsOnGroupCode) {
          // We've traced back to a group that depends on us - circular!
          // But we need to find the actual cycle, not just A depends on B
          // Actually, a single dependency rule means group A depends on group B's value
          // This is NOT circular - it's a valid dependency chain
          // Circular would be: A depends on B, B depends on A
          // Let's check if the target group depends on us
          const targetGroup = groups.find((g) => g.code === rule.dependsOnGroupCode);
          if (targetGroup?.dependencyRules?.some((r) => r.dependsOnGroupCode === group.code)) {
            issues.push(
              `Circular dependency detected: "${group.code}" and "${rule.dependsOnGroupCode}" depend on each other`
            );
          }
          continue;
        }

        if (visited.has(current)) continue;
        visited.add(current);

        const currentGroup = groups.find((g) => g.code === current);
        if (currentGroup?.dependencyRules) {
          for (const r of currentGroup.dependencyRules) {
            stack.push(r.dependsOnGroupCode);
          }
        }
      }
    }
  }

  return issues;
}

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
function normalizeLayoutSettings(data: Record<string, any>) {
  const input = data.layoutSettings ?? {};
  const legacyCategoryIds = Array.isArray(input.allowedTemplateCategoryIds) ? input.allowedTemplateCategoryIds : [];
  const mode = input.mode === 'all' || input.mode === 'specific' || input.mode === 'by-tags' ? input.mode : input.enabled === true ? (input.allowedTemplateIds?.length ? 'specific' : legacyCategoryIds.length ? 'by-tags' : 'all') : 'none';
  data.layoutSettings = {
    enabled: mode !== 'none' && input.enabled !== false,
    mode: input.enabled === false ? 'none' : mode,
    allowedTemplateIds: Array.isArray(input.allowedTemplateIds) ? input.allowedTemplateIds.map(String).filter(Boolean) : [],
    allowedTemplateTags: Array.isArray(input.allowedTemplateTags) ? input.allowedTemplateTags.map((tag: unknown) => String(tag).trim()).filter(Boolean) : [],
    requireTemplateSelection: input.requireTemplateSelection === true,
  };
}
async function validateLayoutSettings(data: Record<string, any>) {
  const settings = data.layoutSettings ?? {};
  if (!settings.enabled || settings.mode === 'none') return;
  if (settings.mode === 'specific') {
    const ids = (settings.allowedTemplateIds ?? []).map(String);
    if (ids.length === 0) throw new ApiError(400, 'Select at least one layout template.');
    if (new Set(ids).size !== ids.length) throw new ApiError(400, 'Layout template selections must be unique.');
    if (ids.some((id: string) => !Types.ObjectId.isValid(id))) throw new ApiError(400, 'Layout template selections must contain valid ObjectIds.');
    const visibility: Record<string, unknown>[] = [{ scope: 'shared' }];
    if (data.scope === 'merchant' && data.merchantId) visibility.push({ scope: 'merchant', merchantId: data.merchantId });
    else visibility.push({ scope: 'merchant' });
    const count = await LayoutTemplateModel.countDocuments({ _id: { $in: ids }, accountId: data.accountId, status: 'active', $or: visibility });
    if (count !== ids.length) throw new ApiError(400, 'Selected layout templates must be active and visible within this account.');
  }
  if (settings.mode === 'by-tags' && (settings.allowedTemplateTags ?? []).length === 0) {
    throw new ApiError(400, 'Add at least one layout template tag.');
  }
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
      if (value.priceModifierType === 'percentage') {
        const minimum = value.priceModifierMin;
        const maximum = value.priceModifierMax;
        if (minimum !== undefined && (!Number.isFinite(Number(minimum)) || Number(minimum) < 0)) throw new ApiError(400, 'Percentage minimum price must be zero or greater.');
        if (maximum !== undefined && (!Number.isFinite(Number(maximum)) || Number(maximum) < 0)) throw new ApiError(400, 'Percentage maximum price must be zero or greater.');
        if (minimum !== undefined && maximum !== undefined && Number(maximum) < Number(minimum)) throw new ApiError(400, 'Percentage maximum price must be greater than or equal to the minimum price.');
      }
    }
    if (defaultCount > 1) throw new ApiError(400, 'Only one option value can be default inside an option group.');
    // Validate dependency rules
    if (Array.isArray(group.dependencyRules)) {
      for (const rule of group.dependencyRules) {
        if (!String(rule.dependsOnGroupCode ?? '').trim()) {
          throw new ApiError(400, 'Dependency rule must specify a target group code.');
        }
        if (!['equals', 'not_equals', 'in', 'not_in'].includes(rule.condition)) {
          throw new ApiError(400, 'Dependency rule condition must be equals, not_equals, in, or not_in.');
        }
        if (!Array.isArray(rule.allowedValues) || rule.allowedValues.length === 0) {
          throw new ApiError(400, 'Dependency rule must have at least one allowed value.');
        }
      }
    }
  }
  // Check for circular dependencies and missing group references
  const dependencyIssues = detectCircularDependencies(data.optionGroups ?? []);
  if (dependencyIssues.length > 0) {
    throw new ApiError(400, `Dependency validation failed: ${dependencyIssues.join('; ')}`);
  }
  // Validate AI Art configuration
  if (data.aiArt && data.aiArt.enabled === true) {
    if (!(data.aiArt.maxUploadImages > 0)) {
      throw new ApiError(400, 'AI Art max upload images must be greater than 0.');
    }
    if (!(data.aiArt.defaultGeneratedImageCount > 0)) {
      throw new ApiError(400, 'AI Art default generated image count must be greater than 0.');
    }
    const styleSlugs = new Set<string>();
    for (const style of data.aiArt.styles ?? []) {
      if (!String(style.name ?? '').trim()) {
        throw new ApiError(400, 'AI Art style name is required.');
      }
      if (!String(style.slug ?? '').trim()) {
        throw new ApiError(400, 'AI Art style slug is required.');
      }
      if (!/^(?=.*[a-z0-9])[a-z0-9_-]+$/.test(String(style.slug))) {
        throw new ApiError(400, 'AI Art style slug may use lowercase letters, numbers, hyphens, and underscores only.');
      }
      if (styleSlugs.has(style.slug)) {
        throw new ApiError(400, `AI Art style slug "${style.slug}" must be unique within product.`);
      }
      styleSlugs.add(style.slug);
      if (!String(style.prompt ?? '').trim()) {
        throw new ApiError(400, `AI Art style "${style.name}" must have a prompt.`);
      }
      if (style.additionalPrice !== undefined && (!Number.isFinite(Number(style.additionalPrice)) || Number(style.additionalPrice) < 0)) {
        throw new ApiError(400, `AI Art style "${style.name}" additional price must be zero or greater.`);
      }
    }
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
  normalizeLayoutSettings(payload);
  normalizeRoomOwnership(payload);
  validateProductShape(payload);
  await validateEditorProductSelection(payload);
  await validateLayoutSettings(payload);
  await assertUniqueSlug(payload);
  return ProductModel.create(payload);
}

export async function updateProduct(id: string, payload: Record<string, any>) {
  normalizeScope(payload);
  await normalizeRefs(payload);
  payload.slug = payload.slug || slugify(String(payload.name ?? 'product'));
  normalizeFrontendContent(payload);
  normalizeEditorProductSelection(payload);
  normalizeLayoutSettings(payload);
  normalizeRoomOwnership(payload);
  validateProductShape(payload);
  await validateEditorProductSelection(payload, id);
  await validateLayoutSettings(payload);
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
  const copy = new ProductModel({
    ...stripIds(source),
    name: `${product.name} Copy`,
    slug: `${product.slug}-copy-${Date.now()}`,
    status: 'draft',
    scope,
    merchantId: scope === 'shared' ? null : payload.merchantId ?? product.merchantId,
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

function publicLayoutTemplateSummary(template: any) {
  return {
    _id: String(template._id),
    name: template.name,
    slug: template.slug,
    description: template.description ?? '',
    templateType: template.templateType,
    orientation: template.orientation,
    thumbnailUrl: template.thumbnailUrl ?? '',
    pageCount: template.pageCount,
    canvasWidth: template.canvasWidth,
    canvasHeight: template.canvasHeight,
    unit: template.unit,
    dpi: template.dpi,
    tags: template.tags ?? [],
    scope: template.scope,
    pages: (template.pages ?? []).map((page: any) => ({
      _id: String(page._id),
      pageNumber: page.pageNumber,
      name: page.name,
      width: page.width,
      height: page.height,
      backgroundColor: page.backgroundColor,
      backgroundImageUrl: page.backgroundImageUrl,
      collageId: page.collageId ? String(page.collageId) : null,
    })),
  };
}
function publicCollageSummary(collage: any) {
  return {
    _id: String(collage._id),
    name: collage.name,
    slug: collage.slug,
    orientation: collage.orientation,
    canvasWidth: collage.canvasWidth,
    canvasHeight: collage.canvasHeight,
    unit: collage.unit,
    dpi: collage.dpi,
    backgroundColor: collage.backgroundColor,
    backgroundImageUrl: collage.backgroundImageUrl,
    tags: collage.tags ?? [],
    elements: collage.elements ?? [],
  };
}

async function resolvePublicLayoutTemplates(product: any, merchantId?: string) {
  const settings = product.layoutSettings ?? { enabled: false, mode: 'none' };
  const mode = settings.enabled === true ? settings.mode ?? 'all' : 'none';
  if (mode === 'none') return { enabled: false, mode: 'none', requireTemplateSelection: false, templates: [] };
  const visibility: Record<string, unknown>[] = [{ scope: 'shared' }];
  if (merchantId) visibility.push({ scope: 'merchant', merchantId });
  else if (product.scope === 'merchant' && product.merchantId) visibility.push({ scope: 'merchant', merchantId: product.merchantId });
  const query: Record<string, any> = {
    accountId: product.accountId,
    status: 'active',
    $or: visibility,
  };
  if (mode === 'specific') {
    const ids = (settings.allowedTemplateIds ?? []).map(String);
    query._id = { $in: ids };
    const templates = await LayoutTemplateModel.find(query).lean();
    const byId = new Map(templates.map((template: any) => [String(template._id), template]));
    const collages = await resolvePublicTemplateCollages(templates, product, merchantId);
    return {
      enabled: true,
      mode,
      requireTemplateSelection: settings.requireTemplateSelection === true,
      templates: ids.map((templateId: string) => byId.get(templateId)).filter(Boolean).map(publicLayoutTemplateSummary),
      collages,
    };
  }
  if (mode === 'by-tags') {
    const tags = (settings.allowedTemplateTags ?? []).map(String).filter(Boolean);
    query.tags = { $in: tags };
  }
  const templates = await LayoutTemplateModel.find(query).sort({ sortOrder: 1, name: 1 }).lean();
  return {
    enabled: true,
    mode,
    requireTemplateSelection: settings.requireTemplateSelection === true,
    templates: templates.map(publicLayoutTemplateSummary),
    collages: await resolvePublicTemplateCollages(templates, product, merchantId),
  };
}

async function resolvePublicTemplateCollages(templates: any[], product: any, merchantId?: string) {
  const collageIds = Array.from(new Set(templates.flatMap((template: any) => (template.pages ?? []).map((page: any) => String(page.collageId ?? '')).filter(Boolean))));
  if (collageIds.length === 0) return [];
  const visibility: Record<string, unknown>[] = [{ scope: 'shared' }];
  if (merchantId) visibility.push({ scope: 'merchant', merchantId });
  else if (product.scope === 'merchant' && product.merchantId) visibility.push({ scope: 'merchant', merchantId: product.merchantId });
  const collages = await CollageModel.find({
    _id: { $in: collageIds },
    accountId: product.accountId,
    status: 'active',
    $or: visibility,
  }).lean();
  const byId = new Map(collages.map((collage: any) => [String(collage._id), collage]));
  return collageIds.map((collageId) => byId.get(collageId)).filter(Boolean).map(publicCollageSummary);
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
      dependencyRules: (group.dependencyRules ?? []).map((rule: any) => ({
        dependsOnGroupCode: rule.dependsOnGroupCode,
        condition: rule.condition,
        allowedValues: rule.allowedValues,
      })),
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
          priceModifierMin: value.priceModifierMin,
          priceModifierMax: value.priceModifierMax,
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
  const layoutTemplates = await resolvePublicLayoutTemplates(product, merchantId);
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
    layoutTemplates,
    editorRules: { ...(product.editorRules ?? {}), allowCustomSize: product.editorRules?.allowCustomSize ?? false },
    exportRules: product.exportRules,
    variants: activeVariants,
    aiArt: publicAiArtConfig(product.aiArt),
  };
}

function publicAiArtConfig(aiArt: any) {
  if (!aiArt) {
    return undefined;
  }
  const activeStyles = (aiArt.styles ?? [])
    .filter((style: any) => style.isActive !== false)
    .sort((a: any, b: any) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
  return {
    enabled: aiArt.enabled === true,
    sectionTitle: aiArt.sectionTitle || 'AI Art Styles',
    badgeText: aiArt.badgeText || '',
    helpText: aiArt.helpText || '',
    requireUploadBeforeStyleSelection: aiArt.requireUploadBeforeStyleSelection ?? true,
    maxUploadImages: aiArt.maxUploadImages ?? 1,
    defaultGeneratedImageCount: aiArt.defaultGeneratedImageCount ?? 4,
    allowMultipleStyleSelection: aiArt.allowMultipleStyleSelection ?? false,
    showDescriptions: aiArt.showDescriptions ?? true,
    showAdditionalPrice: aiArt.showAdditionalPrice ?? true,
    allowArtName: aiArt.allowArtName ?? false,
    artNameFieldLabel: aiArt.artNameFieldLabel || 'Pet name (optional)',
    artNameFieldPlaceholder: aiArt.artNameFieldPlaceholder || 'e.g., Buddy, Luna, Max',
    styles: activeStyles.map((style: any) => ({
      _id: style._id,
      name: style.name,
      slug: style.slug,
      prompt: style.prompt,
      artTitlePrompt: style.artTitlePrompt || '',
      additionalPrice: style.additionalPrice ?? 0,
      previewImageUrl: style.previewImageUrl || '',
      thumbnailImageUrl: style.thumbnailImageUrl || '',
      sortOrder: style.sortOrder ?? 0,
    })),
  };
}
export async function listEditorProducts(apiPrivateKey: string) {
  const merchant = await authenticateApiPrivateKey(apiPrivateKey);
  if (!merchant) throw new ApiError(401, 'A valid merchant API private key is required.');

  const products = await ProductModel.find({
    ...visibleQuery(String(merchant.accountId), String(merchant._id)),
    status: 'active',
  })
    .select('name productType categoryId status updatedAt')
    .sort({ name: 1 })
    .lean();

  const categoryIds = [...new Set(products.map((product: any) => String(product.categoryId ?? '')).filter(Boolean))];
  const categories = await ProductCategoryModel.find({ _id: { $in: categoryIds } })
    .select('name slug')
    .lean();
  const categoriesById = new Map(categories.map((category: any) => [String(category._id), category]));

  return products.map((product: any) => {
    const category = categoriesById.get(String(product.categoryId));
    return {
      _id: String(product._id),
      name: product.name,
      productType: product.productType,
      category: category ? { _id: String(category._id), name: category.name, slug: category.slug } : null,
      status: product.status,
      updatedAt: product.updatedAt,
    };
  });
}
export async function getEditorProductConfig(id: string, apiPrivateKey: string) {
  const merchant = await authenticateApiPrivateKey(apiPrivateKey);
  if (!merchant) throw new ApiError(401, 'A valid merchant API private key is required.');
  return getPublicProductConfig(id, String(merchant._id));
}

export interface PublicDesignTokenPayload {
  userKey: string;
  merchantId: string;
  productId: string;
  expiresAt: number;
}

export async function verifyPublicDesignToken(input: { authorization?: string; routeProductId: string }): Promise<PublicDesignTokenPayload> {
  const token = parseBearerToken(input.authorization);
  const [encodedData, signature = ''] = token.split('.');
  if (!encodedData || !signature || token.split('.').length !== 2) throw new ApiError(401, 'Invalid design authorization token.');

  let data = '';
  try {
    data = Buffer.from(encodedData, 'base64').toString('utf8');
  } catch {
    throw new ApiError(401, 'Invalid design authorization token data.');
  }

  const separatorIndex = data.lastIndexOf('|');
  if (separatorIndex < 0) throw new ApiError(401, 'Invalid design authorization token payload.');
  const identity = data.slice(0, separatorIndex);
  const expiresAt = Number(data.slice(separatorIndex + 1));
  if (!Number.isInteger(expiresAt)) throw new ApiError(401, 'Invalid design authorization token expiry.');
  if (expiresAt <= Math.floor(Date.now() / 1000)) throw new ApiError(401, 'Design authorization token has expired.');

  const identityParts = identity.split(':');
  const [userKeyRaw, merchantId, productId] = identityParts;
  if (!userKeyRaw || !merchantId || !productId || identityParts.length !== 3) throw new ApiError(401, 'Invalid design authorization token identity.');
  if (!Types.ObjectId.isValid(merchantId)) throw new ApiError(401, 'Invalid design authorization merchant.');
  if (!Types.ObjectId.isValid(productId)) throw new ApiError(401, 'Invalid design authorization product.');
  if (String(productId) !== String(input.routeProductId)) throw new ApiError(403, 'Design authorization token does not match this product.');

  const merchant = await MerchantModel.findOne({ _id: merchantId, status: 'active' }).select('+apiPrivateKeySecret').lean();
  if (!merchant) throw new ApiError(401, 'Merchant authorization not found.');
  if (!merchant.apiPrivateKeySecret) throw new ApiError(401, 'Merchant API key must be rotated before temporary design tokens can be verified.');

  const expectedSignature = createHmac('sha256', String(merchant.apiPrivateKeySecret)).update(data).digest('hex');
  if (!safeHexEqual(signature, expectedSignature)) throw new ApiError(401, 'Invalid design authorization signature.');

  return {
    userKey: userKeyRaw,
    merchantId: String(merchant._id),
    productId,
    expiresAt,
  };
}

function parseBearerToken(authorization?: string) {
  const value = String(authorization ?? '').trim();
  const match = /^Bearer\s+(.+)$/i.exec(value);
  if (!match) throw new ApiError(401, 'Authorization Bearer token is required.');
  return match[1].trim();
}

function safeHexEqual(actual: string, expected: string) {
  if (!/^[a-f0-9]{64}$/i.test(actual)) return false;
  const actualBuffer = Buffer.from(actual, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

const DESIGN_UPLOAD_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export async function savePublicDesignUpload(input: {
  productId: string;
  merchantId: string;
  userKey: string;
  designData?: unknown;
  file?: Express.Multer.File;
  pagePreviewFiles?: Express.Multer.File[];
  pagePreviewMeta?: unknown;
  origin: string;
}) {
  const designData = parseDesignData(input.designData);
  const pagePreviewFiles = input.pagePreviewFiles ?? [];
  const pagePreviewMeta = parsePagePreviewMeta(input.pagePreviewMeta, pagePreviewFiles.length);
  if (!input.file && designData === undefined && pagePreviewFiles.length === 0) throw new ApiError(400, 'Image file, page previews, or designData is required.');
  if (input.file && !DESIGN_UPLOAD_MIME_EXTENSIONS[input.file.mimetype]) throw new ApiError(400, 'Only JPG, PNG, and WebP images are allowed.');
  for (const file of pagePreviewFiles) {
    if (!DESIGN_UPLOAD_MIME_EXTENSIONS[file.mimetype]) throw new ApiError(400, 'Only JPG, PNG, and WebP page previews are allowed.');
  }

  const { merchant, product, userKey } = await resolvePublicDesignContext(input.productId, input.merchantId, input.userKey);
  const supabase = getSupabaseAdmin();
  const prefix = designTempPrefix(String(merchant._id), userKey, String(product._id));
  const { data: prefixPublicData } = supabase.storage.from(galleryBucket).getPublicUrl(`${prefix}/`);
  const publicPathPrefix = prefixPublicData.publicUrl;

  let image: Record<string, unknown> | null = null;
  if (input.file) {
    const extension = DESIGN_UPLOAD_MIME_EXTENSIONS[input.file.mimetype];
    const filename = `${Date.now()}-${randomBytes(8).toString('hex')}${extension}`;
    const storagePath = `${prefix}/images/${filename}`;
    const { error: uploadError } = await supabase.storage.from(galleryBucket).upload(storagePath, input.file.buffer, {
      contentType: input.file.mimetype,
      upsert: false,
      cacheControl: '3600',
    });
    if (uploadError) throw new ApiError(502, `Supabase image upload failed: ${uploadError.message}`);
    const { data } = supabase.storage.from(galleryBucket).getPublicUrl(storagePath);
    image = {
      url: data.publicUrl,
      publicUrl: data.publicUrl,
      storageProvider: 'supabase',
      bucket: galleryBucket,
      storagePath,
      filename,
      originalName: input.file.originalname,
      mimeType: input.file.mimetype,
      size: input.file.size,
    };
  }

  if (designData !== undefined) {
    const designStoragePath = `${prefix}/design.json`;
    const { error: designUploadError } = await supabase.storage.from(galleryBucket).upload(
      designStoragePath,
      Buffer.from(JSON.stringify(designData, null, 2), 'utf8'),
      { contentType: 'application/json', upsert: true, cacheControl: '0' }
    );
    if (designUploadError) throw new ApiError(502, `Supabase design save failed: ${designUploadError.message}`);
  }

  const pagePreviews = [];
  for (let index = 0; index < pagePreviewFiles.length; index += 1) {
    const file = pagePreviewFiles[index];
    const meta = pagePreviewMeta[index] ?? {};
    const extension = DESIGN_UPLOAD_MIME_EXTENSIONS[file.mimetype];
    const requestedFilename = sanitizeUploadFilename(String(meta.filename ?? file.originalname ?? `page-${index + 1}${extension}`), extension);
    const filename = requestedFilename || `page-${index + 1}${extension}`;
    const storagePath = `${prefix}/page-previews/${filename}`;
    const { error: previewUploadError } = await supabase.storage.from(galleryBucket).upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
      cacheControl: '0',
    });
    if (previewUploadError) throw new ApiError(502, `Supabase page preview upload failed: ${previewUploadError.message}`);
    const { data } = supabase.storage.from(galleryBucket).getPublicUrl(storagePath);
    pagePreviews.push({
      ...meta,
      url: data.publicUrl,
      publicUrl: data.publicUrl,
      storageProvider: 'supabase',
      bucket: galleryBucket,
      storagePath,
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });
  }

  return {
    ...(image ?? {}),
    image,
    // designData,
    designSaved: designData !== undefined,
    designPublicBaseUrl: publicPathPrefix,
    designPublicUrl: designData !== undefined ? `${publicPathPrefix}design.json` : undefined,
    pagePreviews,
    merchantId: String(merchant._id),
    productId: String(product._id),
    userKey,
  };
}

export async function getPublicDesignWithProduct(input: { productId: string; merchantId: string; userKey: string }) {
  const { product, merchant, userKey } = await resolvePublicDesignContext(input.productId, input.merchantId, input.userKey);
  const productData = await getPublicProductConfig(String(product._id), String(merchant._id));
  const designStoragePath = `${designTempPrefix(String(merchant._id), userKey, String(product._id))}/design.json`;
  let designData: unknown = null;
  let designExists = false;
  const { data, error } = await getSupabaseAdmin().storage.from(galleryBucket).download(designStoragePath);
  if (error) {
    if (!isStorageNotFound(error)) throw new ApiError(502, `Supabase design read failed: ${error.message}`);
  } else if (data) {
    designData = JSON.parse(await data.text());
    designExists = true;
  }
  return {
    product: productData,
    design: designData,
    designExists,
    designStoragePath: designExists ? designStoragePath : null,
    merchantId: String(merchant._id),
    productId: String(product._id),
    userKey,
  };
}

async function resolvePublicDesignContext(productId: string, merchantId: string, rawUserKey: string) {
  if (!Types.ObjectId.isValid(productId)) throw new ApiError(400, 'productId must be a valid MongoDB ObjectId.');
  if (!Types.ObjectId.isValid(merchantId)) throw new ApiError(400, 'merchantId must be a valid MongoDB ObjectId.');
  const userKey = sanitizeUploadSegment(rawUserKey);
  if (!userKey) throw new ApiError(400, 'userKey is required.');

  const merchant = await MerchantModel.findOne({ _id: merchantId, status: 'active' }).lean();
  if (!merchant) throw new ApiError(404, 'Merchant not found.');

  const product = await ProductModel.findOne({
    _id: productId,
    status: 'active',
    accountId: merchant.accountId,
    $or: [{ scope: 'shared' }, { scope: 'merchant', merchantId: merchant._id }],
  }).lean();
  if (!product) throw new ApiError(404, 'Product not found.');

  return { merchant, product, userKey };
}

function parseDesignData(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      throw new ApiError(400, 'designData must be valid JSON.');
    }
  }
  return value;
}

function parsePagePreviewMeta(value: unknown, fileCount: number) {
  if (value === undefined || value === null || value === '') return [];
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new ApiError(400, 'pagePreviewMeta must be valid JSON.');
    }
  }
  if (!Array.isArray(parsed)) throw new ApiError(400, 'pagePreviewMeta must be an array.');
  if (parsed.length > fileCount) throw new ApiError(400, 'pagePreviewMeta cannot include more entries than uploaded pagePreviews files.');
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new ApiError(400, `pagePreviewMeta[${index}] must be an object.`);
    const meta = entry as Record<string, unknown>;
    return {
      pageId: meta.pageId === undefined ? undefined : String(meta.pageId),
      pageNumber: meta.pageNumber === undefined || meta.pageNumber === '' ? undefined : Number(meta.pageNumber),
      filename: meta.filename === undefined ? undefined : String(meta.filename),
    };
  });
}

function designTempPrefix(merchantId: string, userKey: string, productId: string) {
  return `designs/tmp/${merchantId}/${userKey}/${productId}`;
}

function isStorageNotFound(error: { message?: string; statusCode?: string | number; name?: string }) {
  const message = String(error.message ?? '').toLowerCase();
  return error.statusCode === 404 || error.statusCode === '404' || message.includes('not found') || message.includes('object not found');
}

function sanitizeUploadSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}

function sanitizeUploadFilename(value: string, fallbackExtension: string) {
  const raw = value.trim();
  const dotIndex = raw.lastIndexOf('.');
  const base = (dotIndex > 0 ? raw.slice(0, dotIndex) : raw)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || `preview-${Date.now()}`;
  const extension = (dotIndex > 0 ? raw.slice(dotIndex).toLowerCase() : fallbackExtension).replace(/[^a-z0-9.]/g, '');
  return `${base}${extension || fallbackExtension}`;
}
export async function calculatePrice(id: string, variantId: string, selectedOptions: Record<string, string>) {
  const product = await ProductModel.findById(id).lean();
  if (!product) throw new ApiError(404, 'Product not found.');
  const variant = product.variants.find((item: any) => String(item._id) === variantId);
  if (!variant) throw new ApiError(404, 'Variant not found.');
  const selections: Array<{ group: any; optionValue: any }> = [];
  for (const group of product.optionGroups ?? []) {
    const selected = selectedOptions[group.code];
    if (!selected) continue;
    const optionValue = group.values.find((value: any) => value.isActive !== false && value.value === selected);
    if (optionValue) selections.push({ group, optionValue });
  }

  const overrides = selections.filter(({ optionValue }) => optionValue.priceModifierType === 'variant-override');
  if (overrides.length > 1) throw new ApiError(400, 'Only one selected option may override the variant price.');

  let resolvedVariantPrice = variant.price;
  const modifiers: Array<{ groupCode: string; value: string; type: string; amount: number; price?: number }> = [];
  if (overrides[0]) {
    const { group, optionValue } = overrides[0];
    const overridePrice = getVariantConfiguredPrice(optionValue, variant.options ?? {}, group.code);
    if (!Number.isFinite(overridePrice) || overridePrice < 0) {
      throw new ApiError(400, `Variant ${variant.sku} must have a nonnegative numeric _${optionValue.value} or _${group.code} price override.`);
    }
    resolvedVariantPrice = overridePrice;
    modifiers.push({ groupCode: group.code, value: optionValue.value, type: 'variant-override', amount: overridePrice - variant.price, price: overridePrice });
  }

  for (const { group, optionValue } of selections) {
    if (optionValue.priceModifierType === 'variant-override') continue;
    const amount = applyModifier(resolvedVariantPrice, optionValue, variant.options ?? {}, group.code);
    if (!Number.isFinite(amount)) {
      throw new ApiError(400, `Variant ${variant.sku} must have a numeric _${optionValue.value} or _${group.code} option for variant-dependent pricing.`);
    }
    modifiers.push({ groupCode: group.code, value: optionValue.value, type: optionValue.priceModifierType, amount });
  }
  const modifierTotal = modifiers.reduce((sum, item) => sum + item.amount, 0);
  return { basePrice: variant.price, resolvedVariantPrice, modifiers, finalPrice: Math.round((variant.price + modifierTotal) * 100) / 100 };
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

