import { Schema, model } from 'mongoose';

const productCategorySchema = new Schema(
  {
    _id: { type: String },
    accountId: { type: String, required: true, index: true },
    merchantId: { type: String, default: null, index: true },
    scope: { type: String, enum: ['shared', 'merchant'], required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['active', 'draft', 'archived'], default: 'draft', index: true },
    thumbnailUrl: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productCategorySchema.index({ accountId: 1, scope: 1, merchantId: 1, slug: 1 }, { unique: true });
export const ProductCategoryModel = model('ProductCategory', productCategorySchema);


