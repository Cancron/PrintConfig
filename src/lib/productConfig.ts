import { createDefaultEditorRules, createDefaultExportRules } from './storage';
import { normalizeUnit } from './validation';
import type {
  Product,
  ProductOptionDisplayType,
  ProductOptionGroup,
  ProductOptionValue,
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
  'Metal Print',
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
  const surface = source.surface ? cloneSurface(source.surface, productId, now) : null;
  const optionGroups = (source.optionGroups ?? []).map((group) => cloneOptionGroup(group, productId, now));
  const variants = source.variants.map((variant) => cloneVariant(variant, productId, now, variantMap));
  const templates = (source.templates ?? []).map((template) => cloneTemplate(template, productId, now, variantMap, surface?.id ?? ''));
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
    surface,
    editorRules: { ...createDefaultEditorRules(), ...(source.editorRules ?? {}) },
    exportRules: { ...createDefaultExportRules(), ...(source.exportRules ?? {}) },
    optionGroups,
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
  if (typeof parsed.productType !== 'string' || !PRODUCT_TYPES.includes(parsed.productType as ProductType)) return { error: 'Product type is required and must be valid.' };
  if (!Array.isArray(parsed.variants)) return { error: 'Variants are required.' };

  return { product: cloneProductConfiguration(buildImportCandidate(parsed), options) };
}

function cloneSurface(surface: ProductSurface, productId: string, now: string): ProductSurface {
  return {
    ...surface,
    id: createId('s'),
    productId,
    createdAt: now,
    updatedAt: now,
  };
}

function cloneOptionGroup(group: ProductOptionGroup, productId: string, now: string): ProductOptionGroup {
  const groupId = createId('og');
  return {
    ...group,
    id: groupId,
    productId,
    values: group.values.map((value) => ({
      ...value,
      id: createId('ov'),
      optionGroupId: groupId,
      createdAt: now,
      updatedAt: now,
    })),
    createdAt: now,
    updatedAt: now,
  };
}

function cloneVariant(variant: ProductVariant, productId: string, now: string, variantMap: Map<string, string>): ProductVariant {
  const variantId = createId('v');
  variantMap.set(variant.id, variantId);
  return {
    ...variant,
    id: variantId,
    productId,
    status: 'Draft',
    createdAt: now,
    updatedAt: now,
  };
}

function cloneTemplate(template: ProductTemplate, productId: string, now: string, variantMap: Map<string, string>, surfaceId: string): ProductTemplate {
  return {
    ...template,
    id: createId('tpl'),
    productId,
    variantId: variantMap.get(template.variantId) ?? '',
    surfaceId,
    status: 'Draft',
    elements: template.elements.map((element) => ({ ...element, id: createId('el') })),
    createdAt: now,
    updatedAt: now,
  };
}

function buildImportCandidate(input: Record<string, unknown>): Product {
  const now = new Date().toISOString();
  const id = typeof input.id === 'string' ? input.id : createId('import');
  const variants = (input.variants as unknown[]).filter(isRecord);
  const surfaceSource = isRecord(input.surface) ? input.surface : findLegacySurface(variants);
  const surface = surfaceSource ? normalizeSurface(surfaceSource, id, now, 0) : null;

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
    surface,
    editorRules: isRecord(input.editorRules) ? { ...createDefaultEditorRules(), ...input.editorRules } : createDefaultEditorRules(),
    exportRules: isRecord(input.exportRules) ? { ...createDefaultExportRules(), ...input.exportRules } : createDefaultExportRules(),
    optionGroups: Array.isArray(input.optionGroups) ? input.optionGroups.filter(isRecord).map((group, index) => normalizeOptionGroup(group, id, now, index)) : [],
    templates: Array.isArray(input.templates) ? input.templates.filter(isRecord).map((template, index) => normalizeTemplate(template, id, surface?.id ?? '', now, index)) : [],
    variants: variants.map((variant, index) => normalizeVariant(variant, id, now, index)),
    createdAt: now,
    updatedAt: now,
  };
}

function findLegacySurface(variants: Record<string, unknown>[]) {
  for (const variant of variants) {
    if (Array.isArray(variant.surfaces)) {
      const surface = variant.surfaces.find(isRecord);
      if (surface) return surface;
    }
  }
  return null;
}

