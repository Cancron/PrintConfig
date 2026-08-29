/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import { ZipArchive, type ArchiverError } from 'archiver';
import { Types } from 'mongoose';
import { ProductModel } from '../models/Product.js';
import { ProductCategoryModel } from '../models/ProductCategory.js';
import { LayoutTemplateModel } from '../models/LayoutTemplate.js';
import { CollageModel } from '../models/Collage.js';
import { MerchantModel } from '../models/Merchant.js';
import { DesignCartItemModel } from '../models/DesignCartItem.js';
import { DesignProcessingJobModel } from '../models/DesignProcessingJob.js';
import { DesignProjectModel } from '../models/DesignProject.js';
import { ApiError } from '../middleware/errorHandler.js';
import { applyModifier, getVariantConfiguredPrice } from '../utils/pricing.js';
import { slugify } from '../utils/slug.js';
import { getVariantRoomOrientation, liftLegacyProductRooms, ROOM_ORIENTATIONS } from '../utils/roomPreview.js';
import { normalizeFrontendContentPayload, publicFrontendContent } from '../utils/frontendContent.js';
import { renderDesignPageToImageBuffer } from '../utils/designRenderer.js';
import { visibleQuery } from './category.service.js';
import { resolveAccountId } from './account.service.js';
import { authenticateApiPrivateKey } from './merchant.service.js';
import { signDownloadToken, verifyDownloadToken } from './auth.service.js';
import { galleryBucket } from '../config/supabase.js';
import {
  copyObject,
  deleteObjects,
  downloadObject,
  listLegacySupabaseObjects,
  listObjects,
  r2Bucket,
  r2PublicUrl,
  uploadObject,
  type StorageProvider,
} from '../config/storage.js';

export type DependencyCondition = 'equals' | 'not_equals' | 'in' | 'not_in';

export interface DependencyRule {
  dependsOnGroupCode: string;
  condition: DependencyCondition;
  allowedValues: string[];
}

function evaluateDependencyRule(
  rule: DependencyRule,
  selectedValues: Record<string, string>
): boolean {
  const selectedValue = selectedValues[rule.dependsOnGroupCode];

  // If the parent group has no selection, the dependency is not satisfied
  if (selectedValue === undefined || selectedValue === '') {
    return false;
  }

  switch (rule.condition) {
    case 'equals':
      return selectedValue === rule.allowedValues[0];
    case 'not_equals':
      return selectedValue !== rule.allowedValues[0];
    case 'in':
      return rule.allowedValues.includes(selectedValue);
    case 'not_in':
      return !rule.allowedValues.includes(selectedValue);
    default:
      return false;
  }
}

export function evaluateOptionGroupVisibility(
  groups: Array<{ code: string; dependencyRules?: DependencyRule[] }>,
  selectedValues: Record<string, string>
): Record<string, boolean> {
  const result: Record<string, boolean> = {};

  for (const group of groups) {
    // If no dependency rules, group is always visible
    if (!group.dependencyRules || group.dependencyRules.length === 0) {
      result[group.code] = true;
      continue;
    }

    // All rules must pass (AND logic)
    const isVisible = group.dependencyRules.every((rule) =>
      evaluateDependencyRule(rule, selectedValues)
    );
    result[group.code] = isVisible;
  }

  return result;
}

function detectCircularDependencies(
  groups: Array<{ code: string; dependencyRules?: DependencyRule[] }>
): string[] {
  const issues: string[] = [];
  const groupCodes = new Set(groups.map((g) => g.code));

  for (const group of groups) {
    if (!group.dependencyRules) continue;

    for (const rule of group.dependencyRules) {
      // Check if referenced group exists
      if (!groupCodes.has(rule.dependsOnGroupCode)) {
        issues.push(
          `Group "${group.code}" depends on non-existent group "${rule.dependsOnGroupCode}"`
        );
        continue;
      }

      // Check for circular dependency
      const visited = new Set<string>();
      const stack = [group.code];

      while (stack.length > 0) {
        const current = stack.pop()!;
        if (current === rule.dependsOnGroupCode) {
          // We've traced back to a group that depends on us - circular!
          // But we need to find the actual cycle, not just A depends on B
          // Actually, a single dependency rule means group A depends on group B's value
          // This is NOT circular - it's a valid dependency chain
          // Circular would be: A depends on B, B depends on A
          // Let's check if the target group depends on us
          const targetGroup = groups.find((g) => g.code === rule.dependsOnGroupCode);
          if (targetGroup?.dependencyRules?.some((r) => r.dependsOnGroupCode === group.code)) {
            issues.push(
              `Circular dependency detected: "${group.code}" and "${rule.dependsOnGroupCode}" depend on each other`
            );
          }
          continue;
        }

        if (visited.has(current)) continue;
        visited.add(current);

        const currentGroup = groups.find((g) => g.code === current);
        if (currentGroup?.dependencyRules) {
          for (const r of currentGroup.dependencyRules) {
            stack.push(r.dependsOnGroupCode);
          }
        }
      }
    }
  }

  return issues;
}

function normalizeScope(data: Record<string, unknown>) {
  if (data.scope === 'shared') data.merchantId = null;
  if (data.scope === 'merchant' && !data.merchantId) throw new ApiError(400, 'merchantId is required for merchant scoped products.');
}

async function normalizeRefs(data: Record<string, unknown>) {
  data.accountId = resolveAccountId(String(data.accountId ?? ''));
  if (data.scope === 'shared') data.merchantId = null;
  if (data.merchantId && !Types.ObjectId.isValid(String(data.merchantId))) throw new ApiError(400, 'merchantId must be a valid MongoDB ObjectId.');
  if (!data.categoryId || !Types.ObjectId.isValid(String(data.categoryId))) throw new ApiError(400, 'Product must have a valid categoryId.');
}

function normalizeEditorProductSelection(data: Record<string, any>) {
  const selection = data.editorProductSelection ?? {};
  data.editorProductSelection = {
    mode: selection.mode === 'same-category' || selection.mode === 'specific' ? selection.mode : 'single',
    specificProductIds: Array.isArray(selection.specificProductIds) ? selection.specificProductIds : [],
  };
}

async function validateEditorProductSelection(data: Record<string, any>, productId?: string) {
  const ids = data.editorProductSelection.specificProductIds.map(String);
  if (new Set(ids).size !== ids.length) throw new ApiError(400, 'Specific product selections must be unique.');
  if (ids.some((id: string) => !Types.ObjectId.isValid(id))) throw new ApiError(400, 'Specific product selections must contain valid Product ObjectIds.');
  if (productId && ids.includes(productId)) throw new ApiError(400, 'A product cannot select itself.');
  let existingIds = new Set<string>();
  if (productId) {
    const current = await ProductModel.findById(productId).select('editorProductSelection.specificProductIds').lean();
    existingIds = new Set((current?.editorProductSelection?.specificProductIds ?? []).map(String));
  }
  const addedIds = ids.filter((id: string) => !existingIds.has(id));
  if (addedIds.length === 0) return;
  const visibility: Record<string, unknown>[] = [{ scope: 'shared' }];
  if (data.scope === 'merchant' && data.merchantId) visibility.push({ scope: 'merchant', merchantId: data.merchantId });
  else visibility.push({ scope: 'merchant' });
  const count = await ProductModel.countDocuments({ _id: { $in: addedIds }, accountId: data.accountId, status: 'active', $or: visibility });
  if (count !== addedIds.length) throw new ApiError(400, 'New specific product selections must be active and visible within this account.');
}
function normalizeFrontendContent(data: Record<string, any>) {
  data.frontendContent = normalizeFrontendContentPayload(data.frontendContent);
}
function normalizeLayoutSettings(data: Record<string, any>) {
  const input = data.layoutSettings ?? {};
  const legacyCategoryIds = Array.isArray(input.allowedTemplateCategoryIds) ? input.allowedTemplateCategoryIds : [];
  const mode = input.mode === 'all' || input.mode === 'specific' || input.mode === 'by-tags' ? input.mode : input.enabled === true ? (input.allowedTemplateIds?.length ? 'specific' : legacyCategoryIds.length ? 'by-tags' : 'all') : 'none';
  data.layoutSettings = {
    enabled: mode !== 'none' && input.enabled !== false,
    mode: input.enabled === false ? 'none' : mode,
    allowedTemplateIds: Array.isArray(input.allowedTemplateIds) ? input.allowedTemplateIds.map(String).filter(Boolean) : [],
    allowedTemplateTags: Array.isArray(input.allowedTemplateTags) ? input.allowedTemplateTags.map((tag: unknown) => String(tag).trim()).filter(Boolean) : [],
    requireTemplateSelection: input.requireTemplateSelection === true,
  };
}

function normalizePhotoBookSettings(data: Record<string, any>) {
  const input = data.photoBook ?? {};
  const isPhotoBook = data.productType === 'Photo Book Print';
  data.photoBook = {
    enabled: isPhotoBook,
    maxPages: numberOr(input.maxPages, 120),
    defaultPages: numberOr(input.defaultPages, 20),
    maxPhotoCount: numberOr(input.maxPhotoCount, 300),
    pricePerExtraPage: numberOr(input.pricePerExtraPage, 1.5),
    pagesPerSpread: numberOr(input.pagesPerSpread, 2),
    allowPageReorder: input.allowPageReorder !== false,
    allowBlankPages: input.allowBlankPages === true,
    coverType: ['softcover', 'hardcover', 'layflat', 'custom'].includes(input.coverType) ? input.coverType : 'hardcover',
    bindingType: ['perfect', 'saddle_stitch', 'spiral', 'layflat'].includes(input.bindingType) ? input.bindingType : 'layflat',
    paperType: typeof input.paperType === 'string' && input.paperType.trim() ? input.paperType.trim() : 'lustre',
    startsWithCover: input.startsWithCover !== false,
    hasBackCover: input.hasBackCover !== false,
  };
}

function validatePhotoBookSettings(data: Record<string, any>) {
  const settings = data.photoBook;
  if (data.productType !== 'Photo Book Print' || !settings) return;
  if (!(settings.maxPages > 0)) throw new ApiError(400, 'Photo book maximum pages must be greater than 0.');
  if (settings.defaultPages < 1 || settings.defaultPages > settings.maxPages) throw new ApiError(400, 'Photo book default pages must be between 1 and maximum pages.');
  if (settings.maxPhotoCount < 0) throw new ApiError(400, 'Photo book maximum photo count must be zero or greater.');
  if (settings.pricePerExtraPage < 0) throw new ApiError(400, 'Photo book extra page price must be zero or greater.');
  if (!(settings.pagesPerSpread > 0)) throw new ApiError(400, 'Photo book pages per spread must be greater than 0.');
}

function normalizePillowSettings(data: Record<string, any>) {
  const input = data.pillow ?? {};
  const isPillow = data.productType === 'Pillow Print';
  data.pillow = {
    enabled: isPillow && input.enabled !== false,
    sides: ['front', 'back'],
    minimumDesignedSides: Number(input.minimumDesignedSides) === 2 ? 2 : 1,
    defaultLayout: 'full-bleed',
  };
  data.variants = (data.variants ?? []).map((variant: Record<string, any>) => {
    if (!isPillow && !variant.pillow) return variant;
    const pillow = variant.pillow ?? {};
    const printArea = pillow.printArea ?? {};
    const fallbackUnit = variant.unit === 'mm' ? 'mm' : 'inch';
    const normalizeInsets = (value: Record<string, unknown> | undefined, fallback: number) => ({
      top: numberOr(value?.top, fallback),
      right: numberOr(value?.right, fallback),
      bottom: numberOr(value?.bottom, fallback),
      left: numberOr(value?.left, fallback),
    });
    const normalizeMockup = (value: Record<string, any> | undefined) => {
      const designArea = value?.designArea ?? {};
      return {
        imageUrl: typeof value?.imageUrl === 'string' ? value.imageUrl.trim() : '',
        imageAssetId: value?.imageAssetId || undefined,
        thumbnailImageUrl: typeof value?.thumbnailImageUrl === 'string' ? value.thumbnailImageUrl.trim() : '',
        thumbnailImageAssetId: value?.thumbnailImageAssetId || undefined,
        designArea: {
          x: numberOr(designArea.x, 15),
          y: numberOr(designArea.y, 12),
          width: numberOr(designArea.width, 70),
          height: numberOr(designArea.height, 70),
          cornerRadius: numberOr(designArea.cornerRadius, 8),
        },
      };
    };
    return {
      ...variant,
      pillow: {
        shape: pillow.shape === 'rectangle' ? 'rectangle' : Number(variant.width) === Number(variant.height) ? 'square' : 'rectangle',
        printArea: {
          width: numberOr(printArea.width, numberOr(variant.width, 0)),
          height: numberOr(printArea.height, numberOr(variant.height, 0)),
          unit: ['inch', 'cm', 'mm'].includes(printArea.unit) ? printArea.unit : fallbackUnit,
          bleed: normalizeInsets(printArea.bleed, 0.25),
          safeArea: normalizeInsets(printArea.safeArea, 0.5),
        },
        mockups: {
          front: normalizeMockup(pillow.mockups?.front),
          back: normalizeMockup(pillow.mockups?.back),
        },
      },
    };
  });
}

function validatePillowSettings(data: Record<string, any>) {
  if (data.productType !== 'Pillow Print') return;
  if (![1, 2].includes(Number(data.pillow?.minimumDesignedSides))) throw new ApiError(400, 'Pillow minimum designed sides must be 1 or 2.');
  for (const variant of data.variants ?? []) {
    const label = String(variant.sku || variant.name || 'Pillow variant');
    const pillow = variant.pillow;
    if (!pillow) throw new ApiError(400, `${label} requires pillow configuration.`);
    if (!['square', 'rectangle'].includes(pillow.shape)) throw new ApiError(400, `${label} requires a valid pillow shape.`);
    const printArea = pillow.printArea;
    if (!printArea || !(Number(printArea.width) > 0) || !(Number(printArea.height) > 0)) throw new ApiError(400, `${label} print width and height must be greater than 0.`);
    if (!['inch', 'cm', 'mm'].includes(printArea.unit)) throw new ApiError(400, `${label} print unit must be inch, cm, or mm.`);
    if (pillow.shape === 'square' && Math.abs(Number(printArea.width) - Number(printArea.height)) > 0.0001) throw new ApiError(400, `${label} square print width and height must match.`);
    for (const [groupName, insets] of [['bleed', printArea.bleed], ['safe area', printArea.safeArea]] as const) {
      for (const side of ['top', 'right', 'bottom', 'left']) {
        if (!Number.isFinite(Number(insets?.[side])) || Number(insets[side]) < 0) throw new ApiError(400, `${label} ${groupName} ${side} cannot be negative.`);
      }
    }
    for (const side of ['front', 'back'] as const) {
      const mockup = pillow.mockups?.[side];
      if (!String(mockup?.imageUrl ?? '').trim()) throw new ApiError(400, `${label} ${side} mockup image is required.`);
      const area = mockup.designArea;
      if (!area) throw new ApiError(400, `${label} ${side} mockup design area is required.`);
      if (![area.x, area.y, area.width, area.height].every((value) => Number.isFinite(Number(value)))) throw new ApiError(400, `${label} ${side} mockup design area must be numeric.`);
      if (area.x < 0 || area.y < 0 || !(area.width > 0) || !(area.height > 0) || area.x + area.width > 100 || area.y + area.height > 100) throw new ApiError(400, `${label} ${side} mockup design area must remain inside the image.`);
      if (!Number.isFinite(Number(area.cornerRadius)) || area.cornerRadius < 0 || area.cornerRadius > 50) throw new ApiError(400, `${label} ${side} mockup corner radius must be between 0 and 50.`);
    }
  }
}

