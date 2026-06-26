import { normalizeUnit } from './validation';
import type {
  Account,
  BleedSettings,
  EditorRules,
  ExportRules,
  Merchant,
  PriceModifierType,
  Product,
  ProductCategory,
  ProductCategoryStatus,
  ProductOptionDisplayType,
  ProductOptionGroup,
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

export const CURRENT_ACCOUNT_ID = 'acct-1';
export const CANVAS_CATEGORY_ID = 'cat-canvas-print';

export const defaultAccount: Account = { id: CURRENT_ACCOUNT_ID, name: 'Koda North Account' };

export const defaultMerchants: Merchant[] = [
  { id: 'm-main-canvas', accountId: CURRENT_ACCOUNT_ID, name: 'Main Canvas Store', slug: 'main-canvas-store', logoUrl: '', status: 'Active', editorPrimaryColor: '#111827', editorSecondaryColor: '#f3f4f6', editorAccentColor: '#2563eb', customCss: '', customJavascript: '' },
  { id: 'm-gift-shop', accountId: CURRENT_ACCOUNT_ID, name: 'Gift Shop Site', slug: 'gift-shop-site', logoUrl: '', status: 'Active', editorPrimaryColor: '#14532d', editorSecondaryColor: '#ecfdf5', editorAccentColor: '#f59e0b', customCss: '', customJavascript: '' },
  { id: 'm-poster-brand', accountId: CURRENT_ACCOUNT_ID, name: 'Poster Brand Site', slug: 'poster-brand-site', logoUrl: '', status: 'Draft', editorPrimaryColor: '#581c87', editorSecondaryColor: '#faf5ff', editorAccentColor: '#db2777', customCss: '', customJavascript: '' },
];

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
  const merchants = loadMerchants().map((merchant) => (merchant.id === updated.id ? normalizeMerchant(updated) : merchant));
  saveMerchants(merchants);
  return merchants;
}

export function loadSelectedMerchantId() {
  return localStorage.getItem(SELECTED_MERCHANT_KEY) ?? defaultMerchants[0].id;
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
      if (!categories.some((category) => category.id === CANVAS_CATEGORY_ID)) {
        const seeded = [...categories, createCanvasCategory(new Date().toISOString())];
        saveCategories(seeded);
        return seeded;
      }
      return categories;
    }
  } catch {
    // ignore
  }
  const categories = [createCanvasCategory(new Date().toISOString())];
  saveCategories(categories);
  return categories;
}

export function saveCategories(categories: ProductCategory[]) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories.map(normalizeCategory)));
}

