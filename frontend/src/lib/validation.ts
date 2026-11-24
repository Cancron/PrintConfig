import type { LayoutCategory, LayoutElement, LayoutTemplate, MugVariantConfig, PillowVariantConfig, Product, ProductCategory, ProductSurface, ProductType, ProductUnit, ProductVariant, VariantOptionDefinition } from '../types';
import { missingRequiredVariantOptions } from './variantOptions';
import { compatibleRooms, getVariantRoomOrientation } from './roomPreview';

export type ValidationErrors = Record<string, string>;

const PRODUCT_TYPES: ProductType[] = [
  'Canvas Print',
  'Metal Print',
  'Framed Print',
  'Photo Print',
  'Photo Collage Print',
  'Photo Book Print',
  'Pillow Print',
  'Mug Print',
  'AI Art Generation',
  'Art Print',
  'T-Shirt Print',
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
  id?: string | null;
  name: string;
  sku: string;
  price: string | number;
  width: string | number;
  height: string | number;
  unit: string;
  dpi: string | number;
  existingSkus: { id: string; sku: string }[];
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
  } else if (input.existingSkus.some((item) => String(item.id) !== String(input.id ?? '') && item.sku.trim().toLowerCase() === sku)) {
    errors.sku = 'SKU must be unique within this product.';
  }
  if (input.price === '' || Number.isNaN(price) || price < 0) errors.price = 'Price must be zero or greater.';
  if (input.width === '' || Number.isNaN(width) || width <= 0) errors.width = 'Width must be greater than zero.';
  if (input.height === '' || Number.isNaN(height) || height <= 0) errors.height = 'Height must be greater than zero.';
  if (!isProductUnit(input.unit)) errors.unit = 'Unit is required.';
  if (input.dpi === '' || Number.isNaN(dpi) || dpi <= 0) errors.dpi = 'DPI must be greater than zero.';

  return errors;
}

export function validateVariantOptions(options: Record<string, string>, definitions: VariantOptionDefinition[]): ValidationErrors {
  const errors: ValidationErrors = {};
  for (const definition of missingRequiredVariantOptions({ options }, definitions)) {
    errors[`options.${definition.key}`] = `${definition.name} is required.`;
  }
  return errors;
}

export function validatePillowVariant(pillow: PillowVariantConfig | undefined): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!pillow) return { pillow: 'Pillow configuration is required.' };
  if (pillow.shape !== 'square' && pillow.shape !== 'rectangle') errors['pillow.shape'] = 'Select a pillow shape.';
  if (!Number.isFinite(Number(pillow.printArea.width)) || Number(pillow.printArea.width) <= 0) errors['pillow.printArea.width'] = 'Print width must be greater than zero.';
  if (!Number.isFinite(Number(pillow.printArea.height)) || Number(pillow.printArea.height) <= 0) errors['pillow.printArea.height'] = 'Print height must be greater than zero.';
  if (!['inch', 'cm', 'mm'].includes(pillow.printArea.unit)) errors['pillow.printArea.unit'] = 'Select inch, cm, or mm.';

  for (const group of ['bleed', 'safeArea'] as const) {
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const value = pillow.printArea[group][side];
      if (!Number.isFinite(Number(value)) || Number(value) < 0) {
        errors[`pillow.printArea.${group}.${side}`] = `${group === 'bleed' ? 'Bleed' : 'Safe area'} cannot be negative.`;
      }
    }
  }

  for (const side of ['front', 'back'] as const) {
    const mockup = pillow.mockups[side];
    if (!mockup?.imageUrl?.trim()) errors[`pillow.mockups.${side}.imageUrl`] = `${side === 'front' ? 'Front' : 'Back'} mockup image is required.`;
    const area = mockup?.designArea;
    if (!area) {
      errors[`pillow.mockups.${side}.designArea`] = 'Design area is required.';
      continue;
    }
    if (!Number.isFinite(Number(area.x)) || area.x < 0 || area.x > 100) errors[`pillow.mockups.${side}.designArea.x`] = 'X must be between 0 and 100.';
    if (!Number.isFinite(Number(area.y)) || area.y < 0 || area.y > 100) errors[`pillow.mockups.${side}.designArea.y`] = 'Y must be between 0 and 100.';
    if (!Number.isFinite(Number(area.width)) || area.width <= 0 || area.width > 100) errors[`pillow.mockups.${side}.designArea.width`] = 'Width must be greater than 0 and no more than 100.';
    if (!Number.isFinite(Number(area.height)) || area.height <= 0 || area.height > 100) errors[`pillow.mockups.${side}.designArea.height`] = 'Height must be greater than 0 and no more than 100.';
    if (Number(area.x) + Number(area.width) > 100) errors[`pillow.mockups.${side}.designArea.width`] = 'X plus width cannot exceed 100.';
    if (Number(area.y) + Number(area.height) > 100) errors[`pillow.mockups.${side}.designArea.height`] = 'Y plus height cannot exceed 100.';
    if (area.cornerRadius !== undefined && (!Number.isFinite(Number(area.cornerRadius)) || area.cornerRadius < 0 || area.cornerRadius > 50)) {
      errors[`pillow.mockups.${side}.designArea.cornerRadius`] = 'Corner radius must be between 0 and 50.';
    }
  }
  return errors;
}

