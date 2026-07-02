export type PriceModifierType = 'none' | 'fixed' | 'variant-fixed' | 'variant-override' | 'percentage';

export interface PricingOptionValue {
  label: string;
  value: string;
  priceModifierType: PriceModifierType;
  priceModifier: number;
  priceModifierMin?: number;
  priceModifierMax?: number;
}

export function getVariantConfiguredPrice(option: PricingOptionValue, variantOptions: Record<string, string> = {}, groupCode = '') {
  const optionPrice = variantOptions[`_${option.value}`];
  const groupPrice = variantOptions[`_${groupCode}`];
  const rawPrice = optionPrice !== undefined && String(optionPrice).trim() !== '' ? optionPrice : groupPrice;
  return rawPrice !== undefined && String(rawPrice).trim() !== '' ? Number(rawPrice) : Number.NaN;
}

export function applyModifier(variantPrice: number, option: PricingOptionValue, variantOptions: Record<string, string> = {}, groupCode = '') {
  if (option.priceModifierType === 'fixed') return option.priceModifier;
  if (option.priceModifierType === 'variant-fixed') return getVariantConfiguredPrice(option, variantOptions, groupCode);
  if (option.priceModifierType === 'percentage') {
    const calculated = (variantPrice * option.priceModifier) / 100;
    const minimum = Number.isFinite(option.priceModifierMin) ? Number(option.priceModifierMin) : Number.NEGATIVE_INFINITY;
    const maximum = Number.isFinite(option.priceModifierMax) ? Number(option.priceModifierMax) : Number.POSITIVE_INFINITY;
    return Math.min(maximum, Math.max(minimum, calculated));
  }
  return 0;
}