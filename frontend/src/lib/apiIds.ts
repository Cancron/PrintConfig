export function idOf(value: { id?: unknown } | null | undefined) {
  return String(value?.id ?? '');
}

export function apiPayload<T>(value: T): T {
  if (Array.isArray(value)) return value.map(apiPayload) as T;
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === 'clientId' || (key === 'id' && !child)) continue;
      if (!child && ['productId', 'optionGroupId', 'variantId', 'surfaceId', 'categoryId', 'thumbnailAssetId', 'backgroundImageAssetId', 'imageAssetId'].includes(key)) continue;
      output[key] = apiPayload(child);
    }
    return output as T;
  }
  return value;
}
