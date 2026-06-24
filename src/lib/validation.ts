import type { Product, ProductSurface, ProductType } from '../types';

export type ValidationErrors = Record<string, string>;

const PRODUCT_TYPES: ProductType[] = [
  'Canvas Print',
  'Poster Print',
  'Framed Poster',
  'T-Shirt',
  'Mug',
  'Business Card',
  'Sticker',
];

const URL_SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateProductBasicInfo(input: {
  name: string;
  slug: string;
  productType: string;
  basePrice: string | number;
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

  return errors;
}

export function validateVariant(input: {
  id?: string | null;
  name: string;
  sku: string;
  price: string | number;
  existingSkus: { id: string; sku: string }[];
}): ValidationErrors {
  const errors: ValidationErrors = {};
  const price = Number(input.price);
  const sku = input.sku.trim().toLowerCase();

  if (!input.name.trim()) errors.name = 'Variant name is required.';
  if (!input.sku.trim()) {
    errors.sku = 'SKU is required.';
  } else if (
    input.existingSkus.some((item) => item.id !== input.id && item.sku.trim().toLowerCase() === sku)
  ) {
    errors.sku = 'SKU must be unique within this product.';
  }
  if (input.price === '' || Number.isNaN(price) || price < 0) {
    errors.price = 'Price must be zero or greater.';
  }

  return errors;
}

export function validateSurface(surface: ProductSurface): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!surface.name.trim()) errors.name = 'Surface name is required.';
  if (!surface.code.trim()) errors.code = 'Surface code is required.';
  if (!surface.unit) errors.unit = 'Unit is required.';
  if (!Number.isFinite(surface.width) || surface.width <= 0) {
    errors.width = 'Width must be greater than zero.';
  }
  if (!Number.isFinite(surface.height) || surface.height <= 0) {
    errors.height = 'Height must be greater than zero.';
  }
  if (!Number.isFinite(surface.dpi) || surface.dpi <= 0) {
    errors.dpi = 'DPI must be greater than zero.';
  }

  const bleedEntries = Object.entries(surface.bleed) as [keyof ProductSurface['bleed'], number | string][];
  for (const [key, value] of bleedEntries) {
    if (key !== 'unit' && Number(value) < 0) {
      errors[`bleed.${key}`] = 'Bleed cannot be negative.';
    }
  }

  const safeEntries = Object.entries(surface.safeArea) as [keyof ProductSurface['safeArea'], number | string][];
  for (const [key, value] of safeEntries) {
    if (key !== 'unit' && Number(value) < 0) {
      errors[`safeArea.${key}`] = 'Safe area cannot be negative.';
    }
  }

  if (surface.width > 0) {
    const maxHorizontal = surface.width / 2;
    if (surface.safeArea.left > maxHorizontal) {
      errors['safeArea.left'] = 'Safe area cannot exceed half the width.';
    }
    if (surface.safeArea.right > maxHorizontal) {
      errors['safeArea.right'] = 'Safe area cannot exceed half the width.';
    }
  }

  if (surface.height > 0) {
    const maxVertical = surface.height / 2;
    if (surface.safeArea.top > maxVertical) {
      errors['safeArea.top'] = 'Safe area cannot exceed half the height.';
    }
    if (surface.safeArea.bottom > maxVertical) {
      errors['safeArea.bottom'] = 'Safe area cannot exceed half the height.';
    }
  }

  return errors;
}

export function surfaceHasValidDimensions(surface: ProductSurface) {
  return Object.keys(validateSurface(surface)).length === 0;
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
  const activeVariantsHaveSurfaces = activeVariants.every((variant) => variant.surfaces.length > 0);
  const allSurfacesValid = product.variants.every((variant) =>
    variant.surfaces.every(surfaceHasValidDimensions)
  );

  if (Object.keys(basicErrors).length > 0) missing.push('Complete valid product name, slug, type, and base price.');
  if (activeVariants.length === 0) missing.push('Add at least one active variant.');
  if (!activeVariantsHaveSurfaces) missing.push('Add at least one surface to every active variant.');
  if (!allSurfacesValid) missing.push('Fix invalid surface dimensions, DPI, bleed, or safe area values.');

  return {
    hasBasicInfo: Object.keys(basicErrors).length === 0,
    hasActiveVariant: activeVariants.length > 0,
    activeVariantsHaveSurfaces,
    allSurfacesValid,
    ready: missing.length === 0,
    missing,
  };
}

export function toPixels(value: number, unit: ProductSurface['unit'], dpi: number) {
  if (unit === 'px') return value;
  if (unit === 'mm') return (value / 25.4) * dpi;
  return value * dpi;
}
