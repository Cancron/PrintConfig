import { Schema, model } from 'mongoose';

const designProcessingJobSchema = new Schema(
  {
    cartItemId: { type: Schema.Types.ObjectId, ref: 'DesignCartItem', required: true, index: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    type: { type: String, enum: ['final-print-generation'], default: 'final-print-generation', index: true },
    status: { type: String, enum: ['pending', 'processing', 'complete', 'failed', 'cancelled'], default: 'pending', index: true },
    priority: { type: Number, default: 0, index: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    markOrdered: { type: Boolean, default: false, index: true },
    orderId: { type: String, default: '', index: true },
    sourcePrefix: { type: String, default: '' },
    orderPrefix: { type: String, default: '' },
    result: { type: Schema.Types.Mixed },
    error: { type: String, default: '' },
    lockedBy: { type: String, default: '', index: true },
    lockedAt: { type: Date },
    availableAt: { type: Date, default: Date.now, index: true },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

designProcessingJobSchema.index({ status: 1, availableAt: 1, priority: -1, createdAt: 1 });

export const DesignProcessingJobModel = model('DesignProcessingJob', designProcessingJobSchema);
