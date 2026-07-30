export type ProductType =
  | 'Canvas Print'
  | 'Framed Print'
  | 'Metal Print'
  | 'Photo Print'
  | 'Photo Collage Print'
  | 'Photo Book Print'
  | 'Pillow Print'
  | 'Mug Print'
  | 'AI Art Generation'
  | 'Art Print'
  | 'T-Shirt Print'
  | 'Business Card'
  | 'Sticker';

export type EditorProductSelectionMode = 'single' | 'same-category' | 'specific';

export interface EditorProductSelection {
  mode: EditorProductSelectionMode;
  specificProductIds: string[];
}
export type ProductStatus = 'Draft' | 'Active';
export type MerchantStatus = 'Draft' | 'Active';
export type ProductScope = 'shared' | 'merchant';
export type ProductCategoryStatus = 'active' | 'draft' | 'archived';
export type LayoutStatus = 'active' | 'draft' | 'archived';
export type ProductLayoutTemplateMode = 'none' | 'all' | 'specific' | 'by-tags';
export type LayoutTemplateType = 'photo_collage' | 'photo_book' | 'calendar' | 'card' | 'poster' | 'canvas' | 'custom';
export type LayoutOrientation = 'portrait' | 'landscape' | 'square' | 'custom';
export type LayoutElementType = 'photo_placeholder' | 'text_placeholder' | 'shape' | 'background' | 'clipart' | 'static_image';
export type LayoutPhotoFitMode = 'cover' | 'contain' | 'stretch';
export type LayoutMaskShape = 'rectangle' | 'circle' | 'rounded_rectangle' | 'custom';
export type LayoutShapeType = 'rectangle' | 'circle' | 'line' | 'path';
export type ProductUnit = 'inch' | 'mm' | 'px';
export type ProductOptionDisplayType = 'Dropdown' | 'Radio Buttons' | 'Color Swatches' | 'Image Swatches' | 'Text Buttons';
export type PriceModifierType = 'none' | 'fixed' | 'variant-fixed' | 'variant-override' | 'percentage';
export type PhotoBookCoverType = 'softcover' | 'hardcover' | 'layflat' | 'custom';
export type PhotoBookBindingType = 'perfect' | 'saddle_stitch' | 'spiral' | 'layflat';
export type PillowPrintUnit = 'inch' | 'cm' | 'mm';
export type PillowSide = 'front' | 'back';
export type MugPrintUnit = 'inch' | 'cm' | 'mm';
export type TShirtPrintUnit = 'inch' | 'cm' | 'mm';

