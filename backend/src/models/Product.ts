import { Schema, model } from 'mongoose';

const boxSchema = new Schema(
  { top: { type: Number, default: 0 }, right: { type: Number, default: 0 }, bottom: { type: Number, default: 0 }, left: { type: Number, default: 0 } },
  { _id: false }
);

const surfaceSchema = new Schema(
  {
    id: { type: String, required: true },
    productId: { type: String, required: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    backgroundColor: { type: String, default: '#ffffff' },
    allowTransparency: { type: Boolean, default: false },
    bleed: { type: boxSchema, default: () => ({}) },
    safeArea: { type: boxSchema, default: () => ({}) },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const variantSchema = new Schema(
  {
    id: { type: String, required: true },
    productId: { type: String, required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['active', 'draft', 'archived', 'Active', 'Draft'], default: 'draft' },
    options: { type: Map, of: String, default: {} },
    width: { type: Number, required: true, min: 0.0001 },
    height: { type: Number, required: true, min: 0.0001 },
    unit: { type: String, enum: ['inch', 'mm', 'px'], required: true },
    dpi: { type: Number, required: true, min: 0.0001 },
    previewImageUrl: { type: String, default: '' },
    thumbnailImageUrl: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const optionValueSchema = new Schema(
  {
    id: { type: String, required: true },
    optionGroupId: { type: String, required: true },
    label: { type: String, required: true },
    value: { type: String, required: true },
    skuCode: { type: String, default: '' },
    priceModifierType: { type: String, enum: ['none', 'fixed', 'percentage'], default: 'none' },
    priceModifier: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    previewImageUrl: { type: String, default: '' },
    thumbnailImageUrl: { type: String, default: '' },
    metadata: {
      colorHex: String,
      description: String,
      productionCode: String,
      exportNotes: String,
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const optionGroupSchema = new Schema(
  {
    id: { type: String, required: true },
    productId: { type: String, required: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    displayType: { type: String, enum: ['Dropdown', 'Radio Buttons', 'Color Swatches', 'Image Swatches', 'Text Buttons'], default: 'Dropdown' },
    required: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    values: { type: [optionValueSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const editorRulesSchema = new Schema(
  {
    allowImageUpload: { type: Boolean, default: true },
    allowAddText: { type: Boolean, default: true },
    allowClipart: { type: Boolean, default: false },
    allowBackgroundColor: { type: Boolean, default: true },
    allowBackgroundImage: { type: Boolean, default: false },
    allowCrop: { type: Boolean, default: true },
    allowRotate: { type: Boolean, default: true },
    allowDeleteObjects: { type: Boolean, default: true },
    allowLayersPanel: { type: Boolean, default: true },
    maxImageCount: { type: Number, default: 10 },
    maxTextCount: { type: Number, default: 20 },
    minimumDpiWarning: { type: Number, default: 150 },
    minimumDpiBlock: { type: Number, default: 72 },
    requirePlaceholdersFilled: { type: Boolean, default: true },
  },
  { _id: false }
);

const exportRulesSchema = new Schema(
  {
    format: { type: String, enum: ['PNG', 'JPG', 'PDF', 'SVG'], default: 'PDF' },
    dpi: { type: Number, default: 300 },
    includeBleed: { type: Boolean, default: true },
    flattenOutput: { type: Boolean, default: true },
    transparentBackground: { type: Boolean, default: false },
    backgroundColor: { type: String, default: '#ffffff' },
    filenameTemplate: { type: String, default: '{orderId}_{sku}_{surface}' },
    colorMode: { type: String, enum: ['RGB', 'CMYK'], default: 'RGB' },
  },
  { _id: false }
);

const templateElementSchema = new Schema({}, { _id: false, strict: false });
const templateSchema = new Schema(
  {
    id: String,
    productId: String,
    name: String,
    status: String,
    variantId: String,
    surfaceId: String,
    thumbnailUrl: String,
    elements: { type: [templateElementSchema], default: [] },
    createdAt: Date,
    updatedAt: Date,
  },
  { _id: false }
);

const productSchema = new Schema(
  {
    accountId: { type: String, required: true, index: true },
    merchantId: { type: String, default: null, index: true },
    scope: { type: String, enum: ['shared', 'merchant'], required: true, index: true },
    categoryId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    productType: { type: String, required: true },
    status: { type: String, enum: ['active', 'draft', 'archived', 'Active', 'Draft'], default: 'draft', index: true },
    basePrice: { type: Number, default: 0, min: 0 },
    thumbnailUrl: { type: String, default: '' },
    surface: { type: surfaceSchema, default: null },
    optionGroups: { type: [optionGroupSchema], default: [] },
    variants: { type: [variantSchema], default: [] },
    editorRules: { type: editorRulesSchema, default: () => ({}) },
    exportRules: { type: exportRulesSchema, default: () => ({}) },
    templates: { type: [templateSchema], default: [] },
  },
  { timestamps: true }
);

productSchema.index({ accountId: 1, scope: 1, merchantId: 1, categoryId: 1, slug: 1 }, { unique: true });
export const ProductModel = model('Product', productSchema);