function normalizeMugSettings(data: Record<string, any>) {
  const input = data.mug ?? {};
  const isMug = data.productType === 'Mug Print';
  data.mug = {
    enabled: isMug && input.enabled !== false,
    defaultLayout: 'blank',
  };
  data.variants = (data.variants ?? []).map((variant: Record<string, any>) => {
    if (!isMug && !variant.mug) return variant;
    const mug = variant.mug ?? {};
    const printArea = mug.printArea ?? {};
    const fallbackUnit = variant.unit === 'mm' ? 'mm' : 'inch';
    const normalizeInsets = (value: Record<string, unknown> | undefined, fallback: number) => ({
      top: numberOr(value?.top, fallback),
      right: numberOr(value?.right, fallback),
      bottom: numberOr(value?.bottom, fallback),
      left: numberOr(value?.left, fallback),
    });
    return {
      ...variant,
      mug: {
        printArea: {
          width: numberOr(printArea.width, numberOr(variant.width, 0)),
          height: numberOr(printArea.height, numberOr(variant.height, 0)),
          unit: ['inch', 'cm', 'mm'].includes(printArea.unit) ? printArea.unit : fallbackUnit,
          bleed: normalizeInsets(printArea.bleed, 0.125),
          safeArea: normalizeInsets(printArea.safeArea, 0.25),
        },
        model: {
          url: typeof mug.model?.url === 'string' ? mug.model.url.trim() : '',
          printableMaterialName: typeof mug.model?.printableMaterialName === 'string' ? mug.model.printableMaterialName.trim() : '',
        },
      },
    };
  });
}

function validateMugSettings(data: Record<string, any>) {
  if (data.productType !== 'Mug Print') return;
  if (data.mug?.enabled !== true || data.mug?.defaultLayout !== 'blank') throw new ApiError(400, 'Mug editor must be enabled with the blank default layout.');
  for (const variant of data.variants ?? []) {
    const label = String(variant.sku || variant.name || 'Mug variant');
    const mug = variant.mug;
    if (!mug) throw new ApiError(400, `${label} requires mug configuration.`);
    const printArea = mug.printArea;
    if (!printArea || !(Number(printArea.width) > 0) || !(Number(printArea.height) > 0)) throw new ApiError(400, `${label} print width and height must be greater than 0.`);
    if (!['inch', 'cm', 'mm'].includes(printArea.unit)) throw new ApiError(400, `${label} print unit must be inch, cm, or mm.`);
    for (const [groupName, insets] of [['bleed', printArea.bleed], ['safe area', printArea.safeArea]] as const) {
      for (const side of ['top', 'right', 'bottom', 'left']) {
        if (!Number.isFinite(Number(insets?.[side])) || Number(insets[side]) < 0) throw new ApiError(400, `${label} ${groupName} ${side} cannot be negative.`);
      }
    }
    if (Number(printArea.safeArea.left) > Number(printArea.width) / 2 || Number(printArea.safeArea.right) > Number(printArea.width) / 2) {
      throw new ApiError(400, `${label} horizontal safe area cannot exceed half the print width.`);
    }
    if (Number(printArea.safeArea.top) > Number(printArea.height) / 2 || Number(printArea.safeArea.bottom) > Number(printArea.height) / 2) {
      throw new ApiError(400, `${label} vertical safe area cannot exceed half the print height.`);
    }
    const modelUrl = String(mug.model?.url ?? '').trim();
    try {
      const url = new URL(modelUrl);
      if (!/^https?:$/.test(url.protocol) || !url.pathname.toLowerCase().endsWith('.glb')) throw new Error('invalid');
    } catch {
      throw new ApiError(400, `${label} requires a public HTTP(S) GLB model URL.`);
    }
    if (!String(mug.model?.printableMaterialName ?? '').trim()) throw new ApiError(400, `${label} printable material name is required.`);
  }
}

function mockupEntries(value: unknown): Array<[string, any]> {
  if (value instanceof Map) return [...value.entries()].map(([key, mockup]) => [String(key), mockup]);
  if (value && typeof value === 'object') return Object.entries(value as Record<string, any>);
  return [];
}

function getMockupByPlacementId(value: unknown, placementId: string) {
  const normalizedId = String(placementId).trim().toLowerCase();
  return mockupEntries(value).find(([key]) => key.trim().toLowerCase() === normalizedId)?.[1];
}

function normalizeTShirtSettings(data: Record<string, any>) {
  const input = data.tshirt ?? {};
  const isTShirt = data.productType === 'T-Shirt Print';
  const inset = (value: Record<string, unknown> | undefined, fallback: number) => ({
    top: numberOr(value?.top, fallback),
    right: numberOr(value?.right, fallback),
    bottom: numberOr(value?.bottom, fallback),
    left: numberOr(value?.left, fallback),
  });
  const placements = (Array.isArray(input.placements) && input.placements.length ? input.placements : [{
    id: 'front',
    label: 'Front',
    additionalPrice: 0,
    printArea: { width: 12, height: 16, unit: 'inch' },
  }]).map((placement: Record<string, any>, index: number) => {
    const id = String(placement.id ?? `placement-${index + 1}`).trim();
    const legacyArea = (Array.isArray(input.colors) ? input.colors : [])
      .map((color: Record<string, any>) => color.mockups?.[id]?.designArea)
      .find(Boolean);
    const designArea = placement.designArea ?? legacyArea ?? {};
    return {
      id,
      label: String(placement.label ?? `Placement ${index + 1}`).trim(),
      additionalPrice: numberOr(placement.additionalPrice, 0),
      designArea: {
        x: numberOr(designArea.x, 34),
        y: numberOr(designArea.y, 20),
        width: numberOr(designArea.width, 32),
        height: numberOr(designArea.height, 48),
        cornerRadius: numberOr(designArea.cornerRadius, 0),
      },
      printArea: {
        width: numberOr(placement.printArea?.width, 12),
        height: numberOr(placement.printArea?.height, 16),
        unit: ['inch', 'cm', 'mm'].includes(placement.printArea?.unit) ? placement.printArea.unit : 'inch',
        bleed: inset(placement.printArea?.bleed, 0.125),
        safeArea: inset(placement.printArea?.safeArea, 0.25),
      },
    };
  });
  const normalizeMockup = (mockup: Record<string, any> | undefined) => ({
    imageUrl: String(mockup?.imageUrl ?? '').trim(),
    imageAssetId: mockup?.imageAssetId || undefined,
    thumbnailImageUrl: String(mockup?.thumbnailImageUrl ?? '').trim(),
    thumbnailImageAssetId: mockup?.thumbnailImageAssetId || undefined,
  });
  const colors = (Array.isArray(input.colors) ? input.colors : []).map((color: Record<string, any>) => {
    return {
      value: String(color.value ?? '').trim(),
      label: String(color.label ?? '').trim(),
      swatchColor: String(color.swatchColor ?? '').trim(),
      swatchImageUrl: String(color.swatchImageUrl ?? '').trim(),
      mockups: Object.fromEntries(placements.map((placement: Record<string, any>) => {
        const exact = getMockupByPlacementId(color.mockups, placement.id);
        return [placement.id, normalizeMockup(exact)];
      })),
    };
  });
  const requestedDefault = String(input.defaultPlacementId ?? '').trim();
  data.tshirt = {
    enabled: isTShirt && input.enabled !== false,
    colorOptionKey: String(input.colorOptionKey ?? 'Color').trim(),
    sizeOptionKey: String(input.sizeOptionKey ?? 'Size').trim(),
    defaultPlacementId: placements.some((placement: Record<string, any>) => placement.id === requestedDefault) ? requestedDefault : placements[0]?.id ?? '',
    placements,
    colors,
  };
}

function validateTShirtSettings(data: Record<string, any>) {
  if (data.productType !== 'T-Shirt Print') return;
  const settings = data.tshirt;
  if (!settings?.enabled) throw new ApiError(400, 'T-shirt editor must be enabled.');
  if (!settings.colorOptionKey || !settings.sizeOptionKey) throw new ApiError(400, 'T-shirt color and size option keys are required.');
  if (settings.colorOptionKey.toLowerCase() === settings.sizeOptionKey.toLowerCase()) throw new ApiError(400, 'T-shirt color and size option keys must be different.');
  if (!Array.isArray(settings.placements) || settings.placements.length === 0) throw new ApiError(400, 'Add at least one T-shirt print placement.');
  const placementIds = new Set<string>();
  for (const placement of settings.placements) {
    const id = String(placement.id ?? '');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new ApiError(400, `T-shirt placement ID "${id}" must be URL-safe.`);
    if (placementIds.has(id.toLowerCase())) throw new ApiError(400, 'T-shirt placement IDs must be unique.');
    placementIds.add(id.toLowerCase());
    if (!String(placement.label ?? '').trim()) throw new ApiError(400, `T-shirt placement ${id} requires a label.`);
    if (!Number.isFinite(Number(placement.additionalPrice)) || Number(placement.additionalPrice) < 0) throw new ApiError(400, `${placement.label} additional price cannot be negative.`);
    const area = placement.printArea;
    if (!(Number(area?.width) > 0) || !(Number(area?.height) > 0) || !['inch', 'cm', 'mm'].includes(area?.unit)) throw new ApiError(400, `${placement.label} requires valid print dimensions and unit.`);
    for (const [groupName, insets] of [['bleed', area.bleed], ['safe area', area.safeArea]] as const) {
      for (const side of ['top', 'right', 'bottom', 'left']) {
        if (!Number.isFinite(Number(insets?.[side])) || Number(insets[side]) < 0) throw new ApiError(400, `${placement.label} ${groupName} ${side} cannot be negative.`);
      }
    }
    if (Number(area.safeArea.left) > Number(area.width) / 2 || Number(area.safeArea.right) > Number(area.width) / 2 || Number(area.safeArea.top) > Number(area.height) / 2 || Number(area.safeArea.bottom) > Number(area.height) / 2) {
      throw new ApiError(400, `${placement.label} safe area cannot exceed half its print width or height.`);
    }
    const designArea = placement.designArea;
    if (!designArea || designArea.x < 0 || designArea.y < 0 || !(designArea.width > 0) || !(designArea.height > 0) || designArea.x + designArea.width > 100 || designArea.y + designArea.height > 100) {
      throw new ApiError(400, `${placement.label} design area must remain inside the mockup.`);
    }
    if (designArea.cornerRadius < 0 || designArea.cornerRadius > 50) throw new ApiError(400, `${placement.label} design area corner radius must be between 0 and 50.`);
  }
  if (!placementIds.has(String(settings.defaultPlacementId ?? '').toLowerCase())) throw new ApiError(400, 'Default T-shirt placement must match a configured placement.');
  const colorValues = new Set<string>();
  for (const color of settings.colors ?? []) {
    const normalizedValue = String(color.value ?? '').trim().toLowerCase();
    if (!normalizedValue || !String(color.label ?? '').trim()) throw new ApiError(400, 'Every T-shirt color requires a value and label.');
    if (colorValues.has(normalizedValue)) throw new ApiError(400, 'T-shirt color values must be unique.');
    colorValues.add(normalizedValue);
    if (color.swatchColor && !/^#[0-9a-f]{6}$/i.test(color.swatchColor)) throw new ApiError(400, `${color.label} swatch color must be a 6-digit hex color.`);
    for (const placement of settings.placements) {
      const mockup = color.mockups?.[placement.id];
      if (!mockup || !String(mockup.imageUrl ?? '').trim()) throw new ApiError(400, `${color.label} requires a ${placement.label} mockup image.`);
    }
  }
  for (const variant of data.variants ?? []) {
    const options = variant.options instanceof Map ? Object.fromEntries(variant.options) : variant.options ?? {};
    const optionValue = (key: string) => Object.entries(options).find(([optionKey]) => optionKey.toLowerCase() === key.toLowerCase())?.[1];
    const color = String(optionValue(settings.colorOptionKey) ?? '').trim();
    const size = String(optionValue(settings.sizeOptionKey) ?? '').trim();
    if (!color || !size) throw new ApiError(400, `${variant.sku || variant.name || 'T-shirt variant'} requires ${settings.colorOptionKey} and ${settings.sizeOptionKey} options.`);
    if (colorValues.size && !colorValues.has(color.toLowerCase())) throw new ApiError(400, `${variant.sku || variant.name} uses an unconfigured T-shirt color "${color}".`);
  }
}

function numberOr(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
async function validateLayoutSettings(data: Record<string, any>) {
  const settings = data.layoutSettings ?? {};
  if (!settings.enabled || settings.mode === 'none') return;
  if (settings.mode === 'specific') {
    const ids = (settings.allowedTemplateIds ?? []).map(String);
    if (ids.length === 0) throw new ApiError(400, 'Select at least one layout template.');
    if (new Set(ids).size !== ids.length) throw new ApiError(400, 'Layout template selections must be unique.');
    if (ids.some((id: string) => !Types.ObjectId.isValid(id))) throw new ApiError(400, 'Layout template selections must contain valid ObjectIds.');
    const visibility: Record<string, unknown>[] = [{ scope: 'shared' }];
    if (data.scope === 'merchant' && data.merchantId) visibility.push({ scope: 'merchant', merchantId: data.merchantId });
    else visibility.push({ scope: 'merchant' });
    const count = await LayoutTemplateModel.countDocuments({ _id: { $in: ids }, accountId: data.accountId, status: 'active', $or: visibility });
    if (count !== ids.length) throw new ApiError(400, 'Selected layout templates must be active and visible within this account.');
  }
  if (settings.mode === 'by-tags' && (settings.allowedTemplateTags ?? []).length === 0) {
    throw new ApiError(400, 'Add at least one layout template tag.');
  }
}
function normalizeRoomOwnership(data: Record<string, any>) {
  const lifted = liftLegacyProductRooms(data);
  data.roomPreviews = lifted.roomPreviews;
  data.variants = lifted.variants;
}
function validateProductShape(data: Record<string, any>) {
  validatePhotoBookSettings(data);
  validatePillowSettings(data);
  validateMugSettings(data);
  validateTShirtSettings(data);
  if (data.surface && !data.surface.code) throw new ApiError(400, 'Surface code is required.');
  const frontendContent = data.frontendContent ?? {};
  const rating = Number(frontendContent.reviewRating);
  const reviewCount = Number(frontendContent.reviewCount);
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) throw new ApiError(400, 'Review rating must be between 0 and 5.');
  if (!Number.isFinite(reviewCount) || reviewCount < 0) throw new ApiError(400, 'Review count must be zero or greater.');
  if (frontendContent.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(frontendContent.supportEmail))) throw new ApiError(400, 'Support email must be valid.');
  for (const badge of frontendContent.trustBadges ?? []) {
    if (!String(badge.text ?? '').trim()) throw new ApiError(400, 'Trust badge text is required.');
    if (!Number.isFinite(Number(badge.sortOrder))) throw new ApiError(400, 'Trust badge sort order must be numeric.');
  }
  const definitionKeys = new Set<string>();
  let groupByCount = 0;
  for (const definition of data.variantOptionDefinitions ?? []) {
    const key = String(definition.key ?? '').trim();
    if (!String(definition.name ?? '').trim()) throw new ApiError(400, 'Variant option definition name is required.');
    if (!key) throw new ApiError(400, 'Variant option definition key is required.');
    const normalizedKey = key.toLowerCase();
    if (definitionKeys.has(normalizedKey)) throw new ApiError(400, 'Variant option definition keys must be unique within product.');
    definitionKeys.add(normalizedKey);
    if (definition.groupBy) groupByCount += 1;
  }
  if (groupByCount > 1) throw new ApiError(400, 'Only one variant option definition can be used for grouping.');
  const requiredDefinitions = (data.variantOptionDefinitions ?? []).filter((definition: Record<string, unknown>) => definition.required === true);
  const skus = new Set<string>();
  for (const variant of data.variants ?? []) {
    if (skus.has(String(variant.sku).toLowerCase())) throw new ApiError(400, 'Variant SKU must be unique within product.');
    skus.add(String(variant.sku).toLowerCase());
    for (const definition of requiredDefinitions) {
      if (!String(variant.options?.[definition.key] ?? '').trim()) throw new ApiError(400, `Variant ${variant.sku || variant.name || ''} is missing required option ${definition.name}.`);
    }
    if (!(variant.width > 0) || !(variant.height > 0)) throw new ApiError(400, 'Variant width and height must be greater than 0.');
    if (!(variant.dpi > 0)) throw new ApiError(400, 'Variant dpi must be greater than 0.');

  }
  const claimedRoomDefaults = new Set<string>();
  for (const room of data.roomPreviews ?? []) {
    if (!String(room.name ?? '').trim()) throw new ApiError(400, 'Room preview name is required.');
    try {
      const url = new URL(String(room.roomImageUrl ?? ''));
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
    } catch {
      throw new ApiError(400, 'Room preview image must be a valid HTTP or HTTPS URL.');
    }
    const orientations = Array.isArray(room.orientations) ? room.orientations : [];
    const defaults = Array.isArray(room.defaultOrientations) ? room.defaultOrientations : [];
    if (orientations.length === 0 || orientations.some((value: string) => !ROOM_ORIENTATIONS.includes(value as any))) throw new ApiError(400, 'Room preview must support at least one valid orientation.');
    if (defaults.some((value: string) => !orientations.includes(value))) throw new ApiError(400, 'Room default orientations must also be supported orientations.');
    for (const orientation of defaults) {
      if (claimedRoomDefaults.has(orientation)) throw new ApiError(400, `Only one room preview can be default for ${orientation}.`);
      claimedRoomDefaults.add(orientation);
    }
    if (room.centerLeftPercent < 0 || room.centerLeftPercent > 100 || room.centerTopPercent < 0 || room.centerTopPercent > 100) throw new ApiError(400, 'Room preview center position must be between 0 and 100.');
    if (!(room.maxWidthPercent > 0) || room.maxWidthPercent > 100 || !(room.maxHeightPercent > 0) || room.maxHeightPercent > 100) throw new ApiError(400, 'Room preview maximum dimensions must be greater than 0 and no more than 100.');
    if (room.centerLeftPercent - room.maxWidthPercent / 2 < 0 || room.centerLeftPercent + room.maxWidthPercent / 2 > 100 || room.centerTopPercent - room.maxHeightPercent / 2 < 0 || room.centerTopPercent + room.maxHeightPercent / 2 > 100) throw new ApiError(400, 'Room preview rectangle must stay inside the image.');
  }  const groupCodes = new Set<string>();
  for (const group of data.optionGroups ?? []) {
    if (!/^(?=.*[a-z0-9])[a-z0-9_-]+$/.test(String(group.code ?? ''))) throw new ApiError(400, 'Option group code may use lowercase letters, numbers, hyphens, and underscores only.');
    if (groupCodes.has(group.code)) throw new ApiError(400, 'Option group code must be unique within product.');
    groupCodes.add(group.code);
    const values = new Set<string>();
    let defaultCount = 0;
    for (const value of group.values ?? []) {
      if (!/^(?=.*[a-z0-9])[a-z0-9_.-]+$/.test(String(value.value ?? ''))) throw new ApiError(400, 'Option value may use lowercase letters, numbers, periods, hyphens, and underscores only.');
      if (values.has(value.value)) throw new ApiError(400, 'Option value must be unique within option group.');
      values.add(value.value);
      if (value.isDefault) defaultCount += 1;
      if (Number.isNaN(Number(value.priceModifier))) throw new ApiError(400, 'Price modifier must be numeric.');
      if (value.priceModifierType === 'percentage') {
        const minimum = value.priceModifierMin;
        const maximum = value.priceModifierMax;
        if (minimum !== undefined && (!Number.isFinite(Number(minimum)) || Number(minimum) < 0)) throw new ApiError(400, 'Percentage minimum price must be zero or greater.');
        if (maximum !== undefined && (!Number.isFinite(Number(maximum)) || Number(maximum) < 0)) throw new ApiError(400, 'Percentage maximum price must be zero or greater.');
        if (minimum !== undefined && maximum !== undefined && Number(maximum) < Number(minimum)) throw new ApiError(400, 'Percentage maximum price must be greater than or equal to the minimum price.');
      }
    }
    if (defaultCount > 1) throw new ApiError(400, 'Only one option value can be default inside an option group.');
    // Validate dependency rules
    if (Array.isArray(group.dependencyRules)) {
      for (const rule of group.dependencyRules) {
        if (!String(rule.dependsOnGroupCode ?? '').trim()) {
          throw new ApiError(400, 'Dependency rule must specify a target group code.');
        }
        if (!['equals', 'not_equals', 'in', 'not_in'].includes(rule.condition)) {
          throw new ApiError(400, 'Dependency rule condition must be equals, not_equals, in, or not_in.');
        }
        if (!Array.isArray(rule.allowedValues) || rule.allowedValues.length === 0) {
          throw new ApiError(400, 'Dependency rule must have at least one allowed value.');
        }
      }
    }
  }
  // Check for circular dependencies and missing group references
  const dependencyIssues = detectCircularDependencies(data.optionGroups ?? []);
  if (dependencyIssues.length > 0) {
    throw new ApiError(400, `Dependency validation failed: ${dependencyIssues.join('; ')}`);
  }
  // Validate AI Art configuration
  if (data.aiArt && data.aiArt.enabled === true) {
    if (!(data.aiArt.maxUploadImages > 0)) {
      throw new ApiError(400, 'AI Art max upload images must be greater than 0.');
    }
    if (!(data.aiArt.defaultGeneratedImageCount > 0)) {
      throw new ApiError(400, 'AI Art default generated image count must be greater than 0.');
    }
    const styleSlugs = new Set<string>();
    for (const style of data.aiArt.styles ?? []) {
      if (!String(style.name ?? '').trim()) {
        throw new ApiError(400, 'AI Art style name is required.');
      }
      if (!String(style.slug ?? '').trim()) {
        throw new ApiError(400, 'AI Art style slug is required.');
      }
      if (!/^(?=.*[a-z0-9])[a-z0-9_-]+$/.test(String(style.slug))) {
        throw new ApiError(400, 'AI Art style slug may use lowercase letters, numbers, hyphens, and underscores only.');
      }
      if (styleSlugs.has(style.slug)) {
        throw new ApiError(400, `AI Art style slug "${style.slug}" must be unique within product.`);
      }
      styleSlugs.add(style.slug);
      if (!String(style.prompt ?? '').trim()) {
        throw new ApiError(400, `AI Art style "${style.name}" must have a prompt.`);
      }
      if (style.additionalPrice !== undefined && (!Number.isFinite(Number(style.additionalPrice)) || Number(style.additionalPrice) < 0)) {
        throw new ApiError(400, `AI Art style "${style.name}" additional price must be zero or greater.`);
      }
    }
  }
}