export interface ImageFolder {
  _id: string;
  accountId: string;
  merchantId?: string | null;
  scope: ProductScope;
  parentFolderId?: string | null;
  name: string;
  slug: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ImageAsset {
  _id: string;
  accountId: string;
  merchantId?: string | null;
  scope: ProductScope;
  folderId?: string | null;
  name: string;
  filename: string;
  originalFilename: string;
  url: string;
  publicUrl: string;
  thumbnailUrl?: string;
  storageProvider: 'supabase';
  bucket: string;
  storagePath: string;
  mimeType: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  altText?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ImagePickerValue {
  assetId: string;
  url: string;
  thumbnailUrl?: string;
  name: string;
  altText?: string;
  storagePath: string;
}

export type DesignCartItemStatus = 'cart' | 'ordered' | 'abandoned';
export type PrintGenerationStatus = 'not_ready' | 'pending' | 'processing' | 'complete' | 'failed';

export interface DesignStorageFile {
  url: string;
  publicUrl: string;
  storageProvider: 'supabase';
  bucket: string;
  storagePath: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface DesignProcessingJob {
  _id: string;
  cartItemId: string;
  merchantId: string;
  productId: string;
  accountId: string;
  type: 'final-print-generation';
  status: 'pending' | 'processing' | 'complete' | 'failed' | 'cancelled';
  attempts: number;
  orderId: string;
  sourcePrefix: string;
  orderPrefix: string;
  error: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface DesignCartItem {
  _id: string;
  accountId: string;
  merchantId: string;
  productId: string;
  productType: ProductType;
  product?: { _id: string; name: string; slug: string; productType: string } | null;
  userKey: string;
  projectId: string;
  status: DesignCartItemStatus;
  designStoragePath: string;
  designPublicBaseUrl: string;
  designPublicUrl: string;
  tempStoragePrefix: string;
  orderStoragePrefix: string;
  orderId: string;
  image?: DesignStorageFile;
  pagePreviews: Array<DesignStorageFile & { pageId?: string; placementId?: string; pageNumber?: number }>;
  finalPrintFiles: DesignStorageFile[];
  printGenerationStatus: PrintGenerationStatus;
  printGenerationError: string;
  printGenerationTotalPages: number;
  printGenerationCompletedPages: number;
  printGenerationCurrentPage: number;
  latestJob?: DesignProcessingJob | null;
  addedToCartAt: string;
  orderedAt?: string;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}
export interface Account {
  _id: string;
  name: string;
}

export interface Merchant {
  _id: string;
  accountId: string;
  name: string;
  slug: string;
  logoUrl: string;
  logoAssetId?: string;
  status: MerchantStatus;
  editorPrimaryColor: string;
  editorSecondaryColor: string;
  editorAccentColor: string;
  customCss: string;
  customJavascript: string;
  apiPrivateKeyLastFour?: string;
  apiPrivateKeyCreatedAt?: string;
}

export interface ProductCategory {
  _id: string;
  accountId: string;
  merchantId?: string | null;
  scope: ProductScope;
  name: string;
  slug: string;
  description: string;
  status: ProductCategoryStatus;
  thumbnailUrl: string;
  thumbnailAssetId?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}


export interface LayoutCategory {
  _id: string;
  accountId: string;
  merchantId?: string | null;
  scope: ProductScope;
  name: string;
  slug: string;
  description: string;
  status: LayoutStatus;
  thumbnailUrl: string;
  thumbnailAssetId?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface LayoutPhotoSettings {
  fitMode: LayoutPhotoFitMode;
  allowCrop: boolean;
  allowRotate: boolean;
  allowReplace: boolean;
  placeholderIndex: number;
  maskShape: LayoutMaskShape;
}

export interface LayoutTextSettings {
  defaultText: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  maxCharacters?: number;
}

export interface LayoutShapeSettings {
  shapeType: LayoutShapeType;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  borderRadius: number;
  svgPath?: string;
  svgViewBox?: string;
}

export interface LayoutImageSettings {
  imageUrl: string;
  imageAssetId?: string;
  opacity: number;
}

export interface LayoutElement {
  _id: string;
  clientId?: string;
  type: LayoutElementType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  required: boolean;
  editable: boolean;
  style: Record<string, unknown>;
  photoSettings: LayoutPhotoSettings;
  textSettings: LayoutTextSettings;
  shapeSettings: LayoutShapeSettings;
  imageSettings: LayoutImageSettings;
  createdAt: string;
  updatedAt: string;
}

export interface LayoutTemplatePage {
  _id: string;
  clientId?: string;
  pageNumber: number;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  backgroundImageUrl: string;
  backgroundImageAssetId?: string;
  collageId?: string | null;
  elements: LayoutElement[];
  createdAt: string;
  updatedAt: string;
}

export interface Collage {
  _id: string;
  accountId: string;
  merchantId?: string | null;
  scope: ProductScope;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  status: LayoutStatus;
  thumbnailUrl: string;
  thumbnailAssetId?: string;
  orientation: LayoutOrientation;
  canvasWidth: number;
  canvasHeight: number;
  unit: ProductUnit;
  dpi: number;
  backgroundColor: string;
  backgroundImageUrl: string;
  backgroundImageAssetId?: string;
  tags: string[];
  sortOrder: number;
  elements: LayoutElement[];
  createdAt: string;
  updatedAt: string;
}
export interface LayoutTemplate {
  _id: string;
  accountId: string;
  merchantId?: string | null;
  scope: ProductScope;
  categoryId?: string | null;
  name: string;
  slug: string;
  description: string;
  status: LayoutStatus;
  thumbnailUrl: string;
  thumbnailAssetId?: string;
  templateType: LayoutTemplateType;
  orientation: LayoutOrientation;
  pageCount: number;
  canvasWidth: number;
  canvasHeight: number;
  unit: ProductUnit;
  dpi: number;
  backgroundColor: string;
  tags: string[];
  sortOrder: number;
  pages: LayoutTemplatePage[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductLayoutSettings {
  enabled: boolean;
  mode: ProductLayoutTemplateMode;
  allowedTemplateIds: string[];
  allowedTemplateTags: string[];
  requireTemplateSelection: boolean;
}
export type PrecheckStatus = 'success' | 'warning' | 'info' | 'error';
export type FrontendLayoutStyle = 'standard' | 'compact' | 'premium';

export interface ProductTrustBadge {
  _id: string;
  clientId?: string;
  icon: string;
  text: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFrontendContent {
  promoText: string;
  uploadHeading: string;
  uploadDescription: string;
  uploadButtonText: string;
  uploadRequirementsText: string;
  topCtaLabel: string;
  productTitleOverride: string;
  showReviews: boolean;
  reviewRating: number;
  reviewCount: number;
  reviewLabel: string;
  showPrecheckMessage: boolean;
  precheckStatus: PrecheckStatus;
  precheckTitle: string;
  precheckMessage: string;
  resizeLabel: string;
  rotateLabel: string;
  resetLabel: string;
  cropLabel: string;
  changePhotoLabel: string;
  previewLabel: string;
  sizeSectionLabel: string;
  showAllSizesLabel: string;
  quantityLabel: string;
  priceLabel: string;
  salePriceLabel: string;
  savingsLabel: string;
  orderButtonText: string;
  addAnotherImageText: string;
  showSupportBox: boolean;
  supportLabel: string;
  supportPhone: string;
  supportEmail: string;
  supportIcon: string;
  supportMessage: string;
  productDetailHtml: string;
  showTopCta: boolean;
  showReviewBlock: boolean;
  showTrustBadges: boolean;
  showProductDetailDescription: boolean;
  frontendLayoutStyle: FrontendLayoutStyle;
  trustBadges: ProductTrustBadge[];
}
export interface VariantOptionDefinition {
  _id: string;
  clientId?: string;
  productId: string;
  name: string;
  key: string;
  required: boolean;
  groupBy: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
export interface ProductOptionValueMetadata {
  colorHex?: string;
  description?: string;
  productionCode?: string;
  exportNotes?: string;
}

export interface ProductOptionValue {
  _id: string;
  clientId?: string;
  optionGroupId: string;
  label: string;
  value: string;
  skuCode: string;
  priceModifierType: PriceModifierType;
  priceModifier: number;
  priceModifierMin?: number;
  priceModifierMax?: number;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  previewImageUrl: string;
  previewImageAssetId?: string;
  thumbnailImageUrl: string;
  thumbnailImageAssetId?: string;
  metadata: ProductOptionValueMetadata;
  createdAt: string;
  updatedAt: string;
}

export type DependencyCondition = 'equals' | 'not_equals' | 'in' | 'not_in';

export interface DependencyRule {
  dependsOnGroupCode: string;
  condition: DependencyCondition;
  allowedValues: string[];
}

export interface ProductOptionGroup {
  _id: string;
  clientId?: string;
  productId: string;
  name: string;
  code: string;
  displayType: ProductOptionDisplayType;
  required: boolean;
  sortOrder: number;
  values: ProductOptionValue[];
  dependencyRules: DependencyRule[];
  createdAt: string;
  updatedAt: string;
}

export interface BleedSettings {
  top: number;
  right: number;
  bottom: number;
  left: number;
  unit: ProductUnit;
}

export interface SafeAreaSettings {
  top: number;
  right: number;
  bottom: number;
  left: number;
  unit: ProductUnit;
}

export interface ProductSurface {
  _id: string;
  clientId?: string;
  productId: string;
  name: string;
  code: string;
  backgroundColor: string;
  allowTransparency: boolean;
  bleed: BleedSettings;
  safeArea: SafeAreaSettings;
  createdAt: string;
  updatedAt: string;
}

export interface EditorRules {
  allowImageUpload: boolean;
  allowCustomSize: boolean;
  allowAddText: boolean;
  allowClipart: boolean;
  allowBackgroundColor: boolean;
  allowBackgroundImage: boolean;
  allowCrop: boolean;
  allowRotate: boolean;
  allowDeleteObjects: boolean;
  allowLayersPanel: boolean;
  maxImageCount: number;
  maxTextCount: number;
  minimumDpiWarning: number;
  minimumDpiBlock: number;
  requirePlaceholdersFilled: boolean;
}

export type ExportFormat = 'PNG' | 'JPG' | 'PDF' | 'SVG';
export type ColorMode = 'RGB' | 'CMYK';

export interface ExportRules {
  format: ExportFormat;
  dpi: number;
  rasterQuality: number;
  includeBleed: boolean;
  flattenOutput: boolean;
  transparentBackground: boolean;
  backgroundColor: string;
  filenameTemplate: string;
  colorMode: ColorMode;
}

export type RoomOrientation = 'square' | 'vertical' | 'horizontal' | 'pano-vertical' | 'pano-horizontal';

export interface ProductRoomPreview {
  _id: string;
  clientId?: string;
  productId: string;
  name: string;
  roomImageUrl: string;
  roomImageAssetId?: string;
  orientations: RoomOrientation[];
  defaultOrientations: RoomOrientation[];
  centerLeftPercent: number;
  centerTopPercent: number;
  maxWidthPercent: number;
  maxHeightPercent: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface LegacyVariantRoomPreview {
  _id: string;
  clientId?: string;
  variantId: string;
  name: string;
  roomImageUrl: string;
  roomImageAssetId?: string;
  roomWidthMeters: number;
  roomHeightMeters?: number;
  centerLeftPercent: number;
  centerTopPercent: number;
  zoom: number;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
export interface ProductVariant {
  _id: string;
  clientId?: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  status: ProductStatus;
  options: Record<string, string>;
  width: number;
  height: number;
  unit: ProductUnit;
  dpi: number;
  previewImageUrl: string;
  previewImageAssetId?: string;
  thumbnailImageUrl: string;
  thumbnailImageAssetId?: string;
  pillow?: PillowVariantConfig;
  mug?: MugVariantConfig;
  roomPreviews?: LegacyVariantRoomPreview[];
  createdAt: string;
  updatedAt: string;
}

export interface AiArtStyle {
  _id: string;
  clientId?: string;
  name: string;
  slug: string;
  prompt: string;
  artTitlePrompt: string;
  additionalPrice: number;
  previewImageUrl: string;
  previewImageAssetId?: string;
  thumbnailImageUrl: string;
  thumbnailImageAssetId?: string;
  sortOrder: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AiArtConfig {
  enabled: boolean;
  sectionTitle: string;
  badgeText: string;
  helpText: string;
  requireUploadBeforeStyleSelection: boolean;
  maxUploadImages: number;
  defaultGeneratedImageCount: number;
  allowMultipleStyleSelection: boolean;
  showDescriptions: boolean;
  showAdditionalPrice: boolean;
  allowArtName: boolean;
  artNameFieldLabel: string;
  artNameFieldPlaceholder: string;
  styles: AiArtStyle[];
}

export interface PhotoBookConfig {
  enabled: boolean;
  maxPages: number;
  defaultPages: number;
  maxPhotoCount: number;
  pricePerExtraPage: number;
  pagesPerSpread: number;
  allowPageReorder: boolean;
  allowBlankPages: boolean;
  coverType: PhotoBookCoverType;
  bindingType: PhotoBookBindingType;
  paperType: string;
  startsWithCover: boolean;
  hasBackCover: boolean;
}

export interface PillowInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PillowDesignArea {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius?: number;
}

export interface PillowMockupConfig {
  imageUrl: string;
  imageAssetId?: string;
  thumbnailImageUrl?: string;
  thumbnailImageAssetId?: string;
  designArea: PillowDesignArea;
}

export interface PillowVariantConfig {
  shape: 'square' | 'rectangle';
  printArea: {
    width: number;
    height: number;
    unit: PillowPrintUnit;
    bleed: PillowInsets;
    safeArea: PillowInsets;
  };
  mockups: {
    front: PillowMockupConfig;
    back: PillowMockupConfig;
  };
}

export interface PillowProductConfig {
  enabled: boolean;
  sides: PillowSide[];
  minimumDesignedSides: 1 | 2;
  defaultLayout: 'full-bleed';
}

export interface MugInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MugVariantConfig {
  printArea: {
    width: number;
    height: number;
    unit: MugPrintUnit;
    bleed: MugInsets;
    safeArea: MugInsets;
  };
  model: {
    url: string;
    printableMaterialName: string;
  };
}

export interface MugProductConfig {
  enabled: boolean;
  defaultLayout: 'blank';
}

export interface TShirtInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface TShirtDesignArea {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius?: number;
}

export interface TShirtMockupConfig {
  imageUrl: string;
  thumbnailImageUrl?: string;
  imageAssetId?: string;
  thumbnailImageAssetId?: string;
  designArea?: TShirtDesignArea;
}

export interface TShirtPlacementConfig {
  id: string;
  label: string;
  additionalPrice: number;
  designArea: TShirtDesignArea;
  printArea: {
    width: number;
    height: number;
    unit: TShirtPrintUnit;
    bleed: TShirtInsets;
    safeArea: TShirtInsets;
  };
}

export interface TShirtColorConfig {
  value: string;
  label: string;
  swatchColor?: string;
  swatchImageUrl?: string;
  mockups: Record<string, TShirtMockupConfig>;
}

export interface TShirtProductConfig {
  enabled: boolean;
  colorOptionKey: string;
  sizeOptionKey: string;
  defaultPlacementId: string;
  placements: TShirtPlacementConfig[];
  colors: TShirtColorConfig[];
}

export interface ProductSummary {
  _id: string;
  accountId: string;
  merchantId?: string | null;
  scope: ProductScope;
  name: string;
  slug: string;
  productType: ProductType;
  status: ProductStatus;
  basePrice: number;
  thumbnailUrl: string;
  categoryId: string;
  variantCount: number;
  optionGroupCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DesignCartItemSummary {
  _id: string;
  accountId: string;
  merchantId: string;
  productId: string;
  productType: ProductType;
  product?: { _id: string; name: string; slug: string; productType: string } | null;
  userKey: string;
  projectId: string;
  status: DesignCartItemStatus;
  orderId: string;
  pagePreviews: Array<{ publicUrl?: string; url?: string; filename?: string }>;
  pagePreviewCount: number;
  finalPrintFiles: Array<{ publicUrl?: string; url?: string; filename?: string }>;
  finalPrintCount: number;
  printGenerationStatus: PrintGenerationStatus;
  printGenerationError: string;
  printGenerationTotalPages: number;
  printGenerationCompletedPages: number;
  printGenerationCurrentPage: number;
  latestJob?: DesignProcessingJob | null;
  addedToCartAt: string;
  orderedAt?: string;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  _id: string;
  accountId: string;
  merchantId?: string | null;
  scope: ProductScope;
  name: string;
  slug: string;
  description: string;
  productType: ProductType;
  status: ProductStatus;
  basePrice: number;
  thumbnailUrl: string;
  thumbnailAssetId?: string;
  categoryId: string;
  categorySnapshot?: ProductCategory;
  surface: ProductSurface | null;
  optionGroups: ProductOptionGroup[];
  variantOptionDefinitions: VariantOptionDefinition[];
  roomPreviews: ProductRoomPreview[];
  frontendContent: ProductFrontendContent;
  editorProductSelection: EditorProductSelection;
  editorRules: EditorRules;
  exportRules: ExportRules;
  layoutSettings: ProductLayoutSettings;
  variants: ProductVariant[];
  aiArt: AiArtConfig;
  photoBook: PhotoBookConfig;
  pillow: PillowProductConfig;
  mug: MugProductConfig;
  tshirt: TShirtProductConfig;
  createdAt: string;
  updatedAt: string;
}

