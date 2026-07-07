import { Schema, model } from 'mongoose';

const templateTypes = ['photo_collage', 'photo_book', 'calendar', 'card', 'poster', 'canvas', 'custom'] as const;
const orientations = ['portrait', 'landscape', 'square', 'custom'] as const;
const units = ['inch', 'mm', 'px'] as const;
const elementTypes = ['photo_placeholder', 'text_placeholder', 'shape', 'background', 'clipart', 'static_image'] as const;

const photoSettingsSchema = new Schema(
  {
    fitMode: { type: String, enum: ['cover', 'contain', 'stretch'], default: 'cover' },
    allowCrop: { type: Boolean, default: true },
    allowRotate: { type: Boolean, default: true },
    allowReplace: { type: Boolean, default: true },
    placeholderIndex: { type: Number, default: 1, min: 1 },
    maskShape: { type: String, enum: ['rectangle', 'circle', 'rounded_rectangle', 'custom'], default: 'rectangle' },
  },
  { _id: false }
);

const textSettingsSchema = new Schema(
  {
    defaultText: { type: String, default: '' },
    fontFamily: { type: String, default: 'Arial' },
    fontSize: { type: Number, default: 24, min: 1 },
    fontWeight: { type: String, default: '400' },
    color: { type: String, default: '#111827' },
    textAlign: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
    maxCharacters: { type: Number, min: 1 },
  },
  { _id: false }
);

const shapeSettingsSchema = new Schema(
  {
    shapeType: { type: String, enum: ['rectangle', 'circle', 'line'], default: 'rectangle' },
    fillColor: { type: String, default: '#f3f4f6' },
    strokeColor: { type: String, default: '#111827' },
    strokeWidth: { type: Number, default: 1, min: 0 },
    borderRadius: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const imageSettingsSchema = new Schema(
  {
    imageUrl: { type: String, default: '' },
    imageAssetId: { type: Schema.Types.ObjectId, ref: 'ImageAsset' },
    opacity: { type: Number, default: 1, min: 0, max: 1 },
  },
  { _id: false }
);

const layoutElementSchema = new Schema(
  {
    type: { type: String, enum: elementTypes, required: true },
    name: { type: String, required: true, trim: true },
    x: { type: Number, default: 0, min: 0, max: 100 },
    y: { type: Number, default: 0, min: 0, max: 100 },
    width: { type: Number, default: 25, min: 0.01, max: 100 },
    height: { type: Number, default: 25, min: 0.01, max: 100 },
    rotation: { type: Number, default: 0 },
    zIndex: { type: Number, default: 0 },
    locked: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    editable: { type: Boolean, default: true },
    style: { type: Schema.Types.Mixed, default: () => ({}) },
    photoSettings: { type: photoSettingsSchema, default: () => ({}) },
    textSettings: { type: textSettingsSchema, default: () => ({}) },
    shapeSettings: { type: shapeSettingsSchema, default: () => ({}) },
    imageSettings: { type: imageSettingsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

const layoutTemplatePageSchema = new Schema(
  {
    pageNumber: { type: Number, required: true, min: 1 },
    name: { type: String, default: '' },
    width: { type: Number, required: true, min: 0.0001 },
    height: { type: Number, required: true, min: 0.0001 },
    backgroundColor: { type: String, default: '#ffffff' },
    backgroundImageUrl: { type: String, default: '' },
    backgroundImageAssetId: { type: Schema.Types.ObjectId, ref: 'ImageAsset' },
    elements: { type: [layoutElementSchema], default: [] },
  },
  { timestamps: true }
);

const layoutTemplateSchema = new Schema(
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
    templateType: { type: String, enum: templateTypes, required: true, index: true },
    orientation: { type: String, enum: orientations, required: true, index: true },
    pageCount: { type: Number, default: 1, min: 1 },
    canvasWidth: { type: Number, required: true, min: 0.0001 },
    canvasHeight: { type: Number, required: true, min: 0.0001 },
    unit: { type: String, enum: units, required: true },
    dpi: { type: Number, required: true, min: 0.0001 },
    backgroundColor: { type: String, default: '#ffffff' },
    tags: { type: [String], default: [] },
    sortOrder: { type: Number, default: 0 },
    pages: { type: [layoutTemplatePageSchema], default: [] },
  },
  { timestamps: true }
);

layoutTemplateSchema.index({ accountId: 1, scope: 1, merchantId: 1, categoryId: 1, slug: 1 }, { unique: true });
layoutTemplateSchema.index({ accountId: 1, scope: 1, merchantId: 1, templateType: 1 });
layoutTemplateSchema.index({ name: 'text', description: 'text', tags: 'text' });

export const LayoutTemplateModel = model('LayoutTemplate', layoutTemplateSchema);