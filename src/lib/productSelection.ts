import type { EditorProductSelection } from '../types';

export function createDefaultEditorProductSelection(): EditorProductSelection {
  return { mode: 'single', specificProductIds: [] };
}

export function normalizeEditorProductSelection(input?: Partial<EditorProductSelection> | null): EditorProductSelection {
  const mode = input?.mode === 'same-category' || input?.mode === 'specific' ? input.mode : 'single';
  return {
    mode,
    specificProductIds: Array.isArray(input?.specificProductIds)
      ? [...new Set(input.specificProductIds.map(String).filter(Boolean))]
      : [],
  };
}
