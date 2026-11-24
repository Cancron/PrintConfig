import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSelectedMerchantId, saveSelectedMerchantId } from '../../frontend/src/lib/storage.js';

test('selected merchant is stored per account and ignores the legacy global selection', () => {
  const values = new Map<string, string>([['print-config-selected-merchant', '6a3ec8c62d9f5c0bcff11d80']]);
  const previousStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    },
  });
  try {
    const firstAccount = 'd60b6d95-3aac-4db9-b4a7-145fb8a4943f';
    const secondAccount = 'baed6d95-3aac-4db9-b4a7-145fb8a4943f';
    assert.equal(loadSelectedMerchantId(firstAccount), '');
    saveSelectedMerchantId(firstAccount, 'e35f8a2a-cbc5-44fd-a454-5ad91349d72e');
    assert.equal(loadSelectedMerchantId(firstAccount), 'e35f8a2a-cbc5-44fd-a454-5ad91349d72e');
    assert.equal(loadSelectedMerchantId(secondAccount), '');
    assert.equal(loadSelectedMerchantId(''), '');
  } finally {
    if (previousStorage === undefined) delete (globalThis as { localStorage?: Storage }).localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previousStorage });
  }
});
