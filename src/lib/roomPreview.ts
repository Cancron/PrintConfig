import type { ProductUnit, ProductVariant, VariantRoomPreview } from '../types';
import type { ValidationErrors } from './validation';

export interface RoomPreviewSize {
  widthMeters: number;
  heightMeters: number;
  widthPercent: number;
  heightPercent: number;
}

export function convertToMeters(value: number, unit: ProductUnit) {
  if (!Number.isFinite(value) || value <= 0 || unit === 'px') return null;
  return unit === 'mm' ? value / 1000 : value * 0.0254;
}

export function calculateRoomPreviewSize(variant: Pick<ProductVariant, 'width' | 'height' | 'unit'>, roomPreview: Pick<VariantRoomPreview, 'roomWidthMeters' | 'zoom'>): RoomPreviewSize | null {
  const widthMeters = convertToMeters(variant.width, variant.unit);
  const heightMeters = convertToMeters(variant.height, variant.unit);
  if (widthMeters === null || heightMeters === null || roomPreview.roomWidthMeters <= 0 || roomPreview.zoom <= 0) return null;
  return {
    widthMeters,
    heightMeters,
    widthPercent: (widthMeters / roomPreview.roomWidthMeters) * 100 * roomPreview.zoom,
    heightPercent: (heightMeters / roomPreview.roomWidthMeters) * 100 * roomPreview.zoom,
  };
}

export function getOverlayStyle(variant: Pick<ProductVariant, 'width' | 'height' | 'unit'>, roomPreview: VariantRoomPreview, displayedImageWidth?: number, displayedImageHeight?: number) {
  const size = calculateRoomPreviewSize(variant, roomPreview);
  if (!size) return null;
  // CSS height percentages resolve against image height. Convert the width-based
  // physical percentage so the rendered border keeps the variant's true ratio.
  const renderedHeightPercent = displayedImageWidth && displayedImageHeight
    ? size.heightPercent * (displayedImageWidth / displayedImageHeight)
    : size.heightPercent;
  return {
    left: `${roomPreview.centerLeftPercent - size.widthPercent / 2}%`,
    top: `${roomPreview.centerTopPercent - renderedHeightPercent / 2}%`,
    width: `${size.widthPercent}%`,
    height: `${renderedHeightPercent}%`,
  };
}

export function validateRoomPreview(roomPreview: VariantRoomPreview): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!roomPreview.name.trim()) errors.name = 'Preview name is required.';
  if (!roomPreview.roomImageUrl.trim()) {
    errors.roomImageUrl = 'Room image URL is required.';
  } else {
    try {
      const url = new URL(roomPreview.roomImageUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') errors.roomImageUrl = 'Use a valid HTTP or HTTPS URL.';
    } catch {
      errors.roomImageUrl = 'Use a valid image URL.';
    }
  }
  if (!Number.isFinite(roomPreview.roomWidthMeters) || roomPreview.roomWidthMeters <= 0) errors.roomWidthMeters = 'Room width must be greater than zero.';
  if (roomPreview.roomHeightMeters !== undefined && (!Number.isFinite(roomPreview.roomHeightMeters) || roomPreview.roomHeightMeters <= 0)) errors.roomHeightMeters = 'Room height must be greater than zero.';
  if (!inPercentRange(roomPreview.centerLeftPercent)) errors.centerLeftPercent = 'Use a value between 0 and 100.';
  if (!inPercentRange(roomPreview.centerTopPercent)) errors.centerTopPercent = 'Use a value between 0 and 100.';
  if (!Number.isFinite(roomPreview.zoom) || roomPreview.zoom <= 0) errors.zoom = 'Zoom must be greater than zero.';
  if (!Number.isFinite(roomPreview.sortOrder)) errors.sortOrder = 'Sort order must be numeric.';
  return errors;
}

export function getDefaultRoomPreviewPlacement() {
  return { centerLeftPercent: 50, centerTopPercent: 40, zoom: 1 };
}

export function roomPreviewKey(roomPreview: Pick<VariantRoomPreview, '_id' | 'clientId'>) {
  return roomPreview._id || roomPreview.clientId || '';
}

function inPercentRange(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}