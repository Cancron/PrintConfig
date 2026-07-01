/* eslint-disable @typescript-eslint/no-explicit-any */

export const ROOM_ORIENTATIONS = ['square', 'vertical', 'horizontal', 'pano-vertical', 'pano-horizontal'] as const;
export type RoomOrientation = typeof ROOM_ORIENTATIONS[number];

export function getVariantRoomOrientation(variant: any): RoomOrientation {
  const options = variant?.options instanceof Map ? Object.fromEntries(variant.options) : variant?.options ?? {};
  const entry = Object.entries(options).find(([key]) => key.trim().toLowerCase() === 'orientation');
  const value = String(entry?.[1] ?? '').trim().toLowerCase().replace(/[ _]+/g, '-');
  if (value === 'square') return 'square';
  if (value === 'portrait' || value === 'vertical') return 'vertical';
  if (value === 'landscape' || value === 'horizontal') return 'horizontal';
  if (value === 'pano-vertical' || value === 'panorama-vertical' || value === 'vertical-panorama') return 'pano-vertical';
  if (value === 'pano-horizontal' || value === 'panorama-horizontal' || value === 'horizontal-panorama') return 'pano-horizontal';
  return orientationFromDimensions(Number(variant?.width), Number(variant?.height));
}

export function orientationFromDimensions(width: number, height: number): RoomOrientation {
  if (!(width > 0) || !(height > 0) || width === height) return 'square';
  if (height / width >= 3) return 'pano-vertical';
  if (width / height >= 3) return 'pano-horizontal';
  return width < height ? 'vertical' : 'horizontal';
}

export function liftLegacyProductRooms(product: any) {
  const variants = product.variants ?? [];
  const rooms = [...(product.roomPreviews ?? [])].map((room: any) => ({
    ...room,
    orientations: validOrientations(room.orientations),
    defaultOrientations: validOrientations(room.defaultOrientations),
  }));
  const byIdentity = new Map(rooms.map((room: any) => [identity(room), room]));
  const claimedDefaults = new Set<RoomOrientation>(rooms.flatMap((room: any) => room.defaultOrientations));

  for (const variant of variants) {
    const orientation = getVariantRoomOrientation(variant);
    for (const legacy of variant.roomPreviews ?? []) {
      const key = identity(legacy);
      const existing = byIdentity.get(key);
      if (existing) {
        if (!existing.orientations.includes(orientation)) existing.orientations.push(orientation);
        if (legacy.isDefault && !claimedDefaults.has(orientation)) {
          existing.defaultOrientations.push(orientation);
          claimedDefaults.add(orientation);
        }
        continue;
      }
      const placement = legacyPlacement(legacy, variant, variants, orientation);
      const room = {
        name: String(legacy.name ?? ''),
        roomImageUrl: String(legacy.roomImageUrl ?? ''),
        roomImageAssetId: legacy.roomImageAssetId,
        orientations: [orientation],
        defaultOrientations: legacy.isDefault && !claimedDefaults.has(orientation) ? [orientation] : [],
        centerLeftPercent: numberOr(legacy.centerLeftPercent, 50),
        centerTopPercent: numberOr(legacy.centerTopPercent, 45),
        maxWidthPercent: placement.width,
        maxHeightPercent: placement.height,
        sortOrder: rooms.length,
        createdAt: legacy.createdAt,
        updatedAt: legacy.updatedAt,
      };
      if (room.defaultOrientations.length) claimedDefaults.add(orientation);
      rooms.push(room);
      byIdentity.set(key, room);
    }
  }

  return {
    roomPreviews: rooms,
    variants: variants.map((variant: any) => {
      const copy = { ...variant };
      delete copy.roomPreviews;
      return copy;
    }),
  };
}

export function hasLegacyRooms(product: any) {
  return (product.variants ?? []).some((variant: any) => (variant.roomPreviews ?? []).length > 0);
}

function legacyPlacement(legacy: any, variant: any, variants: any[], orientation: RoomOrientation) {
  const width = convertToMeters(Number(variant.width), variant.unit);
  const height = convertToMeters(Number(variant.height), variant.unit);
  if (width === null || height === null || !(legacy.roomWidthMeters > 0) || !(legacy.zoom > 0)) return { width: 30, height: 30 };
  const matching = variants.filter((item) => getVariantRoomOrientation(item) === orientation);
  const widths = matching.map((item) => convertToMeters(Number(item.width), item.unit)).filter((value): value is number => value !== null);
  const heights = matching.map((item) => convertToMeters(Number(item.height), item.unit)).filter((value): value is number => value !== null);
  const oldWidth = width / legacy.roomWidthMeters * 100 * legacy.zoom;
  const oldHeight = height / legacy.roomWidthMeters * 100 * legacy.zoom;
  return {
    width: clamp(oldWidth * ((widths.length ? Math.max(...widths) : width) / width), 1, 100),
    height: clamp(oldHeight * ((heights.length ? Math.max(...heights) : height) / height), 1, 100),
  };
}

function convertToMeters(value: number, unit: string) {
  if (!Number.isFinite(value) || value <= 0 || unit === 'px') return null;
  return unit === 'mm' ? value / 1000 : value * 0.0254;
}

function validOrientations(values: unknown): RoomOrientation[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value): value is RoomOrientation => ROOM_ORIENTATIONS.includes(value as RoomOrientation)))];
}

function identity(room: any) {
  return `${String(room.name ?? '').trim().toLowerCase()}|${String(room.roomImageUrl ?? '').trim().toLowerCase()}`;
}

function numberOr(value: unknown, fallback: number) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
