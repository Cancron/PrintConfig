import { Schema, model } from 'mongoose';

const storageFileSchema = new Schema(
  {
    url: { type: String, default: '' },
    publicUrl: { type: String, default: '' },
    storageProvider: { type: String, enum: ['supabase'], default: 'supabase' },
    bucket: { type: String, default: '' },
    storagePath: { type: String, default: '' },
    filename: { type: String, default: '' },
    originalName: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
  },
  { _id: false }
);

const pagePreviewSchema = new Schema(
  {
    pageId: { type: String, default: '' },
    pageNumber: { type: Number },
    url: { type: String, default: '' },
    publicUrl: { type: String, default: '' },
    storageProvider: { type: String, enum: ['supabase'], default: 'supabase' },
    bucket: { type: String, default: '' },
    storagePath: { type: String, default: '' },
    filename: { type: String, default: '' },
    originalName: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
  },
  { _id: false }
);

const designCartItemSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    userKey: { type: String, required: true, trim: true, index: true },
    projectId: { type: String, default: '', trim: true, index: true },
    status: { type: String, enum: ['cart', 'ordered', 'abandoned'], default: 'cart', index: true },
    designStoragePath: { type: String, required: true },
    designPublicBaseUrl: { type: String, default: '' },
    designPublicUrl: { type: String, default: '' },
    tempStoragePrefix: { type: String, required: true },
    orderStoragePrefix: { type: String, default: '' },
    orderId: { type: String, default: '', index: true },
    image: { type: storageFileSchema },
    pagePreviews: { type: [pagePreviewSchema], default: [] },
    finalPrintFiles: { type: [storageFileSchema], default: [] },
    printGenerationStatus: { type: String, enum: ['not_ready', 'pending', 'processing', 'complete', 'failed'], default: 'pending', index: true },
    printGenerationError: { type: String, default: '' },
    printGenerationTotalPages: { type: Number, default: 0 },
    printGenerationCompletedPages: { type: Number, default: 0 },
    printGenerationCurrentPage: { type: Number, default: 0 },
    addedToCartAt: { type: Date, default: Date.now },
    orderedAt: { type: Date },
    lastActivityAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

designCartItemSchema.index({ merchantId: 1, productId: 1, userKey: 1, projectId: 1, status: 1 });

export const DesignCartItemModel = model('DesignCartItem', designCartItemSchema);
