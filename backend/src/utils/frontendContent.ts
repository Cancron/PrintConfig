/* eslint-disable @typescript-eslint/no-explicit-any */
import sanitizeHtml from 'sanitize-html';

const allowedTags = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li',
  'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'blockquote', 'div', 'span',
];

export function defaultFrontendContent() {
  return {
    promoText: '',
    uploadHeading: 'Start with a photo you love',
    uploadDescription: "Upload from your phone, laptop, or camera roll. We'll show you exactly how it will look before you pay.",
    uploadButtonText: 'Upload Your Photo',
    uploadRequirementsText: 'JPG - PNG - WEBP | MAX 12MB | RECOMMENDED 300 DPI',
    topCtaLabel: 'DESIGN YOUR PRODUCT', productTitleOverride: '', showReviews: true, reviewRating: 4.9, reviewCount: 4777, reviewLabel: 'reviews',
    showPrecheckMessage: true, precheckStatus: 'success', precheckTitle: 'Pre-Check looks great!', precheckMessage: "We'll contact you if your image quality doesn't fit. Your satisfaction is the key to our success!",
    resizeLabel: 'Resize', rotateLabel: 'Rotate', resetLabel: 'Reset', cropLabel: 'Crop', changePhotoLabel: 'Change photo', previewLabel: 'Preview',
    sizeSectionLabel: 'Size', showAllSizesLabel: 'SHOW ALL SIZES & RATIOS',
    quantityLabel: 'Quantity', priceLabel: 'Price', salePriceLabel: 'Price', savingsLabel: 'Save', orderButtonText: 'Order Now', addAnotherImageText: 'Add Another Image',
    showSupportBox: true, supportLabel: 'Need help?', supportPhone: '+1-825-977-3451', supportEmail: '', supportIcon: 'phone', supportMessage: '', productDetailHtml: '',
    showTopCta: true, showReviewBlock: true, showTrustBadges: true, showProductDetailDescription: true, frontendLayoutStyle: 'standard',
    trustBadges: [
      { icon: '🚚', text: 'Free shipping Canada-wide', sortOrder: 1, isActive: true },
      { icon: '⚡', text: '24-hour production', sortOrder: 2, isActive: true },
      { icon: '🛡️', text: 'Lifetime warranty', sortOrder: 3, isActive: true },
      { icon: '🇨🇦', text: 'Made in Canada', sortOrder: 4, isActive: true },
    ],
  };
}

export function normalizeFrontendContentPayload(content: any) {
  const defaults = defaultFrontendContent();
  return { ...defaults, ...(content ?? {}), trustBadges: content?.trustBadges === undefined ? defaults.trustBadges : content.trustBadges };
}
export function sanitizeProductDetailHtml(html: unknown) {
  return sanitizeHtml(String(html ?? ''), {
    allowedTags,
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel', 'class'],
      img: ['src', 'alt', 'title', 'class'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
    },
  });
}

export function publicFrontendContent(content: any = {}) {
  content = normalizeFrontendContentPayload(content);
  return {
    promoText: content.promoText ?? '',
    uploadHeading: content.uploadHeading ?? '',
    uploadDescription: content.uploadDescription ?? '',
    uploadButtonText: content.uploadButtonText ?? '',
    uploadRequirementsText: content.uploadRequirementsText ?? '',
    topCtaLabel: content.topCtaLabel ?? '',
    productTitleOverride: content.productTitleOverride ?? '',
    showReviews: content.showReviews !== false,
    reviewRating: content.reviewRating ?? 0,
    reviewCount: content.reviewCount ?? 0,
    reviewLabel: content.reviewLabel ?? '',
    showPrecheckMessage: content.showPrecheckMessage !== false,
    precheckStatus: content.precheckStatus ?? 'success',
    precheckTitle: content.precheckTitle ?? '',
    precheckMessage: content.precheckMessage ?? '',
    resizeLabel: content.resizeLabel ?? '',
    rotateLabel: content.rotateLabel ?? '',
    resetLabel: content.resetLabel ?? '',
    cropLabel: content.cropLabel ?? '',
    changePhotoLabel: content.changePhotoLabel ?? '',
    previewLabel: content.previewLabel ?? '',
    sizeSectionLabel: content.sizeSectionLabel ?? '',
    showAllSizesLabel: content.showAllSizesLabel ?? '',
    quantityLabel: content.quantityLabel ?? '',
    priceLabel: content.priceLabel ?? '',
    salePriceLabel: content.salePriceLabel ?? '',
    savingsLabel: content.savingsLabel ?? '',
    orderButtonText: content.orderButtonText ?? '',
    addAnotherImageText: content.addAnotherImageText ?? '',
    showSupportBox: content.showSupportBox !== false,
    supportLabel: content.supportLabel ?? '',
    supportPhone: content.supportPhone ?? '',
    supportEmail: content.supportEmail ?? '',
    supportIcon: content.supportIcon ?? '',
    supportMessage: content.supportMessage ?? '',
    productDetailHtml: sanitizeProductDetailHtml(content.productDetailHtml),
    showTopCta: content.showTopCta !== false,
    showReviewBlock: content.showReviewBlock !== false,
    showTrustBadges: content.showTrustBadges !== false,
    showProductDetailDescription: content.showProductDetailDescription !== false,
    frontendLayoutStyle: content.frontendLayoutStyle ?? 'standard',
    trustBadges: (content.trustBadges ?? [])
      .filter((badge: any) => badge.isActive !== false)
      .sort((a: any, b: any) => Number(a.sortOrder) - Number(b.sortOrder))
      .map((badge: any) => ({
        id: String(badge._id ?? ''),
        icon: badge.icon ?? '',
        text: badge.text ?? '',
        sortOrder: Number(badge.sortOrder) || 0,
      })),
  };
}
