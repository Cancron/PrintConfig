import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { renderDesignPageToImageBuffer } from '../../src/utils/designRenderer.js';

function page(backgroundOpacity: number) {
  return { elements: [{ type: 'text', x: 10, y: 20, width: 80, height: 20, rotation: 0, content: 'Hello', style: {
    fontSize: 12, color: '#ff0000', backgroundColor: '#777777', backgroundOpacity,
    backgroundPadding: 0, backgroundRadius: 0,
  } }] };
}

async function pixel(buffer: Buffer, x: number, y: number) {
  const image = await loadImage(buffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  return [...ctx.getImageData(x, y, 1, 1).data];
}

test('PNG output has requested dimensions and text background', async () => {
  const buffer = await renderDesignPageToImageBuffer({ design: {}, page: page(1), widthPx: 100, heightPx: 100, format: 'png' });
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(buffer.readUInt32BE(16), 100);
  assert.equal(buffer.readUInt32BE(20), 100);
  assert.deepEqual((await pixel(buffer, 12, 22)).slice(0, 3), [119, 119, 119]);
});

test('JPEG output composites white and preserves opaque text background', async () => {
  const buffer = await renderDesignPageToImageBuffer({ design: {}, page: page(1), widthPx: 100, heightPx: 100, format: 'jpeg', quality: 0.94 });
  assert.equal(buffer.subarray(0, 2).toString('hex'), 'ffd8');
  const outside = await pixel(buffer, 2, 2);
  const inside = await pixel(buffer, 12, 22);
  assert.ok(outside[0] > 240 && outside[1] > 240 && outside[2] > 240);
  assert.ok(inside[0] < 170 && inside[1] < 170 && inside[2] < 170);
});

test('old text without a background stays on the page matte', async () => {
  const buffer = await renderDesignPageToImageBuffer({ design: {}, page: page(0), widthPx: 100, heightPx: 100, format: 'jpeg' });
  const inside = await pixel(buffer, 12, 22);
  assert.ok(inside[0] > 240 && inside[1] > 240 && inside[2] > 240);
});
