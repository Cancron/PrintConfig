import { Types } from 'mongoose';
import { LayoutCategoryModel } from '../models/LayoutCategory.js';
import { LayoutTemplateModel } from '../models/LayoutTemplate.js';
import { CollageModel } from '../models/Collage.js';
import { ApiError } from '../middleware/errorHandler.js';
import { resolveAccountId } from './account.service.js';
import { slugify } from '../utils/slug.js';

const URL_SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUSES = ['active', 'draft', 'archived'];
const SCOPES = ['shared', 'merchant'];
const TEMPLATE_TYPES = ['photo_collage', 'photo_book', 'calendar', 'card', 'poster', 'canvas', 'custom'];
const ORIENTATIONS = ['portrait', 'landscape', 'square', 'custom'];
const UNITS = ['inch', 'mm', 'px'];
const ELEMENT_TYPES = ['photo_placeholder', 'text_placeholder', 'shape', 'background', 'clipart', 'static_image'];

export function layoutVisibleQuery(accountId: string, merchantId?: string | null) {
  const query: Record<string, unknown> = { accountId };
  const merchant = String(merchantId ?? '').trim();
  query.$or = merchant && Types.ObjectId.isValid(merchant)
    ? [{ scope: 'shared' }, { scope: 'merchant', merchantId: merchant }]
    : [{ scope: 'shared' }];
  return query;
}

function isObjectId(value: unknown) {
  return Types.ObjectId.isValid(String(value ?? ''));
}

function normalizeScope(data: Record<string, unknown>, label: string) {
  if (!SCOPES.includes(String(data.scope))) data.scope = 'shared';
  if (data.scope === 'shared') data.merchantId = null;
  if (data.scope === 'merchant' && !data.merchantId) throw new ApiError(400, `merchantId is required for merchant scoped ${label}.`);
}

function normalizeRefs(data: Record<string, unknown>) {
  data.accountId = resolveAccountId(String(data.accountId ?? ''));
  if (data.scope === 'shared') data.merchantId = null;
  if (data.merchantId && !isObjectId(data.merchantId)) throw new ApiError(400, 'merchantId must be a valid MongoDB ObjectId.');
  if (data.thumbnailAssetId === '') delete data.thumbnailAssetId;
}

function validateSlug(slug: unknown) {
  const value = String(slug ?? '').trim();
  if (!value) throw new ApiError(400, 'Slug is required.');
  if (!URL_SAFE_SLUG.test(value)) throw new ApiError(400, 'Slug must use lowercase letters, numbers, and hyphens only.');
  return value;
}

function validateStatus(status: unknown) {
  if (!STATUSES.includes(String(status))) throw new ApiError(400, 'Status is required.');
}

async function assertCategorySlugUnique(data: Record<string, unknown>, id?: string) {
  const query: Record<string, unknown> = { accountId: data.accountId, scope: data.scope, merchantId: data.scope === 'shared' ? null : data.merchantId, slug: data.slug };
  if (id) query._id = { $ne: id };
  if (await LayoutCategoryModel.findOne(query)) throw new ApiError(409, 'Layout category slug must be unique within account, scope, and merchant.');
}

async function assertTemplateSlugUnique(data: Record<string, unknown>, id?: string) {
  const query: Record<string, unknown> = { accountId: data.accountId, scope: data.scope, merchantId: data.scope === 'shared' ? null : data.merchantId, slug: data.slug };
  if (id) query._id = { $ne: id };
  if (await LayoutTemplateModel.findOne(query)) throw new ApiError(409, 'Layout template slug must be unique within account, scope, and merchant.');
}
async function assertCollageSlugUnique(data: Record<string, unknown>, id?: string) {
  const query: Record<string, unknown> = { accountId: data.accountId, scope: data.scope, merchantId: data.scope === 'shared' ? null : data.merchantId, categoryId: data.categoryId, slug: data.slug };
  if (id) query._id = { $ne: id };
  if (await CollageModel.findOne(query)) throw new ApiError(409, 'Collage slug must be unique within account, scope, merchant, and category.');
}

function normalizeSearch(search?: string) {
  return String(search ?? '').trim();
}

