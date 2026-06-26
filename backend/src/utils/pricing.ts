export type PriceModifierType = 'none' | 'fixed' | 'percentage';

export interface PricingOptionValue {
  label: string;
  value: string;
  priceModifierType: PriceModifierType;
  priceModifier: number;
}

export function applyModifier(variantPrice: number, option: PricingOptionValue) {
  if (option.priceModifierType === 'fixed') return option.priceModifier;
  if (option.priceModifierType === 'percentage') return (variantPrice * option.priceModifier) / 100;
  return 0;
}
