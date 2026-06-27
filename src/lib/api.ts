/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ImageAsset, ImageFolder, Merchant, Product, ProductCategory } from '../types';

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

function normalizeSurface(raw: any) {
  return raw ? { ...raw, _id: idOf(raw), productId: String(raw.productId ?? '') } : null;
}

function normalizeOptionGroups(groups: any[] = []) {
  return groups.map((group) => ({
    ...group,
    _id: idOf(group),
    productId: String(group.productId ?? ''),
    values: (group.values ?? []).map((value: any) => ({ ...value, _id: idOf(value), optionGroupId: String(value.optionGroupId ?? group._id ?? group._id ?? '') })),
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
  return {
    ...raw,
    _id: idOf(raw),
    accountId: String(raw.accountId ?? 'acct-1'),
    merchantId: raw.merchantId ? String(raw.merchantId) : null,
    categoryId: String(raw.categoryId ?? ''),
    categorySnapshot: raw.categorySnapshot ? normalizeCategory(raw.categorySnapshot) : undefined,
    status: raw.status === 'active' || raw.status === 'Active' ? 'Active' : 'Draft',
    surface: normalizeSurface(raw.surface),
    optionGroups: normalizeOptionGroups(raw.optionGroups),
    variants: (raw.variants ?? []).map((variant: any) => ({ ...variant, _id: idOf(variant), productId: String(variant.productId ?? ''), status: variant.status === 'active' || variant.status === 'Active' ? 'Active' : 'Draft', options: variant.options ?? {}, roomPreviews: (variant.roomPreviews ?? []).map((room: any) => ({ ...room, _id: idOf(room), variantId: String(room.variantId ?? variant._id ?? '') })) })),
    editorRules: raw.editorRules ?? {},
    exportRules: raw.exportRules ?? {},
    templates: normalizeTemplates(raw.templates),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

function apiPayload<T>(value: T): T {
  if (Array.isArray(value)) return value.map(apiPayload) as T;
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === 'clientId' || key === 'id' || (key === '_id' && !child)) continue;
      if (!child && ['productId', 'optionGroupId', 'variantId', 'surfaceId'].includes(key)) continue;
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
  updateMerchant: (merchant: Merchant) => request<any>(`/merchants/${merchant._id}`, { method: 'PUT', body: JSON.stringify(apiPayload(withoutRootId(merchant))) }).then(normalizeMerchant),
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