export async function listLayoutCategories(filters: { accountId?: string; merchantId?: string; scope?: string; status?: string; search?: string }) {
  const accountId = resolveAccountId(filters.accountId);
  const query: Record<string, unknown> = layoutVisibleQuery(accountId, filters.merchantId);
  if (filters.scope) query.scope = filters.scope;
  if (filters.status) query.status = filters.status;
  const search = normalizeSearch(filters.search);
  if (search) query.$and = [{ $or: [{ name: new RegExp(search, 'i') }, { description: new RegExp(search, 'i') }] }];
  return LayoutCategoryModel.find(query).sort({ sortOrder: 1, name: 1 });
}

export async function getLayoutCategory(id: string) {
  const category = await LayoutCategoryModel.findById(id);
  if (!category) throw new ApiError(404, 'Layout category not found.');
  return category;
}

export async function createLayoutCategory(payload: Record<string, unknown>) {
  normalizeScope(payload, 'layout categories');
  normalizeRefs(payload);
  if (!String(payload.name ?? '').trim()) throw new ApiError(400, 'Layout category name is required.');
  payload.slug = validateSlug(payload.slug || slugify(String(payload.name ?? 'layout-category')));
  validateStatus(payload.status ?? 'draft');
  if (payload.sortOrder === '' || Number.isNaN(Number(payload.sortOrder ?? 0))) throw new ApiError(400, 'Sort order must be numeric.');
  await assertCategorySlugUnique(payload);
  return LayoutCategoryModel.create(payload);
}

export async function updateLayoutCategory(id: string, payload: Record<string, unknown>) {
  normalizeScope(payload, 'layout categories');
  normalizeRefs(payload);
  if (!String(payload.name ?? '').trim()) throw new ApiError(400, 'Layout category name is required.');
  payload.slug = validateSlug(payload.slug || slugify(String(payload.name ?? 'layout-category')));
  validateStatus(payload.status ?? 'draft');
  if (payload.sortOrder === '' || Number.isNaN(Number(payload.sortOrder ?? 0))) throw new ApiError(400, 'Sort order must be numeric.');
  await assertCategorySlugUnique(payload, id);
  const category = await LayoutCategoryModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  if (!category) throw new ApiError(404, 'Layout category not found.');
  return category;
}

export async function deleteLayoutCategory(id: string) {
  const collageCount = await CollageModel.countDocuments({ categoryId: id });
  if (collageCount > 0) throw new ApiError(409, 'Move or delete collages before deleting this layout category.');
  const category = await LayoutCategoryModel.findByIdAndDelete(id);
  if (!category) throw new ApiError(404, 'Layout category not found.');
  return category;
}

export async function duplicateLayoutCategory(id: string, _includeTemplates = false) {
  const category = await LayoutCategoryModel.findById(id).lean();
  if (!category) throw new ApiError(404, 'Layout category not found.');
  const copy = await LayoutCategoryModel.create({ ...stripIds(category), name: `${category.name} Copy`, slug: `${category.slug}-copy-${Date.now()}`, status: 'draft' });
  return { category: copy, templates: [] };
}

export async function exportLayoutCategory(id: string, _includeTemplates = false) {
  const category = await LayoutCategoryModel.findById(id).lean();
  if (!category) throw new ApiError(404, 'Layout category not found.');
  return { category, templates: [] };
}

export async function importLayoutCategory(payload: Record<string, unknown>) {
  const rawCategory = (payload.category && typeof payload.category === 'object') ? payload.category as Record<string, unknown> : payload;
  const importSlug = String(rawCategory.slug ?? slugify(String(rawCategory.name ?? 'layout-category')));
  const category = await createLayoutCategory({ ...stripIds(rawCategory), status: 'draft', slug: `${importSlug}-import-${Date.now()}` });
  return { category, templates: [] };
}

