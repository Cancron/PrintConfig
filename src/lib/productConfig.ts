import { createDefaultEditorRules, createDefaultExportRules } from './storage';
import type {
  Product,
  ProductScope,
  ProductStatus,
  ProductSurface,
  ProductTemplate,
  ProductType,
  ProductVariant,
  TemplateElement,
} from '../types';

const PRODUCT_TYPES: ProductType[] = [
  'Canvas Print',
  'Poster Print',
  'Framed Poster',
  'T-Shirt',
  'Mug',
  'Business Card',
  'Sticker',
];

export function cloneProductConfiguration(source: Product, options: { addCopySuffix?: boolean; accountId?: string; scope?: ProductScope; merchantId?: string | null } = {}): Product {
  const now = new Date().toISOString();
  const productId = createId('p');
  const variantMap = new Map<string, string>();
  const surfaceMap = new Map<string, string>();

  const variants = source.variants.map((variant) => cloneVariant(variant, productId, now, variantMap, surfaceMap));
  const templates = (source.templates ?? []).map((template) => cloneTemplate(template, productId, now, variantMap, surfaceMap));
  const name = options.addCopySuffix ? `${source.name} Copy` : source.name;
  const scope = options.scope ?? source.scope ?? 'merchant';

  return {
    ...source,
    id: productId,
    name,
    slug: createSlug(name),
    accountId: options.accountId ?? source.accountId,
    scope,
    merchantId: scope === 'shared' ? null : options.merchantId ?? source.merchantId ?? null,
    status: 'Draft',
    editorRules: { ...createDefaultEditorRules(), ...(source.editorRules ?? {}) },
    exportRules: { ...createDefaultExportRules(), ...(source.exportRules ?? {}) },
    templates,
    variants,
    createdAt: now,
    updatedAt: now,
  };
}

export function parseImportedProduct(json: string, options: { accountId: string; scope: ProductScope; merchantId?: string | null }): { product?: Product; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { error: 'JSON is not valid.' };
  }

  if (!isRecord(parsed)) return { error: 'JSON must describe a product object.' };
  if (typeof parsed.name !== 'string' || !parsed.name.trim()) return { error: 'Product name is required.' };
  if (typeof parsed.productType !== 'string' || !PRODUCT_TYPES.includes(parsed.productType as ProductType)) {
    return { error: 'Product type is required and must be valid.' };
  }
  if (!Array.isArray(parsed.variants)) return { error: 'Variants are required.' };

  return { product: cloneProductConfiguration(buildImportCandidate(parsed), options) };
}

function cloneVariant(
  variant: ProductVariant,
  productId: string,
  now: string,
  variantMap: Map<string, string>,
  surfaceMap: Map<string, string>
): ProductVariant {
  const variantId = createId('v');
  variantMap.set(variant.id, variantId);

  return {
    ...variant,
    id: variantId,
    productId,
    status: 'Draft',
    surfaces: variant.surfaces.map((surface) => {
      const surfaceId = createId('s');
      surfaceMap.set(surface.id, surfaceId);
      return { ...surface, id: surfaceId, variantId, createdAt: now, updatedAt: now };
    }),
    createdAt: now,
    updatedAt: now,
  };
}

function cloneTemplate(
  template: ProductTemplate,
  productId: string,
  now: string,
  variantMap: Map<string, string>,
  surfaceMap: Map<string, string>
): ProductTemplate {
  return {
    ...template,
    id: createId('tpl'),
    productId,
    variantId: variantMap.get(template.variantId) ?? '',
    surfaceId: surfaceMap.get(template.surfaceId) ?? '',
    status: 'Draft',
    elements: template.elements.map((element) => ({ ...element, id: createId('el') })),
    createdAt: now,
    updatedAt: now,
  };
}

