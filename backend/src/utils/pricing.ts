export type PriceModifierType = 'none' | 'fixed' | 'variant-fixed' | 'percentage';

export interface PricingOptionValue {
  label: string;
  value: string;
  priceModifierType: PriceModifierType;
  priceModifier: number;
}

export function applyModifier(variantPrice: number, option: PricingOptionValue, variantOptions: Record<string, string> = {}, groupCode = '') {
  if (option.priceModifierType === 'fixed') return option.priceModifier;
  if (option.priceModifierType === 'variant-fixed') {
    const optionPrice = variantOptions[`_${option.value}`];
    const groupPrice = variantOptions[`_${groupCode}`];
    const rawPrice = optionPrice !== undefined && String(optionPrice).trim() !== '' ? optionPrice : groupPrice;
    return rawPrice !== undefined && String(rawPrice).trim() !== '' ? Number(rawPrice) : Number.NaN;
  }
  if (option.priceModifierType === 'percentage') return (variantPrice * option.priceModifier) / 100;
  return 0;
}