async function normalizePages(data: Record<string, unknown>, merchantContextId?: string) {
  const pages = Array.isArray(data.pages) ? data.pages as Record<string, unknown>[] : [];
  if (pages.length === 0) {
    data.pages = [{ pageNumber: 1, name: 'Page 1', width: data.canvasWidth, height: data.canvasHeight, backgroundColor: data.backgroundColor || '#ffffff', collageId: null, elements: [] }];
    return;
  }
  data.pages = await Promise.all(pages.map(async (page, index) => {
    const normalized = { ...page };
    normalized.pageNumber = Number(normalized.pageNumber || index + 1);
    normalized.name = String(normalized.name || `Page ${normalized.pageNumber}`);
    normalized.width = positiveNumber(normalized.width, 'Page width');
    normalized.height = positiveNumber(normalized.height, 'Page height');
    if (normalized.backgroundImageAssetId === '') delete normalized.backgroundImageAssetId;
    if (!normalized.collageId) {
      normalized.collageId = null;
    } else {
      if (!isObjectId(normalized.collageId)) throw new ApiError(400, 'Page collage must be a valid MongoDB ObjectId.');
      const collage = await CollageModel.findOne({
        _id: normalized.collageId,
        ...layoutVisibleQuery(String(data.accountId), merchantContextId ?? (data.merchantId ? String(data.merchantId) : undefined)),
      });
      if (!collage) throw new ApiError(400, 'Selected collage is not visible for this account and merchant.');
    }
    normalized.elements = normalizeElements(Array.isArray(normalized.elements) ? normalized.elements as Record<string, unknown>[] : []);
    return normalized;
  }));
}
function normalizeElements(elements: Record<string, unknown>[]) {
  return elements.map((element, index) => {
    const normalized = { ...element };
    if (!ELEMENT_TYPES.includes(String(normalized.type))) throw new ApiError(400, 'Layout element type is invalid.');
    if (!String(normalized.name ?? '').trim()) normalized.name = `Element ${index + 1}`;
    for (const field of ['x', 'y']) normalized[field] = percentNumber(normalized[field], String(field).toUpperCase());
    for (const field of ['width', 'height']) normalized[field] = positivePercentNumber(normalized[field], String(field));
    normalized.rotation = Number(normalized.rotation ?? 0);
    normalized.zIndex = Number(normalized.zIndex ?? index);
    normalized.locked = normalized.locked === true;
    normalized.required = normalized.required === true;
    normalized.editable = normalized.editable !== false;
    normalized.style = normalized.style && typeof normalized.style === 'object' ? normalized.style : {};
    if ((normalized.imageSettings as Record<string, unknown> | undefined)?.imageAssetId === '') delete (normalized.imageSettings as Record<string, unknown>).imageAssetId;
    return normalized;
  });
}

function positiveNumber(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new ApiError(400, `${label} must be greater than zero.`);
  return number;
}

function percentNumber(value: unknown, label: string) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0 || number > 100) throw new ApiError(400, `${label} must be between 0 and 100.`);
  return number;
}

function positivePercentNumber(value: unknown, label: string) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number <= 0 || number > 100) throw new ApiError(400, `${label} must be greater than 0 and no more than 100.`);
  return number;
}

async function normalizeTemplatePayload(payload: Record<string, unknown>, id?: string) {
  normalizeScope(payload, 'layout templates');
  normalizeRefs(payload);
  if (!String(payload.name ?? '').trim()) throw new ApiError(400, 'Layout template name is required.');
  payload.slug = validateSlug(payload.slug || slugify(String(payload.name ?? 'layout-template')));
  validateStatus(payload.status ?? 'draft');
  const merchantContextId = payload.merchantContextId ? String(payload.merchantContextId) : undefined;
  delete payload.merchantContextId;
  payload.categoryId = null;
  if (!TEMPLATE_TYPES.includes(String(payload.templateType))) throw new ApiError(400, 'Template type is required.');
  if (!ORIENTATIONS.includes(String(payload.orientation))) throw new ApiError(400, 'Orientation is required.');
  if (!UNITS.includes(String(payload.unit))) throw new ApiError(400, 'Unit is required.');
  payload.pageCount = positiveNumber(payload.pageCount ?? 1, 'Page count');
  payload.canvasWidth = positiveNumber(payload.canvasWidth, 'Canvas width');
  payload.canvasHeight = positiveNumber(payload.canvasHeight, 'Canvas height');
  payload.dpi = positiveNumber(payload.dpi, 'DPI');
  payload.sortOrder = Number(payload.sortOrder ?? 0);
  if (Number.isNaN(payload.sortOrder)) throw new ApiError(400, 'Sort order must be numeric.');
  payload.tags = Array.isArray(payload.tags) ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean) : String(payload.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
  await normalizePages(payload, merchantContextId);
  payload.pageCount = Math.max(Number(payload.pageCount), (payload.pages as unknown[]).length);
  await assertTemplateSlugUnique(payload, id);
}

