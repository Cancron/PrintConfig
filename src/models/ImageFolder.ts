import { Schema, model } from 'mongoose';

const imageFolderSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', default: null, index: true },
    scope: { type: String, enum: ['shared', 'merchant'], required: true, index: true },
    parentFolderId: { type: Schema.Types.ObjectId, ref: 'ImageFolder', default: null, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

imageFolderSchema.index({ accountId: 1, merchantId: 1, scope: 1, parentFolderId: 1, slug: 1 }, { unique: true });
imageFolderSchema.index({ accountId: 1, scope: 1, merchantId: 1 });
export const ImageFolderModel = model('ImageFolder', imageFolderSchema);