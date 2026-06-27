import type { Product, ProductCategory, ProductSurface, ProductType, ProductUnit, ProductVariant } from '../types';

export type ValidationErrors = Record<string, string>;

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

const URL_SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function validateProductBasicInfo(input: {
  name: string;
  slug: string;
  productType: string;
  basePrice: string | number;
  categoryId?: string;
}): ValidationErrors {
  const errors: ValidationErrors = {};
  const price = Number(input.basePrice);

  if (!input.name.trim()) errors.name = 'Product name is required.';
  if (!input.slug.trim()) {
    errors.slug = 'Slug is required.';
  } else if (!URL_SAFE_SLUG.test(input.slug.trim())) {
    errors.slug = 'Use lowercase letters, numbers, and hyphens only.';
  }
  if (!PRODUCT_TYPES.includes(input.productType as ProductType)) {
    errors.productType = 'Product type is required.';
  }
  if (input.basePrice === '' || Number.isNaN(price) || price < 0) {
    errors.basePrice = 'Base price must be zero or greater.';
  }
  if (input.categoryId !== undefined && !input.categoryId) errors.categoryId = 'Category is required.';

  return errors;
}

export function validateVariant(input: {
  _id?: string | null;
  name: string;
  sku: string;
  price: string | number;
  width: string | number;
  height: string | number;
  unit: string;
  dpi: string | number;
  existingSkus: { _id: string; sku: string }[];
}): ValidationErrors {
  const errors: ValidationErrors = {};
  const price = Number(input.price);
  const width = Number(input.width);
  const height = Number(input.height);
  const dpi = Number(input.dpi);
  const sku = input.sku.trim().toLowerCase();

  if (!input.name.trim()) errors.name = 'Variant name is required.';
  if (!input.sku.trim()) {
    errors.sku = 'SKU is required.';
  } else if (input.existingSkus.some((item) => String(item._id) !== String(input._id ?? '') && item.sku.trim().toLowerCase() === sku)) {
    errors.sku = 'SKU must be unique within this product.';
  }
  if (input.price === '' || Number.isNaN(price) || price < 0) errors.price = 'Price must be zero or greater.';
  if (input.width === '' || Number.isNaN(width) || width <= 0) errors.width = 'Width must be greater than zero.';
  if (input.height === '' || Number.isNaN(height) || height <= 0) errors.height = 'Height must be greater than zero.';
  if (!isProductUnit(input.unit)) errors.unit = 'Unit is required.';
  if (input.dpi === '' || Number.isNaN(dpi) || dpi <= 0) errors.dpi = 'DPI must be greater than zero.';

  return errors;
}

export function validateSurface(surface: ProductSurface, previewVariant?: Pick<ProductVariant, 'width' | 'height'> | null): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!surface.name.trim()) errors.name = 'Surface name is required.';
  if (!surface.code.trim()) {
    errors.code = 'Surface code is required.';
  } else if (!URL_SAFE_SLUG.test(surface.code.trim())) {
    errors.code = 'Use lowercase letters, numbers, and hyphens only.';
  }
  if (!HEX_COLOR.test(surface.backgroundColor)) errors.backgroundColor = 'Use a valid hex color, like #ffffff.';

  const bleedEntries = Object.entries(surface.bleed) as [keyof ProductSurface['bleed'], number | string][];
  for (const [key, value] of bleedEntries) {
    if (key === 'unit') continue;
    if (!Number.isFinite(Number(value)) || Number(value) < 0) errors[`bleed.${key}`] = 'Bleed cannot be negative.';
  }

  const safeEntries = Object.entries(surface.safeArea) as [keyof ProductSurface['safeArea'], number | string][];
  for (const [key, value] of safeEntries) {
    if (key === 'unit') continue;
    if (!Number.isFinite(Number(value)) || Number(value) < 0) errors[`safeArea.${key}`] = 'Safe area cannot be negative.';
  }

  if (previewVariant?.width && previewVariant.width > 0) {
    const maxHorizontal = previewVariant.width / 2;
    if (surface.safeArea.left > maxHorizontal) errors['safeArea.left'] = 'Safe area cannot exceed half the selected variant width.';
    if (surface.safeArea.right > maxHorizontal) errors['safeArea.right'] = 'Safe area cannot exceed half the selected variant width.';
  }

  if (previewVariant?.height && previewVariant.height > 0) {
    const maxVertical = previewVariant.height / 2;
    if (surface.safeArea.top > maxVertical) errors['safeArea.top'] = 'Safe area cannot exceed half the selected variant height.';
    if (surface.safeArea.bottom > maxVertical) errors['safeArea.bottom'] = 'Safe area cannot exceed half the selected variant height.';
  }

  return errors;
}