export async function listLayoutTemplates(filters: { accountId?: string; merchantId?: string; categoryId?: string; scope?: string; status?: string; templateType?: string; orientation?: string; search?: string }) {
  const accountId = resolveAccountId(filters.accountId);
  const query: Record<string, unknown> = layoutVisibleQuery(accountId, filters.merchantId);
  if (filters.scope) query.scope = filters.scope;
  if (filters.status) query.status = filters.status;
  if (filters.templateType) query.templateType = filters.templateType;
  if (filters.orientation) query.orientation = filters.orientation;
  const search = normalizeSearch(filters.search);
  if (search) query.$and = [{ $or: [{ name: new RegExp(search, 'i') }, { description: new RegExp(search, 'i') }, { tags: new RegExp(search, 'i') }] }];
  return LayoutTemplateModel.find(query).sort({ sortOrder: 1, name: 1 });
}

export async function getLayoutTemplate(id: string) {
  const template = await LayoutTemplateModel.findById(id);
  if (!template) throw new ApiError(404, 'Layout template not found.');
  return template;
}

export async function createLayoutTemplate(payload: Record<string, unknown>) {
  await normalizeTemplatePayload(payload);
  return LayoutTemplateModel.create(payload);
}

export async function updateLayoutTemplate(id: string, payload: Record<string, unknown>) {
  await normalizeTemplatePayload(payload, id);
  const template = await LayoutTemplateModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  if (!template) throw new ApiError(404, 'Layout template not found.');
  return template;
}

export async function deleteLayoutTemplate(id: string) {
  const template = await LayoutTemplateModel.findByIdAndDelete(id);
  if (!template) throw new ApiError(404, 'Layout template not found.');
  return template;
}

export async function duplicateLayoutTemplate(id: string) {
  const template = await LayoutTemplateModel.findById(id).lean();
  if (!template) throw new ApiError(404, 'Layout template not found.');
  return LayoutTemplateModel.create({ ...stripIds(template), categoryId: null, name: `${template.name} Copy`, slug: `${template.slug}-copy-${Date.now()}`, status: 'draft' });
}

export async function exportLayoutTemplate(id: string) {
  const template = await LayoutTemplateModel.findById(id).lean();
  if (!template) throw new ApiError(404, 'Layout template not found.');
  return { template };
}

export async function importLayoutTemplate(payload: Record<string, unknown>) {
  const rawTemplate = (payload.template && typeof payload.template === 'object') ? payload.template as Record<string, unknown> : payload;
  const template = stripIds(rawTemplate) as Record<string, unknown>;
  delete template.categoryId;
  return createLayoutTemplate({ ...template, status: 'draft', slug: `${String(rawTemplate.slug ?? slugify(String(rawTemplate.name ?? 'layout-template')))}-import-${Date.now()}` });
}

async function normalizeCollagePayload(payload: Record<string, unknown>, id?: string) {
  normalizeScope(payload, 'collages');
  normalizeRefs(payload);
  if (!String(payload.name ?? '').trim()) throw new ApiError(400, 'Collage name is required.');
  payload.slug = validateSlug(payload.slug || slugify(String(payload.name ?? 'collage')));
  validateStatus(payload.status ?? 'draft');
  if (!payload.categoryId || !isObjectId(payload.categoryId)) throw new ApiError(400, 'Layout category is required.');
  const merchantContextId = payload.merchantContextId ? String(payload.merchantContextId) : undefined;
  delete payload.merchantContextId;
  const category = await LayoutCategoryModel.findOne({
    _id: payload.categoryId,
    ...layoutVisibleQuery(String(payload.accountId), merchantContextId ?? (payload.merchantId ? String(payload.merchantId) : undefined)),
  });
  if (!category) throw new ApiError(400, 'Layout category is not visible for this account and merchant.');
  if (!ORIENTATIONS.includes(String(payload.orientation))) throw new ApiError(400, 'Orientation is required.');
  if (!UNITS.includes(String(payload.unit))) throw new ApiError(400, 'Unit is required.');
  payload.canvasWidth = positiveNumber(payload.canvasWidth, 'Canvas width');
  payload.canvasHeight = positiveNumber(payload.canvasHeight, 'Canvas height');
  payload.dpi = positiveNumber(payload.dpi, 'DPI');
  payload.sortOrder = Number(payload.sortOrder ?? 0);
  if (Number.isNaN(payload.sortOrder)) throw new ApiError(400, 'Sort order must be numeric.');
  if (payload.backgroundImageAssetId === '') delete payload.backgroundImageAssetId;
  payload.tags = Array.isArray(payload.tags) ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean) : String(payload.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
  payload.elements = normalizeElements(Array.isArray(payload.elements) ? payload.elements as Record<string, unknown>[] : []);
  await assertCollageSlugUnique(payload, id);
}

