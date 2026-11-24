import assert from 'node:assert/strict';
import test from 'node:test';
import { apiPayload, idOf } from '../../frontend/src/lib/apiIds.js';

test('admin API payload keeps persisted nested UUIDs and omits unsaved IDs', () => {
  const variantId = 'db729a70-05fb-48bc-a017-53232a78f644';
  const elementId = 'f472da1f-7cfb-4238-8a43-1a4a6828578f';
  const payload = apiPayload({
    id: '',
    clientId: 'browser-only',
    categoryId: '',
    variants: [{ id: variantId, clientId: 'temporary', options: { Color: 'White' } }],
    pages: [{ id: '', collageId: '7c4c829f-d5da-42cf-9bb6-4f7e3ad65a5d', elements: [{ id: elementId, type: 'text' }] }],
  });
  assert.equal('id' in payload, false);
  assert.equal('clientId' in payload, false);
  assert.equal('categoryId' in payload, false);
  assert.equal(payload.variants[0].id, variantId);
  assert.equal('clientId' in payload.variants[0], false);
  assert.equal('id' in payload.pages[0], false);
  assert.equal(payload.pages[0].elements[0].id, elementId);
  assert.equal(idOf({ id: variantId }), variantId);
  assert.equal(idOf({}), '');
});