export function validateMugVariant(mug: MugVariantConfig | undefined): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!mug) return { mug: 'Mug configuration is required.' };
  const printArea = mug.printArea;
  if (!Number.isFinite(Number(printArea?.width)) || Number(printArea.width) <= 0) errors['mug.printArea.width'] = 'Print width must be greater than zero.';
  if (!Number.isFinite(Number(printArea?.height)) || Number(printArea.height) <= 0) errors['mug.printArea.height'] = 'Print height must be greater than zero.';
  if (!['inch', 'cm', 'mm'].includes(printArea?.unit)) errors['mug.printArea.unit'] = 'Select inch, cm, or mm.';

  for (const group of ['bleed', 'safeArea'] as const) {
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const value = printArea?.[group]?.[side];
      if (!Number.isFinite(Number(value)) || Number(value) < 0) {
        errors[`mug.printArea.${group}.${side}`] = `${group === 'bleed' ? 'Bleed' : 'Safe area'} cannot be negative.`;
      }
    }
  }
  if (Number(printArea?.safeArea?.left) > Number(printArea?.width) / 2) errors['mug.printArea.safeArea.left'] = 'Safe area cannot exceed half the print width.';
  if (Number(printArea?.safeArea?.right) > Number(printArea?.width) / 2) errors['mug.printArea.safeArea.right'] = 'Safe area cannot exceed half the print width.';
  if (Number(printArea?.safeArea?.top) > Number(printArea?.height) / 2) errors['mug.printArea.safeArea.top'] = 'Safe area cannot exceed half the print height.';
  if (Number(printArea?.safeArea?.bottom) > Number(printArea?.height) / 2) errors['mug.printArea.safeArea.bottom'] = 'Safe area cannot exceed half the print height.';

  const modelUrl = mug.model?.url?.trim() ?? '';
  if (!modelUrl) errors['mug.model.url'] = 'GLB model URL is required.';
  else {
    try {
      const url = new URL(modelUrl);
      if (!/^https?:$/.test(url.protocol) || !url.pathname.toLowerCase().endsWith('.glb')) errors['mug.model.url'] = 'Use a public HTTP(S) URL ending in .glb.';
    } catch {
      errors['mug.model.url'] = 'Use a valid public GLB URL.';
    }
  }
  if (!mug.model?.printableMaterialName?.trim()) errors['mug.model.printableMaterialName'] = 'Printable material name is required.';
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

