export type ProductType =
  | 'Canvas Print'
  | 'Poster Print'
  | 'Framed Poster'
  | 'T-Shirt'
  | 'Mug'
  | 'Business Card'
  | 'Sticker';

export type ProductStatus = 'Draft' | 'Active';

export interface BleedSettings {
  top: number;
  right: number;
  bottom: number;
  left: number;
  unit: 'mm' | 'in' | 'px';
}

export interface SafeAreaSettings {
  top: number;
  right: number;
  bottom: number;
  left: number;
  unit: 'mm' | 'in' | 'px';
}

export interface ProductSurface {
  id: string;
  variantId: string;
  name: string;
  code: string;
  width: number;
  height: number;
  unit: 'mm' | 'in' | 'px';
  dpi: number;
  bleed: BleedSettings;
  safeArea: SafeAreaSettings;
  backgroundColor: string;
  allowTransparency: boolean;
  sortOrder: number;
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

export interface ExportRules {
  id: string;
  productId: string;
  outputFormat: 'pdf' | 'png' | 'tiff';
  colorSpace: 'rgb' | 'cmyk';
  resolution: number;
  includeBleed: boolean;
  includeSafeArea: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  status: ProductStatus;
  options: Record<string, string>;
  surfaces: ProductSurface[];
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  merchantId: string;
  name: string;
  slug: string;
  description: string;
  productType: ProductType;
  status: ProductStatus;
  basePrice: number;
  thumbnailUrl: string;
  editorRules: EditorRules;
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}
