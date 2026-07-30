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
    roomImageAssetId: { type: Schema.Types.ObjectId, ref: 'ImageAsset' },
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
const roomOrientations = ['square', 'vertical', 'horizontal', 'pano-vertical', 'pano-horizontal'] as const;
const productRoomPreviewSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true, trim: true },
    roomImageUrl: { type: String, required: true, trim: true },
    roomImageAssetId: { type: Schema.Types.ObjectId, ref: 'ImageAsset' },
    orientations: { type: [{ type: String, enum: roomOrientations }], default: [] },
    defaultOrientations: { type: [{ type: String, enum: roomOrientations }], default: [] },
    centerLeftPercent: { type: Number, default: 50, min: 0, max: 100 },
    centerTopPercent: { type: Number, default: 45, min: 0, max: 100 },
    maxWidthPercent: { type: Number, default: 30, min: 0.01, max: 100 },
    maxHeightPercent: { type: Number, default: 30, min: 0.01, max: 100 },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);
const pillowInsetsSchema = new Schema(
  {
    top: { type: Number, required: true, min: 0, default: 0 },
    right: { type: Number, required: true, min: 0, default: 0 },
    bottom: { type: Number, required: true, min: 0, default: 0 },
    left: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const pillowDesignAreaSchema = new Schema(
  {
    x: { type: Number, required: true, min: 0, max: 100, default: 15 },
    y: { type: Number, required: true, min: 0, max: 100, default: 12 },
    width: { type: Number, required: true, min: 0.0001, max: 100, default: 70 },
    height: { type: Number, required: true, min: 0.0001, max: 100, default: 70 },
    cornerRadius: { type: Number, min: 0, max: 50, default: 8 },
  },
  { _id: false }
);

const pillowMockupSchema = new Schema(
  {
    imageUrl: { type: String, default: '', trim: true },
    imageAssetId: { type: Schema.Types.ObjectId, ref: 'ImageAsset' },
    thumbnailImageUrl: { type: String, default: '', trim: true },
    thumbnailImageAssetId: { type: Schema.Types.ObjectId, ref: 'ImageAsset' },
    designArea: { type: pillowDesignAreaSchema, default: () => ({}) },
  },
  { _id: false }
);

const pillowVariantSchema = new Schema(
  {
    shape: { type: String, enum: ['square', 'rectangle'], required: true, default: 'square' },
    printArea: {
      type: new Schema(
        {
          width: { type: Number, required: true, min: 0.0001 },
          height: { type: Number, required: true, min: 0.0001 },
          unit: { type: String, enum: ['inch', 'cm', 'mm'], required: true, default: 'inch' },
          bleed: { type: pillowInsetsSchema, default: () => ({}) },
          safeArea: { type: pillowInsetsSchema, default: () => ({}) },
        },
        { _id: false }
      ),
      required: true,
    },
    mockups: {
      type: new Schema(
        {
          front: { type: pillowMockupSchema, default: () => ({}) },
          back: { type: pillowMockupSchema, default: () => ({}) },
        },
        { _id: false }
      ),
      required: true,
    },
  },
  { _id: false }
);

const mugVariantSchema = new Schema(
  {
    printArea: {
      type: new Schema(
        {
          width: { type: Number, required: true, min: 0.0001 },
          height: { type: Number, required: true, min: 0.0001 },
          unit: { type: String, enum: ['inch', 'cm', 'mm'], required: true, default: 'inch' },
          bleed: { type: pillowInsetsSchema, default: () => ({}) },
          safeArea: { type: pillowInsetsSchema, default: () => ({}) },
        },
        { _id: false }
      ),
      required: true,
    },
    model: {
      type: new Schema(
        {
          url: { type: String, required: true, trim: true },
          printableMaterialName: { type: String, required: true, trim: true },
        },
        { _id: false }
      ),
      required: true,
    },
  },
  { _id: false }
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
    previewImageAssetId: { type: Schema.Types.ObjectId, ref: 'ImageAsset' },
    thumbnailImageUrl: { type: String, default: '' },
    thumbnailImageAssetId: { type: Schema.Types.ObjectId, ref: 'ImageAsset' },
    pillow: { type: pillowVariantSchema },
    mug: { type: mugVariantSchema },
    roomPreviews: { type: [variantRoomPreviewSchema], default: [] },
  },
  { timestamps: true }
);

const variantOptionDefinitionSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true },
    required: { type: Boolean, default: false },
    groupBy: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const defaultVariantOptionDefinitions = () => ['Size', 'Orientation', 'Ratio'].map((name, index) => ({
  name,
  key: name,
  required: false,
  groupBy: false,
  sortOrder: index + 1,
}));
const optionValueSchema = new Schema(
  {
    optionGroupId: { type: Schema.Types.ObjectId },
    label: { type: String, required: true },
    value: { type: String, required: true },
    skuCode: { type: String, default: '' },
    priceModifierType: { type: String, enum: ['none', 'fixed', 'variant-fixed', 'variant-override', 'percentage'], default: 'none' },
    priceModifier: { type: Number, default: 0 },
    priceModifierMin: { type: Number, min: 0 },
    priceModifierMax: { type: Number, min: 0 },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    previewImageUrl: { type: String, default: '' },
    previewImageAssetId: { type: Schema.Types.ObjectId, ref: 'ImageAsset' },
    thumbnailImageUrl: { type: String, default: '' },
    thumbnailImageAssetId: { type: Schema.Types.ObjectId, ref: 'ImageAsset' },
    metadata: {
      type: new Schema(
        {
          colorHex: { type: String, default: '' },
          description: { type: String, default: '' },
          productionCode: { type: String, default: '' },
          exportNotes: { type: String, default: '' },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
  },
  { timestamps: true }
);

const dependencyRuleSchema = new Schema(
  {
    dependsOnGroupCode: { type: String, required: true, trim: true },
    condition: { type: String, enum: ['equals', 'not_equals', 'in', 'not_in'], default: 'in' },
    allowedValues: { type: [String], default: [] },
  },
  { _id: false }
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
    dependencyRules: { type: [dependencyRuleSchema], default: [] },
  },
  { timestamps: true }
);

const editorRulesSchema = new Schema(
  {
    allowImageUpload: { type: Boolean, default: true },
    allowCustomSize: { type: Boolean, default: false },
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
    rasterQuality: { type: Number, min: 1, max: 100, default: 94 },
    includeBleed: { type: Boolean, default: true },
    flattenOutput: { type: Boolean, default: true },
    transparentBackground: { type: Boolean, default: false },
    backgroundColor: { type: String, default: '#ffffff' },
    filenameTemplate: { type: String, default: '{orderId}_{sku}_{surface}' },
    colorMode: { type: String, enum: ['RGB', 'CMYK'], default: 'RGB' },
  },
  { _id: false }
);

const productTrustBadgeSchema = new Schema(
  {
    icon: { type: String, default: '' },
    text: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const defaultTrustBadges = () => [
  { icon: 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡Ãƒâ€¦Ã‚Â¡', text: 'Free shipping Canada-wide', sortOrder: 1, isActive: true },
  { icon: 'ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â¡', text: '24-hour production', sortOrder: 2, isActive: true },
  { icon: 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂºÃƒâ€šÃ‚Â¡ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â', text: 'Lifetime warranty', sortOrder: 3, isActive: true },
  { icon: 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â¨ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â¦', text: 'Made in Canada', sortOrder: 4, isActive: true },
];

const frontendContentSchema = new Schema(
  {
    promoText: { type: String, default: '', maxlength: 500 },
    uploadHeading: { type: String, default: 'Start with a photo you love', maxlength: 200 },
    uploadDescription: { type: String, default: "Upload from your phone, laptop, or camera roll. We'll show you exactly how it will look before you pay.", maxlength: 500 },
    uploadButtonText: { type: String, default: 'Upload Your Photo', maxlength: 100 },
    uploadRequirementsText: { type: String, default: 'JPG - PNG - WEBP | MAX 12MB | RECOMMENDED 300 DPI', maxlength: 300 },
    topCtaLabel: { type: String, default: 'DESIGN YOUR PRODUCT' },
    productTitleOverride: { type: String, default: '' },
    showReviews: { type: Boolean, default: true },
    reviewRating: { type: Number, default: 4.9, min: 0, max: 5 },
    reviewCount: { type: Number, default: 4777, min: 0 },
    reviewLabel: { type: String, default: 'reviews' },
    showPrecheckMessage: { type: Boolean, default: true },
    precheckStatus: { type: String, enum: ['success', 'warning', 'info', 'error'], default: 'success' },
    precheckTitle: { type: String, default: 'Pre-Check looks great!' },
    precheckMessage: { type: String, default: "We'll contact you if your image quality doesn't fit. Your satisfaction is the key to our success!" },
    resizeLabel: { type: String, default: 'Resize' },
    rotateLabel: { type: String, default: 'Rotate' },
    resetLabel: { type: String, default: 'Reset' },
    cropLabel: { type: String, default: 'Crop' },
    changePhotoLabel: { type: String, default: 'Change photo' },
    previewLabel: { type: String, default: 'Preview' },
    sizeSectionLabel: { type: String, default: 'Size' },
    showAllSizesLabel: { type: String, default: 'SHOW ALL SIZES & RATIOS' },
    quantityLabel: { type: String, default: 'Quantity' },
    priceLabel: { type: String, default: 'Price' },
    salePriceLabel: { type: String, default: 'Price' },
    savingsLabel: { type: String, default: 'Save' },
    orderButtonText: { type: String, default: 'Order Now' },
    addAnotherImageText: { type: String, default: 'Add Another Image' },
    showSupportBox: { type: Boolean, default: true },
    supportLabel: { type: String, default: 'Need help?' },
    supportPhone: { type: String, default: '+1-825-977-3451' },
    supportEmail: { type: String, default: '' },
    supportIcon: { type: String, default: 'phone' },
    supportMessage: { type: String, default: '' },
    productDetailHtml: { type: String, default: '' },
    showTopCta: { type: Boolean, default: true },
    showReviewBlock: { type: Boolean, default: true },
    showTrustBadges: { type: Boolean, default: true },
    showProductDetailDescription: { type: Boolean, default: true },
    frontendLayoutStyle: { type: String, enum: ['standard', 'compact', 'premium'], default: 'standard' },
    trustBadges: { type: [productTrustBadgeSchema], default: defaultTrustBadges },
  },
  { _id: false }
);
const editorProductSelectionSchema = new Schema(
  {
    mode: { type: String, enum: ['single', 'same-category', 'specific'], default: 'single' },
    specificProductIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Product' }], default: [] },
  },
  { _id: false }
);

const layoutSettingsSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    mode: { type: String, enum: ['none', 'all', 'specific', 'by-tags'], default: 'none' },
    allowedTemplateIds: { type: [{ type: Schema.Types.ObjectId, ref: 'LayoutTemplate' }], default: [] },
    allowedTemplateTags: { type: [String], default: [] },
    requireTemplateSelection: { type: Boolean, default: false },
  },
  { _id: false }
);

const aiArtStyleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    prompt: { type: String, required: true },
    artTitlePrompt: { type: String, default: '' },
    additionalPrice: { type: Number, default: 0, min: 0 },
    previewImageUrl: { type: String, default: '' },
    previewImageAssetId: { type: Schema.Types.ObjectId, ref: 'ImageAsset' },
    thumbnailImageUrl: { type: String, default: '' },
    thumbnailImageAssetId: { type: Schema.Types.ObjectId, ref: 'ImageAsset' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

const aiArtSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    sectionTitle: { type: String, default: 'AI Art Styles', trim: true },
    badgeText: { type: String, default: '' },
    helpText: { type: String, default: '' },
    requireUploadBeforeStyleSelection: { type: Boolean, default: true },
    maxUploadImages: { type: Number, default: 1, min: 1 },
    defaultGeneratedImageCount: { type: Number, default: 4, min: 1 },
    allowMultipleStyleSelection: { type: Boolean, default: false },
    showDescriptions: { type: Boolean, default: true },
    showAdditionalPrice: { type: Boolean, default: true },
    allowArtName: { type: Boolean, default: false },
    artNameFieldLabel: { type: String, default: 'Pet name (optional)', trim: true },
    artNameFieldPlaceholder: { type: String, default: 'e.g., Buddy, Luna, Max', trim: true },
    styles: { type: [aiArtStyleSchema], default: [] },
  },
  { _id: false }
);

const photoBookSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    maxPages: { type: Number, default: 120, min: 1 },
    defaultPages: { type: Number, default: 20, min: 1 },
    maxPhotoCount: { type: Number, default: 300, min: 0 },
    pricePerExtraPage: { type: Number, default: 1.5, min: 0 },
    pagesPerSpread: { type: Number, default: 2, min: 1 },
    allowPageReorder: { type: Boolean, default: true },
    allowBlankPages: { type: Boolean, default: false },
    coverType: { type: String, enum: ['softcover', 'hardcover', 'layflat', 'custom'], default: 'hardcover' },
    bindingType: { type: String, enum: ['perfect', 'saddle_stitch', 'spiral', 'layflat'], default: 'layflat' },
    paperType: { type: String, default: 'lustre', trim: true },
    startsWithCover: { type: Boolean, default: true },
    hasBackCover: { type: Boolean, default: true },
  },
  { _id: false }
);

const pillowProductSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    sides: { type: [{ type: String, enum: ['front', 'back'] }], default: ['front', 'back'] },
    minimumDesignedSides: { type: Number, enum: [1, 2], default: 1 },
    defaultLayout: { type: String, enum: ['full-bleed'], default: 'full-bleed' },
  },
  { _id: false }
);

const mugProductSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    defaultLayout: { type: String, enum: ['blank'], default: 'blank' },
  },
  { _id: false }
);

const tshirtPlacementSchema = new Schema(
  {
    id: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    additionalPrice: { type: Number, default: 0, min: 0 },
    designArea: { type: pillowDesignAreaSchema, default: () => ({ x: 34, y: 20, width: 32, height: 48, cornerRadius: 0 }) },
    printArea: {
      type: new Schema(
        {
          width: { type: Number, required: true, min: 0.0001 },
          height: { type: Number, required: true, min: 0.0001 },
          unit: { type: String, enum: ['inch', 'cm', 'mm'], default: 'inch' },
          bleed: { type: pillowInsetsSchema, default: () => ({}) },
          safeArea: { type: pillowInsetsSchema, default: () => ({}) },
        },
        { _id: false }
      ),
      required: true,
    },
  },
  { _id: false }
);

const tshirtColorSchema = new Schema(
  {
    value: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    swatchColor: { type: String, default: '', trim: true },
    swatchImageUrl: { type: String, default: '', trim: true },
    mockups: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { _id: false }
);

const tshirtProductSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    colorOptionKey: { type: String, default: 'Color', trim: true },
    sizeOptionKey: { type: String, default: 'Size', trim: true },
    defaultPlacementId: { type: String, default: 'front', trim: true },
    placements: { type: [tshirtPlacementSchema], default: [] },
    colors: { type: [tshirtColorSchema], default: [] },
  },
  { _id: false }
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
    thumbnailAssetId: { type: Schema.Types.ObjectId, ref: 'ImageAsset' },
    surface: { type: surfaceSchema, default: null },
    optionGroups: { type: [optionGroupSchema], default: [] },
    variantOptionDefinitions: { type: [variantOptionDefinitionSchema], default: defaultVariantOptionDefinitions },
    roomPreviews: { type: [productRoomPreviewSchema], default: [] },
    frontendContent: { type: frontendContentSchema, default: () => ({}) },
    editorProductSelection: { type: editorProductSelectionSchema, default: () => ({}) },
    variants: { type: [variantSchema], default: [] },
    editorRules: { type: editorRulesSchema, default: () => ({}) },
    exportRules: { type: exportRulesSchema, default: () => ({}) },
    layoutSettings: { type: layoutSettingsSchema, default: () => ({}) },
    aiArt: { type: aiArtSchema, default: () => ({ enabled: false }) },
    photoBook: { type: photoBookSchema, default: () => ({}) },
    pillow: { type: pillowProductSchema, default: () => ({}) },
    mug: { type: mugProductSchema, default: () => ({}) },
    tshirt: { type: tshirtProductSchema, default: () => ({}) },
  },
  { timestamps: true }
);

productSchema.pre('validate', function setNestedProductRefs() {
  if (this.surface) this.surface.productId = this._id;
  for (const group of this.optionGroups ?? []) {
    group.productId = this._id;
    for (const value of group.values ?? []) value.optionGroupId = group._id;
  }
  for (const definition of this.variantOptionDefinitions ?? []) definition.productId = this._id;
  for (const roomPreview of this.roomPreviews ?? []) roomPreview.productId = this._id;
  for (const variant of this.variants ?? []) {
    variant.productId = this._id;
    for (const roomPreview of variant.roomPreviews ?? []) roomPreview.variantId = variant._id;
  }
});
productSchema.index({ accountId: 1, scope: 1, merchantId: 1, categoryId: 1, slug: 1 }, { unique: true });
export const ProductModel = model('Product', productSchema);