export function validateTShirtProduct(product: Product): ValidationErrors {
  const errors: ValidationErrors = {};
  if (product.productType !== 'T-Shirt Print') return errors;
  const settings = product.tshirt;
  if (!settings?.enabled) errors['tshirt.enabled'] = 'Enable the T-shirt editor.';
  if (!settings?.colorOptionKey.trim()) errors['tshirt.colorOptionKey'] = 'Color option key is required.';
  if (!settings?.sizeOptionKey.trim()) errors['tshirt.sizeOptionKey'] = 'Size option key is required.';
  if (!settings?.placements.length) errors['tshirt.placements'] = 'Add at least one print placement.';
  if (settings && !settings.placements.some((placement) => placement.id === settings.defaultPlacementId)) errors['tshirt.defaultPlacementId'] = 'Select a configured default placement.';
  for (const placement of settings?.placements ?? []) {
    if (!placement.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(placement.id)) errors[`tshirt.placement.${placement.id}.id`] = 'Placement ID must be URL-safe.';
    if (!(placement.printArea.width > 0) || !(placement.printArea.height > 0)) errors[`tshirt.placement.${placement.id}.printArea`] = 'Print dimensions must be greater than zero.';
    if (placement.designArea.x < 0 || placement.designArea.y < 0 || placement.designArea.width <= 0 || placement.designArea.height <= 0 || placement.designArea.x + placement.designArea.width > 100 || placement.designArea.y + placement.designArea.height > 100) {
      errors[`tshirt.placement.${placement.id}.designArea`] = 'Placement design area must remain inside the mockup.';
    }
  }
  for (const color of settings?.colors ?? []) {
    for (const placement of settings.placements) {
      if (!color.mockups[placement.id]?.imageUrl.trim()) errors[`tshirt.color.${color.value}.${placement.id}`] = `${color.label || color.value} needs a ${placement.label} mockup.`;
    }
  }
  for (const variant of product.variants) {
    const valueFor = (key: string) => Object.entries(variant.options ?? {}).find(([optionKey]) => optionKey.toLowerCase() === key.toLowerCase())?.[1]?.trim();
    if (!valueFor(settings?.colorOptionKey ?? 'Color') || !valueFor(settings?.sizeOptionKey ?? 'Size')) errors[`tshirt.variant.${variant.id}`] = `${variant.name} needs color and size options.`;
  }
  return errors;
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
  const isPillow = product.productType === 'Pillow Print';
  const isMug = product.productType === 'Mug Print';
  const isTShirt = product.productType === 'T-Shirt Print';
  const usesVariantPrintArea = isPillow || isMug || isTShirt;
  const pillowSettingsValid = !isPillow || (
    product.pillow?.enabled === true
    && product.pillow.defaultLayout === 'full-bleed'
    && product.pillow.sides.includes('front')
    && product.pillow.sides.includes('back')
    && (product.pillow.minimumDesignedSides === 1 || product.pillow.minimumDesignedSides === 2)
  );
  const activePillowVariantsValid = !isPillow
    || activeVariants.every((variant) => Object.keys(validatePillowVariant(variant.pillow)).length === 0);
  const mugSettingsValid = !isMug || (product.mug?.enabled === true && product.mug.defaultLayout === 'blank');
  const activeMugVariantsValid = !isMug
    || activeVariants.every((variant) => Object.keys(validateMugVariant(variant.mug)).length === 0);
  const tshirtSettingsValid = !isTShirt || Object.keys(validateTShirtProduct(product)).length === 0;
  const previewVariant = activeVariants[0] ?? product.variants[0] ?? null;
  const hasSurface = usesVariantPrintArea ? activeVariants.length > 0 && activePillowVariantsValid && activeMugVariantsValid : !!product.surface;
  const surfaceValid = usesVariantPrintArea ? activePillowVariantsValid && activeMugVariantsValid : hasSurface && surfaceHasValidSettings(product.surface, previewVariant);
  const hasExportRules = !!product.exportRules;
  const hasEditorRules = !!product.editorRules;
  const variantsHaveRequiredOptions = product.variants.every((variant) => missingRequiredVariantOptions(variant, product.variantOptionDefinitions).length === 0);
  const hasAnyRoomPreviews = usesVariantPrintArea || product.roomPreviews.length > 0;
  const activeVariantsHaveRoomPreviews = usesVariantPrintArea || (activeVariants.length > 0 && activeVariants.every((variant) => compatibleRooms(product.roomPreviews, variant).length > 0));
  const activeVariantsHaveDefaultRoomPreview = usesVariantPrintArea || (activeVariants.length > 0 && activeVariants.every((variant) => {
    const orientation = getVariantRoomOrientation(variant);
    return compatibleRooms(product.roomPreviews, variant).some((room) => room.defaultOrientations.includes(orientation));
  }));

  if (Object.keys(basicErrors).length > 0) missing.push('Complete valid product name, slug, type, and base price.');
  if (activeVariants.length === 0) missing.push('Add at least one active variant.');
  if (!activeVariantsHaveDimensions) missing.push('Add width, height, unit, and DPI to every active variant.');
  if (!pillowSettingsValid) missing.push('Enable and complete the product-level pillow settings.');
  if (!activePillowVariantsValid) missing.push('Complete print areas and front/back mockups for every active pillow variant.');
  if (!mugSettingsValid) missing.push('Enable and complete the product-level mug settings.');
  if (!activeMugVariantsValid) missing.push('Complete print areas and GLB model settings for every active mug variant.');
  if (!tshirtSettingsValid) missing.push('Complete T-shirt placements, color mockups, and variant Color/Size options.');
  if (!usesVariantPrintArea && !hasSurface) missing.push('Add a product surface configuration.');
  if (!usesVariantPrintArea && hasSurface && !surfaceValid) missing.push('Fix invalid surface bleed, safe area, code, or background color settings.');
  if (!hasExportRules) missing.push('Configure export rules.');
  if (!hasEditorRules) missing.push('Configure editor rules.');
  if (!variantsHaveRequiredOptions) missing.push('Fill every required option value on all variants.');
  if (!usesVariantPrintArea && activeVariants.length > 0 && !activeVariantsHaveRoomPreviews) missing.push('Add a compatible shared room for every active variant orientation.');
  if (!usesVariantPrintArea && activeVariants.length > 0 && !activeVariantsHaveDefaultRoomPreview) missing.push('Choose a default shared room for every active variant orientation.');

  return {
    hasBasicInfo: Object.keys(basicErrors).length === 0,
    hasActiveVariant: activeVariants.length > 0,
    activeVariantsHaveDimensions,
    pillowSettingsValid,
    activePillowVariantsValid,
    mugSettingsValid,
    activeMugVariantsValid,
    tshirtSettingsValid,
    hasSurface,
    surfaceValid,
    hasExportRules,
    hasEditorRules,
    variantsHaveRequiredOptions,
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
  id?: string | null;
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
  } else if (input.existingCategories.some((category) => category.id !== input.id && category.slug.toLowerCase() === slug && category.accountId === category.accountId && category.scope === input.scope && (category.scope === 'shared' || category.merchantId === input.merchantId))) {
    errors.slug = 'Slug must be unique in this category scope.';
  }
  if (input.status !== 'active' && input.status !== 'draft' && input.status !== 'archived') errors.status = 'Status is required.';
  if (input.scope !== 'shared' && input.scope !== 'merchant') errors.scope = 'Scope is required.';
  if (input.scope === 'merchant' && !input.merchantId) errors.scope = 'Select a merchant for merchant custom categories.';
  if (input.sortOrder === '' || Number.isNaN(sortOrder)) errors.sortOrder = 'Sort order must be numeric.';

  return errors;
}

