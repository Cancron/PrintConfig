import { Schema, model } from 'mongoose';

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'] as const;

const imageAssetSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', default: null, index: true },
    scope: { type: String, enum: ['shared', 'merchant'], required: true, index: true },
    folderId: { type: Schema.Types.ObjectId, ref: 'ImageFolder', default: null, index: true },
    name: { type: String, required: true, trim: true },
    filename: { type: String, required: true, trim: true },
    originalFilename: { type: String, required: true },
    url: { type: String, required: true },
    publicUrl: { type: String, required: true },
    thumbnailUrl: { type: String, default: '' },
    storageProvider: { type: String, enum: ['supabase'], default: 'supabase', required: true },
    bucket: { type: String, required: true },
    storagePath: { type: String, required: true },
    mimeType: { type: String, enum: IMAGE_MIME_TYPES, required: true },
    sizeBytes: { type: Number, min: 0 },
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
    altText: { type: String, default: '' },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

imageAssetSchema.index({ accountId: 1, merchantId: 1, scope: 1, folderId: 1 });
imageAssetSchema.index({ name: 'text', filename: 'text', altText: 'text', tags: 'text' });
export const ImageAssetModel = model('ImageAsset', imageAssetSchema);