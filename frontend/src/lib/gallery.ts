import type { ProductScope } from '../types';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export function sanitizeFilename(filename: string) {
  const lastDot = filename.lastIndexOf('.');
  const base = (lastDot > 0 ? filename.slice(0, lastDot) : filename).toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'image';
  const extension = lastDot > 0 ? filename.slice(lastDot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  return extension ? `${base}.${extension}` : base;
}

export function buildGalleryStoragePath(input: { accountId: string; merchantId?: string | null; scope: ProductScope; folderId?: string | null; filename: string }) {
  const folder = input.folderId || 'root';
  const filename = `${Date.now()}-${sanitizeFilename(input.filename)}`;
  if (input.scope === 'merchant') {
    if (!input.merchantId) throw new Error('A merchant is required for merchant custom images.');
    return `accounts/${input.accountId}/merchants/${input.merchantId}/${folder}/${filename}`;
  }
  return `accounts/${input.accountId}/shared/${folder}/${filename}`;
}

export async function readImageDimensions(file: File): Promise<{ width?: number; height?: number }> {
  if (file.type === 'image/svg+xml') return {};
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error('Could not read image dimensions.'));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function validateGalleryFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Use a JPEG, PNG, WebP, GIF, or SVG image.';
  if (file.size > MAX_IMAGE_SIZE) return 'Image must be 10 MB or smaller.';
  return '';
}

export function formatFileSize(bytes?: number) {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}