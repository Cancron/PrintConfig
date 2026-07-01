import type { LegacyVariantRoomPreview, Product, ProductRoomPreview, ProductUnit, ProductVariant, RoomOrientation } from '../types';
import type { ValidationErrors } from './validation';

export const ROOM_ORIENTATIONS: RoomOrientation[] = ['square', 'vertical', 'horizontal', 'pano-vertical', 'pano-horizontal'];

export function convertToMeters(value: number, unit: ProductUnit) {
  if (!Number.isFinite(value) || value <= 0 || unit === 'px') return null;
  return unit === 'mm' ? value / 1000 : value * 0.0254;
}

export function getVariantRoomOrientation(variant: Pick<ProductVariant, 'options' | 'width' | 'height'>): RoomOrientation {
  const entry = Object.entries(variant.options ?? {}).find(([key]) => key.trim().toLowerCase() === 'orientation');
  const value = String(entry?.[1] ?? '').trim().toLowerCase().replace(/[ _]+/g, '-');
  if (value === 'square') return 'square';
  if (value === 'portrait' || value === 'vertical') return 'vertical';
  if (value === 'landscape' || value === 'horizontal') return 'horizontal';
  if (value === 'pano-vertical' || value === 'panorama-vertical' || value === 'vertical-panorama') return 'pano-vertical';
  if (value === 'pano-horizontal' || value === 'panorama-horizontal' || value === 'horizontal-panorama') return 'pano-horizontal';
  return orientationFromDimensions(variant.width, variant.height);
}

export function orientationFromDimensions(width: number, height: number): RoomOrientation {
  if (!(width > 0) || !(height > 0) || width === height) return 'square';
  if (height / width >= 3) return 'pano-vertical';
  if (width / height >= 3) return 'pano-horizontal';
  return width < height ? 'vertical' : 'horizontal';
}

export function compatibleRooms(rooms: ProductRoomPreview[], variant: ProductVariant | undefined) {
  if (!variant) return [];
  const orientation = getVariantRoomOrientation(variant);
  return [...rooms].filter((room) => room.orientations.includes(orientation)).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function calculateSharedOverlay(
  variant: ProductVariant,
  room: ProductRoomPreview,
  allVariants: ProductVariant[],
  displayedImageWidth: number,
  displayedImageHeight: number,
) {
  if (!(displayedImageWidth > 0) || !(displayedImageHeight > 0)) return null;
  const orientation = getVariantRoomOrientation(variant);
  const matching = allVariants.filter((item) => getVariantRoomOrientation(item) === orientation);
  const boxWidthPx = displayedImageWidth * room.maxWidthPercent / 100;
  const boxHeightPx = displayedImageHeight * room.maxHeightPercent / 100;
  const widthMeters = convertToMeters(variant.width, variant.unit);
  const heightMeters = convertToMeters(variant.height, variant.unit);
  let widthPx: number;
  let heightPx: number;

  const physical = matching.map((item) => ({
    width: convertToMeters(item.width, item.unit),
    height: convertToMeters(item.height, item.unit),
  })).filter((item): item is { width: number; height: number } => item.width !== null && item.height !== null);

  if (widthMeters !== null && heightMeters !== null && physical.length > 0) {
    const maxWidthMeters = Math.max(...physical.map((item) => item.width));
    const maxHeightMeters = Math.max(...physical.map((item) => item.height));
    const pixelsPerMeter = Math.min(boxWidthPx / maxWidthMeters, boxHeightPx / maxHeightMeters);
    widthPx = widthMeters * pixelsPerMeter;
    heightPx = heightMeters * pixelsPerMeter;
  } else {
    const ratio = variant.width > 0 && variant.height > 0 ? variant.width / variant.height : 1;
    widthPx = boxWidthPx;
    heightPx = widthPx / ratio;
    if (heightPx > boxHeightPx) {
      heightPx = boxHeightPx;
      widthPx = heightPx * ratio;
    }
  }

  return {
    widthPx,
    heightPx,
    widthPercent: widthPx / displayedImageWidth * 100,
    heightPercent: heightPx / displayedImageHeight * 100,
    style: {
      left: `${room.centerLeftPercent - (widthPx / displayedImageWidth * 100) / 2}%`,
      top: `${room.centerTopPercent - (heightPx / displayedImageHeight * 100) / 2}%`,
      width: `${widthPx / displayedImageWidth * 100}%`,
      height: `${heightPx / displayedImageHeight * 100}%`,
    },
  };
}

export function validateRoomPreview(room: ProductRoomPreview): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!room.name.trim()) errors.name = 'Preview name is required.';
  if (!room.roomImageUrl.trim()) errors.roomImageUrl = 'Room image URL is required.';
  else {
    try {
      const url = new URL(room.roomImageUrl);
      if (!['http:', 'https:'].includes(url.protocol)) errors.roomImageUrl = 'Use a valid HTTP or HTTPS URL.';
    } catch {
      errors.roomImageUrl = 'Use a valid image URL.';
    }
  }
  if (room.orientations.length === 0) errors.orientations = 'Select at least one orientation.';
  if (room.defaultOrientations.some((orientation) => !room.orientations.includes(orientation))) errors.defaultOrientations = 'Defaults must also be supported orientations.';
  if (!inPercentRange(room.centerLeftPercent)) errors.centerLeftPercent = 'Use a value between 0 and 100.';
  if (!inPercentRange(room.centerTopPercent)) errors.centerTopPercent = 'Use a value between 0 and 100.';
  if (!positivePercent(room.maxWidthPercent)) errors.maxWidthPercent = 'Max width must be greater than zero and no more than 100.';
  if (!positivePercent(room.maxHeightPercent)) errors.maxHeightPercent = 'Max height must be greater than zero and no more than 100.';
  if (room.centerLeftPercent - room.maxWidthPercent / 2 < 0 || room.centerLeftPercent + room.maxWidthPercent / 2 > 100) errors.centerLeftPercent = 'The rectangle must stay inside the image.';
  if (room.centerTopPercent - room.maxHeightPercent / 2 < 0 || room.centerTopPercent + room.maxHeightPercent / 2 > 100) errors.centerTopPercent = 'The rectangle must stay inside the image.';
  if (!Number.isFinite(room.sortOrder)) errors.sortOrder = 'Sort order must be numeric.';
  return errors;
}