export function surfaceHasValidSettings(surface: ProductSurface | null, previewVariant?: Pick<ProductVariant, 'width' | 'height'> | null) {
  return !!surface && Object.keys(validateSurface(surface, previewVariant)).length === 0;
}

export function variantHasValidDimensions(variant: ProductVariant) {
  return variant.width > 0 && variant.height > 0 && isProductUnit(variant.unit) && variant.dpi > 0;
}

export function getProductReadiness(product: Product) {
  const missing: string[] = [];
  const basicErrors = validateProductBasicInfo({
    name: product.name,
    slug: product.slug,
    productType: product.productType,
    basePrice: product.basePrice,
  });
  const activeVariants = product.variants.filter((variant) => variant.status === 'Active');
  const activeVariantsHaveDimensions = activeVariants.every(variantHasValidDimensions);
  const previewVariant = activeVariants[0] ?? product.variants[0] ?? null;
  const hasSurface = !!product.surface;
  const surfaceValid = hasSurface && surfaceHasValidSettings(product.surface, previewVariant);
  const hasExportRules = !!product.exportRules;
  const hasEditorRules = !!product.editorRules;
  const hasAnyRoomPreviews = product.variants.some((variant) => variant.roomPreviews.length > 0);
  const activeVariantsHaveRoomPreviews = activeVariants.length > 0 && activeVariants.every((variant) => variant.roomPreviews.length > 0);
  const activeVariantsHaveDefaultRoomPreview = activeVariants.length > 0 && activeVariants.every((variant) => variant.roomPreviews.some((room) => room.isDefault));

  if (Object.keys(basicErrors).length > 0) missing.push('Complete valid product name, slug, type, and base price.');
  if (activeVariants.length === 0) missing.push('Add at least one active variant.');
  if (!activeVariantsHaveDimensions) missing.push('Add width, height, unit, and DPI to every active variant.');
  if (!hasSurface) missing.push('Add a product surface configuration.');
  if (hasSurface && !surfaceValid) missing.push('Fix invalid surface bleed, safe area, code, or background color settings.');
  if (!hasExportRules) missing.push('Configure export rules.');
  if (!hasEditorRules) missing.push('Configure editor rules.');

  return {
    hasBasicInfo: Object.keys(basicErrors).length === 0,
    hasActiveVariant: activeVariants.length > 0,
    activeVariantsHaveDimensions,
    hasSurface,
    surfaceValid,
    hasExportRules,
    hasEditorRules,
    hasAnyRoomPreviews,
    activeVariantsHaveRoomPreviews,
    activeVariantsHaveDefaultRoomPreview,
    ready: missing.length === 0,
    missing,
  };
}

export function toPixels(value: number, unit: ProductUnit, dpi: number) {
  if (unit === 'px') return value;
  if (unit === 'mm') return (value / 25.4) * dpi;
  return value * dpi;
}

export function isProductUnit(value: string): value is ProductUnit {
  return value === 'inch' || value === 'mm' || value === 'px';
}

export function normalizeUnit(value: unknown): ProductUnit {
  if (value === 'in' || value === 'inch') return 'inch';
  if (value === 'mm' || value === 'px') return value;
  return 'inch';
}

export function validateCategory(input: {
  _id?: string | null;
  name: string;
  slug: string;
  status: string;
  scope: string;
  merchantId?: string | null;
  sortOrder: string | number;
  existingCategories: ProductCategory[];
}): ValidationErrors {
  const errors: ValidationErrors = {};
  const slug = input.slug.trim().toLowerCase();
  const sortOrder = Number(input.sortOrder);

  if (!input.name.trim()) errors.name = 'Category name is required.';
  if (!slug) {
    errors.slug = 'Slug is required.';
  } else if (!URL_SAFE_SLUG.test(slug)) {
    errors.slug = 'Use lowercase letters, numbers, and hyphens only.';
  } else if (input.existingCategories.some((category) => category._id !== input._id && category.slug.toLowerCase() === slug && category.accountId === category.accountId && category.scope === input.scope && (category.scope === 'shared' || category.merchantId === input.merchantId))) {
    errors.slug = 'Slug must be unique in this category scope.';
  }
  if (input.status !== 'active' && input.status !== 'draft' && input.status !== 'archived') errors.status = 'Status is required.';
  if (input.scope !== 'shared' && input.scope !== 'merchant') errors.scope = 'Scope is required.';
  if (input.scope === 'merchant' && !input.merchantId) errors.scope = 'Select a merchant for merchant custom categories.';
  if (input.sortOrder === '' || Number.isNaN(sortOrder)) errors.sortOrder = 'Sort order must be numeric.';

  return errors;
}
