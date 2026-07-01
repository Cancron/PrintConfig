import DOMPurify from 'dompurify';
import type { ProductFrontendContent, ProductTrustBadge } from '../types';

export const allowedHtmlTags = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li',
  'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'blockquote', 'div', 'span',
];

export function sanitizeProductHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowedHtmlTags,
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'class'],
    ALLOW_DATA_ATTR: false,
  });
}

export function createDefaultFrontendContent(): ProductFrontendContent {
  const now = new Date().toISOString();
  const badges: Array<[string, string]> = [
    ['🚚', 'Free shipping Canada-wide'],
    ['⚡', '24-hour production'],
    ['🛡️', 'Lifetime warranty'],
    ['🇨🇦', 'Made in Canada'],
  ];
  return {
    promoText: '',
    uploadHeading: 'Start with a photo you love',
    uploadDescription: "Upload from your phone, laptop, or camera roll. We'll show you exactly how it will look before you pay.",
    uploadButtonText: 'Upload Your Photo',
    uploadRequirementsText: 'JPG - PNG - WEBP | MAX 12MB | RECOMMENDED 300 DPI',
    topCtaLabel: 'DESIGN YOUR PRODUCT',
    productTitleOverride: '',
    showReviews: true,
    reviewRating: 4.9,
    reviewCount: 4777,
    reviewLabel: 'reviews',
    showPrecheckMessage: true,
    precheckStatus: 'success',
    precheckTitle: 'Pre-Check looks great!',
    precheckMessage: "We'll contact you if your image quality doesn't fit. Your satisfaction is the key to our success!",
    resizeLabel: 'Resize',
    rotateLabel: 'Rotate',
    resetLabel: 'Reset',
    cropLabel: 'Crop',
    changePhotoLabel: 'Change photo',
    previewLabel: 'Preview',
    sizeSectionLabel: 'Size',
    showAllSizesLabel: 'SHOW ALL SIZES & RATIOS',
    quantityLabel: 'Quantity',
    priceLabel: 'Price',
    salePriceLabel: 'Price',
    savingsLabel: 'Save',
    orderButtonText: 'Order Now',
    addAnotherImageText: 'Add Another Image',
    showSupportBox: true,
    supportLabel: 'Need help?',
    supportPhone: '+1-825-977-3451',
    supportEmail: '',
    supportIcon: 'phone',
    supportMessage: '',
    productDetailHtml: '',
    showTopCta: true,
    showReviewBlock: true,
    showTrustBadges: true,
    showProductDetailDescription: true,
    frontendLayoutStyle: 'standard',
    trustBadges: badges.map(([icon, text], index) => ({
      _id: '',
      clientId: crypto.randomUUID(),
      icon,
      text,
      sortOrder: index + 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })),
  };
}

export function normalizeFrontendContent(input?: Partial<ProductFrontendContent> | null): ProductFrontendContent {
  const defaults = createDefaultFrontendContent();
  return {
    ...defaults,
    ...(input ?? {}),
    trustBadges: input?.trustBadges === undefined
      ? defaults.trustBadges
      : input.trustBadges.map((badge, index) => normalizeTrustBadge(badge, index)),
  };
}

export function normalizeTrustBadge(input: Partial<ProductTrustBadge>, index: number): ProductTrustBadge {
  const now = new Date().toISOString();
  return {
    _id: input._id ? String(input._id) : '',
    clientId: input.clientId ?? crypto.randomUUID(),
    icon: String(input.icon ?? ''),
    text: String(input.text ?? ''),
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : index + 1,
    isActive: input.isActive !== false,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}