function normalizeSurface(input: Record<string, unknown>, productId: string, now: string, index: number): ProductSurface {
  return {
    id: typeof input.id === 'string' ? input.id : `import-s-${index}`,
    productId,
    name: typeof input.name === 'string' ? input.name : `Surface ${index + 1}`,
    code: typeof input.code === 'string' ? input.code : 'front',
    backgroundColor: typeof input.backgroundColor === 'string' ? input.backgroundColor : '#ffffff',
    allowTransparency: input.allowTransparency === true,
    bleed: normalizeBox(input.bleed, 0),
    safeArea: normalizeBox(input.safeArea, 0),
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeOptionGroup(input: Record<string, unknown>, productId: string, now: string, index: number): ProductOptionGroup {
  const id = typeof input.id === 'string' ? input.id : `import-og-${index}`;
  return {
    id,
    productId,
    name: typeof input.name === 'string' ? input.name : `Option Group ${index + 1}`,
    code: typeof input.code === 'string' ? input.code : `option-group-${index + 1}`,
    displayType: normalizeDisplayType(input.displayType),
    required: input.required !== false,
    sortOrder: numberOr(input.sortOrder, index + 1),
    values: Array.isArray(input.values) ? input.values.filter(isRecord).map((value, valueIndex) => normalizeOptionValue(value, id, now, valueIndex)) : [],
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeOptionValue(input: Record<string, unknown>, optionGroupId: string, now: string, index: number): ProductOptionValue {
  const priceModifierType = input.priceModifierType === 'fixed' || input.priceModifierType === 'percentage' ? input.priceModifierType : 'none';
  return {
    id: typeof input.id === 'string' ? input.id : `import-ov-${index}`,
    optionGroupId,
    label: typeof input.label === 'string' ? input.label : `Option ${index + 1}`,
    value: typeof input.value === 'string' ? input.value : `option-${index + 1}`,
    skuCode: typeof input.skuCode === 'string' ? input.skuCode : '',
    priceModifierType,
    priceModifier: priceModifierType === 'none' ? 0 : numberOr(input.priceModifier, 0),
    isDefault: input.isDefault === true,
    isActive: input.isActive !== false,
    sortOrder: numberOr(input.sortOrder, index + 1),
    previewImageUrl: typeof input.previewImageUrl === 'string' ? input.previewImageUrl : '',
    thumbnailImageUrl: typeof input.thumbnailImageUrl === 'string' ? input.thumbnailImageUrl : '',
    metadata: isRecord(input.metadata) ? {
      colorHex: typeof input.metadata.colorHex === 'string' ? input.metadata.colorHex : undefined,
      description: typeof input.metadata.description === 'string' ? input.metadata.description : undefined,
      productionCode: typeof input.metadata.productionCode === 'string' ? input.metadata.productionCode : undefined,
      exportNotes: typeof input.metadata.exportNotes === 'string' ? input.metadata.exportNotes : undefined,
    } : {},
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeDisplayType(value: unknown): ProductOptionDisplayType {
  return value === 'Radio Buttons' || value === 'Color Swatches' || value === 'Image Swatches' || value === 'Text Buttons' ? value : 'Dropdown';
}

function normalizeVariant(input: Record<string, unknown>, productId: string, now: string, index: number): ProductVariant {
  const id = typeof input.id === 'string' ? input.id : `import-v-${index}`;
  const legacySurface = Array.isArray(input.surfaces) ? input.surfaces.find(isRecord) : null;
  return {
    id,
    productId,
    name: typeof input.name === 'string' ? input.name : `Variant ${index + 1}`,
    sku: typeof input.sku === 'string' ? input.sku : `SKU-${index + 1}`,
    price: typeof input.price === 'number' ? input.price : 0,
    status: normalizeStatus(input.status),
    options: isRecord(input.options) ? stringRecord(input.options) : {},
    width: numberOr(input.width, isRecord(legacySurface) ? numberOr(legacySurface.width, 1) : 1),
    height: numberOr(input.height, isRecord(legacySurface) ? numberOr(legacySurface.height, 1) : 1),
    unit: normalizeUnit(input.unit ?? (isRecord(legacySurface) ? legacySurface.unit : undefined)),
    dpi: numberOr(input.dpi, isRecord(legacySurface) ? numberOr(legacySurface.dpi, 300) : 300),
    previewImageUrl: typeof input.previewImageUrl === 'string' ? input.previewImageUrl : '',
    thumbnailImageUrl: typeof input.thumbnailImageUrl === 'string' ? input.thumbnailImageUrl : '',
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeTemplate(input: Record<string, unknown>, productId: string, surfaceId: string, now: string, index: number): ProductTemplate {
  return {
    id: typeof input.id === 'string' ? input.id : `import-tpl-${index}`,
    productId,
    name: typeof input.name === 'string' ? input.name : `Template ${index + 1}`,
    status: normalizeStatus(input.status),
    variantId: typeof input.variantId === 'string' ? input.variantId : '',
    surfaceId: surfaceId || (typeof input.surfaceId === 'string' ? input.surfaceId : ''),
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

function normalizeBox(input: unknown, fallback: number): ProductSurface['bleed'] {
  if (!isRecord(input)) return { top: fallback, right: fallback, bottom: fallback, left: fallback, unit: 'inch' };
  return {
    top: numberOr(input.top, fallback),
    right: numberOr(input.right, fallback),
    bottom: numberOr(input.bottom, fallback),
    left: numberOr(input.left, fallback),
    unit: normalizeUnit(input.unit),
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