export function validateLayoutCategory(input: {
  id?: string | null;
  name: string;
  slug: string;
  status: string;
  scope: string;
  merchantId?: string | null;
  sortOrder: string | number;
  existingCategories: LayoutCategory[];
}): ValidationErrors {
  const errors: ValidationErrors = {};
  const slug = input.slug.trim().toLowerCase();
  const sortOrder = Number(input.sortOrder);
  if (!input.name.trim()) errors.name = 'Layout category name is required.';
  if (!slug) errors.slug = 'Slug is required.';
  else if (!URL_SAFE_SLUG.test(slug)) errors.slug = 'Use lowercase letters, numbers, and hyphens only.';
  else if (input.existingCategories.some((category) => category.id !== input.id && category.slug.toLowerCase() === slug && category.scope === input.scope && (category.scope === 'shared' || category.merchantId === input.merchantId))) errors.slug = 'Slug must be unique in this layout category scope.';
  if (input.status !== 'active' && input.status !== 'draft' && input.status !== 'archived') errors.status = 'Status is required.';
  if (input.scope !== 'shared' && input.scope !== 'merchant') errors.scope = 'Scope is required.';
  if (input.scope === 'merchant' && !input.merchantId) errors.scope = 'Select a merchant for merchant custom layout categories.';
  if (input.sortOrder === '' || Number.isNaN(sortOrder)) errors.sortOrder = 'Sort order must be numeric.';
  return errors;
}

