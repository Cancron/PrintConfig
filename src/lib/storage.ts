import { normalizeUnit } from './validation';
import type {
  Account,
  BleedSettings,
  EditorRules,
  ExportRules,
  Merchant,
  PriceModifierType,
  Product,
  ProductOptionDisplayType,
  ProductOptionGroup,
  ProductScope,
  ProductSurface,
  ProductUnit,
  ProductVariant,
  SafeAreaSettings,
} from '../types';

const PRODUCTS_KEY = 'print-config-products';
const MERCHANTS_KEY = 'print-config-merchants';
const ACCOUNT_KEY = 'print-config-account';
const SELECTED_MERCHANT_KEY = 'print-config-selected-merchant';

export const CURRENT_ACCOUNT_ID = 'acct-1';

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

export function normalizeProduct(product: Product): Product {
  const legacy = product as Omit<Product, 'variants'> & { variants?: LegacyVariant[]; surface?: ProductSurface | null };
  const legacyMerchantId = product.merchantId ?? defaultMerchants[0].id;
  const scope: ProductScope = product.scope === 'shared' ? 'shared' : 'merchant';
  const firstLegacySurface = legacy.surface ?? legacy.variants?.flatMap((variant) => variant.surfaces ?? [])[0] ?? null;
  const surface = firstLegacySurface ? normalizeSurface(firstLegacySurface, product.id) : null;

  return {
    ...product,
    accountId: product.accountId ?? CURRENT_ACCOUNT_ID,
    scope,
    merchantId: scope === 'shared' ? null : legacyMerchantId,
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
    if (raw) return (JSON.parse(raw) as Product[]).map(normalizeProduct);
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
  const products: Product[] = [
    createSeedProduct({
      id: 'p1', name: 'Canvas Print', slug: 'canvas-print', description: 'Premium gallery-wrapped canvas prints with vibrant colors and archival-quality inks.', productType: 'Canvas Print', status: 'Active', basePrice: 29, thumbnailUrl: 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=400', scope: 'shared', merchantId: null,
      surface: createDefaultSurface('p1', now),
      optionGroups: createCanvasOptionGroups('p1', now),
      variants: [
        ['v1', '8x10 Canvas', 'CANVAS-8X10', 29, 'Active', 8, 10],
        ['v2', '12x16 Canvas', 'CANVAS-12X16', 49, 'Active', 12, 16],
        ['v3', '16x20 Canvas', 'CANVAS-16X20', 69, 'Active', 16, 20],
        ['v4', '24x36 Canvas', 'CANVAS-24X36', 129, 'Active', 24, 36],
      ], now,
    }),
    createSeedProduct({
      id: 'p2', name: 'Poster Print', slug: 'poster-print', description: 'High-quality poster prints on premium photo paper with a satin finish.', productType: 'Poster Print', status: 'Active', basePrice: 19.99, thumbnailUrl: 'https://images.pexels.com/photos/1287145/pexels-photo-1287145.jpeg?auto=compress&cs=tinysrgb&w=400', scope: 'shared', merchantId: null,
      surface: null, optionGroups: [], variants: [['v5', 'Standard Poster', 'PP-STD', 19.99, 'Active', 18, 24], ['v6', 'Large Glossy Poster', 'PP-LG-GL', 34.99, 'Active', 24, 36]], now,
    }),
    createSeedProduct({
      id: 'p-metal', name: 'Metal Print', slug: 'metal-print', description: 'Sleek metal prints with rich color and modern mounting choices.', productType: 'Metal Print', status: 'Active', basePrice: 39, thumbnailUrl: 'https://images.pexels.com/photos/102127/pexels-photo-102127.jpeg?auto=compress&cs=tinysrgb&w=400', scope: 'shared', merchantId: null,
      surface: createDefaultSurface('p-metal', now),
      optionGroups: createMetalOptionGroups('p-metal', now),
      variants: [
        ['v-metal-1', '8x10 Metal Print', 'METAL-8X10', 39, 'Active', 8, 10],
        ['v-metal-2', '12x16 Metal Print', 'METAL-12X16', 69, 'Active', 12, 16],
        ['v-metal-3', '16x20 Metal Print', 'METAL-16X20', 99, 'Active', 16, 20],
        ['v-metal-4', '24x36 Metal Print', 'METAL-24X36', 179, 'Active', 24, 36],
      ], now,
    }),
    createSeedProduct({
      id: 'p3', name: 'T-Shirt', slug: 't-shirt', description: 'Soft, durable cotton t-shirts perfect for custom designs and prints.', productType: 'T-Shirt', status: 'Draft', basePrice: 24.99, thumbnailUrl: 'https://images.pexels.com/photos/991509/pexels-photo-991509.jpeg?auto=compress&cs=tinysrgb&w=400', scope: 'merchant', merchantId: 'm-main-canvas',
      surface: null, optionGroups: [], variants: [['v7', 'Small Black', 'TS-S-BLK', 24.99, 'Draft', 12, 16], ['v8', 'Medium White', 'TS-M-WHT', 24.99, 'Draft', 12, 16]], now,
    }),
    createSeedProduct({
      id: 'p4', name: 'Mug', slug: 'mug', description: 'Custom ceramic mugs for personalized gifts and branded merchandise.', productType: 'Mug', status: 'Active', basePrice: 14.99, thumbnailUrl: 'https://images.pexels.com/photos/1793035/pexels-photo-1793035.jpeg?auto=compress&cs=tinysrgb&w=400', scope: 'merchant', merchantId: 'm-gift-shop',
      surface: null, optionGroups: [], variants: [['v9', 'Standard White', 'MG-STD-WHT', 14.99, 'Active', 8.5, 3.5]], now,
    }),
  ];
  saveProducts(products);
  return products;
}

type SeedProductInput = Omit<Product, 'accountId' | 'editorRules' | 'exportRules' | 'templates' | 'variants' | 'createdAt' | 'updatedAt'> & {
  variants: [string, string, string, number, 'Draft' | 'Active', number, number, ProductUnit?, number?][];
  now: string;
};

function createSeedProduct(input: SeedProductInput): Product {
  return {
    ...input,
    accountId: CURRENT_ACCOUNT_ID,
    editorRules: createDefaultEditorRules(),
    exportRules: createDefaultExportRules(),
    templates: [],
    createdAt: input.now,
    updatedAt: input.now,
    variants: input.variants.map(([id, name, sku, price, status, width, height, unit = 'inch', dpi = 300]) => ({
      id,
      productId: input.id,
      name,
      sku,
      price,
      status,
      options: {},
      width,
      height,
      unit,
      dpi,
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
  return {
    top: numberOr(input?.top, fallback),
    right: numberOr(input?.right, fallback),
    bottom: numberOr(input?.bottom, fallback),
    left: numberOr(input?.left, fallback),
    unit: normalizeUnit(input?.unit),
  };
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
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

function createCanvasOptionGroups(productId: string, now: string): ProductOptionGroup[] {
  return [
    createOptionGroup(productId, now, 1, 'Size', 'size', 'Dropdown', [['8x10', '8x10', 'none', 0], ['12x16', '12x16', 'fixed', 20], ['16x20', '16x20', 'fixed', 40], ['24x36', '24x36', 'fixed', 100]]),
    createOptionGroup(productId, now, 2, 'Thickness', 'thickness', 'Text Buttons', [['0.75 inch', '075-inch', 'none', 0], ['1.5 inch', '15-inch', 'fixed', 15]]),
    createOptionGroup(productId, now, 3, 'Frame Type', 'frame-type', 'Image Swatches', [['No Frame', 'no-frame', 'none', 0], ['Black Floating Frame', 'black-floating-frame', 'fixed', 20, { colorHex: '#111111', description: 'Black floating frame' }, 'https://placehold.co/160x120/111111/ffffff?text=Black+Frame'], ['White Floating Frame', 'white-floating-frame', 'fixed', 20, { colorHex: '#ffffff', description: 'White floating frame' }, 'https://placehold.co/160x120/ffffff/111111?text=White+Frame'], ['Walnut Floating Frame', 'walnut-floating-frame', 'fixed', 35, { colorHex: '#8b5a2b', description: 'Walnut floating frame' }, 'https://placehold.co/160x120/8b5a2b/ffffff?text=Walnut+Frame']]),
    createOptionGroup(productId, now, 4, 'Hanger Type', 'hanger-type', 'Radio Buttons', [['Sawtooth Hanger', 'sawtooth-hanger', 'none', 0], ['Wire Hanger', 'wire-hanger', 'fixed', 5], ['No Hanger', 'no-hanger', 'none', 0]]),
  ];
}

function createMetalOptionGroups(productId: string, now: string): ProductOptionGroup[] {
  return [
    createOptionGroup(productId, now, 1, 'Size', 'size', 'Dropdown', [['8x10', '8x10', 'none', 0], ['12x16', '12x16', 'fixed', 30], ['16x20', '16x20', 'fixed', 60], ['24x36', '24x36', 'fixed', 140]]),
    createOptionGroup(productId, now, 2, 'Metal Type', 'metal-type', 'Text Buttons', [['High Gloss', 'high-gloss', 'fixed', 10], ['Semi Gloss', 'semi-gloss', 'none', 0]]),
    createOptionGroup(productId, now, 3, 'Hanger Type', 'hanger-type', 'Radio Buttons', [['Float Mount', 'float-mount', 'fixed', 20], ['Inset Frame', 'inset-frame', 'fixed', 35], ['Metal Easel', 'metal-easel', 'fixed', 10], ['No Hanger', 'no-hanger', 'none', 0]]),
  ];
}

