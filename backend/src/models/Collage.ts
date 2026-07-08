import { Schema, model } from 'mongoose';
import { layoutElementSchema, orientations, units } from './LayoutTemplate.js';

const collageSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', default: null, index: true },
    scope: { type: String, enum: ['shared', 'merchant'], required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'LayoutCategory', required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['active', 'draft', 'archived'], default: 'draft', index: true },
    thumbnailUrl: { type: String, default: '' },
    thumbnailAssetId: { type: Schema.Types.ObjectId, ref: 'ImageAsset' },
    orientation: { type: String, enum: orientations, required: true, index: true },
    canvasWidth: { type: Number, required: true, min: 0.0001 },
    canvasHeight: { type: Number, required: true, min: 0.0001 },
    unit: { type: String, enum: units, required: true },
    dpi: { type: Number, required: true, min: 0.0001 },
    backgroundColor: { type: String, default: '#ffffff' },
    backgroundImageUrl: { type: String, default: '' },
    backgroundImageAssetId: { type: Schema.Types.ObjectId, ref: 'ImageAsset' },
    tags: { type: [String], default: [] },
    sortOrder: { type: Number, default: 0 },
    elements: { type: [layoutElementSchema], default: [] },
  },
  { timestamps: true }
);

collageSchema.index({ accountId: 1, scope: 1, merchantId: 1, categoryId: 1, slug: 1 }, { unique: true });
collageSchema.index({ accountId: 1, scope: 1, merchantId: 1, orientation: 1 });
collageSchema.index({ name: 'text', description: 'text', tags: 'text' });

export const CollageModel = model('Collage', collageSchema);