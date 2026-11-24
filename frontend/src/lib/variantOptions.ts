import type { Product, ProductVariant, VariantOptionDefinition } from '../types';

const DEFAULT_NAMES = ['Size', 'Orientation', 'Ratio'] as const;

export function createDefaultVariantOptionDefinitions(productId = ''): VariantOptionDefinition[] {
  const now = new Date().toISOString();
  return DEFAULT_NAMES.map((name, index) => ({
    id: '',
    clientId: crypto.randomUUID(),
    productId,
    name,
    key: name,
    required: false,
    groupBy: false,
    sortOrder: index + 1,
    createdAt: now,
    updatedAt: now,
  }));
}

export function normalizeVariantOptionDefinitions(
  definitions: VariantOptionDefinition[] | undefined,
  productId: string,
): VariantOptionDefinition[] {
  const source = definitions === undefined ? createDefaultVariantOptionDefinitions(productId) : definitions;
  return source.map((definition, index) => ({
    ...definition,
    id: definition.id ? String(definition.id) : '',
    productId,
    name: String(definition.name ?? '').trim(),
    key: String(definition.key ?? '').trim(),
    required: definition.required === true,
    groupBy: definition.groupBy === true,
    sortOrder: Number.isFinite(Number(definition.sortOrder)) ? Number(definition.sortOrder) : index + 1,
    createdAt: definition.createdAt ?? new Date().toISOString(),
    updatedAt: definition.updatedAt ?? new Date().toISOString(),
  }));
}

export function ensureTShirtVariantOptionDefinitions(
  definitions: VariantOptionDefinition[],
  colorKey = 'Color',
  sizeKey = 'Size',
  previousColorKey = colorKey,
  previousSizeKey = sizeKey,
): VariantOptionDefinition[] {
  const now = new Date().toISOString();
  const result = definitions.map((definition) => ({ ...definition }));
  for (const [name, key, previousKey] of [['Color', colorKey, previousColorKey], ['Size', sizeKey, previousSizeKey]] as const) {
    const existing = result.find((definition) => definition.key.toLowerCase() === key.toLowerCase())
      ?? result.find((definition) => definition.key.toLowerCase() === previousKey.toLowerCase());
    if (existing) {
      existing.key = key;
      existing.name = name;
      existing.required = true;
      continue;
    }
    result.push({
      id: '',
      clientId: crypto.randomUUID(),
      productId: definitions[0]?.productId ?? '',
      name,
      key,
      required: true,
      groupBy: false,
      sortOrder: result.length + 1,
      createdAt: now,
      updatedAt: now,
    });
  }
  return result;
}

export function missingRequiredVariantOptions(
  variant: Pick<ProductVariant, 'options'>,
  definitions: VariantOptionDefinition[],
) {
  return definitions.filter((definition) => definition.required && !String(variant.options[definition.key] ?? '').trim());
}

export function productHasRequiredVariantOptionValues(product: Product) {
  return product.variants.every(
    (variant) => missingRequiredVariantOptions(variant, product.variantOptionDefinitions).length === 0,
  );
}
