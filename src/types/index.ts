export type ProductType =
  | 'Canvas Print'
  | 'Framed Print'
  | 'Metal Print'
  | 'Photo Print'
  | 'Photo Book Print'
  | 'AI Art Generation'
  | 'Art Print'
  | 'T-Shirt'
  | 'Mug'
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
export type LayoutTemplateType = 'photo_collage' | 'photo_book' | 'calendar' | 'card' | 'poster' | 'canvas' | 'custom';
export type LayoutOrientation = 'portrait' | 'landscape' | 'square' | 'custom';
export type LayoutElementType = 'photo_placeholder' | 'text_placeholder' | 'shape' | 'background' | 'clipart' | 'static_image';
export type LayoutPhotoFitMode = 'cover' | 'contain' | 'stretch';
export type LayoutMaskShape = 'rectangle' | 'circle' | 'rounded_rectangle' | 'custom';
export type LayoutShapeType = 'rectangle' | 'circle' | 'line' | 'path';
export type ProductUnit = 'inch' | 'mm' | 'px';
export type ProductOptionDisplayType = 'Dropdown' | 'Radio Buttons' | 'Color Swatches' | 'Image Swatches' | 'Text Buttons';
export type PriceModifierType = 'none' | 'fixed' | 'variant-fixed' | 'variant-override' | 'percentage';

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
  categoryId: string;
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
  allowedTemplateCategoryIds: string[];
  allowedTemplateIds: string[];
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
  includeBleed: boolean;
  flattenOutput: boolean;
  transparentBackground: boolean;
  backgroundColor: string;
  filenameTemplate: string;
  colorMode: ColorMode;
}

export type TemplateElementType = 'photo' | 'text';

export interface TemplateElement {
  _id: string;
  clientId?: string;
  name: string;
  type: TemplateElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  locked: boolean;
  editable: boolean;
}

export interface ProductTemplate {
  _id: string;
  clientId?: string;
  productId: string;
  name: string;
  status: ProductStatus;
  variantId: string;
  surfaceId: string;
  thumbnailUrl: string;
  elements: TemplateElement[];
  createdAt: string;
  updatedAt: string;
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
  templates: ProductTemplate[];
  layoutSettings: ProductLayoutSettings;
  variants: ProductVariant[];
  aiArt: AiArtConfig;
  createdAt: string;
  updatedAt: string;
}