export function createRoomPreview(productId: string, sortOrder: number): ProductRoomPreview {
  const now = new Date().toISOString();
  return {
    _id: '', clientId: crypto.randomUUID(), productId, name: '', roomImageUrl: '', orientations: [], defaultOrientations: [],
    centerLeftPercent: 50, centerTopPercent: 45, maxWidthPercent: 30, maxHeightPercent: 30, sortOrder, createdAt: now, updatedAt: now,
  };
}

export function normalizeSharedRoomPreview(input: Partial<ProductRoomPreview>, productId: string, index: number): ProductRoomPreview {
  const now = new Date().toISOString();
  return {
    _id: input._id ? String(input._id) : '',
    clientId: input.clientId ?? crypto.randomUUID(),
    productId,
    name: String(input.name ?? ''),
    roomImageUrl: String(input.roomImageUrl ?? ''),
    roomImageAssetId: input.roomImageAssetId ? String(input.roomImageAssetId) : undefined,
    orientations: normalizeOrientations(input.orientations),
    defaultOrientations: normalizeOrientations(input.defaultOrientations),
    centerLeftPercent: finiteOr(input.centerLeftPercent, 50),
    centerTopPercent: finiteOr(input.centerTopPercent, 45),
    maxWidthPercent: finiteOr(input.maxWidthPercent, 30),
    maxHeightPercent: finiteOr(input.maxHeightPercent, 30),
    sortOrder: finiteOr(input.sortOrder, index),
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

export function liftLegacyRoomPreviews(product: Product): ProductRoomPreview[] {
  const existing = (product.roomPreviews ?? []).map((room, index) => normalizeSharedRoomPreview(room, product._id, index));
  const rooms = [...existing];
  const byIdentity = new Map(rooms.map((room) => [roomIdentity(room.name, room.roomImageUrl), room]));
  const claimedDefaults = new Set(rooms.flatMap((room) => room.defaultOrientations));

  for (const variant of product.variants) {
    const orientation = getVariantRoomOrientation(variant);
    for (const legacy of variant.roomPreviews ?? []) {
      const key = roomIdentity(legacy.name, legacy.roomImageUrl);
      const matched = byIdentity.get(key);
      if (matched) {
        if (!matched.orientations.includes(orientation)) matched.orientations.push(orientation);
        if (legacy.isDefault && !claimedDefaults.has(orientation)) {
          matched.defaultOrientations.push(orientation);
          claimedDefaults.add(orientation);
        }
        continue;
      }
      const placement = legacyPlacement(legacy, variant, product.variants, orientation);
      const room = normalizeSharedRoomPreview({
        name: legacy.name,
        roomImageUrl: legacy.roomImageUrl,
        roomImageAssetId: legacy.roomImageAssetId,
        orientations: [orientation],
        defaultOrientations: legacy.isDefault && !claimedDefaults.has(orientation) ? [orientation] : [],
        centerLeftPercent: legacy.centerLeftPercent,
        centerTopPercent: legacy.centerTopPercent,
        maxWidthPercent: placement.width,
        maxHeightPercent: placement.height,
        sortOrder: rooms.length,
        createdAt: legacy.createdAt,
        updatedAt: legacy.updatedAt,
      }, product._id, rooms.length);
      if (room.defaultOrientations.length) claimedDefaults.add(orientation);
      rooms.push(room);
      byIdentity.set(key, room);
    }
  }
  return rooms;
}

export function roomPreviewKey(room: Pick<ProductRoomPreview, '_id' | 'clientId'>) {
  return room._id || room.clientId || '';
}

function legacyPlacement(legacy: LegacyVariantRoomPreview, variant: ProductVariant, variants: ProductVariant[], orientation: RoomOrientation) {
  const width = convertToMeters(variant.width, variant.unit);
  const height = convertToMeters(variant.height, variant.unit);
  if (width === null || height === null || !(legacy.roomWidthMeters > 0) || !(legacy.zoom > 0)) return { width: 30, height: 30 };
  const matching = variants.filter((item) => getVariantRoomOrientation(item) === orientation);
  const widths = matching.map((item) => convertToMeters(item.width, item.unit)).filter((value): value is number => value !== null);
  const heights = matching.map((item) => convertToMeters(item.height, item.unit)).filter((value): value is number => value !== null);
  const oldWidth = width / legacy.roomWidthMeters * 100 * legacy.zoom;
  const oldHeight = height / legacy.roomWidthMeters * 100 * legacy.zoom;
  return {
    width: clamp(oldWidth * ((widths.length ? Math.max(...widths) : width) / width), 1, 100),
    height: clamp(oldHeight * ((heights.length ? Math.max(...heights) : height) / height), 1, 100),
  };
}

function normalizeOrientations(values: unknown): RoomOrientation[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value): value is RoomOrientation => ROOM_ORIENTATIONS.includes(value as RoomOrientation)))];
}

function roomIdentity(name: string, url: string) {
  return `${name.trim().toLowerCase()}|${url.trim().toLowerCase()}`;
}

function finiteOr(value: unknown, fallback: number) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function inPercentRange(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function positivePercent(value: number) {
  return Number.isFinite(value) && value > 0 && value <= 100;
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}