function buildImportCandidate(input: Record<string, unknown>): Product {
  const now = new Date().toISOString();
  const id = typeof input.id === 'string' ? input.id : createId('import');

  return {
    id,
    accountId: typeof input.accountId === 'string' ? input.accountId : 'acct-1',
    scope: input.scope === 'shared' ? 'shared' : 'merchant',
    merchantId: typeof input.merchantId === 'string' ? input.merchantId : 'm1',
    name: input.name as string,
    slug: typeof input.slug === 'string' ? input.slug : createSlug(input.name as string),
    description: typeof input.description === 'string' ? input.description : '',
    productType: input.productType as ProductType,
    status: 'Draft',
    basePrice: typeof input.basePrice === 'number' ? input.basePrice : 0,
    thumbnailUrl: typeof input.thumbnailUrl === 'string' ? input.thumbnailUrl : '',
    editorRules: isRecord(input.editorRules) ? { ...createDefaultEditorRules(), ...input.editorRules } : createDefaultEditorRules(),
    exportRules: isRecord(input.exportRules) ? { ...createDefaultExportRules(), ...input.exportRules } : createDefaultExportRules(),
    templates: Array.isArray(input.templates) ? input.templates.filter(isRecord).map((template, index) => normalizeTemplate(template, id, now, index)) : [],
    variants: (input.variants as unknown[]).filter(isRecord).map((variant, index) => normalizeVariant(variant, id, now, index)),
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeVariant(input: Record<string, unknown>, productId: string, now: string, index: number): ProductVariant {
  const id = typeof input.id === 'string' ? input.id : `import-v-${index}`;
  return {
    id,
    productId,
    name: typeof input.name === 'string' ? input.name : `Variant ${index + 1}`,
    sku: typeof input.sku === 'string' ? input.sku : `SKU-${index + 1}`,
    price: typeof input.price === 'number' ? input.price : 0,
    status: normalizeStatus(input.status),
    options: isRecord(input.options) ? stringRecord(input.options) : {},
    surfaces: Array.isArray(input.surfaces) ? input.surfaces.filter(isRecord).map((surface, surfaceIndex) => normalizeSurface(surface, id, now, surfaceIndex)) : [],
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeSurface(input: Record<string, unknown>, variantId: string, now: string, index: number): ProductSurface {
  return {
    id: typeof input.id === 'string' ? input.id : `import-s-${index}`,
    variantId,
    name: typeof input.name === 'string' ? input.name : `Surface ${index + 1}`,
    code: typeof input.code === 'string' ? input.code : `surface-${index + 1}`,
    width: numberOr(input.width, 1),
    height: numberOr(input.height, 1),
    unit: input.unit === 'mm' || input.unit === 'px' ? input.unit : 'in',
    dpi: numberOr(input.dpi, 300),
    bleed: normalizeBox(input.bleed),
    safeArea: normalizeBox(input.safeArea),
    backgroundColor: typeof input.backgroundColor === 'string' ? input.backgroundColor : '#ffffff',
    allowTransparency: input.allowTransparency === true,
    sortOrder: numberOr(input.sortOrder, index),
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeTemplate(input: Record<string, unknown>, productId: string, now: string, index: number): ProductTemplate {
  return {
    id: typeof input.id === 'string' ? input.id : `import-tpl-${index}`,
    productId,
    name: typeof input.name === 'string' ? input.name : `Template ${index + 1}`,
    status: normalizeStatus(input.status),
    variantId: typeof input.variantId === 'string' ? input.variantId : '',
    surfaceId: typeof input.surfaceId === 'string' ? input.surfaceId : '',
    thumbnailUrl: typeof input.thumbnailUrl === 'string' ? input.thumbnailUrl : '',
    elements: Array.isArray(input.elements) ? input.elements.filter(isRecord).map(normalizeElement) : [],
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeElement(input: Record<string, unknown>, index: number): TemplateElement {
  return {
    id: typeof input.id === 'string' ? input.id : `import-el-${index}`,
    name: typeof input.name === 'string' ? input.name : `Placeholder ${index + 1}`,
    type: input.type === 'text' ? 'text' : 'photo',
    x: numberOr(input.x, 0),
    y: numberOr(input.y, 0),
    width: numberOr(input.width, 10),
    height: numberOr(input.height, 10),
    required: input.required !== false,
    locked: input.locked === true,
    editable: input.editable !== false,
  };
}

function normalizeBox(input: unknown): ProductSurface['bleed'] {
  if (!isRecord(input)) return { top: 0, right: 0, bottom: 0, left: 0, unit: 'in' as const };
  return {
    top: numberOr(input.top, 0),
    right: numberOr(input.right, 0),
    bottom: numberOr(input.bottom, 0),
    left: numberOr(input.left, 0),
    unit: input.unit === 'mm' || input.unit === 'px' ? input.unit : 'in',
  };
}

function normalizeStatus(value: unknown): ProductStatus {
  return value === 'Active' ? 'Active' : 'Draft';
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringRecord(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, String(value)]));
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'imported-product';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}