async function assertUniqueSlug(data: Record<string, unknown>, id?: string) {
  const query: Record<string, unknown> = { accountId: data.accountId, scope: data.scope, merchantId: data.scope === 'shared' ? null : data.merchantId, categoryId: data.categoryId, slug: data.slug };
  if (id) query._id = { $ne: id };
  const existing = await ProductModel.findOne(query);
  if (existing) throw new ApiError(409, 'Product slug must be unique within account, scope, merchant, and category.');
}

export async function listProducts(filters: Record<string, string | undefined>) {
  const accountId = resolveAccountId(filters.accountId);
  const query: Record<string, unknown> = visibleQuery(accountId, filters.merchantId);
  if (filters.categoryId) query.categoryId = filters.categoryId;
  if (filters.status) query.status = filters.status.toLowerCase();
  if (filters.scope) query.scope = filters.scope;
  if (filters.productType) query.productType = filters.productType;
  if (filters.search) {
    const search = filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { slug: { $regex: search, $options: 'i' } },
    ];
  }

  if (filters.summary === 'true') {
    const requestedPage = Number(filters.page ?? 1);
    const requestedPageSize = Number(filters.pageSize ?? 25);
    const pageSize = Math.min(500, Math.max(1, Number.isFinite(requestedPageSize) ? Math.floor(requestedPageSize) : 25));
    const total = await ProductModel.countDocuments(query);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(pageCount, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
    const products = await ProductModel.find(query)
      .select('_id accountId merchantId scope name slug productType status basePrice thumbnailUrl categoryId variants._id optionGroups._id createdAt updatedAt')
      .sort({ updatedAt: -1, name: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();
    return {
      items: products.map((product: any) => ({
        _id: product._id,
        accountId: product.accountId,
        merchantId: product.merchantId ?? null,
        scope: product.scope,
        name: product.name,
        slug: product.slug,
        productType: product.productType,
        status: product.status,
        basePrice: product.basePrice,
        thumbnailUrl: product.thumbnailUrl,
        categoryId: product.categoryId,
        variantCount: Array.isArray(product.variants) ? product.variants.length : 0,
        optionGroupCount: Array.isArray(product.optionGroups) ? product.optionGroups.length : 0,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      })),
      pagination: { page, pageSize, total, pageCount },
    };
  }
  return ProductModel.find(query).sort({ categoryId: 1, name: 1 });
}

export async function getProduct(id: string) {
  return ProductModel.findById(id);
}

export async function createProduct(payload: Record<string, any>) {
  normalizeScope(payload);
  await normalizeRefs(payload);
  payload.slug = payload.slug || slugify(String(payload.name ?? 'product'));
  normalizeFrontendContent(payload);
  normalizeEditorProductSelection(payload);
  normalizeLayoutSettings(payload);
  normalizePhotoBookSettings(payload);
  normalizePillowSettings(payload);
  normalizeMugSettings(payload);
  normalizeTShirtSettings(payload);
  normalizeRoomOwnership(payload);
  validateProductShape(payload);
  await validateEditorProductSelection(payload);
  await validateLayoutSettings(payload);
  await assertUniqueSlug(payload);
  return ProductModel.create(payload);
}

export async function updateProduct(id: string, payload: Record<string, any>) {
  normalizeScope(payload);
  await normalizeRefs(payload);
  payload.slug = payload.slug || slugify(String(payload.name ?? 'product'));
  normalizeFrontendContent(payload);
  normalizeEditorProductSelection(payload);
  normalizeLayoutSettings(payload);
  normalizePhotoBookSettings(payload);
  normalizePillowSettings(payload);
  normalizeMugSettings(payload);
  normalizeTShirtSettings(payload);
  normalizeRoomOwnership(payload);
  validateProductShape(payload);
  await validateEditorProductSelection(payload, id);
  await validateLayoutSettings(payload);
  await assertUniqueSlug(payload, id);
  return ProductModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
}

export async function deleteProduct(id: string) {
  return ProductModel.findByIdAndDelete(id);
}

export async function duplicateProduct(id: string, payload: { scope?: 'shared' | 'merchant'; merchantId?: string }) {
  const product = await ProductModel.findById(id).lean();
  if (!product) throw new ApiError(404, 'Product not found.');
  const scope = payload.scope ?? product.scope;
  const sharedRoomData = liftLegacyProductRooms(product);
  const source = { ...product, roomPreviews: sharedRoomData.roomPreviews, variants: sharedRoomData.variants };
  const copy = new ProductModel({
    ...stripIds(source),
    name: `${product.name} Copy`,
    slug: `${product.slug}-copy-${Date.now()}`,
    status: 'draft',
    scope,
    merchantId: scope === 'shared' ? null : payload.merchantId ?? product.merchantId,
  });
  return copy.save();
}

export async function exportProduct(id: string) {
  const product = await ProductModel.findById(id).lean();
  if (!product) throw new ApiError(404, 'Product not found.');
  const category = await ProductCategoryModel.findById(product.categoryId).lean();
  return { ...product, categorySnapshot: category };
}

export async function importProduct(payload: Record<string, any>) {
  if (!payload.categoryId && payload.categorySnapshot) {
    const category = await ProductCategoryModel.create(stripIds(payload.categorySnapshot));
    payload.categoryId = category._id;
  }
  return createProduct({ ...stripIds(payload), status: 'draft', slug: `${payload.slug || slugify(payload.name)}-import-${Date.now()}` });
}

function publicProductSummary(product: any) {
  return {
    _id: String(product._id),
    name: product.name,
    slug: product.slug,
    productType: product.productType,
    thumbnailUrl: product.thumbnailUrl,
    basePrice: product.basePrice,
    scope: product.scope,
  };
}

function publicLayoutTemplateSummary(template: any) {
  return {
    _id: String(template._id),
    name: template.name,
    slug: template.slug,
    description: template.description ?? '',
    templateType: template.templateType,
    orientation: template.orientation,
    thumbnailUrl: template.thumbnailUrl ?? '',
    pageCount: template.pageCount,
    canvasWidth: template.canvasWidth,
    canvasHeight: template.canvasHeight,
    unit: template.unit,
    dpi: template.dpi,
    tags: template.tags ?? [],
    scope: template.scope,
    pages: (template.pages ?? []).map((page: any) => ({
      _id: String(page._id),
      pageNumber: page.pageNumber,
      name: page.name,
      width: page.width,
      height: page.height,
      backgroundColor: page.backgroundColor,
      backgroundImageUrl: page.backgroundImageUrl,
      collageId: page.collageId ? String(page.collageId) : null,
    })),
  };
}
function publicCollageSummary(collage: any) {
  return {
    _id: String(collage._id),
    name: collage.name,
    slug: collage.slug,
    orientation: collage.orientation,
    canvasWidth: collage.canvasWidth,
    canvasHeight: collage.canvasHeight,
    unit: collage.unit,
    dpi: collage.dpi,
    backgroundColor: collage.backgroundColor,
    backgroundImageUrl: collage.backgroundImageUrl,
    tags: collage.tags ?? [],
    elements: collage.elements ?? [],
  };
}

async function resolvePublicLayoutTemplates(product: any, merchantId?: string) {
  const settings = product.layoutSettings ?? { enabled: false, mode: 'none' };
  const mode = settings.enabled === true ? settings.mode ?? 'all' : 'none';
  if (mode === 'none') return { enabled: false, mode: 'none', requireTemplateSelection: false, templates: [] };
  const visibility: Record<string, unknown>[] = [{ scope: 'shared' }];
  if (merchantId) visibility.push({ scope: 'merchant', merchantId });
  else if (product.scope === 'merchant' && product.merchantId) visibility.push({ scope: 'merchant', merchantId: product.merchantId });
  const query: Record<string, any> = {
    accountId: product.accountId,
    status: 'active',
    $or: visibility,
  };
  if (mode === 'specific') {
    const ids = (settings.allowedTemplateIds ?? []).map(String);
    query._id = { $in: ids };
    const templates = await LayoutTemplateModel.find(query).lean();
    const byId = new Map(templates.map((template: any) => [String(template._id), template]));
    const collages = await resolvePublicTemplateCollages(templates, product, merchantId);
    return {
      enabled: true,
      mode,
      requireTemplateSelection: settings.requireTemplateSelection === true,
      templates: ids.map((templateId: string) => byId.get(templateId)).filter(Boolean).map(publicLayoutTemplateSummary),
      collages,
    };
  }
  if (mode === 'by-tags') {
    const tags = (settings.allowedTemplateTags ?? []).map(String).filter(Boolean);
    query.tags = { $in: tags };
  }
  const templates = await LayoutTemplateModel.find(query).sort({ sortOrder: 1, name: 1 }).lean();
  return {
    enabled: true,
    mode,
    requireTemplateSelection: settings.requireTemplateSelection === true,
    templates: templates.map(publicLayoutTemplateSummary),
    collages: await resolvePublicTemplateCollages(templates, product, merchantId),
  };
}

async function resolvePublicTemplateCollages(templates: any[], product: any, merchantId?: string) {
  const collageIds = Array.from(new Set(templates.flatMap((template: any) => (template.pages ?? []).map((page: any) => String(page.collageId ?? '')).filter(Boolean))));
  if (collageIds.length === 0) return [];
  const visibility: Record<string, unknown>[] = [{ scope: 'shared' }];
  if (merchantId) visibility.push({ scope: 'merchant', merchantId });
  else if (product.scope === 'merchant' && product.merchantId) visibility.push({ scope: 'merchant', merchantId: product.merchantId });
  const collages = await CollageModel.find({
    _id: { $in: collageIds },
    accountId: product.accountId,
    status: 'active',
    $or: visibility,
  }).lean();
  const byId = new Map(collages.map((collage: any) => [String(collage._id), collage]));
  return collageIds.map((collageId) => byId.get(collageId)).filter(Boolean).map(publicCollageSummary);
}

async function resolvePublicProductSelection(product: any, merchantId?: string) {
  const selection = product.editorProductSelection ?? { mode: 'single', specificProductIds: [] };
  if (merchantId && !Types.ObjectId.isValid(merchantId)) throw new ApiError(400, 'merchantId must be a valid MongoDB ObjectId.');
  let effectiveMerchantId: string | null = merchantId ?? null;
  if (product.scope === 'merchant') {
    const sourceMerchantId = String(product.merchantId ?? '');
    if (merchantId && merchantId !== sourceMerchantId) throw new ApiError(404, 'Product not found.');
    effectiveMerchantId = sourceMerchantId;
  }
  if (selection.mode === 'single') return { mode: 'single', products: [] };
  const visibility: Record<string, unknown>[] = [{ scope: 'shared' }];
  if (effectiveMerchantId) visibility.push({ scope: 'merchant', merchantId: effectiveMerchantId });
  const baseQuery: Record<string, any> = {
    _id: { $ne: product._id },
    accountId: product.accountId,
    status: 'active',
    $or: visibility,
  };
  if (selection.mode === 'same-category') {
    const products = await ProductModel.find({ ...baseQuery, categoryId: product.categoryId })
      .select('name slug productType thumbnailUrl basePrice scope')
      .lean();
    products.sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
    return { mode: 'same-category', products: products.map(publicProductSummary) };
  }
  const ids = (selection.specificProductIds ?? []).map(String);
  const products = await ProductModel.find({ ...baseQuery, _id: { $in: ids, $ne: product._id } })
    .select('name slug productType thumbnailUrl basePrice scope')
    .lean();
  const byId = new Map(products.map((item: any) => [String(item._id), item]));
  return { mode: 'specific', products: ids.map((selectedId: string) => byId.get(selectedId)).filter(Boolean).map(publicProductSummary) };
}
function publicOptionGroups(optionGroups: any[] = []) {
  return optionGroups
    .slice()
    .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
    .map((group) => ({
      _id: group._id,
      name: group.name,
      code: group.code,
      displayType: group.displayType,
      required: group.required,
      sortOrder: group.sortOrder,
      dependencyRules: (group.dependencyRules ?? []).map((rule: any) => ({
        dependsOnGroupCode: rule.dependsOnGroupCode,
        condition: rule.condition,
        allowedValues: rule.allowedValues,
      })),
      values: (group.values ?? [])
        .filter((value: any) => value.isActive !== false)
        .slice()
        .sort((a: any, b: any) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
        .map((value: any) => ({
          _id: value._id,
          label: value.label,
          value: value.value,
          priceModifierType: value.priceModifierType,
          priceModifier: value.priceModifier,
          priceModifierMin: value.priceModifierMin,
          priceModifierMax: value.priceModifierMax,
          isDefault: value.isDefault,
          sortOrder: value.sortOrder,
          previewImageUrl: value.previewImageUrl,
          thumbnailImageUrl: value.thumbnailImageUrl,
          metadata: {
            colorHex: value.metadata?.colorHex ?? '',
            description: value.metadata?.description ?? '',
          },
        })),
    }));
}
export async function getPublicProductConfig(id: string, merchantId?: string) {
  const product = await ProductModel.findById(id).lean();
  if (!product) throw new ApiError(404, 'Product not found.');
  if (product.status !== 'active') throw new ApiError(404, 'Product not found.');
  const sharedRoomData = liftLegacyProductRooms(product);
  const productSelection = await resolvePublicProductSelection(product, merchantId);
  const layoutTemplates = await resolvePublicLayoutTemplates(product, merchantId);
  const activeVariants = (sharedRoomData.variants ?? []).filter((variant: any) => variant.status === 'active').map((variant: any) => ({
    _id: variant._id,
    name: variant.name,
    sku: variant.sku,
    price: variant.price,
    options: variant.options,
    width: variant.width,
    height: variant.height,
    unit: variant.unit,
    dpi: variant.dpi,
    previewImageUrl: variant.previewImageUrl,
    thumbnailImageUrl: variant.thumbnailImageUrl,
    pillow: variant.pillow,
    mug: variant.mug,
    roomOrientation: getVariantRoomOrientation(variant),

  }));
  return {
    _id: product._id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    productType: product.productType,
    basePrice: product.basePrice,
    thumbnailUrl: product.thumbnailUrl,
    surface: product.surface,
    variantOptionDefinitions: product.variantOptionDefinitions,
    optionGroups: publicOptionGroups(product.optionGroups),
    roomPreviews: sharedRoomData.roomPreviews.slice().sort((a: any, b: any) => a.sortOrder - b.sortOrder),
    frontendContent: publicFrontendContent(product.frontendContent),
    productSelection,
    layoutTemplates,
    editorRules: { ...(product.editorRules ?? {}), allowCustomSize: product.editorRules?.allowCustomSize ?? false },
    exportRules: product.exportRules,
    photoBook: publicPhotoBookConfig(product.photoBook, product.productType),
    pillow: publicPillowConfig(product.pillow, product.productType),
    mug: publicMugConfig(product.mug, product.productType),
    tshirt: publicTShirtConfig(product.tshirt, product.productType),
    variants: activeVariants,
    aiArt: publicAiArtConfig(product.aiArt),
  };
}

function publicPhotoBookConfig(photoBook: any, productType: string) {
  const input = photoBook ?? {};
  return {
    enabled: productType === 'Photo Book Print',
    maxPages: input.maxPages ?? 120,
    defaultPages: input.defaultPages ?? 20,
    maxPhotoCount: input.maxPhotoCount ?? 300,
    pricePerExtraPage: input.pricePerExtraPage ?? 1.5,
    pagesPerSpread: input.pagesPerSpread ?? 2,
    allowPageReorder: input.allowPageReorder ?? true,
    allowBlankPages: input.allowBlankPages ?? false,
    coverType: input.coverType || 'hardcover',
    bindingType: input.bindingType || 'layflat',
    paperType: input.paperType || 'lustre',
    startsWithCover: input.startsWithCover ?? true,
    hasBackCover: input.hasBackCover ?? true,
  };
}

function publicAiArtConfig(aiArt: any) {
  if (!aiArt) {
    return undefined;
  }
  const activeStyles = (aiArt.styles ?? [])
    .filter((style: any) => style.isActive !== false)
    .sort((a: any, b: any) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
  return {
    enabled: aiArt.enabled === true,
    sectionTitle: aiArt.sectionTitle || 'AI Art Styles',
    badgeText: aiArt.badgeText || '',
    helpText: aiArt.helpText || '',
    requireUploadBeforeStyleSelection: aiArt.requireUploadBeforeStyleSelection ?? true,
    maxUploadImages: aiArt.maxUploadImages ?? 1,
    defaultGeneratedImageCount: aiArt.defaultGeneratedImageCount ?? 4,
    allowMultipleStyleSelection: aiArt.allowMultipleStyleSelection ?? false,
    showDescriptions: aiArt.showDescriptions ?? true,
    showAdditionalPrice: aiArt.showAdditionalPrice ?? true,
    allowArtName: aiArt.allowArtName ?? false,
    artNameFieldLabel: aiArt.artNameFieldLabel || 'Pet name (optional)',
    artNameFieldPlaceholder: aiArt.artNameFieldPlaceholder || 'e.g., Buddy, Luna, Max',
    styles: activeStyles.map((style: any) => ({
      _id: style._id,
      name: style.name,
      slug: style.slug,
      prompt: style.prompt,
      artTitlePrompt: style.artTitlePrompt || '',
      additionalPrice: style.additionalPrice ?? 0,
      previewImageUrl: style.previewImageUrl || '',
      thumbnailImageUrl: style.thumbnailImageUrl || '',
      sortOrder: style.sortOrder ?? 0,
    })),
  };
}
export async function listEditorProducts(apiPrivateKey: string) {
  const merchant = await authenticateApiPrivateKey(apiPrivateKey);
  if (!merchant) throw new ApiError(401, 'A valid merchant API private key is required.');

  const products = await ProductModel.find({
    ...visibleQuery(String(merchant.accountId), String(merchant._id)),
    status: 'active',
  })
    .select('name productType categoryId status updatedAt')
    .sort({ name: 1 })
    .lean();

  const categoryIds = [...new Set(products.map((product: any) => String(product.categoryId ?? '')).filter(Boolean))];
  const categories = await ProductCategoryModel.find({ _id: { $in: categoryIds } })
    .select('name slug')
    .lean();
  const categoriesById = new Map(categories.map((category: any) => [String(category._id), category]));

  return products.map((product: any) => {
    const category = categoriesById.get(String(product.categoryId));
    return {
      _id: String(product._id),
      name: product.name,
      productType: product.productType,
      category: category ? { _id: String(category._id), name: category.name, slug: category.slug } : null,
      status: product.status,
      updatedAt: product.updatedAt,
    };
  });
}
export async function getEditorProductConfig(id: string, apiPrivateKey: string) {
  const merchant = await authenticateApiPrivateKey(apiPrivateKey);
  if (!merchant) throw new ApiError(401, 'A valid merchant API private key is required.');
  return getPublicProductConfig(id, String(merchant._id));
}

export interface PublicDesignTokenPayload {
  userKey: string;
  merchantId: string;
  productId: string;
  expiresAt: number;
}

export async function verifyPublicDesignToken(input: { authorization?: string; routeProductId: string }): Promise<PublicDesignTokenPayload> {
  const token = parseBearerToken(input.authorization);
  const [encodedData, signature = ''] = token.split('.');
  if (!encodedData || !signature || token.split('.').length !== 2) throw new ApiError(401, 'Invalid design authorization token.');

  let data = '';
  try {
    data = Buffer.from(encodedData, 'base64').toString('utf8');
  } catch {
    throw new ApiError(401, 'Invalid design authorization token data.');
  }

  const separatorIndex = data.lastIndexOf('|');
  if (separatorIndex < 0) throw new ApiError(401, 'Invalid design authorization token payload.');
  const identity = data.slice(0, separatorIndex);
  const expiresAt = Number(data.slice(separatorIndex + 1));
  if (!Number.isInteger(expiresAt)) throw new ApiError(401, 'Invalid design authorization token expiry.');
  if (expiresAt <= Math.floor(Date.now() / 1000)) throw new ApiError(401, 'Design authorization token has expired.');

  const identityParts = identity.split(':');
  const [userKeyRaw, merchantId, productId, wpProductId] = identityParts;
  if (!userKeyRaw || !merchantId || !productId || !wpProductId || identityParts.length !== 4) throw new ApiError(401, 'Invalid design authorization token identity.');
  if (!Types.ObjectId.isValid(merchantId)) throw new ApiError(401, 'Invalid design authorization merchant.');
  if (!Types.ObjectId.isValid(productId)) throw new ApiError(401, 'Invalid design authorization product.');
  if (String(productId) !== String(input.routeProductId)) throw new ApiError(403, 'Design authorization token does not match this product.');

  const merchant = await MerchantModel.findOne({ _id: merchantId, status: 'active' }).select('+apiPrivateKeySecret').lean();
  if (!merchant) throw new ApiError(401, 'Merchant authorization not found.');
  if (!merchant.apiPrivateKeySecret) throw new ApiError(401, 'Merchant API key must be rotated before temporary design tokens can be verified.');

  const expectedSignature = createHmac('sha256', String(merchant.apiPrivateKeySecret)).update(data).digest('hex');
  if (!safeHexEqual(signature, expectedSignature)) throw new ApiError(401, 'Invalid design authorization signature.');

  return {
    userKey: userKeyRaw,
    merchantId: String(merchant._id),
    productId,
    expiresAt,
  };
}

function parseBearerToken(authorization?: string) {
  const value = String(authorization ?? '').trim();
  const match = /^Bearer\s+(.+)$/i.exec(value);
  if (!match) throw new ApiError(401, 'Authorization Bearer token is required.');
  return match[1].trim();
}

function safeHexEqual(actual: string, expected: string) {
  if (!/^[a-f0-9]{64}$/i.test(actual)) return false;
  const actualBuffer = Buffer.from(actual, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function listDesignCartItems(filters: Record<string, string | undefined>) {
  const accountId = resolveAccountId(filters.accountId);
  const query: Record<string, unknown> = { accountId };
  if (filters.merchantId) {
    if (!Types.ObjectId.isValid(filters.merchantId)) throw new ApiError(400, 'merchantId must be a valid MongoDB ObjectId.');
    query.merchantId = filters.merchantId;
  }
  if (filters.status) query.status = filters.status;
  if (filters.printGenerationStatus) query.printGenerationStatus = filters.printGenerationStatus;
  if (filters.productType) {
    const allowedProductTypes = ['Photo Book Print', 'Photo Collage Print', 'Pillow Print', 'Mug Print', 'T-Shirt Print'];
    if (!allowedProductTypes.includes(filters.productType)) throw new ApiError(400, 'Unsupported product type filter.');
    query.productType = filters.productType;
  }
  if (filters.summary === 'true') {
    const requestedPage = Number(filters.page ?? 1);
    const requestedPageSize = Number(filters.pageSize ?? 25);
    const pageSize = Math.min(100, Math.max(1, Number.isFinite(requestedPageSize) ? Math.floor(requestedPageSize) : 25));
    const total = await DesignCartItemModel.countDocuments(query);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(pageCount, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
    const aggregateQuery: Record<string, unknown> = {
      ...query,
      accountId: new Types.ObjectId(accountId),
      ...(filters.merchantId ? { merchantId: new Types.ObjectId(filters.merchantId) } : {}),
    };
    const items = await DesignCartItemModel.aggregate([
      { $match: aggregateQuery },
      { $sort: { updatedAt: -1 } },
      { $skip: (page - 1) * pageSize },
      { $limit: pageSize },
      {
        $project: {
          accountId: 1,
          merchantId: 1,
          productId: 1,
          productType: 1,
          userKey: 1,
          projectId: 1,
          status: 1,
          orderId: 1,
          printGenerationStatus: 1,
          printGenerationError: 1,
          printGenerationTotalPages: 1,
          printGenerationCompletedPages: 1,
          printGenerationCurrentPage: 1,
          pagePreviews: {
            $map: {
              input: { $slice: [{ $ifNull: ['$pagePreviews', []] }, 1] },
              as: 'preview',
              in: {
                publicUrl: '$$preview.publicUrl',
                url: '$$preview.url',
                filename: '$$preview.filename',
              },
            },
          },
          pagePreviewCount: { $size: { $ifNull: ['$pagePreviews', []] } },
          finalPrintFiles: {
            $map: {
              input: { $slice: [{ $ifNull: ['$finalPrintFiles', []] }, 1] },
              as: 'print',
              in: {
                publicUrl: '$$print.publicUrl',
                url: '$$print.url',
                filename: '$$print.filename',
              },
            },
          },
          finalPrintCount: { $size: { $ifNull: ['$finalPrintFiles', []] } },
          addedToCartAt: 1,
          orderedAt: 1,
          lastActivityAt: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ]);
    const productIds = [...new Set(items.map((item) => String(item.productId)))];
    const cartItemIds = items.map((item) => item._id);
    const [products, jobs] = await Promise.all([
      ProductModel.find({ _id: { $in: productIds } }).select('name slug productType').lean(),
      DesignProcessingJobModel.find({ cartItemId: { $in: cartItemIds } })
        .select('cartItemId status attempts error createdAt updatedAt startedAt completedAt')
        .sort({ createdAt: -1 })
        .lean(),
    ]);
    const productMap = new Map(products.map((product: any) => [String(product._id), product]));
    const latestJobMap = new Map<string, any>();
    for (const job of jobs) {
      const key = String(job.cartItemId);
      if (!latestJobMap.has(key)) latestJobMap.set(key, job);
    }
    return {
      items: items.map((item) => {
        const product: any = productMap.get(String(item.productId));
        const finalPrintCount = Number(item.finalPrintCount ?? 0);
        const pagePreviewCount = Number(item.pagePreviewCount ?? 0);
        const totalPages = Number(item.printGenerationTotalPages ?? 0) > 0
          ? Number(item.printGenerationTotalPages)
          : item.printGenerationStatus === 'complete' && finalPrintCount > 0
            ? finalPrintCount
            : Math.max(finalPrintCount, pagePreviewCount);
        return {
          ...item,
          _id: String(item._id),
          accountId: String(item.accountId),
          merchantId: String(item.merchantId),
          productId: String(item.productId),
          productType: normalizeDesignProductType(product?.productType, item.productType),
          projectId: String(item.projectId ?? ''),
          product: product ? { _id: String(product._id), name: product.name, slug: product.slug, productType: product.productType } : null,
          pagePreviewCount,
          finalPrintCount,
          printGenerationTotalPages: totalPages,
          printGenerationCompletedPages: Number(item.printGenerationCompletedPages ?? 0) > 0
            ? Number(item.printGenerationCompletedPages)
            : finalPrintCount,
          printGenerationCurrentPage: Number(item.printGenerationCurrentPage ?? 0),
          latestJob: normalizeLeanJob(latestJobMap.get(String(item._id))),
        };
      }),
      pagination: { page, pageSize, total, pageCount },
    };
  }
  const items = await DesignCartItemModel.find(query).sort({ updatedAt: -1 }).limit(Math.min(Number(filters.limit ?? 100) || 100, 500)).lean();
  const productIds = [...new Set(items.map((item) => String(item.productId)))];
  const jobIds = items.map((item) => String(item._id));
  const [products, jobs] = await Promise.all([
    ProductModel.find({ _id: { $in: productIds } }).select('name slug productType').lean(),
    DesignProcessingJobModel.find({ cartItemId: { $in: jobIds } }).sort({ createdAt: -1 }).lean(),
  ]);
  const productMap = new Map(products.map((product: any) => [String(product._id), product]));
  const latestJobMap = new Map<string, any>();
  for (const job of jobs) {
    const key = String(job.cartItemId);
    if (!latestJobMap.has(key)) latestJobMap.set(key, job);
  }
  return items.map((item) => {
    const product: any = productMap.get(String(item.productId));
    const finalPrintCount = Array.isArray(item.finalPrintFiles) ? item.finalPrintFiles.length : 0;
    const totalPages = Number(item.printGenerationTotalPages ?? 0) > 0 ? Number(item.printGenerationTotalPages) : inferFinalPrintTotalPages(item);
    const completedPages = Number(item.printGenerationCompletedPages ?? 0) > 0 ? Number(item.printGenerationCompletedPages) : finalPrintCount;
    return {
      ...item,
      _id: String(item._id),
      accountId: String(item.accountId),
      merchantId: String(item.merchantId),
      productId: String(item.productId),
      productType: normalizeDesignProductType(product?.productType, item.productType),
      projectId: String(item.projectId ?? ''),
      product: product ? { _id: String(product._id), name: product.name, slug: product.slug, productType: product.productType } : null,
      printGenerationTotalPages: totalPages,
      printGenerationCompletedPages: completedPages,
      printGenerationCurrentPage: Number(item.printGenerationCurrentPage ?? 0),
      latestJob: normalizeLeanJob(latestJobMap.get(String(item._id))),
    };
  });
}

export async function getDesignCartItem(input: { cartItemId: string; accountId?: string }) {
  if (!Types.ObjectId.isValid(input.cartItemId)) throw new ApiError(400, 'cartItemId must be a valid MongoDB ObjectId.');
  const query: Record<string, unknown> = { _id: input.cartItemId };
  if (input.accountId && Types.ObjectId.isValid(input.accountId)) query.accountId = input.accountId;
  const item = await DesignCartItemModel.findOne(query).lean();
  if (!item) throw new ApiError(404, 'Design cart item not found.');
  const [product, latestJob] = await Promise.all([
    ProductModel.findById(item.productId).select('name slug productType').lean(),
    DesignProcessingJobModel.findOne({ cartItemId: item._id }).sort({ createdAt: -1 }).lean(),
  ]);
  const finalPrintCount = Array.isArray(item.finalPrintFiles) ? item.finalPrintFiles.length : 0;
  const totalPages = Number(item.printGenerationTotalPages ?? 0) > 0 ? Number(item.printGenerationTotalPages) : inferFinalPrintTotalPages(item);
  const completedPages = Number(item.printGenerationCompletedPages ?? 0) > 0 ? Number(item.printGenerationCompletedPages) : finalPrintCount;
  return {
    ...item,
    _id: String(item._id),
    accountId: String(item.accountId),
    merchantId: String(item.merchantId),
    productId: String(item.productId),
    productType: normalizeDesignProductType(product?.productType, item.productType),
    projectId: String(item.projectId ?? ''),
    product: product ? { _id: String(product._id), name: product.name, slug: product.slug, productType: product.productType } : null,
    printGenerationTotalPages: totalPages,
    printGenerationCompletedPages: completedPages,
    printGenerationCurrentPage: Number(item.printGenerationCurrentPage ?? 0),
    latestJob: normalizeLeanJob(latestJob),
  };
}

function inferFinalPrintTotalPages(item: Record<string, any>) {
  const finalPrintCount = Array.isArray(item.finalPrintFiles) ? item.finalPrintFiles.length : 0;
  if (item.printGenerationStatus === 'complete' && finalPrintCount > 0) return finalPrintCount;
  const previewCount = Array.isArray(item.pagePreviews) ? item.pagePreviews.length : 0;
  return Math.max(finalPrintCount, previewCount);
}

function normalizeLeanJob(job: any) {
  if (!job) return null;
  return {
    ...job,
    _id: String(job._id),
    cartItemId: String(job.cartItemId),
    merchantId: String(job.merchantId),
    productId: String(job.productId),
    accountId: String(job.accountId),
  };
}

const designProcessingJobs = new Map<string, Promise<void>>();
const WORKER_ID = `api-${process.pid}-${randomBytes(4).toString('hex')}`;

export async function processDesignCartItem(input: { cartItemId: string; apiPrivateKey: string; orderId?: unknown; force?: unknown }) {
  const merchant = await authenticateApiPrivateKey(input.apiPrivateKey);
  if (!merchant) throw new ApiError(401, 'A valid merchant API private key is required.');
  if (!Types.ObjectId.isValid(input.cartItemId)) throw new ApiError(400, 'cartItemId must be a valid MongoDB ObjectId.');

  const cartItem = await DesignCartItemModel.findOne({ _id: input.cartItemId, merchantId: merchant._id });
  if (!cartItem) throw new ApiError(404, 'Design cart item not found.');
  return queueDesignCartItemProcessing(cartItem, { ...input, markOrdered: true });
}

export async function processDesignCartItemForAdmin(input: { cartItemId: string; accountId?: string; orderId?: unknown; force?: unknown }) {
  if (!Types.ObjectId.isValid(input.cartItemId)) throw new ApiError(400, 'cartItemId must be a valid MongoDB ObjectId.');
  const query: Record<string, unknown> = { _id: input.cartItemId };
  if (input.accountId && Types.ObjectId.isValid(input.accountId)) query.accountId = input.accountId;
  const cartItem = await DesignCartItemModel.findOne(query);
  if (!cartItem) throw new ApiError(404, 'Design cart item not found.');
  return queueDesignCartItemProcessing(cartItem, { ...input, markOrdered: false });
}

export async function processPublicDesignFinalPrint(input: {
  productId: string;
  apiPrivateKey: string;
  cartItemId?: unknown;
  projectId?: unknown;
  force?: unknown;
}) {
  const merchant = await authenticateApiPrivateKey(input.apiPrivateKey);
  if (!merchant) throw new ApiError(401, 'A valid merchant API private key is required.');
  if (!Types.ObjectId.isValid(input.productId)) throw new ApiError(400, 'productId must be a valid MongoDB ObjectId.');

  const rawCartItemId = String(input.cartItemId ?? '').trim();
  const rawProjectId = String(input.projectId ?? '').trim();
  const projectId = sanitizeProjectId(input.projectId);
  if (!rawCartItemId && !projectId) throw new ApiError(400, 'cartItemId or projectId is required.');
  if (rawCartItemId && !Types.ObjectId.isValid(rawCartItemId)) {
    throw new ApiError(400, 'cartItemId must be a valid MongoDB ObjectId.');
  }
  if (rawProjectId && !projectId) throw new ApiError(400, 'projectId must be valid.');

  const cartItemQuery: Record<string, unknown> = {
    merchantId: merchant._id,
    accountId: merchant.accountId,
    productId: input.productId,
    status: { $in: ['cart', 'ordered'] },
  };
  if (rawCartItemId) cartItemQuery._id = rawCartItemId;
  else cartItemQuery.projectId = projectId;

  const cartItem = await DesignCartItemModel.findOne(cartItemQuery);
  if (!cartItem) throw new ApiError(404, 'Design cart item was not found for this merchant and product.');

  if (projectId && String(cartItem.projectId) !== projectId) {
    throw new ApiError(403, 'The design project does not belong to this cart item.');
  }

  const result = await queueDesignCartItemProcessing(cartItem, {
    orderId: cartItem.orderId || String(cartItem._id),
    force: input.force,
    markOrdered: false,
  });

  return {
    projectId: String(cartItem.projectId ?? ''),
    cartItemId: String(cartItem._id),
    jobId: result.job?._id ? String(result.job._id) : null,
    queued: Boolean(result.queued),
    processed: Boolean(result.processed),
    printGenerationStatus: result.printGenerationStatus ?? cartItem.printGenerationStatus,
    message: result.message,
  };
}

export async function markDesignCartItemOrderedForAdmin(input: { cartItemId: string; accountId?: string; orderId?: unknown; force?: unknown }) {
  if (!Types.ObjectId.isValid(input.cartItemId)) throw new ApiError(400, 'cartItemId must be a valid MongoDB ObjectId.');
  const query: Record<string, unknown> = { _id: input.cartItemId };
  if (input.accountId && Types.ObjectId.isValid(input.accountId)) query.accountId = input.accountId;
  const cartItem = await DesignCartItemModel.findOne(query);
  if (!cartItem) throw new ApiError(404, 'Design cart item not found.');

  const orderId = await markCartItemAndProjectOrdered(cartItem, input.orderId);
  const force = parseBoolean(input.force);
  if (cartItem.printGenerationStatus !== 'complete' || force) {
    return queueDesignCartItemProcessing(cartItem, { ...input, orderId, markOrdered: true });
  }

  return {
    cartItem,
    queued: false,
    processed: false,
    printGenerationStatus: cartItem.printGenerationStatus,
    message: 'Design cart item marked as ordered.',
  };
}

function publicPillowConfig(pillow: any, productType: string) {
  const input = pillow ?? {};
  return {
    enabled: productType === 'Pillow Print' && input.enabled !== false,
    sides: ['front', 'back'],
    minimumDesignedSides: Number(input.minimumDesignedSides) === 2 ? 2 : 1,
    defaultLayout: 'full-bleed',
  };
}

export async function createFinalPrintsDownloadToken(input: { cartItemId: string; accountId?: string; userId?: string; origin?: string }) {
  const cartItem = await findDownloadableCartItem(input.cartItemId, input.accountId);
  const token = signDownloadToken({
    sub: input.userId || 'admin',
    accountId: input.accountId ? String(input.accountId) : String(cartItem.accountId),
    cartItemId: String(cartItem._id),
    scope: 'final-prints-download',
  });
  const origin = String(input.origin ?? '').replace(/\/+$/, '');
  return {
    expiresInSeconds: 300,
    url: `${origin}/api/products/cart-items/${cartItem._id}/final-prints.zip?downloadToken=${encodeURIComponent(token)}`,
  };
}

export async function streamFinalPrintsZip(input: { cartItemId: string; downloadToken: string; response: Response }) {
  if (!input.downloadToken) throw new ApiError(401, 'downloadToken is required.');
  let payload: Record<string, unknown>;
  try {
    payload = verifyDownloadToken(input.downloadToken) as Record<string, unknown>;
  } catch {
    throw new ApiError(401, 'Download token is invalid or expired.');
  }

  if (payload.scope !== 'final-prints-download') throw new ApiError(401, 'Download token scope is invalid.');
  if (String(payload.cartItemId ?? '') !== input.cartItemId) throw new ApiError(401, 'Download token does not match this cart item.');

  const cartItem = await findDownloadableCartItem(input.cartItemId, typeof payload.accountId === 'string' ? payload.accountId : undefined);
  const files = Array.isArray(cartItem.finalPrintFiles) ? cartItem.finalPrintFiles : [];
  const filename = zipFilename(`final-prints-${cartItem.orderId || cartItem._id}.zip`);

  input.response.setHeader('Content-Type', 'application/zip');
  input.response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  input.response.setHeader('Cache-Control', 'no-store');

  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.on('error', (error: ArchiverError) => {
    input.response.destroy(error);
  });
  archive.pipe(input.response);

  for (const [index, file] of files.entries()) {
    const storagePath = String(file?.storagePath ?? '');
    if (!storagePath) continue;
    const data = await downloadObject(storagePath, {
      provider: String(file?.storageProvider ?? 'supabase') as StorageProvider,
      bucket: String(file?.bucket ?? '') || undefined,
    }).catch((error) => { throw new ApiError(502, `Final print download failed: ${error instanceof Error ? error.message : storagePath}`); });
    archive.append(data, {
      name: sanitizeZipEntryName(String(file?.filename ?? `final-print-${index + 1}.svg`)),
    });
  }

  await archive.finalize();
}

async function findDownloadableCartItem(cartItemId: string, accountId?: string) {
  if (!Types.ObjectId.isValid(cartItemId)) throw new ApiError(400, 'cartItemId must be a valid MongoDB ObjectId.');
  const query: Record<string, unknown> = { _id: cartItemId };
  if (accountId) {
    if (!Types.ObjectId.isValid(accountId)) throw new ApiError(400, 'accountId must be a valid MongoDB ObjectId.');
    query.accountId = accountId;
  }
  const cartItem = await DesignCartItemModel.findOne(query);
  if (!cartItem) throw new ApiError(404, 'Design cart item not found.');
  if (!Array.isArray(cartItem.finalPrintFiles) || cartItem.finalPrintFiles.length === 0) {
    throw new ApiError(400, 'No final print images are available for download.');
  }
  return cartItem;
}

function publicMugConfig(mug: any, productType: string) {
  const input = mug ?? {};
  return {
    enabled: productType === 'Mug Print' && input.enabled !== false,
    defaultLayout: 'blank',
  };
}

function publicTShirtConfig(tshirt: any, productType: string) {
  const input = tshirt ?? {};
  const colors = Array.isArray(input.colors) ? input.colors : [];
  const placements = (Array.isArray(input.placements) ? input.placements : []).map((placement: Record<string, any>) => {
    const legacyArea = colors.map((color: Record<string, any>) => color.mockups?.[placement.id]?.designArea).find(Boolean);
    return {
      ...placement,
      designArea: placement.designArea ?? legacyArea ?? { x: 34, y: 20, width: 32, height: 48, cornerRadius: 0 },
    };
  });
  return {
    enabled: productType === 'T-Shirt Print' && input.enabled !== false,
    colorOptionKey: input.colorOptionKey || 'Color',
    sizeOptionKey: input.sizeOptionKey || 'Size',
    defaultPlacementId: input.defaultPlacementId || placements[0]?.id || '',
    placements,
    colors: colors.map((color: Record<string, any>) => {
      return {
        ...color,
        mockups: Object.fromEntries(placements.map((placement: Record<string, any>) => {
          const mockup = getMockupByPlacementId(color.mockups, placement.id) ?? {};
          const publicMockup = { ...mockup };
          delete publicMockup.designArea;
          return [placement.id, publicMockup];
        })),
      };
    }),
  };
}

async function markCartItemAndProjectOrdered(cartItem: any, requestedOrderId?: unknown) {
  const orderId = sanitizeUploadSegment(String(requestedOrderId ?? cartItem.orderId ?? cartItem._id));
  if (!orderId) throw new ApiError(400, 'orderId is required to mark a design cart item as ordered.');
  const orderPrefix = designOrderPrefix(String(cartItem.merchantId), orderId, String(cartItem.productId));
  const now = new Date();
  cartItem.status = 'ordered';
  cartItem.orderId = orderId;
  cartItem.orderStoragePrefix = cartItem.orderStoragePrefix || orderPrefix;
  cartItem.orderedAt = cartItem.orderedAt || now;
  cartItem.lastActivityAt = now;
  await cartItem.save();
  await markProjectOrdered(cartItem, cartItem.orderStoragePrefix || orderPrefix);
  return orderId;
}

async function markProjectOrdered(cartItem: any, orderPrefix: string) {
  if (!cartItem.projectId) return;
  await DesignProjectModel.findOneAndUpdate(
    { projectId: cartItem.projectId },
    {
      $set: {
        cartItemId: cartItem._id,
        status: 'ordered',
        orderStoragePrefix: orderPrefix,
        lastActivityAt: new Date(),
      },
    }
  );
}

async function queueDesignCartItemProcessing(cartItem: any, input: { orderId?: unknown; force?: unknown; markOrdered?: boolean }) {
  const force = parseBoolean(input.force);
  const markedOrderId = input.markOrdered ? await markCartItemAndProjectOrdered(cartItem, input.orderId) : undefined;
  if (cartItem.printGenerationStatus === 'complete' && !force) {
    return {
      cartItem,
      processed: false,
      message: 'Design cart item has already been processed.',
    };
  }
  const existingJob = await DesignProcessingJobModel.findOne({
    cartItemId: cartItem._id,
    status: { $in: ['pending', 'processing'] },
  }).lean();
  if ((existingJob || designProcessingJobs.has(String(cartItem._id))) && !force) {
    return {
      cartItem,
      job: existingJob,
      queued: true,
      printGenerationStatus: 'processing',
      message: 'Design cart item is already queued for processing.',
    };
  }

  const orderId = sanitizeUploadSegment(String(markedOrderId ?? input.orderId ?? cartItem.orderId ?? cartItem._id));
  if (!orderId) throw new ApiError(400, 'orderId is required to process a design cart item.');
  const orderPrefix = designOrderPrefix(String(cartItem.merchantId), orderId, String(cartItem.productId));
  if (input.markOrdered) cartItem.status = 'ordered';
  cartItem.orderId = orderId;
  cartItem.orderStoragePrefix = orderPrefix;
  cartItem.printGenerationStatus = 'processing';
  cartItem.printGenerationError = '';
  cartItem.printGenerationTotalPages = 0;
  cartItem.printGenerationCompletedPages = 0;
  cartItem.printGenerationCurrentPage = 0;
  cartItem.lastActivityAt = new Date();
  await cartItem.save();

  const job = await DesignProcessingJobModel.create({
    cartItemId: cartItem._id,
    merchantId: cartItem.merchantId,
    productId: cartItem.productId,
    accountId: cartItem.accountId,
    markOrdered: Boolean(input.markOrdered),
    orderId,
    sourcePrefix: cartItem.tempStoragePrefix,
    orderPrefix,
    status: 'pending',
    availableAt: new Date(),
  });

  enqueueDesignCartItemProcessing(String(job._id), String(cartItem._id));
  return {
    cartItem,
    job,
    queued: true,
    processed: false,
    printGenerationStatus: 'processing',
    message: 'Design cart item queued for final print image generation.',
  };
}

function enqueueDesignCartItemProcessing(jobId: string, cartItemId: string) {
  const job = runDesignCartItemProcessing(jobId)
    .catch((error) => {
      console.error(`Design cart item processing failed for ${cartItemId}:`, error);
    })
    .finally(() => {
      designProcessingJobs.delete(cartItemId);
    });
  designProcessingJobs.set(cartItemId, job);
}

async function runDesignCartItemProcessing(jobId: string) {
  const job = await claimDesignProcessingJob(jobId);
  if (!job) return;
  const cartItem = await DesignCartItemModel.findById(job.cartItemId);
  if (!cartItem) return;
  try {
    cartItem.printGenerationStatus = 'processing';
    cartItem.printGenerationError = '';
    cartItem.lastActivityAt = new Date();
    await cartItem.save();
    const orderId = sanitizeUploadSegment(String(job.orderId || cartItem.orderId || cartItem._id));
    const sourcePrefix = String(cartItem.tempStoragePrefix || '');
    if (!sourcePrefix) throw new ApiError(400, 'Cart item is missing a temporary design storage prefix.');
    const orderPrefix = String(job.orderPrefix || designOrderPrefix(String(cartItem.merchantId), orderId, String(cartItem.productId)));
    const copiedFiles = await copyStoragePrefix(sourcePrefix, orderPrefix);
    if (!copiedFiles.some((file) => file.destination === `${orderPrefix}/design.json`)) throw new ApiError(400, 'Cart item has no saved design.json to process.');

    const designPublicBaseUrl = `${r2PublicUrl(orderPrefix)}/`;
    const designPublicUrl = `${designPublicBaseUrl}design.json`;
    const shouldMarkOrdered = Boolean((job as any).markOrdered);
    if (shouldMarkOrdered) cartItem.status = 'ordered';
    cartItem.orderId = orderId;
    cartItem.orderStoragePrefix = orderPrefix;
    cartItem.designStoragePath = `${orderPrefix}/design.json`;
    cartItem.designPublicBaseUrl = designPublicBaseUrl;
    cartItem.designPublicUrl = designPublicUrl;
    cartItem.pagePreviews = (cartItem.pagePreviews ?? []).map((preview: any) => rewriteStoredFile(preview, sourcePrefix, orderPrefix)) as any;
    if (cartItem.image) cartItem.image = rewriteStoredFile(cartItem.image as any, sourcePrefix, orderPrefix) as any;
    cartItem.finalPrintFiles = [] as any;
    cartItem.printGenerationCompletedPages = 0;
    cartItem.printGenerationCurrentPage = 0;
    await cartItem.save();
    cartItem.finalPrintFiles = await generateFinalPrintImages(cartItem as any, orderPrefix) as any;
    cartItem.printGenerationStatus = 'complete';
    cartItem.printGenerationError = '';
    cartItem.printGenerationCurrentPage = 0;
    if (shouldMarkOrdered) cartItem.orderedAt = new Date();
    cartItem.lastActivityAt = new Date();
    await cartItem.save();
    if (shouldMarkOrdered) await markProjectOrdered(cartItem, orderPrefix);
    await DesignProcessingJobModel.findByIdAndUpdate(job._id, {
      status: 'complete',
      completedAt: new Date(),
      result: {
        orderPrefix,
        designPublicUrl,
        copiedFiles,
        finalPrintFiles: cartItem.finalPrintFiles,
      },
      error: '',
    });
  } catch (error) {
    cartItem.printGenerationStatus = 'failed';
    cartItem.printGenerationError = error instanceof Error ? error.message : 'Unknown processing error';
    cartItem.lastActivityAt = new Date();
    await cartItem.save();
    await DesignProcessingJobModel.findByIdAndUpdate(job._id, {
      status: 'failed',
      completedAt: new Date(),
      error: error instanceof Error ? error.message : 'Unknown processing error',
    });
    throw error;
  }
}

async function claimDesignProcessingJob(jobId: string) {
  return DesignProcessingJobModel.findOneAndUpdate(
    {
      _id: jobId,
      status: 'pending',
      availableAt: { $lte: new Date() },
    },
    {
      $set: {
        status: 'processing',
        lockedBy: WORKER_ID,
        lockedAt: new Date(),
        startedAt: new Date(),
        error: '',
      },
      $inc: { attempts: 1 },
    },
    { new: true }
  );
}

export async function processNextDesignProcessingJob() {
  const job = await DesignProcessingJobModel.findOne({
    status: 'pending',
    availableAt: { $lte: new Date() },
  }).sort({ priority: -1, createdAt: 1 }).lean();
  if (!job) return { processed: false, message: 'No pending design processing jobs.' };
  if (designProcessingJobs.has(String(job.cartItemId))) return { processed: false, job, message: 'Job is already running in this process.' };
  enqueueDesignCartItemProcessing(String(job._id), String(job.cartItemId));
  return { processed: true, job, message: 'Design processing job queued in this process.' };
}

const DESIGN_UPLOAD_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export async function savePublicDesignUpload(input: {
  productId: string;
  merchantId: string;
  userKey: string;
  projectId?: unknown;
  productType?: unknown;
  designData?: unknown;
  file?: Express.Multer.File;
  pagePreviewFiles?: Express.Multer.File[];
  pagePreviewMeta?: unknown;
  addToCart?: unknown;
  origin: string;
}) {
  const designData = parseDesignData(input.designData);
  const pagePreviewFiles = input.pagePreviewFiles ?? [];
  const pagePreviewMeta = parsePagePreviewMeta(input.pagePreviewMeta, pagePreviewFiles.length);
  const addToCart = parseBoolean(input.addToCart);
  if (!input.file && designData === undefined && pagePreviewFiles.length === 0) throw new ApiError(400, 'Image file, page previews, or designData is required.');
  if (input.file && !DESIGN_UPLOAD_MIME_EXTENSIONS[input.file.mimetype]) throw new ApiError(400, 'Only JPG, PNG, and WebP images are allowed.');
  for (const file of pagePreviewFiles) {
    if (!DESIGN_UPLOAD_MIME_EXTENSIONS[file.mimetype]) throw new ApiError(400, 'Only JPG, PNG, and WebP page previews are allowed.');
  }

  const { merchant, product, userKey } = await resolvePublicDesignContext(input.productId, input.merchantId, input.userKey);
  const productType = normalizeDesignProductType(input.productType, product.productType);
  const project = await resolveDesignProject({ merchant, product, userKey, requestedProjectId: input.projectId });
  const prefix = project.tempStoragePrefix;
  const publicPathPrefix = `${r2PublicUrl(prefix)}/`;

  let image: Record<string, unknown> | null = null;
  if (input.file) {
    const extension = DESIGN_UPLOAD_MIME_EXTENSIONS[input.file.mimetype];
    const filename = `${Date.now()}-${randomBytes(8).toString('hex')}${extension}`;
    const storagePath = `${prefix}/images/${filename}`;
    await uploadObject({ storagePath, body: input.file.buffer, contentType: input.file.mimetype, upsert: false, cacheControl: '3600' }).catch((error) => {
      throw new ApiError(502, `R2 image upload failed: ${error instanceof Error ? error.message : 'Unknown storage error'}`);
    });
    const publicUrl = r2PublicUrl(storagePath);
    image = {
      url: publicUrl,
      publicUrl,
      storageProvider: 'r2',
      bucket: r2Bucket,
      storagePath,
      filename,
      originalName: input.file.originalname,
      mimeType: input.file.mimetype,
      size: input.file.size,
    };
  }

  if (designData !== undefined) {
    const designStoragePath = `${prefix}/design.json`;
    await uploadObject({
      storagePath: designStoragePath,
      body: Buffer.from(JSON.stringify(designData, null, 2), 'utf8'),
      contentType: 'application/json',
      upsert: true,
      cacheControl: '0',
    }).catch((error) => { throw new ApiError(502, `R2 design save failed: ${error instanceof Error ? error.message : 'Unknown storage error'}`); });
  }

  const pagePreviews = [];
  for (let index = 0; index < pagePreviewFiles.length; index += 1) {
    const file = pagePreviewFiles[index];
    const meta = pagePreviewMeta[index] ?? {};
    const extension = DESIGN_UPLOAD_MIME_EXTENSIONS[file.mimetype];
    const requestedFilename = sanitizeUploadFilename(String(meta.filename ?? file.originalname ?? `page-${index + 1}${extension}`), extension);
    const filename = requestedFilename || `page-${index + 1}${extension}`;
    const storagePath = `${prefix}/page-previews/${filename}`;
    await uploadObject({ storagePath, body: file.buffer, contentType: file.mimetype, upsert: true, cacheControl: '0' })
      .catch((error) => { throw new ApiError(502, `R2 page preview upload failed: ${error instanceof Error ? error.message : 'Unknown storage error'}`); });
    const publicUrl = r2PublicUrl(storagePath);
    pagePreviews.push({
      ...meta,
      url: publicUrl,
      publicUrl,
      storageProvider: 'r2',
      bucket: r2Bucket,
      storagePath,
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });
  }

  const designStoragePath = `${prefix}/design.json`;
  const designPublicUrl = `${publicPathPrefix}design.json`;
  const cartItem = addToCart
    ? await saveDesignCartItem({
        accountId: String(product.accountId),
        merchantId: String(merchant._id),
        productId: String(product._id),
        productType,
        userKey,
        projectId: project.projectId,
        tempStoragePrefix: prefix,
        designStoragePath,
        designPublicBaseUrl: publicPathPrefix,
        designPublicUrl,
        image,
        pagePreviews,
      })
    : null;

  return {
    ...(image ?? {}),
    image,
    // designData,
    designSaved: designData !== undefined,
    designPublicBaseUrl: publicPathPrefix,
    designPublicUrl: designData !== undefined || addToCart ? designPublicUrl : undefined,
    pagePreviews,
    addToCart,
    cartItem,
    projectId: project.projectId,
    sourceProjectId: (project as any).sourceProjectId,
    projectLocked: Boolean((project as any).requestedProjectLocked),
    projectResolutionReason: (project as any).projectResolutionReason,
    merchantId: String(merchant._id),
    productId: String(product._id),
    productType,
    userKey,
  };
}

export async function getPublicDesignWithProduct(input: { productId: string; merchantId: string; userKey: string; projectId?: unknown }) {
  const { product, merchant, userKey } = await resolvePublicDesignContext(input.productId, input.merchantId, input.userKey);
  let project = await resolveDesignProject({ merchant, product, userKey, requestedProjectId: input.projectId });
  const productData = await getPublicProductConfig(String(product._id), String(merchant._id));
  let designStoragePath = `${project.tempStoragePrefix}/design.json`;
  let designData: unknown = null;
  let designExists = false;
  try {
    const data = await downloadObject(designStoragePath);
    try {
      designData = JSON.parse(data.toString('utf8'));
      designExists = true;
    } catch {
      project = await createDesignProject({ merchant, product, userKey }, {
        requestedProjectLocked: false,
        projectResolutionReason: 'design_json_invalid',
      });
      designStoragePath = `${project.tempStoragePrefix}/design.json`;
      designData = null;
      designExists = false;
    }
  } catch {
    designExists = false;
  }
  return {
    product: productData,
    design: designData,
    designExists,
    designStoragePath: designExists ? designStoragePath : null,
    projectId: project.projectId,
    sourceProjectId: (project as any).sourceProjectId,
    projectLocked: Boolean((project as any).requestedProjectLocked),
    projectResolutionReason: (project as any).projectResolutionReason,
    merchantId: String(merchant._id),
    productId: String(product._id),
    userKey,
  };
}

async function resolvePublicDesignContext(productId: string, merchantId: string, rawUserKey: string) {
  if (!Types.ObjectId.isValid(productId)) throw new ApiError(400, 'productId must be a valid MongoDB ObjectId.');
  if (!Types.ObjectId.isValid(merchantId)) throw new ApiError(400, 'merchantId must be a valid MongoDB ObjectId.');
  const userKey = sanitizeUploadSegment(rawUserKey);
  if (!userKey) throw new ApiError(400, 'userKey is required.');

  const merchant = await MerchantModel.findOne({ _id: merchantId, status: 'active' }).lean();
  if (!merchant) throw new ApiError(404, 'Merchant not found.');

  const product = await ProductModel.findOne({
    _id: productId,
    status: 'active',
    accountId: merchant.accountId,
    $or: [{ scope: 'shared' }, { scope: 'merchant', merchantId: merchant._id }],
  }).lean();
  if (!product) throw new ApiError(404, 'Product not found.');

  return { merchant, product, userKey };
}

function parseDesignData(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      throw new ApiError(400, 'designData must be valid JSON.');
    }
  }
  return value;
}

function parsePagePreviewMeta(value: unknown, fileCount: number) {
  if (value === undefined || value === null || value === '') return [];
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new ApiError(400, 'pagePreviewMeta must be valid JSON.');
    }
  }
  if (!Array.isArray(parsed)) throw new ApiError(400, 'pagePreviewMeta must be an array.');
  if (parsed.length > fileCount) throw new ApiError(400, 'pagePreviewMeta cannot include more entries than uploaded pagePreviews files.');
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new ApiError(400, `pagePreviewMeta[${index}] must be an object.`);
    const meta = entry as Record<string, unknown>;
    return {
      pageId: meta.pageId === undefined ? undefined : String(meta.pageId),
      placementId: meta.placementId === undefined ? undefined : String(meta.placementId),
      pageNumber: meta.pageNumber === undefined || meta.pageNumber === '' ? undefined : Number(meta.pageNumber),
      filename: meta.filename === undefined ? undefined : String(meta.filename),
    };
  });
}

function parseBoolean(value: unknown) {
  if (value === true) return true;
  if (value === false || value === undefined || value === null || value === '') return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

function normalizeDesignProductType(value: unknown, fallback: unknown = 'Photo Book Print') {
  for (const candidate of [value, fallback]) {
    const raw = String(candidate ?? '').trim().toLowerCase();
    if (!raw) continue;
    if (raw.includes('t-shirt') || raw.includes('tshirt') || raw.includes('tee shirt')) return 'T-Shirt Print';
    if (raw.includes('pillow')) return 'Pillow Print';
    if (raw.includes('mug')) return 'Mug Print';
    if (raw.includes('collage')) return 'Photo Collage Print';
    if (raw.includes('book')) return 'Photo Book Print';
  }
  return 'Photo Book Print';
}

async function resolveDesignProject(input: { merchant: any; product: any; userKey: string; requestedProjectId?: unknown }) {
  const rawRequestedProjectId = String(input.requestedProjectId ?? '').trim();
  const requestedProjectId = sanitizeProjectId(input.requestedProjectId);
  if (rawRequestedProjectId && !requestedProjectId) {
    return createDesignProject(input, {
      sourceProjectId: rawRequestedProjectId.slice(0, 120),
      requestedProjectLocked: false,
      projectResolutionReason: 'requested_project_invalid',
    });
  }
  if (requestedProjectId) {
    const existing = await DesignProjectModel.findOne({
      projectId: requestedProjectId,
      merchantId: input.merchant._id,
      productId: input.product._id,
      userKey: input.userKey,
    });
    if (existing) {
      const orderedCartItem = await DesignCartItemModel.exists({
        projectId: requestedProjectId,
        merchantId: input.merchant._id,
        productId: input.product._id,
        userKey: input.userKey,
        status: 'ordered',
      });
      if (existing.status === 'ordered' || orderedCartItem) {
        return createDesignProject(input, {
          sourceProjectId: requestedProjectId,
          requestedProjectLocked: true,
          projectResolutionReason: 'ordered_project_locked',
        });
      }
      existing.lastActivityAt = new Date();
      await existing.save();
      return withDesignProjectResolution(existing, {
        sourceProjectId: requestedProjectId,
        requestedProjectLocked: false,
        projectResolutionReason: 'requested_project_loaded',
      });
    }
  }

  if (!requestedProjectId) {
    const latestDraft = await DesignProjectModel.findOne({
      merchantId: input.merchant._id,
      productId: input.product._id,
      userKey: input.userKey,
      status: 'draft',
    }).sort({ lastActivityAt: -1, updatedAt: -1 });

    if (latestDraft) {
      latestDraft.lastActivityAt = new Date();
      await latestDraft.save();
      return withDesignProjectResolution(latestDraft, {
        sourceProjectId: latestDraft.projectId,
        requestedProjectLocked: false,
        projectResolutionReason: 'latest_draft_loaded',
      });
    }
  }

  return createDesignProject(input, requestedProjectId ? {
    sourceProjectId: requestedProjectId,
    requestedProjectLocked: false,
    projectResolutionReason: 'requested_project_not_found',
  } : {
    requestedProjectLocked: false,
    projectResolutionReason: 'new_project_created',
  });
}

async function createDesignProject(
  input: { merchant: any; product: any; userKey: string },
  resolution?: { sourceProjectId?: string; requestedProjectLocked?: boolean; projectResolutionReason?: string }
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const projectId = `prj-${randomBytes(12).toString('hex')}`;
    try {
      const project = await DesignProjectModel.create({
        accountId: input.product.accountId,
        merchantId: input.merchant._id,
        productId: input.product._id,
        userKey: input.userKey,
        projectId,
        status: 'draft',
        tempStoragePrefix: designTempPrefix(String(input.merchant._id), projectId),
        lastActivityAt: new Date(),
      });
      return withDesignProjectResolution(project, resolution);
    } catch (error: any) {
      if (error?.code !== 11000 || attempt === 4) throw error;
    }
  }

  throw new ApiError(500, 'Could not create a design project.');
}

function withDesignProjectResolution(
  project: any,
  resolution?: { sourceProjectId?: string; requestedProjectLocked?: boolean; projectResolutionReason?: string }
) {
  project.sourceProjectId = resolution?.sourceProjectId;
  project.requestedProjectLocked = Boolean(resolution?.requestedProjectLocked);
  project.projectResolutionReason = resolution?.projectResolutionReason;
  return project;
}

async function saveDesignCartItem(input: {
  accountId: string;
  merchantId: string;
  productId: string;
  productType: string;
  userKey: string;
  projectId: string;
  tempStoragePrefix: string;
  designStoragePath: string;
  designPublicBaseUrl: string;
  designPublicUrl: string;
  image: Record<string, unknown> | null;
  pagePreviews: Record<string, unknown>[];
}) {
  const now = new Date();
  const payload = {
    accountId: new Types.ObjectId(input.accountId),
    merchantId: new Types.ObjectId(input.merchantId),
    productId: new Types.ObjectId(input.productId),
    productType: normalizeDesignProductType(input.productType),
    userKey: input.userKey,
    projectId: input.projectId,
    status: 'cart',
    designStoragePath: input.designStoragePath,
    designPublicBaseUrl: input.designPublicBaseUrl,
    designPublicUrl: input.designPublicUrl,
    tempStoragePrefix: input.tempStoragePrefix,
    image: input.image ?? undefined,
    pagePreviews: input.pagePreviews,
    printGenerationStatus: 'pending',
    printGenerationError: '',
    addedToCartAt: now,
    lastActivityAt: now,
  };
  return DesignCartItemModel.findOneAndUpdate(
    {
      merchantId: payload.merchantId,
      productId: payload.productId,
      userKey: input.userKey,
      projectId: input.projectId,
      status: 'cart',
    },
    { $set: payload },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean().then(async (cartItem) => {
    await DesignProjectModel.findOneAndUpdate(
      { projectId: input.projectId },
      {
        $set: {
          cartItemId: cartItem._id,
          status: 'cart',
          lastActivityAt: new Date(),
        },
      }
    );
    return cartItem;
  });
}

function designTempPrefix(merchantId: string, projectId: string) {
  return `designs/tmp/${merchantId}/${projectId}`;
}

function designOrderPrefix(merchantId: string, orderId: string, productId: string) {
  return `designs/orders/${merchantId}/${orderId}/${productId}`;
}

async function copyStoragePrefix(sourcePrefix: string, destinationPrefix: string) {
  let files = (await listObjects(sourcePrefix)).map((file) => file.key);
  let sourceProvider: StorageProvider = 'r2';
  if (files.length === 0 && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    files = await listLegacySupabaseObjects(sourcePrefix);
    sourceProvider = 'supabase';
  }
  if (files.length === 0) throw new ApiError(400, 'No design files found to process.');
  const copiedFiles: Array<{ source: string; destination: string }> = [];
  for (const source of files) {
    const relativePath = source.slice(sourcePrefix.length).replace(/^\/+/, '');
    const destination = `${destinationPrefix}/${relativePath}`;
    await deleteObjects([destination]);
    if (sourceProvider === 'r2') await copyObject(source, destination);
    else {
      const body = await downloadObject(source, { provider: 'supabase', bucket: galleryBucket });
      await uploadObject({ storagePath: destination, body, upsert: true });
    }
    copiedFiles.push({ source, destination });
  }
  return copiedFiles;
}

function rewriteStoredFile(file: Record<string, any>, sourcePrefix: string, destinationPrefix: string) {
  const storagePath = String(file.storagePath ?? '');
  if (!storagePath.startsWith(sourcePrefix)) return file;
  const nextStoragePath = `${destinationPrefix}${storagePath.slice(sourcePrefix.length)}`;
  const publicUrl = r2PublicUrl(nextStoragePath);
  return {
    ...file,
    url: publicUrl,
    publicUrl,
    storageProvider: 'r2',
    bucket: r2Bucket,
    storagePath: nextStoragePath,
  };
}

async function generateFinalPrintImages(cartItem: Record<string, any>, orderPrefix: string) {
  const design = await readDesignJsonFromStorage(String(cartItem.designStoragePath));
  const product = await ProductModel.findById(cartItem.productId).lean();
  const pages = resolveFinalPrintPages(design, cartItem, product);
  if (pages.length === 0) throw new ApiError(400, 'No pages are available for final print generation.');
  const rasterOutput = resolveFinalPrintRasterOutput(design, product);
  const output = [];
  const generationVersion = Date.now().toString(36);
  cartItem.printGenerationTotalPages = pages.length;
  cartItem.printGenerationCompletedPages = 0;
  cartItem.printGenerationCurrentPage = 0;
  await cartItem.save();

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const filename = replaceFilenameExtension(page.filename, rasterOutput.extension);
    const storagePath = `${orderPrefix}/final-prints/${filename}`;
    const buffer = await renderDesignPageToImageBuffer({
      design,
      page,
      cartItem,
      widthPx: page.widthPx,
      heightPx: page.heightPx,
      format: rasterOutput.rendererFormat,
      quality: rasterOutput.quality / 100,
      transparentBackground: rasterOutput.transparentBackground,
    });
    const alternateStoragePath = `${orderPrefix}/final-prints/${replaceFilenameExtension(
      page.filename,
      rasterOutput.extension === 'jpg' ? 'png' : 'jpg',
    )}`;
    await deleteObjects([storagePath, alternateStoragePath]);
    await uploadObject({ storagePath, body: buffer, contentType: rasterOutput.mimeType, upsert: true, cacheControl: '0' })
      .catch((error) => { throw new ApiError(502, `Final print generation upload failed: ${error instanceof Error ? error.message : 'Unknown storage error'}`); });
    const publicUrl = appendUrlQuery(r2PublicUrl(storagePath), 'v', generationVersion);
    const file = {
      url: publicUrl,
      publicUrl,
      storageProvider: 'r2',
      bucket: r2Bucket,
      storagePath,
      filename,
      originalName: filename,
      mimeType: rasterOutput.mimeType,
      size: buffer.length,
    };
    output.push(file);
    cartItem.finalPrintFiles = output as any;
    cartItem.printGenerationStatus = 'processing';
    cartItem.printGenerationCurrentPage = page.pageNumber;
    cartItem.printGenerationCompletedPages = output.length;
    cartItem.lastActivityAt = new Date();
    await cartItem.save();
  }
  return output;
}

function resolveFinalPrintRasterOutput(design: unknown, product: any) {
  const designRecord = isRecordLike(design) ? design : {};
  const nestedDesign = isRecordLike(designRecord.design) ? designRecord.design : {};
  const designProduct = isRecordLike(designRecord.product)
    ? designRecord.product
    : isRecordLike(nestedDesign.product)
      ? nestedDesign.product
      : {};
  const designRules = isRecordLike(designRecord.exportRules)
    ? designRecord.exportRules
    : isRecordLike(nestedDesign.exportRules)
      ? nestedDesign.exportRules
    : isRecordLike(designProduct.exportRules)
      ? designProduct.exportRules
      : {};
  const productRules = isRecordLike(product?.exportRules) ? product.exportRules : {};
  const transparentBackground = designRules.transparentBackground === true
    || (designRules.transparentBackground === undefined && productRules.transparentBackground === true);
  const configuredFormat = String(designRules.format ?? productRules.format ?? 'PDF').toUpperCase();
  const usePng = transparentBackground || configuredFormat === 'PNG';
  const quality = clamp(
    positiveNumber(designRules.rasterQuality, positiveNumber(productRules.rasterQuality, 94)),
    1,
    100,
  );

  return usePng
    ? {
        rendererFormat: 'png' as const,
        extension: 'png',
        mimeType: 'image/png',
        quality,
        transparentBackground,
      }
    : {
        rendererFormat: 'jpeg' as const,
        extension: 'jpg',
        mimeType: 'image/jpeg',
        quality,
        transparentBackground: false,
      };
}

function replaceFilenameExtension(filename: string, extension: string) {
  const normalized = String(filename || 'final-print').replace(/\.[^.]+$/, '');
  return `${normalized}.${extension}`;
}

function appendUrlQuery(url: string, key: string, value: string) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

async function readDesignJsonFromStorage(storagePath: string) {
  const data = await downloadObject(storagePath).catch((error) => {
    throw new ApiError(502, `Design storage read failed: ${error instanceof Error ? error.message : 'Unknown storage error'} ${storagePath}`);
  });
  if (!data.length) throw new ApiError(400, 'Saved design file is empty.');
  try {
    return JSON.parse(data.toString('utf8'));
  } catch {
    throw new ApiError(400, 'Saved design JSON is invalid.');
  }
}

function resolveFinalPrintPages(design: unknown, cartItem: Record<string, any>, product: any) {
  const designRecord = isRecordLike(design) ? design : {};
  const designPages = getDesignPages(designRecord);
  const previews = Array.isArray(cartItem.pagePreviews) ? [...cartItem.pagePreviews] : [];
  previews.sort((a, b) => Number(a.pageNumber ?? 0) - Number(b.pageNumber ?? 0));
  const selectedVariant = resolveFinalPrintVariant(designRecord, product);
  const dpi = positiveNumber(
    selectedVariant?.dpi,
    positiveNumber((designRecord as any).exportRules?.dpi, positiveNumber(product?.exportRules?.dpi, 300))
  );
  const sourcePages: Record<string, any>[] = designPages.length > 0 ? designPages : previews.map((preview, index) => ({ pageNumber: Number(preview.pageNumber ?? index + 1), pageId: preview.pageId }));
  const productType = normalizeDesignProductType(product?.productType, cartItem.productType);
  if (productType === 'T-Shirt Print') {
    const placements = Array.isArray(product?.tshirt?.placements) ? product.tshirt.placements : [];
    const placementById = new Map<string, Record<string, any>>(
      placements.map((placement: Record<string, any>) => [String(placement.id).toLowerCase(), placement])
    );
    const nestedDesign = isRecordLike(designRecord.design) ? designRecord.design : {};
    const configuredDesignedPlacements = Array.isArray(designRecord.tshirtPlacements)
      ? designRecord.tshirtPlacements
      : Array.isArray(nestedDesign.tshirtPlacements)
        ? nestedDesign.tshirtPlacements
        : [];
    const designedPlacementIds = new Set<string>(
      configuredDesignedPlacements
        .map((item: unknown) => String(isRecordLike(item) ? item.id ?? item.placementId ?? '' : item).trim().toLowerCase())
        .filter(Boolean)
    );
    if (designedPlacementIds.size === 0) {
      for (const preview of previews) {
        const placementId = String(preview.placementId ?? '').trim().toLowerCase();
        if (placementId) designedPlacementIds.add(placementId);
      }
    }
    const placementIdFor = (page: Record<string, any>, index: number) => {
      const preview = previews.find((item) => String(item.pageId ?? '') === String(page.pageId ?? page.id ?? page._id ?? '')) ?? previews[index];
      const explicit = String(page.placementId ?? preview?.placementId ?? '').trim();
      if (explicit) return explicit;
      const pageId = String(page.pageId ?? page.id ?? page._id ?? '').trim();
      return pageId.toLowerCase().startsWith('tshirt-') ? pageId.slice(7) : pageId;
    };
    return sourcePages.flatMap((page, index) => {
      const placementId = placementIdFor(page, index);
      if (designedPlacementIds.size > 0 && !designedPlacementIds.has(placementId.toLowerCase())) return [];
      const placement = placementById.get(placementId.toLowerCase());
      if (!placement) return [];
      const pageNumber = positiveInteger(page.pageNumber, index + 1);
      const pageId = String(page.pageId ?? page._id ?? page.id ?? `tshirt-${placement.id}`);
      const preview = previews.find((item) => String(item.placementId ?? '').toLowerCase() === placementId.toLowerCase())
        ?? previews.find((item) => String(item.pageId ?? '') === pageId)
        ?? previews[index];
      return [{
        ...page,
        placementId: placement.id,
        pageNumber,
        printPageNumber: index + 1,
        pageRole: `tshirt-${placement.id}`,
        filename: `final-tshirt-${sanitizeUploadSegment(String(placement.id))}.png`,
        pageId,
        previewUrl: String(preview?.publicUrl ?? preview?.url ?? ''),
        dpi,
        backgroundColor: typeof page.backgroundColor === 'string' ? page.backgroundColor : typeof (designRecord as any).backgroundColor === 'string' ? (designRecord as any).backgroundColor : '#ffffff',
        ...finalPrintAreaDimensions(placement.printArea, dpi),
      }];
    });
  }
  if (productType === 'Photo Collage Print') {
    const page = sourcePages[0] ?? {};
    const pageNumber = positiveInteger(page.pageNumber, 1);
    const pageId = String(page.pageId ?? page._id ?? page.id ?? `page-${pageNumber}`);
    const preview = previews.find((item) => String(item.pageId ?? '') === pageId) ?? previews[0];
    const previewUrl = String(preview?.publicUrl ?? preview?.url ?? '');
    const dimensions = finalPrintDimensions(page, designRecord, dpi, selectedVariant);
    return [{
      ...page,
      pageNumber,
      printPageNumber: 1,
      pageRole: 'collage',
      filename: finalPrintFilename('collage', 1, pageNumber),
      pageId,
      previewUrl,
      dpi,
      backgroundColor: typeof page.backgroundColor === 'string' ? page.backgroundColor : typeof (designRecord as any).backgroundColor === 'string' ? (designRecord as any).backgroundColor : '#ffffff',
      ...dimensions,
    }];
  }
  if (productType === 'Mug Print') {
    const page = sourcePages[0] ?? {};
    const pageNumber = positiveInteger(page.pageNumber, 1);
    const pageId = String(page.pageId ?? page._id ?? page.id ?? 'mug-wrap');
    const preview = previews.find((item) => String(item.pageId ?? '') === pageId) ?? previews[0];
    return [{
      ...page,
      pageNumber,
      printPageNumber: 1,
      pageRole: 'mug-wrap',
      filename: 'final-mug-wrap.png',
      pageId,
      previewUrl: String(preview?.publicUrl ?? preview?.url ?? ''),
      dpi,
      backgroundColor: typeof page.backgroundColor === 'string' ? page.backgroundColor : typeof (designRecord as any).backgroundColor === 'string' ? (designRecord as any).backgroundColor : '#ffffff',
      ...finalPrintDimensions(page, designRecord, dpi, selectedVariant, 'mug'),
    }];
  }
  if (productType === 'Pillow Print') {
    return sourcePages.slice(0, 2).map((page, index) => {
      const pageNumber = positiveInteger(page.pageNumber, index + 1);
      const side = String(page.side ?? page.pageRole ?? (index === 0 ? 'front' : 'back')).toLowerCase() === 'back' ? 'back' : 'front';
      const pageId = String(page.pageId ?? page._id ?? page.id ?? `pillow-${side}`);
      const preview = previews.find((item) => String(item.pageId ?? '') === pageId)
        ?? previews.find((item) => Number(item.pageNumber) === pageNumber)
        ?? previews[index];
      return {
        ...page,
        pageNumber,
        printPageNumber: index + 1,
        pageRole: `pillow-${side}`,
        filename: `final-pillow-${side}.png`,
        pageId,
        previewUrl: String(preview?.publicUrl ?? preview?.url ?? ''),
        dpi,
        backgroundColor: typeof page.backgroundColor === 'string' ? page.backgroundColor : typeof (designRecord as any).backgroundColor === 'string' ? (designRecord as any).backgroundColor : '#ffffff',
        ...finalPrintDimensions(page, designRecord, dpi, selectedVariant, 'pillow'),
      };
    });
  }
  const pages = [];
  for (let index = 0; index < sourcePages.length; index += 1) {
    const page = sourcePages[index];
    const pageNumber = positiveInteger(page.pageNumber, index + 1);
    const pageRole = getPhotoBookPageRole(index, sourcePages.length);
    if (pageRole !== 'interior') continue;
    const printPageNumber = index;
    const pageId = String(page.pageId ?? page._id ?? page.id ?? `page-${pageNumber}`);
    const preview = previews.find((item) => String(item.pageId ?? '') === pageId) ?? previews.find((item) => Number(item.pageNumber) === printPageNumber) ?? previews[printPageNumber - 1];
    const previewUrl = String(preview?.publicUrl ?? preview?.url ?? '');
    const dimensions = finalPrintDimensions(page, designRecord, dpi, selectedVariant);
    pages.push({
      ...page,
      pageNumber,
      printPageNumber,
      pageRole,
      filename: finalPrintFilename(pageRole, printPageNumber, pageNumber),
      pageId,
      previewUrl,
      dpi,
      backgroundColor: typeof page.backgroundColor === 'string' ? page.backgroundColor : typeof (designRecord as any).backgroundColor === 'string' ? (designRecord as any).backgroundColor : '#ffffff',
      ...dimensions,
    });
  }
  return pages;
}

function getPhotoBookPageRole(index: number, totalPages: number) {
  if (index === 0) return 'front-cover';
  if (totalPages > 1 && index === totalPages - 1) return 'back-cover';
  return 'interior';
}

function finalPrintFilename(pageRole: string, printPageNumber: number, sourcePageNumber: number) {
  if (pageRole === 'collage') return 'final-collage.png';
  if (pageRole === 'front-cover') return 'final-cover-front.png';
  if (pageRole === 'back-cover') return 'final-cover-back.png';
  return `final-page-${positiveInteger(printPageNumber, sourcePageNumber)}.png`;
}

function getDesignPages(design: Record<string, unknown>) {
  if (Array.isArray(design.pages)) return design.pages.filter(isRecordLike);
  if (isRecordLike(design.design) && Array.isArray(design.design.pages)) return design.design.pages.filter(isRecordLike);
  if (isRecordLike(design.book) && Array.isArray(design.book.pages)) return design.book.pages.filter(isRecordLike);
  return [];
}

function finalPrintAreaDimensions(printArea: Record<string, any>, dpi: number) {
  const bleed = isRecordLike(printArea?.bleed) ? printArea.bleed : {};
  const width = positiveNumber(printArea?.width, 12) + nonNegativeNumber(bleed.left) + nonNegativeNumber(bleed.right);
  const height = positiveNumber(printArea?.height, 16) + nonNegativeNumber(bleed.top) + nonNegativeNumber(bleed.bottom);
  const unit = String(printArea?.unit ?? 'inch').toLowerCase();
  if (unit === 'mm') return { widthPx: Math.round((width / 25.4) * dpi), heightPx: Math.round((height / 25.4) * dpi) };
  if (unit === 'cm') return { widthPx: Math.round((width / 2.54) * dpi), heightPx: Math.round((height / 2.54) * dpi) };
  return { widthPx: Math.round(width * dpi), heightPx: Math.round(height * dpi) };
}

function resolveFinalPrintVariant(design: Record<string, unknown>, product: any) {
  const nestedDesign = isRecordLike(design.design) ? design.design : {};
  const designProduct = isRecordLike(design.product)
    ? design.product
    : isRecordLike(nestedDesign.product)
      ? nestedDesign.product
      : {};
  const selectedVariantId = String(
    designProduct.variantId
      ?? designProduct.sizeId
      ?? design.variantId
      ?? design.selectedVariantId
      ?? nestedDesign.variantId
      ?? nestedDesign.selectedVariantId
      ?? ''
  ).trim();
  if (!selectedVariantId) return undefined;

  const currentVariant = Array.isArray(product?.variants)
    ? product.variants.find((variant: any) => String(variant?._id ?? variant?.id ?? '') === selectedVariantId)
    : undefined;
  if (currentVariant && hasValidVariantDimensions(currentVariant)) return currentVariant;

  const productConfig = isRecordLike(design.productConfig)
    ? design.productConfig
    : isRecordLike(nestedDesign.productConfig)
      ? nestedDesign.productConfig
      : {};
  const savedVariant = Array.isArray(productConfig.variants)
    ? productConfig.variants.find((variant: any) => String(variant?._id ?? variant?.id ?? '') === selectedVariantId)
    : undefined;
  return savedVariant && hasValidVariantDimensions(savedVariant) ? savedVariant : undefined;
}

function hasValidVariantDimensions(variant: Record<string, unknown>) {
  return Number.isFinite(Number(variant.width))
    && Number(variant.width) > 0
    && Number.isFinite(Number(variant.height))
    && Number(variant.height) > 0;
}

function finalPrintDimensions(
  page: Record<string, unknown>,
  design: Record<string, unknown>,
  dpi: number,
  selectedVariant?: Record<string, unknown>,
  printAreaType?: 'pillow' | 'mug',
) {
  const variantConfig = printAreaType && isRecordLike(selectedVariant?.[printAreaType])
    ? selectedVariant[printAreaType]
    : undefined;
  const printArea = variantConfig && isRecordLike(variantConfig.printArea) ? variantConfig.printArea : undefined;
  const printBleed = printArea && isRecordLike(printArea.bleed) ? printArea.bleed : {};
  const unit = String(printArea?.unit ?? selectedVariant?.unit ?? page.unit ?? design.unit ?? 'inch').trim().toLowerCase();
  const width = printArea
    ? positiveNumber(printArea.width, 12) + nonNegativeNumber(printBleed.left) + nonNegativeNumber(printBleed.right)
    : selectedVariant
      ? positiveNumber(selectedVariant.width, 12)
    : positiveNumber(page.width, positiveNumber(page.canvasWidth, positiveNumber(design.pageWidth, positiveNumber(design.canvasWidth, 12))));
  const height = printArea
    ? positiveNumber(printArea.height, 12) + nonNegativeNumber(printBleed.top) + nonNegativeNumber(printBleed.bottom)
    : selectedVariant
      ? positiveNumber(selectedVariant.height, 12)
    : positiveNumber(page.height, positiveNumber(page.canvasHeight, positiveNumber(design.pageHeight, positiveNumber(design.canvasHeight, 12))));
  if (unit === 'px') return { widthPx: Math.round(width), heightPx: Math.round(height) };
  if (unit === 'mm') return { widthPx: Math.round((width / 25.4) * dpi), heightPx: Math.round((height / 25.4) * dpi) };
  if (unit === 'cm') return { widthPx: Math.round((width / 2.54) * dpi), heightPx: Math.round((height / 2.54) * dpi) };
  return { widthPx: Math.round(width * dpi), heightPx: Math.round(height * dpi) };
}

function positiveNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function nonNegativeNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function positiveInteger(value: unknown, fallback: number) {
  const numeric = Math.round(Number(value));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function isRecordLike(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}


function sanitizeUploadSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}

function sanitizeProjectId(value: unknown) {
  const projectId = String(value ?? '').trim();
  if (!/^[a-zA-Z0-9_-]{8,120}$/.test(projectId)) return '';
  return projectId;
}

function zipFilename(value: string) {
  const filename = value.trim().replace(/[^a-zA-Z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160);
  return filename.toLowerCase().endsWith('.zip') ? filename : `${filename || 'final-prints'}.zip`;
}

function sanitizeZipEntryName(value: string) {
  const filename = value.trim().replace(/[\\/]+/g, '-').replace(/[^a-zA-Z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160);
  return filename || `final-print-${Date.now()}.svg`;
}

function sanitizeUploadFilename(value: string, fallbackExtension: string) {
  const raw = value.trim();
  const dotIndex = raw.lastIndexOf('.');
  const base = (dotIndex > 0 ? raw.slice(0, dotIndex) : raw)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || `preview-${Date.now()}`;
  const extension = (dotIndex > 0 ? raw.slice(dotIndex).toLowerCase() : fallbackExtension).replace(/[^a-z0-9.]/g, '');
  return `${base}${extension || fallbackExtension}`;
}
export async function calculatePrice(
  id: string,
  variantId: string,
  selectedOptions: Record<string, string>,
  designedPlacements: Array<string | { id?: string }> = [],
) {
  const product = await ProductModel.findById(id).lean();
  if (!product) throw new ApiError(404, 'Product not found.');
  const variant = product.variants.find((item: any) => String(item._id) === variantId);
  if (!variant) throw new ApiError(404, 'Variant not found.');
  const selections: Array<{ group: any; optionValue: any }> = [];
  for (const group of product.optionGroups ?? []) {
    const selected = selectedOptions[group.code];
    if (!selected) continue;
    const optionValue = group.values.find((value: any) => value.isActive !== false && value.value === selected);
    if (optionValue) selections.push({ group, optionValue });
  }

  const overrides = selections.filter(({ optionValue }) => optionValue.priceModifierType === 'variant-override');
  if (overrides.length > 1) throw new ApiError(400, 'Only one selected option may override the variant price.');

  let resolvedVariantPrice = variant.price;
  const modifiers: Array<{ groupCode: string; value: string; type: string; amount: number; price?: number }> = [];
  if (overrides[0]) {
    const { group, optionValue } = overrides[0];
    const overridePrice = getVariantConfiguredPrice(optionValue, variant.options ?? {}, group.code);
    if (!Number.isFinite(overridePrice) || overridePrice < 0) {
      throw new ApiError(400, `Variant ${variant.sku} must have a nonnegative numeric _${optionValue.value} or _${group.code} price override.`);
    }
    resolvedVariantPrice = overridePrice;
    modifiers.push({ groupCode: group.code, value: optionValue.value, type: 'variant-override', amount: overridePrice - variant.price, price: overridePrice });
  }

  for (const { group, optionValue } of selections) {
    if (optionValue.priceModifierType === 'variant-override') continue;
    const amount = applyModifier(resolvedVariantPrice, optionValue, variant.options ?? {}, group.code);
    if (!Number.isFinite(amount)) {
      throw new ApiError(400, `Variant ${variant.sku} must have a numeric _${optionValue.value} or _${group.code} option for variant-dependent pricing.`);
    }
    modifiers.push({ groupCode: group.code, value: optionValue.value, type: optionValue.priceModifierType, amount });
  }
  const modifierTotal = modifiers.reduce((sum, item) => sum + item.amount, 0);
  const placementModifiers: Array<{ placementId: string; label: string; amount: number }> = [];
  if (product.productType === 'T-Shirt Print') {
    const requestedIds = [...new Set((Array.isArray(designedPlacements) ? designedPlacements : []).map((item) => String(typeof item === 'string' ? item : item?.id ?? '').trim().toLowerCase()).filter(Boolean))];
    const configured = new Map((product.tshirt?.placements ?? []).map((placement: any) => [String(placement.id).toLowerCase(), placement]));
    for (const placementId of requestedIds) {
      const placement = configured.get(placementId) as any;
      if (!placement) throw new ApiError(400, `Unknown T-shirt placement "${placementId}".`);
      placementModifiers.push({ placementId: placement.id, label: placement.label, amount: Number(placement.additionalPrice ?? 0) });
    }
  }
  const placementTotal = placementModifiers.reduce((sum, item) => sum + item.amount, 0);
  return {
    basePrice: variant.price,
    resolvedVariantPrice,
    modifiers,
    placementModifiers,
    placementTotal,
    finalPrice: Math.round((variant.price + modifierTotal + placementTotal) * 100) / 100,
  };
}

function stripIds<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripIds) as T;
  if (value instanceof Types.ObjectId || value instanceof Date || Buffer.isBuffer(value)) return value;
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === '_id' || key === '__v' || key === 'createdAt' || key === 'updatedAt') continue;
      output[key] = stripIds(child);
    }
    return output as T;
  }
  return value;
}

