import assert from 'node:assert/strict';
import test from 'node:test';
import { applyModifier, getVariantConfiguredPrice, type PricingOptionValue } from '../../src/utils/pricing.js';

function option(priceModifierType: PricingOptionValue['priceModifierType'], overrides: Partial<PricingOptionValue> = {}): PricingOptionValue {
  return { label: 'High gloss', value: 'hg', priceModifierType, priceModifier: 20, ...overrides };
}

test('fixed and no-charge modifiers', () => {
  assert.equal(applyModifier(100, option('fixed')), 20);
  assert.equal(applyModifier(100, option('none')), 0);
});

test('variant amount prefers value key and falls back to group key', () => {
  const variantOptions = { _hg: '35', _finish: '12' };
  assert.equal(getVariantConfiguredPrice(option('variant-fixed'), variantOptions, 'finish'), 35);
  assert.equal(applyModifier(100, option('variant-fixed'), { _finish: '12' }, 'finish'), 12);
  assert.ok(Number.isNaN(applyModifier(100, option('variant-fixed'), {}, 'finish')));
});

test('percentage uses variant price and clamps to minimum and maximum', () => {
  const percentage = option('percentage', { priceModifier: 100, priceModifierMin: 50, priceModifierMax: 400 });
  assert.equal(applyModifier(30, percentage), 50);
  assert.equal(applyModifier(250, percentage), 250);
  assert.equal(applyModifier(500, percentage), 400);
});
