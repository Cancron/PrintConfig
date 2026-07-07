import { Types } from 'mongoose';
import { LayoutCategoryModel } from '../models/LayoutCategory.js';
import { LayoutTemplateModel } from '../models/LayoutTemplate.js';
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

export function layoutVisibleQuery(accountId: string, merchantId?: string) {
  return { accountId, $or: [{ scope: 'shared' }, { scope: 'merchant', merchantId }] };
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
  const query: Record<string, unknown> = { accountId: data.accountId, scope: data.scope, merchantId: data.scope === 'shared' ? null : data.merchantId, categoryId: data.categoryId, slug: data.slug };
  if (id) query._id = { $ne: id };
  if (await LayoutTemplateModel.findOne(query)) throw new ApiError(409, 'Layout template slug must be unique within account, scope, merchant, and category.');
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
  const templateCount = await LayoutTemplateModel.countDocuments({ categoryId: id });
  if (templateCount > 0) throw new ApiError(409, 'Move or delete templates before deleting this layout category.');
  const category = await LayoutCategoryModel.findByIdAndDelete(id);
  if (!category) throw new ApiError(404, 'Layout category not found.');
  return category;
}

export async function duplicateLayoutCategory(id: string, includeTemplates = false) {
  const category = await LayoutCategoryModel.findById(id).lean();
  if (!category) throw new ApiError(404, 'Layout category not found.');
  const copy = await LayoutCategoryModel.create({ ...stripIds(category), name: `${category.name} Copy`, slug: `${category.slug}-copy-${Date.now()}`, status: 'draft' });
  let templates: unknown[] = [];
  if (includeTemplates) {
    const sourceTemplates = await LayoutTemplateModel.find({ categoryId: id }).lean();
    templates = await LayoutTemplateModel.insertMany(sourceTemplates.map((template) => ({ ...stripIds(template), categoryId: copy._id, name: `${template.name} Copy`, slug: `${template.slug}-copy-${Date.now()}`, status: 'draft' })));
  }
  return { category: copy, templates };
}

export async function exportLayoutCategory(id: string, includeTemplates = false) {
  const category = await LayoutCategoryModel.findById(id).lean();
  if (!category) throw new ApiError(404, 'Layout category not found.');
  const templates = includeTemplates ? await LayoutTemplateModel.find({ categoryId: id }).sort({ sortOrder: 1, name: 1 }).lean() : [];
  return { category, templates };
}

export async function importLayoutCategory(payload: Record<string, unknown>) {
  const rawCategory = (payload.category && typeof payload.category === 'object') ? payload.category as Record<string, unknown> : payload;
  const importSlug = String(rawCategory.slug ?? slugify(String(rawCategory.name ?? 'layout-category')));
  const category = await createLayoutCategory({ ...stripIds(rawCategory), status: 'draft', slug: `${importSlug}-import-${Date.now()}` });
  const importedTemplates = Array.isArray(payload.templates) ? payload.templates as Record<string, unknown>[] : [];
  const templates = [];
  for (const template of importedTemplates) {
    templates.push(await createLayoutTemplate({ ...stripIds(template), categoryId: category._id, accountId: category.accountId, merchantId: category.merchantId, scope: category.scope, status: 'draft', slug: `${String(template.slug ?? slugify(String(template.name ?? 'layout-template')))}-import-${Date.now()}` }));
  }
  return { category, templates };
}

function normalizePages(data: Record<string, unknown>) {
  const pages = Array.isArray(data.pages) ? data.pages as Record<string, unknown>[] : [];
  if (pages.length === 0) {
    data.pages = [{ pageNumber: 1, name: 'Page 1', width: data.canvasWidth, height: data.canvasHeight, backgroundColor: data.backgroundColor || '#ffffff', elements: [] }];
    return;
  }
  data.pages = pages.map((page, index) => {
    const normalized = { ...page };
    normalized.pageNumber = Number(normalized.pageNumber || index + 1);
    normalized.name = String(normalized.name || `Page ${normalized.pageNumber}`);
    normalized.width = positiveNumber(normalized.width, 'Page width');
    normalized.height = positiveNumber(normalized.height, 'Page height');
    if (normalized.backgroundImageAssetId === '') delete normalized.backgroundImageAssetId;
    normalized.elements = normalizeElements(Array.isArray(normalized.elements) ? normalized.elements as Record<string, unknown>[] : []);
    return normalized;
  });
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
  if (!payload.categoryId || !isObjectId(payload.categoryId)) throw new ApiError(400, 'Layout category is required.');
  const category = await LayoutCategoryModel.findOne({ _id: payload.categoryId, ...layoutVisibleQuery(String(payload.accountId), String(payload.merchantId ?? '')) });
  if (!category) throw new ApiError(400, 'Layout category is not visible for this account and merchant.');
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
  normalizePages(payload);
  payload.pageCount = Math.max(Number(payload.pageCount), (payload.pages as unknown[]).length);
  await assertTemplateSlugUnique(payload, id);
}

export async function listLayoutTemplates(filters: { accountId?: string; merchantId?: string; categoryId?: string; scope?: string; status?: string; templateType?: string; orientation?: string; search?: string }) {
  const accountId = resolveAccountId(filters.accountId);
  const query: Record<string, unknown> = layoutVisibleQuery(accountId, filters.merchantId);
  if (filters.categoryId) query.categoryId = filters.categoryId;
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
  return LayoutTemplateModel.create({ ...stripIds(template), name: `${template.name} Copy`, slug: `${template.slug}-copy-${Date.now()}`, status: 'draft' });
}

export async function exportLayoutTemplate(id: string) {
  const template = await LayoutTemplateModel.findById(id).lean();
  if (!template) throw new ApiError(404, 'Layout template not found.');
  const category = await LayoutCategoryModel.findById(template.categoryId).lean();
  return { template, category };
}

export async function importLayoutTemplate(payload: Record<string, unknown>) {
  const rawTemplate = (payload.template && typeof payload.template === 'object') ? payload.template as Record<string, unknown> : payload;
  const categoryId = String(payload.categoryId || rawTemplate.categoryId || '');
  return createLayoutTemplate({ ...stripIds(rawTemplate), categoryId, status: 'draft', slug: `${String(rawTemplate.slug ?? slugify(String(rawTemplate.name ?? 'layout-template')))}-import-${Date.now()}` });
}

function stripIds<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripIds) as T;
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