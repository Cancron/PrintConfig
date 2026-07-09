/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Collage, ImageAsset, ImageFolder, LayoutCategory, LayoutElement, LayoutTemplate, LayoutTemplatePage, Merchant, Product, ProductCategory } from '../types';
import { normalizeVariantOptionDefinitions } from './variantOptions';
import { liftLegacyRoomPreviews, normalizeSharedRoomPreview } from './roomPreview';
import { normalizeFrontendContent } from './frontendContent';
import { normalizeEditorProductSelection } from './productSelection';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `API request failed: ${response.status}`);
  }
  return response.json();
}

function idOf(value: any) {
  return String(value?._id ?? '');
}

function normalizeMerchant(raw: any): Merchant {
  return {
    _id: idOf(raw),
    accountId: String(raw.accountId ?? 'acct-1'),
    name: raw.name ?? '',
    slug: raw.slug ?? '',
    logoUrl: raw.logoUrl ?? '',
    logoAssetId: raw.logoAssetId ? String(raw.logoAssetId) : undefined,
    status: raw.status === 'draft' || raw.status === 'Draft' ? 'Draft' : 'Active',
    editorPrimaryColor: raw.editorPrimaryColor ?? '#111827',
    editorSecondaryColor: raw.editorSecondaryColor ?? '#f3f4f6',
    editorAccentColor: raw.editorAccentColor ?? '#2563eb',
    customCss: raw.customCss ?? '',
    customJavascript: raw.customJavascript ?? '',
    apiPrivateKeyLastFour: raw.apiPrivateKeyLastFour ?? '',
    apiPrivateKeyCreatedAt: raw.apiPrivateKeyCreatedAt ?? undefined,
  };
}

