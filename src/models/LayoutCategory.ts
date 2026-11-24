import { Schema, model } from 'mongoose';

const layoutCategorySchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', default: null, index: true },
    scope: { type: String, enum: ['shared', 'merchant'], required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['active', 'draft', 'archived'], default: 'draft', index: true },
    thumbnailUrl: { type: String, default: '' },
    thumbnailAssetId: { type: Schema.Types.ObjectId, ref: 'ImageAsset' },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

layoutCategorySchema.index({ accountId: 1, scope: 1, merchantId: 1, slug: 1 }, { unique: true });
layoutCategorySchema.index({ name: 'text', description: 'text' });

export const LayoutCategoryModel = model('LayoutCategory', layoutCategorySchema);