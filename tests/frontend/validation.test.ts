import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProductBasicInfo, validateVariant, validateVariantOptions } from '../../frontend/src/lib/validation.ts';
import { ensureTShirtVariantOptionDefinitions } from '../../frontend/src/lib/variantOptions.ts';
import type { VariantOptionDefinition } from '../../frontend/src/types/index.ts';

test('product basic info accepts Photo Collage Print and rejects malformed values', () => {
  assert.deepEqual(validateProductBasicInfo({ name: 'Collage', slug: 'photo-collage', productType: 'Photo Collage Print', basePrice: 0 }), {});
  const errors = validateProductBasicInfo({ name: ' ', slug: 'Not Valid', productType: 'Unknown', basePrice: -1 });
  assert.ok(errors.name);
  assert.ok(errors.slug);
  assert.ok(errors.productType);
  assert.ok(errors.basePrice);
});

test('variant validation checks dimensions, DPI, and case-insensitive SKU uniqueness', () => {
  const base = { _id: 'new', name: 'Small', sku: 'SKU-1', price: 10, width: 8, height: 10, unit: 'inch', dpi: 300,
    existingSkus: [{ _id: 'existing', sku: 'sku-1' }] };
  const errors = validateVariant({ ...base, width: 0, dpi: 0 });
  assert.ok(errors.sku);
  assert.ok(errors.width);
  assert.ok(errors.dpi);
  assert.deepEqual(validateVariant({ ...base, sku: 'SKU-2' }), {});
});

test('required variant options and renamed T-shirt keys stay in sync', () => {
  const definition: VariantOptionDefinition = {
    _id: 'color-id', clientId: 'color-client', productId: 'product-id', name: 'Color', key: 'Color',
    required: true, groupBy: false, sortOrder: 1, createdAt: '', updatedAt: '',
  };
  const renamed = ensureTShirtVariantOptionDefinitions([definition], 'GarmentColor', 'Size', 'Color', 'Size');
  assert.equal(renamed.find((item) => item._id === 'color-id')?.key, 'GarmentColor');
  assert.equal(renamed.find((item) => item.key === 'Size')?.required, true);
  assert.ok(validateVariantOptions({ Size: 'M' }, renamed)['options.GarmentColor']);
  assert.deepEqual(validateVariantOptions({ GarmentColor: 'Black', Size: 'M' }, renamed), {});
});