export function validateLayoutTemplate(template: LayoutTemplate, existingTemplates: LayoutTemplate[] = [], merchantContextId?: string | null): ValidationErrors {
  const errors: ValidationErrors = {};
  const slug = template.slug.trim().toLowerCase();
  const effectiveMerchantId = template.merchantId || merchantContextId || null;
  if (!template.name.trim()) errors.name = 'Layout template name is required.';
  if (!slug) errors.slug = 'Slug is required.';
  else if (!URL_SAFE_SLUG.test(slug)) errors.slug = 'Use lowercase letters, numbers, and hyphens only.';
  else if (existingTemplates.some((item) => item.id !== template.id && item.slug.toLowerCase() === slug && item.scope === template.scope && (item.scope === 'shared' || item.merchantId === effectiveMerchantId))) errors.slug = 'Slug must be unique in this scope.';
  if (template.status !== 'active' && template.status !== 'draft' && template.status !== 'archived') errors.status = 'Status is required.';
  if (template.scope !== 'shared' && template.scope !== 'merchant') errors.scope = 'Scope is required.';
  if (template.scope === 'merchant' && !effectiveMerchantId) errors.scope = 'Select a merchant for merchant custom templates.';
  if (!template.templateType) errors.templateType = 'Template type is required.';
  if (!template.orientation) errors.orientation = 'Orientation is required.';
  if (template.pageCount < 1 || !Number.isFinite(template.pageCount)) errors.pageCount = 'Page count must be at least 1.';
  if (template.canvasWidth <= 0 || !Number.isFinite(template.canvasWidth)) errors.canvasWidth = 'Canvas width must be greater than zero.';
  if (template.canvasHeight <= 0 || !Number.isFinite(template.canvasHeight)) errors.canvasHeight = 'Canvas height must be greater than zero.';
  if (!isProductUnit(template.unit)) errors.unit = 'Unit is required.';
  if (template.dpi <= 0 || !Number.isFinite(template.dpi)) errors.dpi = 'DPI must be greater than zero.';
  if (!Number.isFinite(template.sortOrder)) errors.sortOrder = 'Sort order must be numeric.';
  template.pages.forEach((page, pageIndex) => {
    if (page.width <= 0 || !Number.isFinite(page.width)) errors[`pages.${pageIndex}.width`] = 'Page width must be greater than zero.';
    if (page.height <= 0 || !Number.isFinite(page.height)) errors[`pages.${pageIndex}.height`] = 'Page height must be greater than zero.';
    page.elements.forEach((element, elementIndex) => Object.assign(errors, validateLayoutElement(element, `pages.${pageIndex}.elements.${elementIndex}`)));
  });
  return errors;
}

export function validateLayoutElement(element: LayoutElement, prefix = 'element'): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!element.name.trim()) errors[`${prefix}.name`] = 'Element name is required.';
  for (const field of ['x', 'y'] as const) {
    if (!Number.isFinite(element[field]) || element[field] < 0 || element[field] > 100) errors[`${prefix}.${field}`] = 'Use a value from 0 to 100.';
  }
  for (const field of ['width', 'height'] as const) {
    if (!Number.isFinite(element[field]) || element[field] <= 0 || element[field] > 100) errors[`${prefix}.${field}`] = 'Use a value greater than 0 and no more than 100.';
  }
  return errors;
}
