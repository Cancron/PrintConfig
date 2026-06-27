export type ProductType =
  | 'Canvas'
  | 'Fine Art Paper'
  | 'Matte Photo Paper'
  | 'Acrylic Face Mount Prints'
  | 'Poster Printing and Framing'
  | 'Luster Photo Paper'
  | 'Canvas Print'
  | 'Metal Print'
  | 'Poster Print'
  | 'Framed Poster'
  | 'T-Shirt'
  | 'Mug'
  | 'Business Card'
  | 'Sticker';

export type ProductStatus = 'Draft' | 'Active';
export type MerchantStatus = 'Draft' | 'Active';
export type ProductScope = 'shared' | 'merchant';
export type ProductCategoryStatus = 'active' | 'draft' | 'archived';
export type ProductUnit = 'inch' | 'mm' | 'px';
export type ProductOptionDisplayType = 'Dropdown' | 'Radio Buttons' | 'Color Swatches' | 'Image Swatches' | 'Text Buttons';
export type PriceModifierType = 'none' | 'fixed' | 'percentage';

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
  status: MerchantStatus;
  editorPrimaryColor: string;
  editorSecondaryColor: string;
  editorAccentColor: string;
  customCss: string;
  customJavascript: string;
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
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  previewImageUrl: string;
  thumbnailImageUrl: string;
  metadata: ProductOptionValueMetadata;
  createdAt: string;
  updatedAt: string;
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
  thumbnailImageUrl: string;
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
  categoryId: string;
  categorySnapshot?: ProductCategory;
  surface: ProductSurface | null;
  optionGroups: ProductOptionGroup[];
  editorRules: EditorRules;
  exportRules: ExportRules;
  templates: ProductTemplate[];
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

