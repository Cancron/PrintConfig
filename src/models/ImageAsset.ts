import { recordModel } from '../db/recordModel.js';
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'] as const;

export const ImageAssetModel = recordModel('image_assets');
