import { createDefaultEditorRules, createDefaultExportRules } from './storage';
import { normalizeUnit } from './validation';
import type {
  Product,
  ProductCategory,
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
  'Canvas',
  'Fine Art Paper',
  'Matte Photo Paper',
  'Acrylic Face Mount Prints',
  'Poster Printing and Framing',
  'Luster Photo Paper',
  'Canvas Print',
  'Metal Print',
  'Poster Print',
  'Framed Poster',
  'T-Shirt',
  'Mug',
  'Business Card',
  'Sticker',
];

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

  const product = clearImportedIds(buildImportCandidate(parsed));
  product.accountId = options.accountId;
  product.scope = options.scope;
  product.merchantId = options.scope === 'merchant' ? options.merchantId ?? null : null;
  product.status = 'Draft';
  if (product.categorySnapshot) product.categorySnapshot.accountId = options.accountId;
  return { product };
}

function clearImportedIds(product: Product): Product {
  return {
    ...product,
    _id: '',
    surface: product.surface ? { ...product.surface, _id: '', clientId: crypto.randomUUID(), productId: '' } : null,
    optionGroups: product.optionGroups.map((group) => ({
      ...group,
      _id: '',
      clientId: crypto.randomUUID(),
      productId: '',
      values: group.values.map((value) => ({ ...value, _id: '', clientId: crypto.randomUUID(), optionGroupId: '' })),
    })),
    variants: product.variants.map((variant) => ({ ...variant, _id: '', clientId: crypto.randomUUID(), productId: '' })),
    templates: product.templates.map((template) => ({
      ...template,
      _id: '',
      clientId: crypto.randomUUID(),
      productId: '',
      variantId: '',
      surfaceId: '',
      elements: template.elements.map((element) => ({ ...element, _id: '', clientId: crypto.randomUUID() })),
    })),
  };
}
function buildImportCandidate(input: Record<string, unknown>): Product {
  const now = new Date().toISOString();
  const id = typeof input._id === 'string' ? input._id : '';
  const variants = (input.variants as unknown[]).filter(isRecord);
  const surfaceSource = isRecord(input.surface) ? input.surface : findLegacySurface(variants);
  const surface = surfaceSource ? normalizeSurface(surfaceSource, id, now, 0) : null;

  return {
    _id: id,
    accountId: typeof input.accountId === 'string' ? input.accountId : '',
    scope: input.scope === 'shared' ? 'shared' : 'merchant',
    merchantId: typeof input.merchantId === 'string' ? input.merchantId : '',
    name: input.name as string,
    slug: typeof input.slug === 'string' ? input.slug : createSlug(input.name as string),
    description: typeof input.description === 'string' ? input.description : '',
    productType: input.productType as ProductType,
    status: 'Draft',
    basePrice: typeof input.basePrice === 'number' ? input.basePrice : 0,
    thumbnailUrl: typeof input.thumbnailUrl === 'string' ? input.thumbnailUrl : '',
    categoryId: typeof input.categoryId === 'string' ? input.categoryId : '',
    categorySnapshot: isRecord(input.categorySnapshot) ? normalizeCategorySnapshot(input.categorySnapshot) : undefined,
    surface,
    editorRules: isRecord(input.editorRules) ? { ...createDefaultEditorRules(), ...input.editorRules } : createDefaultEditorRules(),
    exportRules: isRecord(input.exportRules) ? { ...createDefaultExportRules(), ...input.exportRules } : createDefaultExportRules(),
    optionGroups: Array.isArray(input.optionGroups) ? input.optionGroups.filter(isRecord).map((group, index) => normalizeOptionGroup(group, id, now, index)) : [],
    templates: Array.isArray(input.templates) ? input.templates.filter(isRecord).map((template, index) => normalizeTemplate(template, id, surface?._id ?? '', now, index)) : [],
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

function normalizeCategorySnapshot(input: Record<string, unknown>): ProductCategory {
  const now = new Date().toISOString();
  return {
    _id: typeof input._id === 'string' ? input._id : '',
    accountId: typeof input.accountId === 'string' ? input.accountId : '',
    merchantId: typeof input.merchantId === 'string' ? input.merchantId : null,
    scope: input.scope === 'merchant' ? 'merchant' : 'shared',
    name: typeof input.name === 'string' ? input.name : 'Imported Category',
    slug: typeof input.slug === 'string' ? input.slug : 'imported-category',
    description: typeof input.description === 'string' ? input.description : '',
    status: input.status === 'draft' || input.status === 'archived' ? input.status : 'active',
    thumbnailUrl: typeof input.thumbnailUrl === 'string' ? input.thumbnailUrl : '',
    sortOrder: numberOr(input.sortOrder, 0),
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeSurface(input: Record<string, unknown>, productId: string, now: string, index: number): ProductSurface {
  return {
    _id: typeof input._id === 'string' ? input._id : '',
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
  const id = typeof input._id === 'string' ? input._id : '';
  return {
    _id: id,
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
    _id: typeof input._id === 'string' ? input._id : '',
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
  const id = typeof input._id === 'string' ? input._id : '';
  const legacySurface = Array.isArray(input.surfaces) ? input.surfaces.find(isRecord) : null;
  return {
    _id: id,
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
    _id: typeof input._id === 'string' ? input._id : '',
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
    _id: typeof input._id === 'string' ? input._id : '',
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

function createSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'imported-product';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}



