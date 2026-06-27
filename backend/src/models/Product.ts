import { Schema, model } from 'mongoose';

const boxSchema = new Schema(
  { 
    top: { type: Number, default: 0 }, 
    right: { type: Number, default: 0 }, 
    bottom: { type: Number, default: 0 }, 
    left: { type: Number, default: 0 }, 
    unit: { type: String, enum: ['inch', 'mm', 'px'], default: 'inch' },
  },
  { _id: false }
);

const surfaceSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    code: { type: String, required: true },
    backgroundColor: { type: String, default: '#ffffff' },
    allowTransparency: { type: Boolean, default: false },
    bleed: { type: boxSchema, default: () => ({}) },
    safeArea: { type: boxSchema, default: () => ({}) },
  },
  { timestamps: true }
);

const variantRoomPreviewSchema = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId },
    name: { type: String, required: true, trim: true },
    roomImageUrl: { type: String, required: true, trim: true },
    roomWidthMeters: { type: Number, required: true, min: 0.01 },
    roomHeightMeters: { type: Number, min: 0.01 },
    centerLeftPercent: { type: Number, default: 50, min: 0, max: 100 },
    centerTopPercent: { type: Number, default: 40, min: 0, max: 100 },
    zoom: { type: Number, default: 1, min: 0.01 },
    isDefault: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);
const variantSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['active', 'draft', 'archived'], default: 'draft' },
    options: { type: Map, of: String, default: {} },
    width: { type: Number, required: true, min: 0.0001 },
    height: { type: Number, required: true, min: 0.0001 },
    unit: { type: String, enum: ['inch', 'mm', 'px'], required: true },
    dpi: { type: Number, required: true, min: 0.0001 },
    previewImageUrl: { type: String, default: '' },
    thumbnailImageUrl: { type: String, default: '' },
    roomPreviews: { type: [variantRoomPreviewSchema], default: [] },
  },
  { timestamps: true }
);

const optionValueSchema = new Schema(
  {
    optionGroupId: { type: Schema.Types.ObjectId },
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
  },
  { timestamps: true }
);

const optionGroupSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    code: { type: String, required: true },
    displayType: { type: String, enum: ['Dropdown', 'Radio Buttons', 'Color Swatches', 'Image Swatches', 'Text Buttons'], default: 'Dropdown' },
    required: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    values: { type: [optionValueSchema], default: [] },
  },
  { timestamps: true }
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

const templateElementSchema = new Schema(
  {
    name: String,
    type: { type: String, enum: ['photo', 'text'] },
    x: Number,
    y: Number,
    width: Number,
    height: Number,
    required: Boolean,
    locked: Boolean,
    editable: Boolean,
  },
  { timestamps: true }
);

const templateSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    status: String,
    variantId: { type: Schema.Types.ObjectId },
    surfaceId: { type: Schema.Types.ObjectId },
    thumbnailUrl: String,
    elements: { type: [templateElementSchema], default: [] },
  },
  { timestamps: true }
);

const productSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', default: null, index: true },
    scope: { type: String, enum: ['shared', 'merchant'], required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'ProductCategory', required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    productType: { type: String, required: true },
    status: { type: String, enum: ['active', 'draft', 'archived'], default: 'draft', index: true },
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

productSchema.pre('validate', function setVariantRoomPreviewRefs() {
  for (const variant of this.variants ?? []) {
    for (const roomPreview of variant.roomPreviews ?? []) roomPreview.variantId = variant._id;
  }
});
productSchema.index({ accountId: 1, scope: 1, merchantId: 1, categoryId: 1, slug: 1 }, { unique: true });
export const ProductModel = model('Product', productSchema);
