import { normalizeUnit } from './validation';
import { normalizeVariantOptionDefinitions } from './variantOptions';
import { liftLegacyRoomPreviews, normalizeSharedRoomPreview } from './roomPreview';
import { normalizeFrontendContent } from './frontendContent';
import type {
  Account,
  BleedSettings,
  EditorRules,
  ExportRules,
  Merchant,
  Product,
  ProductCategory,
  ProductCategoryStatus,
  ProductScope,
  ProductSurface,
  ProductUnit,
  ProductVariant,
  SafeAreaSettings,
} from '../types';

const PRODUCTS_KEY = 'print-config-products';
const CATEGORIES_KEY = 'print-config-categories';
const MERCHANTS_KEY = 'print-config-merchants';
const ACCOUNT_KEY = 'print-config-account';
const SELECTED_MERCHANT_KEY = 'print-config-selected-merchant';

export const CURRENT_ACCOUNT_ID = '6a3ec80a97741e7afc64d62b';

export const defaultAccount: Account = { _id: CURRENT_ACCOUNT_ID, name: 'Koda North Account' };

export const defaultMerchants: Merchant[] = [];

export const defaultEditorRules: EditorRules = {
  allowImageUpload: true,
  allowAddText: true,
  allowClipart: false,
  allowBackgroundColor: true,
  allowBackgroundImage: false,
  allowCrop: true,
  allowRotate: true,
  allowDeleteObjects: true,
  allowLayersPanel: true,
  maxImageCount: 10,
  maxTextCount: 20,
  minimumDpiWarning: 150,
  minimumDpiBlock: 72,
  requirePlaceholdersFilled: true,
};

export function createDefaultEditorRules(): EditorRules {
  return { ...defaultEditorRules };
}

export const defaultExportRules: ExportRules = {
  format: 'PDF',
  dpi: 300,
  includeBleed: true,
  flattenOutput: true,
  transparentBackground: false,
  backgroundColor: '#ffffff',
  filenameTemplate: '{orderId}_{sku}_{surface}',
  colorMode: 'RGB',
};

export function createDefaultExportRules(): ExportRules {
  return { ...defaultExportRules };
}

export function loadAccount(): Account {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (raw) return { ...defaultAccount, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  saveAccount(defaultAccount);
  return defaultAccount;
}

export function saveAccount(account: Account) {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
}

export function loadMerchants(): Merchant[] {
  try {
    const raw = localStorage.getItem(MERCHANTS_KEY);
    if (raw) return (JSON.parse(raw) as Merchant[]).map(normalizeMerchant);
  } catch {
    // ignore
  }
  saveMerchants(defaultMerchants);
  return defaultMerchants;
}

export function saveMerchants(merchants: Merchant[]) {
  localStorage.setItem(MERCHANTS_KEY, JSON.stringify(merchants.map(normalizeMerchant)));
}

export function updateMerchant(updated: Merchant) {
  const merchants = loadMerchants().map((merchant) => (merchant._id === updated._id ? normalizeMerchant(updated) : merchant));
  saveMerchants(merchants);
  return merchants;
}

export function loadSelectedMerchantId() {
  return localStorage.getItem(SELECTED_MERCHANT_KEY) ?? '6a3ec8c62d9f5c0bcff11d7f';
}

export function saveSelectedMerchantId(merchantId: string) {
  localStorage.setItem(SELECTED_MERCHANT_KEY, merchantId);
}

export function getProducts(accountId: string, selectedMerchantId: string) {
  return loadProducts().filter((product) => product.accountId === accountId && (product.scope === 'shared' || product.merchantId === selectedMerchantId));
}

export function getCategories(accountId: string, selectedMerchantId: string) {
  return loadCategories().filter((category) => category.accountId === accountId && (category.scope === 'shared' || category.merchantId === selectedMerchantId));
}

export function loadCategories(): ProductCategory[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (raw) {
      const categories = (JSON.parse(raw) as ProductCategory[]).map(normalizeCategory);
      return categories;
    }
  } catch {
    // ignore
  }
  saveCategories([]);
  return [];
}

export function saveCategories(categories: ProductCategory[]) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories.map(normalizeCategory)));
}

export function normalizeCategory(category: ProductCategory): ProductCategory {
  const scope: ProductScope = category.scope === 'shared' ? 'shared' : 'merchant';
  return {
    ...category,
    accountId: category.accountId ?? CURRENT_ACCOUNT_ID,
    merchantId: scope === 'shared' ? null : category.merchantId ?? null,
    scope,
    name: category.name ?? 'Untitled Category',
    slug: category.slug ?? createSlug(category.name ?? 'category'),
    description: category.description ?? '',
    status: normalizeCategoryStatus(category.status),
    thumbnailUrl: category.thumbnailUrl ?? '',
    sortOrder: numberOr(category.sortOrder, 0),
  };
}