export function normalizeCategory(category: ProductCategory): ProductCategory {
  const scope: ProductScope = category.scope === 'shared' ? 'shared' : 'merchant';
  return {
    ...category,
    accountId: category.accountId ?? CURRENT_ACCOUNT_ID,
    merchantId: scope === 'shared' ? null : category.merchantId ?? defaultMerchants[0].id,
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
  const legacyMerchantId = product.merchantId ?? defaultMerchants[0].id;
  const scope: ProductScope = product.scope === 'shared' ? 'shared' : 'merchant';
  const firstLegacySurface = legacy.surface ?? legacy.variants?.flatMap((variant) => variant.surfaces ?? [])[0] ?? null;
  const surface = firstLegacySurface ? normalizeSurface(firstLegacySurface, product.id) : null;

  return {
    ...product,
    accountId: product.accountId ?? CURRENT_ACCOUNT_ID,
    scope,
    merchantId: scope === 'shared' ? null : legacyMerchantId,
    categoryId: legacy.categoryId ?? CANVAS_CATEGORY_ID,
    categorySnapshot: product.categorySnapshot,
    surface,
    optionGroups: product.optionGroups ?? [],
    editorRules: { ...defaultEditorRules, ...(product.editorRules ?? {}) },
    exportRules: { ...defaultExportRules, ...(product.exportRules ?? {}) },
    templates: (product.templates ?? []).map((template) => ({ ...template, surfaceId: surface?.id ?? template.surfaceId ?? '' })),
    variants: (legacy.variants ?? []).map((variant) => normalizeVariant(variant, product.id)),
  };
}

export function loadProducts(): Product[] {
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    if (raw) {
      const products = (JSON.parse(raw) as Product[]).map(normalizeProduct);
      const hasCanvasProducts = products.some((product) => product.categoryId === CANVAS_CATEGORY_ID && product.name === 'Canvas');
      if (!hasCanvasProducts) {
        const seeded = [...products, ...seedCanvasProducts(new Date().toISOString())];
        saveProducts(seeded);
        return seeded;
      }
      return products;
    }
  } catch {
    // ignore
  }
  return seedProducts();
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

function seedProducts(): Product[] {
  const now = new Date().toISOString();
  const products = seedCanvasProducts(now);
  saveProducts(products);
  return products;
}

function createCanvasCategory(now: string): ProductCategory {
  return {
    id: CANVAS_CATEGORY_ID,
    accountId: CURRENT_ACCOUNT_ID,
    merchantId: null,
    scope: 'shared',
    name: 'Canvas Print',
    slug: 'canvas-print',
    description: 'Print products including canvas, photo papers, acrylic face mount prints, poster printing, framing, and luster paper.',
    status: 'active',
    thumbnailUrl: 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=400',
    sortOrder: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function seedCanvasProducts(now: string): Product[] {
  return [
    createSeedProduct({ id: 'p-canvas', categoryId: CANVAS_CATEGORY_ID, name: 'Canvas', slug: 'canvas', description: 'Gallery-wrapped canvas prints with framing and hanger options.', productType: 'Canvas', status: 'Active', basePrice: 29, thumbnailUrl: 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=400', scope: 'shared', merchantId: null, surface: createDefaultSurface('p-canvas', now), optionGroups: canvasOptions('p-canvas', now), now }),
    createSeedProduct({ id: 'p-fine-art-paper', categoryId: CANVAS_CATEGORY_ID, name: 'Fine Art Paper', slug: 'fine-art-paper', description: 'Museum-quality fine art paper prints with optional borders.', productType: 'Fine Art Paper', status: 'Active', basePrice: 24, thumbnailUrl: '', scope: 'shared', merchantId: null, surface: createDefaultSurface('p-fine-art-paper', now), optionGroups: fineArtOptions('p-fine-art-paper', now), now }),
    createSeedProduct({ id: 'p-matte-photo-paper', categoryId: CANVAS_CATEGORY_ID, name: 'Matte Photo Paper', slug: 'matte-photo-paper', description: 'Smooth matte photo paper prints for glare-free display.', productType: 'Matte Photo Paper', status: 'Active', basePrice: 19, thumbnailUrl: '', scope: 'shared', merchantId: null, surface: createDefaultSurface('p-matte-photo-paper', now), optionGroups: mattePhotoOptions('p-matte-photo-paper', now), now }),
    createSeedProduct({ id: 'p-acrylic-face-mount', categoryId: CANVAS_CATEGORY_ID, name: 'Acrylic Face Mount Prints', slug: 'acrylic-face-mount-prints', description: 'Premium acrylic face mount prints with mounting choices.', productType: 'Acrylic Face Mount Prints', status: 'Active', basePrice: 79, thumbnailUrl: '', scope: 'shared', merchantId: null, surface: createDefaultSurface('p-acrylic-face-mount', now), optionGroups: acrylicOptions('p-acrylic-face-mount', now), now }),
    createSeedProduct({ id: 'p-poster-framing', categoryId: CANVAS_CATEGORY_ID, name: 'Poster Printing and Framing', slug: 'poster-printing-and-framing', description: 'Poster printing with optional frame and hanger selections.', productType: 'Poster Printing and Framing', status: 'Active', basePrice: 22, thumbnailUrl: '', scope: 'shared', merchantId: null, surface: createDefaultSurface('p-poster-framing', now), optionGroups: posterFramingOptions('p-poster-framing', now), now }),
    createSeedProduct({ id: 'p-luster-photo-paper', categoryId: CANVAS_CATEGORY_ID, name: 'Luster Photo Paper', slug: 'luster-photo-paper', description: 'Luster finish photo paper prints with optional borders.', productType: 'Luster Photo Paper', status: 'Active', basePrice: 21, thumbnailUrl: '', scope: 'shared', merchantId: null, surface: createDefaultSurface('p-luster-photo-paper', now), optionGroups: lusterOptions('p-luster-photo-paper', now), now }),
  ];
}

type SeedProductInput = Omit<Product, 'accountId' | 'editorRules' | 'exportRules' | 'templates' | 'variants' | 'createdAt' | 'updatedAt'> & { now: string };

function createSeedProduct(input: SeedProductInput): Product {
  const variantPrefix = input.slug.toUpperCase().replace(/-/g, '-');
  return {
    ...input,
    accountId: CURRENT_ACCOUNT_ID,
    categorySnapshot: createCanvasCategory(input.now),
    editorRules: createDefaultEditorRules(),
    exportRules: createDefaultExportRules(),
    templates: [],
    createdAt: input.now,
    updatedAt: input.now,
    variants: [
      ['8x10', 8, 10, 29],
      ['12x16', 12, 16, 49],
      ['16x20', 16, 20, 69],
      ['24x36', 24, 36, 129],
    ].map(([label, width, height, price], index) => ({
      id: `v-${input.id}-${index + 1}`,
      productId: input.id,
      name: `${label} ${input.name}`,
      sku: `${variantPrefix}-${String(label).toUpperCase()}`,
      price: typeof price === 'number' ? price : input.basePrice,
      status: 'Active',
      options: { size: String(label) },
      width: Number(width),
      height: Number(height),
      unit: 'inch',
      dpi: 300,
      previewImageUrl: '',
      thumbnailImageUrl: '',
      createdAt: input.now,
      updatedAt: input.now,
    })),
  };
}

function createDefaultSurface(productId: string, now: string): ProductSurface {
  return {
    id: `s-${productId}-front`,
    productId,
    name: 'Front Print Area',
    code: 'front',
    backgroundColor: '#ffffff',
    allowTransparency: false,
    bleed: createBox(0.125, 'inch'),
    safeArea: createBox(0.25, 'inch'),
    createdAt: now,
    updatedAt: now,
  };
}

function createBox(value: number, unit: ProductUnit): BleedSettings {
  return { top: value, right: value, bottom: value, left: value, unit };
}

type LegacyVariant = Partial<ProductVariant> & { surfaces?: LegacySurface[]; unit?: ProductUnit | 'in' };
type LegacySurface = Partial<ProductSurface> & { variantId?: string; width?: number; height?: number; unit?: ProductUnit | 'in'; dpi?: number; sortOrder?: number };

function normalizeSurface(surface: LegacySurface, productId: string): ProductSurface {
  const now = new Date().toISOString();
  return {
    id: typeof surface.id === 'string' ? surface.id : `s-${productId}-front`,
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
    id: typeof variant.id === 'string' ? variant.id : `v-${Date.now()}`,
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
    thumbnailImageUrl: typeof variant.thumbnailImageUrl === 'string' ? variant.thumbnailImageUrl : '',
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

type OptionSeed = [string, string, PriceModifierType, number, Partial<ProductOptionGroup['values'][number]['metadata']>?, string?];

function createOptionGroup(productId: string, now: string, sortOrder: number, name: string, code: string, displayType: ProductOptionDisplayType, values: OptionSeed[]): ProductOptionGroup {
  const groupId = `og-${productId}-${code}`;
  return {
    id: groupId,
    productId,
    name,
    code,
    displayType,
    required: true,
    sortOrder,
    values: values.map(([label, value, priceModifierType, priceModifier, metadata = {}, previewImageUrl = ''], index) => ({
      id: `ov-${productId}-${code}-${value}`,
      optionGroupId: groupId,
      label,
      value,
      skuCode: value.toUpperCase().replace(/-/g, '_'),
      priceModifierType,
      priceModifier,
      isDefault: index === 0,
      isActive: true,
      sortOrder: index + 1,
      previewImageUrl,
      thumbnailImageUrl: previewImageUrl,
      metadata,
      createdAt: now,
      updatedAt: now,
    })),
    createdAt: now,
    updatedAt: now,
  };
}

function canvasOptions(productId: string, now: string) {
  return [
    createOptionGroup(productId, now, 1, 'Thickness', 'thickness', 'Text Buttons', [['0.75 inch', '075-inch', 'none', 0], ['1.5 inch', '15-inch', 'fixed', 15]]),
    createOptionGroup(productId, now, 2, 'Frame Type', 'frame-type', 'Image Swatches', [['No Frame', 'no-frame', 'none', 0], ['Black Floating Frame', 'black-floating-frame', 'fixed', 20, { colorHex: '#111111' }, 'https://placehold.co/160x120/111111/ffffff?text=Black+Frame'], ['White Floating Frame', 'white-floating-frame', 'fixed', 20, { colorHex: '#ffffff' }, 'https://placehold.co/160x120/ffffff/111111?text=White+Frame'], ['Walnut Floating Frame', 'walnut-floating-frame', 'fixed', 35, { colorHex: '#8b5a2b' }, 'https://placehold.co/160x120/8b5a2b/ffffff?text=Walnut+Frame']]),
    createOptionGroup(productId, now, 3, 'Hanger Type', 'hanger-type', 'Radio Buttons', [['Sawtooth Hanger', 'sawtooth-hanger', 'none', 0], ['Wire Hanger', 'wire-hanger', 'fixed', 5], ['No Hanger', 'no-hanger', 'none', 0]]),
  ];
}

function fineArtOptions(productId: string, now: string) {
  return [createOptionGroup(productId, now, 1, 'Paper Type', 'paper-type', 'Dropdown', [['Smooth Fine Art', 'smooth-fine-art', 'none', 0], ['Textured Fine Art', 'textured-fine-art', 'fixed', 8]]), borderOptions(productId, now, 2)];
}

function mattePhotoOptions(productId: string, now: string) {
  return [createOptionGroup(productId, now, 1, 'Finish', 'finish', 'Text Buttons', [['Matte', 'matte', 'none', 0]]), borderOptions(productId, now, 2)];
}

function acrylicOptions(productId: string, now: string) {
  return [createOptionGroup(productId, now, 1, 'Acrylic Thickness', 'acrylic-thickness', 'Text Buttons', [['1/8 inch', 'one-eighth-inch', 'none', 0], ['1/4 inch', 'one-quarter-inch', 'fixed', 25]]), createOptionGroup(productId, now, 2, 'Mounting', 'mounting', 'Radio Buttons', [['Float Mount', 'float-mount', 'fixed', 20], ['French Cleat', 'french-cleat', 'fixed', 25], ['No Mount', 'no-mount', 'none', 0]])];
}

function posterFramingOptions(productId: string, now: string) {
  return [createOptionGroup(productId, now, 1, 'Paper Type', 'paper-type', 'Dropdown', [['Standard Poster', 'standard-poster', 'none', 0], ['Premium Poster', 'premium-poster', 'fixed', 6]]), createOptionGroup(productId, now, 2, 'Frame Type', 'frame-type', 'Image Swatches', [['No Frame', 'no-frame', 'none', 0], ['Black Frame', 'black-frame', 'fixed', 20], ['White Frame', 'white-frame', 'fixed', 20], ['Natural Wood Frame', 'natural-wood-frame', 'fixed', 30]]), createOptionGroup(productId, now, 3, 'Hanger Type', 'hanger-type', 'Radio Buttons', [['Standard Hanger', 'standard-hanger', 'none', 0], ['No Hanger', 'no-hanger', 'none', 0]])];
}

function lusterOptions(productId: string, now: string) {
  return [createOptionGroup(productId, now, 1, 'Finish', 'finish', 'Text Buttons', [['Luster', 'luster', 'none', 0]]), borderOptions(productId, now, 2)];
}

function borderOptions(productId: string, now: string, sortOrder: number) {
  return createOptionGroup(productId, now, sortOrder, 'Border', 'border', 'Radio Buttons', [['No Border', 'no-border', 'none', 0], ['1 inch Border', '1-inch-border', 'fixed', 3], ['2 inch Border', '2-inch-border', 'fixed', 5]]);
}
