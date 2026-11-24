import assert from 'node:assert/strict';
import test from 'node:test';
import { getVariantRoomOrientation, hasLegacyRooms, liftLegacyProductRooms, orientationFromDimensions } from '../../src/utils/roomPreview.js';

test('room orientation uses dimensions and explicit options', () => {
  assert.equal(orientationFromDimensions(10, 10), 'square');
  assert.equal(orientationFromDimensions(10, 30), 'pano-vertical');
  assert.equal(orientationFromDimensions(30, 10), 'pano-horizontal');
  assert.equal(getVariantRoomOrientation({ width: 10, height: 20, options: { Orientation: 'Landscape' } }), 'horizontal');
  assert.equal(getVariantRoomOrientation({ width: 10, height: 20, options: new Map([['orientation', 'Portrait']]) }), 'vertical');
});

test('legacy rooms are lifted without leaving per-variant copies', () => {
  const product = { variants: [{ width: 10, height: 20, unit: 'inch', roomPreviews: [
    { name: 'Living Room', roomImageUrl: 'https://example.test/room.jpg', roomWidthMeters: 2, zoom: 1, isDefault: true },
  ] }] };
  assert.equal(hasLegacyRooms(product), true);
  const result = liftLegacyProductRooms(product);
  assert.equal(result.roomPreviews.length, 1);
  assert.deepEqual(result.roomPreviews[0].orientations, ['vertical']);
  assert.deepEqual(result.roomPreviews[0].defaultOrientations, ['vertical']);
  assert.equal('roomPreviews' in result.variants[0], false);
  assert.equal(hasLegacyRooms(result), false);
});