export function normalizeProduct(product: Product): Product {
  const legacy = product as Omit<Product, 'variants'> & { variants?: LegacyVariant[]; surface?: ProductSurface | null; categoryId?: string };
  const legacyMerchantId = product.merchantId ?? null;
  const scope: ProductScope = product.scope === 'shared' ? 'shared' : 'merchant';
  const firstLegacySurface = legacy.surface ?? legacy.variants?.flatMap((variant) => variant.surfaces ?? [])[0] ?? null;
  const surface = firstLegacySurface ? normalizeSurface(firstLegacySurface, product._id) : null;
  const variants = (legacy.variants ?? []).map((variant) => normalizeVariant(variant, product._id));
  const sharedRooms = (product.roomPreviews ?? []).map((room, index) => normalizeSharedRoomPreview(room, product._id, index));

  return {
    ...product,
    accountId: product.accountId ?? CURRENT_ACCOUNT_ID,
    scope,
    merchantId: scope === 'shared' ? null : legacyMerchantId,
    categoryId: legacy.categoryId ?? '',
    categorySnapshot: product.categorySnapshot,
    surface,
    optionGroups: product.optionGroups ?? [],
    variantOptionDefinitions: normalizeVariantOptionDefinitions(product.variantOptionDefinitions, product._id),
    frontendContent: normalizeFrontendContent(product.frontendContent),
    editorRules: { ...defaultEditorRules, ...(product.editorRules ?? {}) },
    exportRules: { ...defaultExportRules, ...(product.exportRules ?? {}) },
    templates: (product.templates ?? []).map((template) => ({ ...template, surfaceId: surface?._id ?? template.surfaceId ?? '' })),
    roomPreviews: liftLegacyRoomPreviews({ ...product, variants, roomPreviews: sharedRooms }),
    variants: variants.map((variant) => ({ ...variant, roomPreviews: undefined })),
  };
}

export function loadProducts(): Product[] {
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    if (raw) return (JSON.parse(raw) as Product[]).map(normalizeProduct);
  } catch {
    // ignore
  }
  return [];
}

export function saveProducts(products: Product[]) {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products.map(normalizeProduct)));
}

function normalizeMerchant(merchant: Merchant): Merchant {
  return {
    ...merchant,
    accountId: merchant.accountId ?? CURRENT_ACCOUNT_ID,
    logoUrl: merchant.logoUrl ?? '',
    status: merchant.status === 'Draft' ? 'Draft' : 'Active',
    editorPrimaryColor: merchant.editorPrimaryColor ?? '#111827',
    editorSecondaryColor: merchant.editorSecondaryColor ?? '#f3f4f6',
    editorAccentColor: merchant.editorAccentColor ?? '#2563eb',
    customCss: merchant.customCss ?? '',
    customJavascript: merchant.customJavascript ?? '',
  };
}

type LegacyVariant = Partial<ProductVariant> & { surfaces?: LegacySurface[]; unit?: ProductUnit | 'in' };
type LegacySurface = Partial<ProductSurface> & { variantId?: string; width?: number; height?: number; unit?: ProductUnit | 'in'; dpi?: number; sortOrder?: number };

function normalizeSurface(surface: LegacySurface, productId: string): ProductSurface {
  const now = new Date().toISOString();
  return {
    _id: typeof surface._id === 'string' ? surface._id : '',
    clientId: surface.clientId ?? crypto.randomUUID(),
    productId,
    name: typeof surface.name === 'string' && surface.name.trim() ? surface.name : 'Front Print Area',
    code: typeof surface.code === 'string' && surface.code.trim() ? surface.code : 'front',
    backgroundColor: typeof surface.backgroundColor === 'string' ? surface.backgroundColor : '#ffffff',
    allowTransparency: surface.allowTransparency === true,
    bleed: normalizeBox(surface.bleed, 0.125),
    safeArea: normalizeBox(surface.safeArea, 0.25),
    createdAt: typeof surface.createdAt === 'string' ? surface.createdAt : now,
    updatedAt: typeof surface.updatedAt === 'string' ? surface.updatedAt : now,
  };
}

function normalizeVariant(variant: LegacyVariant, productId: string): ProductVariant {
  const now = new Date().toISOString();
  const legacySurface = variant.surfaces?.[0];
  return {
    _id: typeof variant._id === 'string' ? variant._id : '',
    clientId: variant.clientId ?? crypto.randomUUID(),
    productId,
    name: typeof variant.name === 'string' ? variant.name : 'Variant',
    sku: typeof variant.sku === 'string' ? variant.sku : 'SKU',
    price: numberOr(variant.price, 0),
    status: variant.status === 'Active' ? 'Active' : 'Draft',
    options: variant.options ?? {},
    width: numberOr(variant.width, numberOr(legacySurface?.width, 8)),
    height: numberOr(variant.height, numberOr(legacySurface?.height, 10)),
    unit: normalizeUnit(variant.unit ?? legacySurface?.unit),
    dpi: numberOr(variant.dpi, numberOr(legacySurface?.dpi, 300)),
    previewImageUrl: typeof variant.previewImageUrl === 'string' ? variant.previewImageUrl : '',
    previewImageAssetId: variant.previewImageAssetId,
    thumbnailImageUrl: typeof variant.thumbnailImageUrl === 'string' ? variant.thumbnailImageUrl : '',
    thumbnailImageAssetId: variant.thumbnailImageAssetId,
    roomPreviews: variant.roomPreviews ?? [],
    createdAt: typeof variant.createdAt === 'string' ? variant.createdAt : now,
    updatedAt: typeof variant.updatedAt === 'string' ? variant.updatedAt : now,
  };
}

function normalizeBox(input: BleedSettings | SafeAreaSettings | undefined, fallback: number): BleedSettings {
  return { top: numberOr(input?.top, fallback), right: numberOr(input?.right, fallback), bottom: numberOr(input?.bottom, fallback), left: numberOr(input?.left, fallback), unit: normalizeUnit(input?.unit) };
}

function normalizeCategoryStatus(status: ProductCategoryStatus) {
  return status === 'draft' || status === 'archived' ? status : 'active';
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function createSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category';
}