export async function listCollages(filters: { accountId?: string; merchantId?: string; categoryId?: string; scope?: string; status?: string; orientation?: string; search?: string; page?: string | number; pageSize?: string | number }) {
  const accountId = resolveAccountId(filters.accountId);
  const query: Record<string, unknown> = layoutVisibleQuery(accountId, filters.merchantId);
  if (filters.categoryId) query.categoryId = filters.categoryId;
  if (filters.scope) query.scope = filters.scope;
  if (filters.status) query.status = filters.status;
  if (filters.orientation) query.orientation = filters.orientation;
  const search = normalizeSearch(filters.search);
  if (search) query.$and = [{ $or: [{ name: new RegExp(search, 'i') }, { description: new RegExp(search, 'i') }, { tags: new RegExp(search, 'i') }] }];
  const page = Number(filters.page);
  const pageSize = Number(filters.pageSize);
  if (Number.isFinite(page) && page > 0 && Number.isFinite(pageSize) && pageSize > 0) {
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
    const safePage = Math.max(1, Math.floor(page));
    const total = await CollageModel.countDocuments(query);
    const pageCount = Math.max(1, Math.ceil(total / safePageSize));
    const currentPage = Math.min(safePage, pageCount);
    const items = await CollageModel.find(query)
      .sort({ sortOrder: 1, name: 1 })
      .skip((currentPage - 1) * safePageSize)
      .limit(safePageSize);
    return {
      items,
      pagination: {
        page: currentPage,
        pageSize: safePageSize,
        total,
        pageCount,
      },
    };
  }
  return CollageModel.find(query).sort({ sortOrder: 1, name: 1 });
}

export async function getCollage(id: string) {
  const collage = await CollageModel.findById(id);
  if (!collage) throw new ApiError(404, 'Collage not found.');
  return collage;
}

export async function createCollage(payload: Record<string, unknown>) {
  await normalizeCollagePayload(payload);
  return CollageModel.create(payload);
}

export async function updateCollage(id: string, payload: Record<string, unknown>) {
  await normalizeCollagePayload(payload, id);
  const collage = await CollageModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  if (!collage) throw new ApiError(404, 'Collage not found.');
  return collage;
}

export async function deleteCollage(id: string) {
  const usageCount = await LayoutTemplateModel.countDocuments({ 'pages.collageId': id });
  if (usageCount > 0) throw new ApiError(409, 'Remove this collage from layout template pages before deleting it.');
  const collage = await CollageModel.findByIdAndDelete(id);
  if (!collage) throw new ApiError(404, 'Collage not found.');
  return collage;
}

export async function duplicateCollage(id: string) {
  const collage = await CollageModel.findById(id).lean();
  if (!collage) throw new ApiError(404, 'Collage not found.');
  return CollageModel.create({ ...stripIds(collage), name: `${collage.name} Copy`, slug: `${collage.slug}-copy-${Date.now()}`, status: 'draft' });
}

export async function exportCollage(id: string) {
  const collage = await CollageModel.findById(id).lean();
  if (!collage) throw new ApiError(404, 'Collage not found.');
  const category = await LayoutCategoryModel.findById(collage.categoryId).lean();
  return { collage, category };
}

export async function importCollage(payload: Record<string, unknown>) {
  const rawCollage = (payload.collage && typeof payload.collage === 'object') ? payload.collage as Record<string, unknown> : payload;
  const categoryId = String(payload.categoryId || rawCollage.categoryId || '');
  return createCollage({ ...stripIds(rawCollage), categoryId, status: 'draft', slug: `${String(rawCollage.slug ?? slugify(String(rawCollage.name ?? 'collage')))}-import-${Date.now()}` });
}
function stripIds<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripIds) as T;
  if (isObjectIdValue(value)) return String(value) as T;
  if (value instanceof Date) return value.toISOString() as T;
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

function isObjectIdValue(value: unknown) {
  return value instanceof Types.ObjectId || Boolean(value && typeof value === 'object' && (value as { _bsontype?: string })._bsontype === 'ObjectId');
}
