import { Schema, model } from 'mongoose';

const merchantSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    logoUrl: { type: String, default: '' },
    logoAssetId: { type: Schema.Types.ObjectId, ref: 'ImageAsset' },
    status: { type: String, enum: ['active', 'draft', 'archived'], default: 'active' },
    editorPrimaryColor: { type: String, default: '#111827' },
    editorSecondaryColor: { type: String, default: '#f3f4f6' },
    editorAccentColor: { type: String, default: '#2563eb' },
    customCss: { type: String, default: '' },
    customJavascript: { type: String, default: '' },
    apiPrivateKeyHash: { type: String, select: false },
    apiPrivateKeyLastFour: { type: String, default: '' },
    apiPrivateKeyCreatedAt: { type: Date },
  },
  { timestamps: true }
);

merchantSchema.index({ accountId: 1, slug: 1 }, { unique: true });
merchantSchema.index({ apiPrivateKeyHash: 1 }, { unique: true, sparse: true });
export const MerchantModel = model('Merchant', merchantSchema);
