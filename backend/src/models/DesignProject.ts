import { Schema, model } from 'mongoose';

const designProjectSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    cartItemId: { type: Schema.Types.ObjectId, ref: 'DesignCartItem', index: true },
    userKey: { type: String, required: true, trim: true, index: true },
    projectId: { type: String, required: true, trim: true, unique: true, index: true },
    status: { type: String, enum: ['draft', 'cart', 'ordered', 'abandoned'], default: 'draft', index: true },
    tempStoragePrefix: { type: String, required: true },
    orderStoragePrefix: { type: String, default: '' },
    lastActivityAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

designProjectSchema.index({ merchantId: 1, productId: 1, userKey: 1, projectId: 1 }, { unique: true });

export const DesignProjectModel = model('DesignProject', designProjectSchema);