function normalizeCategory(raw: any): ProductCategory {
  return {
    _id: idOf(raw),
    accountId: String(raw.accountId ?? 'acct-1'),
    merchantId: raw.merchantId ? String(raw.merchantId) : null,
    scope: raw.scope === 'merchant' ? 'merchant' : 'shared',
    name: raw.name ?? '',
    slug: raw.slug ?? '',
    description: raw.description ?? '',
    status: raw.status === 'archived' ? 'archived' : raw.status === 'active' ? 'active' : 'draft',
    thumbnailUrl: raw.thumbnailUrl ?? '',
    thumbnailAssetId: raw.thumbnailAssetId ? String(raw.thumbnailAssetId) : undefined,
    sortOrder: Number(raw.sortOrder ?? 0),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}


const defaultPhotoSettings = { fitMode: 'cover' as const, allowCrop: true, allowRotate: true, allowReplace: true, placeholderIndex: 1, maskShape: 'rectangle' as const };
const defaultTextSettings = { defaultText: '', fontFamily: 'Arial', fontSize: 24, fontWeight: '400', color: '#111827', textAlign: 'center' as const };
const defaultShapeSettings = { shapeType: 'rectangle' as const, fillColor: '#f3f4f6', strokeColor: '#111827', strokeWidth: 1, borderRadius: 0, svgPath: '', svgViewBox: '' };
const defaultImageSettings = { imageUrl: '', opacity: 1 };

function normalizeLayoutCategory(raw: any): LayoutCategory {
  return {
    _id: idOf(raw),
    accountId: String(raw.accountId ?? ''),
    merchantId: raw.merchantId ? String(raw.merchantId) : null,
    scope: raw.scope === 'merchant' ? 'merchant' : 'shared',
    name: raw.name ?? '',
    slug: raw.slug ?? '',
    description: raw.description ?? '',
    status: raw.status === 'active' || raw.status === 'archived' ? raw.status : 'draft',
    thumbnailUrl: raw.thumbnailUrl ?? '',
    thumbnailAssetId: raw.thumbnailAssetId ? String(raw.thumbnailAssetId) : undefined,
    sortOrder: Number(raw.sortOrder ?? 0),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

function normalizeLayoutElement(raw: any): LayoutElement {
  return {
    ...raw,
    _id: idOf(raw),
    type: raw.type ?? 'photo_placeholder',
    name: raw.name ?? 'Element',
    x: Number(raw.x ?? 0),
    y: Number(raw.y ?? 0),
    width: Number(raw.width ?? 25),
    height: Number(raw.height ?? 25),
    rotation: Number(raw.rotation ?? 0),
    zIndex: Number(raw.zIndex ?? 0),
    locked: raw.locked === true,
    required: raw.required === true,
    editable: raw.editable !== false,
    style: raw.style ?? {},
    photoSettings: { ...defaultPhotoSettings, ...(raw.photoSettings ?? {}) },
    textSettings: { ...defaultTextSettings, ...(raw.textSettings ?? {}) },
    shapeSettings: { ...defaultShapeSettings, ...(raw.shapeSettings ?? {}) },
    imageSettings: { ...defaultImageSettings, ...(raw.imageSettings ?? {}), imageAssetId: raw.imageSettings?.imageAssetId ? String(raw.imageSettings.imageAssetId) : undefined },
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

function normalizeLayoutPage(raw: any, template?: any): LayoutTemplatePage {
  return {
    ...raw,
    _id: idOf(raw),
    pageNumber: Number(raw.pageNumber ?? 1),
    name: raw.name ?? 'Page',
    width: Number(raw.width ?? template?.canvasWidth ?? 12),
    height: Number(raw.height ?? template?.canvasHeight ?? 12),
    backgroundColor: raw.backgroundColor ?? template?.backgroundColor ?? '#ffffff',
    backgroundImageUrl: raw.backgroundImageUrl ?? '',
    backgroundImageAssetId: raw.backgroundImageAssetId ? String(raw.backgroundImageAssetId) : undefined,
    collageId: raw.collageId ? String(raw.collageId) : null,
    elements: (raw.elements ?? []).map(normalizeLayoutElement),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

function normalizeLayoutTemplate(raw: any): LayoutTemplate {
  return {
    ...raw,
    _id: idOf(raw),
    accountId: String(raw.accountId ?? ''),
    merchantId: raw.merchantId ? String(raw.merchantId) : null,
    scope: raw.scope === 'merchant' ? 'merchant' : 'shared',
    categoryId: String(raw.categoryId ?? ''),
    name: raw.name ?? '',
    slug: raw.slug ?? '',
    description: raw.description ?? '',
    status: raw.status === 'active' || raw.status === 'archived' ? raw.status : 'draft',
    thumbnailUrl: raw.thumbnailUrl ?? '',
    thumbnailAssetId: raw.thumbnailAssetId ? String(raw.thumbnailAssetId) : undefined,
    templateType: raw.templateType ?? 'photo_collage',
    orientation: raw.orientation ?? 'square',
    pageCount: Number(raw.pageCount ?? 1),
    canvasWidth: Number(raw.canvasWidth ?? 12),
    canvasHeight: Number(raw.canvasHeight ?? 12),
    unit: raw.unit === 'mm' || raw.unit === 'px' ? raw.unit : 'inch',
    dpi: Number(raw.dpi ?? 300),
    backgroundColor: raw.backgroundColor ?? '#ffffff',
    tags: raw.tags ?? [],
    sortOrder: Number(raw.sortOrder ?? 0),
    pages: (raw.pages ?? []).map((page: any) => normalizeLayoutPage(page, raw)),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

function normalizeCollage(raw: any): Collage {
  return {
    ...raw,
    _id: idOf(raw),
    accountId: String(raw.accountId ?? ''),
    merchantId: raw.merchantId ? String(raw.merchantId) : null,
    scope: raw.scope ?? 'shared',
    categoryId: raw.categoryId ? String(raw.categoryId) : '',
    name: raw.name ?? '',
    slug: raw.slug ?? '',
    description: raw.description ?? '',
    status: raw.status ?? 'draft',
    thumbnailUrl: raw.thumbnailUrl ?? '',
    thumbnailAssetId: raw.thumbnailAssetId ? String(raw.thumbnailAssetId) : undefined,
    orientation: raw.orientation ?? 'square',
    canvasWidth: Number(raw.canvasWidth ?? 12),
    canvasHeight: Number(raw.canvasHeight ?? 12),
    unit: raw.unit ?? 'inch',
    dpi: Number(raw.dpi ?? 300),
    backgroundColor: raw.backgroundColor ?? '#ffffff',
    backgroundImageUrl: raw.backgroundImageUrl ?? '',
    backgroundImageAssetId: raw.backgroundImageAssetId ? String(raw.backgroundImageAssetId) : undefined,
    tags: raw.tags ?? [],
    sortOrder: Number(raw.sortOrder ?? 0),
    elements: (raw.elements ?? []).map(normalizeLayoutElement),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}
function layoutQuery(input: { accountId: string; merchantId?: string; categoryId?: string; scope?: string; status?: string; templateType?: string; orientation?: string; search?: string; page?: number; pageSize?: number }) {
  const params = new URLSearchParams({ accountId: input.accountId });
  if (input.merchantId) params.set('merchantId', input.merchantId);
  if (input.categoryId) params.set('categoryId', input.categoryId);
  if (input.scope) params.set('scope', input.scope);
  if (input.status) params.set('status', input.status);
  if (input.templateType) params.set('templateType', input.templateType);
  if (input.orientation) params.set('orientation', input.orientation);
  if (input.search) params.set('search', input.search);
  if (input.page) params.set('page', String(input.page));
  if (input.pageSize) params.set('pageSize', String(input.pageSize));
  return params.toString();
}
function normalizeSurface(raw: any) {
  return raw ? { ...raw, _id: idOf(raw), productId: String(raw.productId ?? '') } : null;
}

function normalizeOptionGroups(groups: any[] = []) {
  return groups.map((group) => ({
    ...group,
    _id: idOf(group),
    productId: String(group.productId ?? ''),
    values: (group.values ?? []).map((value: any) => ({ ...value, _id: idOf(value), optionGroupId: String(value.optionGroupId ?? group._id ?? ''), metadata: value.metadata ?? {} })),
  }));
}

function normalizeTemplates(templates: any[] = []) {
  return templates.map((template) => ({
    ...template,
    _id: idOf(template),
    productId: String(template.productId ?? ''),
    variantId: String(template.variantId ?? ''),
    surfaceId: String(template.surfaceId ?? ''),
    elements: (template.elements ?? []).map((element: any) => ({ ...element, _id: idOf(element) })),
  }));
}

function normalizeFolder(raw: any): ImageFolder {
  return { ...raw, _id: idOf(raw), accountId: String(raw.accountId ?? ''), merchantId: raw.merchantId ? String(raw.merchantId) : null, parentFolderId: raw.parentFolderId ? String(raw.parentFolderId) : null };
}

function normalizeAsset(raw: any): ImageAsset {
  return { ...raw, _id: idOf(raw), accountId: String(raw.accountId ?? ''), merchantId: raw.merchantId ? String(raw.merchantId) : null, folderId: raw.folderId ? String(raw.folderId) : null, tags: raw.tags ?? [] };
}

function galleryQuery(input: { accountId: string; merchantId?: string; folderId?: string | null; scope?: string; search?: string }) {
  const params = new URLSearchParams({ accountId: input.accountId });
  if (input.merchantId) params.set('merchantId', input.merchantId);
  if (input.folderId) params.set('folderId', input.folderId);
  if (input.scope) params.set('scope', input.scope);
  if (input.search) params.set('search', input.search);
  return params.toString();
}
function normalizeProduct(raw: any): Product {
  const productId = idOf(raw);
  const variants = (raw.variants ?? []).map((variant: any) => ({
    ...variant,
    _id: idOf(variant),
    productId: String(variant.productId ?? productId),
    status: variant.status === 'active' || variant.status === 'Active' ? 'Active' : 'Draft',
    options: variant.options ?? {},
    roomPreviews: (variant.roomPreviews ?? []).map((room: any) => ({ ...room, _id: idOf(room), variantId: String(room.variantId ?? variant._id ?? '') })),
  }));
  const product: Product = {
    ...raw,
    _id: productId,
    accountId: String(raw.accountId ?? 'acct-1'),
    merchantId: raw.merchantId ? String(raw.merchantId) : null,
    categoryId: String(raw.categoryId ?? ''),
    categorySnapshot: raw.categorySnapshot ? normalizeCategory(raw.categorySnapshot) : undefined,
    status: raw.status === 'active' || raw.status === 'Active' ? 'Active' : 'Draft',
    surface: normalizeSurface(raw.surface),
    optionGroups: normalizeOptionGroups(raw.optionGroups),
    variantOptionDefinitions: normalizeVariantOptionDefinitions(raw.variantOptionDefinitions, productId),
    frontendContent: normalizeFrontendContent(raw.frontendContent),
    editorProductSelection: normalizeEditorProductSelection(raw.editorProductSelection),
    roomPreviews: (raw.roomPreviews ?? []).map((room: any, index: number) => normalizeSharedRoomPreview(room, productId, index)),
    variants,
    editorRules: raw.editorRules ?? {},
    exportRules: raw.exportRules ?? {},
    templates: normalizeTemplates(raw.templates),
    layoutSettings: { enabled: raw.layoutSettings?.enabled === true, allowedTemplateCategoryIds: (raw.layoutSettings?.allowedTemplateCategoryIds ?? []).map(String), allowedTemplateIds: (raw.layoutSettings?.allowedTemplateIds ?? []).map(String), requireTemplateSelection: raw.layoutSettings?.requireTemplateSelection === true },
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
  product.roomPreviews = liftLegacyRoomPreviews(product);
  product.variants = product.variants.map((variant) => ({ ...variant, roomPreviews: undefined }));
  return product;
}

function apiPayload<T>(value: T): T {
  if (Array.isArray(value)) return value.map(apiPayload) as T;
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === 'clientId' || key === 'id' || (key === '_id' && !child)) continue;
      if (!child && ['productId', 'optionGroupId', 'variantId', 'surfaceId', 'categoryId', 'thumbnailAssetId', 'backgroundImageAssetId', 'imageAssetId'].includes(key)) continue;
      output[key] = apiPayload(child);
    }
    return output as T;
  }
  return value;
}

function withoutRootId<T extends { _id: string }>(value: T) {
  const payload = { ...value } as Omit<T, '_id'> & { _id?: string };
  delete payload._id;
  return payload;
}

function productPayload(product: Product) {
  return apiPayload({ ...withoutRootId(product), status: product.status === 'Active' ? 'active' : 'draft', variants: product.variants.map((variant) => ({ ...variant, status: variant.status === 'Active' ? 'active' : 'draft' })) });
}
function merchantPayload(merchant: Merchant) {
  return apiPayload({...withoutRootId(merchant), status: merchant.status === 'Active' ? 'active' : 'draft'});
}
export const api = {
  health: () => request<{ ok: boolean }>('/health'),
  listImageFolders: (filters: { accountId: string; merchantId?: string; folderId?: string | null; scope?: string; search?: string }) => request<any[]>(`/image-folders?${galleryQuery(filters)}`).then((items) => items.map(normalizeFolder)),
  listAllImageFolders: (accountId: string, merchantId?: string) => request<any[]>(`/image-folders/all?${galleryQuery({ accountId, merchantId })}`).then((items) => items.map(normalizeFolder)),
  getImageFolder: (id: string) => request<any>(`/image-folders/${id}`).then(normalizeFolder),
  createImageFolder: (folder: ImageFolder) => request<any>('/image-folders', { method: 'POST', body: JSON.stringify(apiPayload(withoutRootId(folder))) }).then(normalizeFolder),
  updateImageFolder: (folder: ImageFolder) => request<any>(`/image-folders/${folder._id}`, { method: 'PUT', body: JSON.stringify(apiPayload(withoutRootId(folder))) }).then(normalizeFolder),
  deleteImageFolder: (id: string) => request(`/image-folders/${id}`, { method: 'DELETE' }),
  listImageAssets: (filters: { accountId: string; merchantId?: string; folderId?: string | null; scope?: string; search?: string }) => request<any[]>(`/image-assets?${galleryQuery(filters)}`).then((items) => items.map(normalizeAsset)),
  getImageAsset: (id: string) => request<any>(`/image-assets/${id}`).then(normalizeAsset),
  createImageAsset: (asset: ImageAsset) => request<any>('/image-assets', { method: 'POST', body: JSON.stringify(apiPayload(withoutRootId(asset))) }).then(normalizeAsset),
  updateImageAsset: (asset: ImageAsset) => request<any>(`/image-assets/${asset._id}`, { method: 'PUT', body: JSON.stringify(apiPayload(withoutRootId(asset))) }).then(normalizeAsset),
  deleteImageAsset: (id: string) => request(`/image-assets/${id}`, { method: 'DELETE' }),
  moveImageAsset: (id: string, folderId?: string | null) => request<any>(`/image-assets/${id}/move`, { method: 'POST', body: JSON.stringify({ folderId: folderId || null }) }).then(normalizeAsset),
  listMerchants: (accountId: string) => request<any[]>(`/merchants?accountId=${encodeURIComponent(accountId)}`).then((items) => items.map(normalizeMerchant)),
  updateMerchant: (merchant: Merchant) => request<any>(`/merchants/${merchant._id}`, { method: 'PUT', body: JSON.stringify(merchantPayload(merchant)) }).then(normalizeMerchant),
  rotateMerchantApiKey: (merchantId: string) => request<any>(`/merchants/${merchantId}/api-key`, { method: 'POST' }).then((result) => ({ merchant: normalizeMerchant(result.merchant), apiPrivateKey: String(result.apiPrivateKey) })),
  listLayoutCategories: (accountId: string, merchantId: string) => request<any[]>(`/layout-categories?${layoutQuery({ accountId, merchantId })}`).then((items) => items.map(normalizeLayoutCategory)),
  getLayoutCategory: (id: string) => request<any>(`/layout-categories/${id}`).then(normalizeLayoutCategory),
  createLayoutCategory: (category: LayoutCategory) => request<any>('/layout-categories', { method: 'POST', body: JSON.stringify(apiPayload(withoutRootId(category))) }).then(normalizeLayoutCategory),
  updateLayoutCategory: (category: LayoutCategory) => request<any>(`/layout-categories/${category._id}`, { method: 'PUT', body: JSON.stringify(apiPayload(withoutRootId(category))) }).then(normalizeLayoutCategory),
  deleteLayoutCategory: (id: string) => request(`/layout-categories/${id}`, { method: 'DELETE' }),
  duplicateLayoutCategory: (id: string, includeTemplates: boolean) => request<any>(`/layout-categories/${id}/duplicate`, { method: 'POST', body: JSON.stringify({ includeTemplates }) }).then((result) => ({ category: normalizeLayoutCategory(result.category), templates: (result.templates ?? []).map(normalizeLayoutTemplate) })),
  exportLayoutCategory: (id: string, includeTemplates = false) => request<any>(`/layout-categories/${id}/export?includeTemplates=${includeTemplates ? 'true' : 'false'}`).then((result) => ({ category: normalizeLayoutCategory(result.category), templates: (result.templates ?? []).map(normalizeLayoutTemplate) })),
  importLayoutCategory: (payload: unknown) => request<any>('/layout-categories/import', { method: 'POST', body: JSON.stringify(payload) }).then((result) => ({ category: normalizeLayoutCategory(result.category), templates: (result.templates ?? []).map(normalizeLayoutTemplate) })),
  listLayoutTemplates: (filters: { accountId: string; merchantId: string; categoryId?: string; scope?: string; status?: string; templateType?: string; orientation?: string; search?: string }) => request<any[]>(`/layout-templates?${layoutQuery(filters)}`).then((items) => items.map(normalizeLayoutTemplate)),
  getLayoutTemplate: (id: string) => request<any>(`/layout-templates/${id}`).then(normalizeLayoutTemplate),
  createLayoutTemplate: (template: LayoutTemplate) => request<any>('/layout-templates', { method: 'POST', body: JSON.stringify(apiPayload(withoutRootId(template))) }).then(normalizeLayoutTemplate),
  updateLayoutTemplate: (template: LayoutTemplate) => request<any>(`/layout-templates/${template._id}`, { method: 'PUT', body: JSON.stringify(apiPayload(withoutRootId(template))) }).then(normalizeLayoutTemplate),
  deleteLayoutTemplate: (id: string) => request(`/layout-templates/${id}`, { method: 'DELETE' }),
  duplicateLayoutTemplate: (id: string) => request<any>(`/layout-templates/${id}/duplicate`, { method: 'POST' }).then(normalizeLayoutTemplate),
  exportLayoutTemplate: (id: string) => request<any>(`/layout-templates/${id}/export`).then((result) => ({ template: normalizeLayoutTemplate(result.template), category: result.category ? normalizeLayoutCategory(result.category) : undefined })),
  importLayoutTemplate: (payload: unknown) => request<any>('/layout-templates/import', { method: 'POST', body: JSON.stringify(payload) }).then(normalizeLayoutTemplate),
  listCollages: (filters: { accountId: string; merchantId: string; categoryId?: string; scope?: string; status?: string; orientation?: string; search?: string }) => request<any[]>(`/collages?${layoutQuery(filters)}`).then((items) => items.map(normalizeCollage)),
  listCollagesPaged: (filters: { accountId: string; merchantId: string; categoryId?: string; scope?: string; status?: string; orientation?: string; search?: string; page: number; pageSize: number }) => request<any>(`/collages?${layoutQuery(filters)}`).then((result) => ({
    items: (result.items ?? []).map(normalizeCollage),
    pagination: {
      page: Number(result.pagination?.page ?? filters.page),
      pageSize: Number(result.pagination?.pageSize ?? filters.pageSize),
      total: Number(result.pagination?.total ?? 0),
      pageCount: Number(result.pagination?.pageCount ?? 1),
    },
  })),
  getCollage: (id: string) => request<any>(`/collages/${id}`).then(normalizeCollage),
  createCollage: (collage: Collage) => request<any>('/collages', { method: 'POST', body: JSON.stringify(apiPayload(withoutRootId(collage))) }).then(normalizeCollage),
  updateCollage: (collage: Collage) => request<any>(`/collages/${collage._id}`, { method: 'PUT', body: JSON.stringify(apiPayload(withoutRootId(collage))) }).then(normalizeCollage),
  deleteCollage: (id: string) => request(`/collages/${id}`, { method: 'DELETE' }),
  duplicateCollage: (id: string) => request<any>(`/collages/${id}/duplicate`, { method: 'POST' }).then(normalizeCollage),
  exportCollage: (id: string) => request<any>(`/collages/${id}/export`).then((result) => ({ collage: normalizeCollage(result.collage), category: result.category ? normalizeLayoutCategory(result.category) : undefined })),
  importCollage: (payload: unknown) => request<any>('/collages/import', { method: 'POST', body: JSON.stringify(payload) }).then(normalizeCollage),
  listCategories: (accountId: string, merchantId: string) => request<any[]>(`/categories?accountId=${encodeURIComponent(accountId)}&merchantId=${encodeURIComponent(merchantId)}`).then((items) => items.map(normalizeCategory)),
  createCategory: (category: ProductCategory) => request<any>('/categories', { method: 'POST', body: JSON.stringify(apiPayload(withoutRootId(category))) }).then(normalizeCategory),
  updateCategory: (category: ProductCategory) => request<any>(`/categories/${category._id}`, { method: 'PUT', body: JSON.stringify(apiPayload(withoutRootId(category))) }).then(normalizeCategory),
  deleteCategory: (id: string) => request(`/categories/${id}`, { method: 'DELETE' }),
  duplicateCategory: (id: string, includeProducts: boolean) => request<any>(`/categories/${id}/duplicate`, { method: 'POST', body: JSON.stringify({ includeProducts }) }).then((result) => ({ category: normalizeCategory(result.category), products: (result.products ?? []).map(normalizeProduct) })),
  listProducts: (accountId: string, merchantId: string) => request<any[]>(`/products?accountId=${encodeURIComponent(accountId)}&merchantId=${encodeURIComponent(merchantId)}`).then((items) => items.map(normalizeProduct)),
  createProduct: (product: Product) => request<any>('/products', { method: 'POST', body: JSON.stringify(productPayload(product)) }).then(normalizeProduct),
  updateProduct: (product: Product) => request<any>(`/products/${product._id}`, { method: 'PUT', body: JSON.stringify(productPayload(product)) }).then(normalizeProduct),
  deleteProduct: (id: string) => request(`/products/${id}`, { method: 'DELETE' }),
  duplicateProduct: (id: string, scope: string, merchantId: string | null) => request<any>(`/products/${id}/duplicate`, { method: 'POST', body: JSON.stringify({ scope, merchantId }) }).then(normalizeProduct),
  exportProduct: (id: string) => request<any>(`/products/${id}/export`).then(normalizeProduct),
  importProduct: (product: Product) => request<any>('/products/import', { method: 'POST', body: JSON.stringify(productPayload(product)) }).then(normalizeProduct),
};
